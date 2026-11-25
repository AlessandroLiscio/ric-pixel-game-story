"""Stamps of the Cinema Bellinzona (the room of scene `universita`, where Prof. Pinolo gives his lessons), rebuilt from the two reference
photos (shapes only, nothing copied; the exit signs and the slide on the screen are our own pixel drawings): a long hall with grey plaster
walls, round white wall lights and small black loudspeakers on brackets, the recess of the front wall with a big white screen between dark
pleated side curtains under a dark soffit, a low light grey stage under it, a dark glossy floor, six rows of red velvet seats with wooden
armrests in two blocks split by a centre aisle, side aisles along the two long walls with grey exit doors and green exit signs, and an
audience of many people seated, painted in from the crowd sheets.

`universita_wall_front` (20 x 3 tiles) is the front wall, `universita_hall` (20 x 9 tiles) the floor with the stage, the aisles, the seats
and the audience, `universita_wall_left` and `universita_wall_right` (1 x 12 tiles) the two long walls, `universita_seat_lollino` the one
seat object drawn over a standing sprite so that Lollino looks seated, `universita_bins` the recycling bins. Every name starts with
`universita_`."""
from pathlib import Path

from PIL import Image

from tilepaint import RED, WOOD, Canvas, T, col, dark, hx, light, make_ramp, mix, rng

ROOT = Path(__file__).resolve().parents[3]

GREY = make_ramp("#8e8d98", 5, 2, dark_hue=262, sh=16)       # the plaster of the walls
CURT = make_ramp("#34353f", 4, 1, dark_hue=265, sh=8)        # the dark curtains and the soffit
FLOOR = make_ramp("#41424f", 4, 1, dark_hue=262, sh=8)       # the dark glossy floor
STAGE = make_ramp("#a2a4b2", 4, 2, dark_hue=262, sh=12)      # the low light grey stage
BEAM = make_ramp("#3a3b46", 3, 1, dark_hue=265, sh=8)

WW = 20 * T                                                  # width of the front wall and of the hall (map columns 1 to 20)
# the recess of the front wall, the screen and the stage, in px from the left edge of those two stamps (map column 1)
REC0, REC1 = 4 * T, 16 * T                                   # tiles 5 to 16 of the map
SCR = (208, 14, 431, 79)                                     # the screen, 224 x 66 px, centred on the hall
STAGE_X = (REC0, REC1 - 1)
# the seats, in px from the top left of the hall stamp (map column 1, row 4): rows 6 to 11, two blocks, tiles 3 to 9 and 12 to 18
SEAT_Y0 = 2 * T
BLOCKS = [(2 * T, 8 * T), (11 * T, 17 * T)]                  # x of the first and the last seat of each block, in px
ROWS = 6
LOLLINO = (0, 0)                                             # his seat: seat 0 of block 0, row 0 (map tile 3,6), left free


# ---------------------------------------------------------------- shared bits
def exit_sign(c, x, y, w=24):
    c.rect(x, y, x + w - 1, y + 8, "#143a24")
    c.rect(x + 1, y + 1, x + w - 2, y + 7, "#27a05a")
    c.hline(x + 1, x + w - 2, y + 1, "#5cd88a")
    wt = "#f4fff0"                                           # a figure running toward an arrow: our own pixel drawing
    c.rect(x + 4, y + 1, x + 5, y + 2, wt)
    c.rect(x + 3, y + 3, x + 5, y + 4, wt)
    c.set(x + 2, y + 4, wt)
    c.set(x + 6, y + 3, wt)
    c.set(x + 2, y + 6, wt)
    c.set(x + 5, y + 5, wt)
    c.set(x + 6, y + 6, wt)
    c.hline(x + 10, x + w - 5, y + 3, wt)
    c.hline(x + 10, x + w - 5, y + 4, wt)
    c.set(x + w - 6, y + 2, wt)
    c.set(x + w - 6, y + 5, wt)
    c.glow(x + w / 2, y + 4, 14, "#5cd88a", 46)


