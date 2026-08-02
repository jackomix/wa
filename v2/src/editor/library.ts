import { MICROGAMES } from "../microgames";
import { ROM_GAMES } from "../content/romGames";
import { compileMicrogame } from "./runtime";
import {
  makeActorDef,
  makeBehavior,
  makeInstance,
  uid,
  type MicrogameData,
} from "./schema";
import type { MicrogameDef } from "../engine/types";

/* ================================================================== */
/*  Storage + dynamic pool                                             */
/* ================================================================== */
const STORE = "microMania.library.v1";
let cache: MicrogameData[] | null = null;
const listeners = new Set<() => void>();

export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

function persist() {
  try {
    localStorage.setItem(STORE, JSON.stringify(cache));
  } catch {
    /* ignore quota */
  }
  listeners.forEach((fn) => fn());
}

function load(): MicrogameData[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORE);
    cache = raw ? (JSON.parse(raw) as MicrogameData[]) : null;
  } catch {
    cache = null;
  }
  if (!cache || !cache.length) {
    cache = PRESETS.map(clone);
    persist();
  }
  return cache!;
}

/** every playable microgame = ROM recreations + hand-crafted + user games */
export function getAllPlayable(): MicrogameDef[] {
  return [
    // Recreations built from the real ROM: decoded art, real palettes,
    // timing taken from the master microgame table.
    ...ROM_GAMES.map(compileMicrogame),
    ...MICROGAMES,
    ...load().map(compileMicrogame),
  ];
}

/** just the ROM-derived recreations, for the library's "Originals" tab */
export function getRomGames(): MicrogameData[] {
  return ROM_GAMES.map(clone);
}

export function getDataGames(): MicrogameData[] {
  return load().map(clone);
}

export function upsertDataGame(data: MicrogameData) {
  const arr = load();
  const i = arr.findIndex((g) => g.id === data.id);
  if (i >= 0) arr[i] = clone(data);
  else arr.push(clone(data));
  persist();
}

export function deleteDataGame(id: string) {
  cache = load().filter((g) => g.id !== id);
  persist();
}

export function duplicateDataGame(id: string): MicrogameData {
  const src = load().find((g) => g.id === id);
  if (!src) return blankGame();
  const copy = clone(src);
  copy.id = uid("game");
  copy.name = src.name + " copy";
  load().push(copy);
  persist();
  return copy;
}

/* ================================================================== */
/*  Export / import                                                    */
/* ================================================================== */
export function encodeGame(d: MicrogameData): string {
  const json = JSON.stringify(d);
  return "MM1:" + btoa(unescape(encodeURIComponent(json)));
}

export function decodeGame(code: string): MicrogameData | null {
  try {
    let s = code.trim();
    const json = s.startsWith("MM1:")
      ? decodeURIComponent(escape(atob(s.slice(4))))
      : s;
    const d = JSON.parse(json);
    if (!d || !d.scene || !Array.isArray(d.actors) || !Array.isArray(d.events)) return null;
    if (!d.id) d.id = uid("game");
    return d as MicrogameData;
  } catch {
    return null;
  }
}

/* ================================================================== */
/*  Blank game + presets (editable examples)                           */
/* ================================================================== */
export function blankGame(): MicrogameData {
  const player = makeActorDef("Player", "😀");
  player.behavior = makeBehavior("8direction");
  player.z = 5;
  return {
    id: uid("game"),
    name: "My Microgame",
    instruction: "DO IT!",
    lengthBars: 2,
    timeoutOutcome: "lose",
    bpm: 124,
    palette: { outer: "#1b1b2f", frame: "#e94560", screen: "#16213e", text: "#e94560" },
    scene: {
      bgColor: "#16213e",
      bg2Color: "#0f3460",
      gradient: true,
      pattern: "stars",
      floorY: 100,
      groundColor: "#533483",
      instances: [makeInstance(player.id, 50, 50)],
    },
    actors: [player],
    events: [],
  };
}

const PAL = {
  sunset: { outer: "#2b1d4f", frame: "#ffb703", screen: "#8ecae6", text: "#ffb703" },
  night: { outer: "#10002b", frame: "#9ef01a", screen: "#240046", text: "#9ef01a" },
  grass: { outer: "#1b3a2f", frame: "#ff6b35", screen: "#90e0ef", text: "#ff6b35" },
  candy: { outer: "#5a189a", frame: "#ff70a6", screen: "#fff3b0", text: "#ff70a6" },
};

