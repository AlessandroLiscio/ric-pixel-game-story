"""Stamps of the Cortile Cafe, rebuilt from the three reference photos (shapes only, nothing copied; text and logos are redrawn as
pixel letters of our own): a small crowded vaulted hall with warm cream plaster, the mezzanine with its black frame and glass
railing and the people leaning over it above the bar, the concrete beam and pillar, the dark bar niche with bottles, the chalkboard
menu, the cluster of black and white portraits with the colourful lightning poster and the round record sign, the white painted
logo wall of the band corner under the staircase with its dark red handrail, the lighting truss with a skull mask and the black PA
speakers, the black wrought-iron birdcage chandelier, the wall TVs and the street door.

The three big wall stamps (`cortile_wall_left` 7 wide, `cortile_wall_mid` 5 wide, `cortile_wall_right` 8 wide, each 4 tiles tall) are
drawn as one picture each so the plaster, the shadows and the lamps join; the map puts them side by side on rows 1 to 4.
Every name starts with `cortile_`: the registry refuses anything else from a room module."""
import math

from tilepaint import (GOLD, LOWER, METAL, WOOD, Canvas, T, dark, hx, light, make_ramp, mix, rng)
from tiles_objects import bottle

WARM = make_ramp("#e9c58b", 4, 1)           # cream plaster
CONC = make_ramp("#8f8b86", 5, 2, dark_hue=255, sh=18)   # concrete
RAIL = "#1c1a22"
RAIL_HI = "#55505c"
SKIN = ["#f4cba8", "#dba577", "#c28a5c", "#e8b890", "#8a5a3c"]
HAIR = ["#2b2330", "#5a3a28", "#8c5a38", "#b04a48", "#d8b060", "#1c1620", "#3a2a30", "#8a8a94"]
CLOTH = ["#2f3d6b", "#3b3f4c", "#e8e2d4", "#8c2a3a", "#4f7a5d", "#c89a3a", "#a6aab3", "#2b2330", "#c0607a", "#2f6a8a"]
WALL_H = 4 * T


# ---------------------------------------------------------------- small helpers

def tint(c, x0, y0, x1, y1, colr, t):
    """Mix every opaque pixel of a rectangle toward a colour (glass, shadow, light)."""
    for y in range(max(0, y0), min(c.h - 1, y1) + 1):
        for x in range(max(0, x0), min(c.w - 1, x1) + 1):
            p = c.get(x, y)
            if p[3]:
                q = mix(p, colr, t)
                c.set(x, y, q[:3] + (p[3],))


def fade_down(c, x0, x1, y0, y1, colr=(30, 14, 36), a0=.5):
    """A soft shadow that is strongest at y0 and gone at y1, in steps with a dithered rim (what a beam or a truss casts)."""
    n = y1 - y0
    for y in range(y0, y1 + 1):
        t = a0 * (1 - (y - y0) / n) ** 1.5
        for x in range(x0, x1 + 1):
            p = c.get(x, y)
            if p[3]:
                tt = t if (x + y) % 2 == 0 or t > .18 else t * .55
                c.set(x, y, mix(p, colr, tt)[:3] + (p[3],))


