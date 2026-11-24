"""Floors, wall caps and wall faces of the tile generator: single seamless 32x32 tiles. Floors are calm (no outline, no pixel noise,
low contrast, a bevel of one light and one dark pixel per stone); walls have a cap seen from above, a face with a cornice shadow, a
baseboard and a dark contact line, and the `shade_*` strips cast a soft shadow on the floor."""
from tilepaint import (BRICK, CAP, FLOOR_WOOD, GREEN, METAL, OUT, PLASTER, RED, STONE, WOOD, Canvas, T, dark, hx, light, make_ramp, mix,
                       rng)

WARM = make_ramp("#e8c48c", 4, 1)    # the warm cream plaster of the venue walls
STAGE_WOOD = make_ramp("#7a4a2e", 4, 1)      # the dark boards of the band riser


def wset(c, x, y, colr):
    c.set(x % T, y % T, colr)


# ---------------------------------------------------------------- floors

def _slabs(r):
    """Random flagstone layout of a tile: the interior 1..30 is split again and again (never below 11 px, never leaving a leaf
    over 17 px on both sides) with 2 px joints. Every layout leaves a grout line along the tile border, so any two variants join."""
    leaves = []

    def split(x0, y0, x1, y1, depth):
        w, h = x1 - x0, y1 - y0
        can_v, can_h = w >= 24, h >= 24
        if not (can_v or can_h):
            leaves.append((x0, y0, x1 - 1, y1 - 1))
            return
        go_v = can_v and (not can_h or w > h or (w == h and r.random() < .5))
        if r.random() < .12 and depth > 0:                 # now and then a long slab is left whole
            go_v = not go_v if (can_v and can_h) else go_v
        if go_v:
            p = r.randrange(11, w - 11 - 2 + 1)
            split(x0, y0, x0 + p, y1, depth + 1)
            split(x0 + p + 2, y0, x1, y1, depth + 1)
        else:
            p = r.randrange(11, h - 11 - 2 + 1)
            split(x0, y0, x1, y0 + p, depth + 1)
            split(x0, y0 + p + 2, x1, y1, depth + 1)

    split(1, 1, 31, 31, 0)
    return leaves


def floor_stone(name, variant=0, cool=False, dirty=0.0, seed=None):
    """Irregular flagstones, seamless, calm: 3 to 6 soft slabs per tile with rounded corners, a lit top left edge and a shaded bottom
    right edge, one glint, no noise. The layout comes from the name, the border of every tile is grout, so tiles mix freely."""
    c = Canvas()
    gro = dark(STONE[1], .36 if not cool else .45)
    c.rect(0, 0, T - 1, T - 1, gro)
    r = rng("flag-%s" % (seed if seed is not None else name))
    rv = rng("flagtone-" + name)
    base_tones = [STONE[2], mix(STONE[2], STONE[3], .4), mix(STONE[2], STONE[1], .3), mix(STONE[2], STONE[3], .18)]
    if cool:
        base_tones = [mix(t, "#9aa4c0", .25) for t in base_tones]
    for (xa, ya, xb, yb) in _slabs(r):
        rad = r.choice([2, 3, 3, 4])
        tone = rv.choice(base_tones)
        tone = mix(tone, STONE[0], dirty * rv.random())
        for y in range(ya, yb + 1):
            for x in range(xa, xb + 1):
                dx, dy = min(x - xa, xb - x), min(y - ya, yb - y)
                if dx < rad and dy < rad and dx + dy < rad:
                    continue
                colr = tone
                if y == ya or (x == xa and dy >= 1):
                    colr = light(tone, .15)
                elif y == yb or (x == xb and dy >= 1):
                    colr = dark(tone, .16)
                elif y == ya + 1 and dx >= rad:
                    colr = light(tone, .07)
                elif y == yb - 1 and dx >= rad:
                    colr = dark(tone, .07)
                c.set(x, y, colr)
        c.set(xa + 2, ya + 1, light(tone, .42))              # a hand placed glint at the lit corner
        c.set(xa + 1, ya + 2, light(tone, .3))
        if variant and xb - xa > 8 and yb - ya > 8 and rv.random() < .5:   # a soft speck or two, never noise
            px, py = rv.randrange(xa + 3, xb - 3), rv.randrange(ya + 3, yb - 3)
            c.set(px, py, dark(tone, .16))
            c.set(px + 1, py, dark(tone, .08))
    if variant == 2:  # a hairline crack across one stone
        x, y = 14, 4
        for k in range(8):
            c.set(x, y, dark(STONE[1], .4))
            x += 1 if k % 2 else 0
            y += 1
    if variant == 3:  # a darker worn patch where feet linger
        for (x, y) in ((6, 22), (7, 22), (8, 23), (9, 23), (7, 24), (8, 24), (9, 24), (10, 25)):
            if c.get(x, y)[:3] != gro[:3]:
                c.set(x, y, dark(c.get(x, y), .14))
    if variant == 4:  # a pebble that has come loose
        c.disc(24, 24, 1.6, light(STONE[2], .05))
        c.set(23, 23, light(STONE[3], .3))
        c.set(25, 25, dark(STONE[1], .25))
    return c


