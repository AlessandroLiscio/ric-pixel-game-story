# pixelfx effects

The game uses the pixelfx library (https://github.com/patch-gg/pixelfx, MIT, 244 code-only pixel effects, no dependencies) for transitions, celebrations, smoke and ambient light. The library is vendored unchanged in `src/vendor/pixelfx` (`PROVENANCE.md` has the source commit and the scan result, `LICENSE` and `NOTICE.md` the licences); `.claude/skills/pixelfx` is the upstream skill with a `NOTE.md` that forbids its `curl | sh` publishing line.

## How it works

An effect draws pixels into a frame (colour plus an additive light buffer) from a small simulation that steps at 30 Hz. The bridge `src/game/fx/PixelFx.ts` gives every playing effect a frame the size of the effect's own canvas (`meta.size`), composites it into a pooled Phaser `CanvasTexture` and shows it as one image, so the cost follows the number and size of the effects and never the 640x360 screen. Images are whole pixels with nearest filtering, like the rest of the game. A scene gets its effects manager on the first `fx.play` and loses all effects when it shuts down. The cap is 12 effects at once per scene (`MAX_ACTIVE`): a new one evicts the oldest one-shot, and is dropped if only loops are left. `fx.play` never throws: a bad id or option is logged and an inert handle comes back, so a broken effect can never stop the story.

```ts
import { fx } from '../fx';
const handle = fx.play(scene, 'ui/confetti', { x: 320, y: 340, scale: 2, world: false });
```

Options of `fx.play` (all in `FxOptions`): `x`, `y` (the effect's origin, see `meta.origin`; world pixels, or screen pixels with `world: false`), `layer` (`front` depth 800, `back` over the ground only, `ysort` sorted with the characters by y) or an explicit `depth`, `only` (`front` or `back`: only the part drawn in front of or behind a character), `palette` (a name from `PALETTES` in `effects.ts`, a library ramp such as `holy`, `ice`, `smoke`, or an array of hex colours dark to bright), `loop` and `loopDelay` (restart a one-shot), `scale` (integer enlargement; x and y are then output pixels), `timeScale`, `startAt` (fast-forward into the effect), `pauseAt` with `onPause` and `resume()` (hold at a moment), `onDone`, `clip` (show only a rectangle), `alpha`, `angle` and `flip`. Every other key goes to the effect itself (`text`, `title`, `count`, `light`, `seed`, ...); the options of an effect are in its `meta.options`. The handle has `stop()` (a loop fades out), `destroy()`, `moveTo(x, y)` and `resume()`.

## Where each effect is used

Scene changes (`src/game/transitions/index.ts`): `fadeToScene` closes a pixelfx wipe over the old scene (320x180 effects shown at 2x), starts the next scene when the screen is fully covered and opens the same wipe in the new scene, with the door sound; the wipe depends on the scene index (iris, diamond wipe, star iris, pixel dissolve, blinds) and the ending always gets the star iris. The black camera fade is the fallback if the effect cannot play.

World (`src/game/fx/moments.ts`, called from `WorldScene`): a minigame result plays `ui/confetti` and `ui/achievement` (Italian title) on a win, `spawn/poof` in grey smoke and `explosions/cartoon-pow` on a loss; a friend joining plays two `pickups/collect-burst` rings (holy and heal palettes) over the follower.

Rooms (`src/game/ambient/index.ts`): the lights of the tile map drive the effects, read at runtime from `map.lights`, so a rebuilt or new room gets them with no change. A group of two or more `pulse` lights (stage spots) throws `weather/god-rays` beams with dust, in the translucent `beams` palette. Smoke puffs (`spawn/poof`, grey) follow the trellone holders listed in `JOINTS` (giuggiu in the giuggiu scene, ros in circe) and end when that person leaves. `flicker` and `steady` lights get nothing, because the map already flickers them.

Minigames (`src/game/minigames/fx.ts`, one call each from the minigame): rhythm plays `impacts/hit-spark` in the lane colour on every hit (two more in white-gold on a perfect) and `ui/combo-counter` every ten hits; cat-smoke adds up to three grey `explosions/smoke-bomb` clouds among its own, semi-transparent so the cat stays visible; slackline puts `spawn/poof` dust in dust colour at the line on a wobble and on the towel when Ric falls; d20 plays `explosions/firework-burst` and `ui/confetti` on a 20, and `spawn/poof` with `explosions/cartoon-pow` on a 1; mash puffs dust at Ric's feet while the button is hammered (at most 7 a second).

Ending (`src/game/ending/fx.ts`): `critters/fish-school` and `critters/jellyfish` swim on the TV screen, clipped to its rectangle, and the finale launches `explosions/firework-rocket` and `explosions/firework-burst` (gold and pink) around "Buon compleanno Ric!" under a `ui/confetti` burst. Everything is placed from the `ENDING_FX` object (TV rectangle, finale point, depths): when the living room is rebuilt, edit only that object.

## How to add an effect

1. Find one: the library's categories are the folders of `src/vendor/pixelfx/fx`; each file's `meta` holds its `size`, `origin`, `duration`, `loop` and `options`. To look at it, write a throwaway node script that calls `createFx` and `composite` from `src/vendor/pixelfx/core/index.js` and writes a PNG (the effects have no dependency on a browser).
2. Import it in `src/game/fx/effects.ts` and add `'<category>/<name>': module` to `EFFECTS`. Only imported effects reach the bundle.
3. Play it with `fx.play(scene, '<category>/<name>', { x, y, ... })`; put a story moment that several scenes share in `moments.ts`, one that belongs to a minigame in `minigames/fx.ts`.
4. Check it on the real game: a test build (`VITE_TEST_BUILD=1`) with `?spike=1` exposes `window.__ricGame` and `window.__ricFx = { fx, stats }` (`stats.updateMs` is the smoothed time of the effects update in milliseconds, `fx.enabled = false` switches every effect off for a baseline).

Traps found while choosing effects: an effect whose `meta.actor` is set (heal, blessing, status effects, melee, hit-flash, heavy-landing, exclamation and about 70 more) draws a grey stock character, so it is not used; `pickups/key-glint` draws a key; the beams of `weather/god-rays` come with a dark haze over its whole canvas unless the first palette step is `0` (the `beams` palette) and a hard floor pool in its last rows (cropped with `clip`); a rotated effect (`angle`) gets a square canvas so it is not cut off; text options (`title`, `text`) take capital letters only.

## Checks

`npm run -s typecheck-nolog`, `npm run -s build-nolog`, `npm run -s verify-production-nolog`, `npm run -s verify-offline-nolog`, `npm run -s check-privacy-nolog` and `npm run -s smoke-walk-nolog`. Frame time was measured in Chrome with Playwright through the test build, with `requestAnimationFrame` deltas over 6 to 8 seconds in the Cortile (stage beams only, then 12 large effects at once as a stress test) and in the ending (credits, finale), each against the same scene with `fx.enabled = false`; the numbers are in the pull request.
