import Phaser from 'phaser';
import { audio } from '../audio';
import { GAME_WIDTH } from '../config';
import { panelTexture } from './panel';
import { pixelStyle, t } from './text';

const CONFIRM_CODES = ['KeyX', 'Enter', 'Space'];
const W = 228;
const H = 92;
const GOLD = '#ffe27a';
const SHADOW = { offsetX: 1, offsetY: 1, color: '#0a1040', blur: 0, stroke: false, fill: true };

/**
 * A yes/no window styled like the menu's "Sei sicuro?": the question, Sì and No side by side, arrows (or A/D, W/S) move the
 * cursor and X, Enter or Space confirm. "No" is the default. Resolves true for Sì. It sits on the right, between the two places
 * the dialogue box can be, so it never hides it. The caller keeps the player busy while it is open.
 */
export function askChoice(scene: Phaser.Scene, question: string): Promise<boolean> {
    const x = GAME_WIDTH - W - 12;
    const y = 132;
    const root = scene.add.container(0, 0).setDepth(1100).setScrollFactor(0);
    root.add(scene.add.image(x, y, panelTexture(scene, `choice-panel-${W}x${H}`, W, H)).setOrigin(0));
    const label = (lx: number, ly: number, s: string, color = '#ffffff') => {
        const text = scene.add.text(lx, ly, s, { ...pixelStyle(16, color), shadow: SHADOW });
        root.add(text);
        return text;
    };
    label(x + 16, y + 14, question, GOLD);
    const yes = label(x + 56, y + 52, t('menu.yes'));
    const no = label(x + 56 + 100, y + 52, t('menu.no'));
    const cursor = scene.add.graphics().fillStyle(0xffe27a).fillTriangle(0, 0, 0, 10, 7, 5);
    root.add(cursor);

    return new Promise((resolve) => {
        let sel = 1; // "No" is the default
        const openedAt = performance.now();
        const draw = () => {
            yes.setColor(sel === 0 ? GOLD : '#ffffff');
            no.setColor(sel === 1 ? GOLD : '#ffffff');
            cursor.setPosition(sel === 0 ? x + 38 : x + 138, y + 56);
        };
        draw();
        const kb = scene.input.keyboard!;
        const onKey = (e: KeyboardEvent) => {
            if (performance.now() - openedAt < 150) return; // the X that closed the dialogue page may still reach this window
            if (CONFIRM_CODES.includes(e.code)) {
                if (e.repeat) return;
                audio.sfx('confirm');
                kb.off('keydown', onKey);
                root.destroy();
                resolve(sel === 0);
            } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(e.code)) {
                sel = ['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW'].includes(e.code) ? 0 : 1;
                audio.sfx('blip');
                draw();
            }
        };
        kb.on('keydown', onKey);
        scene.events.once('shutdown', () => kb.off('keydown', onKey));
    });
}
