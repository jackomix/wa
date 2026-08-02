# Ground truth from the ROM

Everything in this document was read out of `WarioWare, Inc. - Mega Microgame$!.gba`
(`sha1 3f556448d290fa5406d6ed367fee16cc02387ad3`, gamecode `AZWE`) or out of the
[`ShaffySwitcher/wariowareinc`](https://github.com/ShaffySwitcher/wariowareinc)
decompilation, whose Makefile declares **that exact SHA-1** as its baserom target.
No number here is inferred from watching the game.

---

## 1. The clock

This is the single most important finding, because it is what makes or breaks a
WarioWare clone's feel.

`set_beatscript_tempo()` in `src/beatscript.c`:

```c
speed = INT_TO_FIXED(tempo);                       // tempo << 8
gBeatscriptScene.spriteAnimSpeed = speed / 140;
speed /= gBeatscriptScene.musicBaseBPM;
gBeatscriptScene.deltaTime = gBeatscriptScene.musicBaseBPM * speed / 150u;
                                                   // == (tempo << 8) / 150
```

`rest N` stores `N << 8` into `thread.timeUntilNext`, and the scheduler subtracts
`deltaTime` once per frame:

```c
thread->timeUntilNext -= gBeatscriptScene.deltaTime;
while (thread->active && thread->timeUntilNext <= 0 && !paused)
    func_0800A7D4(i);
```

Every decompiled script rests in multiples of 24 (`rest 24` ×21, `rest 12` ×6
across the shipped scene scripts). Therefore:

$$\text{frames per beat} = \frac{24 \ll 8}{(tempo \ll 8)/150} = \frac{3600}{tempo}$$

**24 ticks = 1 beat, and one beat is exactly `60/tempo` seconds at 60 fps.**

| tempo | frames/beat | s/beat | 8-beat game | 16-beat boss |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 36.14 | 0.605 | **4.84 s** | 9.68 s |
| 120 | 30.12 | 0.504 | **4.03 s** | 8.07 s |
| 140 | 25.82 | 0.432 | **3.46 s** | 6.92 s |
| 160 | 22.51 | 0.377 | **3.01 s** | 6.03 s |
| 180 | 20.01 | 0.335 | **2.68 s** | 5.36 s |
| 200 | 18.02 | 0.302 | **2.41 s** | 4.83 s |
| 220 | 16.38 | 0.274 | **2.20 s** | 4.39 s |

The familiar "three to five seconds" is not a design guideline someone wrote down —
it falls out of `3600/tempo × 8 / 60` across the tempo range the game actually uses.

**On "frame rules."** The quantisation is a property of this loop: script time only
advances in `deltaTime` units, so events land on tick boundaries. It is internal. The
original never tells the player about it, and neither does v2 — the mechanic stayed,
the on-screen `FRAMERULE!` badge went.

---

## 2. Collision

`gameplay_check_collision()` — four early-outs on an AABB pair, nothing else:

```c
if (xA >= xB + hitboxB->width)  return FALSE;
if (xB >= xA + hitboxA->width)  return FALSE;
if (yA >= yB + hitboxB->height) return FALSE;
if (yB >= yA + hitboxA->height) return FALSE;
return TRUE;
```

No radius, no slop, no forgiveness frames. WarioWare's hit windows are *tight*, and
a "friendlier" rounded test is a common reason fan recreations feel mushy. v2 uses
the same test.

---

## 3. Run structure

From `src/scenes/gameplay.h` and `gameplay_run_script()`:

| constant | value | source |
| --- | --- | --- |
| `MAX_LIVES` | 4 | `#define MAX_LIVES 4` |
| `MAX_SCORE` | 999 | `#define MAX_SCORE 999` |
| beatscript threads | 2 | `struct BeatscriptScene.threads[2]` |
| save microgame flags | `u8[0x100]` | `struct SaveBuffer` |
| menu iterates ids | `< 226` | `main_menu.c:1200` |

Clearing a boss returns a life, capped at 4 — `func_0800A098()`:

```c
gGameplayData.currentLives++;
if (gGameplayData.currentLives > 4) gGameplayData.currentLives = 4;
```

---

## 4. Where a microgame actually lives

A microgame is an entry in the master table `D_083A50E0`
(`struct GameplayMicrogameInfo[]`, 16 bytes each). **141 entries** parse cleanly.

```c
struct GameplayMicrogameInfo {
    void* unk0;   // -> SubScene
    void* unk4;   // -> sprite / animation data  (NOT a GraphicsTable)
    u8    unk8;   // always 1
    u8    unk9;   // timer value: 10 / 15 / 20 / 25 / 30
    u8    padA[2];
    void* unkC;
};
```

`unk0` points at a `SubScene`:

```c
struct SubScene {            // 0x24 bytes
    +0x00 startFunc   +0x04 startParam
    +0x08 pausedFunc  +0x0C pausedParam
    +0x10 updateFunc  +0x14 updateParam
    +0x18 stopFunc    +0x1C stopParam
    +0x20 script                       // beatscript bytecode
};
```

### The beatscript is *not* the microgame

Disassembling all 141 attached beatscripts gives a near-uniform result:

```
rest 24        ; 1 beat
stop
```

141 `rest`, 141 `stop`, and almost nothing else. The bytecode is a **timing shell**.
The actual behaviour is THUMB code in `startFunc` / `updateFunc`.

Disassembled with capstone: **24,114 instructions**, **138 unique implementations**,
average **171 instructions per `updateFunc`**.

### The outcome API

Decoding `asm_0800a0c4.s` by hand:

```
MOVS R2, #0xBC
LSLS R2, R2, #1        ; 0xBC * 2 = 0x178
ADDS R0, R1, R2
STRH R3, [R0]          ; store result
```

`0x178` is `gGameplayData.unk178` — the flag `gameplay_run_script()` tests to decide
whether to deduct a life. So **`func_0800A0C4(result)` is the win/lose call**, and
**133 of 141** microgames call it. The other 8 are timing-only (they always pass).

The same `movs #imm ; lsls #1` idiom reveals the rest of the hot fields:

| offset | field |
| --- | --- |
| `0xBA*2 = 0x174` | `currentDifficulty` |
| `0xBB*2 = 0x176` | `maxLives` |
| `0xBC*2 = 0x178` | outcome flag |
| `0xBE*2 = 0x17C` | `currentScore` |

---

## 5. What the roster actually does

Measured across all 141 by static analysis (`tools/rom/analyse_logic.py`):

| property | count | how it was determined |
| --- | ---: | --- |
| branch on `currentDifficulty` | **123** | load of `0x174` |
| call the outcome setter | **133** | `bl 0x0800A0C4` |
| call the RNG (`0x08001120`) | **70** | with captured moduli |
| read player input | **67** | literal-pool load of a key global |

### Input is mostly a single tap

Key state is read through globals, not immediates — which is why scanning for
constants finds nothing and you must follow literal-pool loads:

| global | address | meaning | microgames |
| --- | --- | --- | ---: |
| `gPressedKeys` | `0x03003FF4` | newly pressed (edge) | **52** |
| `gCurrentKeys` | `0x03003FC8` | held (level) | **27** |

Button masks actually bit-tested:

| button | microgames |
| --- | ---: |
| A | **129** |
| B | 84 |
| SELECT | 42 |
| START | 7 |
| d-pad (any) | ≤6 each |

So the roster is overwhelmingly **"press A at the right moment"**, edge-triggered.
That is a measured fact, not a stylistic assumption, and it is why v2's recreations
default to a tap.

### Real randomisation ranges

Moduli passed to `func_08001120`:

```
rand(2)  ×30    rand(3)  ×17    rand(4)   ×16    rand(128) ×12
rand(16) ×8     rand(6)  ×8     rand(8)   ×6     rand(192) ×5
rand(12) ×5     rand(30) ×5     rand(5)   ×5
```

`rand(2)`/`rand(3)`/`rand(4)` dominate: most microgames pick between a small number
of *variants* (which side, which of three targets), not a continuous value.
`rand(128)`/`rand(192)` are pixel positions on a 240-wide screen.

### Length

`unk9` distribution across 141 entries:

| value | count | maps to |
| ---: | ---: | --- |
| 10 | 35 | 2 bars |
| 15 | 54 | 2 bars |
| 20 | 31 | 2 bars |
| 25 | 14 | 4 bars |
| 30 | 7 | 4 bars |

---

## 6. Graphics

### The compression is custom

The game does **not** use GBA BIOS LZ77. A scan for `0x10`-headed blocks over the
whole 8 MB ROM decodes **zero** valid tilesets. It uses a bespoke nibble-dictionary
+ RLE + sliding-window scheme (see the decompilation's `tools/compression.py`).

Rather than re-derive it, v2 calls the decompilation's own `decompression.py`.
Verified byte-exact: extracting `title_obj` at `0x08545F28` produces 9,216 bytes
identical to that project's checked-in `graphics/title/title_obj.4bpp`.

### Following the game's own asset registry

```c
struct GraphicsTable { const void *src; void *dest; s32 size; };  // 12 bytes
#define COMPRESSED_GFX_SOURCE  -1
#define END_OF_GRAPHICS_TABLE  { NULL, NULL, 0 }
```

Scanning for runs of ≥3 entries with a ROM `src`, a VRAM/palette `dest` and
`size ∈ {-1, -2, small positive}`:

- **366 graphics tables**
- **734 assets decoded, 0 failures**
- **110,280 tiles**

`dest` classifies each asset for free: `0x06010000+` is OBJ tiles, `0x0600E000..FFFF`
is a BG map, `0x05000000/0200` are palettes.

### The palette detail that matters

Palettes are **not** in the GraphicsTable. They sit immediately after it as one
contiguous **16-bank block** (16 × 16 colours × 2 bytes = `0x200`), BGR555.

A BG tilemap entry is a `u16`:

```
bits 0-9    tile index
bit  10     hflip
bit  11     vflip
bits 12-15  palette bank    <-- indexes into that block
```

Because the bank is encoded **per tile**, all 16 banks must be kept in order and
aligned to the block start. Filtering out "boring" (mostly-black) banks shifts every
later index and mis-colours the screen — that bug produced near-black renders until
it was found. One real example: microgame #6's background uses bank **13** exclusively.

Composited output: **350 true-colour 240×160 screens**, spot-checked as unmistakably
real (a sofa and stool, Kat & Ana's dojo, a castle, the nose-picking scene).

### Linking a microgame to its art

`unk4` is sprite/animation data, so joining on it yields **zero** matches. The real
`GraphicsTable` is passed in **R1** to `load_graphics` (`func_08002124`) inside the
microgame's `startFunc`:

```
ldr  r0, [pc, #0xe4]        ; subscene state + 4
ldr  r1, [pc, #0xe4]        ; -> 0x083CB78C   <<< the GraphicsTable
movs r2, #0x80 ; lsls r2,#6
bl   #0x8002124
```

Tracking literal-pool loads into `r1` up to that call resolves **72 of 141**
microgames to a real table; **71** match an already-extracted bundle, and **41** have
a full background renderable at true colour.

---

## 7. Audio

2,690 sequence-name strings survive in the ROM (861 BGM, 1,820 SFX), which is a
readable index of the content. SFX are prefixed by microgame layer:

```
s_BOMB_CAR_Crash_01      s_BOMB_Nose_01/02/03     s_BOMB_Mario_Step_ON_1..3
s_BOMB_Tennis_Hit_0..2   s_BOMB_Frog_HIT/SWIM     s_BOMB_wario_Hip_Attack_S
```

87 distinct microgame tokens appear under the `s_BOMB_*` prefix — an independent
cross-check on the roster's breadth.

---

## 8. Reproducing all of this

```bash
git clone --depth 1 https://github.com/ShaffySwitcher/wariowareinc /tmp/ww
cd /path/to/repo

node    v2/tools/rom/extract.mjs                       # header, audio, timing
python3 v2/tools/rom/find_gfx_tables.py     "<rom>" /tmp/ww /tmp/romgfx
python3 v2/tools/rom/extract_microgames.py  "<rom>" /tmp/ww /tmp/bundles --gfx /tmp/romgfx
python3 v2/tools/rom/render_screens.py      /tmp/bundles /tmp/screens
python3 v2/tools/rom/read_microgame_table.py "<rom>" /tmp/mgtable.json
python3 v2/tools/rom/disasm_microgame.py    "<rom>" --all /tmp/mgtable.json --out /tmp/mgcode
python3 v2/tools/rom/analyse_logic.py       "<rom>" /tmp/mgtable.json /tmp/specs.json
python3 v2/tools/rom/link_assets.py         "<rom>" /tmp/mgtable.json /tmp/links.json
python3 v2/tools/rom/make_costumes.py       /tmp/bundles /tmp/links.json v2/src/content/romArt.ts
python3 v2/tools/rom/gen_specs.py           /tmp/specs.json /tmp/links.json v2/src/content/romSpecs.json
```

The ROM is required and is not redistributed by this repo.

---

## 9. Honest limits

- **41 of 213** microgames are recreated. The blocker is the `startFunc` → R1 trace,
  which resolves 72; the rest load graphics through a helper or a jump table that the
  current linear tracer does not follow. Extending it is the highest-value next step.
- The recreations reproduce **art, timing, input model, difficulty tiering and
  outcome shape**. They do not yet reproduce every bespoke animation curve — that
  needs per-microgame reading of `updateFunc`, which is done for the timing/input
  facts but not yet for full motion.
- Backgrounds are downsampled from 240×160 to a 64-wide indexed grid to keep the
  bundle at ~527 KB. Full-resolution backdrops would be ~7× larger.
- Microgame **names** are the one editorial element: the ROM stores menu names as
  tile art, not text strings, so names come from the published roster matched
  against each rendered background. Every mechanical field is read from code.
