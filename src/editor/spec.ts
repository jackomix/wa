/* ================================================================== */
/*  Catalog of Behaviors / Conditions / Actions                        */
/*  This drives the editor UI dynamically: each entry declares its      */
/*  parameter fields, and the runtime switches on the same ids.         */
/* ================================================================== */

export type FieldType =
  | "number"
  | "expr" // free text number OR {scope:var} token
  | "key"
  | "color"
  | "actor" // select an actor def
  | "other" // actor def or "any"
  | "op"
  | "scope"
  | "bool"
  | "pattern"
  | "sfx"
  | "text"
  | "emoji"
  | "costume"
  | "playback";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  default?: any;
}

export interface CondSpec {
  id: string;
  label: string;
  category: string;
  /** true = only valid when the event has a forActor */
  needsActor: boolean;
  fields: FieldDef[];
}
export interface ActionSpec {
  id: string;
  label: string;
  category: string;
  /** true = applies to scene once (win/lose/spawn/shake/sceneVar) */
  sceneLevel: boolean;
  fields: FieldDef[];
}
export interface BehaviorSpec {
  id: string;
  label: string;
  icon: string;
  fields: FieldDef[];
}

/* key/sfx/op shared option lists */
export const OP_OPTIONS = [
  { value: "=", label: "=" },
  { value: "!=", label: "≠" },
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: ">=", label: "≥" },
  { value: "<=", label: "≤" },
];
export const SCOPE_OPTIONS = [
  { value: "self", label: "Self" },
  { value: "scene", label: "Scene" },
];
export const SFX_OPTIONS = [
  { value: "coin", label: "Coin" },
  { value: "jump", label: "Jump" },
  { value: "pop", label: "Pop" },
  { value: "hit", label: "Hit" },
  { value: "boom", label: "Boom" },
  { value: "shoot", label: "Shoot" },
  { value: "win", label: "Win" },
  { value: "lose", label: "Lose" },
];
export const PATTERN_OPTIONS = [
  { value: "none", label: "None" },
  { value: "grid", label: "Grid" },
  { value: "dots", label: "Dots" },
  { value: "stars", label: "Stars" },
];

const num = (k: string, label: string, d: number): FieldDef => ({
  key: k,
  label,
  type: "number",
  default: d,
});
const expr = (k: string, label: string, d: number): FieldDef => ({
  key: k,
  label,
  type: "expr",
  default: String(d),
});
const actorF = (k: string, label: string): FieldDef => ({ key: k, label, type: "actor" });
const otherF = (k: string): FieldDef => ({ key: k, label: "with", type: "other" });

export const COND_SPECS: CondSpec[] = [
  { id: "always", label: "Always", category: "Flow", needsActor: false, fields: [] },
  { id: "atStart", label: "On game start", category: "Flow", needsActor: false, fields: [] },
  {
    id: "keyDown", label: "Key held", category: "Input", needsActor: false,
    fields: [{ key: "key", label: "key", type: "key", default: "space" }],
  },
  {
    id: "keyPressed", label: "Key pressed", category: "Input", needsActor: false,
    fields: [{ key: "key", label: "key", type: "key", default: "space" }],
  },
  {
    id: "keyReleased", label: "Key released", category: "Input", needsActor: false,
    fields: [{ key: "key", label: "key", type: "key", default: "space" }],
  },
  { id: "pointerDown", label: "Pointer held", category: "Input", needsActor: false, fields: [] },
  { id: "pointerPressed", label: "Pointer pressed", category: "Input", needsActor: false, fields: [] },
  { id: "clicked", label: "Clicked on self", category: "Input", needsActor: true, fields: [] },
  {
    id: "collide", label: "Overlaps", category: "Collision", needsActor: true,
    fields: [otherF("other")],
  },
  {
    id: "onCollideStart", label: "Starts overlapping", category: "Collision", needsActor: true,
    fields: [otherF("other")],
  },
  {
    id: "inArea", label: "Inside area", category: "Position", needsActor: true,
    fields: [num("x", "x", 35), num("y", "y", 35), num("w", "w", 30), num("h", "h", 30)],
  },
  { id: "outOfBounds", label: "Off-screen", category: "Position", needsActor: true, fields: [] },
  { id: "isGrounded", label: "Is grounded", category: "Movement", needsActor: true, fields: [] },
  {
    id: "varCmp", label: "Variable", category: "Variables", needsActor: false,
    fields: [
      { key: "scope", label: "scope", type: "scope", default: "self" },
      { key: "name", label: "var", type: "text", default: "score" },
      { key: "op", label: "", type: "op", default: ">=" },
      expr("value", "value", 1),
    ],
  },
  {
    id: "everyBeats", label: "Every N beats", category: "Time", needsActor: false,
    fields: [num("beats", "every", 2)],
  },
  {
    id: "timeGt", label: "After N beats", category: "Time", needsActor: false,
    fields: [expr("value", "beats", 6)],
  },

  /* ---- v2 additions ---- */
  {
    id: "isCostume", label: "Costume is", category: "Appearance", needsActor: true,
    fields: [{ key: "costume", label: "costume", type: "costume", default: "idle" }],
  },
  {
    id: "animFinished", label: "Animation finished", category: "Appearance", needsActor: true,
    fields: [],
  },
  {
    // Free-form expression comparison. This is the "escape hatch" that stops
    // the catalog needing a bespoke condition for every question — and it is
    // where cross-actor expressions earn their keep:  Ball.x  <  Player.x
    id: "compare", label: "Compare values", category: "Variables", needsActor: true,
    fields: [
      expr("left", "", 0),
      { key: "op", label: "", type: "op", default: ">=" },
      expr("right", "", 0),
    ],
  },
  {
    id: "pickRandom", label: "Pick a random one", category: "Picking", needsActor: true,
    fields: [],
  },
  {
    id: "pickNth", label: "Pick the Nth one", category: "Picking", needsActor: true,
    fields: [expr("index", "index", 0)],
  },
];

