# Micro Mania

A beat-stable, data-driven microgame engine and creator built from the correct v1 foundation in `origin/main`.

## Run

```bash
npm install
npm run dev
```

The app opens in a 4:3 stage with a continuous metronome, elevator-style
interludes, authored microgames, and a Create mode. `Play` and `Create` are
separate views but share the same data/runtime model.

## What is in this build

- A continuous beat engine with quantized starts, score/lives, speed changes,
  result interludes, and game-over transitions.
- A 213-entry stage registry: 13 authored intro mechanics plus the remaining source-indexed stage entries, all selectable in Play; editable local presets can be added without changing the engine.
- A visual actor/instance scene editor.
- Behaviors: Platformer, 8-Direction, Physics, and Drag & Drop.
- A condition → action event sheet with expressions and target selection.
- A tactile pixel editor with paint, fill, erase, palette, and grid resize.
- Named actor costumes with multiple sprite frames, playback metadata, and
  `Switch costume` actions.
- Replaceable sprite references. Placeholder art is vector/pixel asset data,
  never a text glyph baked into a game object.
- 240 × 160 GBA-native, Compact, and Studio canvas profiles with active
  playfield metadata.
- Import/export and local browser persistence for created microgames.

## Context-aware actions

Collision conditions retain the exact overlapping instance as `other`. In the
Event Sheet, choose `other (picked)` for an action such as:

```text
Player overlaps Ball → Destroy other (picked)
```

This does not destroy every Ball definition in the scene. The engine applies the
action to the instance selected by that collision on the current tick.

## Research

The included ROM is used as a local research input only. It is not bundled into
the browser runtime's asset pipeline. See:

- [`docs/ROM_RESEARCH.md`](docs/ROM_RESEARCH.md)
- [`docs/BUILD_GUIDE.md`](docs/BUILD_GUIDE.md)
- [`tools/rom_probe.py`](tools/rom_probe.py)

The verified supplied image is the USA `AZWE` build with SHA-1
`3f556448d290fa5406d6ed367fee16cc02387ad3`. The original GBA output is
240 × 160; the editor keeps that as the first-class native canvas while allowing
larger authored profiles.

## Recommendation

The right approach for this repository is to extend the correct existing build,
not throw it away. Its global rhythm engine, editor schema, runtime, authored
microgames, and tester already preserve the hard part of the loop. The current
work tightens its UX and data boundaries instead of replacing those strengths.
