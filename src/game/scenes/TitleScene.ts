import Phaser from 'phaser';
import { audio } from '../audio';
import { unlockAudio } from '../audioContext';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { resetRun } from '../flow/RunState';
import { pixelStyle, t } from '../ui/text';

declare global {
    interface Window {
        /** true once the title screen is shown; tests wait for it. */
        __ricReady?: boolean;
    }
}

const CAST = ['ric', 'lollino', 'giuggiu', 'liscio', 'ros', 'giusy', 'lara'];
const START_CODES = ['KeyX', 'Enter', 'Space'];

export class TitleScene extends Phaser.Scene {
    constructor() {
        super('title');
    }

    create(): void {
        this.started = false; // the ending returns to this same instance for a replay
        const cx = GAME_WIDTH / 2;
        const shadow = { offsetX: 2, offsetY: 2, color: '#0a1040', blur: 0, stroke: false, fill: true };
        this.drawSky();

        this.add
            .text(cx, 52, t('titleScreen.title'), { ...pixelStyle(32, '#ffe27a'), shadow, align: 'center', wordWrap: { width: GAME_WIDTH - 40 } })
            .setOrigin(0.5, 0);
        this.add.text(cx, 108, t('titleScreen.subtitle'), { ...pixelStyle(16, '#cfe0ff'), shadow: { ...shadow, offsetX: 1, offsetY: 1 } }).setOrigin(0.5, 0);

        // The friends line up on a strip of ground, bobbing out of step.
        this.add.rectangle(0, 262, GAME_WIDTH, GAME_HEIGHT - 262, 0x1a2f8f).setOrigin(0);
        this.add.rectangle(0, 262, GAME_WIDTH, 2, 0x6f8be6).setOrigin(0);
        CAST.forEach((id, i) => {
            const sprite = this.add.image(cx + (i - (CAST.length - 1) / 2) * 76, 262, `char-${id}`, 1).setOrigin(0.5, 1).setScale(2);
            this.tweens.add({ targets: sprite, y: 258, duration: 420, yoyo: true, repeat: -1, delay: i * 90 });
        });

        const prompt = this.add.text(cx, 188, t('titleScreen.press'), { ...pixelStyle(16, '#ffffff'), shadow: { ...shadow, offsetX: 1, offsetY: 1 } }).setOrigin(0.5);
        this.tweens.add({ targets: prompt, alpha: 0.15, duration: 520, yoyo: true, repeat: -1 });
        this.add.text(8, GAME_HEIGHT - 20, `${t('ui.fullscreen')}    ${t('ui.mute')}`, pixelStyle(16, '#9ec8ff'));
        this.add.text(8, GAME_HEIGHT - 38, `${t('ui.run')}    ${t('ui.menu')}`, pixelStyle(16, '#9ec8ff'));

        this.input.keyboard!.on('keydown', this.onKey, this);
        this.events.once('shutdown', () => this.input.keyboard?.off('keydown', this.onKey, this));
        window.__ricReady = true;
    }

    private started = false;

    private async onKey(e: KeyboardEvent): Promise<void> {
        if (this.started || e.repeat || !START_CODES.includes(e.code)) return;
        this.started = true;
        await unlockAudio(); // browsers need a key press before sound
        audio.sfx('confirm');
        resetRun(this.game);
        this.cameras.main.fadeOut(300);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('world'));
    }

    /** Night sky: vertical gradient texture and blinking stars. */
    private drawSky(): void {
        if (!this.textures.exists('title-sky')) {
            const tex = this.textures.createCanvas('title-sky', GAME_WIDTH, GAME_HEIGHT)!;
            const g = tex.context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
            g.addColorStop(0, '#0a1040');
            g.addColorStop(1, '#3a5cc7');
            tex.context.fillStyle = g;
            tex.context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            tex.refresh();
        }
        this.add.image(0, 0, 'title-sky').setOrigin(0);
        for (let i = 0; i < 40; i++) {
            const star = this.add.rectangle(Phaser.Math.Between(0, GAME_WIDTH), Phaser.Math.Between(0, 250), 2, 2, 0xffffff);
            this.tweens.add({ targets: star, alpha: 0.1, duration: Phaser.Math.Between(500, 1600), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 1200) });
        }
    }
}
