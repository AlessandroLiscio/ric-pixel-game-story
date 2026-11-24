// Small 8-bit sound effect synth. Pure of Phaser: `playSfx` takes any BaseAudioContext and a destination.
import { noteFreq, voice } from './synth';

export const SFX_NAMES = ['blip', 'confirm', 'cancel', 'hit', 'miss', 'win', 'lose', 'door', 'step', 'meow'] as const;
export type SfxName = (typeof SFX_NAMES)[number];

const V = 0.22; // base voice gain: two overlapping voices stay well below 1.0

/** Plays one effect starting at `when`; returns its length in seconds. */
const defs: Record<SfxName, (c: BaseAudioContext, d: AudioNode, t: number) => number> = {
    blip(c, d, t) {
        voice(c, d, { wave: 'square', freq: 1100, when: t, dur: 0.045, vol: V * 0.7 });
        return 0.05;
    },
    confirm(c, d, t) {
        voice(c, d, { wave: 'square', freq: 660, when: t, dur: 0.06, vol: V });
        voice(c, d, { wave: 'square', freq: 990, when: t + 0.06, dur: 0.11, vol: V });
        return 0.18;
    },
    cancel(c, d, t) {
        voice(c, d, { wave: 'square', freq: 440, when: t, dur: 0.06, vol: V });
        voice(c, d, { wave: 'square', freq: 294, when: t + 0.06, dur: 0.1, vol: V });
        return 0.17;
    },
    hit(c, d, t) {
        voice(c, d, { wave: 'noise', freq: 3000, when: t, dur: 0.12, vol: V * 1.1, glide: [[0.12, 800]] });
        voice(c, d, { wave: 'triangle', freq: 180, when: t, dur: 0.12, vol: V, glide: [[0.12, 60]] });
        return 0.13;
    },
    miss(c, d, t) {
        voice(c, d, { wave: 'triangle', freq: 330, when: t, dur: 0.22, vol: V, glide: [[0.22, 110]] });
        return 0.23;
    },
    win(c, d, t) {
        const notes = ['C5', 'E5', 'G5', 'C6'];
        notes.forEach((n, i) => {
            const last = i === notes.length - 1;
            voice(c, d, { wave: 'square', freq: noteFreq(n)!, when: t + i * 0.09, dur: last ? 0.36 : 0.085, vol: V * 0.9 });
            voice(c, d, { wave: 'triangle', freq: noteFreq(n)! / 2, when: t + i * 0.09, dur: last ? 0.36 : 0.085, vol: V * 0.8 });
        });
        return 0.4 + 0.27;
    },
    lose(c, d, t) {
        const notes = ['G4', 'E4', 'C4', 'G3'];
        notes.forEach((n, i) => {
            const last = i === notes.length - 1;
            voice(c, d, { wave: 'triangle', freq: noteFreq(n)!, when: t + i * 0.16, dur: last ? 0.5 : 0.15, vol: V * 1.2 });
        });
        return 0.48 + 0.5;
    },
    door(c, d, t) {
        voice(c, d, { wave: 'noise', freq: 1400, when: t, dur: 0.28, vol: V * 0.9, cutoff: 1200, attack: 0.08, glide: [[0.28, 500]] });
        voice(c, d, { wave: 'triangle', freq: 110, when: t + 0.2, dur: 0.18, vol: V * 1.1, glide: [[0.18, 55]] });
        return 0.4;
    },
    step(c, d, t) {
        voice(c, d, { wave: 'noise', freq: 900, when: t, dur: 0.045, vol: V * 0.5, cutoff: 1800 });
        return 0.05;
    },
    meow(c, d, t) {
        voice(c, d, {
            wave: 'pulse25',
            freq: 520,
            when: t,
            dur: 0.4,
            vol: V * 0.9,
            attack: 0.03,
            glide: [
                [0.12, 900],
                [0.4, 480]
            ]
        });
        return 0.42;
    }
};

export function playSfx(ctx: BaseAudioContext, dest: AudioNode, name: SfxName, when = ctx.currentTime): number {
    return defs[name](ctx, dest, when);
}
