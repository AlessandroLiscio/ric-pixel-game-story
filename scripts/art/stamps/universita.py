"""Stamps of the lecture hall (aula magna), rebuilt from the two reference photos (shapes only, nothing copied; the pinhole sketch and
the exit signs are our own pixel drawings): a historic hall with warm tan ashlar walls and a carved cornice, the front wall with the
white projection screen between two whiteboards, dark wooden pilasters and an inlaid honey wood panel, a long panelled lectern in front
of it with a document camera, a small arched wooden door on the left and the big arched doorway on the right with a lit vending machine
behind it, olive green wall panels with round relief medallions, on the left the tall wooden windows with roller blinds above the gallery
balustrade of turned wooden balusters, the recessed glazed door and the green exit sign under it, and the whole floor of curved
amphitheatre benches: honey wood desks in concentric arcs around a blue grey carpeted floor, dark risers, aisles of dark slate slabs
with the steps and the curved wooden ends topped by the turned ball newel of the second photo, students seated along the rows.

`universita_wall_front` (20 x 4 tiles) is the whole front wall in one picture; `universita_bowl` (20 x 8 tiles) is the floor of the
hall, the stage, the aisles and all the benches, with the students painted in from the crowd sheets (the lower body hides behind the
desk of the next row, as it does from a camera standing behind the rows). Every name starts with `universita_`."""
import math
from pathlib import Path

from PIL import Image

from tilepaint import GOLD, Canvas, T, col, dark, hx, light, make_ramp, mix, rng

ROOT = Path(__file__).resolve().parents[3]

TAN = make_ramp("#c9a771", 5, 2)             # ashlar stone, warm tan
OLIVE = make_ramp("#8a8c62", 4, 1, dark_hue=240, sh=14)    # the olive green wall panels
HONEY = make_ramp("#c98b42", 5, 2)           # bench desks, the inlaid panel
WALNUT = make_ramp("#5e3420", 5, 2)          # dark wood: risers, pilasters, doors
CARP = make_ramp("#5f6c8c", 4, 1, dark_hue=260, sh=10)       # the blue grey carpet of the stage
SLATE = make_ramp("#4d5669", 5, 1, dark_hue=255, sh=10)      # the aisles and corridors
WALL_H = 4 * T
WW = 20 * T

# the bowl: one picture of the hall floor, rows 5 to 12 of the map. Centre of the arcs at the foot of the screen; the arcs are ellipses
# (K wider than tall) because the room is seen from an angle.
BW, BH = 20 * T, 8 * T
CX, CY, K = 391, 14, 1.5
R0, TH = 112, 32
FRONT_Y, REAR_Y = 32, 224
AISLES = [(160, 224), (512, 576)]
STRIP = 32                                   # the side aisle along the left wall


def tint(c, x0, y0, x1, y1, colr, t):
    for y in range(max(0, y0), min(c.h - 1, y1) + 1):
        for x in range(max(0, x0), min(c.w - 1, x1) + 1):
            p = c.get(x, y)
            if p[3]:
                q = mix(p, colr, t)
                c.set(x, y, q[:3] + (p[3],))


def fade_down(c, x0, x1, y0, y1, colr=(30, 14, 36), a0=.5):
    n = max(1, y1 - y0)
    for y in range(y0, y1 + 1):
        t = a0 * (1 - (y - y0) / n) ** 1.5
        for x in range(x0, x1 + 1):
            p = c.get(x, y)
            if p[3]:
                c.set(x, y, mix(p, colr, t if (x + y) % 2 == 0 or t > .18 else t * .55)[:3] + (p[3],))


# ---------------------------------------------------------------- the front wall

def ashlar(c, x0, y0, x1, y1):
    """Courses of tan stone: a 13 px course, a darker joint with a lit line under it, the vertical joints running bond."""
    r = rng("uni-ashlar")
    c.rect(x0, y0, x1, y1, TAN[2])
    for i, y in enumerate(range(y0 + 4, y1 + 1, 13)):
        c.hline(x0, x1, y, TAN[1])
        c.hline(x0, x1, y + 1, TAN[3])
        off = (i % 2) * 22
        for x in range(x0 + 14 + off, x1, 44):
            c.vline(x, y + 2, min(y1, y + 12), TAN[1])
            c.vline(x + 1, y + 2, min(y1, y + 12), light(TAN[2], .22))
    for _ in range(26):                       # soft lighter and darker patches on the stone (dithered, hand placed)
        x, y = r.randrange(x0, x1 - 14), r.randrange(y0 + 4, y1 - 8)
        c.dither(x, y, x + r.randrange(6, 14), y + r.randrange(2, 5), TAN[2], light(TAN[2], .12) if r.random() < .55 else dark(TAN[2], .08), .25, r.randrange(2))


def cornice(c, x0, x1):
    """The carved cornice under the ceiling: shade above, a lit moulding with dentils, a shadow line, then the soft shade on the wall."""
    c.rect(x0, 0, x1, 2, dark(TAN[0], .35))
    c.rect(x0, 3, x1, 6, TAN[3])
    c.hline(x0, x1, 3, TAN[4])
    for x in range(x0 + 2, x1, 6):
        c.rect(x, 4, x + 2, 6, TAN[1])
    c.hline(x0, x1, 7, TAN[0])
    c.hline(x0, x1, 8, dark(TAN[1], .3))
    for y in range(9, 18):
        t = .4 * (1 - (y - 9) / 9) ** 1.3
        for x in range(x0, x1 + 1):
            c.set(x, y, mix(c.get(x, y), (44, 26, 78), t))