def plaster_bg(c, x0, y0, x1, y1, seed, tones=WARM):
    r = rng("cortile-plaster-" + seed)
    c.rect(x0, y0, x1, y1, tones[1])
    for _ in range(max(4, (x1 - x0) // 14)):  # soft lighter and darker patches, hand placed (dithered), never noise
        x, y = r.randrange(x0, x1 - 10), r.randrange(y0 + 6, y1 - 12)
        c.dither(x, y, x + r.randrange(6, 12), y + r.randrange(2, 5), tones[1], light(tones[1], .1) if r.random() < .6 else dark(tones[1], .07), .25, r.randrange(2))


def cornice(c, x0, x1, rows=9):
    """The shadow under the wall cap and a dark line where the wall top meets the cap."""
    for y in range(rows):
        t = .5 * (1 - y / rows) ** 1.3
        for x in range(x0, x1 + 1):
            c.set(x, y, mix(c.get(x, y), (44, 26, 78), t))
    c.hline(x0, x1, 0, dark(WARM[0], .55))


def skirting(c, x0, x1, y1=WALL_H - 1, h=6):
    c.rect(x0, y1 - h + 1, x1, y1, WOOD[2])
    c.hline(x0, x1, y1 - h + 1, light(WOOD[3], .25))
    c.hline(x0, x1, y1 - h + 2, WOOD[3])
    c.hline(x0, x1, y1 - 1, WOOD[1])
    c.hline(x0, x1, y1, dark(WOOD[0], .4))
    for x in range(x0 + 7, x1, 24):
        c.vline(x, y1 - h + 3, y1 - 2, WOOD[1])


def concrete(c, x0, y0, x1, y1, seed, formwork=True):
    """A grey concrete face: lit top edge, formwork seams and tie holes, a soft shade toward the bottom."""
    r = rng("conc" + seed)
    c.rect(x0, y0, x1, y1, CONC[2])
    c.hline(x0, x1, y0, CONC[4])
    c.hline(x0, x1, y0 + 1, light(CONC[3], .15))
    c.hline(x0, x1, y1, CONC[0])
    c.hline(x0, x1, y1 - 1, CONC[1])
    for k in range(3):
        x, y = r.randrange(x0 + 2, max(x0 + 3, x1 - 14)), r.randrange(y0 + 2, max(y0 + 3, y1 - 3))
        c.dither(x, y, x + r.randrange(5, 12), y + 1, CONC[2], CONC[3] if k % 2 else CONC[1], .25, k)
    if formwork:
        mid = (y0 + y1) // 2
        c.hline(x0, x1, mid, CONC[1])
        for x in range(x0 + 20, x1, 48):
            c.vline(x, y0 + 1, y1 - 1, CONC[1])
            c.set(x + 8, mid - 4, CONC[0])
            c.set(x + 8, mid + 4, CONC[0])


# ---------------------------------------------------------------- people on the balcony

def bust(c, cx, hy, skin, hair, cloth, style, scale=1.0):
    """A person leaning on the railing, seen from the hall: hair and forehead (they look down at the stage), shoulders, arms forward."""
    k = scale
    skin, hair = hx(skin), hx(hair)
    cloth = dark(hx(cloth), .12)                                  # people on the balcony are in shade: a clearer silhouette
    c.ell(cx, hy + 14 * k, 8 * k, 9.5 * k, dark(cloth, .34))      # body behind the glass
    c.ell(cx - .5, hy + 13 * k, 7.5 * k, 9 * k, cloth)
    c.ell(cx - 2.2 * k, hy + 9.5 * k, 3.6 * k, 2.6 * k, light(cloth, .2))
    c.rect(cx - 6 * k, hy + 11 * k, cx - 6 * k, hy + 20 * k, light(cloth, .1))
    c.rect(cx - 2, hy + 4 * k, cx + 1, hy + 7 * k, dark(skin, .25))   # neck
    if style == "long":
        c.rect(cx - 6 * k, hy, cx + 5 * k, hy + 12 * k, dark(hair, .2))
        c.vline(cx - 5 * k, hy + 3 * k, hy + 11 * k, hair)
    if style == "curly":
        c.ell(cx, hy - .5, 6.6 * k, 6.4 * k, hair)
        c.ell(cx - 1.4, hy - 2, 3.4 * k, 2.4 * k, light(hair, .25))
    else:
        c.ell(cx, hy, 5.4 * k, 5.8 * k, hair)
        c.ell(cx - 1.3, hy - 2.4 * k, 2.6 * k, 1.7 * k, light(hair, .25))
    c.ell(cx, hy + 1.8 * k, 4.0 * k, 4.0 * k, skin)                # face
    if style == "bald":
        c.ell(cx, hy - 1.5 * k, 4.3 * k, 3.3 * k, mix(skin, hair, .18))
    if style == "cap":
        c.ell(cx, hy - 1.3 * k, 5.6 * k, 3.7 * k, hx("#c8423f"))
        c.hline(cx - 5 * k, cx + 5 * k, hy + 1 * k, dark("#c8423f", .3))
    c.set(cx - 2, hy + 2 * k, "#2a1a1e")
    c.set(cx + 1, hy + 2 * k, "#2a1a1e")
    c.set(cx - 1, hy + 4 * k, dark(skin, .3))
    c.hline(cx - 4 * k, cx + 3 * k, hy + 5 * k, dark(skin, .22))


def balcony_people(c, x0, x1, hy, seed, step=(13, 19)):
    r = rng("balcony" + seed)
    styles = ["short", "long", "curly", "short", "bald", "cap", "long", "short"]
    x = x0 + r.randrange(14, 20)
    while x < x1 - 5:                  # a second row of people stands behind the first, smaller and darker
        bust(c, x, hy - 6 + r.randrange(-1, 2), r.choice(SKIN), r.choice(HAIR), "#3a3440", r.choice(styles), scale=.82)
        x += r.randrange(17, 25)
    x = x0 + r.randrange(5, 11)
    while x < x1 - 5:
        hyy = hy + r.randrange(-2, 4)
        bust(c, x, hyy, r.choice(SKIN), r.choice(HAIR), r.choice(CLOTH), r.choice(styles), scale=r.choice([1.0, 1.08, 1.16]))
        x += r.randrange(*step)


def blend(c, x, y, colr, t):
    if 0 <= x < c.w and 0 <= y < c.h:
        p = c.get(x, y)
        if p[3]:
            c.set(x, y, mix(p, colr, t)[:3] + (p[3],))


def railing(c, x0, x1, ytop, ybot, seed, posts_from=0):
    """A black metal frame with a glass pane: a light tint with diagonal glints, a thick top rail and posts every 32 px."""
    tint(c, x0, ytop + 2, x1, ybot - 4, "#bfe0f0", .2)
    for gx in range(x0 - 20, x1, 22):
        for k in range(ybot - ytop - 8):
            blend(c, gx + k + 4, ytop + 4 + k, "#ffffff", .32)
            blend(c, gx + k + 5, ytop + 4 + k, "#ffffff", .16)
    c.rect(x0, ytop, x1, ytop + 1, RAIL)       # top rail
    c.hline(x0, x1, ytop - 1, RAIL_HI)
    c.rect(x0, ybot - 3, x1, ybot, RAIL)       # bottom rail
    c.hline(x0, x1, ybot - 3, RAIL_HI)
    for px in range(x0 + posts_from, x1 + 1, T):
        c.rect(max(x0, px - 1), ytop - 1, min(x1, px + 1), ybot, RAIL)
        c.vline(max(x0, px - 1), ytop, ybot - 4, RAIL_HI)
    # forearms resting on the rail
    r = rng("arms" + seed)
    for _ in range(max(2, (x1 - x0) // 40)):
        ax = r.randrange(x0 + 4, x1 - 12)
        tone = hx(r.choice(SKIN))
        c.rect(ax, ytop - 3, ax + 8, ytop - 2, dark(tone, .08))
        c.hline(ax, ax + 8, ytop - 3, light(tone, .15))


def beam(c, x0, x1, y0, y1, seed):
    concrete(c, x0, y0, x1, y1, seed)
    c.hline(x0, x1, y1 + 1, dark(CONC[0], .3))


def pendant(c, x, y0, y1):
    """A pendant lamp hanging from the beam: a cable, a copper shade and a warm bulb."""
    c.vline(x, y0, y1 - 5, "#2a2024")
    c.rect(x - 1, y1 - 6, x + 1, y1 - 5, "#2a2024")
    c.ell(x, y1 - 2, 4.5, 3.2, hx("#b0602a"), ymax=y1 - 1)
    c.hline(x - 4, x + 4, y1 - 1, "#6a2e12")
    c.hline(x - 3, x - 1, y1 - 4, "#e8a060")
    c.ell(x, y1 + 1, 2.4, 1.8, hx("#fff0b0"))
    c.set(x, y1 + 1, "#ffffff")


# ---------------------------------------------------------------- wall features

def niche(c, x0, y0, x1, y1, seed):
    """The dark lit bar niche: two shelves of bottles in front of a warm glow, a fridge door and a wooden frame."""
    r = rng("niche" + seed)
    c.rect(x0, y0, x1, y1, "#24160f")
    c.vgrad(x0 + 2, y0 + 2, x1 - 2, y1 - 2, "#5a3420", "#2a1810")
    # back glow behind each shelf, dithered into the wall
    for sy in (y0 + 24, y0 + 46):
        c.dither(x0 + 2, sy - 16, x1 - 2, sy - 1, "#6a3c22", "#9a5a2c", .25)
    cols = ["#3a7240", "#8a4a20", "#c8423f", "#e8b83a", "#2f4aa0", "#f4f1ea", "#3a7240", "#a02a4a", "#5a9a4e", "#c08a22", "#2f6a8a"]
    for si, sy in enumerate((y0 + 24, y0 + 46)):
        x = x0 + 6
        while x < x1 - 9:
            h = r.choice([11, 13, 14, 16] if si == 0 else [10, 12, 14])
            bottle(c, x, sy, h, r.choice(cols), label="#f4f1ea" if r.random() < .5 else None)
            if r.random() < .12:
                x += 4
            x += r.choice([6, 7, 7, 8])
        c.rect(x0, sy + 1, x1, sy + 3, WOOD[3])
        c.hline(x0, x1, sy + 1, WOOD[4])
        c.hline(x0, x1, sy + 2, light(WOOD[3], .1))
        c.hline(x0, x1, sy + 3, WOOD[0])
    c.rect(x0, y0, x1, y0 + 1, WOOD[0])
    c.vline(x0, y0, y1, WOOD[1])
    c.vline(x0 + 1, y0 + 2, y1 - 1, light(WOOD[2], .1))
    c.vline(x1, y0, y1, WOOD[0])
    # cupboards under the lowest shelf
    c.rect(x0 + 2, y0 + 50, x1 - 2, y1, hx("#1a0f0a"))


def chalkboard(c, x, y):
    """A slate menu hanging from the beam by two chains."""
    c.vline(x + 5, y, y + 7, "#2a2024")
    c.vline(x + 22, y, y + 7, "#2a2024")
    c.rect(x, y + 7, x + 27, y + 40, WOOD[1])
    c.hline(x, x + 27, y + 7, WOOD[3])
    c.vline(x, y + 7, y + 40, WOOD[2])
    c.rect(x + 3, y + 10, x + 24, y + 37, "#222e2a")
    c.hline(x + 3, x + 24, y + 10, "#3a4a44")
    c.vline(x + 3, y + 10, y + 37, "#33433d")
    c.text(x + 5, y + 12, "MENU", "#f0ecd8", 1)
    r = rng("chalk")
    for i, yy in enumerate(range(y + 22, y + 36, 4)):
        ln = r.randrange(9, 17)
        c.hline(x + 6, x + 6 + ln, yy, "#e8e8d8" if i % 3 else "#f4c0a0")
        c.hline(x + 19, x + 22, yy, "#a8b0a0")
    c.rect(x + 2, y + 40, x + 25, y + 41, WOOD[0])


def frame_bw(c, x, y, w, h, variant, red=False):
    """A black and white portrait in a thin frame: a head and shoulders in soft grey on pale paper."""
    fr = "#7a2a2a" if red else "#16121a"
    c.rect(x, y, x + w - 1, y + h - 1, fr)
    c.hline(x, x + w - 1, y, "#5a4a4a" if not red else "#c8523f")
    c.vline(x, y, y + h - 1, "#3a3036" if not red else "#a03a34")
    c.rect(x + 2, y + 2, x + w - 3, y + h - 3, ["#ece4d0", "#d8dce0", "#f0e4cc"][variant % 3])
    g1, g2 = ["#3a3034", "#4a4448", "#2c2830"][variant % 3], ["#7a7478", "#8a8488", "#6a666c"][variant % 3]
    cx = x + w // 2
    c.ell(cx, y + h * .42, max(2, w * .22), max(3, h * .24), g2)
    c.ell(cx, y + h * .36, max(2, w * .24), max(2, h * .17), g1)  # hair
    c.rect(x + 3, y + int(h * .72), x + w - 4, y + h - 3, g1)
    c.ell(cx, y + h * .72, max(2, w * .3), 2, g1)
    c.set(cx - 1, int(y + h * .42), "#ece4d0")
    c.set(cx + 1, int(y + h * .42), "#ece4d0")


def bowie_poster(c, x, y, w=36, h=48):
    """A big colourful poster of a face with a red and blue lightning bolt across it (our own pixel painting)."""
    c.rect(x, y, x + w - 1, y + h - 1, "#16121a")
    c.rect(x + 1, y + 1, x + w - 2, y + h - 2, "#f6efe0")      # paper border
    c.rect(x + 3, y + 3, x + w - 4, y + h - 4, "#2a7a8a")
    c.vgrad(x + 3, y + 3, x + w - 4, y + h - 4, "#3a9aa8", "#1d5a72")
    cx = x + w // 2
    c.ell(cx, y + h * .62, 11, 14, "#16121a")                 # shoulders and dark jacket
    c.rect(x + 3, y + int(h * .78), x + w - 4, y + h - 4, "#16121a")
    c.ell(cx, y + h * .50, 8, 11, "#f2dcc8")                  # face
    c.ell(cx - 2, y + h * .45, 4, 6, "#fbeede")
    c.ell(cx, y + h * .26, 10, 6, "#e8662a")                  # swept orange hair
    c.ell(cx - 3, y + h * .22, 6, 3, "#f49a3a")
    c.rect(cx - 8, y + int(h * .26), cx - 7, y + int(h * .42), "#e8662a")
    c.rect(cx + 7, y + int(h * .26), cx + 8, y + int(h * .42), "#d8521e")
    ey = int(y + h * .47)
    c.hline(cx - 6, cx - 2, ey, "#2a1a1e")
    c.hline(cx + 2, cx + 6, ey, "#2a1a1e")
    c.rect(cx - 5, ey + 1, cx - 3, ey + 1, "#4a6ab0")
    c.hline(cx - 3, cx + 3, int(y + h * .64), "#c8423f")       # lips
    # the lightning bolt: red body with a blue edge, from the forehead across the eye to the cheek
    pts = [(cx + 3, y + int(h * .26)), (cx - 1, y + int(h * .44)), (cx + 4, y + int(h * .46)), (cx - 2, y + int(h * .64))]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        c.line(x0 + 1, y0, x1 + 1, y1, "#3a5ad0")
        c.line(x0, y0, x1, y1, "#e83a3a")
        c.line(x0 - 1, y0, x1 - 1, y1, "#e83a3a")
    c.set(x + 5, y + 5, "#fbe07a")
    c.set(x + w - 7, y + 8, "#fbe07a")


def record_sign(c, cx, cy, r=11):
    """A round vinyl record on the wall: black disc, groove rings, a coloured label, a lit rim."""
    c.disc(cx, cy, r, "#16121a")
    c.disc(cx, cy, r - 1, "#2a2428")
    for rr in (r - 3, r - 5, r - 7):
        for k in range(36):
            a = k * math.pi / 18
            c.set(int(cx + rr * math.cos(a)), int(cy + rr * math.sin(a)), "#3e363c")
    c.disc(cx, cy, 3, "#c8523f")
    c.disc(cx, cy, 1, "#16121a")
    for k in range(8):                 # a glint on the upper left of the rim
        a = math.pi * (1.0 + k * .05)
        c.set(int(cx + (r - 1) * math.cos(a)), int(cy + (r - 1) * math.sin(a)), "#7a6e74")
    c.line(cx - r + 3, cy - r + 6, cx - r + 6, cy - r + 3, "#8a7e84")


def tv(c, x, y, w=30, h=19, seed="a"):
    """A flat wall TV with a blue screen, a bright logo block and two lines of text."""
    c.rect(x, y, x + w - 1, y + h - 1, "#0e0e14")
    c.hline(x, x + w - 1, y, "#3a3a46")
    c.rect(x + 2, y + 2, x + w - 3, y + h - 3, "#2a66d8")
    c.vgrad(x + 2, y + 2, x + w - 3, y + h - 3, "#6aa8ff", "#1c46b0")
    c.rect(x + 5, y + 5, x + 10, y + 9, "#ff5a3a")
    c.rect(x + 13, y + 5, x + w - 6, y + 6, "#ffffff")
    c.rect(x + 13, y + 8, x + w - 9, y + 8, "#ffe27a")
    c.rect(x + 5, y + h - 7, x + w - 6, y + h - 6, "#bfe0ff")
    c.hline(x + 3, x + 9, y + 3, "#d8ecff")
    c.rect(x + w // 2 - 2, y + h, x + w // 2 + 2, y + h + 2, "#2a2a32")  # bracket


def pa_speaker(c, x, y, w=22, h=30):
    """A black PA speaker box on a wall bracket: silver rim, a woofer cone and a small horn."""
    c.rect(x, y, x + w - 1, y + h - 1, "#16161c")
    c.hline(x, x + w - 1, y, "#5a5a66")
    c.vline(x, y, y + h - 1, "#3a3a46")
    c.vline(x + w - 1, y + 1, y + h - 1, "#08080c")
    c.rect(x + 2, y + 2, x + w - 3, y + h - 3, "#101016")
    cx = x + w // 2
    cy = y + h - 11 if h >= 26 else y + h // 2
    c.disc(cx, cy, 7, "#2a2a34")
    c.disc(cx, cy, 6, "#08080c")
    c.disc(cx - .4, cy - .4, 4.4, "#1c1c24")
    c.disc(cx - .6, cy - .6, 2, "#4a4a58")
    if h >= 26:  # a small horn above the woofer
        c.rect(cx - 4, y + 4, cx + 3, y + 8, "#4a4a58")
        c.rect(cx - 3, y + 5, cx + 2, y + 7, "#08080c")
    c.rect(x + 3, y + h, x + 5, y + h + 3, "#2a2a32")             # bracket
    c.rect(x + w - 6, y + h, x + w - 4, y + h + 3, "#2a2a32")


def spot_can(c, cx, y, tone):
    c.rect(cx - 1, y, cx + 1, y + 3, METAL[2])
    c.rect(cx - 4, y + 4, cx + 4, y + 10, METAL[1])
    c.hline(cx - 4, cx + 4, y + 4, METAL[3])
    c.vline(cx - 4, y + 4, y + 10, METAL[2])
    c.vline(cx + 4, y + 5, y + 10, METAL[0])
    c.ell(cx, y + 11, 4, 2, METAL[0])
    c.ell(cx, y + 11.2, 3, 1.4, tone)
    c.set(cx - 1, y + 11, "#ffffff")


def truss(c, x0, x1, y, spots):
    """A black lighting truss: two rails with a zigzag between them, spot cans hanging under it, hung from the beam by two chains."""
    c.rect(x0, y, x1, y + 1, METAL[1])
    c.hline(x0, x1, y, METAL[3])
    c.rect(x0, y + 8, x1, y + 9, METAL[1])
    c.hline(x0, x1, y + 8, METAL[2])
    for x in range(x0, x1 - 8, 8):
        c.line(x, y + 1, x + 8, y + 8, METAL[2])
        c.line(x + 8, y + 1, x, y + 8, METAL[1])
    for sx in (x0 + 6, x1 - 6):
        c.vline(sx, y - 6, y, "#2a2024")
    for (sx, tone) in spots:
        spot_can(c, sx, y + 10, tone)


def skull_mask(c, cx, y):
    """A small skull mask hanging from the truss on a string."""
    c.vline(cx, y, y + 3, "#2a2024")
    c.ell(cx, y + 8, 5, 5.4, "#1a1418")                  # a dark rim so the mask reads against the white wall
    c.ell(cx, y + 8, 4.2, 4.6, "#efe4c8")
    c.ell(cx - 1.2, y + 6.4, 2.4, 2.2, "#fbf4e0")
    c.rect(cx - 3, y + 7, cx - 2, y + 9, "#1a1418")      # eye sockets
    c.rect(cx + 1, y + 7, cx + 2, y + 9, "#1a1418")
    c.set(cx - 1, y + 10, "#6a5a4a")                      # nose
    c.set(cx, y + 10, "#6a5a4a")
    c.hline(cx - 2, cx + 2, y + 12, "#1a1418")            # teeth
    c.set(cx - 1, y + 12, "#efe4c8")
    c.set(cx + 1, y + 12, "#efe4c8")
    tint(c, cx - 4, y + 4, cx + 4, y + 12, "#e8923a", .14)  # an orange cast, like the mask in the photo


# ---------------------------------------------------------------- the three wall stamps

def wall_lamp(c, x, y):
    """A small warm brass wall lamp: a back plate, an arm, a frosted shade with a bright bulb."""
    c.rect(x - 1, y + 5, x + 1, y + 11, METAL[1])
    c.vline(x - 1, y + 5, y + 11, METAL[3])
    c.rect(x - 4, y + 4, x + 4, y + 5, hx(GOLD[2]))
    c.hline(x - 4, x + 4, y + 4, hx(GOLD[3]))
    c.ell(x, y, 4.2, 5.0, light(hx("#ffd27a"), .3))
    c.ell(x, y + .5, 3.0, 3.8, hx("#ffe9a8"))
    c.ell(x - .5, y, 1.5, 2.2, hx("#fffbe8"))
    c.set(x - 2, y - 2, "#ffffff")


def wall_left():
    """x 1..7: the mezzanine over the bar. People lean on a glass railing above a concrete beam with pendant lamps, a chalkboard hangs
    from the beam, the dark niche of bottles sits under it, and a grey concrete pier closes the left end."""
    W = 7 * T
    c = Canvas(W, WALL_H)
    plaster_bg(c, 0, 0, W - 1, WALL_H - 1, "left")
    balcony_people(c, 0, W, 17, "left")
    railing(c, 0, W - 1, 30, 58, "left")
    beam(c, 0, W - 1, 59, 70, "left")
    niche(c, T, 72, W - 1, 121, "left")
    pier_w = T
    concrete(c, 0, 72, pier_w - 1, 121, "pier", formwork=False)
    c.vline(pier_w - 1, 72, 121, CONC[0])
    c.vline(pier_w - 2, 72, 121, CONC[1])
    fade_down(c, 0, W - 1, 71, 96, a0=.46)   # the soft shade a beam throws on the niche; the chalkboard and the lamps stay in front of it
    chalkboard(c, 44, 70)
    for lx in (96, 142, 188):
        pendant(c, lx, 71, 82)
    skirting(c, 0, W - 1)
    cornice(c, 0, W - 1)
    return c


def wall_mid():
    """x 8..12: the back wall between bar and band. A vault with the projector image and two wall TVs above, the cluster of portraits
    with the lightning poster and the round record sign below."""
    W = 5 * T
    c = Canvas(W, WALL_H)
    plaster_bg(c, 0, 0, W - 1, WALL_H - 1, "mid")
    # the vault: a paler arch inside darker spandrels, as in the photos
    for y in range(8, 64):
        for x in range(W):
            t = ((x - W / 2) / (W / 2 - 6)) ** 2 + ((y - 62) / 56.0) ** 2
            if t > 1.0:
                c.set(x, y, mix(c.get(x, y), (80, 40, 70), .16 + .12 * min(1, (t - 1))))
            elif t > .86:
                c.set(x, y, mix(c.get(x, y), (255, 240, 210), .07))
    # the projector image: a pale blue patch with a darker portrait shape and a title line
    px0, px1, py0, py1 = 42, 116, 12, 46
    for y in range(py0, py1 + 1):
        for x in range(px0, px1 + 1):
            k = .46 + .2 * (1 - (y - py0) / (py1 - py0))
            edge = min(x - px0, px1 - x, y - py0, py1 - y)
            if edge < 2:
                k *= .55
            c.set(x, y, mix(c.get(x, y), "#cfe6f4", k))
    for (ex, ey, erx, ery, k, tone) in ((84, 27, 12, 14, .55, "#6a2a3a"), (82, 25, 8, 9, .5, "#8a4a58"), (88, 22, 6, 6, .4, "#3a2a40")):
        c.ell(ex, ey, erx, ery, mix(hx("#cfe6f4"), hx(tone), k))   # a projected portrait: warm shapes on the pale patch
    c.rect(52, 36, 66, 37, mix(hx("#cfe6f4"), hx("#3a4a6a"), .65))  # the title lines of the slide
    c.rect(52, 40, 74, 40, mix(hx("#cfe6f4"), hx("#3a4a6a"), .5))
    c.rect(52, 14, 62, 15, mix(hx("#cfe6f4"), hx("#3a4a6a"), .5))
    tv(c, 6, 16)
    tv(c, W - 38, 16)
    # the cluster of portraits around the lightning poster
    bowie_poster(c, 80, 68)
    frame_bw(c, 38, 66, 18, 24, 0)
    frame_bw(c, 60, 74, 14, 18, 1)
    frame_bw(c, 38, 94, 22, 16, 2)
    frame_bw(c, 64, 96, 12, 14, 0)
    frame_bw(c, 120, 66, 18, 24, 2, red=True)
    frame_bw(c, 120, 94, 16, 20, 1)
    frame_bw(c, 140, 96, 14, 16, 0)
    record_sign(c, 147, 76, 10)
    wall_lamp(c, 36, 60)
    wall_lamp(c, 156, 56)
    fade_down(c, 0, W - 1, 8, 24, a0=.18)
    skirting(c, 0, W - 1)
    cornice(c, 0, W - 1)
    return c


LOGO_W = 150


def wall_right():
    """x 13..20: the band corner. A balcony landing with people leaning on glass at the top left, under it the white painted logo
    wall with the lighting truss, a skull mask and PA speakers; on the right the staircase climbs along a white wall under a dark red
    handrail. (The stairs go up toward the landing, so the handrail runs from the landing down to the right.)"""
    W = 8 * T
    c = Canvas(W, WALL_H)
    plaster_bg(c, 0, 0, W - 1, WALL_H - 1, "right")
    # landing: balcony people at the left, glass railing, a beam
    lx1 = LOGO_W
    balcony_people(c, 0, lx1, 17, "right")
    railing(c, 0, lx1, 30, 58, "right")
    beam(c, 0, lx1, 59, 70, "right")
    # the dark space above the stairs: a vault in shadow, with the boards of the soffit and a faint light from the landing
    for y in range(6, 112):
        for x in range(lx1 + 1, W):
            k = .62 + .22 * (1 - y / 112) - .16 * max(0, 1 - (x - lx1) / 50.0)
            c.set(x, y, mix(c.get(x, y), (36, 18, 42), k))
    for x in range(lx1 + 6, W, 16):
        c.vline(x, 8, 104, (26, 12, 34, 255))
        c.vline(x + 1, 8, 104, mix(c.get(x + 1, 40), (90, 52, 70), .15))
    # white logo wall
    x0, y0 = 0, 72
    c.rect(x0, y0, lx1, WALL_H - 1, "#f6f0e2")
    r = rng("logo")
    for k in range(8):
        x, y = r.randrange(4, lx1 - 14), r.randrange(80, 112)
        c.dither(x, y, x + r.randrange(8, 16), y + 2, "#f6f0e2", "#ece4d2" if k % 2 else "#fffaf0", .25, k)
    for y in range(WALL_H - 16, WALL_H):
        for x in range(x0, lx1 + 1):
            c.set(x, y, mix(c.get(x, y), "#d8a070", .36 * (y - (WALL_H - 16)) / 16))
    # the stair wall: white, under a handrail that runs from the landing down to the right
    pts = [(lx1, 38), (W - 14, 100)]
    def rail_y(x):
        return int(round(pts[0][1] + (pts[1][1] - pts[0][1]) * (x - pts[0][0]) / (pts[1][0] - pts[0][0])))
    for x in range(lx1 + 1, W):
        ry = rail_y(x)
        for y in range(ry + 6, WALL_H):
            c.set(x, y, "#f2ead8")
        for y in range(ry + 6, min(WALL_H, ry + 16)):      # the shade of the handrail on the white wall
            c.set(x, y, mix(c.get(x, y), "#a8886a", .3 * (1 - (y - ry - 6) / 10)))
        for y in range(WALL_H - 14, WALL_H):                # warm bounce near the floor
            c.set(x, y, mix(c.get(x, y), "#d8a070", .3 * (y - (WALL_H - 14)) / 14))
    for x in range(lx1 + 1, W):                             # the stringer: a dark wood band under the rail, parallel to it
        ry = rail_y(x)
        for y in range(ry + 15, ry + 18):
            c.set(x, y, "#7a3a28" if y == ry + 15 else "#4e2218")
    for x in range(lx1 + 1, W):
        ry = rail_y(x)
        c.vline(x, ry - 2, ry + 5, "#6a2418")        # the handrail: dark red wood, lit on top, a shadow line under it
        c.set(x, ry - 2, "#3a1410")
        c.set(x, ry - 1, "#b05a40")
        c.set(x, ry, "#a04a34")
        c.set(x, ry + 1, "#8a3a2a")
        c.set(x, ry + 5, "#3a1410")
    for x in range(lx1 + 14, W - 14, 11):                   # small brackets that carry the rail
        ry = rail_y(x)
        c.vline(x, ry + 6, ry + 12, "#5a2418")
    nx = W - 18
    c.rect(nx, 92, nx + 6, WALL_H - 7, "#5a1e16")           # newel post
    c.vline(nx, 92, WALL_H - 7, "#b05a40")
    c.vline(nx + 6, 92, WALL_H - 7, "#3a1410")
    c.rect(nx - 1, 88, nx + 7, 92, "#3a1410")
    c.hline(nx - 1, nx + 7, 88, "#b05a40")
    c.ell(nx + 3, 86, 3, 2.4, "#6a2418")
    # the lettering of the logo, redrawn: "il cortile" large, "café" smaller, and the red squiggle
    ink = "#241e2c"
    c.text(31, 91, "il cortile", "#d8cdb4", 2, font=LOWER)
    c.text(30, 90, "il cortile", ink, 2, font=LOWER)
    c.text(76, 105, "café", "#d8cdb4", 2, font=LOWER)
    c.text(75, 104, "café", "#c8423f", 2, font=LOWER)
    pts_s = [(8, 98), (14, 92), (22, 94), (27, 102), (21, 110), (12, 112), (7, 106), (11, 100), (20, 99), (25, 106)]
    for (xa, ya), (xb, yb) in zip(pts_s, pts_s[1:]):
        c.line(xa + 1, ya + 1, xb + 1, yb + 1, "#e8d2b8")
        c.line(xa, ya, xb, yb, "#c8423f")
        c.line(xa + 1, ya, xb + 1, yb, "#a02a38")
    c.disc(30, 97, 2, "#c8423f")
    # the truss hangs under the landing beam in front of the white wall, with a skull mask and coloured spots
    truss(c, 12, lx1 - 30, 62, [(30, hx("#ff59d6")), (58, hx("#ffd27a")), (88, hx("#59a0ff")), (112, hx("#ff9a5a"))])
    skull_mask(c, 73, 72)
    fade_down(c, 0, lx1, 71, 84, a0=.3)
    pa_speaker(c, lx1 - 19, 66, 16, 22)
    pa_speaker(c, W - 44, 50)
    skirting(c, 0, W - 1)
    cornice(c, 0, W - 1)
    return c


# ---------------------------------------------------------------- objects and strips

def pillar():
    """The grey concrete pillar at the end of the bar: lit on the left, shaded on the right, formwork seams and tie holes, a base."""
    c = Canvas(T, 3 * T)
    H = 3 * T
    c.shadow(16, H - 1.5, 12, 2.6, 76)
    c.rect(7, 0, 24, H - 5, CONC[2])
    c.rect(7, 0, 9, H - 5, CONC[3])
    c.vline(7, 0, H - 5, CONC[4])
    c.rect(21, 0, 24, H - 5, CONC[1])
    c.vline(24, 0, H - 5, CONC[0])
    for y in (30, 62):
        c.hline(7, 24, y, CONC[1])
        c.hline(7, 24, y + 1, light(CONC[3], .1))
    for y in (16, 46, 76):
        c.set(14, y, CONC[0])
        c.set(18, y, CONC[0])
    c.rect(5, H - 8, 26, H - 5, CONC[3])                               # plinth
    c.hline(5, 26, H - 8, CONC[4])
    c.hline(5, 26, H - 5, CONC[0])
    c.rect(4, 0, 27, 3, CONC[3])                                       # where the beam meets it
    c.hline(4, 27, 0, CONC[4])
    # two flyers taped to the concrete, and a small brass lamp
    for (fx, fy, tone, ink) in ((10, 46, "#f4e8c8", "#c8423f"), (15, 60, "#e8d8a8", "#2f4aa0")):
        c.rect(fx, fy, fx + 7, fy + 9, tone)
        c.hline(fx, fx + 7, fy, light(hx(tone), .5))
        c.hline(fx + 1, fx + 6, fy + 2, ink)
        c.hline(fx + 1, fx + 5, fy + 4, dark(hx(tone), .3))
        c.hline(fx + 1, fx + 4, fy + 6, dark(hx(tone), .3))
        c.vline(fx + 7, fy + 1, fy + 9, dark(hx(tone), .2))
    wall_lamp(c, 16, 30)
    c.outline()
    return c


def mezz_side(variant, end=False):
    """The mezzanine seen along the left wall, one tile wide: the platform edge with its glass and black frame, people leaning on it
    seen from above, and the soft shade it throws on the floor to the right. `end` closes the strip with a concrete block."""
    c = Canvas()
    r = rng("mezzside%d" % variant)
    c.rect(0, 0, 13, T - 1, hx("#5a3626"))             # the platform floor, dark boards, lit near the wall
    for y in range(0, T, 8):
        c.hline(0, 13, y, hx("#3a2218"))
        c.hline(0, 13, y + 1, hx("#7a4a30"))
    c.rect(14, 0, 17, T - 1, hx(RAIL))                 # rail post line
    c.vline(14, 0, T - 1, hx(RAIL_HI))
    c.rect(18, 0, 26, T - 1, hx("#7ea4b8"))            # glass seen from above: a cool strip with a bright edge
    c.vline(18, 0, T - 1, hx("#cfe6f2"))
    c.vline(19, 0, T - 1, hx("#93b8cc"))
    c.vline(26, 0, T - 1, hx("#5a82a0"))
    c.rect(27, 0, 29, T - 1, hx(CONC[1]))               # concrete lip of the platform
    c.vline(27, 0, T - 1, hx(CONC[4]))
    c.vline(29, 0, T - 1, hx(CONC[0]))
    for k in range(10):                                 # glints
        blend(c, 19 + k % 7, 2 + k * 3, "#ffffff", .5)
    # two people leaning on the rail, seen from the side and above: head, shoulders, an arm on the rail
    for (cy, skin, hair, cloth) in [(7 + 5 * variant, r.choice(SKIN), r.choice(HAIR), r.choice(CLOTH)),
                                    (24 - 4 * variant, r.choice(SKIN), r.choice(HAIR), r.choice(CLOTH))][:1 if end else 2]:
        s, h_, cl = hx(skin), hx(hair), hx(cloth)
        c.ell(9, cy + 1, 6, 5, dark(cl, .3))
        c.ell(8.5, cy, 5.6, 4.6, cl)
        c.ell(7, cy - 1.4, 2.6, 1.6, light(cl, .22))
        c.rect(13, cy - 1, 19, cy, dark(s, .08))        # forearm on the rail
        c.ell(12.5, cy - 4.6, 3.6, 3.4, h_)             # head seen from above: mostly hair
        c.ell(13.6, cy - 4.2, 2.4, 2.2, s)
    if end:                                             # the strip ends on a concrete block with the black post on it
        c.rect(0, 22, 29, T - 1, hx(CONC[2]))
        c.hline(0, 29, 22, hx(CONC[4]))
        c.hline(0, 29, 23, hx(CONC[3]))
        c.hline(0, 29, T - 2, hx(CONC[1]))
        c.hline(0, 29, T - 1, hx(CONC[0]))
        c.vline(29, 22, T - 1, hx(CONC[0]))
        c.rect(14, 18, 18, 23, hx(RAIL))
        c.vline(14, 18, 23, hx(RAIL_HI))
    for x in range(30, T):                              # the soft shade on the floor to the right of the strip
        a = int(86 * (1 - (x - 30) / 2.0) ** 1.3)
        c.vline(x, 0, T - 1, (26, 12, 40, max(0, a)))
    return c


def chandelier():
    """Black wrought-iron birdcage chandelier, 2 tiles wide and 3 tall (drawn above everyone): a chain, a ring, curved bars around a
    warm lit core with candle bulbs, a tail and a drop."""
    c = Canvas(2 * T, 3 * T)
    cx = 32
    iron, iron_hi = "#18141a", "#4a4250"
    for y in range(0, 17):             # the chain fades in from the ceiling, so it does not stop in mid air
        a = min(255, 40 + y * 15)
        c.set(cx, y, hx(iron, a))
        c.set(cx - 1, y, hx(iron_hi, a))
    for y in range(2, 16, 3):
        c.hline(cx - 2, cx + 1, y, hx(iron, min(255, 40 + y * 15)))
    y0, y1, rx = 24, 58, 16
    c.glow(cx, 42, 24, "#ffcf72", 120)
    for i in range(-3, 4):
        for t in range(0, 35):
            f = t / 34
            half = rx * math.sin(math.pi * (0.18 + 0.64 * f)) * (i / 3.0)
            x, y = int(round(cx + half)), y0 + t
            c.set(x, y, iron)
            if i in (-3, -2, -1):
                c.set(x - 1, y, mix(iron, iron_hi, .3)) if t % 5 == 0 else None
    c.ell(cx, y0, 5, 2.2, iron)
    c.ell(cx, y1, rx, 3.2, iron)
    c.ell(cx, y1 - .4, rx - 1.4, 2.2, hx("#00000000"))
    for (bx, by) in ((cx - 9, 36), (cx + 9, 36), (cx, 40), (cx - 6, 48), (cx + 6, 48)):  # candle bulbs inside
        c.rect(bx - 1, by - 2, bx + 1, by + 2, "#fff4c8")
        c.set(bx, by - 1, "#ffffff")
        c.set(bx - 1, by + 3, "#ffcf72")
    c.vline(cx, y1 + 3, y1 + 8, iron)
    c.disc(cx, y1 + 9, 2, iron)
    c.hline(cx - 3, cx - 1, 36, iron_hi)
    return c


def entrance_gap():
    """The entrance in the bottom wall, 2 tiles wide: wooden door posts, a stone step and the night street outside under a lamp."""
    c = Canvas(2 * T, T)
    c.rect(0, 0, 2 * T - 1, T - 1, "#101a3a")
    c.vgrad(5, 0, 2 * T - 6, T - 1, "#1a2a58", "#0c1230")
    for x in range(6, 2 * T - 6, 8):  # wet cobbles in the lamp light
        for y in range(6, T, 8):
            c.round_rect(x + 1, y + 1, x + 6, y + 5, mix("#2a3a6a", "#e8b060", .25), 2)
            c.hline(x + 2, x + 5, y + 1, mix("#3a4a7a", "#f0c880", .35))
    c.glow(32, 22, 26, "#ffcf72", 100)
    c.rect(0, 0, 4, T - 1, WOOD[1])  # posts
    c.vline(0, 0, T - 1, WOOD[3])
    c.vline(1, 0, T - 1, light(WOOD[3], .1))
    c.vline(4, 0, T - 1, WOOD[0])
    c.rect(2 * T - 5, 0, 2 * T - 1, T - 1, WOOD[1])
    c.vline(2 * T - 5, 0, T - 1, WOOD[3])
    c.vline(2 * T - 1, 0, T - 1, WOOD[0])
    c.rect(5, 0, 2 * T - 6, 5, "#c4b794")  # inner step
    c.hline(5, 2 * T - 6, 0, "#dad3b7")
    c.hline(5, 2 * T - 6, 5, "#705e52")
    return c


def define(reg):
    reg.stamp("cortile_wall_left", wall_left(), "walls")
    reg.stamp("cortile_wall_mid", wall_mid(), "walls")
    reg.stamp("cortile_wall_right", wall_right(), "walls")
    reg.stamp("cortile_pillar", pillar(), "objects", mask=[".", ".", "#"])
    reg.stamp("cortile_mezz_side_a", mezz_side(0), "walls")
    reg.stamp("cortile_mezz_side_b", mezz_side(1), "walls")
    reg.stamp("cortile_mezz_side_c", mezz_side(2), "walls")
    reg.stamp("cortile_mezz_side_end", mezz_side(1, end=True), "walls")
    reg.stamp("cortile_chandelier", chandelier(), "above")
    reg.stamp("cortile_entrance", entrance_gap(), "walls")
