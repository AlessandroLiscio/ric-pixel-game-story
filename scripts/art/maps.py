#!/usr/bin/env python3
"""Map builder: draws the room maps from small Python descriptions and writes src/data/maps/<sceneId>.json.

Usage: python -I scripts/art/maps.py [--render PATH]   (run scripts/art/tiles.py first: it writes tiles.json and the sheet)
A map is layers of tile indexes (ground, walls, below, objects, above), a collision grid derived from the solid tiles, and
named points in tile units. Stamps from tiles.json (furniture, signs, stairs ...) are placed by name. See docs/tiles.md.
--render writes a PNG of the finished room with the characters pasted in, as a review aid.
"""
import argparse
import json
import random
import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
TILES = json.loads((ROOT / "public/assets/tiles/tiles.json").read_text(encoding="utf-8"))
SHEET = Image.open(ROOT / "public/assets/tiles/tileset.png").convert("RGBA")
T = TILES["tileSize"]
COLS = TILES["columns"]
SOLID = set(TILES["solid"])
LAYERS = ["ground", "walls", "below", "objects", "above"]


class Map:
    def __init__(self, map_id, w, h):
        self.id, self.w, self.h = map_id, w, h
        self.layers = {k: [[0] * w for _ in range(h)] for k in LAYERS}
        self.names = {k: [[None] * w for _ in range(h)] for k in LAYERS}
        self.block = [[0] * w for _ in range(h)]  # extra blocked cells (not drawn)
        self.points = {}
        self.lights = []
        self.crowd = []

    # -- drawing
    def put(self, layer, x, y, name):
        if not (0 <= x < self.w and 0 <= y < self.h):
            raise ValueError("%s: %s at %d,%d is outside the map" % (self.id, name, x, y))
        self.layers[layer][y][x] = TILES["tiles"][name]
        self.names[layer][y][x] = name

    def fill(self, layer, x0, y0, x1, y1, names, rnd=None):
        """Fill the inclusive rectangle with one tile name or a list picked at random (seeded)."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(layer, x, y, rnd.choice(names) if (rnd and isinstance(names, list)) else (names[0] if isinstance(names, list) else names))

    def stamp(self, name, x, y):
        st = TILES["stamps"][name]
        for cy, row in enumerate(st["cells"]):
            for cx, tname in enumerate(row):
                if not tname:
                    continue
                layer = st["layer"]
                if layer == "above":
                    self.put("above", x + cx, y + cy, tname)
                elif layer == "objects" and cy < st["aboveRows"]:
                    self.put("above", x + cx, y + cy, tname)
                else:
                    self.put(layer, x + cx, y + cy, tname)

    def point(self, name, x, y, w=None, h=None):
        self.points[name] = {"x": x, "y": y} if w is None else {"x": x, "y": y, "w": w, "h": h}

    def light(self, px, py, color, r, kind="steady", period=0):
        self.lights.append({"x": px, "y": py, "color": color, "r": r, "kind": kind, "period": period})

    # -- derived data
    def collision(self):
        grid = [[0] * self.w for _ in range(self.h)]
        for y in range(self.h):
            for x in range(self.w):
                if self.block[y][x]:
                    grid[y][x] = 1
                for layer in ("walls", "objects"):
                    n = self.names[layer][y][x]
                    if n and n in SOLID:
                        grid[y][x] = 1
        return grid

    def reachable(self, start, grid=None):
        grid = grid or self.collision()
        seen = {start}
        q = deque([start])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < self.w and 0 <= ny < self.h and (nx, ny) not in seen and not grid[ny][nx]:
                    seen.add((nx, ny))
                    q.append((nx, ny))
        return seen

    def to_json(self):
        grid = self.collision()
        lines = ['{', ' "id": "%s", "tileSize": %d, "width": %d, "height": %d,' % (self.id, T, self.w, self.h), ' "layers": {']
        for i, k in enumerate(LAYERS):
            rows = ",\n".join("  [" + ",".join(str(v) for v in row) + "]" for row in self.layers[k])
            lines.append('  "%s": [\n%s\n  ]%s' % (k, rows, "," if i < len(LAYERS) - 1 else ""))
        lines.append(' },')
        rows = ",\n".join("  [" + ",".join(str(v) for v in row) + "]" for row in grid)
        lines.append(' "collision": [\n%s\n ],' % rows)
        lines.append(' "points": ' + json.dumps(self.points, separators=(",", ":")) + ",")
        lines.append(' "lights": ' + json.dumps(self.lights, separators=(",", ":")) + ",")
        lines.append(' "crowd": ' + json.dumps(self.crowd, separators=(",", ":")))
        lines.append('}')
        return "\n".join(lines) + "\n"

    # -- review render
    def render(self, path, sprites=()):
        W, H = self.w * T, self.h * T
        im = Image.new("RGBA", (W, H), (20, 14, 20, 255))
        tiles = {}

        def tile(i):
            if i not in tiles:
                tiles[i] = SHEET.crop(((i % COLS) * T, (i // COLS) * T, (i % COLS) * T + T, (i // COLS) * T + T))
            return tiles[i]

        for layer in ("ground", "walls", "below"):
            for y in range(self.h):
                for x in range(self.w):
                    if self.layers[layer][y][x]:
                        im.alpha_composite(tile(self.layers[layer][y][x]), (x * T, y * T))
        items = []
        for y in range(self.h):
            for x in range(self.w):
                if self.layers["objects"][y][x]:
                    items.append(((y + 1) * T, tile(self.layers["objects"][y][x]), x * T, y * T))
        for (feet_y, img, px, py) in sprites:
            items.append((feet_y, img, px, py))
        items.sort(key=lambda t: t[0])
        for _, img, px, py in items:
            im.alpha_composite(img, (px, py))
        for y in range(self.h):
            for x in range(self.w):
                if self.layers["above"][y][x]:
                    im.alpha_composite(tile(self.layers["above"][y][x]), (x * T, y * T))
        im.convert("RGB").save(path)


def sprite(person, tx, ty, tint=None, frame=1):
    folder = "tiles" if person.startswith("crowd-") else "characters"
    sheet = Image.open(ROOT / ("public/assets/%s/%s.png" % (folder, person))).convert("RGBA")
    fr = sheet.crop((frame * 32, 0, frame * 32 + 32, 32))
    if tint:
        r, g, b = (int(tint[i:i + 2], 16) for i in (1, 3, 5))
        px = fr.load()
        for y in range(32):
            for x in range(32):
                p = px[x, y]
                px[x, y] = (p[0] * r // 255, p[1] * g // 255, p[2] * b // 255, p[3])
    px_, py_ = tx * T + 16 - 16, ty * T + 28 - 32
    return (ty * T + 28, fr, px_, py_)


# ---------------------------------------------------------------- Cortile Cafe

def cortile():
    m = Map("cortile", 30, 18)
    rnd = random.Random(5)
    W, H = m.w, m.h
    # ground: cobbles everywhere, a wooden dance floor in front of the stage, checker behind the bar
    m.fill("ground", 1, 4, 28, 16, ["cobble_a", "cobble_a", "cobble_a", "cobble_b", "cobble_c", "cobble_d"], rnd)
    m.fill("ground", 9, 7, 24, 11, ["floor_wood_a", "floor_wood_b", "floor_wood_c"], rnd)
    m.fill("ground", 1, 4, 9, 4, "floor_checker")
    m.fill("ground", 12, 4, 21, 5, ["floor_stage_a", "floor_stage_b"], rnd)
    for y in (4, 5):
        m.put("ground", 11, y, "stage_top_l")
        m.put("ground", 22, y, "stage_top_r")
    # walls: cap ring (lips on the sides that face the room), warm back wall three tiles tall
    caps = {(x, y) for x in range(W) for y in range(H) if x in (0, W - 1) or y in (0, H - 1)}
    caps.discard((3, 17))
    caps.discard((4, 17))
    for (x, y) in caps:
        edges = "".join(e for e, (dx, dy) in zip("NESW", ((0, -1), (1, 0), (0, 1), (-1, 0)))
                        if 0 <= x + dx < W and 0 <= y + dy < H and (x + dx, y + dy) not in caps)
        m.put("walls", x, y, "cap_" + (edges or "none"))
    for x in range(1, W - 1):
        m.put("walls", x, 1, "plaster_warm_up")
        m.put("walls", x, 2, "plaster_warm_mid")
        m.put("walls", x, 3, "plaster_warm_dn")
    m.stamp("entrance_gap", 3, 17)
    m.stamp("doormat", 3, 16)
    # stage front with steps in the middle, soft shadow on the floor below it
    m.put("walls", 11, 6, "stage_front_l")
    for x in range(12, 22):
        m.put("walls", x, 6, "stage_front_m")
    m.put("walls", 22, 6, "stage_front_r")
    m.stamp("stage_steps", 16, 6)
    for x in range(11, 23):
        m.put("below", x, 7, "shade_top")
    # wall features, from the photos: mezzanine over the bar, painted logo wall, staircase, truss, TVs and signs
    m.stamp("mezz_front_9", 1, 1)
    m.stamp("bottle_nook_9", 1, 3)
    m.stamp("round_sign", 10, 1)
    m.stamp("chalkboard", 10, 2)
    m.stamp("logo_wall_12", 11, 1)
    m.stamp("truss_10", 12, 1)
    m.stamp("stairs_up_4", 23, 1)
    m.stamp("mezz_front_2", 27, 1)
    m.stamp("sconce", 27, 3)
    m.stamp("sconce", 10, 3)
    # bar
    m.stamp("bar_counter_7", 1, 5)
    for x in (2, 4, 6):
        m.stamp("bar_stool", x, 6)
    m.stamp("plant_small", 9, 5)
    # stage gear
    m.stamp("speaker_stack", 12, 3)
    m.stamp("speaker_stack", 21, 3)
    m.stamp("drum_kit", 14, 4)
    m.stamp("amp", 17, 4)
    m.stamp("amp", 18, 4)
    m.stamp("guitar_stand", 19, 4)
    m.stamp("bass_stand", 20, 4)
    m.stamp("monitor_wedge", 13, 5)
    m.stamp("mic_stand", 16, 5)
    m.stamp("mic_stand", 19, 5)
    m.stamp("monitor_wedge", 21, 5)
    # rugs under the table groups, then tables and chairs
    m.stamp("rug_blue", 2, 12)
    m.stamp("rug_red", 25, 12)
    m.stamp("rug_blue", 10, 13)
    m.stamp("rug_red", 18, 13)
    for (tx, ty, kind) in ((3, 10, "table_round"), (3, 13, "table_round"), (25, 9, "table_round_red"), (26, 13, "table_round_red"),
                           (11, 14, "table_round"), (19, 14, "table_round_red")):
        m.stamp(kind, tx, ty)
        m.stamp("chair_e", tx - 1, ty)
        m.stamp("chair_w", tx + 1, ty)
    m.stamp("chair_n", 3, 14)
    m.stamp("chair_s", 25, 8)
    # corners
    m.stamp("plant_flowers", 28, 4)
    m.stamp("plant_big", 1, 15)
    m.stamp("plant_big", 28, 15)
    m.stamp("plant_flowers", 8, 15)
    m.stamp("plant_big", 22, 15)
    m.stamp("barrel", 2, 16)
    m.stamp("crate_bottles", 27, 16)
    m.stamp("crate", 26, 16)
    # chandeliers hang above everyone
    m.stamp("chandelier", 20, 9)
    m.stamp("chandelier", 7, 9)
    # points (tiles): Ric enters at the street door and walks up to the stage, Lara waits in front of the steps
    m.point("spawn", 4, 15)
    m.point("door", 3, 17, 2, 1)
    m.point("lara", 17, 8)
    m.point("barista", 4, 4)
    # light spots in pixels: [mezzanine pendant lamps], stage spots, sconces, TV, chandeliers
    for k in range(5):
        m.light(1 * T + 24 + 56 * k, 1 * T + 53, "#ffcf72", 26, "flicker", 1700 + 230 * k)
    for k, tone in enumerate(["#ff59d6", "#ffd27a", "#59a0ff", "#ff9a5a", "#ffffff"]):
        m.light(12 * T + int((k + .5) * 10 * T / 5), 1 * T + 28, tone, 34, "pulse", 900 + 140 * k)
    m.light(27 * T + 16, 3 * T + 13, "#ffd27a", 26, "flicker", 2100)
    m.light(10 * T + 16, 3 * T + 13, "#ffd27a", 26, "flicker", 1900)
    m.light(11 * T + 16, 3 * T + 14, "#59a0ff", 22, "steady")
    for (cx, cy) in ((20 * T + 32, 9 * T + 52), (7 * T + 32, 9 * T + 52)):
        m.light(cx, cy, "#ffcf72", 46, "flicker", 2400)
    m.light(4 * T + 16, 17 * T + 18, "#ffcf72", 34, "steady")
    # crowd: idle people standing in front of the stage (sprite, tint, facing, bob period in ms)
    crowd = [(13, 8, 1, "up", 2300), (15, 9, 5, "up", 2700), (19, 8, 2, "up", 2500),
             (21, 10, 6, "up", 3000), (12, 10, 3, "up", 2200), (16, 11, 7, "up", 2900),
             (23, 8, 4, "left", 2600), (10, 8, 8, "right", 2800), (14, 13, 2, "up", 2400),
             (19, 12, 5, "up", 3100), (8, 12, 1, "right", 2500), (22, 13, 7, "left", 2700)]
    for (x, y, n, face, per) in crowd:
        m.crowd.append({"sheet": "crowd-%d" % n, "x": x, "y": y, "facing": face, "bob": per})
    return m


MAPS = {"cortile": cortile}


def preview_sprites(m):
    out = [sprite("ric", m.points["spawn"]["x"], m.points["spawn"]["y"], frame=1),
           sprite("lara", m.points["lara"]["x"], m.points["lara"]["y"]),
           sprite("sconosciuta", m.points["barista"]["x"], m.points["barista"]["y"])]
    for c in m.crowd:
        out.append(sprite(c["sheet"], c["x"], c["y"]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--render", help="write a PNG of each finished room (a review aid): PATH gets the map id appended")
    args = ap.parse_args()
    outdir = ROOT / "src" / "data" / "maps"
    outdir.mkdir(parents=True, exist_ok=True)
    problems = []
    for mid, fn in MAPS.items():
        m = fn()
        grid = m.collision()
        spawn = (m.points["spawn"]["x"], m.points["spawn"]["y"])
        if grid[spawn[1]][spawn[0]]:
            problems.append("%s: spawn is blocked" % mid)
        seen = m.reachable(spawn, grid)
        d = m.points["door"]
        if not any((x, y) in seen for x in range(d["x"], d["x"] + d["w"]) for y in range(d["y"], d["y"] + d["h"])):
            problems.append("%s: door is not reachable from spawn" % mid)
        (outdir / (mid + ".json")).write_text(m.to_json(), encoding="utf-8")
        if args.render:
            m.render(args.render.replace(".png", "_%s.png" % mid) if args.render.endswith(".png") else args.render, preview_sprites(m))
    if problems:
        print("FAIL maps: " + "; ".join(problems))
        sys.exit(1)
    print("PASS maps: %d map(s) written" % len(MAPS))


if __name__ == "__main__":
    main()
