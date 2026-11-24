#!/usr/bin/env python3
"""The one deterministic command that regenerates every tile world file: the crowd sheets, tileset.png, tiles.json and every map.

Usage: python -I scripts/art/build_world.py [--preview SHEET.png] [--render MAP.png] [--unlit] [--scale N]
Rooms and their stamps are found by themselves (scripts/art/rooms/<sceneId>.py, scripts/art/stamps/<sceneId>.py), so adding a room
needs no edit here. Tile indexes are not stable between runs that add stamps, which is why the sheet and all the maps are always
rebuilt together: never edit a map JSON or the sheet by hand, rerun this. A second run gives byte-identical files; the last line
prints a digest of all of them to compare two runs. See docs/tiles.md.
"""
import argparse
import hashlib
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))  # python -I does not put the script folder on the path

import crowd  # noqa: E402
import maps  # noqa: E402
import tiles  # noqa: E402
from mapkit import ROOT  # noqa: E402


def digest():
    h = hashlib.sha256()
    files = sorted((ROOT / "public/assets/tiles").glob("*")) + sorted((ROOT / "src/data/maps").glob("*.json"))
    for f in files:
        h.update(f.name.encode())
        h.update(f.read_bytes())
    return h.hexdigest()[:16], len(files)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", help="write the tileset contact sheet PNG (a review aid, not committed)")
    ap.add_argument("--render", help="write a PNG of each room, characters pasted in, night mood applied (a review aid)")
    ap.add_argument("--unlit", action="store_true", help="render without the night mood")
    ap.add_argument("--scale", type=int, default=1, help="render scale")
    args = ap.parse_args()
    n_sheets = crowd.write()
    reg, sheet, names, count = tiles.write(preview=args.preview)
    built = maps.build_maps()
    problems = maps.write(built, args.render, not args.unlit, args.scale)
    if problems:
        print("FAIL world: " + "; ".join(problems))
        sys.exit(1)
    d, n = digest()
    print("PASS world: %d crowd sheets, %d tiles in %d stamps, %d map(s), %d files, digest %s" % (n_sheets, count, len(reg.stamps), len(built), n, d))


if __name__ == "__main__":
    main()
