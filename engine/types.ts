import type React from "react";

/** Input keys allowed: arrows + space. Nothing else. */
export type Key = "left" | "right" | "up" | "down" | "space";

export interface InputState {
  held: Set<Key>;
  /** keys pressed this frame (cleared after each engine tick) */
  pressed: Set<Key>;
  /** pointer (mouse) mapped to the 0..100 game screen; enables Drag & Drop
   *  and click conditions in custom microgames */
  pointer: { x: number; y: number; down: boolean; pressed: boolean };
}

export type Outcome = "win" | "lose" | null;

/** Context passed to a microgame's update() every frame. All time is measured in BEATS. */
export interface MgCtx {
  /** delta time in seconds */
  dt: number;
  /** delta time in beats */
  dtBeats: number;
  /** local time in beats. Starts at -1 (the "0 beat" pre-roll while doors open). */
  t: number;
  /** floor(t) */
  beat: number;
  /** global beat phase 0..1 (for pulsing idle animations) */
  beatPhase: number;
  /** nominal length in beats (8 or 16) */
  lengthBeats: number;
  /** effective end in beats (may be shortened at an internal checkpoint) */
  endBeats: number;
  bpm: number;
  /** true only when the player has control (t >= 0 and doors not closing) */
  control: boolean;
  input: InputState;
  outcome: Outcome;
  win: () => void;
  lose: () => void;
}

/** Context passed to a microgame's View component. */
export interface ViewCtx {
  t: number;
  beat: number;
  beatPhase: number;
  outcome: Outcome;
  lengthBeats: number;
  endBeats: number;
  control: boolean;
}

export interface MicrogamePalette {
  /** color of the letterbox area around the game screen */
  outer: string;
  /** color of the thick frame border */
  frame: string;
  /** game screen background */
  screen: string;
  /** instruction text color */
  text: string;
}

export interface MicrogameDef {
  id: string;
  /** authored logical canvas; defaults to the native GBA frame for classic scenes */
  canvas?: { width: number; height: number; label: string; activeX: number; activeY: number; activeWidth: number; activeHeight: number };
  /** imperative command, e.g. "JUMP!" */
  instruction: string;
  lengthBars: 2 | 4;
  /** outcome applied if nothing was decided when time runs out */
  timeoutOutcome: "win" | "lose";
  palette: MicrogamePalette;
  init: () => any;
  update: (s: any, ctx: MgCtx) => void;
  View: React.FC<{ s: any; v: ViewCtx }>;
}

/** A live microgame instance owned by the engine. */
export interface MgRuntime {
  def: MicrogameDef;
  s: any;
  outcome: Outcome;
  /** absolute beat at which the player gains control (t = 0) */
  startBeat: number;
  lengthBeats: number;
  /** effective end (internal checkpoint may pull this to 8, 12, or 16) */
  endBeats: number;
}

export type InterludeResult = "start" | "win" | "lose";

export type Phase =
  | { kind: "title"; startAtBeat: number | null }
  | {
      kind: "interlude";
      startBeat: number;
      lengthBeats: number; // 8 normally, 16 when a Speed-Up is inserted
      result: InterludeResult;
      speedUp: boolean;
      bpmBumped: boolean;
      toGameOver: boolean;
      lostLife: boolean;
    }
  | { kind: "microgame" }
  | { kind: "gameover"; startBeat: number; restartAtBeat: number | null }
  | { kind: "stage_intro"; startBeat: number; stageId: string };

export interface EngineSnapshot {
  bpm: number;
  beatClock: number;
  beatPhase: number;
  barBeat: number; // 0..3, position inside the global 4/4 bar
  phase: Phase;
  mg: MgRuntime | null;
  score: number;
  displayScore: number;
  scorePopAt: number;
  lives: number;
  maxLives: number;
  gamesPlayed: number;
  speedLevel: number;
  best: number;
  /** 0 = doors fully closed, 1 = fully open */
  doorOpen: number;
  /** instruction text currently displayed (or null) */
  instruction: string | null;
  instructionAge: number; // beats since instruction appeared
  /** current stage ID (e.g. 'intro', 'sports', etc.) */
  currentStage: string | null;
}
