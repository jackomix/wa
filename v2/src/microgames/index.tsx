import React from "react";
import type { MicrogameDef, MgCtx, ViewCtx } from "../engine/types";

/* ================================================================== */
/*  Shared bits                                                        */
/* ================================================================== */
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** absolute-positioned emoji sprite, coords in % of the game screen */
const Sp: React.FC<{
  x: number;
  y: number;
  size?: number;
  flip?: boolean;
  rot?: number;
  scale?: number;
  children: React.ReactNode;
  z?: number;
}> = ({ x, y, size = 12, flip, rot = 0, scale = 1, children, z = 1 }) => (
  <div
    className="absolute select-none leading-none"
    style={{
      left: `${x}%`,
      top: `${y}%`,
      fontSize: `${size}cqw`,
      zIndex: z,
      transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${flip ? -scale : scale}, ${scale})`,
    }}
  >
    {children}
  </div>
);

const bob = (phase: number, amt = 3) => Math.sin(phase * Math.PI * 2) * amt;
const pulse = (phase: number, amt = 0.08) => 1 + Math.max(0, 1 - phase * 3) * amt;

const ResultFlash: React.FC<{ v: ViewCtx }> = ({ v }) =>
  v.outcome ? (
    <div
      className="absolute inset-0 z-30 flex items-start justify-center pointer-events-none"
      style={{ paddingTop: "6%" }}
    >
      <div
        className="font-black tracking-wider"
        style={{
          fontSize: "10cqw",
          color: v.outcome === "win" ? "#ffe93c" : "#ff5470",
          WebkitTextStroke: "0.6cqw #1a1030",
          transform: `scale(${pulse(v.beatPhase, 0.25)}) rotate(-4deg)`,
        }}
      >
        {v.outcome === "win" ? "NICE!" : "MISS..."}
      </div>
    </div>
  ) : null;

/* ================================================================== */
/*  1. JUMP! — hurdle the crate (2 bars)                               */
/* ================================================================== */
interface JumpS {
  hx: number;
  py: number;
  vy: number;
  passed: boolean;
}
const jump: MicrogameDef = {
  id: "jump",
  instruction: "JUMP!",
  lengthBars: 2,
  timeoutOutcome: "lose",
  palette: { outer: "#2b1d4f", frame: "#ffb703", screen: "#8ecae6", text: "#ffb703" },
  init: (): JumpS => ({ hx: 122, py: 0, vy: 0, passed: false }),
  update(s: JumpS, c: MgCtx) {
    s.hx -= 17.5 * c.dtBeats; // reaches the runner right around beat 4
    const grounded = s.py <= 0.01;
    if (c.control && grounded && (c.input.pressed.has("space") || c.input.pressed.has("up"))) {
      s.vy = 44;
    }
    if (!grounded || s.vy > 0) {
      s.py += s.vy * c.dtBeats;
      s.vy -= 76 * c.dtBeats;
      if (s.py <= 0) {
        s.py = 0;
        s.vy = 0;
      }
    }
    if (c.outcome === null) {
      if (Math.abs(s.hx - 26) < 4.5 && s.py < 8) c.lose();
      else if (s.hx < 14) c.win();
    }
  },
  View({ s, v }: { s: JumpS; v: ViewCtx }) {
    const run = Math.floor((v.t + 1) * 4) % 2 === 0;
    return (
      <div className="absolute inset-0">
        <Sp x={80} y={16} size={14}>☀️</Sp>
        <Sp x={30 - ((v.t + 1) * 4) % 40} y={22} size={10}>☁️</Sp>
        <div className="absolute left-0 right-0 bottom-0 bg-[#4c9a2a]" style={{ height: "18%" }} />
        <div className="absolute left-0 right-0 bg-[#2f6b1a]" style={{ bottom: "18%", height: "1.2%" }} />
        <Sp x={26} y={72 - s.py} size={13} flip>
          {v.outcome === "lose" ? "🤕" : s.py > 1 ? "🤸" : run ? "🏃" : "🏃‍♂️"}
        </Sp>
        <Sp x={s.hx} y={73} size={12}>📦</Sp>
        {v.outcome === "win" && <Sp x={26} y={50} size={9}>✨</Sp>}
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  2. CATCH! — move the basket under the apple (2 bars)               */
/* ================================================================== */
interface CatchS {
  bx: number;
  ax: number;
  ay: number;
  caught: boolean;
  splat: boolean;
}
const catchG: MicrogameDef = {
  id: "catch",
  instruction: "CATCH!",
  lengthBars: 2,
  timeoutOutcome: "lose",
  palette: { outer: "#5a189a", frame: "#80ffdb", screen: "#fff3b0", text: "#80ffdb" },
  init: (): CatchS => ({
    bx: 50,
    ax: Math.random() < 0.5 ? rnd(12, 32) : rnd(68, 88),
    ay: -12,
    caught: false,
    splat: false,
  }),
  update(s: CatchS, c: MgCtx) {
    if (c.control && !s.caught) {
      if (c.input.held.has("left")) s.bx -= 55 * c.dtBeats;
      if (c.input.held.has("right")) s.bx += 55 * c.dtBeats;
      s.bx = clamp(s.bx, 8, 92);
    }
    if (!s.caught && !s.splat) {
      s.ay += 16.5 * c.dtBeats; // touches down near beat 5
      if (s.ay >= 74 && Math.abs(s.ax - s.bx) < 10) {
        s.caught = true;
        c.win();
      } else if (s.ay >= 88) {
        s.splat = true;
        c.lose();
      }
    }
  },
  View({ s, v }: { s: CatchS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bottom-0 bg-[#e09f3e]" style={{ height: "12%" }} />
        <Sp x={s.ax} y={4} size={16}>🌳</Sp>
        {!s.caught && <Sp x={s.ax} y={clamp(s.ay, -12, 88)} size={9} rot={s.ay * 8}>{s.splat ? "💥" : "🍎"}</Sp>}
        <Sp x={s.bx} y={82 + bob(v.beatPhase, 0.7)} size={13}>🧺</Sp>
        {s.caught && <Sp x={s.bx} y={76} size={7}>🍎</Sp>}
        <Sp x={s.bx} y={93} size={8}>{v.outcome === "lose" ? "😫" : s.caught ? "😋" : "😮"}</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  3. DODGE! — sidestep the falling rocks (2 bars, survive = win)     */
/* ================================================================== */
interface DodgeS {
  lane: number;
  rocks: { lane: number; landT: number }[];
}
const LANE_X = [22, 50, 78];
const dodge: MicrogameDef = {
  id: "dodge",
  instruction: "DODGE!",
  lengthBars: 2,
  timeoutOutcome: "win",
  palette: { outer: "#1b3a2f", frame: "#ff6b35", screen: "#3d405b", text: "#ff6b35" },
  init: (): DodgeS => {
    const l1 = 1; // first rock always targets the starting lane — you must move
    const l2 = Math.floor(Math.random() * 3);
    return {
      lane: 1,
      rocks: [
        { lane: l1, landT: 3.4 },
        { lane: l2, landT: 5.4 },
      ],
    };
  },
  update(s: DodgeS, c: MgCtx) {
    if (c.control) {
      if (c.input.pressed.has("left")) s.lane = clamp(s.lane - 1, 0, 2);
      if (c.input.pressed.has("right")) s.lane = clamp(s.lane + 1, 0, 2);
    }
    if (c.outcome === null) {
      for (const r of s.rocks) {
        if (c.t >= r.landT && c.t < r.landT + 0.25 && r.lane === s.lane) c.lose();
      }
    }
  },
  View({ s, v }: { s: DodgeS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bottom-0 bg-[#6d597a]" style={{ height: "16%" }} />
        {s.rocks.map((r, i) => {
          const fall = clamp((v.t - (r.landT - 1.6)) / 1.6, 0, 1);
          const gone = v.t > r.landT + 0.6;
          return (
            <React.Fragment key={i}>
              {v.t > r.landT - 1.9 && !gone && (
                <div
                  className="absolute rounded-full bg-black/40"
                  style={{
                    left: `${LANE_X[r.lane] - 6}%`,
                    top: "80%",
                    width: "12%",
                    height: "3.5%",
                    transform: `scale(${0.4 + fall * 0.8})`,
                  }}
                />
              )}
              {fall > 0 && !gone && (
                <Sp x={LANE_X[r.lane]} y={-10 + fall * 88} size={12} rot={fall * 180}>
                  {fall >= 1 ? "💥" : "🪨"}
                </Sp>
              )}
            </React.Fragment>
          );
        })}
        <Sp x={LANE_X[s.lane]} y={74 + bob(v.beatPhase, 0.8)} size={12}>
          {v.outcome === "lose" ? "😵" : v.outcome === "win" ? "😎" : "🐹"}
        </Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  4. PRESS! — hit the matching arrow key (2 bars)                    */
/* ================================================================== */
const ARROWS = [
  { k: "left", g: "⬅️", rot: 0 },
  { k: "right", g: "➡️", rot: 0 },
  { k: "up", g: "⬆️", rot: 0 },
  { k: "down", g: "⬇️", rot: 0 },
] as const;
interface PressS {
  idx: number;
  hit: boolean;
}
const press: MicrogameDef = {
  id: "press",
  instruction: "PRESS!",
  lengthBars: 2,
  timeoutOutcome: "lose",
  palette: { outer: "#03045e", frame: "#f72585", screen: "#caf0f8", text: "#f72585" },
  init: (): PressS => ({ idx: Math.floor(Math.random() * 4), hit: false }),
  update(s: PressS, c: MgCtx) {
    if (!c.control || c.outcome !== null || c.t < 0) return;
    const want = ARROWS[s.idx].k;
    for (const k of ["left", "right", "up", "down"] as const) {
      if (c.input.pressed.has(k)) {
        if (k === want) {
          s.hit = true;
          c.win();
        } else c.lose();
      }
    }
  },
  View({ s, v }: { s: PressS; v: ViewCtx }) {
    const revealed = v.t >= 0;
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="rounded-3xl border-8 border-[#03045e] bg-white flex items-center justify-center"
          style={{
            width: "44%",
            height: "58%",
            transform: `scale(${pulse(v.beatPhase, 0.1)}) rotate(${bob(v.beatPhase, 2)}deg)`,
            boxShadow: "0 2cqw 0 rgba(0,0,0,0.25)",
          }}
        >
          <span style={{ fontSize: "24cqw" }} className="select-none">
            {revealed ? ARROWS[s.idx].g : "❓"}
          </span>
        </div>
        {s.hit && <Sp x={50} y={20} size={10}>🎉</Sp>}
        {v.outcome === "lose" && <Sp x={50} y={20} size={10}>💢</Sp>}
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  5. SHOOT! — fire when the UFO crosses the crosshair (2 bars)       */
/* ================================================================== */
interface ShootS {
  ufoX: number;
  dead: boolean;
  shots: { x: number; age: number }[];
  flash: number;
}
const shoot: MicrogameDef = {
  id: "shoot",
  instruction: "SHOOT!",
  lengthBars: 2,
  timeoutOutcome: "lose",
  palette: { outer: "#10002b", frame: "#9ef01a", screen: "#240046", text: "#9ef01a" },
  init: (): ShootS => ({ ufoX: 50, dead: false, shots: [], flash: 0 }),
  update(s: ShootS, c: MgCtx) {
    if (!s.dead) s.ufoX = 50 + 38 * Math.sin((c.t + 1) * 1.55 + 1.2);
    s.flash = Math.max(0, s.flash - c.dtBeats * 4);
    s.shots.forEach((sh) => (sh.age += c.dtBeats));
    s.shots = s.shots.filter((sh) => sh.age < 0.8);
    if (c.control && !s.dead && c.input.pressed.has("space")) {
      s.shots.push({ x: 50, age: 0 });
      s.flash = 1;
      if (Math.abs(s.ufoX - 50) <= 9) {
        s.dead = true;
        c.win();
      }
    }
  },
  View({ s, v }: { s: ShootS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0">
        <Sp x={15} y={15} size={4}>⭐</Sp>
        <Sp x={85} y={25} size={3}>⭐</Sp>
        <Sp x={70} y={10} size={3}>✨</Sp>
        <Sp x={30} y={30} size={3}>✨</Sp>
        {!s.dead ? (
          <Sp x={s.ufoX} y={26 + bob(v.beatPhase, 2)} size={13}>🛸</Sp>
        ) : (
          <Sp x={s.ufoX} y={26} size={15}>💥</Sp>
        )}
        {/* crosshair column */}
        <div
          className="absolute bg-[#9ef01a]/30"
          style={{ left: "49.4%", top: 0, width: "1.2%", height: "100%" }}
        />
        <Sp x={50} y={26} size={16} z={2}>
          <span style={{ opacity: 0.85 }}>🎯</span>
        </Sp>
        {s.shots.map((sh, i) => (
          <Sp key={i} x={50} y={78 - sh.age * 70} size={5}>🔺</Sp>
        ))}
        <Sp x={50} y={88} size={11} scale={s.flash > 0 ? 1.15 : 1}>🔫</Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  6. CHARGE! — mash SPACE to fuel the rocket (4 bars)               */
/*     Winning early lets the scheduler exit at bar 2 or 3.            */
/* ================================================================== */
interface ChargeS {
  charge: number;
  launched: boolean;
  ry: number;
  mash: number;
}
const charge: MicrogameDef = {
  id: "charge",
  instruction: "MASH!",
  lengthBars: 4,
  timeoutOutcome: "lose",
  palette: { outer: "#370617", frame: "#ffd60a", screen: "#001d3d", text: "#ffd60a" },
  init: (): ChargeS => ({ charge: 0, launched: false, ry: 70, mash: 0 }),
  update(s: ChargeS, c: MgCtx) {
    s.mash = Math.max(0, s.mash - c.dtBeats * 6);
    if (c.control && !s.launched) {
      if (c.input.pressed.has("space")) {
        s.charge = clamp(s.charge + 8.5, 0, 100);
        s.mash = 1;
      }
      s.charge = clamp(s.charge - 3.2 * c.dtBeats, 0, 100);
      if (s.charge >= 100) {
        s.launched = true;
        c.win();
      }
    }
    if (s.launched) s.ry -= 55 * c.dtBeats;
  },
  View({ s, v }: { s: ChargeS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0">
        <Sp x={82} y={14} size={10}>🌕</Sp>
        <Sp x={20} y={22} size={3}>⭐</Sp>
        <Sp x={64} y={8} size={3}>✨</Sp>
        <div className="absolute left-0 right-0 bottom-0 bg-[#7f5539]" style={{ height: "14%" }} />
        <Sp x={62} y={s.ry} size={15} scale={1 + s.mash * 0.08}>🚀</Sp>
        {s.launched && <Sp x={62} y={s.ry + 12} size={9}>🔥</Sp>}
        <Sp x={20} y={80 + bob(v.beatPhase, 0.8)} size={11}>
          {s.mash > 0.4 ? "🙌" : "🧑‍🚀"}
        </Sp>
        {/* fuel gauge */}
        <div
          className="absolute rounded-full border-4 border-white/80 bg-black/50 overflow-hidden"
          style={{ left: "10%", top: "12%", width: "36%", height: "8%" }}
        >
          <div
            className="h-full"
            style={{
              width: `${s.charge}%`,
              background: s.charge > 75 ? "#ffd60a" : "#ff6d00",
              transition: "width 60ms linear",
            }}
          />
        </div>
        <div
          className="absolute font-black text-white/90"
          style={{ left: "10%", top: "21%", fontSize: "4cqw" }}
        >
          FUEL {Math.floor(s.charge)}%
        </div>
        <ResultFlash v={v} />
      </div>
    );
  },
};

/* ================================================================== */
/*  7. SURVIVE! — dodge the meteor shower (4 bars)                     */
/*     Losing early lets the scheduler exit at bar 2 or 3.             */
/* ================================================================== */
interface SurvS {
  px: number;
  meteors: { x: number; landT: number }[];
  hit: boolean;
}
const survive: MicrogameDef = {
  id: "survive",
  instruction: "SURVIVE!",
  lengthBars: 4,
  timeoutOutcome: "win",
  palette: { outer: "#231942", frame: "#ff4d6d", screen: "#14213d", text: "#ff4d6d" },
  init: (): SurvS => {
    const meteors: { x: number; landT: number }[] = [];
    for (let t = 1.2; t < 13.8; t += rnd(0.85, 1.35)) {
      meteors.push({ x: rnd(10, 90), landT: t });
    }
    return { px: 50, meteors, hit: false };
  },
  update(s: SurvS, c: MgCtx) {
    if (c.control && !s.hit) {
      if (c.input.held.has("left")) s.px -= 48 * c.dtBeats;
      if (c.input.held.has("right")) s.px += 48 * c.dtBeats;
      s.px = clamp(s.px, 6, 94);
    }
    if (c.outcome === null && !s.hit) {
      for (const m of s.meteors) {
        if (c.t >= m.landT - 0.12 && c.t <= m.landT + 0.15 && Math.abs(m.x - s.px) < 7.5) {
          s.hit = true;
          c.lose();
        }
      }
    }
  },
  View({ s, v }: { s: SurvS; v: ViewCtx }) {
    return (
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 bottom-0 bg-[#5e503f]" style={{ height: "15%" }} />
        <Sp x={12} y={12} size={3}>⭐</Sp>
        <Sp x={88} y={18} size={3}>✨</Sp>
        {s.meteors.map((m, i) => {
          const fall = (v.t - (m.landT - 1.4)) / 1.4;
          if (fall < -0.35 || v.t > m.landT + 0.5) return null;
          return (
            <React.Fragment key={i}>
              {fall > -0.35 && v.t <= m.landT + 0.3 && (
                <div
                  className="absolute rounded-full bg-red-500/40"
                  style={{
                    left: `${m.x - 5}%`,
                    top: "82%",
                    width: "10%",
                    height: "3%",
                    transform: `scale(${clamp(0.3 + (fall + 0.35) * 1.0, 0, 1.2)})`,
                  }}
                />
              )}
              {fall > 0 && (
                <Sp x={m.x} y={-8 + clamp(fall, 0, 1) * 92} size={9} rot={200}>
                  {fall >= 1 ? "💥" : "☄️"}
                </Sp>
              )}
            </React.Fragment>
          );
        })}
        <Sp x={s.px} y={76 + bob(v.beatPhase, 0.8)} size={11}>
          {v.outcome === "lose" ? "😵" : v.outcome === "win" ? "🥳" : "🐧"}
        </Sp>
        <ResultFlash v={v} />
      </div>
    );
  },
};

export const MICROGAMES: MicrogameDef[] = [jump, catchG, dodge, press, shoot, charge, survive];
