"""Stamps of the divano room (Casa Circe late at night, the sofa opened into a bed), shapes and colours only, redrawn from the photos
`casa-circe-divano-aperto`, `casa-circe-scale-tv` and `casa-circe-tavolo-divano`. The sofa, the stairs wall, the sofa wall, the tree and the
rest are the `circe_*` stamps; only the pieces that room does not have are here:

`divano_tv_unit` (4 x 3): the low white four door cabinet with a wide flat screen (96 x 54 px, the picture the ending plays the fish
documentary on), headphones and a toy on top; `divano_sofa_bed` (3 x 4): the sofa opened into a bed with a quilted cover and a pillow;
`divano_glass_table` (2 x 1): the low glass top table with a pizza box, a paper bag of fries and a glass; `divano_study_table` (2 x 1):
the same table with two laptops and a notebook; `divano_slippers` (1 x 1, floor): a pair of grey slippers. Every name starts with `divano_`."""
import importlib.util
import math
from pathlib import Path

from tilepaint import Canvas, T, dark, light, make_ramp

# the navy sofa is drawn by the circe module: load it as a library (its stamps are registered by the registry, not by this import)
_spec = importlib.util.spec_from_file_location("stamps_circe_lib", Path(__file__).with_name("circe.py"))
circe = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(circe)

WHITE = make_ramp("#efeade", 5, 3, dark_hue=250, sh=24)
STEEL = make_ramp("#8d98a8", 5, 2, dark_hue=250, sh=12)

# the screen of the TV in the stamp, in stamp pixels: the ending lays the fish documentary exactly over it
SCREEN = (16, 6, 96, 54)


def tv_unit():
    c = Canvas(4 * T, 3 * T)
    c.shadow(64, 93, 62, 2.8, 80)
    # the cabinet on the floor row: lit top face, a front with four doors and vertical handle slots, a plinth
    c.rect(0, 66, 127, 71, WHITE[4])
    c.hline(0, 127, 66, "#ffffff")
    c.rect(0, 72, 127, 90, WHITE[3])
    for xx in (0, 32, 64, 96, 127):
        c.vline(xx, 72, 90, WHITE[1])
    for xx in (29, 35, 61, 67, 93, 99):
        c.vline(xx, 76, 84, WHITE[2])
    c.hline(0, 127, 72, WHITE[2])
    c.hline(0, 127, 90, WHITE[1])
    c.rect(0, 91, 127, 92, WHITE[0])
    # the TV: black bezel, a steel neck and foot, the pink and blue picture
    x0, y0, w, h = SCREEN
    c.rect(x0 - 2, y0 - 2, x0 + w + 1, y0 + h + 1, "#101016")
    c.hline(x0 - 2, x0 + w + 1, y0 - 2, "#3a3a44")
    c.vline(x0 - 2, y0 - 2, y0 + h + 1, "#2a2a32")
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            k = (math.sin(x * .17 + y * .11) + math.cos(x * .09 - y * .21)) * .5
            tone = "#ff6ec0" if k > .35 else ("#c890ff" if k > -.1 else ("#6ab0ff" if k > -.55 else "#f0e8ff"))
            c.set(x, y, tone)
    c.hline(x0, x0 + w - 1, y0, "#ffd0f0")
    c.vline(x0, y0, y0 + h - 1, "#ffe0f8")
    c.rect(56, y0 + h + 2, 71, y0 + h + 5, "#2a2a32")
    c.hline(46, 81, y0 + h + 6, "#2a2a32")
    # headphones on the right of the top, a small figure with a plant on the left
    c.ell(118, 64, 5, 3, "#1a1a20")
    c.ell(118, 63, 3, 1.6, "#4a4a58")
    c.rect(5, 59, 11, 65, "#c8683a")
    c.set(7, 57, "#4f9250")
    c.set(8, 56, "#4f9250")
    c.set(9, 57, "#4f9250")
    c.outline()
    c.glow(64, 33, 56, "#ff9ad8", 34)
    return c


