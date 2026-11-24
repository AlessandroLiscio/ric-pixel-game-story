# Tile worlds: tileset, maps and how to add a room

A room can be a real tile world in the look of an RPG Maker VX Ace game (top-down 3/4 view, 32x32 grid, a camera that follows Ric through a room bigger than the screen) instead of a background picture. A scene becomes a tile world when its entry in `src/data/scenes.json` has `"map": "<sceneId>"`; the other scenes keep their background picture and walk rectangles until they are converted. The first tile world is `cortile`. Everything is painted by code, no photo is read, copied or traced: the three Cortile Cafe photos were only looked at to place the stage, the bar, the stairs and the mezzanine.

## How to run

Dependencies are the ones of `scripts/art/requirements.txt` (Pillow and numpy, pinned). Use the same virtual environment as for the chibis, from the repository root, in this order.

```powershell
python -m venv "$HOME\.venvs\chibis"
& "$HOME\.venvs\chibis\Scripts\python.exe" -m pip install -r scripts\art\requirements.txt
& "$HOME\.venvs\chibis\Scripts\python.exe" -I scripts\art\tiles.py
& "$HOME\.venvs\chibis\Scripts\python.exe" -I scripts\art\crowd.py
& "$HOME\.venvs\chibis\Scripts\python.exe" -I scripts\art\maps.py
node scripts\check-scenes.mjs
```

`tiles.py` writes `public/assets/tiles/tileset.png` (16 columns, identical pictures share one slot) and `public/assets/tiles/tiles.json` (tile name to index, the names of the solid tiles, and the stamps). `crowd.py` writes `public/assets/tiles/crowd-<n>.png`, palette swaps of the sconosciuta and lollino sheets for the audience. `maps.py` writes `src/data/maps/<sceneId>.json` and refuses a map whose spawn is blocked or whose door cannot be reached. All three are deterministic: a second run gives byte-identical files. `--preview PATH` on `tiles.py` writes a contact sheet (the sheet at 3x, then every stamp with its name) and `--render PATH` on `maps.py` writes a PNG of each finished room with the characters pasted in; both are review aids and are not committed. The generated PNG and JSON files are committed, so the game does not need Python to build.

## The look

Light comes from the top left. Objects have a 1 px dark outline (warm brown, navy for metal and black gear, the same outline idea as the chibis), two to four tones per material, a little texture noise and a soft ground shadow. The palette ramps are at the top of `scripts/art/tilepaint.py` (wood, floor boards, stone, plaster, brick, metal, red, green, blue, cream, gold and the wall caps) and share the warm saturated feel of the character palette. Walls are drawn the way VX Ace draws them: a dark top (the cap, seen from above) and a face below it, three tiles tall in the Cortile (`up` has a shadow under the cap, `mid` is plain, `dn` has a wainscot).

## How to add a tile

Single seamless tiles (floors, caps, wall faces) are functions in `scripts/art/tiles_terrain.py` that return a 32x32 `Canvas` and are registered in its `define(reg)` with `reg.tile(name, canvas, solid=...)`. Furniture, signs, stairs and other things that may span several tiles are drawn on one big canvas of `w*32 x h*32` px in `tiles_objects.py` (furniture, stage gear, plants), `tiles_venue.py` (what makes the Cortile recognisable) or `tiles_rooms.py` (home, university and park pieces) and registered with `reg.stamp(name, canvas, layer, above_rows, mask)`. The generator slices the canvas into tiles named `<name>.<col>.<row>`. `layer` says where a stamp goes: `objects` (single tiles drawn between the characters by their lower edge, solid), `walls` or `below` (baked under everyone, for decorations on a wall face, rugs and shadows, never solid) or `above` (baked over everyone, for chandeliers and tree crowns, never solid). `above_rows` sends the top rows of an `objects` stamp to the `above` layer (a tree crown); `mask` is one string per row of `#` (blocks) and `.` (free), the default being that every cell of an `objects` stamp blocks. Draw an object so it stands on the lower edge of its canvas, call `c.shadow(...)` before the body and `c.outline(...)` after it, then run `tiles.py` and look at the contact sheet.

## How to draw a map

A map is a function in `scripts/art/maps.py` that returns a `Map(id, width, height)` and is added to `MAPS`. It fills the layers with `fill(layer, x0, y0, x1, y1, names)` (a tile name, or a list picked at random with a seeded generator), puts single tiles with `put(layer, x, y, name)` and places a stamp by its name with `stamp(name, x, y)`, where x and y are the top-left tile in tile units. The layers are `ground` (floors), `walls` (caps, wall faces, stage fronts), `below` (decorations, rugs), `objects` and `above`. Collision is derived: a tile in `walls` or `objects` whose name is in the solid list of `tiles.json` blocks. A map must be bigger than 640x360 so the camera scrolls (the Cortile is 30x18 tiles, 960x576 px) and needs these named points in tile units: `spawn`, `door` (a rectangle `x, y, w, h` of walkable tiles, stepping onto it leaves the room once the friend joined), and one point for every person that scenes.json places with `at`. `light(px, py, color, r, kind, period)` adds a glow in pixels (`steady`, `flicker` or `pulse`), and `crowd` holds idle people `{sheet, x, y, facing, bob}` who stand still and bob slowly and block Ric. Then add `"map": "<sceneId>"` to the scene in `scenes.json`, drop the `walk` rectangles (`"walk": []`, `"door": null`), give `spawn` only a `facing`, and give the friend and the extras `"at": "<point name>"` instead of `x` and `y`. `node scripts/check-scenes.mjs` checks the map: spawn and people on walkable tiles, every talkable person and the door reachable from the spawn by a flood fill, crowd sheets present and every tile index inside the sheet.

## What the game does with a map

`src/game/flow/tileMap.ts` holds the runtime. `BootScene` loads the tileset as a spritesheet and the crowd sheets. `TileWorld` bakes `ground`, `walls` and `below` into one canvas texture under everyone and `above` into another over everyone, adds each `objects` tile as an image with depth `(row+1)*32` and Ric and the people with depth equal to their feet y, so a character is hidden by a counter in front of him and hides one behind him. Ric walks 4-directionally with smooth movement, checked against an 18x7 px feet box on the collision grid and against the people standing around; the camera follows him and stops at the map edge. Glows flicker or pulse with tweens and a few dust motes drift up. The dialogue box moves to the top of the screen when Ric or the person he talks to stands in the lower half of the view. F9 in a dev or test build draws the blocked tiles in red, the door and the named people over the live room.

## Cortile Cafe, from the photos

The room is the venue as the three photos show it: a peach-plaster hall with a wide stage at the back, the white painted logo wall behind the stage under a dark wooden staircase that climbs to the right, a lighting truss with coloured spots over the stage, a mezzanine with a glass railing and people leaning over it above the bar on the left, with the bottle niche under its concrete beam and pendant lamps, a second railing piece on the right, round record sign, hanging chalkboard menu and a wall TV between bar and stage, black wrought-iron chandeliers over the floor, a dance floor of boards in front of the stage and a crowd standing on it, small round tables with chairs at both sides and the street door at the bottom left. The pictures contain text and logos: only the shapes were rebuilt, as pixel letters of our own.
