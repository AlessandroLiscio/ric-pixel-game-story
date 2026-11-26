# ric-pixel-game-story

A pixel-art story game of about 20 minutes, written in Italian, for a friend's 30th birthday. It is a short walk through five scenes, each with a friend, a small minigame, a litter bin with an item to use and an RPG Maker style dialogue box, ending in a credits roll at Casa Circe while the night's last talk goes on, one line per press of X; easter eggs show a small achievement popup. It runs in the browser from a GitHub Pages link and also from an offline zip that works by double-clicking `index.html`.

The engine is [Phaser](https://phaser.io) 4.2.1 on the official Vite + TypeScript template, on a 1280x720 canvas (scenes keep 640x360 coordinates under a camera zoom of 2; the window zoom steps by 0.5, press F for fullscreen). All music and sound effects are generated in code on one shared `AudioContext`, under one quiet looping ambient bed per scene (recorded loops, see Credits and licences); the pixel font is Pixel Operator (CC0).

## Run it

Needs Node 22.2 or newer and Google Chrome (the proof scripts drive the installed Chrome; no browser is downloaded).

```
npm install
npm run dev-nolog
```

The game opens at http://localhost:8080.

## Proof scripts

Every script is quiet: it prints one PASS line, or a FAIL line with at most five lines of detail, and keeps full output under `logs/` (gitignored). The exit code is 0 only on success.

| Command | Success line |
|---|---|
| `npm run spike-nolog` | `PASS spike: Phaser APIs, font glyphs, file URL` |
| `npm run build-nolog` | `PASS build` |
| `npm run verify-production-nolog` | `PASS production: no test skip key` |
| `npm run verify-offline-nolog` | `PASS offline: no network requests, title screen loaded` |
| `npm run verify-pages-nolog` | `PASS pages: title screen loaded` |
| `npm run check-privacy-nolog` | `PASS privacy: no reference photos or secrets in index, history, or build` |
| `npm run test:e2e-nolog` | `PASS e2e: 5 scenes, 6 minigames, no console errors` |

`verify-pages-nolog` checks the live site and fails until GitHub Pages is deployed. `npm run typecheck-nolog` runs the TypeScript check (it is also the first step of the build).

`test:e2e-nolog` (`scripts/e2e.mjs`, about 2.5 minutes) builds the offline single file twice into `logs/e2e/`, once as a test build (`VITE_TEST_BUILD=1`, `dist/`) and once as production (`dist-prod/`), and opens both in Chrome through `file://`. In the test build it plays the title, all five scenes, all six minigames, the ending and the replay from the title: the first scene is walked with real key presses only, the quiz (id `simon`), mash and d20 are played with real key presses, the Cortile fetches Ros and Giusy from the bar, and slackline, cat-smoke (lost on purpose) and rhythm are forced through `window.__ricTest`. At the Cortile it checks that the two lads walk over to Ros and Giusy and the hooded man walks up to Lara; in the ending that a credits line waits for X, that the room laughs after the TV line and that the finale follows the last line. After the replay it also runs the cat-smoke regression: the right sofa picked the moment the cat hides, before the countdown, must win. It fails on any console error, failed request or request that is not `file:` or `data:`, and when the number of distinct minigames entered is not 6. In the production build it checks that the title renders, the game starts, and `window.__ricTest`, the `__RIC_TEST_SKIP__` key and the debug keys are absent. The step log is `logs/e2e/steps.log`.

## Builds

`npm run build-nolog` writes two outputs. `dist/` is the Pages build (`base: './'`). `dist-offline/index.html` is a single self-contained file (code, fonts and images inlined, no network request) built with `vite-plugin-singlefile`, and `dist/ric-pixel-game-story-offline.zip` holds it. Game assets under `public/assets/` are referenced through `assetUrl()` from the `asset-url` module, which returns a relative URL in the Pages build and a `data:` URI in the offline build; never load an asset by a hand-written path.

The test skip key (`__RIC_TEST_SKIP__`, defined once in `src/game/testKey.ts`) exists only in a build made with `VITE_TEST_BUILD=1`. Pages and the offline zip never contain it, which `verify-production-nolog` checks.

## Folder map

| Path | Holds |
|---|---|
| `src/game/` | game code: `flow`, `ui`, `audio` (and `audio/music`), `party`, `transitions`, `debug`, `minigames/*`, `ending`, `ambient`, `scenes` (title) |
| `src/data/` | story, people and scene data (JSON) |
| `src/spike/` | the W0 spike scene, loaded only with `?spike=1` |
| `public/assets/` | `backgrounds`, `characters`, `portraits`, `fonts`, `tiles`, `ambient` (the five sound loops) |
| `scripts/` | build, verify and check scripts; `scripts/art/` holds the art pipelines |
| `tests/` | end-to-end tests |
| `vite/` | Vite configs: dev, Pages build, offline build |
| `docs/` | notes; `docs/w0-spike.md` records the setup spike |
| `.github/workflows/` | `ci.yml` (pull requests) and `pages.yml` (deploy on push to `main`) |

## Credits and licences

The ambient beds come from the free sound effects of [vinish.dev](https://vinish.dev/free-sound-effects), licence [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); the credits roll of the game names them ("Effetti e suoni: vinish.dev (CC BY 4.0)"). Files in `public/assets/ambient/`, unchanged, 16 s seamless loops in the category `ambient-places`, played by `src/game/audio/Ambience.ts` (quiet, under the music, faded on every scene change, muted with the rest of the sound):

| File | Scene |
|---|---|
| `city_traffic_loop.ogg` | cortile |
| `office_room_loop.ogg` | universita (the cinema) |
| `clock_room_loop.ogg` | giuggiu and circe |
| `forest_day_loop.ogg` | giardini |
| `crickets_field_loop.ogg` | divano |

Other credits: the pixel font Pixel Operator (CC0), the pixelfx effects (MIT, `src/vendor/pixelfx/LICENSE`), the Phaser engine (MIT).

## Privacy

`reference_photos/` is private. It is gitignored, it must never be committed, copied into `public/` or built, and no photo may be uploaded to a service without the depicted person's consent. `npm run check-privacy-nolog` checks the index, the whole history and the build outputs for it.
