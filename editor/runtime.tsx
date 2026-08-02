import React, { useMemo } from "react";
import { AUDIO } from "../engine/audio";
import type { MgCtx, MicrogameDef, ViewCtx } from "../engine/types";
import type {
  Action,
  ActorDef,
  ActorInstance,
  Appearance,
  Condition,
  MicrogameData,
} from "./schema";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const uid = (p = "rt") => `${p}_${Math.random().toString(36).slice(2, 7)}`;

/* ================================================================== */
/*  Runtime state                                                      */
/* ================================================================== */
interface RtActor {
  instId: string;
  def: ActorDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
  rot: number;
  visible: boolean;
  grounded: boolean;
  groundedPrev: boolean;
  alive: boolean;
  emoji: string | null;
  vars: Record<string, number>;
}

interface RtState {
  actors: RtActor[];
  sceneVars: Record<string, number>;
  mem: Record<string, any>;
  fx: { shake: number; flash: string | null; flashT: number };
  grabId: string | null;
  started: boolean;
  counter: number;
}

/* ================================================================== */
/*  Expression resolver                                                 */
/*  values may be numbers or tokens: {scene:NAME} {self:NAME} {rnd:a,b} */
/* ================================================================== */
function resolve(raw: any, self: RtActor | null, s: RtState, t: number): number {
  if (typeof raw === "number") return raw;
  const str = String(raw ?? "0").trim();
  if (/^-?\d+(\.\d+)?$/.test(str)) return parseFloat(str);
  if (str.startsWith("{") && str.endsWith("}")) {
    const inner = str.slice(1, -1);
    const idx = inner.indexOf(":");
    const scope = idx >= 0 ? inner.slice(0, idx) : "scene";
    const name = idx >= 0 ? inner.slice(idx + 1) : inner;
    if (scope === "scene") {
      if (name === "t") return t;
      return s.sceneVars[name] ?? 0;
    }
    if (scope === "rnd") {
      const [a, b] = name.split(",").map((n) => parseFloat(n) || 0);
      return a + Math.random() * (b - a);
    }
    if (scope === "self" && self) {
      switch (name) {
        case "x": return self.x;
        case "y": return self.y;
        case "vx": return self.vx;
        case "vy": return self.vy;
        case "scale": return self.scale;
        case "rot": return self.rot;
        case "w": return self.def.width;
        case "h": return self.def.height;
        case "grounded": return self.grounded ? 1 : 0;
        default: return self.vars[name] ?? 0;
      }
    }
    return 0;
  }
  const f = parseFloat(str);
  return isNaN(f) ? 0 : f;
}
const rv = resolve;

/* ================================================================== */
/*  Collision helpers                                                  */
/* ================================================================== */
function overlap(a: RtActor, b: RtActor): boolean {
  return (
    Math.abs(a.x - b.x) * 2 < a.def.width + b.def.width &&
    Math.abs(a.y - b.y) * 2 < a.def.height + b.def.height
  );
}

/** push `a` out of solid `b` along the least-penetration axis */
function resolveSolid(a: RtActor, b: RtActor, beh: ActorDef["behavior"]) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const ox = (a.def.width + b.def.width) / 2 - Math.abs(dx);
  const oy = (a.def.height + b.def.height) / 2 - Math.abs(dy);
  if (ox <= 0 || oy <= 0) return;
  if (ox < oy) {
    a.x += dx >= 0 ? ox : -ox;
    a.vx = beh.type === "physics" ? -a.vx * beh.bounce : 0;
  } else if (dy >= 0) {
    a.y += oy; // a below b → push down
    if (a.vy < 0) a.vy = beh.type === "physics" ? -a.vy * beh.bounce : 0;
  } else {
    a.y -= oy; // a above b → land on top
    if (a.vy > 0) a.vy = beh.type === "physics" ? -a.vy * beh.bounce : 0;
    a.grounded = true;
  }
}

