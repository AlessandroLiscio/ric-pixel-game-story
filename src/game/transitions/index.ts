import type Phaser from 'phaser';
import { audio } from '../audio';
import { fx, type FxHandle } from '../fx';
import { getRun } from '../flow/RunState';

const FADE_MS = 400;
const busy = new WeakSet<Phaser.Scene>();

/**
 * The pixelfx screen transitions (320x180 effects shown at 2x over the 640x360 screen). Each one covers the screen, holds, then uncovers:
 * `cover` is the effect time (seconds) at which the screen is fully covered, where the next scene is started; the second half plays in the new
 * scene from the same time. `speed` shortens the designed 2 second wipe to about a second and a half.
 */
const TRANSITIONS: { id: string; cover: number; speed: number; palette?: string[] }[] = [
    { id: 'transitions/iris', cover: 1.1, speed: 1.5 },
    { id: 'transitions/diamond-wipe', cover: 0.95, speed: 1.4 },
    { id: 'transitions/star-iris', cover: 1.05, speed: 1.5 },
    { id: 'transitions/pixel-dissolve', cover: 1.0, speed: 1.4 },
    { id: 'transitions/blinds', cover: 0.9, speed: 1.4 }
];
const ENDING = 2; // the star iris opens on the ending

/** Warm night blue, so the cover is not a dead black. */
const COVER_COLOR = '#0a0a1a';

/** Camera fade in from black, for first entries (the title scene). */
export function fadeIn(scene: Phaser.Scene): void {
    scene.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
}

function pick(scene: Phaser.Scene, toKey: string): (typeof TRANSITIONS)[number] {
    if (toKey === 'ending') return TRANSITIONS[ENDING];
    const index = getRun(scene.game).sceneIndex; // the flow has already moved on to the scene it is going to
    return TRANSITIONS[(index + TRANSITIONS.length - 1) % TRANSITIONS.length];
}

function overlay(scene: Phaser.Scene, t: (typeof TRANSITIONS)[number], extra: object): FxHandle {
    return fx.play(scene, t.id, {
        x: 0,
        y: 0,
        scale: 2,
        world: false,
        depth: 2000,
        timeScale: t.speed,
        color: COVER_COLOR,
        seed: 1,
        ...extra
    });
}

/**
 * Close a pixelfx wipe over the scene (input off), door sound, start `toKey` with `data`, then open the same wipe over the new scene.
 * The new scene is covered from its first frame, so its create() needs no call. Calls made while a transition runs are ignored.
 * If the effect cannot play, the old black camera fade is used.
 */
export function fadeToScene(scene: Phaser.Scene, toKey: string, data?: object): void {
    if (busy.has(scene)) return;
    busy.add(scene);
    const keyboard = scene.input.keyboard;
    scene.input.enabled = false;
    if (keyboard) keyboard.enabled = false;
    audio.sfx('door');

    const start = () => {
        const manager = scene.scene;
        const target = manager.get(toKey);
        const t = pick(scene, toKey);
        target?.events.once('create', () => {
            // the scene's own camera fade-in would dim the opening wipe; without the effect the camera fade is the transition
            if (overlay(target, t, { startAt: t.cover }).alive) target.cameras.main.resetFX();
            else fadeIn(target);
        });
        manager.start(toKey, data);
        // Restore input so the scene works again if it is started later (the same key included).
        scene.input.enabled = true;
        if (keyboard) keyboard.enabled = true;
        busy.delete(scene);
    };

    const t = pick(scene, toKey);
    const closing = overlay(scene, t, { pauseAt: t.cover, onPause: start });
    if (closing.alive) return;
    // fallback: plain camera fade
    const cam = scene.cameras.main;
    cam.once('camerafadeoutcomplete', start);
    cam.fadeOut(FADE_MS, 0, 0, 0);
}
