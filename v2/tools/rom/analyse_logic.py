#!/usr/bin/env python3
"""
Turn each microgame's disassembly into a RECREATION SPEC.

We now know the shape of a microgame's implementation, so we can read the
facts that actually matter for a faithful rebuild instead of eyeballing
gameplay footage:

  gGameplayData offsets (base pointer + immediate, the LSLS #1 idiom):
      0xBA*2 = 0x174  currentDifficulty
      0xBB*2 = 0x176  maxLives
      0xBC*2 = 0x178  outcome flag  (1 = failed)
      0xBE*2 = 0x17C  currentScore

  Shared engine calls seen across microgames:
      0x08001120  random         (arg = modulus)
      0x0800A0C4  set outcome    (2 = win, else lose)
      0x08002124  load graphics table
      0x0800BEF4 / BF0C / BF20 / BF34 / BF44   BG layer + scroll setup
      0x080EEDE0 / 0x080EF3BC                  sprite create / update

What we extract per microgame:
  * difficulty branches      -> how many tiers and what changes
  * random calls + moduli    -> the real randomisation ranges
  * outcome call sites       -> win vs lose paths
  * literal constants        -> speeds, coordinates, thresholds
  * input polling            -> which buttons the microgame reads

Output: recreation_specs.json, one record per microgame.

Usage: python3 analyse_logic.py <rom> <mgtable.json> <out.json>
"""
import argparse
import json
import re
import struct
from collections import Counter

from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB

ROM_BASE = 0x08000000
ROM_END = 0x08800000

FN = {
    0x08001120: "random",
    0x0800A0C4: "set_outcome",
    0x08002124: "load_graphics",
    0x0800BEF4: "bg_setup_a",
    0x0800BF0C: "bg_setup_b",
    0x0800BF20: "bg_setup_c",
    0x0800BF34: "bg_scroll",
    0x0800BF44: "bg_config",
    0x080EEDE0: "sprite_op_a",
    0x080EF3BC: "sprite_op_b",
    0x080EF224: "sprite_op_c",
    0x080EF50C: "sprite_op_d",
    0x080EF5C4: "sprite_op_e",
    0x0800A128: "beatscript_signal",
    0x0800A27C: "helper_a27c",
    0x0800C9A4: "helper_c9a4",
    0x08001E58: "helper_1e58",
    0x080F41F0: "math_helper",
}

GD = {0x174: "currentDifficulty", 0x176: "maxLives", 0x178: "outcomeFlag", 0x17C: "currentScore"}

# GBA key bits (gCurrentKeys / gPressedKeys)
KEYS = {0x001: "A", 0x002: "B", 0x004: "SELECT", 0x008: "START",
        0x010: "RIGHT", 0x020: "LEFT", 0x040: "UP", 0x080: "DOWN",
        0x100: "R", 0x200: "L"}

# Input globals (addresses from the decompilation's undefined_syms.ld)
KEYVARS = {
    0x03003FC8: "gCurrentKeys",    # held this frame
    0x03003FC0: "gPrevKeys",
    0x03003FF4: "gPressedKeys",    # newly pressed this frame
    0x03004884: "gRepeatedKeys",
}

rom_ref = [b""]


def u32(rom, a):
    return struct.unpack_from("<I", rom, a - ROM_BASE)[0]


def is_rom(v):
    return ROM_BASE <= v < ROM_END


def disasm(rom, addr, max_bytes=0x800):
    md = Cs(CS_ARCH_ARM, CS_MODE_THUMB)
    a = addr & ~1
    code = rom[a - ROM_BASE: a - ROM_BASE + max_bytes]
    out = []
    for ins in md.disasm(code, a):
        out.append(ins)
        if ins.mnemonic == "pop" and "pc" in ins.op_str:
            break
        if ins.mnemonic == "bx" and ins.op_str.strip() == "lr":
            break
    return out


