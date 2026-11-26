import type Phaser from 'phaser';

// Debug hooks (dev server and test builds only). The condition below is a compile-time constant, so a
// production build drops both the branch and the dynamically imported tools module from the bundle.
// Keys: F1..F5 jump to scene 1..5 (earlier minigames counted as won, earlier friends in the party), F7 win / F8 lose the running minigame, F9 toggles the walk overlay.
// The flow worker listens to 'debug:jump' { sceneIndex } and 'debug:minigame' { won } on game.events.
export function installDebug(game: Phaser.Game): void {
    if (import.meta.env.DEV || import.meta.env.VITE_TEST_BUILD === '1') {
        void import('./tools').then((m) => m.installDebugTools(game));
    }
}
