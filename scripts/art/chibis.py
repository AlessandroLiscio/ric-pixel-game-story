#!/usr/bin/env python3
"""Parametric chibi generator: 32x32 RPG Maker style walk sheets (96x128) and 96x96 portraits from src/data/people.json.

Usage: python scripts/art/chibis.py [--verbose] [--preview PATH]
Exit codes: 0 = pass, 1 = a stage failed, 2 = bad usage or missing input.
Output: public/assets/characters/<id>.png (sheet), public/assets/characters/<id>-portrait.png (portrait).
Logs: logs/chibis/run_<timestamp>/<stage>.log (last 10 runs kept).
"""
import argparse
import json
import shutil
import sys
import time
import traceback
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PEOPLE_JSON = ROOT / "src" / "data" / "people.json"
OUT_DIR = ROOT / "public" / "assets" / "characters"
LOG_BASE = ROOT / "logs" / "chibis"

# One shared sprite palette. LINE is a placeholder resolved to the per-sprite outline tone.
PAL = {
    "o_brown": "#2e1c18", "o_navy": "#1c2236", "o_plum": "#36182a",
    "skin_light": "#f4cba8", "skin_light_s": "#d99f7e",
    "skin_tan": "#dba577", "skin_tan_s": "#b9805a",
    "skin_olive": "#c28a5c", "skin_olive_s": "#9d6a45",
    "h_black": "#2b2330", "h_brown": "#5a3a28", "h_chestnut": "#8c5a38", "h_auburn": "#b04a48", "h_grey": "#9ea0a8",
    "maroon": "#8c2a3a", "white": "#f4f1ea", "grey": "#a6aab3", "navy": "#2f3d6b", "yellow": "#e8b83a",
    "green": "#4f9a5d", "mint": "#8fd1b0", "blue_l": "#8db4dc", "khaki": "#b79d6b", "cream": "#e7dcc0",
    "charcoal": "#3b3f4c", "pink": "#e07a90", "orange": "#e48a3a", "red": "#c8362f",
}
LINE = "LINE"
OUTLINE_FOR_HAIR = {"black": "o_navy", "brown": "o_brown", "chestnut": "o_brown", "auburn": "o_plum", "grey": "o_navy", "orange": "o_brown"}
SKIN_NAMES = {"light": ("skin_light", "skin_light_s"), "tan": ("skin_tan", "skin_tan_s"), "olive": ("skin_olive", "skin_olive_s")}


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def rgba(c):
    if c == LINE:
        return (255, 0, 255, 255)
    if isinstance(c, tuple):
        return c
    return hexrgb(PAL[c]) + (255,)


class Cv:
    def __init__(self, w=32, h=32):
        self.w, self.h = w, h
        self.im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px = self.im.load()

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = rgba(c)

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, c)

    def spans(self, sp, c):
        for y, x0, x1 in sp:
            self.rect(x0, y, x1, y, c)

    def ell(self, cx, cy, rx, ry, c, ymin=-99, ymax=999):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            if y < ymin or y > ymax:
                continue
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1:
                    self.set(x, y, c)

    def outline(self, tone):
        """Resolve LINE placeholders and add a 1px outer outline in the tone."""
        o = rgba(tone)
        line = rgba(LINE)
        src = self.im.copy().load()
        for y in range(self.h):
            for x in range(self.w):
                if src[x, y] == line:
                    self.px[x, y] = o
        for y in range(self.h):
            for x in range(self.w):
                if src[x, y][3] == 0:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < self.w and 0 <= ny < self.h and src[nx, ny][3] > 0:
                            self.px[x, y] = o
                            break


# ---------------------------------------------------------------- sprite geometry

TORSO = 7
HX0, HX1 = 9, 22
SIL = [4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 3, 5]


def sil(top, r0, r1, grow=0):
    return [(top + r, HX0 + SIL[r] - grow, HX1 - SIL[r] + grow) for r in range(r0, r1 + 1)]


def parse_top(s):
    p = s.split(":")
    if p[0] == "none":
        return None
    return {"kind": p[0], "col": p[1], "pat": p[2] if len(p) > 2 else None}


def parse_bottom(s):
    if s == "none":
        return None
    kind, rest = s.split(":")
    col, _, shoe = rest.partition("/")
    return {"kind": kind, "col": col, "shoe": shoe or "white"}


def pat_color(pat, rx, ry, base):
    """Colour of a pattern pixel at torso-relative (rx 0..9, ry 0..7), or None."""
    if pat == "floral":
        if (rx * 7 + ry * 13) % 11 == 0:
            return "pink"
        if (rx * 5 + ry * 3) % 13 == 1:
            return "cream" if base != "yellow" else "green"
    elif pat == "stripes":
        if ry % 2 == 1:
            return "white"
    elif pat == "logo":
        if ry == 2 and 2 <= rx <= 7:
            return "charcoal"
        if ry == 3 and 3 <= rx <= 6:
            return "charcoal"
    elif pat == "buttons":
        if rx in (4, 5) and ry in (2, 4, 6):
            return "grey"
    return None


def body_params(traits):
    h = traits["height"]
    d = 1 if h >= 1.08 else (-1 if h <= 0.93 else 0)
    L = 7 + d
    return d, L, 29 - L  # delta, visible leg rows, torso bottom row ty1


def legs_front(cv, ty1, bot, skin, skin_s, step, side_view=False):
    """step: -1/0/1 column; the lifted leg is one px shorter."""
    kind = bot["kind"] if bot else "shorts"
    shoe = bot["shoe"] if bot else "white"
    pantcol = bot["col"] if bot else "khaki"
    for leg, (x0, x1) in enumerate(((12, 15), (16, 19))):
        lift = (step == -1 and leg == 0) or (step == 1 and leg == 1)
        bottom = 29 - (1 if lift else 0)
        for y in range(ty1 - 1, bottom + 1):
            if y >= bottom - 1:
                c = shoe
            elif kind == "trousers":
                c = pantcol
            elif kind == "shorts" and y <= ty1 + 2:
                c = pantcol
            else:
                c = skin
            cv.rect(x0, y, x1, y, c)
    # separation line between legs
    yb = 29 - (1 if step != 0 else 0)
    for y in range(ty1 + 3, yb - 1):
        cv.set(16, y, LINE)


