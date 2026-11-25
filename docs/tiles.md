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

`layer` says where a stamp goes: `objects` (single tiles drawn between the characters by their lower edge, solid), `walls` or `below` (baked under everyone: `walls` for big pictures of a wall, `below` for decorations, rugs and shadows, never solid) or `above` (baked over everyone, for chandeliers and tree crowns, never solid). `above_rows` sends the top rows of an `objects` stamp to the `above` layer (a tree crown); `mask` is one string per row of `#` (blocks) and `.` (free), the default being that every cell of an `objects` stamp blocks and that a `walls` stamp blocks nothing; a `walls` stamp with a `mask` blocks its `#` cells. A big wall can be one stamp (the Cortile back wall is three, 7, 5 and 8 tiles wide and 4 tall, so plaster, shadows and lamps join); give it layer `walls` and block its cells in the map with `m.block`. The registry refuses a name already used and, in a room module, a name that does not start with `<sceneId>_`.

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

- Collision is derived: a tile in `walls` or `objects` whose name is in the solid list of `tiles.json` blocks, plus every cell you `block`, plus every dancer. The `cap_*` tiles, the plaster, brick, wood and stone wall tiles and the `objects` stamps are solid; `walls` stamps are not unless they carry a `mask`, so block the cells of a big wall picture with `m.block`.
- **Anything that stands up blocks.** Everything that stands up in 3D must stop the characters: bikes, scooters, benches, tables, chairs, lamps, bins, plants, shelves, sofas, the bar, any furniture, a rucksack on the grass. Put it in the `objects` layer (every cell blocks, `mask` frees the parts Ric may walk behind, such as a tree crown or a lamp head) or, when it is baked under the characters as a `walls` stamp (the Giardini bikes, scooter and gear), give the stamp a `mask` of `#` cells (`reg.stamp("giardini_bike_a", bike(0), "walls", mask=["##"])`): a `walls` stamp with a mask blocks exactly its `#` cells. Flat things stay walkable: rugs, towels and tarps on the grass, the slackline, floor lines, doormats, shadows. Audit a room with `--render` and look for a standing object that is not in the blocked set before it is done; the flood fill of the builder (and `npm run smoke-walk-nolog`) then proves the spawn, the door and every friend are still reachable.
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

## Cinema Bellinzona (universita), photo feature -> map

The room is 22 x 14 tiles, rebuilt from `cinema-bellinzona-lato-palco.jpg` and `cinema-bellinzona-lato-posteriore.jpeg`. The scene id stays `universita`, so the stamps are in `scripts/art/stamps/universita.py` (names `universita_*`) and the map in `scripts/art/rooms/universita.py`. The front wall with the screen is the top of the map and the seats face it. Indoor mood: a mild dim grey violet, with pools of light under the round wall lights and a bright pool at the screen.

| Photo feature | In the map |
| --- | --- |
| a long hall with grey plaster walls | `universita_wall_front` (20 x 3 tiles) and the two long walls `universita_wall_left` and `universita_wall_right` (1 x 12 tiles each): grey plaster with faint panel joints, a skirting |
| round white wall lights in rows along the side walls | a round lamp with a halo at rows 2, 8, 10 and 12 on both long walls and two on each flank of the front wall, each with a pool of light in the map |
| small black loudspeakers on brackets | `speaker` on the flanks of the front wall and on the long walls |
| the big white screen between dark side frames and curtains, under a dark soffit | the recess of `universita_wall_front` (tiles 5 to 16): a lowered dark soffit, pleated dark curtains on both sides and a 224 x 66 px screen with a black masking frame, a white surface and a soft blue slide (our own drawing: a title, lines and a play triangle) for the lesson Prof. Pinolo projects; the screen has a steady glow and a slow pulse of light |
| a low light grey stage under the screen | row 4 of `universita_hall`: a stage 12 tiles wide (tiles 5 to 16) in light grey with seams, a front step and the shadow it throws on the front aisle; walkable, Prof. Pinolo stands on it at the left end (tile 6,4) |
| a dark glossy floor | `floor_px`: a quiet checker of two dark blue greys, slab joints and long soft reflections; darker under the seats |
| many rows of red velvet seats with wooden armrests facing the screen | `universita_hall`: six rows (map rows 6 to 11) in two blocks of seven seats (tiles 3 to 9 and 12 to 18), every seat a red velvet back with a lit rim and a stitched seam between two wooden armrests, an empty seat with its folded cushion; every seat blocks |
| a full house, an audience of many people | heads and shoulders cut from the crowd sheets (`paste_person`, rows seen from behind, a few turned to the side) in about nine of ten seats, the lower body hidden by the seat back; the front row of the right block is half empty |
| side aisles along the long walls, exit doors with green exit signs | two side aisles two tiles wide (tiles 1 and 2, 19 and 20) and a centre aisle (tiles 10 and 11); a grey metal door with a push bar and a green exit sign over it on each long wall at rows 5 and 6; a walkway along the back (row 12) and the front aisle (row 5) |
| a small notice on the wall and a grey box | a pinned notice and a small wall box on each flank of the front wall |
| two recycling bins | `universita_bins` in the back right corner (tile 20,12), the litter bin of the scene (`bins` in `scenes.json`, x 656, y 412) |
| how the scene plays | Ric comes in through the left exit door (spawn at tile 1,5) and walks right along the front aisle; Lollino sits in the first seat of the front row (tile 3,6, not blocked: `universita_seat_lollino` is an object drawn over his sprite, so he is hidden from the chest down); Prof. Pinolo stands on the stage; the student extra stands in the right aisle (tile 20,9); the exit is the matching door of the right wall (door at tiles 20,5 to 20,6, the smoke test walks the room blind with the right arrow along row 5) |
| things the game can interact with (named points, tile units `x, y, w, h`) | `obj_screen` 7,1,8,3 (the big screen) and `obj_seats` 12,6,7,1 (the front row of the right block of seats) |

