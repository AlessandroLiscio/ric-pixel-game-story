// Giardini: sunny and bouncy, dotted skipping rhythm (3+1 steps), 120 bpm, D major, 24 bars (A B A').
import type { Track } from '../Sequencer';
import { compose } from './lib/compose';

const A =
    'F#5:3 A5:1 D6:3 A5:1 F#5:3 A5:1 D6:3 A5:1 | B5:3 G5:1 D5:3 G5:1 B5:4 D6:4 | A5:3 F#5:1 D5:3 F#5:1 A5:4 F#5:4 | E5:3 A5:1 C#6:3 A5:1 E6:4 C#6:4 | D6:3 A5:1 F#5:3 A5:1 D6:3 F#6:1 A6:4 | G6:3 D6:1 B5:3 D6:1 G6:4 B5:4 | G5:3 B5:1 E6:4 C#6:3 A5:1 E5:4';
const CHORDS = 'D | G | D | A | D | G | Em A';
const feel = { bass: 'bounce', arp: 'skip', drums: 'bounce', fill: 'fill' } as const;

export default compose({
    id: 'giardini',
    bpm: 120,
    sections: [
        { ...feel, chords: `${CHORDS} | D`, lead: `${A} | D6:4 A5:2 F#5:2 D5:4 -:4` },
        {
            ...feel,
            chords: 'Bm | G | D | A | Bm | G | A | A',
            lead: 'B5:3 D6:1 F#6:3 D6:1 B5:3 D6:1 F#6:3 D6:1 | G5:3 B5:1 D6:3 B5:1 G6:4 D6:4 | F#6:3 D6:1 A5:3 D6:1 F#6:4 A5:4 | E6:3 C#6:1 A5:3 C#6:1 E6:4 C#6:4 | D6:2 B5:2 D6:2 F#6:2 F#6:4 D6:4 | B5:2 D6:2 G6:2 D6:2 B5:4 G5:4 | A5:2 C#6:2 E6:2 C#6:2 A5:2 C#6:2 E6:4 | E6:4 -:4 E6:2 D6:2 C#6:2 B5:2'
        },
        { ...feel, chords: `${CHORDS} | D`, lead: `${A} | D6:2 A5:2 F#5:2 A5:2 D6:8` }
    ]
}) satisfies Track;
