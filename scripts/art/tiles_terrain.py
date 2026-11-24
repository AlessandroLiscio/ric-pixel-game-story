"""Floors, wall caps and wall faces of the tile generator: single seamless 32x32 tiles."""
from tilepaint import (BRICK, CAP, CREAM, FLOOR_WOOD, GREEN, METAL, OUT, PLASTER, RED, STONE, WOOD, Canvas, T, hx, mix, rng)


# ---------------------------------------------------------------- floors

def floor_wood(name, tones, seed, planks=4):
    """Horizontal boards. Row tones are fixed so variants join; only grain and nails differ."""
    c = Canvas()
    r = rng(name)
    joints = [6, 22, 13, 29]
    bh = T // planks
    for row in range(planks):
        y0 = row * bh
        base = tones[(row * 3 + 1) % len(tones) if row % 2 == 0 else (row * 3 + 2) % len(tones)]
        base = tones[[1, 2, 1, 2][row % 4]]
        if row % 2:
            base = mix(base, hx("#ffffff"), 0.05)
        c.rect(0, y0, T - 1, y0 + bh - 1, base)
        c.hline(0, T - 1, y0, tones[0])
        c.hline(0, T - 1, y0 + 1, tones[3])
        c.hline(0, T - 1, y0 + bh - 1, mix(base, tones[0], 0.35))
        j = joints[row % 4]
        c.vline(j, y0, y0 + bh - 1, tones[0])
        c.vline((j + 1) % T, y0 + 2, y0 + bh - 2, mix(base, tones[3], 0.25))
        for _ in range(3):  # grain streaks
            gx = r.randrange(0, T - 8)
            gy = y0 + r.randrange(2, bh - 1)
            ln = r.randrange(4, 9)
            tone = tones[0] if r.random() < .55 else tones[3]
            for k in range(ln):
                if gx + k != j:
                    c.set(gx + k, gy, mix(base, tone, 0.28))
        c.set((j + 3) % T, y0 + 3, tones[0])  # nails
        c.set((j - 3) % T, y0 + 3, tones[0])
    return c


def floor_stage(name, seed):
    tones = ["#4a2022", "#6e3030", "#85402f", "#a85a3c"]
    c = floor_wood(name, tones, seed, planks=4)
    return c


def cobble(name, seed, tone_bias=0, moss=False, crack=False, leaf=False, cool=False):
    """Seamless cobblestones: wrapped Voronoi cells with dark joints, light on the top left, shade on the bottom right."""
    r = rng("cobble-structure-%d" % seed)  # same structure for every variant, so variants join
    sites = []
    for gy in range(3):
        for gx in range(3):
            sites.append(((gx + .5) * T / 3 + r.uniform(-3.2, 3.2), (gy + .5) * T / 3 + r.uniform(-3.2, 3.2)))
    rr = rng(name)
    tones = [STONE[2], STONE[2], STONE[3], STONE[1] if tone_bias else STONE[3]]
    stone_tone = [rr.choice(tones) for _ in sites]
    c = Canvas()
    grout = hx("#4a4034")
    for y in range(T):
        for x in range(T):
            px, py = x + .5, y + .5
            ds = []
            for i, (sx, sy) in enumerate(sites):
                best = 1e9
                for ox in (-T, 0, T):
                    for oy in (-T, 0, T):
                        d = ((px - sx - ox) ** 2 + (py - sy - oy) ** 2) ** .5
                        best = min(best, d)
                ds.append((best, i))
            ds.sort()
            d1, i1 = ds[0]
            d2 = ds[1][0]
            edge = d2 - d1
            sx, sy = sites[i1]
            base = hx(stone_tone[i1])
            if cool:
                base = mix(base, hx("#9aa4c0"), 0.25)
            if edge < 1.5:
                c.set(x, y, mix(grout, hx("#000000"), .1))
                continue
            # light vector: top-left of the stone is bright, bottom-right is dark
            lx, ly = px - sx, py - sy
            # wrap the offset to the nearest image
            lx = (lx + T / 2) % T - T / 2
            ly = (ly + T / 2) % T - T / 2
            shade = (lx + ly) / 14.0
            colr = base
            if edge < 3.0:
                colr = mix(base, hx(STONE[4]), 0.5) if shade < 0 else mix(base, hx(STONE[0]), 0.55)
            elif shade < -0.55:
                colr = mix(base, hx(STONE[4]), 0.35)
            elif shade > 0.6:
                colr = mix(base, hx(STONE[1]), 0.45)
            c.set(x, y, colr)
    for _ in range(14):  # speckles
        x, y = rr.randrange(T), rr.randrange(T)
        p = c.get(x, y)
        if p[:3] != grout[:3]:
            c.set(x, y, mix(p, hx(STONE[0]) if rr.random() < .6 else hx(STONE[4]), .35))
    if moss:
        for _ in range(26):
            x, y = rr.randrange(T), rr.randrange(T)
            if c.get(x, y)[:3] == grout[:3] or rr.random() < .15:
                c.set(x, y, mix(hx(GREEN[2]), hx(GREEN[1]), rr.random()))
    if crack:
        x, y = 8, 10
        for _ in range(9):
            c.set(x, y, hx(STONE[0]))
            x += rr.choice([0, 1, 1])
            y += rr.choice([1, 1, 0])
    if leaf:
        c.rect(20, 20, 22, 21, hx("#a85a2a"))
        c.set(21, 22, hx("#7a3a1a"))
        c.set(19, 20, hx("#d8883a"))
    for y in range(T):  # a venue at night: pull the whole floor a little toward warm brown
        for x in range(T):
            c.set(x, y, mix(c.get(x, y), hx("#3a2418"), .16))
    return c


