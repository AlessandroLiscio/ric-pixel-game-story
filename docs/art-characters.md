# Character art (chibis and portraits)

Every character sprite and parametric portrait is drawn by code from `src/data/people.json`. No photo is copied, converted or traced: the photos were only looked at to choose a few abstract traits per person (see the list at the end).

## How to run

Create a virtual environment outside the repository once and install the pinned dependency (Pillow only), then run the generator from the repository root.

```powershell
python -m venv "$HOME\.venvs\chibis"
& "$HOME\.venvs\chibis\Scripts\python.exe" -m pip install -r scripts\art\requirements-chibis.txt
& "$HOME\.venvs\chibis\Scripts\python.exe" scripts\art\chibis.py
```

A clean run prints one `OK` line per stage (sheets, portraits, check) and `PASS characters: 11 sheets 96x128, 10 portraits 96x96`. On a failure it prints a `FAIL` line with the log path and the first error. The full log of each stage is written to `logs/chibis/run_<timestamp>/<stage>.log` (the last 10 runs are kept; the folder must stay out of git). `--verbose` also streams the log to the console and `--preview <path>` writes a contact sheet PNG of every sheet and portrait (a review aid, not committed).

The outputs are `public/assets/characters/<id>.png` (sheet 96x128) and `public/assets/characters/<id>-portrait.png` (portrait 96x96). The cat has a sheet and no portrait. The portraits of this folder are the parametric variant; the flow routes them to `public/assets/portraits/<id>.png` (`portraitSource: "parametric"`), the dialogue worker owns the photo-based variant there.

## Sheet layout

Each sheet is 3 columns by 4 rows of 32x32 frames. Rows are down, left, right, up (the RPG Maker order). Columns are step-left, stand, step-right. The right row is the left row mirrored. On the step frames the body drops 1 px and the lifted leg and the swinging arm alternate, so the walk reads as a two-step cycle. Texture keys are `char-<id>` and `portrait-<id>`.

## How to change a trait

Edit the person in `src/data/people.json` and run the generator again. Nothing else needs touching.

- `skin`: `light`, `tan` or `olive`.
- `hair`: length, `short`, `medium`, `long` or `tied`. For the long styles it decides how far the hair falls over the back (`medium` ends at the shoulders, `long` mid back).
- `hairStyle`: `short`, `side-part`, `curly`, `long-wavy`, `long-straight`, `bob-bangs`, `tied-back` (a bun) or `ponytail`.
- `hairColor`: `black`, `brown`, `chestnut`, `auburn` or `grey`. The outline tone of the sprite follows the hair colour (navy for black and grey, brown for brown and chestnut, plum for auburn).
- `outfitTop`: `garment:colour[:pattern]`. Garments: `tee`, `shirt` (short sleeves), `shirt-long`, `tank`, `dress` (adds a flared skirt). Patterns: `floral`, `stripes`, `logo`, `buttons`, `chain` (no pattern pixels, the necklace is an accessory).
- `outfitBottom`: `garment:colour/shoeColour`. Garments: `shorts`, `trousers`, `skirt`, `dress` (the skirt of the dress, so legs show skin). The shoe colour is optional (white by default).
- Colours of outfits: `maroon`, `white`, `grey`, `navy`, `yellow`, `green`, `mint`, `blue_l`, `khaki`, `cream`, `charcoal`, `pink`, `orange`, `red`.
- `accessory`: any of `beard`, `stubble`, `sunglasses`, `sunglasses-on-head`, `glasses`, `necklace`, `tie`.
- `height`: 0.9 to 1.1. Up to 0.93 gives short legs, from 1.08 long legs, anything between is the standard body. Only the legs change, so every character stays inside the 32x32 frame.

To add a new colour or a new hair style, edit the `PAL` table or the `hair_down`, `hair_up`, `hair_side` functions and the portrait branch in `draw_portrait` in `scripts/art/chibis.py`. The sprite palette has 28 named colours shared by every character (the check step fails when a sheet uses a colour outside it), each portrait uses at most 16 colours, and every sprite gets a 1 px outer outline in its own darker tone.

## The people in prose

Ric (hero) is tall, tan, with a dark brown bun, a dark beard, sunglasses, a maroon floral shirt, khaki shorts and dark sneakers. Lara has light skin, chestnut wavy shoulder length hair and a white button dress. Liscio has tan skin, short brown curly hair, stubble, a grey tee with a chain and khaki shorts. Ros is short with an auburn bob and blunt bangs, a dark floral tank top and navy shorts. Lollino has tan skin, big black curls, a beard, sunglasses pushed up on the hair and a navy tee. Fede has light skin, long straight brown hair with a centre part, a yellow floral top and a cream skirt (easter-egg NPC only). Giuggiu has tan skin, short black hair, a short beard, a white tee with a dark logo and navy shorts. Giusy has olive skin, very long wavy black hair and a dark floral dress. Prof. Pinolo (professor) is older with grey side-parted hair, round dark glasses, a light blue striped shirt, a red tie and dark trousers. Gatto is a calico cat: white with orange patches and brown tabby patches, green eyes, a striped tail, drawn as a 3x4 sheet with a two-step walk. La sconosciuta is a generic girl with a chestnut ponytail and a mint dress.

## Traits that came from the photos

Only these choices came from looking at the group photo, the professor photo and the cat photo. Nothing was copied.

- Ric: beard, sunglasses, hair tied up in a bun, dark red floral shirt, khaki shorts, the tallest of the group.
- Lara: long wavy light chestnut hair, white button-up sundress.
- Liscio: dark curly hair, light beard growth, grey tee with a pendant chain, khaki shorts.
- Ros: reddish hair with bangs at chin length, dark floral strap top.
- Lollino: curly dark hair, beard, sunglasses worn on top of the head, dark navy tee, khaki shorts.
- Fede: long straight dark brown hair, yellow floral top.
- Giuggiu: short dark hair, short beard, white tee with a logo print, dark shorts.
- Giusy: long dark wavy hair, tan skin, dark floral dress.
- Prof. Pinolo: short grey-brown hair, round dark glasses, light blue striped shirt.
- Gatto: calico coat (white, orange and brown tabby patches), as in the cat photo.
- La sconosciuta: no photo, invented.

Skin tones were matched only to the nearest of the three shared tones. A photo-based portrait variant needs each friend's consent and is out of scope here.