def round_light(c, x, y):
    """A round white wall lamp, lit, with a soft halo."""
    c.glow(x, y, 20, "#fff2cc", 74)
    c.disc(x, y, 7.2, "#9c98a0")
    c.disc(x, y, 6.4, "#e8e2d4")
    c.disc(x - .5, y - .5, 5.2, "#fffbea")
    c.disc(x - 1, y - 1, 2.6, "#ffffff")


def speaker(c, x, y):
    """A small black loudspeaker box on a short bracket, tilted toward the seats."""
    c.rect(x, y, x + 15, y + 10, "#17171e")
    c.hline(x, x + 15, y, "#3c3c48")
    c.vline(x, y, y + 10, "#2c2c36")
    c.vline(x + 15, y, y + 10, "#0c0c12")
    c.disc(x + 8, y + 6, 3.4, "#2a2a34")
    c.disc(x + 8, y + 6, 1.6, "#0c0c12")
    c.rect(x + 7, y + 11, x + 8, y + 14, "#4c4c58")
    c.hline(x + 4, x + 11, y + 14, "#4c4c58")


def wall_base(c, x0, y0, x1, y1, lit_side=None):
    """Grey plaster with a soft light falloff and faint vertical panel joints."""
    c.rect(x0, y0, x1, y1, GREY[2])
    h = max(1, y1 - y0)
    for y in range(y0, y1 + 1):
        t = (y - y0) / h
        for x in range(x0, x1 + 1):
            if (x // 64) % 2 and t > .1:
                c.set(x, y, mix(GREY[2], GREY[1], .16 + .12 * t))
            elif t > .55:
                c.set(x, y, mix(GREY[2], GREY[1], (t - .55) * .55))
    for x in range(x0 + 64, x1, 64):
        c.vline(x, y0, y1, mix(GREY[2], GREY[1], .5))
        c.vline(x + 1, y0, y1, mix(GREY[2], GREY[3], .35))


# ---------------------------------------------------------------- the front wall
def pleats(c, x0, x1, y0, y1):
    """A dark pleated curtain: vertical folds with a lit edge."""
    for x in range(x0, x1 + 1):
        k = (x - x0) % 6
        tone = CURT[2] if k in (1, 2) else (CURT[1] if k in (0, 3) else CURT[0])
        c.vline(x, y0, y1, tone)
    for y in range(y1 - 12, y1 + 1):                          # the hem falls into shade
        for x in range(x0, x1 + 1):
            c.set(x, y, mix(c.get(x, y), (16, 14, 26), .4 * (y - (y1 - 12)) / 12))


def slide(c, x0, y0, x1, y1):
    """The lesson on the screen, in soft blue grey: a title bar, three lines and a small play triangle in a framed picture."""
    ink, soft = "#7d8fb4", "#b9c6e0"
    c.rect(x0 + 14, y0 + 8, x0 + 94, y0 + 15, ink)
    c.rect(x0 + 14, y0 + 22, x0 + 74, y0 + 24, soft)
    c.rect(x0 + 14, y0 + 30, x0 + 88, y0 + 32, soft)
    c.rect(x0 + 14, y0 + 38, x0 + 62, y0 + 40, soft)
    c.rect(x0 + 14, y0 + 46, x0 + 80, y0 + 48, soft)
    c.rect(x0 + 130, y0 + 8, x0 + 208, y0 + 50, soft)
    c.rect(x0 + 131, y0 + 9, x0 + 207, y0 + 49, "#e8eef8")
    c.poly([(x0 + 160, y0 + 18), (x0 + 160, y0 + 40), (x0 + 181, y0 + 29)], ink)


def wall_front():
    """The front wall, 20 x 3 tiles: grey plaster flanks with round lights and loudspeakers, the dark soffit, the recess with pleated
    curtains and the big screen."""
    c = Canvas(WW, 3 * T)
    wall_base(c, 0, 0, WW - 1, 3 * T - 1)
    c.rect(0, 0, WW - 1, 9, BEAM[1])                         # the dark soffit along the ceiling
    c.hline(0, WW - 1, 10, BEAM[0])
    c.hline(0, WW - 1, 11, GREY[3])
    c.rect(0, 3 * T - 7, WW - 1, 3 * T - 1, GREY[1])        # the skirting
    c.hline(0, WW - 1, 3 * T - 7, GREY[3])
    c.hline(0, WW - 1, 3 * T - 1, GREY[0])
    # round lights and speakers on the two flanks, mirrored
    for side in (0, 1):
        def X(x, w=0):
            return x if side == 0 else WW - 1 - x - w
        round_light(c, X(34), 38)
        round_light(c, X(98), 38)
        speaker(c, X(60, 15), 24)
        c.rect(X(14, 9), 56, X(14, 9) + 9, 70, "#e6e4dc")   # a pinned notice, as on the wall of the photo
        c.hline(X(14, 9), X(14, 9) + 9, 56, "#ffffff")
        for ty in (59, 62, 65):
            c.hline(X(14, 9) + 2, X(14, 9) + 7, ty, "#9a98a4")
        c.rect(X(104, 9), 60, X(104, 9) + 8, 66, "#2c2c36")   # a small grey wall box under the lamps
        c.set(X(104, 9) + 2, 62, "#e05040")
    # the recess: a deeper dark box with the soffit lowered over it, pleated curtains on both sides of the screen
    c.rect(REC0 - 2, 0, REC1 + 1, 3 * T - 1, CURT[0])
    c.rect(REC0 - 2, 0, REC1 + 1, 17, BEAM[2])               # the lowered soffit over the screen
    c.hline(REC0 - 2, REC1 + 1, 18, BEAM[0])
    c.hline(REC0 - 2, REC1 + 1, 19, CURT[1])
    pleats(c, REC0, SCR[0] - 5, 20, 3 * T - 8)
    pleats(c, SCR[2] + 6, REC1 - 1, 20, 3 * T - 8)
    c.vline(REC0 - 2, 0, 3 * T - 1, GREY[0])
    c.vline(REC0 - 1, 20, 3 * T - 1, GREY[3])
    c.vline(REC1 + 1, 0, 3 * T - 1, GREY[0])
    c.rect(REC0, 3 * T - 7, REC1 - 1, 3 * T - 1, CURT[0])
    # the screen: black masking frame, white surface with a faint blue cast, the lesson on it
    x0, y0, x1, y1 = SCR
    c.rect(x0 - 3, y0 - 3, x1 + 3, y1 + 3, "#101016")
    c.hline(x0 - 3, x1 + 3, y0 - 3, "#2a2a34")
    c.vgrad(x0, y0, x1, y1, "#f6f8fd", "#d9e0ee")
    slide(c, x0, y0, x1, y1)
    c.hline(x0, x1, y0, "#ffffff")
    c.vline(x0, y0, y1, "#ffffff")
    c.vline(x1, y0, y1, "#c6cee0")
    c.hline(x0, x1, y1, "#c6cee0")
    c.glow((x0 + x1) / 2, (y0 + y1) / 2, 150, "#dce8ff", 30)
    return c


# ---------------------------------------------------------------- the long side walls
def side_wall(left):
    """A long side wall, 1 x 12 tiles (map rows 1 to 12): grey plaster, round lights and speakers, the grey exit door with its green
    sign at the front end (rows 5 and 6, next to the front aisle)."""
    c = Canvas(T, 12 * T)
    wall_base(c, 0, 0, T - 1, 12 * T - 1)
    inner = T - 1 if left else 0
    c.vline(inner, 0, 12 * T - 1, GREY[4])
    c.vline(T - 1 - inner, 0, 12 * T - 1, GREY[0])
    for row in (2, 8, 10, 12):
        round_light(c, 16, (row - 1) * T + 16)
    for row in (3, 9, 11):
        speaker(c, 8, (row - 1) * T + 8)
    y0 = 4 * T                                                # door: rows 5 and 6 are local y 128 to 191
    c.rect(4, y0 + 2, T - 5, y0 + 62, GREY[0])               # frame
    c.rect(6, y0 + 4, T - 7, y0 + 62, mix(GREY[2], GREY[1], .5))
    c.vline(6, y0 + 4, y0 + 62, GREY[3])
    c.rect(8, y0 + 8, T - 9, y0 + 26, GREY[1])               # upper panel
    c.rect(8, y0 + 34, T - 9, y0 + 56, GREY[1])
    c.hline(8, T - 9, y0 + 8, GREY[3])
    c.hline(8, T - 9, y0 + 34, GREY[3])
    bar = T - 11 if left else 9                                # the push bar on the side of the handle
    c.hline(10, T - 11, y0 + 31, "#cfd2dc")
    c.hline(10, T - 11, y0 + 32, "#6c7080")
    c.rect(bar, y0 + 29, bar + 1, y0 + 33, "#cfd2dc")
    exit_sign(c, 4, 3 * T + 12, 24)                          # over the door, in row 4
    return c


# ---------------------------------------------------------------- the hall
def floor_px(x, y, aisle):
    """The dark glossy floor: a quiet checker of two near tones, large slab joints, now and then a long soft reflection."""
    base = FLOOR[1] if aisle else FLOOR[0]
    if ((x // 2) + (y // 2)) % 2 == 0:
        base = mix(base, FLOOR[2], .22)
    if x % 64 == 0 or y % 64 == 0:
        base = mix(base, FLOOR[0], .5)
    elif (x + y * 2) % 112 < 3 and aisle:
        base = mix(base, FLOOR[3], .22)
    return col(base)


def stage_px(x, y):
    """The low stage: a light grey top with seams every 32 px, and a darker front step."""
    if y >= 30:
        return hx(STAGE[0])
    if y >= 26:
        return mix(STAGE[1], STAGE[0], (y - 26) * .22)
    if y >= 25:
        return hx(STAGE[3])
    base = STAGE[2]
    if x % 32 == 0:
        base = STAGE[1]
    elif x % 32 == 1:
        base = STAGE[3]
    if y == 0:
        return hx(STAGE[1])
    return col(base)


def seat(c, x, y, empty):
    """One seat seen from behind in the 32 x 32 cell with its top left at (x, y): the red velvet back from y+14 to y+29 with a lit rim,
    the wooden armrests on both sides, the folded seat cushion when nobody sits there."""
    for ax in (x, x + 29):
        c.rect(ax, y + 8, ax + 2, y + 27, WOOD[2])
        c.hline(ax, ax + 2, y + 8, WOOD[4])
        c.hline(ax, ax + 2, y + 9, WOOD[3])
        c.vline(ax if ax == x else ax + 2, y + 10, y + 27, WOOD[1])
        c.hline(ax, ax + 2, y + 27, WOOD[0])
    if empty:
        c.ell(x + 16, y + 10, 11, 4.6, RED[0], ymax=y + 13)
        c.ell(x + 16, y + 9, 10, 4.2, RED[1], ymax=y + 13)
        c.ell(x + 15, y + 8, 7.5, 2.6, RED[2], ymax=y + 13)
    c.round_rect(x + 3, y + 14, x + 28, y + 29, RED[2], 3)
    c.hline(x + 5, x + 26, y + 14, RED[3])
    c.hline(x + 4, x + 27, y + 15, mix(RED[3], RED[2], .45))
    c.vline(x + 3, y + 16, y + 27, RED[3])
    c.vline(x + 4, y + 16, y + 27, mix(RED[3], RED[2], .5))
    c.vline(x + 28, y + 16, y + 27, RED[0])
    c.vline(x + 27, y + 16, y + 27, RED[1])
    c.vline(x + 15, y + 17, y + 26, RED[1])                  # the stitched seam
    c.vline(x + 16, y + 17, y + 26, mix(RED[2], RED[3], .35))
    c.hline(x + 4, x + 27, y + 28, RED[1])
    c.hline(x + 5, x + 26, y + 29, RED[0])
    c.hline(x + 3, x + 28, y + 30, mix((22, 22, 32), (60, 20, 40), .3))   # the contact shadow on the floor


def load_sheets():
    out = {}
    for n in range(1, 21):
        p = ROOT / ("public/assets/tiles/crowd-%d.png" % n)
        if p.exists():
            out[n] = Image.open(p).convert("RGBA")
    return out


def paste_person(c, sheet, face, x, y, dx=0):
    """The head and shoulders of a seated person from a crowd sheet, in the cell at (x, y): rows 1 to 16 of the sprite go to y-2 to y+13,
    so the seat back (from y+14) hides the rest, as it does from a camera standing behind the rows."""
    row = {"down": 0, "left": 1, "right": 2, "up": 3}[face]
    fr = sheet.crop((32, row * 32, 64, row * 32 + 32))
    for sy in range(1, 17):
        for sx in range(32):
            p = fr.getpixel((sx, sy))
            if p[3] >= 200:
                c.set(x + sx + dx, y + sy - 3, p[:3])


def hall():
    c = Canvas(WW, 9 * T)
    # the floor
    for y in range(9 * T):
        for x in range(WW):
            under_seats = SEAT_Y0 <= y < SEAT_Y0 + ROWS * T and any(a <= x < b + T for (a, b) in BLOCKS)
            c.px[x, y] = floor_px(x, y, not under_seats)
    # the stage under the screen: a light grey top, the front step, and its shadow falling on the front aisle
    for y in range(T):
        for x in range(STAGE_X[0], STAGE_X[1] + 1):
            c.px[x, y] = tuple(stage_px(x, y)[:3]) + (255,)
    c.vline(STAGE_X[0], 0, 31, STAGE[0])
    c.vline(STAGE_X[1], 0, 31, STAGE[0])
    for y in range(T, T + 8):
        for x in range(STAGE_X[0], STAGE_X[1] + 1):
            c.set(x, y, mix(c.get(x, y), (16, 12, 28), .42 * (1 - (y - T) / 8)))
    # the seats, row by row from the front, each row painted over the one before it; the person's bust first, then the seat back over it
    r = rng("cinema-audience")
    sheets = load_sheets()
    keys = sorted(sheets)
    for k in range(ROWS):
        y = SEAT_Y0 + k * T
        for b, (xa, xb) in enumerate(BLOCKS):
            for i, x in enumerate(range(xa, xb + 1, T)):
                if (i, k) == LOLLINO and b == 0:
                    continue                                    # his seat is an object drawn over his sprite
                front_right = k == 0 and b == 1                # the front row of the right block (obj_seats): half empty
                empty = (i in (1, 3, 4) if front_right else r.random() < .1) or not sheets
                seat(c, x, y, empty)
                if not empty:
                    face = "up" if r.random() < .84 else ("left" if r.random() < .5 else "right")
                    paste_person(c, sheets[keys[r.randrange(len(keys))]], face, x, y, r.choice((-1, 0, 0, 1)))
    return c


# ---------------------------------------------------------------- objects
def seat_lollino():
    """The seat of Lollino as an object (map tile 3,6, not solid): the back and the armrests, drawn over his sprite from the chest down."""
    c = Canvas()
    seat(c, 0, 0, False)
    return c


def bins():
    """Two recycling bins by the right wall: a blue one and a green and yellow one."""
    c = Canvas()
    c.shadow(16, 28.5, 14, 2.4, 76)
    for (x0, body, lid) in ((2, "#3a6ac0", "#2a4a90"), (17, "#d8b830", "#4a8a3a")):
        hi = light(body, .35)
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
    reg.stamp("universita_wall_left", side_wall(True), "walls")
    reg.stamp("universita_wall_right", side_wall(False), "walls")
    reg.stamp("universita_hall", hall(), "below")
    reg.stamp("universita_seat_lollino", seat_lollino(), "objects", mask=["."])
    reg.stamp("universita_bins", bins(), "objects")
