"""Painted 96x96 dialogue portraits in the RPG Maker VX Ace face style, drawn by code.

Each face is drawn at 4x (384x384) from shapes (ellipses, polygons, Bezier strokes) with cel shading, a cast
shadow from the hair, coloured line art and per-person features, then reduced to 96x96 with a hard alpha edge and
quantised to at most 64 colours. Nothing is copied from a photo: the features in FACES were chosen by looking at the
reference photos (face shape, hair, brows, beard, glasses, expression, clothes), as docs/art-characters.md lists.

chibis.py calls draw(person_id) for every person with a portrait.
"""
import math
import random

import numpy as np
from PIL import Image, ImageDraw

SS = 4                     # supersampling factor
N = 96 * SS
Y, X = np.mgrid[0:N, 0:N].astype(float)
Y = (Y + 0.5) / SS         # pixel centres in 96-px units
X = (X + 0.5) / SS
MAX_COLOURS = 64

SKIN = {"light": (250, 220, 196), "medium": (238, 198, 164), "tan": (226, 176, 136), "olive": (206, 152, 110)}
HAIR = {
    "black": (44, 34, 48), "darkbrown": (64, 42, 34), "brown": (96, 62, 42), "chestnut": (146, 96, 60),
    "auburn": (170, 72, 58), "greybrown": (132, 122, 112), "copper": (200, 108, 56), "lightbrown": (140, 100, 66),
    "ash": (156, 146, 136), "salt": (104, 98, 98),"wavybrown": (84, 52, 38),
    "inkbrown": (52, 40, 40), "pinbrown": (122, 104, 90), "silverbrown": (148, 132, 120), "ginger": (208, 118, 62),
    "blonde": (226, 188, 118), "hoodie": (52, 56, 70),  # hoodie is the cloth of a hood, drawn like hair
}
EYES = {"brown": (92, 56, 36), "darkbrown": (60, 38, 30), "hazel": (120, 96, 52), "green": (84, 118, 70),
        "hazelgreen": (112, 116, 66), "blue": (84, 122, 164)}

# Per-person features. fw = half face width, chin = chin y, cw = chin half width, brow = stroke width,
# eye = (width, height), mouth = grin | smile | soft | neutral, squint = smiling lower lids.
FACES = {
    "ric": dict(skin="tan", hair="darkbrown", eyes="darkbrown", style="bun", fw=18.8, chin=75, cw=3.5, brow=2.4,
                eye=(10, 5.2), mouth="soft", beard="full", acc=["sunglasses"], male=True, messy=True,
                top=("shirt", (128, 36, 52), "hawaii")),
    "lara": dict(skin="tan", hair="wavybrown", eyes="darkbrown", style="longwavy", fw=19.5, chin=72, cw=3.0, brow=2.6,
                 eye=(10, 6.0), mouth="smile", lip=(196, 110, 108), acc=["beadearrings", "mole"],
                 ombre=(178, 118, 72), top=("straps", (246, 243, 236), "buttons")),
    "liscio": dict(skin="tan", hair="darkbrown", eyes="brown", style="swept", fw=19.2, chin=75, cw=3.5, brow=2.5,
                   eye=(10, 5.0), mouth="smile", beard="short", acc=["chain", "hoop"], male=True,
                   top=("tee", (168, 172, 180), None)),
    "ros": dict(skin="light", hair="auburn", eyes="hazel", style="bob", fw=19.5, chin=71, cw=3.0, brow=1.5,
                eye=(10.5, 6.8), mouth="soft", blush=True, acc=["bighoops", "goldchain"],
                top=("straps", (52, 44, 56), "ditsy")),
    "lollino": dict(skin="medium", hair="darkbrown", eyes="hazelgreen", style="tousle", fw=19.8, chin=74, cw=4.0,
                    brow=2.5, eye=(10, 5.6), mouth="grin", squint=True, acc=["shades-on-head"],
                    male=True, vol=1.15, fringe=True, top=("tee", (40, 48, 82), None)),
    "fede": dict(skin="medium", hair="darkbrown", eyes="darkbrown", style="longstraight", fw=19.5, chin=71, cw=3.0,
                 brow=1.4, eye=(10, 6.4), mouth="grin", squint=True, blush=True, acc=[],
                 top=("straps", (226, 196, 70), "ditsy-light")),
    "giuggiu": dict(skin="tan", hair="black", eyes="darkbrown", style="quiff", fw=20.5, chin=75, cw=5.0, brow=2.6,
                    eye=(9.5, 5.4), mouth="smile", beard=None, acc=[], male=True,
                    top=("tee", (244, 244, 240), "logo")),
    "giusy": dict(skin="tan", hair="black", eyes="darkbrown", style="longstraight", fw=19, chin=71, cw=2.6, brow=1.6,
                  eye=(10.5, 6.4), mouth="grin", squint=True, acc=["chain"], lashes=True, part=41,
                  top=("vneck", (40, 30, 44), "floral")),
    "pinolo": dict(skin="light", hair="pinbrown", eyes="brown", style="sidepart", fw=21.5, chin=74, cw=5.0, brow=2.0,
                   eye=(9, 5.0), mouth="smile", acc=["glasses", "lines"], male=True, gframe=(38, 30, 32), gthick=1.6,
                   browcol=(86, 66, 56), top=("collar", (176, 204, 232), "stripes")),
    "sconosciuta": dict(skin="light", hair="chestnut", eyes="green", style="ponytail", fw=19, chin=71, cw=3.0,
                        brow=1.3, eye=(10.5, 6.8), mouth="smile", blush=True, acc=[],
                        top=("straps", (150, 214, 184), None)),
    # extras (comparse), traits from the photos the owner added
    "alessandro": dict(skin="light", hair="black", eyes="darkbrown", style="swept", fw=19.5, chin=74, cw=3.5, brow=1.9,
                       eye=(10, 5.4), mouth="grin", squint=True, beard="stubble", acc=[], male=True,
                       top=("collar", (244, 242, 236), None)),
    "rosanna": dict(skin="light", hair="darkbrown", eyes="darkbrown", style="longstraight", fw=19.5, chin=73, cw=3.5,
                    brow=1.6, eye=(10, 6.0), mouth="neutral", acc=["aviator", "buckethat"],
                    top=("tee", (40, 36, 40), "vest")),
    "roberto": dict(skin="light", hair="brown", eyes="hazel", style="swept", fw=18.8, chin=75, cw=3.5, brow=1.7,
                    eye=(10, 5.0), mouth="smile", squint=True, beard="short", acc=["tophat", "bowtie", "sidecurls"],
                    male=True, top=("blazer", (30, 28, 34), (240, 236, 226))),
    "armando": dict(skin="light", hair="darkbrown", eyes="darkbrown", style="tousle", fw=18.8, chin=75, cw=3.0,
                    brow=2.5, eye=(10, 5.0), mouth="neutral", beard="goatee", acc=[], male=True, vol=1.3,
                    drop=12, top=("tee", (150, 118, 40), "plaid")),
    "carolina": dict(skin="light", hair="ginger", eyes="brown", style="longwavy", fw=19.5, chin=72, cw=3.5,
                     brow=1.5, eye=(10, 6.2), mouth="smile", lip=(150, 20, 38), squint=True, acc=["nosering"],
                     part=53, browcol=(132, 76, 44), top=("vneck", (34, 32, 36), None)),
    "papa": dict(skin="tan", hair="salt", eyes="darkbrown", style="quiff", fw=20, chin=74, cw=4.0, brow=2.0,
                 eye=(9.5, 4.8), mouth="smile", squint=True, beard="short", bcol=HAIR["salt"], acc=["lines"], male=True,
                 top=("blazer", (70, 76, 92), (36, 44, 80))),   # a short beard the colour of his hair (the owner's call, round 4)
    "mamma": dict(skin="light", hair="silverbrown", eyes="brown", style="longwavy", fw=19.5, chin=72, cw=3.5, brow=1.5,
                  eye=(10, 5.8), mouth="grin", squint=True, acc=["rectglasses", "headband", "lines", "browlines"],
                  browcol=(96, 72, 62), top=("blazer", (104, 62, 40), (236, 228, 212))),
    # round 4 npcs, all invented (no photo)
    "frangetta": dict(skin="light", hair="darkbrown", eyes="darkbrown", style="fringe", fw=19.2, chin=71, cw=3.0, brow=1.5,
                      eye=(10, 6.2), mouth="smile", blush=True, lashes=True, acc=[],
                      top=("straps", (246, 242, 232), None)),
    "slackgirl1": dict(skin="light", hair="blonde", eyes="blue", style="longwavy", fw=19.5, chin=72, cw=3.2, brow=1.4,
                       eye=(10.5, 6.4), mouth="grin", squint=True, blush=True, acc=[], ombre=(240, 214, 150),
                       top=("straps", (226, 124, 146), None)),
    "slackgirl2": dict(skin="olive", hair="black", eyes="darkbrown", style="ponytail", fw=19, chin=71, cw=3.0, brow=1.5,
                       eye=(10.5, 6.6), mouth="smile", lip=(176, 84, 88), lashes=True, acc=[],
                       top=("tee", (79, 154, 93), None)),
    "slackgirl3": dict(skin="medium", hair="chestnut", eyes="hazel", style="curls", fw=19.8, chin=72, cw=3.4, brow=1.9,
                       eye=(10, 6.0), mouth="grin", squint=True, acc=["hoop"], lashes=True,
                       top=("straps", (230, 140, 58), None)),
    "albanese1": dict(skin="medium", hair="black", eyes="darkbrown", style="fade", fw=19.6, chin=75, cw=4.0, brow=2.6,
                      eye=(9.6, 5.2), mouth="grin", squint=True, beard="stubble", bcol=(34, 28, 36), acc=[], male=True,
                      top=("track", (47, 61, 107), None)),
    "albanese2": dict(skin="medium", hair="darkbrown", eyes="hazel", style="quiff", fw=19.6, chin=75, cw=3.8, brow=2.4,
                      eye=(9.8, 5.2), mouth="soft", squint=True, acc=[], male=True,
                      top=("collar", (244, 242, 236), None)),
    "losco": dict(skin="tan", hair="hoodie", eyes="darkbrown", style="hood", fw=19, chin=75, cw=4.0, brow=2.6,
                  eye=(9.5, 4.8), mouth="neutral", beard="stubble", acc=[], male=True,
                  top=("hoodie", (59, 63, 76), None)),
}


