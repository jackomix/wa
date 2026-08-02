# WarioWare Inc. — Micro Mania Engine Documentation

## Architecture

This is a faithful 1:1 recreation of the GBA game *WarioWare, Inc.: Mega Microgame$!* using web technologies. The engine replicates the original game's beat-accurate timing system, framerule-based game flow, and character-specific interlude scenes.

### Core Engine

The engine is built on a **beat-accurate timing system** that drives all game logic:

- **Beat Clock**: A continuous global beat counter that never pauses. All game events are quantized to the beat grid.
- **Framerule System**: 4-bar microgames can exit at beat 8 or 12 checkpoints if the outcome is already decided, without breaking the 4/4 flow.
- **Metronome**: Sample-accurate audio scheduling via WebAudio API lookahead (0.16s buffer).
- **Stage Intro**: When starting a stage, a 4-beat character intro screen plays before the first interlude.

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
| STAGE_INTRO_BEATS | 4 | Character intro before stage |

### Game Flow

```
Title Screen → (Press Space) → Stage Intro (4 beats) → Interlude (8 beats) → Microgame (8-16 beats) →
  → Interlude (8 beats) → Microgame → ... → Game Over
```

Each interlude consists of:
- **Bar 1**: Result display (win/lose) with character-specific scene
- **Bar 2**: Score display and preparation
- **Bar 3-4** (optional): Speed-Up announcement

### Stage System

Based on `levels.h` from the decompilation project:

| Stage | Character | BPM | Interlude Style | Boss |
|-------|-----------|-----|-----------------|------|
| Intro Games | Wario | 120 | Boombox | Sparring Wario |
| Sports | Jimmy T. | 130 | Elevator | Punch Out |
| Sci-Fi | Dribble & Spitz | 140 | UFO | Boss Out |
| That's Life! | Mona | 135 | TV | Boss Strange |
| Nintendo Classics | 9-Volt | 145 | TV | Boss Nintendo |
| IQ | Orbulon | 125 | Cockpit | Boss IQ |
| Reality | Dr. Crygor | 150 | Lab | Boss Reality |
| Nature | Kat & Ana | 140 | Dojo | Boss Nature |
| Anything Goes | Wario | 160 | Boombox | Boss Anything |

## Microgame Implementation Status

### Implemented with Full Gameplay (40+ games)

#### Intro Games (13 games)
1. **Crazy Cars** — Dodge oncoming vehicles (jump over them)
2. **Wario Whirled** — Stop spinning face at the right angle
3. **Saving Face** — Protect Wario from falling objects with shield
4. **Diamond Dig** — Catch falling diamonds
5. **Dodge Balls** — Dodge balls falling from above
6. **Repellion** — Shoot UFOs with a laser
7. **Wario Wear** — Put on the right clothes
8. **Hectic Highway** — Dodge traffic on the highway
9. **Maze That Pays** — Navigate to the treasure
10. **Super Wario Bros** — Jump over obstacles (Mario style)
11. **I Spy** — Spot the right item
12. **Mug Shot** — Catch mugs sliding across the counter
13. **Sparring Wario** — Boss: Punch the punching bag off its chain

#### Sports (10 games)
1. **Batter Up** — Swing the bat at the right time
2. **Ski Jump** — Jump at the right time for max distance
3. **Bowling** — Roll the ball to hit the pins
4. **Tennis** — Hit the ball back
5. **Hurry Hurdles** — Jump over hurdles
6. **Log Chop** — Chop the log (3 hits)
7. **High Hoops** — Shoot the basketball at the right angle
8. **Hammer Toss** — Throw the hammer at the right angle
9. **Ring My Bell** — Hit the target with enough power
10. **Punch Out** — Boss: Boxing fight

#### Nintendo Classics (12 games)
1. **Super Mario** — Jump over the Goomba
2. **Duck Hunt** — Shoot the duck
3. **Donkey Kong** — Jump over the barrel
4. **Dr. Mario** — Kill the viruses
5. **Metroid** — Shoot the enemy with aim crosshair
6. **Mario Paint** — Swat the fly
7. **Ice Climber** — Jump to the top
8. **F-Zero** — Steer the car through the track
9. **Sheriff** — Shoot the bandit with rotating aim
10. **Wild Gunman** — Shoot when he draws (wait for FIRE!)
11. **Boss Nintendo** — Boss: Fight the alien boss
12. *(13 placeholder games)*

