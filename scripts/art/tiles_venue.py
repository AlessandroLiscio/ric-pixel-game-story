"""Stamps that rebuild the recognisable features of the Cortile Cafe from the reference photos (shapes only, nothing copied):
the mezzanine with its glass railing and the people leaning over it, the dark wooden staircase, the painted logo wall behind the
stage, the light truss, the black wrought-iron chandelier, the wall TVs, the round record sign, the chalkboard menu and the bar nook."""
import math

from tilepaint import CAP, GOLD, GREEN, METAL, OUT, OUT_COOL, RED, STONE, WOOD, Canvas, T, hx, mix, rng
from tiles_objects import bottle

SKIN = ["#f4cba8", "#dba577", "#c28a5c", "#e8b890"]
HAIR = ["#2b2330", "#5a3a28", "#8c5a38", "#b04a48", "#d8b060", "#2b2330", "#3a2a30"]
CLOTH = ["#2f3d6b", "#3b3f4c", "#f4f1ea", "#8c2a3a", "#4f9a5d", "#e8b83a", "#a6aab3", "#2b2330", "#e07a90"]


def mezz_front(n, seed):
    """Two tiles tall, n wide: people leaning on a glass railing (black frame), then the grey concrete beam with pendant lamps."""
    W = n * T
    c = Canvas(W, 2 * T)
    r = rng("mezz%s" % seed)
    x = -2
    while x < W + 2:
        cx = x + r.randrange(0, 4)
        skin = hx(r.choice(SKIN))
        hair = hx(r.choice(HAIR))
        cloth = hx(r.choice(CLOTH))
        hy = 8 + r.randrange(-2, 4)  # head centre
        # body behind the glass
        c.ell(cx, hy + 13, 7, 8, mix(cloth, "#000000", .25))
        c.ell(cx - .5, hy + 12, 6.4, 7.4, cloth)
        c.ell(cx - 1.5, hy + 10, 3, 2.6, mix(cloth, "#ffffff", .22))
        c.rect(cx - 1, hy + 3, cx + 1, hy + 6, mix(skin, "#000000", .15))  # neck
        # head and hair
        c.ell(cx, hy, 4.3, 4.6, hair)
        c.ell(cx, hy + 1.2, 3.5, 3.6, skin)
        if r.random() < .6:
            c.rect(int(cx - 3), hy - 3, int(cx + 3), hy - 1, hair)
        else:
            c.ell(cx, hy - 2, 4.4, 2.4, hair)
        c.set(int(cx - 1), hy + 1, "#2a1a1e")
        c.set(int(cx + 1), hy + 1, "#2a1a1e")
        # forearms on the rail
        c.rect(int(cx - 6), 20, int(cx - 2), 21, mix(skin, "#000000", .1))
        c.rect(int(cx + 2), 20, int(cx + 6), 21, mix(skin, "#000000", .1))
        x += r.randrange(7, 11)
    # glass pane (light, with diagonal glints) and black frame
    for yy in range(13, 29):
        for xx in range(W):
            p = c.get(xx, yy)
            if p[3] > 0:
                c.set(xx, yy, mix(p, "#bfe0f0", .22))
            else:
                c.set(xx, yy, (190, 224, 240, 40))
    for gx in range(-20, W, 22):
        for k in range(13):
            c.set(gx + k + 4, 15 + k, (255, 255, 255, 120))
            c.set(gx + k + 5, 15 + k, (255, 255, 255, 70))
    c.rect(0, 12, W - 1, 13, "#1a1418")  # top rail
    c.hline(0, W - 1, 12, "#4a4044")
    c.rect(0, 28, W - 1, 31, "#1a1418")  # bottom rail / floor edge
    c.hline(0, W - 1, 28, "#3a3034")
    for px in range(0, W + 1, T):  # posts
        c.rect(max(0, px - 1), 12, min(W - 1, px + 1), 31, "#1a1418")
        c.vline(max(0, px - 1), 13, 27, "#4a4044")
    # concrete beam fascia
    c.rect(0, 32, W - 1, 41, "#9c978f")
    c.hline(0, W - 1, 32, "#c8c4bc")
    c.hline(0, W - 1, 33, "#b4afa6")
    c.hline(0, W - 1, 41, "#4a4640")
    c.hline(0, W - 1, 40, "#78736b")
    for _ in range(W // 2):
        c.set(r.randrange(W), r.randrange(34, 40), r.choice(["#8a857d", "#aaa59c"]))
    for y in range(42, 56):  # shadow under the beam on the wall
        a = int(110 * (1 - (y - 42) / 14) ** 1.4)
        for xx in range(W):
            if c.get(xx, y)[3] == 0:
                c.set(xx, y, (40, 16, 24, a))
    # pendant lamps
    for lx in range(24, W - 10, 56):
        c.vline(lx, 42, 47, "#2a2024")
        c.ell(lx, 50, 4, 3, "#ffd27a")
        c.rect(lx - 3, 47, lx + 3, 48, "#2a2024")
        c.glow(lx, 53, 12, "#ffcf72", 90)
        c.set(lx - 1, 49, "#fff8d8")
    return c


def bottle_nook(n):
    """One tile tall: a dark lit bar niche with two tiers of bottles, as under the mezzanine in the photos."""
    W = n * T
    c = Canvas(W, T)
    c.rect(0, 0, W - 1, T - 1, "#3a2216")
    c.vgrad(1, 1, W - 2, T - 2, "#a06a38", "#4a2c1c")
    r = rng("nook%d" % n)
    cols = ["#3a7240", "#8a4a20", "#c8423f", "#e8b83a", "#2f4aa0", "#f4f1ea", "#3a7240", "#a02a4a", "#5a9a4e", "#c08a22"]
    for yb, hmax in ((14, 11), (29, 11)):
        x = 3
        while x < W - 8:
            bottle(c, x, yb, r.choice([hmax - 3, hmax - 1, hmax]), r.choice(cols), label="#f4f1ea" if r.random() < .5 else None)
            x += r.choice([6, 7, 7])
        c.rect(0, yb + 1, W - 1, yb + 2, WOOD[3])
        c.hline(0, W - 1, yb + 1, WOOD[4])
        c.hline(0, W - 1, yb + 2, WOOD[0])
    c.rect(0, 0, W - 1, 0, WOOD[0])
    c.vline(0, 0, T - 1, WOOD[1])
    c.vline(W - 1, 0, T - 1, WOOD[0])
    c.outline(OUT)
    return c


def logo_wall(w):
    """3 tiles tall: the white painted panel under the staircase, with the red squiggle and the name in pixel letters."""
    W, H = w * T, 3 * T
    c = Canvas(W, H)
    r = rng("logowall")
    panel_x0 = 20
    # panel: white with a sloping top edge (the underside of the stairs)
    for x in range(panel_x0, W - 6):
        top = 6 + int((x - panel_x0) * 0.10)
        for y in range(top, H):
            c.set(x, y, "#f6f0e2")
    for _ in range(W):
        x, y = r.randrange(panel_x0, W - 6), r.randrange(8, H)
        if c.get(x, y)[3]:
            c.set(x, y, r.choice(["#ece4d2", "#fffaf0"]))
    for y in range(H - 14, H):  # soft shade near the floor
        for x in range(panel_x0, W - 6):
            c.set(x, y, mix(c.get(x, y), "#d8a070", .4 * (y - (H - 14)) / 14))
    # soffit above the slope: dark stained wood
    for x in range(panel_x0, W - 6):
        top = 6 + int((x - panel_x0) * 0.10)
        for y in range(0, top):
            c.set(x, y, WOOD[1] if (x // 6 + y // 5) % 2 else WOOD[2])
        c.set(x, top, WOOD[0])
        c.set(x, top - 1, WOOD[3])
    c.vline(panel_x0, 4, H - 1, "#c8bca0")
    c.vline(W - 7, 20, H - 1, "#c8bca0")
    # the wordmark, centred in the panel, and the red squiggle
    s = 3
    tw = c.text_width("CORTILE", s)
    tx = panel_x0 + ((W - 6 - panel_x0) - tw) // 2 + 8
    c.text(tx + 1, 47, "CORTILE", "#c8bca0", s)
    c.text(tx, 46, "CORTILE", "#2a2640", s)
    c.text(tx + 40, 72, "CAFE", "#c8423f", 2)
    pts = [(x + 250, y) for (x, y) in ((34, 58), (40, 53), (47, 55), (51, 62), (46, 69), (38, 72), (32, 67), (35, 61), (43, 60), (48, 66))]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        c.line(x0, y0, x1, y1, "#c8423f")
        c.line(x0 + 1, y0, x1 + 1, y1, "#a02a38")
    c.ell(300, 63, 2.4, 2.4, "#c8423f")
    c.rect(tx, 90, tx + tw, 91, "#2a2640")
    return c


def stairs_up(w=4):
    """3 tiles tall: the dark wooden staircase climbing to the right with its banister and balusters, as on the right of the stage."""
    W, H = w * T, 3 * T
    c = Canvas(W, H)
    steps = 7
    sw = W // steps
    rise = 9
    base = H - 2
    prof = []  # top of each step
    for i in range(steps):
        top = base - rise * (i + 1)
        x0 = i * sw
        c.rect(x0, top, x0 + sw, base, WOOD[1])  # riser (dark)
        c.rect(x0, top, x0 + sw, top + 2, WOOD[3])  # tread lit
        c.hline(x0, x0 + sw, top, WOOD[4])
        c.hline(x0, x0 + sw, top + 3, WOOD[0])
        prof.append(top)
    c.rect(0, base - 1, W - 1, H - 1, WOOD[0])
    # soffit under the stairs
    for x in range(W):
        i = min(steps - 1, x // sw)
    # balusters and handrail
    rail0 = (2, prof[0] - 22)
    rail1 = (W - 3, prof[-1] - 22)
    for x in range(4, W - 2, 6):
        t = (x - rail0[0]) / (rail1[0] - rail0[0])
        ry = int(rail0[1] + (rail1[1] - rail0[1]) * t)
        i = min(steps - 1, x // sw)
        c.vline(x, ry, prof[i], "#5a2418")
        c.vline(x + 1, ry, prof[i], "#8a3a28")
    c.line(rail0[0], rail0[1], rail1[0], rail1[1], "#4a1a14")
    c.line(rail0[0], rail0[1] - 1, rail1[0], rail1[1] - 1, "#a04a34")
    c.line(rail0[0], rail0[1] - 2, rail1[0], rail1[1] - 2, "#6a2a1e")
    c.rect(0, rail0[1] - 5, 3, prof[0], "#4a1a14")  # newel post
    c.rect(0, rail0[1] - 5, 1, prof[0], "#a04a34")
    c.outline(OUT)
    return c


def truss(n):
    """One tile tall: a black lighting truss with four coloured spot cans hanging under it."""
    W = n * T
    c = Canvas(W, T)
    c.rect(0, 3, W - 1, 4, METAL[1])
    c.rect(0, 13, W - 1, 14, METAL[1])
    c.hline(0, W - 1, 3, METAL[3])
    for x in range(0, W - 8, 8):
        c.line(x, 4, x + 8, 13, METAL[2])
        c.line(x + 8, 4, x, 13, METAL[1])
    for k, tone in enumerate(["#ff59d6", "#ffd27a", "#59a0ff", "#ff9a5a", "#ffffff"][:max(2, n // 2)]):
        cx = int((k + .5) * W / max(2, n // 2))
        c.rect(cx - 1, 15, cx + 1, 17, METAL[2])
        c.rect(cx - 5, 18, cx + 5, 25, METAL[1])
        c.hline(cx - 5, cx + 5, 18, METAL[3])
        c.vline(cx - 5, 18, 25, METAL[2])
        c.ell(cx, 26, 5, 2.4, METAL[0])
        c.ell(cx, 26.2, 4, 1.8, tone)
        c.glow(cx, 28, 10, tone, 110)
    c.outline(OUT_COOL)
    return c


def chandelier():
    """Black wrought-iron birdcage chandelier, 2 tiles wide and 3 tall (drawn above everyone)."""
    c = Canvas(2 * T, 3 * T)
    cx = 32
    c.vline(cx, 0, 16, "#1a1418")
    c.vline(cx - 1, 0, 16, "#3a3034")
    c.ell(cx, 18, 4, 2.4, "#1a1418")
    # the cage: a lit core, a ring at the top and the bottom, and curved bars between them
    y0, y1, rx = 24, 58, 16
    c.glow(cx, 42, 24, "#ffcf72", 120)
    for i in range(-3, 4):
        for t in range(0, 35):
            f = t / 34
            half = rx * math.sin(math.pi * (0.18 + 0.64 * f)) * (i / 3.0)
            x, y = int(round(cx + half)), y0 + t
            c.set(x, y, "#1a1418")
    c.ell(cx, y0, 5, 2.2, "#1a1418")
    c.ell(cx, y1, rx, 3.2, "#1a1418")
    c.ell(cx, y1 - .4, rx - 1.4, 2.2, hx("#00000000"))
    for (bx, by) in ((cx - 9, 36), (cx + 9, 36), (cx, 40), (cx - 6, 48), (cx + 6, 48)):  # candle bulbs inside
        c.rect(bx - 1, by - 2, bx + 1, by + 2, "#fff4c8")
        c.set(bx, by - 1, "#ffffff")
    c.vline(cx, y1 + 3, y1 + 8, "#1a1418")  # tail
    c.disc(cx, y1 + 9, 2, "#1a1418")
    c.ell(cx, 18, 4, 2.4, "#1a1418")
    return c


def tv_wall():
    c = Canvas()
    c.rect(3, 7, 28, 21, "#0e0e14")
    c.hline(3, 28, 7, "#3a3a46")
    c.rect(5, 9, 26, 19, "#2a66d8")
    c.vgrad(5, 9, 26, 19, "#6aa8ff", "#1c46b0")
    c.rect(9, 12, 14, 16, "#ff5a3a")  # a bright logo
    c.rect(16, 11, 23, 12, "#ffffff")
    c.rect(16, 14, 22, 14, "#ffe27a")
    c.rect(16, 16, 20, 16, "#ffffff")
    c.rect(14, 22, 17, 24, "#2a2a32")  # bracket
    c.glow(16, 14, 17, "#59a0ff", 90)
    c.outline("#0e0e14")
    return c


def round_sign():
    c = Canvas()
    c.disc(16, 16, 12, "#1a1418")
    c.disc(16, 16, 11, "#3a2a2a")
    c.ell(16, 16, 9, 9, "#1a1418")
    c.ell(16, 16, 6, 6, "#2a2024")
    for rr in (8, 7, 6):
        for k in range(24):
            a = k * math.pi / 12
            c.set(int(16 + rr * math.cos(a)), int(16 + rr * math.sin(a)), "#3a3036")
    c.disc(16, 16, 3, "#e8b83a")
    c.disc(16, 16, 1, "#2a1a1e")
    c.line(7, 9, 11, 6, "#7a6a6a")
    c.outline(OUT)
    return c


def chalkboard():
    c = Canvas(T, 2 * T)
    c.vline(9, 0, 8, "#2a2024")
    c.vline(22, 0, 8, "#2a2024")
    c.rect(5, 8, 26, 54, WOOD[1])
    c.hline(5, 26, 8, WOOD[3])
    c.vline(5, 8, 54, WOOD[2])
    c.rect(8, 11, 23, 51, "#26322e")
    r = rng("chalk")
    for i, y in enumerate(range(14, 48, 5)):
        ln = r.randrange(7, 15)
        c.hline(10, 10 + ln, y, "#e8e8d8" if i % 3 else "#f4c0a0")
        if i % 2:
            c.hline(10, 10 + max(3, ln - 5), y + 1, "#a8b0a0")
    c.rect(8, 11, 23, 11, "#3a4a44")
    c.rect(7, 54, 24, 56, WOOD[0])
    c.shadow(16, 58, 9, 2, 40)
    c.outline(OUT)
    return c


def entrance_gap():
    """The entrance in the bottom wall, 2 tiles wide: wooden door posts, a stone step and the night street outside."""
    c = Canvas(2 * T, T)
    c.rect(0, 0, 2 * T - 1, T - 1, "#101a3a")
    c.vgrad(5, 0, 2 * T - 6, T - 1, "#1a2a58", "#0c1230")
    r = rng("street")
    for x in range(6, 2 * T - 6, 8):  # wet cobbles in the lamp light
        for y in range(6, T, 8):
            c.rect(x + 1, y + 1, x + 6, y + 5, mix("#2a3a6a", "#e8b060", .25))
            c.hline(x + 1, x + 6, y + 1, mix("#3a4a7a", "#f0c880", .35))
    c.glow(32, 22, 26, "#ffcf72", 100)
    c.rect(0, 0, 4, T - 1, WOOD[1])  # posts
    c.vline(0, 0, T - 1, WOOD[3])
    c.vline(4, 0, T - 1, WOOD[0])
    c.rect(2 * T - 5, 0, 2 * T - 1, T - 1, WOOD[1])
    c.vline(2 * T - 5, 0, T - 1, WOOD[3])
    c.vline(2 * T - 1, 0, T - 1, WOOD[0])
    c.rect(5, 0, 2 * T - 6, 5, STONE[3])  # inner step
    c.hline(5, 2 * T - 6, 0, STONE[4])
    c.hline(5, 2 * T - 6, 5, STONE[1])
    return c


def define(reg):
    reg.stamp("mezz_front_9", mezz_front(9, "a"), "below")
    reg.stamp("mezz_front_5", mezz_front(5, "b"), "below")
    reg.stamp("mezz_front_2", mezz_front(2, "c"), "below")
    reg.stamp("bottle_nook_9", bottle_nook(9), "below")
    reg.stamp("logo_wall_12", logo_wall(12), "below")
    reg.stamp("stairs_up_4", stairs_up(4), "below")
    reg.stamp("truss_10", truss(10), "below")
    reg.stamp("chandelier", chandelier(), "above")
    reg.stamp("tv_wall", tv_wall(), "below")
    reg.stamp("round_sign", round_sign(), "below")
    reg.stamp("chalkboard", chalkboard(), "below")
    reg.stamp("entrance_gap", entrance_gap(), "walls")