# ---------------------------------------------------------------- colour helpers

def mix(a, b, f):
    return tuple(a[i] + (b[i] - a[i]) * f for i in range(3))


def shade(c, f=1.0):
    """Cool, slightly saturated shadow tone, the VX Ace way."""
    return mix(c, (c[0] * 0.68, c[1] * 0.56, c[2] * 0.66 + 14), f)


def light(c, f=1.0):
    return mix(c, (255, 250, 236), 0.38 * f)


def ink(c):
    return mix((c[0] * 0.32, c[1] * 0.22, c[2] * 0.28 + 8), (34, 20, 30), 0.35)


# ---------------------------------------------------------------- shape helpers (coordinates in 96-px units)

def _blank():
    return Image.new("L", (N, N), 0)


def _mask(im):
    return np.asarray(im) > 127


def ell(cx, cy, rx, ry):
    im = _blank()
    ImageDraw.Draw(im).ellipse([(cx - rx) * SS, (cy - ry) * SS, (cx + rx) * SS, (cy + ry) * SS], fill=255)
    return _mask(im)


def poly(pts):
    im = _blank()
    ImageDraw.Draw(im).polygon([(x * SS, y * SS) for x, y in pts], fill=255)
    return _mask(im)


def bez(*p, n=28):
    t = np.linspace(0, 1, n)[:, None]
    P = np.array(p, float)
    if len(P) == 3:
        q = (1 - t) ** 2 * P[0] + 2 * (1 - t) * t * P[1] + t ** 2 * P[2]
    else:
        q = (1 - t) ** 3 * P[0] + 3 * (1 - t) ** 2 * t * P[1] + 3 * (1 - t) * t ** 2 * P[2] + t ** 3 * P[3]
    return [tuple(v) for v in q]


def stroke(pts, w, taper="none"):
    """A brush stroke along pts. taper: none | both (pointed ends) | end (pointed at the last point)."""
    im = _blank()
    d = ImageDraw.Draw(im)
    dense = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        k = max(1, int(math.hypot(x1 - x0, y1 - y0) * SS))
        dense += [(x0 + (x1 - x0) * i / k, y0 + (y1 - y0) * i / k) for i in range(k)]
    dense.append(pts[-1])
    n = len(dense)
    for i, (x, y) in enumerate(dense):
        t = i / max(1, n - 1)
        f = {"none": 1.0, "both": math.sin(math.pi * t) ** 0.6, "end": (1 - t) ** 0.7 + 0.15}[taper]
        r = max(0.35, w * f / 2) * SS
        d.ellipse([x * SS - r, y * SS - r, x * SS + r, y * SS + r], fill=255)
    return _mask(im)


def sh(m, dx, dy):
    """Mask moved by (dx, dy) 96-px units."""
    dx, dy = int(round(dx * SS)), int(round(dy * SS))
    out = np.zeros_like(m)
    out[max(dy, 0):N + min(dy, 0), max(dx, 0):N + min(dx, 0)] = m[max(-dy, 0):N + min(-dy, 0), max(-dx, 0):N + min(-dx, 0)]
    return out


def rim(m, dx, dy):
    """Pixels of m whose neighbour at (+dx, +dy) is outside m: the rim facing that direction."""
    return m & ~sh(m, -dx, -dy)


def erode(m, px):
    out = m.copy()
    for _ in range(px):
        o = out.copy()
        o[1:, :] &= out[:-1, :]; o[:-1, :] &= out[1:, :]
        o[:, 1:] &= out[:, :-1]; o[:, :-1] &= out[:, 1:]
        out = o
    return out


# ---------------------------------------------------------------- canvas

class Canvas:
    def __init__(self):
        self.rgb = np.zeros((N, N, 3), float)
        self.a = np.zeros((N, N), float)

    def fill(self, m, col, a=1.0):
        if a >= 1:
            self.rgb[m] = col
            self.a[m] = 1.0
        else:
            self.rgb[m] = self.rgb[m] * (1 - a) + np.array(col) * a

    def vgrad(self, m, c0, c1, y0, y1):
        f = np.clip((Y - y0) / (y1 - y0), 0, 1)[m][:, None]
        self.rgb[m] = np.array(c0) * (1 - f) + np.array(c1) * f
        self.a[m] = 1.0

    def cel(self, m, col, sd=(1.6, 1.3), sd2=None, hi=(-1.0, -1.1), lw=3, grad=None):
        """Flat fill (or vertical gradient), rim shadow bottom right, rim light top left, coloured line art."""
        if grad:
            self.vgrad(m, col, shade(col, grad[2]), grad[0], grad[1])
        else:
            self.fill(m, col)
        s = rim(m, *sd)
        self.fill(s, shade(col, 0.75))
        if sd2:
            self.fill(rim(m, *sd2), shade(col, 1.25))
        if hi:
            self.fill(rim(m, *hi) & ~s, light(col, 0.8))
        if lw:
            self.fill(m & ~erode(m, lw), ink(col))

    def line(self, m, col):
        self.fill(m, col)

    def image(self):
        im = Image.fromarray(np.dstack([self.rgb, self.a * 255]).clip(0, 255).astype(np.uint8), "RGBA")
        return im


# ---------------------------------------------------------------- parts

def head_masks(f):
    rx, cyb, cw = f["fw"], f["chin"], f["cw"]
    cran = ell(48, 44, rx, 24)
    left = bez((48 - rx, 42), (48 - rx + 0.3, cyb - 9), (48 - cw - 4, cyb - 0.5), (48 - cw, cyb))
    right = [(96 - x, y) for x, y in reversed(left)]
    jaw = poly(left + right)
    face = cran | jaw
    ears = ell(48 - rx, 53, 3.2, 5.6) | ell(48 + rx, 53, 3.2, 5.6)
    return face, ears