def floor_checker(name, a="#efe3c4", b="#6a8a82", size=16):
    c = Canvas()
    for y in range(T):
        for x in range(T):
            odd = ((x // size) + (y // size)) % 2
            base = hx(b if odd else a)
            # tiny bevel: light top-left, dark bottom-right of every square
            lx, ly = x % size, y % size
            if lx == 0 or ly == 0:
                base = mix(base, hx("#ffffff"), .25)
            elif lx == size - 1 or ly == size - 1:
                base = mix(base, hx("#000000"), .22)
            c.set(x, y, base)
    c.noise(0, 0, T - 1, T - 1, [hx("#d8c9a4"), hx("#7a9a92")], 0.03, rng(name))
    return c


def floor_carpet(name, tones):
    c = Canvas()
    r = rng(name)
    c.rect(0, 0, T - 1, T - 1, tones[2])
    for y in range(0, T, 2):  # woven rows
        for x in range(T):
            if (x + y // 2) % 3 == 0:
                c.set(x, y, tones[1])
            elif (x + y // 2) % 4 == 1:
                c.set(x, y + 1, tones[3])
    c.noise(0, 0, T - 1, T - 1, [tones[1], tones[3]], 0.05, r)
    return c


def floor_grass(name, tone=0):
    c = Canvas()
    r = rng(name)
    base = [GREEN[2], GREEN[1], GREEN[3]][tone]
    c.rect(0, 0, T - 1, T - 1, base)
    c.noise(0, 0, T - 1, T - 1, [GREEN[1], GREEN[3], GREEN[2]], 0.28, r)
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
    c.noise(0, 0, T - 1, T - 1, ["#9a7244", "#c9a06a", "#a67c4c"], 0.3, r)
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
    c.noise(1, 1, T - 2, T - 2, [mix(a, b, .5)], 0.05, rng(name))
    return c


def shade_strip(name, kind):
    """Translucent shadow tiles for the `below` layer: a soft band under a raised edge or along a wall."""
    c = Canvas()
    for y in range(T):
        if kind == "top":  # darkest at the top edge (under a stage front, a wall)
            a = max(0, 95 - y * 8)
        elif kind == "left":
            a = 0
        else:
            a = 0
        for x in range(T):
            c.set(x, y, (20, 10, 24, a))
    if kind == "left":
        for x in range(T):
            for y in range(T):
                c.set(x, y, (20, 10, 24, max(0, 80 - x * 8)))
    if kind == "right":
        for x in range(T):
            for y in range(T):
                c.set(x, y, (20, 10, 24, max(0, 80 - (T - 1 - x) * 8)))
    return c


# ---------------------------------------------------------------- wall caps

def cap(edges, tone=1):
    """Top of a wall seen from above. `edges` is a subset of 'NESW': the sides that face the room get a lit rim and a dark line."""
    c = Canvas()
    r = rng("cap" + edges)
    c.rect(0, 0, T - 1, T - 1, CAP[tone])
    # subtle stone brush
    for _ in range(60):
        x, y = r.randrange(T), r.randrange(T)
        c.set(x, y, mix(CAP[tone], CAP[0] if r.random() < .5 else CAP[2], .5))
    rims = {"N": (c.hline, (0, T - 1, 0), (0, T - 1, 1)), "S": (c.hline, (0, T - 1, T - 1), (0, T - 1, T - 2)),
            "W": (c.vline, (0, 0, T - 1), (1, 0, T - 1)), "E": (c.vline, (T - 1, 0, T - 1), (T - 2, 0, T - 1))}
    for e in edges:
        fn, dark, light = rims[e]
        fn(*light, CAP[3])
        fn(*dark, CAP[0])
    return c


# ---------------------------------------------------------------- wall faces (two tiles tall: up and dn)

def _face_base(c, tones, r, noise=0.06):
    c.rect(0, 0, T - 1, T - 1, tones[2])
    c.noise(0, 0, T - 1, T - 1, [tones[1], tones[3]], noise, r)


def _under_cap_shadow(c, strength=0.45):
    for y in range(6):
        for x in range(T):
            p = c.get(x, y)
            t = strength * (1 - y / 6)
            c.set(x, y, mix(p, (20, 10, 24), t))


def plaster(part, tones=PLASTER, wain=True, name="plaster"):
    c = Canvas()
    r = rng(name + part)
    _face_base(c, tones, r, 0.07)
    for x in range(0, T, 8):  # faint vertical roller marks
        c.vline(x + r.randrange(0, 3), 0, T - 1, mix(tones[2], tones[3], .5))
    if part == "up":
        _under_cap_shadow(c)
        c.hline(0, T - 1, 0, hx("#2a1a1e"))
    elif part == "mid":
        pass
    else:
        if wain:  # wooden wainscot on the lower half
            c.hline(0, T - 1, 14, WOOD[1])
            c.hline(0, T - 1, 15, WOOD[3])
            c.rect(0, 16, T - 1, T - 1, WOOD[2])
            for x in range(0, T, 16):
                c.rect(x + 2, 18, x + 13, 28, WOOD[2])
                c.hline(x + 2, x + 13, 18, WOOD[1])
                c.vline(x + 2, 18, 28, WOOD[1])
                c.hline(x + 2, x + 13, 28, WOOD[3])
                c.vline(x + 13, 18, 28, WOOD[3])
                c.noise(x + 3, 19, x + 12, 27, [WOOD[1], WOOD[3]], .08, r)
            c.hline(0, T - 1, T - 1, WOOD[0])
            c.hline(0, T - 1, 29, WOOD[1])
        else:
            c.hline(0, T - 1, T - 1, tones[0])
            c.rect(0, T - 6, T - 1, T - 2, mix(tones[2], tones[0], .25))
            c.hline(0, T - 1, T - 6, tones[3])
    return c


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
                c.set(x, y0 + 1, mix(base, hx("#ffffff"), .25))
                c.set(x, y0 + 7, mix(base, hx("#000000"), .25))
            if 0 <= x0 + 15 < T:
                for y in range(y0 + 1, y0 + 8):
                    c.set(x0 + 15, y, mix(c.get(x0 + 15, y), hx("#000000"), .15))
    if part == "up":
        _under_cap_shadow(c)
        c.hline(0, T - 1, 0, hx("#2a1a1e"))
    else:
        c.rect(0, T - 6, T - 1, T - 1, STONE[1])
        c.hline(0, T - 1, T - 6, STONE[3])
        c.hline(0, T - 1, T - 1, STONE[0])
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
        c.vline(x0 + 1, 0, T - 1, tones[3])
        for _ in range(3):
            gx = x0 + r.randrange(2, 7)
            gy = r.randrange(0, T - 8)
            for k in range(r.randrange(4, 9)):
                c.set(gx, gy + k, mix(base, tones[1], .45))
    if part == "up":
        _under_cap_shadow(c, .5)
        c.hline(0, T - 1, 0, hx("#2a1a1e"))
    else:
        c.rect(0, T - 5, T - 1, T - 1, tones[1])
        c.hline(0, T - 1, T - 5, tones[3])
        c.hline(0, T - 1, T - 1, tones[0])
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
                c.set(xx, y0 + 1, mix(base, hx("#ffffff"), .22))
                c.set(xx, y1 - 1, mix(base, hx("#000000"), .25))
            x += wdt
    if part == "up":
        _under_cap_shadow(c, .5)
        c.hline(0, T - 1, 0, hx("#2a1a1e"))
    else:
        c.hline(0, T - 1, T - 1, hx(STONE[0]))
    return c


WARM = ["#c0743f", "#dc9560", "#efb57c", "#f8d29c"]  # the peach plaster of the venue walls


def stage_front(part):
    """Front face of the raised stage: a lit lip, dark vertical boards and a shadowed foot."""
    c = Canvas()
    r = rng("stagefront" + part)
    c.rect(0, 0, T - 1, T - 1, "#5a2a22")
    c.rect(0, 0, T - 1, 3, "#c07a4a")  # lip lit from above
    c.hline(0, T - 1, 0, "#e0a070")
    c.hline(0, T - 1, 3, "#7a3a2a")
    for x in range(0, T, 8):
        c.vline(x, 4, T - 1, "#3e1a18")
        c.vline(x + 1, 4, T - 1, "#7a3a30")
        c.noise(x + 2, 4, x + 7, T - 2, ["#4a2220", "#6a3228"], .1, r)
    for y in range(T - 6, T):  # shaded foot
        for x in range(T):
            c.set(x, y, mix(c.get(x, y), (10, 4, 14), .18 * (y - (T - 7))))
    if part == "l":
        c.vline(0, 0, T - 1, "#2a1a1e")
        c.vline(1, 1, T - 1, "#8a4a38")
    if part == "r":
        c.vline(T - 1, 0, T - 1, "#2a1a1e")
        c.vline(T - 2, 4, T - 1, "#3e1a18")
    return c


def stage_top_edge(side):
    c = floor_stage("floor_stage_a", 1)
    if side == "l":
        c.vline(0, 0, T - 1, "#2a1a1e")
        c.vline(1, 0, T - 1, "#d08a58")
        c.vline(2, 0, T - 1, "#a85a3c")
    else:
        c.vline(T - 1, 0, T - 1, "#2a1a1e")
        c.vline(T - 2, 0, T - 1, "#3e1a18")
    return c


def stage_steps():
    """Two tiles wide: three wooden treads seen from the front, climbing into the stage."""
    c = Canvas(2 * T, T)
    c.rect(0, 0, 2 * T - 1, T - 1, "#3e1a18")
    for i, y0 in enumerate((2, 12, 22)):
        c.rect(3, y0, 2 * T - 4, y0 + 9, "#7a3a2a")
        c.rect(3, y0, 2 * T - 4, y0 + 2, "#e0a070")
        c.hline(3, 2 * T - 4, y0 + 3, "#a85a3c")
        c.hline(3, 2 * T - 4, y0 + 9, "#2a1210")
    c.vline(2, 0, T - 1, "#2a1a1e")
    c.vline(2 * T - 3, 0, T - 1, "#2a1a1e")
    c.rect(0, 0, 1, T - 1, hx("#00000000"))
    c.rect(2 * T - 2, 0, 2 * T - 1, T - 1, hx("#00000000"))
    return c


def define(reg):
    reg.tile("stage_front_l", stage_front("l"), solid=True)
    reg.tile("stage_front_m", stage_front("m"), solid=True)
    reg.tile("stage_front_r", stage_front("r"), solid=True)
    reg.tile("stage_top_l", stage_top_edge("l"))
    reg.tile("stage_top_r", stage_top_edge("r"))
    reg.stamp("stage_steps", stage_steps(), "walls")
    reg.tile("plaster_warm_up", plaster("up", WARM, wain=False, name="warm"), solid=True)
    reg.tile("plaster_warm_mid", plaster("mid", WARM, wain=False, name="warm"), solid=True)
    reg.tile("plaster_warm_dn", plaster("dn", WARM, wain=True, name="warm"), solid=True)
    for v, (tones, seed) in enumerate([(FLOOR_WOOD, 1), (FLOOR_WOOD, 2), (FLOOR_WOOD, 3)]):
        reg.tile("floor_wood_" + "abc"[v], floor_wood("floor_wood_" + "abc"[v], tones, seed))
    reg.tile("floor_stage_a", floor_stage("floor_stage_a", 1))
    reg.tile("floor_stage_b", floor_stage("floor_stage_b", 2))
    reg.tile("cobble_a", cobble("cobble_a", 7))
    reg.tile("cobble_b", cobble("cobble_b", 7, moss=True))
    reg.tile("cobble_c", cobble("cobble_c", 7, crack=True, tone_bias=1))
    reg.tile("cobble_d", cobble("cobble_d", 7, leaf=True))
    reg.tile("cobble_cool", cobble("cobble_cool", 7, cool=True))
    reg.tile("floor_checker", floor_checker("floor_checker"))
    reg.tile("floor_checker_blue", floor_checker("floor_checker_blue", "#e6ecef", "#4a64a8"))
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

    for mat, fn in (("plaster", lambda p: plaster(p)), ("plaster_plain", lambda p: plaster(p, wain=False, name="plainplaster")),
                    ("plaster_blue", lambda p: plaster(p, ["#5a6aa8", "#7486c4", "#94a6dc", "#b8c6f0"], wain=False, name="blueplaster")),
                    ("brick", brick), ("wood", wood_wall), ("stone", stone_wall)):
        reg.tile(mat + "_up", fn("up"), solid=True)
        reg.tile(mat + "_dn", fn("dn"), solid=True)
