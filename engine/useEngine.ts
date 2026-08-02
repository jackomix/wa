import { useEffect, useRef, useState } from "react";
import { AUDIO } from "./audio";
import type {
  EngineSnapshot,
  InputState,
  Key,
  MgCtx,
  MgRuntime,
  MicrogameDef,
  Phase,
} from "./types";
import { getAllPlayable } from "../editor/library";

/* The engine can be paused (e.g. while the editor is open) and the run can be
 * started/restarted from UI buttons instead of only the keyboard. */
let ACTIVE = true;
export const setEngineActive = (b: boolean) => {
  ACTIVE = b;
};
let startReq = false;
export const requestStart = () => {
  startReq = true;
};
let titleReq = false;
export const requestTitle = () => {
  titleReq = true;
};

/* ------------------------------------------------------------------ */
/*  Tuning                                                             */
/* ------------------------------------------------------------------ */
const BASE_BPM = 118;
const BPM_STEP = 14; // added on each Speed-Up
const MAX_BPM = 230;
const GAMES_PER_SPEEDUP = 4; // every 4 microgames -> Speed Up phase
const MAX_LIVES = 4;

const KEYMAP: Record<string, Key> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  Space: "space",
};

const easeInOut = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/* ------------------------------------------------------------------ */
/*  Mutable engine core (lives in a ref, rendered via snapshots)       */
/* ------------------------------------------------------------------ */
interface Core {
  bpm: number;
  beatClock: number; // continuous global beat counter — NEVER pauses
  nextMetroBeat: number; // next beat to schedule metronome audio for
  audioLive: boolean;
  phase: Phase;
  mg: MgRuntime | null;
  lastGameId: string | null;
  score: number;
  displayScore: number;
  scorePopAt: number;
  lives: number;
  gamesPlayed: number;
  speedLevel: number;
  best: number;
  input: InputState;
  doorSfxPlayed: boolean;
  closeSfxKey: string;
}

function freshCore(): Core {
  return {
    bpm: BASE_BPM,
    beatClock: 0,
    nextMetroBeat: 0,
    audioLive: false,
    phase: { kind: "title", startAtBeat: null },
    mg: null,
    lastGameId: null,
    score: 0,
    displayScore: 0,
    scorePopAt: -99,
    lives: MAX_LIVES,
    gamesPlayed: 0,
    speedLevel: 0,
    best: Number(localStorage.getItem("microMania.best") || 0),
    input: {
      held: new Set(),
      pressed: new Set(),
      pointer: { x: -99, y: -99, down: false, pressed: false },
    },
    doorSfxPlayed: false,
    closeSfxKey: "",
  };
}

function pickGame(c: Core): MicrogameDef {
  // the pool = hand-crafted classic games + every user-made data game
  const pool = getAllPlayable().filter((g) => g.id !== c.lastGameId);
  const def = pool[Math.floor(Math.random() * pool.length)];
  c.lastGameId = def.id;
  return def;
}

/** Spawn the next microgame runtime. Its logic starts running immediately —
 *  exactly one beat before the player gains control (the "0 beat"). */
function spawnMg(c: Core, controlStartBeat: number) {
  const def = pickGame(c);
  const lengthBeats = def.lengthBars * 4;
  c.mg = {
    def,
    s: def.init(),
    outcome: null,
    startBeat: controlStartBeat,
    lengthBeats,
    endBeats: lengthBeats,
  };
  c.doorSfxPlayed = false;
  AUDIO.instruction();
}

function beginRun(c: Core, startBeat: number) {
  c.bpm = BASE_BPM;
  c.score = 0;
  c.displayScore = 0;
  c.lives = MAX_LIVES;
  c.gamesPlayed = 0;
  c.speedLevel = 0;
  c.mg = null;
  c.lastGameId = null;
  c.phase = {
    kind: "interlude",
    startBeat,
    lengthBeats: 8,
    result: "start",
    speedUp: false,
    bpmBumped: false,
    toGameOver: false,
    lostLife: false,
  };
}

function updateMicrogame(c: Core, dt: number, dtBeats: number) {
  const mg = c.mg!;
  const t = c.beatClock - mg.startBeat;
  const closing = t >= mg.endBeats - 1;
  const ctx: MgCtx = {
    dt,
    dtBeats,
    t,
    beat: Math.floor(t),
    beatPhase: c.beatClock - Math.floor(c.beatClock),
    lengthBeats: mg.lengthBeats,
    endBeats: mg.endBeats,
    bpm: c.bpm,
    control: t >= 0 && !closing,
    input: c.input,
    outcome: mg.outcome,
    win: () => {
      if (mg.outcome === null) {
        mg.outcome = "win";
        AUDIO.winJingle();
      }
    },
    lose: () => {
      if (mg.outcome === null) {
        mg.outcome = "lose";
        AUDIO.loseJingle();
      }
    },
  };
  mg.def.update(mg.s, ctx);

  /* --- FRAMERULES: a 4-bar game whose outcome is already decided may exit
     at the halfway (beat 8) or three-quarter (beat 12) checkpoint. The end
     is only ever pulled to a checkpoint whose door-closing beat has not yet
     begun, so the 4/4 flow is never broken. --- */
  if (mg.lengthBeats === 16 && mg.outcome !== null && mg.endBeats === 16) {
    if (t <= 7) mg.endBeats = 8;
    else if (t <= 11) mg.endBeats = 12;
  }
}