def torso(cv, f, rng, skin):
    male = f.get("male", False)
    kind, col, pat = f["top"]
    nw = 7.0 if male else 5.6
    neck = poly([(48 - nw, 60), (48 + nw, 60), (48 + nw + 1.5, 86), (48 - nw - 1.5, 86)])
    shoulders = ell(48, 106, 50 if male else 45, 28)
    cv.cel(neck, skin, sd=(1.5, 0), hi=None, lw=0)
    clothes = shoulders.copy()
    if kind in ("straps", "vneck"):
        cv.cel(shoulders, skin, sd=(1.4, 1.4), hi=(-0.8, -1), lw=3, grad=(78, 92, 0.3))
        cv.fill(stroke(bez((40, 82.5), (44, 84.5), (47, 83.5)), 0.7, "both") |
                stroke(bez((56, 82.5), (52, 84.5), (49, 83.5)), 0.7, "both"), shade(skin, 0.7))  # collarbones
        if kind == "straps":
            clothes = shoulders & (Y > 81 + 2.0 * np.cos((X - 48) / 13)) & (np.abs(X - 48) < 30)
        else:
            clothes = shoulders & ~poly([(30, 75), (48, 96), (66, 75)]) & (np.abs(X - 48) < 32)
    elif kind == "tee":
        clothes = shoulders & ~ell(48, 79, nw + 2.5, 4.6)
    elif kind in ("track", "hoodie"):  # a zip-up top with a high neck, or a hoodie whose hood is drawn as hair
        clothes = shoulders & ~ell(48, 79, nw + 1.8, 4.0)
    elif kind == "shirt":
        clothes = shoulders & ~poly([(41, 77), (48, 95), (55, 77)])
    elif kind == "collar":
        clothes = shoulders & ~poly([(43, 78), (48, 89), (53, 78)])
    elif kind == "blazer":  # pat is the shirt colour under the jacket
        shirt = shoulders & poly([(39, 74), (57, 74), (48, 97)])
        cv.cel(shirt, pat, sd=(1.0, 1.0), hi=None, lw=2)
        for s in (-1, 1):
            cv.cel(poly([(48 + s * 7, 74), (48 + s * 1.5, 84), (48 + s * 9, 82)]) & shoulders, light(pat, 0.3), sd=(0.6, 0.6), hi=None, lw=2)
        clothes = shoulders & ~poly([(40, 74), (56, 74), (48, 97)])
        pat = None
    cv.cel(clothes, col, sd=(2.0, 1.6), sd2=(3.5, 0) if kind != "straps" else None, hi=(-1, -1), lw=3,
           grad=(80, 96, 0.45))
    if kind == "blazer":
        for s in (-1, 1):  # lapels
            cv.fill(stroke([(48 + s * 8.5, 75), (48 + s * 2, 95)], 0.6), light(col, 0.6))
    pattern(cv, clothes, col, pat, rng)
    if kind == "straps":
        for s in (-1, 1):
            strap = stroke(bez((48 + s * 12.5, 73.5), (48 + s * 13.0, 78), (48 + s * 13.5, 84)), 1.8)
            cv.cel(strap & shoulders, col, sd=(0.6, 0), hi=None, lw=2)
    if kind == "tee":
        rib = ell(48, 79, nw + 3.6, 5.6) & ~ell(48, 79, nw + 2.5, 4.6) & shoulders
        cv.fill(rib, shade(col, 0.5))
        for s in (-1, 1):  # sleeve seams
            cv.fill(stroke(bez((48 + s * 30, 84), (48 + s * 33, 89), (48 + s * 34, 96)), 0.6), shade(col, 0.8))
    if kind == "track":  # a raised collar band, the zip and a white stripe down each shoulder
        cv.fill(ell(48, 79, nw + 3.2, 5.4) & ~ell(48, 79, nw + 1.8, 4.0) & shoulders, shade(col, 0.6))
        cv.fill(stroke([(48, 79.5), (48, 97)], 0.8), (232, 232, 236))
        for s in (-1, 1):
            cv.fill(stroke(bez((48 + s * 24, 82), (48 + s * 30, 88), (48 + s * 33, 98)), 1.5) & clothes, (236, 236, 240))
    if kind == "hoodie":  # two drawstrings with tips, the pocket seam low on the chest
        for s in (-1, 1):
            cv.fill(stroke(bez((48 + s * 3.6, 80.5), (48 + s * 3.0, 86), (48 + s * 3.6, 92)), 0.8), (186, 190, 200))
            cv.fill(ell(48 + s * 3.6, 92.6, 0.7, 1.0), (214, 216, 224))
        cv.fill(stroke(bez((24, 96), (48, 91.5), (72, 96)), 0.7), shade(col, 1.0))
    if kind in ("shirt", "collar"):
        lapel = (light(col, 0.35) if kind == "shirt" else (238, 242, 248))
        for s in (-1, 1):
            flap = poly([(48 + s * 7.5, 75), (48 + s * 1.5, 86 if kind == "shirt" else 84), (48 + s * 12, 85)])
            cv.cel(flap & shoulders, lapel, sd=(0.8, 0.8), hi=None, lw=2)
    return neck, shoulders, clothes


def pattern(cv, m, col, pat, rng):
    if not pat:
        return
    if pat == "plaid":  # a flannel shirt over a black hoodie: dark checks, the hood around the neck
        for x0 in np.arange(12, 90, 7):
            cv.fill(m & (np.abs(X - x0) < 1.3), shade(col, 1.2))
        for y0 in np.arange(80, 98, 6):
            cv.fill(m & (np.abs(Y - y0) < 1.1), shade(col, 1.4))
        cv.fill(m & (np.abs(Y - 89) < 0.35), (230, 222, 200))
        hood = ell(48, 80, 14, 6.5) & ~ell(48, 79, 9.5, 4.6)
        cv.cel(hood, (30, 28, 32), sd=(1, 1), hi=None, lw=2)
        return
    if pat == "vest":  # a brown fleece vest open over the tee
        vest = m & (np.abs(X - 48) > 9)
        cv.cel(vest, (122, 84, 46), sd=(1.4, 1.2), hi=(-0.8, -0.8), lw=2)
        return
    if pat == "stripes":
        for x0 in np.arange(10, 90, 3.2):
            band = m & (np.abs(X - x0 - (Y - 80) * 0.12) < 0.45)
            cv.fill(band, mix(col, (255, 255, 255), 0.55))
        return
    if pat == "buttons":
        for y in (88.5, 93):
            b = ell(48, y, 1.1, 1.1) & m
            cv.fill(b, (150, 122, 90))
        return
    if pat == "logo":
        plate = poly([(38, 87), (58, 85), (58.5, 91), (38.5, 93)]) & m
        cv.fill(plate, (34, 34, 40))
        cv.fill(plate & (np.abs(Y - (89.2 - (X - 48) * 0.1)) < 0.55) & (np.abs(X - 48.3) < 7.5), (240, 240, 236))
        return
    pal = {
        "hawaii": [(244, 226, 224), (230, 150, 160), (250, 236, 220)],
        "floral": [(214, 92, 104), (236, 196, 120), (196, 120, 170)],
        "ditsy": [(214, 150, 140), (236, 220, 200)],
        "ditsy-light": [(250, 246, 220), (190, 150, 40)],
    }[pat]
    leaf = (70, 120, 72) if pat in ("hawaii", "floral") else None
    big = pat in ("hawaii", "floral")
    ys, xs = np.nonzero(m)
    if len(xs) == 0:
        return
    for _ in range(70 if big else 140):
        i = rng.randrange(len(xs))
        cx, cy = xs[i] / SS, ys[i] / SS
        if leaf and rng.random() < 0.35:
            a = rng.uniform(0, math.pi)
            lf = stroke([(cx - math.cos(a) * 2, cy - math.sin(a) * 2), (cx + math.cos(a) * 2, cy + math.sin(a) * 2)], 1.6,
                        "both")
            cv.fill(lf & m, leaf)
            continue
        c = pal[rng.randrange(len(pal))]
        if big:
            r = rng.uniform(1.4, 2.1)
            fl = np.zeros_like(m)
            for k in range(5):
                a = k * 2 * math.pi / 5 + rng.random()
                fl |= ell(cx + math.cos(a) * r * 0.8, cy + math.sin(a) * r * 0.8, r * 0.6, r * 0.6)
            cv.fill(fl & m, c)
            cv.fill(ell(cx, cy, 0.5, 0.5) & m, (240, 200, 90))
        else:
            cv.fill(ell(cx, cy, 0.45, 0.45) & m, c)


def eye(cv, f, cx, side, skin):
    w, h = f["eye"]
    cy = 52
    iris_c = EYES[f["eyes"]]
    lash = ink(HAIR[f["hair"]]) if f.get("male") else (36, 22, 30)
    sclera = ell(cx, cy, w / 2, h / 2) & (Y > cy - h / 2 + 0.6 + 0.08 * (X - cx) * side)
    cv.fill(sclera, (252, 250, 246))
    cv.fill(sclera & (Y < cy - h / 2 + 1.6), (214, 206, 214))  # lid shadow
    ir = h * 0.48
    iris = ell(cx - side * 0.3, cy + 0.2, ir * 0.82, ir) & sclera
    cv.vgrad(iris, shade(iris_c, 0.9), light(iris_c, 0.5), cy - ir, cy + ir)
    cv.fill(ell(cx - side * 0.3, cy + 0.4, ir * 0.42, ir * 0.5) & sclera, (26, 16, 20))
    cv.fill(ell(cx - side * 0.3 - 1.0, cy - 0.9, 0.75, 0.75) & sclera, (255, 255, 255))
    cv.fill(ell(cx - side * 0.3 + 1.1, cy + 1.3, 0.4, 0.4) & sclera, (236, 236, 250))
    inner, outer = cx - side * w / 2, cx + side * w / 2
    upper = stroke(bez((inner + side * 0.2, cy - 0.3), (cx, cy - h / 2 - 1.3), (outer + side * 1.0, cy - 0.2)),
                   1.5 if f.get("male") else 1.8, "end" if side > 0 else "none")
    cv.fill(upper, lash)
    if f.get("lashes"):
        cv.fill(stroke([(outer + side * 0.4, cy - 1.0), (outer + side * 1.8, cy - 2.2)], 0.9, "end"), lash)
    low_y = cy + h / 2 - (1.1 if f.get("squint") else 0.3)
    lower = stroke(bez((inner + side * 1.5, low_y - 0.4), (cx, low_y + 0.5), (outer - side * 0.5, low_y - 0.5)), 0.7)
    cv.fill(lower, shade(skin, 1.6))
    if f.get("squint"):
        cheek = ell(cx, cy + h / 2 + 1.7, w / 2 + 1, 2.0) & ~lower
        cv.fill(cheek & (Y > low_y), skin)


