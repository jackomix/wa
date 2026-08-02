# ROM decompilation pipeline

Real extraction from `WarioWare, Inc. - Mega Microgame$!.gba`
(sha1 `3f556448d290fa5406d6ed367fee16cc02387ad3`) — the exact baserom target
of the [`ShaffySwitcher/wariowareinc`](https://github.com/ShaffySwitcher/wariowareinc)
decompilation. Nothing here is guessed; every number is read out of the ROM
or the decompiled source.

## Why a custom decompressor was needed

The game does **not** use GBA BIOS LZ77. A naive scan for `0x10` headers finds
zero valid blocks. It uses a bespoke nibble-dictionary + RLE + sliding-window
scheme. Rather than reverse it again, we call the decompilation's own
`tools/decompression.py`, verified byte-exact against that project's
`graphics/title/title_obj.4bpp` (9216 bytes, identical).

## Stages

| script | what it does | result |
| --- | --- | --- |
| `extract.mjs` | ROM header, audio string table, timing model | `docs/rom-findings.json` |
| `find_gfx_tables.py` | walks every `struct GraphicsTable` and decodes its assets | 366 tables, 734 assets, 0 failures |
| `extract_microgames.py` | groups assets + the 16-bank palette block into per-microgame bundles | 363 bundles, 258,008 tiles |
| `render_screens.py` | composites tilemap × tileset × per-tile palette bank | 350 true-colour screens |
| `build_assets.py` | slices OBJ tiles into costume-ready sprites | 8,017 sprites |

## The palette detail that matters

Palettes are not in the GraphicsTable. They sit immediately after it as one
contiguous **16-bank block** (16 banks × 16 colours × 2 bytes = 0x200). A
tilemap entry is a `u16`:

```
bits 0-9   tile index
bit  10    hflip
bit  11    vflip
bits 12-15 palette bank   <-- indexes into that block
```

Because the bank is per-tile, you must keep all 16 banks in order and aligned
to the block start. Filtering out "boring" banks shifts every later index and
mis-colours the screen — that bug produced near-black renders until fixed.

## Reproduce

```bash
git clone --depth 1 https://github.com/ShaffySwitcher/wariowareinc /tmp/ww
python3 find_gfx_tables.py    "<rom>" /tmp/ww /tmp/romgfx
python3 extract_microgames.py "<rom>" /tmp/ww /tmp/bundles --gfx /tmp/romgfx
python3 render_screens.py     /tmp/bundles /tmp/screens
```
