#!/usr/bin/env python3
"""
Read the game's MASTER MICROGAME TABLE straight out of the ROM.

The decompilation declares it:

    extern struct GameplayMicrogameInfo D_083A50E0[];

    struct GameplayMicrogameInfo {   // 16 bytes
        void* unk0;   // -> SubScene (start/paused/update/stop fn + beatscript)
        void* unk4;   // -> GraphicsTable for this microgame
        u8    unk8;   // difficulty / length flags
        u8    unk9;
        u8    padA[2];
        void* unkC;   // -> extra data (often the command/prompt art)
    };

So entry N of this table IS microgame N. Its `unk4` pointer is exactly the
GraphicsTable address our extractor already keyed bundles by — which lets us
map "bundle_083XXXXX" to a real microgame ID instead of guessing.

`unk0` points at a SubScene:

    struct SubScene {
        void (*startFunc)();  s32 startParam;
        void (*pausedFunc)(); s32 pausedParam;
        void (*updateFunc)(); s32 updateParam;
        void (*stopFunc)();   s32 stopParam;
        const struct Beatscript *script;
    };

The `script` pointer is the microgame's actual bytecode — the real logic.

Usage: python3 read_microgame_table.py <rom> <out.json> [--table 0x083A50E0]
"""
import argparse
import json
import struct

ROM_BASE = 0x08000000
ROM_END = 0x08800000


def u32(d, a):
    return struct.unpack_from("<I", d, a - ROM_BASE)[0]


def u8(d, a):
    return d[a - ROM_BASE]


def is_rom(v):
    return ROM_BASE <= v < ROM_END


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("rom")
    ap.add_argument("out")
    ap.add_argument("--table", type=lambda x: int(x, 0), default=0x083A50E0)
    ap.add_argument("--max", type=int, default=300)
    args = ap.parse_args()

    rom = open(args.rom, "rb").read()
    entries = []
    a = args.table

    for i in range(args.max):
        base = a + i * 16
        try:
            p0 = u32(rom, base)
            p4 = u32(rom, base + 4)
            f8 = u8(rom, base + 8)
            f9 = u8(rom, base + 9)
            pc = u32(rom, base + 12)
        except Exception:
            break

        # table ends when the pointers stop being plausible
        if not (is_rom(p0) and is_rom(p4)):
            break

        e = {
            "id": i,
            "addr": "0x%08X" % base,
            "subscene": "0x%08X" % p0,
            "gfxTable": "0x%08X" % p4,
            "gfxTableInt": p4,
            "flag8": f8,
            "flag9": f9,
            "extra": ("0x%08X" % pc) if is_rom(pc) else None,
        }

        # follow the SubScene to its beatscript (5th word = script ptr)
        try:
            start_fn = u32(rom, p0)
            script = u32(rom, p0 + 32)
            e["startFunc"] = "0x%08X" % start_fn if is_rom(start_fn) else None
            e["script"] = "0x%08X" % script if is_rom(script) else None
        except Exception:
            pass

        entries.append(e)

    json.dump(entries, open(args.out, "w"), indent=2)
    print("microgame table @ 0x%08X" % args.table)
    print("entries read: %d" % len(entries))
    uniq_gfx = len({e["gfxTable"] for e in entries})
    uniq_scr = len({e.get("script") for e in entries if e.get("script")})
    print("unique gfx tables: %d" % uniq_gfx)
    print("unique beatscripts: %d" % uniq_scr)
    print()
    for e in entries[:12]:
        print("  #%3d  gfx=%s  subscene=%s  script=%s  f8=%d f9=%d"
              % (e["id"], e["gfxTable"], e["subscene"], e.get("script"), e["flag8"], e["flag9"]))


if __name__ == "__main__":
    main()
