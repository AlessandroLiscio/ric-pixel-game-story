"""Stamps of Giuggiu's flat (the living room), rebuilt from the three reference photos (shapes only, nothing copied; the sign and the
lantern are redrawn in our own pixels): a big old Bologna living room with a dark herringbone parquet, pale lilac cream walls, a wide
white window with half lowered roller shutters on the back wall (brick houses outside) with a big crystal chandelier and a red Chinese
paper lantern hanging in front of it, a tall carved walnut armoire with a brass tea trolley next to it,
a glass dining table with chrome legs and one red and one black chair, a walnut display cabinet with leaded glass carrying an old TV and
a blue pedestrian sign, a light wood open shelf, a tall window on the left wall with trees outside, and the sofas: a long burgundy
sofa bed, a cream patterned sofa with blankets, a navy two seater with a red throw (the cat's sofa) and a red bean bag pouf.

Every name starts with `giuggiu_`: the registry refuses anything else from a room module."""
import math

from PIL import Image

from tilepaint import (Canvas, T, dark, hx, light, make_ramp, mix, pxl_object, rng)

WALLC = make_ramp("#d8cbc6", 5, 3, dark_hue=285, sh=30)            # pale lilac cream plaster
PQ = make_ramp("#5e3d2a", 5, 2, dark_hue=300, sh=14)               # herringbone parquet
WAL = make_ramp("#4c2d1f", 5, 2, dark_hue=290, sh=14, lh=10)       # dark carved walnut
OAK = make_ramp("#c98c44", 5, 2)                                   # the light wood shelf
BURG = make_ramp("#932744", 5, 2, dark_hue=335, sh=16)             # burgundy sofa
NAVY = make_ramp("#34425f", 5, 2, dark_hue=250, sh=12)             # navy sofa
CRM = make_ramp("#d8d5c8", 5, 3, dark_hue=270, sh=26)              # cream sofa cover
RED = make_ramp("#d5272f", 5, 2, dark_hue=338, sh=14)              # the bright red throw
PINK = make_ramp("#d9415b", 5, 2, dark_hue=335, sh=14)             # the bean bag
BRASS = make_ramp("#a98a42", 5, 2, light_hue=55)
SKIRT = make_ramp("#e8e0d2", 5, 3, dark_hue=270, sh=26)            # cream baseboards and door frames
INK = "#2a1d22"
WHITE = "#f4f0e8"


# ---------------------------------------------------------------- helpers

def blend(c, x, y, colr, t):
    if 0 <= x < c.w and 0 <= y < c.h:
        p = c.get(x, y)
        if p[3]:
            c.set(x, y, mix(p, colr, t)[:3] + (p[3],))


def tint(c, x0, y0, x1, y1, colr, t):
    for y in range(max(0, y0), min(c.h - 1, y1) + 1):
        for x in range(max(0, x0), min(c.w - 1, x1) + 1):
            blend(c, x, y, colr, t)


def cline(c, x0, y0, x1, y1, box, colr):
    """A line clipped to the inclusive rectangle `box` (the lead of a leaded glass door must not leave the glass)."""
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        x, y = round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)
        if box[0] <= x <= box[2] and box[1] <= y <= box[3]:
            c.set(x, y, colr)


def flip(c):
    out = Canvas(c.w, c.h)
    out.im = c.im.transpose(Image.FLIP_LEFT_RIGHT)
    out.px = out.im.load()
    from PIL import ImageDraw
    out.d = ImageDraw.Draw(out.im)
    return out


