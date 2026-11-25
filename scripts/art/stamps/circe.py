"""Stamps of Casa Circe, rebuilt from the five reference photos (shapes and colours only, nothing copied; the people are left out, text
and posters are redrawn in our own pixels): an open plan flat under a pine ceiling with black steel beams. A white kitchen with
four upper cabinets, a sink, an oven and a tall unit, the white cube shelves full of bottles and board games, the white
"STAFF ONLY" door that is the bathroom, the white stair stringer with fairy lights, a steel handrail, posters and the TV on its low
white cabinet, the navy sofa (it opens into a bed with a quilted cover) under the scratch-off world map next to the curtained glass
door with a standing lamp, a scooter and a coat rack, a long table with a red damask cloth, ghost chairs and white folding chairs.

Wall stamps (4 tiles tall, `walls` layer, the map blocks their cells): `circe_wall_stairs` 6 wide, `circe_wall_shelf` 3, `circe_wall_door`
2, `circe_wall_kitchen` 6 (and `circe_wall_kitchen_flip`, the same mirrored, with the fridge at the left), `circe_wall_sofa` 5. The
dinner table comes in two turns: `circe_table` (4 x 2, east to west) and `circe_table_v` (3 x 4, north to south, as on the owner's floor
plan). Reusable pieces for the night scene (`divano`): `circe_sofa_front`, `circe_sofa_front_throw`, `circe_sofa_back`, `circe_sofa_bed`,
`circe_tv_unit`, `circe_wall_stairs`, `circe_rug`, `circe_coffee_table`. Every name starts with `circe_`."""
import math

from PIL import Image, ImageDraw

from tilepaint import (LETTERS, Canvas, T, dark, hx, light, make_ramp, mix, rng)
from tiles_objects import bottle

WALL_H = 4 * T
WALL = make_ramp("#e9d8bc", 5, 3, dark_hue=268, sh=30)        # warm cream plaster, cool violet shade
PEACH = make_ramp("#ebc9a8", 5, 3, dark_hue=268, sh=30)       # the warmer wall behind the sofa
PINE = make_ramp("#c98f56", 5, 2, dark_hue=10, sh=14)         # the pine ceiling
WHITE = make_ramp("#efeade", 5, 3, dark_hue=250, sh=24)       # white furniture
NAVY = make_ramp("#2c3658", 5, 2, dark_hue=268, sh=10)        # the sofa
SLATE = make_ramp("#4a5559", 5, 2, dark_hue=240, sh=12)       # the dark grey wall behind the TV
STEEL = make_ramp("#8d98a8", 5, 2, dark_hue=250, sh=12)
BLACK = "#1d1e26"
BLACK_HI = "#585866"
TABLE = make_ramp("#a8693a", 5, 2)                            # the coffee table wood
RED_C = ["#4e1020", "#7a1a32", "#a82840", "#cf4a62", "#ee8196"]   # the red damask and the throw
PINK = make_ramp("#e0508a", 5, 2, dark_hue=290, sh=20)


# ---------------------------------------------------------------- helpers

def blend(c, x, y, colr, t):
    if 0 <= x < c.w and 0 <= y < c.h:
        p = c.get(x, y)
        if p[3]:
            c.set(x, y, mix(p, colr, t)[:3] + (p[3],))