def legs_side(cv, ty1, bot, skin, step):
    kind = bot["kind"] if bot else "shorts"
    shoe = bot["shoe"] if bot else "white"
    pantcol = bot["col"] if bot else "khaki"
    if step == 0:
        legs = [(13, 18, 0)]
    else:
        # back leg x 11..14, front leg x 17..20; one foot is lifted
        legs = [(11, 14, 1 if step == -1 else 0), (17, 20, 0 if step == -1 else 1)]
    for x0, x1, lift in legs:
        bottom = 29 - lift
        for y in range(ty1 - 1, bottom + 1):
            if y >= bottom - 1:
                c = shoe
            elif kind == "trousers":
                c = pantcol
            elif kind == "shorts" and y <= ty1 + 2:
                c = pantcol
            else:
                c = skin
            cv.rect(x0, y, x1, y, c)


def torso_front(cv, T0, top, skin, skin_s, back=False):
    if top is None:
        return
    kind, col, pat = top["kind"], top["col"], top["pat"]
    sleeveless = kind in ("tank", "dress")
    x0, x1 = (12, 19) if sleeveless else (11, 20)
    for ry in range(TORSO):
        for x in range(x0, x1 + 1):
            c = col
            pc = pat_color(pat, x - 11, ry, col)
            if pc and not (back and pat == "logo"):
                c = pc
            cv.set(x, T0 + ry, c)
    if sleeveless:
        # skin shoulders and neckline
        cv.rect(14, T0, 17, T0 + (0 if back else 1), skin)
        cv.rect(12, T0, 13, T0, col)
        cv.rect(18, T0, 19, T0, col)
        cv.set(14, T0 + 1, col) if back else None
    else:
        cv.rect(14, T0, 17, T0, skin_s if back else skin)
        if not back:
            cv.rect(15, T0 + 1, 16, T0 + 1, skin)
    if kind == "dress":
        # flared skirt over the legs
        for i, y in enumerate((T0 + TORSO, T0 + TORSO + 1)):
            gx0, gx1 = (11, 20) if i == 0 else (10, 21)
            for x in range(gx0, gx1 + 1):
                pc = pat_color(pat, x - 11, 2 + i * 3, col)
                cv.set(x, y, pc if pc and pat == "floral" else col)
        for x in range(10, 22):
            if x % 3 == 0:
                cv.set(x, T0 + TORSO + 1, col)
    if kind == "skirt":
        for i, y in enumerate((T0 + TORSO, T0 + TORSO + 1)):
            gx0, gx1 = (11, 20) if i == 0 else (10, 21)
            cv.rect(gx0, y, gx1, y, col)


def arms_front(cv, T0, top, skin, ya_l, ya_r):
    kind = top["kind"] if top else "tee"
    col = top["col"] if top else "white"
    pat = top["pat"] if top else None
    sleeve = {"tee": 3, "shirt": 3, "shirt-long": 6, "tank": 0, "dress": 0}.get(kind, 3)
    for x0, ya in ((9, ya_l), (21, ya_r)):
        for r in range(1, TORSO):
            y = T0 + r + ya
            c = col if r <= sleeve else skin
            if c == col and pat == "stripes" and r % 2 == 0:
                c = "white"
            cv.rect(x0, y, x0 + 1, y, c)
        if sleeve >= 6:
            cv.rect(x0, T0 + TORSO - 1 + ya, x0 + 1, T0 + TORSO - 1 + ya, skin)
            cv.rect(x0, T0 + TORSO - 2 + ya, x0 + 1, T0 + TORSO - 2 + ya, skin)


def torso_side(cv, T0, top, skin, skin_s, step):
    if top is None:
        return
    kind, col, pat = top["kind"], top["col"], top["pat"]
    for ry in range(TORSO):
        for x in range(12, 20):
            pc = pat_color(pat, x - 11, ry, col) if pat in ("floral", "stripes") else None
            cv.set(x, T0 + ry, pc or col)
    if kind in ("tank", "dress"):
        cv.rect(12, T0, 13, T0, skin_s)
    cv.rect(14, T0, 15, T0, skin)
    if kind == "dress":
        for i, y in enumerate((T0 + TORSO, T0 + TORSO + 1)):
            cv.rect(11 - i, y, 20 + i, y, col)
    if kind == "skirt":
        for i, y in enumerate((T0 + TORSO, T0 + TORSO + 1)):
            cv.rect(11 - i, y, 20 + i, y, col)


def arm_side(cv, T0, top, skin, step):
    kind = top["kind"] if top else "tee"
    col = top["col"] if top else "white"
    pat = top["pat"] if top else None
    sleeve = {"tee": 3, "shirt": 3, "shirt-long": 6, "tank": 0, "dress": 0}.get(kind, 3)
    swing = -1 if step == -1 else (1 if step == 1 else 0)
    for r in range(1, TORSO):
        dx = (swing * 2 * max(0, r - 2)) // 5 if swing else 0
        c = col if r <= sleeve else skin
        if c == col and pat == "stripes" and r % 2 == 0:
            c = "white"
        cv.rect(14 + dx, T0 + r, 15 + dx, T0 + r, c)


# ---------------------------------------------------------------- hair