def brow(cv, f, cx, side):
    hc = HAIR[f["hair"]]
    col = f.get("browcol") or (ink(hc) if f["hair"] != "greybrown" else shade(hc, 1.4))
    cy = 52 - f["eye"][1] / 2 - 3.4
    inner, outer = cx - side * 5.2, cx + side * 5.6
    pts = bez((inner, cy + 0.6), (cx - side * 0.5, cy - 1.4), (outer, cy + 0.6))
    cv.fill(stroke(pts, f["brow"], "end" if side > 0 else "none"), col)
    if side < 0:  # left brow drawn from outer to inner keeps the thick end inside
        pass


def nose(cv, skin):
    s = shade(skin, 1.0)
    cv.fill(stroke(bez((50.0, 53.5), (51.0, 57.5), (50.0, 60.5)), 1.0, "both"), shade(skin, 0.55))
    cv.fill(stroke(bez((45.8, 60.4), (48.2, 61.6), (50.6, 60.4)), 0.9), s)
    cv.fill(ell(46.3, 60.0, 0.55, 0.45) | ell(50.3, 60.0, 0.55, 0.45), shade(skin, 1.5))
    cv.fill(ell(48.0, 57.4, 0.6, 1.2), light(skin, 0.7))


def mouth(cv, f, skin):
    kind = f["mouth"]
    lip = f.get("lip") or mix(shade(skin, 1.3), (180, 70, 80), 0.35)
    my = 66.0 if f["chin"] >= 73 else 65.0
    if kind == "grin":
        top = bez((41.0, my - 1.4), (48, my + 0.2), (55.0, my - 1.4))
        bot = bez((55.0, my - 1.4), (48, my + 6.4), (41.0, my - 1.4))
        m = poly(top + bot)
        cv.fill(m, (110, 40, 50))
        teeth = m & (Y < my + 1.9)
        cv.fill(teeth, (252, 250, 246))
        cv.fill(m & (Y > my + 3.6), (204, 100, 108))
        cv.fill(m & ~erode(m, 2), (90, 30, 40))
        cv.fill(stroke(bez((44.5, my + 6.6), (48, my + 7.6), (51.5, my + 6.6)), 0.8), shade(skin, 0.7))
        for s in (-1, 1):  # smile creases
            cv.fill(stroke(bez((48 + s * 7.8, my - 3.0), (48 + s * 8.6, my - 1.2), (48 + s * 7.6, my + 0.6)), 0.6, "both"),
                    shade(skin, 0.6))
    elif kind == "smile":
        cv.fill(stroke(bez((43.5, my - 0.6), (48, my + 1.6), (52.5, my - 0.6)), 1.0, "both"), lip)
        cv.fill(stroke(bez((45.5, my + 2.6), (48, my + 3.2), (50.5, my + 2.6)), 0.8), shade(skin, 0.6))
    elif kind == "soft":
        cv.fill(stroke(bez((44.5, my), (48, my + 0.9), (51.5, my - 0.2)), 1.0, "both"), lip)
        cv.fill(stroke(bez((46, my + 2.4), (48, my + 2.9), (50, my + 2.4)), 0.8), shade(skin, 0.6))
    else:
        cv.fill(stroke([(45.0, my + 0.3), (51.0, my + 0.3)], 0.9, "both"), lip)
        cv.fill(stroke(bez((45.5, my + 2.2), (48, my + 2.8), (50.5, my + 2.2)), 1.2), mix(skin, (220, 120, 120), 0.3))


def beard(cv, f, face, skin, rng):
    kind = f.get("beard")
    if not kind:
        return
    hc = HAIR[f["hair"]]
    rx = f["fw"]
    my = 66.0 if f["chin"] >= 73 else 65.0
    grey = f.get("bcol") or (70, 62, 70)
    if kind == "stubble":
        top = 61 - 9 * np.clip(np.abs(X - 48) / rx, 0, 1) ** 1.4
        m = face & (Y > top) & ~ell(48, my + 1.4, 6.4, 3.4)
        noise = np.random.default_rng(rng.randrange(1 << 30)).random((N, N)) < 0.4
        cv.fill(m, mix(skin, grey, 0.12))
        cv.fill(m & noise, mix(skin, grey, 0.24))
        cv.fill(stroke(bez((42.5, my - 2.6), (48, my - 3.8), (53.5, my - 2.6)), 1.2, "both"), mix(skin, grey, 0.26))
        return
    if kind == "goatee":  # a moustache and a pointed tuft on the chin
        col = f.get("bcol") or mix(HAIR[f["hair"]], (96, 70, 56), 0.2)
        tuft = (face & ell(48, f["chin"] - 2.2, 4.6, 4.4) & (Y > my + 2.2)) | stroke(bez((46, my + 3), (48, f["chin"] + 1.2), (50, my + 3)), 2.0)
        cv.cel(tuft, col, sd=(0.6, 0.8), hi=None, lw=2)
        must = stroke(bez((42, my - 0.4), (45, my - 3.2), (48, my - 2.6)), 1.8, "end") | stroke(bez((54, my - 0.4), (51, my - 3.2), (48, my - 2.6)), 1.8, "end")
        cv.cel(must, col, sd=(0, 0.8), hi=None, lw=2)
        return
    full = kind == "full"
    grow = ell(48, f["chin"] - (0.5 if full else 2.5), rx - (6 if full else 9.5), 6.5 if full else 3.2)
    top = np.array([[0.0]]) + np.vectorize(lambda x: top_at(x, rx, full))(X[0])[None, :]
    hole = ell(48, my + 1.0, 3.0, 1.2) if f["mouth"] != "grin" else ell(48, my + 1.8, 7.2, 4.4)
    m = ((face | grow) & (Y > top)) & ~hole
    col = f.get("bcol") or (mix(hc, (96, 70, 56), 0.25) if full else mix(mix(hc, (96, 70, 56), 0.3), skin, 0.12))
    cv.cel(m, col, sd=(1.6, 1.6), hi=(-0.8, -1.0), lw=3, grad=(52, f["chin"] + 6, 0.5))
    # cheek edge fades into the skin, then a few hair strokes for texture
    edge = m & ~sh(m, 0, -1.2) & ~erode(m, 6)
    cv.fill(edge & (Y < my), mix(col, skin, 0.45))
    tex = np.zeros_like(m)
    for _ in range(26):
        x0 = rng.uniform(48 - rx + 3, 48 + rx - 3)
        y0 = rng.uniform(top_at(x0, rx, full), f["chin"] + 2)
        tex |= stroke([(x0, y0), (x0 + (x0 - 48) * 0.06, y0 + 2.4)], 0.55, "both")
    cv.fill(tex & erode(m, 3), shade(col, 1.0))
    must = stroke(bez((41.5, my - 0.6), (45, my - 3.4), (48, my - 2.6)), 2.2, "end") | \
        stroke(bez((54.5, my - 0.6), (51, my - 3.4), (48, my - 2.6)), 2.2, "end")
    cv.cel(must, col, sd=(0, 1.0), hi=None, lw=2)


def top_at(x, rx, full):
    """Upper edge of the beard: high at the sideburns, at the upper lip in the middle."""
    return (61 if full else 63.5) - (10 if full else 9) * min(1.0, abs(x - 48) / rx) ** 1.6


# ---------------------------------------------------------------- hair

def cap(fw, top=17.0, extra=2.5):
    return ell(48, 44, fw + extra, 44 - top)


def hairline(curve):
    return Y < curve


def strands(cv, m, col, paths, w=0.55):
    for p in paths:
        cv.fill(stroke(p, w, "both") & m, shade(col, 0.95))


def shine(cv, m, col, y0):
    """A broken arc of short light streaks across the crown, like painted hair gloss."""
    inner = erode(m, 5)
    for k, x0 in enumerate(np.arange(32, 65, 2.6)):
        y = y0 + 0.016 * (x0 - 46) ** 2
        dx = (x0 - 46) * 0.06
        ln = 2.6 if k % 2 == 0 else 1.6
        pts = [(x0 - dx * ln, y - ln * 0.8), (x0 + dx * ln, y + ln * 0.8)]
        cv.fill(stroke(pts, 0.9, "both") & inner, light(col, 0.9 if k % 2 == 0 else 0.55))


def ombre(cv, m, col, y0):
    """Sun-bleached ends: blend the lower hair towards col."""
    t = (np.clip((Y - y0) / 30, 0, 1) * 0.8)[m][:, None]
    cv.rgb[m] = cv.rgb[m] * (1 - t) + np.array(col) * t


def locks(roots, tip, ctrl, w):
    """Union of tapered locks from each root towards tip(root) through ctrl(root)."""
    m = np.zeros((N, N), bool)
    for r in roots:
        m |= stroke(bez(r, ctrl(r), tip(r)), w, "end")
    return m