/* ================================================================== */
/*  Behavior integration                                               */
/* ================================================================== */
function integrate(a: RtActor, ctx: MgCtx, s: RtState, solids: RtActor[], floorY: number) {
  const beh = a.def.behavior;
  const dt = ctx.dtBeats;
  const hw = a.def.width / 2;
  const hh = a.def.height / 2;
  const held = ctx.input.held;
  const pressed = ctx.input.pressed;
  const ctrl = ctx.control;

  a.grounded = false;

  if (beh.type === "platformer") {
    a.vy += beh.gravity * dt;
    if (ctrl) {
      if (held.has("left")) a.vx = -beh.speed;
      else if (held.has("right")) a.vx = beh.speed;
      else a.vx *= 1 - clamp(beh.friction * dt, 0, 1);
      if ((pressed.has("space") || pressed.has("up")) && a.groundedPrev) a.vy = -beh.jump;
    }
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.x = clamp(a.x, hw, 100 - hw);
    if (floorY < 100 && a.y + hh >= floorY) {
      a.y = floorY - hh;
      if (a.vy > 0) a.vy = 0;
      a.grounded = true;
    }
    for (const sol of solids) if (sol !== a) resolveSolid(a, sol, beh);
  } else if (beh.type === "8direction") {
    if (ctrl) {
      let mx = 0, my = 0;
      if (held.has("left")) mx -= 1;
      if (held.has("right")) mx += 1;
      if (held.has("up")) my -= 1;
      if (held.has("down")) my += 1;
      if (mx || my) {
        const len = Math.hypot(mx, my);
        a.vx = (mx / len) * beh.speed;
        a.vy = (my / len) * beh.speed;
      } else {
        const f = 1 - clamp(beh.friction * dt, 0, 1);
        a.vx *= f;
        a.vy *= f;
        if (Math.abs(a.vx) < 0.4) a.vx = 0;
        if (Math.abs(a.vy) < 0.4) a.vy = 0;
      }
    }
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.x = clamp(a.x, hw, 100 - hw);
    a.y = clamp(a.y, hh, 100 - hh);
  } else if (beh.type === "physics") {
    a.vy += beh.gravity * dt;
    const f = 1 - clamp(beh.friction * dt, 0, 1);
    a.vx *= f;
    if (a.x - hw < 0) { a.x = hw; a.vx = -a.vx * beh.bounce; }
    if (a.x + hw > 100) { a.x = 100 - hw; a.vx = -a.vx * beh.bounce; }
    if (a.y - hh < 0) { a.y = hh; a.vy = -a.vy * beh.bounce; }
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    if (floorY < 100 && a.y + hh >= floorY) {
      a.y = floorY - hh;
      a.vy = -a.vy * beh.bounce;
      a.grounded = true;
    }
    for (const sol of solids) if (sol !== a) resolveSolid(a, sol, beh);
  } else if (beh.type === "dragdrop") {
    const p = ctx.input.pointer;
    if (p.pressed && !s.grabId) {
      const d = Math.hypot(p.x - a.x, p.y - a.y);
      if (d < Math.max(a.def.width, a.def.height) * 0.8) s.grabId = a.instId;
    }
    if (s.grabId === a.instId && p.down) {
      a.x = a.x + (p.x - a.x) * 0.6;
      a.y = a.y + (p.y - a.y) * 0.6;
      a.x = clamp(a.x, hw, 100 - hw);
      a.y = clamp(a.y, hh, 100 - hh);
      a.vx = 0;
      a.vy = 0;
    }
    if (!p.down && s.grabId === a.instId) s.grabId = null;
  }

  a.groundedPrev = a.grounded;
}

/* ================================================================== */
/*  Condition evaluation                                               */
/* ================================================================== */
interface EvalCtx {
  s: RtState;
  ctx: MgCtx;
  data: MicrogameData;
  self: RtActor | null;
  evid: string;
}

function others(self: RtActor | null, s: RtState, defId: string): RtActor[] {
  return s.actors.filter(
    (o) => o.alive && o !== self && (defId === "any" || o.def.id === defId),
  );
}

function hitPointer(a: RtActor, ctx: MgCtx): boolean {
  const p = ctx.input.pointer;
  return Math.abs(p.x - a.x) * 2 < a.def.width && Math.abs(p.y - a.y) * 2 < a.def.height;
}

const cmpNum = (a: number, op: string, b: number) => {
  switch (op) {
    case "=": return a === b;
    case "!=": return a !== b;
    case ">": return a > b;
    case "<": return a < b;
    case ">=": return a >= b;
    case "<=": return a <= b;
    default: return false;
  }
};

