"""Furniture, stage gear, wall decorations and scenery stamps. Every stamp is drawn on one canvas of w*32 x h*32 px."""
from tilepaint import (BRICK, CAP, CREAM, FLOOR_WOOD, GOLD, GREEN, METAL, OUT, OUT_COOL, PLASTER, RED, STONE, WOOD, BLUE,
                       Canvas, T, hx, mix, rng)


def ramp(c, n=3):
    return c


# ---------------------------------------------------------------- small shared pieces

def bottle(c, x, yb, h, body, label=None, neck_dark=None):
    """A bottle standing with its foot at row yb, left edge x (5 px wide)."""
    d = hx(body)
    dk = mix(d, "#000000", .35)
    lt = mix(d, "#ffffff", .45)
    c.rect(x, yb - h + 4, x + 4, yb, d)
    c.vline(x, yb - h + 4, yb, lt)
    c.vline(x + 4, yb - h + 4, yb, dk)
    c.hline(x, x + 4, yb, dk)
    c.rect(x + 1, yb - h, x + 3, yb - h + 3, d)  # neck
    c.vline(x + 1, yb - h, yb - h + 3, lt)
    c.vline(x + 3, yb - h, yb - h + 3, dk)
    c.hline(x + 1, x + 3, yb - h, neck_dark or dk)
    if label:
        c.rect(x + 1, yb - 4, x + 3, yb - 2, label)


def glass(c, x, yb, tone="#cfe8f4", liquid=None):
    c.rect(x, yb - 4, x + 3, yb, mix(tone, "#ffffff", .1))
    c.vline(x, yb - 4, yb, "#ffffff")
    c.hline(x, x + 3, yb, "#8aa6b8")
    if liquid:
        c.rect(x + 1, yb - 3, x + 2, yb - 1, liquid)


