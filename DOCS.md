# WarioWare Inc. — Micro Mania Engine Documentation

## Architecture

This is a faithful 1:1 recreation of the GBA game *WarioWare, Inc.: Mega Microgame$!* using web technologies. The engine replicates the original game's beat-accurate timing system, framerule-based game flow, and character-specific interlude scenes.

### Core Engine

The engine is built on a **beat-accurate timing system** that drives all game logic:

- **Beat Clock**: A continuous global beat counter that never pauses. All game events are quantized to the beat grid.
- **Framerule System**: 4-bar microgames can exit at beat 8 or 12 checkpoints if the outcome is already decided, without breaking the 4/4 flow.
- **Metronome**: Sample-accurate audio scheduling via WebAudio API lookahead (0.16s buffer).

#### Timing Constants (from decompilation)

| Parameter | Value | Source |
|-----------|-------|--------|
| BASE_BPM | 118 | `beatscript.c` (BPM=120 in US version) |
| BPM_STEP | 14 | Speed-up increment per interval |
| MAX_BPM | 230 | Maximum game speed |
| GAMES_PER_SPEEDUP | 4 | Games between speed-ups |
| MAX_LIVES | 4 | `gameplay.h` currentLives |
| STANDARD_BEATS | 8 | Standard 2-bar game length |
| DOUBLE_BEATS | 16 | Boss 4-bar game length |

### Game Flow

```
Title Screen → (Press Space) → Interlude (8 beats) → Microgame (8-16 beats) →
  → Interlude (8 beats) → Microgame → ... → Game Over
```

Each interlude consists of:
- **Bar 1**: Result display (win/lose) with character-specific scene
- **Bar 2**: Score display and preparation
- **Bar 3-4** (optional): Speed-Up announcement

### Stage System

Based on `levels.h` from the decompilation project:

| Stage | Character | BPM | Interlude Style |
|-------|-----------|-----|-----------------|
| Intro Games | Wario | 120 | Boombox |
| Sports | Jimmy T. | 130 | Elevator |
| Sci-Fi | Dribble & Spitz | 140 | UFO |
| That's Life! | Mona | 135 | Stage |
| Nintendo Classics | 9-Volt | 145 | TV |
| IQ | Orbulon | 125 | Cockpit |
| Reality | Dr. Crygor | 150 | Lab |
| Nature | Kat & Ana | 140 | Dojo |
| Anything Goes | Wario | 160 | Boombox |

## ROM Graphics System

The game uses a browser-based ROM graphics extraction system that works exactly like the GBA hardware:

### GBA Graphics Pipeline

1. **LZ77 Decompression**: The ROM stores all graphics data in LZ77 compressed blocks (0x10 header byte)
2. **4bpp Tile Data**: Each 8×8 pixel tile is 32 bytes, with 4 bits per pixel (16-color palettes)
3. **RGB555 Palettes**: Colors are stored as 16-bit values in xBGR555 format
4. **Canvas Rendering**: Tiles are rendered using the Canvas API with `imageSmoothingEnabled = false`

### ROM Loading

The ROM is served as a static asset from `public/rom.gba`. On startup, the app:
1. Fetches the ROM via `fetch('/rom.gba')`
2. Decompresses LZ77 blocks in the browser
3. Extracts palettes and tile data
4. Renders sprites to Canvas elements
5. Caches the results as data URLs

### Pixel Art Sprite System

The `engine/pixelArt.tsx` module provides:
- `SpriteData` type: Defines sprites as arrays of color indices referencing a palette
- `PixelSprite` component: Renders sprites using Canvas API
- Pre-defined sprites: Wario, Car, Diamond, UFO, Shield (using actual ROM palettes)
- `Sprite` component: Renders either pixel art or emoji fallback

### ROM Structure

The ROM is 8MB with the following layout:
- `0x000000-0x400000`: Code section (ARM instructions)
- `0x400000-0x800000`: Data section (graphics, palettes, maps, audio)
- `0x0F7000-0x0F7800`: Microgame name table

