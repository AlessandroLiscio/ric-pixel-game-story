import { person } from '../flow/data';
import type { RunState } from '../flow/RunState';
import type { Line } from '../flow/sceneTypes';
import { lines, t } from '../ui/text';

/** One spoken line of the credits, shown until the player moves on. */
export interface Beat {
    speaker: string;
    name: string;
    text: string;
    /** True from the first line of the upstairs gag on. */
    upstairs: boolean;
    /** The line the whole room laughs at: the one marked `laugh` in dialogue.it.json. */
    laugh: boolean;
}

/** The credits column scrolls by in this long; once the last line has been read it hurries (see EndingScene). */
export const SCROLL_MS = 45000;
/** The quiet moment before the first line. */
export const LEAD_IN_MS = 2500;
/** Who goes upstairs when the gag starts (they are in the room for the whole night until then): Liscio and Lara, or Ric (the fringe girl waits up there) when he got her number. */
export const awayOf = (flags: RunState['flags'] | undefined): string[] => (flags?.numeroFrangetta ? ['ric'] : ['liscio', 'lara']);

/**
 * The night scene of the divano room, played as speech during the credits: its three groups of lines, then the upstairs gag, which starts
 * when the ones who go upstairs leave the room, so everyone who speaks before it is there to be seen. No minigame result changes it.
 */
export function buildBeats(run: Pick<RunState, 'flags'>): Beat[] {
    const away = awayOf(run.flags);
    const gag = lines(away.includes('ric') ? 'ending.upstairsFrangetta' : 'ending.upstairs');
    const tag = t('ending.fromUpstairs');
    const beat = (upstairs: boolean) => (l: Line): Beat => {
        const who = l.speaker === 'narratore' ? undefined : person(l.speaker);
        const name = who ? (upstairs && away.includes(l.speaker) ? `${who.name} ${tag}` : who.name) : ''; // only a gag line can come from upstairs
        return { speaker: l.speaker, name, text: l.text.replace(/\{ric\}/g, 'Ric').replace(/\s*\n\s*/g, ' '), upstairs, laugh: !!l.laugh };
    };
    return [...['arrival', 'meet', 'join'].flatMap((k) => lines(`scenes.divano.${k}`)).map(beat(false)), ...gag.map(beat(true))];
}
