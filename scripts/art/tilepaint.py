"""Pixel painting helpers and the shared palette of the tile generator (scripts/art/tiles.py). Pillow only, deterministic.

Light comes from the top left. Materials are 4 to 5 tone ramps with the hue shifted along the ramp: shadows drift toward a cool
violet navy, highlights toward warm cream, so a venue lit by warm lamps keeps cool shade. Objects get a selective outline (the
outline takes the colour of the thing it hugs, darker below and to the right, lighter above and to the left), a soft ground shadow
and hand placed highlight pixels. Floors have no outline and no pixel noise: they read calm.
"""
import colorsys
import random
import zlib
from pathlib import Path

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


def hexs(c):
    c = col(c)
    return "#%02x%02x%02x" % c[:3]


# ---------------------------------------------------------------- hue shifted tones
SH_TINT = (44, 26, 78)       # what shade drifts toward: a cool violet navy, never black
HL_TINT = (255, 236, 190)    # what light drifts toward: warm cream


def dark(c, t):
    return mix(c, SH_TINT, t)


def light(c, t):
    return mix(c, HL_TINT, t)


def shade(c, k):
    """k < 0 darker and cooler, k > 0 lighter and warmer."""
    return dark(c, -k) if k < 0 else light(c, k)


def make_ramp(base, n=5, bi=2, dark_hue=255.0, light_hue=48.0, sh=22.0, lh=16.0):
    """A tone ramp, darkest to lightest, with `base` at index bi. Shadows turn toward dark_hue, highlights toward light_hue."""
    r, g, b = col(base)[:3]
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    h *= 360
    out = []
    for i in range(n):
        p = (i - bi) / max(bi, n - 1 - bi)
        hh, ss, vv = h, s, v
        if p < 0:
            q = -p
            d = ((dark_hue - h + 180) % 360) - 180
            hh = h + max(-sh, min(sh, d)) * q
            vv = v * (1 - 0.62 * q)
            ss = min(1.0, s * (1 + 0.12 * q))
        elif p > 0:
            d = ((light_hue - h + 180) % 360) - 180
            hh = h + max(-lh, min(lh, d)) * p
            vv = v + (1 - v) * 0.6 * p
            ss = s * (1 - 0.38 * p)
        rr, gg, bb = colorsys.hsv_to_rgb((hh % 360) / 360, max(0, min(1, ss)), max(0, min(1, vv)))
        out.append("#%02x%02x%02x" % (int(round(rr * 255)), int(round(gg * 255)), int(round(bb * 255))))
    return out


# ---------------------------------------------------------------- palette (ramps run darkest to lightest)
OUT = "#2a1a1e"       # warm outline of objects (between the brown and plum outlines of the chibis)
OUT_COOL = "#1c2236"  # navy outline (the chibi navy), for cool or dark objects
WOOD = make_ramp("#93593a", 5, 2)                       # furniture wood
FLOOR_WOOD = make_ramp("#8a5632", 4, 1)                 # floorboards
STONE = make_ramp("#b9a47c", 5, 2)                      # flagstones, warm sandy beige like the reference cobbles
PLASTER = make_ramp("#e6c58f", 4, 1)                    # warm cream plaster
BRICK = make_ramp("#a8503c", 4, 1)
METAL = make_ramp("#5d6679", 5, 2, dark_hue=250, sh=14)
RED = make_ramp("#c4403f", 4, 2)
GREEN = make_ramp("#4f9250", 5, 2, light_hue=70, lh=22)
BLUE = make_ramp("#3a58ba", 4, 2)
CREAM = make_ramp("#e2cba0", 4, 1)
SKYN = ["#0c1440", "#18266a", "#2c4aa0"]  # night sky
GOLD = make_ramp("#d9a02a", 4, 2, light_hue=55)
CAP = make_ramp("#5a4448", 4, 1, dark_hue=270)          # tops of walls seen from above
SHADOW = (26, 12, 40)

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

