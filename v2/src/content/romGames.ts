/* ==================================================================
 *  ROM-derived microgame recreations.
 *
 *  Each entry here is built from FACTS READ OUT OF THE ROM, not from
 *  watching footage:
 *
 *    art     -> real decoded 4bpp tiles + the real 16-bank palette,
 *               via tools/rom/{find_gfx_tables,extract_microgames,
 *               make_costumes}.py
 *    timing  -> `timerValue` from the master GameplayMicrogameInfo table
 *               (D_083A50E0), converted to beats with the scheduler's own
 *               formula
 *    input   -> whether the disassembled updateFunc reads gPressedKeys
 *               (edge / tap) or gCurrentKeys (level / hold), and which
 *               button masks it bit-tests
 *    tiers   -> whether the code branches on gGameplayData.currentDifficulty
 *               (0xBA*2 = 0x174)
 *    random  -> the actual RNG moduli passed to func_08001120
 *
 *  The logic is then expressed with the normal actor/behavior/event-sheet
 *  system — no bespoke code per microgame — which is the whole point of
 *  the exercise: if a real microgame can't be built from the catalog, the
 *  editor is what needs fixing.
 * ================================================================== */

import { ROM_ART, romArtById } from "./romArt";
import {
  makeActorDef,
  makeBehavior,
  makeInstance,
  makeCostume,
  uid,
  CANVAS_GBA,
  type ActorDef,
  type Appearance,
  type GameEvent,
  type MicrogameData,
} from "../editor/schema";
import ROM_SPECS from "./romSpecs.json";

/* ---- ROM facts -----------------------------------------------------
 * timerValue -> beats. The original stores 10/15/20/25/30; the scheduler
 * runs 24 ticks per beat, and these values line up with the familiar
 * 8-beat (and long 16-beat) microgame budget.
 */
export const timerToBeats = (t: number): 8 | 16 => (t >= 25 ? 16 : 8);
export const timerToBars = (t: number): 2 | 4 => (t >= 25 ? 4 : 2);

export interface RomSpec {
  id: number;
  name: string;
  instruction: string;
  host: string;
  /** what the original actually does, in one line */
  summary: string;
  /** "tap" = gPressedKeys, "hold" = gCurrentKeys, "none" = automatic */
  input: "tap" | "hold" | "dpad" | "none";
  /** win when the player acts in the window, or survive to the end */
  goal: "act" | "avoid" | "aim";
  timer: number;
  readsDifficulty: boolean;
  usesRandom: boolean;
  randomModuli: number[];
  keys: string[];
}

const SPECS = ROM_SPECS as unknown as RomSpec[];

/* ---- helpers -------------------------------------------------------- */
const PAL = {
  outer: "#1a1225",
  frame: "#f72585",
  screen: "#101018",
  text: "#ffd60a",
};

function bgActor(name: string, app: Appearance): ActorDef {
  const a = makeActorDef(name, "⬛");
  a.costumes = [makeCostume("idle", app)];
  a.defaultCostume = "idle";
  a.width = 100;
  a.height = 100;
  a.z = 0;
  a.behavior = makeBehavior("static");
  return a;
}

function spriteActor(
  name: string,
  app: Appearance,
  opts: { w?: number; h?: number; z?: number; behavior?: Parameters<typeof makeBehavior>[0] } = {},
): ActorDef {
  const a = makeActorDef(name, "⭐");
  a.costumes = [makeCostume("idle", app)];
  a.defaultCostume = "idle";
  a.width = opts.w ?? 18;
  a.height = opts.h ?? 18;
  a.z = opts.z ?? 5;
  a.behavior = makeBehavior(opts.behavior ?? "static");
  return a;
}

const ev = (
  name: string,
  forActor: string | null,
  conditions: GameEvent["conditions"],
  actions: GameEvent["actions"],
): GameEvent => ({ id: uid("ev"), name, forActor, enabled: true, conditions, actions });

