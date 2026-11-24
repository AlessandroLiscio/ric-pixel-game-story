// Title screen: heroic and cheerful, 128 bpm, C major, 24 bars (A B A').
import type { Track } from '../Sequencer';
import { compose } from './lib/compose';

const A = 'G4:2 C5:2 E5:2 G5:4 E5:2 G5:4 | F5:2 D5:2 B4:4 D5:2 G5:2 F5:2 D5:2 | C5:2 E5:2 A5:4 G5:2 E5:2 C5:4 | A5:2 F5:2 C5:2 F5:2 A5:4 G5:4 | E5:4 G5:2 E5:2 C6:6 G5:2 | B5:4 G5:2 D5:2 G5:4 B4:2 D5:2';
const A_CHORDS = 'C | G | Am | F | C | G';
const B =
    'E5:4 A5:4 G5:2 E5:2 C5:4 | B4:4 E5:4 D5:2 B4:2 G4:4 | A4:4 C5:4 F5:4 E5:2 D5:2 | E5:8 G5:4 C5:4 | A5:4 G5:2 E5:2 A5:4 C6:4 | D6:4 C6:2 A5:2 F5:4 A5:4 | G5:4 B5:4 D6:4 B5:2 G5:2 | F5:2 G5:2 B5:2 D6:2 G6:4 -:2 G5:2';

export default compose({
    id: 'title',
    bpm: 128,
    sections: [
        {
            chords: `${A_CHORDS} | F G | C`,
            lead: `${A} | A5:4 F5:2 A5:2 G5:4 B5:4 | C6:2 G5:2 E5:2 G5:2 C6:8`,
            bass: 'oct',
            arp: 'up',
            drums: 'four',
            fill: 'fill'
        },
        {
            chords: 'Am | Em | F | C | Am | Dm | G | G7',
            lead: B,
            bass: 'oct',
            arp: 'up8',
            drums: 'four',
            fill: 'fill'
        },
        {
            chords: `${A_CHORDS} | F G | C`,
            lead: `${A} | A5:4 F5:2 A5:2 G5:2 B5:2 D6:2 G6:2 | C6:2 G5:2 E5:2 G5:2 C6:8`,
            bass: 'oct',
            arp: 'up',
            drums: 'four',
            fill: 'fill'
        }
    ]
}) satisfies Track;