def skirting(c, x0, x1, y1=WALL_H - 1, h=7):
    c.rect(x0, y1 - h + 1, x1, y1, WALNUT[2])
    c.hline(x0, x1, y1 - h + 1, light(WALNUT[3], .25))
    c.hline(x0, x1, y1 - h + 2, WALNUT[3])
    c.hline(x0, x1, y1 - 1, WALNUT[1])
    c.hline(x0, x1, y1, dark(WALNUT[0], .4))
    for x in range(x0 + 9, x1, 26):
        c.vline(x, y1 - h + 3, y1 - 2, WALNUT[1])


def window(c, x0, y0, w, h, seed):
    """A tall wooden window: dark brown frame, white glazing bars, a glimpse of green outside, a roller blind half down, a stone sill."""
    r = rng("uni-win" + seed)
    fr, frl = WALNUT[2], WALNUT[4]
    c.rect(x0 - 3, y0 - 2, x0 + w + 2, y0 + h + 1, WALNUT[1])
    c.vline(x0 - 3, y0 - 2, y0 + h + 1, frl)
    c.hline(x0 - 3, x0 + w + 2, y0 - 2, frl)
    c.rect(x0, y0, x0 + w - 1, y0 + h - 1, "#cfe4e8")
    c.vgrad(x0, y0, x0 + w - 1, y0 + h - 1, "#b8d6e0", "#eaf4ee")
    for _ in range(5):                                          # trees and a lit slope seen through the glass
        lx, ly = x0 + r.randrange(2, w - 8), y0 + h - r.randrange(8, 18)
        c.ell(lx, ly, r.randrange(5, 9), r.randrange(3, 6), hx("#6f9a5e"))
        c.ell(lx - 1, ly - 1, 3, 2, hx("#9cc27c"))
    c.rect(x0, y0 + h - 7, x0 + w - 1, y0 + h - 1, "#7fa070")
    for gx in (x0 + w // 3, x0 + 2 * w // 3):
        c.vline(gx, y0, y0 + h - 1, "#f1ece0")
        c.vline(gx + 1, y0, y0 + h - 1, dark("#d8d0c0", .15))
    for gy in range(y0 + 10, y0 + h, 9):
        c.hline(x0, x0 + w - 1, gy, "#f1ece0")
        c.hline(x0, x0 + w - 1, gy + 1, dark("#d8d0c0", .15))
    c.rect(x0, y0, x0 + w - 1, y0 + 9, "#4e3a28")               # the roller blind, dark brown, with its lit hem
    c.hline(x0, x0 + w - 1, y0 + 9, "#8a6a48")
    c.hline(x0, x0 + w - 1, y0 + 10, dark("#4e3a28", .3))
    c.rect(x0 - 4, y0 + h + 2, x0 + w + 3, y0 + h + 4, TAN[4])   # the sill
    c.hline(x0 - 4, x0 + w + 3, y0 + h + 4, TAN[0])
    tint(c, x0, y0 + 10, x0 + w - 1, y0 + h - 1, "#fff4d0", .08)


def wall_strip_lamp(c, x, y):
    """The tall white strip lamp of the long wall: a pale tube in a narrow steel frame."""
    c.rect(x - 3, y - 1, x + 3, y + 17, "#3e3a40")
    c.rect(x - 2, y, x + 2, y + 16, "#f6f2e6")
    c.vline(x - 2, y, y + 16, "#ffffff")
    c.vline(x + 2, y, y + 16, "#d8d2c0")


def balustrade(c, x0, x1, y):
    """The gallery balustrade: a thick rail, turned balusters, a dark panelled base with lighter recessed panels, the shade under it."""
    c.rect(x0, y, x1, y + 2, WALNUT[3])
    c.hline(x0, x1, y, light(WALNUT[4], .2))
    c.hline(x0, x1, y + 3, WALNUT[0])
    c.rect(x0, y + 4, x1, y + 15, TAN[1])           # the dark gap between the balusters is the wall behind
    for x in range(x0 + 2, x1, 6):
        c.rect(x, y + 4, x + 1, y + 15, WALNUT[3])
        c.set(x, y + 5, WALNUT[4])
        c.rect(x - 1, y + 9, x + 2, y + 10, WALNUT[3])    # the swelling of a turned baluster
        c.vline(x + 1, y + 4, y + 15, WALNUT[1])
    c.rect(x0, y + 16, x1, y + 26, WALNUT[2])
    c.hline(x0, x1, y + 16, WALNUT[4])
    c.hline(x0, x1, y + 26, WALNUT[0])
    for x in range(x0 + 5, x1 - 20, 28):
        c.rect(x, y + 19, x + 21, y + 24, WALNUT[3])
        c.hline(x, x + 21, y + 19, WALNUT[1])
        c.vline(x, y + 19, y + 24, WALNUT[1])
    fade_down(c, x0, x1, y + 27, y + 38, a0=.55)


def tondo(c, cx, cy, r=10):
    """A round relief medallion: a bronze frame, a pale plaque with a head in profile."""
    c.disc(cx + 1, cy + 1, r + 1, dark(OLIVE[0], .4))
    c.disc(cx, cy, r, "#6a5230")
    c.disc(cx, cy, r - 1, "#a88a52")
    c.disc(cx, cy, r - 3, "#d9cfa8")
    c.disc(cx - 1, cy - 1, r - 5, "#e8e0c0")
    c.ell(cx + 1, cy - 1, 3.4, 4.4, "#8a7a52")      # the head
    c.ell(cx + 3, cy, 1.6, 2.2, "#8a7a52")
    c.rect(cx - 2, cy + 3, cx + 4, cy + 5, "#8a7a52")
    c.hline(cx - r + 2, cx - r + 4, cy - r + 3, "#fff4d0")


def olive_panel(c, x0, y0, x1, y1):
    c.rect(x0, y0, x1, y1, TAN[4])               # the lit stone frame
    c.rect(x0 + 2, y0 + 2, x1 - 2, y1 - 2, OLIVE[1])
    c.vgrad(x0 + 2, y0 + 2, x1 - 2, y1 - 2, OLIVE[2], OLIVE[1])
    c.hline(x0 + 2, x1 - 2, y0 + 2, OLIVE[0])
    c.vline(x0 + 2, y0 + 2, y1 - 2, OLIVE[0])
    c.hline(x0, x1, y1, TAN[0])
    c.vline(x1, y0, y1, TAN[1])


def pilaster(c, x0, x1, y0, y1):
    """A wooden pilaster: a lit capital, a long panelled shaft with a recess, a plinth."""
    c.rect(x0, y0, x1, y1, WALNUT[2])
    c.vline(x0, y0, y1, WALNUT[4])
    c.vline(x0 + 1, y0, y1, WALNUT[3])
    c.vline(x1, y0, y1, WALNUT[0])
    c.rect(x0 - 2, y0, x1 + 2, y0 + 4, WALNUT[3])
    c.hline(x0 - 2, x1 + 2, y0, light(WALNUT[4], .2))
    c.hline(x0 - 2, x1 + 2, y0 + 4, WALNUT[0])
    c.rect(x0 + 4, y0 + 10, x1 - 4, y1 - 14, WALNUT[1])
    c.hline(x0 + 4, x1 - 4, y0 + 10, WALNUT[0])
    c.vline(x0 + 4, y0 + 10, y1 - 14, WALNUT[0])
    c.hline(x0 + 4, x1 - 4, y1 - 14, WALNUT[3])
    c.vline(x1 - 4, y0 + 10, y1 - 14, WALNUT[3])
    c.rect(x0 - 1, y1 - 9, x1 + 1, y1 - 7, WALNUT[3])


def arched_door_small(c, x0, x1, ytop, ybase):
    """The small arched wooden door left of the screen: a pale stone surround, dark leaf with two panels, a brass handle."""
    w = x1 - x0
    r = w / 2
    ys = ytop + r
    for (ins, tone) in ((0, TAN[4]), (3, WALNUT[0]), (4, WALNUT[2])):
        c.rect(x0 + ins, ys, x1 - ins, ybase, tone)
        c.ell((x0 + x1) / 2, ys, r - ins, r - ins, tone, ymax=ys)
    c.vline(x0 + 4, ys, ybase, WALNUT[4])
    c.vline((x0 + x1) // 2, ys - 10, ybase, WALNUT[0])
    c.rect(x0 + 8, ys + 4, (x0 + x1) // 2 - 3, ys + 18, WALNUT[3])
    c.rect((x0 + x1) // 2 + 3, ys + 4, x1 - 8, ys + 18, WALNUT[3])
    c.rect(x0 + 8, ys + 24, (x0 + x1) // 2 - 3, ybase - 6, WALNUT[3])
    c.rect((x0 + x1) // 2 + 3, ys + 24, x1 - 8, ybase - 6, WALNUT[3])
    for (a, b) in ((x0 + 8, (x0 + x1) // 2 - 3), ((x0 + x1) // 2 + 3, x1 - 8)):
        c.hline(a, b, ys + 4, WALNUT[1])
        c.hline(a, b, ys + 24, WALNUT[1])
    c.rect((x0 + x1) // 2 + 5, ys + 21, (x0 + x1) // 2 + 7, ys + 23, hx(GOLD[3]))


def arched_doorway(c, x0, x1, ytop, ybase):
    """The big arched doorway: a thick dark wood arch, and through it a daylit corridor with a vending machine glowing at its right."""
    w = x1 - x0
    r = w / 2
    ys = ytop + r
    cx = (x0 + x1) / 2
    for (ins, tone) in ((0, WALNUT[0]), (1, WALNUT[3]), (3, WALNUT[2]), (7, WALNUT[0])):
        c.rect(x0 + ins, ys, x1 - ins, ybase, tone)
        c.ell(cx, ys, r - ins, r - ins, tone, ymax=ys)
    c.vline(x0 + 1, ys, ybase, WALNUT[4])
    c.vline(x0 + 2, ys, ybase, light(WALNUT[3], .1))
    c.rect(int(cx) - 3, ytop + 1, int(cx) + 2, ytop + 5, hx(WALNUT[4]))      # the keystone
    c.hline(int(cx) - 3, int(cx) + 2, ytop + 1, "#e8c890")
    ix0, ix1, iy = x0 + 9, x1 - 9, ytop + 9
    r2 = (ix1 - ix0 + 1) / 2
    ys2 = iy + r2
    c.rect(ix0, ys2, ix1, ybase, "#e7dcc0")
    c.ell((ix0 + ix1 + 1) / 2, ys2, r2, r2, "#e7dcc0", ymax=ys2)
    for y in range(iy, ybase + 1):                       # the corridor: warm light, a pale floor, a darker far wall
        for x in range(ix0, ix1 + 1):
            if c.get(x, y)[3] and c.get(x, y)[:3] == hx("#e7dcc0")[:3]:
                k = (y - iy) / (ybase - iy)
                c.set(x, y, mix("#f2e8cc", "#c9b890", k * .8))
    c.rect(ix0, ybase - 9, ix1, ybase, "#aab0bc")          # the floor of the corridor
    c.hline(ix0, ix1, ybase - 9, "#cfd4dc")
    vx0, vx1 = ix1 - 20, ix1 - 3                           # the vending machine
    c.rect(vx0, ybase - 44, vx1, ybase - 6, "#1a2e3a")
    c.rect(vx0 + 2, ybase - 41, vx1 - 2, ybase - 14, "#2e5a66")
    for gy, tone in ((ybase - 40, "#e8c84a"), (ybase - 32, "#6fe0b0"), (ybase - 24, "#ff8a5a")):
        for gx in range(vx0 + 3, vx1 - 3, 4):
            c.rect(gx, gy, gx + 2, gy + 4, tone)
    c.rect(vx0 + 3, ybase - 12, vx1 - 3, ybase - 9, "#0e1a22")
    c.vline(vx0, ybase - 44, ybase - 6, "#3a5a6a")
    c.glow((vx0 + vx1) / 2, ybase - 28, 22, "#6fe0b0", 70)
    c.vline(ix0, iy + int(r2), ybase - 9, dark("#e7dcc0", .35))   # the shade of the left jamb on the corridor wall


def exit_sign(c, x, y, w=30):
    c.rect(x, y, x + w - 1, y + 9, "#143a24")
    c.rect(x + 1, y + 1, x + w - 2, y + 8, "#27a05a")
    c.hline(x + 1, x + w - 2, y + 1, "#5cd88a")
    wt = "#f4fff0"                                          # a figure running toward an arrow: our own pixel drawing
    c.rect(x + 4, y + 1, x + 5, y + 2, wt)                  # head
    c.rect(x + 3, y + 3, x + 5, y + 5, wt)                  # body
    c.set(x + 2, y + 4, wt)                                 # back arm
    c.set(x + 6, y + 3, wt)                                 # front arm
    c.set(x + 2, y + 6, wt)                                 # legs
    c.set(x + 5, y + 6, wt)
    c.set(x + 6, y + 7, wt)
    c.hline(x + 10, x + w - 5, y + 4, wt)
    c.hline(x + 10, x + w - 5, y + 5, wt)
    c.set(x + w - 6, y + 3, wt)
    c.set(x + w - 6, y + 6, wt)
    c.glow(x + w / 2, y + 5, 16, "#5cd88a", 50)


def projection_screen(c, x0, x1, y0, y1):
    """The pulled down white screen: a steel casing with its lit top, the white surface with a soft light, a dark lower rod."""
    c.rect(x0, y0, x1, y0 + 5, "#9aa0aa")
    c.hline(x0, x1, y0, "#dfe3e8")
    c.hline(x0, x1, y0 + 5, "#4a4e5a")
    c.rect(x0 + 2, y0 + 6, x1 - 2, y1, "#f4f4ee")
    c.vgrad(x0 + 2, y0 + 6, x1 - 2, y1, "#fbfbf6", "#e4e8ea")
    c.vline(x0 + 2, y0 + 6, y1, "#d4d8da")
    c.vline(x1 - 2, y0 + 6, y1, "#cfd4d6")
    c.rect(x0 + 2, y1 - 2, x1 - 2, y1, "#8a8e98")
    c.hline(x0 + 2, x1 - 2, y1, "#3a3e48")
    for y in range(y0 + 6, y0 + 14):                    # the casing shade on the surface
        c.hline(x0 + 3, x1 - 3, y, mix(c.get(x0 + 3, y), "#9aa4b0", .3 * (1 - (y - y0 - 6) / 8)))
    c.glow((x0 + x1) / 2, (y0 + y1) / 2, 76, "#ffffff", 34)


def whiteboard(c, x0, y0, x1, y1, sketch=False):
    c.rect(x0, y0, x1, y1, "#9aa0aa")
    c.hline(x0, x1, y0, "#dfe3e8")
    c.vline(x0, y0, y1, "#c4c8d0")
    c.rect(x0 + 2, y0 + 2, x1 - 2, y1 - 4, "#e9eeee")
    c.hline(x0 + 2, x1 - 2, y0 + 2, "#cdd4d6")
    c.rect(x0, y1 - 3, x1, y1, "#7a808c")                 # the marker tray
    c.hline(x0, x1, y1 - 3, "#b0b6c0")
    if sketch:
        bx, by = x0 + 5, y0 + 7                           # a pinhole camera drawn in marker: a box, a hole, two rays and the inverted image
        c.rect(bx + 8, by, bx + 8, by + 7, "#2a4aa8")
        c.hline(bx + 8, bx + 13, by, "#2a4aa8")
        c.hline(bx + 8, bx + 13, by + 7, "#2a4aa8")
        c.vline(bx + 13, by, by + 7, "#2a4aa8")
        c.set(bx + 8, by + 3, "#e9eeee")
        c.set(bx + 8, by + 4, "#e9eeee")
        c.line(bx, by - 1, bx + 8, by + 3, "#d83a3a")
        c.line(bx, by + 8, bx + 8, by + 4, "#d83a3a")
        c.vline(bx + 11, by + 2, by + 5, "#2a8a4a")
        c.vline(bx - 1, by + 1, by + 6, "#2a8a4a")


def inlaid_panel(c, x0, y0, x1, y1):
    """The inlaid honey wood panel behind the lectern: a dark border, a diamond lattice, a lighter centre medallion."""
    c.rect(x0, y0, x1, y1, WALNUT[1])
    c.rect(x0 + 3, y0 + 3, x1 - 3, y1 - 3, HONEY[2])
    c.hline(x0 + 3, x1 - 3, y0 + 3, HONEY[4])
    for k in range(-(y1 - y0), x1 - x0, 12):
        for t in range(0, y1 - y0 - 5):
            for (xx, tone) in ((x0 + k + t, HONEY[1]), (x0 + k + (y1 - y0) - t, HONEY[3])):
                if x0 + 4 <= xx <= x1 - 4 and y0 + 4 <= y0 + 3 + t <= y1 - 4:
                    c.set(xx, y0 + 3 + t, tone)
    mx = (x0 + x1) // 2
    c.ell(mx, (y0 + y1) // 2, 14, 7, WALNUT[2])
    c.ell(mx, (y0 + y1) // 2, 12, 5.5, HONEY[3])
    c.ell(mx - 1, (y0 + y1) // 2 - 1, 7, 2.6, HONEY[4])
    c.hline(x0, x1, y1, WALNUT[0])


def wall_front():
    """The whole front wall, 20 x 4 tiles. Left bay: windows over the gallery balustrade; then the arched door, the pilasters, the
    screen with its boards and the inlaid panel; at the right the exit sign over the big arched doorway."""
    c = Canvas(WW, WALL_H)
    ashlar(c, 0, 0, WW - 1, WALL_H - 1)
    # olive panels with medallions on the front part, above the small door and above the big doorway
    olive_panel(c, 198, 14, 258, 66)
    tondo(c, 228, 40, 11)
    olive_panel(c, 544, 12, WW - 1, 38)
    tondo(c, 618, 26, 9)
    olive_panel(c, 262, 14, 308, 40)
    # the left bay: the long wall with its windows, strip lamps and the gallery
    for (wx, seed) in ((22, "a"), (118, "b")):
        window(c, wx, 12, 38, 42, seed)
    wall_strip_lamp(c, 92, 14)
    wall_strip_lamp(c, 178, 14)
    c.rect(0, 58, 191, 126, dark(TAN[2], .22))              # under the gallery the wall is in shade
    balustrade(c, 0, 191, 58)
    c.vline(191, 12, 126, TAN[0])
    c.vline(192, 12, 126, TAN[4])
    # under the gallery: the glazed door and the green exit sign beside it
    c.rect(62, 90, 94, 126, WALNUT[1])
    c.rect(65, 93, 91, 126, WALNUT[3])
    c.rect(68, 96, 88, 110, "#cfe4e8")
    c.vgrad(68, 96, 88, 110, "#bcd8e2", "#f0f6ee")
    c.vline(78, 96, 110, WALNUT[2])
    c.hline(68, 88, 103, WALNUT[2])
    c.rect(68, 114, 88, 124, WALNUT[2])
    c.vline(65, 93, 126, WALNUT[4])
    exit_sign(c, 22, 92, 28)
    c.rect(116, 98, 130, 112, "#8a8e98")                   # a small wall unit
    c.hline(116, 130, 98, "#c4c8d0")
    c.rect(118, 101, 128, 104, "#3a3e48")
    # the small arched wooden door
    arched_door_small(c, 208, 250, 72, 126)
    # screen, whiteboards, pilasters, inlaid panel
    whiteboard(c, 282, 58, 320, 102, sketch=True)
    whiteboard(c, 462, 58, 502, 102)
    projection_screen(c, 314, 468, 12, 86)
    inlaid_panel(c, 316, 92, 466, 123)
    pilaster(c, 262, 280, 12, 126)
    pilaster(c, 504, 524, 12, 126)
    fade_down(c, 316, 466, 87, 96, a0=.5)
    # the big arched doorway and its sign
    arched_doorway(c, 544, 608, 54, 127)
    exit_sign(c, 560, 40, 32)
    cornice(c, 0, WW - 1)
    skirting(c, 0, WW - 1)
    return c


# ---------------------------------------------------------------- the bowl

def slate_px(x, y):
    """Dark blue grey slate slabs 32 x 24 in running bond: a thin dark grout, a pale line on its lit side, a polished streak on some."""
    row = y // 24
    sx = x + (16 if row % 2 else 0)
    sid = (sx // 32, row)
    rr = rng("slate%d_%d" % sid)
    base = [SLATE[1], SLATE[2], mix(SLATE[1], SLATE[2], .5), SLATE[1]][rr.randrange(4)]
    lx, ly = sx % 32, y % 24
    if lx == 0 or ly == 0:
        return hx(SLATE[0])
    if lx == 1 or ly == 1:
        return mix(base, SLATE[3], .38)
    if rr.random() < .3 and 0 < (lx + ly * 2 - 10) % 30 < 2:      # a polished smear
        return mix(base, SLATE[4], .14)
    return col(base)


def carpet_px(x, y):
    base = hx(CARP[1])
    if ((x // 2) + (y // 2)) % 2 == 0:
        base = mix(base, CARP[2], .3)
    if x % 24 == 0 or y % 24 == 0:
        base = mix(base, CARP[0], .22)
    return base


def tier_px(u):
    """One row of benches, from the stage side outward: the honey desk with its lit nose, a dark lip, the seat boards in the desk's
    shade, and the dark riser under the next row's desk. u is the distance in px from the front edge of the desk."""
    if u < 1:
        return hx(HONEY[4])
    if u < 15:
        base = HONEY[3] if u < 3 else HONEY[2]
        if int(u) in (5, 8, 11, 13):
            base = mix(HONEY[2], HONEY[1], .5)
        return col(base)
    if u < 16:
        return hx(HONEY[1])
    if u < 18:
        return hx(WALNUT[0])
    if u < 22:
        return mix(WALNUT[2], WALNUT[0], .5 - (u - 18) * .12)
    if u < 28:
        return hx(WALNUT[1] if int(u) == 25 else WALNUT[2])
    if u < 29:
        return hx(WALNUT[3])
    return hx(WALNUT[0])


def step_px(u, base_fn, x, y):
    """The stairs of an aisle: each row is one step with a lit nosing and a shadow under it."""
    if u < 2:
        return mix(base_fn(x, y), SLATE[4], .75)
    if u < 5:
        return mix(base_fn(x, y), SLATE[0], .5 - (u - 2) * .1)
    return base_fn(x, y)


def classify(x, y):
    if y < FRONT_Y:
        return ("front", 0, 0.0)
    if y >= REAR_Y:
        return ("rear", 0, 0.0)
    rho = math.hypot((x + .5 - CX) / K, y + .5 - CY)
    if rho < R0:
        return ("stage", rho, 0.0)
    t, u = divmod(rho - R0, TH)
    if x < STRIP or any(a <= x < b for a, b in AISLES):
        return ("aisle", int(t), u)
    return ("tier", int(t), u)


def load_sheets():
    out = {}
    for n in range(1, 21):
        p = ROOT / ("public/assets/tiles/crowd-%d.png" % n)
        if p.exists():
            out[n] = Image.open(p).convert("RGBA")
    return out


def paste_student(c, zones, sheet, face, x, y, t):
    """A student seen from behind or the side: the head and shoulders from a crowd sheet, cut at the seat; only inside tier t."""
    row = {"down": 0, "left": 1, "right": 2, "up": 3}[face]
    fr = sheet.crop((32, row * 32, 64, row * 32 + 32))
    ox, oy = int(x) - 16, int(y) - 20
    for sy in range(0, 25):
        for sx in range(32):
            p = fr.getpixel((sx, sy))
            if p[3] < 200:
                continue
            px, py = ox + sx, oy + sy
            if 0 <= px < BW and 0 <= py < BH and zones[py][px][0] == "tier":
                c.set(px, py, p[:3])


def bowl():
    c = Canvas(BW, BH)
    zones = [[classify(x, y) for x in range(BW)] for y in range(BH)]
    base_fn = slate_px
    for y in range(BH):
        for x in range(BW):
            z, a, b = zones[y][x]
            if z == "front":
                col = carpet_px(x, y)                           # the carpet of the lecturer's floor runs along the whole front wall
                if y >= FRONT_Y - 3 and zones[FRONT_Y][x][0] != "stage":
                    col = mix(col, (30, 18, 44), .18 * (y - (FRONT_Y - 4)))
            elif z == "rear":
                col = slate_px(x, y)
            elif z == "stage":
                col = carpet_px(x, y)
                if a > R0 - 5:                                  # the shadow of the first desk on the carpet
                    col = mix(col, (30, 18, 44), .22 * (a - (R0 - 5)) / 5)
            elif z == "aisle":
                col = step_px(b, slate_px, x, y)
            else:
                col = tier_px(b)
                if y >= REAR_Y - 6:                             # the last riser against the rear corridor
                    col = hx(WALNUT[2] if y < REAR_Y - 2 else WALNUT[0])
                elif y < FRONT_Y + 3:
                    col = hx(WALNUT[1]) if y < FRONT_Y + 1 else hx(WALNUT[2])
            c.px[x, y] = col if len(col) == 4 else tuple(col) + (255,)
    # the bench ends along every aisle: a dark wood panel with a lit edge
    for y in range(FRONT_Y, REAR_Y):
        for x in range(BW):
            if zones[y][x][0] != "tier":
                continue
            for d in (1, 2, 3):
                if x - d >= 0 and zones[y][x - d][0] == "aisle":
                    c.px[x, y] = hx(WALNUT[4]) if d == 1 else hx(WALNUT[2])
                if x + d < BW and zones[y][x + d][0] == "aisle":
                    c.px[x, y] = hx(WALNUT[1]) if d == 1 else hx(WALNUT[2])
    # things on the desks: sheets of paper, an open notebook, a laptop, a pencil case
    r = rng("uni-desk")
    items = []
    for t in range(0, 7):
        rs = R0 + TH * t + 5
        steps = int(math.pi * K * rs / 30)
        for k in range(steps + 1):
            a = k * math.pi / steps
            items.append((CX + K * rs * math.cos(a), CY + rs * math.sin(a), t))
    for (x, y, t) in items:
        if r.random() < .35 and 40 < y < 214 and 0 <= int(x) < BW and zones[int(y)][int(x)][0] == "tier" and zones[int(y)][max(0, int(x) - 8)][0] == "tier" and zones[int(y)][min(BW - 1, int(x) + 8)][0] == "tier":
            kind = r.randrange(4)
            xi, yi = int(x), int(y)
            if kind == 0:
                c.rect(xi - 4, yi - 2, xi + 3, yi + 2, "#f4f0e6")
                c.hline(xi - 4, xi + 3, yi - 2, "#ffffff")
                c.hline(xi - 3, xi + 1, yi, "#b0a898")
            elif kind == 1:
                c.rect(xi - 4, yi - 2, xi + 4, yi + 2, "#3a3a46")
                c.rect(xi - 3, yi - 2, xi + 3, yi, "#7fc0e0")
            elif kind == 2:
                c.rect(xi - 3, yi - 2, xi + 3, yi + 2, "#ece4d0")
                c.vline(xi, yi - 2, yi + 2, "#8a7a62")
            else:
                c.rect(xi - 3, yi - 1, xi + 3, yi + 1, hx(["#c8423f", "#2f6a8a", "#4f9250"][r.randrange(3)]))
    # the students, row by row, each row first and then the lower part of the row painted again over the cut
    sheets = load_sheets()
    base = c.im.copy()
    if sheets:
        for t in range(0, 8):
            rs = R0 + TH * t + 22
            steps = int(math.pi * K * rs / 27)
            for k in range(steps + 1):
                a = (k + .5 * (t % 2)) * math.pi / steps
                x, y = CX + K * rs * math.cos(a), CY + rs * math.sin(a)
                xi, yi = int(x), int(y)
                if not (0 <= xi < BW and 44 < yi < 212) or zones[yi][xi][0] != "tier":
                    continue
                if zones[yi][max(0, xi - 7)][0] != "tier" or zones[yi][min(BW - 1, xi + 7)][0] != "tier":
                    continue
                if r.random() < (.18 if t < 4 else .3):               # some seats stay empty
                    continue
                dx, dy = CX - x, CY - y
                face = "up" if abs(dx) / K < 1.25 * abs(dy) else ("right" if dx > 0 else "left")
                paste_student(c, zones, sheets[1 + r.randrange(len(sheets))], face, x, y, t)
        for y in range(FRONT_Y, REAR_Y):                               # the cut of every student is hidden by the riser of the next row
            for x in range(BW):
                z, a, b = zones[y][x]
                if z == "tier" and b >= 25.5:
                    c.px[x, y] = base.getpixel((x, y))
    # the turned ball newels at the foot of every bench end, as in the photo of the steps
    ball_h = hx(HONEY[3])
    for (xe, side) in [(160, -1), (224, 1), (512, -1), (576, 1), (STRIP, 1)]:
        xe_in = xe + (-4 if side == -1 else 3)
        for t in range(0, 8):
            rho = R0 + TH * t + 2
            q = rho * rho - ((xe - CX) / K) ** 2
            if q <= 0:
                continue
            y = CY + math.sqrt(q)
            if not (FRONT_Y + 6 < y < REAR_Y - 8):
                continue
            yi = int(y)
            c.ell(xe_in + 1, yi + 3.4, 3.4, 1.5, (30, 14, 36, 120))
            c.disc(xe_in, yi, 3.4, hx(WALNUT[0]))
            c.disc(xe_in, yi, 2.7, ball_h)
            c.set(xe_in - 1, yi - 1, "#fff0c0")
            c.set(xe_in + 1, yi + 1, hx(HONEY[1]))
    # the sun that comes through the two windows of the left bay and falls on the benches
    for (wx0, wx1) in ((22, 60), (118, 156)):
        for y in range(BH):
            gy = y + 0
            for x in range(BW):
                x0 = x - .62 * gy
                if wx0 <= x0 <= wx1 and gy < 215:
                    e = min(1.0, min(x0 - wx0, wx1 - x0) / 5.0)
                    k = .5 * e * (1 - gy / 300.0)
                    if wx0 + 12 < x0 < wx0 + 14 or wx0 + 25 < x0 < wx0 + 27:
                        k *= .4
                    p = c.get(x, y)
                    c.set(x, y, mix(p, "#fff0c0", k)[:3] + (255,))
    # the shade of the front wall and the side walls on the floor
    for y in range(0, 7):
        t = .55 * (1 - y / 7) ** 1.4
        for x in range(BW):
            c.set(x, y, mix(c.get(x, y), (44, 26, 78), t)[:3] + (255,))
    for x in range(0, 6):
        t = .4 * (1 - x / 6) ** 1.4
        for y in range(BH):
            c.set(x, y, mix(c.get(x, y), (44, 26, 78), t)[:3] + (255,))
    for x in range(BW - 6, BW):
        t = .4 * (1 - (BW - 1 - x) / 6) ** 1.4
        for y in range(BH):
            c.set(x, y, mix(c.get(x, y), (44, 26, 78), t)[:3] + (255,))
    return c


# ---------------------------------------------------------------- objects

def lectern():
    """The long panelled lectern, 6 x 2 tiles: a lit honey top with a document camera, a laptop, a gooseneck microphone and papers; a
    front of lighter panels in a dark frame (the first row of the canvas is the top, the second the front)."""
    c = Canvas(6 * T, 2 * T)
    W = 6 * T
    c.shadow(W / 2, 2 * T - 2, 92, 3.4, 80)
    c.rect(2, 20, W - 3, 30, HONEY[3])                       # the top, seen from above
    c.hline(2, W - 3, 20, HONEY[4])
    c.hline(2, W - 3, 21, light(HONEY[3], .2))
    for gy in (24, 27):
        c.hline(4, W - 5, gy, HONEY[2])
    c.rect(2, 31, W - 3, 59, WALNUT[2])                      # the front
    c.hline(2, W - 3, 31, HONEY[1])
    c.rect(2, 32, 3, 59, WALNUT[3])
    c.rect(W - 4, 32, W - 3, 59, WALNUT[0])
    for x in range(8, W - 34, 44):
        c.rect(x, 36, x + 35, 54, HONEY[2])
        c.hline(x, x + 35, 36, HONEY[4])
        c.vline(x, 36, 54, HONEY[3])
        c.hline(x, x + 35, 54, WALNUT[1])
        c.vline(x + 35, 36, 54, WALNUT[1])
        c.rect(x + 5, 41, x + 30, 49, HONEY[3])
        c.hline(x + 5, x + 30, 41, HONEY[1])
        c.vline(x + 5, 41, 49, HONEY[1])
    c.rect(2, 56, W - 3, 59, WALNUT[0])
    # on the top: a laptop with its back to the room, the document camera (a base, two arms and a head), a microphone, papers
    c.rect(22, 11, 46, 25, "#3a3c46")
    c.rect(24, 13, 44, 22, "#4a4c58")
    c.hline(22, 46, 11, "#7a7c8a")
    c.set(34, 17, "#d8dae4")
    c.rect(20, 25, 48, 26, "#2a2c34")
    c.rect(78, 24, 100, 26, "#e4e6ea")                       # the base of the document camera
    c.hline(78, 100, 24, "#ffffff")
    c.line(92, 24, 98, 10, "#f2f4f6")
    c.line(93, 24, 99, 10, "#a8acb4")
    c.line(98, 10, 86, 9, "#f2f4f6")
    c.line(86, 9, 88, 12, "#a8acb4")
    c.rect(82, 11, 90, 13, "#d8dce2")
    c.rect(84, 13, 88, 14, "#4a6ab0")
    c.line(120, 25, 120, 12, "#2a2c34")                       # a gooseneck microphone
    c.line(120, 12, 125, 9, "#2a2c34")
    c.rect(125, 8, 127, 11, "#3a3c46")
    c.rect(140, 21, 156, 26, "#f4f0e6")
    c.hline(140, 156, 21, "#ffffff")
    c.hline(143, 152, 23, "#b0a898")
    c.rect(150, 20, 165, 25, "#ece4d0")
    c.hline(153, 162, 22, "#b0a898")
    c.disc(177, 23, 2.4, "#2f6a8a")                          # a mug
    c.outline()
    return c


def bins():
    """Two recycling bins by the big door: a blue one and a green and yellow one."""
    c = Canvas()
    c.shadow(16, 28.5, 14, 2.4, 76)
    for (x0, body, hi, lid) in ((2, "#3a6ac0", "#6a9ae8", "#2a4a90"), (17, "#d8b830", "#f4e068", "#4a8a3a")):
        c.rect(x0, 12, x0 + 12, 27, body)
        c.vline(x0, 12, 27, hi)
        c.vline(x0 + 12, 13, 27, dark(body, .35))
        c.rect(x0 - 1, 9, x0 + 13, 12, lid)
        c.hline(x0 - 1, x0 + 13, 9, light(lid, .3))
        c.rect(x0 + 3, 17, x0 + 9, 19, dark(body, .3))
    c.outline()
    return c


def define(reg):
    reg.stamp("universita_wall_front", wall_front(), "walls")
    reg.stamp("universita_bowl", bowl(), "below")
    reg.stamp("universita_lectern", lectern(), "objects")
    reg.stamp("universita_bins", bins(), "objects")
