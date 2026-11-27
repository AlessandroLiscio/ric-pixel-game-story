// Short story moments built from pixelfx effects, called by the flow with one line each (see docs/pixelfx.md).
import type Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { fx } from './PixelFx';

/** A minigame ends: confetti on a win, a grey poof and a cartoon bang on a loss. Screen space, over everything. */
export function resultFx(scene: Phaser.Scene, won: boolean): void {
    const cx = GAME_WIDTH / 2;
    if (won) {
        fx.play(scene, 'ui/confetti', { x: cx, y: 345, scale: 2, world: false, depth: 960 });    } else {
        fx.play(scene, 'spawn/poof', { x: cx, y: 190, scale: 3, world: false, depth: 960, palette: 'greySmoke' });
        fx.play(scene, 'explosions/cartoon-pow', { x: cx, y: 110, scale: 1, world: false, depth: 960, text: 'OPS!' });
    }
}

/** A friend joins the party: a golden ring of sparkles, then a second green one, over the spot where the follower pops in (world coordinates, feet position). */
export function joinFx(scene: Phaser.Scene, x: number, feetY: number): void {
    fx.play(scene, 'pickups/collect-burst', { x, y: feetY, layer: 'front', palette: 'holy', timeScale: 0.8 });
    scene.time.delayedCall(220, () => fx.play(scene, 'pickups/collect-burst', { x, y: feetY - 10, layer: 'front', palette: 'heal', timeScale: 0.8 }));
}
