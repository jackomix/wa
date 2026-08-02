#!/usr/bin/env python3
"""
Scan the WarioWare ROM for CompressedGraphics assets and decode them.

Uses the decompressor from the ShaffySwitcher/wariowareinc decompilation,
whose baserom target is this exact ROM (sha1 3f556448...). Verified
byte-exact against that project's own extracted `title_obj.4bpp`.

The game does NOT use standard GBA BIOS LZ77 — it has a custom nibble
dictionary + RLE + sliding-window scheme, which is why a naive 0x10-header
scan finds nothing. We reuse the real implementation rather than guessing.

Usage:
    python3 scan_gfx.py <rom> <decomp_dir> <out_dir> [--limit N]
"""
import argparse
import json
import os
import struct
import sys

ROM_BASE = 0x08000000


def load_decompressor(decomp_dir):
    sys.path.insert(0, os.path.join(decomp_dir, "tools"))
    import decompression  # noqa
    return decompression


def is_plausible_tileset(data_bytes):
    """4bpp tile data is a multiple of 32 bytes (8x8 px at 4bpp)."""
    n = len(data_bytes)
    if n < 64 or n % 32 != 0:
        return False
    # reject all-zero / all-same blocks (padding, not art)
    if len(set(data_bytes)) < 3:
        return False
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("rom")
    ap.add_argument("decomp")
    ap.add_argument("out")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--start", type=lambda x: int(x, 0), default=0x08000000)
    ap.add_argument("--end", type=lambda x: int(x, 0), default=0x08800000)
    args = ap.parse_args()

    dec = load_decompressor(args.decomp)
    rom = open(args.rom, "rb").read()
    os.makedirs(args.out, exist_ok=True)

    found = []
    errors = 0
    addr = args.start
    step = 4

    while addr < min(args.end, ROM_BASE + len(rom)):
        try:
            res = dec.decompress_compressed_data(rom, addr)
            hw = res["output"]
            raw = struct.pack("<%dH" % len(hw), *hw)
            if is_plausible_tileset(raw):
                found.append({
                    "addr": addr,
                    "bytes": len(raw),
                    "tiles": len(raw) // 32,
                    "double": bool(res.get("double_compressed")),
                })
                name = "gfx_%08X.4bpp" % addr
                with open(os.path.join(args.out, name), "wb") as f:
                    f.write(raw)
                if args.limit and len(found) >= args.limit:
                    break
        except Exception:
            errors += 1
        addr += step

    with open(os.path.join(args.out, "index.json"), "w") as f:
        json.dump(found, f, indent=2)

    print("scanned 0x%08X..0x%08X" % (args.start, args.end))
    print("assets decoded: %d" % len(found))
    total = sum(x["tiles"] for x in found)
    print("total tiles: %d" % total)


if __name__ == "__main__":
    main()