/** scene-level conditions evaluated once per event per frame */
function evalGlobal(conds: Condition[], ec: EvalCtx): boolean {
  const { s, ctx, self } = ec;
  for (const c of conds) {
    const p = c.params;
    switch (c.kind) {
      case "always": break;
      case "atStart": {
        // fires exactly once, on the first frame the player gains control
        if (!ctx.control) return false;
        const k = `start:${ec.evid}`;
        if (s.mem[k]) return false;
        s.mem[k] = 1;
        break;
      }
      case "keyDown":
        if (!ctx.input.held.has(p.key)) return false;
        break;
      case "keyPressed":
        if (!ctx.input.pressed.has(p.key)) return false;
        break;
      case "keyReleased": {
        const k = `rel:${ec.evid}:${p.key}`;
        const now = ctx.input.held.has(p.key);
        const was = !!s.mem[k];
        s.mem[k] = now;
        if (!(was && !now)) return false;
        break;
      }
      case "pointerDown":
        if (!ctx.input.pointer.down) return false;
        break;
      case "pointerPressed":
        if (!ctx.input.pointer.pressed) return false;
        break;
      case "varCmp":
        if (p.scope === "scene")
          if (!cmpNum(s.sceneVars[p.name] ?? 0, p.op, rv(p.value, self, s, ctx.t))) return false;
        break;
      case "everyBeats": {
        const slot = Math.floor(ctx.t / p.beats);
        const k = `ev:${ec.evid}`;
        if (ctx.t < 0 || slot <= (s.mem[k] ?? -1)) return false;
        s.mem[k] = slot;
        break;
      }
      case "timeGt":
        if (!(ctx.t > rv(p.value, self, s, ctx.t))) return false;
        break;
      default: break; // instance conditions handled below
    }
  }
  return true;
}

/** per-instance conditions evaluated for each "self" */
function evalInstance(conds: Condition[], ec: EvalCtx): boolean {
  const { s, ctx, self } = ec;
  if (!self) return false;
  for (const c of conds) {
    const p = c.params;
    switch (c.kind) {
      case "clicked":
        if (!(ctx.input.pointer.pressed && hitPointer(self, ctx))) return false;
        break;
      case "collide":
        if (!others(self, s, p.other).some((o) => overlap(self, o))) return false;
        break;
      case "onCollideStart": {
        const now = others(self, s, p.other).some((o) => overlap(self, o));
        const k = `ocs:${ec.evid}:${self.instId}`;
        const was = !!s.mem[k];
        s.mem[k] = now;
        if (!(now && !was)) return false;
        break;
      }
      case "inArea": {
        const inX = self.x >= p.x && self.x <= p.x + p.w;
        const inY = self.y >= p.y && self.y <= p.y + p.h;
        if (!(inX && inY)) return false;
        break;
      }
      case "outOfBounds":
        if (!(self.x < 0 || self.x > 100 || self.y < 0 || self.y > 100)) return false;
        break;
      case "isGrounded":
        if (!self.grounded) return false;
        break;
      case "varCmp":
        if (p.scope === "self") {
          // built-ins (x, y, vx, vy, scale, grounded, ...) are readable too
          const lv = resolve(`{self:${p.name}}`, self, s, ctx.t);
          if (!cmpNum(lv, p.op, rv(p.value, self, s, ctx.t))) return false;
        }
        break;
      default: break;
    }
  }
  return true;
}

/* ================================================================== */
/*  Action application                                                 */
/* ================================================================== */
function playSfx(name: string) {
  switch (name) {
    case "coin": AUDIO.coin(); break;
    case "jump": AUDIO.press(); break;
    case "pop": AUDIO.press(); break;
    case "hit": AUDIO.boom(); break;
    case "boom": AUDIO.boom(); break;
    case "shoot": AUDIO.press(); break;
    case "win": AUDIO.winJingle(); break;
    case "lose": AUDIO.loseJingle(); break;
    default: AUDIO.press();
  }
}

