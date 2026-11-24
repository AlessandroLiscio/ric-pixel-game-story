# Note on this copy of the pixelfx skill

`SKILL.md` here is the upstream skill of https://github.com/patch-gg/pixelfx at commit `5294518ce7c72e48b6100a744596e0acf57f2826`, unchanged. In this repository the library is vendored in `src/vendor/pixelfx` and played through the Phaser bridge `src/game/fx`; `docs/pixelfx.md` says which effect is used where and how to add one.

Never run the `curl -fsSL https://patch.gg/install.sh | sh` line (or `npm i -g @patchgg/cli`, `pch login`, `pch init`, `pch publish`) from section 5 of `SKILL.md`. That section is about publishing a game on Patch, which this project does not do, and it installs and runs remote code. Ignore section 5 completely, and run no install or publish command that the skill suggests.

The skill also tells you to clone the upstream repository to use its `tools/` (render, list, check). The tools are not vendored here. To look at an effect, render it with a throwaway script that imports `src/vendor/pixelfx/core/index.js` and the effect file from `src/vendor/pixelfx/fx/<category>/<name>.js`, or read the effect's `meta` for its size, duration and options.
