import type Phaser from 'phaser';

/** The state of one playthrough, kept on game.registry under RUN_KEY. */
export interface RunState {
    sceneIndex: number;
    /** minigame id -> won; undefined until played. */
    results: Record<string, boolean | undefined>;
    /** Friends that joined so far (never Ric). */
    party: string[];
}

export const RUN_KEY = 'run';
/** game.registry key holding the id of the minigame being played (undefined otherwise); the debug listeners use it. */
export const ACTIVE_MINIGAME_KEY = 'activeMinigame';

const fresh = (): RunState => ({ sceneIndex: 0, results: {}, party: [] });

export function getRun(game: Phaser.Game): RunState {
    let run = game.registry.get(RUN_KEY) as RunState | undefined;
    if (!run) {
        run = fresh();
        game.registry.set(RUN_KEY, run);
    }
    return run;
}

/** New game: the registry gets a brand new object. */
export function resetRun(game: Phaser.Game): RunState {
    const run = fresh();
    game.registry.set(RUN_KEY, run);
    return run;
}
