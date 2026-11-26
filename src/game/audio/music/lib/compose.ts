// Tiny composing helper for the track files in ../*.ts (it lives in lib/ so the engine's `./music/*.ts` glob never sees it).
// A track is written as sections of bars; one bar = 16 sixteenth-note steps in 4/4.
//   lead:   bars separated by `|`, each token `Name[:steps]` (`E5` = 2 steps, an eighth; `E5:4` a quarter; `-:4` a rest; `=:4` hold the previous note).
//   chords: bars separated by `|`, one chord per bar or two (`C G`) or four, e.g. `C | Am7 | F G | C`.
//   bass, arp, drums: a library name (BASS, ARP, DRUMS below) or 16 raw tokens.
// Bass follows the chord root of each step, the arpeggio follows the chord tones, so the harmony never clashes with the chords.
import type { Track } from '../../Sequencer';

export const STEPS_PER_BAR = 16;

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Chord quality -> semitones above the root. */
const QUALITY: Record<string, number[]> = {
    '': [0, 4, 7],
    m: [0, 3, 7],
    '7': [0, 4, 7, 10],
    m7: [0, 3, 7, 10],
    maj7: [0, 4, 7, 11],
    '6': [0, 4, 7, 9],
    m6: [0, 3, 7, 9],
    dim: [0, 3, 6],
    sus4: [0, 5, 7],
    add9: [0, 4, 7, 14]
};

/** Bass tokens: r root, 3 third, 5 fifth, 8 octave, 7 seventh, 4 fourth, l fifth below the root, - rest, = hold. */
export const BASS: Record<string, string> = {
    none: '- - - - - - - - - - - - - - - -',
    whole: 'r - - - - - - - - - - - - - - -',
    half: 'r - - - - - - - 5 - - - - - - -',
    rf: 'r - - - 5 - - - r - - - 5 - - -',
    walk: 'r - - - 3 - - - 5 - - - 3 - - -',
    eighths: 'r - r - r - r - r - r - r - r -',
    oct: 'r - 8 - r - 8 - r - 8 - r - 8 -',
    drive: 'r - r r - r - r r - r r - r 5 -',
    bounce: 'r - - r - - r - 5 - - 5 - - r -',
    swing: 'r - - - - - 5 - - - r - - - - -',
    chase: 'r r - r r - r r - r r - r r - 5',
    sync: 'r - - r - - r - r - - r - r - 5'
};

/** Arpeggio tokens: 1 root, 3 third, 5 fifth, 7 seventh (the octave root when the chord has none), a/b/c root/third/fifth one octave up, - rest, = hold. */
export const ARP: Record<string, string> = {
    none: '- - - - - - - - - - - - - - - -',
    up: '1 3 5 3 1 3 5 3 1 3 5 3 1 3 5 3',
    up8: '1 3 5 a 5 3 1 3 1 3 5 a 5 3 1 3',
    pluck: '5 - 3 - 5 - 3 - 5 - 3 - 5 - 3 -',
    stab: '- - 5 - - - 5 - - - 5 - - - 5 -',
    offbeat: '- - 3 - - - 5 - - - 3 - - - 5 -',
    skip: '1 - - 3 - - 5 - 1 - - 3 - - 5 -',
    slow: '1 - 3 - 5 - 3 - 1 - 3 - 5 - 3 -',
    held: '3 - - - - - - - 5 - - - - - - -',
    chase: '5 - 3 5 - 3 5 - 3 5 - 3 5 - 3 -'
};

/** Noise drum tokens: k kick, s snare, h hat, o open hat, t tom, - rest. */
export const DRUMS: Record<string, string> = {
    none: '- - - - - - - - - - - - - - - -',
    four: 'k - h - s - h - k - h - s - h h',
    rock: 'k - h - s - h - k - h k s - h -',
    drive: 'k - h - s - h - k k h - s - h k',
    soft: 'k - - - - - h - - - - - s - h -',
    swing: 'k - - - h - s - - - k - h - s -',
    bounce: 'k - h - s - h h k - h - s - h -',
    chase: 'k h s h k h s h k h s h k h s s',
    lull: 'h - - - - - - - - - - - h - - -',
    fill: 'k - s - s - s s t t s s k k s s',
    fillsoft: 'k - - - s - - - t - t - s - s s'
};

const DRUM_NOTE: Record<string, string> = { k: 'C2', s: 'A4', h: 'C6', o: 'A5', t: 'G3' };

export interface Section {
    chords: string;
    lead: string;
    bass?: string;
    arp?: string;
    drums?: string;
    /** Drum pattern of the last bar of the section (a fill). */
    fill?: string;
    /** Octave shift in semitones for the arpeggio of this section (default 0). */
    arpShift?: number;
}

export interface TrackSpec {
    id: string;
    bpm: number;
    /** Name notes with flats (Bb, Eb) instead of sharps in the generated bass and arpeggio. */
    flats?: boolean;
    /** Fewest bars the track may have (default 16): the rhythm game's song is 14. */
    minBars?: number;
    sections: Section[];
    /** Channel waves and volumes. Volumes are scaled by the sequencer (x0.2), so 1 = a lead peak of about 0.2. */
    lead?: { wave?: 'square' | 'pulse25'; volume?: number };
    harm?: { wave?: 'square' | 'pulse25'; volume?: number };
    bassVolume?: number;
    noiseVolume?: number;
}

