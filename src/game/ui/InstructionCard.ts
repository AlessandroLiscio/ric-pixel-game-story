import Phaser from 'phaser';
import { audio } from '../audio';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { panelTexture } from './panel';
import { pixelStyle, t } from './text';

const CONFIRM_CODES = ['KeyX', 'Enter', 'Space'];
const W = 480;
const H = 200;

/**
 * The card every minigame shows before it starts: title and instructions from dialogue.it.json
 * (minigames.<id>), a key hint, and a wait for X / Enter / Space.
 * Usage in a minigame scene: `await showInstructionCard(this, ID);` then start playing.
 */
export function showInstructionCard(scene: Phaser.Scene, minigameId: string): Promise<void> {
    const shadow = { offsetX: 1, offsetY: 1, color: '#0a1040', blur: 0, stroke: false, fill: true };
    const x = (GAME_WIDTH - W) / 2;
    const y = (GAME_HEIGHT - H) / 2;
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0);
    const panel = scene.add.image(x, y, panelTexture(scene, 'card-panel', W, H)).setOrigin(0);
    const title = scene.add
        .text(GAME_WIDTH / 2, y + 22, t(`minigames.${minigameId}.title`), { ...pixelStyle(32, '#ffe27a'), shadow })
        .setOrigin(0.5, 0);
    const body = scene.add
        .text(GAME_WIDTH / 2, y + 76, t(`minigames.${minigameId}.instructions`), { ...pixelStyle(), shadow, align: 'center', lineSpacing: 4 })
        .setOrigin(0.5, 0);
    const hint = scene.add
        .text(GAME_WIDTH / 2, y + H - 34, t('ui.confirm'), { ...pixelStyle(16, '#cfe0ff'), shadow })
        .setOrigin(0.5, 0);
    scene.tweens.add({ targets: hint, alpha: 0.2, duration: 450, yoyo: true, repeat: -1 });
    const parts = [dim, panel, title, body, hint];
    parts.forEach((p) => p.setDepth(900));

    return new Promise((resolve) => {
        const close = () => {
            scene.input.keyboard!.off('keydown', onKey);
            scene.game.events.off('test-skip', close);
            parts.forEach((p) => p.destroy());
            resolve();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.repeat || !CONFIRM_CODES.includes(e.code)) return;
            audio.sfx('confirm');
            close();
        };
        scene.input.keyboard!.on('keydown', onKey);
        scene.game.events.on('test-skip', close);
        scene.events.once('shutdown', () => scene.game.events.off('test-skip', close));
    });
}

/** `await InstructionCard.show(this, ID)` from a minigame scene. */
export const InstructionCard = { show: showInstructionCard };