def hair_down(cv, t, st, col, T0, ln):
    S = lambda r0, r1, g=0: cv.spans(sil(t, r0, r1, g), col)
    R = lambda x0, r0, x1, r1, c=None: cv.rect(x0, t + r0, x1, t + r1, c or col)
    if st == "short":
        S(0, 3); R(9, 4, 16, 4); R(21, 4, 22, 4); R(9, 5, 10, 6); R(21, 5, 22, 6)
        R(11, 5, 12, 5)
    elif st == "side-part":
        S(0, 3); R(9, 4, 18, 4); R(9, 5, 10, 7); R(21, 5, 22, 7)
        R(17, 1, 17, 2, LINE)
    elif st == "curly":
        S(0, 5, 1)
        R(8, 6, 10, 8); R(21, 6, 23, 8)
        R(12, -1, 13, -1); R(17, -1, 19, -1); R(10, 0, 10, 0); R(21, 0, 21, 0)
        for (x, r) in ((11, 2), (15, 1), (19, 3), (13, 4), (18, 5), (10, 5), (21, 5), (16, 3), (12, 6)):
            R(x, r, x, r, LINE)
        R(10, 4, 13, 5)
    elif st in ("long-wavy", "long-straight", "bob-bangs"):
        S(0, 3)
        if st == "bob-bangs":
            R(10, 4, 21, 5)
            R(8, 4, 11, 11); R(20, 4, 23, 11)
            R(9, 11, 11, 11, col)
        else:
            if st == "long-straight":
                R(9, 4, 12, 5); R(19, 4, 22, 5)
                R(15, 0, 16, 3, LINE)
                R(15, 3, 16, 3, LINE)
            else:
                R(9, 4, 15, 4); R(20, 4, 22, 4)
            R(8, 4, 11, 12); R(20, 4, 23, 12)
            end = T0 + (3 if ln == "medium" else 6)
            for y in range(t + 13, end + 1):
                wob = 1 if (st == "long-wavy" and (y // 2) % 2) else 0
                cv.rect(8 - wob, y, 11, y, col)
                cv.rect(20, y, 23 + wob, y, col)
            if st == "long-wavy":
                for y in range(t + 5, end, 3):
                    cv.set(9, y, LINE); cv.set(22, y, LINE)
    elif st == "tied-back":
        S(0, 2); R(9, 3, 10, 5); R(21, 3, 22, 5)
        R(13, -2, 18, -2); R(12, -1, 19, -1); R(13, 0, 18, 0)
        R(14, -1, 14, -1, LINE)
    elif st == "ponytail":
        S(0, 3); R(9, 4, 16, 4); R(21, 4, 22, 4); R(9, 5, 10, 6); R(21, 5, 22, 6)
        R(23, 3, 24, 4); R(24, 5, 25, 11)
        R(23, 3, 23, 3, "pink")


def hair_up(cv, t, st, col, T0, ln):
    S = lambda r0, r1, g=0: cv.spans(sil(t, r0, r1, g), col)
    R = lambda x0, r0, x1, r1, c=None: cv.rect(x0, t + r0, x1, t + r1, c or col)
    if st in ("short", "side-part"):
        S(0, 10)
        R(12, 6, 13, 6, LINE)
    elif st == "curly":
        S(0, 10, 1); R(12, -1, 13, -1); R(17, -1, 19, -1)
        for (x, r) in ((11, 2), (15, 1), (19, 3), (13, 5), (18, 6), (10, 7), (21, 7), (16, 8)):
            R(x, r, x, r, LINE)
    elif st in ("long-wavy", "long-straight", "bob-bangs"):
        S(0, 12 if st != "bob-bangs" else 11)
        R(8, 4, 11, 12); R(20, 4, 23, 12)
        if st != "bob-bangs":
            end = T0 + (4 if ln == "medium" else 7)
            for y in range(t + 13, end + 1):
                wob = 1 if (st == "long-wavy" and (y // 2) % 2) else 0
                cv.rect(8 - wob, y, 23 + wob, y, col)
        else:
            R(9, 11, 22, 11)
        for x, r0, r1 in ((12, 5, 11), (15, 2, 8), (18, 6, 12), (20, 3, 7)):
            R(x, r0, x, r1, LINE)
        if st == "long-wavy":
            for x, y in ((13, t + 16), (17, t + 19), (11, t + 21)):
                cv.set(x, y, LINE)
    elif st == "tied-back":
        S(0, 10); R(13, -2, 18, -2); R(12, -1, 19, -1)
        R(14, 5, 17, 5, LINE)
        R(14, 11, 17, 14)
    elif st == "ponytail":
        S(0, 10)
        R(14, 3, 17, 3, "pink")
        R(14, 4, 17, 12)
        for y in range(t + 13, T0 + 6):
            cv.rect(14, y, 17, y, col)
        cv.rect(15, T0 + 6, 16, T0 + 7, col)


def hair_side(cv, t, st, col, T0, ln, face_skin_s):
    """Left-facing: face on the left, hair mass on the right."""
    S = lambda r0, r1, g=0: cv.spans(sil(t, r0, r1, g), col)
    R = lambda x0, r0, x1, r1, c=None: cv.rect(x0, t + r0, x1, t + r1, c or col)
    if st == "short":
        S(0, 3); R(9, 4, 12, 4); R(15, 4, 22, 9); R(13, 4, 14, 6)
    elif st == "side-part":
        S(0, 3); R(9, 4, 13, 4); R(15, 4, 22, 9); R(13, 4, 14, 6)
    elif st == "curly":
        S(0, 5, 1); R(8, 4, 12, 5); R(14, 6, 23, 10); R(12, -1, 13, -1); R(17, -1, 19, -1)
        for (x, r) in ((11, 2), (15, 1), (19, 3), (13, 4), (18, 5), (21, 7), (17, 8), (16, 3)):
            R(x, r, x, r, LINE)
    elif st in ("long-wavy", "long-straight", "bob-bangs"):
        S(0, 3); R(9, 4, 13, 4); R(14, 4, 23, 11)
        if st == "bob-bangs":
            R(9, 4, 12, 5)
        else:
            end = T0 + (3 if ln == "medium" else 6)
            for y in range(t + 12, end + 1):
                wob = 1 if (st == "long-wavy" and (y // 2) % 2) else 0
                cv.rect(20, y, 23 + wob, y, col)
        if st == "long-wavy":
            for y in range(t + 5, t + 11, 3):
                cv.set(19, y, LINE)
    elif st == "tied-back":
        S(0, 2); R(17, 3, 22, 6); R(15, 3, 16, 3)
        R(16, -2, 21, -2); R(15, -1, 22, -1)
    elif st == "ponytail":
        S(0, 3); R(9, 4, 12, 4); R(15, 4, 22, 8)
        R(23, 3, 24, 4); R(24, 5, 25, 11)
        cv.set(23, t + 3, "pink")


# ---------------------------------------------------------------- one frame

def draw_head_down(cv, t, tr, skin, skin_s, hair_col, back=False):
    acc = set(tr["accessory"])
    cv.spans(sil(t, 3, 12), skin)
    if back:
        return
    # eyes: 2 wide x 3 tall with a white glint
    if not acc & {"sunglasses"}:
        for x in (12, 18):
            cv.rect(x, t + 7, x + 1, t + 9, "o_navy" if False else LINE)
            cv.set(x, t + 7, "white")
    cv.set(10, t + 10, "pink"); cv.set(21, t + 10, "pink")
    cv.rect(15, t + 11, 16, t + 11, skin_s)
    if "glasses" in acc:
        for x in (11, 18):
            cv.rect(x, t + 6, x + 3, t + 6, "charcoal"); cv.rect(x, t + 10, x + 3, t + 10, "charcoal")
            cv.rect(x, t + 7, x, t + 9, "charcoal"); cv.rect(x + 3, t + 7, x + 3, t + 9, "charcoal")
        cv.rect(15, t + 7, 16, t + 7, "charcoal")
    if "sunglasses" in acc:
        cv.rect(10, t + 7, 21, t + 7, "charcoal")
        cv.rect(11, t + 8, 14, t + 9, "o_navy"); cv.rect(17, t + 8, 20, t + 9, "o_navy")
        cv.set(12, t + 8, "grey"); cv.set(18, t + 8, "grey")
    if "beard" in acc:
        c = hair_col
        cv.rect(9, t + 9, 11, t + 9, c); cv.rect(20, t + 9, 22, t + 9, c)
        cv.spans(sil(t, 10, 12), c)
        cv.rect(15, t + 11, 16, t + 11, skin_s)
        cv.rect(13, t + 10, 18, t + 10, c)
    if "stubble" in acc:
        for (x, r) in ((11, 10), (13, 11), (18, 11), (20, 10), (15, 12), (16, 12), (12, 12), (19, 12), (10, 9), (21, 9)):
            cv.set(x, t + r, hair_col)


def draw_head_side(cv, t, tr, skin, skin_s, hair_col, st):
    acc = set(tr["accessory"])
    cv.spans(sil(t, 3, 12), skin)
    cv.set(8, t + 8, skin)  # nose
    cv.set(8, t + 9, skin)
    cv.rect(11, t + 7, 12, t + 9, LINE)
    cv.set(11, t + 7, "white")
    cv.set(10, t + 10, "pink")
    cv.rect(10, t + 11, 11, t + 11, skin_s)
    if st in ("short", "side-part", "tied-back"):
        cv.set(16, t + 8, skin_s); cv.set(16, t + 9, skin_s)  # ear
    if "glasses" in acc:
        cv.rect(10, t + 6, 13, t + 6, "charcoal"); cv.rect(10, t + 10, 13, t + 10, "charcoal")
        cv.rect(10, t + 7, 10, t + 9, "charcoal"); cv.rect(13, t + 7, 13, t + 9, "charcoal")
        cv.rect(14, t + 6, 17, t + 6, "charcoal")
    if "sunglasses" in acc:
        cv.rect(9, t + 7, 13, t + 9, "o_navy")
        cv.rect(14, t + 7, 17, t + 7, "charcoal")
        cv.set(10, t + 7, "grey")
    if "beard" in acc:
        c = hair_col
        cv.rect(9, t + 9, 15, t + 9, c)
        cv.spans([(t + 10, 9, 17), (t + 11, 11, 17), (t + 12, 14, 17)], c)
        cv.rect(10, t + 11, 11, t + 11, skin_s)
        cv.rect(8, t + 10, 8, t + 10, c)
    if "stubble" in acc:
        for (x, r) in ((10, 10), (12, 11), (14, 10), (15, 12), (11, 9), (16, 11)):
            cv.set(x, t + r, hair_col)


def sunglasses_on_head(cv, t, view):
    if view == "down":
        cv.rect(10, t + 2, 21, t + 3, "charcoal")
        cv.rect(11, t + 3, 14, t + 3, "o_navy"); cv.rect(17, t + 3, 20, t + 3, "o_navy")
        cv.set(12, t + 2, "grey"); cv.set(18, t + 2, "grey")
    elif view == "up":
        cv.rect(10, t + 2, 21, t + 2, "charcoal")
    else:
        cv.rect(9, t + 2, 18, t + 3, "charcoal")
        cv.rect(9, t + 3, 12, t + 3, "o_navy")
        cv.set(10, t + 2, "grey")


def accessories_torso(cv, T0, tr, view):
    acc = set(tr["accessory"])
    top = parse_top(tr["outfitTop"])
    if "necklace" in acc and view in ("down",):
        cv.set(14, T0 + 1, "cream"); cv.set(17, T0 + 1, "cream")
        cv.set(15, T0 + 2, "cream"); cv.set(16, T0 + 2, "cream")
        cv.rect(15, T0 + 3, 16, T0 + 3, "charcoal")
    if "tie" in acc and view == "down":
        cv.rect(15, T0 + 1, 16, T0 + 1, "red")
        cv.rect(15, T0 + 2, 16, T0 + 5, "red")
        cv.rect(15, T0 + 6, 16, T0 + 6, "maroon")
        cv.rect(14, T0, 17, T0, "white")
    if top and top["kind"] == "shirt-long" and view == "down":
        cv.rect(14, T0, 14, T0, "white"); cv.rect(17, T0, 17, T0, "white")


def render_frame(tr, facing, col):
    """col 0 step-left, 1 stand, 2 step-right. facing down/up/left (right is the mirror)."""
    cv = Cv()
    step = (-1, 0, 1)[col]
    d, L, ty1 = body_params(tr)
    skin, skin_s = SKIN_NAMES[tr["skin"]]
    hair_col = "h_" + tr["hairColor"]
    st = tr["hairStyle"]
    ln = tr["hair"]
    top = parse_top(tr["outfitTop"])
    bot = parse_bottom(tr["outfitBottom"])
    bob = 1 if step != 0 else 0
    T0 = ty1 - (TORSO - 1) + bob
    t = T0 - 13
    acc = set(tr["accessory"])
    arm_l, arm_r = (1, -1) if step == -1 else ((-1, 1) if step == 1 else (0, 0))
    if facing == "down":
        legs_front(cv, ty1, bot, skin, skin_s, step)
        torso_front(cv, T0, top, skin, skin_s)
        arms_front(cv, T0, top, skin, arm_l, arm_r)
        draw_head_down(cv, t, tr, skin, skin_s, hair_col)
        hair_down(cv, t, st, hair_col, T0, ln)
        # beard/glasses drawn before hair would be covered by fringe; redraw face accessories on top of hair
        face_overlay_down(cv, t, tr, skin_s, hair_col)
        if "sunglasses-on-head" in acc:
            sunglasses_on_head(cv, t, "down")
        accessories_torso(cv, T0, tr, "down")
    elif facing == "up":
        legs_front(cv, ty1, bot, skin, skin_s, step)
        torso_front(cv, T0, top, skin, skin_s, back=True)
        arms_front(cv, T0, top, skin, arm_r, arm_l)
        draw_head_down(cv, t, tr, skin, skin_s, hair_col, back=True)
        hair_up(cv, t, st, hair_col, T0, ln)
        if "sunglasses-on-head" in acc:
            sunglasses_on_head(cv, t, "up")
    else:
        legs_side(cv, ty1, bot, skin, step)
        torso_side(cv, T0, top, skin, skin_s, step)
        draw_head_side(cv, t, tr, skin, skin_s, hair_col, st)
        hair_side(cv, t, st, hair_col, T0, ln, skin_s)
        arm_side(cv, T0, top, skin, step)
        if "sunglasses-on-head" in acc:
            sunglasses_on_head(cv, t, "left")
    cv.outline(OUTLINE_FOR_HAIR[tr["hairColor"]])
    return cv.im


def face_overlay_down(cv, t, tr, skin_s, hair_col):
    """Redraw eyes and glasses over a fringe that reaches the eye rows."""
    acc = set(tr["accessory"])
    if "sunglasses" not in acc:
        for x in (12, 18):
            cv.rect(x, t + 7, x + 1, t + 9, LINE)
            cv.set(x, t + 7, "white")
    if "sunglasses" in acc:
        cv.rect(10, t + 7, 21, t + 7, "charcoal")
        cv.rect(11, t + 8, 14, t + 9, "o_navy"); cv.rect(17, t + 8, 20, t + 9, "o_navy")
        cv.set(12, t + 8, "grey"); cv.set(18, t + 8, "grey")
    if "glasses" in acc:
        for x in (11, 18):
            cv.rect(x, t + 6, x + 3, t + 6, "charcoal"); cv.rect(x, t + 10, x + 3, t + 10, "charcoal")
            cv.rect(x, t + 7, x, t + 9, "charcoal"); cv.rect(x + 3, t + 7, x + 3, t + 9, "charcoal")
        cv.rect(15, t + 7, 16, t + 7, "charcoal")
    if "beard" in acc:
        c = hair_col
        cv.rect(9, t + 9, 11, t + 9, c); cv.rect(20, t + 9, 22, t + 9, c)
        cv.spans(sil(t, 10, 12), c)
        cv.rect(13, t + 10, 18, t + 10, c)
        cv.rect(15, t + 11, 16, t + 11, skin_s)


# ---------------------------------------------------------------- cat

def draw_cat(facing, col):
    cv = Cv()
    step = (-1, 0, 1)[col]
    W, O, G, B, P, E, N = "white", "orange", "h_brown", "charcoal", "pink", "green", "o_brown"
    bob = 1 if step != 0 else 0
    if facing == "left":
        # body
        cv.ell(17, 21 + bob, 8.5, 5, W)
        cv.ell(14, 19 + bob, 4.5, 3, O)
        cv.ell(21, 19 + bob, 3.5, 2.5, G)
        cv.rect(19, 17 + bob, 20, 17 + bob, B); cv.rect(22, 18 + bob, 23, 18 + bob, B)
        cv.rect(16, 16 + bob, 16, 17 + bob, G)
        # head
        cv.ell(8, 17 + bob, 5, 4.5, W)
        cv.ell(8, 14.5 + bob, 4.5, 2.5, O)
        cv.rect(4, 11 + bob, 5, 12 + bob, G); cv.rect(11, 11 + bob, 12, 12 + bob, G)
        cv.set(4, 10 + bob, W); cv.set(12, 10 + bob, O)
        cv.set(5, 10 + bob, G); cv.set(11, 10 + bob, G)
        cv.set(6, 16 + bob, E); cv.set(7, 16 + bob, "o_navy")
        cv.set(3, 18 + bob, P); cv.set(4, 18 + bob, P)
        cv.rect(5, 19 + bob, 6, 19 + bob, W)
        # tail
        tail = [(25, 18), (26, 17), (27, 16), (27, 15), (27, 14), (26, 13), (26, 12)]
        for x, y in tail:
            cv.rect(x, y + bob, x + 1, y + bob, G if (x + y) % 2 else O)
        cv.set(26, 11 + bob, W); cv.set(27, 11 + bob, W)
        # legs
        legs = [(10, 0), (13, 1), (20, 1), (23, 0)]
        for i, (x, grp) in enumerate(legs):
            lift = 1 if (step != 0 and ((step == -1) == (grp == 0))) else 0
            cv.rect(x, 24 + bob, x + 1, 28 - lift, W)
            cv.set(x, 28 - lift, W)
        cv.rect(11, 24, 11, 25, W)
    elif facing == "down":
        cv.ell(16, 23 + bob, 6.5, 5, W)
        cv.ell(13, 22 + bob, 3, 3, O); cv.ell(19.5, 22 + bob, 2.5, 3, G)
        cv.rect(15, 20 + bob, 16, 23 + bob, W)
        # head
        cv.ell(16, 15 + bob, 6.5, 5, W)
        cv.ell(12.5, 12.5 + bob, 3.5, 2.8, O); cv.ell(19.5, 12.5 + bob, 3.5, 2.8, G)
        cv.rect(10, 8 + bob, 11, 10 + bob, O); cv.rect(20, 8 + bob, 21, 10 + bob, G)
        cv.set(10, 9 + bob, P); cv.set(21, 9 + bob, P)
        cv.set(13, 15 + bob, E); cv.set(18, 15 + bob, E)
        cv.set(13, 16 + bob, "o_navy"); cv.set(18, 16 + bob, "o_navy")
        cv.set(15, 17 + bob, P); cv.set(16, 17 + bob, P)
        cv.set(15, 18 + bob, "o_brown"); cv.set(16, 18 + bob, "o_brown")
        cv.rect(15, 11 + bob, 16, 13 + bob, O)
        # paws
        lift_l = 1 if step == -1 else 0
        lift_r = 1 if step == 1 else 0
        cv.rect(12, 27 - lift_l, 14, 28 - lift_l, W)
        cv.rect(17, 27 - lift_r, 19, 28 - lift_r, W)
    else:  # up
        cv.ell(16, 21 + bob, 7, 6, O)
        cv.ell(19, 21 + bob, 3.5, 4, G)
        cv.rect(13, 18 + bob, 14, 18 + bob, B); cv.rect(13, 22 + bob, 14, 22 + bob, B)
        cv.rect(18, 24 + bob, 20, 24 + bob, B)
        cv.ell(16, 12 + bob, 5.5, 4, O)
        cv.rect(11, 7 + bob, 12, 9 + bob, G); cv.rect(19, 7 + bob, 20, 9 + bob, O)
        cv.set(11, 8 + bob, P); cv.set(20, 8 + bob, P)
        # tail up
        for y in range(8, 22):
            cv.rect(21 + (1 if y < 14 else 0), y + bob, 22 + (1 if y < 14 else 0), y + bob, G if y % 3 else O)
        cv.rect(22, 7 + bob, 23, 7 + bob, W)
        lift_l = 1 if step == -1 else 0
        lift_r = 1 if step == 1 else 0
        cv.rect(11, 27 - lift_l, 14, 28 - lift_l, W)
        cv.rect(17, 27 - lift_r, 20, 28 - lift_r, W)
    cv.outline("o_brown")
    return cv.im


def render_sheet(tr):
    sheet = Image.new("RGBA", (96, 128), (0, 0, 0, 0))
    for row, facing in enumerate(("down", "left", "right", "up")):
        for col in range(3):
            if facing == "right":
                fr = (draw_cat("left", col) if tr["id"] == "gatto" else render_frame(tr, "left", col)).transpose(Image.FLIP_LEFT_RIGHT)
            elif tr["id"] == "gatto":
                fr = draw_cat(facing, col)
            else:
                fr = render_frame(tr, facing, col)
            sheet.paste(fr, (col * 32, row * 32))
    return sheet


# ---------------------------------------------------------------- portraits (48x48, scaled x2)

def lerp(a, b, f):
    return tuple(int(a[i] + (b[i] - a[i]) * f) for i in range(3))


def draw_portrait(tr):
    skin, skin_s = SKIN_NAMES[tr["skin"]]
    acc = set(tr["accessory"])
    st = tr["hairStyle"]
    ln = tr["hair"]
    top = parse_top(tr["outfitTop"])
    hc = hexrgb(PAL["h_" + tr["hairColor"]])
    hair = hc + (255,)
    hair_hi = lerp(hc, (255, 255, 255), 0.28) + (255,)
    outfit = top["col"] if top else "white"
    ofc = hexrgb(PAL[outfit]) + (255,)
    ofs = lerp(hexrgb(PAL[outfit]), (20, 20, 40), 0.3) + (255,)
    sk = rgba(skin); sks = rgba(skin_s)
    pink = rgba("pink"); white = rgba("white"); red = rgba("red"); char = rgba("charcoal")
    bgc = (26, 42, 107, 255)
    cv = Cv(48, 48)
    S = lambda *a, **k: cv.ell(*a, **k)
    # long hair back layer
    kind = top["kind"] if top else "tee"
    if st in ("long-wavy", "long-straight"):
        cv.rect(10, 12, 38, 40, hair)
        cv.rect(8, 28, 40, 47, hair)
    if st == "bob-bangs":
        cv.rect(10, 12, 38, 34, hair)
    if st == "ponytail":
        cv.rect(37, 14, 40, 30, hair); cv.rect(38, 30, 39, 34, hair)
    # body
    for y in range(38, 48):
        hw = int(10 + (y - 38) * 1.5)
        cv.rect(24 - hw, y, 24 + hw - 1, y, ofc)
    cv.rect(24, 38, 47, 47, ofc)
    for y in range(38, 48):
        hw = int(10 + (y - 38) * 1.5)
        cv.rect(24 + hw - 5, y, 24 + hw - 1, y, ofs)
    # pattern
    pat = top["pat"] if top else None
    for y in range(40, 48):
        for x in range(2, 46):
            hw = int(10 + (y - 38) * 1.5)
            if abs(x - 23.5) < hw - 2:
                pc = pat_color(pat, x % 10, y % 8, outfit)
                if pc and pat == "floral":
                    cv.set(x, y, rgba(pc))
                if pat == "stripes" and y % 3 == 0:
                    cv.set(x, y, white)
    if pat == "logo":
        cv.rect(18, 42, 29, 43, char); cv.rect(20, 44, 27, 44, char)
    if pat == "buttons":
        for y in (42, 45):
            cv.rect(23, y, 24, y, rgba("grey"))
    # neck and neckline
    cv.rect(20, 33, 27, 39, sks)
    if kind in ("tank", "dress"):
        cv.rect(15, 38, 32, 41, sk); S(24, 41, 8, 4, sk, ymin=38)
        cv.rect(15, 38, 17, 40, ofc); cv.rect(30, 38, 32, 40, ofc)
        S(24, 41, 8, 5, sk, ymin=38)
        cv.rect(10, 41, 14, 47, sk) if False else None
    elif kind == "shirt" or kind == "shirt-long":
        for i in range(5):
            cv.rect(20 + i, 38 + i, 27 - i, 38 + i, sk if i < 3 else sks)
        for i in range(5):
            cv.set(19 + i, 38 + i, white); cv.set(28 - i, 38 + i, white)
            cv.set(18 + i, 38 + i, white); cv.set(29 - i, 38 + i, white)
    else:
        S(24, 38, 5.5, 3, sk, ymin=38)
    if "tie" in acc:
        cv.rect(23, 40, 24, 41, red); cv.rect(22, 42, 25, 46, red); cv.rect(23, 47, 24, 47, red)
        cv.rect(23, 38, 24, 39, red)
    if "necklace" in acc:
        for i in range(4):
            cv.set(20 + i, 39 + i, rgba("cream")); cv.set(27 - i, 39 + i, rgba("cream"))
        cv.rect(23, 43, 24, 44, rgba("cream"))
    # head
    S(24, 22, 12.5, 13.5, sk)
    # ears
    cv.rect(11, 22, 12, 26, sks); cv.rect(36, 22, 37, 26, sks)
    S(24, 22, 12, 13, sk)
    # hair
    def cap(rx=13.5, ymax=17):
        S(24, 20, rx, 13, hair, ymax=ymax)

    def arc(y0):
        """Curved highlight on hair pixels only."""
        for x in range(15, 34):
            y = y0 + ((x - 24) ** 2) // 24
            if cv.px[x, y] == hair:
                cv.px[x, y] = hair_hi
    if st in ("short", "side-part"):
        cap(13.5, 17)
        for x in range(11, 38):
            lim = 16 + max(0, min(5, (34 - x) // 4)) if st == "short" else 17 + max(0, min(3, (30 - x) // 4))
            cv.rect(x, 12, x, lim, hair)
        cv.rect(11, 17, 13, 25, hair); cv.rect(35, 17, 37, 25, hair)
        arc(13)
    elif st == "curly":
        for cx, cy in ((13, 20), (13, 14), (18, 9), (24, 7), (30, 9), (35, 14), (35, 20), (24, 12), (17, 13), (31, 13)):
            S(cx, cy, 5.2, 5, hair)
        for x in range(12, 37):
            cv.rect(x, 12, x, 18 + (1 if x % 4 < 2 else 0), hair)
        cv.rect(10, 16, 13, 27, hair); cv.rect(35, 16, 38, 27, hair)
        for (x, y) in ((15, 10), (22, 9), (29, 11), (12, 17), (36, 17), (19, 15), (28, 15)):
            cv.rect(x, y, x + 1, y, hair_hi)
    elif st in ("long-wavy", "long-straight"):
        cap(14, 17)
        for x in range(11, 38):
            lim = 18 + max(0, min(4, abs(x - 24) // 3)) if st == "long-wavy" else 17 + (1 if x < 20 or x > 28 else 0)
            lim = 18 + min(4, abs(x - 24) // 3) if st == "long-wavy" else lim
            cv.rect(x, 12, x, lim, hair)
        cv.rect(9, 17, 14, 44, hair); cv.rect(34, 17, 39, 44, hair)
        if st == "long-straight":
            cv.rect(24, 9, 24, 14, sks)
        else:
            for y in range(24, 40, 7):
                cv.rect(11, y, 11, y + 4, hair_hi); cv.rect(36, y + 3, 36, y + 7, hair_hi)
        arc(13)
    elif st == "bob-bangs":
        cap(14, 18)
        cv.rect(12, 12, 36, 20, hair)
        cv.rect(10, 17, 14, 36, hair); cv.rect(34, 17, 38, 36, hair)
        arc(14)
    elif st == "tied-back":
        cap(13.5, 14)
        for x in range(12, 37):
            cv.rect(x, 12, x, 14 + (1 if x % 5 == 0 else 0), hair)
        cv.rect(11, 14, 12, 21, hair); cv.rect(36, 14, 37, 21, hair)
        S(24, 5, 5, 4.5, hair)
        cv.rect(20, 9, 28, 10, sks)
        cv.set(22, 4, hair_hi); cv.set(23, 4, hair_hi)
        arc(11)
    elif st == "ponytail":
        cap(13.5, 17)
        for x in range(11, 38):
            lim = 16 + max(0, min(4, (34 - x) // 5))
            cv.rect(x, 12, x, lim, hair)
        cv.rect(11, 17, 13, 24, hair); cv.rect(35, 17, 37, 24, hair)
        arc(13)
        cv.rect(36, 12, 38, 14, pink)
    # face
    for x in (18, 28):
        cv.rect(x, 24, x + 2, 28, rgba("o_navy"))
        cv.set(x, 24, white); cv.set(x + 1, 24, white)
    cv.rect(16, 29, 18, 29, pink); cv.rect(30, 29, 32, 29, pink)
    cv.rect(23, 33, 25, 33, red)
    cv.set(24, 29, sks)
    for x in (18, 28):
        cv.rect(x - 1, 21, x + 3, 21, hair)
    if "beard" in acc:
        for y in range(30, 36):
            for x in range(11, 38):
                if ((x + .5 - 24) / 12.2) ** 2 + ((y + .5 - 22) / 13.3) ** 2 <= 1:
                    if y >= 31 or abs(x - 24) > 8 or (y >= 28 and abs(x - 24) > 10):
                        cv.set(x, y, hair)
        for x in range(10, 38):
            if abs(x - 24) > 7 or True:
                pass
        cv.rect(14, 29, 17, 30, hair); cv.rect(31, 29, 34, 30, hair)
        cv.rect(19, 30, 29, 31, hair)
        cv.rect(23, 33, 25, 33, red)
        cv.set(24, 29, sks)
    if "stubble" in acc:
        for (x, y) in ((14, 31), (17, 34), (20, 35), (28, 35), (31, 34), (34, 31), (23, 35), (13, 28), (35, 28), (16, 33), (32, 33)):
            cv.set(x, y, hair)
    if "glasses" in acc:
        for x in (15, 27):
            cv.rect(x, 22, x + 8, 22, char); cv.rect(x, 30, x + 8, 30, char)
            cv.rect(x, 23, x, 29, char); cv.rect(x + 8, 23, x + 8, 29, char)
        cv.rect(23, 25, 26, 25, char)
    if "sunglasses" in acc:
        cv.rect(14, 23, 22, 29, rgba("o_navy")); cv.rect(26, 23, 34, 29, rgba("o_navy"))
        cv.rect(22, 24, 26, 24, char)
        cv.rect(15, 24, 17, 24, rgba("grey")); cv.rect(27, 24, 29, 24, rgba("grey"))
        cv.rect(12, 24, 14, 24, char); cv.rect(34, 24, 36, 24, char)
    if "sunglasses-on-head" in acc:
        cv.rect(14, 11, 34, 14, char)
        cv.rect(15, 13, 22, 15, rgba("o_navy")); cv.rect(26, 13, 33, 15, rgba("o_navy"))
        cv.rect(16, 12, 18, 12, rgba("grey")); cv.rect(28, 12, 30, 12, rgba("grey"))
    cv.outline(OUTLINE_FOR_HAIR[tr["hairColor"]])
    bg = Image.new("RGBA", (48, 48), bgc)
    bg.alpha_composite(cv.im)
    # soft floor band to read as a tile
    px = bg.load()
    for y in range(44, 48):
        for x in range(48):
            if px[x, y] == bgc:
                px[x, y] = (20, 33, 88, 255)
    return bg.resize((96, 96), Image.NEAREST).convert("RGBA")


# ---------------------------------------------------------------- driver

def colours(img):
    px = img.load()
    return {px[x, y] for y in range(img.height) for x in range(img.width)}


def load_people():
    return json.loads(PEOPLE_JSON.read_text(encoding="utf-8"))


def stage_sheets(people, log):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for p in people:
        sheet = render_sheet(p["traits"] | {"id": p["id"]})
        sheet.save(OUT_DIR / f"{p['id']}.png")
        log(f"sheet {p['id']} {sheet.size}")


def stage_portraits(people, log):
    for p in people:
        if not p["portrait"]:
            continue
        img = draw_portrait(p["traits"])
        img.save(OUT_DIR / f"{p['id']}-portrait.png")
        log(f"portrait {p['id']} {img.size} colours={len(colours(img))}")


def stage_check(people, log):
    n_sheets = n_port = 0
    sprite_cols = {hexrgb(v) + (255,) for v in PAL.values()}
    for p in people:
        sh = Image.open(OUT_DIR / f"{p['id']}.png").convert("RGBA")
        assert sh.size == (96, 128), f"{p['id']} sheet size {sh.size}"
        px = sh.load()
        assert px[0, 0][3] == 0 and px[95, 127][3] == 0, f"{p['id']} corners not transparent"
        for fy in range(4):
            frames = [sh.crop((fx * 32, fy * 32, fx * 32 + 32, fy * 32 + 32)) for fx in range(3)]
            assert all(f.getbbox() for f in frames), f"{p['id']} empty frame in row {fy}"
            assert frames[0].tobytes() != frames[1].tobytes() != frames[2].tobytes(), f"{p['id']} row {fy} does not animate"
        used = {c for c in colours(sh) if c[3] == 255}
        extra = used - sprite_cols
        assert not extra, f"{p['id']} colours outside palette: {sorted(extra)[:3]}"
        n_sheets += 1
        if p["portrait"]:
            po = Image.open(OUT_DIR / f"{p['id']}-portrait.png").convert("RGBA")
            assert po.size == (96, 96), f"{p['id']} portrait size {po.size}"
            ncol = len(colours(po))
            assert ncol <= 16, f"{p['id']} portrait has {ncol} colours"
            n_port += 1
    assert n_sheets == 11 and n_port == 10, f"counts {n_sheets}/{n_port}"
    return n_sheets, n_port


def preview(people, path):
    S = 3
    cols = 4
    rows = (len(people) + cols - 1) // cols
    cw, ch = 96 * S + 8, (128 * S) + 8 + 96 * S // 2
    img = Image.new("RGBA", (cols * cw, rows * (ch + 8)), (110, 140, 90, 255))
    for i, p in enumerate(people):
        sh = Image.open(OUT_DIR / f"{p['id']}.png").convert("RGBA")
        sh = sh.resize((96 * S, 128 * S), Image.NEAREST)
        x, y = (i % cols) * cw, (i // cols) * (ch + 8)
        img.alpha_composite(sh, (x + 4, y + 4))
        if p["portrait"]:
            po = Image.open(OUT_DIR / f"{p['id']}-portrait.png").convert("RGBA")
            po = po.resize((96 * S // 2, 96 * S // 2), Image.NEAREST)
            img.alpha_composite(po, (x + 4, y + 128 * S + 4))
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    img.save(path)


def main():
    ap = argparse.ArgumentParser(description="Generate chibi sheets and parametric portraits from src/data/people.json.")
    ap.add_argument("--verbose", action="store_true", help="stream the full log to the console too")
    ap.add_argument("--preview", metavar="PATH", help="also write a contact sheet PNG (not committed)")
    args = ap.parse_args()
    if not PEOPLE_JSON.exists():
        print(f"FAIL input missing: {PEOPLE_JSON.relative_to(ROOT)}")
        return 2
    LOG_BASE.mkdir(parents=True, exist_ok=True)
    runs = sorted(d for d in LOG_BASE.glob("run_*") if d.is_dir())
    for d in runs[:-9]:
        shutil.rmtree(d, ignore_errors=True)
    run = LOG_BASE / time.strftime("run_%Y%m%d_%H%M%S")
    run.mkdir(parents=True, exist_ok=True)
    people = load_people()
    failed = 0
    result = (0, 0)
    for name, fn in (("sheets", stage_sheets), ("portraits", stage_portraits), ("check", stage_check)):
        logf = (run / f"{name}.log").open("w", encoding="utf-8")

        def log(msg, logf=logf):
            logf.write(msg + "\n")
            if args.verbose:
                print("  " + msg)
        try:
            r = fn(people, log)
            if name == "check":
                result = r
            print(f"OK   {name}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            logf.write(traceback.format_exc())
            rel = (run / f"{name}.log").relative_to(ROOT).as_posix()
            print(f"FAIL {name} -> {rel}")
            print(f"     {type(e).__name__}: {e}")
        finally:
            logf.close()
    if args.preview and not failed:
        preview(people, args.preview)
    if failed:
        print(f"FAIL {failed}/3 stages, logs: {run.relative_to(ROOT).as_posix()}")
        return 1
    print(f"PASS characters: {result[0]} sheets 96x128, {result[1]} portraits 96x96")
    return 0


if __name__ == "__main__":
    sys.exit(main())
