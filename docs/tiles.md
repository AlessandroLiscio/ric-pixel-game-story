# Tile worlds: tileset, maps and how to add a room

A room can be a real tile world in the look of an RPG Maker VX Ace game (top-down 3/4 view, 32x32 grid, a camera that follows Ric through a room bigger than the screen) instead of a background picture. A scene becomes a tile world when its entry in `src/data/scenes.json` has `"map": "<sceneId>"`; the other scenes keep their background picture and walk rectangles until they are converted. The first tile world is `cortile`. Everything is painted by code, no photo is read, copied or traced: the reference photos were only looked at to decide what stands where.

## Rule for room workers: small rooms, faithful to the photos

A room is not a generic venue of its kind. It reproduces the real place from its photos in `reference_photos/` (private, view them with Read, never copy a pixel or a file into the repository): the geometry (what is at the back, which wall has the stairs, where the door is, how deep the room is), the decor (the posters, the lamps, the chalkboard, the colours of the walls and the floor) and the mood (a crowded evening hall is dark with pools of light, a living room is warm). Rooms are small: about 18 to 22 tiles wide and 12 to 14 tall, one screen or a little more, never a hall of 30 x 18 with nothing in it. The engine only needs the room to be bigger than the 640x360 screen (`check-scenes` wants at least 21 x 12 tiles), so size it to the real place and fill it. Before drawing, write a short list "photo feature -> map" (see the Cortile list at the end) and look at it again after every render. Show a feature of the photos as a stamp the player can recognise (a poster, a sign, a piece of furniture), redraw text and logos as pixel letters of our own, and put people where the photos have people (a balcony, a bar, a crowd).

## How to run

Dependencies are the ones of `scripts/art/requirements.txt` (Pillow and numpy, pinned). Use the same virtual environment as for the chibis, from the repository root.

```powershell
python -m venv "$HOME\.venvs\chibis"
& "$HOME\.venvs\chibis\Scripts\python.exe" -m pip install -r scripts\art\requirements.txt
& "$HOME\.venvs\chibis\Scripts\python.exe" -I scripts\art\build_world.py
node scripts\check-scenes.mjs
```

`build_world.py` is the one command. It writes the crowd sheets (`public/assets/tiles/crowd-<n>.png`), then `public/assets/tiles/tileset.png` (16 columns, identical pictures share one slot) and `public/assets/tiles/tiles.json` (tile name to index, the names of the solid tiles, the stamps), then runs every room module and writes `src/data/maps/<sceneId>.json`. It refuses a map whose spawn is blocked, whose door cannot be reached, whose friend cannot be reached around the idle crowd, or whose crowd uses a missing sheet. A second run gives byte-identical files; the last line prints a digest of all of them (`digest 0123456789abcdef`), so two runs can be compared at a glance. The generated PNG and JSON files are committed, so the game does not need Python to build.

Tile indexes are not stable when a room adds stamps (the sheet is laid out in registration order), which is why the sheet and every map are always rebuilt together by one command. Never edit a map JSON or the sheet by hand. When two branches both changed generated files, keep either side of the generated files and run `build_world.py` again on the merged scripts: the files come out right whatever the conflict looked like.

Review aids, never committed: `--preview PATH.png` writes a contact sheet (the sheet at 3x, then every stamp with its name), `--render PATH.png` writes `PATH_<sceneId>.png`, each finished room with the characters pasted in and the night mood applied, `--scale 2` makes it 2x, `--unlit` leaves the night mood out. `python -I scripts/art/tiles.py` and `python -I scripts/art/maps.py` run their halves alone (maps needs the sheet to exist). `python -I scripts/art/crowd.py` writes only the crowd.

## Files

| File | What it holds |
| --- | --- |
| `scripts/art/tilepaint.py` | the pixel helpers (`Canvas`) and the shared palette: hue shifted ramps `WOOD`, `STONE`, `PLASTER`, `METAL`, `RED`, `GREEN`, `BLUE`, `GOLD`, `CAP` and the letter fonts |
| `scripts/art/tiles_terrain.py` | floors, wall caps, wall faces and the soft shadow strips: single seamless 32x32 tiles |
| `scripts/art/tiles_objects.py` | furniture, stage gear, plants, signs, rugs that any room can use |
| `scripts/art/tiles_rooms.py` | pieces drawn for the home, university and park rooms, to restyle when a room needs them |
| `scripts/art/stamps/<sceneId>.py` | the stamps of one room, found by `tiles.py` with importlib; names must start with `<sceneId>_` |
| `scripts/art/rooms/<sceneId>.py` | the map of one room, found by `maps.py` with importlib; `build()` returns a `mapkit.Map` with that id |
| `scripts/art/mapkit.py` | the `Map` class every room module uses |
| `scripts/art/lighting.py` | the night mood model shared by the preview and the game |
| `scripts/art/crowd.py` | the people of the crowd sheets |
| `scripts/art/tiles.py`, `maps.py`, `build_world.py` | the registry and the sheet, the map builder and its checks, the one command |

