"""Giuggiu's living room, 22 x 18 tiles, laid out from the owner's floor plan (`casa-giuggiu-sketch.jpeg`) and dressed from the three photos
(see docs/tiles.md, "Giuggiu, plan and photo feature -> map").

A big old flat in the afternoon (16:20): dark herringbone parquet, pale lilac cream walls, the big window on the back wall with its half
lowered shutters, the crystal chandelier and the red paper lantern in front of it, the glass table with its chairs under it. Down the
left wall: the walnut armoire, the iron and brass table, the cream sofa, the tall small window with the red pouf in front of it, the long
burgundy sofa. Three sofas make a triangle round an open floor (the navy one with the cat against the right wall, the long burgundy
one on the left, the one with the grey cushion in the middle, back to the dining table; the plan's low black table is left out, the
owner's call), with the TV on its table at the bottom wall facing them. The entrance is the door in the right wall, below the navy sofa. Day mood: warm and a little dim, with sun from the windows.
"""
import random

from mapkit import Map

T = 32
W, H = 22, 18


def build():
    m = Map("giuggiu", W, H)
    rnd = random.Random(11)
    m.mood("#e2d0c8")

    # ground: the herringbone parquet everywhere inside the walls
    m.fill("ground", 1, 4, 20, H - 2, ["giuggiu_parquet_a"] * 5 + ["giuggiu_parquet_b"] * 2 + ["giuggiu_parquet_c", "giuggiu_parquet_d"], rnd)

    # caps: a ring round the room
    caps = {(x, y) for x in range(W) for y in range(H) if x in (0, W - 1) or y in (0, H - 1)}
    for (x, y) in caps:
        edges = "".join(e for e, (dx, dy) in zip("NESW", ((0, -1), (1, 0), (0, 1), (-1, 0)))
                        if 0 <= x + dx < W and 0 <= y + dy < H and (x + dx, y + dy) not in caps)
        m.put("walls", x, y, "cap_" + (edges or "none"))

    # the back wall in three pictures (rows 1 to 3) and the two side walls seen edge on (column 1 and column 20)
    m.stamp("giuggiu_wall_left", 1, 1)
    m.stamp("giuggiu_wall_win", 8, 1)
    m.stamp("giuggiu_wall_right", 14, 1)
    m.block(1, 1, 20, 3)
    # the left wall: the tall small window ("finestra piccola") on rows 8 to 12, beside the pouf
    side = ["giuggiu_sidel_wall"] * 4 + ["giuggiu_sidel_win_top", "giuggiu_sidel_win_mid", "giuggiu_sidel_win_mid2",
                                       "giuggiu_sidel_win_mid", "giuggiu_sidel_win_bot"] + ["giuggiu_sidel_wall"] * 4
    DOOR = (14, 15)                                              # the entrance, rows 14 and 15 of the right wall
    for i in range(H - 5):
        y = 4 + i
        m.put("walls", 1, y, side[i])
        m.put("walls", 20, y, "giuggiu_sider_door_top" if y == DOOR[0] else "giuggiu_sider_door_bot" if y == DOOR[1]
              else "giuggiu_sider_picture" if y in (10, 11) else "giuggiu_sider_wall")
    m.block(1, 4, 1, H - 2)
    m.block(20, 4, 20, DOOR[0] - 1)
    m.block(20, DOOR[1] + 1, 20, H - 2)
    for x in range(6, 17):                                       # the soft shade of the back wall on the floor
        m.put("below", x, 4, "shade_top")

    # sun on the floor: through the big window and through the tall window on the left
    m.stamp("giuggiu_sun_window", 6, 4)
    m.stamp("giuggiu_sun_side", 2, 9)

    # against the back wall: the armoire in the left corner ("mobile marrone"), the cabinet with the pictures on top in the right
    # corner ("mobile con sopra quadri"), the oak shelf along the right wall; the floor under the window stays free
    m.stamp("giuggiu_armoire", 2, 1)
    m.stamp("giuggiu_vitrine", 17, 1)
    m.stamp("giuggiu_shelf", 19, 5)

    # the left wall, from the top: the iron and brass table, the cream sofa, the pouf in front of the small window, the burgundy sofa
    m.stamp("giuggiu_trolley", 2, 5)
    m.stamp("giuggiu_sofa_cream", 2, 7)
    m.stamp("giuggiu_pouf", 2, 10)
    m.stamp("giuggiu_sofa_burgundy", 2, 11)

    # the dining table under the window with a chair at each end of both rows
    m.stamp("giuggiu_table", 9, 5)
    m.stamp("giuggiu_chair_red", 8, 5)
    m.stamp("giuggiu_chair_red", 8, 6)
    m.stamp("giuggiu_chair_black", 13, 5)
    m.stamp("giuggiu_chair_black", 13, 6)

    # the sofa triangle: the middle sofa faces the TV, the burgundy one (left wall) and the navy one (right wall) face each other
    m.stamp("giuggiu_sofa_navy", 8, 9)
    m.stamp("giuggiu_sofa_east", 18, 10)

    # the TV on its table against the bottom wall, a plant beside it, the doormat inside the entrance
    m.stamp("giuggiu_tv", 9, 15)
    m.stamp("plant_big", 5, 15)
    m.stamp("giuggiu_doormat", 18, 15)

    # hanging in front of the window: the chandelier, and the lantern from its middle
    m.stamp("giuggiu_chandelier", 8, 1)
    m.stamp("giuggiu_lantern", 10, 2)

    # named points, in tiles
    m.point("spawn", 17, 15)
    m.point("door", 20, DOOR[0], 1, 2)
    m.point("giuggiu", 13, 5)                                    # Giuggiu sits on the black chair at the east end of the glass table (a seat: the tile stays blocked)
    m.point("gatto", 18, 11)
    # the things the player can look at or use (x, y, w, h in tiles, the footprint of each object)
    m.point("obj_plates", 9, 5, 4, 2)                            # the glass table: the three carbonara plates and their steam stand on it
    m.point("obj_tv", 9, 15, 3, 2)
    m.point("obj_window", 8, 1, 6, 3)                            # the big window
    m.point("obj_puf", 2, 10, 1, 1)
    m.point("obj_cat", 18, 11, 1, 1)                             # the navy sofa's seat where the cat sleeps

    # lights, in pixels: the big window, the tall window, the chandelier, the lantern, the glass table, the doorway
    m.light(352, 140, "#fff0cf", 0, "steady", 0, pool=170, power=.7)             # the daylight the big window throws into the room
    m.light(70, 336, "#ffe2a8", 0, "steady", 0, pool=150, power=.8)               # the tall window on the left
    m.light(352, 96, "#ffe0a0", 0, "steady", 0, pool=64, power=.4)                # the chandelier
    m.light(352, 140, "#ff6a50", 14, "steady", 0, pool=60, power=.4)              # the red lantern
    m.light(352, 200, "#ffe8c8", 0, "steady", 0, pool=110, power=.35)             # the glass table catches the light
    m.light(20 * T + 12, 15 * T, "#8a6a58", 0, "steady", 0, pool=48, power=.3)    # the dim corridor
    return m