/** Finalize the microgame that just ended and open the next interlude. */
function finishMicrogame(c: Core) {
  const mg = c.mg!;
  if (mg.outcome === null) {
    mg.outcome = mg.def.timeoutOutcome;
    if (mg.outcome === "win") AUDIO.winJingle();
    else AUDIO.loseJingle();
  }
  const won = mg.outcome === "win";
  const interludeStart = mg.startBeat + mg.endBeats;
  c.gamesPlayed += 1;
  if (won) c.score += 1;
  else c.lives -= 1;

  if (c.score > c.best) {
    c.best = c.score;
    localStorage.setItem("microMania.best", String(c.best));
  }

  const dead = c.lives <= 0;
  const speedUp = !dead && c.gamesPlayed % GAMES_PER_SPEEDUP === 0 && c.bpm < MAX_BPM;
  c.phase = {
    kind: "interlude",
    startBeat: interludeStart,
    // Speed-Up inserts exactly 2 extra bars (8 beats) into the interlude
    lengthBeats: dead ? 4 : speedUp ? 16 : 8,
    result: won ? "win" : "lose",
    speedUp,
    bpmBumped: false,
    toGameOver: dead,
    lostLife: !won,
  };
  c.mg = null;
  if (dead) AUDIO.gameOver();
}

/* ------------------------------------------------------------------ */
/*  Main tick                                                          */
/* ------------------------------------------------------------------ */
function tick(c: Core, dt: number) {
  if (!ACTIVE) return; // paused while the editor is open
  if (titleReq) {
    // bail back to the title screen from anywhere
    titleReq = false;
    c.phase = { kind: "title", startAtBeat: null };
    c.mg = null;
    c.bpm = BASE_BPM;
    c.audioLive = false;
    return;
  }
  const dtBeats = (dt * c.bpm) / 60;
  c.beatClock += dtBeats;

  /* ---- sample-accurate metronome via lookahead scheduling ---- */
  if (c.audioLive && AUDIO.ctx) {
    const secPerBeat = 60 / c.bpm;
    for (let guard = 0; guard < 8; guard++) {
      const beatsAhead = c.nextMetroBeat - c.beatClock;
      const at = AUDIO.now + beatsAhead * secPerBeat;
      if (at > AUDIO.now + 0.16) break;
      AUDIO.metroTick(Math.max(at, AUDIO.now + 0.001), c.nextMetroBeat);
      c.nextMetroBeat += 1;
    }
  }

  const p = c.phase;

  if (p.kind === "title") {
    if ((c.input.pressed.has("space") || startReq) && p.startAtBeat === null) {
      startReq = false;
      // quantize the run start to the next whole bar — the metronome never pauses
      p.startAtBeat = Math.ceil((c.beatClock + 0.05) / 4) * 4;
      AUDIO.coin();
    }
    if (p.startAtBeat !== null && c.beatClock >= p.startAtBeat) {
      beginRun(c, p.startAtBeat);
    }
  } else if (p.kind === "interlude") {
    const local = c.beatClock - p.startBeat;
    const prevLocal = local - dtBeats;
    const L = p.lengthBeats;

    // Game-over lead-in: play Bar 1 (result) then drop to game over, on the bar.
    if (p.toGameOver) {
      if (local >= 4) {
        c.phase = { kind: "gameover", startBeat: p.startBeat + 4, restartAtBeat: null };
      }
      return postTick(c);
    }

    // Score tick-up lands on the first beat of Bar 2
    if (p.result === "win" && prevLocal < 4 && local >= 4 && c.displayScore < c.score) {
      c.displayScore = c.score;
      c.scorePopAt = c.beatClock;
      AUDIO.coin();
    }
    if (p.result !== "win") c.displayScore = c.score;

    // Speed-Up: BPM bumps exactly on the downbeat of Bar 3
    if (p.speedUp && !p.bpmBumped && local >= 8) {
      p.bpmBumped = true;
      c.speedLevel += 1;
      c.bpm = Math.min(MAX_BPM, c.bpm + BPM_STEP);
      AUDIO.speedUp(c.speedLevel);
    }

    // Final beat of the interlude: instruction appears, doors open,
    // and the microgame's logic starts running NOW (its t = -1 .. 0).
    if (!c.mg && local >= L - 1) {
      spawnMg(c, p.startBeat + L);
    }
    if (c.mg) {
      if (!c.doorSfxPlayed) {
        c.doorSfxPlayed = true;
        AUDIO.doorMove();
      }
      updateMicrogame(c, dt, dtBeats);
    }
    // Hand off exactly on the beat: player gains control at mg t = 0.
    if (local >= L) c.phase = { kind: "microgame" };
  } else if (p.kind === "microgame") {
    const mg = c.mg!;
    updateMicrogame(c, dt, dtBeats);
    const t = c.beatClock - mg.startBeat;
    // door-close sfx at the top of the final beat
    if (t >= mg.endBeats - 1) {
      const key = `${mg.startBeat}:${mg.endBeats}`;
      if (c.closeSfxKey !== key) {
        c.closeSfxKey = key;
        AUDIO.doorMove();
      }
    }
    if (t >= mg.endBeats) finishMicrogame(c);
  } else if (p.kind === "gameover") {
    if (c.input.pressed.has("space") && p.restartAtBeat === null) {
      p.restartAtBeat = Math.ceil((c.beatClock + 0.05) / 4) * 4;
      AUDIO.coin();
    }
    if (p.restartAtBeat !== null && c.beatClock >= p.restartAtBeat) {
      beginRun(c, p.restartAtBeat);
    }
  }

  postTick(c);
}

