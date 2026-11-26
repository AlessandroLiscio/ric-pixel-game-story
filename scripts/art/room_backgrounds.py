"""Renders public/assets/backgrounds/<scene>.png from the tile rooms, the way the game draws them (src/game/flow/tileMap.ts).

Reads only src/data/maps/*.json and public/assets/tiles/tileset.png. Per room: ground, walls, below, objects and above tiles, then the
night mood (an ambient colour multiplied over everything, the lights' pools of colour added back into it) and the steady glow of each
light. No people, no photo. The result is one native-scale 640x360 window of the room (no resampling, the pixels stay crisp), centred on
a focus point of the room. Output: one PASS line. Usage: python -I scripts/art/room_backgrounds.py [--out DIR]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
TILE = 32
W, H = 640, 360
# where the 640x360 window is centred, in tile units (x, y); None centres it on the room. The room the minigame is about shows its best part.
FOCUS = {
    'universita': (11, 5.5),  # the screen and the first rows of seats
    'giuggiu': None,
    'giardini': (10.5, 7.78125),  # the slackline (trunks at columns 3 and 17 of row 8) at screen y 205, the trunks at x 96 and 544: the slackline minigame walks it
    'circe': None,
    'cortile': (11, 9),
    'divano': None,
}
GLOW_ALPHA = {'steady': 0.55, 'flicker': 0.6, 'pulse': 0.4}  # the mean of the alpha tween each kind runs in the game


def hex_rgb(s):
    s = s.lstrip('#')
    return np.array([int(s[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def radial(w, h, cx, cy, radius, stops):
    """A (h, w) array of the gradient value at each pixel; stops = [(position 0..1, value)] linear in between, 0 past the radius."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2) / max(radius, 1e-6)
    pos, val = zip(*stops)
    return np.interp(d, pos, val, right=0.0).astype(np.float32)


def render(m, tileset):
    cols = tileset.width // TILE
    wpx, hpx = m['width'] * TILE, m['height'] * TILE
    canvas = Image.new('RGBA', (wpx, hpx), (0, 0, 0, 255))
    for layer in ('ground', 'walls', 'below', 'objects', 'above'):
        for y, row in enumerate(m['layers'][layer]):
            for x, idx in enumerate(row):
                if idx > 0:
                    sx, sy = (idx % cols) * TILE, (idx // cols) * TILE
                    canvas.alpha_composite(tileset.crop((sx, sy, sx + TILE, sy + TILE)), (x * TILE, y * TILE))
    img = np.asarray(canvas.convert('RGB'), dtype=np.float32)
    if m.get('mood'):
        mood = np.tile(hex_rgb(m['mood']['ambient']), (hpx, wpx, 1))
        for l in m['lights']:
            pool = l.get('pool', 0)
            if pool > 0:
                a = radial(wpx, hpx, l['x'], l['y'], pool, [(0, l.get('power', 1)), (0.4, 0.6 * l.get('power', 1)), (1, 0)])
                mood = np.minimum(mood + hex_rgb(l['color']) * a[..., None], 255)
        img = img * mood / 255
    for l in m['lights']:
        if l['r'] > 0:
            g = radial(wpx, hpx, l['x'], l['y'], l['r'], [(0, 1), (0.35, 0.45), (1, 0)]) * GLOW_ALPHA[l['kind']]
            img = np.minimum(img + hex_rgb(l['color']) * g[..., None], 255)
    return Image.fromarray(np.clip(img + 0.5, 0, 255).astype(np.uint8), 'RGB')


def window(img, focus):
    fx, fy = focus if focus else (img.width / TILE / 2, img.height / TILE / 2)
    x = int(min(max(fx * TILE - W / 2, 0), img.width - W))
    y = int(min(max(fy * TILE - H / 2, 0), img.height - H))
    return img.crop((x, y, x + W, y + H))


def main():
    out = Path(sys.argv[sys.argv.index('--out') + 1]) if '--out' in sys.argv else ROOT / 'public/assets/backgrounds'
    out.mkdir(parents=True, exist_ok=True)
    tileset = Image.open(ROOT / 'public/assets/tiles/tileset.png').convert('RGBA')
    n = 0
    for f in sorted((ROOT / 'src/data/maps').glob('*.json')):
        m = json.loads(f.read_text(encoding='utf-8'))
        if m['id'] not in FOCUS:
            print(f'FAIL room-backgrounds: no focus for map {m["id"]}')
            sys.exit(1)
        if m['width'] * TILE < W or m['height'] * TILE < H:
            print(f'FAIL room-backgrounds: map {m["id"]} is smaller than {W}x{H}')
            sys.exit(1)
        window(render(m, tileset), FOCUS[m['id']]).save(out / f'{m["id"]}.png', optimize=True)
        n += 1
    print(f'PASS room-backgrounds: {n} files, {W}x{H}, rendered from src/data/maps')


if __name__ == '__main__':
    main()
