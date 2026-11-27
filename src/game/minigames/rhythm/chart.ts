// The chart of the rhythm game: built from channel 0 (the lead) of a Track, no Phaser, so a Node or browser check can run it too.
import type { Track } from '../../audio/Sequencer';

export interface ChartNote {
    /** Seconds from the start of the track. */
    t: number;
    /** 0..3, left to right (keys Q W E R). */
    lane: number;
    /** The lead note name, e.g. "E5". */
    pitch: string;
    /** Part of the bass solo (see SOLO_MAX_OCTAVE). */
    solo: boolean;
}

/** Lead notes in octave 3 or lower are the bass solo: there every eighth (step % 2 = 0) becomes a chart note, twice the usual density. */
export const SOLO_MAX_OCTAVE = 3;

/** Pitch class (0 = C) to lane: C | D E | F G | A B, so a rising melody moves to the right. Black keys join their lower neighbour's lane. */
export const LANE_OF_PC = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3];
export const LANE_COUNT = 4;
/** Notes on the same lane are at least this far apart (seconds); 0.25 s is the floor asked for the game. */
export const MIN_SAME_LANE_GAP = 0.26;
/** At most this many chart notes at the same instant, always on different lanes. */
export const MAX_SIMULTANEOUS = 2;
/** Only lead notes that start on a beat (step % 4 = 0) become chart notes; the eighths between them are melody the player does not hit. */
export const BEATS_ONLY = true;
/** Offbeat eighths of the rhythm track that are chart notes too (steps of A and B, before the bass solo): bar * 16 + step in the bar. */
export const EXTRA_STEPS = new Set([34, 58, 66, 90, 102, 118, 130, 138, 150]);

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Pitch class of a note name such as "C#5" or "Bb4"; null for a rest, a hold or anything unparsable. */
export function pitchClass(name: string | null | undefined): number | null {
    const m = name ? /^([A-G])([#b]?)(-?\d)$/.exec(name.trim()) : null;
    if (!m) return null;
    return (SEMITONES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
}

export interface Chart {
    notes: ChartNote[];
    /** Lead notes left out because they are off the beat. */
    skippedOffbeat: number;
    /** Lead notes left out because of the same-lane gap or the simultaneous limit. */
    dropped: number;
}

/** One pass of the track. Deterministic: the same track always gives the same chart. */
export function buildChartInfo(track: Track): Chart {
    const lead = track.channels[0]?.notes ?? [];
    const stepSec = 60 / track.bpm / 4;
    const notes: ChartNote[] = [];
    const lastOnLane: number[] = Array(LANE_COUNT).fill(-Infinity);
    let skippedOffbeat = 0;
    let dropped = 0;
    for (let s = 0; s < track.steps && lead.length; s++) {
        const name = lead[s % lead.length];
        const pc = pitchClass(name);
        if (pc === null) continue;
        const solo = Number(/(-?\d)$/.exec(name as string)?.[1]) <= SOLO_MAX_OCTAVE;
        if (BEATS_ONLY && s % (solo ? 2 : 4) !== 0 && !EXTRA_STEPS.has(s)) {
            skippedOffbeat++;
            continue;
        }
        const t = s * stepSec;
        const lane = LANE_OF_PC[pc];
        const sameTime = notes.filter((n) => Math.abs(n.t - t) < 0.001);
        if (t - lastOnLane[lane] < MIN_SAME_LANE_GAP || sameTime.length >= MAX_SIMULTANEOUS || sameTime.some((n) => n.lane === lane)) {
            dropped++;
            continue;
        }
        lastOnLane[lane] = t;
        notes.push({ t, lane, pitch: name as string, solo });
    }
    return { notes, skippedOffbeat, dropped };
}

export const buildChart = (track: Track): ChartNote[] => buildChartInfo(track).notes;