## Giuggiu's living room, plan and photo feature -> map

The room is 22 x 18 tiles. The layout follows the owner's floor plan (`casa-giuggiu-sketch.jpeg`, private, viewed only with Read): the plan is drawn long and narrow with the big window at the top and the TV at the bottom, here squeezed to 22 x 18 because the plan is not to scale (its table alone fills half the width) and the engine wants a room at least 21 tiles wide. The decor comes from the three photos `casa-giuggiu-salotto-lato-finestra.jpg`, `casa-giuggiu-divani-e-puf.jpg` and `casa-giuggiu-gatto.jpg` (the video is not used). Stamps are in `scripts/art/stamps/giuggiu.py`, the map in `scripts/art/rooms/giuggiu.py`.

The sofa triangle (tile coordinates, x and y of the top-left tile, sizes in tiles): the middle sofa with the red throw and the grey cushion `giuggiu_sofa_navy` at 8,9 (4 x 2, faces south), the long burgundy sofa `giuggiu_sofa_burgundy` against the left wall at 2,11 (2 x 4, faces east), the navy sofa with the cat `giuggiu_sofa_east` against the right wall at 18,10 (2 x 3, faces west), and the low black table `giuggiu_table_black` in the middle of them at 8,12 (4 x 2); the TV `giuggiu_tv` stands at 9,15 (3 x 2) at the bottom wall and faces them. The cream sofa (2,7, 2 x 3) and the red pouf (2,10) stand on the left wall above the burgundy sofa, as in the plan, which has four sofas.

The scene points: `spawn` 17,15, `door` 20,14 (1 x 2, the entrance in the right wall), `giuggiu` 15,6, `gatto` 18,11. The interactable objects, as points with a size in tiles (the footprint of each object): `obj_table` 8,12 4 x 2; `obj_tv` 9,15 3 x 2; `obj_window` 8,1 6 x 3; `obj_puf` 2,10 1 x 1; `obj_cat` 18,11 1 x 1 (the seat of the navy sofa, the one tile of a sofa that stays walkable because a scene needs a walkable point for the cat). The litter bin of `scenes.json` is at the bottom left corner (tile 2,16).

