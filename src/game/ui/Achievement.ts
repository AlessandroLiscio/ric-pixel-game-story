import Phaser from 'phaser';
import { audio } from '../audio';
import { GAME_WIDTH } from '../config';
import { getRun } from '../flow/RunState';
import { DIALOGUE, pixelStyle, t } from './text';

const W = 214;
const H = 42;
const MARGIN = 6;
const HOLD_MS = 3000;
const SLIDE_MS = 380;
const DEPTH = 2000;
const queues = new WeakMap<Phaser.Scene, Promise<void>>();

/** The dark panel of the toast (a Steam style card: light edge, a gold cup in a square on the left), drawn once. */
function panel(scene: Phaser.Scene): string {
    const key = 'ach-panel';
    if (scene.textures.exists(key)) return key;
    const tex = scene.textures.createCanvas(key, W, H)!;
    const c = tex.getContext();
    c.fillStyle = '#5d7088';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#121a26';
    c.fillRect(1, 1, W - 2, H - 2);
    c.fillStyle = '#1c2838';
    c.fillRect(1, 1, W - 2, 3);
    c.fillStyle = '#2a3b52'; // the icon square
    c.fillRect(5, 5, 32, 32);
    c.fillStyle = '#4a617f';
    c.fillRect(5, 5, 32, 1);
    c.fillRect(5, 5, 1, 32);
    const px = (color: string, x: number, y: number, w: number, h: number) => {
        c.fillStyle = color;
        c.fillRect(x, y, w, h);
    };
    px('#ffd84a', 14, 10, 14, 9); // the cup
    px('#ffd84a', 16, 19, 10, 3);
    px('#e0a800', 14, 17, 14, 2);
    px('#ffd84a', 11, 11, 3, 5); // handles
    px('#ffd84a', 28, 11, 3, 5);
    px('#e0a800', 19, 22, 4, 5);
    px('#ffd84a', 15, 27, 12, 3);
    px('#fff3a8', 16, 11, 2, 6); // shine
    tex.refresh();
    return key;
}

function toast(scene: Phaser.Scene, name: string): Promise<void> {
    return new Promise((resolve) => {
        if (!scene.sys.isActive()) return resolve();
        const shadow = { offsetX: 1, offsetY: 1, color: '#000000', blur: 0, stroke: false, fill: true };
        const root = scene.add.container(GAME_WIDTH + 4, MARGIN).setDepth(DEPTH).setScrollFactor(0);
        const head = scene.add.text(44, 5, t('ui.achievement'), { ...pixelStyle(16, '#8fb4de'), shadow });
        const body = scene.add.text(44, 21, name, { ...pixelStyle(16, '#ffffff'), shadow });
        root.add([scene.add.image(0, 0, panel(scene)).setOrigin(0), head, body]);
        audio.sfx('confirm');
        const to = GAME_WIDTH - W - MARGIN;
        // if the scene ends first (a door, a minigame) the toast dies with it, and the queue goes on
        const done = () => resolve();
        scene.events.once('shutdown', done);
        scene.tweens.add({
            targets: root,
            x: to,
            duration: SLIDE_MS,
            ease: 'Cubic.Out',
            onComplete: () =>
                scene.time.delayedCall(HOLD_MS, () =>
                    scene.tweens.add({
                        targets: root,
                        x: GAME_WIDTH + 4,
                        duration: SLIDE_MS,
                        ease: 'Cubic.In',
                        onComplete: () => {
                            root.destroy();
                            scene.events.off('shutdown', done);
                            resolve();
                        }
                    })
                )
        });
    });
}

/**
 * The first time an easter egg triggers in a run: a small card slides in at the top right ("Easter egg sbloccato" and the name
 * under it), stays about 3 s and slides out. `id` is a key of `achievements` in dialogue.it.json; shown ids are kept in the run
 * (RunState.achievements), so each shows once. Several in a row wait for each other. Returns true when a toast was queued.
 */
export function showAchievement(scene: Phaser.Scene, id: string): boolean {
    const run = getRun(scene.game);
    const name = DIALOGUE.achievements?.[id];
    if (!name || run.achievements.includes(id)) return false;
    run.achievements.push(id);
    queues.set(scene, (queues.get(scene) ?? Promise.resolve()).then(() => toast(scene, name)));
    return true;
}
