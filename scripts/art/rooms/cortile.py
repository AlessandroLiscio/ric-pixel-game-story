"""The Cortile Cafe, 22 x 14 tiles, rebuilt from the three reference photos (see docs/tiles.md, "Photo feature -> map").

A small crowded vaulted hall. The mezzanine runs over the bar on the back-left and down the left wall, the staircase climbs along the
white wall of the band corner at the back-right, the band plays at floor level on a very low step in front of the logo wall, the
crowd fills the floor in front of them, the street door is at the bottom left. Evening mood: dark with pools of warm and coloured light.
"""
import random

from mapkit import Map

T = 32
W, H = 22, 14


def build():
    m = Map("cortile", W, H)
    rnd = random.Random(5)
    m.mood("#8c7490")

    # ground: calm flagstones everywhere, the low band riser in the back-right corner, the soft shadow under the walls
    m.fill("ground", 1, 5, 20, 12, ["stone_" + n for n in "abcdefgh"] * 3 + ["stone_crack", "stone_worn", "stone_pebble", "stone_dirty"], rnd)
    m.fill("ground", 13, 5, 20, 7, ["floor_stage_a", "floor_stage_b", "floor_stage_c"], rnd)
    for x in range(14, 21):
        m.put("ground", x, 7, "riser_front")
    m.put("ground", 13, 5, "riser_left")
    m.put("ground", 13, 6, "riser_left")
    m.put("ground", 13, 7, "riser_corner")
    for x in range(1, 21):
        m.put("below", x, 5, "shade_top")
    for x in range(13, 21):
        m.put("below", x, 8, "shade_top")
    for y in range(5, 8):
        m.put("below", 12, y, "shade_right")
    for y in range(8, 13):
        m.put("below", 20, y, "shade_right")
    for y in range(10, 13):
        m.put("below", 1, y, "shade_left")

    # caps: a ring around the hall, open at the street door
    caps = {(x, y) for x in range(W) for y in range(H) if x in (0, W - 1) or y in (0, H - 1)}
    caps.discard((3, H - 1))
    caps.discard((4, H - 1))
    for (x, y) in caps:
        edges = "".join(e for e, (dx, dy) in zip("NESW", ((0, -1), (1, 0), (0, 1), (-1, 0)))
                        if 0 <= x + dx < W and 0 <= y + dy < H and (x + dx, y + dy) not in caps)
        m.put("walls", x, y, "cap_" + (edges or "none"))
    m.stamp("cortile_entrance", 3, H - 1)
    m.stamp("doormat", 3, H - 2)

    # the back wall in three pictures, rows 1 to 4, and the mezzanine strip down the left wall
    m.stamp("cortile_wall_left", 1, 1)
    m.stamp("cortile_wall_mid", 8, 1)
    m.stamp("cortile_wall_right", 13, 1)
    m.block(1, 1, 20, 4)
    for i, y in enumerate(range(5, 9)):
        m.stamp("cortile_mezz_side_" + "abc"[i % 3], 1, y)
    m.stamp("cortile_mezz_side_end", 1, 9)
    m.block(1, 5, 1, 9)

    # the bar under the mezzanine: counter and stools in front, the barista behind, the hatch at its right end
    m.stamp("bar_counter_5", 2, 6)
    m.stamp("bar_stool", 3, 7)
    m.stamp("bar_stool", 5, 7)
    m.stamp("cortile_pillar", 8, 3)

    # the band, at floor level on the low step: drums in the middle, amps against the right wall, a guitar and a bass on stands
    for x in (14, 17):
        m.stamp("floor_cable", x, 6)
    m.stamp("drum_kit", 15, 5)
    m.stamp("amp", 18, 5)
    m.stamp("amp", 19, 5)
    m.stamp("guitar_stand", 17, 6)
    m.stamp("bass_stand", 20, 6)
    m.stamp("monitor_wedge", 14, 7)
    m.stamp("monitor_wedge", 19, 7)
    m.stamp("mic_stand", 16, 7)
    m.stamp("mic_stand", 18, 7)
    m.block(20, 5, 20, 7)  # the corner behind the amps is not a place to walk

    # tables, chairs, crates and barrels
    m.stamp("table_round", 3, 9)
    m.stamp("chair_e", 2, 9)
    m.stamp("chair_w", 4, 9)
    m.stamp("barrel", 1, 12)
    m.stamp("crate", 2, 12)
    m.stamp("crate_bottles", 20, 12)
    m.stamp("barrel", 19, 12)

    # the chandelier hangs above everyone
    m.stamp("cortile_chandelier", 9, 6)

    # named points, in tiles
    m.point("spawn", 4, 11)
    m.point("door", 3, 13, 2, 1)
    m.point("lara", 12, 8)
    m.point("barista", 4, 5)

    # lights, in pixels: pendant lamps under the beam, the pillar lamp, the TVs and the projector, the truss spots on the band, the
    # chandelier, the bar, the street at the door
    for lx in (96, 142, 188):
        m.light(32 + lx, 32 + 82, "#ffcf72", 22, "flicker", 1700 + lx * 3, pool=70, power=.9)
    m.light(8 * T + 16, 3 * T + 36, "#ffd27a", 0, "steady", 0, pool=80, power=.7)
    m.light(8 * T + 36, 32 + 60, "#ffd27a", 20, "flicker", 2100, pool=72, power=.8)
    m.light(8 * T + 156, 32 + 56, "#ffd27a", 20, "flicker", 1900, pool=72, power=.8)
    m.light(8 * T + 21, 32 + 25, "#59a0ff", 20, "steady", 0, pool=50, power=.55)
    m.light(8 * T + 137, 32 + 25, "#59a0ff", 20, "steady", 0, pool=50, power=.55)
    m.light(8 * T + 79, 32 + 29, "#bfe0ff", 0, "steady", 0, pool=70, power=.4)
    for (lx, tone) in ((30, "#ff59d6"), (58, "#ffd27a"), (88, "#59a0ff"), (112, "#ff9a5a")):
        m.light(13 * T + lx, 32 + 84, tone, 12, "pulse", 900 + lx * 7, pool=0)
        m.light(13 * T + lx + 6, 6 * T + 12, tone, 0, "steady", 0, pool=78, power=.62)
    m.light(9 * T + 32, 6 * T + 42, "#ffcf72", 40, "flicker", 2400, pool=128, power=.85)
    m.light(3 * T + 16, 9 * T + 6, "#ffb060", 0, "steady", 0, pool=56, power=.5)       # the candle on the table
    m.light(10 * T, 11 * T, "#ffc890", 0, "steady", 0, pool=110, power=.32)              # the warm bounce of the hall
    m.light(4 * T + 16, 6 * T + 4, "#ffb060", 0, "steady", 0, pool=96, power=.6)
    m.light(4 * T, 13 * T + 22, "#ffcf72", 26, "steady", 0, pool=60, power=.8)
    m.light(4 * T, 12 * T + 6, "#8ab0ff", 0, "steady", 0, pool=70, power=.35)

    # the idle crowd, facing the band (sheet, x, y, facing, bob period in ms): front row, then the rows behind, a few at the bar
    for (n, x, y, face, per) in [
        (1, 10, 8, "up", 2300), (2, 11, 8, "up", 2700), (3, 13, 8, "up", 2500), (4, 14, 8, "up", 3000), (5, 16, 8, "up", 2200),
        (6, 17, 8, "up", 2900), (7, 19, 8, "up", 2600), (8, 9, 9, "up", 2800), (9, 11, 9, "up", 2400), (10, 15, 9, "up", 3100),
        (11, 17, 9, "up", 2700), (12, 19, 9, "right", 2500), (13, 10, 10, "up", 2300), (14, 14, 10, "up", 2700), (15, 18, 10, "up", 2400),
        (16, 9, 11, "right", 3000), (17, 11, 11, "up", 2600), (18, 15, 11, "up", 2900), (19, 17, 11, "left", 2500), (20, 19, 10, "up", 2800),
        (3, 6, 9, "up", 2600), (8, 7, 8, "right", 2900)]:
        m.person("crowd-%d" % n, x, y, face, per)
    # a few who dance: the two arm poses swap on the beat
    for (n, x, y, face, per) in [(4, 13, 9, "up", 420), (6, 16, 10, "up", 460), (2, 12, 11, "up", 440)]:
        m.dancer("crowd-%d" % n, x, y, face, per)
    return m
