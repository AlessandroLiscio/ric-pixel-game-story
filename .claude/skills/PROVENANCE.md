# Phaser agent skills: provenance

These 28 skill folders are the official Phaser agent skills, copied unchanged from `phaserjs/phaser` at commit `02d8931b626d9764c133cbb3fbf99966c03c757c`, folder `skills/`, on 2026-11-24.

Before the copy they were scanned with `scan-skill.sh` (SkillSpector, static analysis): CRITICAL 0, HIGH 5, MEDIUM 4. Every HIGH finding was read by hand and is a false positive: "swap contexts" (audio-and-sound, about `setAudioContext`), "override filter" (game-object-components reference, a filter camera method), and "reset state" (scenes, about resetting scene state in `init()`). The owner approved the install on 2026-11-24.

To update them, scan the new version first and replace the folders as a whole.

## pxl (pixel art as code)

`.claude/skills/pxl/` is copied from `https://github.com/uilianks/pxl` at commit `c1bea5c20e8ed6c0dadaf59a9a1dee3797afce8e` (downloaded with `gh api` as a tarball, licence MIT, copied on 2026-11-25). Files copied: `SKILL.md`, `reference.md`, `lighting.md`, `bin/`, `src/`, `types/`, `LICENSE`, `package.json`. Not copied: `docs/`, `examples/`, `showcase/`, `test/`, `scripts/`, `README.md`, `package-lock.json`, `tsconfig.json`. Scan before the copy: CRITICAL 0, HIGH 0; the owner approved it after a security intake. It needs no install and no `dist/`: in a checkout `bin/pxl.js` runs the TypeScript sources directly (Node 22.18 or later). Never run its `serve` command or `npx github:...`. To update it, scan the new commit first and replace the folder as a whole.
