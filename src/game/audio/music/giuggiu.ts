// Giuggiu: lazy lounge, swing feel from long-short note placement (3+1 steps), jazzy seventh chords, 88 bpm, F major, 24 bars (A B A').
import type { Track } from '../Sequencer';
import { compose } from './lib/compose';

const A =
    'A5:3 G5:1 F5:4 C5:3 E5:1 F5:4 | D5:3 F5:1 A5:4 C6:6 -:2 | Bb5:3 A5:1 G5:4 D5:3 F5:1 G5:4 | E5:3 G5:1 Bb5:4 A5:2 G5:2 E5:4 | A5:3 C6:1 F6:4 E6:3 C6:1 A5:4 | C6:3 A5:1 E5:4 G5:3 A5:1 C6:4 | D6:3 C6:1 Bb5:4 A5:3 F5:1 D5:4';
const CHORDS = 'Fmaj7 | Dm7 | Gm7 | C7 | Fmaj7 | Am7 | Bbmaj7';
const feel = { bass: 'swing', arp: 'offbeat', drums: 'swing', fill: 'fillsoft' } as const;

export default compose({
    id: 'giuggiu',
    bpm: 88,
    flats: true,
    harm: { wave: 'pulse25', volume: 0.4 },
    sections: [
        { ...feel, chords: `${CHORDS} | C7`, lead: `${A} | G5:4 E5:3 G5:1 Bb5:4 -:4` },
        {
            ...feel,
            chords: 'Dm7 | Gm7 | C7 | Fmaj7 | Dm7 | Gm7 | C7 | Fmaj7',
            lead: 'F5:3 A5:1 D6:4 C6:3 A5:1 F5:4 | G5:3 Bb5:1 D6:4 F6:2 D6:2 Bb5:4 | E6:3 D6:1 C6:4 Bb5:3 G5:1 E5:4 | F5:3 A5:1 C6:4 E6:8 | D6:3 C6:1 A5:4 F5:3 A5:1 D6:4 | Bb5:3 G5:1 D5:4 G5:3 Bb5:1 D6:4 | C6:3 Bb5:1 G5:4 E5:3 G5:1 Bb5:4 | A5:3 F5:1 C5:4 -:8'
        },
        { ...feel, chords: `${CHORDS} | C7 Fmaj7`, lead: `${A} | G5:4 E5:4 A5:4 F5:4` }
    ]
}) satisfies Track;
