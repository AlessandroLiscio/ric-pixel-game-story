# ric-pixel-game-story

A ~20 minute pixel-art story game in Italian for Ric's 30th birthday: Phaser 4.2.1 + Vite + TypeScript, 640x360, a 32x32 tile world in the RPG Maker VX Ace look, six scenes in Bologna, a minigame per scene and a credits roll. README.md has the commands, the proof scripts with their PASS lines, the builds and the folder map; read it first.

## Privacy, always

- `reference_photos/` is private and gitignored. Never stage, commit, copy into `public/` or build it, and never copy pixels from it: view the photos with the Read tool only. Never upload a photo of a person to any service without Alessandro's confirmation of that person's consent.
- No token or key in any file, log or commit. `npm run check-privacy-nolog` must print PASS before every PR.

## Where things live

- Rooms: `docs/tiles.md` is the room API, the build command and one "photo feature -> map" table per room. A room is `scripts/art/stamps/<room>.py` plus `scripts/art/rooms/<room>.py`; `python -I scripts/art/build_world.py` regenerates `public/assets/tiles/**` and `src/data/maps/**` deterministically (Pillow and numpy needed). Every room must match the real place in geometry and decor.
- When two room branches meet, take either side of `tiles.json` and `tileset.png`, keep both sections of `docs/tiles.md`, then rerun `build_world.py` and commit its outputs.
- Story and scene data: `src/data/scenes.json`, `src/data/dialogue.it.json`, `docs/scenes.md`, `docs/dialogue-it.md`. Effects: pixelfx is vendored in `src/vendor/pixelfx`; how the game uses it is in `docs/pixelfx.md`.
- Phaser 4 and pixelfx reference skills are in `.claude/skills/` (provenance in `.claude/skills/PROVENANCE.md`).

## Checks before a PR

`npm run -s typecheck-nolog`, `npm run -s build-nolog`, `npm run -s check-content-nolog`, `npm run -s smoke-walk-nolog`, `npm run -s test:e2e-nolog`, `npm run -s check-privacy-nolog`: quote each PASS line in the PR body.
