# W0 spike record

Date: 2026-11-24. Machine: Windows 11, Node 24.20.0, npm 11.19.0, Chrome 157.0.8103.79 (the installed one, through Playwright `channel: 'chrome'`).

## Template and versions

- Template: https://github.com/phaserjs/template-vite-ts at commit `d1d7d58acfcf47f97642bcb8b4967071b85f8db9` (default branch head on 2026-11-24, version 1.4.0, MIT). Cloned over HTTPS because the SSH clone through `gh repo clone` failed on host key verification.
- What was taken from it: the Vite config layout (`vite/config.dev.mjs`, `vite/config.prod.mjs`, `base: './'`), the `*-nolog` script convention and the `tsconfig.json` options. What was left out: `log.js` and the `dev`/`build` scripts that run it (it sends a usage ping to Phaser), `terser` (the default esbuild minifier is enough), the demo scenes and images.
- Phaser: 4.2.1 exactly (`npm view phaser@4.2.1 version` printed `4.2.1`; it is the `latest` dist-tag). The template itself pins 4.0.0. No fallback to 3.90.0 was needed.
- Other versions: Vite 6.4.6, vite-plugin-singlefile 2.3.4, TypeScript 5.7.3, Playwright 1.65.1 (`playwright` package, no browser downloaded).

## Documentation used

- Phaser 4.2.1 release: https://github.com/phaserjs/phaser/releases/tag/v4.2.1
- Phaser API pages (the same facts were read in `node_modules/phaser/src`): https://docs.phaser.io/api-documentation/class/core-config (`pixelArt`, `roundPixels`, `audio.context`, `loader.imageLoadType`), https://docs.phaser.io/api-documentation/class/scale-scalemanager (`Scale.FIT`, `refresh`, `getParentBounds`)
- Files read in the installed package: `src/core/Config.js` (`pixelArt` sets `antialias=false`, `roundPixels=true`; `audio.context`; `loader.imageLoadType`), `src/sound/webaudio/WebAudioSoundManager.js` (line 500 uses `config.audio.context`), `src/scale/ScaleManager.js` (`refresh()` does not re-read the parent size, so `getParentBounds()` is called first)
- Vite assets and `?inline`: https://vite.dev/guide/assets
- vite-plugin-singlefile: https://github.com/richardtallent/vite-plugin-singlefile
- Playwright browsers and `channel`: https://playwright.dev/docs/browsers
- Font licence text: https://creativecommons.org/publicdomain/zero/1.0/

## Decisions