def glass_table():
    """2 x 1: the low glass table, seen from the front and above: a pale green-blue top with a bright edge, chrome legs, a pizza box
    with a slice, a paper bag of fries and a tall glass."""
    c = Canvas(2 * T, T)
    c.shadow(32, 30, 29, 2.4, 70)
    c.rect(3, 14, 60, 21, "#a8cfd8")
    c.hline(3, 60, 14, "#e6f6f8")
    c.hline(3, 60, 15, "#c8e8ee")
    c.rect(3, 22, 60, 23, "#6a9aa8")
    c.hline(3, 60, 23, "#4a7a88")
    for lx in (5, 56):
        c.rect(lx, 24, lx + 1, 30, STEEL[3])
        c.vline(lx, 24, 30, STEEL[4])
    c.rect(8, 25, 55, 26, "#7aa8b4")
    # the pizza box, open, with a slice and a red sauce stain
    c.rect(6, 9, 27, 14, "#e8dcc0")
    c.hline(6, 27, 9, "#fff8e8")
    c.hline(6, 27, 14, "#a89878")
    c.poly([(10, 10), (21, 10), (16, 13)], "#e8a83a")
    c.hline(11, 20, 10, "#f4c860")
    c.set(14, 11, "#c4403f")
    c.set(17, 11, "#c4403f")
    # the paper bag of fries: red bag, golden sticks
    c.rect(33, 7, 41, 14, "#c4403f")
    c.hline(33, 41, 7, "#e8665a")
    c.vline(41, 8, 14, "#8a2430")
    for k in range(4):
        c.rect(34 + k * 2, 3 + (k % 2), 35 + k * 2, 7, "#f0c04a")
    c.rect(36, 10, 38, 12, "#f4d870")
    # a tall clear glass
    c.rect(47, 5, 51, 14, "#cfe8f4")
    c.vline(47, 5, 14, "#ffffff")
    c.hline(47, 51, 14, "#7a98a8")
    c.rect(48, 9, 50, 13, "#e8a83a")
    c.outline()
    return c


def study_table():
    """2 x 1: the same glass table as it looks in `casa-circe-tavolo-divano`, with the evening's study left on it: a laptop seen from its
    black lid with a round orange sticker, a second laptop lit with a page of text, a blue spiral notebook, a glass of water and papers."""
    c = Canvas(2 * T, T)
    c.shadow(32, 30, 29, 2.4, 70)
    c.rect(3, 14, 60, 21, "#a8cfd8")
    c.hline(3, 60, 14, "#e6f6f8")
    c.hline(3, 60, 15, "#c8e8ee")
    c.rect(3, 22, 60, 23, "#6a9aa8")
    c.hline(3, 60, 23, "#4a7a88")
    for lx in (5, 56):
        c.rect(lx, 24, lx + 1, 30, STEEL[3])
        c.vline(lx, 24, 30, STEEL[4])
    c.rect(8, 25, 55, 26, "#7aa8b4")
    c.rect(6, 12, 22, 14, "#2a2a32")                         # the first laptop: the lid from behind, a base under it, the sticker
    c.rect(7, 2, 21, 11, "#16161c")
    c.hline(7, 21, 2, "#3a3a44")
    c.ell(14, 7, 3.6, 3.2, "#d85a2a")
    c.ell(14, 7, 1.6, 1.4, "#f0a070")
    c.rect(26, 5, 44, 13, "#101018")                         # the second laptop, screen lit with lines of text
    c.rect(27, 6, 43, 12, "#e4efff")
    for k in range(4):
        c.hline(29, 40 - (k % 2) * 3, 7 + k * 2 - (1 if k == 3 else 0), "#6a88c8" if k else "#2a4a9a")
    c.rect(24, 13, 46, 14, "#2a2a32")
    c.rect(48, 8, 58, 14, "#4aa0d8")                         # the blue spiral notebook, flat
    c.hline(48, 58, 8, "#9ad0f0")
    c.hline(48, 58, 14, "#2a6a98")
    for xx in range(49, 58, 2):
        c.set(xx, 8, "#e8e8f0")
    c.rect(48, 4, 52, 8, "#cfe8f4")                          # a glass of water behind it
    c.vline(48, 4, 8, "#ffffff")
    c.outline()
    return c


