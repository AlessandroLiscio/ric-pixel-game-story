import Phaser from 'phaser';
import { FONT_FAMILY } from '../game/config';

// W0 spike scene, loaded only with ?spike=1. It draws the Italian glyphs with the game font and
// code-made art so scripts/spike.mjs can check them from the outside (see docs/w0-spike.md).
export const SPIKE_GLYPHS = "àèéìòùÀÈÉÌÒÙ’'";

export class SpikeScene extends Phaser.Scene {
    constructor() {
        super('Spike');
    }

    create(): void {
        const style = { fontFamily: FONT_FAMILY, fontSize: '16px', color: '#ffffff' };
        this.add.text(8, 8, SPIKE_GLYPHS, style);
        this.add.text(8, 28, "L’università è già qui: com'è bella! Ciò che più conta.", style);

        // A 4x4 checker texture, scaled 8x: crisp edges prove pixelArt (nearest-neighbour) works.
        const tex = this.textures.createCanvas('spike-checker', 4, 4)!;
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
                tex.context.fillStyle = (x + y) % 2 ? '#ff4040' : '#4040ff';
                tex.context.fillRect(x, y, 1, 1);
            }
        }
        tex.refresh();
        this.add.image(600, 40, 'spike-checker').setScale(8);

        this.cameras.main.fadeIn(10);
        (window as unknown as Record<string, unknown>).__ricSpikeReady = true;
    }
}
