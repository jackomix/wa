/* ==================================================================
 *  Authoring helpers for recreated microgames.
 *
 *  Every recreation below is PURE DATA — no engine code, no per-game
 *  `case` anywhere. That constraint is the point: if a microgame can't
 *  be expressed with these helpers plus the condition/action catalog,
 *  the editor is missing a feature and the editor gets fixed.
 *
 *  This file is deliberately thin. It is sugar over `schema.ts`, so that
 *  a microgame definition reads like a description of the game rather
 *  than a pile of object literals.
 * ================================================================== */

import {
  makeActorDef,
  makeBehavior,
  makeInstance,
  makeCostume,
  makeAnimCostume,
  uid,
  CANVAS_GBA,
  type Action,
  type ActorDef,
  type Appearance,
  type BehaviorType,
  type Canvas,
  type Condition,
  type GameEvent,
  type MicrogameData,
  type Playback,
} from "../editor/schema";

/* ---- appearance sugar --------------------------------------------- */
export const em = (char: string): Appearance => ({ kind: "emoji", char });
export const shape = (
  s: "rect" | "ellipse" | "triangle" | "star",
  fill: string,
): Appearance => ({ kind: "shape", shape: s, fill });

/* ---- actor builder ------------------------------------------------ */
export interface ActorOpts {
  /** costumes as { name: [chars...] } — first is the default */
  costumes?: Record<string, string | string[]>;
  /** or explicit appearances for non-emoji art */
  costumeApps?: Record<string, Appearance | Appearance[]>;
  behavior?: BehaviorType;
  /** behavior field overrides */
  tune?: Partial<Record<"speed" | "jump" | "gravity" | "friction" | "bounce", number>>;
  w?: number;
  h?: number;
  z?: number;
  solid?: boolean;
  vars?: Record<string, number>;
  /** per-cel hold in beats for multi-frame costumes */
  hold?: number;
  playback?: Playback;
}

export function actor(name: string, opts: ActorOpts = {}): ActorDef {
  const a = makeActorDef(name, "⭐");

  const costumes: ActorDef["costumes"] = [];
  const add = (cname: string, v: Appearance | Appearance[]) => {
    costumes.push(
      Array.isArray(v)
        ? makeAnimCostume(cname, v, opts.hold ?? 0.25, opts.playback ?? "loop")
        : makeCostume(cname, v),
    );
  };

  if (opts.costumeApps) {
    for (const [k, v] of Object.entries(opts.costumeApps)) add(k, v);
  } else if (opts.costumes) {
    for (const [k, v] of Object.entries(opts.costumes)) {
      add(k, Array.isArray(v) ? v.map(em) : em(v));
    }
  }
  if (costumes.length === 0) add("idle", em("⭐"));

  a.costumes = costumes;
  a.defaultCostume = costumes[0].name;
  a.behavior = makeBehavior(opts.behavior ?? "static");
  if (opts.tune) Object.assign(a.behavior, opts.tune);
  a.width = opts.w ?? 14;
  a.height = opts.h ?? 14;
  a.z = opts.z ?? 1;
  a.solid = opts.solid ?? false;
  a.vars = opts.vars ?? {};
  return a;
}

/* ---- event builder ------------------------------------------------ */
export const ev = (
  name: string,
  forActor: string | null,
  conditions: Condition[],
  actions: Action[],
): GameEvent => ({ id: uid("ev"), name, forActor, enabled: true, conditions, actions });

/* ---- conditions ---------------------------------------------------- */
export const C = {
  start: (): Condition => ({ kind: "atStart", params: {} }),
  always: (): Condition => ({ kind: "always", params: {} }),
  keyPress: (key: string): Condition => ({ kind: "keyPressed", params: { key } }),
  keyHeld: (key: string): Condition => ({ kind: "keyDown", params: { key } }),
  keyUp: (key: string): Condition => ({ kind: "keyReleased", params: { key } }),
  tap: (): Condition => ({ kind: "pointerPressed", params: {} }),
  clicked: (): Condition => ({ kind: "clicked", params: {} }),
  hits: (otherDefId: string): Condition => ({ kind: "collide", params: { other: otherDefId } }),
  startsHitting: (otherDefId: string): Condition => ({ kind: "onCollideStart", params: { other: otherDefId } }),
  inArea: (x: number, y: number, w: number, h: number): Condition => ({ kind: "inArea", params: { x, y, w, h } }),
  offscreen: (): Condition => ({ kind: "outOfBounds", params: {} }),
  grounded: (): Condition => ({ kind: "isGrounded", params: {} }),
  after: (beats: number | string): Condition => ({ kind: "timeGt", params: { value: beats } }),
  everyBeats: (beats: number): Condition => ({ kind: "everyBeats", params: { beats } }),
  sceneVar: (name: string, op: string, value: number | string): Condition => ({
    kind: "varCmp", params: { scope: "scene", name, op, value },
  }),
  selfVar: (name: string, op: string, value: number | string): Condition => ({
    kind: "varCmp", params: { scope: "self", name, op, value },
  }),
  /** free-form expression comparison; where cross-actor refs earn their keep */
  cmp: (left: string | number, op: string, right: string | number): Condition => ({
    kind: "compare", params: { left, op, right },
  }),
  costumeIs: (costume: string): Condition => ({ kind: "isCostume", params: { costume } }),
  animDone: (): Condition => ({ kind: "animFinished", params: {} }),
  pickRandom: (): Condition => ({ kind: "pickRandom", params: {} }),
};

