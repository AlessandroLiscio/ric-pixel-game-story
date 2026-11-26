# Character art (chibis and portraits)

Every character sprite and parametric portrait is drawn by code: the sprites from `src/data/people.json`, the portraits from the `FACES` table in `scripts/art/portraits.py`. No photo is copied, converted or traced: the photos were only looked at to choose traits per person (see the lists at the end).

## How to run

Create a virtual environment outside the repository once and install Pillow and numpy (the portraits need numpy), then run the generator from the repository root.

```powershell
python -m venv "$HOME\.venvs\chibis"
& "$HOME\.venvs\chibis\Scripts\python.exe" -m pip install -r scripts\art\requirements-chibis.txt
& "$HOME\.venvs\chibis\Scripts\python.exe" scripts\art\chibis.py
```

A clean run prints one `OK` line per stage (sheets, portraits, check) and `PASS characters: 25 sheets 96x128, 25 portraits 96x96`. On a failure it prints a `FAIL` line with the log path and the first error. The full log of each stage is written to `logs/chibis/run_<timestamp>/<stage>.log` (the last 10 runs are kept; the folder must stay out of git). `--verbose` also streams the log to the console and `--preview <path>` writes a contact sheet PNG of every sheet and portrait (a review aid, not committed).

The outputs are `public/assets/characters/<id>.png` (sheet 96x128) and `public/assets/portraits/<id>.png` (portrait 96x96). The cat has a sheet and a portrait (`draw_cat` in `scripts/art/portraits.py`).

The portraits are painted faces in the RPG Maker VX Ace face style. `scripts/art/portraits.py` draws each one at 4x (384x384) from ellipses, polygons and tapered Bezier strokes: cel shading with a cool shadow rim and a warm light rim, a cast shadow from the hair on the face and from the chin on the neck, coloured line art, eyes with iris, pupil and two highlights, and per-person hair (bun, swept back, curls, quiff, side part, long wavy, long straight, bob with bangs, ponytail), beard, glasses and clothes. It then takes an 80x80 close-up window, reduces it to 96x96 with a hard alpha edge (transparent background, so the dialogue panel shows through) and quantises it to at most 64 colours. To change a face, edit its entry in `FACES` (skin, hair, eyes, style, face width and chin, brows, eye size, mouth, beard, accessories, top) and rerun the generator. The portraits are the parametric variant (`portraitSource: "parametric"`); a photo-based variant would replace a file in the same folder only for a friend who agreed to a public likeness.

## Sheet layout

Each sheet is 3 columns by 4 rows of 32x32 frames. Rows are down, left, right, up (the RPG Maker order). Columns are step-left, stand, step-right. The right row is the left row mirrored. On the step frames the body drops 1 px and the lifted leg and the swinging arm alternate, so the walk reads as a two-step cycle. Texture keys are `char-<id>` and `portrait-<id>`.

## How to change a trait

Edit the person in `src/data/people.json` and run the generator again. Nothing else needs touching.

