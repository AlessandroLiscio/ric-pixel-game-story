"""Shading, selective outline and stray pixel clean-up for the 32x32 walk frames drawn by chibis.py.

Light comes from the top left, like the tiles (docs/tiles.md). Every material of the shared sprite palette gets a three tone ramp whose hue moves
(shadow toward violet, light toward warm yellow), `polish` then lights the top left rim of each material, shades its right and bottom rim, casts
the hair onto the face, outlines the sprite in the dark tone of the material it hugs (a selective outline, as pxl's `selout`) and merges the
stray pixels that `pxl lint` flags as orphans. Frames are polished after the right row is mirrored, so the light stays on the left in every row.
"""
import colorsys

from PIL import Image

TOP_LEFT_CX = 17  # hair highlight stays left of this column


def _hls(h):
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return colorsys.rgb_to_hls(r, g, b)


def _hex(h, l, s):
    r, g, b = colorsys.hls_to_rgb(h % 1.0, min(1.0, max(0.0, l)), min(1.0, max(0.0, s)))
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


def _toward(h, target, amount):
    d = ((target - h + 0.5) % 1.0) - 0.5
    return h + max(-amount, min(amount, d))


def ramp(hexs):
    """(shade, light, dark) tones of one colour: cool shade, warm light, a deep tone for the outline."""
    h, l, s = _hls(hexs)
    if s < 0.08:
        h = 240 / 360  # neutrals take a blue shade instead of red
    lo, hi = (l * 0.8, l + 0.12) if l < 0.25 else (l * 0.8, l + (1 - l) * 0.2)
    return (_hex(_toward(h, 270 / 360, 12 / 360), lo, s * 0.88 + 0.02),
            _hex(_toward(h, 50 / 360, 8 / 360), hi, s * 0.85),
            _hex(_toward(h, 270 / 360, 20 / 360), l * 0.5, s * 0.6 + 0.05))


def derive(pal):
    """Ramp tones `<name>.s`, `<name>.l`, `<name>.d` for every material of the palette (outline and `_s` skin tones excluded).
    A material that already has a hand picked `<name>_s` (the three skins) keeps it as its shade."""
    out = {}
    known = list(pal.values())

    def snap(hexs):
        """A tone within 12 of a colour that exists already becomes that colour (pxl lint `near-duplicate`, and fewer colours)."""
        c = _rgba(hexs)
        for o in known:
            r = _rgba(o)
            if sum((c[i] - r[i]) ** 2 for i in range(3)) < 144:
                return o
        known.append(hexs)
        return hexs

    for k, v in pal.items():
        if k.startswith("o_") or k.endswith("_s"):
            continue
        s, l, d = ramp(v)
        out[k + ".s"], out[k + ".l"], out[k + ".d"] = snap(pal.get(k + "_s", s)), snap(l), snap(d)
    return out


def _rgba(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def _lum(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] if c[3] else 0


class Ramps:
    def __init__(self, pal):
        self.rgba = {k: _rgba(v) for k, v in pal.items()}
        self.base = {}  # colour -> material name; base colours win over a derived tone with the same value
        for k, c in self.rgba.items():
            if "." not in k and not (k.endswith("_s") and k[:-2] in pal):
                self.base[c] = k
        for k, c in self.rgba.items():
            self.base.setdefault(c, k[:-2] if k.endswith("_s") and k[:-2] in pal else k.split(".")[0])
        self.ramped = {k for k in pal if "." not in k and not k.startswith("o_") and not k.endswith("_s")}

    def tone(self, name, suffix):
        return self.rgba[name + "." + suffix]


def shade(im, rp):
    w, h = im.size
    src = im.load()
    out = im.copy()
    px = out.load()
    toned = {}  # pixel -> its colour before shading

    def t(x, y):
        return not (0 <= x < w and 0 <= y < h) or src[x, y][3] == 0

    def m(x, y):
        return rp.base.get(src[x, y]) if 0 <= x < w and 0 <= y < h else None

    for y in range(h):
        for x in range(w):
            if src[x, y][3] == 0:
                continue
            k = m(x, y)
            if k not in rp.ramped:
                continue
            hair, skin = k.startswith("h_"), k.startswith("skin")
            below = m(x, y + 1)
            dark = t(x + 1, y) or t(x, y + 1)
            dark = dark or (hair and (t(x + 2, y) or t(x, y + 2)))
            dark = dark or (skin and (m(x, y - 1) or "").startswith("h_"))  # the hair casts onto the face
            dark = dark or (not skin and below is not None and below != k and below in rp.ramped)  # hem shadow over the next material
            if dark:
                new = rp.tone(k, "s")
            elif t(x - 1, y) or t(x, y - 1) or (hair and t(x, y - 2) and x < TOP_LEFT_CX):
                new = rp.tone(k, "l")
            else:
                continue
            if new != src[x, y]:
                toned[x, y] = src[x, y]
                px[x, y] = new
    return out, toned


def outline(im, rp, line, tone):
    """Resolve the interior LINE placeholders to the tone, then a 1 px outer outline in the dark tone of the darkest neighbour."""
    w, h = im.size
    src = im.copy()
    sp = src.load()
    out = im.copy()
    px = out.load()
    ring = set()
    for y in range(h):
        for x in range(w):
            if sp[x, y] == line:
                px[x, y] = tone
    for y in range(h):
        for x in range(w):
            if sp[x, y][3]:
                continue
            best = None
            for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < w and 0 <= ny < h) or not sp[nx, ny][3]:
                    continue
                k = rp.base.get(sp[nx, ny])
                c = rp.tone(k, "d") if k in rp.ramped else tone
                if best is None or _lum(c) < _lum(best):
                    best = c
            if best:
                px[x, y] = best
                ring.add((x, y))
    # pixel perfect line: an L corner of the outer line (`pxl lint` jaggy) loses its corner pixel so the line steps diagonally
    for _ in range(3):
        drop = [(x, y) for (x, y) in sorted(ring) if jaggy(px, w, h, x, y)]
        if not drop:
            break
        for x, y in drop:
            px[x, y] = (0, 0, 0, 0)
            ring.discard((x, y))
    return out