Key addresses from decompilation:
- `title_obj`: `0x08545F28` (ROM offset `0x545F28`)
- `main_menu_bg_tiles`: `0x08548ED4` (ROM offset `0x548ED4`)

## Decompilation Findings

### Beatscript System

The original game uses a bytecode VM with ~150+ opcodes:

| Opcode | Function |
|--------|----------|
| `BS_CMD_STOP` | Stop script execution |
| `BS_CMD_SET8/16/32` | Set variable |
| `BS_CMD_IF_EQ/NEQ` | Conditional branch |
| `BS_CMD_SPRITE_SET_PLAYBACK` | Set sprite animation |
| `BS_CMD_REST` | Wait for N beats |
| `BS_CMD_CALL` | Call subroutine |
| `BS_CMD_RET` | Return from subroutine |

### GameplayData Structure

From `gameplay.h`:

| Offset | Field | Type |
|--------|-------|------|
| 0x174 | currentDifficulty | u8 |
| 0x175 | currentLives | u8 |
| 0x17C | currentScore | u32 |
| 0x27C | currentMicrogameID | u32 |

### Multi-threaded Scene System

The game supports up to 4 concurrent threads, each with:
- Own script execution context
- Own sprite pool
- Own variable set
- Independent beat timing

### Microgame Names (from ROM)

175 microgame names found at offsets 0x0F7000-0x0F7800, including:
- Intro: JACK, CHIBI WARIO, MONTAGE, CAKE2, etc.
- Sports: LOG CHOP, HEADS UP, BOING, FRUIT SHOOT, etc.
- Sci-Fi: CYCLONE JUMP, CATCH ROBOT, NOSE, ULTRAMAN BEAM, etc.
- Nintendo: SUPER MARIO, DUCK HUNT, WILD GUNMAN, SHERIFF, etc.

## File Structure

```
├── App.tsx              — Main app with stage selection, ROM loader
├── main.tsx             — Entry point
├── index.html           — HTML template
├── index.css            — Global styles
├── engine/
│   ├── useEngine.ts     — Core engine hook (beat clock, framerules, interlude)
│   ├── audio.ts         — WebAudio synth (metronome, SFX, sample-accurate)
│   ├── types.ts         — All type definitions
│   ├── romGfx.tsx       — ROM graphics loader (LZ77, palettes, tile renderer)
│   └── pixelArt.tsx     — Pixel art sprite system (Canvas-based rendering)
├── components/
│   └── Screens.tsx      — All UI screens (Stage, Doors, Interlude, etc.)
├── microgames/
│   └── index.tsx        — All 213 microgame definitions (13 implemented)
├── editor/
│   ├── Editor.tsx       — Editor UI
│   ├── PixelEditor.tsx  — Pixel art editor
│   ├── Tester.tsx       — Microgame tester
│   ├── runtime.tsx      — Data-driven microgame runtime
│   ├── schema.ts        — MicrogameData schema
│   ├── spec.ts          — Condition/action catalog
│   └── library.ts       — Microgame library
├── utils/
├── public/
│   └── rom.gba          — The GBA ROM file (8MB, AZWE)
└── tools/
    └── extract_gfx.py   — ROM graphics extraction tool
```

## Building

```bash
npm install
npx vite build    # Build to dist/
npx vite dev      # Development server
```

## Controls

- **Arrow Keys**: Move (left/right/up/down)
- **Space**: Action button
- **Mouse**: Pointer input for drag-and-drop games

## References

- [Decompilation Project](https://github.com/ShaffySwitcher/wariowareinc) — GBA decompilation effort
- [MarioWiki](https://www.mariowiki.com/WarioWare,_Inc.:_Mega_Microgame$!) — Game information
- `graphics.h` — GBA graphics system definitions
- `gameplay.h` — Gameplay data structures
- `levels.h` — Stage enum definitions
- `beatscript.h` — Beatscript VM opcodes