- `skin`: `light`, `tan` or `olive`.
- `hair`: length, `short`, `medium`, `long` or `tied`. For the long styles it decides how far the hair falls over the back (`medium` ends at the shoulders, `long` mid back).
- `hairStyle`: `short`, `side-part`, `curly`, `long-wavy`, `long-straight`, `bob-bangs`, `tied-back` (a bun), `ponytail`, `fringe-straight` (long straight hair with a blunt fringe straight across the brow), `fade` (a short top with the sides and nape cut to the skin), `quiff` (forehead open, the top gelled up and forward) or `hood` (a hood up: the head is cloth of the colour of the top, the eye band in shadow with two pale glints; the hair colour only sets the outline tone).
- `hairColor`: `black`, `brown`, `chestnut`, `auburn`, `grey` or `blonde`. The outline tone of the sprite follows the hair colour (navy for black and grey, brown for brown, chestnut, auburn's plum and blonde).
- `outfitTop`: `garment:colour[:pattern]`. Garments: `tee`, `shirt` (short sleeves), `shirt-long`, `tank`, `dress` (adds a flared skirt), `track` (a zip-up tracksuit top: long sleeves, a white stripe down each sleeve, a white collar), `hoodie` (long sleeves, to wear with the `hood` hair style). Patterns: `floral`, `stripes`, `logo`, `buttons`, `chain` (no pattern pixels, the necklace is an accessory), `zip` (a white zip down the middle, for `track`), `pocket` (a kangaroo pocket and two drawstrings, for `hoodie`).
- `outfitBottom`: `garment:colour/shoeColour`. Garments: `shorts`, `trousers`, `skirt`, `dress` (the skirt of the dress, so legs show skin). The shoe colour is optional (white by default). The shoe `sandal` is a Birkenstock look: a cork sole, bare toes and a cork strap across the instep, so skin shows on the foot.
- Colours of outfits: `maroon`, `white`, `grey`, `navy`, `yellow`, `green`, `mint`, `blue_l`, `khaki`, `cream`, `charcoal`, `pink`, `orange`, `red`.
- `accessory`: any of `beard`, `stubble`, `sunglasses`, `sunglasses-on-head`, `glasses`, `necklace`, `tie`.
- `height`: 0.9 to 1.1. Up to 0.93 gives short legs, from 1.08 long legs, anything between is the standard body. Only the legs change, so every character stays inside the 32x32 frame.

To add a new colour or a new hair style, edit the `PAL` table or the `hair_down`, `hair_up`, `hair_side` functions in `scripts/art/chibis.py`, and the matching style in `hair()` in `scripts/art/portraits.py`. The sprite palette has 30 named colours shared by every character, each with a derived shade, light and dark tone (`<name>.s`, `.l`, `.d`, made by `derive` in `scripts/art/sprite_shade.py`: cool shade, warm light, a tone within 12 of an existing colour snaps to it; the three skins keep their hand picked `_s` shade). The check step fails when a sheet uses a colour outside the table, each portrait uses at most 64 colours.

Every frame is finished by `sprite_shade.polish` after the right row is mirrored, so the light is on the top left in all four rows like the tiles: the top and left rim of each material is lit, its right and bottom rim shaded (two pixels on hair, which also gets a highlight crescent), the hair casts a shade onto the forehead, a shirt shades its hem, and the 1 px outer outline is selective (the dark tone of the darkest material it touches, as pxl's `selout`) with its L corners dropped so it steps diagonally. Then stray pixels are merged and doubled corners in thin lines removed, which is what `pxl lint` asks for.

The gate is `python -I scripts/art/pxl/lint_sheets.py`: it runs `pxl lint` (the skill in `.claude/skills/pxl`, Node 22.18 or later, no install) over all 300 frames and must print `PASS pxl lint: 300 frames of 25 sheets, 0 findings`. The sheets before this pass had 174 findings (126 orphan pixels, 48 jaggies).

## The people in prose

Ric (hero) is tall, tan, with a dark brown bun, a dark beard, sunglasses, a maroon floral shirt, khaki shorts and dark sneakers. Lara has light skin, chestnut wavy shoulder length hair and a white button dress. Liscio has tan skin, short brown curly hair, stubble, a grey tee with a chain and khaki shorts. Ros is short with an auburn bob and blunt bangs, a dark floral tank top and navy shorts. Lollino has tan skin, big black curls, no beard, sunglasses pushed up on the hair and a navy tee. Fede has light skin, long straight brown hair with a centre part, a yellow floral top and a cream skirt (easter-egg NPC only). Giuggiu has tan skin, short black hair, no beard, a white tee with a dark logo and navy shorts. Giusy has olive skin, very long wavy black hair and a dark floral dress. Prof. Pinolo (professor) is older with grey side-parted hair, round dark glasses, a light blue striped shirt with an open collar and dark trousers. Gatto di Paz (speaker id `gatto`) is a calico cat: white with orange patches and brown tabby patches, green eyes, a striped tail, drawn as a 3x4 sheet with a two-step walk. La sconosciuta is a generic girl with a chestnut ponytail and a mint dress.

Round 4 adds seven invented people (role `npc`, no photo, nothing traced). La tipa con la frangetta (`frangetta`) has light skin, long straight dark brown hair with a blunt fringe, a white tank top, a khaki skirt and cork Birkenstock sandals with straps. The three Ragazze al parco (`slackgirl1`, `slackgirl2`, `slackgirl3`, for the Giardini) are a light-skinned blonde with long wavy hair, a pink tank and navy shorts; an olive-skinned girl with a black ponytail, a green tee and charcoal shorts; and a tan girl with short chestnut curls, an orange tank and navy leggings. The two Ragazzi albanesi (`albanese1`, `albanese2`, for the Cortile bar) are young men with a friendly, a little cocky look and no caricature: the first has tan skin, black hair in a fade cut, stubble and a navy tracksuit top with a white zip and sleeve stripes; the second has light skin, a gelled brown quiff and a white long-sleeve shirt with an open collar. Losco figuro (`losco`) wears a charcoal hoodie with the hood up, so his face is in shadow with only two pale glints for the eyes, and a little stubble below.

The painted portraits of the seven use new `FACES` entries: `style="fringe"` (the long straight hair with the fringe at brow height), `style="fade"` (a short top, the temples shaded by an `extras` mask), `style="hood"` (a cowl round the face and `hood_shadow` darkening the face, with `hair="hoodie"` as the cloth colour), the tops `track` and `hoodie`, the hair colour `blonde` and the eye colour `blue`. `bcol` now also sets the stubble colour, and `curls` has five more curls over the forehead so the crown closes.

The carbonara plate is not a person: `carbonara` in `scripts/art/pxl/objects.px.js` is a 32x32 pickup (texture key `obj-carbonara`, `public/assets/objects/carbonara.png`), see `scripts/art/pxl/README.md`.

## Traits that came from the photos

Only these choices came from looking at the group photo, the professor photo and the cat photo. Nothing was copied.

- Ric: beard, sunglasses, hair tied up in a bun, dark red floral shirt, khaki shorts, the tallest of the group.
- Lara: long wavy light chestnut hair, white button-up sundress.
- Liscio: dark curly hair, light beard growth, grey tee with a pendant chain, khaki shorts.
- Ros: reddish hair with bangs at chin length, dark floral strap top.
- Lollino: curly dark hair, no beard, sunglasses worn on top of the head, dark navy tee, khaki shorts.
- Fede: long straight dark brown hair, yellow floral top.
- Giuggiu: short dark hair, no beard (the owner's call, round 4), white tee with a logo print, dark shorts.
- Giusy: long dark wavy hair, tan skin, dark floral dress.
- Prof. Pinolo: short grey-brown hair, round dark glasses, light blue striped shirt with an open collar and no tie.

The painted portraits add, from the same photos (round 3 likeness pass, features chosen by eye, nothing traced): Ric's long narrow face, thick brows, full dark beard with moustache, and a messy bun with loose tufts and wisps at the temples. Lara's tan olive skin, long dark brown wavy hair with sun-bleached lighter ends, very thick dark brows, a closed half smile, a small mole on the right cheek and long beaded earrings (blue, white, orange, black) hanging over the hair. Liscio's swept-back dark hair, thick straight brows, heavy-lidded eyes, a dense short beard with moustache, a small silver hoop in the right ear, the chain with a pendant and a closed smile. Ros's chin-length copper-red bob with bangs, a softer smirk instead of a flat mouth, big gold hoops with a small one above, and two gold chains. Lollino's lighter skin, dark brown tousled wavy hair swept up with a lock falling on the forehead (in place of the old tight curls), hazel-green eyes, thick arched brows, no beard, a wide smile and the sunglasses pushed up on the hair. Fede's centre-parted straight hair and wide smile (no photo, unchanged). Giuggiu's tan skin, the earlier short black quiff (the owner's choice), thick brows, no beard and a closed smile, with the logo tee. Giusy's lighter tan skin, long straight black hair with a side part, a wide smile with teeth and a thin silver pendant chain (no earrings). Prof. Pinolo's brown-grey side-swept fringe, a broad face, thick black round glasses, faint smile lines and the open striped collar. The portraits use their own colours, so a skin or hair tone there can be closer to the photo than the shared sprite palette allows.
- Gatto di Paz: calico coat (white, orange and brown tabby patches), as in the cat photo.
- La sconosciuta: no photo, invented.

Skin tones were matched only to the nearest of the three shared tones. A photo-based portrait variant needs each friend's consent and is out of scope here.

Extras (comparse) added from the photos in `reference_photos/personaggi/comparse/` (viewed only): Alessandro, the waiter (white shirt, swept black hair, stubble, wide smile), barista of the Cortile Cafe; Rosanna (long black hair, tie-dye bucket hat, aviators, black tee under a brown fleece vest), at the Giardini; Ric's parents (dad: a short beard the grey of his hair, dark hair, blazer over a navy shirt; mum: long ash-grey wavy hair, red headband, rectangular glasses, brown jacket), at the Giardini; Roberto (top hat, red bow tie, light-brown hair, short beard), Armando (messy dark hair, goatee, flannel shirt over a black hoodie) and Carolina (copper hair, red lips, nose ring, black top) have a sprite and a portrait but no scene yet.

Portrait traits of the extras after the round 3 likeness pass (chosen by looking only): Alessandro keeps his earlier portrait (swept black hair, stubble, wide smile, open white collar), the owner's choice. Rosanna has very long dark brown hair, the tie-dye bucket hat with its red chin cord, teardrop aviator sunglasses with a thin gold frame (a new accessory, `aviator`), a neutral mouth and the brown fleece vest. Roberto has a long narrow face, hazel eyes, a short scruffy beard, a warm one-sided smile, a few dark curls sticking out under the top hat at ear level and the red bow tie. Armando has a pale narrow face, a big messy dark brown quiff swept up and back, heavy straight brows, a thin moustache with a goatee and a neutral mouth. Carolina has long loosely wavy ginger hair with a side part, thin copper brows, dark red lips, a smile and the nose ring. Dad keeps his earlier portrait (salt-and-pepper quiff, smile lines), the owner's choice, but since round 4 with a short beard the grey of his hair instead of the full one. Mum has long silver-brown wavy hair, a thin red headband, rectangular dark glasses, forehead and smile lines and a warm grin.

New `FACES` keys of this pass, all optional: `style="tousle"` with `vol`, `drop`, `bumps` and `fringe`; `part` (x of the parting for `longstraight` and `longwavy`); `ombre` (colour of lighter hair ends); `bcol` (beard colour); `browcol` (brow colour); `gframe` and `gthick` (round glasses frame colour and thickness); `messy` (loose tufts on the bun); accessories `aviator`, `mole`, `browlines`, `hoop`, `bighoops`, `beadearrings`, `goldchain` and `sidecurls`.