# lowercase for the painted wall logo: 5 wide, rows 0-1 ascender, rows 2-6 x-height
LOWER = {
    "c": [".....", ".....", ".###.", "#...#", "#....", "#...#", ".###."],
    "o": [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
    "r": [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
    "t": ["..#..", "..#..", "####.", "..#..", "..#..", "..#..", "...##"],
    "i": ["..#..", ".....", ".##..", "..#..", "..#..", "..#..", ".###."],
    "l": [".##..", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "e": [".....", ".....", ".###.", "#...#", "#####", "#....", ".###."],
    "a": [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"],
    "f": ["..##.", ".#...", "####.", ".#...", ".#...", ".#...", ".#..."],
    "é": ["...#.", "..#..", ".###.", "#...#", "#####", "#....", ".###."],
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
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = col(c)

    def get(self, x, y):
        return self.px[x, y]

    def rect(self, x0, y0, x1, y1, c):
        x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
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

    def round_rect(self, x0, y0, x1, y1, c, r=2):
        """Filled rectangle with the corners cut by r pixels (stones, cushions, pillows)."""
        c = col(c)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                dx = min(x - x0, x1 - x)
                dy = min(y - y0, y1 - y)
                if dx + dy >= r or (dx >= r or dy >= r):
                    self.set(x, y, c)

    def shade_box(self, x0, y0, x1, y1, ramp):
        """Box lit from the top left: ramp is (dark, base, light)."""
        dark_, base, light_ = ramp
        self.rect(x0, y0, x1, y1, base)
        self.hline(x0, x1, y0, light_)
        self.vline(x0, y0, y1, light_)
        self.hline(x0, x1, y1, dark_)
        self.vline(x1, y0, y1, dark_)
        self.set(x0, y1, base)
        self.set(x1, y0, base)

    def vgrad(self, x0, y0, x1, y1, c0, c1):
        n = max(1, y1 - y0)
        for y in range(y0, y1 + 1):
            self.hline(x0, x1, y, mix(c0, c1, (y - y0) / n))

    def dither(self, x0, y0, x1, y1, a, b, density=.5, phase=0):
        """Checker style dither between two tones inside a rectangle (density 0.25, 0.5 or 0.75)."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                k = (x + y + phase) % 2 == 0
                if density >= .75:
                    k = k or (x % 2 == 0 and y % 2 == 0)
                elif density <= .25:
                    k = x % 2 == 0 and y % 2 == 0 and (x // 2 + y // 2 + phase) % 2 == 0
                self.set(x, y, b if k else a)

    def text(self, x, y, s, c, scale=1, gap=1, font=None):
        font = font or LETTERS
        for ch in s:
            g = font.get(ch) or font.get(ch.upper()) or font[" "]
            for gy, row in enumerate(g):
                for gx, v in enumerate(row):
                    if v == "#":
                        self.rect(x + gx * scale, y + gy * scale, x + gx * scale + scale - 1, y + gy * scale + scale - 1, c)
            x += (len(g[0]) + gap) * scale
        return x

    def text_width(self, s, scale=1, gap=1, font=None):
        font = font or LETTERS
        return sum((len((font.get(ch) or font.get(ch.upper()) or font[" "])[0]) + gap) * scale for ch in s) - gap * scale

    def blit(self, other, x=0, y=0):
        self.im.alpha_composite(other.im, (x, y))
        self.px = self.im.load()
        self.d = ImageDraw.Draw(self.im)

    def shadow(self, cx, cy, rx, ry, alpha=70, dx=1):
        """Soft ground shadow in three steps (core, body, dithered rim), pushed a pixel to the right because light comes from the
        left. Only paints where nothing is drawn yet."""
        cx += dx
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if 0 <= x < self.w and 0 <= y < self.h and self.px[x, y][3] == 0:
                    d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
                    if d <= 1:
                        if d < .38:
                            a = alpha
                        elif d < .7:
                            a = int(alpha * .72)
                        else:
                            a = int(alpha * .5) if (x + y) % 2 == 0 else int(alpha * .3)
                        self.px[x, y] = SHADOW + (a,)

    def outline(self, tone=None, inner_opaque_only=True):
        """1 px outer outline around every opaque pixel (4-neighbour); semi-transparent shadow pixels do not count.
        With a colour it is flat. Without one it is selective: the outline takes the hue of the neighbour it hugs, heavier under
        and to the right of a shape, lighter above and to the left (light comes from the top left)."""
        flat = col(tone) if tone is not None else None
        src = self.im.copy().load()
        for y in range(self.h):
            for x in range(self.w):
                if src[x, y][3] < 255:
                    best = None
                    for dx, dy, k in ((0, 1, .5), (-1, 0, .62), (1, 0, .8), (0, -1, .84)):
                        # neighbour below the pixel means we are above the shape: light side
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < self.w and 0 <= ny < self.h and src[nx, ny][3] == 255:
                            if best is None or k > best[1]:
                                best = (src[nx, ny], k)
                    if best is None:
                        continue
                    if flat is not None:
                        self.px[x, y] = flat
                    else:
                        p, k = best
                        c = dark(p, k)
                        c = mix(c, OUT, .28)
                        self.px[x, y] = dark(c, .1) if k > .7 else c

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


PXL_SPRITES = Path(__file__).resolve().parent / "pxl" / "out" / "sprites"


def pxl_object(name, shadow=None):
    """A stamp canvas from the PNG that pxl built (scripts/art/pxl/objects.px.js, committed in scripts/art/pxl/out/sprites): the soft ground
    shadow first, `shadow` = (cx, cy, rx, ry, alpha[, dx]) as for Canvas.shadow, then the drawing with its outline over it. The size of the
    PNG is the size of the stamp (a multiple of 32), so collision and masks stay as they were."""
    src = Image.open(PXL_SPRITES / (name + ".png")).convert("RGBA")
    assert src.width % T == 0 and src.height % T == 0, name
    c = Canvas(*src.size)
    if shadow:
        c.shadow(*shadow)
    c.im.alpha_composite(src)
    c.px = c.im.load()
    c.d = ImageDraw.Draw(c.im)
    return c
