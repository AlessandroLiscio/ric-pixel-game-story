// Universita: academic and quirky, staccato pizzicato-like notes with a metronome tick, 108 bpm, G major, 24 bars (A B A').
import type { Track } from '../Sequencer';
import { compose } from './lib/compose';

const A =
    'B4:1 -:1 D5:1 -:1 G5:1 -:1 D5:1 -:1 B5:2 G5:2 D5:2 B4:2 | E5:1 -:1 G5:1 -:1 B5:1 -:1 G5:1 -:1 E5:2 G5:2 B5:4 | C5:1 -:1 E5:1 -:1 G5:1 -:1 E5:1 -:1 C6:4 G5:2 E5:2 | D5:1 -:1 F#5:1 -:1 A5:1 -:1 F#5:1 -:1 D6:4 A5:2 F#5:2 | G5:2 B5:2 D6:2 B5:2 G5:2 B5:2 D6:4 | E6:2 D6:2 B5:2 G5:2 E5:2 G5:2 B5:4 | C6:2 B5:2 A5:2 C6:2 A5:2 F#5:2 D5:2 F#5:2';
const A_CHORDS = 'G | Em | C | D | G | Em | Am D';
const TICK = 'h - - - h - - - h - - - h - - -';

export default compose({
    id: 'universita',
    bpm: 108,
    sections: [
        {
            chords: `${A_CHORDS} | G`,
            lead: `${A} | G5:4 -:2 B4:2 D5:2 G5:2 -:4`,
            bass: 'rf',
            arp: 'pluck',
            drums: TICK,
            fill: 'h - h - h - h - h h h h s s s s'
        },
        {
            chords: 'Am | D | G | Em | C | Am | D | D',
            lead: 'A5:3 -:1 C6:3 -:1 E6:3 -:1 C6:3 -:1 | D6:3 -:1 A5:3 -:1 F#5:3 -:1 A5:3 -:1 | B5:3 -:1 G5:3 -:1 D5:3 -:1 G5:3 -:1 | E5:3 -:1 G5:3 -:1 B5:3 -:1 E6:3 -:1 | C6:2 B5:2 C6:2 E6:2 G6:4 E6:4 | A5:2 G5:2 A5:2 C6:2 E6:4 C6:4 | D6:2 C6:2 B5:2 A5:2 G5:2 F#5:2 A5:2 D6:2 | D6:4 -:4 A5:2 F#5:2 D5:4',
            bass: 'half',
            arp: 'skip',
            drums: TICK,
            fill: 'h - h - h - h - h h h h s s s s'
        },
        {
            chords: `${A_CHORDS} | G`,
            lead: `${A} | G5:2 D5:2 B4:2 D5:2 G4:4 -:4`,
            bass: 'rf',
            arp: 'pluck',
            drums: TICK,
            fill: 'h - h - h - h - h h h h s s s s'
        }
    ]
}) satisfies Track;