def sofa_bed():
    """3 x 4: the navy sofa opened into a bed, as in `casa-circe-divano-aperto`: the backrest and the wide arms on top, a pale quilted
    grey bedspread with diamond stitching over the mattress, a white pillow at the head, the black metal frame with its folded legs at
    the foot. The same navy sofa as `circe_sofa_bed`, a better quilt and the pillow."""
    c = Canvas(3 * T, 4 * T)
    c.shadow(48, 124, 46, 3, 80)
    c.rect(6, 112, 89, 116, "#1a1c24")                       # the metal frame: a rail across the foot and two folded legs
    c.hline(6, 89, 112, "#5a5c68")
    for lx in (10, 82):
        c.rect(lx, 112, lx + 3, 124, "#1a1c24")
        c.vline(lx, 112, 124, "#4a4c58")
    c.line(14, 116, 40, 122, "#1a1c24")
    c.line(80, 116, 56, 122, "#1a1c24")
    circe.sofa_body(c, bed=True)
    # the quilt: pale blue grey, stitched into diamonds 14 px across: a dark seam, a lit stitch beside it, a soft fall of tone to the right
    x0, y0, x1, y1 = 13, 36, 82, 112
    c.rect(x0, y0, x1, y1, "#b4b8d0")
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            u, v = (x + y) % 14, (x - y) % 14
            if u == 0 or v == 0:
                c.set(x, y, "#8084a4")
            elif u == 1 or v == 1:
                c.set(x, y, "#d0d4ea")
            elif x > x0 + 44 and (u + v) % 2 == 0:
                c.set(x, y, "#a4a8c4")
    c.rect(x0, y0, x1, y0 + 2, "#7a7ea0")                    # the shade under the backrest
    c.hline(x0, x1, y0 + 3, "#d0d4ea")
    c.hline(x0, x1, y1, "#6a6e8c")
    c.hline(x0, x1, y1 - 1, "#8a8eac")
    c.vline(x0, y0, y1, "#dce0f2")
    c.vline(x1, y0, y1, "#6a6e8c")
    c.poly([(x0, y1 - 10), (x0 + 16, y1 - 12), (x0 + 14, y1), (x0, y1)], "#c4c8de")     # the quilt bunched at the foot, left
    c.line(x0, y1 - 10, x0 + 16, y1 - 12, "#e4e8f8")
    # the quilt is thrown loosely: two soft wrinkles across it, each a dark crease with a lit lip under it, and a dented corner
    for (xa, ya, xb, yb) in ((22, 62, 58, 70), (44, 86, 78, 82)):
        c.line(xa, ya, xb, yb, "#6e7294")
        c.line(xa, ya + 1, xb, yb + 1, "#dce0f2")
    c.poly([(70, y0 + 4), (x1, y0 + 6), (x1, y0 + 22), (76, y0 + 14)], "#a8acc8")     # the fold over the right arm
    c.line(70, y0 + 4, 76, y0 + 14, "#6e7294")
    # a white pillow at the head, against the left cushion of the backrest
    c.round_rect(17, 38, 41, 50, "#ece8f0", 4)
    c.hline(20, 38, 38, "#ffffff")
    c.hline(18, 40, 50, "#9a98b4")
    c.vline(41, 41, 49, "#b8b4cc")
    c.set(28, 44, "#c4c0d8")
    c.set(29, 45, "#c4c0d8")
    c.outline()
    return c


def slippers():
    """1 x 1 on the floor: a pair of soft grey slippers, one tipped over."""
    c = Canvas()
    c.shadow(16, 24, 11, 2, 60)
    for (x, y, tone) in ((6, 15, "#a8acb8"), (14, 19, "#9498a6")):
        c.ell(x + 6, y + 3, 7, 3.6, dark(tone, .35))
        c.ell(x + 6, y + 2, 6.4, 3.1, tone)
        c.ell(x + 8, y + 1, 4, 1.6, light(tone, .35))
        c.ell(x + 4, y + 3, 2.6, 1.1, dark(tone, .5))
    c.outline()
    return c


def define(reg):
    reg.stamp("divano_tv_unit", tv_unit(), "objects", mask=["....", "....", "####"])
    reg.stamp("divano_glass_table", glass_table(), "objects")
    reg.stamp("divano_study_table", study_table(), "objects")
    reg.stamp("divano_slippers", slippers(), "below")
    reg.stamp("divano_sofa_bed", sofa_bed(), "objects", mask=["...", "...", "###", "###"])
