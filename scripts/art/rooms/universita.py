"""The lecture hall, 22 x 14 tiles, rebuilt from the two reference photos (see docs/tiles.md, "Photo feature -> map").

The front wall is at the top: windows over the gallery balustrade on the left, the small arched door, the screen between its two
whiteboards and the pilasters, the big arched doorway on the right (the exit). Under it the carpeted floor of the lecturer with the long
lectern, then the curved amphitheatre benches in arcs around it, split by two stairs aisles and a side aisle along the left wall, with a
walkway along the back. Ric comes in through the small arched door and walks right along the front. Daylight: the sun falls through
the left windows onto the benches.
"""
import math

from mapkit import Map

T = 32
W, H = 22, 14
# the geometry of the benches, equal to the one in stamps/universita.py (the arcs are ellipses around the foot of the screen)
CX, CY, K, R0 = 391, 14, 1.5, 112
FRONT_Y, REAR_Y, STRIP = 32, 224, 32
AISLES = [(160, 224), (512, 576)]


def is_tier(x, y):
    if y < FRONT_Y or y >= REAR_Y:
        return False
    if math.hypot((x + .5 - CX) / K, y + .5 - CY) < R0:
        return False
    return not (x < STRIP or any(a <= x < b for a, b in AISLES))


def build():
    m = Map("universita", W, H)
    m.mood("#e4d9cc")

    m.fill("ground", 1, 5, 20, 12, "stone_cool")
    caps = {(x, y) for x in range(W) for y in range(H) if x in (0, W - 1) or y in (0, H - 1)}
    for (x, y) in caps:
        edges = "".join(e for e, (dx, dy) in zip("NESW", ((0, -1), (1, 0), (0, 1), (-1, 0)))
                        if 0 <= x + dx < W and 0 <= y + dy < H and (x + dx, y + dy) not in caps)
        m.put("walls", x, y, "cap_" + (edges or "none"))

    m.stamp("universita_wall_front", 1, 1)
    m.block(1, 1, 20, 3)
    m.block(1, 4, 17, 4)
    m.block(20, 4, 20, 4)       # the big doorway (tiles 18 and 19 of row 4) stays open: it is the door

    m.stamp("universita_bowl", 1, 5)
    for ty in range(5, 13):
        for tx in range(1, 21):
            n = sum(1 for sy in range(4, 32, 8) for sx in range(4, 32, 8) if is_tier((tx - 1) * T + sx, (ty - 5) * T + sy))
            if n >= 8:          # at least half of the 16 samples are benches
                m.block(tx, ty)

    m.stamp("universita_lectern", 10, 6)
    m.stamp("universita_bins", 20, 5)

    # Ric comes in through the small arched door of the front wall and walks right along the front of the room: Lollino waits two tiles
    # on, Prof. Pinolo stands at the left end of the lectern, the exit is the big arched doorway at the right end of the same row
    m.point("spawn", 7, 5)
    m.point("door", 18, 4, 2, 2)
    m.point("lollino", 9, 5)
    m.point("pinolo", 9, 7)
    m.point("studente", 18, 8)

    # lights, in pixels: the sun through the two windows of the left bay, their strip lamps, the glow of the screen, the vending machine
    # in the doorway, the daylight of the back door
    m.light(32 + 103, 160 + 80, "#fff0c0", 0, "steady", 0, pool=96, power=.55)
    m.light(32 + 199, 160 + 96, "#fff0c0", 0, "steady", 0, pool=96, power=.5)
    m.light(32 + 92, 32 + 24, "#fff4d8", 8, "steady", 0, pool=54, power=.5)
    m.light(32 + 178, 32 + 24, "#fff4d8", 8, "steady", 0, pool=54, power=.5)
    m.light(32 + 391, 32 + 52, "#e4f0ff", 0, "steady", 0, pool=120, power=.5)
    m.light(32 + 590, 32 + 92, "#7fe8c0", 12, "flicker", 2600, pool=46, power=.5)
    m.light(32 + 400, 8 * T, "#fff4e0", 0, "steady", 0, pool=150, power=.3)
    return m
