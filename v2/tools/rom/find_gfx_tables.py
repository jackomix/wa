#!/usr/bin/env python3
"""
Locate every GraphicsTable in the ROM and extract the assets it points at.

This follows the game's OWN asset registry rather than brute-forcing the
address space, so what comes out is exactly what the game loads.

    struct GraphicsTable { const void *src; void *dest; s32 size; };   // 12 bytes
    #define COMPRESSED_GFX_SOURCE  -1
    #define END_OF_GRAPHICS_TABLE  { NULL, NULL, 0 }

A table is a run of >=2 entries where:
    src  is a ROM pointer   (0x08000000..0x08800000)
    dest is a VRAM/palette pointer (0x05000000 or 0x06000000 range)
    size is -1 (compressed), -2 (loader fn), or a small positive byte count
terminated by a {0,0,0} entry.

`dest` tells us what each asset IS:
    0x06000000..0x0600FFFF  BG tiles / BG tilemaps
    0x06010000..0x06017FFF  OBJ (sprite) tiles
    0x05000000..0x050001FF  BG palette
    0x05000200..0x050003FF  OBJ palette

Usage: python3 find_gfx_tables.py <rom> <decomp_dir> <out_dir>
"""
import argparse
import json
import os
import struct
import sys

ROM_BASE = 0x08000000
ROM_END = 0x08800000
VRAM = 0x06000000
PAL = 0x05000000


def u32(d, o):
    return struct.unpack_from("<I", d, o)[0]


def s32(d, o):
    return struct.unpack_from("<i", d, o)[0]


def is_rom_ptr(v):
    return ROM_BASE <= v < ROM_END


def is_vram_ptr(v):
    return (VRAM <= v < VRAM + 0x18000) or (PAL <= v < PAL + 0x400)


def classify(dest):
    if PAL <= dest < PAL + 0x200:
        return "bg_palette"
    if PAL + 0x200 <= dest < PAL + 0x400:
        return "obj_palette"
    if VRAM + 0x10000 <= dest < VRAM + 0x18000:
        return "obj_tiles"
    off = dest - VRAM
    # BG maps live in the upper screenblocks; tiles in the lower charblocks
    if 0xE000 <= off <= 0xFFFF:
        return "bg_map"
    return "bg_tiles"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("rom")
    ap.add_argument("decomp")
    ap.add_argument("out")
    ap.add_argument("--max-tables", type=int, default=0)
    args = ap.parse_args()

    sys.path.insert(0, os.path.join(args.decomp, "tools"))
    import decompression as dec

    rom = open(args.rom, "rb").read()
    os.makedirs(args.out, exist_ok=True)

    tables = []
    i = 0
    n = len(rom)

    while i + 12 <= n:
        src = u32(rom, i)
        dest = u32(rom, i + 4)
        size = s32(rom, i + 8)

        if is_rom_ptr(src) and is_vram_ptr(dest) and (size in (-1, -2) or 0 < size <= 0x4000):
            # walk the run
            entries = []
            j = i
            while j + 12 <= n:
                s_ = u32(rom, j)
                d_ = u32(rom, j + 4)
                z_ = s32(rom, j + 8)
                if s_ == 0 and d_ == 0 and z_ == 0:
                    break
                if not (is_rom_ptr(s_) and is_vram_ptr(d_) and (z_ in (-1, -2) or 0 < z_ <= 0x4000)):
                    break
                entries.append({"src": s_, "dest": d_, "size": z_, "kind": classify(d_)})
                j += 12

            if len(entries) >= 3:
                tables.append({"addr": ROM_BASE + i, "entries": entries})
                i = j + 12
                if args.max_tables and len(tables) >= args.max_tables:
                    break
                continue
        i += 4

    print("graphics tables found: %d" % len(tables))

    # extract unique compressed assets
    seen = {}
    ok = 0
    failed = 0
    for t in tables:
        for e in t["entries"]:
            if e["size"] != -1:
                continue
            a = e["src"]
            if a in seen:
                continue
            try:
                res = dec.decompress_compressed_data(rom, a)
                hw = res["output"]
                raw = struct.pack("<%dH" % len(hw), *hw)
                name = "%s_%08X.bin" % (e["kind"], a)
                with open(os.path.join(args.out, name), "wb") as f:
                    f.write(raw)
                seen[a] = {
                    "addr": a, "kind": e["kind"], "bytes": len(raw),
                    "tiles": len(raw) // 32, "file": name,
                    "double": bool(res.get("double_compressed")),
                }
                ok += 1
            except Exception:
                seen[a] = None
                failed += 1

    assets = [v for v in seen.values() if v]
    index = {
        "tables": [
            {"addr": t["addr"], "count": len(t["entries"]),
             "entries": [{"src": e["src"], "dest": e["dest"], "size": e["size"], "kind": e["kind"]}
                         for e in t["entries"]]}
            for t in tables
        ],
        "assets": assets,
    }
    with open(os.path.join(args.out, "index.json"), "w") as f:
        json.dump(index, f, indent=2)

    by_kind = {}
    for a in assets:
        by_kind[a["kind"]] = by_kind.get(a["kind"], 0) + 1
    print("assets extracted: %d  (failed %d)" % (ok, failed))
    for k, v in sorted(by_kind.items()):
        print("   %-12s %d" % (k, v))
    print("total tiles: %d" % sum(a["tiles"] for a in assets if "tiles" in a.get("kind", "")))


if __name__ == "__main__":
    main()
