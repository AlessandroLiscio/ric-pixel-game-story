"""Room stamps: one module per tile world, scripts/art/stamps/<sceneId>.py, found by tiles.py with importlib (see docs/tiles.md).

A module defines `define(reg)` and registers only stamps and tiles whose names start with `<sceneId>_`, so rooms written in parallel
never collide. Shared materials and furniture come from tilepaint.py, tiles_terrain.py and tiles_objects.py.
"""