| Plan or photo feature | In the map |
| --- | --- |
| plan: "finestra grande" in the top wall with the "tavolo" (four chairs) in front of it, "mobile marrone" in the top left corner, "mobile con sopra quadri" top right | the big window `giuggiu_wall_win` in the back wall, the glass table `giuggiu_table` at 9,5 with two red chairs on its west end and two black ones on its east end, `giuggiu_armoire` in the left corner, `giuggiu_vitrine` in the right corner with framed pictures standing on top (the tube TV of the photo moved to the TV table) |
| plan: "tavolo ferro argento" on the left wall under the cabinet | `giuggiu_trolley` (the brass and glass tea trolley of the photo) at 2,5 |
| plan: "finestra piccola" in the left wall with the "puff" in front of it, a sofa on each side | the side window tiles `giuggiu_sidel_win_*` on rows 8 to 12, the red bean bag `giuggiu_pouf` at 2,10, the cream sofa above it and the burgundy sofa below it, a sun patch on the floor in front of the window |
| plan: three sofas round the "tavolino nero basso" in the middle | see the sofa triangle above, with a magazine, a remote control and a mug on the black table |
| plan: "tavolo con TV" at the bottom wall, a plant at its left | `giuggiu_tv` (an old tube TV on a low wooden table, seen from behind because it faces the sofas) and the shared `plant_big` at 5,15 |
| plan: "porta ingresso" in the right wall below the sofa | the door tiles `giuggiu_sider_door_top` and `giuggiu_sider_door_bot` (a cream frame, a dark corridor, the open leaf of orange veneer seen edge on) at 20,14 and 20,15, with a coir doormat `giuggiu_doormat` in front |
| dark herringbone parquet, worn, warm brown | `giuggiu_parquet_a` to `d`, 16 x 4 px planks in a seamless herringbone with a few scuffs in the variants |
| pale lilac cream walls, cream baseboards, a very high ceiling | `giuggiu_wall_left`, `giuggiu_wall_win`, `giuggiu_wall_right` (three tiles tall, plaster, cream skirting), cables hanging on the wall |
| the big white window on the back wall, three sashes, grey roller shutters half lowered, brick houses outside, a beige shutter box over it | `giuggiu_wall_win`: the middle sash open on two brick houses with a balcony, the outer sashes half covered by slatted shutters, the box and the white sill |
| a big crystal chandelier with brass arms in front of the window | `giuggiu_chandelier` in the above layer, 6 tiles wide, arms with candles and hoops of hanging glass drops |
| a red Chinese paper lantern with a printed child and a yellow tassel, hanging in front of the window | `giuggiu_lantern` in the above layer, hung from the middle of the chandelier |
| a dark console table under the window, sun on its top | `giuggiu_console` with a warm streak on the dark wood |
| a tall dark carved wardrobe in the left corner with a bicycle frame on top and cables beside it | `giuggiu_armoire`, 2 x 4 tiles, twisted columns, glass panel, a bicycle frame and a rope on top |
| a gilded landscape painting on the left wall, a framed black and white picture next to the window | `giuggiu_wall_left` (landscape), `giuggiu_wall_right` (portrait) |
| the tall window on the left wall with trees outside, a long burgundy sofa bed under it | `giuggiu_sidel_*` tiles (the wall seen edge on, a window with foliage and a white sill) and `giuggiu_sofa_burgundy`, a sun patch and a light on the floor in front |
| a cream patterned sofa with a white blanket, a red blanket, a burgundy cushion and a black bag | `giuggiu_sofa_cream` against the left wall |
| a navy two seater with a bright red ribbed throw, a dark grey cushion and a remote control; the cat sleeps on it, next to the door | the cat's sofa `giuggiu_sofa_east` (navy, a burgundy cushion, the red throw on the middle seat, the remote control) in the walls layer so the cat stands on its seat, and the middle sofa `giuggiu_sofa_navy` with the throw and the grey cushion |
| the glass table with chrome legs, a laptop and a bottle on it, one red plastic chair and one black slatted chair | `giuggiu_table` (a see-through top), `giuggiu_chair_red`, `giuggiu_chair_black` |
| a dark walnut display cabinet with leaded glass doors and claw feet, a blue pedestrian sign, a green white and red scarf | `giuggiu_vitrine` in the right corner, with the sign redrawn in our own pixels and the pictures of the plan on top |
| a light oak open shelf along the right wall with a white sports bag, a spray can, a picture frame | `giuggiu_shelf`, 1 x 4 tiles at 19,5, the lit top and the open side with the cubbies |
| afternoon light, dim room, a bright window | day mood `#e2d0c8`, pools of warm light under the windows, a red glow near the lantern, sun patches on the parquet |

## Giardini Margherita, photo feature -> map

The room is 26 x 16 tiles (an open-air park is a little larger than the indoor rooms), a bright afternoon with no mood, rebuilt from the four photos `giardini-margherita-1.jpeg`, `-2.jpeg`, `-tipico.jpeg` and `-ric-slack.jpeg` of `reference_photos/giardini-margherita/` (only the setting is used: no face, no pixel and no logo of the photos is copied, and the people on the grass are our own crowd sheets). Everything is in `scripts/art/stamps/giardini.py` and `scripts/art/rooms/giardini.py`. Layers: the lawn, the gravel path, the pavers, the curb and the road are `ground` tiles (autotiled by the room module with ragged edges); the back of the park, the slackline, the towel, the tarp, the bikes and the rucksacks are `walls` stamps (flat, under everyone); the tree shadows are translucent `below` stamps; trees (crown in `above`, trunk blocks), benches, lamps, the bin and the dog are `objects`.

