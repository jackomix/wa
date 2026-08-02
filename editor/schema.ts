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

/* ---- appearance -------------------------------------------------- */
export type Appearance =
  | { kind: "sprite"; ref: string; label?: string }
  | {
      kind: "pixel";
      grid: number; // cells per side (8/12/16)
      palette: string[];
      pixels: number[][]; // [row][col] = palette index, -1 = transparent
    };

export interface SpriteFrame {
  id: string;
  appearance: Appearance;
  duration: number;
}

export interface Costume {
  id: string;
  name: string;
  frames: SpriteFrame[];
  loop: boolean;
  fps: number;
}

/* ---- actor template ---------------------------------------------- */
export interface ActorDef {
  id: string;
  name: string;
  appearance: Appearance; // default/legacy view; costumes are the authored source
  costumes: Costume[];
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
  costumeId: string;
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

export interface CanvasSpec {
  width: number;
  height: number;
  label: string;
  activeX: number;
  activeY: number;
  activeWidth: number;
  activeHeight: number;
}

export interface MicrogameData {
  id: string;
  name: string;
  canvas?: CanvasSpec;
  instruction: string;
  lengthBars: 2 | 4;
  timeoutOutcome: "win" | "lose";
  palette: Palette;
  scene: Scene;
  actors: ActorDef[];
  events: GameEvent[];
  /** optional per-game tempo when tested standalone */
  bpm?: number;
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

export function makeActorDef(name: string, spriteRef = "spark"): ActorDef {
  const defaultAppearance: Appearance = { kind: "sprite", ref: spriteRef, label: name };
  return {
    id: uid("act"),
    name,
    appearance: defaultAppearance,
    costumes: [{ id: "default", name: "Default", frames: [{ id: uid("frame"), appearance: defaultAppearance, duration: 0.12 }], loop: true, fps: 8 }],
    defaultCostume: "default",
    width: 14,
    height: 14,
    solid: false,
    z: 1,
    behavior: makeBehavior("static"),
    vars: {},
  };
}

export function makeInstance(defId: string, x = 50, y = 50): ActorInstance {
  return { id: uid("inst"), defId, x, y, scale: 1, rot: 0, costumeId: "default", visible: true, vars: {} };
}

export const KEY_OPTIONS: { value: Key; label: string }[] = [
  { value: "left", label: "◀ Left" },
  { value: "right", label: "Right ▶" },
  { value: "up", label: "▲ Up" },
  { value: "down", label: "▼ Down" },
  { value: "space", label: "Space ␣" },
];
