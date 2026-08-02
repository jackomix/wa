#!/usr/bin/env python3
"""
Disassemble a microgame's beatscript straight from the ROM.

This is the actual logic of the microgame — its bytecode, not a guess about
its behaviour. Opcode names come from the decompilation's
`enum BeatscriptCommand` (src/beatscript.h) and the assembler macros in
`include/beatscript_main.inc`.

    struct Beatscript { u32 command:8; u32 param1:24; u32 param2; u32 param3; }
    -> 16 bytes per instruction

Timing: `rest N` sets timeUntilNext = N<<8, decremented by
deltaTime = (tempo<<8)/150 each frame, so **24 units = 1 beat**.
The disassembler annotates rests in beats.

Usage:
    python3 disasm_beatscript.py <rom> 0x083CB888
    python3 disasm_beatscript.py <rom> --all <mgtable.json> --out scripts/
"""
import argparse
import json
import os
import struct

ROM_BASE = 0x08000000
ROM_END = 0x08800000
TICKS_PER_BEAT = 24

OPS = {
    0x00: "stop", 0x01: "scene_run", 0x02: "run", 0x03: "set_var_32",
    0x04: "set_var_16", 0x05: "set_var_8", 0x06: "rest", 0x09: "play_music",
    0x0A: "play_sfx", 0x10: "call", 0x11: "return", 0x14: "goto",
    0x15: "loop_start", 0x16: "loop_end", 0x17: "if_neq_32", 0x18: "if_neq_16",
    0x19: "if_neq_8", 0x1A: "if_eq_32", 0x1B: "if_eq_16", 0x1C: "if_eq_8",
    0x1D: "else", 0x1E: "endif", 0x27: "switch_32", 0x28: "switch_16",
    0x29: "switch_8", 0x2A: "end_switch", 0x2B: "case", 0x2C: "break",
    0x2D: "load_graphics", 0x2E: "play_music2", 0x30: "set_speed",
    0x33: "interp_lcd_blend", 0x34: "change_palette", 0x35: "set_bg_reg",
    0x36: "add_32", 0x37: "add_16", 0x38: "add_8", 0x3E: "load_graphics_async",
    0x41: "fade_screen", 0x44: "if_result_eq", 0x48: "default_case",
    0x4A: "setbit_32", 0x4B: "setbit_16", 0x4C: "setbit_8",
    0x4D: "clearbit_32", 0x4E: "clearbit_16", 0x4F: "clearbit_8",
    0x82: "sprite_set_playback", 0x83: "sprite_set_xyz", 0x84: "sprite_set_xy",
    0x85: "sprite_set_z", 0x86: "sprite_render", 0x94: "sprite_add_xy",
    0x95: "sprite_add_z",
}

# ops whose param3 is a ROM pointer worth following
PTR_OPS = {0x01, 0x02, 0x10, 0x14, 0x2D, 0x3E, 0x09, 0x0A, 0x34, 0x2E}
# ops that end a linear run
END_OPS = {0x00, 0x11, 0x14}


def disasm(rom, addr, limit=400):
    out = []
    a = addr
    for _ in range(limit):
        off = a - ROM_BASE
        if off < 0 or off + 16 > len(rom):
            break
        w0, p2, p3 = struct.unpack_from("<III", rom, off)
        op = w0 & 0xFF
        p1 = w0 >> 8
        name = OPS.get(op, "op_%02X" % op)

        note = ""
        if op == 0x06:
            note = "  ; %.3g beat(s)" % (p3 / TICKS_PER_BEAT)
        elif op in PTR_OPS and ROM_BASE <= p3 < ROM_END:
            note = "  ; -> 0x%08X" % p3

        out.append({
            "addr": "0x%08X" % a, "op": op, "name": name,
            "p1": p1, "p2": p2, "p3": p3, "note": note.strip("; ").strip(),
        })
        if op in END_OPS:
            break
        a += 16
    return out


def total_beats(instrs):
    return sum(i["p3"] for i in instrs if i["op"] == 0x06) / TICKS_PER_BEAT


def fmt(instrs):
    lines = []
    for i in instrs:
        args = ""
        if i["op"] == 0x06:
            args = "%d" % i["p3"]
        elif i["p1"] or i["p2"] or i["p3"]:
            args = "0x%X, 0x%X, 0x%X" % (i["p1"], i["p2"], i["p3"])
        line = "%s  %-22s %s" % (i["addr"], i["name"], args)
        if i["note"]:
            line += "   ; " + i["note"]
        lines.append(line)
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("rom")
    ap.add_argument("addr", nargs="?", default=None)
    ap.add_argument("--all", default=None, help="mgtable.json from read_microgame_table.py")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    rom = open(args.rom, "rb").read()

    if args.all:
        table = json.load(open(args.all))
        os.makedirs(args.out or "scripts", exist_ok=True)
        summary = []
        for e in table:
            s = e.get("script")
            if not s:
                continue
            instrs = disasm(rom, int(s, 16))
            beats = total_beats(instrs)
            ops_used = sorted({i["name"] for i in instrs})
            path = os.path.join(args.out or "scripts", "mg_%03d_%s.txt" % (e["id"], s[2:]))
            with open(path, "w") as f:
                f.write("; microgame #%d\n; subscene %s  gfx %s  flags %d/%d\n; %d instructions, %.3g beats of rest\n\n"
                        % (e["id"], e["subscene"], e["gfxTable"], e["flag8"], e["flag9"], len(instrs), beats))
                f.write(fmt(instrs) + "\n")
            summary.append({
                "id": e["id"], "script": s, "gfxTable": e["gfxTable"],
                "instructions": len(instrs), "restBeats": beats,
                "flag8": e["flag8"], "flag9": e["flag9"], "ops": ops_used,
            })
        json.dump(summary, open(os.path.join(args.out or "scripts", "summary.json"), "w"), indent=2)
        print("disassembled %d beatscripts -> %s" % (len(summary), args.out or "scripts"))
        import collections
        c = collections.Counter()
        for s in summary:
            c.update(s["ops"])
        print("\nmost common opcodes across all microgames:")
        for k, v in c.most_common(20):
            print("   %-24s %d" % (k, v))
        return

    instrs = disasm(rom, int(args.addr, 16))
    print(fmt(instrs))
    print("\n; %d instructions, %.3g beats of rest" % (len(instrs), total_beats(instrs)))


if __name__ == "__main__":
    main()
