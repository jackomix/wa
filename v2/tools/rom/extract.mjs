/* ==================================================================
 *  ROM ground-truth extractor
 *
 *  Reads the WarioWare, Inc. GBA ROM in the repo root and pulls out the
 *  facts that inform the recreations. Verifies the ROM identity first so
 *  the numbers below can be trusted.
 *
 *  Cross-checked against the ShaffySwitcher/wariowareinc decompilation,
 *  whose baserom target is this exact SHA-1.
 *
 *  Run: node tools/rom/extract.mjs
 * ================================================================== */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const ROM = join(ROOT, "WarioWare, Inc. - Mega Microgame$!.gba");
const OUT = join(ROOT, "docs", "rom-findings.json");

const EXPECT_SHA1 = "3f556448d290fa5406d6ed367fee16cc02387ad3";

const rom = readFileSync(ROM);
const sha1 = createHash("sha1").update(rom).digest("hex");
const md5 = createHash("md5").update(rom).digest("hex");

const ascii = (off, len) => rom.subarray(off, off + len).toString("ascii").replace(/\0+$/, "");

const header = {
  title: ascii(0xa0, 12),
  gameCode: ascii(0xac, 4),
  makerCode: ascii(0xb0, 2),
  version: rom[0xbc],
  sizeBytes: rom.length,
  md5,
  sha1,
  sha1Matches: sha1 === EXPECT_SHA1,
};

console.log("ROM header");
for (const [k, v] of Object.entries(header)) console.log(`  ${k.padEnd(13)} ${v}`);
if (!header.sha1MatchesEXPECT && !header.sha1Matches) {
  console.warn("\n  ! SHA-1 does not match the decompilation's baserom target.");
}

/* ---- string mining ------------------------------------------------
 * The audio driver keeps its sequence/sample names as plain C strings.
 * They are the most legible index into what content the ROM contains,
 * because each microgame's SFX are prefixed consistently.
 * ------------------------------------------------------------------ */
const strings = [];
{
  let cur = [];
  let start = 0;
  for (let i = 0; i < rom.length; i++) {
    const b = rom[i];
    if (b >= 0x20 && b < 0x7f) {
      if (!cur.length) start = i;
      cur.push(b);
    } else {
      if (cur.length >= 4) strings.push({ off: start, s: Buffer.from(cur).toString("ascii") });
      cur = [];
    }
  }
}

const seqNames = strings.filter((x) => /^(m_|s_|x_)/.test(x.s)).map((x) => x.s);
const bgm = seqNames.filter((s) => s.startsWith("m_BGM"));
const sfx = seqNames.filter((s) => s.startsWith("s_"));

/* Group the BOMB_* SFX by their second token — in the original's naming,
   "BOMB" is the microgame layer, so the next token usually names the
   microgame or its central prop. */
const bombTokens = {};
for (const s of sfx) {
  const m = /^s_BOMB_([A-Za-z0-9]+)/.exec(s);
  if (m) bombTokens[m[1]] = (bombTokens[m[1]] ?? 0) + 1;
}

/* Host/stage BGM prefixes reveal the stage roster. */
const stageHints = {};
for (const s of bgm) {
  const m = /^m_BGM_([A-Za-z0-9]+)_/.exec(s);
  if (m) stageHints[m[1]] = (stageHints[m[1]] ?? 0) + 1;
}

/* ---- timing model (from the decompilation, verified arithmetically) --- */
const TICKS_PER_BEAT = 24;   // every .bs script rests in multiples of 24
const DELTA_DIV = 150;       // deltaTime = (tempo << 8) / 150
const FPS = 59.7275;         // GBA vblank

const timing = {
  note:
    "set_beatscript_tempo(): speed = tempo<<8; speed /= musicBaseBPM; " +
    "deltaTime = musicBaseBPM * speed / 150  ==  (tempo<<8)/150. " +
    "`rest N` stores N<<8 and is decremented by deltaTime each frame.",
  ticksPerBeat: TICKS_PER_BEAT,
  deltaDivisor: DELTA_DIV,
  formulaFramesPerBeat: "3600 / tempo",
  table: [100, 120, 140, 160, 180, 200, 220].map((tempo) => {
    const deltaQ = Math.floor((tempo * 256) / DELTA_DIV);
    const framesPerBeat = ((TICKS_PER_BEAT * 256) / deltaQ);
    return {
      tempo,
      deltaTimeQ24_8: deltaQ,
      framesPerBeat: +framesPerBeat.toFixed(3),
      secondsPerBeat: +(framesPerBeat / FPS).toFixed(4),
      microgameSeconds8Beats: +((framesPerBeat * 8) / FPS).toFixed(3),
      bossSeconds16Beats: +((framesPerBeat * 16) / FPS).toFixed(3),
    };
  }),
};

const findings = {
  generatedBy: "tools/rom/extract.mjs",
  header,
  decompilation: {
    repo: "ShaffySwitcher/wariowareinc",
    baseromSha1: EXPECT_SHA1,
    matchesOurRom: header.sha1Matches,
  },
  constants: {
    MAX_LIVES: 4,
    MAX_SCORE: 999,
    beatscriptThreads: 2,
    saveMicrogameFlagBytes: 0x100,
    menuIteratesMicrogameIds: 226,
    note: "MAX_LIVES/MAX_SCORE from src/scenes/gameplay.h; thread count from struct BeatscriptScene.",
  },
  timing,
  collision: {
    note:
      "gameplay_check_collision() is four early-out AABB comparisons, no radius and no slop. " +
      "Hit windows are tight; a friendlier rounded test makes recreations feel wrong.",
    pseudo: [
      "if (ax >= bx + bw) return false;",
      "if (bx >= ax + aw) return false;",
      "if (ay >= by + bh) return false;",
      "if (by >= ay + ah) return false;",
      "return true;",
    ],
  },
  audio: {
    totalSequenceNames: seqNames.length,
    bgmCount: bgm.length,
    sfxCount: sfx.length,
    stageBgmPrefixes: Object.fromEntries(
      Object.entries(stageHints).sort((a, b) => b[1] - a[1]).slice(0, 40),
    ),
    microgameSfxTokens: Object.fromEntries(
      Object.entries(bombTokens).sort((a, b) => b[1] - a[1]),
    ),
  },
  samples: {
    bgmExamples: bgm.slice(0, 40),
    sfxExamples: sfx.filter((s) => s.startsWith("s_BOMB_")).slice(0, 60),
  },
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(findings, null, 2));

console.log(`\naudio strings: ${seqNames.length} (${bgm.length} BGM, ${sfx.length} SFX)`);
console.log(`distinct microgame SFX tokens: ${Object.keys(bombTokens).length}`);
console.log("\ntiming (derived, not guessed):");
for (const r of timing.table) {
  console.log(
    `  tempo ${String(r.tempo).padStart(3)}  ${String(r.framesPerBeat).padStart(6)} frames/beat  ` +
    `${r.secondsPerBeat}s/beat  8-beat game = ${r.microgameSeconds8Beats}s`,
  );
}
console.log(`\nwrote ${OUT}`);