def curtain(s, fw, y0, y1, out, wave, inner=2.5, spread=0.25):
    """A side lock of long hair on side s (-1 left, 1 right): inner edge over the face edge, wavy outer edge."""
    ys = np.linspace(y0, y1, 40)
    inn = [(48 + s * (fw - inner + max(0, y - 60) * spread), y) for y in ys]
    outr = [(48 + s * (fw + out + 1.2 * math.sin((y - y0) / (y1 - y0) * math.pi) + wave * math.sin(y * 0.42)), y)
            for y in ys]
    return poly(inn + outr[::-1])


def hair(f, rng):
    """Returns (back, front, draw_extra) for the face's hair style."""
    st, fw = f["style"], f["fw"]
    hc = HAIR[f["hair"]]
    paths, extras = [], []
    back = None
    if st == "bun":
        c = cap(fw, 18, 1.8)
        front = c & hairline(31 + 9 * np.clip(np.abs(X - 48) / fw, 0, 1) ** 2.2)
        front |= c & (np.abs(X - 48) > fw - 2.5) & (Y < 47)
        bun = ell(51, 15.5, 8.5, 7.0) | ell(46, 17.5, 6, 4.5)
        front |= bun
        for x0 in (33, 41, 55, 63):
            paths.append(bez((x0, 33 + abs(x0 - 48) * 0.25), ((x0 + 50) / 2, 26), (50, 20)))
        paths += [bez((45, 16), (51, 11), (57, 15))]
        if f.get("messy"):  # loose tufts round the knot and a few wisps at the temples
            for cx, cy, r in ((41.5, 13.5, 2.6), (60.5, 12.5, 2.4), (58.5, 18.5, 2.2), (43, 19.5, 2.0)):
                front |= ell(cx, cy, r, r * 0.85)
            front |= stroke(bez((32, 33), (29.5, 40), (31.5, 50)), 1.4, "end") | stroke(bez((63, 33), (66, 40), (64.5, 50)), 1.4, "end")
        front |= stroke(bez((31, 31), (28.5, 38), (30, 46)), 1.3, "end") | stroke(bez((64, 30), (68, 36), (67, 44)), 1.2, "end")
    elif st == "swept":
        c = ell(48, 42, fw + 2.5, 26)
        hl = 27.0 + 2.2 * np.cos((X - 48) * 0.5) + 13 * np.clip(np.abs(X - 48) / fw, 0, 1) ** 2.0
        front = c & hairline(hl)
        roots = [(x, 27.5 + 13 * min(1, abs(x - 48) / fw) ** 2.0 - 0.5) for x in np.arange(30, 67, 3.0)]
        front |= locks(roots, lambda r: (48 + (r[0] - 48) * 1.18 + 3, 10.5 + abs(r[0] - 48) * 0.22),
                       lambda r: (r[0] + (r[0] - 48) * 0.1 - 1, 21), 5.0) & ell(49, 39, fw + 3.2, 25.5)
        front |= c & (np.abs(X - 48) > fw - 1.5) & (Y < 46)
        front |= stroke(bez((51, 21), (45, 28), (43.5, 35.5)), 2.0, "end") | stroke(bez((56, 22), (55, 28), (56.5, 33)), 1.4, "end")
        for x0 in (34, 40, 46, 52, 58, 62):
            paths.append(bez((x0, 31 + abs(x0 - 48) * 0.2), (x0 + (x0 - 48) * 0.1, 22), (x0 + 4, 12)))
    elif st == "curls":
        back = ell(48, 40, fw + 7.5, 27) & (Y < 58)
        front = np.zeros((N, N), bool)
        curls = []
        for rad, cyo, rr, cnt in ((fw + 5.0, 42, (4.2, 5.2), 17), (fw - 1.0, 40, (3.8, 4.8), 12),
                                  (fw - 8.0, 36, (3.6, 4.4), 7)):
            for k in range(cnt):
                a = math.pi * (1.04 + 0.92 * k / (cnt - 1)) + rng.uniform(-0.03, 0.03)
                curls.append((48 + math.cos(a) * rad, cyo + math.sin(a) * (rad + 3.5), rng.uniform(*rr)))
        for cx in (35, 41, 47, 53, 59):
            curls.append((cx + rng.uniform(-0.8, 0.8), 32.5 + rng.uniform(-0.8, 0.8), rng.uniform(2.8, 3.5)))
        curls += [(27.5, 48, 3.6), (68.5, 48, 3.6), (27, 41, 4.0), (69, 41, 4.0)]
        curls += [(44, 28.5, 3.8), (52, 28.5, 3.8), (48, 26, 4.0), (38, 29.5, 3.4), (58, 29.5, 3.4)]  # close the crown over the forehead
        for cx, cy, r in curls:
            front |= ell(cx, cy, r, r * 0.92)
        extras.append(("curls", curls))
    elif st == "quiff":
        c = cap(fw, 20, 1.2)
        front = c & hairline(33 + 11 * np.clip(np.abs(X - 48) / fw, 0, 1) ** 2.4)
        roots = [(x, 33.5) for x in np.arange(36, 61, 3.0)]
        front |= locks(roots, lambda r: (r[0] + 4.5, 17.5 - (r[0] - 48) * 0.05), lambda r: (r[0] - 1.5, 24), 4.4) & \
            ell(48.5, 33, fw + 0.5, 15)
        front |= c & (np.abs(X - 48) > fw - 2.0) & (Y < 50)
        for x0 in (38, 44, 50, 56):
            paths.append(bez((x0, 32), (x0 - 1, 24), (x0 + 4, 18)))
    elif st == "tousle":  # a tousled mass swept up and back; vol = height, drop = how far the temples come down
        vol = f.get("vol", 1.0)
        top = 15.0 - 5.0 * vol
        c = ell(48, 42, fw + 3.0, 42 - top)
        hl = 29.5 + 2.5 * np.cos((X - 48) * 0.5) + f.get("drop", 12) * np.clip(np.abs(X - 48) / fw, 0, 1) ** 2.0
        front = c & hairline(hl)
        front |= c & (np.abs(X - 48) > fw - 1.8) & (Y < 46)
        if f.get("bumps"):  # short curls along the crown
            for x0 in np.arange(33, 64, 4.2):
                yy = 42 - (42 - top) * math.sqrt(max(0.0, 1 - ((x0 - 48) / (fw + 3.0)) ** 2))
                front |= ell(x0 + rng.uniform(-0.6, 0.6), yy + 2.0, 3.4, 3.0)
        else:  # wavy lobes, uneven in height, so the crown reads as loose hair and not as spikes
            for x0 in np.arange(31, 66, 5.0):
                yy = 42 - (42 - top) * math.sqrt(max(0.0, 1 - ((x0 - 48) / (fw + 3.0)) ** 2))
                front |= ell(x0 + rng.uniform(-0.8, 0.8), yy + rng.uniform(0.6, 2.4), rng.uniform(4.4, 5.6), rng.uniform(3.6, 4.8))
        if f.get("fringe"):
            front |= stroke(bez((50, 19), (40, 24), (35.5, 36)), 4.2, "end")
        front |= stroke(bez((30.5, 33), (27.5, 40), (29.5, 47)), 2.2, "end") | \
            stroke(bez((65.5, 33), (68.5, 40), (66.5, 47)), 2.2, "end")
        for x0 in (34, 40, 46, 52, 58, 62):
            paths.append(bez((x0, 30 + abs(x0 - 48) * 0.2), (x0 + (x0 - 48) * 0.1, 22), (x0 + 3, top + 4)))
    elif st == "sidepart":
        c = cap(fw, 20.5, 0.8)
        # the fringe sweeps from the part down towards the right temple, the left temple recedes a little
        hl = np.where(X < 40, 31.5 + 5 * np.clip((40 - X) / 12, 0, 1) ** 1.5, 31 + (X - 40) * 0.27 + 1.2 * np.sin(X * 0.9))
        front = c & hairline(hl)
        roots_r = [(40.5, y) for y in np.arange(20.5, 31, 1.5)]
        front |= locks(roots_r, lambda r: (69.0, 33 + (r[1] - 21) * 1.0), lambda r: (55, r[1] - 3.0), 3.4) & \
            ell(48.5, 41, fw + 2.0, 22.5)
        roots_l = [(39.5, y) for y in np.arange(21, 32, 2.2)]
        front |= locks(roots_l, lambda r: (28.0, 38 + (r[1] - 22) * 0.6), lambda r: (31, r[1] - 1.0), 3.0) & \
            ell(48.5, 41, fw + 2.0, 22.5)
        front |= c & (np.abs(X - 48) > fw - 1.6) & (Y > 34) & (Y < 46) & (np.abs(X - 48) < fw + 0.6)
        extras.append(("part", stroke([(39.6, 20), (40.4, 30)], 0.6)))
        for y0 in (21, 23.5, 26, 28.5):
            paths.append(bez((42, y0), (55, y0 - 2.0), (67, y0 + 8)))
        for y0 in (23, 27):
            paths.append(bez((38, y0), (33, y0 + 2), (29, y0 + 10)))
    elif st in ("longwavy", "longblack"):
        big = st == "longblack"
        px = f.get("part", 44 if not big else 53)
        sp = 8.5 if big else 6
        wave = 1.4 if big else 1.1
        ys = np.linspace(44, 97, 30)
        back = poly([(48 - fw - sp - 2 * math.sin((y - 44) / 20) - wave * math.sin(y * 0.42), y) for y in ys] +
                    [(48 + fw + sp + 2 * math.sin((y - 44) / 20) + wave * math.sin(y * 0.42 + 1), y) for y in ys[::-1]])
        back |= ell(48, 42, fw + sp, 28)
        c = cap(fw, 16, 3.5)
        front = c & hairline(27 + 2.4 * np.abs(X - px) ** 0.5 + 8 * np.clip(np.abs(X - 48) / fw, 0, 1) ** 2)
        front |= curtain(-1, fw, 30, 92 if big else 88, sp - 1, wave, inner=2.5 if big else 2.0)
        front |= curtain(1, fw, 30, 94 if big else 86, sp - 1, wave, inner=4.5 if big else 2.0)
        front |= c & (np.abs(X - 48) > fw - 3) & (Y < 50)
        for s in (-1, 1):
            for k in range(3):
                x0 = 48 + s * (fw + 0.5 + k * 2.0)
                paths.append(bez((x0 - s * 1.5, 32), (x0 + s * 3, 50), (x0 - s * 2, 68), (x0 + s * 2, 88)))
        for k in range(5):
            tx = 30 + k * 9
            paths.append(bez((px, 18), ((px + tx) / 2, 20), (tx, 31 + abs(tx - 48) * 0.1)))
    elif st in ("longstraight", "fringe"):  # fringe: the same long straight hair with a blunt fringe straight across the brow
        back = poly([(48 - fw - 5, 44), (48 - fw - 6.5, 97), (48 + fw + 6.5, 97), (48 + fw + 5, 44)]) | ell(48, 42, fw + 5, 27)
        px = f.get("part", 48)
        c = cap(fw, 17, 3.0)
        front = c & hairline(41.2 + 0.006 * (X - 48) ** 2 if st == "fringe" else 26.5 + 1.7 * np.abs(X - px) ** 0.7)
        front |= curtain(-1, fw, 30, 96, 4.5, 0.0, inner=2.2, spread=0.12)
        front |= curtain(1, fw, 30, 96, 4.5, 0.0, inner=2.2, spread=0.12)
        front |= c & (np.abs(X - 48) > fw - 3) & (Y < 50)
        for s in (-1, 1):
            for k in range(3):
                x0 = 48 + s * (fw + 0.8 + k * 1.8)
                paths.append([(x0 - s * 0.8, 36), (x0, 62), (x0 + s * 0.6, 96)])
            for k in range(3):
                if st == "fringe":
                    x0 = 48 + s * (5 + k * 5.5)
                    paths.append([(x0, 19 + k), (x0 + s * 0.5, 41)])
                else:
                    paths.append(bez((px, 19), (px + s * (8 + k * 2), 21), (48 + s * (18 + k * 0.5), 31 + k)))
        if st != "fringe":
            extras.append(("part", stroke([(px, 17.5), (px, 23)], 0.6)))
    elif st == "fade":  # short on top, the temples and sides cut to a soft shadow of stubble
        c = cap(fw, 20, 1.0)
        front = c & hairline(30 + 6 * np.clip(np.abs(X - 48) / fw, 0, 1) ** 2.2)
        front |= c & (np.abs(X - 48) > fw - 1.0) & (Y < 40)
        extras.append(("fade", ell(48, 46, fw + 1.0, 20) & (np.abs(X - 48) > fw - 6.0) & (Y > 29) & (Y < 54)))
        for x0 in (36, 42, 48, 54, 60):
            paths.append(bez((x0, 31 + abs(x0 - 48) * 0.15), (x0 + (x0 - 48) * 0.05, 25), (x0 + 1, 20)))
    elif st == "hood":  # a hood up: a deep cowl round the face, a fold of cloth round the neck
        front = (ell(48, 42, fw + 8.5, 34) & (Y < 78) & ~ell(48, 58.5, fw - 3.8, 21.5)) | \
            (ell(48, 80, fw + 7, 8.5) & ~ell(48, 76, fw - 7, 7.5))
        for s in (-1, 1):
            paths.append(bez((48 + s * 3, 8), (48 + s * 17, 11), (48 + s * 23.5, 40)))
            paths.append(bez((48 + s * 8, 9), (48 + s * 20, 16), (48 + s * 24.5, 54)))
            paths.append(bez((48 + s * 25, 56), (48 + s * 24, 68), (48 + s * 22, 78)))
    elif st == "bob":
        back = ell(48, 47, fw + 6.5, 26) & (Y < 71)
        c = cap(fw, 16, 4.0)
        bang = 42.0 + 0.5 * np.sin(X * 1.9) + 0.012 * (X - 48) ** 2
        front = (c & (Y < bang)) | (c & (np.abs(X - 48) > fw - 3.0) & (Y < 60))
        for s in (-1, 1):
            front |= poly([(48 + s * (fw + 6), 40), (48 + s * (fw + 6.5), 66), (48 + s * (fw + 3), 71),
                           (48 + s * (fw - 3.5), 70), (48 + s * (fw - 2), 56), (48 + s * (fw - 2.5), 44)])
        for k in range(6):
            x0 = 35 + k * 5.2
            paths.append(bez((48 + (x0 - 48) * 0.3, 20), (x0, 30), (x0 + 0.3, 41)))
        for s in (-1, 1):
            for k in range(2):
                x0 = 48 + s * (fw + k * 3)
                paths.append(bez((x0 - s * 2, 32), (x0 + s * 1.5, 50), (x0 + s * 0.6, 69)))
    elif st == "ponytail":
        back = stroke(bez((62, 26), (77, 33), (75, 56), (70, 76)), 7.5, "end")
        c = cap(fw, 18, 2.0)
        front = c & hairline(30 + 9 * np.clip(np.abs(X - 48) / fw, 0, 1) ** 2)
        front |= poly(bez((38, 21), (31, 29), (30.5, 44)) + [(33.5, 44), (36, 33), (52, 25)])
        front |= c & (np.abs(X - 48) > fw - 2.0) & (Y < 48)
        extras.append(("tie", ell(64.5, 27.5, 2.4, 2.4)))
        for x0 in (34, 42, 50, 58):
            paths.append(bez((x0, 31), (x0 + 6, 24), (62, 26)))
    else:
        raise ValueError(f"unknown hair style {st}")
    return back, front, paths, extras, hc


