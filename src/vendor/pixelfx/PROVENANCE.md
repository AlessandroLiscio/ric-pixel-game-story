# pixelfx, vendored copy

Source: https://github.com/patch-gg/pixelfx (MIT, see `LICENSE`; third-party notices in `NOTICE.md`). Pinned commit: `5294518ce7c72e48b6100a744596e0acf57f2826`, package version 0.3.1. Vendored on 2026-11-24.

What was copied, unchanged: `src/core` as `core/` and `src/fx` as `fx/` (all 244 effects, 22 categories). Not copied: the gallery, the tools, the docs and the font in `gallery/fonts` (Patch's own, not MIT). The game imports only the effects listed in `src/game/fx/effects.ts`, so the build bundles those and drops the rest.

Scan result (2026-11-24, static scan of `src/` by the manager): no network access, no `eval` or `Function` constructor, no dynamic import, no `fetch`, no storage access. The library has no runtime dependencies. The only risky text in the upstream repository is in `skills/pixelfx/SKILL.md` (section 5, a `curl ... | sh` line that installs the Patch publishing CLI): it is never run, see `.claude/skills/pixelfx/NOTE.md`.

To update: download the new commit into an empty folder, scan it (no network, eval or dynamic import in `src/`), replace `core/` and `fx/`, change the SHA above, and run the checks listed in `docs/pixelfx.md`.
