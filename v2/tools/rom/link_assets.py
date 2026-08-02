#!/usr/bin/env python3
"""
Link each microgame to its REAL GraphicsTable by tracing its startFunc.

The `unk4` field of GameplayMicrogameInfo is NOT a GraphicsTable -- it points
at sprite/animation data. The actual graphics table is passed in R1 to
`load_graphics` (func_08002124) inside the microgame's startFunc:

    ldr r0, =<subscene state + 4>
    ldr r1, =0x083CB78C        <-- the GraphicsTable
    movs r2, #0x80 ; lsls r2,#6
    bl  0x8002124              <-- load_graphics(dest, table, size)

So we disassemble each startFunc, track the last literal-pool value loaded
into R1 before the call, and that address is the microgame's asset table.

This is what finally lets us say "microgame #N looks like THIS", pairing the
disassembled logic with the decoded tiles/palettes.

Usage: python3 link_assets.py <rom> <mgtable.json> <out.json>
"""
import argparse
import json
import struct
from collections import Counter

from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB

ROM_BASE = 0x08000000
ROM_END = 0x08800000
LOAD_GRAPHICS = 0x08002124
LOAD_GRAPHICS_ALT = 0x080021C8


def is_rom(v):
    return ROM_BASE <= v < ROM_END


def trace_graphics_tables(rom, addr, max_bytes=0x800):
    """Return every GraphicsTable address passed to load_graphics()."""
    md = Cs(CS_ARCH_ARM, CS_MODE_THUMB)
    a = addr & ~1
    code = rom[a - ROM_BASE: a - ROM_BASE + max_bytes]
    regs = {}
    tables = []

    for ins in md.disasm(code, a):
        op = ins.op_str or ""

        # literal pool load -> remember the register's value
        if ins.mnemonic == "ldr" and "[pc," in op:
            try:
                dst = op.split(",")[0].strip()
                disp = int(op.split("#")[-1].rstrip("]"), 0)
                pool = ((ins.address + 4) & ~3) + disp
                if ROM_BASE <= pool < ROM_END - 4:
                    regs[dst] = struct.unpack_from("<I", rom, pool - ROM_BASE)[0]
            except Exception:
                pass
        elif ins.mnemonic in ("movs", "mov") and "#" in op:
            try:
                dst = op.split(",")[0].strip()
                regs[dst] = int(op.split("#")[-1], 0)
            except Exception:
                pass
        elif ins.mnemonic in ("adds", "add") and "#" in op:
            parts = [p.strip() for p in op.split(",")]
            if len(parts) >= 2 and parts[0] in regs:
                pass  # value no longer a clean pointer; leave as-is

        if ins.mnemonic == "bl":
            try:
                tgt = int(op.strip("# "), 0)
            except Exception:
                continue
            if tgt in (LOAD_GRAPHICS, LOAD_GRAPHICS_ALT):
                v = regs.get("r1")
                if v and is_rom(v):
                    tables.append(v)

        if ins.mnemonic == "pop" and "pc" in op:
            break
    return tables


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("rom")
    ap.add_argument("table")
    ap.add_argument("out")
    args = ap.parse_args()

    rom = open(args.rom, "rb").read()
    entries = json.load(open(args.table))

    out = []
    hit = 0
    for e in entries:
        ss = int(e["subscene"], 16)
        try:
            start = struct.unpack_from("<I", rom, ss - ROM_BASE)[0]
        except Exception:
            continue
        tables = trace_graphics_tables(rom, start) if is_rom(start) else []
        if tables:
            hit += 1
        out.append({
            "id": e["id"],
            "subscene": e["subscene"],
            "spriteData": e["gfxTable"],       # the original unk4
            "graphicsTables": ["0x%08X" % t for t in dict.fromkeys(tables)],
            "timerValue": e["flag9"],
        })

    json.dump(out, open(args.out, "w"), indent=2)
    print("microgames traced: %d" % len(out))
    print("with a resolved GraphicsTable: %d" % hit)

    c = Counter()
    for o in out:
        for t in o["graphicsTables"]:
            c[t] += 1
    print("unique graphics tables referenced: %d" % len(c))
    print("\nmost shared tables (common backdrops / host sets):")
    for k, v in c.most_common(8):
        print("   %s  used by %d microgames" % (k, v))


if __name__ == "__main__":
    main()