Shared modules register first and room modules after them in file name order, so a new room never changes the picture of an existing tile, only the index of the tiles that come after it.

## The look

Light comes from the top left. Every material is a 4 to 5 tone ramp whose hue moves along it: shadows drift toward a cool violet navy, highlights toward warm cream (`make_ramp`, `dark`, `light`, `shade` in `tilepaint.py`), so a hall lit by warm lamps keeps cool shade. Objects stand on the lower edge of their canvas: first the soft ground shadow (`c.shadow`), then the body with a lit top face, a base front face and a darker right side, then a selective outline (`c.outline()`: the outline takes the hue of the thing it hugs, darker under and to the right, lighter above and to the left). Highlights are single hand placed pixels, never noise. Floors have no outline and no pixel noise and read calm: flagstones are 3 to 6 soft slabs per tile with a lit top left edge, every tile has a grout line along its border so any layouts mix freely. Walls are drawn the way VX Ace draws them: a cap seen from above, a face with a cornice shadow under the cap and a baseboard with a dark contact line, and a soft shadow strip (`shade_top`, `shade_left`, `shade_right` in the `below` layer) on the floor next to them. Characters get a soft ground shadow at run time (see below), crowd people are drawn by `crowd.py` in the proportions and the 1 px outline of the character sheets.

## Stamps: how to add a tile or a piece of furniture

Single seamless tiles (floors, caps, wall faces) are functions in `tiles_terrain.py` returning a 32x32 `Canvas`, registered in its `define(reg)` with `reg.tile(name, canvas, solid=...)`. Anything that spans several tiles is drawn on one big canvas of `w*32 x h*32` px and registered with `reg.stamp(name, canvas, layer, above_rows, mask)`. The registry slices the canvas into tiles named `<name>.<col>.<row>` and skips empty cells. Shared pieces go in `tiles_objects.py`; the pieces of one room go in `scripts/art/stamps/<sceneId>.py`:

```python
from tilepaint import Canvas, T, WOOD, dark, light
from tiles_objects import slab, bottle   # shared helpers

def piano():
    c = Canvas(2 * T, T)
    c.shadow(32, 30.5, 28, 2.6, 76)       # the soft ground shadow first
    slab(c, 3, 5, 60, 29, WOOD, top_h=7)  # a lit top, a base front, a dark foot
    c.outline()                            # the selective outline last
    return c

def define(reg):                           # called once; names must start with the scene id
    reg.stamp("salotto_piano", piano(), "objects", mask=["##"])
```

`layer` says where a stamp goes: `objects` (single tiles drawn between the characters by their lower edge, solid), `walls` or `below` (baked under everyone: `walls` for big pictures of a wall, `below` for decorations, rugs and shadows, never solid) or `above` (baked over everyone, for chandeliers and tree crowns, never solid). `above_rows` sends the top rows of an `objects` stamp to the `above` layer (a tree crown); `mask` is one string per row of `#` (blocks) and `.` (free), the default being that every cell of an `objects` stamp blocks. A big wall can be one stamp (the Cortile back wall is three, 7, 5 and 8 tiles wide and 4 tall, so plaster, shadows and lamps join); give it layer `walls` and block its cells in the map with `m.block`. The registry refuses a name already used and, in a room module, a name that does not start with `<sceneId>_`.

Helpers worth knowing in `tilepaint.Canvas`: `rect`, `hline`, `vline`, `line`, `poly`, `ell`, `disc`, `round_rect`, `vgrad`, `dither(x0, y0, x1, y1, a, b, density)` for soft patches, `text(x, y, s, color, scale, font=LOWER)` for pixel letters (`LETTERS` is upper case, `LOWER` the lowercase of the Cortile logo), `glow`, `shadow`, `outline`. In `tiles_objects.py`: `slab`, `panel`, `bottle`, `glass`, `leaf`, `pot`. Draw with 4 to 5 ramp tones, never with random noise inside a shape, and look at the render at 2x and 4x before you call a piece done.

## Maps: how to draw a room

