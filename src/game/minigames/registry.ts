import type Phaser from 'phaser';
import { makeStubMinigame } from './stub/StubMinigame';
import { MINIGAME_IDS } from './types';

// Each minigame lives in ./<id>/index.ts and default-exports its scene class; the folder name is the id.
// (The stub is ./stub/StubMinigame.ts, so it never matches this glob.)
const found = import.meta.glob<{ default: typeof Phaser.Scene }>('./*/index.ts', { eager: true });

/** minigame id -> scene class. An id with no folder yet gets the stub (X wins, Z loses). */
export const MINIGAMES: Record<string, typeof Phaser.Scene> = {};

for (const id of MINIGAME_IDS) MINIGAMES[id] = makeStubMinigame(id);
for (const [path, mod] of Object.entries(found)) {
    const id = path.split('/')[1];
    if (mod.default) MINIGAMES[id] = mod.default;
}
