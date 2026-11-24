#!/usr/bin/env python3
"""Tileset generator: 32x32 tiles in the RPG Maker VX Ace look (top-down 3/4 view, light from the top left).

Usage: python -I scripts/art/tiles.py [--preview PATH]
Output: public/assets/tiles/tileset.png (16 columns, deterministic) and public/assets/tiles/tiles.json
(tile name -> index, solid tile names, and the multi-tile stamps the map builder places).
No photo is read: everything is painted with Pillow. See docs/tiles.md.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # python -I does not put the script folder on the path

from PIL import Image, ImageDraw, ImageFont  # noqa: E402

import tiles_objects  # noqa: E402
import tiles_rooms  # noqa: E402
import tiles_terrain  # noqa: E402
import tiles_venue  # noqa: E402
from tilepaint import T, Canvas  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "assets" / "tiles"
COLUMNS = 16


class Registry:
    """Collects tiles and stamps. A stamp is a big drawing sliced into tiles `<name>.<col>.<row>`."""

    def __init__(self):
        self.tiles = []  # (name, Canvas)
        self.solid = set()
        self.stamps = {}

    def tile(self, name, canvas, solid=False):
        assert name not in {n for n, _ in self.tiles}, "duplicate tile " + name
        assert canvas.w == T and canvas.h == T, name
        self.tiles.append((name, canvas))
        if solid:
            self.solid.add(name)

    def stamp(self, name, canvas, layer="objects", above_rows=0, mask=None):
        """layer: objects (sorted with characters by their bottom row), walls or below (baked under everyone).
        above_rows: how many top rows go to the `above` layer (tree crowns), those cells never block.
        mask: one string per row, '#' blocks and '.' does not (default: every cell blocks in layer objects)."""
        w, h = canvas.w // T, canvas.h // T
        assert canvas.w % T == 0 and canvas.h % T == 0, name
        cells, solid = [], []
        for cy in range(h):
            row, srow = [], []
            for cx in range(w):
                part = canvas.copy_region(cx * T, cy * T)
                if part.im.getbbox() is None:
                    row.append(None)
                    srow.append(0)
                    continue
                tname = "%s.%d.%d" % (name, cx, cy)
                is_solid = layer == "objects" and cy >= above_rows and (mask is None or mask[cy][cx] == "#")
                self.tile(tname, part, solid=is_solid)
                row.append(tname)
                srow.append(int(is_solid))
            cells.append(row)
            solid.append(srow)
        self.stamps[name] = {"w": w, "h": h, "layer": layer, "aboveRows": above_rows, "cells": cells, "solid": solid}


def build():
    reg = Registry()
    reg.tile("empty", Canvas())  # index 0 is always the empty tile
    tiles_terrain.define(reg)
    tiles_objects.define(reg)
    tiles_venue.define(reg)
    tiles_rooms.define(reg)
    return reg


def assemble(reg):
    """Lay the tiles out in a sheet, identical pictures share one slot."""
    index_of, slots, names = {}, [], {}
    for name, cv in reg.tiles:
        key = cv.im.tobytes()
        if key not in index_of:
            index_of[key] = len(slots)
            slots.append(cv)
        names[name] = index_of[key]
    rows = (len(slots) + COLUMNS - 1) // COLUMNS
    sheet = Image.new("RGBA", (COLUMNS * T, rows * T), (0, 0, 0, 0))
    for i, cv in enumerate(slots):
        sheet.paste(cv.im, ((i % COLUMNS) * T, (i // COLUMNS) * T))
    return sheet, names, len(slots)


def contact_sheet(reg, sheet, names, path):
    """A review aid: the tileset at 3x, then every stamp composed on a floor, with its name."""
    font = ImageFont.load_default(10)
    scale = 3
    bg = (38, 30, 36, 255)
    stamps = list(reg.stamps.items())
    cell_w = 7 * T * 1 + 16
    cols = 6
    gal_h, x, y, row_h = 0, 8, 8, 0
    placed = []
    for sname, st in stamps:
        w, h = st["w"] * T, st["h"] * T
        if x + w + 8 > cols * cell_w:
            x, y, row_h = 8, y + row_h + 24, 0
        placed.append((sname, st, x, y))
        x += max(w, 64) + 14
        row_h = max(row_h, h)
    gal_h = y + row_h + 30
    gal_w = cols * cell_w
    gal = Image.new("RGBA", (gal_w, gal_h), bg)
    gd = ImageDraw.Draw(gal)
    lookup = {n: cv.im for n, cv in reg.tiles}
    for sname, st, px, py in placed:
        w, h = st["w"] * T, st["h"] * T
        gd.rectangle([px - 2, py + 8, px + w + 1, py + h + 11], fill=(66, 54, 62, 255))
        for cy, row in enumerate(st["cells"]):
            for cx, tn in enumerate(row):
                if tn:
                    gal.alpha_composite(lookup[tn], (px + cx * T, py + cy * T + 10))
        gd.text((px, py - 2), sname, fill=(255, 235, 180, 255), font=font)
    big = sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST)
    gal = gal.resize((gal.width * 2, gal.height * 2), Image.NEAREST)
    out = Image.new("RGBA", (max(big.width, gal.width), big.height + gal.height + 20), bg)
    out.alpha_composite(big, (0, 0))
    out.alpha_composite(gal, (0, big.height + 20))
    out.convert("RGB").save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", help="write a contact sheet PNG (a review aid, not committed)")
    args = ap.parse_args()
    reg = build()
    sheet, names, count = assemble(reg)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT_DIR / "tileset.png", optimize=True)
    data = {"tileSize": T, "columns": COLUMNS, "count": count, "tiles": names, "solid": sorted(reg.solid), "stamps": reg.stamps}
    (OUT_DIR / "tiles.json").write_text(json.dumps(data, separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")
    if args.preview:
        contact_sheet(reg, sheet, names, args.preview)
    print("PASS tiles: %d names, %d distinct tiles, %d stamps, sheet %dx%d" % (len(names), count, len(reg.stamps), sheet.width, sheet.height))


if __name__ == "__main__":
    main()
