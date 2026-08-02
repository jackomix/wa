#!/usr/bin/env python3
"""
Find real palettes by scanning for beatscript "Change Palette" commands.

Palettes are NOT in the GraphicsTables — the game loads tiles via the table
and then applies colour separately from its bytecode:

    struct Beatscript { u32 command:8; u32 param1:24; u32 param2; u32 param3; }
    beatscript_cmd 0x34, 0x806001, 0, title_bg_pal
    beatscript_cmd 0x34, 0x80610F, 0, title_obj_pal

So a 16-byte record whose low byte is 0x34 and whose 3rd word is a ROM
pointer gives us a palette address. param1 encodes the destination slot.

We then sanity-check each candidate as BGR555 data (bit 15 clear).

Usage: python3 find_palettes.py <rom> <out.json>
"""
import argparse
import json
import struct
from collections import Counter

ROM_BASE = 0x08000000
ROM_END = 0x08800000


def looks_like_palette(rom, addr, n=16):
    off = addr - ROM_BASE
    if off < 0 or off + n * 2 > len(rom):
        return False
    vals = struct.unpack_from("<%dH" % n, rom, off)
    # BGR555: bit 15 unused, should be 0 across the board
    if any(v & 0x8000 for v in vals):
        return False
    # reject degenerate runs
    if len(set(vals)) < 3:
        return False
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("rom")
    ap.add_argument("out")
    args = ap.parse_args()

    rom = open(args.rom, "rb").read()
    hits = []

    for off in range(0, len(rom) - 16, 4):
        if rom[off] != 0x34:
            continue
        cmd = struct.unpack_from("<I", rom, off)[0]
        p1 = cmd >> 8
        p3 = struct.unpack_from("<I", rom, off + 8)[0]
        if not (ROM_BASE <= p3 < ROM_END):
            continue
        # param1 high bit set is the pattern seen in real scripts (0x806001)
        if not (p1 & 0x800000):
            continue
        if not looks_like_palette(rom, p3):
            continue
        slot = p1 & 0xFFFF
        hits.append({
            "script_addr": ROM_BASE + off,
            "palette_addr": p3,
            "param1": p1,
            "slot": slot,
            "is_obj": bool(p1 & 0x000100),
        })

    uniq = {}
    for h in hits:
        uniq.setdefault(h["palette_addr"], h)

    print("change_palette commands: %d" % len(hits))
    print("unique palette addresses: %d" % len(uniq))
    c = Counter(h["is_obj"] for h in uniq.values())
    print("  obj palettes: %d   bg palettes: %d" % (c[True], c[False]))

    # dump colours for each
    out = []
    for a, h in sorted(uniq.items()):
        off = a - ROM_BASE
        n = 16
        vals = struct.unpack_from("<%dH" % n, rom, off)
        cols = []
        for v in vals:
            r = (v & 0x1F) << 3
            g = ((v >> 5) & 0x1F) << 3
            b = ((v >> 10) & 0x1F) << 3
            cols.append("#%02x%02x%02x" % (r | r >> 5, g | g >> 5, b | b >> 5))
        out.append({
            "addr": "0x%08X" % a,
            "addr_int": a,
            "script_addr": "0x%08X" % h["script_addr"],
            "is_obj": h["is_obj"],
            "colors": cols,
        })

    json.dump(out, open(args.out, "w"), indent=2)
    print("wrote %s" % args.out)


if __name__ == "__main__":
    main()