function applyAction(act: Action, ec: EvalCtx) {
  const { s, ctx, self } = ec;
  const p = act.params;
  const t = ctx.t;

  const targets: RtActor[] = act.targetDef
    ? s.actors.filter((a) => a.alive && a.def.id === act.targetDef)
    : self
      ? [self]
      : [];

  const per = (a: RtActor) => {
    switch (act.kind) {
      case "setVel": a.vx = rv(p.vx, a, s, t); a.vy = rv(p.vy, a, s, t); break;
      case "addVel": a.vx += rv(p.vx, a, s, t); a.vy += rv(p.vy, a, s, t); break;
      case "setPos": a.x = rv(p.x, a, s, t); a.y = rv(p.y, a, s, t); break;
      case "moveBy": a.x += rv(p.x, a, s, t); a.y += rv(p.y, a, s, t); break;
      case "stop": a.vx = 0; a.vy = 0; break;
      case "setVar": {
        const v = rv(p.value, a, s, t);
        if (p.scope === "scene") s.sceneVars[p.name] = p.op === "add" ? (s.sceneVars[p.name] ?? 0) + v : v;
        else a.vars[p.name] = p.op === "add" ? (a.vars[p.name] ?? 0) + v : v;
        break;
      }
      case "destroy": a.alive = false; break;
      case "setEmoji": if (a.def.appearance.kind === "emoji") a.emoji = p.emoji; break;
      case "hide": a.visible = false; break;
      case "show": a.visible = true; break;
      case "setScale": a.scale = rv(p.value, a, s, t); break;
      case "rotate": a.rot += rv(p.value, a, s, t); break;
      default: break;
    }
  };

  switch (act.kind) {
    case "win": ctx.win(); break;
    case "lose": ctx.lose(); break;
    case "spawn": {
      const def = ec.data.actors.find((d) => d.id === p.def);
      if (def) {
        const inst: ActorInstance = {
          id: uid("inst"), defId: def.id,
          x: rv(p.x, self, s, t), y: rv(p.y, self, s, t),
          scale: 1, rot: 0, visible: true, vars: {},
        };
        s.actors.push(instToActor(inst, def));
      }
      break;
    }
    case "playSfx": playSfx(p.sfx); break;
    case "shake": s.fx.shake = Math.max(s.fx.shake, rv(p.value, self, s, t)); break;
    default: targets.forEach(per);
  }
}

/* ================================================================== */
/*  Init / step                                                        */
/* ================================================================== */
function instToActor(inst: ActorInstance, def: ActorDef): RtActor {
  return {
    instId: inst.id, def, x: inst.x, y: inst.y, vx: 0, vy: 0,
    scale: inst.scale, rot: inst.rot, visible: inst.visible,
    grounded: false, groundedPrev: false, alive: true, emoji: null,
    vars: { ...def.vars, ...inst.vars },
  };
}

function initState(data: MicrogameData): RtState {
  const s: RtState = {
    actors: [], sceneVars: {}, mem: {},
    fx: { shake: 0, flash: null, flashT: 0 },
    grabId: null, started: false, counter: 0,
  };
  for (const inst of data.scene.instances) {
    const def = data.actors.find((d) => d.id === inst.defId);
    if (def) s.actors.push(instToActor(inst, def));
  }
  return s;
}

function step(s: RtState, data: MicrogameData, ctx: MgCtx) {
  if (ctx.control && !s.started) s.started = true;

  const solids = s.actors.filter((a) => a.alive && a.def.solid);
  const floorY = data.scene.floorY;

  for (const a of s.actors) if (a.alive) integrate(a, ctx, s, solids, floorY);

  for (const ev of data.events) {
    if (!ev.enabled) continue;
    const ec: EvalCtx = { s, ctx, data, self: null, evid: ev.id };
    if (!evalGlobal(ev.conditions, ec)) continue;

    if (ev.forActor) {
      for (const a of [...s.actors]) {
        if (!a.alive || a.def.id !== ev.forActor) continue;
        ec.self = a;
        if (!evalInstance(ev.conditions, ec)) continue;
        for (const act of ev.actions) applyAction(act, ec);
      }
    } else {
      ec.self = null;
      for (const act of ev.actions) applyAction(act, ec);
    }
  }

  s.actors = s.actors.filter((a) => a.alive);
  s.fx.shake = Math.max(0, s.fx.shake - ctx.dtBeats * 6);
}

