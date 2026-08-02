import { useMemo } from "react";
import { AUDIO } from "../engine/audio";
import type { MgCtx, MicrogameDef, ViewCtx } from "../engine/types";
import type {
  Action,
  ActorDef,
  ActorInstance,
  Condition,
  MicrogameData,
} from "./schema";
import { migrateGame } from "./schema";
import { PickState, collectPairs } from "../engine/picking";
import { evalExpr, type ExprHost } from "../engine/expr";
import { Sprite, celOf, costumeOf } from "../engine/Sprite";
import { defaultFidelity } from "../engine/assets";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const uid = (p = "rt") => `${p}_${Math.random().toString(36).slice(2, 7)}`;

/* ================================================================== */
/*  Runtime state                                                      */
/* ================================================================== */
interface RtActor {
  instId: string;
  def: ActorDef;
  /** stable index for deterministic tie-breaking in picking */
  seq: number;
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
  vars: Record<string, number>;

  /* ---- costume / animation state ---- */
  costume: string;
  frame: number;
  /** beats accumulated on the current cel */
  animClock: number;
  animDir: 1 | -1;
  animPlaying: boolean;
  /** set when a costume switch cut an unfinished animation short */
  animInterrupted: boolean;

  /** mirrors def.id; PickState keys on this */
  defId: string;
}

interface RtState {
  actors: RtActor[];
  sceneVars: Record<string, number>;
  mem: Record<string, any>;
  fx: { shake: number; flash: string | null; flashT: number };
  grabId: string | null;
  started: boolean;
  counter: number;
  /** name -> def and id -> def, so expressions can say `Ball.x` */
  defsByName: Map<string, ActorDef>;
  defsById: Map<string, ActorDef>;
  seq: number;
}

/* ==================================================================
 *  Expression resolution
 *
 *  v1's syntax ({self:x} / {scene:foo} / {rnd:a,b}) is preserved exactly,
 *  so every existing microgame keeps evaluating identically. What is new
 *  is that expressions can now reach ACROSS actors and are resolved
 *  against the PICKED set:
 *
 *      Ball.x            x of the picked Ball (the one that was hit)
 *      {Ball:width}      brace form of the same
 *      count(Ball)       how many Balls are picked
 *      sin(t*90)*8 + 50  arithmetic + functions
 *
 *  This is what makes "Set Player size to Ball size" a plain expression
 *  rather than a bespoke action.
 * ================================================================== */
function selfReader(self: RtActor): (name: string) => number {
  return (name) => {
    switch (name) {
      case "x": return self.x;
      case "y": return self.y;
      case "vx": return self.vx;
      case "vy": return self.vy;
      case "scale": return self.scale;
      case "rot": return self.rot;
      case "w": case "width": return self.def.width * self.scale;
      case "h": case "height": return self.def.height * self.scale;
      case "left": return self.x - (self.def.width * self.scale) / 2;
      case "right": return self.x + (self.def.width * self.scale) / 2;
      case "top": return self.y - (self.def.height * self.scale) / 2;
      case "bottom": return self.y + (self.def.height * self.scale) / 2;
      case "grounded": return self.grounded ? 1 : 0;
      case "frame": return self.frame;
      case "visible": return self.visible ? 1 : 0;
      case "interrupted": return self.animInterrupted ? 1 : 0;
      default: return self.vars[name] ?? 0;
    }
  };
}

/** Build an ExprHost bound to the current pick scope. */
function hostFor(self: RtActor | null, s: RtState, t: number, pick: PickState<RtActor> | null): ExprHost {
  return {
    self: self ? selfReader(self) : null,
    scene: (name) => (name === "t" ? t : s.sceneVars[name] ?? 0),
    t,
    rng: Math.random,
    actorProp: (actorName, prop) => {
      const def = s.defsByName.get(actorName) ?? s.defsById.get(actorName);
      if (!def) return 0;
      // Prefer the picked instance — this is what makes cross-actor
      // expressions mean "the one this event is about".
      const list = pick ? pick.get(def.id) : s.actors.filter((a) => a.alive && a.defId === def.id);
      const inst = list[0];
      return inst ? selfReader(inst)(prop) : 0;
    },
    count: (actorName) => {
      const def = s.defsByName.get(actorName) ?? s.defsById.get(actorName);
      if (!def) return 0;
      return (pick ? pick.get(def.id) : s.actors.filter((a) => a.alive && a.defId === def.id)).length;
    },
  };
}

