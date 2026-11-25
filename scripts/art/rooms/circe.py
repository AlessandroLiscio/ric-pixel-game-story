"""Casa Circe, 24 x 13 tiles, rebuilt from the five reference photos and arranged after the owner's floor plan (see docs/tiles.md, "Casa Circe, photo feature -> map").

An open plan flat seen from the south, the walls of the real home laid flat along the back wall: the kitchen in the north west corner with
the fridge in the corner, the white bathroom door, the stair stringer with the TV and the fairy lights, the white shelves of bottles,
the curtained glass door and the sofa under the world map. On the floor, as on the plan: the long dinner table turned north to south on
the left with two chairs on each long side, the rug and the coffee table in front of the TV, the navy sofa on the south wall facing the
TV, the front door and the coat stand at the bottom right. Warm evening light from the lamps, the kitchen and the TV.
"""
import random

from mapkit import Map

T = 32
W, H = 24, 13
DOOR_X = 19                    # the front door, in the bottom wall (the plan has it on the right wall, low)


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
    caps.discard((DOOR_X, H - 1))
    caps.discard((DOOR_X + 1, H - 1))
    for (x, y) in caps:
        edges = "".join(e for e, (dx, dy) in zip("NESW", ((0, -1), (1, 0), (0, 1), (-1, 0)))
                        if 0 <= x + dx < W and 0 <= y + dy < H and (x + dx, y + dy) not in caps)
        m.put("walls", x, y, "cap_" + (edges or "none"))
    m.stamp("circe_entrance", DOOR_X, H - 1)
    m.stamp("circe_doormat", DOOR_X, H - 2)

    # the back wall in five pictures on rows 1 to 4: the kitchen (fridge in the corner), the bathroom door, the stairs and the TV, the shelves, the sofa and the glass door
    m.stamp("circe_wall_kitchen_flip", 1, 1)
    m.stamp("circe_wall_door", 7, 1)
    m.stamp("circe_wall_stairs", 9, 1)
    m.stamp("circe_wall_shelf", 15, 1)
    m.stamp("circe_wall_sofa", 18, 1)
    m.block(1, 1, W - 2, 4)

    # the TV on the stairs wall, the white tree beside it, and in front of it the rug with the coffee table, the pink pouf and a white chair
    m.stamp("circe_tv_unit", 10, 4)
    m.stamp("circe_xmas_tree", 13, 4)
    m.stamp("circe_rug", 9, 6)
    m.stamp("circe_coffee_table", 10, 7)
    m.stamp("circe_beanbag", 13, 7)
    m.stamp("circe_chair_white_e", 9, 7)

    # the navy sofa on the south wall, its back to us, facing the TV across the rug
    m.stamp("circe_sofa_back", 10, 10)

    # the sofa corner: the sofa with its red throw under the map, the standing lamp and the scooter at the glass door, a plant
    m.stamp("circe_sofa_front_throw", 20, 4)
    m.stamp("circe_floorlamp", 18, 3)
    m.stamp("circe_scooter", 19, 4)
    m.stamp("circe_plant_red", 18, 6)

    # the dinner table with the red cloth turned north to south, two ghost chairs on its east side and two white folding chairs on its west
    m.stamp("circe_table_v", 4, 6)
    m.stamp("circe_chair_white_e", 3, 7)
    m.stamp("circe_chair_white_e", 3, 8)
    m.stamp("circe_chair_ghost_w", 7, 7)
    m.stamp("circe_chair_ghost_w", 7, 8)
    m.stamp("circe_bowl", 1, 11)

    # the coat stand with fairy lights in the bottom right corner, by the front door
    m.stamp("circe_coatstand", 22, 10)

    # named points, in tiles
    m.point("spawn", 20, 10)
    m.point("door", DOOR_X, 12, 2, 1)
    m.point("ros", 20, 6)
    m.point("giusy", 8, 5)
    m.point("papa", 5, 10)   # Ric's parents (extras), just in from dinner, standing at the foot of the table
    m.point("mamma", 6, 10)

    # the things Ric can interact with, in tiles: x, y, width, height of each footprint
    m.point("obj_tv", 10, 4, 3, 2)
    m.point("obj_sink", 3, 3, 2, 2)
    m.point("obj_fridge", 1, 1, 1, 4)
    m.point("obj_shelf", 15, 1, 3, 4)
    m.point("obj_lamp", 18, 3, 1, 3)
    m.point("obj_coatrack", 22, 10, 1, 2)

    # lights, in pixels
    for lx in (72, 142):                                                    # under the kitchen cabinets (the stamp is mirrored)
        m.light(T + lx, T + 80, "#ffe6a8", 0, "steady", 0, pool=70, power=.55)
    m.light(18 * T + 20, 3 * T + 12, "#ffe2a0", 24, "steady", 0, pool=110, power=.8)   # the standing lamp: lights 2 and 3
    m.light(18 * T + 9, 3 * T + 34, "#ffe2a0", 16, "steady", 0, pool=56, power=.5)
    m.light(4 * T + 68, 6 * T + 14, "#ffb060", 14, "flicker", 1500, pool=70, power=.6)  # the candle on the table
    m.light(5 * T + 10, 8 * T + 6, "#ffcf72", 0, "steady", 0, pool=80, power=.3)
    m.light(10 * T + 49, 4 * T + 17, "#e29cff", 24, "pulse", 1700, pool=80, power=.42)      # the TV
    for k, (lx, ly) in enumerate(((20, 28), (60, 36), (100, 48), (150, 48), (182, 68))):   # the fairy lights on the stairs
        m.light(9 * T + lx, T + ly, "#ffd890", 9, "flicker", 1600 + 230 * k, pool=40, power=.4)
    m.light(13 * T + 16, 4 * T + 34, "#ffe9c0", 14, "flicker", 2100, pool=50, power=.45)     # the white tree
    m.light(22 * T + 16, 10 * T + 28, "#ffd890", 10, "flicker", 1900, pool=44, power=.45)   # the coat stand lights
    m.light(12 * T, 9 * T, "#ffc890", 0, "steady", 0, pool=150, power=.22)                   # the warm bounce of the room
    m.light(11 * T + 16, 7 * T + 16, "#ffc890", 0, "steady", 0, pool=110, power=.2)
    m.light(21 * T, 6 * T + 16, "#ffcf90", 0, "steady", 0, pool=90, power=.3)
    m.light((DOOR_X + 1) * T, 12 * T + 22, "#ffcf72", 26, "steady", 0, pool=60, power=.8)   # the porch lamp outside
    m.light((DOOR_X + 1) * T, 11 * T + 6, "#8ab0ff", 0, "steady", 0, pool=70, power=.35)
    return m
