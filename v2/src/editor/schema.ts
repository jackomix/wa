/* ================================================================== */
/*  Data-driven microgame schema                                        */
/*  A microgame is fully described by data: actors (with a behavior +   */
/*  appearance), a scene of placed instances, and an event sheet of     */
/*  condition/action rules. The runtime in runtime.ts compiles this     */
/*  into a live MicrogameDef.                                           */
/* ================================================================== */

import type { Key } from "../engine/types";

export type BehaviorType =
  | "static"
  | "platformer"
  | "8direction"
  | "physics"
  | "dragdrop";

export interface Behavior {
  type: BehaviorType;
  /** horizontal run / move speed (units per beat) */
  speed: number;
  /** platformer jump impulse (units per beat) */
  jump: number;
  /** gravity (units per beat^2) */
  gravity: number;
  /** velocity damping 0..1 per beat (physics / 8-dir drift) */
  friction: number;
  /** restitution 0..1 (physics bounce) */
  bounce: number;
}

/* ---- appearance ---------------------------------------------------
 * Appearance is a SpriteRef (see engine/assets.ts): a tagged *reference*
 * that resolves to pixels, never a baked-in glyph. `emoji` is one possible
 * resolution and `image` is another, so swapping placeholder art for
 * finished art is one field change with no downstream effects.
 * ------------------------------------------------------------------ */
export type Appearance =
  | { kind: "emoji"; char: string }
  | {
      kind: "pixel";
      grid: number; // cells per side (8/12/16/24/32)
      palette: string[];
      pixels: number[][]; // [row][col] = palette index, -1 = transparent
    }
  | { kind: "shape"; shape: "rect" | "ellipse" | "triangle" | "star"; fill: string; stroke?: string }
  | { kind: "image"; src: string };

/* ---- costumes -----------------------------------------------------
 * An actor has COSTUMES; each costume is an animated sequence of cels.
 * The event sheet switches between them by name ("run", "celebrate",
 * "sad"). Frame holds are in BEATS, so animation rides the tempo ramp
 * automatically instead of drifting when the game speeds up.
 *
 * The original GBA engine worked exactly this way — its sprite handler
 * exposes SET_ANIM / SET_PLAYBACK / SET_ANIM_CEL rather than one sprite
 * per state — so this is a restoration of the source design.
 * ------------------------------------------------------------------ */
export type Playback = "loop" | "pingpong" | "once" | "onceHide";

export interface CostumeFrame {
  app: Appearance;
  /** hold in beats; 0.25 = a sixteenth note */
  hold: number;
}

export interface Costume {
  id: string;
  name: string;
  frames: CostumeFrame[];
  playback: Playback;
}

/* ---- actor template ---------------------------------------------- */
export interface ActorDef {
  id: string;
  name: string;
  /** @deprecated kept so v1 saves keep loading; migration folds it into
   *  costumes[0]. Read `costumes` instead. */
  appearance?: Appearance;
  /** Named animated appearances. Always has at least one. */
  costumes: Costume[];
  /** Which costume an instance starts in. */
  defaultCostume: string;
  width: number; // units (percent of screen width)
  height: number; // units (percent of screen height)
  solid: boolean; // acts as a platform / wall for physics + platformer
  z: number; // draw order
  behavior: Behavior;
  vars: Record<string, number>;
}

/* ---- placed instance --------------------------------------------- */
export interface ActorInstance {
  id: string;
  defId: string;
  x: number; // center, 0..100
  y: number;
  scale: number;
  rot: number;
  visible: boolean;
  vars: Record<string, number>;
}

/* ---- scene ------------------------------------------------------- */
export type BgPattern = "none" | "grid" | "dots" | "stars";

export interface Scene {
  bgColor: string;
  bg2Color: string;
  gradient: boolean;
  pattern: BgPattern;
  floorY: number; // ground line (100 = no floor)
  groundColor: string;
  instances: ActorInstance[];
}

/* ---- event sheet ------------------------------------------------- */
export interface Condition {
  kind: string;
  params: Record<string, any>;
}
export interface Action {
  kind: string;
  params: Record<string, any>;
  /** if set, the action targets every live instance of this actor def
   *  instead of the event's "self" actor */
  targetDef?: string | null;
}
export interface GameEvent {
  id: string;
  name: string;
  forActor: string | null; // actor def iterated as "self", or null = scene-level
  enabled: boolean;
  conditions: Condition[];
  actions: Action[];
}

export interface Palette {
  outer: string;
  frame: string;
  screen: string;
  text: string;
}

/* ---- canvas -------------------------------------------------------
 * Per-microgame playfield size. The original varies its canvas between
 * microgames and the shell letterboxes whatever it is handed; preserving
 * that variation is part of the point.
 *
 * Actor coordinates stay 0..100 in both axes regardless — the canvas only
 * changes the ASPECT and the pixel density, so a microgame authored at one
 * size still reads correctly at another.
 * ------------------------------------------------------------------ */