const PRESETS: MicrogameData[] = [];

/* ---- Preset 1: HOP! (platformer + reach the goal) ---------------- */
{
  const player = makeActorDef("Hero", "🐰");
  player.behavior = makeBehavior("platformer");
  player.z = 5;
  const spike = makeActorDef("Spike", "⚡");
  spike.solid = false;
  spike.z = 2;
  const goal = makeActorDef("Goal", "🏁");
  goal.z = 1;
  PRESETS.push({
    id: "preset_hop",
    name: "HOP!",
    instruction: "REACH THE FLAG!",
    lengthBars: 2,
    timeoutOutcome: "lose",
    bpm: 128,
    palette: PAL.grass,
    scene: {
      bgColor: "#90e0ef",
      bg2Color: "#caf0f8",
      gradient: true,
      pattern: "dots",
      floorY: 86,
      groundColor: "#52b788",
      instances: [
        makeInstance(player.id, 16, 78),
        makeInstance(spike.id, 52, 80),
        makeInstance(goal.id, 86, 78),
      ],
    },
    actors: [player, spike, goal],
    events: [
      {
        id: uid("ev"), name: "reach goal", forActor: player.id, enabled: true,
        conditions: [{ kind: "inArea", params: { x: 80, y: 0, w: 20, h: 100 } }],
        actions: [{ kind: "win", params: {} }],
      },
      {
        id: uid("ev"), name: "hit spike", forActor: player.id, enabled: true,
        conditions: [{ kind: "collide", params: { other: spike.id } }],
        actions: [{ kind: "lose", params: {} }, { kind: "playSfx", params: { sfx: "hit" } }],
      },
      {
        id: uid("ev"), name: "run hint", forActor: null, enabled: true,
        conditions: [{ kind: "atStart", params: {} }],
        actions: [{ kind: "setVel", params: { vx: 0, vy: 0 } }],
      },
    ],
  });
}

/* ---- Preset 2: BOUNCY CATCH (8-dir player + physics ball) --------- */
{
  const bowl = makeActorDef("Bowl", "🧺");
  bowl.behavior = makeBehavior("8direction");
  bowl.z = 5;
  const ball = makeActorDef("Ball", "⚽");
  ball.behavior = makeBehavior("physics");
  ball.behavior.gravity = 46;
  ball.behavior.bounce = 0.78;
  ball.z = 3;
  PRESETS.push({
    id: "preset_catch",
    name: "BOUNCY CATCH!",
    instruction: "CATCH IT!",
    lengthBars: 2,
    timeoutOutcome: "lose",
    bpm: 126,
    palette: PAL.candy,
    scene: {
      bgColor: "#fff3b0",
      bg2Color: "#ffe5ec",
      gradient: true,
      pattern: "none",
      floorY: 88,
      groundColor: "#ffb4a2",
      instances: [makeInstance(bowl.id, 50, 78), makeInstance(ball.id, 30, 16)],
    },
    actors: [bowl, ball],
    events: [
      {
        id: uid("ev"), name: "drop the ball", forActor: null, enabled: true,
        conditions: [{ kind: "atStart", params: {} }],
        actions: [
          { kind: "addVel", params: { vx: 8, vy: 0 }, targetDef: ball.id },
          { kind: "playSfx", params: { sfx: "pop" } },
        ],
      },
      {
        id: uid("ev"), name: "catch", forActor: bowl.id, enabled: true,
        conditions: [{ kind: "collide", params: { other: ball.id } }],
        actions: [{ kind: "win", params: {} }, { kind: "playSfx", params: { sfx: "coin" } }],
      },
    ],
  });
}

