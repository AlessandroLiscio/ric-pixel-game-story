# Phaser agent skills: provenance

These 28 skill folders are the official Phaser agent skills, copied unchanged from `phaserjs/phaser` at commit `02d8931b626d9764c133cbb3fbf99966c03c757c`, folder `skills/`, on 2026-11-24.

Before the copy they were scanned with `scan-skill.sh` (SkillSpector, static analysis): CRITICAL 0, HIGH 5, MEDIUM 4. Every HIGH finding was read by hand and is a false positive: "swap contexts" (audio-and-sound, about `setAudioContext`), "override filter" (game-object-components reference, a filter camera method), and "reset state" (scenes, about resetting scene state in `init()`). The owner approved the install on 2026-11-24.

To update them, scan the new version first and replace the folders as a whole.
