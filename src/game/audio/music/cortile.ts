// Cortile: warm band-rehearsal rock-pop with a driving bass, 112 bpm, A major, 24 bars (verse, chorus, verse).
import type { Track } from '../Sequencer';
import { compose } from './lib/compose';

const VERSE =
    'E5:2 A5:2 C#6:4 B5:2 A5:2 E5:4 | B5:2 E6:2 G#5:4 B5:2 E5:2 G#5:4 | C#6:2 F#6:2 A5:4 C#6:2 F#5:2 A5:4 | D6:2 A5:2 F#5:4 A5:2 D6:2 F#6:4 | E6:4 C#6:2 A5:2 C#6:2 E6:2 C#6:4 | B5:4 G#5:2 E5:2 G#5:2 B5:2 E6:4 | F#5:2 A5:2 D6:4 E6:2 B5:2 G#5:2 B5:2';
const VERSE_CHORDS = 'A | E | F#m | D | A | E | D E';

export default compose({
    id: 'cortile',
    bpm: 112,
    sections: [
        { chords: `${VERSE_CHORDS} | A`, lead: `${VERSE} | A5:4 C#6:2 E6:2 A5:8`, bass: 'drive', arp: 'stab', drums: 'drive', fill: 'fill' },
        {
            chords: 'D | A | E | F#m | D | A | E | E',
            lead: 'A5:2 D6:2 D6:4 F#6:2 D6:2 A5:4 | C#6:2 E6:2 E6:4 C#6:2 A5:2 E6:4 | B5:2 E6:2 E6:4 G#6:2 E6:2 B5:4 | C#6:2 F#6:2 F#6:4 A5:2 C#6:2 F#5:4 | D6:2 F#6:2 F#6:4 D6:2 A5:2 D6:4 | E6:2 C#6:2 A5:4 C#6:2 E6:2 A5:4 | G#5:2 B5:2 E6:4 B5:2 G#5:2 E5:4 | E6:4 -:4 B5:2 G#5:2 E5:4',
            bass: 'eighths',
            arp: 'up',
            drums: 'rock',
            fill: 'fill'
        },
        { chords: `${VERSE_CHORDS} | A`, lead: `${VERSE} | A5:2 E5:2 A5:2 C#6:2 A5:8`, bass: 'drive', arp: 'stab', drums: 'drive', fill: 'fill' }
    ]
}) satisfies Track;
