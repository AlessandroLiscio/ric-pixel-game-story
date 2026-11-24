"""The map toolkit every room module uses: `from mapkit import Map`. A Map is five layers of tile indexes (ground, walls, below,
objects, above), a collision grid derived from the solid tiles plus `block`, named points in tile units, lights, an optional night
mood, and the idle crowd. Written as src/data/maps/<sceneId>.json by maps.py; see docs/tiles.md.
"""
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

import lighting

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
LAYERS = ["ground", "walls", "below", "objects", "above"]
FACE_ROW = {"down": 0, "left": 1, "right": 2, "up": 3}

TILES = {}
SHEET = None
T = 32
COLS = 16
SOLID = set()


def load():
    """(Re)reads tiles.json and the sheet: tiles.py writes them, the map builder calls this right after."""
    global TILES, SHEET, T, COLS, SOLID
    TILES = json.loads((ROOT / "public/assets/tiles/tiles.json").read_text(encoding="utf-8"))
    SHEET = Image.open(ROOT / "public/assets/tiles/tileset.png").convert("RGBA")
    T = TILES["tileSize"]
    COLS = TILES["columns"]
    SOLID = set(TILES["solid"])


class Map:
    def __init__(self, map_id, w, h):
        if not TILES:
            load()
        self.id, self.w, self.h = map_id, w, h
        self.layers = {k: [[0] * w for _ in range(h)] for k in LAYERS}
        self.names = {k: [[None] * w for _ in range(h)] for k in LAYERS}
        self.blocked = [[0] * w for _ in range(h)]  # extra blocked cells (not drawn)
        self.points = {}
        self.lights = []
        self.crowd = []
        self.dancers = []
        self.ambient = None

    # -- drawing
    def put(self, layer, x, y, name):
        if not (0 <= x < self.w and 0 <= y < self.h):
            raise ValueError("%s: %s at %d,%d is outside the map" % (self.id, name, x, y))
        if name not in TILES["tiles"]:
            raise KeyError("%s: no tile or stamp cell named %s" % (self.id, name))
        self.layers[layer][y][x] = TILES["tiles"][name]
        self.names[layer][y][x] = name

    def fill(self, layer, x0, y0, x1, y1, names, rnd=None):
        """Fill the inclusive rectangle with one tile name or a list picked at random (seeded Random)."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(layer, x, y, rnd.choice(names) if (rnd and isinstance(names, list)) else (names[0] if isinstance(names, list) else names))

    def stamp(self, name, x, y):
        """Place a stamp by name, x and y being its top-left tile. Cells go to the layer the stamp says."""
        if name not in TILES["stamps"]:
            raise KeyError("%s: no stamp named %s" % (self.id, name))
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

    def block(self, x0, y0, x1=None, y1=None):
        """Mark the inclusive rectangle as not walkable without drawing anything (walls drawn from stamps, dancers)."""
        x1 = x0 if x1 is None else x1
        y1 = y0 if y1 is None else y1
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.blocked[y][x] = 1

    def point(self, name, x, y, w=None, h=None):
        self.points[name] = {"x": x, "y": y} if w is None else {"x": x, "y": y, "w": w, "h": h}

    def light(self, px, py, color, r, kind="steady", period=0, pool=None, power=1.0):
        """A light in pixels. `r` is the small additive glow (flicker or pulse by `kind`), `pool` the radius of the bright pool in the
        night overlay (default 2.4 x r, 0 for none), `power` how much of the colour the pool brings back (0..1)."""
        self.lights.append({"x": px, "y": py, "color": color, "r": r, "kind": kind, "period": period,
                            "pool": int(r * 2.4) if pool is None else pool, "power": power})

    def mood(self, ambient):
        """Turns the room into an evening room: everything is multiplied by this colour, lights bring pools of colour back."""
        self.ambient = ambient

    def person(self, sheet, x, y, facing="up", bob=2500):
        """An idle person who stands still and breathes in a slow bob (bob is the period in ms). Blocks Ric at run time."""
        self.crowd.append({"sheet": sheet, "x": x, "y": y, "facing": facing, "bob": bob})

    def dancer(self, sheet, x, y, facing="up", period=440):
        """A dancing person: the two arm poses of the crowd sheet (columns 0 and 2) swap every `period` ms with a small hop. Blocks."""
        self.dancers.append({"sheet": sheet, "x": x, "y": y, "facing": facing, "period": period})
        self.block(x, y)

    # -- derived data
    def collision(self):
        grid = [[0] * self.w for _ in range(self.h)]
        for y in range(self.h):
            for x in range(self.w):
                if self.blocked[y][x]:
                    grid[y][x] = 1
                for layer in ("walls", "objects"):
                    n = self.names[layer][y][x]
                    if n and n in SOLID:
                        grid[y][x] = 1
        return grid

    def reachable(self, start, grid=None, extra=()):
        """Flood fill over walkable tiles; `extra` is a set of (x, y) cells to treat as blocked (the idle crowd)."""
        grid = grid or self.collision()
        seen = {start}
        q = deque([start])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < self.w and 0 <= ny < self.h and (nx, ny) not in seen and not grid[ny][nx] and (nx, ny) not in extra:
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
        if self.ambient:
            lines.append(' "mood": ' + json.dumps({"ambient": self.ambient}, separators=(",", ":")) + ",")
        lines.append(' "dancers": ' + json.dumps(self.dancers, separators=(",", ":")) + ",")
        lines.append(' "crowd": ' + json.dumps(self.crowd, separators=(",", ":")))
        lines.append('}')
        return "\n".join(lines) + "\n"

    # -- review render
    def render(self, sprites=(), lit=True, glows=True):
        """The finished room as a PIL image, characters pasted in, the night mood applied when the room has one."""
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
        rgb = np.array(im.convert("RGB"))
        if lit and self.ambient:
            rgb = lighting.apply(rgb, {"ambient": self.ambient}, self.lights, glows)
        return Image.fromarray(rgb)


def shadow(tx, ty):
    """The ground shadow tileMap.ts puts under every character (three flat ellipses), as a Map.render entry just under its character."""
    from PIL import ImageDraw
    im = Image.new("RGBA", (24, 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for (rx, ry, a) in ((12, 4, 51), (9, 3, 56), (5.5, 2, 66)):
        for y in range(8):
            for x in range(24):
                if ((x + .5 - 12) / rx) ** 2 + ((y + .5 - 4) / ry) ** 2 <= 1:
                    p = im.getpixel((x, y))
                    # alpha-over, as the canvas does
                    pa = p[3] / 255
                    na = a / 255 + pa * (1 - a / 255)
                    im.putpixel((x, y), (22, 8, 34, int(na * 255)))
    return (ty * T + 28 - .5, im, tx * T + 16 - 12, ty * T + 28 - 1 - 4)


def sprite(person, tx, ty, facing="up", frame=1, dy=0):
    """A character or crowd sheet frame standing on tile (tx, ty), as (feet y, image, x, y) for Map.render."""
    folder = "tiles" if person.startswith("crowd-") else "characters"
    sheet = Image.open(ROOT / ("public/assets/%s/%s.png" % (folder, person))).convert("RGBA")
    row = FACE_ROW[facing]
    fr = sheet.crop((frame * 32, row * 32, frame * 32 + 32, row * 32 + 32))
    return (ty * T + 28, fr, tx * T + 16 - 16, ty * T + 28 - 32 + dy)
