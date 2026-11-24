// The contract between the flow (WorldScene) and every minigame scene (W3).
// A minigame is a Phaser.Scene with `static KEY = 'minigame-<id>'` and `static ID = '<id>'`, exported as the
// default export of src/game/minigames/<id>/index.ts. It shows `await InstructionCard.show(this, ID)` first, plays,
// then calls `this.game.events.emit(MINIGAME_DONE, { id: ID, won, score } satisfies MinigameDone)` and stops itself.
export interface MinigameInit {
    sceneId: string;
}

export interface MinigameResult {
    won: boolean;
    score?: number;
}

export type MinigameDone = { id: string } & MinigameResult;

export const MINIGAME_DONE = 'minigame:done';

export const MINIGAME_IDS = ['simon', 'cat-smoke', 'slackline', 'd20', 'mash', 'rhythm'] as const;
