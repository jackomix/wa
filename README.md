# WarioWare-style microgame engine — v2

A data-driven microgame engine and editor, with **139 microgames recreated from the
original GBA ROM** using real decompiled assets and logic.

```bash
npm install
npm run dev      # play + edit
npm run build    # single-file bundle in dist/
```

## What's here

| | |
| --- | --- |
| **Engine** | actors + attachable behaviors + event sheet, with Construct-style instance picking |
| **Editor** | scene / costume studio / event sheet / settings, plus a rebuilt pixel editor |
| **Content** | 139 microgames built from ROM ground truth, 7 hand-authored, plus anything you make |
| **ROM tools** | a full decompilation pipeline in `v2/tools/rom/` |

## Documentation

- [`v2/docs/00-DECISION.md`](v2/docs/00-DECISION.md) — extend v1 or rebuild, and why
- [`v2/docs/10-ROM-FINDINGS.md`](v2/docs/10-ROM-FINDINGS.md) — everything read out of the ROM
- [`v2/docs/30-BUILD-GUIDE.md`](v2/docs/30-BUILD-GUIDE.md) — how to build a faithful microgame
- [`v2/docs/40-EDITOR-CHANGELOG.md`](v2/docs/40-EDITOR-CHANGELOG.md) — what recreation forced us to fix
- [`v2/tools/rom/README.md`](v2/tools/rom/README.md) — reproducing the extraction

## The ROM work

The ROM in this repo (`sha1 3f556448…`) is the exact baserom target of the
[`ShaffySwitcher/wariowareinc`](https://github.com/ShaffySwitcher/wariowareinc)
decompilation, so the engine was **read**, not inferred:

- **366** graphics tables walked, **734** assets decoded, **0** failures
- **350** true-colour 240×160 screens composited from tilemap × tileset × palette bank
- **141** entries read from the master microgame table `D_083A50E0`
- **24,114** instructions of microgame logic disassembled (138 unique implementations)
- **139** microgames linked to their real art: **91** backgrounds, **555** sprites

Key facts that drive the engine, all sourced:

- **24 ticks = 1 beat**; `3600/tempo` frames per beat. An 8-beat microgame is 4.03 s at
  tempo 120 and 2.20 s at 220 — the "3 to 5 seconds" figure is derived, not guessed.
- Collision is **four early-out AABB comparisons**, no slop. Hit windows are tight on purpose.
- Input is overwhelmingly **one button**: A is bit-tested in 129/141; 52 read
  `gPressedKeys` (tap) vs 27 `gCurrentKeys` (hold).
- **123/141** branch on `currentDifficulty` — three tiers is the norm, not a bonus.

## Tests

```bash
npx tsx v2/tools/test/rom-games.test.mjs
```

## Note on the ROM

`WarioWare, Inc. - Mega Microgame$!.gba` is required to re-run the extraction tools
and is not redistributed. The checked-in derived art is for this recreation only.
