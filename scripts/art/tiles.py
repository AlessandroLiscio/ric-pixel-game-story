#!/usr/bin/env python3
"""Tileset generator: 32x32 tiles in the RPG Maker VX Ace look (top-down 3/4 view, light from the top left).

Usage: python -I scripts/art/tiles.py [--preview PATH]      (python -I scripts/art/build_world.py runs the whole pipeline)
Output: public/assets/tiles/tileset.png (16 columns, deterministic) and public/assets/tiles/tiles.json
(tile name -> index, solid tile names, and the multi-tile stamps the map builder places).
Shared materials live in tiles_terrain.py, tiles_objects.py and tiles_rooms.py; every room adds its own stamps in
scripts/art/stamps/<sceneId>.py, found automatically. No photo is read: everything is painted with Pillow. See docs/tiles.md.
"""
import argparse
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))  # python -I does not put the script folder on the path

from PIL import Image, ImageDraw, ImageFont  # noqa: E402

import tiles_objects  # noqa: E402
import tiles_rooms  # noqa: E402
import tiles_terrain  # noqa: E402
from tilepaint import T, Canvas  # noqa: E402

ROOT = HERE.parents[1]
OUT_DIR = ROOT / "public" / "assets" / "tiles"
COLUMNS = 16


def discover(folder):
    """Every non-underscore module of scripts/art/<folder>, sorted by file name, loaded with importlib: [(sceneId, module)]."""
    mods = []
    for p in sorted((HERE / folder).glob("*.py")):
        if p.name.startswith("_"):
            continue
        spec = importlib.util.spec_from_file_location("%s_%s" % (folder, p.stem), p)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mods.append((p.stem, mod))
    return mods


class Registry:
    """Collects tiles and stamps. A stamp is a big drawing sliced into tiles `<name>.<col>.<row>`."""

    def __init__(self):
        self.tiles = []  # (name, Canvas)
        self.solid = set()
        self.stamps = {}
        self.scope = None  # the sceneId while a room's stamps module runs: every name it registers must start with `<scope>_`
        self._names = set()

    def _check(self, name):
        assert name not in self._names, "duplicate tile " + name
        if self.scope:
            assert name.startswith(self.scope + "_"), "%s: a stamp of room %s must be named %s_<something>" % (name, self.scope, self.scope)
        self._names.add(name)

    def tile(self, name, canvas, solid=False):
        self._check(name)
        assert canvas.w == T and canvas.h == T, name
        self.tiles.append((name, canvas))
        if solid:
            self.solid.add(name)

    def stamp(self, name, canvas, layer="objects", above_rows=0, mask=None):
        """layer: objects (sorted with characters by their bottom row), walls or below (baked under everyone), above (over everyone).
        above_rows: how many top rows go to the `above` layer (tree crowns), those cells never block.
        mask: one string per row, '#' blocks and '.' does not (default: every cell blocks in layer objects; a walls stamp blocks only where its mask says, so a
        standing object baked under the characters, such as a scooter, takes a mask)."""
        w, h = canvas.w // T, canvas.h // T
        assert canvas.w % T == 0 and canvas.h % T == 0, name
        if self.scope:
            assert name.startswith(self.scope + "_"), "%s: a stamp of room %s must be named %s_<something>" % (name, self.scope, self.scope)
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
                is_solid = (layer == "objects" and cy >= above_rows and (mask is None or mask[cy][cx] == "#")) or (layer == "walls" and mask is not None and mask[cy][cx] == "#")
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
    tiles_rooms.define(reg)
    for scene_id, mod in discover("stamps"):
        reg.scope = scene_id
        mod.define(reg)
        reg.scope = None
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
    x, y, row_h = 8, 8, 0
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
        gd.rectangle([px - 2, py + 8, px + w + 1, py + h + 11], fill=(86, 72, 80, 255))
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


def write(reg=None, preview=None):
    """Builds and writes the sheet and tiles.json, returns the registry. Quiet: the caller prints the PASS line."""
    reg = reg or build()
    sheet, names, count = assemble(reg)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT_DIR / "tileset.png", optimize=True)
    data = {"tileSize": T, "columns": COLUMNS, "count": count, "tiles": names, "solid": sorted(reg.solid), "stamps": reg.stamps}
    (OUT_DIR / "tiles.json").write_text(json.dumps(data, separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")
    if preview:
        contact_sheet(reg, sheet, names, preview)
    return reg, sheet, names, count


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", help="write a contact sheet PNG (a review aid, not committed)")
    args = ap.parse_args()
    reg, sheet, names, count = write(preview=args.preview)
    print("PASS tiles: %d names, %d distinct tiles, %d stamps, sheet %dx%d" % (len(names), count, len(reg.stamps), sheet.width, sheet.height))


if __name__ == "__main__":
    main()