def plaster(c, x0, y0, x1, y1, seed):
    """Pale lilac cream plaster with a few soft hand placed patches, never noise."""
    r = rng("giuggiu-plaster-" + seed)
    c.rect(x0, y0, x1, y1, WALLC[3])
    for _ in range(max(5, (x1 - x0) // 12)):
        x, y = r.randrange(x0, max(x0 + 1, x1 - 12)), r.randrange(y0 + 4, max(y0 + 5, y1 - 14))
        c.dither(x, y, x + r.randrange(6, 14), y + r.randrange(2, 5), WALLC[3], WALLC[4] if r.random() < .55 else WALLC[2], .25, r.randrange(2))


def skirting(c, x0, x1, y1, h=7):
    """A cream baseboard, lit on top, with a dark contact line on the floor."""
    c.rect(x0, y1 - h + 1, x1, y1, SKIRT[2])
    c.hline(x0, x1, y1 - h + 1, SKIRT[3])
    c.hline(x0, x1, y1 - h + 2, light(SKIRT[3], .3))
    c.hline(x0, x1, y1 - 2, SKIRT[1])
    c.hline(x0, x1, y1 - 1, dark(SKIRT[0], .1))
    c.hline(x0, x1, y1, dark(PQ[0], .45))


def cornice(c, x0, x1, rows=9):
    for y in range(rows):
        t = .42 * (1 - y / rows) ** 1.3
        for x in range(x0, x1 + 1):
            blend(c, x, y, (44, 26, 78), t)
    c.hline(x0, x1, 0, dark(WALLC[0], .45))


def wire(c, x, y0, y1, sway=2, colr="#2a2328"):
    """A loose cable hanging on the wall (the photos show a few)."""
    for y in range(y0, y1):
        c.set(x + round(sway * math.sin((y - y0) / 14.0)), y, colr)


# ---------------------------------------------------------------- the herringbone parquet

def herring_origins():
    return sorted({((i + 2 * j) % 8, (7 * i + 6 * j) % 8) for i in range(8) for j in range(8)})


def plank(c, x0, y0, horiz, base, seed):
    w, h = (16, 4) if horiz else (4, 16)
    c.rect(x0, y0, x0 + w - 1, y0 + h - 1, base)
    seam = mix(base, PQ[0], .5)
    if horiz:
        c.hline(x0, x0 + w - 1, y0, light(base, .07))
        c.hline(x0, x0 + w - 1, y0 + h - 1, seam)
        c.vline(x0 + w - 1, y0, y0 + h - 1, mix(base, PQ[0], .42))
        gx = x0 + 2 + seed % 6
        c.hline(gx, gx + 5, y0 + 2, mix(base, PQ[0], .14))
    else:
        c.vline(x0, y0, y0 + h - 1, light(base, .07))
        c.vline(x0 + w - 1, y0, y0 + h - 1, seam)
        c.hline(x0, x0 + w - 1, y0 + h - 1, mix(base, PQ[0], .42))
        gy = y0 + 2 + seed % 6
        c.vline(x0 + 2, gy, gy + 5, mix(base, PQ[0], .14))


def parquet(variant):
    """Dark herringbone boards, 16 x 4 px planks, seamless (the pattern repeats every 32 px). The variants add a few scuffs."""
    c = Canvas()
    tones = [PQ[1], PQ[2], mix(PQ[2], PQ[3], .3), mix(PQ[1], PQ[2], .5), PQ[2]]
    for (cx, cy) in herring_origins():
        for horiz in (True, False):
            x0, y0 = (cx * 4, cy * 4) if horiz else (((cx + 4) % 8) * 4, cy * 4)
            seed = (cx * 7 + cy * 13 + (0 if horiz else 5))
            base = tones[seed % len(tones)]
            for ox in (-32, 0, 32):
                for oy in (-32, 0, 32):
                    plank(c, x0 + ox, y0 + oy, horiz, base, seed)
    r = rng("giuggiu-parquet-%d" % variant)
    for k in range(variant * 3):
        x, y = r.randrange(3, 26), r.randrange(3, 29)
        for i in range(r.randrange(3, 6)):
            blend(c, x + i, y, "#d9b890", .13)
    if variant == 3:
        c.dither(6, 10, 20, 12, PQ[2], PQ[1], .25)
    return c


# ---------------------------------------------------------------- side walls and the doorway

def side_wall(left, kind):
    """The wall of the left (or right) side seen edge on, one tile wide. `kind`: wall, window top, mid, mid2, bottom, picture."""
    c = Canvas()
    c.rect(0, 0, 27, T - 1, WALLC[2])
    c.vline(0, 0, T - 1, WALLC[1])
    for y in range(T):                                  # soft shade toward the ceiling corner on the left
        for x in range(0, 5):
            blend(c, x, y, (44, 26, 78), .30 * (1 - x / 5))
    skirting_v(c)
    if kind.startswith("win"):
        gx0, gx1 = 6, 21
        c.rect(gx0 - 2, 0, gx1 + 2, T - 1, hx(WHITE))
        c.vline(gx0 - 2, 0, T - 1, "#ffffff")
        c.vline(gx1 + 2, 0, T - 1, "#bdb6b4")
        r = rng("giuggiu-foliage-" + kind)
        for y in range(T):
            for x in range(gx0, gx1 + 1):
                t = (y / T) * .5 + (.3 if kind == "win_top" else 0)
                c.set(x, y, mix("#e9f4cf", "#9cc66a", .25 + t * .5 if kind != "win_top" else .15))
        for _ in range(26):                              # leaves of the trees outside, light and dark
            x, y = r.randrange(gx0, gx1 - 2), r.randrange(0, T - 2)
            c.rect(x, y, x + r.randrange(1, 4), y + 1, r.choice(["#5f9a48", "#82b45a", "#bcd88a", "#3f7a3a"]))
        if kind == "win_top":
            c.rect(gx0 - 2, 0, gx1 + 2, 6, hx(WHITE))
            c.hline(gx0 - 2, gx1 + 2, 6, "#bdb6b4")
        if kind == "win_mid2":
            c.rect(gx0 - 2, 14, gx1 + 2, 17, hx(WHITE))
            c.hline(gx0 - 2, gx1 + 2, 17, "#bdb6b4")
        if kind == "win_bot":
            c.rect(gx0 - 2, 20, gx1 + 2, 22, hx(WHITE))
            c.rect(4, 22, 27, 26, "#fbf7ee")
            c.hline(4, 27, 22, "#ffffff")
            c.hline(4, 27, 26, "#a89c98")
            for x in range(6, 26):
                blend(c, x, 27, (44, 26, 78), .3)
    if kind.startswith("door"):                         # the entrance door seen edge on: a cream frame round a dark corridor, the open veneer leaf
        gx0, gx1 = 6, 21
        c.rect(gx0 - 2, 0, gx1 + 2, T - 1, SKIRT[2])
        c.vline(gx0 - 2, 0, T - 1, SKIRT[4])
        c.vline(gx1 + 2, 0, T - 1, SKIRT[0])
        c.rect(gx0, 0, gx1, T - 1, "#120d12")
        c.vgrad(gx0, 0, gx1, T - 1, "#241a22", "#0e0a10")
        if kind == "door_top":
            c.rect(gx0 - 2, 0, gx1 + 2, 6, SKIRT[2])      # the lintel
            c.hline(gx0 - 2, gx1 + 2, 0, SKIRT[4])
            c.hline(gx0, gx1, 7, "#3a2c28")
            c.rect(gx0 + 4, 12, gx0 + 9, 18, "#4a3a30")   # a little framed picture in the corridor
        else:
            c.rect(gx0, 16, gx1, 23, "#2a1e22")           # the corridor floor
            c.hline(gx0, gx1, 16, "#4a3a34")
            c.rect(gx0 - 2, 24, gx1 + 2, 28, SKIRT[1])    # the threshold
            c.hline(gx0 - 2, gx1 + 2, 24, SKIRT[4])
        c.rect(23, 0, 27, T - 1, "#b3652f")               # the open leaf of orange veneer, edge on
        c.vline(23, 0, T - 1, "#e49a52")
        c.vline(27, 0, T - 1, "#6e3a1c")
        for y in (6, 14, 22):
            c.hline(24, 26, y, "#8a4a22")
    if kind == "picture":                               # a framed picture seen edge on: a thin dark frame with a pale mat
        c.rect(5, 4, 9, 27, hx("#2a1d22"))
        c.vline(5, 4, 27, "#6a4a30")
        c.rect(7, 6, 8, 25, "#d8c8a8")
    for y in range(T):                                  # the soft shade the wall throws on the floor
        for x in range(28, T):
            c.set(x, y, (26, 12, 40, int(70 * (1 - (x - 28) / 4.0) ** 1.3)))
    if not left:
        c = flip(c)
    return c


def skirting_v(c):
    c.rect(23, 0, 27, T - 1, SKIRT[2])
    c.vline(23, 0, T - 1, SKIRT[3])
    c.vline(27, 0, T - 1, dark(PQ[0], .4))
    c.vline(26, 0, T - 1, SKIRT[1])


def doormat():
    c = Canvas(2 * T, T)
    c.rect(10, 9, 53, 25, "#6a5236")
    c.rect(12, 11, 51, 23, "#a58a5a")
    c.hline(10, 53, 9, "#c4a874")
    c.hline(10, 53, 25, "#3e2e1e")
    for x in range(14, 51, 3):
        c.vline(x, 12, 22, "#8a7044")
    c.rect(24, 15, 39, 19, "#6a5236")
    c.rect(26, 16, 37, 18, "#a58a5a")
    c.outline()
    return c


# ---------------------------------------------------------------- the three pieces of the back wall

BRICK = ["#9a4a3c", "#b05a44", "#c9765a", "#d98e6a"]


def city(c, x0, y0, x1, y1):
    """The view through the window: a pale sky and two brick houses with their windows, shutters and a balcony."""
    c.rect(x0, y0, x1, y1, "#c9d8e6")
    c.vgrad(x0, y0, x1, y1, "#d6e2ec", "#b8ccdc")
    w = x1 - x0
    # the left house: dark brick with a grid of windows
    hx0, hx1 = x0 + 4, x0 + w * 0.46
    c.rect(hx0, y0 + 14, hx1, y1, BRICK[0])
    for gy in range(y0 + 18, y1 - 4, 10):
        for gx in range(int(hx0) + 3, int(hx1) - 6, 9):
            c.rect(gx, gy, gx + 4, gy + 6, "#4a3a44")
            c.hline(gx, gx + 4, gy, "#8a8090")
            c.rect(gx + 5, gy, gx + 6, gy + 6, "#7a5a50")
    # the right house: lighter brick with a rounded corner balcony
    rx0 = x0 + w * 0.42
    c.rect(rx0, y0 + 6, x1, y1, BRICK[2])
    c.rect(rx0, y0 + 6, x1, y0 + 8, BRICK[3])
    for gy in range(y0 + 12, y1 - 4, 12):
        c.rect(rx0 + 5, gy, rx0 + 12, gy + 7, "#5a3a40")
        c.rect(rx0 + 17, gy, rx0 + 23, gy + 7, "#5a3a40")
    c.rect(rx0 - 2, y0 + 20, rx0 + 14, y0 + 23, "#e8d8c0")         # a balcony slab with its rail
    c.hline(rx0 - 2, rx0 + 14, y0 + 17, "#2a2a30")
    for k in range(int(rx0) - 1, int(rx0) + 14, 3):
        c.vline(k, y0 + 17, y0 + 20, "#2a2a30")
    c.rect(x1 - 7, y0 + 30, x1, y0 + 40, "#3a6a58")                # a green shutter
    c.vline(x1 - 7, y0 + 30, y0 + 40, "#2a4a3e")


def window_pane(c, x0, y0, x1, y1):
    c.rect(x0, y0, x1, y1, "#c9d8e6")


def wall_win():
    """x 8..13: the big white window, three sashes, the two outer ones half closed by grey roller shutters, the middle one open onto the
    brick houses of the street, a roller shutter box on top and a white sill. The chandelier and the lantern hang in front (above layer)."""
    W = 6 * T
    c = Canvas(W, 3 * T)
    plaster(c, 0, 0, W - 1, 3 * T - 1, "win")
    fx0, fx1, fy0, fy1 = 22, W - 23, 18, 83
    city(c, fx0, fy0, fx1, fy1)
    # roller shutters on the outer sashes, lowered about half way: grey slats with a bar at the bottom
    for (sx0, sx1) in ((fx0 + 4, fx0 + 44), (fx1 - 44, fx1 - 4)):
        for y in range(fy0 + 1, fy0 + 36):
            tone = "#8c898e" if (y - fy0) % 3 else "#6a676e"
            c.hline(sx0, sx1, y, tone)
        c.hline(sx0, sx1, fy0 + 1, "#b4b1b6")
        c.rect(sx0, fy0 + 36, sx1, fy0 + 38, "#4a474e")
        c.hline(sx0, sx1, fy0 + 36, "#7a777e")
        c.rect((sx0 + sx1) // 2 - 2, fy0 + 39, (sx0 + sx1) // 2 + 2, fy0 + 41, "#2e2c32")   # the pull strap
        for y in range(fy0 + 39, fy0 + 52):                # soft shade the blind throws on the glass below it
            blend(c, sx0, y, (44, 26, 78), 0)
            for x in range(sx0, sx1 + 1):
                blend(c, x, y, (44, 26, 78), .22 * (1 - (y - fy0 - 39) / 13))
    # white frame: outer ring, two mullions, a lit top left edge
    fr, fr_hi, fr_lo = hx(WHITE), hx("#ffffff"), hx("#b9b1b3")
    c.rect(fx0 - 4, fy0 - 3, fx1 + 4, fy0 + 1, fr)             # top rail
    c.rect(fx0 - 4, fy1 - 1, fx1 + 4, fy1 + 3, fr)             # bottom rail
    c.rect(fx0 - 4, fy0 - 3, fx0, fy1 + 3, fr)
    c.rect(fx1, fy0 - 3, fx1 + 4, fy1 + 3, fr)
    for mx in ((fx0 + fx1) // 2 - 25, (fx0 + fx1) // 2 + 23):
        c.rect(mx - 2, fy0, mx + 2, fy1, fr)
        c.vline(mx - 2, fy0, fy1, fr_hi)
        c.vline(mx + 2, fy0, fy1, fr_lo)
    c.hline(fx0 - 4, fx1 + 4, fy0 - 3, fr_hi)
    c.vline(fx0 - 4, fy0 - 3, fy1 + 3, fr_hi)
    c.hline(fx0 - 4, fx1 + 4, fy1 + 3, fr_lo)
    c.vline(fx1 + 4, fy0 - 3, fy1 + 3, fr_lo)
    c.hline(fx0, fx1, fy0 + 2, fr_lo)
    c.hline(fx0, fx1, fy1 - 2, fr_lo)
    # the roller shutter box above the window (a beige plastic box) and the rod
    c.rect(fx0 - 8, 6, fx1 + 8, fy0 - 4, "#cdbf98")
    c.hline(fx0 - 8, fx1 + 8, 6, "#eadcb4")
    c.hline(fx0 - 8, fx1 + 8, fy0 - 4, "#8a7c5a")
    c.vline(fx0 - 8, 6, fy0 - 4, "#a8996e")
    for x in range(fx0 - 2, fx1, 26):
        c.vline(x, 8, fy0 - 6, "#b5a77f")
    c.rect(fx0 - 12, 3, fx1 + 12, 4, "#4a3a30")                # a thin curtain rod over the box
    c.hline(fx0 - 12, fx1 + 12, 3, "#8a7a60")
    # the white sill with its shadow
    c.rect(fx0 - 9, fy1 + 3, fx1 + 9, fy1 + 7, "#fbf7ee")
    c.hline(fx0 - 9, fx1 + 9, fy1 + 3, "#ffffff")
    c.hline(fx0 - 9, fx1 + 9, fy1 + 7, "#a89c98")
    for y in range(fy1 + 8, fy1 + 15):
        for x in range(fx0 - 9, fx1 + 10):
            blend(c, x, y, (44, 26, 78), .28 * (1 - (y - fy1 - 8) / 7))
    c.rect(fx0 - 4, fy1 + 8, fx0 - 2, fy1 + 11, "#a89c98")
    wire(c, fx1 + 26, 0, 80, 1, "#3a3238")                     # the thin cord on the right of the window
    skirting(c, 0, W - 1, 3 * T - 1)
    cornice(c, 0, W - 1)
    return c


def frame_landscape(c, x, y, w, h):
    """The big gilded frame with a landscape painting (green hills, a sky) that hangs on the left of the room."""
    c.rect(x, y, x + w - 1, y + h - 1, "#8a6a2a")
    c.hline(x, x + w - 1, y, "#e8c860")
    c.vline(x, y, y + h - 1, "#d4a840")
    c.vline(x + w - 1, y, y + h - 1, "#5a4218")
    c.hline(x, x + w - 1, y + h - 1, "#5a4218")
    c.rect(x + 3, y + 3, x + w - 4, y + h - 4, "#a8c0cc")
    c.vgrad(x + 3, y + 3, x + w - 4, y + h - 4, "#cfdde4", "#8aa8b8")
    c.ell(x + w * .3, y + h * .78, w * .34, h * .26, "#4a7a40")
    c.ell(x + w * .72, y + h * .82, w * .38, h * .24, "#3a6a38")
    c.rect(x + 3, y + int(h * .84), x + w - 4, y + h - 4, "#2f5a30")
    c.ell(x + w * .6, y + h * .3, 5, 2.4, "#f0f0ea")


def wall_left():
    """x 1..7: the left end of the back wall: a gilded landscape over the trolley, the loose cables, the socket."""
    W = 7 * T
    c = Canvas(W, 3 * T)
    plaster(c, 0, 0, W - 1, 3 * T - 1, "left")
    for y in range(3 * T):                                   # the corner shade on the far left
        for x in range(0, 26):
            blend(c, x, y, (44, 26, 78), .28 * (1 - x / 26))
    frame_landscape(c, 116, 22, 38, 34)
    wire(c, 10, 0, 74, 2, "#2a2328")
    wire(c, 14, 0, 60, -2, "#a86a3a")
    c.rect(168, 66, 173, 71, "#e8e0d0")                       # a wall socket
    c.rect(169, 67, 172, 70, "#2a2328")
    skirting(c, 0, W - 1, 3 * T - 1)
    cornice(c, 0, W - 1)
    return c


def wall_right():
    """x 14..20: the right end of the back wall: plain plaster behind the cabinet and the shelf, a thin cord and a light switch."""
    W = 7 * T
    c = Canvas(W, 3 * T)
    plaster(c, 0, 0, W - 1, 3 * T - 1, "right")
    for y in range(3 * T):
        for x in range(W - 26, W):
            blend(c, x, y, (44, 26, 78), .26 * ((x - (W - 26)) / 26))
    wire(c, 4, 0, 72, 1, "#3a3238")
    c.rect(40, 18, 69, 55, "#16121a")                          # a big framed black and white picture
    c.vline(40, 18, 55, "#4a4048")
    c.hline(40, 69, 18, "#4a4048")
    c.rect(43, 21, 66, 52, "#d8d4c8")
    c.ell(55, 34, 6, 8, "#6a6670")
    c.ell(55, 29, 7, 5, "#3a363e")
    c.rect(47, 41, 63, 52, "#4a464e")
    c.rect(100, 56, 104, 63, "#e8e0d0")
    c.rect(101, 57, 103, 60, "#cfc6b8")
    skirting(c, 0, W - 1, 3 * T - 1)
    cornice(c, 0, W - 1)
    return c


# ---------------------------------------------------------------- tall furniture against the back wall

def armoire():
    """The tall carved walnut armoire in the left corner: an arched cornice, one big door with a glass panel above and a raised panel
    below, twisted columns on its sides, with a bicycle frame left on top."""
    c = Canvas(2 * T, 4 * T)
    H = 4 * T
    c.shadow(33, H - 2, 29, 3, 80)
    x0, x1 = 7, 57
    c.rect(x0, 38, x1, H - 10, WAL[2])                      # body
    c.rect(x0, 38, x0 + 3, H - 10, WAL[3])
    c.rect(x1 - 3, 38, x1, H - 10, WAL[1])
    for yy in range(40, H - 12, 4):                           # twisted columns: short diagonal light and dark strokes
        for (cx_) in (x0 + 1, x1 - 2):
            c.hline(cx_, cx_ + 1, yy, WAL[4])
            c.hline(cx_ - 1, cx_, yy + 2, WAL[0])
    c.rect(x0 - 2, 30, x1 + 2, 37, WAL[3])                   # cornice
    c.hline(x0 - 2, x1 + 2, 30, WAL[4])
    c.hline(x0 - 2, x1 + 2, 37, WAL[0])
    c.ell(32, 30, 20, 7, WAL[2], ymax=30)                    # the arched pediment
    c.ell(32, 30, 20, 7, WAL[3], ymax=26)
    c.hline(14, 50, 31, WAL[1])
    for fx in (x0 - 1, x1 + 1):                               # finials
        c.disc(fx, 28, 2.2, WAL[3])
        c.set(fx - 1, 27, WAL[4])
    c.rect(x0 + 6, H - 10, x1 - 6, H - 6, WAL[1])             # plinth
    c.rect(x0 + 2, H - 6, x0 + 6, H - 3, WAL[0])              # feet
    c.rect(x1 - 6, H - 6, x1 - 2, H - 3, WAL[0])
    # the door: glass above, raised panel below
    c.rect(13, 42, 51, 80, WAL[1])
    c.rect(16, 45, 48, 77, "#1a1319")
    c.vgrad(16, 45, 48, 77, "#2a2230", "#171117")
    for k in range(14):                                       # a diagonal reflection of the window on the glass
        c.line(20 + k, 77, 34 + k, 46, "#4e4a5a")
    c.hline(16, 48, 45, "#5a5060")
    c.vline(16, 45, 77, "#463e52")
    c.rect(13, 83, 51, H - 14, WAL[1])
    c.rect(16, 86, 48, H - 17, WAL[2])
    c.hline(16, 48, 86, WAL[4])
    c.vline(16, 86, H - 17, WAL[3])
    c.hline(16, 48, H - 17, WAL[0])
    c.vline(48, 87, H - 17, WAL[0])
    c.poly([(32, 92), (42, 100), (32, 108), (22, 100)], WAL[3])
    c.poly([(32, 95), (39, 100), (32, 105), (25, 100)], WAL[2])
    c.rect(46, 80, 47, 83, BRASS[3])                          # the keyhole plate
    # the bicycle frame and a rope on top of the armoire
    for (a, b, d, e) in ((12, 26, 26, 8), (26, 8, 38, 24), (12, 26, 38, 24), (26, 8, 34, 6), (20, 17, 36, 17)):
        c.line(a, b, d, e, "#2a2024")
    ring_c = (47, 17)
    for k in range(40):
        a = k * math.pi / 20
        c.set(ring_c[0] + 8 * math.cos(a), ring_c[1] + 8 * math.sin(a), "#2a2024")
    c.set(34, 6, "#c8602a")
    c.line(8, 29, 14, 22, "#c8602a")
    c.outline()
    return c


def trolley():
    """The brass tea trolley with two glass shelves: a curved handle, four posts, wheels, a few papers on the top shelf."""
    c = Canvas(2 * T, 2 * T)
    c.shadow(33, 62, 26, 2.4, 66)
    br = BRASS
    for (px, ph) in ((9, 0), (56, 0)):
        c.rect(px, 22, px + 1, 58, br[2])                      # posts
        c.vline(px, 22, 58, br[3])
    for sy in (24, 44):                                        # two glass shelves with brass rims
        c.rect(9, sy - 3, 57, sy, hx("#bfe6ea", 110))
        c.hline(9, 57, sy - 3, hx("#eefcff", 200))
        c.rect(9, sy, 57, sy + 1, br[2])
        c.hline(9, 57, sy, br[4])
        c.vline(9, sy - 3, sy + 1, br[3])
    c.rect(9, 56, 57, 58, br[2])                               # the lower rail
    c.hline(9, 57, 56, br[3])
    for wx in (9, 56):
        c.disc(wx, 60, 2.2, "#2a2024")
        c.set(wx, 59, "#6a5a58")
    for k in range(13):                                        # the handle: a curved bar
        yy = 22 - int(14 * math.sin(k / 12 * math.pi / 2 + .0))
        c.set(9 - k * .1 + k, 22 - int(12 * (1 - (1 - k / 12) ** 2)), br[3])
    c.hline(9, 22, 9, br[3])
    c.vline(9, 9, 22, br[3])
    c.rect(14, 17, 26, 22, "#f1ece0")                          # a few papers on the top shelf
    c.hline(14, 26, 17, "#ffffff")
    c.hline(14, 26, 21, "#b8b0a2")
    c.rect(30, 19, 36, 22, "#3a5a78")
    c.hline(30, 36, 19, "#6a8aa8")
    c.rect(44, 38, 52, 43, "#e8e0d0")                          # a cloth on the lower shelf
    c.hline(44, 52, 38, "#ffffff")
    c.outline()
    return c


def vitrine():
    """The big walnut display cabinet on claw feet, with leaded glass doors and drawers, framed pictures standing on top, a blue
    pedestrian sign leaning on it and a green white and red scarf hanging from the cornice."""
    c = Canvas(3 * T, 4 * T)
    H = 4 * T
    c.shadow(48, H - 2, 42, 3, 80)
    x0, x1 = 6, 89
    c.rect(x0, 44, x1, H - 12, WAL[2])
    c.rect(x0, 44, x0 + 3, H - 12, WAL[3])
    c.rect(x1 - 3, 44, x1, H - 12, WAL[1])
    c.vline(x1, 44, H - 12, WAL[0])
    c.rect(x0 - 3, 36, x1 + 3, 44, WAL[3])                    # cornice and carved crest
    c.hline(x0 - 3, x1 + 3, 36, WAL[4])
    c.hline(x0 - 3, x1 + 3, 44, WAL[0])
    c.rect(34, 30, 62, 36, WAL[3])
    c.hline(34, 62, 30, WAL[4])
    c.ell(48, 36, 14, 5, WAL[3], ymax=33)
    for (dx0, dx1) in ((11, 46), (50, 85)):                    # the two leaded glass doors
        c.rect(dx0, 49, dx1, 100, WAL[1])
        c.rect(dx0 + 3, 52, dx1 - 3, 97, "#1c2630")
        c.vgrad(dx0 + 3, 52, dx1 - 3, 97, "#31485a", "#1a2230")
        box = (dx0 + 3, 52, dx1 - 3, 97)
        for k in range(-60, 80, 9):                           # the lead lattice, clipped to the glass
            cline(c, dx0 + 3 + k, 52, dx0 + 3 + k + 46, 98, box, "#5a7a88")
            cline(c, dx0 + 3 + k + 46, 52, dx0 + 3 + k, 98, box, "#4a6874")
        tint(c, dx0 + 3, 52, dx1 - 3, 97, "#8ac0a8", .12)
        for (px_, py_) in ((dx0 + 9, 60), (dx0 + 20, 72), (dx1 - 12, 66), (dx1 - 18, 88)):   # a few pale panes catching the light
            c.rect(px_, py_, px_ + 3, py_ + 3, "#9ac4c8")
        c.hline(dx0 + 3, dx1 - 3, 52, "#6a8a96")
        c.rect(dx1 - 4, 74, dx1 - 3, 80, BRASS[3])
    c.vline(48, 49, 100, WAL[0])
    c.rect(x0 + 2, 102, x1 - 2, H - 16, WAL[2])               # the two drawers
    c.hline(x0 + 2, x1 - 2, 102, WAL[4])
    c.hline(x0 + 2, x1 - 2, 111, WAL[0])
    c.vline(48, 103, H - 16, WAL[0])
    for hx_ in (30, 66):
        c.rect(hx_, 105, hx_ + 6, 107, BRASS[3])
        c.hline(hx_, hx_ + 6, 105, BRASS[4])
    c.rect(x0 + 2, H - 12, x1 - 2, H - 8, WAL[1])
    for fx in (x0 + 4, x1 - 10):                              # lion paw feet
        c.rect(fx, H - 8, fx + 6, H - 3, WAL[2])
        c.rect(fx - 1, H - 4, fx + 7, H - 2, WAL[0])
        c.set(fx + 2, H - 4, WAL[3])
    # the framed pictures standing on top (the plan: "mobile con sopra quadri"): a big gilded landscape and a small dark portrait
    frame_landscape(c, 36, 6, 34, 27)
    c.rect(72, 12, 84, 33, "#2a1d22")
    c.rect(73, 13, 83, 32, "#6a4a30")
    c.rect(75, 15, 81, 30, "#d8c8a8")
    c.ell(78, 21, 2.4, 3, "#5a4030")
    c.rect(75, 26, 81, 30, "#3a4a5a")
    # the blue sign: a square with a white circle and a walking person, two bars of text under it (our own drawing)
    c.rect(5, 6, 31, 36, "#16348a")
    c.rect(6, 7, 30, 35, "#2850b8")
    c.hline(6, 30, 7, "#5a80e0")
    c.disc(18, 17, 8, "#f4f4f0")
    c.disc(18, 17, 6.6, "#2850b8")
    c.disc(18, 12, 1.8, "#f4f4f0")                            # the walker's head, body, legs and a stride
    c.line(18, 14, 18, 19, "#f4f4f0")
    c.line(18, 19, 15, 23, "#f4f4f0")
    c.line(18, 19, 21, 23, "#f4f4f0")
    c.line(18, 15, 21, 17, "#f4f4f0")
    c.hline(10, 26, 28, "#f4f4f0")
    c.hline(12, 24, 31, "#f4f4f0")
    # the tricolour scarf hanging over the right corner of the cornice
    for k, tone in enumerate(("#2e9a4a", "#f0f0e8", "#c8282e")):
        c.rect(x1 - 8 + k * 3, 32, x1 - 6 + k * 3, 46, tone)
    c.outline()
    return c


def shelf_east():
    """The light oak open shelf along the right wall, 1 tile wide and 4 tall, seen from above and from its open side: the lit top plank
    on the right, and on the left the dark cubbies between oak dividers with a spray can, a picture, papers and the white sports bag
    in them."""
    H = 4 * T
    c = Canvas(T, H)
    c.shadow(16, H / 2, 14, H / 2 - 4, 66, dx=-2)
    x0, x1, y0, y1 = 3, 30, 5, H - 8
    c.rect(x0, y0, x1, y1, OAK[2])                              # the top plank, seen from above
    c.rect(x0, y0, x1, y0 + 1, OAK[4])
    c.vline(x0 + 9, y0, y1, OAK[3])
    c.vline(x1, y0, y1, OAK[0])
    for gy in range(y0 + 6, y1, 11):                            # the grain of the top
        c.hline(x0 + 12, x0 + 20 + (gy % 5), gy, OAK[1])
    c.rect(x0 + 9, y1 + 1, x1, y1 + 5, OAK[1])                  # the end panel, in front
    c.hline(x0 + 9, x1, y1 + 1, OAK[3])
    c.hline(x0 + 9, x1, y1 + 5, OAK[0])
    c.rect(x0, y0, x0 + 8, y1, "#2a1a10")                       # the open side: dark cubbies between oak dividers
    c.vline(x0, y0, y1, OAK[3])
    n = 6
    for i in range(n + 1):
        dy = y0 + (y1 - y0) * i // n
        c.rect(x0, dy, x0 + 8, dy + 1, OAK[2])
        c.hline(x0, x0 + 8, dy, OAK[4])
    cell = (y1 - y0) // n
    c.rect(x0 + 1, y0 + 2 * cell + 4, x0 + 7, y0 + 3 * cell - 1, "#f2f2f2")     # the white sports bag
    c.rect(x0 + 3, y0 + 2 * cell + 2, x0 + 4, y0 + 2 * cell + 4, "#2a2a32")
    c.rect(x0 + 2, y0 + 3 * cell + 5, x0 + 4, y0 + 4 * cell - 1, "#c8302c")      # a spray can
    c.rect(x0 + 5, y0 + 3 * cell + 6, x0 + 7, y0 + 4 * cell - 1, "#e8dcb4")
    c.rect(x0 + 1, y0 + cell + 5, x0 + 7, y0 + 2 * cell - 1, "#8a6a40")         # a picture frame
    c.rect(x0 + 1, y0 + 5, x0 + 7, y0 + cell - 1, "#e4dccc")                    # papers
    c.rect(x0 + 2, y0 + 4 * cell + 5, x0 + 6, y0 + 5 * cell - 1, "#4a6a90")     # books
    c.rect(x0 + 1, y0 + 5 * cell + 5, x0 + 7, y1 - 1, "#c8b890")                # a box
    for fy in (y0 + 3, y1 - 2):
        c.rect(x0 + 10, fy, x0 + 12, fy + 2, OAK[0])
    c.outline()
    return c


# ---------------------------------------------------------------- the table and the chairs

def glass_table(n=4):
    """The glass top dining table with chrome legs, n tiles wide: a see-through top, a laptop and a bottle on it, the frame showing
    underneath."""
    W = n * T
    c = Canvas(W, 2 * T)
    c.shadow(W / 2 + 2, 60, W / 2 - 8, 3, 70)
    ch = ("#58606c", "#8a93a2", "#c0c8d4", "#eef2f6")
    for lx in (10, W - 14):                                     # chrome legs, front ones taller in the picture
        c.rect(lx, 40, lx + 2, 58, ch[2])
        c.vline(lx, 40, 58, ch[3])
        c.vline(lx + 2, 40, 58, ch[0])
    c.rect(30, 54, W - 34, 57, ch[1])                           # the lower runners
    c.hline(30, W - 34, 54, ch[3])
    c.rect(36, 36, W - 36, 40, ch[1])                           # the frame under the glass
    c.hline(36, W - 36, 36, ch[3])
    # the glass: a pale cool top at low alpha so the floor shows through, white edges, glints and the window reflected in it
    c.rect(4, 8, W - 5, 38, (196, 230, 236, 150))
    c.poly([(W // 2 - 4, 9), (W // 2 + 28, 9), (W // 2 + 18, 37), (W // 2 - 14, 37)], (232, 244, 250, 120))
    c.poly([(W // 2 + 34, 9), (W // 2 + 46, 9), (W // 2 + 40, 37), (W // 2 + 28, 37)], (170, 212, 222, 120))
    c.rect(4, 8, W - 5, 9, (250, 254, 255, 240))
    c.vline(4, 8, 38, (250, 254, 255, 230))
    c.hline(4, W - 5, 38, (150, 196, 206, 240))
    c.rect(4, 39, W - 5, 42, (110, 176, 190, 245))             # the edge of the glass: a green cyan band
    c.hline(4, W - 5, 39, (200, 240, 242, 250))
    c.vline(W - 5, 8, 42, (150, 196, 206, 240))
    for k in range(10):
        c.set(50 + k, 34 - k * 2, (255, 255, 255, 200))
        c.set(51 + k, 34 - k * 2, (255, 255, 255, 110))
    for k in range(6):
        c.set(W - 30 + k, 30 - k * 3, (255, 255, 255, 170))
    # the laptop (open, silver) and a water bottle
    c.rect(14, 12, 34, 24, "#a0a8b4")
    c.rect(16, 14, 32, 22, "#2a3a58")
    c.hline(16, 32, 14, "#5a7ab0")
    c.rect(12, 25, 36, 28, "#d8dde4")
    c.hline(12, 36, 25, "#ffffff")
    c.hline(12, 36, 28, "#7a8290")
    c.rect(W - 28, 18, W - 24, 28, "#cde8f2")
    c.rect(W - 27, 15, W - 25, 18, "#2a58c8")
    c.vline(W - 28, 18, 28, "#ffffff")
    c.hline(W - 28, W - 24, 28, "#7aa0b4")
    c.outline()
    return c


def chair_red():
    """The red plastic chair with chrome legs, facing east (the back is on its left)."""
    c = Canvas()
    c.shadow(16, 29, 12, 2.6, 66)
    for (lx, ly0, ly1) in ((6, 24, 30), (24, 24, 30), (9, 22, 28)):
        c.rect(lx, ly0, lx + 1, ly1, "#aab2c0")
        c.vline(lx, ly0, ly1, "#eef2f6")
    c.rect(4, 1, 8, 24, RED[2])                                 # back
    c.vline(4, 1, 24, RED[3])
    c.vline(8, 2, 24, RED[0])
    c.hline(4, 8, 1, RED[4])
    c.rect(5, 14, 27, 25, RED[2])                               # seat
    c.hline(5, 27, 14, RED[4])
    c.hline(5, 27, 15, RED[3])
    c.hline(5, 27, 25, RED[0])
    c.vline(27, 16, 25, RED[1])
    c.outline()
    return c


def chair_black():
    """The black chair with a slatted back, facing west (the back is on its right)."""
    c = Canvas()
    c.shadow(16, 29, 12, 2.6, 66)
    d = Canvas()
    for (lx, ly0, ly1) in ((6, 24, 30), (24, 24, 30), (22, 22, 28)):
        d.rect(lx, ly0, lx + 1, ly1, "#8a93a2")
        d.vline(lx, ly0, ly1, "#c8d0dc")
    d.rect(23, 1, 27, 24, "#26262e")                           # back with slots
    d.vline(23, 1, 24, "#4a4a58")
    d.hline(23, 27, 1, "#6a6a78")
    for sy in (5, 9, 13, 17):
        d.rect(24, sy, 26, sy + 1, "#0c0c10")
    d.rect(4, 14, 27, 25, "#2a2a32")                           # seat
    d.hline(4, 27, 14, "#6a6a78")
    d.hline(4, 27, 15, "#4a4a56")
    d.hline(4, 27, 25, "#101016")
    d.vline(4, 16, 25, "#34343e")
    c.blit(d)
    c.outline()
    return c


# ---------------------------------------------------------------- sofas and the pouf

def throw_stripes(c, x0, y0, x1, y1, ramp):
    """The ribbed cloth of a throw: fine lines in two tones."""
    fills = {col_ for col_ in (hx(ramp[2]), hx(ramp[3]))}
    for x in range(x0, x1 + 1, 3):
        for y in range(y0, y1 + 1):
            if c.get(x, y) in fills:                       # only on the cloth itself, never on what lies under it
                c.set(x, y, mix(c.get(x, y), ramp[1], .45))


def sofa_west(rows, R, seat_tone, back_tone, cover=None):
    """A sofa against the left wall facing east, seen from the front and above: a tall back on the left, the seat cushions, an arm at
    each end. `cover` adds the things lying on it."""
    c = Canvas(2 * T, rows * T)
    H = rows * T
    c.shadow(56, H / 2 + 2, 6, H / 2 - 6, 70, dx=0)
    x0, x1 = 3, 58

    def pillow(xa, ya, xb, yb, tone, r=4, top=True):
        """A soft cushion: rounded, lit on its top left, shaded on its bottom right, with a crease."""
        c.round_rect(xa, ya, xb, yb, R[0], r)
        c.round_rect(xa + 1, ya + 1, xb - 1, yb - 1, tone, max(1, r - 1))
        c.hline(xa + r, xb - r, ya + 1, light(tone, .26))
        c.vline(xa + 1, ya + r, yb - r, light(tone, .14))
        c.hline(xa + r, xb - r, yb - 1, dark(tone, .22))
        c.vline(xb - 1, ya + r, yb - r, dark(tone, .16))

    c.rect(x0 + 2, 8, x1 - 2, H - 7, R[0])                       # the frame in shadow, seen in the gaps
    n = max(2, (H - 38) // 28)
    span = H - 34
    for i in range(n):                                           # the back cushions, one per seat
        ya = 17 + span * i // n
        yb = 16 + span * (i + 1) // n
        pillow(x0, ya, 21, yb, back_tone, 5)
        c.hline(x0 + 5, 16, (ya + yb) // 2, dark(back_tone, .3))
    for i in range(n):                                           # the seat cushions
        ya = 17 + span * i // n
        yb = 16 + span * (i + 1) // n
        pillow(23, ya, x1 - 2, yb, seat_tone, 5)
        c.hline(28, x1 - 8, (ya + yb) // 2 + 1, dark(seat_tone, .12))
    pillow(x0, 5, x1, 18, R[3], 5)                               # the north arm, a rolled bolster
    c.hline(x0 + 6, x1 - 6, 8, light(R[3], .35))
    pillow(x0, H - 22, x1, H - 5, R[3], 6)                       # the south arm, taller because it is the nearest
    c.hline(x0 + 6, x1 - 6, H - 19, light(R[3], .35))
    c.rect(x0 + 4, H - 9, x1 - 4, H - 7, R[1])
    c.rect(x1 + 1, H - 9, x1 + 2, H - 5, "#2a2024")              # the foot
    c.rect(x0 + 1, H - 5, x0 + 3, H - 3, "#2a2024")
    if cover:
        cover(c, H)
    c.outline()
    return c


def cream_cover(c, H):
    for (px_, py_) in ((30, 28), (44, 60), (28, 76), (50, 30)):    # the embroidered swirls of the cover
        c.ell(px_, py_, 5, 3, CRM[4])
        c.ell(px_, py_, 3, 1.4, CRM[2])
    c.poly([(24, 44), (52, 40), (56, 64), (28, 70)], "#f4f1e8")     # the white blanket thrown on the seat
    c.line(24, 44, 52, 40, "#ffffff")
    c.line(28, 70, 56, 64, "#bdb8aa")
    c.line(34, 50, 50, 48, "#dcd8cc")
    c.line(32, 60, 48, 58, "#dcd8cc")
    c.rect(5, 6, 30, 15, RED[1])                                    # a red blanket over the north arm
    c.hline(5, 30, 6, RED[3])
    c.hline(5, 30, 15, RED[0])
    c.rect(9, H - 34, 20, H - 22, BURG[1])                          # a burgundy cushion
    c.hline(9, 20, H - 34, BURG[3])
    c.round_rect(30, 20, 50, 31, "#1c1c24", 3)                      # a black laptop bag on the seat by the arm
    c.round_rect(31, 21, 49, 30, "#3a3a46", 2)
    c.hline(33, 47, 22, "#5e5e6c")
    c.hline(31, 49, 26, "#22222a")
    c.rect(38, 19, 42, 20, "#14141a")
    c.set(40, 27, "#c8c8d0")


def beanbag():
    """The red bean bag pouf: a slumped sack with a gathered top and soft wrinkles."""
    c = Canvas()
    c.shadow(16, 28, 13, 3, 76)
    c.ell(16, 19, 13, 10.5, PINK[2])
    c.ell(15, 17, 11, 8, PINK[3])
    c.ell(13, 14, 5, 3, PINK[4])
    c.ell(17, 10, 6, 3.6, PINK[2])                               # the gathered top, with a small crown
    c.ell(16, 9, 3.6, 2.2, PINK[3])
    c.poly([(11, 11), (21, 11), (20, 14), (12, 14)], PINK[1])
    for (a, b, d, e) in ((7, 17, 12, 21), (24, 17, 20, 21), (13, 22, 19, 22), (10, 14, 14, 17), (22, 14, 19, 16)):
        c.line(a, b, d, e, PINK[1])
    c.hline(5, 27, 28, PINK[0])
    c.outline()
    return c


def navy_cover(c, H):
    """The navy sofa against the right wall (drawn facing west, then mirrored): a burgundy cushion on the north seat, the red ribbed
    throw over the middle seat where the cat sleeps, the remote control on the south seat."""
    c.round_rect(24, 18, 38, 32, "#3a0f1c", 4)                       # the burgundy cushion
    c.round_rect(25, 19, 37, 31, BURG[3], 3)
    c.hline(28, 34, 20, light(BURG[3], .3))
    c.poly([(23, 36), (54, 33), (57, 60), (27, 62)], RED[2])         # the throw, rumpled over the middle seat
    c.poly([(30, 35), (54, 33), (56, 50), (32, 48)], RED[3])
    c.line(23, 36, 54, 33, RED[4])
    c.line(27, 62, 57, 60, RED[0])
    throw_stripes(c, 25, 36, 56, 60, RED)
    c.line(26, 46, 50, 44, RED[0])
    c.rect(40, 68, 48, 72, "#14141a")                                # the remote control
    for k in range(3):
        c.set(41 + k * 2, 70, "#c84040" if k == 0 else "#6a6a78")


def sofa_east(rows, R, cover):
    """A sofa against the right wall facing west: the left wall version mirrored."""
    return flip(sofa_west(rows, R, R[3], R[2], cover))


# ---------------------------------------------------------------- hanging pieces (drawn above everyone)

def chandelier():
    """The big crystal chandelier: a chain and a rose at the ceiling, a brass stem with a vase, curling arms with candle bulbs, and a
    cloud of hanging glass drops. 6 tiles wide and 3 tall, drawn over everything."""
    c = Canvas(6 * T, 3 * T)
    cx = 96
    br = BRASS
    glass = ("#7f9f9e", "#b4d4d2", "#e6f4f0", "#ffffff")

    def drop(x, y, h=8, w=2):
        """A faceted glass drop hanging from (x, y): a thin diamond with a bright facet and a dark tip."""
        c.poly([(x, y), (x + w, y + h // 2), (x, y + h), (x - w, y + h // 2)], glass[1])
        c.poly([(x, y + 1), (x - w + 1, y + h // 2), (x, y + h - 1)], glass[2])
        c.set(x - 1, y + h // 2 - 1, glass[3])
        c.set(x, y + h, glass[0])

    for y in range(0, 12):                                         # chain and ceiling rose
        c.set(cx, y, br[2])
        c.set(cx - 1, y, br[3] if y % 2 else br[1])
    c.ell(cx, 2, 7, 2.8, br[2])
    c.hline(cx - 6, cx + 6, 1, br[4])
    c.ell(cx, 18, 5, 6, br[2])                                     # the brass stem: a vase shape and a ball
    c.ell(cx - 1, 17, 2, 4, br[3])
    c.ell(cx, 30, 7, 4.4, br[2])
    c.ell(cx - 2, 29, 3, 2, br[4])
    c.vline(cx, 34, 80, br[1])
    # the arms: six brass S curves that swing out and up to a candle cup, drops hanging under every cup
    for (sgn, reach, up) in ((-1, 88, 6), (1, 88, 6), (-1, 60, 4), (1, 60, 4), (-1, 32, 2), (1, 32, 2)):
        ex = cx + sgn * reach
        ey = 36 - up
        for k in range(0, 131):
            f = k / 130
            x = cx + sgn * reach * f
            y = 31 + (ey - 31) * (f ** 2) + 12 * math.sin(f * math.pi) * (1 if reach > 30 else .6)
            c.set(x, y - 1, br[3])
            c.set(x, y, br[2])
            c.set(x, y + 1, br[0])
        c.rect(ex - 3, ey - 1, ex + 3, ey + 1, br[3])               # the candle cup
        c.hline(ex - 3, ex + 3, ey - 1, br[4])
        c.rect(ex - 1, ey - 8, ex + 1, ey - 2, "#f4f0e0")           # a candle bulb with a flame
        c.set(ex, ey - 9, "#fff4c0")
        c.set(ex, ey - 10, "#ffd870")
    # the skirt of drops: three brass hoops, glass drops hanging from them, one long drop at the centre
    for (hy, hrx, step, dl) in ((44, 80, 7, 13), (56, 58, 7, 14), (68, 34, 7, 12)):
        for k in range(0, 121):
            a = k * math.pi / 60
            c.set(cx + hrx * math.cos(a), hy + 3 * math.sin(a), br[2] if math.sin(a) > 0 else br[3])
        for k in range(-hrx + 4, hrx - 3, step):
            drop(cx + k, hy + 2, dl, 2)
    drop(cx, 80, 14, 3)
    return c


def lantern():
    """The red Chinese paper lantern with the little printed figure and a golden tassel. 2 tiles wide and 3 tall, drawn over everything."""
    c = Canvas(2 * T, 3 * T)
    cx = 32
    c.vline(cx, 0, 18, "#3a2c2c")
    c.ell(cx, 20, 9, 2.6, "#d9a02a")
    c.hline(cx - 7, cx + 7, 19, "#f6d060")
    c.ell(cx, 40, 24, 21, "#c8202a")
    c.ell(cx - 5, 36, 16, 15, "#dc2f35")
    c.ell(cx - 9, 31, 7, 6, "#ee5048")
    for k, yy in enumerate(range(24, 60, 3)):                    # the paper pleats
        half = 24 * math.sqrt(max(0.0, 1 - ((yy - 40) / 21.0) ** 2))
        c.hline(cx - half + 1, cx + half - 1, yy, "#9c1822" if k % 2 else "#b81c26")
    # the print: a child in a gold coat, with a round face, between two columns of gold marks
    c.ell(cx, 31, 5, 5, "#f4d0a8")
    c.ell(cx - 1, 30, 3, 3, "#fae4c8")
    c.rect(cx - 4, 36, cx + 4, 49, "#e8b030")
    c.rect(cx - 4, 36, cx - 3, 49, "#f6d060")
    c.hline(cx - 5, cx + 5, 37, "#c8421f")
    c.rect(cx - 2, 28, cx + 2, 28, "#2a1a1e")
    for (mx, my) in ((cx - 17, 34), (cx - 17, 41), (cx + 15, 34), (cx + 15, 41), (cx - 15, 48), (cx + 13, 48)):
        c.rect(mx, my, mx + 2, my + 4, "#e8b030")
        c.set(mx + 1, my + 2, "#c8202a")
    c.ell(cx, 62, 9, 2.4, "#d9a02a")
    c.hline(cx - 7, cx + 7, 61, "#f6d060")
    for k in range(-8, 9, 2):                                     # the yellow tassel
        c.vline(cx + k, 64, 86 - (abs(k) // 3), "#e8c038" if k % 4 == 0 else "#f6e070")
    c.rect(cx - 3, 63, cx + 3, 68, "#c8902a")
    return c


# ---------------------------------------------------------------- the sun on the floor

def sunpatch(w, h, slats=True):
    """A soft parallelogram of afternoon sun on the parquet (below layer, translucent): lit warm cream, striped by the roller shutter
    slats, strongest in the middle."""
    c = Canvas(w * T, h * T)
    W, H = w * T, h * T
    for y in range(H):
        for x in range(W):
            u = (x - y * .55) / (W * .72)                       # slanted by the angle of the sun
            if 0.04 < u < 1.0 and 3 < y < H - 3:
                e = min(u - .04, 1.0 - u) * 4
                v = min(y - 3, H - 3 - y) / 22.0
                a = min(1.0, e) * min(1.0, v)
                if slats and (y // 5) % 2 == 0:
                    a *= .6
                al = int(58 * a)
                if al > 0:
                    c.set(x, y, (255, 232, 170, al))
    return c


def define(reg):
    for i, v in enumerate("abcd"):
        reg.tile("giuggiu_parquet_" + v, parquet(i))
    reg.stamp("giuggiu_wall_left", wall_left(), "walls")
    reg.stamp("giuggiu_wall_win", wall_win(), "walls")
    reg.stamp("giuggiu_wall_right", wall_right(), "walls")
    for kind in ("wall", "win_top", "win_mid", "win_mid2", "win_bot"):
        reg.tile("giuggiu_sidel_" + kind, side_wall(True, kind))
    reg.tile("giuggiu_sider_wall", side_wall(False, "wall"))
    reg.tile("giuggiu_sider_picture", side_wall(False, "picture"))
    reg.tile("giuggiu_sider_door_top", side_wall(False, "door_top"))
    reg.tile("giuggiu_sider_door_bot", side_wall(False, "door_bot"))
    reg.stamp("giuggiu_doormat", doormat(), "below")
    reg.stamp("giuggiu_armoire", armoire(), "objects", mask=["..", "..", "..", "##"])
    reg.stamp("giuggiu_trolley", trolley(), "objects", mask=["..", "##"])
    reg.stamp("giuggiu_vitrine", vitrine(), "objects", mask=["...", "...", "...", "###"])
    reg.stamp("giuggiu_shelf", shelf_east(), "objects", mask=["#"] * 4)
    reg.stamp("giuggiu_table", glass_table(4), "objects", mask=["####", "####"])
    reg.stamp("giuggiu_chair_red", chair_red(), "objects")
    reg.stamp("giuggiu_chair_black", chair_black(), "objects")
    reg.stamp("giuggiu_sofa_cream", sofa_west(3, CRM, CRM[3], CRM[2], cream_cover), "objects", mask=["##", "##", "##"])
    reg.stamp("giuggiu_sofa_burgundy", pxl_object("giuggiu_sofa_burgundy", (56, 66, 6, 58, 70, 0)), "objects", mask=["##"] * 4)   # drawn with pxl, scripts/art/pxl/objects.px.js
    reg.stamp("giuggiu_sofa_navy", pxl_object("giuggiu_sofa_navy", (64, 61, 60, 2.8, 70)), "objects", mask=["####", "####"])
    reg.stamp("giuggiu_sofa_east", sofa_east(3, NAVY, navy_cover), "walls", mask=["##", ".#", "##"])   # the cat's seat (the middle row, left cell) stays walkable
    reg.stamp("giuggiu_table_black", pxl_object("giuggiu_table_black", (66, 55, 58, 3, 74)), "objects", mask=["####", "####"])
    reg.stamp("giuggiu_tv", pxl_object("giuggiu_tv", (48, 61, 44, 2.8, 74)), "objects", mask=["###", "###"])
    reg.stamp("giuggiu_pouf", beanbag(), "objects")
    reg.stamp("giuggiu_chandelier", chandelier(), "above")
    reg.stamp("giuggiu_lantern", lantern(), "above")
    reg.stamp("giuggiu_sun_window", sunpatch(5, 3, slats=False), "below")
    reg.stamp("giuggiu_sun_side", sunpatch(3, 4, slats=False), "below")
