// Note-array chiptune sequencer. Pure of Phaser: it needs a BaseAudioContext and a destination node.
import { noteFreq, voice, type Wave } from './synth';

export type { Wave };

export interface TrackChannel {
    wave: Wave;
    /** 0..1, scaled down again inside the sequencer so four loud channels still stay below 1.0. */
    volume: number;
    /** One entry per 16th note: "C4", "G#3", "Bb2", "-" or null for a rest, "=" to hold the previous note one more step. Shorter than `steps` loops. */
    notes: (string | null)[];
}

export interface Track {
    id: string;
    bpm: number;
    /** Loop length in 16th notes. */
    steps: number;
    channels: TrackChannel[];
}

const CHANNEL_GAIN = 0.2;
const LOOKAHEAD = 0.1; // seconds scheduled ahead of the context clock
const TICK_MS = 25;
const MAX_LATENCY = 0.5; // seconds; a larger reported output latency is treated as bogus

/** Schedules the notes that start on one step of every channel. Shared by the sequencer and offline renders. */
function scheduleStep(ctx: BaseAudioContext, dest: AudioNode, track: Track, step: number, when: number): void {
    const stepSec = 60 / track.bpm / 4;
    const idx = step % track.steps;
    for (const ch of track.channels) {
        const name = ch.notes.length ? ch.notes[idx % ch.notes.length] : null;
        const freq = noteFreq(name);
        if (freq === null) continue;
        // A note lasts one step; each "=" right after it (extension to the contract) holds it one more step.
        let len = 1;
        while (idx + len < track.steps && ch.notes[(idx + len) % ch.notes.length] === '=') len++;
        voice(ctx, dest, {
            wave: ch.wave,
            freq: ch.wave === 'noise' ? freq * 4 : freq,
            when,
            dur: Math.max(0.03, stepSec * len * 0.9),
            vol: ch.volume * CHANNEL_GAIN,
            cutoff: ch.wave === 'noise' ? 6000 : undefined
        });
    }
}

/** Renders `loops` passes of a track into any context (used by check-audio.mjs with an OfflineAudioContext). */
export function renderTrack(ctx: BaseAudioContext, dest: AudioNode, track: Track, startAt = 0, loops = 1): number {
    const stepSec = 60 / track.bpm / 4;
    for (let s = 0; s < track.steps * loops; s++) scheduleStep(ctx, dest, track, s, startAt + s * stepSec);
    return track.steps * loops * stepSec;
}

export class Sequencer {
    private track: Track | null = null;
    private bus: GainNode | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;
    private startTime = 0;
    private nextStep = 0;

    constructor(
        private readonly ctx: BaseAudioContext,
        private readonly dest: AudioNode
    ) {}

    get current(): Track | null {
        return this.track;
    }

    play(track: Track): void {
        this.stop();
        this.track = track;
        this.bus = this.ctx.createGain();
        this.bus.connect(this.dest);
        this.startTime = this.ctx.currentTime + 0.05;
        this.nextStep = 0;
        this.timer = setInterval(() => this.tick(), TICK_MS);
        this.tick();
    }

    stop(): void {
        if (this.timer !== null) clearInterval(this.timer);
        this.timer = null;
        if (this.bus) {
            // Fade the bus out so already scheduled notes cut off without a click, then drop it.
            const bus = this.bus;
            const t = this.ctx.currentTime;
            bus.gain.cancelScheduledValues(t);
            bus.gain.setValueAtTime(bus.gain.value, t);
            bus.gain.linearRampToValueAtTime(0, t + 0.04);
            setTimeout(() => bus.disconnect(), 120);
        }
        this.bus = null;
        this.track = null;
    }

    /**
     * Seconds of the track the listener is hearing now: the context clock minus the output latency (what the device still has
     * to play), never negative; 0 when nothing plays.
     */
    getBeatClock(): number {
        if (!this.track) return 0;
        const c = this.ctx as BaseAudioContext & { outputLatency?: number; baseLatency?: number };
        const latency = c.outputLatency || c.baseLatency || 0; // outputLatency is 0 or missing in some browsers
        return Math.max(0, this.ctx.currentTime - this.startTime - Math.min(latency, MAX_LATENCY));
    }

    private tick(): void {
        const track = this.track;
        const bus = this.bus;
        if (!track || !bus) return;
        const stepSec = 60 / track.bpm / 4;
        const horizon = this.ctx.currentTime + LOOKAHEAD;
        while (this.startTime + this.nextStep * stepSec < horizon) {
            scheduleStep(this.ctx, bus, track, this.nextStep, this.startTime + this.nextStep * stepSec);
            this.nextStep++;
        }
    }
}
