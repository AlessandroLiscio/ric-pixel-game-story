"""Pixel painting helpers and the shared palette of the tile generator (scripts/art/tiles.py). Pillow only, deterministic.

Light comes from the top left. Every object gets a 1 px dark outline and 2 to 4 tones per material, the same
approach as the chibi sprites of scripts/art/chibis.py, so tiles and characters read as one game.
"""
import random
import zlib

from PIL import Image, ImageDraw

T = 32


def hx(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def col(c):
    if isinstance(c, str):
        return hx(c)
    if len(c) == 3:
        return tuple(c) + (255,)
    return tuple(c)


def mix(a, b, t):
    a, b = col(a), col(b)
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3)) + (255,)


def rng(name):
    return random.Random(zlib.crc32(name.encode()))


# ---------------------------------------------------------------- palette (ramps run darkest to lightest)
OUT = "#2a1a1e"       # warm outline of objects (between the brown and plum outlines of the chibis)
OUT_COOL = "#1c2236"  # navy outline (the chibi navy), for cool or dark objects
WOOD = ["#4a2a1e", "#6b3f28", "#8f5a36", "#b4783f", "#d29a58"]       # furniture wood
FLOOR_WOOD = ["#7a4d2b", "#9b6636", "#b88347", "#d3a05c"]            # floorboards
STONE = ["#5e5242", "#7f7260", "#a39679", "#c4b794", "#d8cdaa"]      # cobbles, warm beige like the reference
PLASTER = ["#a87a52", "#c99a6a", "#e2bd8e", "#f2d8ac"]               # warm plaster wall
BRICK = ["#5e2926", "#8a3c32", "#b05840", "#d07a54"]
METAL = ["#1c2028", "#363d4c", "#5b6478", "#8d97ab", "#c3cad8"]
RED = ["#5e1a28", "#962c38", "#c8423f", "#e8695a"]
GREEN = ["#27502f", "#3a7240", "#5a9a4e", "#88c068", "#b4de86"]
BLUE = ["#1d2f6a", "#2f4aa0", "#4f72d0", "#86a6ee"]
CREAM = ["#bfa27a", "#dcc59a", "#efe3c4", "#fbf4dc"]
SKYN = ["#0c1440", "#18266a", "#2c4aa0"]  # night sky
GOLD = ["#8a5a14", "#c08a22", "#e8b83a", "#fbe07a"]
CAP = ["#2e2024", "#4e3a3c", "#6a504c", "#8d6a5c"]  # tops of walls seen from above
SHADOW = (20, 10, 24)

LETTERS = {
    "C": [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
    "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "I": [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
    "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
    "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "N": ["#...#", "##..#", "#.#.#", "#.#.#", "#..##", "#...#", "#...#"],
    "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    "G": [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
    "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "V": ["#...#", "#...#", "#...#", "#...#", ".#.#.", ".#.#.", "..#.."],
    "W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
    "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
    "0": [".###.", "#..##", "#.#.#", "#.#.#", "#.#.#", "##..#", ".###."],
    "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
    " ": ["...", "...", "...", "...", "...", "...", "..."],
}


class Canvas:
    def __init__(self, w=T, h=T):
        self.w, self.h = w, h
        self.im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)
        self.px = self.im.load()

    # -- basics
    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = col(c)

    def get(self, x, y):
        return self.px[x, y]

    def rect(self, x0, y0, x1, y1, c):
        if x1 < x0 or y1 < y0:
            return
        self.d.rectangle([x0, y0, x1, y1], fill=col(c))

    def hline(self, x0, x1, y, c):
        self.rect(x0, y, x1, y, c)

    def vline(self, x, y0, y1, c):
        self.rect(x, y0, x, y1, c)

    def line(self, x0, y0, x1, y1, c):
        self.d.line([x0, y0, x1, y1], fill=col(c))

    def poly(self, pts, c):
        self.d.polygon(pts, fill=col(c))

    def ell(self, cx, cy, rx, ry, c, ymin=-999, ymax=999):
        c = col(c)
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            if y < ymin or y > ymax:
                continue
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1:
                    self.set(x, y, c)

    def disc(self, cx, cy, r, c):
        self.ell(cx, cy, r, r, c)

    def noise(self, x0, y0, x1, y1, cols, density, r):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if r.random() < density and self.get(x, y)[3] > 0:
                    self.set(x, y, r.choice(cols))

    def shade_box(self, x0, y0, x1, y1, ramp):
        """Box lit from the top left: ramp is (dark, base, light)."""
        dark, base, light = ramp
        self.rect(x0, y0, x1, y1, base)
        self.hline(x0, x1, y0, light)
        self.vline(x0, y0, y1, light)
        self.hline(x0, x1, y1, dark)
        self.vline(x1, y0, y1, dark)
        self.set(x0, y1, base)
        self.set(x1, y0, base)

    def vgrad(self, x0, y0, x1, y1, c0, c1):
        n = max(1, y1 - y0)
        for y in range(y0, y1 + 1):
            self.hline(x0, x1, y, mix(c0, c1, (y - y0) / n))

    def text(self, x, y, s, c, scale=1, gap=1):
        for ch in s:
            g = LETTERS.get(ch.upper(), LETTERS[" "])
            for gy, row in enumerate(g):
                for gx, v in enumerate(row):
                    if v == "#":
                        self.rect(x + gx * scale, y + gy * scale, x + gx * scale + scale - 1, y + gy * scale + scale - 1, c)
            x += (len(g[0]) + gap) * scale
        return x

    def text_width(self, s, scale=1, gap=1):
        return sum((len(LETTERS.get(ch.upper(), LETTERS[" "])[0]) + gap) * scale for ch in s) - gap * scale

    def blit(self, other, x=0, y=0):
        self.im.alpha_composite(other.im, (x, y))
        self.px = self.im.load()
        self.d = ImageDraw.Draw(self.im)

    def shadow(self, cx, cy, rx, ry, alpha=70):
        """Soft ground shadow: only paints where nothing is drawn yet."""
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if 0 <= x < self.w and 0 <= y < self.h and self.px[x, y][3] == 0:
                    d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
                    if d <= 1:
                        self.px[x, y] = SHADOW + (int(alpha * (1.0 if d < .55 else .6)),)

    def outline(self, tone=OUT, inner_opaque_only=True):
        """1 px outer outline around every opaque pixel (4-neighbour), semi-transparent shadow pixels do not count."""
        o = col(tone)
        src = self.im.copy().load()
        for y in range(self.h):
            for x in range(self.w):
                if src[x, y][3] < 255:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < self.w and 0 <= ny < self.h and src[nx, ny][3] == 255:
                            self.px[x, y] = o
                            break

    def glow(self, cx, cy, r, color, alpha=90):
        """Soft additive-looking halo (alpha blended), painted over what is there."""
        c = col(color)
        for y in range(int(cy - r) - 1, int(cy + r) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                if 0 <= x < self.w and 0 <= y < self.h:
                    d = ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2) ** .5 / r
                    if d < 1:
                        a = int(alpha * (1 - d) ** 1.5)
                        if a <= 0:
                            continue
                        p = self.px[x, y]
                        if p[3] == 0:
                            self.px[x, y] = c[:3] + (a,)
                        else:
                            t = a / 255
                            self.px[x, y] = tuple(int(p[i] + (c[i] - p[i]) * t) for i in range(3)) + (p[3],)

    def copy_region(self, x0, y0, w=T, h=T):
        out = Canvas(w, h)
        out.im = self.im.crop((x0, y0, x0 + w, y0 + h))
        out.px = out.im.load()
        out.d = ImageDraw.Draw(out.im)
        return out
