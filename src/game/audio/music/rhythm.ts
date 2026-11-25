// Rhythm game song: a clear catchy lead on channel 0 over a steady kick and snare, 120 bpm, C major, 18 bars (36 seconds).
// Bars 1-2 are the intro (the lead is silent, so the first chart notes have time to fall), then A, B, A and a 4 bar bass solo to close.
// The chart of the minigame is built from channel 0 (see src/game/minigames/rhythm/chart.ts), so edit the lead with care:
// every note on a beat becomes a falling note, and the offbeat eighths are decoration the player does not need to hit.
// The bass solo is the lead dropped to octaves 2 and 3: there every eighth is a chart note (twice the density), and consecutive
// notes always change lane, because eighths (0.25 s) are closer than the same-lane gap allows.
import type { Track } from '../Sequencer';
import { compose } from './lib/compose';

const A = 'E5:2 G5:2 C6:4 G5:2 E5:2 G5:4 | D5:2 G5:2 B5:4 G5:2 D5:2 B5:4 | A5:2 C6:2 E6:4 C6:2 A5:2 E5:4 | F5:2 A5:2 C6:4 A5:2 F5:2 D5:4';
const A_CHORDS = 'C | G | Am | F';
const feel = { bass: 'eighths', arp: 'up', drums: 'rock', fill: 'fill' } as const;
const REST = '-:16';

export default compose({
    id: 'rhythm',
    bpm: 120,
    sections: [
        { ...feel, chords: 'C | G', lead: `${REST} | ${REST}`, fill: 'rock' },
        { ...feel, chords: A_CHORDS, lead: A },
        {
            ...feel,
            chords: 'F | G | Em | Am',
            lead: 'A5:4 C6:2 A5:2 F5:4 A5:4 | B5:4 D6:2 B5:2 G5:4 B5:4 | G5:2 E5:2 B5:4 G5:2 E5:2 B5:4 | E6:4 C6:2 A5:2 C6:4 E6:4',
            bass: 'drive',
            arp: 'stab'
        },
        { ...feel, chords: A_CHORDS, lead: A },
        {
            // the bass solo: the lead walks the chords in the low register, the bass and the arpeggio step aside
            chords: 'C | Am | F | G',
            lead: 'C3 E3 G3 A3 G3 E3 C3 E3 | A2 C3 E3 G3 A3 G3 E3 C3 | F2 A2 C3 D3 F3 D3 C3 A2 | G2 B2 D3 G3 C3:8',
            bass: 'none',
            arp: 'none',
            drums: 'drive',
            fill: 'fill'
        }
    ]
}) satisfies Track;
