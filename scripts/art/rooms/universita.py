"""The Cinema Bellinzona, 22 x 14 tiles, rebuilt from the two reference photos (see docs/tiles.md, "Photo feature -> map").

The front wall is at the top: grey flanks with round lights and loudspeakers, the recess with pleated curtains and the big white screen
(the lesson is projected on it) over a low stage where Prof. Pinolo stands. Under the stage a front aisle, then six rows of red velvet
seats in two blocks split by a centre aisle, full of people, with a side aisle along each long wall and a walkway along the back. Ric
comes in through the grey exit door of the left wall (front end) and walks right along the front aisle; Lollino sits in the first seat of
the front row, the exit is the matching door of the right wall.
"""
from mapkit import Map

W, H = 22, 14
SEATS = [(3, 9), (12, 18)]                  # first and last map column of each block of seats
FIRST_ROW, LAST_ROW = 6, 11


def build():
    m = Map("universita", W, H)
    m.mood("#b4b4cc")

    # the top and bottom walls are caps, the two long walls and the front wall are pictures
    caps = {(x, y) for x in range(W) for y in (0, H - 1)}
    for (x, y) in caps:
        edges = "".join(e for e, (dx, dy) in zip("NESW", ((0, -1), (1, 0), (0, 1), (-1, 0)))
                        if 0 <= x + dx < W and 0 <= y + dy < H and (x + dx, y + dy) not in caps)
        m.put("walls", x, y, "cap_" + (edges or "none"))

    m.stamp("universita_wall_front", 1, 1)
    m.stamp("universita_wall_left", 0, 1)
    m.stamp("universita_wall_right", W - 1, 1)
    m.block(1, 1, W - 2, 3)
    m.block(0, 1, 0, H - 2)
    m.block(W - 1, 1, W - 1, H - 2)

    m.stamp("universita_hall", 1, 4)
    for (x0, x1) in SEATS:                  # every seat stands up and blocks, except the one where Lollino sits
        m.block(x0, FIRST_ROW, x1, LAST_ROW)
    m.blocked[FIRST_ROW][3] = 0
    m.stamp("universita_seat_lollino", 3, FIRST_ROW)
    m.stamp("universita_bins", W - 2, H - 2)

    # Ric comes in through the left exit door and walks right along the front aisle: Lollino sits two tiles on, in the first seat of
    # the front row, Prof. Pinolo stands on the stage by the screen, the exit is the matching door of the right wall at the end of
    # the same aisle (the smoke test walks the room blind with the right arrow along that row)
    m.point("spawn", 1, 5)
    m.point("door", W - 2, 5, 1, 2)
    m.point("lollino", 3, FIRST_ROW)
    m.point("pinolo", 6, 4)
    # things the game can interact with, in tiles: the footprint of the object (x, y, w, h)
    m.point("obj_screen", 7, 1, 8, 3)       # the big screen on the front wall
    m.point("obj_seats", 12, FIRST_ROW, 7, 1)   # the front row of the right block of seats
    m.point("obj_notice", 1, 1, 1, 3)       # the pinned notice on the left flank of the front wall
    m.point("obj_speaker", 0, 9, 1, 1)      # the loudspeaker on the left wall
    m.point("obj_exitdoor", 0, 5, 1, 2)     # the side exit door of the left wall (the way out of the scene is the right one)
    m.point("obj_sleeper", 12, LAST_ROW, 1, 1)  # the student asleep in the sixth row, by the centre aisle

    # lights, in pixels: the glow of the screen, the round wall lights (two on each flank of the front wall, four on each long wall),
    # the green exit signs
    m.light(352, 79, "#dfe8ff", 0, "steady", 0, pool=200, power=.6)
    m.light(352, 79, "#cfe0ff", 34, "pulse", 3400, pool=0)
    for (x, y) in ((66, 70), (130, 70), (638, 70), (574, 70)):
        m.light(x, y, "#ffeec4", 0, "steady", 0, pool=64, power=.5)
    for row in (2, 8, 10, 12):
        for x in (16, W * 32 - 16):
            m.light(x, row * 32 + 16, "#ffeec4", 0, "steady", 0, pool=62, power=.45)
    for x in (16, W * 32 - 16):
        m.light(x, 4 * 32 + 16, "#7fe8c0", 10, "steady", 0, pool=40, power=.4)
    return m