| Photo feature | In the map |
| --- | --- |
| a wide mown lawn with worn bare patches and tufts, big dappled tree shadows (all four photos) | six lawn tiles (`giardini_grass_a` to `_dry`), `giardini_grass_bare` patches, four `giardini_shade_*` stamps with sun dapples punched through, falling to the lower right of each tree |
| the slackline: a green webbing strapped around two big trunks with a green tree strap and a silver ratchet, the tail coiled on the grass (`-tipico`, `-ric-slack`) | `giardini_tree_slack_l` and `_slack_r` (trunk at columns 3 and 17 of row 8, strap and ratchet drawn on the trunk, worn earth at the foot), `giardini_line` (the sagging webbing with its shadow, 15 tiles) and `giardini_webbing` (the coil) |
| the orange towel spread open below the line (the story text; the photo has a patterned blanket) with things left on it | `giardini_towel` 5 x 3 tiles, skewed, striped, wrinkled, with a fringe, a bottle and a paperback; Liscio stands at the left of it, between the left trunk and the towel |
| a dark green tarp with two people lying on it, one in a straw hat (`-ric-slack`) | `giardini_tarp` with two lying figures seen from behind (no faces), a pink towel, a phone and a bottle |
| bicycles lying on the grass, an electric scooter, rucksacks, shoes, a blue bottle, an orange frisbee, beer bottles (`-tipico`, `-ric-slack`) | `giardini_bike_a` (lime frame) and `_bike_b` (black), `giardini_scooter`, `giardini_gear_a` to `_c` |
| the big plane trees with dark furrowed trunks, one very big at the right edge (`-1`), slender ash trees further back, a sapling with a stake (`-1`) | `giardini_tree_plane` (5 x 5), `giardini_tree_young_a` and `_b`, `giardini_sapling` |
| the red-brown park bench with a graffiti scribble on a patch of small brick pavers behind a concrete curb, at the lower left (`-1`) | `giardini_bench_graffiti` on `giardini_brick_*` tiles, `giardini_curb_brick` |
| the grey asphalt of Viale Bottonelli along the front behind a concrete curb with a gutter (`-1`, `-2`) | rows 14 and 15 of `giardini_road_*` (a storm drain and two tarmac patches), the row 13 `giardini_curb`; Ric comes in on the road at the left (`spawn` 1, 14) and leaves at the right (`door` 24, 14, 2 x 2) |
| a dark green perforated litter bin on a pole at the curb (`-2`) | `giardini_bin` |
| a green lamp post with a round globe, wooden park benches, the asphalt path behind the lawn (`-tipico`, `-ric-slack`) | two `giardini_lamp` posts, two `giardini_bench_wood`, the back path in `giardini_backdrop` with tiny walkers and a bench |
| the far wooded edge, a villa with an orange roof among the trees (`-1`), the pond with a white fountain behind a wooden fence (`-ric-slack`), a post-and-rail fence | `giardini_backdrop` (26 x 4 tiles): sky and clouds, hazy far trees, the villa, the pond and its fountain, taller trees on slender trunks, the back path, a pale post-and-rail fence |
| a gravel footpath that leaves the lawn through a gate in the fence toward the pond | `giardini_path_*` ragged autotiles at columns 20 and 21 from the road (`giardini_pathdip_l` and `_r`, the dropped curb) up to the gate posts in the backdrop |
| a dog walker with a small dog on a red leash | the extra `sconosciuta` (tinted, egg `extra-2`) at the point `dogwalker` (21, 11) on the path, `giardini_dog` at its right on the grass with the leash running to her hand |
| a few people sitting and standing around on the grass | six idle crowd people: a spectator at the left trunk, a pair chatting by the bin, one at the curb by the bench, one at the curb by the path, one watching from the right trunk, and the friend Liscio at the point `liscio` (6, 9) |

## Casa Circe, photo feature -> map

