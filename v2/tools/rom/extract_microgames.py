#!/usr/bin/env python3
"""
Extract per-microgame asset bundles from the ROM.

Each microgame in WarioWare loads its art through one GraphicsTable. The
palette lives immediately after the table's terminator in the same data
blob. So a "bundle" is:

    GraphicsTable @A
      -> bg_tiles / bg_map / obj_tiles  (custom-compressed, decoded)
      -> palettes found in the 0x400 bytes following the table

This gives a real, in-game-accurate asset group per microgame without any
guessing about which colours go with which sprites.

Outputs:
    <out>/bundle_<addr>/           tiles.bin, map.bin, obj.bin, pal.json
    <out>/bundle_<addr>/sheet.png  rendered with the real palette
    <out>/bundles.json             index

Usage: python3 extract_microgames.py <rom> <decomp> <out> [--max N]
"""
import argparse
import json
import os
import struct
import sys
import zlib

ROM_BASE = 0x08000000


def bgr(v):
    r = (v & 0x1F) << 3
    g = ((v >> 5) & 0x1F) << 3
    b = ((v >> 10) & 0x1F) << 3
    return (r | r >> 5, g | g >> 5, b | b >> 5)


def is_pal_at(rom, off, n=16):
    if off < 0 or off + n * 2 > len(rom):
        return False
    v = struct.unpack_from("<%dH" % n, rom, off)
    if any(x & 0x8000 for x in v):
        return False
    return len(set(v)) >= 4


def decode_tiles(data):
    out = []
    for t in range(len(data) // 32):
        b = t * 32
        g = []
        for y in range(8):
            row = []
            for x in range(0, 8, 2):
                by = data[b + y * 4 + x // 2]
                row.append(by & 0xF)
                row.append(by >> 4)
            g.append(row)
        out.append(g)
    return out


def write_png(path, w, h, rows):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    def ch(tag, d):
        return struct.pack(">I", len(d)) + tag + d + struct.pack(">I", zlib.crc32(tag + d) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n"
    png += ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += ch(b"IDAT", zlib.compress(raw, 6))
    png += ch(b"IEND", b"")
    open(path, "wb").write(png)


def render(tiles, pal, cols=16):
    rows_n = (len(tiles) + cols - 1) // cols
    W, H = cols * 8, rows_n * 8
    img = [[0] * (W * 4) for _ in range(H)]
    for ti, g in enumerate(tiles):
        tx, ty = (ti % cols) * 8, (ti // cols) * 8
        for y in range(8):
            for x in range(8):
                ci = g[y][x]
                o = (tx + x) * 4
                if ci == 0:
                    img[ty + y][o:o + 4] = [0, 0, 0, 0]
                else:
                    r, gg, b = pal[ci % len(pal)]
                    img[ty + y][o:o + 4] = [r, gg, b, 255]
    return W, H, img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("rom")
    ap.add_argument("decomp")
    ap.add_argument("out")
    ap.add_argument("--gfx", default=None, help="dir from find_gfx_tables.py")
    ap.add_argument("--max", type=int, default=0)
    args = ap.parse_args()

    sys.path.insert(0, os.path.join(args.decomp, "tools"))
    import decompression as dec

    rom = open(args.rom, "rb").read()
    gfxdir = args.gfx or args.out
    idx = json.load(open(os.path.join(gfxdir, "index.json")))
    os.makedirs(args.out, exist_ok=True)

    bundles = []
    tables = idx["tables"]
    if args.max:
        tables = tables[: args.max]

    for t in tables:
        addr = t["addr"]
        # palettes immediately after the table terminator
        # Palettes follow the table as ONE CONTIGUOUS 16-bank block (0x200
        # bytes = 16 banks x 16 colours). A tilemap entry's bits 12-15 index
        # into that block, so we must keep the banks in order and aligned to
        # the block start -- filtering out "boring" banks would shift every
        # subsequent index and mis-colour the screen.
        end = addr + t["count"] * 12 + 12
        base = None
        a = end
        while a < end + 0x100:
            if is_pal_at(rom, a - ROM_BASE):
                base = a
                break
            a += 4
        if base is None:
            continue
        pals = []
        for bank in range(16):
            pa = base + bank * 32
            if pa - ROM_BASE + 32 > len(rom):
                break
            v = struct.unpack_from("<16H", rom, pa - ROM_BASE)
            pals.append({"addr": pa, "bank": bank, "colors": [bgr(x) for x in v]})
        if not pals:
            continue

        bdir = os.path.join(args.out, "bundle_%08X" % addr)
        os.makedirs(bdir, exist_ok=True)

        info = {"table": "0x%08X" % addr, "assets": [], "palettes": []}
        for p in pals:
            info["palettes"].append({
                "addr": "0x%08X" % p["addr"],
                "bank": p["bank"],
                "colors": ["#%02x%02x%02x" % c for c in p["colors"]],
            })

        first_pal = pals[0]["colors"]
        for e in t["entries"]:
            if e["size"] != -1:
                continue
            try:
                res = dec.decompress_compressed_data(rom, e["src"])
                raw = struct.pack("<%dH" % len(res["output"]), *res["output"])
            except Exception:
                continue
            fn = "%s_%08X.bin" % (e["kind"], e["src"])
            open(os.path.join(bdir, fn), "wb").write(raw)
            info["assets"].append({
                "kind": e["kind"], "src": "0x%08X" % e["src"],
                "bytes": len(raw), "tiles": len(raw) // 32, "file": fn,
            })
            if e["kind"] in ("obj_tiles", "bg_tiles"):
                # obj uses the later palette when there are several
                pal = pals[-1]["colors"] if (e["kind"] == "obj_tiles" and len(pals) > 1) else first_pal
                tiles = decode_tiles(raw)
                if tiles:
                    W, H, img = render(tiles, pal)
                    write_png(os.path.join(bdir, fn.replace(".bin", ".png")), W, H, img)

        json.dump(info, open(os.path.join(bdir, "bundle.json"), "w"), indent=2)
        bundles.append({
            "table": "0x%08X" % addr,
            "dir": os.path.basename(bdir),
            "assets": len(info["assets"]),
            "palettes": len(pals),
            "tiles": sum(x["tiles"] for x in info["assets"]),
        })

    json.dump(bundles, open(os.path.join(args.out, "bundles.json"), "w"), indent=2)
    print("bundles: %d" % len(bundles))
    print("total tiles: %d" % sum(b["tiles"] for b in bundles))


if __name__ == "__main__":
    main()