# ---------------------------------------------------------------- accessories

def glasses(cv, f, which):
    if which == "glasses":
        frame = f.get("gframe", (70, 44, 34))
        t = f.get("gthick", 1.1)
        for cx in (38, 58):
            ring = ell(cx, 52, 6.4, 5.6) & ~ell(cx, 52, 6.4 - t, 5.6 - t * 0.8)
            cv.fill(ell(cx, 52, 6.4 - t, 5.6 - t * 0.8), (220, 232, 240), 0.18)
            cv.fill(ring, frame)
            cv.fill(ring & (Y < 49) & (X < cx), light(frame, 0.5) if "gframe" in f else (150, 104, 80))
        cv.fill(stroke(bez((43.6, 51), (48, 49.5), (52.4, 51)), 0.9), frame)
        cv.fill(stroke([(31.6, 51), (48 - f["fw"] + 0.5, 50)], 0.9) | stroke([(64.4, 51), (48 + f["fw"] - 0.5, 50)], 0.9),
                frame)
    elif which == "aviator":  # teardrop lenses, thin gold frame and double bridge
        gold = (206, 176, 96)
        for cx in (38.5, 57.5):
            narrow = 7.6 * (1 - 0.3 * np.clip((Y - 48) / 11, 0, 1))
            lens = ell(cx, 52.0, 7.6, 6.6) & (np.abs(X - cx) < narrow) & (Y > 46.4)
            cv.vgrad(lens, (34, 38, 38), (92, 96, 94), 46, 59)
            cv.fill(lens & (np.abs((X - cx) + (Y - 51) * 1.1 + 2.5) < 0.9), (170, 176, 170))
            cv.fill(lens & ~erode(lens, 2), gold)
        cv.fill(stroke(bez((45.6, 49.2), (48, 47.6), (50.4, 49.2)), 0.7) | stroke([(45.8, 51.6), (50.2, 51.6)], 0.6), gold)
        cv.fill(stroke([(31, 49.5), (48 - f["fw"] + 0.5, 49.5)], 0.7) | stroke([(65, 49.5), (48 + f["fw"] - 0.5, 49.5)], 0.7), gold)
    elif which == "sunglasses":
        frame = (24, 20, 28)
        for cx in (38.5, 57.5):
            lens = ell(cx, 52.5, 7.2, 5.6) & (Y > 47.6)
            cv.vgrad(lens, (30, 28, 44), (70, 60, 84), 47, 58)
            cv.fill(lens & (np.abs((X - cx) + (Y - 52) * 0.9 + 2) < 0.9), (150, 144, 170))
            cv.fill(lens & ~erode(lens, 3), frame)
        cv.fill(stroke([(45.3, 50.5), (50.7, 50.5)], 1.2), frame)
        cv.fill(stroke([(31.5, 50), (48 - f["fw"] + 0.5, 49.5)], 1.2) | stroke([(64.5, 50), (48 + f["fw"] - 0.5, 49.5)], 1.2),
                frame)
    elif which == "shades-on-head":
        frame = (24, 20, 28)
        band = stroke(bez((26, 34), (48, 22), (70, 34)), 1.3)
        cv.fill(band, frame)
        for cx, cy in ((38.5, 26.5), (57.5, 26.5)):
            lens = ell(cx, cy, 6.6, 3.8)
            cv.vgrad(lens, (36, 34, 50), (78, 70, 96), cy - 4, cy + 4)
            cv.fill(lens & ~erode(lens, 3), frame)
            cv.fill(lens & (np.abs((X - cx) + (Y - cy) * 0.9 + 1.5) < 0.7), (160, 154, 180))


