// Rhythm game song: a clear catchy lead on channel 0 over a steady kick and snare, 120 bpm, C major, 26 bars.
// Bars 1-2 are the intro (the lead is silent, so the first chart notes have time to fall), then A, A', B, B', A and an ending.
// The chart of the minigame is built from channel 0 (see src/game/minigames/rhythm/chart.ts), so edit the lead with care:
// every note on a beat becomes a falling note, and the offbeat eighths are decoration the player does not need to hit.
import type { Track } from '../Sequencer';
import { compose } from './lib/compose';

const A = 'E5:2 G5:2 C6:4 G5:2 E5:2 G5:4 | D5:2 G5:2 B5:4 G5:2 D5:2 B5:4 | A5:2 C6:2 E6:4 C6:2 A5:2 E5:4 | F5:2 A5:2 C6:4 A5:2 F5:2 D5:4';
const A_CHORDS = 'C | G | Am | F';
const feel = { bass: 'eighths', arp: 'up', drums: 'rock', fill: 'fill' } as const;
const REST = '-:16';

export default compose({
    id: 'rhythm',
    bpm: 120,
    maxHold: 16,
    sections: [
        { ...feel, chords: 'C | G', lead: `${REST} | ${REST}`, fill: 'rock' },
        { ...feel, chords: A_CHORDS, lead: A },
        {
            ...feel,
            chords: 'C | G | Am | G',
            lead: 'G5:2 E5:2 C6:4 E6:2 C6:2 G5:4 | B5:2 D6:2 G6:4 D6:2 B5:2 G5:4 | C6:2 A5:2 E5:4 A5:2 C6:2 E6:4 | D6:2 B5:2 G5:4 -:2 D5:2 G5:4'
        },
        {
            ...feel,
            chords: 'F | G | Em | Am',
            lead: 'A5:4 C6:2 A5:2 F5:4 A5:4 | B5:4 D6:2 B5:2 G5:4 B5:4 | G5:2 E5:2 B5:4 G5:2 E5:2 B5:4 | E6:4 C6:2 A5:2 C6:4 E6:4',
            bass: 'drive',
            arp: 'stab'
        },
        {
            ...feel,
            chords: 'F | G | C | G',
            lead: 'C6:2 A5:2 F5:4 A5:2 C6:2 F6:4 | D6:2 B5:2 G5:4 B5:2 D6:2 G6:4 | E6:2 C6:2 G5:4 C6:2 E6:2 C6:4 | D6:2 B5:2 G5:2 B5:2 D6:2 -:2 G5:4',
            bass: 'drive',
            arp: 'stab'
        },
        { ...feel, chords: A_CHORDS, lead: A },
        { ...feel, chords: 'F | G | C | C', lead: 'A5:4 F5:4 C6:4 A5:4 | B5:4 G5:4 D6:4 B5:4 | E6:2 C6:2 G5:2 E5:2 C6:8 | C6:4 -:12', fill: 'rock' }
    ]
}) satisfies Track;
