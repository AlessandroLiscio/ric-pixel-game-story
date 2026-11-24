import type Phaser from 'phaser';
import { audio } from '../audio';

const FADE_MS = 400;
const busy = new WeakSet<Phaser.Scene>();

/** Camera fade in from black, for first entries and for the scene started by fadeToScene. */
export function fadeIn(scene: Phaser.Scene): void {
    scene.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
}

/**
 * Fade out to black (input off), door sound, start `toKey` with `data`, fade the new scene in.
 * The new scene fades in on its own `create` event, so its create() needs no call. Calls made while a
 * transition runs are ignored.
 */
export function fadeToScene(scene: Phaser.Scene, toKey: string, data?: object): void {
    if (busy.has(scene)) return;
    busy.add(scene);
    const keyboard = scene.input.keyboard;
    scene.input.enabled = false;
    if (keyboard) keyboard.enabled = false;
    audio.sfx('door');
    const cam = scene.cameras.main;
    cam.once('camerafadeoutcomplete', () => {
        const manager = scene.scene;
        const target = manager.get(toKey);
        target?.events.once('create', () => fadeIn(target));
        manager.start(toKey, data);
        // Restore input so the scene works again if it is started later (the same key included).
        scene.input.enabled = true;
        if (keyboard) keyboard.enabled = true;
        busy.delete(scene);
    });
    cam.fadeOut(FADE_MS, 0, 0, 0);
}
