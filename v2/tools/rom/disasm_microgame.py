#!/usr/bin/env python3
"""
Disassemble a microgame's ACTUAL implementation (THUMB code) from the ROM.

The beatscript attached to a microgame turns out to be a thin timing shell
(`rest N; stop`). The real behaviour lives in the SubScene's C functions:

    struct SubScene {           // 0x24 bytes
        +0x00 startFunc  +0x04 startParam
        +0x08 pausedFunc +0x0C pausedParam
        +0x10 updateFunc +0x14 updateParam
        +0x18 stopFunc   +0x1C stopParam
        +0x20 script
    };

`startFunc` sets the microgame up (initial positions, difficulty branch,
which sprite/anim to use). `updateFunc` runs every frame and is where the
win/lose call, the hit test and the movement live.

What this extracts per microgame:
  * the disassembly itself
  * calls to `gameplay_check_collision`  -> the real hit test
  * calls to the win/lose helpers        -> the actual success condition
  * immediate constants                  -> speeds, positions, thresholds
  * difficulty branches on currentDifficulty

Usage:
  python3 disasm_microgame.py <rom> --id 0 --table /tmp/mgtable.json
  python3 disasm_microgame.py <rom> --all /tmp/mgtable.json --out /tmp/mgcode
"""
import argparse
import json
import os
import struct

from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB

ROM_BASE = 0x08000000
ROM_END = 0x08800000

# Known engine entry points (from the decompilation's symbol table / headers)
KNOWN = {
    0x08008A24: "gameplay_check_collision",   # see note below
}


def u32(rom, a):
    return struct.unpack_from("<I", rom, a - ROM_BASE)[0]


def is_rom(v):
    return ROM_BASE <= v < ROM_END


def read_subscene(rom, addr):
    f = {}
    for name, off in (("start", 0x00), ("paused", 0x08), ("update", 0x10),
                      ("stop", 0x18), ("script", 0x20)):
        v = u32(rom, addr + off)
        f[name] = v if is_rom(v) else None
    return f


def disasm_fn(rom, addr, max_bytes=0x600):
    """Disassemble THUMB from `addr` until a plausible function end."""
    md = Cs(CS_ARCH_ARM, CS_MODE_THUMB)
    md.detail = True
    a = addr & ~1
    off = a - ROM_BASE
    code = rom[off:off + max_bytes]
    out = []
    depth_pop = False
    for ins in md.disasm(code, a):
        out.append(ins)
        # crude terminator: POP {...,pc} or BX lr after we've seen a push
        if ins.mnemonic == "pop" and "pc" in ins.op_str:
            depth_pop = True
            break
        if ins.mnemonic == "bx" and ins.op_str.strip() == "lr":
            depth_pop = True
            break
    return out, depth_pop


def analyse(rom, addr):
    ins_list, ok = disasm_fn(rom, addr)
    calls = []
    imms = []
    for i in ins_list:
        if i.mnemonic in ("bl", "blx"):
            try:
                tgt = int(i.op_str.strip("# "), 0)
                calls.append(tgt)
            except Exception:
                pass
        # literal pool loads are the usual source of constants/pointers
        if i.mnemonic == "ldr" and "[pc," in i.op_str:
            try:
                disp = int(i.op_str.split("#")[-1].rstrip("]"), 0)
                pool = ((i.address + 4) & ~3) + disp
                if ROM_BASE <= pool < ROM_END - 4:
                    imms.append(u32(rom, pool))
            except Exception:
                pass
        for m in ("mov", "movs", "cmp", "adds", "subs"):
            if i.mnemonic == m and "#" in i.op_str:
                try:
                    imms.append(int(i.op_str.split("#")[-1], 0))
                except Exception:
                    pass
    return {
        "instructions": len(ins_list),
        "terminated": ok,
        "calls": calls,
        "constants": imms,
        "text": ["0x%08X  %-8s %s" % (i.address, i.mnemonic, i.op_str) for i in ins_list],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("rom")
    ap.add_argument("--table", default="/tmp/mgtable.json")
    ap.add_argument("--id", type=int, default=None)
    ap.add_argument("--all", default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    rom = open(args.rom, "rb").read()
    table = json.load(open(args.all or args.table))

    if args.id is not None:
        e = next(x for x in table if x["id"] == args.id)
        ss = read_subscene(rom, int(e["subscene"], 16))
        print("microgame #%d  gfx=%s  flags=%d/%d" % (e["id"], e["gfxTable"], e["flag8"], e["flag9"]))
        for k in ("start", "update"):
            if not ss[k]:
                continue
            r = analyse(rom, ss[k])
            print("\n=== %sFunc 0x%08X  (%d instrs) ===" % (k, ss[k], r["instructions"]))
            print("\n".join(r["text"][:80]))
            print("calls:", ["0x%08X" % c for c in sorted(set(r["calls"]))][:12])
        return

    os.makedirs(args.out or "mgcode", exist_ok=True)
    summary = []
    callcount = {}
    for e in table:
        ss = read_subscene(rom, int(e["subscene"], 16))
        rec = {"id": e["id"], "gfxTable": e["gfxTable"],
               "flag8": e["flag8"], "flag9": e["flag9"]}
        lines = ["; microgame #%d" % e["id"],
                 "; subscene %s  gfx %s  flags %d/%d" % (e["subscene"], e["gfxTable"], e["flag8"], e["flag9"])]
        for k in ("start", "update"):
            if not ss[k]:
                continue
            r = analyse(rom, ss[k])
            rec["%sInstr" % k] = r["instructions"]
            rec["%sCalls" % k] = sorted(set("0x%08X" % c for c in r["calls"]))
            for c in r["calls"]:
                callcount[c] = callcount.get(c, 0) + 1
            lines.append("\n=== %sFunc 0x%08X (%d instrs) ===" % (k, ss[k], r["instructions"]))
            lines += r["text"]
        with open(os.path.join(args.out or "mgcode", "mg_%03d.asm" % e["id"]), "w") as f:
            f.write("\n".join(lines) + "\n")
        summary.append(rec)

    json.dump(summary, open(os.path.join(args.out or "mgcode", "summary.json"), "w"), indent=2)
    print("disassembled %d microgames -> %s" % (len(summary), args.out or "mgcode"))
    tot = sum(s.get("updateInstr", 0) for s in summary)
    print("total updateFunc instructions: %d" % tot)
    print("\nmost-called shared engine functions (candidates for win/lose/collision):")
    for a, n in sorted(callcount.items(), key=lambda x: -x[1])[:20]:
        print("   0x%08X  called by %d microgames" % (a, n))


if __name__ == "__main__":
    main()