def analyse_fn(rom, addr):
    ins = disasm(rom, addr)
    calls = Counter()
    keyvars = Counter()
    randoms = []
    gd_touch = Counter()
    consts = Counter()
    keys = Counter()
    branches = 0
    last_imm = None

    for i, x in enumerate(ins):
        if x.mnemonic in ("bl", "blx"):
            try:
                t = int(x.op_str.strip("# "), 0)
            except Exception:
                continue
            calls[FN.get(t, "0x%08X" % t)] += 1
            if t == 0x08001120 and last_imm is not None:
                randoms.append(last_imm)
        if x.mnemonic.startswith("b") and x.mnemonic not in ("bl", "blx", "bx"):
            branches += 1

        # Key state is read through globals loaded from the literal pool,
        # not as immediates -- that is why an immediate-only scan found
        # nothing. gPressedKeys => edge-triggered ("on press"),
        # gCurrentKeys => level ("while held").
        if x.mnemonic == "ldr" and "[pc," in (x.op_str or ""):
            try:
                disp = int(x.op_str.split("#")[-1].rstrip("]"), 0)
                pool = ((x.address + 4) & ~3) + disp
                pv = struct.unpack_from("<I", rom_ref[0], pool - ROM_BASE)[0]
                if pv in KEYVARS:
                    keyvars[KEYVARS[pv]] += 1
            except Exception:
                pass

        m = re.search(r"#(0x[0-9a-fA-F]+|\d+)", x.op_str or "")
        if m:
            try:
                v = int(m.group(1), 0)
            except Exception:
                v = None
            if v is not None:
                if x.mnemonic in ("movs", "mov"):
                    last_imm = v
                # the "movs rN,#imm ; lsls rN,#1" idiom addresses gGameplayData
                if x.mnemonic == "lsls" and "#1" in x.op_str and last_imm is not None:
                    off = last_imm * 2
                    if off in GD:
                        gd_touch[GD[off]] += 1
                if 0 < v <= 0x400:
                    consts[v] += 1
                # Only count a value as a button mask when it is actually used
                # in a bit test. Plain `movs r0,#1` is far too common to mean
                # "polls the A button" -- that over-match reported every
                # microgame as reading every key.
                if v in KEYS and x.mnemonic in ("ands", "tst", "and", "bic", "cmp"):
                    keys[KEYS[v]] += 1

    return {
        "instructions": len(ins),
        "calls": dict(calls),
        "randomModuli": sorted(set(randoms)),
        "gameplayData": dict(gd_touch),
        "branches": branches,
        "topConstants": [k for k, _ in consts.most_common(14)],
        "keysPolled": sorted(keys),
        "inputGlobals": sorted(keyvars),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("rom")
    ap.add_argument("table")
    ap.add_argument("out")
    args = ap.parse_args()

    rom = open(args.rom, "rb").read()
    rom_ref[0] = rom
    table = json.load(open(args.table))
    specs = []

    for e in table:
        ss = int(e["subscene"], 16)
        try:
            start = u32(rom, ss)
            update = u32(rom, ss + 0x10)
        except Exception:
            continue
        rec = {
            "id": e["id"],
            "gfxTable": e["gfxTable"],
            "timerValue": e["flag9"],
            "subscene": e["subscene"],
        }
        for label, fnaddr in (("start", start), ("update", update)):
            if is_rom(fnaddr):
                rec[label] = analyse_fn(rom, fnaddr)
        # merged view
        allcalls = Counter()
        for label in ("start", "update"):
            for k, v in (rec.get(label, {}).get("calls") or {}).items():
                allcalls[k] += v
        rec["usesRandom"] = "random" in allcalls
        rec["setsOutcome"] = "set_outcome" in allcalls
        rec["readsDifficulty"] = any(
            "currentDifficulty" in (rec.get(l, {}).get("gameplayData") or {})
            for l in ("start", "update")
        )
        rec["keys"] = sorted(set(
            (rec.get("start", {}).get("keysPolled") or []) +
            (rec.get("update", {}).get("keysPolled") or [])
        ))
        rec["inputGlobals"] = sorted(set(
            (rec.get("start", {}).get("inputGlobals") or []) +
            (rec.get("update", {}).get("inputGlobals") or [])
        ))
        rec["readsInput"] = bool(rec["inputGlobals"])
        specs.append(rec)

    json.dump(specs, open(args.out, "w"), indent=2)

    print("microgames analysed: %d" % len(specs))
    print("  read currentDifficulty: %d" % sum(1 for s in specs if s["readsDifficulty"]))
    print("  use randomisation:      %d" % sum(1 for s in specs if s["usesRandom"]))
    print("  set win/lose outcome:   %d" % sum(1 for s in specs if s["setsOutcome"]))

    mods = Counter()
    for s in specs:
        for l in ("start", "update"):
            for m in (s.get(l, {}).get("randomModuli") or []):
                mods[m] += 1
    print("\nmost common random moduli (real randomisation ranges):")
    for k, v in mods.most_common(12):
        print("   rand(%d)  used %d times" % (k, v))

    print("  read player input:      %d" % sum(1 for s in specs if s.get("readsInput")))

    kc = Counter()
    for s in specs:
        kc.update(s["keys"])
    print("\nbutton masks bit-tested across the roster:")
    for k, v in kc.most_common():
        print("   %-6s %d microgames" % (k, v))

    gc = Counter()
    for s in specs:
        gc.update(s.get("inputGlobals") or [])
    print("\ninput globals referenced (how input is sampled):")
    for k, v in gc.most_common():
        print("   %-14s %d microgames" % (k, v))


if __name__ == "__main__":
    main()
