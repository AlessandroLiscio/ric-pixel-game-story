import type Phaser from 'phaser';
import { audio } from '../audio';
import { MINIGAME_DONE, type MinigameDone } from '../minigames/types';
import { ACTIVE_MINIGAME_KEY, getRun, type RunState } from './RunState';
import { SCENES } from './data';
import { friendsBefore, resultsBefore } from './story';

export interface RicState {
    scene: string;
    sceneIndex: number;
    results: RunState['results'];
    party: string[];
    portalGun: boolean;
    flags: RunState['flags'];
    achievements: string[];
}

declare global {
    interface Window {
        /** Snapshot of the run for tests and debugging; always available. */
        __ricState?: () => RicState;
    }
}

/** Starts scene `index` as if every earlier scene was won: their minigames count as won and their friends are in the party. */
function jumpToScene(game: Phaser.Game, index: number): void {
    const run = getRun(game);
    run.sceneIndex = Math.max(0, Math.min(index, SCENES.length - 1));
    run.party = friendsBefore(run.sceneIndex);
    run.results = resultsBefore(run.sceneIndex);
    game.registry.set(ACTIVE_MINIGAME_KEY, undefined);
    for (const s of game.scene.getScenes(false)) if (s.scene.key !== 'boot') game.scene.stop(s.scene.key);
    game.scene.start('world');
}

/** Window globals, the 'debug:*' listeners the debug keys talk to, the Esc menu's scene jump and the M (mute) key. */
export function installFlowGlobals(game: Phaser.Game): void {
    window.__ricState = () => {
        const run = getRun(game);
        const active = game.scene.getScenes(true);
        return {
            scene: active[active.length - 1]?.scene.key ?? '',
            sceneIndex: run.sceneIndex,
            results: { ...run.results },
            party: [...run.party],
            portalGun: run.portalGun,
            flags: { ...run.flags },
            achievements: [...run.achievements]
        };
    };

    // Debug keys (W2 debug worker) jump to a scene or force the running minigame's result; the Esc menu's "Vai alla scena" does the same jump.
    game.events.on('debug:jump', ({ sceneIndex }: { sceneIndex: number }) => jumpToScene(game, sceneIndex));
    game.events.on('menu:jump', ({ sceneIndex }: { sceneIndex: number }) => jumpToScene(game, sceneIndex));
    game.events.on('debug:minigame', ({ won }: { won: boolean }) => {
        const id = game.registry.get(ACTIVE_MINIGAME_KEY) as string | undefined;
        if (id) game.events.emit(MINIGAME_DONE, { id, won } satisfies MinigameDone);
    });

    // Test builds only (VITE_TEST_BUILD=1): the whole branch is dead code in the Pages and offline builds.
    if (import.meta.env.VITE_TEST_BUILD === '1') {
        (window as unknown as Record<string, unknown>).__ricTest = {
            skip: () => game.events.emit('test-skip'),
            win: () => game.events.emit('debug:minigame', { won: true }),
            lose: () => game.events.emit('debug:minigame', { won: false })
        };
    }

    let muted = false;
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyM' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) audio.mute((muted = !muted));
    });
}