/* ---- Preset 3: METEOR STORM (spawn every beat + survive) --------- */
{
  const ship = makeActorDef("Ship", "🚀");
  ship.behavior = makeBehavior("8direction");
  ship.z = 5;
  const rock = makeActorDef("Meteor", "☄️");
  rock.behavior = makeBehavior("physics");
  rock.behavior.gravity = 26;
  rock.behavior.friction = 0;
  rock.z = 2;
  PRESETS.push({
    id: "preset_meteor",
    name: "METEOR STORM!",
    instruction: "SURVIVE!",
    lengthBars: 2,
    timeoutOutcome: "win",
    bpm: 130,
    palette: PAL.night,
    scene: {
      bgColor: "#240046",
      bg2Color: "#10002b",
      gradient: true,
      pattern: "stars",
      floorY: 100,
      groundColor: "#3c096c",
      instances: [makeInstance(ship.id, 50, 70)],
    },
    actors: [ship, rock],
    events: [
      {
        id: uid("ev"), name: "spawn meteors", forActor: null, enabled: true,
        conditions: [{ kind: "everyBeats", params: { beats: 1 } }],
        actions: [
          { kind: "spawn", params: { def: rock.id, x: "{rnd:8,92}", y: 6 } },
          { kind: "playSfx", params: { sfx: "shoot" } },
        ],
      },
      {
        id: uid("ev"), name: "hit", forActor: ship.id, enabled: true,
        conditions: [{ kind: "collide", params: { other: "any" } }],
        actions: [{ kind: "lose", params: {} }, { kind: "shake", params: { value: 1.2 } }, { kind: "playSfx", params: { sfx: "boom" } }],
      },
    ],
  });
}

/* ---- Preset 4: DROP ZONE (drag & drop into the goal) ------------- */
{
  const crate = makeActorDef("Crate", "📦");
  crate.behavior = makeBehavior("dragdrop");
  crate.z = 5;
  const zone = makeActorDef("Goal", "🎯");
  zone.z = 1;
  PRESETS.push({
    id: "preset_drop",
    name: "DROP ZONE!",
    instruction: "DRAG IT IN!",
    lengthBars: 2,
    timeoutOutcome: "lose",
    bpm: 124,
    palette: PAL.sunset,
    scene: {
      bgColor: "#8ecae6",
      bg2Color: "#219ebc",
      gradient: true,
      pattern: "grid",
      floorY: 100,
      groundColor: "#ffb703",
      instances: [makeInstance(crate.id, 25, 30), makeInstance(zone.id, 75, 70)],
    },
    actors: [crate, zone],
    events: [
      {
        id: uid("ev"), name: "in the zone", forActor: crate.id, enabled: true,
        conditions: [
          { kind: "inArea", params: { x: 64, y: 60, w: 22, h: 22 } },
          { kind: "pointerDown", params: {} },
        ],
        actions: [{ kind: "win", params: {} }, { kind: "playSfx", params: { sfx: "coin" } }],
      },
    ],
  });
}

/* ---- Preset 5: TAP ATTACK (rhythm: press on the beat) ----------- */
{
  const target = makeActorDef("Target", "🟢");
  target.behavior = makeBehavior("static");
  target.z = 3;
  const dancer = makeActorDef("Dancer", "🤖");
  dancer.behavior = makeBehavior("static");
  dancer.z = 5;
  PRESETS.push({
    id: "preset_tap",
    name: "TAP ATTACK!",
    instruction: "TAP ON BEAT!",
    lengthBars: 2,
    timeoutOutcome: "lose",
    bpm: 124,
    palette: PAL.candy,
    scene: {
      bgColor: "#5a189a",
      bg2Color: "#240046",
      gradient: true,
      pattern: "dots",
      floorY: 100,
      groundColor: "#3c096c",
      instances: [makeInstance(target.id, 50, 40), makeInstance(dancer.id, 50, 75)],
    },
    actors: [target, dancer],
    events: [
      {
        id: uid("ev"), name: "hit on beat", forActor: null, enabled: true,
        conditions: [{ kind: "keyPressed", params: { key: "space" } }],
        actions: [
          { kind: "setEmoji", params: { emoji: "💥" }, targetDef: target.id },
          { kind: "win", params: {} },
          { kind: "playSfx", params: { sfx: "pop" } },
        ],
      },
      {
        id: uid("ev"), name: "reset target", forActor: null, enabled: true,
        conditions: [{ kind: "keyReleased", params: { key: "space" } }],
        actions: [{ kind: "setEmoji", params: { emoji: "🟢" }, targetDef: target.id }],
      },
    ],
  });
}
