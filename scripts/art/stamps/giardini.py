"""Stamps of the Giardini Margherita, drawn from the four reference photos (shapes and colours only, nothing copied; no face, no logo,
no text is reproduced): a wide sunny lawn under big old plane trees and ash trees with dappled shade, the grey asphalt of Viale Bottonelli
along the front behind a concrete curb, a red-brown park bench with a graffiti scribble on a patch of small brick pavers, a dark green
perforated litter bin on a pole, a green round-globe lamp post, a pale gravel footpath that leads to a gate in a wooden post-and-rail
fence, the far treeline with a villa with an orange roof, the pond with its fountain and the back path with tiny walkers, and the
slackline: a green webbing strapped around two trunks, a green tree strap with a silver ratchet, the coiled tail on the grass, the orange
towel spread open below it, a dark green tarp with two people lying on it, backpacks, shoes, a blue bottle and
an orange frisbee, and a small dog on a red leash for the dog walker.

Every name starts with `giardini_`: the registry refuses anything else from a room module. Big pictures are one stamp each so the lines
and the shadows join: `giardini_backdrop` (26 x 4 tiles, the back of the park), `giardini_line` (the slackline, 15 x 1 tiles)."""
import math

from tilepaint import METAL, WOOD, Canvas, T, col, dark, hx, light, make_ramp, mix, pxl_object, rng

GR = make_ramp("#7fa83f", 5, 2, light_hue=62, lh=20, sh=18)        # sunny lawn
LEAF = make_ramp("#5f9c35", 5, 2, light_hue=64, lh=22, sh=20)       # canopy in the sun
LEAF_D = make_ramp("#467f33", 5, 2, light_hue=62, lh=18, sh=20)     # canopy of the middle ground, a little darker
FAR = make_ramp("#7aa874", 4, 1, light_hue=70, lh=14, sh=10)        # hazy far trees
BARK = make_ramp("#5b4838", 5, 2, dark_hue=270, sh=10)
GRAV = make_ramp("#d0bd92", 5, 2)
ASPH = make_ramp("#85878e", 5, 2, dark_hue=260, sh=8)
CONC = make_ramp("#aaa6a0", 5, 2, dark_hue=255, sh=12)
BRK = make_ramp("#a06c5a", 4, 1)
IRON = make_ramp("#2d5a46", 4, 1, dark_hue=240, sh=14)              # green cast iron of the bench and the lamp
RB = make_ramp("#9a3f36", 4, 1)                                     # red-brown slats of the bench back
STRAP = "#3fae3c"
STRAP_HI = "#9ee884"
STRAP_LO = "#1f6a2e"
OUTL = "#1e3a24"


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


def puffs_tree(c, cx, cy, rx, ry, ramp, seed, shade=.3, rim=True):
    """A crown made of leaf puffs, drawn from the back to the front: dark rim, body, a lit top left, a bright dab. Light from the top
    left, so the lower right of the crown is pushed toward the shade tone at the end."""
    r = rng("puffs" + seed)
    ox, oy = int(rx) + 6, int(ry) + 6
    tmp = Canvas(2 * ox, 2 * oy)                 # the crown is painted alone, so its shading never touches what is behind it
    ccx, ccy = ox, oy
    n = int(rx * ry / 120) + 5
    ps = []
    for _ in range(n * 2):
        a, d = r.random() * math.tau, r.random() ** .55
        px, py = ccx + math.cos(a) * rx * .70 * d, ccy + math.sin(a) * ry * .68 * d
        ps.append((py, px, rx * (.34 + r.random() * .16)))
    ps.append((ccy + ry * .40, ccx, rx * .46))
    ps.append((ccy + ry * .26, ccx - rx * .38, rx * .40))
    ps.append((ccy + ry * .26, ccx + rx * .38, rx * .40))
    ps.sort()
    for (py, px, pr) in ps:
        q = pr * .86
        tmp.ell(px + .9, py + 1.6, pr, q, ramp[0])                          # the dark underside only shows at the lower right
        tmp.ell(px, py, pr, q, ramp[1])
        tmp.ell(px - pr * .18, py - q * .24, pr * .74, q * .66, ramp[2])
        tmp.ell(px - pr * .30, py - q * .40, pr * .42, q * .32, ramp[3])
        for k in range(3):                                                   # a few bright leaf dabs on the lit side
            tmp.set(px - pr * .55 + k * 2, py - q * .55 + (k % 2), ramp[-1])
    for y in range(tmp.h):
        for x in range(tmp.w):
            p = tmp.get(x, y)
            if p[3] == 255:
                k = ((x - ccx) / rx) * .55 + ((y - ccy) / ry) * .85
                if k > .36 and (x + y) % 2 == 0:
                    tmp.set(x, y, mix(p, ramp[0], min(.5, (k - .3) * shade * 2.2)))
                elif k > .62:
                    tmp.set(x, y, mix(p, ramp[0], min(.55, (k - .5) * shade * 1.6)))
    bx, by = int(round(cx)) - ox, int(round(cy)) - oy
    for y in range(tmp.h):
        for x in range(tmp.w):
            p = tmp.get(x, y)
            if p[3] and 0 <= bx + x < c.w and 0 <= by + y < c.h:
                c.px[bx + x, by + y] = p
    return c