def orphans(im):
    """The pixels `pxl lint` calls orphans: opaque, no same-colour 8-neighbour, opaque on all 4 sides, little contrast around."""
    w, h = im.size
    p = im.load()
    n8 = ((-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1))

    def get(x, y):
        return p[x, y] if 0 <= x < w and 0 <= y < h else (0, 0, 0, 0)

    found = []
    for y in range(h):
        for x in range(w):
            c = get(x, y)
            if not c[3] or any(get(x + dx, y + dy) == c for dx, dy in n8):
                continue
            if any(not get(x + dx, y + dy)[3] for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))):
                continue
            around = sum(_lum(get(x + dx, y + dy)) for dx, dy in n8) / 8
            if abs(_lum(c) - around) < 48:
                found.append((x, y))
    return found


def clean(im):
    """A stray pixel inside a mass becomes a 2 px dash (a strand or a fold), otherwise it takes the commonest colour of its 4 neighbours."""
    out = im.copy()
    p = out.load()
    for _ in range(3):
        found = orphans(out)
        if not found:
            break
        for x, y in found:
            up, dn = p[x, y - 1], p[x, y + 1]
            if up == dn and y + 2 < out.height and p[x, y + 2] == up:
                p[x, y + 1] = p[x, y]
                continue
            near = [p[x + dx, y + dy] for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1))]
            p[x, y] = max(near, key=lambda c: (near.count(c), c == near[0]))
    return out


def jaggy(px, w, h, x, y):
    """The `pxl lint` jaggy test at one pixel: exactly two same-colour 8-neighbours, one horizontal and one vertical, forming an L."""
    c = px[x, y]

    def same(dx, dy):
        return 0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy] == c

    if sum(same(dx, dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy) != 2:
        return False
    return any(same(hx, 0) and same(0, vy) and not same(hx, vy) and not same(2 * hx, 0) and not same(0, 2 * vy) for hx in (-1, 1) for vy in (-1, 1))


def unjag(im, toned):
    """A shaded pixel that closes an L in a 1 px rim goes back to its plain colour, together with its two arms (alone it would be a stray)."""
    out = im.copy()
    p = out.load()
    for _ in range(3):
        drop = [(x, y) for (x, y) in sorted(toned) if jaggy(p, out.width, out.height, x, y)]
        if not drop:
            break
        for x, y in drop:
            c = p[x, y]
            for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
                q = (x + dx, y + dy)
                if q in toned and p[q] == c:
                    p[q] = toned.pop(q)
    return out


def long_jaggies(im):
    """What `pxl lint` reports as jaggy: the `jaggy` test, but only inside a thin 8-connected same-colour stroke of 6 or more pixels."""
    w, h = im.size
    p = im.load()
    seen, found = {}, []
    for y0 in range(h):
        for x0 in range(w):
            if not p[x0, y0][3] or (x0, y0) in seen:
                continue
            comp, stack, thin = [(x0, y0)], [(x0, y0)], True
            seen[x0, y0] = True
            while stack:
                x, y = stack.pop()
                c = p[x, y]
                if all(0 <= x + dx < w and 0 <= y + dy < h and p[x + dx, y + dy] == c for dx, dy in ((1, 0), (0, 1), (1, 1))):
                    thin = False
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if (dx or dy) and 0 <= nx < w and 0 <= ny < h and p[nx, ny] == c and (nx, ny) not in seen:
                            seen[nx, ny] = True
                            comp.append((nx, ny))
                            stack.append((nx, ny))
            if len(comp) >= 6 and thin:
                found += [q for q in comp if jaggy(p, w, h, *q)]
    return found


def smooth(im):
    """What the passes above leave of long jaggies takes the commonest other colour of its 4 neighbours (the line steps diagonally)."""
    out = im.copy()
    p = out.load()
    for _ in range(3):
        found = long_jaggies(out)
        if not found:
            break
        for x, y in found:
            near = [p[x + dx, y + dy] for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)) if 0 <= x + dx < out.width and 0 <= y + dy < out.height]
            near = [c for c in near if c != p[x, y]]
            if near:
                p[x, y] = max(near, key=lambda c: (near.count(c), c[3]))
    return out


def polish(im, rp, line, tone):
    shaded, toned = shade(im, rp)
    return clean(smooth(clean(unjag(outline(shaded, rp, line, tone), toned))))
