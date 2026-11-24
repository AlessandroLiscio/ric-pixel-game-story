import type Phaser from 'phaser';
import { getAudioContext } from '../audioContext';
import { Sequencer, type Track } from './Sequencer';
import { playSfx, SFX_NAMES, type SfxName } from './sfx';
import { voice } from './synth';

const MUSIC_GAIN = 0.4; // music sits under the effects; notes sustain now, so the average level is about 2.7x the old plucks (lowered from 0.7)
const DEFAULT_VOLUME = 0.7;

// One file per track in ./music, each `export default` a Track. An empty folder is fine.
const trackModules = import.meta.glob<{ default?: Track }>('./music/*.ts', { eager: true });

function collectTracks(): Map<string, Track> {
    const map = new Map<string, Track>();
    for (const [path, mod] of Object.entries(trackModules)) {
        const t = mod.default;
        if (t && typeof t.id === 'string' && Array.isArray(t.channels)) map.set(t.id, t);
        else if (import.meta.env.DEV) console.warn(`[audio] ${path} has no valid default Track`);
    }
    return map;
}

export class AudioEngine {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private musicBus: GainNode | null = null;
    private sequencer: Sequencer | null = null;
    private tracks: Map<string, Track> | null = null;
    private volume = DEFAULT_VOLUME;
    private muted = false;
    private wanted: string | null = null;

    /** Call once at boot. Uses Phaser's WebAudio context when it has one, else the shared one of audioContext.ts. */
    init(game?: Phaser.Game): void {
        if (this.ctx) return;
        const phaserCtx = (game?.sound as { context?: AudioContext } | undefined)?.context;
        const ctx = phaserCtx ?? getAudioContext();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.connect(ctx.destination);
        this.musicBus = ctx.createGain();
        this.musicBus.gain.value = MUSIC_GAIN;
        this.musicBus.connect(this.master);
        this.sequencer = new Sequencer(ctx, this.musicBus);
        this.applyGain();

        // Browsers keep the context suspended until a gesture: resume it on the first input (W0 spike).
        const unlock = (): void => {
            if (ctx.state !== 'running') void ctx.resume();
            else removeEventListener();
        };
        const events = ['keydown', 'pointerdown', 'touchend', 'mousedown'] as const;
        const removeEventListener = (): void => events.forEach((e) => window.removeEventListener(e, unlock, true));
        events.forEach((e) => window.addEventListener(e, unlock, true));

        window.addEventListener('keydown', (e) => {
            if (e.repeat || e.code !== 'KeyM' || e.ctrlKey || e.metaKey || e.altKey) return;
            this.mute(!this.muted);
        });
    }

    sfx(name: SfxName): void {
        const ctx = this.ctx;
        if (!ctx || !this.master || ctx.state !== 'running') return;
        if (!SFX_NAMES.includes(name)) {
            if (import.meta.env.DEV) console.warn(`[audio] unknown sfx "${name}"`);
            return;
        }
        playSfx(ctx, this.master, name);
    }

    /** A short square-wave tone through the master gain, so mute and volume apply (the Simon pad keys). */
    tone(freq: number, ms: number): void {
        const ctx = this.ctx;
        if (!ctx || !this.master || ctx.state !== 'running') return;
        voice(ctx, this.master, { wave: 'square', freq, when: ctx.currentTime, dur: ms / 1000, vol: 0.12 });
    }

    playTrack(id: string): void {
        if (!this.sequencer) return;
        if (this.wanted === id && this.sequencer.current) return;
        this.tracks ??= collectTracks();
        const track = this.tracks.get(id);
        if (!track) {
            if (import.meta.env.DEV) console.warn(`[audio] unknown track "${id}"`);
            return;
        }
        this.wanted = id;
        this.sequencer.play(track);
    }

    stopTrack(): void {
        this.wanted = null;
        this.sequencer?.stop();
    }

    /** Seconds since the current track started; 0 when none plays. */
    getBeatClock(): number {
        return this.sequencer?.getBeatClock() ?? 0;
    }

    setVolume(v: number): void {
        this.volume = Math.min(1, Math.max(0, v));
        this.applyGain();
    }

    mute(on: boolean): void {
        this.muted = on;
        this.applyGain();
    }

    isMuted(): boolean {
        return this.muted;
    }

    private applyGain(): void {
        if (!this.master || !this.ctx) return;
        const t = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, t, 0.01);
    }
}