function split(s: string): string[] {
    return s.split('|').map((b) => b.trim());
}

function pitch(name: string): number {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) throw new Error(`bad note "${name}"`);
    return 12 * (Number(m[3]) + 1) + LETTER[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

function midiName(midi: number, flats: boolean): string {
    return `${(flats ? FLATS : SHARPS)[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

interface Chord {
    root: number;
    iv: number[];
}

function parseChord(s: string): Chord {
    const m = /^([A-G][#b]?)(.*)$/.exec(s);
    const iv = m && QUALITY[m[2]];
    if (!m || !iv) throw new Error(`bad chord "${s}"`);
    return { root: pitch(`${m[1]}4`) % 12, iv };
}

function pattern(lib: Record<string, string>, spec: string, what: string): string[] {
    const toks = (lib[spec] ?? spec).trim().split(/\s+/);
    if (toks.length !== STEPS_PER_BAR) throw new Error(`${what} "${spec}" has ${toks.length} tokens, need ${STEPS_PER_BAR}`);
    return toks;
}

function leadSteps(bar: string, where: string): (string | null)[] {
    const out: (string | null)[] = [];
    for (const tok of bar.split(/\s+/).filter(Boolean)) {
        const m = /^([A-G][#b]?-?\d|-|=)(?::(\d+))?$/.exec(tok);
        if (!m) throw new Error(`${where}: bad lead token "${tok}"`);
        const n = m[2] ? Number(m[2]) : 2;
        for (let i = 0; i < n; i++) out.push(m[1] === '-' ? '-' : m[1] === '=' || i > 0 ? '=' : m[1]);
    }
    return out;
}

export function compose(spec: TrackSpec): Track {
    const flats = spec.flats ?? false;
    const lead: (string | null)[] = [];
    const harm: (string | null)[] = [];
    const bass: (string | null)[] = [];
    const drums: (string | null)[] = [];

    spec.sections.forEach((sec, si) => {
        const leadBars = split(sec.lead);
        const chordBars = split(sec.chords);
        if (leadBars.length !== chordBars.length) throw new Error(`${spec.id}: section ${si} has ${leadBars.length} lead bars and ${chordBars.length} chord bars`);
        const bassPat = pattern(BASS, sec.bass ?? 'eighths', `${spec.id} bass`);
        const arpPat = pattern(ARP, sec.arp ?? 'up', `${spec.id} arp`);
        const drumPat = pattern(DRUMS, sec.drums ?? 'rock', `${spec.id} drums`);
        const fillPat = sec.fill ? pattern(DRUMS, sec.fill, `${spec.id} fill`) : drumPat;
        const shift = sec.arpShift ?? 0;
        leadBars.forEach((lb, bi) => {
            const where = `${spec.id}: section ${si} bar ${bi + 1}`;
            const l = leadSteps(lb, where);
            if (l.length !== STEPS_PER_BAR) throw new Error(`${where} has ${l.length} lead steps, need ${STEPS_PER_BAR}`);
            lead.push(...l);
            const chords = chordBars[bi].split(/\s+/).map(parseChord);
            if (![1, 2, 4].includes(chords.length)) throw new Error(`${where}: ${chords.length} chords in a bar`);
            const dp = bi === leadBars.length - 1 ? fillPat : drumPat;
            for (let s = 0; s < STEPS_PER_BAR; s++) {
                const ch = chords[Math.floor((s * chords.length) / STEPS_PER_BAR)];
                const bRoot = 40 + ((((ch.root - 40) % 12) + 12) % 12); // E2..D#3
                const aRoot = 60 + ((((ch.root - 60) % 12) + 12) % 12) + shift; // C4..B4
                const third = ch.iv[1];
                const fifth = ch.iv[2];
                const seventh = ch.iv[3] ?? 12;
                const bt = bassPat[s];
                const bMap: Record<string, number> = { r: 0, '3': third, '5': fifth, '8': 12, '7': seventh, '4': 5, l: -5 };
                bass.push(bt === '-' ? '-' : bt === '=' ? '=' : midiName(bRoot + bMap[bt], flats));
                const at = arpPat[s];
                const aMap: Record<string, number> = { '1': 0, '3': third, '5': fifth, '7': seventh, a: 12, b: third + 12, c: fifth + 12 };
                harm.push(at === '-' ? '-' : at === '=' ? '=' : midiName(aRoot + aMap[at], flats));
                const dt = dp[s];
                drums.push(dt === '-' ? '-' : DRUM_NOTE[dt]);
            }
        });
    });

    const steps = lead.length;
    const bars = steps / STEPS_PER_BAR;
    const minBars = spec.minBars ?? 16;
    if (bars < minBars || bars > 32) throw new Error(`${spec.id}: ${bars} bars, need ${minBars} to 32`);
    return {
        id: spec.id,
        bpm: spec.bpm,
        steps,
        channels: [
            { wave: spec.lead?.wave ?? 'square', volume: spec.lead?.volume ?? 1, notes: lead },
            { wave: spec.harm?.wave ?? 'pulse25', volume: spec.harm?.volume ?? 0.5, notes: harm },
            { wave: 'triangle', volume: spec.bassVolume ?? 1, notes: bass },
            { wave: 'noise', volume: spec.noiseVolume ?? 0.3, notes: drums }
        ]
    };
}
