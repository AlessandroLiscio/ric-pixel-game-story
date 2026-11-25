import { assetUrl } from 'asset-url';

// One quiet looping bed per scene, under the music. The files are 16 s seamless loops from vinish.dev free sounds (CC BY 4.0, see README);
// `rms` is each file's measured RMS, so every bed lands at LEVEL at the master whatever the recording's own loudness.
const LEVEL = 0.02; // the music bus peaks well above this (MUSIC_GAIN 0.4)
const BEDS: Record<string, { file: string; rms: number }> = {
    cortile: { file: 'city_traffic_loop', rms: 0.086 },
    universita: { file: 'office_room_loop', rms: 0.044 },
    giuggiu: { file: 'clock_room_loop', rms: 0.04 },
    giardini: { file: 'forest_day_loop', rms: 0.043 },
    circe: { file: 'clock_room_loop', rms: 0.04 },
    divano: { file: 'crickets_field_loop', rms: 0.036 }
};
const FADE_IN = 0.6; // time constant of the fade in, seconds (about 2 s to full)
const FADE_OUT = 0.4;

interface Playing {
    file: string;
    src: AudioBufferSourceNode;
    gain: GainNode;
}

/** Ambient loops on the shared AudioContext, through `out` (the master gain: mute and volume apply). Nothing starts while the context is
 *  suspended (no user gesture yet): the bed that was asked for starts when the context runs. */
export class Ambience {
    private buffers = new Map<string, Promise<AudioBuffer | null>>();
    private cur: Playing | null = null;
    private wanted: string | null = null;

    constructor(
        private ctx: AudioContext,
        private out: AudioNode
    ) {
        ctx.addEventListener('statechange', () => void this.sync());
    }

    /** The bed of a scene; the same file in the next scene keeps playing, another one crossfades. */
    play(sceneId: string): void {
        this.wanted = BEDS[sceneId] ? sceneId : null;
        void this.sync();
    }

    stop(): void {
        this.wanted = null;
        void this.sync();
    }

    private load(file: string): Promise<AudioBuffer | null> {
        let p = this.buffers.get(file);
        if (!p) {
            // fetch + decodeAudioData also reads the data: URIs of the offline build (no XHR, so file:// works)
            p = fetch(assetUrl(`ambient/${file}.ogg`))
                .then((r) => r.arrayBuffer())
                .then((b) => this.ctx.decodeAudioData(b))
                .catch((e) => {
                    if (import.meta.env.DEV) console.warn(`[audio] ambience ${file} failed`, e);
                    this.buffers.delete(file); // a later scene may retry
                    return null;
                });
            this.buffers.set(file, p);
        }
        return p;
    }

    private async sync(): Promise<void> {
        const { ctx } = this;
        if (ctx.state !== 'running') return;
        const want = this.wanted ? BEDS[this.wanted] : null;
        if (this.cur?.file === want?.file) return;
        if (this.cur) this.fadeOut(this.cur);
        this.cur = null;
        if (!want) return;
        const buffer = await this.load(want.file);
        // a newer play() or stop() while the file loaded wins
        if (!buffer || this.cur || (this.wanted ? BEDS[this.wanted]?.file : null) !== want.file) return;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.gain.setTargetAtTime(LEVEL / want.rms, ctx.currentTime, FADE_IN);
        src.connect(gain).connect(this.out);
        src.start();
        this.cur = { file: want.file, src, gain };
    }

    private fadeOut({ src, gain }: Playing): void {
        const t = this.ctx.currentTime;
        // no cancelScheduledValues: it would drop a fade in that is still running and click; the later event takes over from the current value
        gain.gain.setTargetAtTime(0, t, FADE_OUT);
        src.stop(t + FADE_OUT * 6);
        src.onended = () => gain.disconnect();
    }
}
