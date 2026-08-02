#!/usr/bin/env python3
"""
Render complete microgame BACKGROUNDS by combining tilemap + tileset + palette.

This is the strongest ground truth available short of running the game.
A GBA BG tilemap entry is a u16:

    bits 0-9    tile index into the charblock
    bit  10     horizontal flip
    bit  11     vertical flip
    bits 12-15  palette bank (which 16-colour sub-palette to use)

Because the palette bank is encoded PER TILE, rendering a tilemap gives us
the exact colours the game displays -- no guessing which palette pairs with
which art, which is what made raw sprite dumps look wrong.

Output: one PNG per (tilemap, tileset) pair in a bundle, at true size.

Usage: python3 render_screens.py <bundles_dir> <out_dir> [--max N]
"""
import argparse
import json
import os
import struct
import zlib


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


def hx(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def write_png(path, w, h, rows):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    def ch(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n"
    png += ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += ch(b"IDAT", zlib.compress(raw, 6))
    png += ch(b"IEND", b"")
    open(path, "wb").write(png)


def render_map(mapdata, tiles, palettes, cols=32, rows=20):
    """GBA screen is 30x20 tiles; screenblocks are 32 wide."""
    n = len(mapdata) // 2
    entries = struct.unpack("<%dH" % n, mapdata[: n * 2])
    W, H = cols * 8, rows * 8
    img = [[0] * (W * 4) for _ in range(H)]
    painted = 0

    for i, e in enumerate(entries):
        if i >= cols * rows:
            break
        tx = (i % cols) * 8
        ty = (i // cols) * 8
        idx = e & 0x3FF
        hf = bool(e & 0x400)
        vf = bool(e & 0x800)
        bank = (e >> 12) & 0xF
        if idx >= len(tiles):
            continue
        g = tiles[idx]
        pal = palettes[bank] if bank < len(palettes) else palettes[0]
        for y in range(8):
            sy = 7 - y if vf else y
            for x in range(8):
                sx = 7 - x if hf else x
                ci = g[sy][sx]
                o = (tx + x) * 4
                if ci == 0:
                    continue
                r, gg, b = pal[ci % len(pal)]
                img[ty + y][o:o + 4] = [r, gg, b, 255]
                painted += 1
    return W, H, img, painted


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("bundles")
    ap.add_argument("out")
    ap.add_argument("--max", type=int, default=0)
    ap.add_argument("--min-painted", type=int, default=2000)
    args = ap.parse_args()

    index = json.load(open(os.path.join(args.bundles, "bundles.json")))
    if args.max:
        index = index[: args.max]
    os.makedirs(args.out, exist_ok=True)

    made = []
    for b in index:
        bdir = os.path.join(args.bundles, b["dir"])
        mp = os.path.join(bdir, "bundle.json")
        if not os.path.exists(mp):
            continue
        meta = json.load(open(mp))
        pals = [[hx(c) for c in p["colors"]] for p in meta.get("palettes", [])]
        if not pals:
            continue

        tilesets = [a for a in meta["assets"] if a["kind"] == "bg_tiles"]
        maps = [a for a in meta["assets"] if a["kind"] == "bg_map"]
        if not tilesets or not maps:
            continue

        ts = max(tilesets, key=lambda a: a["tiles"])
        tiles = decode_tiles(open(os.path.join(bdir, ts["file"]), "rb").read())
        if not tiles:
            continue

        for m in maps:
            md = open(os.path.join(bdir, m["file"]), "rb").read()
            W, H, img, painted = render_map(md, tiles, pals)
            if painted < args.min_painted:
                continue
            name = "screen_%s_%s.png" % (meta["table"][2:], m["src"][2:])
            write_png(os.path.join(args.out, name), W, H, img)
            made.append({
                "table": meta["table"], "map": m["src"], "tileset": ts["src"],
                "png": name, "painted": painted,
            })

    json.dump(made, open(os.path.join(args.out, "screens.json"), "w"), indent=2)
    print("screens rendered: %d" % len(made))
    for s in sorted(made, key=lambda s: -s["painted"])[:10]:
        print("  %s  painted=%d" % (s["png"], s["painted"]))


if __name__ == "__main__":
    main()
