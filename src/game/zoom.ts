import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';

/** Largest whole-number zoom that fits the window (at least 1). */
export function integerZoom(winW: number, winH: number): number {
    return Math.max(1, Math.floor(Math.min(winW / GAME_WIDTH, winH / GAME_HEIGHT)));
}

/**
 * Keeps the game container at exactly zoom x 640x360 CSS pixels, so every game pixel is a whole
 * number of screen pixels (Scale.FIT then fills the container with no fractional scaling).
 * Also wires the F key to the browser fullscreen of the whole page.
 */
export function installIntegerZoom(game: Phaser.Game, container: HTMLElement): void {
    const apply = () => {
        const z = integerZoom(window.innerWidth, window.innerHeight);
        container.style.width = `${GAME_WIDTH * z}px`;
        container.style.height = `${GAME_HEIGHT * z}px`;
        game.scale.getParentBounds(); // refresh() alone reuses the old parent size
        game.scale.refresh();
    };
    apply();
    window.addEventListener('resize', apply);
    document.addEventListener('fullscreenchange', apply);
    window.addEventListener('keydown', (e) => {
        if (e.code !== 'KeyF' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => undefined);
    });
}
