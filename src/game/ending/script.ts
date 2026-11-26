import { person } from '../flow/data';
import type { RunState } from '../flow/RunState';
import { divanoEggs } from '../flow/story';
import { lines, t } from '../ui/text';

/** One spoken line of the credits, in roll milliseconds. */
export interface Beat {
    speaker: string;
    name: string;
    text: string;
    start: number;
    end: number;
    /** True from the first line of the upstairs gag on. */
    upstairs: boolean;
}

/** The credits track: 24 bars at 100 bpm, 57.6 s, looping; its Happy Birthday phrase starts at bar 17 and the finale lands 42 s into a pass. */
export const LOOP_MS = 57600;
export const FINALE_MS = 42000;
const LEAD_IN_MS = 2500;
const TAIL_MS = 2500;
const GAP_MS = 250;

/** Who is upstairs, not on the sofa: Liscio and Lara, or Ric (with the fringe girl) when he got her number. */
export const awayOf = (flags: RunState['flags'] | undefined): string[] => (flags?.numeroFrangetta ? ['ric'] : ['liscio', 'lara']);

/** Reading time of a line: a base plus a fixed time per letter (the row breaks of the file do not count). */
const lineMs = (text: string): number => Math.min(7000, Math.max(2400, 900 + 34 * text.replace(/\s*\n\s*/g, ' ').length));

/**
 * The night scene of the divano room, played as speech during the credits: its three groups of lines, the easter-egg gag of each won minigame, then the
 * upstairs gag. The Ric-on-the-chair egg is left out when Ric is upstairs.
 */
export function buildBeats(run: Pick<RunState, 'results' | 'flags'>): { beats: Beat[]; rollMs: number } {
    const away = awayOf(run.flags);
    const eggs = divanoEggs(run.results).filter((id) => !(id === 'ric-sedia' && away.includes('ric')));
    const gag = lines(away.includes('ric') ? 'ending.upstairsFrangetta' : 'ending.upstairs');
    const groups = [
        ...(['arrival', 'meet', 'join'] as const).map((k) => ({ list: lines(`scenes.divano.${k}`), upstairs: false })),
        ...eggs.map((id) => ({ list: lines(`easterEggs.${id}`), upstairs: false })),
        { list: gag, upstairs: true }
    ];
    const tag = t('ending.fromUpstairs');
    const beats: Beat[] = [];
    let at = LEAD_IN_MS;
    for (const { list, upstairs } of groups) {
        for (const l of list) {
            const who = l.speaker === 'narratore' ? undefined : person(l.speaker);
            const name = who ? (away.includes(l.speaker) ? `${who.name} ${tag}` : who.name) : '';
            const end = at + lineMs(l.text);
            beats.push({ speaker: l.speaker, name, text: l.text.replace(/\{ric\}/g, 'Ric').replace(/\s*\n\s*/g, ' '), start: at, end, upstairs });
            at = end + GAP_MS;
        }
    }
    // the roll ends on the Happy Birthday phrase of some pass of the track: the first one after the last line
    const passes = Math.max(0, Math.ceil((at + TAIL_MS - FINALE_MS) / LOOP_MS));
    return { beats, rollMs: FINALE_MS + passes * LOOP_MS };
}