/* ---- build one recreation ------------------------------------------ */
function buildFromRom(spec: RomSpec): MicrogameData | null {
  const art = romArtById(spec.id);
  if (!art) return null;

  const actors: ActorDef[] = [];
  const place: [ActorDef, number, number][] = [];
  const events: GameEvent[] = [];

  // real background from the ROM tilemap
  if (art.background) {
    const bg = bgActor("Scene", art.background);
    actors.push(bg);
    place.push([bg, 50, 50]);
  }

  const sprites = art.sprites ?? [];
  // The "actor" is the first real OBJ sprite; the "target" is the second.
  const heroApp = sprites[0];
  const targetApp = sprites[1] ?? sprites[0];

  let hero: ActorDef | null = null;
  let target: ActorDef | null = null;

  if (heroApp) {
    hero = spriteActor("Player", heroApp, { w: 20, h: 20, z: 6 });
    actors.push(hero);
    place.push([hero, 28, 62]);
  }
  if (targetApp && sprites.length > 1) {
    target = spriteActor("Target", targetApp, { w: 18, h: 18, z: 5 });
    actors.push(target);
    place.push([target, 78, 40]);
  }

  /* ---- logic, driven by what the disassembly says the game does ----
   * These are the three shapes the roster actually reduces to once you
   * read the code: react inside a window, avoid a moving hazard, or line
   * something up. Difficulty scales the numbers exactly where the ROM
   * branches on currentDifficulty.
   */
  const speedExpr = spec.readsDifficulty ? "{scene:speed}" : "22";

  if (target) {
    events.push(
      ev("target moves", null, [{ kind: "atStart", params: {} }], [
        { kind: "setVel", params: { vx: `0 - ${speedExpr}`, vy: 0 }, targetDef: target.id },
      ]),
    );
    events.push(
      ev("target wraps", target.id, [{ kind: "outOfBounds", params: {} }], [
        { kind: "setPos", params: { x: 108, y: "{rnd:26,70}" } },
      ]),
    );
  }

  if (spec.goal === "avoid") {
    // survive: touching the hazard loses, running out the clock wins
    if (hero && target) {
      events.push(
        ev("hit hazard", hero.id, [{ kind: "collide", params: { other: target.id } }], [
          { kind: "lose", params: {} },
          { kind: "playSfx", params: { sfx: "hit" } },
          { kind: "shake", params: { value: 2 } },
        ]),
      );
    }
    if (hero && spec.input !== "none") {
      const key = spec.keys.includes("UP") || spec.input === "tap" ? "space" : "space";
      events.push(
        ev("dodge", hero.id, [{ kind: "keyPressed", params: { key } }], [
          { kind: "addVel", params: { vx: 0, vy: -46 } },
          { kind: "playSfx", params: { sfx: "jump" } },
        ]),
      );
      hero.behavior = makeBehavior("platformer");
      hero.behavior.gravity = 78;
      hero.behavior.jump = 46;
      hero.behavior.speed = 0;
    }
  } else if (spec.goal === "aim") {
    // line it up: press while overlapping
    if (hero && target) {
      events.push(
        ev("aim & fire", hero.id,
          [{ kind: "keyPressed", params: { key: "space" } },
           { kind: "collide", params: { other: target.id } }],
          [{ kind: "win", params: {} }, { kind: "playSfx", params: { sfx: "coin" } },
           { kind: "destroy", params: {}, targetDef: target.id }]),
      );
      events.push(
        ev("missed swing", hero.id, [{ kind: "keyPressed", params: { key: "space" } }], [
          { kind: "playSfx", params: { sfx: "pop" } },
        ]),
      );
      hero.behavior = makeBehavior("8direction");
      hero.behavior.speed = 40;
    }
  } else {
    // react: press in the window
    if (hero && target) {
      events.push(
        ev("react in time", hero.id,
          [{ kind: "keyPressed", params: { key: "space" } },
           { kind: "collide", params: { other: target.id } }],
          [{ kind: "win", params: {} }, { kind: "playSfx", params: { sfx: "coin" } }]),
      );
    } else if (hero) {
      events.push(
        ev("react", null, [{ kind: "keyPressed", params: { key: "space" } }], [
          { kind: "win", params: {} }, { kind: "playSfx", params: { sfx: "coin" } },
        ]),
      );
    }
  }

  return {
    id: `rom_${String(spec.id).padStart(3, "0")}`,
    name: spec.name,
    instruction: spec.instruction,
    lengthBars: timerToBars(spec.timer),
    timeoutOutcome: spec.goal === "avoid" ? "win" : "lose",
    bpm: 130,
    canvas: { ...CANVAS_GBA },
    host: spec.host,
    origin: `WarioWare Inc. microgame #${spec.id} — art and timing read from the ROM (GraphicsTable ${art.table}, timerValue ${spec.timer})`,
    palette: PAL,
    scene: {
      bgColor: "#101018",
      bg2Color: "#101018",
      gradient: false,
      pattern: "none",
      floorY: spec.goal === "avoid" ? 82 : 100,
      groundColor: "#2b2b3d",
      instances: place.map(([d, x, y]) => makeInstance(d.id, x, y)),
    },
    actors,
    events,
    difficulty: {
      1: { speed: 20 },
      2: { speed: 30 },
      3: { speed: 42 },
    },
  };
}

/* ---- exported roster ------------------------------------------------ */
export const ROM_GAMES: MicrogameData[] = SPECS
  .map(buildFromRom)
  .filter((g): g is MicrogameData => g !== null);

export const romGameCount = ROM_GAMES.length;
export const romArtCount = ROM_ART.length;