#### Sci-Fi (5 games)
1. **Cyclone Jump** — Jump over the cyclone
2. **Enter Command** — Press the right arrow sequence
3. **Space Fight** — Shoot the enemy ship
4. **Ninja Arrow** — Dodge the arrows
5. **Boss Out** — Boss: Survive the alien boss

#### That's Life! (5 games)
1. **Jack** — Pull the weed (3 pulls)
2. **Pinball** — Flip the ball to the top
3. **Steak** — Cut the steak (3 cuts)
4. **Wheel** — Stop the spinning wheel
5. **Boss Strange** — Boss: Catch falling items

#### Nature (5 games)
1. **UFO Catcher** — Catch the prize with the claw
2. **Rainy Day** — Avoid the rain
3. **Fire Fighting** — Spray the fires
4. **Samurai** — Cut at the right angle
5. **Boss Nature** — Boss: Dodge and counter-attack

### Placeholder Games (~170)
The remaining games for each stage use a simple "press SPACE to win" placeholder with the correct stage palettes and instruction text.

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
- Pre-defined sprites: Wario, Car, Diamond, UFO, Shield (using actual ROM palettes from decompilation)
- `Sprite` component: Renders either pixel art or emoji fallback
- `getCachedSpriteURL()`: Cache for pre-rendered data URLs

### ROM Structure

The ROM is 8MB (AZWE, USA version) with the following layout:
- `0x000000-0x400000`: Code section (ARM instructions)
- `0x400000-0x800000`: Data section (graphics, palettes, maps, audio)
- `0x0F7000-0x0F7800`: Microgame name table (175+ names)
- `0x6BE74C`: FATA marker (compressed data)

Key addresses from decompilation (`undefined_syms.ld`):
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

### GameplayData Structure (from `gameplay.h`)

| Offset | Field | Type |
|--------|-------|------|
| 0x174 | currentDifficulty | u8 |
| 0x175 | currentLives | u8 |
| 0x176 | maxLives | u8 |
| 0x17C | currentScore | u16 |
| 0x27C | currentMicrogameID | u8 |

### GameplayMicrogameInfo Structure

From `gameplay.h`:
```c
struct GameplayMicrogameInfo {
    void* unk0;    // pointer to graphics data
    void* unk4;    // pointer to palette data
    u8 unk8;       // parameter
    u8 unk9;       // parameter
    u8 padA[2];
    void* unkC;    // pointer to script data
};
```

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

## Interlude Scenes

Each character has a unique interlude scene rendered during the result/preparation phase:

| Character | Interlude | Visual Elements |
|-----------|-----------|-----------------|
| Wario | Boombox | Cassette player with beat visualization |
| Jimmy T. | Elevator | Elevator doors with floor indicator |
| 9-Volt | TV | Retro TV with scanlines and score display |
| Dribble & Spitz | UFO | UFO with tractor beam and stars |
| Mona | Stage | Theater stage with spotlight |
| Dr. Crygor | Lab | Laboratory with bubbling beakers |
| Orbulon | Cockpit | Spaceship cockpit with control panel |
| Kat & Ana | Dojo | Japanese dojo with cherry blossoms |

## File Structure

```
├── App.tsx              — Main app with stage selection, ROM loader
├── main.tsx             — Entry point
├── index.html           — HTML template
├── index.css            — Global styles
├── engine/
│   ├── useEngine.ts     — Core engine hook (beat clock, framerules, interlude, stage intro)
│   ├── audio.ts         — WebAudio synth (metronome, SFX, sample-accurate)
│   ├── types.ts         — All type definitions (Phase includes stage_intro)
│   ├── romGfx.tsx       — ROM graphics loader (LZ77, palettes, tile renderer)
│   └── pixelArt.tsx     — Pixel art sprite system (Canvas-based rendering)
├── components/
│   └── Screens.tsx      — All UI screens (Stage, Doors, Interlude, StageIntro, etc.)
├── microgames/
│   └── index.tsx        — All 213 microgame definitions (40+ implemented)
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
│   └── rom.gba          — The GBA ROM file (8MB, AZWE, excluded from git)
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
- `graphics.h` — GBA graphics system definitions
- `gameplay.h` — Gameplay data structures
- `levels.h` — Stage enum definitions
- `beatscript.h` — Beatscript VM opcodes
- `title_pal.c` — Actual extracted palettes from decompilation
