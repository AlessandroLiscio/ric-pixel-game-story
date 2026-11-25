import Phaser from 'phaser';
import { audio } from '../audio';

// Two small things drawn in code: the litter bin of the rooms whose map does not draw one, and Rick's green portal.

const BIN_KEY = 'prop-bin';
export const BIN_RANGE = 40; // px from a bin's feet: Ric is "next to it" within this distance
export const BIN_BLOCK = { x: 12, y: 6 }; // half width and half depth Ric cannot walk into

/** A grey litter bin standing at `x`,`y` (feet), sorted with the characters by its depth. */
export function addBin(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
    if (!scene.textures.exists(BIN_KEY)) {
        const tex = scene.textures.createCanvas(BIN_KEY, 16, 22)!;
        const c = tex.getContext();
        const px = (color: string, rx: number, ry: number, rw: number, rh: number) => {
            c.fillStyle = color;
            c.fillRect(rx, ry, rw, rh);
        };
        px('#2b3140', 1, 20, 14, 2); // ground shadow
        px('#6f7b91', 3, 5, 10, 15); // body
        px('#4d5870', 3, 5, 1, 15); // shaded left edge
        px('#4d5870', 6, 7, 1, 11); // slats
        px('#4d5870', 9, 7, 1, 11);
        px('#4d5870', 12, 7, 1, 11);
        px('#5b6577', 1, 3, 14, 3); // lid
        px('#8b96aa', 1, 3, 14, 1); // lid highlight
        px('#8b96aa', 6, 1, 4, 2); // lid handle
        px('#2b3140', 3, 19, 10, 1); // base
        tex.refresh();
    }
    return scene.add.image(x, y, BIN_KEY).setOrigin(0.5, 1).setDepth(y);
}

export interface Portal {
    x: number;
    y: number;
    /** Closes the portal with a quick shrink. */
    close(): void;
}

/** A green swirling oval standing on a wall at `x`,`y` (the middle of the oval). `wide` is for a wall that faces the player, narrow for one seen edge on. */
export function openPortal(scene: Phaser.Scene, x: number, y: number, wide: boolean): Portal {
    const R = 22;
    const root = scene.add.container(x, y).setDepth(800);
    const hole = scene.add.graphics();
    hole.fillStyle(0x052a12, 1).fillCircle(0, 0, R);
    hole.fillStyle(0x0d5a26, 1).fillCircle(0, 0, R * 0.7);
    hole.fillStyle(0x7dff5a, 0.8).fillCircle(0, 0, R * 0.18);
    const swirl = (radius: number, color: number, width: number, arcs: number) => {
        const g = scene.add.graphics();
        g.lineStyle(width, color, 1);
        for (let i = 0; i < arcs; i++) {
            const start = (i * Math.PI * 2) / arcs;
            g.beginPath();
            g.arc(0, 0, radius, start, start + Math.PI * 0.55, false, 0);
            g.strokePath();
        }
        return g;
    };
    const outer = swirl(R * 0.85, 0x9bff6e, 3, 3);
    const inner = swirl(R * 0.5, 0xd8ffc4, 2, 2);
    const ring = scene.add.graphics();
    ring.lineStyle(3, 0x4cff4c, 1).strokeCircle(0, 0, R);
    ring.lineStyle(1, 0xd8ffc4, 0.9).strokeCircle(0, 0, R + 2);
    root.add([hole, outer, inner, ring]);
    scene.tweens.add({ targets: outer, rotation: Math.PI * 2, duration: 900, repeat: -1 });
    scene.tweens.add({ targets: inner, rotation: -Math.PI * 2, duration: 1300, repeat: -1 });
    scene.tweens.add({ targets: ring, alpha: 0.6, duration: 280, yoyo: true, repeat: -1 });

    const sx = wide ? 0.85 : 0.5;
    root.setScale(0, 0);
    scene.tweens.add({ targets: root, scaleX: sx, scaleY: 1, duration: 350, ease: 'Back.Out' });
    audio.sfx('door'); // the noise sweep of the door doubles as the whoosh
    return {
        x,
        y,
        close: () => scene.tweens.add({ targets: root, scaleX: 0, scaleY: 0, duration: 250, ease: 'Back.In', onComplete: () => root.destroy() })
    };
}
