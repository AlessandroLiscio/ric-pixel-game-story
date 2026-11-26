import { person } from '../flow/data';
import type { RunState } from '../flow/RunState';
import { lines, t } from '../ui/text';

/** One spoken line of the credits, shown until the player moves on. */
export interface Beat {
    speaker: string;
    name: string;
    text: string;
    /** True from the first line of the upstairs gag on. */
    upstairs: boolean;
    /** The line the whole room laughs at: the last one of the TV exchange (`scenes.divano.meet`). */
    laugh: boolean;
}

/** The credits column scrolls by in this long; once the last line has been read it hurries (see EndingScene). */
export const SCROLL_MS = 45000;
/** The quiet moment before the first line. */
export const LEAD_IN_MS = 2500;
/** The 16th note of the `credits` track where Happy Birthday starts (the pickup in the last beat of bar 16): the finale jumps there. */
export const BIRTHDAY_STEP = 252;

/** Who goes upstairs when the gag starts (they are in the room for the whole night until then): Liscio and Lara, or Ric (the fringe girl waits up there) when he got her number. */
export const awayOf = (flags: RunState['flags'] | undefined): string[] => (flags?.numeroFrangetta ? ['ric'] : ['liscio', 'lara']);

/**
 * The night scene of the divano room, played as speech during the credits: its three groups of lines, then the upstairs gag, which starts
 * when the ones who go upstairs leave the room, so everyone who speaks before it is there to be seen. No minigame result changes it.
 */
export function buildBeats(run: Pick<RunState, 'flags'>): Beat[] {
    const away = awayOf(run.flags);
    const gag = lines(away.includes('ric') ? 'ending.upstairsFrangetta' : 'ending.upstairs');
    const tv = lines('scenes.divano.meet');
    const tag = t('ending.fromUpstairs');
    return [
        ...[...lines('scenes.divano.arrival'), ...tv, ...lines('scenes.divano.join')].map((l) => ({ l, upstairs: false })),
        ...gag.map((l) => ({ l, upstairs: true }))
    ].map(({ l, upstairs }) => {
        const who = l.speaker === 'narratore' ? undefined : person(l.speaker);
        const name = who ? (upstairs && away.includes(l.speaker) ? `${who.name} ${tag}` : who.name) : ''; // only a gag line can come from upstairs
        return { speaker: l.speaker, name, text: l.text.replace(/\{ric\}/g, 'Ric').replace(/\s*\n\s*/g, ' '), upstairs, laugh: l === tv[tv.length - 1] };
    });
}