- Resolution 640x360, `pixelArt: true`, `roundPixels: true`, `Scale.FIT`. Integer zoom is done in `src/game/zoom.ts`: the game container is resized to an exact multiple of 640x360 (zoom = floor(min(width/640, height/360)), at least 1) on load, window resize and fullscreen change, and `Scale.FIT` then fills it with no fractional scaling. F toggles the browser fullscreen of the whole page (own handler, not Phaser's, so the integer sizing keeps working in fullscreen).
- One `AudioContext`: `src/game/audioContext.ts` creates it, `src/game/main.ts` passes it to Phaser as `audio.context`, and the title scene unlocks it on the first key press. The chiptune sequencer and the SFX synth must use `getAudioContext()`.
- Assets: `public/assets/**` is referenced only through `assetUrl()` (module `asset-url`). The Pages build resolves it to `assets/<path>`; the offline build resolves it to a module that inlines every png/jpg/gif/webp/ttf/woff file of `public/assets` as a `data:` URI (`import.meta.glob` with `?inline`). Phaser loads images with `imageLoadType: 'HTMLImageElement'`, which also accepts `data:` URIs.
- Test skip key: `__RIC_TEST_SKIP__`, one constant in `src/game/testKey.ts`, registered on `window` only when `VITE_TEST_BUILD=1`. Production bundles do not contain the string (verified, with a control build that does contain it).
- Offline zip: written by `scripts/lib/zip.mjs` on `node:zlib` only (about 50 lines, round-trip checked with CRC), so no archive dependency was added.

## Commands run and results

| Command | Output |
|---|---|
| `npm run spike-nolog` | `PASS spike: Phaser APIs, font glyphs, file URL` |
| `npm run build-nolog` | `PASS build` |
| `npm run verify-production-nolog` | `PASS production: no test skip key` |
| `npm run verify-offline-nolog` | `PASS offline: no network requests, title screen loaded` |
| `npm run check-privacy-nolog` | `PASS privacy: no reference photos or secrets in index, history, or build` |
| `npm run test:e2e-nolog` | `FAIL e2e: not implemented (W4)` (expected, exit 1) |
| `npm run verify-pages-nolog` | `FAIL pages` until the Pages deployment exists (expected; run after the first deploy) |

Details are in `logs/<script>/*.log` after a run (gitignored).

## Spike results

- Phaser APIs: `Phaser.VERSION` is `4.2.1`; `Scale.FIT`, `pixelArt`, `roundPixels`, `antialias=false` and the loader type are as configured; `add.text`, `add.particles`, `tweens.add`, `cameras.main.fadeOut`, `textures.createCanvas`, keyboard input and `sound.context` all exist. Renderer used in headless Chrome: WebGL.
- Integer zoom: the canvas measures 1920x1080 in a 1920x1080 window (3x), 1280x720 in 1366x768 (2x) and 640x360 in 1000x600 (1x); internal size stays 640x360 and `image-rendering` is `pixelated`. F entered fullscreen in headless Chrome.
- Audio: the context is `suspended` at load, `running` after a key press, exactly one `AudioContext` is constructed (counted by wrapping the constructor), Phaser's `sound.context` is that same object, and a beep advances the context clock with no error.
- Glyph test: every one of `à è é ì ò ù À È É Ì Ò Ù ’ '` was drawn on a canvas with `PixelOperator, monospace` and with `monospace` alone. The result is non-blank (ink pixels from 9 for the apostrophes to 60 for À), differs from the fallback render (so the glyph exists in the pixel font), each accented letter differs from its base letter, and the twelve accented letters differ from each other. The apostrophes `’` and `'` both render (9 ink pixels each). A screenshot was also looked at once: the Italian sample sentence shows all accents correctly.
- file://: the offline single file (1,713,807 bytes) opens from `file://` with one request (the file itself), no console error, and a drawn title screen; the zip is 390,567 bytes and holds only `index.html`.

## Font licence

Pixel Operator by Jayvee Enaguas (HarvettFox96), CC0 1.0 Universal. File `public/assets/fonts/PixelOperator.ttf`, licence text `public/assets/fonts/LICENSE-PixelOperator.txt`, provenance and SHA-256 in `public/assets/fonts/NOTICE.txt`. The author's site returned 403 to a script, so the font was taken from a mirror that carries the original distribution; the CC0 grant is stated in the font's own metadata and in its LICENSE.txt. m5x7 was not used because its licence could not be verified.

## Privacy check: what it covers and its limit

`npm run check-privacy-nolog` checks three things. Names: paths in the index and in all history, and paths in `dist/`, `dist-offline/` and the zip, against `reference_photos/` and against the file names found in the private folder. Patterns: token and private-key patterns in tracked text, in history patches and in built text, plus any inlined JPEG, HEIC or WebP image (the game art is PNG only). Content: when the private folder exists (next to the main checkout, or the folder named by the environment variable `REF_PHOTOS_DIR`; it does not exist in CI), the SHA-256 of every media file in it is compared with the SHA-256 of every blob in the index and in all history (`git rev-list --objects --all` and `git cat-file`, binary blobs included), every file in `dist/` and `dist-offline/`, every zip entry, and every base64 `data:` URI payload found in built or tracked html, js and css, whatever the image format. A committed or built file with the same byte size as a private file but another hash is only a `WARN` line in `logs/check-privacy/result.log`.

Positive test (2026-11-24, throwaway repos and a generated harmless PNG as the "private" folder through `REF_PHOTOS_DIR`, nothing in the real repository): baseline PASS; the PNG renamed and staged in the index FAILS; the same file committed and then deleted (history only) FAILS; the renamed copy in `dist/` FAILS; the same bytes as a base64 `data:` URI in `dist-offline/index.html` FAILS; the same bytes inside a zip in `dist/` FAILS; a different file of the same size as a data URI and as a png in `dist/` PASSES with two `WARN` lines.

Inlined photos in history (added after review round 1): blobs whose path ends in html, htm, js, mjs, cjs, jsx, ts, tsx, css, json, svg, md, txt, yml or yaml, in the index and in all history, are read (one `git cat-file --batch` call) and every base64 `data:` URI payload in them is decoded and hashed like a built file, so a photo committed as a data URI inside such a file and deleted later still fails. A text blob over 8 MB is not scanned and gives a `WARN` line. Test: a generated PNG as a data URI in a `.js` file, committed and then deleted, FAILS; the baseline PASSES.

Token patterns read the index blobs (`git ls-files -s` and `git cat-file --batch`), not only the working files (added after review round 2): a secret that was staged and then replaced by a clean working file still fails, because the next commit would contain it. Working files that are tracked or untracked-but-not-ignored are scanned too (what a later `git add` would stage). Binary files are skipped and a text file over 8 MB gives a `WARN`. Test in a throwaway repo: a fake `ghp_` token staged and replaced by a clean unstaged file FAILS; an untracked file holding it FAILS; the clean state PASSES.

Remaining limit: the match is on exact bytes. A re-encoded, resized, cropped, recompressed or screenshot copy of a photo has another hash and is not caught, and neither is a photo split, encrypted or otherwise encoded (hex, URL-encoded, not base64) before inlining, nor a data URI inside a text blob of another file type or over 8 MB. The size warning is a weak hint for those cases. The defence for them is the rule that `reference_photos/` is never read by an agent and that no photo-derived asset is added without the owner's look.

## Not done in W0

- Phaser skills registration (`.claude/skills/`), PixelLab MCP and the `scan-skill.sh` path: the W0 brief did not include them; they need the scan and the owner's approval first.
- GitHub Pages setting (Settings > Pages > Source: GitHub Actions) and the first deployment: repository-level steps for the manager and the owner. `verify-pages-nolog` stays red until then.