def plaster_bg(c, x0, y0, x1, y1, tones, seed):
    r = rng("circe-plaster-" + seed)
    c.rect(x0, y0, x1, y1, tones[3])
    for _ in range(max(3, (x1 - x0) // 18)):  # soft lighter and darker patches, hand placed, never noise
        x, y = r.randrange(x0, max(x0 + 1, x1 - 12)), r.randrange(y0 + 16, max(y0 + 17, y1 - 14))
        c.dither(x, y, x + r.randrange(6, 12), y + r.randrange(2, 4), tones[3], tones[4] if r.random() < .6 else tones[2], .25, r.randrange(2))


def ceiling(c, x0, x1, wx):
    """The pine ceiling edge along the top of a wall: boards and the ends of the beams (wx is the world x of the stamp, so the beams join)."""
    c.rect(x0, 0, x1, 12, PINE[2])
    for y in (4, 8):
        c.hline(x0, x1, y, PINE[1])
        c.hline(x0, x1, y + 1, PINE[3])
    c.hline(x0, x1, 0, PINE[0])
    for jx in range(-64, c.w + 64, 64):
        bx = jx - (wx % 64) + 20
        if bx + 11 < x0 or bx > x1:
            continue
        for xx in range(max(bx, x0), min(bx + 11, x1) + 1):
            k = xx - bx
            tone = PINE[3] if k == 0 else (PINE[0] if k == 11 else PINE[1])
            c.vline(xx, 0, 12, tone)
        c.set(bx + 4, 4, PINE[0])
        c.set(bx + 7, 8, PINE[0])
        c.set(bx + 5, 6, PINE[2])
    c.hline(x0, x1, 12, dark(PINE[0], .45))
    c.hline(x0, x1, 13, dark(PINE[0], .2))


def cornice(c, x0, x1, y0=14, rows=9, strength=.4):
    """The soft shade the ceiling throws on the wall under it."""
    for i in range(rows):
        t = strength * (1 - i / rows) ** 1.3
        for x in range(x0, x1 + 1):
            p = c.get(x, y0 + i)
            if p[3]:
                c.set(x, y0 + i, mix(p, (44, 26, 78), t)[:3] + (p[3],))


def steel_beam(c, x0, x1, y=13):
    """A black steel I-beam across the top of the wall (the edge of the upper floor), lit on its top flange."""
    c.rect(x0, y, x1, y + 10, BLACK)
    c.hline(x0, x1, y, BLACK_HI)
    c.hline(x0, x1, y + 1, "#34343e")
    c.hline(x0, x1, y + 3, "#2a2a34")
    c.hline(x0, x1, y + 8, "#2a2a34")
    c.hline(x0, x1, y + 9, "#0e0e14")
    for k in range(6):  # the soft shadow it casts on the wall
        t = .45 * (1 - k / 6) ** 1.4
        for x in range(x0, x1 + 1):
            blend(c, x, y + 11 + k, (30, 14, 40), t)


def skirting(c, x0, x1):
    y1 = WALL_H - 1
    c.rect(x0, y1 - 4, x1, y1, WHITE[3])
    c.hline(x0, x1, y1 - 4, WHITE[4])
    c.hline(x0, x1, y1 - 3, WHITE[2])
    c.hline(x0, x1, y1, dark(WHITE[0], .4))


def vstrip(c, x, y0, y1, tone):
    c.vline(x, y0, y1, tone)


def tiny(c, x, y, s, color):
    """Tiny 3x5 capitals for the little sign on the door."""
    font = {"S": ["###", "#..", "###", "..#", "###"], "T": ["###", ".#.", ".#.", ".#.", ".#."], "A": [".#.", "#.#", "###", "#.#", "#.#"],
            "F": ["###", "#..", "##.", "#..", "#.."], "O": ["###", "#.#", "#.#", "#.#", "###"], "N": ["##.", "#.#", "#.#", "#.#", "#.#"],
            "L": ["#..", "#..", "#..", "#..", "###"], "Y": ["#.#", "#.#", ".#.", ".#.", ".#."], " ": ["..", "..", "..", "..", ".."]}
    for ch in s:
        g = font[ch]
        for gy, row in enumerate(g):
            for gx, v in enumerate(row):
                if v == "#":
                    c.set(x + gx, y + gy, color)
        x += len(g[0]) + 1
    return x


def fairy(c, pts, seed, tones=("#fff0b0", "#ffd890", "#ffe9c8")):
    """Fairy lights along a polyline: a thin dark wire and warm bulbs with a soft halo."""
    r = rng("fairy" + seed)
    for (a, b) in zip(pts, pts[1:]):
        n = max(abs(b[0] - a[0]), abs(b[1] - a[1]))
        for i in range(n + 1):
            x = a[0] + (b[0] - a[0]) * i / max(1, n)
            y = a[1] + (b[1] - a[1]) * i / max(1, n)
            c.set(x, y + (1 if (i // 6) % 2 else 0), "#6a5a50")
    for (a, b) in zip(pts, pts[1:]):
        n = max(abs(b[0] - a[0]), abs(b[1] - a[1]))
        for i in range(5, n, 9):
            x = a[0] + (b[0] - a[0]) * i / max(1, n)
            y = a[1] + (b[1] - a[1]) * i / max(1, n) + 2
            c.glow(x, y, 5, "#ffd890", 70)
            c.set(x, y, r.choice(tones))
            c.set(x, y - 1, "#a08060")


def damask(c, x0, y0, x1, y1, base, lo, hi, step=6):
    c.rect(x0, y0, x1, y1, base)
    for j, y in enumerate(range(y0 + 2, y1, step)):
        for x in range(x0 + 2 + (step // 2 if j % 2 else 0), x1, step):
            for (dx, dy, tone) in ((0, 0, hi), (-1, 0, lo), (1, 0, lo), (0, -1, lo), (0, 1, lo)):
                if x0 <= x + dx <= x1 and y0 <= y + dy <= y1:
                    c.set(x + dx, y + dy, tone)


# ---------------------------------------------------------------- the stairs wall (the TV wall)

def wall_stairs():
    """x 1..6: the white stair stringer climbing to the left under the upper floor, a dark grey wall behind the TV, a film poster,
    polaroids, a plant on a step, fairy lights, the black beam and the steel handrail: a vertical pole and a diagonal rail."""
    W = 6 * T
    c = Canvas(W, WALL_H)
    plaster_bg(c, 0, 0, W - 1, WALL_H - 1, WALL, "stairs")
    # the dark grey wall that hangs behind the stairs and the TV, a little lighter toward the right
    c.vgrad(0, 14, 126, WALL_H - 7, SLATE[2], SLATE[0])
    c.vline(126, 14, WALL_H - 7, SLATE[0])
    c.vline(125, 14, WALL_H - 7, SLATE[1])
    # the stair stringer: one white mass with a stepped top edge, high on the left, stepping down to the right
    top = lambda x: 30 + int(x / 16) * 6          # noqa: E731
    pts = [(0, WALL_H - 6)]
    for sx in range(0, W, 16):
        pts += [(sx, top(sx)), (sx + 15, top(sx))]
    pts += [(W - 1, WALL_H - 6)]
    c.poly(pts, WHITE[3])
    for sx in range(0, W, 16):
        y0 = top(sx)
        if sx < 126:
            c.hline(max(0, sx - 1), sx + 15, y0 - 1, SLATE[0])       # a dark line where the edge meets the dark wall
        c.hline(sx, sx + 15, y0, WHITE[4])
        c.hline(sx, sx + 15, y0 + 1, light(WHITE[4], .3))
        c.vline(sx, y0 + 2, y0 + 12, WHITE[2])                       # the notch of the step above
        c.vline(sx + 1, y0 + 2, y0 + 12, WHITE[4])
    for y in range(WALL_H - 28, WALL_H - 6):                         # the stringer darkens toward the floor
        for x in range(0, W):
            blend(c, x, y, (44, 26, 78), .1 * (y - (WALL_H - 28)) / 22)
    # a plant on a step: brown pot, trailing ivy
    px = 44
    py = top(px)
    c.rect(px, py - 9, px + 8, py - 1, "#7a4a30")
    c.rect(px, py - 9, px + 8, py - 8, "#a86a44")
    c.vline(px + 8, py - 8, py - 1, "#4e2c1e")
    for (lx, ly, rr) in ((px + 4, py - 14, 5), (px + 1, py - 11, 3.5), (px + 8, py - 12, 3.5), (px + 4, py - 18, 3.5)):
        c.ell(lx, ly, rr, rr - .8, "#2f6a3a")
        c.ell(lx - 1, ly - 1, rr - 1.5, rr - 2, "#4f9250")
    for k in range(6):
        c.set(px + 9, py - 8 + k * 2, "#3f7a46")
        c.set(px + 10, py - 7 + k * 2, "#2f6a3a")
    # the film poster on the white stringer: a red top, a bold title, a figure with a black bob
    c.rect(6, 54, 39, 99, "#16121a")
    c.rect(7, 55, 38, 98, "#e9d8b0")
    c.rect(7, 55, 38, 66, "#c4403f")
    c.hline(7, 38, 66, "#8a2430")
    c.set(11, 55, "#e9d8b0")
    c.set(12, 56, "#e9d8b0")
    c.set(30, 55, "#e9d8b0")
    c.text(12, 58, "PULP", "#f4ead0", 1)
    c.rect(10, 68, 35, 68, "#16121a")
    c.rect(12, 70, 33, 70, "#6a5a4a")
    c.ell(22, 80, 7, 6, "#16121a")                     # the black bob, then the face with a small cigarette
    c.ell(22, 83, 4.4, 4.6, "#e8b890")
    c.rect(18, 88, 27, 97, "#16121a")
    c.set(20, 82, "#16121a")
    c.set(24, 82, "#16121a")
    c.hline(23, 26, 86, "#d8d0c0")
    c.rect(10, 90, 13, 97, "#c4403f")
    c.hline(29, 36, 94, "#8a7a68")
    c.hline(29, 36, 96, "#8a7a68")
    # two small colourful posters further left behind the TV
    c.rect(0, 40, 4, 52, "#c4403f")
    c.rect(0, 53, 4, 58, "#2f6a8a")
    # polaroids stacked on the wall, a coloured ribbon of fridge letters
    for k, (x0, tone) in enumerate(((96, "#cfd8e0"), (96, "#e0d4b4"), (96, "#d0c4b0"))):
        yy = 60 + k * 14
        c.rect(x0, yy, x0 + 11, yy + 12, "#ece8e0")
        c.rect(x0 + 1, yy + 1, x0 + 10, yy + 8, tone)
        c.ell(x0 + 6, yy + 5, 3, 2.4, mix(tone, "#5a6a8a", .45))
        c.hline(x0, x0 + 11, yy + 12, "#a8a09a")
    for k, tone in enumerate(("#e8c43a", "#c4403f", "#4f9250", "#3a58ba", "#e8c43a", "#c4403f")):
        c.rect(70 + k * 4, 52 + (k % 2), 72 + k * 4, 54 + (k % 2), tone)
    # the black beam and the steel handrail
    steel_beam(c, 56, W - 1, 13)
    ceiling(c, 0, 55, 32)
    ceiling(c, 56, W - 1, 32)
    c.rect(56, 13, W - 1, 23, BLACK)               # the beam is drawn over the ceiling edge, so redraw it on top
    c.hline(56, W - 1, 13, BLACK_HI)
    c.hline(56, W - 1, 14, "#34343e")
    c.hline(56, W - 1, 16, "#2a2a34")
    c.hline(56, W - 1, 21, "#2a2a34")
    c.hline(56, W - 1, 22, "#0e0e14")
    for k in range(6):
        t = .45 * (1 - k / 6) ** 1.4
        for x in range(56, W):
            blend(c, x, 24 + k, (30, 14, 40), t)
    pole = 122
    c.rect(pole, 24, pole + 2, WALL_H - 6, STEEL[2])
    c.vline(pole, 24, WALL_H - 6, STEEL[4])
    c.vline(pole + 2, 24, WALL_H - 6, STEEL[0])
    for k in range(0, 70):                          # the diagonal rail down to the right, parallel to the stringer
        x = pole + 3 + k
        y = 30 + int(k * .46)
        c.rect(x, y, x, y + 2, STEEL[2])
        c.set(x, y, STEEL[4])
        c.set(x, y + 2, STEEL[0])
    c.rect(pole + 70, 62, pole + 71, 76, STEEL[1])
    # fairy lights along the stringer and over the dark wall
    fairy(c, [(0, 26), (40, 33), (84, 43), (124, 56)], "stairs-a")
    fairy(c, [(124, 32), (150, 46), (180, 66), (191, 74)], "stairs-b")
    cornice(c, 0, W - 1, 24, 6, .25)
    skirting(c, 0, W - 1)
    return c


# ---------------------------------------------------------------- the shelf wall

def shelf_items(c, x0, x1, yb, seed, kind):
    r = rng("shelf" + seed)
    cols = ["#c4403f", "#e8c43a", "#4f9250", "#3a58ba", "#e8e2d4", "#a02a4a", "#2f6a8a", "#c89a3a"]
    x = x0 + 2
    if kind == 0:                                  # board games, a jar, plates
        ys = yb
        for (w, h, tone) in ((17, 6, "#c4403f"), (15, 5, "#e8c43a"), (16, 5, "#4f9250")):
            yy = ys - h
            c.rect(x, yy, x + w - 1, ys, tone)
            c.hline(x, x + w - 1, yy, light(hx(tone), .35))
            c.hline(x, x + w - 1, ys, dark(hx(tone), .4))
            c.rect(x + 2, yy + 2, x + w - 4, yy + 2, mix(tone, "#ffffff", .55))
            ys = yy
        x += 22
        c.rect(x, yb - 12, x + 7, yb, "#cfe0e8")
        c.rect(x + 1, yb - 13, x + 6, yb - 12, "#8a9aa8")
        c.vline(x + 1, yb - 11, yb - 1, "#ffffff")
        c.rect(x + 2, yb - 6, x + 6, yb - 1, "#e8a43a")
        x += 12
        for k in range(4):                         # a stack of blue plates
            c.ell(x + 6, yb - 2 - k * 2, 7, 2, "#3a58ba" if k % 2 == 0 else "#6a82d8")
        c.ell(x + 6, yb - 8, 7, 2, "#e8e2d4")
    elif kind == 1:                                # books, a mug, a small black board
        for k in range(8):
            h = r.choice([12, 14, 15, 13])
            tone = r.choice(cols)
            c.rect(x, yb - h, x + 2, yb, tone)
            c.vline(x, yb - h, yb, light(hx(tone), .3))
            c.vline(x + 2, yb - h, yb, dark(hx(tone), .3))
            x += 3
        x += 4
        c.rect(x, yb - 8, x + 5, yb, "#e8e2d4")
        c.rect(x + 6, yb - 6, x + 7, yb - 3, "#e8e2d4")
        c.hline(x, x + 5, yb - 8, "#ffffff")
        c.rect(x + 9, yb - 4, x + 14, yb, "#c4403f")
        x += 18
        c.rect(x, yb - 15, x + 9, yb - 1, "#1a1f24")
        c.rect(x + 1, yb - 14, x + 8, yb - 2, "#2a3238")
        c.hline(x + 2, x + 6, yb - 11, "#e8e8d8")
        c.hline(x + 2, x + 5, yb - 8, "#a8b0a0")
        c.hline(x + 2, x + 7, yb - 5, "#e8e8d8")
    else:                                          # plants, a yellow giraffe, a red pot, a teapot
        c.rect(x, yb - 6, x + 7, yb, "#c8683a")
        c.hline(x, x + 7, yb - 6, "#e08a52")
        for (lx, ly) in ((x + 3, yb - 12), (x, yb - 10), (x + 7, yb - 10), (x + 4, yb - 16)):
            c.ell(lx, ly, 3.4, 3, "#2f6a3a")
            c.ell(lx - 1, ly - 1, 2, 1.8, "#5aa65a")
        x += 14
        c.rect(x, yb - 15, x + 3, yb, "#e8b83a")
        c.rect(x + 3, yb - 17, x + 6, yb - 12, "#e8b83a")
        c.rect(x + 6, yb - 16, x + 8, yb - 14, "#c89a22")
        c.set(x + 5, yb - 15, "#2a1a1e")
        c.vline(x, yb - 15, yb, "#f8d870")
        x += 14
        c.round_rect(x, yb - 10, x + 8, yb, "#f4f1ea", 2)
        c.hline(x + 1, x + 7, yb - 10, "#ffffff")
        c.rect(x + 3, yb - 14, x + 5, yb - 10, "#e8e2d4")
        x += 14
        c.rect(x, yb - 7, x + 9, yb, "#b8302a")
        c.hline(x, x + 9, yb - 7, "#e8604a")
        for (lx, ly) in ((x + 2, yb - 11), (x + 5, yb - 13), (x + 8, yb - 10)):
            c.disc(lx, ly, 2.4, "#c4403f")
            c.set(lx, ly, "#ffd0a0")
        x += 14
        c.ell(x + 5, yb - 4, 5.5, 4, "#cfd8e0")
        c.hline(x, x + 10, yb, "#8a9aa8")
        c.hline(x + 10, x + 13, yb - 5, "#cfd8e0")


def wall_shelf():
    """x 7..9: the tall white cube shelves of the kitchen corner: a row of bottles on top, three shelves of board games, books, plants
    and trinkets, and white cupboards under them."""
    W = 3 * T
    c = Canvas(W, WALL_H)
    plaster_bg(c, 0, 0, W - 1, WALL_H - 1, WALL, "shelf")
    ceiling(c, 0, W - 1, 7 * T)
    # a row of bottles standing on top of the unit, up to the ceiling
    cols = ["#3a7240", "#8a4a20", "#c8423f", "#e8b83a", "#2f4aa0", "#f4f1ea", "#a02a4a", "#5a9a4e", "#c08a22", "#2f6a8a", "#d8d0b0"]
    r = rng("circe-bottles")
    x = 4
    while x < W - 8:
        h = r.choice([14, 16, 18, 15])
        bottle(c, x, 36, h, r.choice(cols), label="#f4f1ea" if r.random() < .5 else None)
        x += r.choice([6, 7, 7])
    # the unit: a white frame, shadow inside, three open rows and a cupboard
    ux0, ux1, uy0, uy1 = 3, W - 4, 37, WALL_H - 5
    c.rect(ux0, uy0, ux1, uy1, WHITE[3])
    c.hline(ux0, ux1, uy0, WHITE[4])
    c.vline(ux0, uy0, uy1, WHITE[4])
    c.vline(ux1, uy0, uy1, WHITE[1])
    c.vline(ux1 - 1, uy0 + 1, uy1, WHITE[2])
    rows = ((40, 59), (63, 82), (86, 105))
    for ri, (ya, yb) in enumerate(rows):
        c.rect(ux0 + 3, ya, ux1 - 3, yb, WHITE[1])
        c.rect(ux0 + 3, ya, ux1 - 3, ya + 2, dark(WHITE[1], .25))
        c.vline(ux0 + 3, ya, yb, dark(WHITE[1], .15))
        shelf_items(c, ux0 + 4, ux1 - 4, yb, "r%d" % ri, ri)
        c.hline(ux0 + 3, ux1 - 3, yb + 1, WHITE[4])
        c.hline(ux0 + 3, ux1 - 3, yb + 2, WHITE[2])
    # cupboards under the shelves
    c.hline(ux0, ux1, 108, WHITE[2])
    c.vline(48, 110, uy1 - 1, WHITE[2])
    for hx0 in (40, 55):
        c.rect(hx0, 114, hx0 + 1, 120, STEEL[3])
    c.hline(ux0 + 2, ux1 - 2, 110, WHITE[4])
    cornice(c, 0, W - 1)
    skirting(c, 0, W - 1)
    return c


# ---------------------------------------------------------------- the bathroom door

def wall_door():
    """x 10..11: the white door with a white frame and the little red and white STAFF ONLY sign: the bathroom."""
    W = 2 * T
    c = Canvas(W, WALL_H)
    plaster_bg(c, 0, 0, W - 1, WALL_H - 1, WALL, "door")
    ceiling(c, 0, W - 1, 10 * T)
    # frame, then the door slab with a lit left edge and a thin shade on the right
    c.rect(8, 18, 55, WALL_H - 5, WHITE[2])
    c.hline(8, 55, 18, WHITE[4])
    c.vline(8, 18, WALL_H - 5, WHITE[4])
    c.vline(55, 18, WALL_H - 5, WHITE[0])
    c.rect(12, 22, 51, WALL_H - 5, WHITE[3])
    c.hline(12, 51, 22, WHITE[1])
    c.hline(12, 51, 23, WHITE[4])
    c.vline(12, 23, WALL_H - 5, WHITE[1])
    c.vline(13, 24, WALL_H - 5, WHITE[4])
    c.vline(51, 24, WALL_H - 5, WHITE[2])
    c.vline(50, 24, WALL_H - 5, light(WHITE[2], .2))
    # soft recessed panels (a modern flat door with two shallow grooves)
    for (ya, yb) in ((30, 58), (66, 112)):
        c.rect(18, ya, 45, yb, light(WHITE[3], .1))
        c.hline(18, 45, ya, WHITE[2])
        c.vline(18, ya, yb, WHITE[2])
        c.hline(18, 45, yb, WHITE[4])
        c.vline(45, ya, yb, WHITE[4])
    # the sign: white sticker, red outline, STAFF over ONLY in red
    c.rect(20, 36, 41, 50, "#c4403f")
    c.rect(21, 37, 40, 49, "#f8f4ec")
    tiny(c, 23, 39, "STAFF", "#c4403f")
    tiny(c, 26, 45, "ONLY", "#c4403f")
    # a steel lever handle with its plate, on the right
    c.rect(43, 66, 46, 70, STEEL[3])
    c.hline(43, 46, 66, STEEL[4])
    c.rect(37, 67, 44, 68, STEEL[2])
    c.hline(37, 44, 67, STEEL[4])
    cornice(c, 0, W - 1)
    skirting(c, 0, W - 1)
    return c


# ---------------------------------------------------------------- the kitchen wall

def clear_bottle(c, x, yb, h):
    c.rect(x, yb - h + 4, x + 5, yb, "#dbeaf2")
    c.rect(x + 1, yb - h, x + 4, yb - h + 3, "#dbeaf2")
    c.vline(x, yb - h + 4, yb, "#ffffff")
    c.vline(x + 5, yb - h + 4, yb, "#9ab4c4")
    c.hline(x + 1, x + 4, yb - h, "#f0f4f6")
    c.hline(x, x + 5, yb - h + 8, "#aac8d8")
    c.hline(x, x + 5, yb - 2, "#aac8d8")


def bow(c, cx, cy):
    """A big red ribbon bow with long tails, over red flowers and holly: the Christmas bouquet on top of the cabinets."""
    for (lx, ly) in ((-16, 4), (-12, 8), (14, 6), (-4, 9), (8, 9)):
        c.ell(cx + lx, cy + ly, 5, 3, "#2f6a3a")
        c.ell(cx + lx - 1, cy + ly - 1, 3, 1.6, "#4f9250")
    c.poly([(cx - 2, cy - 2), (cx - 14, cy - 11), (cx - 16, cy + 1), (cx - 4, cy + 3)], RED_C[2])
    c.poly([(cx + 2, cy - 2), (cx + 14, cy - 11), (cx + 16, cy + 1), (cx + 4, cy + 3)], RED_C[2])
    c.poly([(cx - 2, cy - 2), (cx - 12, cy - 9), (cx - 13, cy - 3)], RED_C[3])
    c.poly([(cx + 2, cy - 2), (cx + 12, cy - 9), (cx + 13, cy - 3)], RED_C[3])
    c.rect(cx - 3, cy - 3, cx + 3, cy + 3, RED_C[1])
    c.hline(cx - 3, cx + 3, cy - 3, RED_C[3])
    c.poly([(cx - 3, cy + 3), (cx - 9, cy + 15), (cx - 5, cy + 15), (cx, cy + 4)], RED_C[2])
    c.poly([(cx + 3, cy + 3), (cx + 9, cy + 14), (cx + 5, cy + 15), (cx, cy + 4)], RED_C[1])
    for (fx, fy) in ((-7, 5), (6, 6), (0, 7)):
        c.disc(cx + fx, cy + fy, 2.2, "#c4303a")
        c.set(cx + fx, cy + fy, "#ffb0a0")


def basket(c, cx, yb, flowers):
    c.round_rect(cx - 7, yb - 9, cx + 7, yb, "#a4743c", 2)
    c.hline(cx - 7, cx + 7, yb - 9, "#d4a45c")
    for y in range(yb - 7, yb, 2):
        c.hline(cx - 6, cx + 6, y, "#7a5028")
    for k, (fx, fy, tone) in enumerate(flowers):
        c.vline(cx + fx // 2, yb - 9 + fy // 2, yb - 9, "#5a7a3a")
        c.disc(cx + fx, yb - 11 + fy, 2.2, tone)
        c.set(cx + fx, yb - 11 + fy, light(hx(tone), .5))


def wall_kitchen():
    """x 12..17: the kitchen run. Four white upper cabinets with the red bow bouquet, a basket of dried flowers and the bottles on top,
    the steel tap over the sink, soap and a green bottle on the counter, the built-in oven, and the tall white unit with its ducting."""
    W = 6 * T
    c = Canvas(W, WALL_H)
    plaster_bg(c, 0, 0, W - 1, WALL_H - 1, WALL, "kitchen")
    ceiling(c, 0, W - 1, 12 * T)
    # the flexible silver duct over the tall unit
    for y in range(0, 14, 2):
        c.hline(150, 158, y, "#b8c0cc")
        c.hline(150, 158, y + 1, "#7a8494")
    c.vline(150, 0, 14, "#dfe6ee")
    # upper cabinets: x 0..159, y 28..66
    cx0, cx1, cy0, cy1 = 0, 159, 28, 66
    c.rect(cx0, cy0, cx1, cy1, WHITE[3])
    c.hline(cx0, cx1, cy0, WHITE[4])
    c.hline(cx0, cx1, cy0 + 1, light(WHITE[4], .3))
    c.hline(cx0, cx1, cy1, WHITE[1])
    c.hline(cx0, cx1, cy1 - 1, WHITE[2])
    for k in range(1, 4):
        c.vline(k * 40, cy0 + 2, cy1 - 1, WHITE[1])
        c.vline(k * 40 + 1, cy0 + 2, cy1 - 2, WHITE[4])
    c.vline(0, cy0, cy1, WHITE[4])
    c.vline(cx1, cy0, cy1, WHITE[1])
    for k in range(4):   # tiny finger grooves at the bottom edge of every door
        c.hline(k * 40 + 14, k * 40 + 26, cy1 - 3, WHITE[2])
    # on top of the cabinets
    basket(c, 22, 28, [(-4, -3, "#e8a0b8"), (1, -6, "#f0e0c8"), (5, -2, "#b08acd"), (-1, -1, "#d8b060")])
    c.rect(36, 24, 40, 27, "#b08acd")   # a ribbon at the basket
    c.round_rect(66, 15, 74, 27, "#f4f1ea", 3)
    c.vline(66, 17, 26, "#ffffff")
    c.vline(74, 17, 26, "#c8c8d0")
    for k, (sx, sy) in enumerate(((68, 8), (70, 5), (72, 9), (69, 11))):
        c.line(70, 15, sx, sy, "#4f9250")
        c.disc(sx, sy, 2, "#ffffff" if k % 2 == 0 else "#e8f0d0")
    c.ell(92, 25, 14, 2.4, "#4a5a2a")     # a dried branch lying along the cabinets
    c.ell(92, 24, 12, 1.4, "#7a8a4a")
    for k in range(7):
        c.set(82 + k * 4, 22 + (k % 2), "#c0a050")
    bow(c, 130, 15)
    for k, bx in enumerate((164, 171, 178, 185)):
        clear_bottle(c, bx, 12, 12 if k % 2 == 0 else 14)
    # the backsplash is plain white wall; the warm under-cabinet light washes over it
    for y in range(cy1 + 1, 92):
        t = .26 * (1 - (y - cy1) / 26) ** 1.4
        for x in range(0, 160):
            blend(c, x, y, "#ffe6a0", t)
    # the counter top: lit top face, white front edge, steel sink
    c.rect(0, 92, 159, 99, WHITE[4])
    c.hline(0, 159, 92, "#ffffff")
    c.hline(0, 159, 98, WHITE[2])
    c.hline(0, 159, 99, WHITE[1])
    c.rect(60, 93, 97, 98, STEEL[1])
    c.rect(62, 94, 95, 98, STEEL[2])
    c.hline(62, 95, 94, STEEL[4])
    c.vline(62, 94, 98, STEEL[3])
    c.hline(60, 97, 92, STEEL[4])
    # the tap: a steel stem with an arch and a spout
    c.rect(77, 76, 79, 92, STEEL[3])
    c.vline(77, 76, 92, STEEL[4])
    c.vline(79, 76, 92, STEEL[1])
    c.hline(77, 86, 74, STEEL[3])
    c.hline(77, 86, 73, STEEL[4])
    c.rect(85, 74, 86, 80, STEEL[3])
    c.set(85, 81, STEEL[4])
    c.rect(72, 80, 74, 84, "#c4403f")      # the tap handle
    # on the counter: a white detergent bottle with a red cap, a blue spray, a green bottle, a jar, a carton
    c.round_rect(26, 78, 35, 92, "#f4f1ea", 3)
    c.vline(26, 80, 91, "#ffffff")
    c.vline(35, 80, 91, "#c8c8d0")
    c.rect(28, 74, 33, 78, "#c4403f")
    c.rect(29, 83, 33, 88, "#3a58ba")
    c.rect(38, 82, 44, 92, "#2f8ad0")
    c.rect(40, 77, 42, 82, "#2f8ad0")
    c.hline(38, 44, 82, "#6ab4e8")
    c.rect(42, 75, 47, 77, "#f4f1ea")
    c.rect(48, 84, 54, 92, "#e8e8e0")
    c.rect(48, 84, 54, 86, "#c4403f")
    bottle(c, 110, 92, 22, "#2a5a32", neck_dark="#c8b04a", glint=True)
    c.rect(122, 84, 127, 92, "#dfe8ee")
    c.rect(122, 82, 127, 84, "#8a96a8")
    c.rect(129, 82, 135, 92, "#f4f1ea")
    c.hline(129, 135, 82, "#ffffff")
    c.rect(129, 86, 135, 88, "#3a58ba")
    c.rect(140, 78, 146, 92, "#e8b83a")           # a tall yellow dispenser
    c.hline(140, 146, 78, "#f8d870")
    c.rect(150, 86, 156, 92, "#c8683a")           # a small pot with a green sprig
    c.ell(153, 83, 3, 3, "#4f9250")
    # the counter cabinets: doors, a built-in oven, the sink cabinet
    c.rect(0, 100, 159, 121, WHITE[3])
    for xx in (0, 31, 62, 98, 134):
        c.vline(xx, 100, 121, WHITE[1])
        c.vline(xx + 1, 101, 121, WHITE[4])
    c.hline(0, 159, 100, WHITE[2])
    c.hline(0, 159, 101, WHITE[4])
    for xx in (22, 53, 90, 150):
        c.rect(xx, 104, xx + 1, 110, STEEL[3])
    c.rect(98, 103, 133, 120, "#2a2a32")            # the oven: dark glass, a steel handle bar and three knobs
    c.rect(100, 108, 131, 119, "#16161c")
    c.hline(100, 131, 108, "#3a3a44")
    c.rect(102, 104, 129, 105, STEEL[3])
    c.hline(102, 129, 104, STEEL[4])
    for kx in (104, 112, 124):
        c.disc(kx, 106, 1.2, STEEL[2])
    c.rect(106, 111, 125, 117, "#20202a")
    c.hline(106, 125, 111, "#34343e")
    c.hline(0, 159, 121, dark(WHITE[0], .3))
    # the tall white unit on the right, from just under the ceiling to the floor
    c.rect(160, 10, W - 1, WALL_H - 5, WHITE[3])
    c.hline(160, W - 1, 10, WHITE[4])
    c.vline(160, 10, WALL_H - 5, WHITE[1])
    c.vline(161, 11, WALL_H - 5, WHITE[4])
    c.vline(W - 1, 10, WALL_H - 5, WHITE[1])
    c.hline(160, W - 1, 66, WHITE[1])
    c.hline(160, W - 1, 67, WHITE[4])
    c.rect(165, 40, 166, 58, STEEL[3])
    c.vline(165, 40, 58, STEEL[4])
    c.rect(165, 76, 166, 98, STEEL[3])
    c.vline(165, 76, 98, STEEL[4])
    c.hline(160, W - 1, WALL_H - 6, WHITE[1])
    cornice(c, 0, 159, 14, 9, .25)
    c.rect(0, WALL_H - 6, 159, WALL_H - 1, "#2c2630")    # the toe-kick under the counter
    c.hline(0, 159, WALL_H - 6, "#3e3640")
    c.rect(160, WALL_H - 5, W - 1, WALL_H - 1, WHITE[2])
    c.hline(160, W - 1, WALL_H - 1, dark(WHITE[0], .4))
    return c


def wall_kitchen_flip():
    """The kitchen run mirrored, so the tall unit (the fridge) stands in the corner and the oven and the sink follow, as on the floor plan."""
    c = wall_kitchen()
    f = Canvas(c.w, c.h)
    f.im = c.im.transpose(Image.FLIP_LEFT_RIGHT)
    f.d = ImageDraw.Draw(f.im)
    f.px = f.im.load()
    return f


# ---------------------------------------------------------------- the sofa wall

SCRATCH = ["#1b2440", "#2a3556"]
GOLDC = ["#a8741c", "#d9a02a", "#f0c860"]


def world_map(c, x, y, w=54, h=32):
    """A framed scratch-off world map: dark navy with gold continents and a row of little charts at the foot."""
    c.rect(x, y, x + w - 1, y + h - 1, "#f4f1ea")
    c.hline(x, x + w - 1, y, "#ffffff")
    c.hline(x, x + w - 1, y + h - 1, "#b8b4ae")
    c.vline(x + w - 1, y, y + h - 1, "#b8b4ae")
    ix0, iy0, ix1, iy1 = x + 2, y + 2, x + w - 3, y + h - 3
    c.rect(ix0, iy0, ix1, iy1, SCRATCH[0])
    c.dither(ix0, iy0, ix1, iy0 + 6, SCRATCH[0], SCRATCH[1], .25)

    def blob(pts, tone=GOLDC[1]):
        c.poly([(ix0 + px * (ix1 - ix0) / 100, iy0 + py * (iy1 - iy0 - 6) / 100) for px, py in pts], tone)

    blob([(6, 12), (20, 8), (30, 14), (27, 26), (20, 34), (24, 48), (22, 64), (17, 84), (12, 62), (14, 44), (8, 30)])   # the Americas
    blob([(40, 14), (52, 8), (58, 16), (54, 30), (60, 46), (56, 66), (48, 74), (44, 54), (42, 34)])                     # Europe and Africa
    blob([(58, 12), (74, 8), (92, 14), (96, 28), (86, 36), (76, 34), (68, 46), (62, 30)])                              # Asia
    blob([(80, 62), (92, 60), (94, 72), (84, 78)])                                                                      # Australia
    c.hline(ix0 + 2, ix1 - 2, iy1 - 5, GOLDC[0])
    for k in range(5):
        c.rect(ix0 + 3 + k * 9, iy1 - 4, ix0 + 6 + k * 9, iy1 - 1, GOLDC[1] if k % 2 == 0 else GOLDC[0])
    for k in range(10):
        c.set(ix0 + 4 + (k * 17) % (ix1 - ix0 - 8), iy0 + 3 + (k * 7) % 14, GOLDC[2])


def jacket(c, x, y, tone, tone_hi, w=20, h=48):
    """A coat hanging from a hook: shoulders, two sleeves and a hem."""
    c.rect(x + w // 2 - 1, y - 6, x + w // 2, y - 1, "#8a8a94")
    c.set(x + w // 2 - 2, y - 7, "#8a8a94")
    c.poly([(x + w // 2, y), (x + 1, y + 5), (x - 1, y + 14), (x + 1, y + h - 4), (x + 6, y + h), (x + w - 6, y + h), (x + w - 1, y + h - 4),
            (x + w + 1, y + 14), (x + w - 1, y + 5)], tone)
    c.vline(x + 1, y + 6, y + h - 6, tone_hi)
    c.vline(x + 2, y + 6, y + h - 8, tone_hi)
    c.vline(x + w - 2, y + 8, y + h - 6, dark(hx(tone), .4))
    c.vline(x + w // 2, y + 8, y + h - 2, dark(hx(tone), .3))
    c.hline(x + 3, x + w - 3, y + h - 1, dark(hx(tone), .45))
    c.hline(x + 5, x + w - 5, y + 3, tone_hi)
    c.vline(x + 5, y + 12, y + h - 12, dark(hx(tone), .3))        # the sleeves fall beside the body
    c.vline(x + w - 6, y + 12, y + h - 12, dark(hx(tone), .3))
    c.poly([(x + w // 2 - 4, y + 2), (x + w // 2 + 4, y + 2), (x + w // 2, y + 9)], tone_hi)   # a collar
    c.hline(x + 4, x + w - 4, y + 24, dark(hx(tone), .2))         # a pocket line


def wall_sofa():
    """x 18..22: the sofa corner. A glass door with a white curtain and a dark outside, a black steel beam on the left, the coats on a
    hook, the framed scratch-off world map over the sofa. The sofa itself is `circe_sofa_front*`, the lamp and the scooter in front
    of the door are objects."""
    W = 5 * T
    c = Canvas(W, WALL_H)
    plaster_bg(c, 0, 0, W - 1, WALL_H - 1, PEACH, "sofa")
    ceiling(c, 0, W - 1, 18 * T)
    steel_beam(c, 0, 60, 13)
    # the glass door: white frame, dark glass reflecting the room, a white curtain pulled to the left, a steel handle
    c.rect(3, 26, 61, WALL_H - 5, WHITE[3])
    c.hline(3, 61, 26, WHITE[4])
    c.vline(3, 26, WALL_H - 5, WHITE[4])
    c.vline(61, 26, WALL_H - 5, WHITE[1])
    c.rect(8, 31, 56, WALL_H - 6, "#141d30")
    c.vgrad(9, 32, 55, WALL_H - 7, "#27385a", "#101826")
    c.dither(9, 90, 55, WALL_H - 7, "#101826", "#1c2a46", .25)
    for (lx, ly, lw, lh, tone) in ((20, 70, 12, 8, "#c8a05a"), (36, 78, 10, 6, "#a0805a"), (14, 84, 8, 10, "#5a6a8a")):
        c.rect(lx, ly, lx + lw, ly + lh, tone)
        c.hline(lx, lx + lw, ly, light(hx(tone), .3))
    for k in range(18):                 # reflections of the room lights
        blend(c, 12 + k, 36 + k, "#ffffff", .22)
        blend(c, 13 + k, 36 + k, "#ffffff", .1)
    c.vline(8, 31, WALL_H - 6, WHITE[1])
    c.vline(56, 31, WALL_H - 6, WHITE[1])
    c.rect(8, 31, 56, 32, WHITE[2])
    c.rect(8, 63, 56, 64, WHITE[2])
    c.rect(52, 70, 53, 84, STEEL[3])    # the handle
    c.vline(52, 70, 84, STEEL[4])
    c.rect(8, 28, 30, 118, "#f1ede4")   # the curtain: pleats of white linen on a rail
    for k in range(0, 23, 4):
        c.vline(8 + k, 29, 118, "#d4cfc6")
        c.vline(9 + k, 29, 118, "#fffdf8")
    c.hline(6, 32, 28, "#8a8a94")
    c.hline(8, 30, 118, "#c8c2b8")
    # the coats on the wall between the door and the sofa
    jacket(c, 68, 38, "#c8d070", "#e8eca0", 20, 50)
    jacket(c, 82, 42, "#2c2a30", "#4a4852", 18, 48)
    c.rect(72, 70, 79, 80, "#16161c")      # a small black bag on the first coat
    c.hline(72, 79, 70, "#3a3a44")
    # the map
    world_map(c, 92, 34, 56, 33)
    # two small photos and a sticker on the wall to the right
    for (px, py, tone) in ((150, 38, "#c8b898"), (150, 54, "#a8b8c8")):
        c.rect(px, py, px + 8, py + 10, "#ece8e0")
        c.rect(px + 1, py + 1, px + 7, py + 7, tone)
        c.ell(px + 4, py + 4, 2, 2, mix(tone, "#5a4a3a", .5))
    cornice(c, 0, W - 1, 14, 9, .3)
    skirting(c, 0, W - 1)
    return c


# ---------------------------------------------------------------- the sofa

def sofa_body(c, bed=False):
    """The navy two seat sofa with wide padded arms, drawn for a 96 px wide canvas, seen from the front: the backrest with two cushions
    on top, the arms, a seat of two cushions."""
    # backrest
    c.round_rect(7, 7, 88, 36, NAVY[2], 4)
    c.hline(10, 85, 7, NAVY[4])
    c.hline(8, 87, 8, NAVY[3])
    c.rect(8, 9, 87, 11, NAVY[3])
    c.vline(7, 11, 34, NAVY[3])
    c.vline(88, 11, 34, NAVY[1])
    for (x0, x1) in ((14, 47), (49, 82)):                 # two back cushions
        c.round_rect(x0, 12, x1, 35, NAVY[3] if False else NAVY[2], 4)
        c.hline(x0 + 2, x1 - 2, 12, NAVY[4])
        c.vline(x0, 14, 33, NAVY[3])
        c.vline(x1, 14, 33, NAVY[1])
        c.hline(x0 + 1, x1 - 1, 35, NAVY[0])
        c.set(x0 + 7, 22, NAVY[3])
        c.set(x0 + 8, 23, NAVY[3])
        c.set(x1 - 8, 24, NAVY[1])
    c.vline(48, 12, 35, NAVY[0])
    # arms
    for (ax0, ax1) in ((0, 13), (82, 95)):
        c.round_rect(ax0, 15, ax1, 58, NAVY[2], 5)
        c.hline(ax0 + 2, ax1 - 2, 15, NAVY[4])
        c.rect(ax0 + 1, 17, ax1 - 1, 24, NAVY[3])
        c.hline(ax0 + 1, ax1 - 1, 25, NAVY[1])
        c.vline(ax0, 20, 56, NAVY[3] if ax0 == 0 else NAVY[2])
        c.vline(ax1, 20, 56, NAVY[0] if ax0 else NAVY[1])
        c.hline(ax0 + 1, ax1 - 1, 58, NAVY[0])
        c.vline(ax0 + 4 if ax0 == 0 else ax0 + 9, 27, 55, NAVY[1])
    if not bed:
        # seat: two cushions, lit top, front face, a seam
        for (x0, x1) in ((13, 47), (48, 82)):
            c.rect(x0, 36, x1, 45, NAVY[3])
            c.hline(x0 + 1, x1 - 1, 36, NAVY[4])
            c.rect(x0, 46, x1, 53, NAVY[2])
            c.hline(x0, x1, 46, NAVY[1])
            c.hline(x0, x1, 53, NAVY[0])
            c.vline(x0, 37, 52, NAVY[3])
        c.vline(47, 36, 53, NAVY[0])
        c.rect(13, 54, 82, 56, NAVY[1])
        c.hline(13, 82, 56, NAVY[0])
        c.rect(5, 57, 9, 59, "#16161c")
        c.rect(86, 57, 90, 59, "#16161c")


def throw_and_cushions(c):
    """The red damask throw over the seat and back, two patterned cushions, a grey blanket folded on the backrest."""
    c.round_rect(60, 5, 84, 13, "#8a909a", 3)           # the grey blanket on the back, right side
    c.hline(62, 82, 5, "#b0b6c0")
    c.hline(60, 84, 13, "#5a606c")
    c.poly([(16, 12), (80, 12), (82, 36), (78, 54), (16, 54), (14, 36)], RED_C[2])
    damask(c, 15, 13, 81, 35, RED_C[2], RED_C[1], RED_C[4], 6)
    c.hline(16, 80, 12, RED_C[4])
    c.hline(16, 80, 13, RED_C[3])
    c.rect(15, 36, 81, 44, RED_C[3])
    damask(c, 14, 36, 82, 44, RED_C[3], RED_C[2], RED_C[4], 6)
    c.rect(14, 45, 82, 54, RED_C[2])
    damask(c, 14, 45, 82, 54, RED_C[2], RED_C[1], RED_C[4], 6)
    c.hline(14, 82, 54, RED_C[0])
    c.hline(14, 82, 45, RED_C[1])
    for k in range(0, 68, 2):                            # the fringe
        c.set(15 + k, 55, RED_C[1])
    for (x0, y0) in ((19, 34), (50, 33)):                # two patterned cushions on the seat
        c.round_rect(x0, y0, x0 + 20, y0 + 11, "#5a2a30", 3)
        c.hline(x0 + 2, x0 + 18, y0, "#9a5a48")
        c.rect(x0 + 2, y0 + 2, x0 + 18, y0 + 9, "#7a3a38")
        for xx in range(x0 + 3, x0 + 18, 3):
            c.set(xx, y0 + 4, "#d8a070")
            c.set(xx + 1, y0 + 6, "#d8a070")
        c.hline(x0 + 1, x0 + 19, y0 + 11, "#3a1a20")


def sofa_front(throw=False):
    c = Canvas(3 * T, 2 * T)
    c.shadow(48, 61, 47, 2.6, 80)
    sofa_body(c)
    if throw:
        throw_and_cushions(c)
        # re-draw the arms on top of the throw edge
        for (ax0, ax1) in ((0, 13), (82, 95)):
            c.round_rect(ax0, 15, ax1, 58, NAVY[2], 5)
            c.hline(ax0 + 2, ax1 - 2, 15, NAVY[4])
            c.rect(ax0 + 1, 17, ax1 - 1, 24, NAVY[3])
            c.hline(ax0 + 1, ax1 - 1, 25, NAVY[1])
            c.vline(ax0, 20, 56, NAVY[3] if ax0 == 0 else NAVY[2])
            c.vline(ax1, 20, 56, NAVY[0] if ax0 else NAVY[1])
            c.hline(ax0 + 1, ax1 - 1, 58, NAVY[0])
            c.vline(ax0 + 4 if ax0 == 0 else ax0 + 9, 27, 55, NAVY[1])
    c.outline()
    return c


def sofa_back(throw=False):
    """The sofa seen from behind (facing north, toward a TV on the north wall): a plain tall back with the two arms."""
    c = Canvas(3 * T, 2 * T)
    c.shadow(48, 60, 47, 2.6, 80)
    for (ax0, ax1) in ((0, 13), (82, 95)):
        c.round_rect(ax0, 9, ax1, 56, NAVY[2], 5)
        c.hline(ax0 + 2, ax1 - 2, 9, NAVY[4])
        c.rect(ax0 + 1, 11, ax1 - 1, 17, NAVY[3])
        c.hline(ax0 + 1, ax1 - 1, 18, NAVY[1])
        c.vline(ax0, 13, 54, NAVY[3] if ax0 == 0 else NAVY[2])
        c.vline(ax1, 13, 54, NAVY[0])
        c.hline(ax0 + 1, ax1 - 1, 56, NAVY[0])
    c.round_rect(13, 14, 82, 54, NAVY[2], 4)
    c.hline(15, 80, 14, NAVY[4])
    c.hline(14, 81, 15, NAVY[3])
    c.rect(14, 16, 81, 19, NAVY[3])
    c.hline(14, 81, 20, NAVY[1])
    c.vline(13, 18, 52, NAVY[3])
    c.vline(82, 18, 52, NAVY[0])
    c.hline(14, 81, 54, NAVY[0])
    for (x0, x1) in ((15, 47), (48, 80)):
        c.vline(x0 + 2, 24, 50, NAVY[3])
        c.vline(x1 - 2, 24, 50, NAVY[1])
        c.hline(x0 + 2, x1 - 2, 50, NAVY[1])
    c.vline(47, 20, 53, NAVY[0])
    c.rect(5, 57, 9, 59, "#16161c")
    c.rect(86, 57, 90, 59, "#16161c")
    if throw:
        c.poly([(16, 13), (80, 13), (80, 30), (16, 30)], RED_C[2])
        damask(c, 16, 14, 80, 30, RED_C[2], RED_C[1], RED_C[4], 6)
        c.hline(16, 80, 13, RED_C[4])
        c.hline(16, 80, 30, RED_C[0])
    c.outline()
    return c


def sofa_bed():
    """The sofa opened into a bed, 3 x 4 tiles: the navy back and arms at the top, a quilted grey bedspread over the mattress, the
    black metal frame and its folded legs at the foot."""
    c = Canvas(3 * T, 4 * T)
    c.shadow(48, 124, 46, 3, 80)
    # the metal frame: rails and two folded legs at the foot
    c.rect(6, 112, 89, 116, "#1a1c24")
    c.hline(6, 89, 112, "#5a5c68")
    for lx in (10, 82):
        c.rect(lx, 112, lx + 3, 124, "#1a1c24")
        c.vline(lx, 112, 124, "#4a4c58")
    c.line(14, 116, 40, 122, "#1a1c24")
    c.line(80, 116, 56, 122, "#1a1c24")
    sofa_body(c, bed=True)
    # the mattress with the quilted cover, from the backrest down to the foot
    c.rect(13, 36, 82, 112, "#a8a8bc")
    for y in range(36, 112):
        for x in range(13, 83):
            t = ((x + y) % 14 == 0) or ((x - y) % 14 == 0)
            if t:
                c.set(x, y, "#c8c8dc")
            elif ((x + y) % 14 == 7) or ((x - y) % 14 == 7):
                c.set(x, y, "#8888a0")
    c.rect(13, 36, 82, 38, "#8a8aa4")
    c.hline(13, 82, 39, "#c8c8dc")
    c.hline(13, 82, 112, "#6a6a84")
    c.hline(13, 82, 111, "#8a8aa4")
    c.vline(13, 36, 112, "#d8d8ec")
    c.vline(82, 36, 112, "#6a6a84")
    c.hline(13, 82, 108, "#d8d8ec")
    c.poly([(30, 40), (60, 40), (52, 52), (30, 52)], "#b4b4cc")   # a fold in the cover
    c.hline(30, 60, 40, "#d8d8ec")
    c.outline()
    return c


# ---------------------------------------------------------------- tv unit, tree

def tv_unit():
    """3 x 2 tiles: the low white four door cabinet with a flat screen on it playing pink and blue static, headphones and a toy on top.
    The screen is in the upper row, in front of the dark wall; the cabinet front stands on the floor row."""
    c = Canvas(3 * T, 2 * T)
    c.shadow(48, 61, 47, 2.6, 80)
    # the cabinet: top face, front with four doors and handle slots, plinth
    c.rect(0, 33, 95, 38, WHITE[4])
    c.hline(0, 95, 33, "#ffffff")
    c.rect(0, 39, 95, 58, WHITE[3])
    for xx in (0, 24, 48, 72, 95):
        c.vline(xx, 39, 58, WHITE[1])
    for xx in (22, 26, 46, 50, 70, 74):
        c.vline(xx, 42, 50, WHITE[2])
    c.hline(0, 95, 39, WHITE[2])
    c.hline(0, 95, 58, WHITE[1])
    c.rect(0, 59, 95, 60, WHITE[0])
    # the TV: black bezel, a bright pink and blue screen, a small steel stand
    c.rect(24, 5, 74, 28, "#101016")
    c.hline(24, 74, 5, "#3a3a44")
    c.rect(26, 7, 72, 25, "#e8a0d8")
    for y in range(7, 26):
        for x in range(26, 73):
            k = (math.sin(x * .33 + y * .21) + math.cos(x * .17 - y * .4)) * .5
            tone = "#ff6ec0" if k > .35 else ("#c890ff" if k > -.1 else ("#6ab0ff" if k > -.55 else "#f0e8ff"))
            c.set(x, y, tone)
    c.hline(26, 72, 7, "#ffd0f0")
    c.vline(26, 7, 25, "#ffe0f8")
    c.rect(44, 28, 54, 32, "#2a2a32")
    c.hline(38, 60, 33, "#2a2a32")
    # headphones on the right of the cabinet top, a small figure on the left
    c.ell(82, 30, 5, 3, "#1a1a20")
    c.ell(82, 29, 3, 1.6, "#4a4a58")
    c.rect(8, 27, 14, 32, "#c8683a")
    c.set(10, 25, "#4f9250")
    c.set(11, 24, "#4f9250")
    c.set(12, 25, "#4f9250")
    c.outline()
    c.glow(49, 17, 30, "#ff9ad8", 40)
    return c


def xmas_tree():
    """1 x 2 tiles: a small white artificial Christmas tree full of warm lights on a little pot."""
    c = Canvas(T, 2 * T)
    c.shadow(16, 61, 11, 2.4, 80)
    c.rect(11, 52, 20, 60, "#a86a3c")
    c.hline(11, 20, 52, "#d4a45c")
    c.hline(11, 20, 60, "#5a3420")
    for (y0, hw) in ((8, 6), (20, 9), (32, 12), (44, 14)):         # four layers of branches
        for k in range(0, 14):
            y = y0 + k
            w = hw * (k + 2) / 16
            c.hline(16 - w, 16 + w, y, "#e8f0e8" if k % 3 else "#cfd8d4")
        c.hline(16 - hw, 16 + hw, y0 + 13, "#9aa8a4")
    c.rect(15, 5, 16, 8, "#e8f0e8")
    c.set(15, 3, "#ffd890")
    c.set(16, 4, "#ffd890")
    r = rng("tree")
    for _ in range(22):
        y = r.randrange(10, 52)
        w = 3 + (y - 8) * .27
        x = int(16 + r.uniform(-w, w))
        c.set(x, y, r.choice(["#ffd890", "#fff0b0", "#ffb8d8", "#a8d8ff"]))
    c.outline()
    c.glow(16, 34, 18, "#ffe9c0", 55)
    return c


# ---------------------------------------------------------------- the dining table and the chairs

# the golden plates and cups of the dinner table, shared by the long table and the one turned north to south
def _plate(c, cx, cy, tone="#efc04a", rx=10, ry=4, food=None):
    c.ell(cx, cy + 1, rx + 1, ry + 1, "#8a5a18")
    c.ell(cx, cy, rx, ry, tone)
    c.ell(cx - 1, cy - 1, rx - 3, ry - 2, light(hx(tone), .3))
    if food == "tort":
        for (fx, fy) in ((-5, 0), (-2, -1), (1, 0), (4, -1), (-3, 1), (2, 1), (6, 0)):
            c.set(cx + fx, cy + fy, "#e8c070")
            c.set(cx + fx + 1, cy + fy, "#b8863a")
    elif food == "ham":
        for (fx, fy) in ((-6, 0), (-2, -1), (3, 0), (1, 1)):
            c.rect(cx + fx, cy + fy, cx + fx + 3, cy + fy + 1, "#e8808c")
        c.set(cx + 5, cy, "#6aa04a")
    elif food == "salad":
        for (fx, fy) in ((-5, 0), (-1, -1), (3, 0), (0, 1), (5, 1)):
            c.set(cx + fx, cy + fy, "#5aa65a")
            c.set(cx + fx + 1, cy + fy, "#e84a3a")
    elif food == "bread":
        for (fx, fy) in ((-5, 0), (-1, -1), (3, 0), (1, 1)):
            c.rect(cx + fx, cy + fy, cx + fx + 2, cy + fy + 1, "#d8a040")


def _cup(c, cx, cy):
    c.rect(cx - 2, cy - 6, cx + 2, cy, "#d9a02a")
    c.hline(cx - 2, cx + 2, cy - 6, "#f8d870")
    c.vline(cx - 2, cy - 5, cy, "#f0c860")
    c.vline(cx + 2, cy - 5, cy, "#a8741c")
    c.hline(cx - 2, cx + 2, cy, "#8a5a18")
    c.set(cx, cy - 8, "#c8c8d0")           # a fork in the cup
    c.set(cx + 1, cy - 7, "#c8c8d0")


def table():
    """4 x 2 tiles: the long table with the red damask cloth: golden plates of tortellini and ham, golden cups with forks, a candle,
    a teal napkin, the cloth hanging at the front."""
    c = Canvas(4 * T, 2 * T)
    c.shadow(64, 61, 60, 2.6, 80)
    damask(c, 2, 8, 125, 46, RED_C[2], RED_C[1], RED_C[3], 6)
    c.rect(2, 8, 125, 9, RED_C[3])
    c.hline(2, 125, 8, RED_C[4])
    c.vline(2, 9, 46, RED_C[3])
    c.vline(125, 9, 46, RED_C[1])
    c.rect(1, 47, 126, 58, RED_C[1])                  # the front drop of the cloth
    for x in range(1, 127):
        c.vline(x, 47, 58 + (1 if x % 8 < 4 else 0), RED_C[1] if (x // 4) % 2 else RED_C[2])
    for x in range(1, 127, 8):
        c.vline(x, 49, 57, RED_C[0])
    c.hline(1, 126, 47, RED_C[0])
    c.hline(2, 125, 46, RED_C[0])
    c.hline(1, 126, 59, RED_C[0])
    # the table top is seen from above: items stand on it
    plate = lambda *a, **k: _plate(c, *a, **k)
    cup = lambda *a, **k: _cup(c, *a, **k)

    plate(30, 22, food="tort")
    plate(66, 20, "#f4d878", 12, 5, "ham")
    plate(98, 26, "#efc04a", 10, 4, "salad")
    plate(20, 36, "#efc04a", 9, 4, "bread")
    plate(104, 14, "#efc04a", 9, 3.4, "tort")
    for (cx, cy) in ((46, 14), (84, 12), (52, 32), (80, 36), (118, 22)):
        cup(cx, cy)
    c.rect(8, 20, 13, 24, "#e8e0d0")      # a candle in a glass, with its flame
    c.rect(9, 18, 12, 20, "#f4e8c8")
    c.set(10, 15, "#ffd870")
    c.set(10, 16, "#ff9a3a")
    c.set(11, 16, "#ff9a3a")
    c.glow(10, 16, 8, "#ffd070", 90)
    c.rect(58, 36, 70, 39, "#2f8a8a")     # a teal napkin and a turquoise bowl
    c.hline(58, 70, 36, "#5ac0c0")
    c.ell(92, 12, 6, 2.6, "#2a8a9a")
    c.ell(92, 11, 4, 1.6, "#6ac8d0")
    c.outline()
    return c


def table_v():
    """3 x 4 tiles: the same dinner table turned to run north to south, as the owner's floor plan has it (chairs on its two long sides):
    the red damask cloth, golden plates, cups with forks, a candle, a teal napkin, the cloth hanging at the south end."""
    c = Canvas(3 * T, 4 * T)
    c.shadow(48, 125, 44, 2.6, 80)
    damask(c, 2, 8, 93, 110, RED_C[2], RED_C[1], RED_C[3], 6)
    c.rect(2, 8, 93, 9, RED_C[3])
    c.hline(2, 93, 8, RED_C[4])
    c.vline(2, 9, 110, RED_C[3])
    c.vline(93, 9, 110, RED_C[1])
    c.rect(1, 111, 94, 122, RED_C[1])                 # the front drop of the cloth
    for x in range(1, 95):
        c.vline(x, 111, 122 + (1 if x % 8 < 4 else 0), RED_C[1] if (x // 4) % 2 else RED_C[2])
    for x in range(1, 95, 8):
        c.vline(x, 113, 121, RED_C[0])
    c.hline(1, 94, 111, RED_C[0])
    c.hline(2, 93, 110, RED_C[0])
    c.hline(1, 94, 123, RED_C[0])
    plate = lambda *a, **k: _plate(c, *a, **k)
    cup = lambda *a, **k: _cup(c, *a, **k)
    plate(28, 26, food="tort")
    plate(66, 42, "#f4d878", 12, 5, "ham")
    plate(30, 68, "#efc04a", 10, 4, "salad")
    plate(66, 86, "#efc04a", 9, 4, "bread")
    plate(44, 100, "#efc04a", 9, 3.4, "tort")
    for (cx, cy) in ((54, 20), (20, 46), (52, 62), (82, 66), (14, 90), (80, 104)):
        cup(cx, cy)
    c.rect(66, 18, 71, 22, "#e8e0d0")     # a candle in a glass, with its flame
    c.rect(67, 16, 70, 18, "#f4e8c8")
    c.set(68, 13, "#ffd870")
    c.set(68, 14, "#ff9a3a")
    c.set(69, 14, "#ff9a3a")
    c.glow(68, 14, 8, "#ffd070", 90)
    c.rect(36, 78, 48, 81, "#2f8a8a")     # a teal napkin and a turquoise bowl
    c.hline(36, 48, 78, "#5ac0c0")
    c.ell(78, 28, 6, 2.6, "#2a8a9a")
    c.ell(78, 27, 4, 1.6, "#6ac8d0")
    c.outline()
    return c


def chair(kind, face):
    """kind 'ghost' (clear acrylic, drawn translucent) or 'white' (white wooden folding chair); face 'n' (sits north of the table,
    faces south), 's', 'e' or 'w'."""
    c = Canvas()
    c.shadow(16, 29, 9, 2.2, 70)
    ghost = kind == "ghost"
    if ghost:
        body, edge, lit, seat = (150, 196, 232, 120), (70, 116, 168, 235), (240, 250, 255, 245), (176, 214, 242, 170)
    else:
        body, edge, lit, seat = hx(WHITE[3]), hx(WHITE[1]), hx(WHITE[4]), hx(WHITE[4])
    leg = (84, 128, 176, 230) if ghost else hx(WHITE[1])

    def rectangle(x0, y0, x1, y1, fill, border=True):
        c.rect(x0, y0, x1, y1, fill)
        if border:
            c.hline(x0, x1, y0, lit)
            c.vline(x0, y0, y1, lit)
            c.hline(x0, x1, y1, edge)
            c.vline(x1, y0, y1, edge)

    if face == "n":
        for lx in (8, 22):
            c.rect(lx, 22, lx + 1, 29, leg)
        rectangle(7, 3, 24, 14, body)            # the backrest, seen from the front
        if not ghost:
            for sx in (11, 15, 19):
                c.vline(sx, 5, 13, edge)
        rectangle(6, 15, 25, 23, seat)           # the seat
    elif face == "s":
        rectangle(6, 5, 25, 12, seat)            # the seat, behind the backrest
        for lx in (8, 22):
            c.rect(lx, 23, lx + 1, 29, leg)
        rectangle(7, 12, 24, 25, body)           # the backrest, seen from behind
        if not ghost:
            for sx in (11, 15, 19):
                c.vline(sx, 14, 24, edge)
    elif face == "e":                            # sits at the west end, faces east: backrest on the left
        for lx in (8, 22):
            c.rect(lx, 22, lx + 1, 29, leg)
        rectangle(6, 14, 24, 23, seat)
        rectangle(5, 3, 9, 24, body)
        if not ghost:
            for sy in (7, 11, 15, 19):
                c.hline(5, 9, sy, edge)
    else:                                        # 'w': sits at the east end, faces west: backrest on the right
        for lx in (8, 22):
            c.rect(lx, 22, lx + 1, 29, leg)
        rectangle(7, 14, 25, 23, seat)
        rectangle(22, 3, 26, 24, body)
        if not ghost:
            for sy in (7, 11, 15, 19):
                c.hline(22, 26, sy, edge)
    if not ghost:
        c.outline()
    return c


# ---------------------------------------------------------------- living room pieces

def rug():
    """5 x 3 tiles: a woven wine red rug with a cream and teal border and short fringe, for under the coffee table."""
    c = Canvas(5 * T, 3 * T)
    W, H = 5 * T, 3 * T
    c.rect(3, 4, W - 4, H - 5, "#3a1822")
    c.rect(5, 6, W - 6, H - 7, "#7a2a3a")
    c.rect(8, 9, W - 9, H - 10, "#e8d8b0")
    c.rect(10, 11, W - 11, H - 12, "#2f6a74")
    c.rect(13, 14, W - 14, H - 15, "#a8384c")
    for y in range(14, H - 14):
        for x in range(13, W - 13):
            if (x // 5 + y // 5) % 2 == 0 and (x % 5) in (1, 2, 3) and (y % 5) in (1, 2, 3):
                c.set(x, y, "#c8566a")
            if (x + y) % 13 == 0:
                c.set(x, y, "#e8c470")
    c.hline(5, W - 6, 6, "#a8384c")
    c.hline(10, W - 11, 11, "#5aa0a8")
    for x in range(5, W - 5, 3):                      # fringe at the short ends
        c.set(x, 3, "#d8c8a0")
        c.set(x, H - 4, "#d8c8a0")
        c.set(x, 2, "#c0b088")
        c.set(x, H - 3, "#c0b088")
    return c


def coffee_table():
    """2 x 1 tile: a low wooden table with a big pink bowl, glasses, a beer bottle and a remote, as in the photo of the TV corner."""
    c = Canvas(2 * T, T)
    c.shadow(32, 29, 29, 2.4, 76)
    c.rect(3, 8, 60, 22, TABLE[3])
    c.hline(3, 60, 8, TABLE[4])
    c.hline(3, 60, 9, light(TABLE[3], .2))
    c.vline(3, 9, 22, light(TABLE[3], .2))
    for x in range(8, 58, 11):
        c.hline(x, x + 6, 14, TABLE[2])
    c.rect(3, 23, 60, 27, TABLE[1])
    c.hline(3, 60, 23, TABLE[2])
    c.hline(3, 60, 27, TABLE[0])
    c.rect(5, 28, 8, 30, TABLE[0])
    c.rect(55, 28, 58, 30, TABLE[0])
    c.ell(20, 14, 8, 4.4, "#d83a84")        # the pink bowl
    c.ell(20, 13, 6.4, 3, "#f06ca8")
    c.ell(20, 14, 5, 2, "#ff9ac8")
    c.hline(13, 27, 12, "#ffc0dc")
    c.rect(34, 11, 37, 17, "#cfe8f4")        # a glass
    c.vline(34, 11, 17, "#ffffff")
    c.hline(34, 37, 17, "#8aa6b8")
    c.rect(43, 6, 45, 14, "#6a3a1a")         # the beer bottle
    c.rect(44, 3, 44, 6, "#6a3a1a")
    c.rect(43, 10, 45, 12, "#c4403f")
    c.set(44, 3, "#d8c070")
    c.rect(49, 13, 57, 16, "#16161c")        # the remote
    c.hline(49, 57, 13, "#3a3a44")
    c.set(51, 14, "#c4403f")
    c.set(54, 14, "#3a58ba")
    c.rect(8, 17, 14, 19, "#f4f1ea")         # a paper napkin
    c.outline()
    return c


def beanbag():
    """1 x 1: the big pink pouf by the sofa."""
    c = Canvas()
    c.shadow(16, 28, 13, 2.6, 78)
    c.ell(16, 19, 13, 9.4, PINK[1])
    c.ell(15.5, 17.5, 12, 8.2, PINK[2])
    c.ell(14, 15, 8, 4.6, PINK[3])
    c.ell(12, 13.5, 3.6, 2, PINK[4])
    c.hline(8, 22, 21, PINK[1])
    c.vline(21, 12, 25, PINK[1])
    c.outline()
    return c


def plant_red():
    """1 x 1: a small red bromeliad in a pot on the floor by the glass door."""
    c = Canvas()
    c.shadow(16, 29, 8, 2, 70)
    c.rect(11, 20, 21, 28, "#8a2a2a")
    c.rect(11, 20, 21, 22, "#c8523f")
    c.vline(21, 22, 28, "#5a1a1a")
    for (x1, y1) in ((6, 10), (9, 6), (16, 4), (23, 7), (26, 11), (12, 9), (20, 9)):
        c.line(16, 20, x1, y1, "#3f7a46")
        c.line(17, 20, x1 + 1, y1 + 1, "#2f6a3a")
    for (x1, y1) in ((13, 12), (17, 9), (20, 13), (15, 14)):
        c.line(16, 19, x1, y1, "#d8402a")
        c.disc(x1, y1, 1.6, "#ff6a3a")
        c.set(x1, y1, "#ffd0a0")
    c.outline()
    return c


def floorlamp():
    """1 x 3: a tall steel floor lamp with two round heads, the upper one tilted; a warm glow around the heads."""
    c = Canvas(T, 3 * T)
    c.shadow(16, 92, 9, 2.4, 80)
    c.rect(10, 88, 21, 92, "#2a2a32")
    c.hline(10, 21, 88, "#5a5a66")
    c.rect(15, 22, 16, 88, "#9aa4b4")
    c.vline(15, 22, 88, "#dfe6ee")
    c.vline(16, 22, 88, "#5a6678")
    c.rect(14, 56, 17, 58, "#6a7688")
    c.glow(18, 14, 18, "#ffe2a0", 110)
    c.glow(9, 34, 14, "#ffe2a0", 90)
    c.ell(20, 12, 9, 5, "#e8e2d0")           # upper head: a round shade seen from below, lit
    c.ell(20, 13, 7, 3.4, "#fff6c8")
    c.ell(20, 13, 4, 2, "#ffffff")
    c.hline(12, 28, 9, "#c8c2b0")
    c.line(16, 22, 18, 16, "#9aa4b4")
    c.ell(9, 33, 7, 4, "#e8e2d0")           # lower head
    c.ell(9, 34, 5, 2.6, "#fff6c8")
    c.line(15, 40, 11, 36, "#9aa4b4")
    c.outline()
    return c


def scooter():
    """1 x 2: an electric kick scooter standing against the wall: a black stem with handlebars and the deck."""
    c = Canvas(T, 2 * T)
    c.shadow(16, 61, 13, 2.2, 76)
    c.rect(18, 4, 25, 6, "#1a1a20")                       # handlebars
    c.hline(18, 25, 4, "#585866")
    c.rect(21, 7, 22, 46, "#2a2a32")                      # the stem
    c.vline(21, 7, 46, "#585866")
    c.rect(19, 40, 24, 50, "#1a1a20")                     # the folding joint
    c.rect(6, 52, 26, 57, "#1e1e26")                      # the deck
    c.hline(6, 26, 52, "#585866")
    c.disc(8, 58, 3, "#14141a")
    c.disc(24, 58, 3, "#14141a")
    c.set(8, 57, "#585866")
    c.set(24, 57, "#585866")
    c.rect(11, 50, 14, 51, "#c4403f")                     # a tail light
    c.outline()
    return c


def bowl():
    """1 x 1: the big steel bowl of pasta left on the floor in the corner."""
    c = Canvas()
    c.shadow(16, 27, 12, 2.4, 76)
    c.ell(16, 19, 12, 7.4, STEEL[1])
    c.ell(16, 18, 11, 6.4, STEEL[3])
    c.ell(16, 17, 9, 4.6, "#e8c070")
    for (x, y) in ((11, 16), (14, 15), (18, 16), (21, 17), (13, 19), (17, 19), (20, 14)):
        c.set(x, y, "#b8863a")
        c.set(x + 1, y, "#f4dc98")
    c.hline(8, 14, 13, STEEL[4])
    c.outline()
    return c


def coatstand():
    """1 x 2: a white tripod coat stand wound with fairy lights, with a red scarf on a peg."""
    c = Canvas(T, 2 * T)
    c.shadow(16, 61, 12, 2.4, 78)
    for (x0, x1) in ((16, 16), (16, 8), (16, 24)):       # three legs from the crown to the floor
        c.line(16, 8, x0 if x1 == 16 else x1, 58, "#e8e2d8")
    c.line(17, 8, 17, 58, "#b8b2a8")
    c.line(15, 8, 8, 58, "#cfc9bf")
    c.line(17, 8, 24, 58, "#a8a29a")
    for (px, py) in ((11, 22), (21, 22), (13, 34), (19, 34)):    # pegs
        c.rect(px, py, px + 1, py + 2, "#a8a29a")
    c.rect(20, 22, 23, 38, "#c4303a")                     # the scarf hanging from a peg
    c.vline(20, 22, 38, "#e8606a")
    c.vline(23, 24, 38, "#8a1a28")
    fairy(c, [(15, 10), (11, 24), (14, 38), (9, 52)], "coat1")
    fairy(c, [(17, 14), (22, 28), (19, 40), (24, 54)], "coat2")
    c.glow(16, 28, 14, "#ffd890", 40)
    c.outline()
    return c


def doormat():
    """2 x 1: a coir mat with a dark border and CIAO in cream pixel letters."""
    c = Canvas(2 * T, T)
    c.rect(6, 8, 57, 26, "#3a2e26")
    c.rect(8, 10, 55, 24, "#8a7458")
    for x in range(8, 56, 3):
        c.vline(x, 10, 24, "#7a6448")
    c.hline(6, 57, 8, "#5a4a3a")
    c.hline(8, 55, 10, "#a89070")
    c.text(16, 13, "CIAO", "#f0e4c0", 1)
    c.hline(6, 57, 26, "#1e1612")
    c.outline()
    return c


def entrance_gap():
    """2 x 1, in the bottom wall: a white door frame, the night outside under a porch lamp and a stone step; people walk through it."""
    c = Canvas(2 * T, T)
    c.rect(0, 0, 2 * T - 1, T - 1, "#101a3a")
    c.vgrad(5, 0, 2 * T - 6, T - 1, "#1a2a58", "#0c1230")
    for x in range(6, 2 * T - 6, 8):
        for y in range(6, T, 8):
            c.round_rect(x + 1, y + 1, x + 6, y + 5, mix("#2a3a6a", "#e8b060", .22), 2)
    c.glow(32, 18, 26, "#ffcf72", 100)
    c.rect(0, 0, 4, T - 1, WHITE[2])
    c.vline(0, 0, T - 1, WHITE[4])
    c.vline(4, 0, T - 1, WHITE[0])
    c.rect(2 * T - 5, 0, 2 * T - 1, T - 1, WHITE[2])
    c.vline(2 * T - 5, 0, T - 1, WHITE[4])
    c.vline(2 * T - 1, 0, T - 1, WHITE[0])
    c.rect(5, 0, 2 * T - 6, 5, "#c4b794")
    c.hline(5, 2 * T - 6, 0, "#dad3b7")
    c.hline(5, 2 * T - 6, 5, "#705e52")
    return c


# ---------------------------------------------------------------- floor

def floor_tile(variant):
    """Large pale beige floor tiles, each 2 x 2 tiles (64 px) with a thin grout: variant 0 top left cell, 1 top right, 2 bottom left,
    3 bottom right, so the map places them by the parity of x and y."""
    c = Canvas()
    base = "#e0d2b8"
    c.rect(0, 0, T - 1, T - 1, base)
    right, bottom = variant in (1, 3), variant in (2, 3)
    if right:
        c.vline(T - 1, 0, T - 1, "#b8a68a")
        c.vline(T - 2, 0, T - 1, "#cbbb9f")
    else:
        c.vline(0, 0, T - 1, "#ece0c8") if variant == 0 or variant == 2 else None
    if bottom:
        c.hline(0, T - 1, T - 1, "#b8a68a")
        c.hline(0, T - 1, T - 2, "#cbbb9f")
    else:
        c.hline(0, T - 1, 0, "#ece0c8")
    if variant == 1:
        c.hline(0, T - 2, 0, "#ece0c8")
    if variant == 2:
        c.hline(0, T - 2, 0, "#ece0c8")
    for k in range(5):                                   # a soft sheen toward the top left of the big tile, hand placed
        if variant == 0:
            c.set(6 + k * 2, 8 + k, "#eadfc8")
            c.set(7 + k * 2, 8 + k, "#eadfc8")
    if variant == 3:
        c.set(8, 10, "#cfc0a4")
        c.set(9, 10, "#cfc0a4")
    return c


def define(reg):
    for v in range(4):
        reg.tile("circe_floor_" + "abcd"[v], floor_tile(v))
    reg.stamp("circe_wall_stairs", wall_stairs(), "walls")
    reg.stamp("circe_wall_shelf", wall_shelf(), "walls")
    reg.stamp("circe_wall_door", wall_door(), "walls")
    reg.stamp("circe_wall_kitchen", wall_kitchen(), "walls")
    reg.stamp("circe_wall_kitchen_flip", wall_kitchen_flip(), "walls")
    reg.stamp("circe_wall_sofa", wall_sofa(), "walls")
    reg.stamp("circe_entrance", entrance_gap(), "walls")
    reg.stamp("circe_sofa_front", sofa_front(), "objects", mask=["...", "###"])
    reg.stamp("circe_sofa_front_throw", sofa_front(True), "objects", mask=["...", "###"])
    reg.stamp("circe_sofa_back", sofa_back(), "objects", mask=["...", "###"])
    reg.stamp("circe_sofa_back_throw", sofa_back(True), "objects", mask=["...", "###"])
    reg.stamp("circe_sofa_bed", sofa_bed(), "objects", mask=["...", "...", "###", "###"])
    reg.stamp("circe_tv_unit", tv_unit(), "objects", mask=["...", "###"])
    reg.stamp("circe_xmas_tree", xmas_tree(), "objects", mask=[".", "#"])
    reg.stamp("circe_table", table(), "objects", mask=["####", "####"])
    reg.stamp("circe_table_v", table_v(), "objects", mask=["###", "###", "###", "###"])
    for kind in ("ghost", "white"):
        for face in "nsew":
            reg.stamp("circe_chair_%s_%s" % (kind, face), chair(kind, face), "objects")
    reg.stamp("circe_rug", rug(), "below")
    reg.stamp("circe_coffee_table", coffee_table(), "objects")
    reg.stamp("circe_beanbag", beanbag(), "objects")
    reg.stamp("circe_bowl", bowl(), "objects")
    reg.stamp("circe_plant_red", plant_red(), "objects")
    reg.stamp("circe_floorlamp", floorlamp(), "objects", above_rows=2, mask=[".", ".", "#"])
    reg.stamp("circe_scooter", scooter(), "objects", mask=[".", "#"])
    reg.stamp("circe_coatstand", coatstand(), "objects", mask=[".", "#"])
    reg.stamp("circe_doormat", doormat(), "below")