/* ================================================================== */
/*  Rendering                                                          */
/* ================================================================== */
function PixelSprite({ app }: { app: Extract<Appearance, { kind: "pixel" }> }) {
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < app.grid; r++) {
    for (let c = 0; c < app.grid; c++) {
      const idx = app.pixels[r]?.[c];
      if (idx == null || idx < 0) continue;
      cells.push(
        <rect key={`${r}-${c}`} x={c} y={r} width={1.02} height={1.02} fill={app.palette[idx]} />,
      );
    }
  }
  return (
    <svg viewBox={`0 0 ${app.grid} ${app.grid}`} width="100%" height="100%" preserveAspectRatio="none" style={{ overflow: "visible" }}>
      {cells}
    </svg>
  );
}

function starField(seedStr: string): { x: number; y: number; s: number }[] {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rnd = () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: 14 }, () => ({ x: rnd() * 100, y: rnd() * 100, s: 0.6 + rnd() * 1.2 }));
}

function DataView({ s, v, data }: { s: RtState; v: ViewCtx; data: MicrogameData }) {
  const sc = data.scene;
  const bg = sc.gradient ? `linear-gradient(to bottom, ${sc.bgColor}, ${sc.bg2Color})` : sc.bgColor;
  const stars = useMemo(
    () => (sc.pattern === "stars" ? starField(data.id) : []),
    [sc.pattern, data.id],
  );

  let patternCSS = "";
  if (sc.pattern === "grid")
    patternCSS =
      "linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px)";
  else if (sc.pattern === "dots")
    patternCSS = "radial-gradient(rgba(255,255,255,.16) 1px,transparent 1.5px)";

  const shakeX = s.fx.shake ? (Math.random() - 0.5) * s.fx.shake * 3 : 0;
  const shakeY = s.fx.shake ? (Math.random() - 0.5) * s.fx.shake * 3 : 0;

  const sorted = [...s.actors]
    .filter((a) => a.alive && a.visible)
    .sort((a, b) => a.def.z - b.def.z);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: "#000" }}>
      <div className="absolute inset-0" style={{ background: bg }}>
        {patternCSS && (
          <div className="absolute inset-0" style={{ background: patternCSS, backgroundSize: "7cqw 7cqw" }} />
        )}
        {stars.map((st, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{
            left: `${st.x}%`, top: `${st.y}%`, width: `${st.s}cqw`, height: `${st.s}cqw`, opacity: 0.7,
          }} />
        ))}
      </div>

      <div className="absolute inset-0" style={{ transform: `translate(${shakeX}%, ${shakeY}%)` }}>
        {sc.floorY < 100 && (
          <div className="absolute left-0 right-0 bottom-0" style={{ height: `${100 - sc.floorY}%`, background: sc.groundColor }} />
        )}
        {sorted.map((a) => (
          <div key={a.instId} className="absolute flex items-center justify-center" style={{
            left: `${a.x}%`, top: `${a.y}%`, width: `${a.def.width}%`, height: `${a.def.height}%`,
            transform: `translate(-50%, -50%) rotate(${a.rot}deg) scale(${a.scale})`, zIndex: a.def.z,
          }}>
            {a.def.appearance.kind === "emoji" ? (
              <span className="leading-none select-none" style={{ fontSize: `${a.def.height * 0.85}cqw` }}>
                {a.emoji ?? a.def.appearance.char}
              </span>
            ) : (
              <PixelSprite app={a.def.appearance} />
            )}
          </div>
        ))}
      </div>

      {v.outcome && (
        <div className="absolute inset-0 z-30 flex items-start justify-center pointer-events-none" style={{ paddingTop: "5%" }}>
          <div className="font-black tracking-wider" style={{
            fontSize: "11cqw", color: v.outcome === "win" ? "#ffe93c" : "#ff5470",
            WebkitTextStroke: "0.6cqw #14082b", transform: "rotate(-4deg)",
          }}>
            {v.outcome === "win" ? "NICE!" : "MISS..."}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Compile                                                            */
/* ================================================================== */
export function compileMicrogame(data: MicrogameData): MicrogameDef {
  return {
    id: data.id,
    instruction: data.instruction,
    lengthBars: data.lengthBars,
    timeoutOutcome: data.timeoutOutcome,
    palette: data.palette,
    init: () => initState(data),
    update: (s: RtState, ctx: MgCtx) => step(s, data, ctx),
    View: ({ s, v }: { s: RtState; v: ViewCtx }) => <DataView s={s} v={v} data={data} />,
  };
}
