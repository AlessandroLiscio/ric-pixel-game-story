// pixelfx touches of the minigames: effects only, no gameplay. Each function is one call from the minigame that owns the moment.
import Phaser from 'phaser';
import { fx } from '../fx';

const mix = (a: number, b: number, k: number): number => Math.round(a + (b - a) * k);

/** A dark-to-bright ramp of `steps` hex colours ending in white that passes through `hex` (a '#rrggbb' lane or light colour). */
export function rampOf(hex: string, steps = 6): string[] {
    const c = Phaser.Display.Color.HexStringToColor(hex);
    const dark = [16, 12, 26];
    const out: string[] = [];
    for (let i = 0; i < steps; i++) {
        const k = i / (steps - 1);
        // dark -> colour at 60%, colour -> white at the end
        const [r, g, b] = k < 0.6 ? [0, 1, 2].map((j) => mix(dark[j], [c.red, c.green, c.blue][j], k / 0.6)) : [c.red, c.green, c.blue].map((v) => mix(v, 255, (k - 0.6) / 0.4));
        out.push(`#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
    }
    return out;
}

// ---- rhythm ----

/** Sparks flying up from the hit line of a lane; a perfect hit adds a glint. */
export function rhythmHit(scene: Phaser.Scene, x: number, y: number, hex: string, perfect: boolean): void {
    fx.play(scene, 'impacts/hit-spark', { x, y, world: false, scale: 2, angle: -Math.PI / 2, palette: rampOf(hex), depth: 12, timeScale: 1.3 });
    if (perfect) {
        // two more sparks fanned to the sides, in white-gold
        for (const da of [-0.6, 0.6]) fx.play(scene, 'impacts/hit-spark', { x, y, world: false, scale: 2, angle: -Math.PI / 2 + da, palette: 'partyGold', depth: 12, timeScale: 1.5 });
    }
}

/** A combo plate at the combo counter each ten hits. */
export function rhythmCombo(scene: Phaser.Scene, combo: number, x: number, y: number): void {
    if (combo > 0 && combo % 10 === 0) fx.play(scene, 'ui/combo-counter', { x, y, world: false, depth: 20, count: combo, label: 'COMBO' });
}

// ---- cat-smoke ----

let cloudsPlaying = 0;
/** A grey pixelfx cloud among the plain ones (at most three at once, semi-transparent so the cat is still seen under it). */
export function catSmokeCloud(scene: Phaser.Scene, x: number, y: number): void {
    if (cloudsPlaying >= 3) return;
    cloudsPlaying++;
    const done = () => (cloudsPlaying = Math.max(0, cloudsPlaying - 1));
    const h = fx.play(scene, 'explosions/smoke-bomb', { x, y: y + 30, world: false, depth: 31, palette: 'greySmoke', startAt: 0.7, alpha: 0.6, timeScale: 0.9, onDone: done });
    if (!h.alive) done();
}

// ---- slackline ----

/** Dust at the rope: a small puff for a step, a bigger one for a wobble, on the towel when Ric falls. */
export function slacklineDust(scene: Phaser.Scene, x: number, y: number, big: boolean): void {
    fx.play(scene, 'spawn/poof', { x, y, world: false, depth: 25, palette: 'dust', timeScale: big ? 1 : 1.3 });
}

// ---- d20 ----

/** Natural 20: a golden burst and stars; natural 1: a grey poof and a cartoon bang. */
export function d20Roll(scene: Phaser.Scene, value: number, x: number, y: number): void {
    if (value === 20) {
        fx.play(scene, 'explosions/firework-burst', { x, y, world: false, depth: 45, palette: 'partyGold' });
        fx.play(scene, 'ui/confetti', { x, y: y + 60, world: false, depth: 46, scale: 2 });
    } else if (value === 1) {
        fx.play(scene, 'spawn/poof', { x, y: y + 40, world: false, depth: 45, scale: 2, palette: 'greySmoke' });
        fx.play(scene, 'explosions/cartoon-pow', { x, y: y - 10, world: false, depth: 46, text: 'OPS!' });
    }
}

// ---- mash ----

let lastStrain = 0;
/** Dust and strain puffs at the feet while the button is hammered (throttled to about 7 a second). */
export function mashStrain(scene: Phaser.Scene, x: number, y: number): void {
    if (scene.time.now - lastStrain < 140) return;
    lastStrain = scene.time.now;
    fx.play(scene, 'spawn/poof', { x, y, world: false, depth: 25, palette: 'dust', timeScale: 1.6 });
}
