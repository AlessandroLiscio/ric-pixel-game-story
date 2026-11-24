// Circe: hurried and comic chase, running eighths, 140 bpm, A minor (G# as the leading tone), 24 bars (A B A').
import type { Track } from '../Sequencer';
import { compose } from './lib/compose';

const A =
    'A5:2 C6:2 E6:2 C6:2 A5:2 C6:2 E6:4 | D6:2 F6:2 A5:2 F6:2 D6:2 F6:2 A5:4 | E6:1 D6:1 C6:1 B5:1 A5:2 C6:2 E6:2 A5:2 C6:4 | B5:2 G#5:2 E5:2 G#5:2 B5:4 -:2 B5:2 | E6:2 E6:2 C6:2 C6:2 A5:2 A5:2 C6:4 | F6:2 E6:2 D6:2 C6:2 D6:2 F6:2 A5:4 | G#5:2 B5:2 E6:2 B5:2 G#5:2 B5:2 E6:4';
const CHORDS = 'Am | Dm | Am | E | Am | Dm | E';
const feel = { bass: 'chase', arp: 'chase', drums: 'chase', fill: 'fill' } as const;

export default compose({
    id: 'circe',
    bpm: 140,
    sections: [
        { ...feel, chords: `${CHORDS} | Am`, lead: `${A} | A5:2 C6:2 E6:2 A5:2 A5:6 -:2` },
        {
            ...feel,
            chords: 'F | G | Am | Em | F | G | E | E',
            lead: 'F6:2 A5:2 C6:2 A5:2 F6:2 A5:2 C6:4 | G5:2 B5:2 D6:2 B5:2 G5:2 B5:2 D6:4 | C6:2 E6:2 A5:2 E6:2 C6:2 E6:2 A5:4 | B5:2 E6:2 G5:2 E6:2 B5:2 E6:2 G5:4 | A5:1 C6:1 F6:2 A5:1 C6:1 F6:2 A5:2 F6:2 C6:4 | B5:1 D6:1 G6:2 B5:1 D6:1 G6:2 D6:2 B5:2 G5:4 | E6:2 D6:1 C6:1 B5:2 G#5:2 E5:2 G#5:2 B5:4 | E6:4 B5:4 G#5:4 -:4'
        },
        { ...feel, chords: `${CHORDS} | Am`, lead: `${A} | A5:2 C6:2 E6:2 C6:2 A5:8` }
    ]
}) satisfies Track;
