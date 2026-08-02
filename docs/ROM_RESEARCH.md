# ROM research record

The included image is used as a local, legally obtained research input. The
browser build does not load it, embed its proprietary art/audio, or redistribute
extracted assets. The probe reports metadata only:

```bash
python3 tools/rom_probe.py
```

## Verified image

| field | value |
| --- | --- |
| title | `WARIOWAREINC` |
| game code | `AZWE` |
| size | 8 MiB / 64 Mbit |
| SHA-1 | `3f556448d290fa5406d6ed367fee16cc02387ad3` |
| MD5 | `a2d26dc774cec9a0b47388a5dd727b03` |
| CRC32 | `785D8B8C` |

The matching public decompilation reference is [ShaffySwitcher/wariowareinc](https://github.com/ShaffySwitcher/wariowareinc). Its Makefile pins the same SHA-1. The useful source-reading targets are:

- `include/graphics.h`: native GBA output is 240 × 160.
- `src/scenes/gameplay.h` and `src/scenes/gameplay.c`: stage state, score, lives, difficulty, current microgame ID, result transitions, and rectangle collision.
- `src/beatscript.c` / `src/beatscript.h`: fixed-point tempo, script speed, delta time, two scene threads, branching, loops, and sprite playback.
- `src/lib_sprite.h`: animation cels, playback modes, visibility, position, origin, and callbacks.

## Architecture decisions derived from the source

1. **The stage owns rhythm and transitions.** The microgame only owns its verb,
   actors, behavior, and event sheet. The engine owns score, lives, speed-up,
   interludes, and selection.
2. **240 × 160 is a profile, not a prison.** Studio now stores a logical canvas
   plus an active playfield. New scenes may use Compact or Studio profiles
   without asking the creator to commit to a pixel/photorealism label.
3. **Timing stays internal.** Long phrases may hand off at internal checkpoints
   so the 4/4 flow remains stable, but Play and Create never expose that
   implementation vocabulary.
4. **Sprite art is an asset reference.** `Appearance.kind === "sprite"` stores a
   replaceable ID. Pixels are authored separately in `PixelEditor`; neither
   path creates a text/glyph game object.
5. **Collision actions carry the picked instance.** `editor/runtime.tsx` stores
   the exact overlapping `other` actor. The Event Sheet exposes `other (picked)`
   so `Destroy other` cannot accidentally destroy every actor of that type.

## Research follow-up

The decompilation is a code/data reference, not a claim that a generic demo is a
faithful recreation of every original title. A real per-title pass should
record: source set, active rectangle, 8/16-beat length, input edge, clear/fail
window, level changes, result pose, interlude, and rights-cleared asset refs.
The current repository provides the runtime/editor contract, a 213-entry stage
registry, and authored test scenes to make that conversion repeatable. The
registry is not presented as proof that every source title is already a
pixel-perfect recreation; the scaffolded entries are deliberately visible so
the next per-title pass has a concrete place to land.