A room is `scripts/art/rooms/<sceneId>.py` with `build()` returning a `mapkit.Map`. The layers are `ground` (floors), `walls` (caps, big wall pictures, anything under the characters that blocks or frames the room), `below` (decorations, rugs, shadows), `objects` and `above`.

```python
import random

from mapkit import Map

def build():
    m = Map("salotto", 22, 13)
    m.fill("ground", 1, 3, 20, 11, ["floor_wood_a", "floor_wood_b"], random.Random(1))   # a list is picked at random, seeded
    m.put("walls", 0, 0, "cap_none")                       # a single tile by name
    m.stamp("salotto_piano", 4, 5)                         # a stamp by name, x and y are its top-left tile
    m.block(0, 0, 21, 2)                                    # blocked cells that are drawn by a stamp
    m.point("spawn", 3, 10)                                 # tile units
    m.point("door", 9, 12, 2, 1)                            # x, y, w, h of walkable tiles
    m.point("friend", 12, 7)
    m.light(160, 90, "#ffcf72", 22, "flicker", 1800, pool=70, power=.9)
    m.mood("#8c7490")
    m.person("crowd-4", 8, 8, "up", 2400)
    m.dancer("crowd-6", 9, 9, "up", 440)
    return m
```

- Collision is derived: a tile in `walls` or `objects` whose name is in the solid list of `tiles.json` blocks, plus every cell you `block`, plus every dancer. The `cap_*` tiles, the plaster, brick, wood and stone wall tiles and the `objects` stamps are solid; `walls` stamps are not, so block their cells.
- A map must be bigger than 640x360 so the camera scrolls (at least 21 x 12 tiles) and needs these points, in tiles: `spawn`, `door` (a rectangle of walkable tiles, stepping onto it leaves the room once the friend joined) and one point for every person `scenes.json` places with `at` (the friend, the extras). Name them as you like, the scene refers to them.
- `m.light(px, py, color, r, kind, period, pool, power)` is a light in pixels. `r` is the radius of a small additive glow that `kind` makes `steady`, `flicker` or `pulse` (`period` in ms; 0 for no glow). `pool` is the radius of the pool of light it brings back into the night overlay (default 2.4 x `r`, 0 for none) and `power` how much of its colour (0 to 1). Several lights on one spot are fine: a glow at the lamp and a pool on the floor under it.
- `m.mood("#rrggbb")` makes an evening room: everything is multiplied by that colour (darker and cooler than the day), and the pools of the lights bring colour back. Leave it out for a day room. `scripts/art/lighting.py` and `addMood` in `src/game/flow/tileMap.ts` are the same model, so the render of `--render` is what the game shows.
- `m.person(sheet, x, y, facing, bob)` is an idle person (a crowd sheet name such as `crowd-4`) who stands still and breathes in a slow bob of `bob` ms and blocks Ric at run time. `m.dancer(sheet, x, y, facing, period)` is a person who swaps the two dance poses of a crowd sheet every `period` ms with a small hop. Keep an aisle: the builder checks that the crowd does not close the way from the spawn to the door and to the friend.
- Then add `"map": "<sceneId>"` to the scene in `scenes.json`, drop the `walk` rectangles (`"walk": []`, `"door": null`), give `spawn` only a `facing`, and give the friend and the extras `"at": "<point name>"` instead of `x` and `y`.

## How to add a room, in order

1. Look at the photos of the place and write the list "photo feature -> map" (rule above). Decide the size, the door and where the player enters.
2. Create `scripts/art/stamps/<sceneId>.py` with `define(reg)` and the stamps only this room needs (names `<sceneId>_...`). Reuse shared pieces from `tiles_objects.py` and `tiles_rooms.py`, restyle them in place if the room needs a better version.
3. Create `scripts/art/rooms/<sceneId>.py` with `build()`.
4. Run `python -I scripts/art/build_world.py --render "<scratch>\room.png" --scale 2 --preview "<scratch>\contact.png"`, open the render with Read, write down three things that look weak, fix them and run again, at least four rounds; compare with the photos and with the Doom & Destiny reference each time.
5. Edit `scenes.json` as above, then run the checks: `node scripts/check-scenes.mjs` (spawn, people and door on walkable tiles, reachable, crowd sheets present, every tile index inside the sheet), `npm run typecheck-nolog`, `npm run build-nolog`, `npm run smoke-walk-nolog`.
6. Commit the scripts and the generated files together (`public/assets/tiles/*`, `src/data/maps/*.json`).

## What the game does with a map

