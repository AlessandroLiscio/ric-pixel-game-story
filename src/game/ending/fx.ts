// pixelfx of the ending: critters on the TV screen and fireworks on the birthday finale. Everything is positioned from ENDING_FX, the one object
// to edit when the room changes (the TV rectangle follows the divano map through layout.ts, the finale point is over the credits column).
import Phaser from 'phaser';
import { fx } from '../fx';
import { DEPTH, SCREEN } from './layout';

export const ENDING_FX = {
    /** The TV screen of the room in screen pixels; the critters are clipped to it. */
    tv: { x: SCREEN.x, y: SCREEN.y, w: SCREEN.w, h: SCREEN.h },
    /** Where "Buon compleanno Ric!" stands: the fireworks burst around it. */
    finale: { x: 494, y: 74 },
    /** Depths: over the documentary and under its scanlines, and over the room and the credits column but under the finale texts. */
    depth: { tv: DEPTH.tvPicture + 0.5, finale: DEPTH.finaleFx }
};

/** A school of fish crossing the TV and a jellyfish drifting in front of the documentary. */
export function startTvFx(scene: Phaser.Scene): void {
    const { tv, depth } = ENDING_FX;
    const clip = { ...tv };
    fx.play(scene, 'critters/fish-school', { x: tv.x + tv.w / 2, y: tv.y + tv.h * 0.6, only: 'front', depth: depth.tv, clip, alpha: 0.9 });
    fx.play(scene, 'critters/jellyfish', { x: tv.x + tv.w * 0.8, y: tv.y + tv.h * 0.35, depth: depth.tv, clip, seed: 7, palette: 'neon', alpha: 0.9 });
}

/** Confetti over the title, then fireworks from the ground and bursts in the sky for as long as the scene runs. */
export function finaleFx(scene: Phaser.Scene): void {
    const { finale, depth } = ENDING_FX;
    fx.play(scene, 'ui/confetti', { x: finale.x, y: 330, scale: 2, world: false, depth: depth.finale });
    let n = 0;
    const launch = () => {
        n++;
        const x = Phaser.Math.Between(finale.x - 190, finale.x + 140);
        if (n % 3 === 0) {
            fx.play(scene, 'explosions/firework-rocket', { x, y: 330, depth: depth.finale, palette: 'partyGold' });
        } else {
            const bx = Phaser.Math.Between(finale.x - 200, finale.x + 150);
            const by = Phaser.Math.Between(30, 150);
            fx.play(scene, 'explosions/firework-burst', { x: bx, y: by, depth: depth.finale, palette: n % 2 ? 'partyGold' : 'neon' });
        }
    };
    launch();
    scene.time.addEvent({ delay: 700, loop: true, callback: launch });
}
