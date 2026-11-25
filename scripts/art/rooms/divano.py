"""The divano room, 22 x 12 tiles: Casa Circe late at night, rebuilt from `casa-circe-divano-aperto`, `casa-circe-scale-tv` and
`casa-circe-tavolo-divano` and arranged like the `circe` room, after the owner's floor plan (see docs/tiles.md, "Casa Circe late at
night (divano), photo feature -> map").

The same flat as the `circe` room, seen on the night of the story: the kitchen in the corner, the white stair stringer with the fairy
lights and the TV on its low cabinet, the white shelves, the curtained glass door with the navy sofa opened into a bed under the world
map, the long dinner table turned north to south on the left, and the navy sofa on the south wall facing the TV. The only light is the
TV, the fairy lights, the standing lamp and the tree. The ending (src/game/ending) draws this map as its backdrop: the TV screen sits at
`tv`, and the party sits on the sofa with its back to us, on the chairs of the table, on the rug and on the floor, at the points `seat_*`.
The credits column covers everything right of x 400, so the TV, the sofa and the table are all on the left of it.
"""
import random

from mapkit import Map

T = 32
W, H = 22, 12


def build():
    m = Map("divano", W, H)
    rnd = random.Random(11)
    m.mood("#424e80")                                  # dark blue night, the pools of the lights bring the colour back

    # ground: the big pale beige tiles, the soft shade under the back wall and along the sides
    for y in range(5, H - 1):
        for x in range(1, W - 1):
            m.put("ground", x, y, "circe_floor_" + "abcd"[(x % 2) + 2 * (y % 2)])
    for x in range(1, W - 1):
        m.put("below", x, 5, "shade_top")
    for y in range(6, H - 1):
        m.put("below", 1, y, "shade_left")
        m.put("below", W - 2, y, "shade_right")

    # a closed ring of caps (the front door of the flat is not part of this scene)
    for y in range(H):
        for x in range(W):
            if x in (0, W - 1) or y in (0, H - 1):
                edges = "".join(e for e, (dx, dy) in zip("NESW", ((0, -1), (1, 0), (0, 1), (-1, 0)))
                                if 0 <= x + dx < W and 0 <= y + dy < H and not (x + dx in (0, W - 1) or y + dy in (0, H - 1)))
                m.put("walls", x, y, "cap_" + (edges or "none"))

    # the back wall on rows 1 to 4: the kitchen (fridge in the corner), the stairs and the TV, the shelves, the sofa wall
    m.stamp("circe_wall_kitchen_flip", 1, 1)
    m.stamp("circe_wall_stairs", 7, 1)
    m.stamp("circe_wall_shelf", 13, 1)
    m.stamp("circe_wall_sofa", 16, 1)
    m.block(1, 1, W - 2, 4)

    # the TV corner: the wide screen on its white cabinet, the little white tree, the rug with the low table and the pink pouf
    m.stamp("divano_tv_unit", 8, 3)
    m.stamp("circe_xmas_tree", 12, 4)
    m.stamp("circe_rug", 8, 6)
    m.stamp("circe_coffee_table", 9, 7)
    m.stamp("circe_beanbag", 12, 7)

    # the navy sofa on the south wall, its back to us, facing the TV across the rug: the party sits on it in the ending
    m.stamp("circe_sofa_back", 9, 9)

    # the glass door corner: the standing lamp and the scooter in front of the curtained door, the glass table with the pizza
    m.stamp("circe_floorlamp", 16, 3)
    m.stamp("circe_scooter", 17, 4)
    m.stamp("divano_glass_table", 16, 6)
    m.stamp("circe_plant_red", 15, 6)

    # the sofa opened into a bed under the world map, a white folding chair and the slippers on the floor in front of it
    m.stamp("divano_sofa_bed", 18, 4)
    m.stamp("circe_chair_white_w", 16, 8)
    m.stamp("divano_slippers", 18, 8)

    # the dinner table with the red cloth turned north to south on the left, what is left of the dinner, two chairs on each long side
    m.stamp("circe_table_v", 4, 6)
    m.stamp("circe_chair_white_e", 3, 7)
    m.stamp("circe_chair_white_e", 3, 8)
    m.stamp("circe_chair_ghost_w", 7, 7)
    m.stamp("circe_chair_ghost_w", 7, 8)
    m.stamp("divano_study_table", 13, 10)                # the study left on the glass table
    m.stamp("circe_bowl", 20, 10)

    # named points, in tiles: where Ric enters, a door that this scene never uses (the maps need one), and the seats of the party
    m.point("spawn", 14, 8)
    m.point("door", 15, 10, 2, 1)
    m.point("tv", 8, 3, 4, 3)                           # the TV stamp: the screen is 96 x 54 px at (16, 6) inside it
    m.point("seat_sofa_l", 9, 9)                        # the three seats of the sofa: heads over the backrest, left, middle, right
    m.point("seat_sofa_m", 10, 9)
    m.point("seat_sofa_r", 11, 9)
    m.point("seat_chair_l", 3, 8)                       # the white chair at the west side of the table (faces east)
    m.point("seat_chair_r", 7, 8)                       # the clear chair at the east side of the table (faces west)
    m.point("seat_pouf", 12, 7)                         # the pink pouf, in front of the TV
    m.point("seat_floor", 10, 8)                         # on the rug in front of the coffee table
    m.point("seat_cat", 12, 10)                         # the cat curls up at the end of the sofa
    m.point("bed", 18, 4, 3, 4)                         # the sofa bed under the world map (out of sight of the credits)

    # lights, in pixels: the TV is the main one, then the fairy lights, the standing lamp, the tree
    tvx, tvy = 8 * T + 64, 3 * T + 34
    m.light(tvx, tvy, "#b48cff", 30, "pulse", 1500, pool=150, power=.85)
    m.light(tvx - 8, tvy + 40, "#ff8ad0", 0, "steady", 0, pool=110, power=.5)
    m.light(10 * T + 16, 7 * T + 16, "#8aa8ff", 0, "steady", 0, pool=130, power=.35)         # the blue wash of the screen on the rug
    m.light(10 * T + 16, 9 * T + 8, "#9ab0ff", 0, "steady", 0, pool=100, power=.4)           # and on the sofa
    for k, (lx, ly) in enumerate(((20, 28), (60, 36), (100, 48), (150, 48), (182, 68))):   # the fairy lights on the stairs
        m.light(7 * T + lx, T + ly, "#ffd890", 9, "flicker", 1600 + 230 * k, pool=44, power=.5)
    m.light(12 * T + 16, 4 * T + 34, "#ffe9c0", 14, "flicker", 2100, pool=54, power=.5)     # the white tree
    m.light(16 * T + 20, 3 * T + 12, "#ffe2a0", 22, "steady", 0, pool=100, power=.65)       # the standing lamp, low
    m.light(16 * T + 9, 3 * T + 34, "#ffe2a0", 14, "steady", 0, pool=50, power=.4)
    for lx in (72, 142):                                                                    # the strip under the kitchen cabinets
        m.light(T + lx, T + 80, "#ffe6a8", 0, "steady", 0, pool=60, power=.4)
    m.light(4 * T + 68, 6 * T + 14, "#ffb060", 14, "flicker", 1500, pool=70, power=.5)      # the last candle on the dinner table
    return m