export interface Canvas {
  w: number;
  h: number;
}

/** GBA native. The default, and what most recreations use. */
export const CANVAS_GBA: Canvas = { w: 240, h: 160 };

export interface MicrogameData {
  id: string;
  name: string;
  instruction: string;
  lengthBars: 2 | 4;
  timeoutOutcome: "win" | "lose";
  palette: Palette;
  scene: Scene;
  actors: ActorDef[];
  events: GameEvent[];
  /** optional per-game tempo when tested standalone */
  bpm?: number;
  /** playfield size; defaults to GBA native when absent */
  canvas?: Canvas;
  /** render fidelity; derived from canvas when absent, never asked up front */
  fidelity?: { scale: number; smoothing: boolean; snap: boolean };
  /** provenance note for recreations of original microgames */
  origin?: string;
  /** host/stage this belongs to */
  host?: string;
  /** per-difficulty scene-variable overrides (tiers 1..3, as in the original) */
  difficulty?: Record<1 | 2 | 3, Record<string, number>>;
}

/* ---- factories --------------------------------------------------- */
export const uid = (p = "id") =>
  `${p}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;

export function makeBehavior(t: BehaviorType): Behavior {
  switch (t) {
    case "platformer":
      return { type: t, speed: 32, jump: 40, gravity: 72, friction: 0, bounce: 0 };
    case "8direction":
      return { type: t, speed: 42, jump: 0, gravity: 0, friction: 6, bounce: 0 };
    case "physics":
      return { type: t, speed: 0, jump: 0, gravity: 60, friction: 0.4, bounce: 0.6 };
    case "dragdrop":
      return { type: t, speed: 0, jump: 0, gravity: 0, friction: 0, bounce: 0 };
    default:
      return { type: "static", speed: 0, jump: 0, gravity: 0, friction: 0, bounce: 0 };
  }
}

export function makeCostume(name: string, app: Appearance, playback: Playback = "loop"): Costume {
  return { id: uid("cos"), name, frames: [{ app, hold: 1 }], playback };
}

/** Multi-cel costume from a list of appearances at a uniform hold. */
export function makeAnimCostume(
  name: string,
  apps: Appearance[],
  hold = 0.25,
  playback: Playback = "loop",
): Costume {
  return { id: uid("cos"), name, frames: apps.map((app) => ({ app, hold })), playback };
}

/** Emoji sugar — the fast path for placeholder art. */
export const emojiCostume = (name: string, ...chars: string[]): Costume =>
  chars.length === 1
    ? makeCostume(name, { kind: "emoji", char: chars[0] })
    : makeAnimCostume(name, chars.map((c) => ({ kind: "emoji", char: c }) as Appearance));

export function makeActorDef(name: string, char = "⭐"): ActorDef {
  const idle = emojiCostume("idle", char);
  return {
    id: uid("act"),
    name,
    costumes: [idle],
    defaultCostume: "idle",
    width: 14,
    height: 14,
    solid: false,
    z: 1,
    behavior: makeBehavior("static"),
    vars: {},
  };
}

/* ---- migration -----------------------------------------------------
 * v1 saves have `appearance` and no costumes. Fold the old field into a
 * single "idle" costume so every microgame anyone already made keeps
 * working. Idempotent, so it is safe to run on load every time.
 * ------------------------------------------------------------------ */
export function migrateActor(a: any): ActorDef {
  if (!a.costumes || !Array.isArray(a.costumes) || a.costumes.length === 0) {
    const app: Appearance = a.appearance ?? { kind: "emoji", char: "⭐" };
    a.costumes = [makeCostume("idle", app)];
    a.defaultCostume = "idle";
  }
  if (!a.defaultCostume || !a.costumes.some((c: Costume) => c.name === a.defaultCostume)) {
    a.defaultCostume = a.costumes[0].name;
  }
  return a as ActorDef;
}

export function migrateGame(d: any): MicrogameData {
  if (!d) return d;
  if (Array.isArray(d.actors)) d.actors = d.actors.map(migrateActor);
  if (!d.canvas) d.canvas = { ...CANVAS_GBA };
  return d as MicrogameData;
}

export function makeInstance(defId: string, x = 50, y = 50): ActorInstance {
  return { id: uid("inst"), defId, x, y, scale: 1, rot: 0, visible: true, vars: {} };
}

export const KEY_OPTIONS: { value: Key; label: string }[] = [
  { value: "left", label: "◀ Left" },
  { value: "right", label: "Right ▶" },
  { value: "up", label: "▲ Up" },
  { value: "down", label: "▼ Down" },
  { value: "space", label: "Space ␣" },
];
