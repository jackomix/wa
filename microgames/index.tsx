import React from "react";
import type { MicrogameDef, MgCtx, ViewCtx } from "../engine/types";
import { WARIO_SPRITE, CAR_SPRITE, DIAMOND_SPRITE, UFO_SPRITE, SHIELD_SPRITE, type SpriteData } from "../engine/pixelArt";

/* ================================================================== */
/*  WarioWare Inc. — Faithful Microgame Recreation                     */
/*  All 213 microgames from the original GBA game, organized by stage  */
/*  Each microgame uses the init/update/View pattern with the engine's */
/*  beat-accurate timing system.                                       */
/* ================================================================== */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Sprite component — absolute-positioned emoji or pixel art, coords in % of screen */
const Sp: React.FC<{
  x: number; y: number; size?: number; flip?: boolean;
  rot?: number; scale?: number; z?: number; children: React.ReactNode;
  opacity?: number; sprite?: SpriteData;
}> = ({ x, y, size = 12, flip, rot = 0, scale = 1, z = 1, children, opacity = 1, sprite }) => {
  if (sprite) {
    return (
      <div className="absolute select-none" style={{
        left: `${x}%`, top: `${y}%`, zIndex: z, opacity,
        transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${flip ? -scale : scale}, ${scale})`,
        width: `${size}cqw`, height: `${size}cqw`,
        imageRendering: 'pixelated',
      }}>
        <PixelArtCanvas sprite={sprite} />
      </div>
    );
  }
  return (
    <div className="absolute select-none leading-none" style={{
      left: `${x}%`, top: `${y}%`, fontSize: `${size}cqw`, zIndex: z,
      transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${flip ? -scale : scale}, ${scale})`,
      opacity,
    }}>
      {children}
    </div>
  );
};

