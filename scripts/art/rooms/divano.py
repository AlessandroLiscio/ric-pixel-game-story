"""The divano room, 22 x 12 tiles: Casa Circe late at night, rebuilt from `casa-circe-divano-aperto`, `casa-circe-scale-tv` and
`casa-circe-tavolo-divano` (see docs/tiles.md, "Casa Circe, la sera (divano), photo feature -> map").

The same flat as the `circe` room, seen on the night of the story: the white stair stringer with the fairy lights and the TV on its low
cabinet at the left, the sofa wall next to it (curtained glass door, coats, the scratch-off world map), the navy sofa opened into a
bed with a quilted cover, the white shelves and the kitchen at the far right. The only light is the TV, the fairy lights, the standing
lamp and the tree. The ending (src/game/ending) draws this map as its backdrop: the TV screen sits at `tv` and the party on and around
the bed, whose seats are the points `seat_*`.
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

    # the back wall on rows 1 to 4: the stairs and the TV, the sofa with its world map, the shelves, the kitchen
    m.stamp("circe_wall_stairs", 1, 1)
    m.stamp("circe_wall_sofa", 7, 1)
    m.stamp("circe_wall_shelf", 12, 1)
    m.stamp("circe_wall_kitchen", 15, 1)
    m.block(1, 1, W - 2, 4)

    # the TV corner: the wide screen on its white cabinet, the little white tree, the rug with the low table and the pink pouf
    m.stamp("divano_tv_unit", 2, 3)
    m.stamp("circe_xmas_tree", 6, 4)
    m.stamp("circe_rug", 2, 6)
    m.stamp("circe_coffee_table", 3, 7)
    m.stamp("circe_beanbag", 6, 7)

    # the glass door corner: the standing lamp and the scooter in front of the curtained door, the glass table with the pizza
    m.stamp("circe_floorlamp", 7, 3)
    m.stamp("circe_scooter", 8, 4)
    m.stamp("divano_glass_table", 7, 6)

    # the sofa opened into a bed under the world map, a white folding chair on each side, the slippers on the floor
    m.stamp("divano_sofa_bed", 9, 4)
    m.block(9, 5, 11, 5)                                # the whole bed is furniture: the party sits on it in the ending
    m.stamp("circe_chair_white_w", 12, 6)
    m.stamp("circe_chair_white_w", 8, 8)
    m.stamp("divano_slippers", 12, 8)
    m.stamp("divano_study_table", 10, 10)                # the study left on the glass table in front of the sofa

    # the shelf and kitchen end of the flat: what is left of the dinner, the long table with the red cloth and its chairs
    m.stamp("circe_plant_red", 13, 6)
    m.stamp("circe_table", 16, 7)
    m.stamp("circe_chair_white_n", 16, 6)
    m.stamp("circe_chair_ghost_n", 18, 6)
    m.stamp("circe_chair_white_e", 15, 7)
    m.stamp("circe_chair_ghost_w", 20, 8)
    m.stamp("circe_chair_ghost_s", 17, 9)
    m.stamp("circe_chair_ghost_s", 19, 9)
    m.stamp("circe_bowl", 20, 10)

    # named points, in tiles: where Ric enters, a door that this scene never uses (the maps need one), and the seats of the party
    m.point("spawn", 10, 9)
    m.point("door", 19, 10, 2, 1)
    m.point("tv", 2, 3, 4, 3)                           # the TV stamp: the screen is 96 x 54 px at (16, 6) inside it
    m.point("bed", 9, 4, 3, 4)                          # the sofa bed stamp: backrest on top, mattress, foot with the folded legs
    m.point("seat_bed_l", 9, 5)                         # head of the bed, left and right of the middle seam
    m.point("seat_bed_r", 10, 5)
    m.point("seat_bed_foot", 10, 7)                     # the foot of the bed
    m.point("seat_chair_l", 8, 8)                       # the white chair at the left of the foot
    m.point("seat_chair_r", 12, 6)                      # the white chair at the right of the bed
    m.point("seat_pouf", 6, 7)                          # the pink pouf, in front of the TV
    m.point("seat_floor", 4, 9)                         # on the floor in front of the TV
    m.point("seat_cat", 12, 9)                          # the cat curls up near the slippers

    # lights, in pixels: the TV is the main one, then the fairy lights, the standing lamp, the tree
    tvx, tvy = 2 * T + 64, 3 * T + 34
    m.light(tvx, tvy, "#b48cff", 30, "pulse", 1500, pool=150, power=.85)
    m.light(tvx - 8, tvy + 40, "#ff8ad0", 0, "steady", 0, pool=110, power=.5)
    m.light(5 * T, 8 * T, "#8aa8ff", 0, "steady", 0, pool=130, power=.35)                   # the blue wash of the screen on the rug
    m.light(10 * T + 16, 6 * T, "#9ab0ff", 0, "steady", 0, pool=120, power=.45)             # and on the bed
    for k, (lx, ly) in enumerate(((20, 28), (60, 36), (100, 48), (150, 48), (182, 68))):   # the fairy lights on the stairs
        m.light(T + lx, T + ly, "#ffd890", 9, "flicker", 1600 + 230 * k, pool=44, power=.5)
    m.light(6 * T + 16, 4 * T + 34, "#ffe9c0", 14, "flicker", 2100, pool=54, power=.5)      # the white tree
    m.light(7 * T + 20, 3 * T + 12, "#ffe2a0", 22, "steady", 0, pool=100, power=.65)        # the standing lamp, low
    m.light(7 * T + 9, 3 * T + 34, "#ffe2a0", 14, "steady", 0, pool=50, power=.4)
    for lx in (50, 120):                                                                    # the strip under the kitchen cabinets
        m.light(15 * T + lx, T + 80, "#ffe6a8", 0, "steady", 0, pool=60, power=.4)
    m.light(16 * T + 10, 7 * T + 16, "#ffb060", 14, "flicker", 1500, pool=70, power=.5)     # the last candle on the dinner table
    return m
