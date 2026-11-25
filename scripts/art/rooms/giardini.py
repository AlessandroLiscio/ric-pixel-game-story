"""The Giardini Margherita, 26 x 16 tiles, rebuilt from the four reference photos (see docs/tiles.md, "Photo feature -> map").

Bright afternoon, no mood. A wide lawn under big old trees with dappled shade. The grey road (Viale Bottonelli) runs along the front
behind a concrete curb, with a red-brown graffiti bench on a patch of brick pavers at the left; a gravel footpath climbs from the road to
a gate in the wooden fence at the back right, toward the pond. The slackline is strapped between two trunks across the middle, the orange
towel lies spread open below it, a few people sit around with bikes and rucksacks on the grass. Ric comes in on the road from the left
and leaves along it to the right.
"""
import random

from mapkit import Map

W, H = 26, 16
PATH_X = (20, 21)          # the gravel footpath, columns
LINE_Y = 8                 # the row of the slackline and of the two trunks
TREE_L, TREE_R = 3, 17     # trunk columns of the slackline trees


def build():
    m = Map("giardini", W, H)
    rnd = random.Random(31)

    # ground: lawn everywhere, then the front strip (curb row 13, road rows 14 and 15), the footpath and the brick pavers
    kinds = ["giardini_grass_a"] * 7 + ["giardini_grass_b"] * 6 + ["giardini_grass_c"] * 4 + ["giardini_grass_tuft"] * 4 \
        + ["giardini_grass_daisy"] * 2 + ["giardini_grass_dry"]
    m.fill("ground", 0, 0, W - 1, H - 1, kinds, rnd)
    for (x, y) in ((5, 7), (10, 6), (24, 9), (13, 13), (16, 5), (8, 12)):          # bare earth, where the grass is worn
        m.put("ground", x, y, "giardini_grass_bare")
    for x in range(W):
        m.put("ground", x, 13, "giardini_curb_brick" if x <= 4 else "giardini_curb")
        m.put("ground", x, 14, "giardini_road_drain" if x == 9 else "giardini_road_top")
        m.put("ground", x, 15, "giardini_road_repair" if x in (4, 16) else rnd.choice(["giardini_road_a", "giardini_road_a", "giardini_road_b"]))
    m.put("ground", PATH_X[0], 13, "giardini_pathdip_l")
    m.put("ground", PATH_X[1], 13, "giardini_pathdip_r")
    path = {(x, y) for x in PATH_X for y in range(4, 14)}
    for (x, y) in path:
        if y == 13:
            continue                      # the dropped curb tile above
        edges = "".join(e for e, (dx, dy) in zip("NESW", ((0, -1), (1, 0), (0, 1), (-1, 0))) if (x + dx, y + dy) not in path and y + dy > 3)
        m.put("ground", x, y, "giardini_path_" + (edges or "c"))
    pave = {(x, y) for x in range(0, 5) for y in range(11, 13)}
    for (x, y) in pave:
        edges = "".join(e for e, (dx, dy) in zip("NESW", ((0, -1), (1, 0), (0, 1), (-1, 0)))
                        if (x + dx, y + dy) not in pave and 0 <= x + dx and y + dy < 13)
        m.put("ground", x, y, "giardini_brick_" + (edges or "c"))

    # the back of the park: sky, trees, villa, pond, the back path and the fence, one picture over rows 0 to 3
    m.stamp("giardini_backdrop", 0, 0)
    m.block(0, 0, W - 1, 3)

    # shade on the lawn, falling to the lower right of the trees (below layer, translucent)
    m.stamp("giardini_shade_a", 1, 6)
    m.stamp("giardini_shade_b", 14, 6)
    m.stamp("giardini_shade_c", 20, 4)
    m.stamp("giardini_shade_d", 8, 3)

    # the slackline between the two trunks, the coil of webbing at the left one, the orange towel below it
    m.stamp("giardini_line", TREE_L, LINE_Y)
    m.stamp("giardini_webbing", 2, LINE_Y + 1)
    m.stamp("giardini_towel", 9, 9)
    m.stamp("giardini_tarp", 11, 5)
    m.stamp("giardini_bike_a", 14, 6)
    m.stamp("giardini_bike_b", 6, 12)
    m.stamp("giardini_gear_a", 8, 10)
    m.stamp("giardini_gear_b", 14, 10)
    m.stamp("giardini_gear_c", 24, 11)
    m.stamp("giardini_scooter", 24, 7)

    # trees: the two slackline trunks, a big plane tree at the back right, slender ones further back, a sapling with its stake
    m.stamp("giardini_tree_slack_l", TREE_L - 1, LINE_Y - 3)
    m.stamp("giardini_tree_slack_r", TREE_R - 1, LINE_Y - 3)
    m.stamp("giardini_tree_plane", 21, 3)
    m.stamp("giardini_tree_young_a", 9, 2)
    m.stamp("giardini_tree_young_b", 13, 3)
    m.stamp("giardini_sapling", 6, 10)

    # park furniture: the graffiti bench on the pavers, a wooden bench by the path, lamps, the litter bin
    m.stamp("giardini_bench_graffiti", 2, 12)
    m.stamp("giardini_bench_wood", 18, 11)
    m.stamp("giardini_bench_wood", 7, 5)
    m.stamp("giardini_lamp", 6, 4)
    m.stamp("giardini_lamp", 19, 4)
    m.stamp("giardini_bin", 11, 12)
    m.stamp("giardini_dog", 22, 11)

    # named points, in tiles
    m.point("spawn", 1, 14)
    m.point("door", 24, 14, 2, 2)
    m.point("liscio", 6, 9)
    m.point("dogwalker", 21, 11)
    m.point("rosanna", 16, 10)  # Rosanna, the Erasmus-trip organiser (an extra), on the grass above the path

    # a few people on the grass
    for (n, x, y, face, per) in [(5, 4, 10, "up", 2600), (9, 13, 12, "right", 2900), (12, 14, 12, "left", 2400),
                                 (16, 23, 13, "left", 2700), (3, 5, 13, "up", 3000), (7, 16, 9, "left", 2500)]:
        m.person("crowd-%d" % n, x, y, face, per)
    return m
