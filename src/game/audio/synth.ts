// Pure Web Audio synth helpers: no Phaser, no globals. Every function takes a BaseAudioContext
// (AudioContext or OfflineAudioContext) and a destination node, so check-audio.mjs can render them offline.
export type Wave = 'square' | 'triangle' | 'noise' | 'pulse25';

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C4", "G#3", "Bb2" to Hz (A4 = 440). Rests ("-", null, anything unparsable) give null. */
export function noteFreq(name: string | null | undefined): number | null {
    if (!name) return null;
    const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(name.trim());
    if (!m) return null;
    const semi = SEMITONES[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    const midi = 12 * (Number(m[3]) + 1) + semi;
    return 440 * Math.pow(2, (midi - 69) / 12);
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
    let b = noiseBuffers.get(ctx);
    if (!b) {
        b = ctx.createBuffer(1, Math.floor(ctx.sampleRate), ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        noiseBuffers.set(ctx, b);
    }
    return b;
}

// 25% duty pulse as a PeriodicWave (Fourier series of a pulse of duty d).
const pulseWaves = new WeakMap<BaseAudioContext, PeriodicWave>();
function pulse25(ctx: BaseAudioContext): PeriodicWave {
    let w = pulseWaves.get(ctx);
    if (!w) {
        const n = 64;
        const d = 0.25;
        const real = new Float32Array(n + 1);
        const imag = new Float32Array(n + 1);
        for (let k = 1; k <= n; k++) {
            real[k] = Math.sin(2 * Math.PI * k * d) / (Math.PI * k);
            imag[k] = (1 - Math.cos(2 * Math.PI * k * d)) / (Math.PI * k);
        }
        w = ctx.createPeriodicWave(real, imag);
        pulseWaves.set(ctx, w);
    }
    return w;
}

export interface VoiceOptions {
    wave: Wave;
    /** Start pitch in Hz. For noise it only sets the playback rate (higher = brighter hiss). */
    freq: number;
    /** Start time on the context clock, seconds. */
    when: number;
    /** Length in seconds. */
    dur: number;
    /** Peak gain 0..1 before the destination. */
    vol: number;
    /** Extra pitch points [secondsAfterStart, Hz], ramped exponentially (slides, meow). */
    glide?: [number, number][];
    /** Low-pass cutoff for noise voices, Hz. */
    cutoff?: number;
    attack?: number;
}

/** One enveloped voice: starts and stops itself and frees its nodes when it ends. */
export function voice(ctx: BaseAudioContext, dest: AudioNode, o: VoiceOptions): void {
    const end = o.when + o.dur;
    const attack = Math.min(o.attack ?? 0.004, o.dur / 2);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, o.when);
    gain.gain.linearRampToValueAtTime(Math.max(o.vol, 0.0002), o.when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    let src: AudioScheduledSourceNode;
    let pitch: AudioParam;
    let base: number;
    if (o.wave === 'noise') {
        const s = ctx.createBufferSource();
        s.buffer = noiseBuffer(ctx);
        s.loop = true;
        pitch = s.playbackRate;
        base = 1000;
        src = s;
        if (o.cutoff) {
            const f = ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = o.cutoff;
            s.connect(f).connect(gain);
        } else s.connect(gain);
    } else {
        const osc = ctx.createOscillator();
        if (o.wave === 'pulse25') osc.setPeriodicWave(pulse25(ctx));
        else osc.type = o.wave;
        pitch = osc.frequency;
        base = 1;
        src = osc;
        osc.connect(gain);
    }
    pitch.setValueAtTime(o.freq / base, o.when);
    for (const [t, f] of o.glide ?? []) pitch.exponentialRampToValueAtTime(Math.max(f, 1) / base, o.when + t);
    gain.connect(dest);
    src.onended = () => {
        src.disconnect();
        gain.disconnect();
    };
    src.start(o.when);
    src.stop(end + 0.02);
}
