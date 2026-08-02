#!/usr/bin/env python3
"""
Render extracted 4bpp tilesets to PNG sheets using their real palettes.

Pairs each tileset with the palette loaded alongside it in the same
GraphicsTable — that is how the game itself pairs them, so the colours are
the actual shipped colours, not a guess.

GBA 4bpp tile format: 8x8 px, 32 bytes/tile, two pixels per byte,
low nibble = left pixel. Palette entries are BGR555.

Usage: python3 render_sheets.py <rom> <gfx_dir> <out_dir> [--cols 16]
"""
import argparse
import json
import os
import struct

ROM_BASE = 0x08000000


def bgr555_to_rgb(v):
    r = (v & 0x1F) << 3
    g = ((v >> 5) & 0x1F) << 3
    b = ((v >> 10) & 0x1F) << 3
    return (r | r >> 5, g | g >> 5, b | b >> 5)


def read_palette(rom, addr, count_bytes):
    off = addr - ROM_BASE
    n = count_bytes // 2
    vals = struct.unpack_from("<%dH" % n, rom, off)
    return [bgr555_to_rgb(v) for v in vals]


def decode_tiles(data):
    """-> list of 8x8 index grids"""
    tiles = []
    for t in range(len(data) // 32):
        base = t * 32
        grid = []
        for y in range(8):
            row = []
            for x in range(0, 8, 2):
                b = data[base + y * 4 + x // 2]
                row.append(b & 0xF)
                row.append(b >> 4)
            grid.append(row)
        tiles.append(grid)
    return tiles


def write_png(path, w, h, rgba_rows):
    import zlib
    raw = b"".join(b"\x00" + bytes(row) for row in rgba_rows)
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 6))
    png += chunk(b"IEND", b"")
    open(path, "wb").write(png)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("rom")
    ap.add_argument("gfxdir")
    ap.add_argument("out")
    ap.add_argument("--cols", type=int, default=16)
    ap.add_argument("--max", type=int, default=0)
    args = ap.parse_args()

    rom = open(args.rom, "rb").read()
    idx = json.load(open(os.path.join(args.gfxdir, "index.json")))
    os.makedirs(args.out, exist_ok=True)

    # map each tileset asset -> a palette from the same table
    pal_for = {}
    for t in idx["tables"]:
        pals = [e for e in t["entries"] if e["kind"].endswith("palette") and e["size"] > 0]
        objp = next((e for e in pals if e["kind"] == "obj_palette"), None)
        bgp = next((e for e in pals if e["kind"] == "bg_palette"), None)
        for e in t["entries"]:
            if e["kind"] == "obj_tiles" and objp:
                pal_for.setdefault(e["src"], objp)
            elif e["kind"] == "bg_tiles" and bgp:
                pal_for.setdefault(e["src"], bgp)

    assets = [a for a in idx["assets"] if a["kind"] in ("obj_tiles", "bg_tiles")]
    assets.sort(key=lambda a: -a["tiles"])
    if args.max:
        assets = assets[: args.max]

    manifest = []
    for a in assets:
        data = open(os.path.join(args.gfxdir, a["file"]), "rb").read()
        tiles = decode_tiles(data)
        if not tiles:
            continue

        pe = pal_for.get(a["addr"])
        if pe:
            try:
                pal = read_palette(rom, pe["src"], min(pe["size"], 0x200))
            except Exception:
                pal = None
        else:
            pal = None
        if not pal or len(pal) < 16:
            # greyscale fallback so the sheet is still inspectable
            pal = [(i * 17, i * 17, i * 17) for i in range(16)]

        cols = args.cols
        rows = (len(tiles) + cols - 1) // cols
        W, H = cols * 8, rows * 8
        img = [[0] * (W * 4) for _ in range(H)]

        for ti, grid in enumerate(tiles):
            tx = (ti % cols) * 8
            ty = (ti // cols) * 8
            for y in range(8):
                for x in range(8):
                    ci = grid[y][x]
                    px = tx + x
                    py = ty + y
                    o = px * 4
                    if ci == 0:
                        img[py][o:o + 4] = [0, 0, 0, 0]
                    else:
                        r, g, b = pal[ci % len(pal)]
                        img[py][o:o + 4] = [r, g, b, 255]

        name = "%s_%08X.png" % (a["kind"], a["addr"])
        write_png(os.path.join(args.out, name), W, H, img)
        manifest.append({
            "addr": "0x%08X" % a["addr"], "kind": a["kind"],
            "tiles": a["tiles"], "png": name,
            "palette": ("0x%08X" % pe["src"]) if pe else None,
        })

    json.dump(manifest, open(os.path.join(args.out, "manifest.json"), "w"), indent=2)
    print("rendered %d sheets -> %s" % (len(manifest), args.out))


if __name__ == "__main__":
    main()
