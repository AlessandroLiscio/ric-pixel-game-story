"""Giuggiu's living room, 22 x 13 tiles, rebuilt from the three reference photos (see docs/tiles.md, "Giuggiu, photo feature -> map").

A big old flat in the afternoon (16:20): dark herringbone parquet, pale lilac cream walls, the wide window on the back wall with its half
lowered shutters, the crystal chandelier and the red paper lantern in front of it, the walnut armoire in the left corner and the display
cabinet in the right corner, the glass table with the red and the black chair in the middle, and the three sofas (burgundy and cream along
the left wall under the tall window, the navy one with the red throw in front where the cat sleeps) with the red pouf, the oak shelf
along the right wall. The door is the dark doorway in the bottom wall. Day mood: warm and a little dim, with sun from the windows.
"""
import random

from mapkit import Map

T = 32
W, H = 22, 13


def build():
    m = Map("giuggiu", W, H)
    rnd = random.Random(11)
    m.mood("#e2d0c8")

    # ground: the herringbone parquet everywhere inside the walls
    m.fill("ground", 1, 4, 20, H - 2, ["giuggiu_parquet_a"] * 5 + ["giuggiu_parquet_b"] * 2 + ["giuggiu_parquet_c", "giuggiu_parquet_d"], rnd)

    # caps: a ring around the room, open at the doorway in the bottom wall
    caps = {(x, y) for x in range(W) for y in range(H) if x in (0, W - 1) or y in (0, H - 1)}
    caps.discard((10, H - 1))
    caps.discard((11, H - 1))
    for (x, y) in caps:
        edges = "".join(e for e, (dx, dy) in zip("NESW", ((0, -1), (1, 0), (0, 1), (-1, 0)))
                        if 0 <= x + dx < W and 0 <= y + dy < H and (x + dx, y + dy) not in caps)
        m.put("walls", x, y, "cap_" + (edges or "none"))
    m.stamp("giuggiu_doorway", 10, H - 1)
    m.stamp("giuggiu_doormat", 10, H - 2)

    # the back wall in three pictures (rows 1 to 3) and the two side walls seen edge on (column 1 and column 20)
    m.stamp("giuggiu_wall_left", 1, 1)
    m.stamp("giuggiu_wall_win", 8, 1)
    m.stamp("giuggiu_wall_right", 14, 1)
    m.block(1, 1, 20, 3)
    side = ["giuggiu_sidel_wall", "giuggiu_sidel_wall", "giuggiu_sidel_win_top", "giuggiu_sidel_win_mid", "giuggiu_sidel_win_mid2",
            "giuggiu_sidel_win_bot", "giuggiu_sidel_wall", "giuggiu_sidel_wall", "giuggiu_sidel_wall"]
    for i in range(H - 5):
        m.put("walls", 1, 4 + i, side[i])
        m.put("walls", 20, 4 + i, "giuggiu_sider_picture" if i in (6, 7) else "giuggiu_sider_wall")
    m.block(1, 4, 1, H - 2)
    m.block(20, 4, 20, H - 2)
    for x in list(range(6, 11)) + list(range(14, 17)):          # the soft shade of the back wall on the floor
        m.put("below", x, 4, "shade_top")

    # sun on the floor: through the back window and through the tall window on the left
    m.stamp("giuggiu_sun_window", 6, 4)
    m.stamp("giuggiu_sun_side", 2, 8)

    # against the back wall, from the left: the armoire, the brass trolley, the console under the window, the cabinet in the corner
    m.stamp("giuggiu_armoire", 2, 1)
    m.stamp("giuggiu_trolley", 4, 3)
    m.stamp("giuggiu_console", 11, 3)
    m.stamp("giuggiu_vitrine", 17, 1)
    m.stamp("giuggiu_shelf", 19, 5)                              # the oak shelf along the right wall

    # the sofas: the cream one and the long burgundy one along the left wall facing east, the pouf, the navy one with the red throw
    m.stamp("giuggiu_sofa_cream", 2, 5)
    m.stamp("giuggiu_sofa_burgundy", 2, 8)
    m.stamp("giuggiu_pouf", 4, 10)
    m.stamp("giuggiu_sofa_navy", 5, 9)
    m.block(5, 9, 8, 9)
    m.block(5, 10, 7, 10)                                        # the arm tile (8, 10) stays free: it is the cat's spot, scenes need a walkable one

    # the glass table with the red chair on its left and the black chair on its right
    m.stamp("giuggiu_table", 10, 6)
    m.stamp("giuggiu_chair_red", 9, 7)
    m.stamp("giuggiu_chair_black", 14, 7)

    # hanging in front of the window: the chandelier, and the lantern from its middle
    m.stamp("giuggiu_chandelier", 8, 1)
    m.stamp("giuggiu_lantern", 10, 2)

    # named points, in tiles
    m.point("spawn", 12, 10)
    m.point("door", 10, H - 1, 2, 1)
    m.point("giuggiu", 15, 6)
    m.point("gatto", 8, 10)

    # lights, in pixels: the back window, the tall window, the chandelier, the lantern, the glass table, the corridor
    m.light(352, 140, "#fff0cf", 0, "steady", 0, pool=170, power=.7)             # the daylight the back window throws into the room
    m.light(70, 240, "#ffe2a8", 0, "steady", 0, pool=150, power=.8)               # the tall window on the left
    m.light(352, 96, "#ffe0a0", 0, "steady", 0, pool=64, power=.4)                # the chandelier
    m.light(352, 140, "#ff6a50", 14, "steady", 0, pool=60, power=.4)              # the red lantern
    m.light(352, 250, "#ffe8c8", 0, "steady", 0, pool=110, power=.35)             # the glass table catches the light
    m.light(11 * T, (H - 1) * T + 12, "#8a6a58", 0, "steady", 0, pool=44, power=.3)   # the dim corridor
    return m