function postTick(c: Core) {
  c.input.pressed.clear();
}

/* ------------------------------------------------------------------ */
/*  Snapshot for rendering                                             */
/* ------------------------------------------------------------------ */
function snapshot(c: Core): EngineSnapshot {
  const p = c.phase;
  let doorOpen = 0;
  let instruction: string | null = null;
  let instructionAge = 0;

  if (p.kind === "interlude" && c.mg) {
    const local = c.beatClock - p.startBeat;
    doorOpen = easeInOut(local - (p.lengthBeats - 1));
    instruction = c.mg.def.instruction;
    instructionAge = local - (p.lengthBeats - 1);
  } else if (p.kind === "microgame" && c.mg) {
    const t = c.beatClock - c.mg.startBeat;
    doorOpen = t >= c.mg.endBeats - 1 ? 1 - easeInOut(t - (c.mg.endBeats - 1)) : 1;
    if (t < 2) {
      instruction = c.mg.def.instruction;
      instructionAge = t + 1;
    }
  }

  return {
    bpm: c.bpm,
    beatClock: c.beatClock,
    beatPhase: c.beatClock - Math.floor(c.beatClock),
    barBeat: ((Math.floor(c.beatClock) % 4) + 4) % 4,
    phase: p,
    mg: c.mg,
    score: c.score,
    displayScore: c.displayScore,
    scorePopAt: c.scorePopAt,
    lives: c.lives,
    maxLives: MAX_LIVES,
    gamesPlayed: c.gamesPlayed,
    speedLevel: c.speedLevel,
    best: c.best,
    doorOpen,
    instruction,
    instructionAge,
  };
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */
export function useEngine(): { snap: EngineSnapshot; input: InputState } {
  const coreRef = useRef<Core | null>(null);
  if (!coreRef.current) coreRef.current = freshCore();
  const [, setFrame] = useState(0);
  const snapRef = useRef<EngineSnapshot>(snapshot(coreRef.current));

  useEffect(() => {
    const c = coreRef.current!;

    const down = (e: KeyboardEvent) => {
      const k = KEYMAP[e.code];
      if (!k || !ACTIVE) return; // input is strictly arrows + space (ignored while editor open)
      e.preventDefault();
      AUDIO.unlock();
      c.audioLive = !!AUDIO.ctx;
      if (c.audioLive && c.nextMetroBeat < c.beatClock) {
        c.nextMetroBeat = Math.ceil(c.beatClock);
      }
      if (!e.repeat) {
        c.input.pressed.add(k);
        c.input.held.add(k);
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = KEYMAP[e.code];
      if (!k) return;
      e.preventDefault();
      c.input.held.delete(k);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    // pointer mapped to the letterboxed game screen (for Drag & Drop games)
    const mapPointer = (e: MouseEvent) => {
      const el = document.querySelector("[data-gamescreen]") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      c.input.pointer.x = Math.max(-20, Math.min(120, x));
      c.input.pointer.y = Math.max(-20, Math.min(120, y));
    };
    const mmove = (e: MouseEvent) => mapPointer(e);
    const mdown = (e: MouseEvent) => {
      if (!ACTIVE) return;
      mapPointer(e);
      c.input.pointer.down = true;
      c.input.pointer.pressed = true;
    };
    const mup = () => {
      c.input.pointer.down = false;
    };
    window.addEventListener("mousemove", mmove);
    window.addEventListener("mousedown", mdown);
    window.addEventListener("mouseup", mup);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); // clamp: rhythm survives tab hitches
      last = now;
      tick(c, dt);
      snapRef.current = snapshot(c);
      setFrame((f) => f + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("mousemove", mmove);
      window.removeEventListener("mousedown", mdown);
      window.removeEventListener("mouseup", mup);
    };
  }, []);

  return { snap: snapRef.current, input: coreRef.current.input };
}
