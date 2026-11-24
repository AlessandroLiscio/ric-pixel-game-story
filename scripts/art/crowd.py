#!/usr/bin/env python3
"""Crowd sheets: palette swaps of two existing character sheets (sconosciuta, lollino), so the audience of the tile rooms
is not one tinted girl. Writes public/assets/tiles/crowd-<n>.png (96x128, same layout as the character sheets).

Usage: python -I scripts/art/crowd.py     (reads public/assets/characters/*.png, no photo involved)
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CHARS = ROOT / "public" / "assets" / "characters"
OUT = ROOT / "public" / "assets" / "tiles"


def hx(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


SKIN_LIGHT = {"#f4cba8": "#f4cba8", "#d99f7e": "#d99f7e"}
SKIN_TAN = {"#f4cba8": "#dba577", "#d99f7e": "#b9805a", "#dba577": "#dba577", "#b9805a": "#b9805a"}
SKIN_OLIVE = {"#f4cba8": "#c28a5c", "#d99f7e": "#9d6a45", "#dba577": "#c28a5c", "#b9805a": "#9d6a45"}
SKIN_PALE = {"#dba577": "#f4cba8", "#b9805a": "#d99f7e"}

# (source sheet, {old colour: new colour})
VARIANTS = [
    ("sconosciuta", {"#8c5a38": "#2b2330", "#8fd1b0": "#e07a90", **SKIN_LIGHT}),
    ("sconosciuta", {"#8c5a38": "#b04a48", "#8fd1b0": "#e8b83a", **SKIN_TAN}),
    ("sconosciuta", {"#8c5a38": "#d8b060", "#8fd1b0": "#c8423f", **SKIN_OLIVE}),
    ("sconosciuta", {"#8c5a38": "#5a3a28", "#8fd1b0": "#4f72d0", **SKIN_LIGHT}),
    ("lollino", {"#2f3d6b": "#8c2a3a", "#2b2330": "#5a3a28", **SKIN_PALE}),
    ("lollino", {"#2f3d6b": "#4f9a5d", **SKIN_PALE}),
    ("lollino", {"#2f3d6b": "#3b3f4c", "#2b2330": "#b04a48", "#b79d6b": "#3b3f4c", **SKIN_PALE}),
    ("lollino", {"#2f3d6b": "#e8b83a", "#2b2330": "#8c5a38", **SKIN_OLIVE}),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for n, (src, swap) in enumerate(VARIANTS, 1):
        im = Image.open(CHARS / (src + ".png")).convert("RGBA")
        px = im.load()
        table = {hx(a): hx(b) for a, b in swap.items()}
        for y in range(im.height):
            for x in range(im.width):
                p = px[x, y]
                if p[3] and p[:3] in table:
                    px[x, y] = table[p[:3]] + (p[3],)
        im.save(OUT / ("crowd-%d.png" % n), optimize=True)
    print("PASS crowd: %d sheets" % len(VARIANTS))


if __name__ == "__main__":
    main()