def pot(c, cx, yb, w, h, tone="terracotta"):
    base = ["#6e2c1e", "#a04a2c", "#c8683a", "#e08a52"]
    c.poly([(cx - w // 2, yb - h), (cx + w // 2, yb - h), (cx + w // 2 - 2, yb), (cx - w // 2 + 2, yb)], base[2])
    c.rect(cx - w // 2 - 1, yb - h, cx + w // 2 + 1, yb - h + 2, base[3])
    c.hline(cx - w // 2 - 1, cx + w // 2 + 1, yb - h + 2, base[0])
    c.vline(cx - w // 2 + 1, yb - h + 3, yb - 1, base[3])
    c.vline(cx + w // 2 - 1, yb - h + 3, yb - 1, base[1])
    c.hline(cx - w // 2 + 2, cx + w // 2 - 2, yb, base[0])


def leaf(c, cx, cy, rx, ry, tones=GREEN):
    """A leafy blob: dark rim, mid body, bright top left."""
    c.ell(cx, cy, rx, ry, tones[0])
    c.ell(cx - .5, cy - .5, rx - 1, ry - 1, tones[1])
    c.ell(cx - 1.5, cy - 1.5, max(1, rx - 3), max(1, ry - 3), tones[2])
    c.ell(cx - 2.5, cy - 2.5, max(1, rx - 5), max(1, ry - 5), tones[3])


# ---------------------------------------------------------------- bar and cafe furniture

def bar_counter(n, props=True):
    W = n * T
    c = Canvas(W, T)
    c.shadow(W / 2, 30, W / 2 - 1, 2.2, 60)
    # top surface (lit) and lip
    c.rect(1, 3, W - 2, 13, WOOD[3])
    c.hline(1, W - 2, 3, WOOD[4])
    c.hline(1, W - 2, 4, mix(WOOD[3], WOOD[4], .5))
    c.hline(1, W - 2, 12, WOOD[2])
    c.hline(1, W - 2, 13, WOOD[1])
    r = rng("bar%d" % n)
    for _ in range(n * 7):  # grain
        x, y = r.randrange(3, W - 8), r.randrange(5, 12)
        for k in range(r.randrange(4, 10)):
            c.set(x + k, y, mix(WOOD[3], WOOD[2] if r.random() < .5 else WOOD[4], .55))
    # front panel
    c.rect(1, 14, W - 2, 28, WOOD[1])
    c.hline(1, W - 2, 14, WOOD[0])
    for i in range(n):
        x0 = i * T + 4
        c.rect(x0, 17, x0 + 23, 26, WOOD[2])
        c.hline(x0, x0 + 23, 17, WOOD[0])
        c.vline(x0, 17, 26, WOOD[0])
        c.hline(x0 + 1, x0 + 23, 26, WOOD[3])
        c.vline(x0 + 23, 18, 26, WOOD[3])
        c.noise(x0 + 1, 18, x0 + 22, 25, [WOOD[1], WOOD[3]], .08, r)
    c.rect(1, 27, W - 2, 28, METAL[2])  # brass foot rail
    c.hline(1, W - 2, 27, GOLD[3])
    c.hline(1, W - 2, 28, GOLD[0])
    c.rect(1, 29, W - 2, 29, WOOD[0])
    if props:
        glass(c, 40, 11, liquid="#e8b83a")
        glass(c, 47, 11, liquid="#f4f1ea")
        glass(c, 54, 12)
        # beer taps
        tx = W // 2 + 6
        c.rect(tx, 5, tx + 11, 7, METAL[3])
        c.hline(tx, tx + 11, 5, METAL[4])
        for k in (1, 5, 9):
            c.rect(tx + k, 8, tx + k, 11, METAL[2])
            c.set(tx + k, 4, hx(["#c8423f", "#e8b83a", "#4f72d0"][k // 4]))
        # cash register at the right end
        rx = W - 30
        c.rect(rx, 6, rx + 14, 12, "#d8cdb0")
        c.hline(rx, rx + 14, 6, "#ffffff")
        c.rect(rx + 2, 7, rx + 12, 8, "#2f6a52")
        c.rect(rx + 1, 9, rx + 13, 11, "#8a7a62")
        for k in range(3, 12, 3):
            c.set(rx + k, 10, "#e8d8b0")
        c.rect(rx + 3, 2, rx + 11, 5, "#f4ead0")
        c.hline(rx + 3, rx + 11, 2, "#ffffff")
        c.rect(rx + 4, 3, rx + 10, 4, "#2a6a52")
    c.outline(OUT)
    return c


def bar_stool():
    c = Canvas()
    c.shadow(16, 29, 9, 3, 70)
    c.ell(16, 28, 7, 2.6, METAL[1])  # foot ring
    c.ell(16, 27.5, 6, 2, METAL[2])
    c.rect(15, 16, 16, 26, METAL[3])
    c.vline(15, 16, 26, METAL[4])
    c.vline(16, 16, 26, METAL[2])
    c.ell(16, 23, 6.5, 2.2, METAL[1])  # foot rest ring
    c.ell(16, 22.5, 5.5, 1.5, METAL[2])
    c.ell(16, 22.5, 3, .8, hx("#00000000"))
    c.ell(16, 16, 9, 5, RED[0])  # seat side
    c.ell(16, 14, 9, 5, RED[2])
    c.ell(14.5, 13, 6.5, 3.3, RED[3])
    c.ell(13, 12, 3, 1.4, hx("#f7a090"))
    c.hline(9, 23, 17, RED[0])
    c.outline(OUT)
    return c


def table_round(cloth=None, name="table_round"):
    c = Canvas()
    top, edge, hi = (WOOD[3], WOOD[1], WOOD[4]) if not cloth else (cloth[2], cloth[0], cloth[3])
    c.shadow(16, 28, 11, 3, 70)
    c.ell(16, 28, 8, 2.8, edge)  # base
    c.ell(16, 27, 7, 2, mix(edge, hx("#ffffff"), .15))
    c.rect(14, 17, 18, 27, edge if not cloth else WOOD[1])
    c.vline(14, 17, 27, WOOD[2])
    if cloth:  # cloth hangs down in a skirt
        c.ell(16, 18, 12, 6.5, cloth[1])
        c.rect(5, 12, 27, 19, cloth[1])
        c.ell(16, 12, 12, 6.5, cloth[1])
        for x in range(5, 28, 3):  # scalloped hem
            c.ell(x + 1, 19, 2, 1.5, cloth[1])
    c.ell(16, 15, 12, 6, edge)
    c.ell(16, 13, 12, 6, top)
    c.ell(15, 12.2, 10, 4.6, mix(top, hx(hi), .25))
    c.ell(12, 10.5, 4, 1.6, mix(top, hx("#ffffff"), .45))
    # candle jar and glass
    c.rect(18, 9, 21, 12, "#e86a3a")
    c.hline(18, 21, 9, "#f8a070")
    c.rect(19, 6, 20, 8, "#ffe27a")
    c.set(19, 5, "#fff6c0")
    glass(c, 9, 13, liquid="#e8b83a")
    c.outline(OUT)
    return c


def chair(facing):
    c = Canvas()
    c.shadow(16, 28, 9, 2.6, 60)
    wd = WOOD
    if facing in ("w", "e"):
        flip = facing == "e"
        d = Canvas()
        d.rect(21, 7, 24, 22, wd[2])  # back slab
        d.vline(21, 7, 22, wd[3])
        d.vline(24, 7, 22, wd[1])
        d.hline(21, 24, 7, wd[4])
        d.rect(22, 10, 23, 14, wd[1])
        d.rect(22, 16, 23, 20, wd[1])
        d.rect(21, 25, 23, 28, wd[1])  # rear leg
        d.rect(7, 19, 24, 22, wd[2])  # seat
        d.rect(7, 19, 24, 20, wd[3])
        d.hline(7, 24, 19, wd[4])
        d.hline(7, 24, 22, wd[0])
        d.rect(9, 22, 11, 28, wd[1])  # front leg
        d.vline(9, 22, 28, wd[2])
        d.rect(9, 17, 20, 19, RED[2])  # cushion
        d.hline(9, 20, 17, RED[3])
        d.hline(9, 20, 19, RED[0])
        im = d.im.transpose(0) if not flip else d.im.transpose(0).transpose(0)
        if flip:
            from PIL import Image
            im = d.im.transpose(Image.FLIP_LEFT_RIGHT)
        c.im.alpha_composite(im)
        c.px = c.im.load()
    elif facing == "s":  # faces the viewer: back at the top
        c.rect(9, 7, 22, 17, wd[2])
        c.rect(9, 7, 22, 8, wd[3])
        c.vline(9, 7, 17, wd[3])
        c.vline(22, 8, 17, wd[1])
        for x in (12, 15, 18):
            c.rect(x, 10, x + 1, 16, wd[1])
        c.rect(9, 19, 22, 23, wd[2])
        c.hline(9, 22, 19, wd[4])
        c.rect(10, 17, 21, 20, RED[2])
        c.hline(10, 21, 17, RED[3])
        c.hline(10, 21, 20, RED[0])
        c.hline(9, 22, 24, wd[0])
        for x in (9, 21):
            c.rect(x, 24, x + 1, 28, wd[1])
    else:  # "n": seen from behind, back covers the seat
        c.rect(9, 8, 22, 22, wd[2])
        c.rect(9, 8, 22, 9, wd[3])
        c.vline(9, 8, 22, wd[3])
        c.vline(22, 9, 22, wd[1])
        for x in (12, 15, 18):
            c.rect(x, 11, x + 1, 20, wd[1])
        c.hline(9, 22, 22, wd[0])
        for x in (9, 21):
            c.rect(x, 23, x + 1, 28, wd[1])
    c.outline(OUT)
    return c


# ---------------------------------------------------------------- stage gear

def amp():
    c = Canvas()
    c.shadow(16, 30, 13, 2.4, 70)
    c.rect(3, 12, 28, 29, METAL[1])  # front
    c.rect(3, 7, 28, 12, METAL[2])  # top face
    c.hline(3, 28, 7, METAL[4])
    c.hline(3, 28, 12, METAL[0])
    c.vline(3, 7, 29, METAL[2])
    c.vline(28, 12, 29, METAL[0])
    c.rect(5, 14, 26, 18, METAL[0])  # control strip
    for x in range(7, 25, 4):
        c.rect(x, 15, x + 1, 16, METAL[4])
        c.set(x, 17, hx("#c8423f"))
    c.rect(5, 19, 26, 28, hx("#3a2a24"))  # grille cloth
    for y in range(19, 29):
        for x in range(5, 27):
            if (x + y) % 3 == 0:
                c.set(x, y, hx("#5a4036"))
            elif (x - y) % 4 == 0:
                c.set(x, y, hx("#2a1c18"))
    c.rect(5, 19, 26, 19, METAL[0])
    c.rect(11, 22, 20, 24, "#f4f1ea")  # badge
    c.hline(11, 20, 22, "#ffffff")
    c.set(23, 15, hx("#ff4a3a"))
    c.rect(12, 4, 19, 6, METAL[3])  # handle
    c.hline(12, 19, 4, METAL[4])
    c.rect(13, 5, 18, 5, METAL[0])
    c.outline(OUT_COOL)
    return c


def speaker_stack():
    c = Canvas(T, 2 * T)
    c.shadow(16, 62, 13, 2.4, 70)
    for (y0, y1, kind) in ((33, 61, "woofer"), (4, 32, "horn")):
        c.rect(4, y0, 27, y1, METAL[1])
        c.hline(4, 27, y0, METAL[3])
        c.vline(4, y0, y1, METAL[2])
        c.vline(27, y0, y1, METAL[0])
        c.hline(4, 27, y1, METAL[0])
        c.rect(6, y0 + 3, 25, y1 - 3, METAL[0])
        cx, cy = 16, (y0 + y1) // 2
        if kind == "woofer":
            c.disc(cx, cy, 10, METAL[1])
            c.disc(cx, cy, 8, METAL[0])
            c.disc(cx - .5, cy - .5, 6, METAL[1])
            c.disc(cx - 1, cy - 1, 3, METAL[2])
            c.disc(cx, cy, 1, METAL[0])
            c.hline(cx - 8, cx - 5, cy - 7, METAL[3])
        else:
            c.rect(8, y0 + 5, 23, y0 + 13, METAL[2])
            c.rect(9, y0 + 6, 22, y0 + 12, METAL[0])
            c.rect(10, y0 + 7, 21, y0 + 8, METAL[1])
            c.disc(cx, y0 + 19, 4, METAL[2])
            c.disc(cx, y0 + 19, 3, METAL[0])
            c.set(cx - 1, y0 + 18, METAL[3])
        for k in (6, 25):
            c.set(k, y0 + 2, METAL[4])
            c.set(k, y1 - 2, METAL[4])
    c.rect(11, 2, 20, 3, METAL[3])  # top handle
    c.outline(OUT_COOL)
    return c


def drum_kit():
    c = Canvas(2 * T, 2 * T)
    c.shadow(32, 62, 28, 3, 70)
    # hardware lines under the shells
    c.line(14, 14, 14, 44, METAL[3])
    c.line(50, 12, 50, 40, METAL[3])
    c.line(52, 34, 52, 56, METAL[3])
    # crash cymbals (gold)
    for cx, cy in ((13, 12), (51, 10)):
        c.ell(cx, cy, 10, 3.4, GOLD[0])
        c.ell(cx, cy - 1, 10, 3, GOLD[2])
        c.ell(cx - 2, cy - 1.6, 6, 1.4, GOLD[3])
        c.set(cx, cy - 1, GOLD[0])
    # toms
    for cx in (24, 41):
        c.rect(cx - 7, 22, cx + 7, 30, RED[1])
        c.vline(cx - 6, 22, 30, RED[3])
        c.vline(cx + 6, 22, 30, RED[0])
        c.ell(cx, 22, 8, 3.3, METAL[4])
        c.ell(cx, 22.4, 6.8, 2.6, "#f4f1ea")
        c.ell(cx - 1.5, 22, 3, 1, "#ffffff")
        c.hline(cx - 7, cx + 7, 30, METAL[3])
    # snare left, hi hat right
    c.ell(10, 44, 8, 3.4, METAL[3])
    c.rect(2, 44, 18, 49, METAL[2])
    c.ell(10, 44.2, 6.8, 2.5, "#f4f1ea")
    c.hline(2, 18, 49, METAL[1])
    c.vline(10, 50, 57, METAL[2])
    c.ell(54, 36, 7, 2.2, GOLD[1])
    c.ell(54, 35, 7, 2, GOLD[2])
    c.ell(53, 34.4, 4, .9, GOLD[3])
    # kick drum, front head with a ring logo
    c.rect(18, 36, 46, 58, RED[1])
    c.ell(32, 47, 15, 13, METAL[3])
    c.ell(32, 47, 13.6, 11.7, RED[0])
    c.ell(32, 47, 12.2, 10.6, "#f4f1ea")
    c.ell(31, 46, 11.4, 9.8, "#fffaf0")
    c.ell(32, 47, 7.2, 6, RED[2])
    c.ell(32, 47, 5.3, 4.4, "#f4f1ea")
    c.ell(32, 47, 2.1, 1.6, RED[2])
    c.ell(25, 41, 3.5, 1.4, "#ffffff")
    for k in range(8):  # lugs
        a = k * 0.785
        import math
        c.set(int(32 + 14.5 * math.cos(a)), int(47 + 12.4 * math.sin(a)), METAL[4])
    c.rect(19, 59, 45, 61, METAL[1])  # feet
    c.hline(19, 45, 59, METAL[3])
    c.outline(OUT_COOL)
    return c


def mic_stand():
    c = Canvas()
    c.shadow(16, 29, 8, 2.4, 60)
    c.line(16, 24, 9, 29, METAL[1])  # tripod
    c.line(16, 24, 23, 29, METAL[1])
    c.line(16, 24, 16, 29, METAL[2])
    c.rect(15, 9, 16, 25, METAL[3])
    c.vline(15, 9, 25, METAL[4])
    c.vline(16, 9, 25, METAL[2])
    c.rect(14, 18, 17, 19, METAL[1])  # clutch
    c.line(16, 9, 20, 5, METAL[3])
    c.rect(19, 2, 23, 6, METAL[0])  # mic
    c.rect(19, 2, 23, 3, METAL[2])
    c.set(19, 2, METAL[4])
    c.rect(19, 4, 23, 4, METAL[3])
    c.outline(OUT_COOL)
    return c


def guitar_on_stand(body, body_hi, body_lo, bass=False):
    c = Canvas(T, T)
    c.shadow(16, 29, 8, 2.4, 60)
    c.line(16, 21, 9, 29, METAL[1])  # stand legs
    c.line(16, 21, 23, 29, METAL[1])
    c.line(16, 21, 16, 29, METAL[2])
    top = 1 if bass else 3
    c.rect(15, top + 1, 17, 15, WOOD[0])  # neck
    c.vline(15, top + 1, 15, WOOD[1])
    c.rect(14, top - 1, 18, top + 3, WOOD[1])  # headstock
    c.vline(14, top - 1, top + 3, WOOD[2])
    for k in range(3):
        c.set(14 if k % 2 else 18, top + k, METAL[4])
    c.vline(16, top + 3, 15, hx("#d8d0c0"))  # strings
    c.ell(16, 22, 7, 6.2, body_lo)  # body
    c.ell(16, 17, 5, 4.3, body_lo)
    c.ell(15.4, 21.4, 6, 5.4, body)
    c.ell(15.4, 16.6, 4.2, 3.6, body)
    c.ell(13.2, 19.5, 3.2, 3.2, body_hi)
    c.rect(13, 19, 18, 20, METAL[0])  # pickups
    c.rect(13, 22, 18, 23, METAL[0])
    c.hline(13, 18, 19, METAL[3])
    c.hline(13, 18, 22, METAL[3])
    c.rect(14, 25, 18, 25, METAL[3])  # bridge
    c.outline(OUT_COOL)
    return c


def monitor_wedge():
    c = Canvas()
    c.shadow(16, 29, 11, 2.2, 60)
    c.poly([(4, 28), (28, 28), (28, 21), (22, 14), (9, 14), (4, 21)], METAL[1])
    c.poly([(9, 14), (22, 14), (28, 21), (4, 21)], METAL[2])
    c.hline(9, 22, 14, METAL[4])
    c.rect(4, 21, 28, 28, METAL[1])
    c.hline(4, 28, 21, METAL[3])
    c.rect(6, 23, 26, 26, METAL[0])
    for x in range(8, 25, 3):
        c.vline(x, 23, 26, METAL[1])
    c.vline(28, 21, 28, METAL[0])
    c.hline(4, 28, 28, METAL[0])
    c.outline(OUT_COOL)
    return c


# ---------------------------------------------------------------- crates, barrels, plants

def crate(bottles=False):
    c = Canvas()
    c.shadow(16, 29, 12, 2.4, 70)
    if bottles:
        for i, tone in enumerate(["#3a7240", "#8a4a20", "#3a7240", "#c08a22", "#8a4a20"]):
            bottle(c, 5 + i * 5, 14, 12, tone, label="#f4f1ea")
    c.rect(3, 12, 28, 29, WOOD[2])
    c.rect(3, 12, 28, 14, WOOD[3])
    c.hline(3, 28, 12, WOOD[4])
    c.hline(3, 28, 15, WOOD[0])
    for y0 in (16, 23):
        c.rect(4, y0, 27, y0 + 5, WOOD[2])
        c.hline(4, 27, y0, WOOD[3])
        c.hline(4, 27, y0 + 5, WOOD[1])
    for x in (5, 25):
        c.rect(x - 1, 13, x + 1, 28, WOOD[1])
        c.vline(x - 1, 13, 28, WOOD[2])
    c.set(5, 14, METAL[4])
    c.set(5, 27, METAL[4])
    c.set(26, 14, METAL[4])
    c.set(26, 27, METAL[4])
    c.noise(5, 16, 26, 28, [WOOD[1], WOOD[3]], .07, rng("crate" + str(bottles)))
    c.outline(OUT)
    return c


def barrel():
    c = Canvas()
    c.shadow(16, 30, 11, 2.4, 70)
    c.ell(16, 28, 10, 3, WOOD[0])
    c.rect(6, 8, 25, 28, WOOD[2])
    c.ell(16, 8, 10, 4, WOOD[3])
    c.ell(16, 8, 8, 3, WOOD[2])
    c.ell(14, 7, 5, 1.8, WOOD[3])
    c.ell(16, 28, 10, 3, WOOD[2])
    c.rect(6, 9, 25, 28, WOOD[2])
    for x in range(8, 25, 4):
        c.vline(x, 11, 27, WOOD[1])
    c.vline(7, 10, 27, WOOD[3])
    c.vline(24, 10, 27, WOOD[1])
    for y in (12, 24):  # hoops
        c.rect(6, y, 25, y + 2, METAL[2])
        c.hline(6, 25, y, METAL[4])
        c.hline(6, 25, y + 2, METAL[0])
    c.ell(16, 29, 8, 2, WOOD[1], ymin=28)
    c.outline(OUT)
    return c


def plant_big(tones=GREEN, flowers=False):
    c = Canvas(T, 2 * T)
    c.shadow(16, 61, 11, 2.6, 70)
    pot(c, 16, 60, 18, 14)
    for (cx, cy, rx, ry) in ((10, 40, 8, 10), (22, 38, 8, 11), (16, 28, 9, 12), (16, 18, 7, 10), (8, 26, 6, 8), (24, 26, 6, 8)):
        leaf(c, cx, cy, rx, ry, tones)
    for (x0, y0, x1, y1) in ((16, 44, 10, 36), (16, 44, 22, 34), (16, 44, 16, 24)):
        c.line(x0, y0, x1, y1, tones[0])
    if flowers:
        r = rng("flw")
        for _ in range(8):
            x, y = r.randrange(6, 26), r.randrange(10, 44)
            c.set(x, y, "#f2a0c0")
            c.set(x + 1, y, "#fbe07a")
    c.outline("#16301c")
    return c


def plant_small():
    c = Canvas()
    c.shadow(16, 29, 8, 2.2, 60)
    pot(c, 16, 29, 12, 10)
    for k, (cx, cy, rx, ry) in enumerate(((10, 14, 5, 7), (22, 14, 5, 7), (16, 10, 5, 8), (13, 18, 4, 4), (19, 18, 4, 4))):
        leaf(c, cx, cy, rx, ry)
    c.outline("#16301c")
    return c


# ---------------------------------------------------------------- walls: decor over the face (layer below, transparent corners ok)

def door_double(glow=True):
    c = Canvas(2 * T, 2 * T)
    c.rect(2, 4, 61, 63, WOOD[0])  # frame
    c.rect(3, 5, 60, 63, WOOD[1])
    c.hline(3, 60, 5, WOOD[3])
    for x0 in (6, 33):  # two leaves
        c.rect(x0, 8, x0 + 24, 63, WOOD[2])
        c.rect(x0, 8, x0 + 24, 9, WOOD[3])
        c.vline(x0, 8, 63, WOOD[3])
        c.vline(x0 + 24, 8, 63, WOOD[1])
        # glass pane with warm light from inside
        c.rect(x0 + 4, 12, x0 + 20, 30, WOOD[0])
        c.rect(x0 + 5, 13, x0 + 19, 29, "#ffcf72")
        c.vgrad(x0 + 5, 13, x0 + 19, 29, "#ffe9a8", "#ee9a3c")
        c.vline(x0 + 12, 13, 29, WOOD[0])
        c.hline(x0 + 5, x0 + 19, 21, WOOD[0])
        c.hline(x0 + 5, x0 + 19, 13, "#fff4d0")
        # lower panel
        c.rect(x0 + 4, 36, x0 + 20, 58, WOOD[1])
        c.hline(x0 + 4, x0 + 20, 36, WOOD[0])
        c.vline(x0 + 4, 36, 58, WOOD[0])
        c.hline(x0 + 4, x0 + 20, 58, WOOD[3])
        c.vline(x0 + 20, 36, 58, WOOD[3])
    c.rect(28, 36, 30, 38, GOLD[2])  # handles
    c.rect(33, 36, 35, 38, GOLD[2])
    c.set(28, 36, GOLD[3])
    c.set(33, 36, GOLD[3])
    c.rect(2, 62, 61, 63, STONE[1])  # threshold
    c.hline(2, 61, 62, STONE[3])
    c.rect(0, 2, 63, 4, WOOD[3])  # lintel
    c.hline(0, 63, 2, WOOD[4])
    c.hline(0, 63, 4, WOOD[0])
    c.outline(OUT)
    return c


def window_night(day=False):
    c = Canvas(2 * T, 2 * T)
    c.rect(6, 6, 57, 57, WOOD[1])
    c.rect(7, 7, 56, 56, WOOD[3])
    c.hline(7, 56, 7, WOOD[4])
    for (x0, y0) in ((10, 10), (33, 10), (10, 33), (33, 33)):
        c.rect(x0, y0, x0 + 20, y0 + 20, WOOD[0])
        if day:
            c.vgrad(x0 + 1, y0 + 1, x0 + 19, y0 + 19, "#bfe4ff", "#7fc0f0")
            c.ell(x0 + 8, y0 + 7, 5, 2.2, "#ffffff")
        else:
            c.vgrad(x0 + 1, y0 + 1, x0 + 19, y0 + 19, "#18266a", "#2c4aa0")
            for (sx, sy) in ((5, 4), (14, 9), (9, 15), (16, 3)):
                c.set(x0 + sx, y0 + sy, "#fff4c0")
        c.line(x0 + 1, y0 + 19, x0 + 8, y0 + 12, mix("#ffffff", "#7fa0e0", .6) if day else "#3a5ab8")
    c.rect(4, 56, 59, 60, STONE[3])  # sill
    c.hline(4, 59, 56, STONE[4])
    c.hline(4, 59, 60, STONE[0])
    c.outline(OUT)
    return c


def frame_portrait(variant):
    c = Canvas()
    c.rect(9, 6, 22, 25, "#1a1418")
    c.rect(10, 7, 21, 24, "#1a1418")
    c.hline(9, 22, 6, "#6a5a5a")
    c.vline(9, 6, 25, "#4a3e40")
    c.rect(11, 8, 20, 23, ["#e8dcc4", "#d8e0e8", "#ecd8c0"][variant % 3])
    # a stylised face / figure in black and white
    face = ["#3a3034", "#4a3a3c", "#2a2630"][variant % 3]
    c.ell(15.5, 14, 3.4, 4.2, face)
    c.rect(12, 19, 19, 23, face)
    if variant == 1:  # big hair
        c.ell(15.5, 12, 5, 4.5, face)
    if variant == 2:  # lightning stripe
        c.line(14, 9, 17, 15, "#e83a3a")
        c.line(17, 15, 14, 16, "#e83a3a")
    c.set(14, 13, "#e8dcc4")
    c.set(17, 13, "#e8dcc4")
    c.shadow(16, 28, 9, 1.6, 40)
    c.outline(OUT)
    return c


def frame_wide(variant=0):
    c = Canvas(2 * T, T)
    c.rect(6, 6, 57, 25, "#1a1418")
    c.hline(6, 57, 6, "#6a5a5a")
    c.vline(6, 6, 25, "#4a3e40")
    c.rect(8, 8, 55, 23, ["#2a3a6a", "#7a3a3a"][variant])
    if variant == 0:  # a night skyline poster
        c.vgrad(8, 8, 55, 23, "#2a3a6a", "#c8626a")
        for x in range(10, 54, 6):
            h = 4 + (x * 7) % 9
            c.rect(x, 23 - h, x + 4, 23, "#1a1a30")
            c.set(x + 1, 23 - h + 2, "#ffe27a")
    else:  # a gig poster
        c.rect(8, 8, 55, 23, "#7a3a3a")
        c.text(12, 10, "LIVE", "#ffe27a", 1)
        c.rect(34, 10, 52, 21, "#2a1a1e")
        c.ell(43, 16, 6, 4, "#e8b83a")
    c.shadow(32, 28, 24, 1.6, 40)
    c.outline(OUT)
    return c


def neon_sign(text="BAR", color="#ff59d6", glow="#ff59d6"):
    n = len(text)
    wpx = max(2, (n * 12 + 12 + 31) // 32) * T
    c = Canvas(wpx, T)
    tw = c.text_width(text, 2)
    c.glow(wpx / 2, 16, wpx / 2 - 2, glow, 70)
    x = (wpx - tw) // 2
    c.text(x, 8, text, mix(color, "#000000", .45), 2)
    c.text(x - 1, 7, text, mix(color, "#ffffff", .1), 2)
    c.text(x - 1, 7, text, color, 2)
    return c


def banner_cortile():
    c = Canvas(4 * T, 2 * T)
    c.rect(3, 3, 124, 60, "#2a1a1e")  # black frame behind
    c.rect(5, 5, 122, 58, "#f4efe2")  # white banner
    c.hline(5, 122, 5, "#ffffff")
    c.hline(5, 122, 58, "#c8bca0")
    c.vline(122, 5, 58, "#d8ccb0")
    ts = c.text_width("CORTILE", 2)
    c.text((128 - ts) // 2, 10, "CORTILE", "#2a2640", 2)
    c.text((128 - c.text_width("CAFE", 2)) // 2 + 10, 30, "CAFE", "#c8423f", 2)
    # the red squiggle logo on the left under the word
    for t, (x, y) in enumerate(((14, 36), (18, 33), (22, 34), (24, 38), (20, 42), (15, 43), (12, 40), (16, 38))):
        c.rect(x, y, x + 2, y + 1, "#c8423f")
    c.rect(26, 46, 100, 47, "#2a2640")
    c.outline(OUT)
    return c


def bottle_shelf(n=3):
    W = n * T
    c = Canvas(W, 2 * T)
    c.rect(2, 4, W - 3, 62, "#3a2418")  # lit niche
    c.vgrad(3, 5, W - 4, 61, "#8a5a30", "#4a2c1c")
    r = rng("shelf%d" % n)
    cols = ["#3a7240", "#8a4a20", "#c8423f", "#e8b83a", "#2f4aa0", "#f4f1ea", "#3a7240", "#a02a4a", "#5a9a4e"]
    for sy in (22, 46):
        x = 6
        while x < W - 12:
            bottle(c, x, sy, r.choice([13, 15, 17]), r.choice(cols), label="#f4f1ea" if r.random() < .6 else None)
            x += 7
        c.rect(2, sy + 1, W - 3, sy + 3, WOOD[3])
        c.hline(2, W - 3, sy + 1, WOOD[4])
        c.hline(2, W - 3, sy + 3, WOOD[0])
    c.rect(2, 4, W - 3, 5, WOOD[3])
    c.rect(2, 61, W - 3, 62, WOOD[1])
    c.outline(OUT)
    return c


def spot_light(color="#ff59d6"):
    c = Canvas()
    c.rect(14, 2, 17, 6, METAL[1])  # bracket
    c.rect(9, 7, 22, 18, METAL[1])  # can
    c.rect(9, 7, 22, 8, METAL[3])
    c.vline(9, 7, 18, METAL[2])
    c.vline(22, 8, 18, METAL[0])
    c.ell(16, 19, 7, 3.4, METAL[0])
    c.ell(16, 19.2, 5.8, 2.6, color)
    c.ell(15, 18.6, 3, 1.2, mix(color, "#ffffff", .6))
    c.glow(16, 20, 12, color, 80)
    c.outline(OUT_COOL)
    return c


def sconce(color="#ffd27a"):
    c = Canvas()
    c.rect(13, 16, 18, 20, METAL[1])
    c.ell(15.5, 12, 4.4, 5, "#ffe9a8")
    c.ell(15.5, 12, 2.5, 3.5, "#fff8d8")
    c.rect(13, 17, 18, 18, GOLD[2])
    c.glow(16, 13, 13, color, 85)
    c.outline(OUT)
    return c


def doormat():
    c = Canvas(2 * T, T)
    c.rect(4, 8, 59, 26, "#6e1a28")
    c.rect(6, 10, 57, 24, "#a02a38")
    c.hline(4, 59, 8, "#c8423f")
    c.hline(4, 59, 26, "#3e0e18")
    c.text(10, 13, "BENVENUTI"[:6], "#ffe27a", 1) if False else None
    c.rect(10, 15, 53, 19, "#c8423f")
    for x in range(10, 54, 4):
        c.set(x, 17, "#ffe27a")
    c.outline("#3e0e18")
    return c


def rug(w, h, base, accent, name="rug"):
    c = Canvas(w * T, h * T)
    W, H = w * T, h * T
    c.rect(2, 2, W - 3, H - 3, accent[0])
    c.rect(4, 4, W - 5, H - 5, accent[2])
    c.rect(7, 7, W - 8, H - 8, base[1])
    c.rect(9, 9, W - 10, H - 10, base[2])
    r = rng(name)
    for y in range(9, H - 9):
        for x in range(9, W - 9):
            if (x + y) % 7 == 0:
                c.set(x, y, base[3])
            if (x - y) % 11 == 0:
                c.set(x, y, base[0])
    for x in range(2, W - 2, 3):  # fringe
        c.set(x, 1, accent[3])
        c.set(x, H - 2, accent[3])
    c.rect(W // 2 - 6, H // 2 - 4, W // 2 + 5, H // 2 + 3, base[0])
    c.rect(W // 2 - 4, H // 2 - 2, W // 2 + 3, H // 2 + 1, accent[3])
    c.hline(2, W - 3, 2, accent[3])
    c.vline(2, 2, H - 3, accent[3])
    return c


def string_lights(kind):
    """A festoon from one tile edge to the next: the wire dips in the middle and carries three warm bulbs."""
    c = Canvas()
    pts = []
    for x in range(T):
        y = 3 + round(7 * (1 - ((x - 15.5) / 15.5) ** 2))
        pts.append((x, y))
    for x, y in pts:
        c.set(x, y, "#2a2024")
    bulbs = [(5, "#ffd27a"), (16, "#ff9a5a"), (27, "#ffe9a8")]
    for bx, tone in bulbs:
        by = pts[bx][1]
        c.glow(bx, by + 3, 7, tone, 100)
        c.rect(bx - 1, by + 1, bx, by + 2, "#2a2024")
        c.rect(bx - 1, by + 3, bx, by + 5, tone)
        c.set(bx - 1, by + 3, "#ffffff")
        c.set(bx, by + 5, mix(tone, "#a04a1a", .5))
    if kind == "l":
        c.rect(0, 1, 2, 4, METAL[2])
        c.set(0, 1, METAL[4])
    if kind == "r":
        c.rect(T - 3, 1, T - 1, 4, METAL[2])
    return c


def define(reg):
    for n in (2, 3, 4, 5, 6, 7, 8):
        reg.stamp("bar_counter_%d" % n, bar_counter(n, props=n >= 4), "objects")
    reg.stamp("bar_stool", bar_stool(), "objects")
    reg.stamp("table_round", table_round(), "objects")
    reg.stamp("table_round_red", table_round([RED[0], RED[1], RED[2], RED[3]], "tr"), "objects")
    for f in "wesn":
        reg.stamp("chair_" + f, chair(f), "objects")
    reg.stamp("amp", amp(), "objects")
    reg.stamp("speaker_stack", speaker_stack(), "objects", mask=["#", "#"])
    reg.stamp("drum_kit", drum_kit(), "objects", mask=["##", "##"])
    reg.stamp("mic_stand", mic_stand(), "objects")
    reg.stamp("guitar_stand", guitar_on_stand("#c8423f", "#ee7a6a", "#7a1e2a"), "objects")
    reg.stamp("bass_stand", guitar_on_stand("#d08a2a", "#f4c060", "#5a2a14", bass=True), "objects")
    reg.stamp("monitor_wedge", monitor_wedge(), "objects")
    reg.stamp("crate", crate(), "objects")
    reg.stamp("crate_bottles", crate(True), "objects")
    reg.stamp("barrel", barrel(), "objects")
    reg.stamp("plant_big", plant_big(), "objects", mask=[".", "#"])
    reg.stamp("plant_flowers", plant_big(flowers=True), "objects", mask=[".", "#"])
    reg.stamp("plant_small", plant_small(), "objects")
    reg.stamp("door_double", door_double(), "below")
    reg.stamp("window_night", window_night(), "below")
    reg.stamp("window_day", window_night(day=True), "below")
    for v in range(3):
        reg.stamp("frame_portrait_%d" % v, frame_portrait(v), "below")
    for v in range(2):
        reg.stamp("frame_wide_%d" % v, frame_wide(v), "below")
    reg.stamp("neon_bar", neon_sign("BAR"), "below")
    reg.stamp("banner_cortile", banner_cortile(), "below")
    reg.stamp("bottle_shelf_3", bottle_shelf(3), "below")
    reg.stamp("bottle_shelf_4", bottle_shelf(4), "below")
    reg.stamp("spot_pink", spot_light("#ff59d6"), "below")
    reg.stamp("spot_blue", spot_light("#59a0ff"), "below")
    reg.stamp("sconce", sconce(), "below")
    reg.stamp("doormat", doormat(), "below")
    reg.stamp("rug_red", rug(3, 2, RED, WOOD, "rugred"), "below")
    reg.stamp("rug_blue", rug(3, 2, BLUE, GOLD, "rugblue"), "below")
    for k in "lmr":
        reg.stamp("lights_" + k, string_lights(k), "above")
