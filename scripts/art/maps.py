#!/usr/bin/env python3
"""Map builder: runs every room module of scripts/art/rooms/<sceneId>.py and writes src/data/maps/<sceneId>.json.

Usage: python -I scripts/art/maps.py [--render PATH]   (run scripts/art/tiles.py first, or just run build_world.py, which runs it all)
A room module defines build() and returns a mapkit.Map whose id equals the file name. The map is layers of tile indexes (ground, walls,
below, objects, above), a collision grid derived from the solid tiles, named points in tile units, lights and the crowd. Stamps from
tiles.json (furniture, signs, stairs ...) are placed by name. See docs/tiles.md.
--render writes a PNG of each finished room with the characters pasted in (and the night mood applied), as a review aid.
"""
import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))  # python -I does not put the script folder on the path

import mapkit  # noqa: E402
from mapkit import ROOT, Map, shadow, sprite  # noqa: E402,F401
from tiles import discover  # noqa: E402

OUT_DIR = ROOT / "src" / "data" / "maps"


def build_maps():
    """[(sceneId, Map)] from every rooms/*.py, sorted by file name."""
    mapkit.load()
    out = []
    for scene_id, mod in discover("rooms"):
        m = mod.build()
        if not isinstance(m, Map) or m.id != scene_id:
            raise SystemExit("rooms/%s.py: build() must return a Map with id %r" % (scene_id, scene_id))
        out.append((scene_id, m))
    return out


def check(m):
    """Problems of one map: spawn and door, every named person's point, the crowd, and Ric's way to them around the idle crowd."""
    problems, mid = [], m.id
    grid = m.collision()
    pts = m.points
    for need in ("spawn", "door"):
        if need not in pts:
            return ["%s: point %s is missing" % (mid, need)]
    spawn = (pts["spawn"]["x"], pts["spawn"]["y"])
    if grid[spawn[1]][spawn[0]]:
        return ["%s: spawn is blocked" % mid]
    crowd_cells = {(c["x"], c["y"]) for c in m.crowd} | {(d["x"], d["y"]) for d in m.dancers}
    seen = m.reachable(spawn, grid)
    d = pts["door"]
    cells = [(x, y) for x in range(d["x"], d["x"] + d["w"]) for y in range(d["y"], d["y"] + d["h"])]
    if not any(c in seen for c in cells):
        problems.append("%s: door is not reachable from spawn" % mid)
    walk = m.reachable(spawn, grid, crowd_cells)  # the crowd is solid at run time: a door behind the crowd is unreachable
    if not any(c in walk for c in cells):
        problems.append("%s: the crowd blocks the way from spawn to the door" % mid)
    scene = next((s for s in json.loads((ROOT / "src/data/scenes.json").read_text(encoding="utf-8")) if s.get("map") == mid), None)
    people = []
    if scene:
        people = [p for p in [scene.get("friend"), scene.get("friend2"), *scene.get("extras", [])] if p and p.get("at")]
        for p in people:
            q = pts.get(p["at"])
            if not q:
                problems.append("%s: point %s (%s) is missing" % (mid, p["at"], p["personId"]))
            elif (q["x"], q["y"]) in crowd_cells:
                problems.append("%s: %s stands on a crowd tile" % (mid, p["personId"]))
            elif p.get("personId") == (scene.get("friend") or {}).get("personId") and (q["x"], q["y"]) not in walk:
                # a person Ric talks to needs a free neighbouring tile he can walk to
                if not any((q["x"] + dx, q["y"] + dy) in walk for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    problems.append("%s: the crowd blocks the way to %s" % (mid, p["personId"]))
    for c in m.crowd + m.dancers:
        f = ROOT / ("public/assets/tiles/%s.png" % c["sheet"])
        if not f.exists():
            problems.append("%s: sheet %s has no file" % (mid, c["sheet"]))
        if grid[c["y"]][c["x"]] and c in m.crowd:
            problems.append("%s: crowd member at %d,%d is on a blocked tile" % (mid, c["x"], c["y"]))
    return problems


def preview_sprites(m, scene_defs):
    """Ric at the spawn, the people the scene puts on named points, the crowd and the dancers (second pose on the beat)."""
    sp = m.points["spawn"]
    scene = next((s for s in scene_defs if s.get("map") == m.id), {})
    out = [sprite("ric", sp["x"], sp["y"], (scene.get("spawn") or {}).get("facing", "up")), shadow(sp["x"], sp["y"])]
    for p in [scene.get("friend"), scene.get("friend2"), *scene.get("extras", [])]:
        if p and p.get("at") in m.points:
            q = m.points[p["at"]]
            out += [sprite(p["personId"], q["x"], q["y"], p.get("facing", "down")), shadow(q["x"], q["y"])]
    for c in m.crowd:
        out += [sprite(c["sheet"], c["x"], c["y"], c["facing"]), shadow(c["x"], c["y"])]
    for i, d in enumerate(m.dancers):
        out += [sprite(d["sheet"], d["x"], d["y"], d["facing"], frame=0 if i % 2 else 2, dy=-1), shadow(d["x"], d["y"])]
    return out


def write(maps, render=None, lit=True, scale=1):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    scene_defs = json.loads((ROOT / "src/data/scenes.json").read_text(encoding="utf-8"))
    problems = []
    for mid, m in maps:
        problems += check(m)
        (OUT_DIR / (mid + ".json")).write_text(m.to_json(), encoding="utf-8")
        if render:
            im = m.render(preview_sprites(m, scene_defs), lit=lit)
            if scale != 1:
                im = im.resize((im.width * scale, im.height * scale), 0)
            im.save(render.replace(".png", "_%s.png" % mid) if render.endswith(".png") else render)
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--render", help="write a PNG of each finished room (a review aid): PATH gets the map id appended")
    ap.add_argument("--unlit", action="store_true", help="render without the night mood")
    ap.add_argument("--scale", type=int, default=1)
    args = ap.parse_args()
    maps = build_maps()
    problems = write(maps, args.render, not args.unlit, args.scale)
    if problems:
        print("FAIL maps: " + "; ".join(problems))
        sys.exit(1)
    print("PASS maps: %d map(s) written" % len(maps))


if __name__ == "__main__":
    main()
