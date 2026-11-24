#!/usr/bin/env python3
"""Crowd sheets: small chibi people drawn by code in the proportions and the 1 px outline of the character sheets, so the audience
of a tile room is not one tinted girl. Every sheet is a different person: skin, hair style and colour, clothes, shoes, an accessory.
Writes public/assets/tiles/crowd-<n>.png (96x128, same layout as the character sheets: rows down, left, right, up).

Columns 0 and 2 of a crowd sheet are the two dance poses (an arm up, a foot lifted), column 1 is the standing pose the idle crowd
uses. Crowd people never walk, so the walk columns of the character layout are free for the dance. No photo, nothing copied.
Usage: python -I scripts/art/crowd.py     (build_world.py runs it too)
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from PIL import Image, ImageOps  # noqa: E402

from tilepaint import Canvas, dark, hx, light, mix  # noqa: E402

ROOT = HERE.parents[1]
OUT = ROOT / "public" / "assets" / "tiles"

SKINS = {"pale": "#f6d3b4", "light": "#f4cba8", "tan": "#dba577", "olive": "#c28a5c", "brown": "#9d6a45", "dark": "#7a4a30"}
OUTL = "#2a1c22"

# name: skin, hair colour, hair style, top colour, top style, bottom colour, shoes, extra
PEOPLE = [
    dict(skin="tan", hair="#2b2330", style="short", top="#c8423f", tops="tee", bottom="#3b4a7a", shoe="#f4f1ea"),
    dict(skin="light", hair="#7a4a2c", style="long", top="#e8b83a", tops="dress", bottom="#e8b83a", shoe="#6a3a28"),
    dict(skin="dark", hair="#1c1620", style="curly", top="#4f9a5d", tops="hoodie", bottom="#2a2e3c", shoe="#f4f1ea"),
    dict(skin="pale", hair="#e0b860", style="bob", top="#4f72d0", tops="tee", bottom="#2a2630", shoe="#2a2630"),
    dict(skin="olive", hair="#241a20", style="bun", top="#f4f1ea", tops="tee", bottom="#4a6aa8", shoe="#c8423f"),
    dict(skin="light", hair="#5a3a28", style="short", top="#2a2630", tops="tee", bottom="#3b4a7a", shoe="#f4f1ea", extra="cap", cap="#c8423f"),
    dict(skin="tan", hair="#b04a2a", style="pony", top="#2f8a8a", tops="jacket", bottom="#3b3f4c", shoe="#f4f1ea"),
    dict(skin="light", hair="#8a8a94", style="bald", top="#6a6a78", tops="tee", bottom="#3b3f4c", shoe="#3a2a24", extra="beard"),
    dict(skin="olive", hair="#2b2330", style="short", top="#2f3d6b", tops="hoodie", bottom="#3b3f4c", shoe="#f4f1ea", extra="beanie", cap="#e8b83a"),
    dict(skin="light", hair="#1c1620", style="long", top="#1c1c24", tops="band", bottom="#1c1c24", shoe="#1c1c24", extra="beard"),
    dict(skin="pale", hair="#e07a90", style="bob", top="#1c1c24", tops="jacket", bottom="#3b3f4c", shoe="#c8423f", extra="glasses"),
    dict(skin="tan", hair="#c8c8d0", style="short", top="#8a5a38", tops="jacket", bottom="#5a4a3a", shoe="#3a2a24", extra="glasses"),
    dict(skin="brown", hair="#1c1620", style="curly", top="#e07a3a", tops="dress", bottom="#e07a3a", shoe="#f4f1ea"),
    dict(skin="light", hair="#d8b060", style="short", top="#f4f1ea", tops="stripes", bottom="#3b4a7a", shoe="#f4f1ea"),
    dict(skin="tan", hair="#3a2a30", style="long", top="#8a5ac8", tops="tee", bottom="#2a2630", shoe="#f4f1ea", extra="headband", cap="#e8b83a"),
    dict(skin="dark", hair="#1c1620", style="short", top="#e8b83a", tops="tee", bottom="#2a2e3c", shoe="#f4f1ea", extra="cap", cap="#2f3d6b"),
    dict(skin="olive", hair="#5a3a28", style="pony", top="#c8423f", tops="dress", bottom="#c8423f", shoe="#2a2630"),
    dict(skin="light", hair="#2b2330", style="curly", top="#4f9a5d", tops="band", bottom="#3b3f4c", shoe="#f4f1ea", extra="glasses"),
    dict(skin="pale", hair="#b04a48", style="bun", top="#2f3d6b", tops="jacket", bottom="#3b3f4c", shoe="#f4f1ea"),
    dict(skin="tan", hair="#241a20", style="short", top="#f4f1ea", tops="stripes", bottom="#2a2630", shoe="#c8423f", extra="beard"),
]


def hue(c):
    return SKINS.get(c, c)


class Pal:
    def __init__(self, s):
        self.skin = hx(hue(s["skin"]))
        self.skin2 = dark(self.skin, .22)
        self.skin3 = light(self.skin, .25)
        self.hair = hx(s["hair"])
        self.hair2 = dark(self.hair, .32)
        self.hair3 = light(self.hair, .26)
        self.top = hx(s["top"])
        self.top2 = dark(self.top, .3)
        self.top3 = light(self.top, .22)
        self.bottom = hx(s["bottom"])
        self.bottom2 = dark(self.bottom, .3)
        self.shoe = hx(s["shoe"])
        self.shoe2 = dark(self.shoe, .3)
        self.cap = hx(s.get("cap", "#c8423f"))
        self.cap2 = dark(self.cap, .3)


def legs(c, p, s, lift=(0, 0), wide=0):
    """Two legs and two shoes (front or back view)."""
    for k, (x0, x1) in enumerate(((12 - wide, 15 - wide), (17 + wide, 20 + wide))):
        up = lift[k]
        if s["tops"] == "dress":
            c.rect(x0, 25 - up, x1, 27 - up, p.skin)
            c.hline(x0, x1, 27 - up, p.skin2)
        else:
            c.rect(x0, 24 - up, x1, 27 - up, p.bottom)
            c.vline(x1, 24 - up, 27 - up, p.bottom2)
            c.vline(x0, 24 - up, 26 - up, mix(p.bottom, "#ffffff", .12))
        c.rect(x0, 28 - up, x1, 29 - up, p.shoe)
        c.hline(x0, x1, 29 - up, p.shoe2)


def torso_front(c, p, s, back=False):
    t = s["tops"]
    c.rect(9, 16, 22, 23, p.top)
    c.hline(9, 22, 16, p.top3)  # shoulder line
    c.vline(22, 17, 23, p.top2)
    c.hline(9, 22, 23, p.top2)
    if t == "dress":
        c.poly([(9, 22), (22, 22), (24, 27), (7, 27)], p.top)
        c.hline(7, 24, 27, p.top2)
        c.vline(23, 23, 26, p.top2)
        c.set(11, 24, p.top3)
        c.set(12, 26, p.top3)
    if t == "hoodie":
        c.hline(11, 20, 16, p.top2) if not back else c.rect(12, 16, 19, 18, p.top2)
        c.rect(12, 21, 19, 22, p.top2) if not back else None
    if t == "jacket":
        if not back:
            c.vline(15, 17, 23, p.top2)
            c.vline(16, 17, 23, p.top3)
            c.rect(12, 17, 13, 17, p.top3)
        else:
            c.vline(15, 17, 23, p.top2)
    if t == "stripes":
        for y in range(17, 23, 2):
            c.hline(10, 21, y, p.top2 if p.top[0] > 200 else p.top3)
    if t == "band" and not back:  # a band tee: a small round print and a bar
        c.ell(15.5, 20, 3, 2.4, hx("#e8b83a"))
        c.ell(15.5, 20, 1.4, 1.1, hx("#c8423f"))
    if t == "band" and back:
        c.rect(11, 18, 20, 19, hx("#e8e8e0"))
        c.rect(12, 20, 19, 20, hx("#c8423f"))
    # neck and collar
    if not back:
        c.rect(14, 15, 17, 16, p.skin2)
        if t in ("tee", "stripes", "band", "dress"):
            c.rect(14, 16, 17, 16, p.skin)


def arms_front(c, p, s, pose):
    t = s["tops"]
    long_sleeve = t in ("hoodie", "jacket")
    sleeve_end = 21 if long_sleeve else 19
    # pose: stand (both down), danceL (left arm up), danceR (right arm up)
    for side, (x0, x1) in (("L", (8, 10)), ("R", (21, 23))):
        up = (pose == "danceL" and side == "L") or (pose == "danceR" and side == "R")
        if not up:
            c.rect(x0, 17, x1, sleeve_end, p.top)
            c.vline(x1 if side == "R" else x0, 18, sleeve_end, p.top2 if side == "R" else p.top3)
            c.rect(x0, sleeve_end + 1, x1, 22, p.skin)
            c.hline(x0, x1, 22, p.skin2)
        else:
            sx = x0 - 1 if side == "L" else x0 + 1
            c.rect(sx, 10, sx + 2, 17, p.top)
            c.vline(sx + (2 if side == "R" else 0), 11, 16, p.top2 if side == "R" else p.top3)
            c.rect(sx, 6, sx + 2, 9, p.skin)
            c.hline(sx, sx + 2, 9, p.skin2)
            c.set(sx + 1, 5, p.skin3)


def head_front(c, p, s, back=False):
    st = s["style"]
    cx, cy = 15.5, 8.5
    rx, ry = 8.2, 7.3
    if st == "curly":
        rx, ry = 9.0, 8.0
    # back hair (long hair falls behind the shoulders)
    if st == "long":
        c.rect(8, 10, 10, 19, p.hair2)
        c.rect(21, 10, 23, 19, p.hair2)
        c.vline(8, 11, 18, p.hair)
    c.ell(cx, cy, rx, ry, p.skin)
    # hair cap
    def cap_to(y_forehead):
        for y in range(0, 32):
            for x in range(0, 32):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1 and y <= y_forehead:
                    c.set(x, y, p.hair)
    if back:
        c.ell(cx, cy, rx, ry, p.hair)
        if st == "bald":
            c.ell(cx, cy, rx - .6, ry - .6, mix(p.skin, p.hair, .25))
        c.ell(cx - 1.5, cy - 2, rx - 4, ry - 4.5, p.hair3) if st != "bald" else None
        c.hline(10, 21, 14, p.hair2) if st not in ("bald",) else c.hline(11, 20, 14, p.skin2)
        if st == "long":
            c.rect(9, 10, 22, 19, p.hair)
            c.rect(11, 12, 12, 18, p.hair3)
            c.hline(9, 22, 19, p.hair2)
        if st == "pony":
            c.rect(14, 15, 17, 21, p.hair)
            c.vline(17, 16, 21, p.hair2)
        if st == "bun":
            c.ell(15.5, 1.8, 3.2, 2.8, p.hair)
            c.set(14, 1, p.hair3)
        if st == "bob":
            c.rect(8, 10, 23, 14, p.hair)
            c.hline(8, 23, 14, p.hair2)
    else:
        forehead = {"short": 8, "bob": 8, "long": 7, "pony": 8, "bun": 8, "curly": 7, "bald": 3, "buzz": 5}[st]
        cap_to(forehead)
        if st == "bald":
            c.ell(cx, cy - 2.6, rx - 1.5, ry - 4.2, mix(p.skin, p.hair, .22))
        # fringe: a notched hairline
        if st in ("short", "pony", "bun", "bob"):
            for x in range(9, 23):
                if (x + (0 if st != "bob" else 1)) % 4 == 0:
                    c.set(x, forehead + 1, p.hair)
            c.set(12, forehead + 2, p.hair) if st in ("short", "bob") else None
            c.set(19, forehead + 2, p.hair) if st in ("short", "bob") else None
        if st == "curly":
            for (x, y) in ((8, 9), (7, 8), (23, 9), (24, 8), (9, 11), (22, 11)):
                c.set(x, y, p.hair)
            c.rect(8, 7, 9, 11, p.hair)
            c.rect(22, 7, 23, 11, p.hair)
        # sideburns / sides of hair beside the face
        if st in ("short", "bob", "long", "pony", "bun"):
            ys = 12 if st in ("bob", "long") else 10
            c.rect(8, 8, 9, ys, p.hair)
            c.rect(22, 8, 23, ys, p.hair)
        if st == "bob":
            c.rect(8, 8, 10, 13, p.hair)
            c.rect(21, 8, 23, 13, p.hair)
            c.hline(8, 10, 13, p.hair2)
            c.hline(21, 23, 13, p.hair2)
        if st == "long":
            c.rect(8, 8, 10, 17, p.hair)
            c.rect(21, 8, 23, 17, p.hair)
            c.vline(9, 10, 16, p.hair3)
        if st == "pony":
            c.rect(23, 9, 25, 15, p.hair)
            c.vline(25, 10, 15, p.hair2)
            c.rect(23, 9, 24, 10, hx("#e07a90"))
        if st == "bun":
            c.ell(15.5, 1.8, 3.2, 2.8, p.hair)
            c.set(14, 1, p.hair3)
        # highlight on the hair, a hand placed arc
        if st != "bald":
            for x in range(11, 15):
                c.set(x, 3 + (1 if x > 12 else 0), p.hair3)
        # eyes: dark 1x3 with a white pixel on the outer side (like the chibi sheets), brows follow the hair
        for ex, wx in ((13, 12), (19, 18)):
            c.rect(ex, 10, ex, 12, hx("#2a1c22"))
            c.set(wx, 11, hx("#f4f1ea"))
        c.set(15, 13, p.skin2)
        c.set(16, 13, p.skin2)
        # cheeks
        c.set(11, 12, mix(p.skin, "#e07a90", .35))
        c.set(21, 12, mix(p.skin, "#e07a90", .35))
        # chin shade
        c.hline(11, 20, 14, p.skin2)
        if s.get("extra") == "beard":
            c.rect(10, 12, 21, 14, p.hair)
            c.rect(13, 12, 18, 12, p.skin)
            c.rect(14, 13, 17, 13, p.skin2)
            c.set(15, 13, hx("#8a3a3a"))
        if s.get("extra") == "glasses":
            c.hline(11, 14, 10, hx("#2a2630"))
            c.hline(17, 20, 10, hx("#2a2630"))
            c.hline(11, 14, 13, hx("#2a2630"))
            c.hline(17, 20, 13, hx("#2a2630"))
            c.vline(11, 10, 13, hx("#2a2630"))
            c.vline(14, 10, 13, hx("#2a2630"))
            c.vline(17, 10, 13, hx("#2a2630"))
            c.vline(20, 10, 13, hx("#2a2630"))
            c.hline(15, 16, 11, hx("#2a2630"))
    ex = s.get("extra")
    if ex == "cap":
        c.ell(cx, cy - 1.2, rx + .2, ry - 1.8, p.cap, ymax=7)
        c.rect(9, 7, 22, 7, p.cap2)
        if not back:
            c.rect(10, 8, 21, 8, p.cap2)
            c.rect(11, 8, 20, 9, p.cap)
            c.hline(11, 20, 9, p.cap2)
        c.set(11, 3, light(p.cap, .3))
        c.set(12, 3, light(p.cap, .3))
    if ex == "beanie":
        c.ell(cx, cy - 1.0, rx + .2, ry - 1.4, p.cap, ymax=8)
        c.rect(8, 7, 23, 8, p.cap2)
        for x in range(9, 23, 2):
            c.vline(x, 2, 6, p.cap2)
        c.set(11, 3, light(p.cap, .3))
        c.set(12, 3, light(p.cap, .3))
        c.set(15, 0, p.cap)
        c.set(16, 0, p.cap)
    if ex == "headband":
        c.rect(8, 6, 23, 7, p.cap)
        c.hline(8, 23, 7, p.cap2)


def body_front(pose, p, s, back=False):
    c = Canvas(32, 32)
    lift = {"stand": (0, 0), "danceL": (1, 0), "danceR": (0, 1)}[pose]
    legs(c, p, s, lift, wide=1 if pose != "stand" else 0)
    torso_front(c, p, s, back)
    arms_front(c, p, s, pose)
    head_front(c, p, s, back)
    c.outline(OUTL)
    # lift the dancer by one pixel on the beat: handled by the runtime hop
    return c


def side_left(pose, p, s):
    """Facing left; the right-facing row is its mirror image."""
    c = Canvas(32, 32)
    st = s["style"]
    t = s["tops"]
    lift = {"stand": (0, 0), "danceL": (1, 0), "danceR": (0, 1)}[pose]
    # legs: one in front of the other
    for k, (x0, x1) in enumerate(((12, 15), (16, 19))):
        up = lift[k]
        if t == "dress":
            c.rect(x0, 25 - up, x1, 27 - up, p.skin)
        else:
            c.rect(x0, 24 - up, x1, 27 - up, p.bottom if k == 0 else p.bottom2)
        c.rect(x0 - (2 if k == 0 else 0), 28 - up, x1, 29 - up, p.shoe if k == 0 else p.shoe2)
    # torso
    c.rect(11, 16, 20, 23, p.top)
    c.hline(11, 20, 16, p.top3)
    c.vline(20, 17, 23, p.top2)
    c.hline(11, 20, 23, p.top2)
    if t == "dress":
        c.poly([(11, 22), (20, 22), (22, 27), (9, 27)], p.top)
        c.hline(9, 22, 27, p.top2)
    if t == "stripes":
        for y in range(17, 23, 2):
            c.hline(12, 19, y, p.top2 if p.top[0] > 200 else p.top3)
    if t == "band":
        c.rect(12, 19, 18, 20, hx("#e8b83a"))
    if t in ("jacket", "hoodie"):
        c.vline(11, 17, 23, p.top3)
    c.rect(14, 15, 17, 16, p.skin2)
    # arm in front
    up = pose != "stand"
    if not up:
        c.rect(13, 17, 17, 19 if t not in ("hoodie", "jacket") else 21, p.top)
        c.rect(13, 20 if t not in ("hoodie", "jacket") else 22, 17, 22, p.skin)
        c.vline(17, 18, 21, p.top2)
        c.hline(13, 17, 22, p.skin2)
    else:
        c.rect(9, 11, 13, 17, p.top)
        c.rect(7, 7, 10, 11, p.skin)
        c.hline(7, 10, 11, p.skin2)
    # head facing left
    cx, cy = 15.5, 8.5
    rx, ry = 7.8, 7.3
    if st == "curly":
        rx, ry = 8.8, 8.0
    if st == "long":
        c.rect(15, 9, 22, 19, p.hair2)
    c.ell(cx, cy, rx, ry, p.hair)
    # face on the left part
    for y in range(32):
        for x in range(32):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1 and x <= 14 and y >= (7 if st != "curly" else 6) and y <= 14:
                c.set(x, y, p.skin)
    c.set(7, 11, p.skin)  # nose
    c.set(7, 12, p.skin2)
    c.rect(11, 10, 11, 12, hx("#2a1c22"))
    c.set(10, 11, hx("#f4f1ea"))
    c.hline(9, 13, 14, p.skin2)
    c.set(9, 12, mix(p.skin, "#e07a90", .35))
    if st == "bald":
        c.ell(cx - 1, cy - 2.2, rx - 2, ry - 4, mix(p.skin, p.hair, .22))
    if st in ("short", "bob", "pony", "bun", "long"):
        c.rect(9, 5, 14, 7, p.hair)
        c.set(8, 7, p.hair)
    if st == "bob":
        c.rect(15, 9, 21, 14, p.hair)
    if st == "long":
        c.rect(15, 9, 21, 18, p.hair)
        c.vline(17, 11, 17, p.hair3)
    if st == "pony":
        c.rect(21, 9, 24, 17, p.hair)
        c.vline(24, 10, 17, p.hair2)
    if st == "bun":
        c.ell(17, 1.8, 3.2, 2.8, p.hair)
    if st != "bald":
        for x in range(11, 14):
            c.set(x, 3 + (1 if x > 11 else 0), p.hair3)
    if s.get("extra") == "beard":
        c.rect(8, 12, 12, 14, p.hair)
        c.rect(13, 13, 15, 14, p.hair)
    if s.get("extra") == "glasses":
        c.hline(8, 11, 10, hx("#2a2630"))
        c.hline(8, 11, 13, hx("#2a2630"))
        c.vline(8, 10, 13, hx("#2a2630"))
        c.hline(12, 14, 11, hx("#2a2630"))
    ex = s.get("extra")
    if ex == "cap":
        c.ell(cx, cy - 1.2, rx + .2, ry - 1.8, p.cap, ymax=7)
        c.rect(5, 7, 13, 7, p.cap2)
        c.rect(5, 6, 9, 7, p.cap)
    if ex == "beanie":
        c.ell(cx, cy - 1.0, rx + .2, ry - 1.4, p.cap, ymax=8)
        c.rect(8, 7, 22, 8, p.cap2)
        c.set(15, 0, p.cap)
    if ex == "headband":
        c.rect(8, 6, 22, 7, p.cap)
    c.outline(OUTL)
    return c


def sheet(spec):
    p = Pal(spec)
    out = Image.new("RGBA", (96, 128), (0, 0, 0, 0))
    poses = ("danceL", "stand", "danceR")
    for col, pose in enumerate(poses):
        out.alpha_composite(body_front(pose, p, spec).im, (col * 32, 0))
        left = side_left(pose, p, spec).im
        out.alpha_composite(left, (col * 32, 32))
        out.alpha_composite(ImageOps.mirror(left), (col * 32, 64))
        out.alpha_composite(body_front(pose, p, spec, back=True).im, (col * 32, 96))
    return out


def write():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("crowd-*.png"):
        old.unlink()
    for n, spec in enumerate(PEOPLE, 1):
        sheet(spec).save(OUT / ("crowd-%d.png" % n), optimize=True)
    return len(PEOPLE)


def main():
    print("PASS crowd: %d sheets" % write())


if __name__ == "__main__":
    main()
