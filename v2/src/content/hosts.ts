/* ==================================================================
 *  Hosts / stages.
 *
 *  Structure and tempi taken from the original: each host owns a themed
 *  set, the set speeds up twice at fixed score thresholds, and a boss
 *  microgame closes it out (clearing the boss returns a lost life, up to
 *  the cap of 4).
 *
 *  Stage roster confirmed against include/levels.h in the decompilation:
 *    STAGE_INTRODUCTION, STAGE_JIMMY, STAGE_9_VOLT, STAGE_DRIBBLE,
 *    STAGE_KAT, STAGE_MONA, STAGE_DR_CRYGOR, STAGE_ORBULON, STAGE_WARIO,
 *    STAGE_JIMMY_REMIX_1/2, ...
 *
 *  Genre labels are the ones the game itself uses for each set.
 * ================================================================== */

export interface HostDef {
  id: string;
  name: string;
  /** the genre label the original gives this set */
  genre: string;
  blurb: string;
  primary: string;
  secondary: string;
  accent: string;
  /** starting script tempo in BPM */
  tempo: number;
  /** score thresholds at which the set speeds up (the original ramps twice) */
  speedUps: [number, number];
  /** microgame ids in this pool */
  pool: string[];
  /** boss microgame id */
  boss: string;
}

export const HOSTS: HostDef[] = [
  {
    id: "wario",
    name: "Wario",
    genre: "Introduction",
    blurb: "The basics, delivered by a man with no manners. One button, one idea, no mercy.",
    primary: "#ffd60a",
    secondary: "#7b2ff7",
    accent: "#ff4d6d",
    tempo: 124,
    speedUps: [3, 6],
    pool: ["ww_nose", "ww_jump_rope", "ww_dodge_car", "ww_sole_man", "ww_hurdle", "ww_bee_catch"],
    boss: "ww_boss_hammer",
  },
  {
    id: "jimmy",
    name: "Jimmy T.",
    genre: "Anything Goes",
    blurb: "Sports, chores, animals, whatever fell out of the disco. No theme is the theme.",
    primary: "#f72585",
    secondary: "#4361ee",
    accent: "#4cc9f0",
    tempo: 128,
    speedUps: [4, 8],
    pool: ["ww_tennis", "ww_dog_catch", "ww_sweep", "ww_bowling", "ww_umbrella", "ww_teeth"],
    boss: "ww_boss_dance",
  },
  {
    id: "ninevolt",
    name: "9-Volt",
    genre: "Nintendo Classics",
    blurb: "Retro homework. Everything here is a five-second quotation of something older.",
    primary: "#4cc9f0",
    secondary: "#e63946",
    accent: "#ffd60a",
    tempo: 132,
    speedUps: [4, 8],
    pool: ["ww_mario_stomp", "ww_duck_shot", "ww_balloon_fight", "ww_zelda_slash", "ww_dk_barrel"],
    boss: "ww_boss_metroid",
  },
  {
    id: "mona",
    name: "Mona",
    genre: "Strange",
    blurb: "Scooter-powered nonsense. Cheerful, fast, and slightly wrong.",
    primary: "#ff70a6",
    secondary: "#ff9770",
    accent: "#ffd670",
    tempo: 130,
    speedUps: [4, 8],
    pool: ["ww_pizza", "ww_monkey", "ww_stamp", "ww_slice", "ww_hair"],
    boss: "ww_boss_scooter",
  },
  {
    id: "dribble",
    name: "Dribble & Spitz",
    genre: "Sci-Fi",
    blurb: "Two cabbies who mostly drive through space. Lasers, saucers, escaping.",
    primary: "#7b2ff7",
    secondary: "#00f5d4",
    accent: "#f15bb5",
    tempo: 130,
    speedUps: [4, 8],
    pool: ["ww_ufo_zap", "ww_asteroid", "ww_rocket_fuel", "ww_alien_grab", "ww_warp"],
    boss: "ww_boss_saucer",
  },
  {
    id: "kat",
    name: "Kat & Ana",
    genre: "Nature",
    blurb: "Tiny ninjas versus the natural world. Mostly the natural world loses.",
    primary: "#9ef01a",
    secondary: "#38b000",
    accent: "#ff4d6d",
    tempo: 134,
    speedUps: [4, 8],
    pool: ["ww_fly_swat", "ww_water_plant", "ww_egg_catch", "ww_leaf_cut", "ww_frog"],
    boss: "ww_boss_dojo",
  },
  {
    id: "crygor",
    name: "Dr. Crygor",
    genre: "Reality",
    blurb: "Lab-coat physics. Levers, dials, and things that must not be dropped.",
    primary: "#00b4d8",
    secondary: "#90e0ef",
    accent: "#ffb703",
    tempo: 132,
    speedUps: [4, 8],
    pool: ["ww_test_tube", "ww_gear", "ww_magnet", "ww_balance", "ww_wire"],
    boss: "ww_boss_reactor",
  },
  {
    id: "orbulon",
    name: "Orbulon",
    genre: "I.Q.",
    blurb: "The thinking set. Slower on the surface, and then it is not.",
    primary: "#b5179e",
    secondary: "#560bad",
    accent: "#4cc9f0",
    tempo: 120,
    speedUps: [4, 8],
    pool: ["ww_shape_fit", "ww_count", "ww_memory", "ww_sort", "ww_maze"],
    boss: "ww_boss_puzzle",
  },
  {
    id: "jimmyremix",
    name: "Jimmy T. Remix",
    genre: "Mixed Bag",
    blurb: "Everything, shuffled, faster. The victory lap that fights back.",
    primary: "#ffbe0b",
    secondary: "#fb5607",
    accent: "#8338ec",
    tempo: 140,
    speedUps: [5, 10],
    pool: [
      "ww_nose", "ww_tennis", "ww_mario_stomp", "ww_pizza", "ww_ufo_zap",
      "ww_fly_swat", "ww_test_tube", "ww_shape_fit", "ww_dodge_car", "ww_duck_shot",
    ],
    boss: "ww_boss_hammer",
  },
];

export const hostById = (id: string) => HOSTS.find((h) => h.id === id);
