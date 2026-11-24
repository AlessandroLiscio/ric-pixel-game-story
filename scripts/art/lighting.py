"""The night mood of a tile room, one model shared by the map preview (numpy) and by src/game/flow/tileMap.ts (canvas).

A room with a `mood` is multiplied by a light map: the ambient colour everywhere, plus a radial pool of each light's colour around
it (the pool radius is the light's `pool`, in pixels). The pool profile is a radial gradient, 1.0 in the centre, 0.6 at 40 % of the
radius, 0 at the edge, added on top of the ambient colour and clamped at 1, so a pool can only bring a spot back to its daylight
colour, never past it. After the multiply the small additive glows (`r`) are painted on top, tinted and at alpha 0.55.
Keep the numbers here and in tileMap.ts equal: it is the whole contract.
"""
import numpy as np

POOL_PROFILE = ([0.0, 0.4, 1.0], [1.0, 0.6, 0.0])
GLOW_PROFILE = ([0.0, 0.35, 1.0], [1.0, 0.45, 0.0])
GLOW_ALPHA = 0.55


def _rgb(hexstr):
    h = hexstr.lstrip("#")
    return np.array([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)], dtype=np.float64) / 255.0


def _radial(w, h, cx, cy, radius, profile):
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt((xx + .5 - cx) ** 2 + (yy + .5 - cy) ** 2) / radius
    return np.interp(d, profile[0], profile[1])


def light_map(mood, lights, w, h):
    acc = np.tile(_rgb(mood["ambient"]), (h, w, 1))
    for l in lights:
        pool = l.get("pool", 0)
        if pool <= 0:
            continue
        a = _radial(w, h, l["x"], l["y"], pool, POOL_PROFILE) * l.get("power", 1.0)
        acc += _rgb(l["color"]) * a[:, :, None]
    return np.clip(acc, 0, 1)


def apply(rgb, mood, lights, glows=True):
    """rgb: uint8 array (h, w, 3). Returns the lit picture as uint8."""
    h, w = rgb.shape[:2]
    out = rgb.astype(np.float64) / 255.0 * light_map(mood, lights, w, h)
    if glows:
        for l in lights:
            if l["r"] <= 0:
                continue
            a = _radial(w, h, l["x"], l["y"], l["r"], GLOW_PROFILE) * GLOW_ALPHA
            out += _rgb(l["color"]) * a[:, :, None]
    return (np.clip(out, 0, 1) * 255 + .5).astype(np.uint8)
