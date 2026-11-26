# pxl art sources

Pixel art drawn with pxl, the skill vendored in `.claude/skills/pxl` (provenance in `.claude/skills/PROVENANCE.md`). It needs Node 22.18 or later and no install. Never run its `serve` command or `npx github:...`.

## Objects

`objects.px.js` draws eight key room objects (and the carbonara pickup below): `giuggiu_sofa_burgundy`, `giuggiu_sofa_navy`, `giuggiu_table_black`, `giuggiu_tv`, `circe_sofa_back`, `giardini_bench_wood`, `giardini_lamp` and `cortile_table_big`. Each sprite is its stamp's size minus 2 px on both axes, and `selout` adds the outline, so the built PNG has exactly the size of the stamp (a multiple of 32): collision and masks stay as they were. The palette is set explicitly (the game's own ramps, no pico8) at the top of the file, lit from the top left like the tiles. To change an object, edit the sprite and run, from the repository root:

```powershell
node .claude\skills\pxl\bin\pxl.js build scripts\art\pxl\objects.px.js --out scripts\art\pxl\out --no-preview
& "$HOME\.venvs\chibis\Scripts\python.exe" -I scripts\art\build_world.py
```

`objects.px.js` also draws `carbonara`, a plate of spaghetti carbonara that is not a stamp: it is a 32x32 pickup, copied after the build to `public/assets/objects/carbonara.png` (texture key `obj-carbonara`):

```powershell
Copy-Item scripts\art\pxl\out\sprites\carbonara.png public\assets\objects\carbonara.png
```

The PNGs in `out/sprites/` are committed, so `build_world.py` needs only Python. The stamp modules load them with `pxl_object(name, shadow)` from `tilepaint.py`, which draws the soft ground shadow first and pastes the PNG over it.

## Walk sheets

`lint_sheets.py` runs `pxl lint` on every 32x32 frame of every sheet in `public/assets/characters` and prints one line, `PASS pxl lint: 300 frames of 25 sheets, 0 findings`. The shading, the selective outline and the clean-up that make it pass are in `scripts/art/sprite_shade.py`, called by `chibis.py` (see `docs/art-characters.md`).