function resolve(raw: any, self: RtActor | null, s: RtState, t: number, pick: PickState<RtActor> | null = null): number {
  return evalExpr(raw, hostFor(self, s, t, pick));
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
  /** the picked-instance scope for this event (Construct's SOL) */
  pick: PickState<RtActor>;
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

/* ==================================================================
 *  Instance-scoped conditions — NARROWING, not just testing.
 *
 *  This is the heart of the v2 change. In v1 a condition returned a bool
 *  for one pre-chosen `self`, and an action's `targetDef` then hit EVERY
 *  live instance of that type. So "Player overlaps Ball -> Destroy Ball"
 *  destroyed every ball on screen.
 *
 *  Here each condition narrows `ec.pick`. A condition is "true" exactly
 *  when it leaves at least one instance picked, so truthiness and
 *  selection are the same operation — and the obvious authoring reads
 *  correctly with no disambiguation UI.
 * ================================================================== */
function narrowInstance(conds: Condition[], ec: EvalCtx, forActor: string): boolean {
  const { s, ctx, pick } = ec;

  for (const c of conds) {
    const p = c.params;
    switch (c.kind) {
      case "clicked":
        if (!pick.filter(forActor, (a) => ctx.input.pointer.pressed && hitPointer(a, ctx))) return false;
        break;

      case "collide": {
        // Narrow BOTH sides to the instances actually touching. When the
        // other type is "any" we can only narrow the subject.
        const otherId = p.other as string;
        if (otherId === "any") {
          if (!pick.filter(forActor, (a) => s.actors.some((o) => o.alive && o !== a && overlap(a, o)))) return false;
        } else {
          const pairs = collectPairs(pick.get(forActor), pick.get(otherId), overlap);
          if (!pairs.length) return false;
          pick.set(forActor, dedupe(pairs.map((x) => x.a)));
          pick.set(otherId, dedupe(pairs.map((x) => x.b)));
        }
        break;
      }

      case "onCollideStart": {
        const otherId = p.other as string;
        const hits: RtActor[] = [];
        const partners: RtActor[] = [];
        for (const a of pick.get(forActor)) {
          const list = otherId === "any"
            ? s.actors.filter((o) => o.alive && o !== a)
            : pick.get(otherId);
          const touching = list.filter((o) => o !== a && overlap(a, o));
          // edge-detect per (event, instance) pair
          const k = `ocs:${ec.evid}:${a.instId}`;
          const was = !!s.mem[k];
          const now = touching.length > 0;
          s.mem[k] = now;
          if (now && !was) {
            hits.push(a);
            partners.push(...touching);
          }
        }
        if (!hits.length) return false;
        pick.set(forActor, hits);
        if (otherId !== "any") pick.set(otherId, dedupe(partners));
        break;
      }

      case "inArea":
        if (!pick.filter(forActor, (a) =>
          a.x >= p.x && a.x <= p.x + p.w && a.y >= p.y && a.y <= p.y + p.h)) return false;
        break;

      case "outOfBounds":
        if (!pick.filter(forActor, (a) => a.x < 0 || a.x > 100 || a.y < 0 || a.y > 100)) return false;
        break;

      case "isGrounded":
        if (!pick.filter(forActor, (a) => a.grounded)) return false;
        break;

      case "isCostume":
        if (!pick.filter(forActor, (a) => a.costume === p.costume)) return false;
        break;

      case "animFinished":
        if (!pick.filter(forActor, (a) => !a.animPlaying)) return false;
        break;

      case "varCmp":
        if (p.scope === "self") {
          if (!pick.filter(forActor, (a) =>
            cmpNum(resolve(`{self:${p.name}}`, a, s, ctx.t, pick), p.op, rv(p.value, a, s, ctx.t, pick)))) return false;
        }
        break;

      case "compare":
        // free-form expression comparison, e.g.  Ball.x  <  Player.x
        if (!pick.filter(forActor, (a) =>
          cmpNum(rv(p.left, a, s, ctx.t, pick), p.op, rv(p.right, a, s, ctx.t, pick)))) return false;
        break;

      case "pickNth": {
        const list = pick.get(forActor).slice().sort((x, y) => x.seq - y.seq);
        const i = Math.floor(rv(p.index, null, s, ctx.t, pick));
        const chosen = list[((i % list.length) + list.length) % list.length];
        if (!chosen) return false;
        pick.set(forActor, [chosen]);
        break;
      }

      case "pickRandom": {
        const list = pick.get(forActor);
        if (!list.length) return false;
        pick.set(forActor, [list[Math.floor(Math.random() * list.length)]]);
        break;
      }

      default: break; // scene-level conditions already handled
    }
  }
  return pick.get(forActor).length > 0;
}

const dedupe = (list: RtActor[]): RtActor[] => {
  const m = new Map<string, RtActor>();
  for (const a of list) m.set(a.instId, a);
  return Array.from(m.values());
};

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

function applyAction(act: Action, ec: EvalCtx, forActor: string | null) {
  const { s, ctx, pick } = ec;
  const p = act.params;
  const t = ctx.t;

  /* TARGET RESOLUTION — the payoff of the picking model.
   *
   * An explicit `targetDef` now resolves to that type's PICKED set, not to
   * every live instance. So in
   *
   *     [Player overlaps Ball]  ->  Destroy Ball
   *
   * `Ball` is the ball the collision narrowed to, and every other ball is
   * untouched. With no targetDef we act on the event's own picked subject.
   */
  const targets: RtActor[] = act.targetDef
    ? pick.get(act.targetDef)
    : forActor
      ? pick.get(forActor)
      : [];

  // `self` for expression scope: the first picked subject, if any
  const self: RtActor | null = targets[0] ?? ec.self ?? null;

  const per = (a: RtActor) => {
    switch (act.kind) {
      case "setVel": a.vx = rv(p.vx, a, s, t, pick); a.vy = rv(p.vy, a, s, t, pick); break;
      case "addVel": a.vx += rv(p.vx, a, s, t, pick); a.vy += rv(p.vy, a, s, t, pick); break;
      case "setPos": a.x = rv(p.x, a, s, t, pick); a.y = rv(p.y, a, s, t, pick); break;
      case "moveBy": a.x += rv(p.x, a, s, t, pick); a.y += rv(p.y, a, s, t, pick); break;
      case "stop": a.vx = 0; a.vy = 0; break;
      case "setVar": {
        const v = rv(p.value, a, s, t, pick);
        if (p.scope === "scene") s.sceneVars[p.name] = p.op === "add" ? (s.sceneVars[p.name] ?? 0) + v : v;
        else a.vars[p.name] = p.op === "add" ? (a.vars[p.name] ?? 0) + v : v;
        break;
      }
      case "destroy": a.alive = false; break;
      case "hide": a.visible = false; break;
      case "show": a.visible = true; break;
      case "setScale": a.scale = rv(p.value, a, s, t, pick); break;
      case "rotate": a.rot += rv(p.value, a, s, t, pick); break;

      /* ---- costume actions (new in v2) ---- */
      case "setCostume": switchCostume(a, String(p.costume), true); break;
      case "setCostumeKeep": switchCostume(a, String(p.costume), false); break;
      case "stopAnim": a.animPlaying = false; break;
      case "playAnim": a.animPlaying = true; break;
      case "setFrame": {
        const c = costumeOf(a.def, a.costume);
        const n = c ? c.frames.length : 1;
        a.frame = Math.max(0, Math.min(n - 1, Math.floor(rv(p.value, a, s, t, pick))));
        a.animClock = 0;
        break;
      }

      /* Legacy: v1's "Set emoji". Retargeted onto the costume system so old
       * microgames keep working — it now rewrites cel 0 of the live costume
       * rather than poking a render-time override. */
      case "setEmoji": {
        const c = costumeOf(a.def, a.costume);
        if (c && c.frames[0]) c.frames[0] = { ...c.frames[0], app: { kind: "emoji", char: String(p.emoji) } };
        break;
      }
      default: break;
    }
  };

  switch (act.kind) {
    case "win": ctx.win(); break;
    case "lose": ctx.lose(); break;
    case "spawn": {
      const def = s.defsById.get(p.def) ?? ec.data.actors.find((d) => d.id === p.def);
      if (def) {
        const inst: ActorInstance = {
          id: uid("inst"), defId: def.id,
          x: rv(p.x, self, s, t, pick), y: rv(p.y, self, s, t, pick),
          scale: 1, rot: 0, visible: true, vars: {},
        };
        const born = instToActor(inst, def, s.seq++);
        s.actors.push(born);
        // Newly spawned instances join the picked set, so a following
        // action in the same event can address what was just created.
        pick.addPick(def.id, [born]);
      }
      break;
    }
    case "playSfx": playSfx(p.sfx); break;
    case "shake": s.fx.shake = Math.max(s.fx.shake, rv(p.value, self, s, t, pick)); break;
    case "setSceneVar": {
      const v = rv(p.value, self, s, t, pick);
      s.sceneVars[p.name] = p.op === "add" ? (s.sceneVars[p.name] ?? 0) + v : v;
      break;
    }
    default: targets.forEach(per);
  }
}

/* ================================================================== */
/*  Init / step                                                        */
/* ================================================================== */
function instToActor(inst: ActorInstance, def: ActorDef, seq: number): RtActor {
  const start = def.defaultCostume ?? def.costumes?.[0]?.name ?? "idle";
  return {
    instId: inst.id, def, defId: def.id, seq,
    x: inst.x, y: inst.y, vx: 0, vy: 0,
    scale: inst.scale, rot: inst.rot, visible: inst.visible,
    grounded: false, groundedPrev: false, alive: true,
    vars: { ...def.vars, ...inst.vars },
    costume: start, frame: 0, animClock: 0, animDir: 1,
    animPlaying: true, animInterrupted: false,
  };
}

/* ---- costume switching (runtime side) ----------------------------- */
function switchCostume(a: RtActor, name: string, restart = true): void {
  const next = costumeOf(a.def, name);
  if (!next) return;
  if (a.costume === name && !restart) return;

  const prev = costumeOf(a.def, a.costume);
  // "Interruptible animations" from the Mario Paint brief: an event sheet
  // can ask whether a costume switch cut an animation short.
  a.animInterrupted = a.animPlaying && !!prev && a.frame < prev.frames.length - 1;

  a.costume = name;
  if (restart) { a.frame = 0; a.animClock = 0; a.animDir = 1; }
  else a.frame = Math.min(a.frame, Math.max(0, next.frames.length - 1));
  a.animPlaying = true;
}

/** Advance one actor's animation. Holds are in BEATS, so cel timing rides
 *  the tempo ramp instead of drifting when the game speeds up. */
function advanceAnim(a: RtActor, dtBeats: number): void {
  if (!a.animPlaying) return;
  const c = costumeOf(a.def, a.costume);
  if (!c || c.frames.length <= 1) return;

  a.animClock += dtBeats;
  let guard = 0;
  while (guard++ < 32) {
    const hold = Math.max(0.01, c.frames[a.frame]?.hold ?? 0.5);
    if (a.animClock < hold) break;
    a.animClock -= hold;
    switch (c.playback) {
      case "loop":
        a.frame = (a.frame + 1) % c.frames.length;
        break;
      case "pingpong": {
        if (a.frame + a.animDir >= c.frames.length || a.frame + a.animDir < 0) {
          a.animDir = (a.animDir * -1) as 1 | -1;
        }
        a.frame = Math.max(0, Math.min(c.frames.length - 1, a.frame + a.animDir));
        break;
      }
      case "once":
        if (a.frame < c.frames.length - 1) a.frame++;
        else a.animPlaying = false;
        break;
      case "onceHide":
        if (a.frame < c.frames.length - 1) a.frame++;
        else { a.animPlaying = false; a.visible = false; }
        break;
    }
  }
}

function initState(data: MicrogameData): RtState {
  const s: RtState = {
    actors: [], sceneVars: {}, mem: {},
    fx: { shake: 0, flash: null, flashT: 0 },
    grabId: null, started: false, counter: 0,
    defsByName: new Map(), defsById: new Map(), seq: 0,
  };
  for (const d of data.actors) {
    s.defsByName.set(d.name, d);
    s.defsById.set(d.id, d);
  }
  for (const inst of data.scene.instances) {
    const def = s.defsById.get(inst.defId);
    if (def) s.actors.push(instToActor(inst, def, s.seq++));
  }
  return s;
}

function step(s: RtState, data: MicrogameData, ctx: MgCtx) {
  if (ctx.control && !s.started) s.started = true;

  const solids = s.actors.filter((a) => a.alive && a.def.solid);
  const floorY = data.scene.floorY;

  for (const a of s.actors) if (a.alive) integrate(a, ctx, s, solids, floorY);

  // Animation advances in BEATS, so cel timing rides the tempo ramp.
  if (ctx.t > -1) for (const a of s.actors) if (a.alive) advanceAnim(a, ctx.dtBeats);

  /* ---- event sheet ------------------------------------------------
   * Each event gets a FRESH pick scope. Conditions narrow it; actions
   * read it. Sub-events (if present) inherit a clone so siblings can't
   * contaminate one another — Construct's semantics.
   * ---------------------------------------------------------------- */
  for (const ev of data.events) {
    if (!ev.enabled) continue;

    const pick = new PickState<RtActor>(() => s.actors);
    const ec: EvalCtx = { s, ctx, data, self: null, evid: ev.id, pick };

    // scene-level conditions gate the whole event
    if (!evalGlobal(ev.conditions, ec)) continue;

    if (ev.forActor) {
      // narrow to the instances this event is actually about
      if (!narrowInstance(ev.conditions, ec, ev.forActor)) continue;
      ec.self = pick.get(ev.forActor)[0] ?? null;

      /* Run the action list ONCE against the picked set rather than once
       * per instance. Actions that target a type fan out internally via
       * `targets.forEach`, so a multi-instance pick still applies to all
       * of them — but a cross-actor reference like `Ball.x` resolves to
       * the picked partner instead of an arbitrary one. */
      for (const act of ev.actions) applyAction(act, ec, ev.forActor);
    } else {
      ec.self = null;
      for (const act of ev.actions) applyAction(act, ec, null);
    }
  }

  s.actors = s.actors.filter((a) => a.alive);
  s.fx.shake = Math.max(0, s.fx.shake - ctx.dtBeats * 6);
}

/* ================================================================== */
/*  Rendering                                                          */
/* ================================================================== */
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
  /* Fidelity is DERIVED, not asked. A small canvas implies crisp
     nearest-neighbour pixels; a large one implies smoothing. Authors who
     care can override it in Settings; everyone else never thinks about it,
     and there is no "pixel or photorealistic?" prompt anywhere. */
  const fid = data.fidelity ?? defaultFidelity(data.canvas?.w ?? 240);
  const crisp = !fid.smoothing;
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
            {/* ONE render path for every appearance kind. The actor names a
                costume; the costume yields a cel; Sprite draws it. Nothing
                here knows or cares whether that cel is an emoji placeholder
                or a finished bitmap — which is exactly the indirection v1
                was missing. */}
            <Sprite
              app={celOf(a.def, a.costume, a.frame)}
              sizeCqw={a.def.height}
              crisp={crisp}
            />
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
export function compileMicrogame(raw: MicrogameData): MicrogameDef {
  // Fold v1 saves (appearance -> costumes, missing canvas) forward on load.
  const data = migrateGame(raw);
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
