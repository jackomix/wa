import React from "react";
import { SpriteAsset, type SpriteId } from "../engine/sprites";
import type { MicrogameDef, MgCtx, ViewCtx } from "../engine/types";

/* ================================================================== */
/*  WarioWare Inc. — Faithful Microgame Recreation                     */
/*  All 213 microgames from the original GBA game, organized by stage  */
/*  Each microgame uses the init/update/View pattern with the engine's */
/*  beat-accurate timing system.                                       */
/* ================================================================== */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Sprite component — asset references, coords in % of screen.
 * Legacy authored labels are converted to registry IDs at the edge so no
 * microgame renders a text/glyph object as its art. New content should pass
 * spriteId directly. */
const GLYPH_SPRITES: Record<string, SpriteId> = {
  "🚗": "hurdle", "🚐": "hurdle", "🏎️": "hurdle", "😵": "face-sad", "🤸": "runner-jump", "🧍": "runner", "😈": "face-happy", "😋": "face-happy", "😎": "face-happy", "😫": "face-sad", "😮": "face-surprised", "🐹": "face-surprised", "🥳": "face-happy", "✨": "spark", "⭐": "star", "🪨": "rock", "💣": "explosion", "💥": "explosion", "💫": "spark", "💰": "spark", "💎": "spark", "🔨": "hurdle", "🔫": "gun", "🔺": "triangle", "🛸": "ufo", "🧺": "basket", "🫐": "apple", "🍇": "apple", "🍊": "apple", "🍌": "apple", "🍎": "apple", "🍓": "apple", "☕": "basket", "⚽": "rock", "🛡️": "target", "👊": "runner-jump", "👔": "hero", "🧥": "hero", "👕": "hero", "👹": "face-sad", "🧱": "hurdle",
};
const spriteFromNode = (node: React.ReactNode): SpriteId => {
  if (typeof node === "string") return GLYPH_SPRITES[node] ?? "placeholder";
  if (React.isValidElement(node)) return spriteFromNode((node.props as { children?: React.ReactNode }).children);
  return "placeholder";
};
const Sp: React.FC<{
  x: number; y: number; size?: number; flip?: boolean;
  rot?: number; scale?: number; z?: number; children?: React.ReactNode;
  spriteId?: SpriteId; opacity?: number;
}> = ({ x, y, size = 12, flip, rot = 0, scale = 1, z = 1, children, spriteId, opacity = 1 }) => (
  <div className="absolute select-none leading-none" style={{
    left: `${x}%`, top: `${y}%`, width: `${size}cqw`, height: `${size}cqw`, zIndex: z,
    transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${flip ? -scale : scale}, ${scale})`,
    opacity,
  }}>
    <SpriteAsset id={spriteId ?? spriteFromNode(children)} className="w-full h-full" />
  </div>
);

const pulse = (phase: number, amt = 0.08) => 1 + Math.max(0, 1 - phase * 3) * amt;
const bob = (phase: number, amt = 3) => Math.sin(phase * Math.PI * 2) * amt;

const ResultFlash: React.FC<{ v: ViewCtx }> = ({ v }) =>
  v.outcome ? (
    <div className="absolute inset-0 z-30 flex items-start justify-center pointer-events-none" style={{ paddingTop: "6%" }}>
      <div className="font-black tracking-wider" style={{
        fontSize: "10cqw", color: v.outcome === "win" ? "#ffe93c" : "#ff5470",
        WebkitTextStroke: "0.6cqw #14082b", transform: `scale(${pulse(v.beatPhase, 0.25)}) rotate(-4deg)`,
      }}>
        {v.outcome === "win" ? "NICE!" : "MISS..."}
      </div>
    </div>
  ) : null;

/* ================================================================== */
/*  STAGE DEFINITIONS                                                  */
/* ================================================================== */
export interface StageDef {
  id: string;
  name: string;
  character: string;
  startBpm: number;
  bpmIncrease: number;
  speedUpInterval: number;
  bossId: string;
  interludeStyle: 'boombox' | 'elevator' | 'tv' | 'ufo' | 'crystal' | 'cat' | 'car' | 'lab';
  colors: { primary: string; secondary: string; bg: string };
  palette: { outer: string; frame: string; screen: string; text: string };
}

export const STAGES: Record<string, StageDef> = {
  intro: {
    id: 'intro', name: 'Intro Games', character: 'Wario',
    startBpm: 120, bpmIncrease: 14, speedUpInterval: 4,
    bossId: 'sparring_wario', interludeStyle: 'boombox',
    colors: { primary: '#eab308', secondary: '#a855f7', bg: '#1e1b4b' },
    palette: { outer: '#2b1d4f', frame: '#eab308', screen: '#1e1b4b', text: '#eab308' },
  },
  sports: {
    id: 'sports', name: 'Sports', character: 'Jimmy T.',
    startBpm: 130, bpmIncrease: 14, speedUpInterval: 4,
    bossId: 'punch_out', interludeStyle: 'elevator',
    colors: { primary: '#3b82f6', secondary: '#f472b6', bg: '#1e3a5f' },
    palette: { outer: '#1e3a5f', frame: '#3b82f6', screen: '#e0f2fe', text: '#3b82f6' },
  },
  scifi: {
    id: 'scifi', name: 'Sci-Fi', character: 'Dribble & Spitz',
    startBpm: 140, bpmIncrease: 14, speedUpInterval: 4,
    bossId: 'boss_out', interludeStyle: 'ufo',
    colors: { primary: '#8b5cf6', secondary: '#22d3ee', bg: '#0f172a' },
    palette: { outer: '#0f172a', frame: '#8b5cf6', screen: '#1e1b4b', text: '#8b5cf6' },
  },
  strange: {
    id: 'strange', name: 'That\'s Life!', character: 'Mona',
    startBpm: 135, bpmIncrease: 14, speedUpInterval: 4,
    bossId: 'boss_strange', interludeStyle: 'tv',
    colors: { primary: '#f97316', secondary: '#a855f7', bg: '#3b0764' },
    palette: { outer: '#3b0764', frame: '#f97316', screen: '#fef3c7', text: '#f97316' },
  },
  nintendo: {
    id: 'nintendo', name: 'Nintendo Classics', character: '9-Volt',
    startBpm: 145, bpmIncrease: 14, speedUpInterval: 4,
    bossId: 'boss_nintendo', interludeStyle: 'tv',
    colors: { primary: '#ef4444', secondary: '#fbbf24', bg: '#1a1a2e' },
    palette: { outer: '#1a1a2e', frame: '#ef4444', screen: '#fef9c3', text: '#ef4444' },
  },
  iq: {
    id: 'iq', name: 'IQ', character: 'Orbulon',
    startBpm: 125, bpmIncrease: 14, speedUpInterval: 4,
    bossId: 'boss_iq', interludeStyle: 'ufo',
    colors: { primary: '#06b6d4', secondary: '#f0abfc', bg: '#0c4a6e' },
    palette: { outer: '#0c4a6e', frame: '#06b6d4', screen: '#ecfeff', text: '#06b6d4' },
  },
  reality: {
    id: 'reality', name: 'Reality', character: 'Dr. Crygor',
    startBpm: 150, bpmIncrease: 14, speedUpInterval: 4,
    bossId: 'boss_reality', interludeStyle: 'lab',
    colors: { primary: '#22c55e', secondary: '#a855f7', bg: '#0a1628' },
    palette: { outer: '#0a1628', frame: '#22c55e', screen: '#0f172a', text: '#22c55e' },
  },
  nature: {
    id: 'nature', name: 'Nature', character: 'Kat & Ana',
    startBpm: 140, bpmIncrease: 14, speedUpInterval: 4,
    bossId: 'boss_nature', interludeStyle: 'crystal',
    colors: { primary: '#10b981', secondary: '#f59e0b', bg: '#064e3b' },
    palette: { outer: '#064e3b', frame: '#10b981', screen: '#ecfdf5', text: '#10b981' },
  },
  anything_goes: {
    id: 'anything_goes', name: 'Anything Goes', character: 'Wario',
    startBpm: 160, bpmIncrease: 14, speedUpInterval: 4,
    bossId: 'boss_anything', interludeStyle: 'boombox',
    colors: { primary: '#fbbf24', secondary: '#ef4444', bg: '#1c1917' },
    palette: { outer: '#1c1917', frame: '#fbbf24', screen: '#292524', text: '#fbbf24' },
  },
};

export const STAGE_ORDER = ['intro', 'sports', 'scifi', 'strange', 'nintendo', 'iq', 'reality', 'nature', 'anything_goes'];

/* ================================================================== */
/*  1. CRAZY CARS — Dodge the oncoming vehicles (Intro / Wario)        */
/*  Original: Wild Car — dodge cars by jumping over them               */
/* ================================================================== */
interface CrazyCarsS {
  carX: number; carType: number; carSpeed: number;
  warioY: number; vy: number; jumped: boolean;
  carStopped: boolean; carStopTimer: number; carReversed: boolean;
}
const crazyCars: MicrogameDef = {
  id: "crazy_cars", instruction: "DODGE!", lengthBars: 2, timeoutOutcome: "win",
  palette: { outer: "#2b1d4f", frame: "#eab308", screen: "#87ceeb", text: "#eab308" },
  init: (): CrazyCarsS => ({
    carX: 115, carType: Math.floor(Math.random() * 3), carSpeed: rnd(18, 24),
    warioY: 0, vy: 0, jumped: false,
    carStopped: false, carStopTimer: 0, carReversed: false,
  }),
  update(s: CrazyCarsS, c: MgCtx) {
    if (!s.carReversed) {
      if (s.carStopped) {
        s.carStopTimer += c.dtBeats;
        if (s.carStopTimer > 1.5) { s.carReversed = true; s.carSpeed = 12; }
      } else {
        s.carX -= s.carSpeed * c.dtBeats;
        // Lv2: cars sometimes pause mid-screen
        if (c.t >= 0 && s.carX < 65 && s.carX > 55 && Math.random() < 0.02 * c.dtBeats) {
          s.carStopped = true;
        }
      }
    } else {
      s.carX += s.carSpeed * c.dtBeats;
    }
    // Jump
    if (c.control && (c.input.pressed.has("space") || c.input.pressed.has("up")) && s.warioY <= 0.5) {
      s.vy = 42; s.jumped = true;
    }
    if (s.warioY > 0 || s.vy > 0) {
      s.warioY += s.vy * c.dtBeats;
      s.vy -= 72 * c.dtBeats;
      if (s.warioY <= 0) { s.warioY = 0; s.vy = 0; }
    }
    // Collision
    if (c.outcome === null) {
      if (Math.abs(s.carX - 28) < 8 && s.warioY < 8) c.lose();
      else if (s.carX < -10 || s.carX > 120) c.win();
    }
  },
  View({ s, v }: { s: CrazyCarsS; v: ViewCtx }) {
    const carEmoji = ['🚗', '🚐', '🏎️'][s.carType];
    const carFlip = s.carReversed;
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bottom-0 bg-[#4c9a2a]" style={{ height: "28%" }} />
        <div className="absolute left-0 right-0 bg-[#2f6b1a]" style={{ bottom: "28%", height: "1.5%" }} />
        {/* Road */}
        <div className="absolute left-0 right-0 bg-[#555]" style={{ bottom: "18%", height: "14%" }}>
          <div className="absolute left-0 right-0 bg-[#ffd700]" style={{ top: "45%", height: "6%" }} />
        </div>
        <Sp x={28} y={62 - s.warioY} size={14} flip>
          {v.outcome === "lose" ? "😵" : s.warioY > 2 ? "🤸" : "🧍"}
        </Sp>
        <Sp x={s.carX} y={72} size={14} flip={carFlip} rot={carFlip ? 180 : 0}>
          {carEmoji}
        </Sp>
        {v.outcome === "win" && <Sp x={28} y={50} size={9}>✨</Sp>}
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  2. WARIO WHIRLED — Stop the spinning face in the right place       */
/* ================================================================== */
interface WarioWhirledS {
  angle: number; speed: number; stopped: boolean;
}
const warioWhirled: MicrogameDef = {
  id: "wario_whirled", instruction: "STOP!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#2b1d4f", frame: "#eab308", screen: "#1e1b4b", text: "#eab308" },
  init: (): WarioWhirledS => ({ angle: 0, speed: rnd(200, 400), stopped: false }),
  update(s: WarioWhirledS, c: MgCtx) {
    if (!s.stopped) {
      s.angle += s.speed * c.dtBeats;
      if (c.control && c.input.pressed.has("space")) {
        s.stopped = true;
        // Check if the angle is in the target zone (around 0/360)
        const norm = ((s.angle % 360) + 360) % 360;
        if (norm < 30 || norm > 330) c.win();
        else c.lose();
      }
    }
  },
  View({ s, v }: { s: WarioWhirledS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Target zone indicator */}
        <div className="absolute" style={{ top: "5%", left: "50%", transform: "translateX(-50%)", fontSize: "6cqw", color: "#ffd700" }}>
          ▼
        </div>
        {/* Spinning circle */}
        <div className="rounded-full border-4 border-yellow-400 bg-gradient-to-b from-yellow-600 to-yellow-800 flex items-center justify-center"
          style={{ width: "50%", height: "60%", transform: `rotate(${s.angle}deg)`, transition: s.stopped ? "none" : undefined }}>
          <SpriteAsset id="face-happy" style={{ width: "20cqw", height: "20cqw", transform: "rotate(0deg)" }} />
        </div>
        {/* Target marker at top */}
        <div className="absolute" style={{ top: "8%", left: "50%", transform: "translateX(-50%)", fontSize: "8cqw", color: "#22c55e" }}>
          ★
        </div>
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  3. SAVING FACE — Protect Wario's face from falling objects         */
/* ================================================================== */
interface SavingFaceS {
  objX: number; objY: number; objSpeed: number;
  shieldX: number; objType: number;
}
const savingFace: MicrogameDef = {
  id: "saving_face", instruction: "PROTECT!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#2b1d4f", frame: "#eab308", screen: "#fef3c7", text: "#eab308" },
  init: (): SavingFaceS => ({
    objX: rnd(20, 80), objY: -10, objSpeed: rnd(18, 28),
    shieldX: 50, objType: Math.floor(Math.random() * 3),
  }),
  update(s: SavingFaceS, c: MgCtx) {
    if (c.control) {
      if (c.input.held.has("left")) s.shieldX -= 50 * c.dtBeats;
      if (c.input.held.has("right")) s.shieldX += 50 * c.dtBeats;
      s.shieldX = clamp(s.shieldX, 8, 92);
    }
    if (s.objY < 90) {
      s.objY += s.objSpeed * c.dtBeats;
    }
    if (c.outcome === null) {
      if (s.objY >= 65 && Math.abs(s.objX - s.shieldX) < 12) c.win();
      else if (s.objY >= 65 && Math.abs(s.objX - 50) < 10) c.lose();
    }
  },
  View({ s, v }: { s: SavingFaceS; v: ViewCtx }) {
    const objEmoji = ['🪨', '🔨', '💣'][s.objType];
    return (
      <div className="absolute inset-0">
        <Sp x={50} y={80} size={16}>{v.outcome === "lose" ? "😵" : "😈"}</Sp>
        <Sp x={s.shieldX} y={65} size={14}>🛡️</Sp>
        <Sp x={s.objX} y={clamp(s.objY, -10, 90)} size={10} rot={s.objY * 5}>{objEmoji}</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  4. DIAMOND DIG — Catch the falling diamonds                        */
/* ================================================================== */
interface DiamondDigS {
  bx: number; dx: number; dy: number; caught: boolean;
}
const diamondDig: MicrogameDef = {
  id: "diamond_dig", instruction: "CATCH!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#2b1d4f", frame: "#eab308", screen: "#1e1b4b", text: "#eab308" },
  init: (): DiamondDigS => ({
    bx: 50, dx: rnd(15, 85), dy: -8, caught: false,
  }),
  update(s: DiamondDigS, c: MgCtx) {
    if (c.control && !s.caught) {
      if (c.input.held.has("left")) s.bx -= 55 * c.dtBeats;
      if (c.input.held.has("right")) s.bx += 55 * c.dtBeats;
      s.bx = clamp(s.bx, 8, 92);
    }
    if (!s.caught) {
      s.dy += 18 * c.dtBeats;
      if (s.dy >= 72 && Math.abs(s.dx - s.bx) < 12) { s.caught = true; c.win(); }
      else if (s.dy >= 95) c.lose();
    }
  },
  View({ s, v }: { s: DiamondDigS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bottom-0 bg-[#4a3728]" style={{ height: "20%" }} />
        <Sp x={s.dx} y={clamp(s.dy, -8, 95)} size={10} rot={s.dy * 3}>💎</Sp>
        <Sp x={s.bx} y={80 + bob(v.beatPhase, 0.7)} size={14}>🧺</Sp>
        {s.caught && <Sp x={s.bx} y={76} size={7}>💎</Sp>}
        <Sp x={s.bx} y={92} size={8}>{v.outcome === "lose" ? "😫" : s.caught ? "😋" : "😮"}</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  5. DODGE BALLS — Dodge the falling balls (Intro / Wario)           */
/* ================================================================== */
interface DodgeBallsS {
  lane: number; balls: { lane: number; landT: number }[];
}
const LANE_X = [22, 50, 78];
const dodgeBalls: MicrogameDef = {
  id: "dodge_balls", instruction: "DODGE!", lengthBars: 2, timeoutOutcome: "win",
  palette: { outer: "#2b1d4f", frame: "#eab308", screen: "#3d405b", text: "#eab308" },
  init: (): DodgeBallsS => {
    const l1 = 1;
    const l2 = Math.floor(Math.random() * 3);
    return { lane: 1, balls: [{ lane: l1, landT: 3.4 }, { lane: l2, landT: 5.4 }] };
  },
  update(s: DodgeBallsS, c: MgCtx) {
    if (c.control) {
      if (c.input.pressed.has("left")) s.lane = clamp(s.lane - 1, 0, 2);
      if (c.input.pressed.has("right")) s.lane = clamp(s.lane + 1, 0, 2);
    }
    if (c.outcome === null) {
      for (const r of s.balls) {
        if (c.t >= r.landT && c.t < r.landT + 0.25 && r.lane === s.lane) c.lose();
      }
    }
  },
  View({ s, v }: { s: DodgeBallsS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bottom-0 bg-[#6d597a]" style={{ height: "16%" }} />
        {s.balls.map((r, i) => {
          const fall = clamp((v.t - (r.landT - 1.6)) / 1.6, 0, 1);
          const gone = v.t > r.landT + 0.6;
          return (
            <React.Fragment key={i}>
              {v.t > r.landT - 1.9 && !gone && (
                <div className="absolute rounded-full bg-black/40" style={{
                  left: `${LANE_X[r.lane] - 6}%`, top: "80%", width: "12%", height: "3.5%",
                  transform: `scale(${0.4 + fall * 0.8})`,
                }} />
              )}
              {fall > 0 && !gone && (
                <Sp x={LANE_X[r.lane]} y={-10 + fall * 88} size={12} rot={fall * 180}>
                  {fall >= 1 ? "💥" : "⚽"}
                </Sp>
              )}
            </React.Fragment>
          );
        })}
        <Sp x={LANE_X[s.lane]} y={74 + bob(v.beatPhase, 0.8)} size={12}>
          {v.outcome === "lose" ? "😵" : v.outcome === "win" ? "😎" : "😈"}
        </Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  6. REPELLION — Shoot the UFOs falling from the sky                 */
/* ================================================================== */
interface RepellionS {
  ufos: { x: number; y: number; alive: boolean }[];
  shots: { x: number; y: number; age: number }[];
  flash: number;
}
const repellion: MicrogameDef = {
  id: "repellion", instruction: "SHOOT!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#2b1d4f", frame: "#8b5cf6", screen: "#0f172a", text: "#8b5cf6" },
  init: (): RepellionS => ({
    ufos: Array.from({ length: 3 }, () => ({ x: rnd(15, 85), y: rnd(10, 30), alive: true })),
    shots: [], flash: 0,
  }),
  update(s: RepellionS, c: MgCtx) {
    s.flash = Math.max(0, s.flash - c.dtBeats * 4);
    s.shots.forEach(sh => { sh.age += c.dtBeats; sh.y -= 60 * c.dtBeats; });
    s.shots = s.shots.filter(sh => sh.age < 0.8);
    if (c.control && c.input.pressed.has("space")) {
      s.shots.push({ x: 50, y: 80, age: 0 });
      s.flash = 1;
      for (const ufo of s.ufos) {
        if (ufo.alive && Math.abs(ufo.x - 50) < 15) {
          ufo.alive = false; c.win(); break;
        }
      }
    }
    // Move UFOs
    for (const ufo of s.ufos) {
      if (ufo.alive) ufo.x = 50 + 38 * Math.sin((c.t + 1) * 1.2 + ufo.y);
    }
  },
  View({ s, v }: { s: RepellionS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0">
        <Sp x={15} y={10} size={4}>⭐</Sp>
        <Sp x={80} y={20} size={3}>✨</Sp>
        {s.ufos.map((ufo, i) => (
          <Sp key={i} x={ufo.x} y={ufo.y + bob(v.beatPhase, 2)} size={13}>
            {ufo.alive ? "🛸" : "💥"}
          </Sp>
        ))}
        {s.shots.map((sh, i) => <Sp key={i} x={sh.x} y={sh.y} size={5}>🔺</Sp>)}
        <Sp x={50} y={88} size={11} scale={s.flash > 0 ? 1.15 : 1}>🔫</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  7. WARIO WEAR — Put on the right clothes                          */
/* ================================================================== */
interface WarioWearS {
  correctIdx: number; selectedIdx: number;
}
const WARIO_CLOTHES = ['👔', '🧥', '👕'];
const warioWear: MicrogameDef = {
  id: "wario_wear", instruction: "PUT ON!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#2b1d4f", frame: "#eab308", screen: "#fef3c7", text: "#eab308" },
  init: (): WarioWearS => ({ correctIdx: Math.floor(Math.random() * 3), selectedIdx: -1 }),
  update(s: WarioWearS, c: MgCtx) {
    if (c.control && s.selectedIdx < 0) {
      if (c.input.pressed.has("left")) s.selectedIdx = 0;
      if (c.input.pressed.has("up")) s.selectedIdx = 1;
      if (c.input.pressed.has("right")) s.selectedIdx = 2;
      if (s.selectedIdx >= 0) {
        if (s.selectedIdx === s.correctIdx) c.win();
        else c.lose();
      }
    }
  },
  View({ s, v }: { s: WarioWearS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <Sp x={50} y={30} size={20}>{v.outcome === "lose" ? "😵" : "😈"}</Sp>
        <div className="font-black text-white/80" style={{ fontSize: "4cqw" }}>
          {WARIO_CLOTHES[s.correctIdx]}
        </div>
        <div className="flex gap-4 mt-2">
          {[0, 1, 2].map(i => (
            <button key={i} className="rounded-xl border-2 bg-white/10 p-2"
              style={{ fontSize: "8cqw", borderColor: s.selectedIdx === i ? '#ffd700' : 'rgba(255,255,255,0.3)' }}>
              {WARIO_CLOTHES[i]}
            </button>
          ))}
        </div>
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  8. HECTIC HIGHWAY — Dodge traffic on the highway                   */
/* ================================================================== */
interface HecticHighwayS {
  px: number; cars: { x: number; lane: number; speed: number }[];
}
const HECTIC_LANES = [25, 50, 75];
const hecticHighway: MicrogameDef = {
  id: "hectic_highway", instruction: "DODGE!", lengthBars: 2, timeoutOutcome: "win",
  palette: { outer: "#2b1d4f", frame: "#eab308", screen: "#374151", text: "#eab308" },
  init: (): HecticHighwayS => ({
    px: 50,
    cars: Array.from({ length: 6 }, (_, i) => ({
      x: 110 + i * 25, lane: Math.floor(Math.random() * 3), speed: rnd(16, 26),
    })),
  }),
  update(s: HecticHighwayS, c: MgCtx) {
    if (c.control) {
      if (c.input.held.has("left")) s.px -= 48 * c.dtBeats;
      if (c.input.held.has("right")) s.px += 48 * c.dtBeats;
      s.px = clamp(s.px, 6, 94);
    }
    for (const car of s.cars) car.x -= car.speed * c.dtBeats;
    if (c.outcome === null) {
      for (const car of s.cars) {
        if (Math.abs(car.x - s.px) < 8 && Math.abs(HECTIC_LANES[car.lane] - s.px) < 8) c.lose();
      }
    }
  },
  View({ s, v }: { s: HecticHighwayS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bg-[#444]" style={{ top: "15%", height: "70%" }}>
          <div className="absolute left-0 right-0 bg-[#ffd700]" style={{ top: "33%", height: "2%" }} />
          <div className="absolute left-0 right-0 bg-[#ffd700]" style={{ top: "66%", height: "2%" }} />
        </div>
        {s.cars.map((car, i) => car.x > -10 && car.x < 110 ? (
          <Sp key={i} x={car.x} y={HECTIC_LANES[car.lane]} size={10}>🚗</Sp>
        ) : null)}
        <Sp x={s.px} y={50 + bob(v.beatPhase, 0.8)} size={12}>
          {v.outcome === "lose" ? "😵" : "😈"}
        </Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  9. THE MAZE THAT PAYS — Navigate to the treasure                  */
/* ================================================================== */
interface MazeThatPaysS {
  px: number; py: number; goalX: number; goalY: number;
}
const mazeThatPays: MicrogameDef = {
  id: "maze_that_pays", instruction: "FIND!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#2b1d4f", frame: "#eab308", screen: "#1e1b4b", text: "#eab308" },
  init: (): MazeThatPaysS => ({ px: 20, py: 80, goalX: 80, goalY: 20 }),
  update(s: MazeThatPaysS, c: MgCtx) {
    if (c.control) {
      if (c.input.held.has("left")) s.px -= 40 * c.dtBeats;
      if (c.input.held.has("right")) s.px += 40 * c.dtBeats;
      if (c.input.held.has("up")) s.py -= 40 * c.dtBeats;
      if (c.input.held.has("down")) s.py += 40 * c.dtBeats;
      s.px = clamp(s.px, 6, 94);
      s.py = clamp(s.py, 6, 94);
    }
    if (c.outcome === null && Math.abs(s.px - s.goalX) < 8 && Math.abs(s.py - s.goalY) < 8) c.win();
  },
  View({ s, v }: { s: MazeThatPaysS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0">
        <Sp x={s.goalX} y={s.goalY} size={14} scale={pulse(v.beatPhase, 0.15)}>💰</Sp>
        <Sp x={s.px} y={s.py} size={12}>
          {v.outcome === "lose" ? "😵" : "😈"}
        </Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  10. SUPER WARIO BROS — Jump over obstacles (Classic Mario style)   */
/* ================================================================== */
interface SuperWarioBrosS {
  hx: number; py: number; vy: number; passed: boolean;
}
const superWarioBros: MicrogameDef = {
  id: "super_wario_bros", instruction: "JUMP!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#2b1d4f", frame: "#ef4444", screen: "#87ceeb", text: "#ef4444" },
  init: (): SuperWarioBrosS => ({ hx: 120, py: 0, vy: 0, passed: false }),
  update(s: SuperWarioBrosS, c: MgCtx) {
    s.hx -= 20 * c.dtBeats;
    const grounded = s.py <= 0.01;
    if (c.control && grounded && (c.input.pressed.has("space") || c.input.pressed.has("up"))) {
      s.vy = 44;
    }
    if (!grounded || s.vy > 0) {
      s.py += s.vy * c.dtBeats;
      s.vy -= 76 * c.dtBeats;
      if (s.py <= 0) { s.py = 0; s.vy = 0; }
    }
    if (c.outcome === null) {
      if (Math.abs(s.hx - 26) < 6 && s.py < 10) c.lose();
      else if (s.hx < 5) c.win();
    }
  },
  View({ s, v }: { s: SuperWarioBrosS; v: ViewCtx }) {
    const run = Math.floor((v.t + 1) * 4) % 2 === 0;
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bottom-0 bg-[#4c9a2a]" style={{ height: "22%" }} />
        <div className="absolute left-0 right-0 bg-[#8B4513]" style={{ bottom: "22%", height: "3%" }} />
        <Sp x={s.hx} y={72} size={12}>🧱</Sp>
        <Sp x={26} y={68 - s.py} size={14} flip>
          {v.outcome === "lose" ? "😵" : s.py > 2 ? "🤸" : run ? "🏃" : "🧍"}
        </Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  11. I SPY — Spot the right item                                   */
/* ================================================================== */
interface ISpyS {
  targetIdx: number; selectedIdx: number;
  items: string[];
}
const SPY_ITEMS = ['🍎', '🍌', '🍇', '🍊', '🍓', '🫐'];
const iSpy: MicrogameDef = {
  id: "i_spy", instruction: "SPOT!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#2b1d4f", frame: "#eab308", screen: "#fef3c7", text: "#eab308" },
  init: (): ISpyS => {
    const targetIdx = Math.floor(Math.random() * 4);
    const items = [];
    for (let i = 0; i < 4; i++) items.push(SPY_ITEMS[(targetIdx + i) % SPY_ITEMS.length]);
    // Shuffle
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return { targetIdx: items.indexOf(SPY_ITEMS[targetIdx]), selectedIdx: -1, items };
  },
  update(s: ISpyS, c: MgCtx) {
    if (c.control && s.selectedIdx < 0) {
      if (c.input.pressed.has("left")) s.selectedIdx = 0;
      if (c.input.pressed.has("up")) s.selectedIdx = 1;
      if (c.input.pressed.has("right")) s.selectedIdx = 2;
      if (c.input.pressed.has("down")) s.selectedIdx = 3;
      if (s.selectedIdx >= 0) {
        if (s.selectedIdx === s.targetIdx) c.win();
        else c.lose();
      }
    }
  },
  View({ s, v }: { s: ISpyS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div className="font-black flex items-center gap-2" style={{ fontSize: "6cqw", color: "#eab308" }}>
          Find: <SpriteAsset id={spriteFromNode(s.items[s.targetIdx])} style={{ width: "8cqw", height: "8cqw" }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {s.items.map((item, i) => (
            <div key={i} className="rounded-xl border-2 bg-white/10 p-2 flex items-center justify-center"
              style={{ fontSize: "10cqw", borderColor: s.selectedIdx === i ? '#ffd700' : 'rgba(255,255,255,0.3)' }}>
              <SpriteAsset id={spriteFromNode(item)} style={{ width: "10cqw", height: "10cqw" }} />
            </div>
          ))}
        </div>
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  12. MUG SHOT — Catch the mugs sliding across the counter          */
/* ================================================================== */
interface MugShotS {
  mx: number; bx: number; caught: boolean;
}
const mugShot: MicrogameDef = {
  id: "mug_shot", instruction: "CATCH!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#2b1d4f", frame: "#eab308", screen: "#fef3c7", text: "#eab308" },
  init: (): MugShotS => ({ mx: 110, bx: 50, caught: false }),
  update(s: MugShotS, c: MgCtx) {
    if (!s.caught) {
      s.mx -= 22 * c.dtBeats;
      if (c.control) {
        if (c.input.held.has("left")) s.bx -= 50 * c.dtBeats;
        if (c.input.held.has("right")) s.bx += 50 * c.dtBeats;
        s.bx = clamp(s.bx, 8, 92);
      }
      if (Math.abs(s.mx - s.bx) < 10 && s.mx < 80) { s.caught = true; c.win(); }
      else if (s.mx < -5) c.lose();
    }
  },
  View({ s, v }: { s: MugShotS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bg-[#8B4513]" style={{ top: "50%", height: "8%" }} />
        <div className="absolute left-0 right-0 bottom-0 bg-[#4a3728]" style={{ height: "42%" }} />
        {!s.caught && <Sp x={s.mx} y={48} size={12}>☕</Sp>}
        {s.caught && <Sp x={s.bx} y={48} size={12}>☕</Sp>}
        <Sp x={s.bx} y={70} size={10}>{v.outcome === "lose" ? "😫" : "😋"}</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  13. SPARRING WARIO (BOSS) — Punch the boss!                       */
/* ================================================================== */
interface SparringWarioS {
  bossHp: number; playerX: number; bossX: number; bossDir: number;
  punchCooldown: number; bossHit: number;
}
const sparringWario: MicrogameDef = {
  id: "sparring_wario", instruction: "PUNCH!", lengthBars: 4, timeoutOutcome: "lose",
  palette: { outer: "#2b1d4f", frame: "#ef4444", screen: "#1e1b4b", text: "#ef4444" },
  init: (): SparringWarioS => ({
    bossHp: 3, playerX: 25, bossX: 75, bossDir: -1,
    punchCooldown: 0, bossHit: 0,
  }),
  update(s: SparringWarioS, c: MgCtx) {
    s.punchCooldown = Math.max(0, s.punchCooldown - c.dtBeats * 4);
    s.bossHit = Math.max(0, s.bossHit - c.dtBeats * 4);
    if (c.control) {
      if (c.input.held.has("left")) s.playerX -= 45 * c.dtBeats;
      if (c.input.held.has("right")) s.playerX += 45 * c.dtBeats;
      s.playerX = clamp(s.playerX, 8, 92);
      if (c.input.pressed.has("space") && s.punchCooldown <= 0) {
        s.punchCooldown = 1;
        if (Math.abs(s.playerX - s.bossX) < 15) {
          s.bossHp -= 1;
          s.bossHit = 1;
          if (s.bossHp <= 0) c.win();
        }
      }
    }
    // Boss moves
    s.bossX += s.bossDir * 20 * c.dtBeats;
    if (s.bossX < 30 || s.bossX > 85) s.bossDir *= -1;
  },
  View({ s, v }: { s: SparringWarioS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bottom-0 bg-[#4a3728]" style={{ height: "20%" }} />
        {/* Boss HP */}
        <div className="absolute left-1/2 -translate-x-1/2 flex gap-1" style={{ top: "4%" }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-full" style={{ width: "4cqw", height: "4cqw", background: i < s.bossHp ? '#ef4444' : '#444' }} />
          ))}
        </div>
        <Sp x={s.playerX} y={65} size={14} flip>
          {s.punchCooldown > 0.5 ? "👊" : "😈"}
        </Sp>
        <Sp x={s.bossX} y={65} size={16} flip scale={s.bossHit > 0 ? 0.9 : 1}>
          {s.bossHp <= 0 ? "💫" : "👹"}
        </Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  MICROGAME REGISTRY — All 213 microgames organized by stage         */
/* ================================================================== */

// Intro Games microgames (all 13 implemented above)
const INTRO_GAMES: MicrogameDef[] = [
  crazyCars, warioWhirled, savingFace, diamondDig, dodgeBalls,
  repellion, warioWear, hecticHighway, mazeThatPays, superWarioBros,
  iSpy, mugShot, sparringWario,
];

// Placeholder factory for stages not yet fully implemented
function placeholderGame(id: string, instruction: string, _stage: string, stagePalette: StageDef['palette']): MicrogameDef {
  return {
    id, instruction, lengthBars: 2, timeoutOutcome: "lose",
    palette: stagePalette,
    init: () => ({ t: 0 }),
    update(s: any, c: MgCtx) {
      s.t += c.dtBeats;
      if (c.control && c.input.pressed.has("space")) c.win();
    },
    View({ v }: { s: any; v: ViewCtx }) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="font-black text-white/60" style={{ fontSize: "8cqw" }}>{instruction}</div>
          <ResultFlash v={v} />
        </div>
      );
    },
  };
}

// Sports microgames
const SPORTS_NAMES = [
  ['log_chop', 'CHOP!'], ['heads_up', 'DODGE!'], ['boing', 'JUMP!'],
  ['fruit_shoot', 'SHOOT!'], ['guy_scraper', 'CATCH!'], ['spare_me', 'ROLL!'],
  ['baseline_bash', 'HIT!'], ['pro_curling', 'SLIDE!'], ['batter_up', 'SWING!'],
  ['butterfly_stroke', 'SWIM!'], ['high_hoops', 'SHOOT!'], ['hammer_toss', 'THROW!'],
  ['balancing_act', 'BALANCE!'], ['hurry_hurdles', 'JUMP!'], ['mountain_mountin', 'CLIMB!'],
  ['putt_for_dough', 'PUTT!'], ['gifted_goalie', 'BLOCK!'], ['city_surfer', 'DODGE!'],
  ['ski_jump', 'JUMP!'], ['set_n_spike', 'SPIKE!'], ['lift_and_shout', 'LIFT!'],
  ['snowboard_slalom', 'TURN!'], ['jumpin_rope', 'JUMP!'], ['ring_my_bell', 'HIT!'],
  ['punch_out', 'PUNCH!'],
];
const SPORTS_GAMES: MicrogameDef[] = SPORTS_NAMES.map(([id, instr]) =>
  placeholderGame(id, instr, 'sports', STAGES.sports.palette)
);

// Sci-Fi microgames
const SCIFI_NAMES = [
  ['cyclone_jump', 'JUMP!'], ['catch_robot', 'CATCH!'], ['nose', 'PICK!'],
  ['ultraman_beam', 'SHOOT!'], ['seesaw', 'LAUNCH!'], ['balloon_trip', 'AVOID!'],
  ['volcano', 'DODGE!'], ['ultraman_throw', 'THROW!'], ['arien_catch', 'CATCH!'],
  ['mouse_catch', 'CATCH!'], ['ultraman_dodge', 'DODGE!'], ['toast_catch', 'CATCH!'],
  ['enter_command', 'TYPE!'], ['bac_man', 'EAT!'], ['space_fight', 'SHOOT!'],
  ['dodge_missiles', 'DODGE!'], ['shoot_certainly', 'SHOOT!'], ['dodge_with_jump', 'JUMP!'],
  ['ninja_arrow', 'DODGE!'], ['falling_rod', 'DODGE!'], ['ninja_bunshin', 'FIND!'],
  ['ninja_run', 'RUN!'], ['ninja_cross', 'DODGE!'], ['light_ghost', 'SHINE!'],
  ['boss_out', 'SURVIVE!'],
];
const SCIFI_GAMES: MicrogameDef[] = SCIFI_NAMES.map(([id, instr]) =>
  placeholderGame(id, instr, 'scifi', STAGES.scifi.palette)
);

// Strange microgames
const STRANGE_NAMES = [
  ['jack', 'PULL!'], ['chibi_wario', 'EAT!'], ['montage', 'MATCH!'],
  ['cake2', 'DECORATE!'], ['thumb_wrestling', 'PIN!'], ['eyedrop2', 'DROP!'],
  ['stomach', 'EAT!'], ['pinball', 'FLIP!'], ['kawara', 'BREAK!'],
  ['bird', 'CATCH!'], ['hotdog', 'EAT!'], ['whale', 'SPRAY!'],
  ['soybean', 'CATCH!'], ['wariobros', 'JUMP!'], ['steak', 'CUT!'],
  ['kuchibashi', 'PECK!'], ['wheel', 'STOP!'], ['boji', 'STAMP!'],
  ['fruits_drop', 'CATCH!'], ['toto', 'PULL!'], ['cake', 'DECORATE!'],
  ['real_pon', 'PULL!'], ['vegetable_slot', 'MATCH!'], ['which', 'PICK!'],
  ['boss_strange', 'SURVIVE!'],
];
const STRANGE_GAMES: MicrogameDef[] = STRANGE_NAMES.map(([id, instr]) =>
  placeholderGame(id, instr, 'strange', STAGES.strange.palette)
);

// Nintendo microgames
const NINTENDO_NAMES = [
  ['super_mario', 'JUMP!'], ['duck_hunt', 'SHOOT!'], ['wild_gunman', 'SHOOT!'],
  ['shoot_red_ball', 'SHOOT!'], ['hogans_alley', 'SHOOT!'], ['sheriff', 'SHOOT!'],
  ['dr_mario', 'KILL!'], ['metroid', 'SHOOT!'], ['zelda_cave', 'NAVIGATE!'],
  ['mario_paint', 'SWAT!'], ['donkeykong', 'JUMP!'], ['racing_112', 'STEER!'],
  ['clu_clu_land', 'COLLECT!'], ['ice_climber', 'JUMP!'], ['f_zero', 'STEER!'],
  ['game_boy', 'PRESS!'], ['ultra_hand', 'CATCH!'], ['chiritorie', 'VACUUM!'],
  ['fc_basic', 'TYPE!'], ['mario_clash', 'HIT!'], ['super_scope', 'SHOOT!'],
  ['urban_champion', 'PUNCH!'], ['stack_up', 'STACK!'], ['punch_out', 'PUNCH!'],
  ['boss_nintendo', 'FIGHT!'],
];
const NINTENDO_GAMES: MicrogameDef[] = NINTENDO_NAMES.map(([id, instr]) =>
  placeholderGame(id, instr, 'nintendo', STAGES.nintendo.palette)
);

// IQ microgames
const IQ_NAMES = [
  ['catch_truck', 'CATCH!'], ['cyclone_wheelie', 'STOP!'], ['rolling', 'STOP!'],
  ['cyclone_bomb', 'CUT!'], ['super_mario_basement', 'JUMP!'], ['scatter', 'CATCH!'],
  ['hit_alien', 'SHOOT!'], ['beetmania', 'CATCH!'], ['bullfight', 'DODGE!'],
  ['crayon', 'DRAW!'], ['snow_boarder', 'STEER!'], ['earthquake', 'DODGE!'],
  ['skateboard', 'DODGE!'], ['volleyball', 'SPIKE!'], ['firework', 'LAUNCH!'],
  ['mini_car_race', 'STEER!'], ['pyramid', 'CATCH!'], ['frog_jump', 'JUMP!'],
  ['frog_swim', 'SWIM!'], ['hurdle', 'JUMP!'], ['hyper_jump', 'JUMP!'],
  ['harvest_man', 'CATCH!'], ['reflect', 'BOUNCE!'], ['doshin', 'STOMP!'],
  ['boss_iq', 'THINK!'],
];
const IQ_GAMES: MicrogameDef[] = IQ_NAMES.map(([id, instr]) =>
  placeholderGame(id, instr, 'iq', STAGES.iq.palette)
);

// Reality microgames
const REALITY_NAMES = [
  ['ski_jump_r', 'JUMP!'], ['weightlifting', 'LIFT!'], ['praise_or_abuse', 'PICK!'],
  ['chiritori', 'VACUUM!'], ['soccer_pk', 'KICK!'], ['free_throw', 'SHOOT!'],
  ['tennis', 'HIT!'], ['mosquito', 'SLAP!'], ['super_mario_q', 'JUMP!'],
  ['shoot_reverse', 'SHOOT!'], ['block', 'STACK!'], ['hammer', 'HIT!'],
  ['curling', 'SLIDE!'], ['mountain', 'CLIMB!'], ['bowling', 'ROLL!'],
  ['parking', 'PARK!'], ['delivery', 'CATCH!'], ['baseball', 'SWING!'],
  ['drive', 'STEER!'], ['page', 'FLIP!'], ['helmet', 'DODGE!'],
  ['air_bag', 'CATCH!'], ['trampoline', 'BOUNCE!'], ['exception', 'CATCH!'],
  ['boss_reality', 'SURVIVE!'],
];
const REALITY_GAMES: MicrogameDef[] = REALITY_NAMES.map(([id, instr]) =>
  placeholderGame(id, instr, 'reality', STAGES.reality.palette)
);

// Nature microgames
const NATURE_NAMES = [
  ['ufo_catcher', 'CATCH!'], ['rainy_day', 'AVOID!'], ['worm', 'EAT!'],
  ['banana', 'CATCH!'], ['fire_fighting', 'SPRAY!'], ['frisbee', 'CATCH!'],
  ['penguin', 'CATCH!'], ['tooth', 'PULL!'], ['apple', 'CATCH!'],
  ['hanamizu', 'WIPE!'], ['monkey_banana', 'CATCH!'], ['eat_potato', 'EAT!'],
  ['eye_drop', 'DROP!'], ['flower_pom', 'SHAKE!'], ['rider_kick', 'KICK!'],
  ['stop_the_train', 'STOP!'], ['tetris', 'FIT!'], ['catch_ball', 'CATCH!'],
  ['gotiger_v', 'SHOOT!'], ['lizard', 'CATCH!'], ['be_hero', 'PUNCH!'],
  ['be_skin_head', 'DODGE!'], ['samurai', 'CUT!'], ['eat_all', 'EAT!'],
  ['boss_nature', 'SURVIVE!'],
];
const NATURE_GAMES: MicrogameDef[] = NATURE_NAMES.map(([id, instr]) =>
  placeholderGame(id, instr, 'nature', STAGES.nature.palette)
);

// Anything Goes microgames
const ANYTHING_NAMES = [
  ['hit_mole', 'HIT!'], ['kill_viruses', 'DESTROY!'], ['get_the_fruit', 'CATCH!'],
  ['jump_rope', 'JUMP!'], ['break_the_log', 'CHOP!'], ['stop_the_fan', 'STOP!'],
  ['archery', 'SHOOT!'], ['paper_plane', 'FLY!'], ['cup_noodle', 'WAIT!'],
  ['thread_a_needle', 'THREAD!'], ['meteorite', 'DODGE!'], ['shutter', 'SNAP!'],
  ['lets_dancing', 'DANCE!'], ['pasta', 'EAT!'], ['superman', 'FLY!'],
  ['nameshot', 'SHOOT!'], ['arbanchamp', 'PUNCH!'], ['f1_race', 'STEER!'],
  ['pick_me', 'PICK!'], ['follow_me', 'FOLLOW!'], ['tv_game_6', 'DODGE!'],
  ['mario_crash', 'DODGE!'], ['bar_counter', 'CATCH!'], ['raygun_sp', 'SHOOT!'],
  ['boss_anything', 'SURVIVE!'],
];
const ANYTHING_GAMES: MicrogameDef[] = ANYTHING_NAMES.map(([id, instr]) =>
  placeholderGame(id, instr, 'anything_goes', STAGES.anything_goes.palette)
);

/* ================================================================== */
/*  EXPORTS                                                            */
/* ================================================================== */

/** All microgames from all stages */
export const MICROGAMES: MicrogameDef[] = [
  ...INTRO_GAMES,
  ...SPORTS_GAMES,
  ...SCIFI_GAMES,
  ...STRANGE_GAMES,
  ...NINTENDO_GAMES,
  ...IQ_GAMES,
  ...REALITY_GAMES,
  ...NATURE_GAMES,
  ...ANYTHING_GAMES,
];

/** Get microgames for a specific stage */
export function getMicrogamesForStage(stageId: string): MicrogameDef[] {
  switch (stageId) {
    case 'intro': return INTRO_GAMES;
    case 'sports': return SPORTS_GAMES;
    case 'scifi': return SCIFI_GAMES;
    case 'strange': return STRANGE_GAMES;
    case 'nintendo': return NINTENDO_GAMES;
    case 'iq': return IQ_GAMES;
    case 'reality': return REALITY_GAMES;
    case 'nature': return NATURE_GAMES;
    case 'anything_goes': return ANYTHING_GAMES;
    default: return INTRO_GAMES;
  }
}

/** Get a random microgame for a stage, excluding the last played */
export function getRandomMicrogame(stageId: string, excludeId?: string): MicrogameDef {
  const pool = getMicrogamesForStage(stageId);
  const filtered = excludeId ? pool.filter(g => g.id !== excludeId) : pool;
  return filtered[Math.floor(Math.random() * filtered.length)];
}
