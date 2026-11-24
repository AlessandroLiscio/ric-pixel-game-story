"""Furniture and scenery for the other five rooms (home, university, park): drawn now so the tileset is complete, placed in the
maps later. Same look as tiles_objects.py: outline, 3 tones per material, light from the top left."""
from tilepaint import BLUE, BRICK, CREAM, GOLD, GREEN, METAL, RED, STONE, WOOD, Canvas, T, hx, mix, rng
from tiles_objects import leaf


def sofa(n, body, name):
    W = n * T
    c = Canvas(W, T)
    c.shadow(W / 2, 30, W / 2 - 1, 2.2, 60)
    c.rect(2, 20, 4, 29, WOOD[1])  # feet
    c.rect(W - 5, 20, W - 3, 29, WOOD[1])
    c.rect(4, 3, W - 5, 15, body[1])  # back
    c.hline(4, W - 5, 3, body[3])
    c.hline(4, W - 5, 4, mix(body[2], "#ffffff", .15))
    c.hline(4, W - 5, 15, body[0])
    for x in range(4 + 12, W - 6, 12):
        c.vline(x, 5, 14, body[0])
        c.vline(x + 1, 5, 14, body[2])
    c.rect(1, 9, 7, 28, body[2])  # arms
    c.rect(W - 8, 9, W - 2, 28, body[2])
    for ax in (1, W - 8):
        c.hline(ax, ax + 6, 9, body[3])
        c.vline(ax, 9, 28, body[3])
        c.vline(ax + 6, 11, 28, body[0])
        c.hline(ax, ax + 6, 28, body[0])
    c.rect(8, 15, W - 9, 27, body[2])  # seat cushions
    seg = max(1, (W - 16) // 24)
    for i in range(seg):
        x0 = 8 + i * (W - 16) // seg
        x1 = 8 + (i + 1) * (W - 16) // seg - 1
        c.rect(x0, 15, x1, 26, body[2])
        c.hline(x0, x1, 15, body[3])
        c.vline(x0, 15, 27, body[3])
        c.vline(x1, 16, 27, body[0])
        c.hline(x0, x1, 27, body[0])
    c.rect(1, 29, W - 2, 29, body[0])
    c.noise(8, 16, W - 9, 26, [body[1], body[3]], .05, rng(name))
    c.outline()
    return c


def coffee_table(n=2):
    W = n * T
    c = Canvas(W, T)
    c.shadow(W / 2, 29, W / 2 - 3, 2.2, 60)
    for x in (5, W - 8):
        c.rect(x, 18, x + 2, 28, WOOD[1])
    c.rect(2, 9, W - 3, 18, WOOD[3])
    c.hline(2, W - 3, 9, WOOD[4])
    c.hline(2, W - 3, 17, WOOD[2])
    c.hline(2, W - 3, 18, WOOD[0])
    c.rect(2, 19, W - 3, 21, WOOD[1])
    c.hline(2, W - 3, 19, WOOD[0])
    c.rect(9, 5, 12, 10, "#f4f1ea")  # mug
    c.hline(9, 12, 5, "#c8423f")
    c.rect(W - 22, 11, W - 11, 13, "#c8423f")  # a magazine
    c.hline(W - 22, W - 11, 11, "#ffffff")
    c.outline()
    return c


def tv_unit(n=2):
    W = n * T
    c = Canvas(W, T)
    c.shadow(W / 2, 30, W / 2 - 1, 2.2, 60)
    c.rect(2, 19, W - 3, 29, WOOD[2])
    c.hline(2, W - 3, 19, WOOD[4])
    c.hline(2, W - 3, 29, WOOD[0])
    for i in range(n):
        c.rect(i * T + 5, 22, i * T + 27, 27, WOOD[1])
        c.hline(i * T + 5, i * T + 27, 22, WOOD[0])
        c.rect(i * T + 14, 24, i * T + 18, 25, GOLD[2])
    tv = (6, 1, W - 7, 18)
    c.rect(*tv, "#14141c")
    c.hline(tv[0], tv[2], tv[1], "#3a3a46")
    c.rect(tv[0] + 2, tv[1] + 2, tv[2] - 2, tv[3] - 2, "#1c2a48")
    c.vgrad(tv[0] + 2, tv[1] + 2, tv[2] - 2, tv[3] - 2, "#3a5a98", "#1a2a58")
    c.line(tv[0] + 4, tv[3] - 4, tv[0] + 12, tv[1] + 3, "#6a8ac8")
    c.set(tv[2] - 3, tv[3] - 1, "#58f058")
    c.rect(W // 2 - 3, 18, W // 2 + 2, 19, METAL[1])
    c.outline("#1c1418")
    return c


def bookshelf(n):
    W = n * T
    c = Canvas(W, 2 * T)
    c.shadow(W / 2, 62, W / 2 - 1, 2.2, 60)
    c.rect(1, 2, W - 2, 61, WOOD[2])
    c.rect(1, 2, W - 2, 4, WOOD[3])
    c.hline(1, W - 2, 2, WOOD[4])
    c.vline(1, 2, 61, WOOD[3])
    c.vline(W - 2, 5, 61, WOOD[1])
    r = rng("books%d" % n)
    tones = ["#c8423f", "#2f4aa0", "#3a7240", "#e8b83a", "#8c2a3a", "#f4f1ea", "#5a3a28", "#4f9a5d", "#a6aab3", "#e07a90"]
    for (y0, y1) in ((6, 21), (24, 39), (42, 58)):
        c.rect(4, y0, W - 5, y1, WOOD[0])
        x = 5
        while x < W - 8:
            bw = r.choice([2, 3, 3, 4])
            bh = r.randrange(y1 - y0 - 7, y1 - y0 - 1)
            tone = hx(r.choice(tones))
            c.rect(x, y1 - bh, x + bw - 1, y1, tone)
            c.vline(x, y1 - bh, y1, mix(tone, "#ffffff", .35))
            c.vline(x + bw - 1, y1 - bh, y1, mix(tone, "#000000", .3))
            c.set(x + 1, y1 - bh + 2, "#f4e8c0")
            x += bw + (1 if r.random() < .2 else 0)
        c.rect(1, y1 + 1, W - 2, y1 + 2, WOOD[3])
        c.hline(1, W - 2, y1 + 2, WOOD[1])
    c.outline()
    return c


def kitchen_counter(n):
    W = n * T
    c = Canvas(W, T)
    c.shadow(W / 2, 30, W / 2 - 1, 2.2, 60)
    c.rect(1, 3, W - 2, 12, "#e8eef0")  # stone worktop
    c.hline(1, W - 2, 3, "#ffffff")
    c.hline(1, W - 2, 11, "#a8b4bc")
    c.hline(1, W - 2, 12, "#6a7680")
    c.rect(1, 13, W - 2, 29, "#d8c8a8")  # cabinet doors
    for i in range(n):
        x0 = i * T + 3
        c.rect(x0, 15, x0 + 25, 27, "#e8d8b8")
        c.hline(x0, x0 + 25, 15, "#fbf0d8")
        c.vline(x0, 15, 27, "#fbf0d8")
        c.hline(x0, x0 + 25, 27, "#a89870")
        c.vline(x0 + 25, 15, 27, "#a89870")
        c.rect(x0 + 18, 19, x0 + 20, 22, METAL[3])
    c.rect(1, 29, W - 2, 29, "#7a6a50")
    # a sink at one third and a hob at two thirds
    sx = T + 4 if n >= 3 else 6
    c.rect(sx, 4, sx + 18, 9, METAL[2])
    c.rect(sx + 1, 5, sx + 17, 8, METAL[1])
    c.rect(sx + 8, 1, sx + 10, 4, METAL[4])
    if n >= 3:
        hx0 = 2 * T + 4
        c.rect(hx0, 4, hx0 + 22, 10, "#2a2a30")
        for cx in (hx0 + 6, hx0 + 16):
            c.ell(cx, 7, 4, 2.2, "#4a4a52")
            c.ell(cx, 7, 2, 1, "#c8423f")
    c.outline()
    return c


def fridge():
    c = Canvas(T, 2 * T)
    c.shadow(16, 62, 12, 2.4, 70)
    c.rect(4, 2, 27, 61, "#e8eef0")
    c.rect(4, 2, 27, 4, "#ffffff")
    c.vline(4, 2, 61, "#ffffff")
    c.vline(27, 4, 61, "#98a4ac")
    c.hline(4, 27, 61, "#6a7680")
    c.hline(5, 26, 22, "#98a4ac")  # door seam
    c.hline(5, 26, 23, "#ffffff")
    c.rect(22, 8, 24, 16, METAL[3])
    c.rect(22, 28, 24, 44, METAL[3])
    c.vline(22, 8, 16, METAL[4])
    c.vline(22, 28, 44, METAL[4])
    c.rect(8, 30, 11, 33, "#c8423f")  # magnets and a note
    c.rect(12, 36, 17, 41, "#f8f0c8")
    c.set(9, 36, "#2f4aa0")
    c.outline()
    return c


def lecture_bench(n):
    W = n * T
    c = Canvas(W, T)
    c.shadow(W / 2, 30, W / 2 - 1, 2.2, 60)
    c.rect(1, 6, W - 2, 15, WOOD[3])
    c.hline(1, W - 2, 6, WOOD[4])
    c.hline(1, W - 2, 14, WOOD[2])
    c.hline(1, W - 2, 15, WOOD[0])
    c.rect(1, 16, W - 2, 22, WOOD[1])
    for x in (3, W - 6):
        c.rect(x, 22, x + 2, 29, METAL[1])
    c.rect(8, 8, 17, 12, "#f4f1ea")  # paper
    c.hline(10, 15, 10, "#8aa6b8")
    c.rect(W - 18, 8, W - 10, 12, "#2f4aa0")
    c.outline()
    return c


def lectern():
    c = Canvas()
    c.shadow(16, 30, 12, 2.4, 70)
    c.rect(4, 6, 27, 14, WOOD[3])
    c.hline(4, 27, 6, WOOD[4])
    c.hline(4, 27, 13, WOOD[2])
    c.rect(5, 15, 26, 29, WOOD[1])
    c.hline(5, 26, 15, WOOD[0])
    c.rect(8, 18, 23, 26, WOOD[2])
    c.vline(8, 18, 26, WOOD[0])
    c.hline(8, 23, 26, WOOD[3])
    c.rect(10, 2, 21, 6, "#f4f1ea")  # an open book
    c.vline(15, 2, 6, "#98a4ac")
    c.outline()
    return c


def blackboard(n=4):
    W = n * T
    c = Canvas(W, 2 * T)
    c.rect(3, 4, W - 4, 54, WOOD[1])
    c.hline(3, W - 4, 4, WOOD[3])
    c.rect(6, 7, W - 7, 48, "#26382e")
    c.vgrad(6, 7, W - 7, 48, "#2c4236", "#22322a")
    r = rng("board")
    for k, y in enumerate(range(12, 44, 6)):  # chalk lines
        ln = r.randrange(24, W - 40)
        c.hline(12, 12 + ln, y, "#e8e8d8" if k % 2 else "#f4d8a0")
    c.rect(W - 32, 22, W - 18, 24, "#e8e8d8")
    c.rect(6, 50, W - 7, 54, WOOD[3])  # chalk tray
    c.hline(6, W - 7, 50, WOOD[4])
    c.rect(12, 49, 16, 50, "#f4f1ea")
    c.outline()
    return c


def tree():
    c = Canvas(2 * T, 3 * T)
    c.shadow(32, 94, 18, 3, 70)
    c.rect(27, 58, 37, 93, WOOD[1])  # trunk
    c.vline(27, 58, 93, WOOD[2])
    c.vline(36, 62, 93, WOOD[0])
    c.rect(24, 88, 40, 93, WOOD[1])
    c.vline(24, 88, 93, WOOD[2])
    c.line(31, 70, 20, 56, WOOD[1])
    c.line(33, 70, 44, 54, WOOD[1])
    blobs = ((32, 20, 20, 17), (14, 36, 14, 14), (50, 36, 14, 14), (22, 48, 15, 11), (42, 48, 15, 11), (32, 38, 18, 14))
    for (cx, cy, rx, ry) in blobs:
        c.ell(cx, cy, rx, ry, GREEN[0])
    for (cx, cy, rx, ry) in blobs:
        leaf(c, cx, cy, rx - 1, ry - 1)
    r = rng("tree")
    for _ in range(60):  # leaf dabs
        x, y = r.randrange(6, 58), r.randrange(6, 56)
        if c.get(x, y)[3] == 255:
            c.set(x, y, GREEN[4] if r.random() < .5 else GREEN[1])
    c.outline("#16301c")
    return c


def bush():
    c = Canvas()
    c.shadow(16, 29, 12, 2.4, 60)
    for (cx, cy, rx, ry) in ((10, 20, 9, 8), (22, 20, 9, 8), (16, 15, 10, 9)):
        c.ell(cx, cy, rx, ry, GREEN[0])
    for (cx, cy, rx, ry) in ((10, 20, 8, 7), (22, 20, 8, 7), (16, 15, 9, 8)):
        leaf(c, cx, cy, rx, ry)
    c.outline("#16301c")
    return c


def bench_park():
    c = Canvas(2 * T, T)
    c.shadow(32, 30, 28, 2.4, 60)
    for x in (6, 54):
        c.rect(x, 12, x + 3, 29, METAL[1])
    c.rect(4, 4, 59, 8, WOOD[3])  # back slats
    c.rect(4, 10, 59, 13, WOOD[3])
    for y in (4, 10):
        c.hline(4, 59, y, WOOD[4])
        c.hline(4, 59, y + (4 if y == 4 else 3), WOOD[1])
    c.rect(2, 17, 61, 22, WOOD[3])
    c.hline(2, 61, 17, WOOD[4])
    c.hline(2, 61, 22, WOOD[0])
    c.rect(2, 23, 61, 25, WOOD[1])
    c.outline()
    return c


def lamp_post():
    c = Canvas(T, 2 * T)
    c.shadow(16, 62, 8, 2.2, 60)
    c.rect(15, 18, 16, 60, METAL[1])
    c.vline(15, 18, 60, METAL[3])
    c.rect(12, 56, 19, 61, METAL[1])
    c.rect(12, 56, 19, 57, METAL[3])
    c.rect(10, 14, 21, 19, METAL[1])
    c.rect(11, 3, 20, 14, "#ffe9a8")  # lantern glass
    c.vgrad(11, 4, 20, 14, "#fff6d0", "#f0b050")
    c.vline(15, 3, 14, METAL[0])
    c.poly([(9, 3), (22, 3), (16, 0)], METAL[1])
    c.rect(9, 3, 22, 3, METAL[3])
    c.glow(16, 9, 20, "#ffd27a", 90)
    c.outline("#1c2236")
    return c


def fence():
    c = Canvas()
    c.shadow(16, 30, 15, 2, 55)
    c.rect(0, 12, T - 1, 14, WOOD[2])  # rails
    c.rect(0, 22, T - 1, 24, WOOD[2])
    c.hline(0, T - 1, 12, WOOD[4])
    c.hline(0, T - 1, 22, WOOD[4])
    for x in range(1, T, 8):
        c.rect(x, 8, x + 4, 29, WOOD[3])
        c.poly([(x, 8), (x + 4, 8), (x + 2, 5)], WOOD[3])
        c.vline(x, 8, 29, WOOD[4])
        c.vline(x + 4, 8, 29, WOOD[1])
        c.hline(x + 1, x + 3, 29, WOOD[0])
    c.outline()
    return c


def slackline_post():
    c = Canvas(T, 2 * T)
    c.shadow(16, 62, 10, 2.4, 70)
    c.rect(10, 6, 21, 61, WOOD[2])
    c.vline(10, 6, 61, WOOD[3])
    c.vline(21, 8, 61, WOOD[1])
    c.ell(16, 6, 6, 2.4, WOOD[4])
    for y in (30, 38):  # the tree protection and the strap
        c.rect(9, y, 22, y + 3, "#3a7a3a")
        c.hline(9, 22, y, "#5aa05a")
    c.rect(9, 44, 22, 47, "#e8b83a")
    c.hline(9, 22, 44, "#fbe07a")
    c.rect(13, 40, 18, 43, METAL[3])  # ratchet
    c.hline(13, 18, 40, METAL[4])
    c.rect(22, 44, 31, 46, "#e8b83a")  # the webbing running off to the right
    c.hline(22, 31, 44, "#fbe07a")
    c.outline()
    return c


def bed(body):
    c = Canvas(2 * T, 2 * T)
    c.shadow(32, 62, 28, 2.6, 60)
    c.rect(3, 4, 60, 12, WOOD[1])  # headboard
    c.hline(3, 60, 4, WOOD[3])
    c.rect(3, 12, 60, 60, body[2])  # blanket
    c.rect(3, 12, 60, 14, "#f4f1ea")
    c.hline(3, 60, 12, "#ffffff")
    for (x0, x1) in ((8, 28), (35, 55)):  # pillows
        c.rect(x0, 13, x1, 24, "#f4f1ea")
        c.hline(x0, x1, 13, "#ffffff")
        c.hline(x0, x1, 24, "#c8c4b8")
        c.vline(x1, 14, 24, "#d8d4c8")
    c.rect(3, 28, 60, 58, body[2])
    c.hline(3, 60, 28, body[3])
    c.rect(3, 28, 60, 31, body[3])
    c.hline(3, 60, 31, body[1])
    for x in range(6, 60, 8):
        c.vline(x, 34, 57, body[1])
    c.hline(3, 60, 58, body[0])
    c.rect(3, 59, 60, 61, WOOD[1])
    c.vline(3, 28, 58, body[3])
    c.vline(60, 28, 58, body[0])
    c.outline()
    return c


def define(reg):
    for n in (1, 2, 3):
        reg.stamp("sofa_red_%d" % n, sofa(n, RED, "sofared%d" % n), "objects")
        reg.stamp("sofa_blue_%d" % n, sofa(n, BLUE, "sofablue%d" % n), "objects")
    reg.stamp("coffee_table", coffee_table(2), "objects")
    reg.stamp("tv_unit", tv_unit(2), "objects")
    reg.stamp("bookshelf_2", bookshelf(2), "objects", mask=["##", "##"])
    reg.stamp("bookshelf_1", bookshelf(1), "objects", mask=["#", "#"])
    reg.stamp("kitchen_counter_2", kitchen_counter(2), "objects")
    reg.stamp("kitchen_counter_3", kitchen_counter(3), "objects")
    reg.stamp("fridge", fridge(), "objects", mask=["#", "#"])
    reg.stamp("lecture_bench_3", lecture_bench(3), "objects")
    reg.stamp("lectern", lectern(), "objects")
    reg.stamp("blackboard_4", blackboard(4), "below")
    reg.stamp("tree", tree(), "objects", above_rows=2, mask=["..", "..", "##"])
    reg.stamp("bush", bush(), "objects")
    reg.stamp("bench_park", bench_park(), "objects")
    reg.stamp("lamp_post", lamp_post(), "objects", mask=[".", "#"])
    reg.stamp("fence", fence(), "objects")
    reg.stamp("slackline_post", slackline_post(), "objects", mask=[".", "#"])
    reg.stamp("bed_blue", bed(BLUE), "objects", mask=["##", "##"])
    reg.stamp("bed_red", bed(RED), "objects", mask=["##", "##"])
