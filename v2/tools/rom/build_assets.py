#!/usr/bin/env python3
"""
Turn extracted ROM tiles into engine-ready sprite costumes.

Pipeline:
    ROM  --(custom decompressor)-->  4bpp tiles
         --(real palette)---------->  indexed pixel grids
         --(object grouping)------->  { kind:"pixel" } costume frames

Palette choice: a bundle carries several palettes (background, sprites,
UI, fade steps). We score each by how much *usable colour* it has -- number
of distinct non-black entries -- and take the best for sprites. That
reproduces what the game shows far more reliably than "take the first".

Sprites in GBA OAM are built from multiple 8x8 tiles. We detect runs of
non-empty tiles and group them into 16x16 / 32x32 objects, which is what
the microgames actually use for characters and props.

Output: a JSON file of costume-ready sprites that the engine can import
directly as { kind: "pixel", grid, palette, pixels }.

Usage: python3 build_assets.py <bundles_dir> <out.json> [--min-tiles 4]
"""
import argparse
import json
import os
import struct


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


def score_palette(colors):
    """How much usable colour does this palette carry?"""
    uniq = set(colors[1:])  # index 0 is transparent in OBJ
    dark = sum(1 for c in uniq if c == "#000000")
    return len(uniq) - dark


def tile_is_empty(g):
    return all(all(v == 0 for v in row) for row in g)


def group_objects(tiles, side=2):
    """Group consecutive non-empty tiles into side x side objects."""
    objs = []
    n = side * side
    i = 0
    while i + n <= len(tiles):
        block = tiles[i:i + n]
        if sum(0 if tile_is_empty(t) else 1 for t in block) >= max(2, n // 2):
            grid = [[0] * (side * 8) for _ in range(side * 8)]
            for k, t in enumerate(block):
                ox = (k % side) * 8
                oy = (k // side) * 8
                for y in range(8):
                    for x in range(8):
                        grid[oy + y][ox + x] = t[y][x]
            objs.append({"index": i, "size": side * 8, "pixels": grid})
        i += n
    return objs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("bundles")
    ap.add_argument("out")
    ap.add_argument("--max-bundles", type=int, default=0)
    ap.add_argument("--max-objs", type=int, default=12)
    args = ap.parse_args()

    index = json.load(open(os.path.join(args.bundles, "bundles.json")))
    if args.max_bundles:
        index = index[: args.max_bundles]

    result = []
    for b in index:
        bdir = os.path.join(args.bundles, b["dir"])
        meta_path = os.path.join(bdir, "bundle.json")
        if not os.path.exists(meta_path):
            continue
        meta = json.load(open(meta_path))

        pals = meta.get("palettes", [])
        if not pals:
            continue
        best = max(pals, key=lambda p: score_palette(p["colors"]))
        if score_palette(best["colors"]) < 4:
            continue

        obj_assets = [a for a in meta["assets"] if a["kind"] == "obj_tiles"]
        if not obj_assets:
            continue

        sprites = []
        for a in obj_assets:
            raw = open(os.path.join(bdir, a["file"]), "rb").read()
            tiles = decode_tiles(raw)
            for side in (2, 4):  # 16x16 and 32x32 objects
                for o in group_objects(tiles, side)[: args.max_objs]:
                    sprites.append({
                        "src": a["src"],
                        "tileIndex": o["index"],
                        "grid": o["size"],
                        "pixels": o["pixels"],
                    })
            if len(sprites) >= args.max_objs * 2:
                break

        if not sprites:
            continue

        result.append({
            "table": meta["table"],
            "palette": best["colors"],
            "paletteAddr": best["addr"],
            "paletteScore": score_palette(best["colors"]),
            "sprites": sprites[: args.max_objs * 2],
        })

    json.dump(result, open(args.out, "w"))
    total = sum(len(r["sprites"]) for r in result)
    print("bundles with usable sprites: %d" % len(result))
    print("sprites extracted: %d" % total)
    if result:
        top = sorted(result, key=lambda r: -r["paletteScore"])[:5]
        print("\nbest-coloured bundles:")
        for r in top:
            print("  %s  pal %s  score %d  sprites %d"
                  % (r["table"], r["paletteAddr"], r["paletteScore"], len(r["sprites"])))


if __name__ == "__main__":
    main()
