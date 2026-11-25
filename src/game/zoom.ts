import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './config';

/**
 * How many CSS pixels one canvas pixel gets in a window: the largest 0.5 step that fits (1, 1.5, 2, ...), so a canvas pixel is a
 * whole number of screen pixels at 1 and 2 and the 2x2 art pixel stays whole at every step. A window smaller than the 1280x720 canvas
 * gets the exact fit instead (below 1 no whole step exists), so the game never overflows.
 */
export function integerZoom(winW: number, winH: number): number {
    const fit = Math.min(winW / CANVAS_WIDTH, winH / CANVAS_HEIGHT);
    return fit < 1 ? fit : Math.floor(fit * 2) / 2;
}

/**
 * Keeps the game container at exactly zoom x 1280x720 CSS pixels (Scale.FIT then fills the container with no extra scaling).
 * Also wires the F key to the browser fullscreen of the whole page.
 */
export function installIntegerZoom(game: Phaser.Game, container: HTMLElement): void {
    const apply = () => {
        const z = integerZoom(window.innerWidth, window.innerHeight);
        container.style.width = `${CANVAS_WIDTH * z}px`;
        container.style.height = `${CANVAS_HEIGHT * z}px`;
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