# ---------------------------------------------------------------- the portrait

def draw_cat():
    """Gatto di Paz: a calico (white, orange and brown tabby patches) with green eyes, same painting style."""
    white, orange, brown = (246, 240, 230), (226, 140, 66), (110, 78, 56)
    cv = Canvas()
    body = ell(48, 98, 34, 27)
    head = ell(48, 52, 25, 20.5) | ell(48, 60, 20, 14)
    ears = poly([(26, 46), (27, 20), (44, 35)]) | poly([(70, 46), (69, 20), (52, 35)])
    cv.cel(body, white, sd=(2, 1.6), hi=(-1, -1), lw=3, grad=(74, 96, 0.4))
    cv.fill(body & ell(72, 92, 14, 12), orange)
    cv.fill(body & ell(28, 96, 12, 10), brown)
    cv.fill(head & sh(head, 0, 3) & body & ~head, shade(white, 1.0))
    cv.cel(ears, white, sd=(1, 1), hi=None, lw=3)
    cv.fill(ears & (X < 48), orange)
    cv.fill(ears & (X > 48), brown)
    cv.fill(poly([(29, 42), (29.5, 26), (40, 36)]) | poly([(67, 42), (66.5, 26), (56, 36)]), (238, 160, 168))
    cv.cel(head, white, sd=(1.8, 1.4), hi=(-0.9, -0.9), lw=3, grad=(32, 74, 0.2))
    # calico patches: orange over the left eye and ear, brown tabby over the right, a white blaze down the nose
    left = head & ell(33, 40, 15, 13) & ~ell(48, 50, 5, 30)
    right = head & ell(63, 40, 15, 12) & ~ell(48, 50, 5, 30)
    cv.fill(left, orange)
    cv.fill(rim(left, 1.6, 1.4), shade(orange, 0.7))
    cv.fill(right, brown)
    for k in range(4):  # tabby stripes
        cv.fill(stroke(bez((56 + k * 3.5, 30), (57 + k * 3.5, 36), (55 + k * 4, 41)), 1.1, "both") & right, shade(brown, 1.2))
    cv.fill(stroke(bez((26, 54), (30, 58), (29, 63)), 1.0, "both") & head, shade(orange, 0.6))
    # eyes: green, vertical pupils, big highlights
    for cx, side in ((39, -1), (57, 1)):
        e = ell(cx, 51, 5.2, 4.6)
        cv.vgrad(e, (92, 150, 70), (176, 214, 96), 47, 56)
        cv.fill(ell(cx, 51.2, 1.1, 3.8), (20, 20, 18))
        cv.fill(ell(cx - 1.6, 49.2, 1.1, 1.1), (255, 255, 255))
        cv.fill(e & ~erode(e, 3), (40, 30, 26))
        cv.fill(stroke(bez((cx - side * 5.5, 51), (cx, 45.2), (cx + side * 6.2, 49.5)), 1.4, "end" if side > 0 else "none"), (40, 30, 26))
    # muzzle, nose, mouth, whiskers
    cv.fill(ell(44.5, 62, 4.6, 3.4) | ell(51.5, 62, 4.6, 3.4), (252, 250, 246))
    cv.fill(poly([(45.6, 57.4), (50.4, 57.4), (48, 60.2)]), (226, 120, 136))
    cv.fill(stroke(bez((48, 60), (48, 61.5), (45.5, 63)), 0.6) | stroke(bez((48, 60), (48, 61.5), (50.5, 63)), 0.6), (90, 60, 60))
    for s in (-1, 1):
        for k in range(3):
            cv.fill(stroke(bez((48 + s * 7, 61 + k * 1.4), (48 + s * 14, 60 + k * 2.2), (48 + s * 21, 59 + k * 3.4)), 0.45),
                    (250, 250, 250))
    return finish(cv.image())


