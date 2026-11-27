"""The Cortile Cafe, 22 x 18 tiles, laid out from the owner's floor plan and rebuilt from the three reference photos (see docs/tiles.md,
"Plan and photo feature -> map").

The stage is at the back (the band plays at floor level on a very low step in front of the logo wall) and the staircase climbs along
the right wall beside it. The bar is a long counter down the left side with two screens on it, the mezzanine over its back; a third
screen hangs on the front wall. Three big round tables stand against the right wall below the stairs, the crowd fills the middle
of the floor and the street door is in the front wall at the left of centre. Evening mood: dark with pools of warm and coloured light.
"""
import random

from mapkit import Map

T = 32
W, H = 22, 18


def build():
    m = Map("cortile", W, H)
    rnd = random.Random(5)
    m.mood("#8c7490")

    # ground: calm flagstones everywhere, the low band riser at the back from the pier to the stairs, the soft shadow under the walls
    m.fill("ground", 1, 5, 20, H - 2, ["stone_" + n for n in "abcdefgh"] * 3 + ["stone_crack", "stone_worn", "stone_pebble", "stone_dirty"], rnd)
    m.fill("ground", 9, 5, 17, 7, ["floor_stage_a", "floor_stage_b", "floor_stage_c"], rnd)
    for x in range(10, 18):
        m.put("ground", x, 7, "riser_front")
    m.put("ground", 9, 5, "riser_left")
    m.put("ground", 9, 6, "riser_left")
    m.put("ground", 9, 7, "riser_corner")
    for x in range(1, 21):
        m.put("below", x, 5, "shade_top")
    for x in range(9, 18):
        m.put("below", x, 8, "shade_top")
    for y in range(5, 8):
        m.put("below", 8, y, "shade_right")
    for y in range(5, 9):
        m.put("below", 17, y, "shade_right")
    for y in range(9, H - 1):
        m.put("below", 20, y, "shade_right")

    # caps: a ring around the hall, open at the street door
    caps = {(x, y) for x in range(W) for y in range(H) if x in (0, W - 1) or y in (0, H - 1)}
    caps.discard((10, H - 1))
    caps.discard((11, H - 1))
    for (x, y) in caps:
        edges = "".join(e for e, (dx, dy) in zip("NESW", ((0, -1), (1, 0), (0, 1), (-1, 0)))
                        if 0 <= x + dx < W and 0 <= y + dy < H and (x + dx, y + dy) not in caps)
        m.put("walls", x, y, "cap_" + (edges or "none"))
    m.stamp("cortile_entrance", 10, H - 1)
    m.stamp("doormat", 10, H - 2)
    m.stamp("cortile_tv_front", 16, H - 1)
    m.block(16, H - 1, 18, H - 1)

    # the back wall in three pictures, rows 1 to 4: the mezzanine over the back of the bar, the portraits, the logo wall of the stage
    m.stamp("cortile_wall_left", 1, 1)
    m.stamp("cortile_wall_mid", 8, 1)
    m.stamp("cortile_wall_right", 13, 1)
    m.block(1, 1, 20, 4)

    # the left wall: the mezzanine seen along it, then the back of the bar with its shelves
    for i, y in enumerate(range(5, 8)):
        m.stamp("cortile_mezz_side_" + "abc"[i], 1, y)
    m.stamp("cortile_mezz_side_end", 1, 8)
    for i, y in enumerate(range(9, H - 1)):
        m.stamp("cortile_backbar_" + "ab"[i % 2], 1, y)
    m.block(1, 5, 1, H - 2)

    # the bar: a counter down the left of the hall, open at both ends; the staff walk behind it, stools in front
    for y, kind in zip(range(8, 16), ("top", "glasses", "tv", "taps", "bottles", "tv", "glasses", "bot")):
        m.stamp("cortile_bar_side_" + kind, 7, y)
    for y in (10, 12, 14):
        m.stamp("bar_stool", 8, y)
    m.stamp("cortile_pillar", 8, 3)
    # behind the bar, under the mezzanine: two small tables for the staff and friends, a plant, crates and barrels against the walls
    m.stamp("table_round", 4, 13)          # a row below the barista (6, 11), so no chair crowds him
    m.stamp("chair_e", 3, 13)
    m.stamp("chair_w", 5, 13)
    m.stamp("table_round_red", 4, 8)
    m.stamp("chair_e", 3, 8)
    m.stamp("chair_w", 5, 8)
    m.stamp("plant_big", 2, 5)
    m.stamp("crate_bottles", 3, 5)
    m.stamp("barrel", 6, 5)
    m.stamp("barrel", 2, 16)
    m.stamp("barrel", 3, 16)
    m.stamp("crate", 2, 15)
    m.stamp("crate_bottles", 4, 16)

    # the band, at floor level on the low step: an amp at each end of the stage, drums in the middle under the logo, a guitar and a bass on stands
    for x in (11, 16):
        m.stamp("floor_cable", x, 6)
    m.stamp("drum_kit", 14, 5)
    m.stamp("amp", 10, 5)
    m.stamp("amp", 17, 5)    # the second speaker at the far end of the stage, away from the first (it hung over the stairs before)
    m.stamp("guitar_stand", 12, 6)
    m.stamp("bass_stand", 17, 6)
    m.stamp("monitor_wedge", 12, 7)
    m.stamp("monitor_wedge", 16, 7)
    m.stamp("mic_stand", 13, 7)
    m.stamp("mic_stand", 15, 7)

    # the staircase against the right wall, beside the stage, and three big round tables with their chairs below it
    m.stamp("cortile_stairs", 18, 5)
    for y in (9, 11, 13):                   # close together: rows 15 and 16 stay free for the talking group in the corner
        m.stamp("cortile_table_big", 19, y)
    for y in range(9, 15):
        m.stamp("chair_e", 18, y)

    # the chandelier hangs above everyone
    m.stamp("cortile_chandelier", 10, 9)

    # named points, in tiles
    m.point("spawn", 11, 15)
    m.point("door", 10, 17, 2, 1)
    m.point("lara", 12, 8)
    m.point("barista", 6, 11)
    # two Albanian lads wait at the bar: the top end of the counter, in the corridor above it
    m.point("albanese1", 5, 7)
    m.point("albanese2", 8, 7)
    m.point("losco", 8, 11)      # the hooded man, by the counter: far enough from Lara that his walk to her shows
    m.point("armando", 17, 12)   # Armando and Carolina, together at a big table on the right
    m.point("carolina", 16, 12)
    m.point("trig_bar", 9, 12, 5, 2)  # a few steps in from the door: crossing this zone sends Ros and Giusy to the bar (x, y, w, h in tiles)
    m.point("obj_bar", 7, 8, 1, 8)  # the counter: 1 tile wide, rows 8 to 15
    # the bottom right corner, where the two lads and the girls end up talking: one couple above the other, each face to face,
    # the girls on the open side so Ric can reach them
    for name, x, y in (("wall_ros", 19, 15), ("wall_albanese1", 20, 15), ("wall_giusy", 19, 16), ("wall_albanese2", 20, 16)):
        m.point(name, x, y)

    # lights, in pixels: pendant lamps under the beam, the pillar lamp, the TVs and the projector, the truss spots on the band, the
    # chandelier, the bar and its screens, the table candles, the street at the door
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
    m.light(11 * T, 10 * T + 10, "#ffcf72", 40, "flicker", 2400, pool=128, power=.85)
    for ty in (9, 11, 13):
        m.light(20 * T + 10, ty * T + 14, "#ffb060", 0, "steady", 0, pool=56, power=.5)     # the candle on each big table
    m.light(4 * T + 16, 13 * T + 6,"#ffb060", 0, "steady", 0, pool=56, power=.5)           # the candle at the staff table
    m.light(13 * T, 12 * T, "#ffc890", 0, "steady", 0, pool=110, power=.32)                 # the warm bounce of the hall
    m.light(7 * T + 16, 9 * T + 8, "#ffb060", 0, "steady", 0, pool=96, power=.6)            # the bar
    m.light(7 * T + 16, 13 * T, "#ffb060", 0, "steady", 0, pool=90, power=.55)
    m.light(7 * T + 18, 10 * T + 16, "#59a0ff", 0, "steady", 0, pool=56, power=.5)          # the two bar screens
    m.light(7 * T + 18, 13 * T + 16, "#59a0ff", 0, "steady", 0, pool=56, power=.5)
    m.light(17 * T, 16 * T + 8, "#59a0ff", 0, "steady", 0, pool=70, power=.42)              # the screen on the front wall
    m.light(11 * T, 17 * T + 22, "#ffcf72", 26, "steady", 0, pool=60, power=.8)
    m.light(11 * T, 16 * T + 6, "#8ab0ff", 0, "steady", 0, pool=70, power=.35)

    # the idle crowd, facing the stage (sheet, x, y, facing, bob period in ms): rows from the stage back, a few at the bar and by the
    # tables; the lane at x 12 and the rows 15 and 16 stay free from the door up to the friend
    for (n, x, y, face, per) in [
        (1, 10, 8, "up", 2300), (3, 14, 8, "up", 2500), (4, 15, 8, "up", 3000), (5, 16, 8, "up", 2200), (6, 17, 8, "up", 2900),
        (8, 9, 9, "up", 2800), (9, 11, 9, "up", 2400), (2, 13, 9, "up", 2600), (10, 15, 9, "up", 3100), (7, 17, 9, "right", 2600),
        (13, 10, 10, "up", 2300), (11, 14, 10, "up", 2700), (14, 16, 10, "up", 2800), (15, 17, 10, "right", 2400),
        (16, 9, 11, "left", 3000), (17, 11, 11, "up", 2600), (18, 14, 11, "up", 2900), (19, 17, 11, "right", 2500),
        (20, 15, 12, "up", 2800), (12, 9, 13, "left", 2500), (3, 11, 13, "up", 2700), (8, 14, 13, "up", 2400),
        (9, 16, 13, "up", 3000), (4, 10, 14, "up", 2600), (7, 15, 14, "right", 2900),
        (11, 3, 10, "right", 2700), (14, 3, 15, "up", 2500)]:  # the last two are behind the bar
        m.person("crowd-%d" % n, x, y, face, per)
    # a few who dance: the two arm poses swap on the beat
    for (n, x, y, face, per) in [(4, 13, 10, "up", 420), (6, 16, 11, "up", 460), (2, 10, 12, "up", 440)]:
        m.dancer("crowd-%d" % n, x, y, face, per)
    return m