`src/game/flow/tileMap.ts` holds the runtime. `BootScene` loads the tileset as a spritesheet and the crowd sheets (those of `crowd` and `dancers`). `TileWorld` bakes `ground`, `walls` and `below` into one canvas texture under everyone and `above` into another over everyone, adds each `objects` tile as an image with depth `(row+1)*32` and Ric and the people with depth equal to their feet y, so a character is hidden by a counter in front of him and hides one behind him. A soft ground shadow follows every character sprite (any sprite whose texture key starts with `char-`). With a `mood` the room gets a canvas the size of the map filled with the ambient colour plus a radial pool per light, drawn over everything with the multiply blend at depth 750; the glows and the dust motes sit on top of it, the dialogue box above all. Ric walks 4-directionally with smooth movement, checked against an 18x7 px feet box on the collision grid and against the people standing around; the camera follows him and stops at the map edge. F9 in a dev or test build toggles the walk overlay, which draws the blocked tiles of the collision grid over the live room.

## Crowd

`crowd.py` draws small chibi people in the proportions and the outline of the character sheets. Each entry of `PEOPLE` is a dict with `skin` (pale, light, tan, olive, brown, dark), `hair` (a colour), `style` (short, bob, long, pony, bun, curly, bald), `top` and `tops` (tee, hoodie, jacket, dress, stripes, band), `bottom`, `shoe` and an optional `extra` (cap, beanie, headband, glasses, beard, with `cap` as its colour); there are twenty. A sheet is 96x128 like the character sheets (rows down, left, right, up); columns 0 and 2 are the two dance poses (an arm up, a foot lifted) and column 1 the standing pose the idle crowd uses. To add a person append a dict to `PEOPLE`; the new sheet is `crowd-<n>` with n the position in the list starting at 1, and appending keeps the numbers of the others.

## Cortile Cafe, photo feature -> map

The room is 22 x 14 tiles, rebuilt from the three photos `cortile-cafe-lato-scale.jpeg`, `cortile-cafe-palco.jpeg` and `cortile-cafe-lato-ingresso.jpg`.

| Photo feature | In the map |
| --- | --- |
| a small narrow vaulted hall, warm cream plaster walls | 22 x 14 tiles, plaster drawn into the three wall stamps, an arch and darker spandrels on the middle wall |
| no big stage: the band plays at floor level in the back-right corner on a very low step | `riser_*` tiles, a very low step at the front and left of an 8 x 3 tile corner, drums, two amps, guitar and bass on stands, wedges and mic stands |
| the mezzanine balcony along the left and the back above the bar, black frame, glass railing, people leaning over | `cortile_wall_left` (people over a glass railing above a concrete beam) and `cortile_mezz_side_*` (the same balcony seen along the left wall) |
| the bar under the mezzanine: dark niche with bottle shelves, counter, concrete pillar | the niche in `cortile_wall_left`, `bar_counter_5` with taps, glasses and a cash register, `bar_stool`, `cortile_pillar` with flyers and a brass lamp |
| a hanging chalkboard menu, small warm wall lamps and pendant lamps | the chalkboard and three pendant lamps in `cortile_wall_left`, two brass wall lamps in `cortile_wall_mid`, lights with pools |
| the back wall between bar and band: framed black and white portraits, a big lightning-bolt poster, a round vinyl-record sign | `cortile_wall_mid`: eight frames, the painted poster, the record |
| the white wall of the band corner with the painted logo "il cortile café" in black lowercase and a red squiggle | `cortile_wall_right`: the white wall, the lettering and the squiggle redrawn in pixel letters |
| the staircase along the back-right white wall, dark red wooden handrail, up to the balcony landing | `cortile_wall_right`: a diagonal handrail on a white wall, a stringer, a newel post, a landing with people at its top |
| the lighting truss with spots, a skull mask on it, two black PA speakers | the truss with four coloured spots and the skull in `cortile_wall_right`, two wall speakers, four coloured light pools on the band |
| the black wrought-iron birdcage chandelier hanging from the vault | `cortile_chandelier` in the `above` layer, with a light pool |
| a projector image glowing on the vault, wall TVs with blue screens | a pale projected portrait on the arch and two TVs in `cortile_wall_mid`, with blue light pools |
| drums with the "Cortile Cafe" kick drum, amps, mic stands, a guitar on a stand | `drum_kit` (ring logo on the kick), `amp`, `mic_stand`, `guitar_stand`, `bass_stand` |
| the floor in front packed with the crowd | twenty-two idle people of twenty different sheets facing the band and three dancers |
| the street door at the front | `cortile_entrance` and a doormat at the bottom left, a cool pool of street light |