The room is 24 x 13 tiles, rebuilt from the five photos `casa-circe-zona-cucina.jpeg`, `casa-circe-foto-verso-ingresso.jpeg`, `casa-circe-tavolo-divano.jpeg`, `casa-circe-divano-aperto.jpeg` and `casa-circe-scale-tv.jpeg`. The real flat is open plan; the map lays its walls flat along one back wall of five pictures (rows 1 to 4, all blocked) and puts the table, the rug and the front door on the floor in front. People are left out of the pictures; Ros stands by the sofa, Giusy at the bathroom door. The evening mood is warm: lamps, the under-cabinet light, the TV, candles and fairy lights bring pools of colour back.

| Photo feature | In the map |
| --- | --- |
| pine ceiling with exposed beams and black steel I-beams over the room | the top 13 px of every wall stamp is the pine ceiling edge with beam ends that join across stamps (`ceiling`), a black steel beam over the stairs and over the glass door (`steel_beam`) |
| the kitchen run: four white upper cabinets with a red-bow Christmas bouquet, dried flowers and plastic bottles on top, a steel tap over the sink, soap and a green bottle, a built-in oven, a tall white unit with a duct | `circe_wall_kitchen` (6 wide, x 12 to 17) |
| the tall white cube shelves with a row of bottles on top, board games, books, plants, a yellow giraffe and white cupboards below | `circe_wall_shelf` (3 wide, x 7 to 9) |
| the white door with a red and white "STAFF ONLY" sticker: the bathroom door (the photos show it only here, between the shelves and the kitchen) | `circe_wall_door` (2 wide, x 10 to 11); Giusy stands at the point `giusy`, (11, 5), right in front of it |
| the white stair stringer with fairy lights, a steel pole and a diagonal handrail, a film poster, polaroids, a plant on a step, dark grey wall behind the TV | `circe_wall_stairs` (6 wide, x 1 to 6), five flickering fairy light pools |
| the TV on its low white four door cabinet, pink and blue picture, a small white Christmas tree with lights beside it | `circe_tv_unit` (3 x 2, the screen sits on the wall base), `circe_xmas_tree` |
| the navy two seat sofa with wide arms, a red damask throw and patterned cushions, a grey blanket on the back | `circe_sofa_front_throw` (3 x 2), Ros stands in front of it (point `ros`), the plain navy `circe_sofa_front` |
| the sofa opened into a bed with a quilted grey cover and a black metal frame | `circe_sofa_bed` (3 x 4), not used in this room, for the night scene |
| the framed scratch-off world map over the sofa, coats on a hook, two small photos | `circe_wall_sofa` (5 wide, x 18 to 22): the map in a white frame, a lime and a dark coat, the peach wall |
| the glass door with a white curtain and the dark night outside, a tall steel floor lamp with two heads, an electric scooter, a red bromeliad on the floor | the glass door and curtain in `circe_wall_sofa`, `circe_floorlamp` (1 x 3, heads in the `above` layer), `circe_scooter`, `circe_plant_red`, warm pools of light |
| the long dinner table with a red damask cloth, golden plates, cups with forks, a candle, clear acrylic ghost chairs and white wooden folding chairs | `circe_table` (4 x 2), `circe_chair_ghost_n/s/e/w`, `circe_chair_white_n/s/e/w`, a candle light that flickers |
| the pink pouf, the low wooden coffee table with a pink bowl, a beer bottle and a remote in front of the TV | `circe_beanbag`, `circe_coffee_table` (2 x 1), `circe_rug` (5 x 3, an addition: the photos show bare tiles) |
| large pale beige floor tiles | `circe_floor_a` to `circe_floor_d`: one 64 px tile cut in four, placed by the parity of x and y |
| a white coat stand with fairy lights, a steel bowl of pasta in the corner | `circe_coatstand`, `circe_bowl`; the front door at the bottom left is `circe_entrance` with `circe_doormat` (CIAO) |

Reusable pieces for the `divano` room (night, the same sofa): `circe_sofa_front`, `circe_sofa_front_throw`, `circe_sofa_back` (seen from behind, facing a TV on the north wall), `circe_sofa_back_throw`, `circe_sofa_bed`, `circe_tv_unit` (put it at the wall base so its screen overlaps the wall rows), `circe_wall_stairs` (the TV wall without the TV), `circe_coffee_table`, `circe_rug`, `circe_beanbag`, `circe_floorlamp`, `circe_xmas_tree`; the wall stamps are 4 tiles tall and `walls` layer, so a new map blocks their cells with `m.block`. Import nothing from Python: just name the stamps in `m.stamp(...)`, the registry has them already because every module of `scripts/art/stamps/` is loaded for the whole sheet.

