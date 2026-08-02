#!/usr/bin/env python3
"""
Convert real ROM art into engine costume data.

Emits a TypeScript module of `{ kind:"pixel", grid, palette, pixels }`
appearances — exactly the shape `editor/schema.ts` already understands — so
recreated microgames render with the game's own sprites and colours rather
than emoji stand-ins.

Two products per linked microgame:

  background : the composited 240x160 screen, downsampled to a 32x32 or
               48x48 indexed grid (a full-res backdrop would be 1200 cells
               and pointless to store as a sprite)
  sprites    : OBJ tiles grouped into 16x16 / 32x32 objects, de-duplicated
               and filtered for actual content

Palette is the real 16-bank block; we keep the bank a tile actually uses.

Usage:
  python3 make_costumes.py <bundles_dir> <links.json> <out.ts> [--limit N]
"""
import argparse
import json
import os
import struct
from collections import Counter


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


def compose_bg(mapdata, tiles, cols=32, rows=20):
    """Render tilemap to a (rows*8) x (cols*8) grid of (bank, colorIndex)."""
    n = len(mapdata) // 2
    ent = struct.unpack("<%dH" % n, mapdata[: n * 2])
    W, H = cols * 8, rows * 8
    grid = [[None] * W for _ in range(H)]
    for i, e in enumerate(ent):
        if i >= cols * rows:
            break
        tx, ty = (i % cols) * 8, (i // cols) * 8
        idx = e & 0x3FF
        hf, vf = bool(e & 0x400), bool(e & 0x800)
        bank = (e >> 12) & 0xF
        if idx >= len(tiles):
            continue
        g = tiles[idx]
        for y in range(8):
            sy = 7 - y if vf else y
            for x in range(8):
                sx = 7 - x if hf else x
                ci = g[sy][sx]
                grid[ty + y][tx + x] = None if ci == 0 else (bank, ci)
    return grid


def downsample(grid, out_w, out_h):
    H = len(grid)
    W = len(grid[0]) if H else 0
    out = []
    for oy in range(out_h):
        row = []
        for ox in range(out_w):
            x0, x1 = ox * W // out_w, max(ox * W // out_w + 1, (ox + 1) * W // out_w)
            y0, y1 = oy * H // out_h, max(oy * H // out_h + 1, (oy + 1) * H // out_h)
            c = Counter()
            for y in range(y0, min(y1, H)):
                for x in range(x0, min(x1, W)):
                    c[grid[y][x]] += 1
            # Majority vote over the non-transparent cells. Ties break
            # toward the rarer colour so small details (eyes, highlights)
            # survive downsampling instead of being swallowed by the
            # dominant fill -- that collapse was flattening backgrounds to
            # a single colour.
            solid = {k: v for k, v in c.items() if k is not None}
            if not solid:
                row.append(None)
                continue
            nsolid = sum(solid.values())
            ntotal = sum(c.values())
            if nsolid * 3 < ntotal:      # mostly empty -> stay transparent
                row.append(None)
                continue
            # Prefer the most common colour, but when a rarer colour is
            # present at all in a block that is otherwise uniform, keep it:
            # WarioWare art is mostly flat fills with thin outlines and
            # small features, and pure majority erases exactly those.
            ordered = sorted(solid.items(), key=lambda kv: -kv[1])
            best = ordered[0][0]
            if len(ordered) > 1:
                # a minority colour covering >=18% of the block is a real
                # feature (outline, eye, highlight), not noise
                second, scount = ordered[1]
                if scount >= max(1, nsolid * 0.18):
                    # alternate deterministically so outlines stay connected
                    best = second if ((ox + oy) & 1) else best
            row.append(best)
        out.append(row)
    return out


def flatten_palette(cells, palettes):
    """Map (bank,index) pairs to a flat palette + index grid."""
    used = []
    lut = {}
    for row in cells:
        for c in row:
            if c is None or c in lut:
                continue
            bank, ci = c
            if bank >= len(palettes):
                continue
            col = palettes[bank]["colors"][ci % 16]
            lut[c] = len(used) + 1  # 0 reserved for transparent
            used.append(col)
    grid = [[(0 if c is None else lut.get(c, 0)) for c in row] for row in cells]
    return used, grid


def tile_nonempty(g):
    return any(any(v for v in row) for row in g)


def group_objects(tiles, side):
    n = side * side
    objs = []
    for i in range(0, len(tiles) - n + 1, n):
        block = tiles[i:i + n]
        filled = sum(1 for t in block if tile_nonempty(t))
        if filled < max(2, n // 2):
            continue
        g = [[0] * (side * 8) for _ in range(side * 8)]
        for k, t in enumerate(block):
            ox, oy = (k % side) * 8, (k // side) * 8
            for y in range(8):
                for x in range(8):
                    g[oy + y][ox + x] = t[y][x]
        # reject near-empty and near-solid blocks
        filled_px = sum(1 for r in g for v in r if v)
        area = (side * 8) ** 2
        if not (area * 0.10 < filled_px < area * 0.92):
            continue
        objs.append({"tile": i, "grid": side * 8, "pixels": g})
    return objs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("bundles")
    ap.add_argument("links")
    ap.add_argument("out")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--bg-size", type=int, default=64)
    ap.add_argument("--sprites-per-game", type=int, default=4)
    args = ap.parse_args()

    links = json.load(open(args.links))
    bundles = {b["table"]: b for b in json.load(open(os.path.join(args.bundles, "bundles.json")))}

    records = []
    for l in links:
        tbl = next((t for t in l["graphicsTables"] if t in bundles), None)
        if not tbl:
            continue
        bdir = os.path.join(args.bundles, bundles[tbl]["dir"])
        mp = os.path.join(bdir, "bundle.json")
        if not os.path.exists(mp):
            continue
        meta = json.load(open(mp))
        pals = meta.get("palettes", [])
        if not pals:
            continue

        rec = {"id": l["id"], "table": tbl, "timer": l["timerValue"]}

        # ---- background ----
        tsets = [a for a in meta["assets"] if a["kind"] == "bg_tiles"]
        maps = [a for a in meta["assets"] if a["kind"] == "bg_map"]
        if tsets and maps:
            ts = max(tsets, key=lambda a: a["tiles"])
            tiles = decode_tiles(open(os.path.join(bdir, ts["file"]), "rb").read())
            best = None
            for m in maps:
                md = open(os.path.join(bdir, m["file"]), "rb").read()
                cells = compose_bg(md, tiles)
                filled = sum(1 for r in cells for c in r if c)
                if best is None or filled > best[0]:
                    best = (filled, cells)
            if best and best[0] > 3000:
                small = downsample(best[1], args.bg_size, int(args.bg_size * 2 / 3))
                pal, grid = flatten_palette(small, pals)
                if pal:
                    rec["background"] = {"w": len(grid[0]), "h": len(grid), "palette": pal, "pixels": grid}

        # ---- sprites ----
        objs = []
        for a in [x for x in meta["assets"] if x["kind"] == "obj_tiles"]:
            tiles = decode_tiles(open(os.path.join(bdir, a["file"]), "rb").read())
            for side in (2, 4):
                objs.extend(group_objects(tiles, side))
            if len(objs) >= args.sprites_per_game * 4:
                break
        if objs:
            objpal = pals[-1] if len(pals) > 1 else pals[0]
            colors = objpal["colors"]
            picked = objs[: args.sprites_per_game]
            rec["sprites"] = [{
                "grid": o["grid"],
                "palette": colors,
                "pixels": o["pixels"],
            } for o in picked]

        if "background" in rec or "sprites" in rec:
            records.append(rec)
        if args.limit and len(records) >= args.limit:
            break

    with open(args.out, "w") as f:
        f.write("/* AUTO-GENERATED from the WarioWare ROM by tools/rom/make_costumes.py.\n")
        f.write(" * Real decoded tiles + real 16-bank palettes. Do not hand-edit.\n")
        f.write(" */\n")
        f.write("import type { Appearance } from \"../editor/schema\";\n\n")
        f.write("export interface RomArt {\n  id: number;\n  table: string;\n  timer: number;\n")
        f.write("  background?: Appearance;\n  sprites?: Appearance[];\n}\n\n")
        f.write("export const ROM_ART: RomArt[] = ")
        payload = []
        for r in records:
            o = {"id": r["id"], "table": r["table"], "timer": r["timer"]}
            if "background" in r:
                bgp = r["background"]
                o["background"] = {
                    "kind": "pixel", "grid": max(bgp["w"], bgp["h"]),
                    "palette": ["#000000"] + bgp["palette"],
                    "pixels": [[(v - 1 if v else -1) for v in row] for row in bgp["pixels"]],
                }
            if "sprites" in r:
                o["sprites"] = [{
                    "kind": "pixel", "grid": s["grid"],
                    "palette": s["palette"],
                    "pixels": [[(v if v else -1) for v in row] for row in s["pixels"]],
                } for s in r["sprites"]]
            payload.append(o)
        json.dump(payload, f, separators=(",", ":"))
        f.write(";\n\nexport const romArtById = (id: number) => ROM_ART.find((a) => a.id === id);\n")

    nbg = sum(1 for r in records if "background" in r)
    nsp = sum(len(r.get("sprites", [])) for r in records)
    print("microgames with art: %d" % len(records))
    print("  backgrounds: %d" % nbg)
    print("  sprites:     %d" % nsp)
    print("wrote %s (%.1f KB)" % (args.out, os.path.getsize(args.out) / 1024))


if __name__ == "__main__":
    main()