export const ACTION_SPECS: ActionSpec[] = [
  { id: "win", label: "Win game", category: "Outcome", sceneLevel: true, fields: [] },
  { id: "lose", label: "Lose game", category: "Outcome", sceneLevel: true, fields: [] },
  {
    id: "setVel", label: "Set velocity", category: "Movement", sceneLevel: false,
    fields: [expr("vx", "vx", 0), expr("vy", "vy", 0)],
  },
  {
    id: "addVel", label: "Add velocity", category: "Movement", sceneLevel: false,
    fields: [expr("vx", "vx", 0), expr("vy", "vy", -30)],
  },
  {
    id: "setPos", label: "Set position", category: "Position", sceneLevel: false,
    fields: [expr("x", "x", 50), expr("y", "y", 50)],
  },
  {
    id: "moveBy", label: "Move by", category: "Position", sceneLevel: false,
    fields: [expr("x", "dx", 0), expr("y", "dy", 0)],
  },
  { id: "stop", label: "Stop", category: "Movement", sceneLevel: false, fields: [] },
  {
    id: "setVar", label: "Set variable", category: "Variables", sceneLevel: false,
    fields: [
      { key: "scope", label: "scope", type: "scope", default: "self" },
      { key: "name", label: "var", type: "text", default: "score" },
      { key: "op", label: "", type: "op", default: "set" },
      expr("value", "value", 1),
    ],
  },
  { id: "destroy", label: "Destroy", category: "Object", sceneLevel: false, fields: [] },
  {
    id: "spawn", label: "Spawn", category: "Object", sceneLevel: true,
    fields: [actorF("def", "actor"), expr("x", "x", 50), expr("y", "y", 20)],
  },
  {
    id: "setEmoji", label: "Set emoji", category: "Appearance", sceneLevel: false,
    fields: [{ key: "emoji", label: "emoji", type: "emoji", default: "😎" }],
  },
  { id: "hide", label: "Hide", category: "Appearance", sceneLevel: false, fields: [] },
  { id: "show", label: "Show", category: "Appearance", sceneLevel: false, fields: [] },
  {
    id: "setScale", label: "Set scale", category: "Appearance", sceneLevel: false,
    fields: [expr("value", "scale", 1.2)],
  },
  {
    id: "rotate", label: "Rotate by", category: "Appearance", sceneLevel: false,
    fields: [expr("value", "degrees", 15)],
  },
  {
    id: "playSfx", label: "Play sound", category: "Audio", sceneLevel: true,
    fields: [{ key: "sfx", label: "sound", type: "sfx", default: "pop" }],
  },
  {
    id: "shake", label: "Screen shake", category: "FX", sceneLevel: true,
    fields: [expr("value", "amount", 1)],
  },

  /* ---- v2 additions: costumes ---- */
  {
    id: "setCostume", label: "Switch costume", category: "Appearance", sceneLevel: false,
    fields: [{ key: "costume", label: "to", type: "costume", default: "idle" }],
  },
  {
    id: "setCostumeKeep", label: "Switch costume (keep frame)", category: "Appearance", sceneLevel: false,
    fields: [{ key: "costume", label: "to", type: "costume", default: "idle" }],
  },
  { id: "stopAnim", label: "Stop animation", category: "Appearance", sceneLevel: false, fields: [] },
  { id: "playAnim", label: "Play animation", category: "Appearance", sceneLevel: false, fields: [] },
  {
    id: "setFrame", label: "Go to frame", category: "Appearance", sceneLevel: false,
    fields: [expr("value", "frame", 0)],
  },
  {
    id: "setSceneVar", label: "Set scene variable", category: "Variables", sceneLevel: true,
    fields: [
      { key: "name", label: "var", type: "text", default: "score" },
      { key: "op", label: "", type: "op", default: "set" },
      expr("value", "value", 1),
    ],
  },
];

export const BEHAVIOR_SPECS: BehaviorSpec[] = [
  { id: "static", label: "Static", icon: "🧍", fields: [] },
  {
    id: "platformer", label: "Platformer", icon: "🏃",
    fields: [num("speed", "run", 32), num("jump", "jump", 40), num("gravity", "gravity", 72)],
  },
  {
    id: "8direction", label: "8-Direction", icon: "🕹️",
    fields: [num("speed", "speed", 42), num("friction", "friction", 6)],
  },
  {
    id: "physics", label: "Physics", icon: "🪂",
    fields: [num("gravity", "gravity", 60), num("bounce", "bounce", 0.6), num("friction", "friction", 0.4)],
  },
  { id: "dragdrop", label: "Drag & Drop", icon: "✋", fields: [] },
];

export const condSpec = (id: string) => COND_SPECS.find((s) => s.id === id);
export const actionSpec = (id: string) => ACTION_SPECS.find((s) => s.id === id);
export const behaviorSpec = (id: string) => BEHAVIOR_SPECS.find((s) => s.id === id);
