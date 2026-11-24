import Phaser from 'phaser';
import { beep, unlockAudio } from '../audioContext';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../config';

declare global {
    interface Window {
        /** true once the title screen is shown; tests wait for it. */
        __ricReady?: boolean;
    }
}

export class TitleScene extends Phaser.Scene {
    constructor() {
        super('Title');
    }

    create(): void {
        const style = { fontFamily: FONT_FAMILY, fontSize: '32px', color: '#ffffff' };
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 24, 'Titolo provvisorio', style).setOrigin(0.5);
        const prompt = this.add
            .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 32, 'Premi un tasto', { ...style, fontSize: '16px', color: '#9ec8ff' })
            .setOrigin(0.5);
        this.tweens.add({ targets: prompt, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

        // Any key unlocks audio on the shared context (browsers need a user gesture first).
        this.input.keyboard!.once('keydown', async () => {
            await unlockAudio();
            beep();
        });

        window.__ricReady = true;
    }
}