def draw(pid):
    if pid == "gatto":
        return draw_cat()
    f = FACES[pid]
    rng = random.Random(f"portrait-{pid}")
    skin = SKIN[f["skin"]]
    cv = Canvas()
    back, front, paths, extras, hc = hair(f, rng)
    face, ears = head_masks(f)
    if back is not None:
        cv.cel(back, shade(hc, 0.55), sd=(2, 1.5), hi=None, lw=3, grad=(30, 96, 0.6))
        strands(cv, back, shade(hc, 0.55), paths[: len(paths) // 2], 0.6)
        if f.get("ombre"):
            ombre(cv, back, shade(f["ombre"], 0.5), 58)
    neck, shoulders, clothes = torso(cv, f, rng, skin)
    if "necklace" in f["acc"]:
        cv.fill(stroke(bez((41, 76), (48, 87), (55, 76)), 0.55) & ~clothes, (214, 178, 90))
        cv.fill(ell(48, 86.6, 0.8, 0.9), (236, 206, 120))
    if "chain" in f["acc"]:
        cv.fill(stroke(bez((40.5, 78), (48, 90), (55.5, 78)), 0.65), (196, 198, 206))
        cv.fill(ell(48, 90.6, 1.2, 1.6), (220, 222, 230))
    if "goldchain" in f["acc"]:  # two gold chains, the short one with a small pendant
        cv.fill(stroke(bez((40, 76), (48, 85), (56, 76)), 0.7), (222, 184, 96))
        cv.fill(stroke(bez((42, 78), (48, 92), (54, 78)), 0.55), (236, 204, 120))
        cv.fill(ell(48, 92.0, 0.9, 1.3), (236, 206, 120))
    cv.cel(ears, skin, sd=(0.8, 0.8), hi=None, lw=3)
    cv.fill(stroke([(48 - f["fw"] - 0.8, 51), (48 - f["fw"] - 0.6, 55)], 0.9) |
            stroke([(48 + f["fw"] + 0.8, 51), (48 + f["fw"] + 0.6, 55)], 0.9), shade(skin, 1.0))
    if "earrings" in f["acc"]:
        for s in (-1, 1):
            hoop = ell(48 + s * (f["fw"] + 0.6), 60.5, 1.7, 2.0) & ~ell(48 + s * (f["fw"] + 0.6), 60.5, 1.0, 1.3)
            cv.fill(hoop, (232, 196, 96))
    cv.fill(neck & sh(face, 0, 3.0) & ~face, shade(skin, 1.0))
    cv.cel(face, skin, sd=(1.8, 1.2), sd2=None, hi=(-0.8, -0.8), lw=3, grad=(24, f["chin"] + 4, 0.22))
    if f.get("blush"):
        for cx in (35.5, 60.5):
            cv.fill(ell(cx, 59, 3.4, 1.7), (240, 140, 140), 0.28)
    for cx, side in ((38, -1), (58, 1)):
        if "sunglasses" not in f["acc"] and "aviator" not in f["acc"]:
            eye(cv, f, cx, side, skin)
        brow(cv, f, cx, side)
    nose(cv, skin)
    if "mole" in f["acc"]:
        cv.fill(ell(60.5, 60.5, 0.75, 0.75), (112, 70, 54))
    if "browlines" in f["acc"]:
        for y0 in (38.5, 41.5):
            cv.fill(stroke(bez((38, y0), (48, y0 - 1.0), (58, y0)), 0.5, "both"), shade(skin, 0.5))
    if "lines" in f["acc"]:
        for s in (-1, 1):
            cv.fill(stroke(bez((48 + s * 4.2, 60), (48 + s * 6.4, 63), (48 + s * 6.0, 66)), 0.6, "both"), shade(skin, 0.8))
            cv.fill(stroke(bez((48 + s * 6.5, 56), (48 + s * 10, 57), (48 + s * 13, 55.5)), 0.5, "both"), shade(skin, 0.5))
    mouth(cv, f, skin)
    beard(cv, f, face, skin, rng)
    # hair over the face: cast shadow first, then the hair itself
    cv.fill(face & sh(front, 0.8, 2.2) & ~front, shade(skin, 0.9))
    curls = dict(extras).get("curls")
    if curls:
        for cx, cy, r in sorted(curls, key=lambda c: -abs(c[0] - 48) - (c[1] < 30) * 20):
            m = ell(cx, cy, r, r * 0.92)
            cv.cel(m, hc, sd=(1.3, 1.3), hi=(-1.0, -1.0), lw=0)
            cv.fill(rim(m, 0.9, 1.1) & ~rim(m, 0.0, 0.5), shade(hc, 1.3))
            cv.fill(stroke(bez((cx - r * 0.5, cy - r * 0.2), (cx, cy - r * 0.6), (cx + r * 0.4, cy - r * 0.1)), 0.7) & m,
                    light(hc, 1.1))
        cv.fill(front & ~erode(front, 3), ink(hc))
    else:
        long_hair = f["style"] in ("longwavy", "longblack", "longstraight", "fringe", "bob")
        cv.cel(front, hc, sd=(1.8, 1.6), sd2=(0, 3.2) if long_hair else None, hi=(-1.0, -1.0), lw=3,
               grad=(14, 70, 0.5) if long_hair else (16, 46, 0.35))
        strands(cv, front, hc, paths)
        top = np.nonzero(front[:, 44 * SS:52 * SS].any(axis=1))[0]
        if f["style"] != "hood":
            shine(cv, front, hc, (top[0] / SS if len(top) else 18) + 6.5)
        if f.get("ombre"):
            ombre(cv, front, f["ombre"], 56)
        cv.fill(front & ~erode(front, 3), ink(hc))
        if f["style"] == "hood":
            hood_shadow(cv, face, front)
    for name, m in extras:
        if name == "part":
            cv.fill(m, shade(skin, 0.3))
        elif name == "fade":
            cv.fill(m & face & ~front, shade(hc, 0.8), 0.28)
        elif name == "tie":
            cv.cel(m, (220, 110, 140), sd=(0.6, 0.6), hi=None, lw=2)
    for which in ("glasses", "aviator", "sunglasses", "shades-on-head"):
        if which in f["acc"]:
            glasses(cv, f, which)
    wearables(cv, f)
    return finish(cv.image())


def hood_shadow(cv, face, front):
    """The hood throws the face into shadow: dark over the eyes and brow, fading towards the jaw, two pale glints for the eyes."""
    t = np.clip(1.0 - (Y - 56) / 20, 0.45, 0.9)
    m = face & ~front
    cv.rgb[m] = cv.rgb[m] * (1 - t[m][:, None]) + np.array((22, 22, 34)) * t[m][:, None]
    for cx in (38, 58):
        cv.fill(ell(cx, 52.4, 2.1, 1.0), (232, 234, 244), 0.8)


def wearables(cv, f):
    """Hats, bow tie, headband, rectangular glasses and a nose ring for the extras."""
    acc, fw = f["acc"], f["fw"]
    if "sidecurls" in acc:  # curls that stick out from under the hat at ear level
        hc = HAIR[f["hair"]]
        for s in (-1, 1):
            for cy, r, dx in ((34.5, 2.8, 0.6), (39.5, 2.6, 1.6)):
                cv.cel(ell(48 + s * (fw + dx), cy, r, r), hc, sd=(1.0, 1.0), hi=(-0.8, -0.8), lw=2)
    if "bighoops" in acc:  # chunky gold hoops, a small one above each
        for s in (-1, 1):
            x0 = 48 + s * (fw + 0.4)
            cv.fill(ell(x0, 61.5, 3.0, 3.6) & ~ell(x0, 61.5, 2.0, 2.6), (230, 190, 92))
            cv.fill(ell(x0 + s * 0.3, 56.5, 1.5, 1.8) & ~ell(x0 + s * 0.3, 56.5, 0.8, 1.1), (230, 190, 92))
    if "beadearrings" in acc:  # long beaded fringe: blue, white, orange and black bands
        bands = [(52, 96, 150), (240, 240, 236), (232, 140, 48), (36, 32, 40), (240, 240, 236), (52, 96, 150)]
        for s in (-1, 1):
            x0 = 48 + s * (fw + 1.0)
            for k, col in enumerate(bands):
                cv.fill(poly([(x0 - 1.1, 58 + k * 2.3), (x0 + 1.1, 58 + k * 2.3), (x0 + 0.7, 60.2 + k * 2.3),
                              (x0 - 0.7, 60.2 + k * 2.3)]), col)
    if "hoop" in acc:  # a small silver hoop on the right ear
        x0 = 48 + fw + 0.8
        cv.fill(ell(x0, 59.5, 1.6, 2.0) & ~ell(x0, 59.5, 0.9, 1.3), (214, 216, 224))
    if "rectglasses" in acc:
        frame = (60, 36, 34)
        for cx in (38, 58):
            outer = poly([(cx - 6.4, 48), (cx + 6.4, 48), (cx + 6.0, 56), (cx - 6.0, 56)])
            inner = poly([(cx - 5.3, 49), (cx + 5.3, 49), (cx + 4.9, 55), (cx - 4.9, 55)])
            cv.fill(inner, (220, 232, 240), 0.15)
            cv.fill(outer & ~inner, frame)
        cv.fill(stroke(bez((44.4, 50), (48, 49), (51.6, 50)), 0.8), frame)
        cv.fill(stroke([(31.6, 50), (48 - fw + 0.5, 49.5)], 0.8) | stroke([(64.4, 50), (48 + fw - 0.5, 49.5)], 0.8), frame)
    if "nosering" in acc:
        cv.fill(ell(50.6, 60.4, 1.0, 1.0) & ~ell(50.6, 60.0, 0.45, 0.45), (226, 226, 232))
    if "headband" in acc:
        band = stroke(bez((48 - fw - 2, 34), (48, 15), (48 + fw + 2, 34)), 1.6)
        cv.cel(band & ell(48, 40, fw + 4, 27), (196, 40, 60), sd=(0, 0.6), hi=None, lw=2)
    if "bowtie" in acc:
        red = (184, 30, 40)
        tie = poly([(41.5, 74), (48, 77.5), (41.5, 81)]) | poly([(54.5, 74), (48, 77.5), (54.5, 81)])
        cv.cel(tie, red, sd=(0.6, 0.6), hi=(-0.4, -0.4), lw=2)
        cv.cel(ell(48, 77.5, 1.6, 1.8), shade(red, 0.4), sd=(0.4, 0.4), hi=None, lw=2)
    if "tophat" in acc:
        black = (32, 30, 36)
        brim = ell(49, 27, fw + 9, 3.6)
        crown = poly([(36, 27), (35, 1), (63, 0), (62, 27)])
        cv.cel(crown, black, sd=(1.6, 0), hi=(-1.2, 0), lw=3)
        cv.fill(crown & (Y > 21) & (Y < 24.5), (60, 56, 66))  # band
        cv.cel(brim, black, sd=(0, 1.0), hi=(0, -0.8), lw=3)
    if "buckethat" in acc:
        dome = ell(48, 30, fw + 5, 15) & (Y < 33)
        brim = ell(48, 33, fw + 11, 6) & ~ell(48, 30, fw + 3, 3)
        hat = dome | brim
        # tie-dye: soft rainbow bands that wobble across the hat
        band = np.sin((Y + 2.2 * np.sin(X * 0.35)) * 0.55)
        cols = [(232, 120, 196), (170, 120, 226), (248, 168, 96), (120, 196, 220)]
        cv.cel(hat, cols[0], sd=(1.6, 1.4), hi=None, lw=0)
        for k, c in enumerate(cols[1:], 1):
            cv.fill(hat & erode(hat, 3) & (np.abs(band - (k / 2 - 1)) < 0.22), c)
        cv.fill(rim(hat, 1.6, 1.4), shade(cols[1], 0.6))
        cv.fill(hat & ~erode(hat, 3), (90, 50, 90))
        cv.fill(stroke(bez((48 + fw + 1, 36), (48 + fw + 3, 52), (48 + fw, 72)), 0.6), (196, 40, 60))  # chin cord


CROP = (8, 7, 88, 87)  # the 80x80 window (96-px units) that fills the 96x96 frame: a 1.2x close-up


def finish(big):
    small = big.crop(tuple(v * SS for v in CROP)).resize((96, 96), Image.BOX)
    a = np.asarray(small)[:, :, 3]
    solid = Image.new("RGB", (96, 96), (0, 0, 0))
    solid.paste(small.convert("RGB"), mask=Image.fromarray(((a > 100) * 255).astype(np.uint8)))
    q = solid.quantize(colors=MAX_COLOURS - 1, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    out = np.dstack([np.asarray(q), ((a > 100) * 255).astype(np.uint8)])
    out[out[:, :, 3] == 0] = 0
    return Image.fromarray(out, "RGBA")