def floor_wood(name, tones, seed, planks=4):
    """Long horizontal boards, seamless. Only every other board has an end joint in a tile, so the boards read long and the floor
    does not turn into brickwork. Row tones are fixed so variants join; the grain differs. A lit top edge and a dark seam."""
    c = Canvas()
    r = rng(name)
    joints = [None, 9, None, 25]       # a joint on two boards of four, staggered
    bh = T // planks
    for row in range(planks):
        y0 = row * bh
        base = tones[[1, 2, 1, 2][row % 4]]
        if row % 2:
            base = mix(base, hx("#ffffff"), 0.04)
        c.rect(0, y0, T - 1, y0 + bh - 1, base)
        c.hline(0, T - 1, y0, mix(base, tones[0], .5))
        c.hline(0, T - 1, y0 + 1, light(base, .13))
        c.hline(0, T - 1, y0 + bh - 1, mix(base, tones[0], 0.22))
        j = joints[row % 4]
        if j is not None:
            c.vline(j, y0, y0 + bh - 1, mix(base, tones[0], .55))
            c.vline((j + 1) % T, y0 + 2, y0 + bh - 2, light(base, .08))
            c.set((j + 4) % T, y0 + 3, dark(tones[0], .15))  # nails near the joint
            c.set((j - 4) % T, y0 + 3, dark(tones[0], .15))
        for _ in range(3):  # grain: long soft streaks along the board
            gx = r.randrange(0, T - 12)
            gy = y0 + r.randrange(2, bh - 1)
            ln = r.randrange(7, 14)
            tone = tones[0] if r.random() < .6 else tones[3]
            for k in range(ln):
                if (gx + k) % T != j:
                    c.set(gx + k, gy, mix(base, tone, 0.14))
    return c


def floor_stage(name, seed):
    return floor_wood(name, STAGE_WOOD, seed, planks=4)


def riser_edge(side):
    """Edges of the low band riser (one step, about 8 px): `front` is the lip under the lowest row, `left` the step on its left side,
    `corner` both. The floor on top is the same dark boards, the step face is darker with a lit lip and a shadow foot."""
    c = floor_stage("floor_stage_a", 1)
    face = (T - 8) if side in ("front", "corner") else T
    if side in ("front", "corner"):
        c.rect(0, face, T - 1, T - 1, STAGE_WOOD[0])
        c.hline(0, T - 1, face, light(STAGE_WOOD[3], .25))        # the lit lip
        c.hline(0, T - 1, face + 1, STAGE_WOOD[3])
        c.rect(0, face + 2, T - 1, face + 5, STAGE_WOOD[1])
        for x in range(0, T, 8):                                  # boards of the face
            c.vline(x, face + 2, face + 5, STAGE_WOOD[0])
        c.hline(0, T - 1, T - 2, dark(STAGE_WOOD[0], .35))
        c.hline(0, T - 1, T - 1, dark(STAGE_WOOD[0], .6))
    if side in ("left", "corner"):
        c.rect(0, 0, 7, T - 1 if side == "left" else face - 1, STAGE_WOOD[1])
        c.vline(7, 0, T - 1 if side == "left" else face - 1, light(STAGE_WOOD[3], .25))
        c.vline(6, 0, T - 1 if side == "left" else face - 1, STAGE_WOOD[3])
        c.vline(0, 0, T - 1, dark(STAGE_WOOD[0], .5))
        c.vline(1, 0, T - 1, dark(STAGE_WOOD[0], .2))
        c.rect(2, 0, 5, (T - 1 if side == "left" else face - 1), STAGE_WOOD[0])
    return c