def trunk(c, cx, y0, y1, w0, w1, seed, light_patches=True):
    """A furrowed bark trunk that flares at the base: lit left, dark right, long vertical furrows with a pale edge, a few pale patches."""
    r = rng("trunk" + seed)
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, y1 - y0)
        w = w0 + (w1 - w0) * t ** 2.2
        x0, x1 = int(round(cx - w / 2)), int(round(cx + w / 2))
        c.hline(x0, x1, y, BARK[2])
        c.set(x0, y, BARK[3])
        c.set(x0 + 1, y, BARK[3])
        c.set(x1, y, BARK[0])
        c.set(x1 - 1, y, BARK[1])
        c.set(x1 - 2, y, BARK[1])
    wm = int(w1)
    for _ in range(int(wm / 2.4)):
        fx = cx + r.randrange(-wm // 2 + 3, wm // 2 - 1)
        ya = r.randrange(y0 + 2, y1 - 10)
        yb = min(y1 - 2, ya + r.randrange(8, 20))
        c.vline(fx, ya, yb, BARK[1])
        c.vline(fx - 1, ya + 1, yb - 1, BARK[3])
    if light_patches:
        for _ in range(int(wm / 4)):
            px, py = cx + r.randrange(-wm // 2 + 3, wm // 2 - 2), r.randrange(y0 + 4, y1 - 4)
            c.hline(px, px + 1, py, mix(BARK[3], "#a89880", .5))
    for dx, k in ((-1, -1), (1, 1)):       # the roots on the grass
        c.ell(cx + dx * w1 * .55, y1 - 1, w1 * .28, 2.4, BARK[2])
        c.set(cx + dx * w1 * .55 - 1, y1 - 3, BARK[3])
    c.hline(cx - w1 // 2, cx + w1 // 2, y1, BARK[0])


def strap_wrap(c, cx, y, w, ratchet=False):
    """The green tree strap of the slackline around the trunk: a wide band, a lit top edge, a cross strap, a silver ratchet."""
    x0, x1 = int(cx - w / 2) - 1, int(cx + w / 2) + 1
    c.rect(x0, y, x1, y + 5, STRAP)
    c.hline(x0, x1, y, STRAP_HI)
    c.hline(x0, x1, y + 5, STRAP_LO)
    c.vline(x1, y + 1, y + 5, STRAP_LO)
    c.rect(x0 + 3, y - 2, x0 + 5, y + 8, "#2c8a34")
    c.vline(x0 + 3, y - 2, y + 8, STRAP_HI)
    if ratchet:
        c.rect(cx + 2, y + 1, cx + 7, y + 4, "#c8ccd4")
        c.hline(cx + 2, cx + 7, y + 1, "#f4f6fa")
        c.hline(cx + 2, cx + 7, y + 4, "#6a7080")
        c.set(cx + 4, y + 2, "#40485a")


# ---------------------------------------------------------------- ground tiles

def grass(name, kind="a"):
    c = Canvas()
    r = rng(name)
    c.rect(0, 0, T - 1, T - 1, GR[2])
    lit = {"a": 4, "b": 5, "c": 3, "tuft": 4, "daisy": 4, "dry": 3, "bare": 3}[kind]
    for k in range(lit):                   # soft lighter and darker patches, hand placed (dithered)
        x, y = r.randrange(1, 22), r.randrange(1, 28)
        w, h = r.randrange(5, 10), r.randrange(2, 5)
        c.dither(x, y, min(T - 2, x + w), min(T - 2, y + h), GR[2], GR[3] if k % 3 else GR[1], .25 if k % 2 else .5, k)
    for _ in range({"tuft": 6, "a": 2, "b": 3, "c": 1, "daisy": 2, "dry": 2, "bare": 1}[kind]):
        x, y = r.randrange(3, T - 3), r.randrange(4, T - 1)
        c.set(x, y, GR[1])
        c.set(x, y - 1, GR[3])
        c.set(x - 1, y - 1, GR[3])
        c.set(x + 1, y - 2, GR[4])
        c.set(x - 2, y - 2, GR[4])
    if kind == "daisy":
        for _ in range(4):
            x, y = r.randrange(3, T - 3), r.randrange(3, T - 3)
            for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
                c.set(x + dx, y + dy, "#fff6e4")
            c.set(x, y, "#f4c840")
            c.set(x, y + 2, GR[0])
    if kind == "bare":                      # a worn patch of bare earth in the lawn, like the ones in the photos
        cx, cy = r.randrange(11, 21), r.randrange(12, 21)
        for y in range(T):
            for x in range(T):
                d = ((x - cx) / 9.5) ** 2 + ((y - cy) / 6.5) ** 2 + .22 * math.sin(x * .8 + y * .5)
                if d < .55:
                    c.set(x, y, "#a98a5a")
                elif d < .9:
                    c.set(x, y, "#9a8a52" if (x + y) % 2 == 0 else GR[2])
        for _ in range(8):
            x, y = r.randrange(cx - 7, cx + 7), r.randrange(cy - 4, cy + 4)
            if c.get(x, y)[:3] == hx("#a98a5a")[:3]:
                c.set(x, y, "#8a6e44")
                c.set(x + 1, y, "#c2a676")
    if kind == "dry":
        for _ in range(4):
            x, y = r.randrange(2, 24), r.randrange(2, 28)
            c.dither(x, y, x + r.randrange(4, 8), y + r.randrange(1, 3), GR[2], "#b0ae5a", .25, 0)
        for _ in range(3):
            c.set(r.randrange(2, 30), r.randrange(2, 30), "#c8b878")
    return c


def edge_inset(side, t, straight=False):
    """How far a patch edge sits from the tile border at position t along it: a ragged line that repeats every tile so it joins (a
    straight one for cut paving)."""
    if straight:
        return 2.0
    ph = {"N": .3, "E": 1.1, "S": 2.0, "W": 2.9}[side]
    return 3.6 + 1.5 * math.sin(math.tau * t * 2 / T + ph) + .9 * math.sin(math.tau * t * 5 / T + ph * 1.7)


def patch(name, edges, tex, rim, straight=False):
    """Grass with a patch of another ground (gravel, bricks) on it: an edge on the sides in `edges` (N E S W) is a ragged line with a
    dark rim and a pale lip, the other sides run on into the next tile."""
    c = grass(name + "-g", "a")
    src = tex.px
    for y in range(T):
        for x in range(T):
            ds = []
            for e in edges:
                if e == "W":
                    ds.append(x - edge_inset("W", y, straight))
                elif e == "E":
                    ds.append((T - 1 - x) - edge_inset("E", y, straight))
                elif e == "N":
                    ds.append(y - edge_inset("N", x, straight))
                else:
                    ds.append((T - 1 - y) - edge_inset("S", x, straight))
            d = min(ds) if ds else 99
            if d >= 0:
                p = src[x, y]
                if d < 1.4:
                    p = rim[0]
                elif d < 2.4:
                    p = mix(p, rim[0], .35)
                c.set(x, y, p)
            elif d > -1.3:
                c.set(x, y, mix(c.get(x, y), GR[4], .25))
    return c


def gravel_tex(name):
    c = Canvas()
    r = rng(name)
    c.rect(0, 0, T - 1, T - 1, GRAV[2])
    c.noise(0, 0, T - 1, T - 1, [GRAV[1], GRAV[3]], .14, r)
    for _ in range(11):
        x, y = r.randrange(1, T - 3), r.randrange(1, T - 3)
        c.set(x, y, GRAV[4])
        c.set(x + 1, y, GRAV[3])
        c.set(x, y + 1, GRAV[1])
    for _ in range(3):
        x, y = r.randrange(2, T - 6), r.randrange(2, T - 3)
        c.dither(x, y, x + r.randrange(3, 6), y + 1, GRAV[2], GRAV[1], .25, 0)
    return c


def brick_tex(name):
    """Small brick pavers in running bond: 8 x 4 px, a light top edge, a dark foot, a mortar line."""
    c = Canvas()
    r = rng(name)
    mortar = "#82726a"
    c.rect(0, 0, T - 1, T - 1, mortar)
    for row in range(8):
        off = 4 * (row % 2)
        for k in range(-1, 5):
            x0 = k * 8 + off
            tone = BRK[r.choice([1, 1, 2, 2, 2, 3])]
            for yy in range(row * 4, row * 4 + 3):
                for xx in range(x0, x0 + 7):
                    if 0 <= xx < T:
                        c.set(xx, yy, tone)
            for xx in range(x0, x0 + 7):
                if 0 <= xx < T:
                    c.set(xx, row * 4, light(tone, .18))
                    c.set(xx, row * 4 + 2, dark(tone, .22))
    return c


def curb(name, brick=False):
    """The concrete curb along the road, seen from the lawn: grass (or bricks) above, a lit top face, a shaded front face, the gutter."""
    c = patch(name + "-p", "", brick_tex("brickcurb"), BRK) if brick else grass(name + "-g", "b")
    for x in range(T):
        for y in range(17, T):
            c.set(x, y, ASPH[1])
    c.hline(0, T - 1, 16, GR[0] if not brick else "#5a443e")
    c.rect(0, 17, T - 1, 22, CONC[3])
    c.hline(0, T - 1, 17, CONC[4])
    c.hline(0, T - 1, 18, light(CONC[3], .15))
    c.rect(0, 23, T - 1, 29, CONC[2])
    c.hline(0, T - 1, 23, CONC[1])
    c.hline(0, T - 1, 29, CONC[1])
    c.hline(0, T - 1, 30, CONC[0])
    c.vline(0, 17, 30, CONC[1])               # the joint between two curb stones
    c.vline(1, 17, 22, CONC[4])
    c.set(9, 25, CONC[3])
    c.set(10, 25, CONC[3])
    c.set(22, 21, CONC[1])
    c.hline(0, T - 1, 31, ASPH[0])
    return c


def road(name, top=False, crack=False, drain=False, repair=False):
    c = Canvas()
    r = rng(name)
    c.rect(0, 0, T - 1, T - 1, ASPH[2])
    c.noise(0, 0, T - 1, T - 1, [ASPH[1], ASPH[3]], .1, r)
    for _ in range(4):
        x, y = r.randrange(1, 26), r.randrange(4, 30)
        c.dither(x, y, x + r.randrange(3, 7), y + 1, ASPH[2], ASPH[3], .25, 0)
    if top:                                     # the gutter along the curb: dark, with a little grit
        c.rect(0, 0, T - 1, 2, ASPH[1])
        c.hline(0, T - 1, 3, mix(ASPH[1], ASPH[2], .5))
        for _ in range(5):
            c.set(r.randrange(T), r.randrange(0, 3), ASPH[3])
    if drain:                                   # a storm drain with iron bars at the foot of the curb
        c.rect(5, 0, 26, 8, "#16161c")
        c.hline(5, 26, 8, ASPH[3])
        c.vline(5, 0, 8, ASPH[3])
        for x in range(8, 26, 4):
            c.vline(x, 0, 7, "#5a5a66")
            c.vline(x + 1, 0, 7, "#2a2a32")
        c.hline(5, 26, 1, "#4a4a56")
    if repair:                                  # a darker patch of fresh tarmac, squared off
        c.rect(5, 8, 27, 23, ASPH[1])
        c.hline(5, 27, 8, ASPH[0])
        c.hline(5, 27, 23, ASPH[3])
        c.vline(5, 8, 23, ASPH[0])
        c.noise(6, 9, 26, 22, [ASPH[0], ASPH[2]], .12, r)
    if crack:
        pts, x, y = [], 3, 4
        for _ in range(7):
            pts.append((x, y))
            x += r.randrange(2, 6)
            y += r.randrange(2, 6)
        for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
            c.line(xa, ya, xb, yb, ASPH[0])
            c.line(xa + 1, ya, xb + 1, yb, ASPH[3])
    return c


def path_dip(name, side):
    """The gravel path where it meets the road, one of its two tiles (side "l" or "r"): the curb dips, the gravel runs down to the road."""
    c = patch(name + "-p", "W" if side == "l" else "E", gravel_tex("gravdip" + side), [GRAV[0]])
    cu = curb("giardini_dipcurb")
    xa, xb = (3, T - 1) if side == "l" else (0, 28)
    for y in range(16, T):
        for x in range(T):
            c.set(x, y, GRAV[2] if (xa <= x <= xb and y != 31) else cu.get(x, y))
    c.noise(xa, 17, xb, 29, [GRAV[1], GRAV[3]], .16, rng("dipn" + side))
    bx = 3 if side == "l" else 28                           # the bevel of the dropped curb, a slope in two shades
    for k in range(3):
        c.line(bx, 17 + k * 4, bx, 21 + k * 4, CONC[2] if side == "l" else CONC[1])
    c.hline(xa, xb, 16, GRAV[0])
    c.hline(xa, xb, 30, GRAV[1])
    return c


# ---------------------------------------------------------------- shade on the lawn (below layer, translucent)

def shade(w, h, seed, blobs):
    """A tree shadow on the lawn: cool green-violet, three steps and a dithered rim, with dapples of sun punched through it."""
    c = Canvas(w * T, h * T)
    r = rng("shade" + seed)
    ph = [r.random() * 6 for _ in range(4)]
    for y in range(c.h):
        for x in range(c.w):
            v = -9
            for (bx, by, brx, bry) in blobs:
                d = ((x - bx) / brx) ** 2 + ((y - by) / bry) ** 2
                v = max(v, 1 - d)
            v += .2 * math.sin(x * .19 + ph[0]) + .16 * math.sin(y * .29 + ph[1]) + .1 * math.sin((x + y) * .41 + ph[2]) + .1 * math.sin((x - y) * .23 + ph[3])
            v -= max(0, 12 - min(x, c.w - 1 - x, y, c.h - 1 - y)) * .06            # fade out before the edge of the picture
            if v > .32:
                a = 84
            elif v > .12:
                a = 60
            elif v > -.02:
                a = 38 if (x + y) % 2 == 0 else 16
            else:
                continue
            c.px[x, y] = (26, 52, 62, a)
    for _ in range(int(w * h * 5.5)):                  # sun dapples between the leaves
        x, y = r.randrange(c.w), r.randrange(c.h)
        rx_, ry_ = r.choice([1, 1, 2, 2, 3]), r.choice([1, 1, 2])
        for yy in range(y - ry_, y + ry_ + 1):
            for xx in range(x - rx_, x + rx_ + 1):
                if 0 <= xx < c.w and 0 <= yy < c.h and ((xx - x) / rx_) ** 2 + ((yy - y) / ry_) ** 2 <= 1.2:
                    p = c.px[xx, yy]
                    if p[3]:
                        c.px[xx, yy] = (255, 244, 170, 22) if p[3] > 50 and r.random() < .4 else (p[0], p[1], p[2], 0)
    return c


# ---------------------------------------------------------------- trees

def big_tree(w, h, seed, crown_rx, crown_ry, w0, w1, strap=0, ramp=LEAF, lean=0):
    """A tree of w x h tiles: the crown is in the top h-1 rows (drawn over everyone), the trunk stands on the last row, which blocks.
    strap: 1 the left slackline tree (ratchet), 2 the right one."""
    c = Canvas(w * T, h * T)
    cx = w * T // 2
    yb = h * T - 3
    c.shadow(cx, yb + .5, w1 * .95, 3.6, 84)
    r = rng("treebase" + seed)
    if strap:                                            # bare worn earth at the foot of the slackline trees, where people stand
        c.ell(cx, yb - 1, w1 * .95, 5.2, "#9a7a52")
        c.ell(cx - 2, yb - 2, w1 * .7, 3.6, "#b4916a")
        for _ in range(10):
            c.set(cx + r.randrange(-w1, w1), yb - 3 + r.randrange(0, 5), "#7a5a3a")
    trunk(c, cx + lean, (h - 3) * T, yb, w0, w1, seed)
    if strap:
        strap_wrap(c, cx + lean, yb - 16, w1 * .62, ratchet=(strap == 1))
    ccy = (h - 1) * T - 12 - crown_ry * .95              # the crown floats above a visible length of trunk
    for k in range(3):                                   # the main limbs reaching into the crown
        c.line(cx + lean, (h - 2) * T, cx + lean + (k - 1) * w1 * 1.2, (h - 2) * T - 18, BARK[1])
        c.line(cx + lean + 1, (h - 2) * T, cx + lean + 1 + (k - 1) * w1 * 1.2, (h - 2) * T - 18, BARK[2])
    puffs_tree(c, cx, ccy, crown_rx, crown_ry, ramp, seed)
    c.outline(OUTL)
    return c


def sapling():
    """A young tree with its stake, 1 x 2 tiles, the crown over everyone."""
    c = Canvas(T, 2 * T)
    c.shadow(16, 61, 10, 2.4, 70)
    c.rect(22, 30, 23, 61, "#a78a5a")                    # the stake
    c.vline(22, 30, 61, "#c8b078")
    c.rect(15, 28, 17, 60, BARK[2])
    c.vline(15, 28, 60, BARK[3])
    c.vline(17, 30, 60, BARK[0])
    c.line(16, 40, 22, 40, "#3a2a20")                    # the tie
    puffs_tree(c, 16, 18, 13, 16, LEAF, "sapling")
    c.outline(OUTL)
    return c


# ---------------------------------------------------------------- the back of the park

def wooden_fence(c, x0, x1, y):
    """A post-and-rail fence of pale weathered wood; posts every 24 px, two rails, a soft shadow on the grass under it."""
    wd = make_ramp("#b79a6a", 4, 1)
    for x in range(x0, x1):
        for k in range(3):
            if y + 11 + k < c.h:
                c.px[x, y + 11 + k] = (24, 52, 44, 70 - k * 22)
    c.rect(x0, y + 4, x1, y + 5, wd[2])
    c.rect(x0, y + 9, x1, y + 10, wd[2])
    c.hline(x0, x1, y + 4, wd[3])
    c.hline(x0, x1, y + 9, wd[3])
    c.hline(x0, x1, y + 5, wd[1])
    c.hline(x0, x1, y + 10, wd[1])
    x = x0 + 4
    while x < x1:
        c.rect(x, y, x + 2, y + 12, wd[2])
        c.vline(x, y, y + 12, wd[3])
        c.vline(x + 2, y + 1, y + 12, wd[0])
        c.hline(x, x + 2, y, wd[3])
        x += 24


def tiny_walker(c, x, y, shirt, pants):
    c.rect(x, y + 5, x + 2, y + 8, shirt)
    c.set(x, y + 5, light(shirt, .25))
    c.rect(x, y + 9, x + 2, y + 12, pants)
    c.set(x + 1, y + 9, dark(pants, .3))
    c.rect(x, y + 2, x + 2, y + 4, "#e8b890")
    c.hline(x, x + 2, y + 2, "#3a2a24")


def backdrop():
    """The back of the park, rows 0 to 3: sky and clouds, hazy far trees with the orange roof of a villa, the pond with its fountain,
    taller darker trees on slender trunks, the back path with tiny walkers and a bench, a post-and-rail fence with a gate where the gravel
    path goes through. The lowest 10 px are left clear so the lawn runs up to the fence."""
    W, H = 26 * T, 4 * T
    c = Canvas(W, H)
    r = rng("giardini-backdrop")
    c.vgrad(0, 0, W - 1, H - 1, "#86bde8", "#d2e9f0")
    for (cx, cy, rx, ry) in ((90, 12, 44, 9), (150, 18, 30, 7), (470, 8, 52, 10), (520, 17, 26, 6), (720, 14, 40, 8), (790, 9, 24, 6)):
        c.ell(cx, cy + 2, rx, ry, "#d6e6ee")
        c.ell(cx, cy, rx, ry, "#f4f8fa")
        c.ell(cx - rx * .25, cy - ry * .4, rx * .55, ry * .55, "#ffffff")
    c.rect(0, 80, W - 1, 100, FAR[1])                          # the wooded edge far away, under the hazy crowns
    c.dither(0, 76, W - 1, 80, "#a8d0e0", FAR[1], .5)
    # far treeline, hazy
    x = -10
    while x < W + 20:
        h_ = r.randrange(26, 48)
        if 120 < x < 205 or 470 < x < 540 or 700 < x < 770:
            h_ = r.randrange(14, 24)                      # gaps with sky between the crowns
        rx = r.randrange(18, 30)
        puffs_tree(c, x, 74 - h_ * .3, rx, h_ * .5 + 10, FAR, "far%d" % x, shade=.18)
        x += r.randrange(24, 38)
    # the villa with the orange roof, low among the trees, in front of the haze and behind the nearer trees
    vx = 372
    c.rect(vx - 12, 74, vx + 62, 90, FAR[1])                # the hedge and trees at its foot
    c.rect(vx, 62, vx + 48, 86, "#ead2aa")
    c.vline(vx + 48, 62, 86, "#c8a880")
    c.rect(vx, 62, vx + 2, 86, "#f6e4c0")
    c.poly([(vx - 6, 62), (vx + 54, 62), (vx + 43, 44), (vx + 5, 44)], "#c8683a")
    c.poly([(vx - 6, 62), (vx + 5, 44), (vx + 12, 44), (vx + 3, 62)], "#e8946a")
    c.poly([(vx + 43, 44), (vx + 54, 62), (vx + 48, 62), (vx + 38, 44)], "#a24a2c")
    c.hline(vx - 6, vx + 54, 62, "#8a3a22")
    c.hline(vx - 6, vx + 54, 63, "#8a6a52")
    c.rect(vx + 35, 36, vx + 40, 46, "#b0603a")
    c.hline(vx + 35, vx + 40, 36, "#e8946a")
    for wx in (vx + 7, vx + 21, vx + 35):
        c.rect(wx, 68, wx + 5, 79, "#4a4258")
        c.hline(wx, wx + 5, 68, "#f4ead0")
        c.vline(wx + 2, 68, 79, "#6a6278")
        c.rect(wx - 1, 80, wx + 6, 81, "#c8a880")
    puffs_tree(c, vx - 12, 82, 22, 14, LEAF_D, "villa-l", shade=.25)
    puffs_tree(c, vx + 62, 84, 22, 14, LEAF_D, "villa-r", shade=.25)
    # the distant lawn between the trees and the back path: hazy, a little darker under the crowns
    c.rect(0, 97, W - 1, 113, mix(GR[2], "#9cc09a", .4))
    c.dither(0, 97, W - 1, 102, mix(GR[2], "#9cc09a", .4), mix(GR[1], "#8ab088", .4), .25)
    for k in range(60):
        gx, gy = r.randrange(0, W - 6), r.randrange(98, 112)
        c.hline(gx, gx + r.randrange(2, 5), gy, mix(GR[3], "#b0d0a8", .4))
    # the pond and its fountain behind the trees at the right
    c.ell(650, 93, 96, 10, "#5f9a9c")
    c.ell(646, 91, 90, 7, "#7ab4b2")
    for k in range(26):
        wx = 580 + r.randrange(0, 150)
        wy = 87 + r.randrange(0, 10)
        c.hline(wx, wx + r.randrange(3, 8), wy, "#d4eeee")
    c.rect(624, 93, 678, 96, "#4a7e82")
    jet = [(648, 56, 3), (650, 66, 5), (652, 76, 7), (651, 86, 9)]
    for (jx, jy, jw) in jet:
        c.ell(jx, jy, jw / 2 + 1, 6, "#eef8fa")
        c.ell(jx - 1, jy - 1, jw / 2 - 1, 5, "#ffffff")
    c.dither(634, 78, 668, 94, "#cfe8ec", "#ffffff", .25, 0)
    c.ell(650, 94, 14, 3, "#f4fafa")
    # taller darker trees on slender trunks, leaving the villa and the pond in view
    xs = []
    x = -6
    while x < W + 20:
        if not (338 < x < 456 or 590 < x < 710):
            xs.append(x)
        x += r.randrange(46, 64)
    for x in xs:
        ty = r.randrange(48, 64)
        c.rect(x - 1, ty + 8, x + 1, 104, BARK[1])
        c.vline(x - 1, ty + 8, 104, BARK[3])
    for x in xs:
        ty = r.randrange(48, 64)
        puffs_tree(c, x, ty, r.randrange(26, 38), r.randrange(24, 32), LEAF_D, "mid%d" % x, shade=.28)
    # the leafy shade at the foot of the trees
    for y in range(80, 106):
        for x in range(W):
            blend(c, x, y, (30, 56, 48), .30 * min(1, (y - 80) / 16) * (1 if x % 2 == y % 2 or y > 94 else .4))
    # the back path: grey asphalt, a pale edge, a bench and walkers
    c.rect(0, 101, W - 1, 112, ASPH[2])
    c.hline(0, W - 1, 101, ASPH[3])
    c.hline(0, W - 1, 112, CONC[2])
    c.hline(0, W - 1, 113, CONC[1])
    c.noise(0, 102, W - 1, 111, [ASPH[1], ASPH[3]], .05, r)
    bw = make_ramp("#7a5a3a", 4, 1)
    c.rect(168, 98, 188, 100, bw[2])
    c.hline(168, 188, 98, bw[3])
    c.rect(168, 101, 188, 104, bw[1])
    c.vline(169, 104, 109, "#2a2a30")
    c.vline(187, 104, 109, "#2a2a30")
    for (wx, shirt, pants) in ((74, "#c8423f", "#2f3d6b"), (96, "#f4f1ea", "#3b3f4c"), (252, "#2f6a8a", "#2b2330"), (310, "#e8b83a", "#4a4258"),
                               (532, "#f4f1ea", "#8c2a3a"), (584, "#4f7a5d", "#2b2330"), (776, "#c0607a", "#3b3f4c"), (798, "#2b2330", "#5a4a40")):
        tiny_walker(c, wx, 95, shirt, pants)
    for y in range(114, H):                           # the lowest rows are clear: the lawn of the map runs up to the fence
        for x in range(W):
            c.px[x, y] = (0, 0, 0, 0)
    # the fence in front of the path, with the gate where the gravel path goes through
    wooden_fence(c, 0, 636, 114)
    wooden_fence(c, 706, W - 1, 114)
    c.rect(642, 114, 700, 127, GRAV[2])               # the gravel path through the gap, as wide as the tiles below it
    c.noise(642, 114, 700, 127, [GRAV[1], GRAV[3]], .14, r)
    c.vline(641, 114, 127, GRAV[0])
    c.vline(701, 114, 127, GRAV[0])
    wd = make_ramp("#b79a6a", 4, 1)
    for gx in (636, 706):                              # the gate posts, taller, with a round cap
        c.rect(gx, 104, gx + 3, 126, wd[2])
        c.vline(gx, 104, 126, wd[3])
        c.vline(gx + 3, 105, 126, wd[0])
        c.ell(gx + 1.5, 103, 3, 2.4, wd[3])
    c.hline(0, W - 1, 0, "#8cc0e8")
    return c


# ---------------------------------------------------------------- the slackline and what lies around it

def slackline(n=15):
    """The webbing between the two trunks, one row of n tiles: a bright green band with a lit edge, a few px of sag, a dithered shadow on
    the grass under it. The trunks (objects) are drawn over its two ends."""
    c = Canvas(n * T, T)
    W = n * T
    x0, x1 = T // 2, W - T // 2
    for x in range(x0, x1 + 1):
        t = (x - x0) / (x1 - x0)
        y = 17 + int(round(2.4 * math.sin(math.pi * t)))
        for k in range(3, 6):
            if (x + k) % 2 == 0:
                c.px[x, y + k] = (24, 56, 40, 70 if k < 5 else 44)
        c.set(x, y - 1, "#7bd96a")
        c.set(x, y, STRAP)
        c.set(x, y + 1, STRAP)
        c.set(x, y + 2, STRAP_LO)
    return c


def webbing_tail():
    """The coiled tail of the slackline on the grass at the left trunk: loops of green webbing and a strap end."""
    c = Canvas()
    for (cx, cy, rx, ry) in ((13, 17, 10, 5), (17, 20, 9, 4.4), (11, 22, 8, 3.6)):
        c.ell(cx + 1, cy + 1, rx, ry, (24, 56, 40, 80))
    for (cx, cy, rx, ry) in ((13, 16, 10, 5), (17, 19, 9, 4.4), (11, 21, 8, 3.6)):
        c.ell(cx, cy, rx, ry, STRAP_LO)
        c.ell(cx, cy - .4, rx - 1.2, ry - 1.2, STRAP)
        c.ell(cx, cy - .6, rx - 3.2, max(.8, ry - 3.0), GR[2])
        c.ell(cx - 1, cy - .8, rx - 4.0, max(.7, ry - 3.4), GR[3])
        c.hline(int(cx - rx * .6), int(cx + rx * .4), int(cy - ry + 1), STRAP_HI)
    c.rect(20, 12, 29, 14, STRAP)
    c.hline(20, 29, 12, STRAP_HI)
    c.hline(20, 29, 14, STRAP_LO)
    return c


def towel(w=5, h=3):
    """The big orange towel, spread open and a little skewed: stripes, wrinkles, fringe on the short sides, a soft shadow on the grass."""
    c = Canvas(w * T, h * T)
    W, H = w * T, h * T
    P = [(10, 22), (W - 14, 12), (W - 8, H - 26), (16, H - 12)]
    c.poly([(x + 3, y + 4) for (x, y) in P], (24, 56, 40, 90))
    base = make_ramp("#ec7f26", 5, 2, light_hue=48)
    # the cloth, painted row by row so the skew carries the stripes
    def inside(x, y):
        a = P[0][1] + (P[1][1] - P[0][1]) * (x - P[0][0]) / (P[1][0] - P[0][0])
        b = P[3][1] + (P[2][1] - P[3][1]) * (x - P[3][0]) / (P[2][0] - P[3][0])
        lx = P[0][0] + (P[3][0] - P[0][0]) * (y - P[0][1]) / (P[3][1] - P[0][1])
        rx = P[1][0] + (P[2][0] - P[1][0]) * (y - P[1][1]) / (P[2][1] - P[1][1])
        return a <= y <= b and lx <= x <= rx
    r = rng("towel")
    for y in range(H):
        for x in range(W):
            if inside(x, y):
                lx = P[0][0] + (P[3][0] - P[0][0]) * (y - P[0][1]) / (P[3][1] - P[0][1])
                rx_ = P[1][0] + (P[2][0] - P[1][0]) * (y - P[1][1]) / (P[2][1] - P[1][1])
                u = (x - lx) / max(1, rx_ - lx)
                tone = base[2]
                if .10 < u < .15 or .85 < u < .90:
                    tone = base[4]
                elif .15 <= u < .185 or .815 < u <= .85:
                    tone = base[3]
                elif .28 < u < .31 or .69 < u < .72:
                    tone = base[3]
                c.set(x, y, tone)
    for _ in range(9):                                      # wrinkles: a light ridge with a dark foot, soft diagonal
        x, y = r.randrange(28, W - 40), r.randrange(30, H - 30)
        ln = r.randrange(10, 22)
        for k in range(ln):
            if inside(x + k, y + k // 4):
                c.set(x + k, y + k // 4, base[3])
                if inside(x + k, y + k // 4 + 1):
                    c.set(x + k, y + k // 4 + 1, base[1])
    for y in range(H):                                      # the edges: lit top and left, dark right and bottom
        for x in range(W):
            if inside(x, y):
                if not inside(x, y - 1) or not inside(x - 1, y):
                    c.set(x, y, base[4])
                elif not inside(x, y + 1) or not inside(x + 1, y):
                    c.set(x, y, base[0])
    for k in range(0, int(P[3][1] - P[0][1]), 3):           # the fringe on the two short sides
        y = P[0][1] + k
        lx = P[0][0] + (P[3][0] - P[0][0]) * k / (P[3][1] - P[0][1])
        c.hline(int(lx) - 3, int(lx) - 1, int(y), base[3])
        rx_ = P[1][0] + (P[2][0] - P[1][0]) * k / (P[2][1] - P[1][1])
        c.hline(int(rx_) + 1, int(rx_) + 3, int(P[1][1] + k), base[1])
    # a bottle and a pair of flip flops on it, as people leave things on a towel
    c.rect(98, 44, 101, 54, "#2a5a2a")
    c.rect(99, 40, 100, 44, "#2a5a2a")
    c.vline(98, 44, 54, "#5aa05a")
    c.set(99, 40, "#c8c8a0")
    c.ell(104, 55, 4, 1.6, (24, 40, 30, 90))
    c.rect(40, 46, 56, 58, "#f0e6cc")                       # a paperback, face up, a bookmark sticking out
    c.hline(40, 56, 46, "#ffffff")
    c.hline(40, 56, 58, "#b8a888")
    c.vline(56, 47, 58, "#b8a888")
    c.rect(44, 49, 52, 50, "#c8423f")
    c.hline(44, 49, 53, "#8a8070")
    c.hline(44, 51, 55, "#8a8070")
    c.rect(57, 51, 58, 57, "#2f6aa8")
    c.hline(41, 48, 58, "#d8cca8")
    return c


def tarp():
    """A dark green tarp with two people lying on it, seen from above and a little from the front: one on his front in a green shirt, one
    in black with a straw hat and a pink towel under. No faces: hair, hats and backs."""
    c = Canvas(3 * T, 2 * T)
    W, H = 3 * T, 2 * T
    P = [(8, 14), (W - 8, 8), (W - 4, H - 14), (6, H - 8)]
    c.poly([(x + 3, y + 3) for (x, y) in P], (24, 52, 44, 90))
    tp = make_ramp("#3a6a58", 4, 1, dark_hue=220)
    c.poly(P, tp[1])
    c.poly([(11, 16), (W - 10, 11), (W - 12, 22), (12, 28)], tp[2])
    for k in range(5):
        c.line(14 + k * 16, 26, 22 + k * 15, H - 18, tp[0])
        c.line(15 + k * 16, 26, 23 + k * 15, H - 18, tp[2])
    c.hline(8, W - 8, 14, tp[3])
    c.rect(10, 36, 34, 52, "#e8a0b8")                    # the pink towel under the left person
    c.hline(10, 34, 36, "#f6c4d4")
    # the left person: black top, straw hat, bare legs
    c.ell(26, 40, 8, 6, "#1c1a22")
    c.ell(24, 38, 6, 3.6, "#3a3844")
    c.rect(32, 37, 44, 42, "#e8b890")
    c.rect(40, 36, 46, 41, "#1c1a22")
    c.ell(16, 38, 6.4, 5.4, "#e8cf86")
    c.ell(15, 37, 5.2, 4.2, "#f4e3a8")
    c.ell(16, 38, 3, 2.4, "#c8a860")
    c.hline(11, 21, 41, "#b09050")
    # the right person: green shirt, face down, dark trousers
    c.ell(60, 33, 11, 6.2, "#3a4a30")
    c.ell(58, 31, 9, 4.4, "#6a8a50")
    c.ell(56, 30, 5, 2.2, "#8aa862")
    c.ell(45, 33, 4.6, 4.2, "#4a3020")                   # hair, seen from behind
    c.ell(44, 32, 3.2, 2.6, "#6a4a30")
    c.rect(47, 36, 53, 38, "#e8b890")
    c.rect(70, 30, 86, 37, "#2a2a30")
    c.hline(70, 86, 30, "#4a4a54")
    c.rect(86, 31, 89, 36, "#e8b890")
    c.set(48, 28, "#e8b890")
    for (x, y) in ((24, 28), (33, 27)):                  # a phone and a water bottle on the tarp
        c.rect(x, y, x + 2, y + 3, "#2a2a32")
    c.rect(78, 40, 80, 48, "#2f6aa8")
    c.rect(78, 40, 80, 41, "#9ac8f0")
    return c


def scooter():
    """An electric scooter parked on its stand, side view, 2 x 2 tiles: a black deck, a big front wheel and a small rear one with its
    mudguard, a tall stem with a handlebar and grips, a battery box with a green light."""
    c = Canvas(2 * T, 2 * T)
    c.ell(32, 60, 26, 3, (24, 56, 40, 80))
    c.rect(10, 50, 48, 53, "#2a2a32")                    # the deck
    c.hline(10, 48, 50, "#5a5a68")
    c.hline(10, 48, 53, "#121218")
    c.rect(26, 45, 40, 50, "#3a3a46")                    # the battery box
    c.hline(26, 40, 45, "#6a6a78")
    c.set(38, 47, "#59e08a")
    c.line(50, 52, 44, 12, "#8a8e9a")                    # the stem, leaning back toward the rider
    c.line(51, 52, 45, 12, "#5a5e6a")
    c.line(47, 30, 47, 32, "#c8423f")
    c.hline(37, 54, 11, "#2a2a32")                       # the handlebar and its grips
    c.hline(37, 54, 10, "#6a6a78")
    c.rect(36, 10, 38, 12, "#121218")
    c.rect(53, 10, 55, 12, "#121218")
    for (cx, cy, r_) in ((54, 56, 5.4), (9, 57, 4.4)):
        c.disc(cx, cy, r_, "#121218")
        c.disc(cx, cy, r_ - 1.8, "#4a4a58")
        c.disc(cx, cy, 1.4, "#9a9aa6")
    c.ell(9, 53, 6, 2.2, "#3a3a46")                      # the rear mudguard
    c.outline()
    return c


def gear(variant):
    """Things people leave on the grass, one tile: a green rucksack with a pair of trainers, or a flowery rucksack, a blue bottle and a
    frisbee."""
    c = Canvas()
    c.ell(16, 26, 13, 3.4, (24, 56, 40, 70))
    if variant == 2:                                     # a black bag with two beer bottles and a cap lying next to it
        c.round_rect(14, 12, 28, 25, "#2a2a34", 4)
        c.round_rect(14, 12, 27, 18, "#3e3e4a", 4)
        c.hline(16, 25, 12, "#5a5a68")
        c.hline(15, 26, 19, "#16161c")
        c.rect(19, 20, 23, 23, "#8a8a96")
        for bx in (3, 8):
            c.rect(bx, 17, bx + 2, 25, "#7a4a1a")
            c.rect(bx + 1, 13, bx + 1, 17, "#7a4a1a")
            c.set(bx + 1, 12, "#c8c8a0")
            c.vline(bx, 18, 24, "#c8843a")
            c.rect(bx, 21, bx + 2, 22, "#e8dcb0")
        c.ell(29, 25, 2.6, 1.2, "#c8423f")
    elif variant == 0:
        bag = make_ramp("#667a4c", 5, 2)
        c.round_rect(5, 7, 22, 25, bag[2], 5)                    # the rucksack, upright against the grass: body, flap, pocket
        c.round_rect(5, 7, 22, 15, bag[3], 5)
        c.hline(8, 19, 7, bag[4])
        c.hline(6, 21, 15, bag[0])
        c.hline(6, 21, 16, bag[1])
        c.rect(8, 18, 19, 24, bag[1])
        c.hline(8, 19, 18, bag[3])
        c.hline(8, 19, 24, bag[0])
        c.hline(9, 18, 21, bag[0])
        c.rect(12, 14, 14, 17, "#c8b878")                        # the buckle of the flap strap
        c.vline(13, 10, 14, "#3a3a2a")
        c.vline(6, 9, 22, bag[4])
        c.vline(22, 9, 24, bag[0])
        c.rect(1, 12, 4, 19, bag[1])                             # a bottle pocket on the left, with a blue bottle
        c.rect(1, 9, 3, 13, "#2f6aa8")
        c.set(1, 10, "#9ac8f0")
        for (sx, sy) in ((22, 22), (26, 24)):                    # trainers, left on the grass
            c.ell(sx + 3, sy + 2, 4.6, 2.6, "#2a2a32")
            c.ell(sx + 2.4, sy + 1.4, 3.4, 1.8, "#4a4a58")
            c.hline(sx, sx + 6, sy + 4, "#d8d4c8")
    else:
        c.round_rect(3, 10, 15, 24, "#e86a90", 3)
        for (x, y, k) in ((5, 12, 0), (9, 14, 1), (6, 17, 2), (11, 19, 0), (4, 21, 1), (12, 12, 2)):
            c.set(x, y, ["#2f9a6a", "#f4e84a", "#2f6aa8"][k])
            c.set(x + 1, y, ["#2f9a6a", "#f4e84a", "#2f6aa8"][k])
            c.set(x, y + 1, "#2a6a2a")
        c.hline(5, 13, 10, "#f49ab8")
        c.rect(18, 11, 21, 24, "#2f6aa8")
        c.rect(19, 8, 20, 11, "#2f6aa8")
        c.vline(18, 12, 24, "#9ac8f0")
        c.hline(18, 21, 24, "#1c3a68")
        c.ell(26, 22, 5.4, 2.8, "#c8501a")
        c.ell(26, 21.4, 4.6, 2.2, "#f08a2a")
        c.ell(25, 21, 2.4, 1.2, "#f8b060")
    c.outline()
    return c


# ---------------------------------------------------------------- park furniture

def bench(graffiti=True):
    """The park bench, 2 x 1 tiles, seen from the front: green cast-iron ends, a red-brown back with a graffiti scribble, dark seat slats."""
    c = Canvas(2 * T, T)
    c.shadow(32, 29.5, 28, 2.8, 70)
    for x in (6, 54):
        c.rect(x, 13, x + 3, 28, IRON[2])
        c.vline(x, 13, 28, IRON[3])
        c.vline(x + 3, 14, 28, IRON[0])
        c.rect(x - 2, 27, x + 5, 29, IRON[1])
        c.hline(x - 2, x + 5, 27, IRON[3])
        c.set(x + 1, 22, IRON[3])
        c.set(x + 2, 24, IRON[3])
    c.rect(5, 17, 58, 23, "#5a3028")                     # seat slats
    c.hline(5, 58, 17, "#8a5040")
    c.hline(5, 58, 20, "#3a1e1c")
    c.hline(5, 58, 21, "#7a4438")
    c.hline(5, 58, 23, "#2a1612")
    c.rect(4, 3, 59, 8, RB[2])                           # back slats
    c.rect(4, 10, 59, 14, RB[2])
    for y in (3, 10):
        c.hline(4, 59, y, RB[3])
    for y in (8, 14):
        c.hline(4, 59, y, RB[0])
    c.vline(4, 3, 14, RB[3])
    c.vline(59, 4, 14, RB[0])
    if graffiti:                                         # a tag, scribbled: loops and bars in pale paint (not letters of anything)
        ink, ink2 = "#f4e8c0", "#d8d0a8"
        for x in range(9, 50):
            y = 6 + int(round(1.6 * math.sin(x * .62) * (1 if x % 11 < 8 else -1)))
            c.set(x, y, ink)
            if x % 3 == 0:
                c.set(x, y + 1, ink2)
        c.line(11, 4, 15, 8, ink)
        c.line(15, 4, 11, 8, ink)
        c.line(30, 3, 34, 8, ink2)
        c.hline(36, 52, 12, ink2)
        c.set(11, 12, ink2)
        c.set(12, 12, ink2)
    c.outline()
    return c


def bin_green():
    """A dark green perforated litter bin on a pole: a black lid with a hole, a silver band, rows of round holes."""
    c = Canvas()
    c.shadow(16, 30, 8, 2, 66)
    c.rect(15, 20, 17, 29, "#3a3a44")
    c.rect(9, 7, 22, 21, "#2f6a50")
    c.rect(9, 7, 12, 21, "#4a8a68")
    c.rect(19, 8, 22, 21, "#1c4a38")
    c.vline(22, 8, 21, "#123428")
    for y in range(10, 20, 3):
        for x in range(11, 21, 3):
            c.set(x, y, "#123428")
    c.rect(8, 4, 23, 8, "#2a2a32")
    c.hline(8, 23, 4, "#5a5a66")
    c.ell(16, 5, 4, 1.4, "#0c0c12")
    c.hline(9, 22, 13, "#a8b0b4")
    c.hline(9, 22, 14, "#6a7478")
    c.outline("#16281f")
    return c


def dog():
    """A small tan dog standing, side view facing right, on a red leash that runs off to the left toward its walker."""
    c = Canvas()
    c.shadow(17, 30, 11, 2, 66)
    tan = make_ramp("#c89a58", 4, 1)
    for x in (12, 15, 21, 24):                         # legs
        c.rect(x, 22, x + 1, 29, tan[1])
        c.set(x, 29, "#3a2a20")
        c.set(x + 1, 29, "#3a2a20")
    c.ell(18, 20, 8.4, 4.8, tan[1])
    c.ell(17.4, 19.2, 7.4, 3.8, tan[2])
    c.ell(16, 18, 4.4, 1.8, tan[3])
    c.line(10, 19, 7, 13, tan[1])                       # the tail up
    c.line(11, 19, 8, 13, tan[2])
    c.disc(25, 15, 4.2, tan[2])                         # head
    c.disc(24.4, 14.4, 3.2, tan[3])
    c.rect(27, 16, 31, 18, "#e0bd86")                   # snout
    c.set(31, 16, "#2a1a1e")
    c.set(31, 17, "#2a1a1e")
    c.rect(22, 11, 23, 17, "#6a4020")                   # floppy ear
    c.set(22, 18, "#6a4020")
    c.set(26, 14, "#1c1620")
    c.hline(22, 25, 18, "#c8423f")                      # collar
    c.line(22, 18, 0, 14, "#c8423f")                    # the leash
    c.line(22, 19, 0, 15, "#8a2a30")
    c.outline("#3a2410")
    return c


# ---------------------------------------------------------------- registry

def define(reg):
    for k in ("a", "b", "c", "tuft", "daisy", "dry", "bare"):
        reg.tile("giardini_grass_" + k, grass("giardini_grass_" + k, k))
    gt, bt = gravel_tex("gravel"), brick_tex("pave")
    for mask in range(16):
        edges = "".join(e for i, e in enumerate("NESW") if mask >> i & 1)
        reg.tile("giardini_path_" + (edges or "c"), patch("giardini_path_" + edges, edges, gt, [GRAV[0]]))
        reg.tile("giardini_brick_" + (edges or "c"), patch("giardini_brick_" + edges, edges, bt, [CONC[1]], straight=True))
    reg.tile("giardini_pathdip_l", path_dip("giardini_pathdip_l", "l"))
    reg.tile("giardini_pathdip_r", path_dip("giardini_pathdip_r", "r"))
    reg.tile("giardini_curb", curb("giardini_curb"))
    reg.tile("giardini_curb_brick", curb("giardini_curb_brick", True))
    reg.tile("giardini_road_top", road("giardini_road_top", top=True))
    reg.tile("giardini_road_a", road("giardini_road_a"))
    reg.tile("giardini_road_b", road("giardini_road_b", crack=True))
    reg.tile("giardini_road_drain", road("giardini_road_drain", top=True, drain=True))
    reg.tile("giardini_road_repair", road("giardini_road_repair", repair=True))

    reg.stamp("giardini_backdrop", backdrop(), "walls")
    reg.stamp("giardini_line", slackline(15), "walls")
    reg.stamp("giardini_towel", towel(5, 3), "walls")
    reg.stamp("giardini_tarp", tarp(), "walls")
    reg.stamp("giardini_webbing", webbing_tail(), "walls")
    reg.stamp("giardini_scooter", scooter(), "walls", mask=["##", "##"])
    reg.stamp("giardini_gear_a", gear(0), "walls", mask=["#"])
    reg.stamp("giardini_gear_b", gear(1), "walls", mask=["#"])
    reg.stamp("giardini_gear_c", gear(2), "walls", mask=["#"])
    reg.stamp("giardini_shade_a", shade(6, 4, "a", [(92, 56, 84, 40), (140, 92, 62, 30)]), "below")
    reg.stamp("giardini_shade_b", shade(5, 4, "b", [(80, 58, 70, 38), (46, 96, 40, 20)]), "below")
    reg.stamp("giardini_shade_c", shade(6, 4, "c", [(86, 60, 78, 36), (140, 92, 42, 22)]), "below")
    reg.stamp("giardini_shade_d", shade(5, 3, "d", [(70, 44, 62, 28), (110, 66, 36, 16)]), "below")

    def mask(w, h):
        return ["." * w] * (h - 1) + ["." * (w // 2) + "#" + "." * (w // 2)]

    reg.stamp("giardini_tree_slack_l", big_tree(3, 4, "slackl", 38, 34, 16, 24, strap=1), "objects", above_rows=3, mask=mask(3, 4))
    reg.stamp("giardini_tree_slack_r", big_tree(3, 4, "slackr", 38, 34, 16, 24, strap=2), "objects", above_rows=3, mask=mask(3, 4))
    reg.stamp("giardini_tree_plane", big_tree(5, 5, "plane", 64, 46, 22, 32, ramp=LEAF), "objects", above_rows=4, mask=mask(5, 5))
    reg.stamp("giardini_tree_young_a", big_tree(3, 3, "younga", 29, 22, 8, 12, ramp=LEAF_D), "objects", above_rows=2, mask=mask(3, 3))
    reg.stamp("giardini_tree_young_b", big_tree(3, 3, "youngb", 31, 22, 8, 12, ramp=LEAF), "objects", above_rows=2, mask=mask(3, 3))
    reg.stamp("giardini_sapling", sapling(), "objects", above_rows=1, mask=[".", "#"])
    reg.stamp("giardini_bench_graffiti", bench(True), "objects")
    reg.stamp("giardini_bench_wood", pxl_object("giardini_bench_wood", (32, 29.5, 28, 2.8, 70)), "objects")   # drawn with pxl, scripts/art/pxl/objects.px.js
    reg.stamp("giardini_lamp", pxl_object("giardini_lamp", (16, 62, 8, 2.2, 66)), "objects", mask=[".", "#"])
    reg.stamp("giardini_bin", bin_green(), "objects")
    reg.stamp("giardini_dog", dog(), "objects")