/* ---- actions -------------------------------------------------------- */
export const A = {
  win: (): Action => ({ kind: "win", params: {} }),
  lose: (): Action => ({ kind: "lose", params: {} }),
  sfx: (sfx: string): Action => ({ kind: "playSfx", params: { sfx } }),
  shake: (amount: number | string = 1): Action => ({ kind: "shake", params: { value: amount } }),

  vel: (vx: number | string, vy: number | string, target?: string): Action => ({
    kind: "setVel", params: { vx, vy }, targetDef: target ?? null,
  }),
  addVel: (vx: number | string, vy: number | string, target?: string): Action => ({
    kind: "addVel", params: { vx, vy }, targetDef: target ?? null,
  }),
  pos: (x: number | string, y: number | string, target?: string): Action => ({
    kind: "setPos", params: { x, y }, targetDef: target ?? null,
  }),
  moveBy: (x: number | string, y: number | string, target?: string): Action => ({
    kind: "moveBy", params: { x, y }, targetDef: target ?? null,
  }),
  stop: (target?: string): Action => ({ kind: "stop", params: {}, targetDef: target ?? null }),

  destroy: (target?: string): Action => ({ kind: "destroy", params: {}, targetDef: target ?? null }),
  spawn: (defId: string, x: number | string, y: number | string): Action => ({
    kind: "spawn", params: { def: defId, x, y },
  }),
  hide: (target?: string): Action => ({ kind: "hide", params: {}, targetDef: target ?? null }),
  show: (target?: string): Action => ({ kind: "show", params: {}, targetDef: target ?? null }),
  scale: (value: number | string, target?: string): Action => ({
    kind: "setScale", params: { value }, targetDef: target ?? null,
  }),
  rotate: (value: number | string, target?: string): Action => ({
    kind: "rotate", params: { value }, targetDef: target ?? null,
  }),

  costume: (costume: string, target?: string): Action => ({
    kind: "setCostume", params: { costume }, targetDef: target ?? null,
  }),
  costumeKeep: (costume: string, target?: string): Action => ({
    kind: "setCostumeKeep", params: { costume }, targetDef: target ?? null,
  }),
  stopAnim: (target?: string): Action => ({ kind: "stopAnim", params: {}, targetDef: target ?? null }),

  setVar: (name: string, value: number | string, target?: string): Action => ({
    kind: "setVar", params: { scope: "self", name, op: "set", value }, targetDef: target ?? null,
  }),
  addVar: (name: string, value: number | string, target?: string): Action => ({
    kind: "setVar", params: { scope: "self", name, op: "add", value }, targetDef: target ?? null,
  }),
  setScene: (name: string, value: number | string): Action => ({
    kind: "setSceneVar", params: { name, op: "set", value },
  }),
  addScene: (name: string, value: number | string): Action => ({
    kind: "setSceneVar", params: { name, op: "add", value },
  }),
};

/* ---- microgame builder --------------------------------------------- */
export interface GameOpts {
  id: string;
  name: string;
  /** the single imperative verb card */
  instruction: string;
  host: string;
  /** provenance note: what this recreates and what was matched */
  origin?: string;
  bars?: 2 | 4;
  timeout?: "win" | "lose";
  bpm?: number;
  /** original playfield size; varies per microgame in the source */
  canvas?: Canvas;
  palette: { outer: string; frame: string; screen: string; text: string };
  scene: {
    bg: string;
    bg2?: string;
    gradient?: boolean;
    pattern?: "none" | "grid" | "dots" | "stars";
    floorY?: number;
    ground?: string;
  };
  actors: ActorDef[];
  /** [actorDef, x, y] placements */
  place: [ActorDef, number, number][];
  events: GameEvent[];
  /** per-tier scene-variable overrides, mirroring the original's 3 levels */
  difficulty?: Record<1 | 2 | 3, Record<string, number>>;
  vars?: Record<string, number>;
  notes?: string;
}

export function game(o: GameOpts): MicrogameData {
  return {
    id: o.id,
    name: o.name,
    instruction: o.instruction,
    lengthBars: o.bars ?? 2,
    timeoutOutcome: o.timeout ?? "lose",
    bpm: o.bpm ?? 130,
    canvas: o.canvas ?? { ...CANVAS_GBA },
    host: o.host,
    origin: o.origin,
    palette: o.palette,
    scene: {
      bgColor: o.scene.bg,
      bg2Color: o.scene.bg2 ?? o.scene.bg,
      gradient: o.scene.gradient ?? false,
      pattern: o.scene.pattern ?? "none",
      floorY: o.scene.floorY ?? 100,
      groundColor: o.scene.ground ?? "#333",
      instances: o.place.map(([d, x, y]) => makeInstance(d.id, x, y)),
    },
    actors: o.actors,
    events: o.events,
    difficulty: o.difficulty,
  };
}