def floor_checker(name, a="#efe3c4", b="#6a8a82", size=16):
    c = Canvas()
    for y in range(T):
        for x in range(T):
            odd = ((x // size) + (y // size)) % 2
            base = hx(b if odd else a)
            lx, ly = x % size, y % size
            if lx == 0 or ly == 0:
                base = light(base, .3)
            elif lx == size - 1 or ly == size - 1:
                base = dark(base, .26)
            c.set(x, y, base)
    # a soft sheen in each light square, hand placed
    for (x, y) in ((3, 3), (4, 3), (3, 4), (19, 19), (20, 19), (19, 20)):
        c.set(x, y, light(c.get(x, y), .3))
    return c


def floor_carpet(name, tones):
    c = Canvas()
    c.rect(0, 0, T - 1, T - 1, tones[2])
    for y in range(0, T, 2):  # woven rows
        for x in range(T):
            if (x + y // 2) % 3 == 0:
                c.set(x, y, tones[1])
            elif (x + y // 2) % 4 == 1:
                c.set(x, y + 1, tones[3])
    return c


def floor_grass(name, tone=0):
    c = Canvas()
    r = rng(name)
    base = [GREEN[2], GREEN[1], GREEN[3]][tone]
    c.rect(0, 0, T - 1, T - 1, base)
    c.noise(0, 0, T - 1, T - 1, [GREEN[1], GREEN[3], GREEN[2]], 0.22, r)
    for _ in range(9):  # little blades
        x, y = r.randrange(1, T - 2), r.randrange(3, T - 1)
        c.set(x, y, GREEN[0])
        c.set(x, y - 1, GREEN[4])
        c.set(x + 1, y - 2, GREEN[3])
    return c


def floor_flowers(name, tone=0):
    c = floor_grass(name, tone)
    r = rng(name + "f")
    for _ in range(5):
        x, y = r.randrange(3, T - 3), r.randrange(3, T - 3)
        petal = r.choice(["#fbe07a", "#f4f1ea", "#e8695a", "#f2a0c0"])
        for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
            c.set(x + dx, y + dy, petal)
        c.set(x, y, "#e8b83a")
    return c


def floor_dirt(name):
    c = Canvas()
    r = rng(name)
    c.rect(0, 0, T - 1, T - 1, "#b48a58")
    c.noise(0, 0, T - 1, T - 1, ["#9a7244", "#c9a06a", "#a67c4c"], 0.26, r)
    for _ in range(7):
        x, y = r.randrange(T), r.randrange(T)
        c.set(x, y, "#7a5634")
        c.set(x + 1, y, "#8a6540")
    return c


def floor_tiles_plain(name, a="#e6ebea", b="#c4cfd0"):
    """Light square floor tiles (kitchen, university)."""
    c = Canvas()
    c.rect(0, 0, T - 1, T - 1, a)
    c.hline(0, T - 1, 0, "#ffffff")
    c.vline(0, 0, T - 1, "#ffffff")
    c.hline(0, T - 1, T - 1, b)
    c.vline(T - 1, 0, T - 1, b)
    for (x, y) in ((5, 6), (6, 6), (5, 7), (20, 21), (21, 21)):
        c.set(x, y, mix(a, b, .35))
    return c


def shade_strip(name, kind):
    """Translucent shadow tiles for the `below` layer: a soft band under a wall, a stage or a big piece of furniture. Stepped, with a
    dithered rim, tinted violet so the floor keeps cool shade instead of going grey."""
    c = Canvas()
    steps = [92, 70, 50, 34, 20, 10]
    for d, a in enumerate(steps):
        for i in range(T):
            if kind == "top":
                x, y = i, d * 2
            elif kind == "left":
                x, y = d * 2, i
            else:
                x, y = T - 1 - d * 2, i
            for k in range(2):
                xx, yy = (x, y + k) if kind == "top" else ((x + k, y) if kind == "left" else (x - k, y))
                half = a if (k == 0 or (i + d) % 2 == 0) else int(a * .6)
                c.set(xx, yy, (26, 12, 40, half))
    return c


# ---------------------------------------------------------------- wall caps

def cap(edges, tone=1):
    """Top of a wall seen from above. `edges` is a subset of 'NESW': the sides that face the room get a lit rim and a dark line."""
    c = Canvas()
    r = rng("cap" + edges)
    c.rect(0, 0, T - 1, T - 1, CAP[tone])
    for x in range(0, T, 8):                       # faint joints of the coping stones
        c.vline(x + 3, 0, T - 1, dark(CAP[tone], .12))
    for _ in range(14):
        x, y = r.randrange(T), r.randrange(T)
        c.set(x, y, light(CAP[tone], .1))
    rims = {"N": (c.hline, (0, T - 1, 0), (0, T - 1, 1)), "S": (c.hline, (0, T - 1, T - 1), (0, T - 1, T - 2)),
            "W": (c.vline, (0, 0, T - 1), (1, 0, T - 1)), "E": (c.vline, (T - 1, 0, T - 1), (T - 2, 0, T - 1))}
    for e in edges:
        fn, dark_, light_ = rims[e]
        fn(*light_, CAP[3])
        fn(*dark_, dark(CAP[0], .3))
    return c


# ---------------------------------------------------------------- wall faces

def _under_cap_shadow(c, strength=0.5, rows=7):
    for y in range(rows):
        t = strength * (1 - y / rows) ** 1.3
        for x in range(T):
            c.set(x, y, dark(c.get(x, y), t))


def _skirting(c, tones, h=6):
    """A baseboard along the foot of a wall face: a lit top edge, a body and a dark contact line with the floor."""
    c.rect(0, T - h, T - 1, T - 1, tones[2])
    c.hline(0, T - 1, T - h, light(tones[3], .25))
    c.hline(0, T - 1, T - h + 1, tones[3])
    c.rect(0, T - h + 2, T - 1, T - 3, tones[2])
    c.hline(0, T - 1, T - 2, tones[1])
    c.hline(0, T - 1, T - 1, dark(tones[0], .4))
    for x in range(0, T, 16):  # a butt joint
        c.vline(x + 7, T - h + 2, T - 2, tones[1])


def plaster(part, tones=PLASTER, wain=True, name="plaster"):
    c = Canvas()
    r = rng(name + part)
    c.rect(0, 0, T - 1, T - 1, tones[1])
    # three soft hand-placed patches of a lighter and a darker tone: the wall is not flat paint, but never speckled
    for k in range(2):
        x, y = r.randrange(2, 20), r.randrange(4, 22)
        c.dither(x, y, x + 9, y + 3, tones[1], light(tones[1], .1), .25, k)
    x, y = r.randrange(2, 20), r.randrange(6, 20)
    c.dither(x, y, x + 8, y + 2, tones[1], dark(tones[1], .07), .25)
    if part == "up":
        _under_cap_shadow(c)
        c.hline(0, T - 1, 0, dark(tones[0], .55))
    elif part == "dn":
        if wain:
            c.hline(0, T - 1, 12, WOOD[1])
            c.hline(0, T - 1, 13, WOOD[3])
            c.rect(0, 14, T - 1, T - 1, WOOD[2])
            for x in range(0, T, 16):
                c.rect(x + 2, 17, x + 13, 27, WOOD[2])
                c.hline(x + 2, x + 13, 17, dark(WOOD[1], .1))
                c.vline(x + 2, 17, 27, dark(WOOD[1], .1))
                c.hline(x + 2, x + 13, 27, light(WOOD[3], .1))
                c.vline(x + 13, 17, 27, light(WOOD[3], .1))
            _skirting(c, WOOD, 4)
        else:
            _skirting(c, WOOD, 6)
    return c


def warm_wall(part):
    """The cream plaster of the Cortile hall. up: cornice shadow under the cap; mid: plain; dn: baseboard."""
    return plaster(part, WARM, wain=False, name="warm")


def brick(part, tones=BRICK, name="brick"):
    c = Canvas()
    r = rng(name + part)
    mortar = mix(tones[1], hx("#d8b890"), .35)
    c.rect(0, 0, T - 1, T - 1, mortar)
    for row in range(4):
        y0 = row * 8
        off = 0 if row % 2 == 0 else 8
        for bx in range(-16, T + 16, 16):
            x0 = bx + off
            base = tones[r.choice([1, 2, 2, 2, 3])]
            for y in range(y0 + 1, y0 + 8):
                for x in range(max(0, x0 + 1), min(T, x0 + 16)):
                    c.set(x, y, base)
            for x in range(max(0, x0 + 1), min(T, x0 + 16)):
                c.set(x, y0 + 1, light(base, .22))
                c.set(x, y0 + 7, dark(base, .25))
            if 0 <= x0 + 15 < T:
                for y in range(y0 + 1, y0 + 8):
                    c.set(x0 + 15, y, dark(c.get(x0 + 15, y), .15))
    if part == "up":
        _under_cap_shadow(c)
        c.hline(0, T - 1, 0, dark(tones[0], .55))
    else:
        c.rect(0, T - 6, T - 1, T - 1, STONE[1])
        c.hline(0, T - 1, T - 6, STONE[3])
        c.hline(0, T - 1, T - 1, dark(STONE[0], .3))
        for x in range(0, T, 16):
            c.vline(x + 15, T - 5, T - 2, STONE[0])
    return c


def wood_wall(part, name="woodwall"):
    c = Canvas()
    r = rng(name + part)
    tones = WOOD
    for i in range(4):
        x0 = i * 8
        base = tones[2] if i % 2 == 0 else mix(tones[2], tones[1], .35)
        c.rect(x0, 0, x0 + 7, T - 1, base)
        c.vline(x0, 0, T - 1, tones[1])
        c.vline(x0 + 1, 0, T - 1, light(tones[3], .1))
        for _ in range(2):
            gx = x0 + r.randrange(2, 7)
            gy = r.randrange(0, T - 8)
            for k in range(r.randrange(4, 9)):
                c.set(gx, gy + k, mix(base, tones[1], .4))
    if part == "up":
        _under_cap_shadow(c, .55)
        c.hline(0, T - 1, 0, dark(tones[0], .5))
    else:
        _skirting(c, tones, 5)
    return c


def stone_wall(part, name="stonewall"):
    c = Canvas()
    r = rng(name + part)
    mortar = hx(STONE[0])
    c.rect(0, 0, T - 1, T - 1, mortar)
    rows = [(0, 11), (11, 22), (22, 32)]
    for ri, (y0, y1) in enumerate(rows):
        x = -r.randrange(0, 10)
        while x < T:
            wdt = r.randrange(10, 17)
            base = hx(STONE[r.choice([1, 2, 2, 3])])
            for yy in range(y0 + 1, y1):
                for xx in range(max(0, x + 1), min(T, x + wdt)):
                    c.set(xx, yy, base)
            for xx in range(max(0, x + 1), min(T, x + wdt)):
                c.set(xx, y0 + 1, light(base, .22))
                c.set(xx, y1 - 1, dark(base, .25))
            x += wdt
    if part == "up":
        _under_cap_shadow(c, .55)
        c.hline(0, T - 1, 0, dark(STONE[0], .5))
    else:
        c.hline(0, T - 1, T - 1, dark(STONE[0], .4))
    return c


def define(reg):
    for v, n in enumerate("abcdefgh"):   # eight plain layouts: mix them at random, they join anywhere
        reg.tile("stone_" + n, floor_stone("stone_" + n, 1 if v % 3 == 0 else 0))
    reg.tile("stone_crack", floor_stone("stone_crack", 2))
    reg.tile("stone_worn", floor_stone("stone_worn", 3))
    reg.tile("stone_pebble", floor_stone("stone_pebble", 4))
    reg.tile("stone_cool", floor_stone("stone_cool", 0, cool=True))
    reg.tile("stone_dirty", floor_stone("stone_dirty", 1, dirty=.35))
    # compatibility names the other rooms were drawn with
    for v, n in enumerate(("cobble_a", "cobble_b", "cobble_c", "cobble_d")):
        reg.tile(n, floor_stone(n, v + 1))
    reg.tile("cobble_cool", floor_stone("cobble_cool", 0, cool=True))
    for v in "abc":
        reg.tile("floor_wood_" + v, floor_wood("floor_wood_" + v, FLOOR_WOOD, 1))
    reg.tile("floor_stage_a", floor_stage("floor_stage_a", 1))
    reg.tile("floor_stage_b", floor_stage("floor_stage_b", 2))
    reg.tile("floor_stage_c", floor_stage("floor_stage_c", 3))
    reg.tile("riser_front", riser_edge("front"))
    reg.tile("riser_left", riser_edge("left"))
    reg.tile("riser_corner", riser_edge("corner"))
    reg.tile("floor_checker", floor_checker("floor_checker"))
    reg.tile("floor_checker_blue", floor_checker("floor_checker_blue", "#e6ecef", "#4a64a8"))
    reg.tile("floor_checker_dark", floor_checker("floor_checker_dark", "#d8c8a4", "#4a5a58"))
    reg.tile("floor_carpet_red", floor_carpet("floor_carpet_red", RED))
    reg.tile("floor_carpet_blue", floor_carpet("floor_carpet_blue", ["#1d2f6a", "#2f4aa0", "#3f5cb4", "#5a7cd0"]))
    reg.tile("floor_tiles", floor_tiles_plain("floor_tiles"))
    reg.tile("floor_tiles_warm", floor_tiles_plain("floor_tiles_warm", "#efe0c0", "#cdb98e"))
    for i in range(3):
        reg.tile("grass_" + "abc"[i], floor_grass("grass_" + "abc"[i], i))
    reg.tile("grass_flowers_a", floor_flowers("grass_flowers_a", 0))
    reg.tile("grass_flowers_b", floor_flowers("grass_flowers_b", 1))
    reg.tile("dirt_a", floor_dirt("dirt_a"))
    reg.tile("dirt_b", floor_dirt("dirt_b"))
    reg.tile("shade_top", shade_strip("shade_top", "top"))
    reg.tile("shade_left", shade_strip("shade_left", "left"))
    reg.tile("shade_right", shade_strip("shade_right", "right"))

    # caps: every combination of rims (N E S W), solid
    for mask in range(16):
        edges = "".join(e for i, e in enumerate("NESW") if mask >> i & 1)
        reg.tile("cap_" + (edges or "none"), cap(edges), solid=True)

    for part in ("up", "mid", "dn"):
        reg.tile("plaster_warm_" + part, warm_wall(part), solid=True)
    for mat, fn in (("plaster", lambda p: plaster(p)), ("plaster_plain", lambda p: plaster(p, wain=False, name="plainplaster")),
                    ("plaster_blue", lambda p: plaster(p, make_ramp("#8c9cd8", 4, 1), wain=False, name="blueplaster")),
                    ("brick", brick), ("wood", wood_wall), ("stone", stone_wall)):
        reg.tile(mat + "_up", fn("up"), solid=True)
        reg.tile(mat + "_dn", fn("dn"), solid=True)