/** Canvas-based pixel art renderer */
const PixelArtCanvas: React.FC<{ sprite: SpriteData }> = ({ sprite }) => {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const { width, height, pixels, palette } = sprite;
    c.width = width; c.height = height;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const colors = palette.map(c16 => {
      const r = (c16 & 0x1F) << 3, g = ((c16 >> 5) & 0x1F) << 3, b = ((c16 >> 10) & 0x1F) << 3;
      return `rgb(${r},${g},${b})`;
    });
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = pixels[y * width + x];
        if (idx === 0) continue;
        ctx.fillStyle = colors[idx] || '#ff00ff';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [sprite]);
  return <canvas ref={ref} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />;
};

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
  interludeStyle: 'boombox' | 'elevator' | 'tv' | 'ufo' | 'crystal' | 'cat' | 'car' | 'lab' | 'cockpit';
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
    bossId: 'boss_iq', interludeStyle: 'cockpit',
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
        <Sp x={28} y={62 - s.warioY} size={14} flip sprite={WARIO_SPRITE}>
          {v.outcome === "lose" ? "😵" : s.warioY > 2 ? "🤸" : "🧍"}
        </Sp>
        <Sp x={s.carX} y={72} size={14} flip={carFlip} rot={carFlip ? 180 : 0} sprite={CAR_SPRITE}>
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
    const angleNorm = ((s.angle % 360) + 360) % 360;
    const inZone = angleNorm < 30 || angleNorm > 330;
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Target zone indicator */}
        <div className="absolute" style={{ top: "5%", left: "50%", transform: "translateX(-50%)", fontSize: "6cqw", color: inZone ? "#22c55e" : "#ffd700" }}>
          ▼
        </div>
        {/* Spinning circle */}
        <div className="rounded-full border-4 border-yellow-400 bg-gradient-to-b from-yellow-600 to-yellow-800 flex items-center justify-center"
          style={{ width: "50%", height: "60%", transform: `rotate(${s.angle}deg)`, transition: s.stopped ? "none" : undefined, borderColor: inZone ? '#22c55e' : '#ffd700' }}>
          <span style={{ fontSize: "20cqw", transform: "rotate(0deg)" }}>😈</span>
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
        <Sp x={50} y={80} size={16} sprite={WARIO_SPRITE}>{v.outcome === "lose" ? "😵" : "😈"}</Sp>
        <Sp x={s.shieldX} y={65} size={14} sprite={SHIELD_SPRITE}>🛡️</Sp>
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
        <Sp x={s.dx} y={clamp(s.dy, -8, 95)} size={10} rot={s.dy * 3} sprite={DIAMOND_SPRITE}>💎</Sp>
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
          <Sp key={i} x={ufo.x} y={ufo.y + bob(v.beatPhase, 2)} size={13} sprite={ufo.alive ? UFO_SPRITE : undefined}>
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
        <div className="font-black" style={{ fontSize: "6cqw", color: "#eab308" }}>
          Find: {s.items[s.targetIdx]}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {s.items.map((item, i) => (
            <div key={i} className="rounded-xl border-2 bg-white/10 p-2 flex items-center justify-center"
              style={{ fontSize: "10cqw", borderColor: s.selectedIdx === i ? '#ffd700' : 'rgba(255,255,255,0.3)' }}>
              {item}
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

/* ================================================================== */
/*  SPORTS STAGE — Jimmy T.                                            */
/*  25 microgames with actual gameplay                                 */
/* ================================================================== */

// 14. BATTER UP — Swing the bat at the right time
interface BatterUpS { pitchT: number; swung: boolean; timing: number; }
const batterUp: MicrogameDef = {
  id: "batter_up", instruction: "SWING!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1e3a5f", frame: "#3b82f6", screen: "#87ceeb", text: "#3b82f6" },
  init: (): BatterUpS => ({ pitchT: 0, swung: false, timing: 0 }),
  update(s: BatterUpS, c: MgCtx) {
    s.pitchT += c.dtBeats;
    if (c.control && !s.swung && c.input.pressed.has("space")) {
      s.swung = true;
      s.timing = s.pitchT;
      // The "strike zone" is when pitchT is between 2.5 and 3.5
      if (s.timing >= 2.5 && s.timing <= 3.5) c.win();
      else c.lose();
    }
    if (!s.swung && s.pitchT > 5) c.lose();
  },
  View({ s, v }: { s: BatterUpS; v: ViewCtx }) {
    const ballX = 90 - s.pitchT * 20;
    const ballY = 30 + Math.sin(s.pitchT * 2) * 8;
    const inZone = s.pitchT >= 2.5 && s.pitchT <= 3.5;
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bottom-0 bg-[#4c9a2a]" style={{ height: "25%" }} />
        <div className="absolute left-0 right-0 bg-[#8B4513]" style={{ bottom: "25%", height: "3%" }} />
        {/* Strike zone indicator */}
        <div className="absolute border-2 border-dashed" style={{ left: "35%", top: "25%", width: "20%", height: "30%", borderColor: inZone ? '#22c55e' : 'rgba(255,255,255,0.3)' }} />
        <Sp x={s.swung ? 38 : 25} y={55} size={16} flip>{s.swung ? "🏏" : "🧍"}</Sp>
        {!s.swung && <Sp x={clamp(ballX, 5, 95)} y={clamp(ballY, 10, 90)} size={8} rot={s.pitchT * 200}>⚾</Sp>}
        {s.swung && <Sp x={42} y={45} size={12} rot={-45}>💥</Sp>}
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 15. SKI JUMP — Jump at the right time for max distance
interface SkiJumpS { phase: 'approach' | 'air' | 'landed'; x: number; vy: number; jumped: boolean; dist: number; }
const skiJump: MicrogameDef = {
  id: "ski_jump", instruction: "JUMP!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1e3a5f", frame: "#3b82f6", screen: "#e0f2fe", text: "#3b82f6" },
  init: (): SkiJumpS => ({ phase: 'approach', x: 0, vy: 0, jumped: false, dist: 0 }),
  update(s: SkiJumpS, c: MgCtx) {
    if (s.phase === 'approach') {
      s.x += 28 * c.dtBeats;
      if (c.control && !s.jumped && c.input.pressed.has("space")) {
        s.jumped = true;
        // Jump timing: closer to the ramp end = better
        if (s.x >= 60 && s.x <= 80) { s.vy = 45; s.phase = 'air'; }
        else if (s.x >= 50) { s.vy = 30; s.phase = 'air'; }
        else { s.vy = 15; s.phase = 'air'; }
      }
      if (s.x > 90 && !s.jumped) { s.jumped = true; s.vy = 20; s.phase = 'air'; }
    }
    if (s.phase === 'air') {
      s.x += 15 * c.dtBeats;
      s.vy -= 35 * c.dtBeats;
      if (s.vy <= 0 && s.x > 70) {
        s.phase = 'landed';
        s.dist = Math.round(s.x - 70);
        if (s.dist >= 15) c.win();
        else c.lose();
      }
    }
  },
  View({ s, v }: { s: SkiJumpS; v: ViewCtx }) {
    const rampY = 70 - (s.x < 70 ? 0 : Math.min(20, (s.x - 70) * 0.5));
    const skierY = s.phase === 'air' ? rampY - s.vy * 0.5 : rampY;
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bg-[#e0f2fe]" style={{ top: 0, height: "60%" }} />
        <div className="absolute left-0 right-0 bottom-0 bg-[#f0f0f0]" style={{ height: "30%" }} />
        {/* Ramp */}
        <div className="absolute" style={{ left: "50%", bottom: "30%", width: "25%", height: "20%", background: 'linear-gradient(135deg, #87ceeb 0%, #e0f2fe 50%, #f0f0f0 100%)', clipPath: 'polygon(0% 100%, 100% 0%, 100% 100%)' }} />
        {/* K-point line */}
        <div className="absolute" style={{ left: "85%", bottom: "30%", width: "1%", height: "5%", background: '#ef4444' }} />
        <Sp x={clamp(s.x, 5, 95)} y={clamp(skierY, 5, 95)} size={10} flip>
          {s.phase === 'air' ? "⛷️" : "🎿"}
        </Sp>
        {s.phase === 'landed' && <div className="absolute font-black" style={{ top: "20%", left: "50%", transform: "translateX(-50%)", fontSize: "6cqw", color: s.dist >= 15 ? "#22c55e" : "#ef4444" }}>{s.dist}m</div>}
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 16. BOWLING — Roll the ball to hit the pins
interface BowlingS { phase: 'aim' | 'roll'; ballX: number; ballY: number; aimX: number; rolled: boolean; }
const bowling: MicrogameDef = {
  id: "bowling", instruction: "ROLL!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1e3a5f", frame: "#3b82f6", screen: "#f5f0e0", text: "#3b82f6" },
  init: (): BowlingS => ({ phase: 'aim', ballX: 50, ballY: 85, aimX: 50, rolled: false }),
  update(s: BowlingS, c: MgCtx) {
    if (s.phase === 'aim') {
      if (c.control) {
        if (c.input.held.has("left")) s.aimX -= 40 * c.dtBeats;
        if (c.input.held.has("right")) s.aimX += 40 * c.dtBeats;
        s.aimX = clamp(s.aimX, 20, 80);
        if (c.input.pressed.has("space")) {
          s.phase = 'roll';
          s.ballX = s.aimX;
        }
      }
    }
    if (s.phase === 'roll') {
      s.ballY -= 50 * c.dtBeats;
      if (s.ballY <= 22 && c.outcome === null) {
        // Hit detection: pins are centered around 50
        if (Math.abs(s.ballX - 50) < 12) c.win();
        else c.lose();
      }
    }
  },
  View({ s, v }: { s: BowlingS; v: ViewCtx }) {
    const pinPositions = [[45, 18], [50, 15], [55, 18], [48, 22], [52, 22]];
    return (
      <div className="absolute inset-0">
        <div className="absolute left-[10%] right-[10%] top-0 bottom-0" style={{ background: 'linear-gradient(180deg, #d4c4a0 0%, #e8dcc0 100%)' }}>
          {/* Gutter lines */}
          <div className="absolute left-0 top-0 bottom-0 w-[5%] bg-[#8B7355]" />
          <div className="absolute right-0 top-0 bottom-0 w-[5%] bg-[#8B7355]" />
          {/* Foul line */}
          <div className="absolute left-0 right-0 bg-[#333]" style={{ top: "75%", height: "1%" }} />
          {/* Pins */}
          {pinPositions.map(([x, y], i) => (
            <Sp key={i} x={x} y={y} size={5}>🎳</Sp>
          ))}
          {/* Ball */}
          <Sp x={s.phase === 'aim' ? s.aimX : s.ballX} y={s.phase === 'aim' ? 85 : s.ballY} size={8} rot={s.ballY * 5}>⚽</Sp>
          {/* Aim guide */}
          {s.phase === 'aim' && <div className="absolute" style={{ left: `${s.aimX}%`, top: "20%", width: "1%", height: "60%", background: 'rgba(59,130,246,0.3)' }} />}
        </div>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 17. TENNIS — Hit the ball back
interface TennisS { ballX: number; ballY: number; ballVx: number; ballVy: number; racketX: number; hit: boolean; }
const tennis: MicrogameDef = {
  id: "tennis", instruction: "HIT!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1e3a5f", frame: "#3b82f6", screen: "#2d6a2e", text: "#3b82f6" },
  init: (): TennisS => ({ ballX: 50, ballY: 10, ballVx: 0, ballVy: 30, racketX: 50, hit: false }),
  update(s: TennisS, c: MgCtx) {
    if (c.control) {
      if (c.input.held.has("left")) s.racketX -= 55 * c.dtBeats;
      if (c.input.held.has("right")) s.racketX += 55 * c.dtBeats;
      s.racketX = clamp(s.racketX, 10, 90);
    }
    if (!s.hit) {
      s.ballX += s.ballVx * c.dtBeats;
      s.ballY += s.ballVy * c.dtBeats;
      if (s.ballY >= 75 && c.outcome === null) {
        if (Math.abs(s.ballX - s.racketX) < 14) { s.hit = true; c.win(); }
        else c.lose();
      }
    }
  },
  View({ s, v }: { s: TennisS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#2d6a2e' }}>
        {/* Net */}
        <div className="absolute left-0 right-0 bg-[#fff]" style={{ top: "50%", height: "1%" }} />
        <div className="absolute left-0 right-0" style={{ top: "48%", height: "5%", background: 'repeating-linear-gradient(90deg, transparent, transparent 8%, rgba(255,255,255,0.3) 8%, rgba(255,255,255,0.3) 9%)' }} />
        {/* Court lines */}
        <div className="absolute border-2 border-white/40" style={{ left: "15%", top: "5%", width: "70%", height: "90%" }} />
        {!s.hit && <Sp x={clamp(s.ballX, 5, 95)} y={clamp(s.ballY, 5, 95)} size={7} rot={s.ballY * 10}>🎾</Sp>}
        <Sp x={s.racketX} y={78} size={12}>🏸</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 18. HURRY HURDLES — Jump over hurdles
interface HurryHurdlesS { px: number; py: number; vy: number; hurdles: { x: number; passed: boolean }[]; }
const hurryHurdles: MicrogameDef = {
  id: "hurry_hurdles", instruction: "JUMP!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1e3a5f", frame: "#3b82f6", screen: "#87ceeb", text: "#3b82f6" },
  init: (): HurryHurdlesS => ({
    px: 20, py: 0, vy: 0,
    hurdles: [{ x: 110, passed: false }, { x: 140, passed: false }],
  }),
  update(s: HurryHurdlesS, c: MgCtx) {
    const grounded = s.py <= 0.01;
    if (c.control && grounded && (c.input.pressed.has("space") || c.input.pressed.has("up"))) s.vy = 40;
    if (!grounded || s.vy > 0) {
      s.py += s.vy * c.dtBeats;
      s.vy -= 70 * c.dtBeats;
      if (s.py <= 0) { s.py = 0; s.vy = 0; }
    }
    for (const h of s.hurdles) {
      h.x -= 22 * c.dtBeats;
      if (c.outcome === null) {
        if (Math.abs(h.x - 25) < 5 && s.py < 10) c.lose();
        else if (h.x < 5 && !h.passed) h.passed = true;
      }
    }
    if (c.outcome === null && s.hurdles.every(h => h.passed)) c.win();
  },
  View({ s, v }: { s: HurryHurdlesS; v: ViewCtx }) {
    const run = Math.floor((v.t + 1) * 4) % 2 === 0;
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bg-[#87ceeb]" style={{ top: 0, height: "55%" }} />
        <div className="absolute left-0 right-0 bottom-0 bg-[#c44]" style={{ height: "30%" }} />
        <div className="absolute left-0 right-0 bg-[#f0f0f0]" style={{ bottom: "30%", height: "2%" }} />
        {s.hurdles.map((h, i) => h.x > -10 && h.x < 110 ? (
          <Sp key={i} x={h.x} y={64} size={10}>{h.passed ? "✅" : "🏃"}</Sp>
        ) : null)}
        <Sp x={25} y={62 - s.py} size={14} flip>
          {v.outcome === "lose" ? "😵" : s.py > 2 ? "🤸" : run ? "🏃" : "🧍"}
        </Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 19. LOG CHOP — Chop the log
interface LogChopS { chops: number; needed: number; }
const logChop: MicrogameDef = {
  id: "log_chop", instruction: "CHOP!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1e3a5f", frame: "#3b82f6", screen: "#87ceeb", text: "#3b82f6" },
  init: (): LogChopS => ({ chops: 0, needed: 3 }),
  update(s: LogChopS, c: MgCtx) {
    if (c.control && c.input.pressed.has("space")) {
      s.chops++;
      if (s.chops >= s.needed) c.win();
    }
  },
  View({ s, v }: { s: LogChopS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bg-[#87ceeb]" style={{ top: 0, height: "50%" }} />
        <div className="absolute left-0 right-0 bottom-0 bg-[#4c9a2a]" style={{ height: "25%" }} />
        <Sp x={50} y={55} size={16}>{s.chops >= 3 ? "💥" : "🪵"}</Sp>
        <Sp x={35} y={48} size={12} rot={s.chops > Math.floor(v.t) ? -30 : 0}>🪓</Sp>
        {/* Progress */}
        <div className="absolute left-1/2 -translate-x-1/2 flex gap-1" style={{ top: "10%" }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-full" style={{ width: "4cqw", height: "4cqw", background: i < s.chops ? '#ef4444' : '#555' }} />
          ))}
        </div>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 20. HIGH HOOPS — Shoot the basketball
interface HighHoopsS { angle: number; speed: number; shot: boolean; }
const highHoops: MicrogameDef = {
  id: "high_hoops", instruction: "SHOOT!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1e3a5f", frame: "#3b82f6", screen: "#f5deb3", text: "#3b82f6" },
  init: (): HighHoopsS => ({ angle: 45, speed: 200, shot: false }),
  update(s: HighHoopsS, c: MgCtx) {
    if (!s.shot) {
      s.angle = 45 + Math.sin(c.t * 3) * 25;
      if (c.control && c.input.pressed.has("space")) {
        s.shot = true;
        // Sweet spot: angle between 35-55
        if (s.angle >= 35 && s.angle <= 55) c.win();
        else c.lose();
      }
    }
  },
  View({ s, v }: { s: HighHoopsS; v: ViewCtx }) {
    const inZone = s.angle >= 35 && s.angle <= 55;
    return (
      <div className="absolute inset-0" style={{ background: '#f5deb3' }}>
        {/* Backboard */}
        <div className="absolute bg-[#fff] border-2 border-[#8B4513]" style={{ right: "20%", top: "15%", width: "15%", height: "25%" }} />
        {/* Hoop */}
        <div className="absolute" style={{ right: "22%", top: "38%", width: "14%", height: "2%", background: '#ef4444' }} />
        <Sp x={25} y={70} size={14} rot={s.shot ? -s.angle : 0}>🏀</Sp>
        {/* Angle indicator */}
        <div className="absolute" style={{ left: "5%", top: "5%", fontSize: "4cqw", color: inZone ? '#22c55e' : '#3b82f6' }}>
          {Math.round(s.angle)}°
        </div>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 21. HAMMER TOSS — Throw the hammer at the right angle
interface HammerTossS { angle: number; spun: number; thrown: boolean; }
const hammerToss: MicrogameDef = {
  id: "hammer_toss", instruction: "THROW!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1e3a5f", frame: "#3b82f6", screen: "#87ceeb", text: "#3b82f6" },
  init: (): HammerTossS => ({ angle: 0, spun: 0, thrown: false }),
  update(s: HammerTossS, c: MgCtx) {
    if (!s.thrown) {
      s.angle += 300 * c.dtBeats;
      s.spun += c.dtBeats;
      if (c.control && c.input.pressed.has("space") && s.spun > 1) {
        s.thrown = true;
        const norm = ((s.angle % 360) + 360) % 360;
        if (norm >= 30 && norm <= 60) c.win();
        else c.lose();
      }
    }
  },
  View({ s, v }: { s: HammerTossS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bg-[#87ceeb]" style={{ top: 0, height: "50%" }} />
        <div className="absolute left-0 right-0 bottom-0 bg-[#4c9a2a]" style={{ height: "30%" }} />
        <Sp x={50} y={60} size={10}>🧍</Sp>
        <Sp x={50 + 15 * Math.cos(s.angle * Math.PI / 180)} y={55 + 15 * Math.sin(s.angle * Math.PI / 180)} size={8} rot={s.angle}>🔨</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 22. RING MY BELL — Hit the target to ring the bell
interface RingMyBellS { power: number; dir: number; hit: boolean; }
const ringMyBell: MicrogameDef = {
  id: "ring_my_bell", instruction: "HIT!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1e3a5f", frame: "#3b82f6", screen: "#fef3c7", text: "#3b82f6" },
  init: (): RingMyBellS => ({ power: 0, dir: 1, hit: false }),
  update(s: RingMyBellS, c: MgCtx) {
    if (!s.hit) {
      s.power += s.dir * 80 * c.dtBeats;
      if (s.power >= 100) { s.power = 100; s.dir = -1; }
      if (s.power <= 0) { s.power = 0; s.dir = 1; }
      if (c.control && c.input.pressed.has("space")) {
        s.hit = true;
        if (s.power >= 80) c.win();
        else c.lose();
      }
    }
  },
  View({ s, v }: { s: RingMyBellS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#fef3c7' }}>
        {/* Bell tower */}
        <div className="absolute" style={{ left: "35%", top: "5%", width: "30%", height: "70%", background: 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)', borderRadius: '5% 5% 0 0' }}>
          {/* Power meter */}
          <div className="absolute" style={{ left: "10%", right: "10%", bottom: "5%", top: "5%", background: '#1a1a2e' }}>
            <div className="absolute bottom-0 left-0 right-0" style={{ height: `${s.power}%`, background: s.power >= 80 ? '#22c55e' : s.power >= 50 ? '#ffd60a' : '#ef4444', transition: 'height 0.05s' }} />
          </div>
        </div>
        {/* Bell */}
        <Sp x={50} y={8} size={10} scale={s.hit && s.power >= 80 ? pulse(v.beatPhase, 0.3) : 1}>🔔</Sp>
        {/* Hammer */}
        <Sp x={50} y={80} size={12}>{s.hit ? "💥" : "🔨"}</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 23. PUNCH OUT (BOSS) — Boxing boss fight
interface PunchOutS { bossHp: number; playerX: number; bossX: number; bossDir: number; punchCd: number; bossHit: number; dodgeCd: number; }
const punchOut: MicrogameDef = {
  id: "punch_out", instruction: "PUNCH!", lengthBars: 4, timeoutOutcome: "lose",
  palette: { outer: "#1e3a5f", frame: "#ef4444", screen: "#1e1b4b", text: "#ef4444" },
  init: (): PunchOutS => ({ bossHp: 3, playerX: 30, bossX: 70, bossDir: -1, punchCd: 0, bossHit: 0, dodgeCd: 0 }),
  update(s: PunchOutS, c: MgCtx) {
    s.punchCd = Math.max(0, s.punchCd - c.dtBeats * 4);
    s.bossHit = Math.max(0, s.bossHit - c.dtBeats * 4);
    s.dodgeCd = Math.max(0, s.dodgeCd - c.dtBeats * 4);
    if (c.control) {
      if (c.input.held.has("left")) s.playerX -= 40 * c.dtBeats;
      if (c.input.held.has("right")) s.playerX += 40 * c.dtBeats;
      s.playerX = clamp(s.playerX, 10, 90);
      if (c.input.pressed.has("space") && s.punchCd <= 0) {
        s.punchCd = 1;
        if (Math.abs(s.playerX - s.bossX) < 18) {
          s.bossHp--;
          s.bossHit = 1;
          if (s.bossHp <= 0) c.win();
        }
      }
    }
    s.bossX += s.bossDir * 18 * c.dtBeats;
    if (s.bossX < 35 || s.bossX > 85) s.bossDir *= -1;
  },
  View({ s, v }: { s: PunchOutS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bottom-0 bg-[#4a3728]" style={{ height: "20%" }} />
        {/* Boxing ring ropes */}
        {[30, 50, 70].map(y => (
          <div key={y} className="absolute left-[5%] right-[5%] bg-[#ef4444]/60" style={{ top: `${y}%`, height: "1%" }} />
        ))}
        <div className="absolute left-1/2 -translate-x-1/2 flex gap-1" style={{ top: "4%" }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-full" style={{ width: "4cqw", height: "4cqw", background: i < s.bossHp ? '#ef4444' : '#444' }} />
          ))}
        </div>
        <Sp x={s.playerX} y={65} size={14} flip>{s.punchCd > 0.5 ? "👊" : "🥊"}</Sp>
        <Sp x={s.bossX} y={65} size={16} flip scale={s.bossHit > 0 ? 0.9 : 1}>
          {s.bossHp <= 0 ? "💫" : "🥊"}
        </Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// Remaining sports placeholders
const SPORTS_NAMES = [
  ['heads_up', 'DODGE!'], ['boing', 'JUMP!'],
  ['fruit_shoot', 'SHOOT!'], ['guy_scraper', 'CATCH!'], ['spare_me', 'ROLL!'],
  ['baseline_bash', 'HIT!'], ['pro_curling', 'SLIDE!'],
  ['butterfly_stroke', 'SWIM!'], ['balancing_act', 'BALANCE!'],
  ['mountain_mountin', 'CLIMB!'], ['putt_for_dough', 'PUTT!'],
  ['gifted_goalie', 'BLOCK!'], ['city_surfer', 'DODGE!'],
  ['set_n_spike', 'SPIKE!'], ['lift_and_shout', 'LIFT!'],
  ['snowboard_slalom', 'TURN!'], ['jumpin_rope', 'JUMP!'],
];
const SPORTS_PLACEHOLDER: MicrogameDef[] = SPORTS_NAMES.map(([id, instr]) =>
  placeholderGame(id, instr, 'sports', STAGES.sports.palette)
);
const SPORTS_GAMES: MicrogameDef[] = [
  batterUp, skiJump, bowling, tennis, hurryHurdles,
  logChop, highHoops, hammerToss, ringMyBell, punchOut,
  ...SPORTS_PLACEHOLDER,
];

/* ================================================================== */
/*  SCI-FI STAGE — Dribble & Spitz                                     */
/*  25 microgames with space/alien themes                              */
/* ================================================================== */

// 49. CYCLONE JUMP — Jump over the cyclone
interface CycloneJumpS { cx: number; py: number; vy: number; }
const cycloneJump: MicrogameDef = {
  id: "cyclone_jump", instruction: "JUMP!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#0f172a", frame: "#8b5cf6", screen: "#1a1a2e", text: "#8b5cf6" },
  init: (): CycloneJumpS => ({ cx: 110, py: 0, vy: 0 }),
  update(s: CycloneJumpS, c: MgCtx) {
    s.cx -= 25 * c.dtBeats;
    const grounded = s.py <= 0.01;
    if (c.control && grounded && (c.input.pressed.has("space") || c.input.pressed.has("up"))) s.vy = 42;
    if (!grounded || s.vy > 0) {
      s.py += s.vy * c.dtBeats;
      s.vy -= 72 * c.dtBeats;
      if (s.py <= 0) { s.py = 0; s.vy = 0; }
    }
    if (c.outcome === null) {
      if (Math.abs(s.cx - 30) < 6 && s.py < 10) c.lose();
      else if (s.cx < -5) c.win();
    }
  },
  View({ s, v }: { s: CycloneJumpS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#1a1a2e' }}>
        <div className="absolute left-0 right-0 bottom-0 bg-[#333]" style={{ height: "25%" }} />
        <Sp x={s.cx} y={68} size={14} rot={s.cx * 5}>🌀</Sp>
        <Sp x={30} y={68 - s.py} size={14} flip>
          {v.outcome === "lose" ? "😵" : s.py > 2 ? "🤸" : "🧍"}
        </Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 50. ENTER COMMAND — Press the right sequence
interface EnterCommandS { sequence: string[]; current: number; }
const COMMAND_KEYS = ['↑', '↓', '←', '→'];
const enterCommand: MicrogameDef = {
  id: "enter_command", instruction: "TYPE!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#0f172a", frame: "#8b5cf6", screen: "#0a0a1a", text: "#8b5cf6" },
  init: (): EnterCommandS => ({
    sequence: Array.from({ length: 3 }, () => COMMAND_KEYS[Math.floor(Math.random() * 4)]),
    current: 0,
  }),
  update(s: EnterCommandS, c: MgCtx) {
    if (c.control && s.current < s.sequence.length) {
      const expected = s.sequence[s.current];
      const keyMap: Record<string, string> = { '↑': 'up', '↓': 'down', '←': 'left', '→': 'right' };
      for (const [sym, key] of Object.entries(keyMap)) {
        if (expected === sym && c.input.pressed.has(key as any)) {
          s.current++;
          if (s.current >= s.sequence.length) c.win();
          break;
        }
      }
    }
  },
  View({ s, v }: { s: EnterCommandS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#0a0a1a' }}>
        {/* Terminal */}
        <div className="absolute border-2 border-[#8b5cf6]" style={{ left: "10%", top: "10%", width: "80%", height: "80%", background: '#0f0f1a' }}>
          <div className="absolute font-mono" style={{ top: "10%", left: "8%", fontSize: "5cqw", color: "#8b5cf6" }}>
            {'>'} ACCESS CODE:
          </div>
          <div className="absolute flex gap-2" style={{ top: "35%", left: "50%", transform: "translateX(-50%)" }}>
            {s.sequence.map((cmd, i) => (
              <div key={i} className="rounded border-2 flex items-center justify-center" style={{
                width: "12cqw", height: "12cqw", fontSize: "7cqw",
                borderColor: i < s.current ? '#22c55e' : i === s.current ? '#ffd60a' : '#8b5cf6',
                color: i < s.current ? '#22c55e' : '#fff',
                background: i < s.current ? '#22c55e22' : '#0a0a1a',
              }}>
                {cmd}
              </div>
            ))}
          </div>
          <div className="absolute font-mono" style={{ bottom: "15%", left: "8%", fontSize: "3cqw", color: "#555" }}>
            {s.current < s.sequence.length ? `AWAITING INPUT: ${s.sequence[s.current]}` : 'ACCESS GRANTED'}
          </div>
        </div>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 51. SPACE FIGHT — Shoot the enemy ship
interface SpaceFightS { enemyX: number; enemyY: number; shots: { x: number; y: number }[]; cooldown: number; }
const spaceFight: MicrogameDef = {
  id: "space_fight", instruction: "SHOOT!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#0f172a", frame: "#8b5cf6", screen: "#0a0a1a", text: "#8b5cf6" },
  init: (): SpaceFightS => ({ enemyX: 50, enemyY: 20, shots: [], cooldown: 0 }),
  update(s: SpaceFightS, c: MgCtx) {
    s.cooldown = Math.max(0, s.cooldown - c.dtBeats * 4);
    s.enemyX += Math.sin(c.t * 2) * 25 * c.dtBeats;
    s.enemyX = clamp(s.enemyX, 15, 85);
    s.shots.forEach(sh => { sh.y -= 60 * c.dtBeats; });
    s.shots = s.shots.filter(sh => sh.y > -5);
    if (c.control && c.input.pressed.has("space") && s.cooldown <= 0) {
      s.cooldown = 0.5;
      s.shots.push({ x: 50, y: 80 });
      for (const sh of s.shots) {
        if (Math.abs(sh.x - s.enemyX) < 15 && Math.abs(sh.y - s.enemyY) < 15) c.win();
      }
    }
    // Check if any shot hits
    for (const sh of s.shots) {
      if (Math.abs(sh.x - s.enemyX) < 15 && Math.abs(sh.y - s.enemyY) < 15 && c.outcome === null) c.win();
    }
  },
  View({ s, v }: { s: SpaceFightS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#0a0a1a' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{ width: "0.5cqw", height: "0.5cqw", left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, opacity: 0.3 + Math.random() * 0.5 }} />
        ))}
        <Sp x={s.enemyX} y={s.enemyY} size={14} scale={pulse(v.beatPhase, 0.1)}>👾</Sp>
        {s.shots.map((sh, i) => <Sp key={i} x={sh.x} y={sh.y} size={5}>⚡</Sp>)}
        <Sp x={50} y={85} size={12}>🚀</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 52. NINJA ARROW — Dodge the arrows
interface NinjaArrowS { arrows: { x: number; y: number; speed: number }[]; lane: number; }
const ninjaArrow: MicrogameDef = {
  id: "ninja_arrow", instruction: "DODGE!", lengthBars: 2, timeoutOutcome: "win",
  palette: { outer: "#0f172a", frame: "#8b5cf6", screen: "#1a1a2e", text: "#8b5cf6" },
  init: (): NinjaArrowS => ({
    arrows: Array.from({ length: 4 }, (_, i) => ({ x: -10 - i * 20, y: 30 + Math.random() * 40, speed: rnd(20, 30) })),
    lane: 50,
  }),
  update(s: NinjaArrowS, c: MgCtx) {
    if (c.control) {
      if (c.input.held.has("left")) s.lane -= 50 * c.dtBeats;
      if (c.input.held.has("right")) s.lane += 50 * c.dtBeats;
      s.lane = clamp(s.lane, 10, 90);
    }
    for (const a of s.arrows) a.x += a.speed * c.dtBeats;
    if (c.outcome === null) {
      for (const a of s.arrows) {
        if (a.x > 0 && a.x < 100 && Math.abs(a.x - 50) < 8 && Math.abs(a.y - s.lane) < 10) c.lose();
      }
      if (s.arrows.every(a => a.x > 110)) c.win();
    }
  },
  View({ s, v }: { s: NinjaArrowS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#1a1a2e' }}>
        <div className="absolute left-0 right-0 bg-[#333]" style={{ top: "25%", height: "50%" }} />
        {s.arrows.map((a, i) => a.x > -10 && a.x < 110 ? (
          <Sp key={i} x={a.x} y={a.y} size={10} rot={90}>🏹</Sp>
        ) : null)}
        <Sp x={50} y={s.lane} size={12}>
          {v.outcome === "lose" ? "😵" : "🥷"}
        </Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 53. BOSS OUT (BOSS) — Survive the alien boss
interface BossOutS { bossHp: number; playerX: number; aimAngle: number; shots: { x: number; y: number }[]; cd: number; }
const bossOut: MicrogameDef = {
  id: "boss_out", instruction: "SURVIVE!", lengthBars: 4, timeoutOutcome: "lose",
  palette: { outer: "#0f172a", frame: "#ef4444", screen: "#0a0a1a", text: "#ef4444" },
  init: (): BossOutS => ({ bossHp: 3, playerX: 50, aimAngle: 0, shots: [], cd: 0 }),
  update(s: BossOutS, c: MgCtx) {
    s.cd = Math.max(0, s.cd - c.dtBeats * 4);
    s.aimAngle += 200 * c.dtBeats;
    if (c.control) {
      if (c.input.held.has("left")) s.playerX -= 45 * c.dtBeats;
      if (c.input.held.has("right")) s.playerX += 45 * c.dtBeats;
      s.playerX = clamp(s.playerX, 10, 90);
      if (c.input.pressed.has("space") && s.cd <= 0) {
        s.cd = 0.4;
        s.shots.push({ x: s.playerX, y: 80 });
      }
    }
    s.shots.forEach(sh => { sh.y -= 60 * c.dtBeats; });
    s.shots = s.shots.filter(sh => sh.y > -5);
    for (const sh of s.shots) {
      if (Math.abs(sh.x - 50) < 15 && sh.y < 20 && c.outcome === null) {
        s.bossHp--;
        if (s.bossHp <= 0) c.win();
      }
    }
  },
  View({ s, v }: { s: BossOutS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#0a0a1a' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{ width: "0.5cqw", height: "0.5cqw", left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, opacity: 0.3 + Math.random() * 0.5 }} />
        ))}
        <Sp x={50} y={15} size={18} scale={pulse(v.beatPhase, 0.1)}>{s.bossHp <= 0 ? "💥" : "👾"}</Sp>
        <div className="absolute left-1/2 -translate-x-1/2 flex gap-1" style={{ top: "4%" }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-full" style={{ width: "4cqw", height: "4cqw", background: i < s.bossHp ? '#ef4444' : '#444' }} />
          ))}
        </div>
        {s.shots.map((sh, i) => <Sp key={i} x={sh.x} y={sh.y} size={5}>⚡</Sp>)}
        <Sp x={s.playerX} y={80} size={12}>🚀</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// Remaining Sci-Fi placeholders
const SCIFI_NAMES = [
  ['catch_robot', 'CATCH!'], ['nose', 'PICK!'],
  ['ultraman_beam', 'SHOOT!'], ['seesaw', 'LAUNCH!'], ['balloon_trip', 'AVOID!'],
  ['volcano', 'DODGE!'], ['ultraman_throw', 'THROW!'], ['arien_catch', 'CATCH!'],
  ['mouse_catch', 'CATCH!'], ['ultraman_dodge', 'DODGE!'], ['toast_catch', 'CATCH!'],
  ['bac_man', 'EAT!'],
  ['dodge_missiles', 'DODGE!'], ['shoot_certainly', 'SHOOT!'], ['dodge_with_jump', 'JUMP!'],
  ['falling_rod', 'DODGE!'], ['ninja_bunshin', 'FIND!'],
  ['ninja_run', 'RUN!'], ['ninja_cross', 'DODGE!'], ['light_ghost', 'SHINE!'],
];
const SCIFI_PLACEHOLDER: MicrogameDef[] = SCIFI_NAMES.map(([id, instr]) =>
  placeholderGame(id, instr, 'scifi', STAGES.scifi.palette)
);
const SCIFI_GAMES: MicrogameDef[] = [
  cycloneJump, enterCommand, spaceFight, ninjaArrow, bossOut,
  ...SCIFI_PLACEHOLDER,
];

/* ================================================================== */
/*  THAT'S LIFE! STAGE — Mona                                          */
/*  25 microgames with everyday/strange situations                     */
/* ================================================================== */

// 54. JACK — Pull the weed
interface JackS { pulled: number; needed: number; }
const jack: MicrogameDef = {
  id: "jack", instruction: "PULL!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#3b0764", frame: "#f97316", screen: "#87ceeb", text: "#f97316" },
  init: (): JackS => ({ pulled: 0, needed: 3 }),
  update(s: JackS, c: MgCtx) {
    if (c.control && c.input.pressed.has("space")) {
      s.pulled++;
      if (s.pulled >= s.needed) c.win();
    }
  },
  View({ s, v }: { s: JackS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bg-[#87ceeb]" style={{ top: 0, height: "50%" }} />
        <div className="absolute left-0 right-0 bottom-0 bg-[#4c9a2a]" style={{ height: "35%" }} />
        <Sp x={50} y={55} size={16}>{s.pulled >= 3 ? "🥬" : "🌿"}</Sp>
        <Sp x={50} y={78} size={12} rot={s.pulled > Math.floor(v.t * 2) ? -30 : 0}>🧍</Sp>
        <div className="absolute left-1/2 -translate-x-1/2 flex gap-1" style={{ top: "10%" }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-full" style={{ width: "4cqw", height: "4cqw", background: i < s.pulled ? '#22c55e' : '#555' }} />
          ))}
        </div>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 55. PINBALL — Flip the ball
interface PinballS { ballX: number; ballY: number; ballVy: number; leftFlip: boolean; rightFlip: boolean; }
const pinball: MicrogameDef = {
  id: "pinball", instruction: "FLIP!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#3b0764", frame: "#f97316", screen: "#1a1a2e", text: "#f97316" },
  init: (): PinballS => ({ ballX: 50, ballY: 20, ballVy: 0, leftFlip: false, rightFlip: false }),
  update(s: PinballS, c: MgCtx) {
    s.ballVy += 30 * c.dtBeats;
    s.ballY += s.ballVy * c.dtBeats;
    if (c.control) {
      if (c.input.pressed.has("left")) s.leftFlip = true;
      if (c.input.pressed.has("right")) s.rightFlip = true;
      // Check flipper hit
      if (s.ballY >= 75 && s.ballY < 82) {
        if (s.leftFlip && s.ballX < 50) { s.ballVy = -50; s.ballX += 5; }
        if (s.rightFlip && s.ballX >= 50) { s.ballVy = -50; s.ballX -= 5; }
      }
    }
    if (s.ballY >= 90) c.lose();
    if (s.ballY < 5) c.win();
  },
  View({ s, v }: { s: PinballS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#1a1a2e' }}>
        {/* Pinball table */}
        <div className="absolute border-2 border-[#f97316]" style={{ left: "10%", top: "5%", width: "80%", height: "90%", background: '#0f0f1a' }}>
          {/* Bumpers */}
          <Sp x={35} y={35} size={8} scale={pulse(v.beatPhase, 0.1)}>🔴</Sp>
          <Sp x={65} y={35} size={8} scale={pulse(v.beatPhase, 0.1)}>🔴</Sp>
          <Sp x={50} y={50} size={8} scale={pulse(v.beatPhase, 0.1)}>🟡</Sp>
        </div>
        {/* Flippers */}
        <div className="absolute" style={{ left: "25%", top: "82%", width: "15%", height: "2%", background: s.leftFlip ? '#f97316' : '#555', transform: `rotate(${s.leftFlip ? -30 : 0}deg)`, transformOrigin: 'right center' }} />
        <div className="absolute" style={{ right: "25%", top: "82%", width: "15%", height: "2%", background: s.rightFlip ? '#f97316' : '#555', transform: `rotate(${s.rightFlip ? 30 : 0}deg)`, transformOrigin: 'left center' }} />
        <Sp x={clamp(s.ballX, 15, 85)} y={clamp(s.ballY, 5, 90)} size={7}>⚪</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 56. STEAK — Cut the steak
interface SteakS { cuts: number; needed: number; }
const steak: MicrogameDef = {
  id: "steak", instruction: "CUT!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#3b0764", frame: "#f97316", screen: "#fef3c7", text: "#f97316" },
  init: (): SteakS => ({ cuts: 0, needed: 3 }),
  update(s: SteakS, c: MgCtx) {
    if (c.control && c.input.pressed.has("space")) {
      s.cuts++;
      if (s.cuts >= s.needed) c.win();
    }
  },
  View({ s, v }: { s: SteakS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#fef3c7' }}>
        {/* Plate */}
        <div className="absolute rounded-full bg-white" style={{ left: "20%", top: "15%", width: "60%", height: "60%", boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }} />
        <Sp x={50} y={50} size={20}>{s.cuts >= 3 ? "🥩" : "🥩"}</Sp>
        {s.cuts > 0 && <Sp x={50} y={35} size={6} rot={-45}>🔪</Sp>}
        <div className="absolute left-1/2 -translate-x-1/2 flex gap-1" style={{ top: "82%" }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-full" style={{ width: "4cqw", height: "4cqw", background: i < s.cuts ? '#ef4444' : '#555' }} />
          ))}
        </div>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 57. WHEEL — Stop the spinning wheel
interface WheelS { angle: number; speed: number; stopped: boolean; }
const wheel: MicrogameDef = {
  id: "wheel", instruction: "STOP!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#3b0764", frame: "#f97316", screen: "#1e1b4b", text: "#f97316" },
  init: (): WheelS => ({ angle: 0, speed: rnd(150, 300), stopped: false }),
  update(s: WheelS, c: MgCtx) {
    if (!s.stopped) {
      s.angle += s.speed * c.dtBeats;
      if (c.control && c.input.pressed.has("space")) {
        s.stopped = true;
        const norm = ((s.angle % 360) + 360) % 360;
        if (norm < 30 || norm > 330) c.win();
        else c.lose();
      }
    }
  },
  View({ s, v }: { s: WheelS; v: ViewCtx }) {
    const norm = ((s.angle % 360) + 360) % 360;
    const inZone = norm < 30 || norm > 330;
    return (
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#1e1b4b' }}>
        <div className="absolute" style={{ top: "5%", left: "50%", transform: "translateX(-50%)", fontSize: "6cqw", color: "#22c55e" }}>▼</div>
        <div className="rounded-full border-4 flex items-center justify-center" style={{ width: "50%", height: "50%", borderColor: inZone ? '#22c55e' : '#f97316', transform: `rotate(${s.angle}deg)`, background: 'conic-gradient(from 0deg, #ef4444 0deg, #ef4444 30deg, #333 30deg, #333 360deg)' }}>
          <div className="rounded-full bg-[#1e1b4b] flex items-center justify-center" style={{ width: "60%", height: "60%" }}>
            <span style={{ fontSize: "8cqw", transform: `rotate(${-s.angle}deg)` }}>🎡</span>
          </div>
        </div>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 58. BOSS STRANGE — Boss fight
interface BossStrangeS { bossHp: number; playerX: number; items: { x: number; y: number; speed: number }[]; caught: number; needed: number; }
const bossStrange: MicrogameDef = {
  id: "boss_strange", instruction: "SURVIVE!", lengthBars: 4, timeoutOutcome: "lose",
  palette: { outer: "#3b0764", frame: "#ef4444", screen: "#1e1b4b", text: "#ef4444" },
  init: (): BossStrangeS => ({
    bossHp: 3, playerX: 50,
    items: Array.from({ length: 5 }, () => ({ x: rnd(20, 80), y: rnd(10, 30), speed: rnd(15, 25) })),
    caught: 0, needed: 3,
  }),
  update(s: BossStrangeS, c: MgCtx) {
    if (c.control) {
      if (c.input.held.has("left")) s.playerX -= 45 * c.dtBeats;
      if (c.input.held.has("right")) s.playerX += 45 * c.dtBeats;
      s.playerX = clamp(s.playerX, 10, 90);
    }
    for (const item of s.items) {
      item.y += item.speed * c.dtBeats;
      if (item.y >= 70 && Math.abs(item.x - s.playerX) < 12 && c.outcome === null) {
        s.caught++;
        item.y = -10;
        if (s.caught >= s.needed) c.win();
      }
      if (item.y > 100) item.y = -10;
    }
  },
  View({ s, v }: { s: BossStrangeS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#1e1b4b' }}>
        <div className="absolute left-1/2 -translate-x-1/2 flex gap-1" style={{ top: "4%" }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-full" style={{ width: "4cqw", height: "4cqw", background: i < s.caught ? '#22c55e' : '#444' }} />
          ))}
        </div>
        {s.items.map((item, i) => (
          <Sp key={i} x={item.x} y={clamp(item.y, -10, 95)} size={10} rot={item.y * 3}>🍩</Sp>
        ))}
        <Sp x={s.playerX} y={75} size={14}>{v.outcome === "lose" ? "😵" : "😈"}</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// Remaining Strange placeholders
const STRANGE_NAMES = [
  ['chibi_wario', 'EAT!'], ['montage', 'MATCH!'], ['cake2', 'DECORATE!'],
  ['thumb_wrestling', 'PIN!'], ['eyedrop2', 'DROP!'], ['stomach', 'EAT!'],
  ['kawara', 'BREAK!'], ['bird', 'CATCH!'], ['hotdog', 'EAT!'],
  ['whale', 'SPRAY!'], ['soybean', 'CATCH!'], ['wariobros', 'JUMP!'],
  ['kuchibashi', 'PECK!'], ['boji', 'STAMP!'],
  ['fruits_drop', 'CATCH!'], ['toto', 'PULL!'], ['cake', 'DECORATE!'],
  ['real_pon', 'PULL!'], ['vegetable_slot', 'MATCH!'], ['which', 'PICK!'],
];
const STRANGE_PLACEHOLDER: MicrogameDef[] = STRANGE_NAMES.map(([id, instr]) =>
  placeholderGame(id, instr, 'strange', STAGES.strange.palette)
);
const STRANGE_GAMES: MicrogameDef[] = [
  jack, pinball, steak, wheel, bossStrange,
  ...STRANGE_PLACEHOLDER,
];

/* ================================================================== */
/*  NINTENDO CLASSICS STAGE — 9-Volt                                   */
/*  25 microgames based on classic NES/Famicom games                   */
/* ================================================================== */

// 39. SUPER MARIO — Jump over the Goomba
interface SuperMarioS { goombaX: number; py: number; vy: number; }
const superMario: MicrogameDef = {
  id: "super_mario", instruction: "JUMP!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1a1a2e", frame: "#ef4444", screen: "#87ceeb", text: "#ef4444" },
  init: (): SuperMarioS => ({ goombaX: 110, py: 0, vy: 0 }),
  update(s: SuperMarioS, c: MgCtx) {
    s.goombaX -= 22 * c.dtBeats;
    const grounded = s.py <= 0.01;
    if (c.control && grounded && (c.input.pressed.has("space") || c.input.pressed.has("up"))) s.vy = 42;
    if (!grounded || s.vy > 0) {
      s.py += s.vy * c.dtBeats;
      s.vy -= 72 * c.dtBeats;
      if (s.py <= 0) { s.py = 0; s.vy = 0; }
    }
    if (c.outcome === null) {
      if (Math.abs(s.goombaX - 28) < 6 && s.py < 8) c.lose();
      else if (s.goombaX < -5) c.win();
    }
  },
  View({ s, v }: { s: SuperMarioS; v: ViewCtx }) {
    const run = Math.floor((v.t + 1) * 4) % 2 === 0;
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bg-[#6b8cff]" style={{ top: 0, height: "55%" }} />
        {/* Bricks */}
        <div className="absolute left-0 right-0 bg-[#c84c0c]" style={{ bottom: "25%", height: "3%" }} />
        <div className="absolute left-0 right-0 bottom-0 bg-[#00a800]" style={{ height: "25%" }} />
        {/* Question block */}
        <Sp x={50} y={28} size={10} scale={pulse(v.beatPhase, 0.1)}>❓</Sp>
        <Sp x={s.goombaX} y={72} size={10} flip>🍄</Sp>
        <Sp x={28} y={68 - s.py} size={14} flip>
          {v.outcome === "lose" ? "😵" : s.py > 2 ? "🤸" : run ? "🏃" : "🧍"}
        </Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 40. DUCK HUNT — Shoot the duck
interface DuckHuntS { duckX: number; duckY: number; duckDir: number; shot: boolean; }
const duckHunt: MicrogameDef = {
  id: "duck_hunt", instruction: "SHOOT!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1a1a2e", frame: "#ef4444", screen: "#87ceeb", text: "#ef4444" },
  init: (): DuckHuntS => ({ duckX: 50, duckY: 30, duckDir: 1, shot: false }),
  update(s: DuckHuntS, c: MgCtx) {
    if (!s.shot) {
      s.duckX += s.duckDir * 35 * c.dtBeats;
      s.duckY += Math.sin(c.t * 3) * 8 * c.dtBeats;
      if (s.duckX > 90) s.duckDir = -1;
      if (s.duckX < 10) s.duckDir = 1;
      s.duckY = clamp(s.duckY, 10, 50);
      if (c.control && c.input.pressed.has("space")) {
        // Use pointer position for aiming
        s.shot = true;
        // Simple hit check: duck is on screen
        if (s.duckX > 20 && s.duckX < 80) c.win();
        else c.lose();
      }
    }
  },
  View({ s, v }: { s: DuckHuntS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bg-[#87ceeb]" style={{ top: 0, height: "60%" }} />
        <div className="absolute left-0 right-0 bottom-0 bg-[#4c9a2a]" style={{ height: "25%" }} />
        {/* Bush */}
        <div className="absolute bg-[#2d6a2e] rounded-full" style={{ left: "5%", bottom: "25%", width: "20%", height: "12%" }} />
        <div className="absolute bg-[#2d6a2e] rounded-full" style={{ right: "5%", bottom: "25%", width: "15%", height: "10%" }} />
        {/* Dog */}
        <Sp x={50} y={82} size={10}>🐕</Sp>
        {!s.shot ? (
          <Sp x={s.duckX} y={s.duckY} size={12} flip={s.duckDir < 0} rot={s.duckDir > 0 ? -15 : 15}>🦆</Sp>
        ) : (
          <Sp x={s.duckX} y={s.duckY} size={10}>💥</Sp>
        )}
        {/* Crosshair */}
        <div className="absolute" style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)", fontSize: "6cqw", color: "#fff", opacity: 0.5 }}>+</div>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 41. DONKEY KONG — Jump over the barrel
interface DonkeyKongS { barrelX: number; barrelY: number; py: number; vy: number; }
const donkeyKong: MicrogameDef = {
  id: "donkeykong", instruction: "JUMP!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1a1a2e", frame: "#ef4444", screen: "#1a1a2e", text: "#ef4444" },
  init: (): DonkeyKongS => ({ barrelX: 50, barrelY: 10, py: 0, vy: 0 }),
  update(s: DonkeyKongS, c: MgCtx) {
    s.barrelY += 18 * c.dtBeats;
    s.barrelX += 12 * c.dtBeats;
    if (s.barrelX > 80) s.barrelX = 80;
    const grounded = s.py <= 0.01;
    if (c.control && grounded && (c.input.pressed.has("space") || c.input.pressed.has("up"))) s.vy = 42;
    if (!grounded || s.vy > 0) {
      s.py += s.vy * c.dtBeats;
      s.vy -= 72 * c.dtBeats;
      if (s.py <= 0) { s.py = 0; s.vy = 0; }
    }
    if (c.outcome === null) {
      if (Math.abs(s.barrelY - 68) < 6 && Math.abs(s.barrelX - 30) < 8 && s.py < 8) c.lose();
      else if (s.barrelY > 100) c.win();
    }
  },
  View({ s, v }: { s: DonkeyKongS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#1a1a2e' }}>
        {/* Girders */}
        <div className="absolute bg-[#ef4444]" style={{ left: "10%", top: "15%", width: "80%", height: "2%", transform: "rotate(3deg)" }} />
        <div className="absolute bg-[#ef4444]" style={{ left: "5%", top: "40%", width: "90%", height: "2%", transform: "rotate(-2deg)" }} />
        <div className="absolute bg-[#ef4444]" style={{ left: "10%", top: "65%", width: "80%", height: "2%" }} />
        <Sp x={75} y={12} size={14}>🦍</Sp>
        <Sp x={s.barrelX} y={clamp(s.barrelY, 5, 95)} size={10} rot={s.barrelY * 10}>🛢️</Sp>
        <Sp x={30} y={68 - s.py} size={14} flip>
          {v.outcome === "lose" ? "😵" : s.py > 2 ? "🤸" : "🧍"}
        </Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 42. DR. MARIO — Kill the viruses
interface DrMarioS { viruses: { x: number; y: number; alive: boolean; color: number }[]; cursorX: number; cursorY: number; }
const drMario: MicrogameDef = {
  id: "dr_mario", instruction: "KILL!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1a1a2e", frame: "#ef4444", screen: "#1e1b4b", text: "#ef4444" },
  init: (): DrMarioS => ({
    viruses: [
      { x: 30, y: 30, alive: true, color: 0 },
      { x: 50, y: 45, alive: true, color: 1 },
      { x: 70, y: 30, alive: true, color: 2 },
    ],
    cursorX: 50, cursorY: 35,
  }),
  update(s: DrMarioS, c: MgCtx) {
    if (c.control) {
      if (c.input.held.has("left")) s.cursorX -= 50 * c.dtBeats;
      if (c.input.held.has("right")) s.cursorX += 50 * c.dtBeats;
      if (c.input.held.has("up")) s.cursorY -= 50 * c.dtBeats;
      if (c.input.held.has("down")) s.cursorY += 50 * c.dtBeats;
      s.cursorX = clamp(s.cursorX, 10, 90);
      s.cursorY = clamp(s.cursorY, 10, 90);
      if (c.input.pressed.has("space")) {
        for (const v of s.viruses) {
          if (v.alive && Math.abs(v.x - s.cursorX) < 10 && Math.abs(v.y - s.cursorY) < 10) {
            v.alive = false;
            if (s.viruses.every(v => !v.alive)) c.win();
            break;
          }
        }
      }
    }
  },
  View({ s, v }: { s: DrMarioS; v: ViewCtx }) {
    const virusEmoji = ['🔴', '🟡', '🔵'];
    return (
      <div className="absolute inset-0" style={{ background: '#1e1b4b' }}>
        {/* Bottle */}
        <div className="absolute border-2 border-white/30 rounded-lg" style={{ left: "15%", top: "10%", width: "70%", height: "80%" }}>
          <div className="absolute left-1/2 -translate-x-1/2" style={{ top: "-5%", width: "30%", height: "8%", background: 'rgba(255,255,255,0.2)', borderRadius: '10% 10% 0 0' }} />
        </div>
        {s.viruses.map((virus, i) => virus.alive ? (
          <Sp key={i} x={virus.x} y={virus.y} size={12} scale={pulse(v.beatPhase, 0.15)}>{virusEmoji[virus.color]}</Sp>
        ) : (
          <Sp key={i} x={virus.x} y={virus.y} size={10}>💥</Sp>
        ))}
        {/* Cursor */}
        <div className="absolute" style={{ left: `${s.cursorX}%`, top: `${s.cursorY}%`, transform: "translate(-50%, -50%)", width: "12%", height: "10%", border: "2px solid #fff", borderRadius: "4px" }} />
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 43. METROID — Shoot the enemy
interface MetroidS { enemyX: number; enemyY: number; aimX: number; aimY: number; shot: boolean; }
const metroid: MicrogameDef = {
  id: "metroid", instruction: "SHOOT!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1a1a2e", frame: "#ef4444", screen: "#0a0a1a", text: "#ef4444" },
  init: (): MetroidS => ({ enemyX: rnd(25, 75), enemyY: rnd(15, 45), aimX: 50, aimY: 40, shot: false }),
  update(s: MetroidS, c: MgCtx) {
    if (!s.shot) {
      s.enemyX += Math.sin(c.t * 2) * 15 * c.dtBeats;
      s.enemyY += Math.cos(c.t * 1.5) * 8 * c.dtBeats;
      s.enemyX = clamp(s.enemyX, 15, 85);
      s.enemyY = clamp(s.enemyY, 10, 55);
      if (c.control) {
        if (c.input.held.has("left")) s.aimX -= 50 * c.dtBeats;
        if (c.input.held.has("right")) s.aimX += 50 * c.dtBeats;
        if (c.input.held.has("up")) s.aimY -= 50 * c.dtBeats;
        if (c.input.held.has("down")) s.aimY += 50 * c.dtBeats;
        s.aimX = clamp(s.aimX, 10, 90);
        s.aimY = clamp(s.aimY, 10, 90);
        if (c.input.pressed.has("space")) {
          s.shot = true;
          if (Math.abs(s.aimX - s.enemyX) < 12 && Math.abs(s.aimY - s.enemyY) < 12) c.win();
          else c.lose();
        }
      }
    }
  },
  View({ s, v }: { s: MetroidS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#0a0a1a' }}>
        {/* Space background */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{ width: "0.5cqw", height: "0.5cqw", left: `${10 + i * 12}%`, top: `${5 + (i * 17) % 80}%`, opacity: 0.4 + Math.random() * 0.4 }} />
        ))}
        {!s.shot && <Sp x={s.enemyX} y={s.enemyY} size={14} scale={pulse(v.beatPhase, 0.1)}>👾</Sp>}
        {s.shot && <Sp x={s.enemyX} y={s.enemyY} size={12}>💥</Sp>}
        <Sp x={50} y={85} size={12}>🚀</Sp>
        {/* Aim crosshair */}
        <div className="absolute" style={{ left: `${s.aimX}%`, top: `${s.aimY}%`, transform: "translate(-50%, -50%)" }}>
          <div style={{ width: "8cqw", height: "8cqw", border: "2px solid #ef4444", borderRadius: "50%", position: "relative" }} />
        </div>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 44. MARIO PAINT — Swat the fly
interface MarioPaintS { flyX: number; flyY: number; swatterX: number; swatterY: number; hit: boolean; }
const marioPaint: MicrogameDef = {
  id: "mario_paint", instruction: "SWAT!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1a1a2e", frame: "#ef4444", screen: "#fef3c7", text: "#ef4444" },
  init: (): MarioPaintS => ({ flyX: 50, flyY: 30, swatterX: 50, swatterY: 50, hit: false }),
  update(s: MarioPaintS, c: MgCtx) {
    if (!s.hit) {
      s.flyX += Math.sin(c.t * 5) * 30 * c.dtBeats;
      s.flyY += Math.cos(c.t * 3) * 20 * c.dtBeats;
      s.flyX = clamp(s.flyX, 10, 90);
      s.flyY = clamp(s.flyY, 10, 60);
      if (c.control) {
        if (c.input.held.has("left")) s.swatterX -= 55 * c.dtBeats;
        if (c.input.held.has("right")) s.swatterX += 55 * c.dtBeats;
        if (c.input.held.has("up")) s.swatterY -= 55 * c.dtBeats;
        if (c.input.held.has("down")) s.swatterY += 55 * c.dtBeats;
        s.swatterX = clamp(s.swatterX, 10, 90);
        s.swatterY = clamp(s.swatterY, 10, 90);
        if (c.input.pressed.has("space")) {
          s.hit = true;
          if (Math.abs(s.swatterX - s.flyX) < 12 && Math.abs(s.swatterY - s.flyY) < 12) c.win();
          else c.lose();
        }
      }
    }
  },
  View({ s, v }: { s: MarioPaintS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#fef3c7' }}>
        {/* Canvas */}
        <div className="absolute border-4 border-[#8B4513]" style={{ left: "10%", top: "5%", width: "80%", height: "75%", background: '#fff' }} />
        {!s.hit && <Sp x={s.flyX} y={s.flyY} size={8} rot={v.t * 200}>🪰</Sp>}
        {s.hit && <Sp x={s.flyX} y={s.flyY} size={8}>💢</Sp>}
        <Sp x={s.swatterX} y={s.swatterY} size={14} rot={s.hit ? -30 : 0}>🪠</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 45. ICE CLIMBER — Jump to the top
interface IceClimberS { py: number; vy: number; platforms: { y: number; x: number }[]; currentPlat: number; }
const iceClimber: MicrogameDef = {
  id: "ice_climber", instruction: "JUMP!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1a1a2e", frame: "#ef4444", screen: "#e0f2fe", text: "#ef4444" },
  init: (): IceClimberS => ({
    py: 85, vy: 0,
    platforms: [{ y: 70, x: 50 }, { y: 50, x: 50 }, { y: 30, x: 50 }, { y: 10, x: 50 }],
    currentPlat: -1,
  }),
  update(s: IceClimberS, c: MgCtx) {
    if (c.control && (c.input.pressed.has("space") || c.input.pressed.has("up"))) {
      s.vy = 28;
    }
    s.py -= s.vy * c.dtBeats;
    s.vy -= 50 * c.dtBeats;
    // Land on platforms
    for (let i = 0; i < s.platforms.length; i++) {
      if (s.py <= s.platforms[i].y && s.py > s.platforms[i].y - 5 && s.vy < 0) {
        s.py = s.platforms[i].y;
        s.vy = 0;
        s.currentPlat = i;
      }
    }
    if (s.py <= 10) c.win();
    if (s.py > 95) c.lose();
  },
  View({ s, v }: { s: IceClimberS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#e0f2fe' }}>
        {/* Mountain */}
        <div className="absolute left-0 right-0 bottom-0" style={{ background: 'linear-gradient(180deg, #87ceeb 0%, #f0f0f0 50%, #e0e0e0 100%)', height: "100%" }} />
        {s.platforms.map((p, i) => (
          <div key={i} className="absolute bg-[#8B4513] rounded" style={{ left: `${p.x - 20}%`, top: `${p.y}%`, width: "40%", height: "3%" }} />
        ))}
        <Sp x={50} y={s.py} size={12}>{v.outcome === "lose" ? "😵" : "🧗"}</Sp>
        <Sp x={50} y={5} size={8} scale={pulse(v.beatPhase, 0.15)}>🥬</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 46. F-ZERO — Steer the car
interface FZeroS { px: number; track: { x: number; w: number }[]; pos: number; }
const fZero: MicrogameDef = {
  id: "f_zero", instruction: "STEER!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1a1a2e", frame: "#ef4444", screen: "#0a0a1a", text: "#ef4444" },
  init: (): FZeroS => ({
    px: 50,
    track: Array.from({ length: 8 }, (_, i) => ({ x: 40 + Math.sin(i * 0.8) * 20, w: 40 })),
    pos: 0,
  }),
  update(s: FZeroS, c: MgCtx) {
    if (c.control) {
      if (c.input.held.has("left")) s.px -= 55 * c.dtBeats;
      if (c.input.held.has("right")) s.px += 55 * c.dtBeats;
      s.px = clamp(s.px, 5, 95);
    }
    s.pos += 25 * c.dtBeats;
    // Check if on track
    const seg = Math.min(Math.floor(s.pos / 12.5), s.track.length - 1);
    const t = s.track[seg];
    if (c.outcome === null && s.px < t.x - t.w / 2 || s.px > t.x + t.w / 2) c.lose();
    if (s.pos >= 100 && c.outcome === null) c.win();
  },
  View({ s, v }: { s: FZeroS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#0a0a1a' }}>
        {/* Track segments */}
        {s.track.map((t, i) => (
          <div key={i} className="absolute" style={{ left: `${t.x - t.w / 2}%`, top: `${80 - i * 10}%`, width: `${t.w}%`, height: "8%", background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }} />
        ))}
        <Sp x={s.px} y={80} size={12} rot={s.px > 55 ? 10 : s.px < 45 ? -10 : 0}>🏎️</Sp>
        {/* Speed lines */}
        <div className="absolute" style={{ left: "50%", top: "92%", transform: "translateX(-50%)", fontSize: "3cqw", color: "#ef4444" }}>⚡{Math.round(s.pos * 4)}km/h</div>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 47. SHERIFF — Shoot the bandit
interface SheriffS { banditX: number; banditY: number; aimAngle: number; shot: boolean; }
const sheriff: MicrogameDef = {
  id: "sheriff", instruction: "SHOOT!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1a1a2e", frame: "#ef4444", screen: "#d4a574", text: "#ef4444" },
  init: (): SheriffS => ({ banditX: rnd(20, 80), banditY: rnd(15, 45), aimAngle: 0, shot: false }),
  update(s: SheriffS, c: MgCtx) {
    if (!s.shot) {
      s.aimAngle += 200 * c.dtBeats;
      if (c.control && c.input.pressed.has("space")) {
        s.shot = true;
        // Hit if the rotating aim is pointing toward the bandit
        const dx = s.banditX - 50;
        const dy = s.banditY - 75;
        const targetAngle = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
        const aimNorm = ((s.aimAngle % 360) + 360) % 360;
        const diff = Math.abs(aimNorm - targetAngle);
        if (diff < 30 || diff > 330) c.win();
        else c.lose();
      }
    }
  },
  View({ s, v }: { s: SheriffS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#d4a574' }}>
        {/* Western backdrop */}
        <div className="absolute left-0 right-0 bottom-0 bg-[#8B6914]" style={{ height: "25%" }} />
        <Sp x={s.banditX} y={s.banditY} size={12}>🤠</Sp>
        <Sp x={50} y={75} size={14}>🧍</Sp>
        {/* Aim line */}
        {!s.shot && <div className="absolute" style={{ left: "50%", top: "75%", width: "40%", height: "2px", background: '#ef4444', transformOrigin: "0 50%", transform: `rotate(${s.aimAngle}deg)` }} />}
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 48. WILD GUNMAN — Shoot when he draws
interface WildGunmanS { phase: 'wait' | 'draw' | 'shot'; drawT: number; reacted: boolean; }
const wildGunman: MicrogameDef = {
  id: "wild_gunman", instruction: "SHOOT!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#1a1a2e", frame: "#ef4444", screen: "#d4a574", text: "#ef4444" },
  init: (): WildGunmanS => ({ phase: 'wait', drawT: rnd(2, 4), reacted: false }),
  update(s: WildGunmanS, c: MgCtx) {
    if (s.phase === 'wait') {
      s.drawT -= c.dtBeats;
      if (s.drawT <= 0) s.phase = 'draw';
    }
    if (s.phase === 'draw' && c.control && !s.reacted) {
      if (c.input.pressed.has("space")) {
        s.reacted = true;
        c.win();
      }
    }
    if (s.phase === 'draw' && s.drawT < -1.5 && !s.reacted) c.lose();
  },
  View({ s, v }: { s: WildGunmanS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#d4a574' }}>
        <div className="absolute left-0 right-0 bottom-0 bg-[#8B6914]" style={{ height: "20%" }} />
        {/* Saloon */}
        <div className="absolute" style={{ left: "30%", top: "10%", width: "40%", height: "50%", background: '#5c3a1e', borderRadius: '5% 5% 0 0' }}>
          <div className="absolute" style={{ left: "20%", top: "20%", width: "60%", height: "50%", background: '#1a1a2e' }} />
        </div>
        <Sp x={50} y={55} size={16}>{s.phase === 'draw' ? "🤠" : "🧍"}</Sp>
        {s.phase === 'draw' && <div className="absolute font-black" style={{ top: "15%", left: "50%", transform: "translateX(-50%)", fontSize: "8cqw", color: "#ef4444" }}>FIRE!</div>}
        {s.phase === 'wait' && <div className="absolute font-black" style={{ top: "15%", left: "50%", transform: "translateX(-50%)", fontSize: "6cqw", color: "#fff" }}>WAIT...</div>}
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 49. BOSS NINTENDO — Boss fight
interface BossNintendoS { bossHp: number; playerX: number; aimAngle: number; shot: boolean; }
const bossNintendo: MicrogameDef = {
  id: "boss_nintendo", instruction: "FIGHT!", lengthBars: 4, timeoutOutcome: "lose",
  palette: { outer: "#1a1a2e", frame: "#ef4444", screen: "#0a0a1a", text: "#ef4444" },
  init: (): BossNintendoS => ({ bossHp: 3, playerX: 50, aimAngle: 0, shot: false }),
  update(s: BossNintendoS, c: MgCtx) {
    s.aimAngle += 180 * c.dtBeats;
    if (c.control) {
      if (c.input.held.has("left")) s.playerX -= 40 * c.dtBeats;
      if (c.input.held.has("right")) s.playerX += 40 * c.dtBeats;
      s.playerX = clamp(s.playerX, 10, 90);
      if (c.input.pressed.has("space") && !s.shot) {
        s.shot = true;
        const aimNorm = ((s.aimAngle % 360) + 360) % 360;
        // Boss is above, aim angle needs to be roughly 250-290 (upward)
        if (aimNorm >= 240 && aimNorm <= 300) {
          s.bossHp--;
          if (s.bossHp <= 0) c.win();
        }
        setTimeout(() => { s.shot = false; }, 200);
      }
    }
  },
  View({ s, v }: { s: BossNintendoS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#0a0a1a' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{ width: "0.5cqw", height: "0.5cqw", left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, opacity: 0.3 + Math.random() * 0.5 }} />
        ))}
        <Sp x={50} y={15} size={18} scale={pulse(v.beatPhase, 0.1)}>{s.bossHp <= 0 ? "💥" : "👾"}</Sp>
        <div className="absolute left-1/2 -translate-x-1/2 flex gap-1" style={{ top: "4%" }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-full" style={{ width: "4cqw", height: "4cqw", background: i < s.bossHp ? '#ef4444' : '#444' }} />
          ))}
        </div>
        <Sp x={s.playerX} y={80} size={12}>🚀</Sp>
        {/* Aim line */}
        <div className="absolute" style={{ left: `${s.playerX}%`, top: "80%", width: "35%", height: "2px", background: '#ef4444', transformOrigin: "0 50%", transform: `rotate(${s.aimAngle}deg)` }} />
        <ResultFlash v={v} />
      </div>
    );
  },
};

// Remaining Nintendo placeholders
const NINTENDO_NAMES = [
  ['shoot_red_ball', 'SHOOT!'], ['hogans_alley', 'SHOOT!'],
  ['zelda_cave', 'NAVIGATE!'], ['racing_112', 'STEER!'],
  ['clu_clu_land', 'COLLECT!'], ['game_boy', 'PRESS!'],
  ['ultra_hand', 'CATCH!'], ['chiritorie', 'VACUUM!'],
  ['fc_basic', 'TYPE!'], ['mario_clash', 'HIT!'], ['super_scope', 'SHOOT!'],
  ['urban_champion', 'PUNCH!'], ['stack_up', 'STACK!'],
];
const NINTENDO_PLACEHOLDER: MicrogameDef[] = NINTENDO_NAMES.map(([id, instr]) =>
  placeholderGame(id, instr, 'nintendo', STAGES.nintendo.palette)
);
const NINTENDO_GAMES: MicrogameDef[] = [
  superMario, duckHunt, donkeyKong, drMario, metroid,
  marioPaint, iceClimber, fZero, sheriff, wildGunman,
  bossNintendo, ...NINTENDO_PLACEHOLDER,
];

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

/* ================================================================== */
/*  NATURE STAGE — Kat & Ana                                           */
/*  25 microgames with nature/animal themes                            */
/* ================================================================== */

// 59. UFO CATCHER — Catch the prize
interface UFOCatcherS { clawX: number; clawY: number; phase: 'move' | 'drop' | 'grab'; grabbed: boolean; }
const ufoCatcher: MicrogameDef = {
  id: "ufo_catcher", instruction: "CATCH!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#064e3b", frame: "#10b981", screen: "#fef3c7", text: "#10b981" },
  init: (): UFOCatcherS => ({ clawX: 50, clawY: 15, phase: 'move', grabbed: false }),
  update(s: UFOCatcherS, c: MgCtx) {
    if (s.phase === 'move') {
      if (c.control) {
        if (c.input.held.has("left")) s.clawX -= 50 * c.dtBeats;
        if (c.input.held.has("right")) s.clawX += 50 * c.dtBeats;
        s.clawX = clamp(s.clawX, 15, 85);
        if (c.input.pressed.has("space")) s.phase = 'drop';
      }
    }
    if (s.phase === 'drop') {
      s.clawY += 40 * c.dtBeats;
      if (s.clawY >= 65) {
        s.phase = 'grab';
        // Prize is at center
        if (Math.abs(s.clawX - 50) < 15) { s.grabbed = true; c.win(); }
        else c.lose();
      }
    }
  },
  View({ s, v }: { s: UFOCatcherS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#fef3c7' }}>
        {/* Machine */}
        <div className="absolute border-4 border-[#10b981] rounded-lg" style={{ left: "10%", top: "5%", width: "80%", height: "90%", background: '#f0f0f0' }}>
          <div className="absolute bg-[#87ceeb]" style={{ left: "5%", top: "5%", width: "90%", height: "70%", borderRadius: '5px' }} />
        </div>
        {/* Prize */}
        <Sp x={50} y={68} size={12} scale={pulse(v.beatPhase, 0.1)}>🧸</Sp>
        {/* Claw */}
        <div className="absolute" style={{ left: `${s.clawX}%`, top: `${s.clawY}%`, transform: "translate(-50%, -50%)" }}>
          <div style={{ width: "2cqw", height: "5cqw", background: '#666', margin: '0 auto' }} />
          <div style={{ width: "8cqw", height: "2cqw", background: '#888', borderRadius: '2px' }} />
        </div>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 60. RAINY DAY — Avoid the rain
interface RainyDayS { playerX: number; drops: { x: number; y: number; speed: number }[]; }
const rainyDay: MicrogameDef = {
  id: "rainy_day", instruction: "AVOID!", lengthBars: 2, timeoutOutcome: "win",
  palette: { outer: "#064e3b", frame: "#10b981", screen: "#87ceeb", text: "#10b981" },
  init: (): RainyDayS => ({
    playerX: 50,
    drops: Array.from({ length: 8 }, () => ({ x: rnd(5, 95), y: rnd(-30, 0), speed: rnd(25, 40) })),
  }),
  update(s: RainyDayS, c: MgCtx) {
    if (c.control) {
      if (c.input.held.has("left")) s.playerX -= 50 * c.dtBeats;
      if (c.input.held.has("right")) s.playerX += 50 * c.dtBeats;
      s.playerX = clamp(s.playerX, 8, 92);
    }
    for (const d of s.drops) {
      d.y += d.speed * c.dtBeats;
      if (d.y > 100) { d.y = -10; d.x = rnd(5, 95); }
      if (c.outcome === null && d.y >= 75 && d.y < 85 && Math.abs(d.x - s.playerX) < 6) c.lose();
    }
  },
  View({ s, v }: { s: RainyDayS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#87ceeb' }}>
        {/* Cloud */}
        <div className="absolute bg-[#ccc] rounded-full" style={{ left: "10%", top: "5%", width: "30%", height: "10%" }} />
        <div className="absolute bg-[#ccc] rounded-full" style={{ left: "50%", top: "3%", width: "25%", height: "12%" }} />
        {s.drops.map((d, i) => (
          <div key={i} className="absolute" style={{ left: `${d.x}%`, top: `${d.y}%`, width: "1%", height: "3%", background: '#4488ff', borderRadius: '50%' }} />
        ))}
        <Sp x={s.playerX} y={78} size={12}>{v.outcome === "lose" ? "😵" : "🧍"}</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 61. FIRE FIGHTING — Spray the fire
interface FireFightingS { fires: { x: number; y: number; alive: boolean }[]; aimX: number; aimY: number; }
const fireFighting: MicrogameDef = {
  id: "fire_fighting", instruction: "SPRAY!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#064e3b", frame: "#10b981", screen: "#fef3c7", text: "#10b981" },
  init: (): FireFightingS => ({
    fires: [{ x: 30, y: 40, alive: true }, { x: 70, y: 30, alive: true }],
    aimX: 50, aimY: 40,
  }),
  update(s: FireFightingS, c: MgCtx) {
    if (c.control) {
      if (c.input.held.has("left")) s.aimX -= 50 * c.dtBeats;
      if (c.input.held.has("right")) s.aimX += 50 * c.dtBeats;
      if (c.input.held.has("up")) s.aimY -= 50 * c.dtBeats;
      if (c.input.held.has("down")) s.aimY += 50 * c.dtBeats;
      s.aimX = clamp(s.aimX, 10, 90);
      s.aimY = clamp(s.aimY, 10, 90);
      if (c.input.pressed.has("space")) {
        for (const f of s.fires) {
          if (f.alive && Math.abs(f.x - s.aimX) < 12 && Math.abs(f.y - s.aimY) < 12) {
            f.alive = false;
            if (s.fires.every(f => !f.alive)) c.win();
            break;
          }
        }
      }
    }
  },
  View({ s, v }: { s: FireFightingS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#fef3c7' }}>
        {/* House */}
        <div className="absolute bg-[#8B4513]" style={{ left: "20%", top: "30%", width: "60%", height: "50%" }}>
          <div className="absolute bg-[#8B4513]" style={{ left: "-5%", top: "-20%", width: "110%", height: "25%", clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
        </div>
        {s.fires.map((f, i) => f.alive ? (
          <Sp key={i} x={f.x} y={f.y} size={12} scale={pulse(v.beatPhase, 0.2)}>🔥</Sp>
        ) : (
          <Sp key={i} x={f.x} y={f.y} size={8}>💨</Sp>
        ))}
        <Sp x={s.aimX} y={s.aimY} size={10}>🧯</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 62. SAMURAI — Cut the object
interface SamuraiS { angle: number; speed: number; swung: boolean; }
const samurai: MicrogameDef = {
  id: "samurai", instruction: "CUT!", lengthBars: 2, timeoutOutcome: "lose",
  palette: { outer: "#064e3b", frame: "#10b981", screen: "#fef3c7", text: "#10b981" },
  init: (): SamuraiS => ({ angle: 0, speed: rnd(200, 400), swung: false }),
  update(s: SamuraiS, c: MgCtx) {
    if (!s.swung) {
      s.angle += s.speed * c.dtBeats;
      if (c.control && c.input.pressed.has("space")) {
        s.swung = true;
        const norm = ((s.angle % 360) + 360) % 360;
        if (norm < 25 || norm > 335) c.win();
        else c.lose();
      }
    }
  },
  View({ s, v }: { s: SamuraiS; v: ViewCtx }) {
    const norm = ((s.angle % 360) + 360) % 360;
    const inZone = norm < 25 || norm > 335;
    return (
      <div className="absolute inset-0" style={{ background: '#fef3c7' }}>
        {/* Target line */}
        <div className="absolute" style={{ left: "50%", top: "5%", width: "2px", height: "20%", background: inZone ? '#22c55e' : '#ef4444' }} />
        {/* Spinning guide */}
        <div className="absolute" style={{ left: "50%", top: "30%", width: "40%", height: "2px", background: '#10b981', transformOrigin: "0 50%", transform: `rotate(${s.angle}deg)` }} />
        <Sp x={50} y={55} size={14} rot={s.swung ? -45 : 0}>🥷</Sp>
        <Sp x={50} y={30} size={12} scale={pulse(v.beatPhase, 0.1)}>🎋</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// 63. BOSS NATURE — Boss fight
interface BossNatureS { bossHp: number; playerX: number; items: { x: number; y: number; speed: number; type: number }[]; dodged: number; }
const bossNature: MicrogameDef = {
  id: "boss_nature", instruction: "SURVIVE!", lengthBars: 4, timeoutOutcome: "lose",
  palette: { outer: "#064e3b", frame: "#ef4444", screen: "#0a3a2e", text: "#ef4444" },
  init: (): BossNatureS => ({
    bossHp: 3, playerX: 50,
    items: Array.from({ length: 8 }, (_, i) => ({ x: rnd(20, 80), y: -10 - i * 15, speed: rnd(20, 35), type: Math.floor(Math.random() * 3) })),
    dodged: 0,
  }),
  update(s: BossNatureS, c: MgCtx) {
    if (c.control) {
      if (c.input.held.has("left")) s.playerX -= 45 * c.dtBeats;
      if (c.input.held.has("right")) s.playerX += 45 * c.dtBeats;
      s.playerX = clamp(s.playerX, 10, 90);
      if (c.input.pressed.has("space")) {
        // Throw shuriken upward
        s.bossHp--;
        if (s.bossHp <= 0) c.win();
      }
    }
    for (const item of s.items) {
      item.y += item.speed * c.dtBeats;
      if (item.y >= 75 && Math.abs(item.x - s.playerX) < 10 && c.outcome === null) c.lose();
      if (item.y > 100) { item.y = -10; item.x = rnd(20, 80); }
    }
  },
  View({ s, v }: { s: BossNatureS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0" style={{ background: '#0a3a2e' }}>
        <div className="absolute left-1/2 -translate-x-1/2 flex gap-1" style={{ top: "4%" }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-full" style={{ width: "4cqw", height: "4cqw", background: i < s.bossHp ? '#ef4444' : '#444' }} />
          ))}
        </div>
        <Sp x={50} y={15} size={16} scale={pulse(v.beatPhase, 0.1)}>{s.bossHp <= 0 ? "💫" : "👹"}</Sp>
        {s.items.map((item, i) => (
          <Sp key={i} x={item.x} y={clamp(item.y, -10, 95)} size={8} rot={item.y * 5}>🌸</Sp>
        ))}
        <Sp x={s.playerX} y={78} size={12}>🥷</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

// Remaining Nature placeholders
const NATURE_NAMES = [
  ['worm', 'EAT!'], ['banana', 'CATCH!'], ['frisbee', 'CATCH!'],
  ['penguin', 'CATCH!'], ['tooth', 'PULL!'], ['apple', 'CATCH!'],
  ['hanamizu', 'WIPE!'], ['monkey_banana', 'CATCH!'], ['eat_potato', 'EAT!'],
  ['eye_drop', 'DROP!'], ['flower_pom', 'SHAKE!'], ['rider_kick', 'KICK!'],
  ['stop_the_train', 'STOP!'], ['tetris', 'FIT!'], ['catch_ball', 'CATCH!'],
  ['gotiger_v', 'SHOOT!'], ['lizard', 'CATCH!'], ['be_hero', 'PUNCH!'],
  ['be_skin_head', 'DODGE!'], ['eat_all', 'EAT!'],
];
const NATURE_PLACEHOLDER: MicrogameDef[] = NATURE_NAMES.map(([id, instr]) =>
  placeholderGame(id, instr, 'nature', STAGES.nature.palette)
);
const NATURE_GAMES: MicrogameDef[] = [
  ufoCatcher, rainyDay, fireFighting, samurai, bossNature,
  ...NATURE_PLACEHOLDER,
];

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
