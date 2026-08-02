/* ==================================================================
 *  Asset references + costumes
 *
 *  THE EMOJI FIX.
 *
 *  v1 rendered placeholder art as a literal glyph:
 *
 *      <span style={{ fontSize }}>{a.emoji ?? a.def.appearance.char}</span>
 *
 *  The character was welded into the render call, so there was nothing to
 *  swap later. Using emoji as placeholder art is a good idea; making it a
 *  <span> is what was wrong.
 *
 *  Here an actor never names its art. It names a COSTUME, and a costume
 *  holds FRAMES, and a frame holds a SpriteRef — a tagged reference that
 *  resolves to pixels. `{ kind: "glyph" }` is one possible resolution and
 *  `{ kind: "image" }` is another. Swapping placeholder art for finished
 *  art is changing one field in one record; every consumer downstream
 *  (renderer, hit test, editor thumbnail, exporter) is unaffected because
 *  none of them ever look at the source kind.
 * ================================================================== */

export type SpriteRef =
  /** Placeholder art. Rendered through the same sprite path as everything else. */
  | { kind: "glyph"; char: string }
  /** Hand-drawn in the built-in pixel editor. */
  | { kind: "pixel"; grid: number; palette: string[]; pixels: number[][] }
  /** Primitive shape — cheap for platforms, bars, UI furniture. */
  | { kind: "shape"; shape: "rect" | "ellipse" | "triangle" | "star"; fill: string; stroke?: string }
  /** Real bitmap: data URI or packaged path. The endgame for finished art. */
  | { kind: "image"; src: string };

/** One animation cel. `hold` is in BEATS, so animation rides the tempo ramp. */
export interface Frame {
  ref: SpriteRef;
  /** Beats to hold this cel. 0.25 = a sixteenth. */
  hold: number;
}

export type Playback = "loop" | "pingpong" | "once" | "onceHide";

/**
 * A costume: one named animated appearance.
 *
 * The original GBA engine had exactly this — its sprite handler exposes
 * SET_ANIM / SET_PLAYBACK / SET_ANIM_CEL operations rather than one sprite
 * per state. So costumes are a restoration of the source design, not an
 * invention.
 */
export interface Costume {
  id: string;
  name: string;
  frames: Frame[];
  playback: Playback;
}

/* ---- runtime animation state (per instance) ---------------------- */
export interface AnimState {
  costume: string;
  frame: number;
  /** beats accumulated on the current cel */
  clock: number;
  dir: 1 | -1;
  playing: boolean;
  /** true when a costume switch cut an unfinished animation short */
  interrupted: boolean;
}

export const freshAnim = (costume: string): AnimState => ({
  costume,
  frame: 0,
  clock: 0,
  dir: 1,
  playing: true,
  interrupted: false,
});

export const findCostume = (costumes: Costume[], name: string): Costume | undefined =>
  costumes.find((c) => c.name === name);

/**
 * Switch costume.
 *
 * `restart = false` keeps the cel index where it can, so a mood swap on the
 * same pose doesn't visually pop. Mario Paint's animation tools let you cut
 * an animation mid-swing; `interrupted` records that so an event sheet can
 * tell "I was cut off" from "I finished".
 */
export function setCostume(
  anim: AnimState,
  costumes: Costume[],
  name: string,
  restart = true,
): void {
  const next = findCostume(costumes, name);
  if (!next) return;
  if (anim.costume === name && !restart) return;

  const prev = findCostume(costumes, anim.costume);
  anim.interrupted = anim.playing && !!prev && anim.frame < prev.frames.length - 1;

  anim.costume = name;
  if (restart) {
    anim.frame = 0;
    anim.clock = 0;
    anim.dir = 1;
  } else {
    anim.frame = Math.min(anim.frame, Math.max(0, next.frames.length - 1));
  }
  anim.playing = true;
}

/** Advance animation by `dtBeats`. Beat-locked: speeds up with the tempo ramp. */
export function advanceAnim(anim: AnimState, costumes: Costume[], dtBeats: number): void {
  if (!anim.playing) return;
  const c = findCostume(costumes, anim.costume);
  if (!c || c.frames.length <= 1) return;

  anim.clock += dtBeats;
  let guard = 0;
  while (guard++ < 64) {
    const hold = Math.max(0.01, c.frames[anim.frame]?.hold ?? 0.5);
    if (anim.clock < hold) break;
    anim.clock -= hold;

    switch (c.playback) {
      case "loop":
        anim.frame = (anim.frame + 1) % c.frames.length;
        break;
      case "pingpong": {
        const n = anim.frame + anim.dir;
        if (n >= c.frames.length || n < 0) anim.dir = (anim.dir * -1) as 1 | -1;
        anim.frame = Math.max(0, Math.min(c.frames.length - 1, anim.frame + anim.dir));
        break;
      }
      case "once":
        if (anim.frame < c.frames.length - 1) anim.frame++;
        else anim.playing = false;
        break;
      case "onceHide":
        if (anim.frame < c.frames.length - 1) anim.frame++;
        else anim.playing = false;
        break;
    }
  }
}

/** The cel to draw right now. */
export function currentRef(anim: AnimState, costumes: Costume[]): SpriteRef | null {
  const c = findCostume(costumes, anim.costume) ?? costumes[0];
  if (!c || !c.frames.length) return null;
  return c.frames[Math.min(anim.frame, c.frames.length - 1)]?.ref ?? null;
}

/* ---- constructors ------------------------------------------------ */
let cid = 0;
const nextId = () => `cos_${(++cid).toString(36)}${Date.now().toString(36).slice(-3)}`;

export const glyph = (char: string): SpriteRef => ({ kind: "glyph", char });

/** A one-cel costume. The common case, and what a fresh actor starts with. */
export function still(name: string, ref: SpriteRef): Costume {
  return { id: nextId(), name, frames: [{ ref, hold: 1 }], playback: "loop" };
}

/** A multi-cel costume from a list of refs at a uniform hold. */
export function anim(
  name: string,
  refs: SpriteRef[],
  hold = 0.25,
  playback: Playback = "loop",
): Costume {
  return { id: nextId(), name, frames: refs.map((ref) => ({ ref, hold })), playback };
}

/** Sugar: an animated costume straight from emoji, for fast placeholder work. */
export const glyphAnim = (name: string, chars: string[], hold = 0.25, playback: Playback = "loop"): Costume =>
  anim(name, chars.map(glyph), hold, playback);

/* ---- rendering size hint ---------------------------------------- */
/**
 * Fidelity is a NUMBER derived from context, not a "pixel or photoreal?"
 * question put to the user. Small canvases get crisp nearest-neighbour and
 * position snapping; large ones get smooth. It is exposed in Settings for
 * people who care, and invisible to everyone else.
 */
export interface Fidelity {
  /** internal render scale; <1 = chunkier */
  scale: number;
  smoothing: boolean;
  /** quantise positions to the internal pixel grid — this is what actually
   *  makes art read as "Flipnote/GBA", more than the filtering does */
  snap: boolean;
}

export function defaultFidelity(canvasW: number): Fidelity {
  if (canvasW <= 176) return { scale: 1, smoothing: false, snap: true };
  if (canvasW <= 320) return { scale: 1, smoothing: false, snap: true };
  return { scale: 1, smoothing: true, snap: false };
}