## Casa Circe late at night (divano), photo feature -> map

The room is 22 x 12 tiles, the same flat as `circe` on the night of the story, rebuilt from `casa-circe-divano-aperto.jpeg`, `casa-circe-scale-tv.jpeg` and `casa-circe-tavolo-divano.jpeg`. Stamps are in `scripts/art/stamps/divano.py` (it loads `circe.py` as a library for the navy sofa), the map in `scripts/art/rooms/divano.py`. The back wall is the `circe_wall_*` pictures in a new order: stairs and TV, the sofa wall, the shelves, the kitchen. The mood is a dark blue night (`#424e80`); the TV, the fairy lights, the standing lamp, the tree and the last candle bring pools of colour back. The scene has no door and no friend: the flow plays the arrival, the meeting, the eggs and the join with Ric standing at the spawn (the map still needs a `door` point, which is never used), and then the ending scene (`src/game/ending`) draws this same map as its backdrop, reading `tv` and the `seat_*` points of the table below. In the ending the map is drawn from the top left corner of the screen, so a map pixel is a screen pixel, and the credits column covers everything right of x 400.

| Photo feature | In the map |
| --- | --- |
| the sofa opened into a bed: a navy back with two thick cushions and wide arms, a quilted pale grey cover, a black metal frame with folded legs (`divano-aperto`) | `divano_sofa_bed` (3 x 4 at tile 9, 4): the navy sofa of `circe_sofa_front`, diamond stitching with loose wrinkles, a pillow at the head, the frame and legs at the foot; all its cells are blocked, the party sits on it in the ending |
| the scratch-off world map on the wall over the sofa, two coats on hooks at its left, a black steel beam in the ceiling corner (`divano-aperto`, `tavolo-divano`) | `circe_wall_sofa` at tile 7: the map, a lime and a dark coat, the beam |
| the glass door with a white curtain and the dark night outside, a tall steel floor lamp with two heads, an electric scooter (`divano-aperto`, `tavolo-divano`) | the glass door and curtain in `circe_wall_sofa`, `circe_floorlamp` at tile 7, `circe_scooter` at tile 8, warm pools of light |
| a low glass top table by the curtain with a pizza box, a bag of fries and a glass (`divano-aperto`); the same table with two laptops, a notebook and papers (`tavolo-divano`) | `divano_glass_table` at (7, 6) and `divano_study_table` at (10, 10) |
| a pair of grey slippers on the floor at the right of the bed (`divano-aperto`) | `divano_slippers` at (12, 8) |
| large pale beige floor tiles (all photos) | `circe_floor_a` to `d`, as in `circe` |
| the TV on its low white four door cabinet, wide picture, headphones and a small toy on top (`scale-tv`) | `divano_tv_unit` (4 x 3 at tile 2, 3): the screen is 96 x 54 px at (16, 6) inside the stamp, the ending lays the fish documentary on it |
| the white stair stringer with fairy lights, a film poster, polaroids, a plant on a step, the steel pole and the diagonal rail, a dark grey wall behind the TV, pine ceiling with beams (`scale-tv`) | `circe_wall_stairs` at tile 1, five flickering fairy light pools |
| a small white Christmas tree with lights beside the TV, a pink pouf, the low wooden table with a pink bowl, a beer bottle and a remote (`scale-tv`) | `circe_xmas_tree` at (6, 4), `circe_beanbag` at (6, 7), `circe_rug` and `circe_coffee_table` at (2, 6) and (3, 7) |
| the white cube shelves of bottles and board games, the kitchen run, the long table with the red damask cloth and white and clear chairs, left from the dinner (`circe` photos) | `circe_wall_shelf` at tile 12, `circe_wall_kitchen` at tile 15, `circe_table` at (16, 7) with its chairs and a candle |
| blue and violet light of the screen over everything, the room otherwise dark | mood `#424e80`, a pulsing violet pool on the TV, blue pools on the rug and on the bed |
| the party on and around the bed (the story text; the photos have people on the sofa and standing in front of the TV, redrawn here as our own characters) | the points `seat_bed_l`, `seat_bed_r`, `seat_bed_foot`, `seat_chair_l`, `seat_chair_r`, `seat_pouf`, `seat_floor` and `seat_cat`: the ending seats Liscio and Ric (or Ros) against the backrest, Lara lying across the foot, Giusy and Ros (or Ric standing) on two white chairs, Lollino behind the pink pouf, Giuggiu asleep on the floor, the cat if its minigame was won |
