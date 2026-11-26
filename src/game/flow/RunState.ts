import type Phaser from 'phaser';

/** The state of one playthrough, kept on game.registry under RUN_KEY. */
export interface RunState {
    sceneIndex: number;
    /** minigame id -> won; undefined until played. */
    results: Record<string, boolean | undefined>;
    /** Friends that joined so far (never Ric). */
    party: string[];
    /** True once Ric found Rick's portal gun in a litter bin: Z then opens a portal on a wall. */
    portalGun: boolean;
    /**
     * Named switches of the run (the contract the minigames read as `getRun(game).flags?.[name]`): `appunti` (cinema notes found),
     * `peroni` (found), `peroniBevuta` (drunk), `fumo` (hash found), `soldi` (20 EUR found), `numeroFrangetta` (got the fringe
     * girl's number), `soldiUsati` (the 20 EUR bought the drinks), `rosGiusyBack` (Ros and Giusy are back in the train at the Cortile).
     */
    flags: Record<string, boolean>;
    /** Ids of `achievements` in dialogue.it.json already shown as a popup in this run. */
    achievements: string[];
}

export const RUN_KEY = 'run';
/** game.registry key holding the id of the minigame being played (undefined otherwise); the debug listeners use it. */
export const ACTIVE_MINIGAME_KEY = 'activeMinigame';

const fresh = (): RunState => ({ sceneIndex: 0, results: {}, party: [], portalGun: false, flags: {}, achievements: [] });

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
