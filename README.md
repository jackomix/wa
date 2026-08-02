# wa — WarioWare-style microgame engine

⚠️ **This branch currently contains two parallel builds.** More than one Arena session
was pushing to `arena/019fc0aa-wa`, so rather than overwrite anyone's work both are
kept side by side. They share `node_modules` but are otherwise independent.

| build | location | entry | run |
| --- | --- | --- | --- |
| **Micro Mania** | repo root (`App.tsx`, `engine/`, `editor/`, `microgames/`) | `index.html` | `npm run dev` |
| **v2 — ROM-faithful** | `v2/` | `v2/index.html` | `npm run dev:v2` |

---

# v2 — ROM-faithful microgame engine

A data-driven microgame engine and editor, with **139 microgames recreated from the
original GBA ROM** using real decompiled art and real disassembled logic.

### One click (macOS)

Double-click **`Play WarioWare v2.command`** in Finder. It checks for Node, installs
dependencies the first time, starts the server and opens your browser.

> First launch takes a minute or two while dependencies install. After that it's a
> few seconds.
>
> If macOS blocks it with *"cannot be opened because it is from an unidentified
> developer"*: right-click the file → **Open** → **Open**. Only needed once.

### Or from a terminal

```bash
npm install
npm run dev:v2      # play + edit
npm run build:v2    # single-file bundle in v2/dist/
npm run test:v2     # headless assertions
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

## Fixes from the v1 feedback

1. **Frame rules** — removed from every user-facing surface; the quantisation remains
   internal to the scheduler, which is where the original keeps it.
2. **Instruction text** — retimed from lingering ~1.4 beats into play to clearing
   ~0.1 beat after control starts.
3. **Music-note HUD** — the bottom-left `♩=BPM · BAR n · 4/4` readout is gone.
4. **Emoji-as-sprite** — art is now a swappable `SpriteRef` behind a costume, rendered
   through one path shared with pixels and bitmaps. This is what let 555 real ROM
   sprites drop in with no other change.

## Note on the ROM

`WarioWare, Inc. - Mega Microgame$!.gba` is required to re-run the extraction tools
and is not redistributed. The checked-in derived art is for this recreation only.
