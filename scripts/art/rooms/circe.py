"""Casa Circe, 24 x 13 tiles, rebuilt from the five reference photos (see docs/tiles.md, "Casa Circe, photo feature -> map").

An open plan flat seen from the south, the walls of the real home laid flat along the back wall: the white stair stringer with the TV and
the fairy lights, the white shelves of bottles, the white bathroom door, the kitchen run, the curtained glass door and the sofa under
the world map. In front of them the long dinner table with the red cloth in the middle, the rug and the coffee table on the left, the
front door at the bottom left. Warm evening light from the lamps, the kitchen and the TV.
"""
import random

from mapkit import Map

T = 32
W, H = 24, 13


def build():
    m = Map("circe", W, H)
    rnd = random.Random(7)
    m.mood("#8c7790")

    # ground: big pale beige tiles (2 x 2 tiles each, picked by the parity of x and y), the soft shade under the back wall and the sides
    for y in range(5, H - 1):
        for x in range(1, W - 1):
            m.put("ground", x, y, "circe_floor_" + "abcd"[(x % 2) + 2 * (y % 2)])
    for x in range(1, W - 1):
        m.put("below", x, 5, "shade_top")
    for y in range(6, H - 1):
        m.put("below", 1, y, "shade_left")
        m.put("below", W - 2, y, "shade_right")

    # caps: a ring around the flat, open at the front door
    caps = {(x, y) for x in range(W) for y in range(H) if x in (0, W - 1) or y in (0, H - 1)}
    caps.discard((3, H - 1))
    caps.discard((4, H - 1))
    for (x, y) in caps:
        edges = "".join(e for e, (dx, dy) in zip("NESW", ((0, -1), (1, 0), (0, 1), (-1, 0)))
                        if 0 <= x + dx < W and 0 <= y + dy < H and (x + dx, y + dy) not in caps)
        m.put("walls", x, y, "cap_" + (edges or "none"))
    m.stamp("circe_entrance", 3, H - 1)
    m.stamp("circe_doormat", 3, H - 2)

    # the back wall in five pictures on rows 1 to 4: stairs and TV, shelves, the bathroom door, the kitchen, the sofa and the glass door
    m.stamp("circe_wall_stairs", 1, 1)
    m.stamp("circe_wall_shelf", 7, 1)
    m.stamp("circe_wall_door", 10, 1)
    m.stamp("circe_wall_kitchen", 12, 1)
    m.stamp("circe_wall_sofa", 18, 1)
    m.block(1, 1, W - 2, 4)

    # the TV corner
    m.stamp("circe_tv_unit", 2, 4)
    m.stamp("circe_xmas_tree", 5, 4)
    m.stamp("circe_rug", 2, 7)
    m.stamp("circe_coffee_table", 3, 8)
    m.stamp("circe_beanbag", 6, 8)
    m.stamp("circe_chair_white_e", 2, 8)

    # the sofa corner: the sofa with its red throw, the standing lamp and the scooter at the glass door, a plant
    m.stamp("circe_sofa_front_throw", 20, 4)
    m.stamp("circe_floorlamp", 18, 3)
    m.stamp("circe_scooter", 19, 4)
    m.stamp("circe_plant_red", 18, 6)

    # the dinner table with the red cloth, ghost chairs on the south and east, white folding chairs on the north and west
    m.stamp("circe_table", 13, 7)
    m.stamp("circe_chair_white_n", 13, 6)
    m.stamp("circe_chair_ghost_n", 15, 6)
    m.stamp("circe_chair_white_e", 12, 7)
    m.stamp("circe_chair_ghost_w", 17, 8)
    m.stamp("circe_chair_ghost_s", 14, 9)
    m.stamp("circe_chair_ghost_s", 16, 9)
    m.stamp("circe_bowl", 21, 10)

    # the coat stand with fairy lights by the front door
    m.stamp("circe_coatstand", 6, 10)

    # named points, in tiles
    m.point("spawn", 4, 10)
    m.point("door", 3, 12, 2, 1)
    m.point("ros", 20, 6)
    m.point("giusy", 11, 5)

    # lights, in pixels
    for lx in (50, 120):                                                    # under the kitchen cabinets
        m.light(12 * T + lx, T + 80, "#ffe6a8", 0, "steady", 0, pool=70, power=.55)
    m.light(18 * T + 20, 3 * T + 12, "#ffe2a0", 24, "steady", 0, pool=110, power=.8)   # the standing lamp
    m.light(18 * T + 9, 3 * T + 34, "#ffe2a0", 16, "steady", 0, pool=56, power=.5)
    m.light(13 * T + 10, 7 * T + 16, "#ffb060", 14, "flicker", 1500, pool=70, power=.6)  # the candle on the table
    m.light(15 * T + 10, 7 * T + 22, "#ffcf72", 0, "steady", 0, pool=80, power=.3)
    m.light(2 * T + 49, 4 * T + 17, "#e29cff", 24, "pulse", 1700, pool=80, power=.42)       # the TV
    for k, (lx, ly) in enumerate(((20, 28), (60, 36), (100, 48), (150, 48), (182, 68))):   # the fairy lights on the stairs
        m.light(T + lx, T + ly, "#ffd890", 9, "flicker", 1600 + 230 * k, pool=40, power=.4)
    m.light(5 * T + 16, 4 * T + 34, "#ffe9c0", 14, "flicker", 2100, pool=50, power=.45)      # the white tree
    m.light(6 * T + 16, 10 * T + 28, "#ffd890", 10, "flicker", 1900, pool=44, power=.45)    # the coat stand lights
    m.light(12 * T, 9 * T, "#ffc890", 0, "steady", 0, pool=150, power=.22)                   # the warm bounce of the room
    m.light(4 * T, 8 * T, "#ffc890", 0, "steady", 0, pool=110, power=.2)
    m.light(21 * T, 6 * T + 16, "#ffcf90", 0, "steady", 0, pool=90, power=.3)
    m.light(4 * T, 12 * T + 22, "#ffcf72", 26, "steady", 0, pool=60, power=.8)               # the porch lamp outside
    m.light(4 * T, 11 * T + 6, "#8ab0ff", 0, "steady", 0, pool=70, power=.35)
    return m
