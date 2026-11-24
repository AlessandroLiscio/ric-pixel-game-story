import type Phaser from 'phaser';

// Sheet 96x128: 3 columns (step-left, stand, step-right) x 4 rows in the order down, left, right, up.
export const DIRS = ['down', 'left', 'right', 'up'] as const;
export type Dir = (typeof DIRS)[number];

const WALK_CYCLE = [0, 1, 2, 1]; // columns
const WALK_FPS = 8;

export const walkKey = (personId: string, dir: Dir): string => `${personId}-walk-${dir}`;
export const idleKey = (personId: string, dir: Dir): string => `${personId}-idle-${dir}`;

/** Defines `<id>-walk-<dir>` and `<id>-idle-<dir>` for the texture `char-<id>` once (animations are global). */
export function ensureCharAnims(scene: Phaser.Scene, personId: string): void {
    const texture = `char-${personId}`;
    DIRS.forEach((dir, row) => {
        if (!scene.anims.exists(walkKey(personId, dir))) {
            scene.anims.create({
                key: walkKey(personId, dir),
                frames: WALK_CYCLE.map((col) => ({ key: texture, frame: row * 3 + col })),
                frameRate: WALK_FPS,
                repeat: -1
            });
        }
        if (!scene.anims.exists(idleKey(personId, dir))) {
            scene.anims.create({
                key: idleKey(personId, dir),
                frames: [{ key: texture, frame: row * 3 + 1 }],
                frameRate: 1,
                repeat: -1
            });
        }
    });
}
