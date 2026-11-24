// Credits: triumphant and nostalgic, 100 bpm, C major, 24 bars (A, B, then a quote of Happy Birthday as the last phrase).
// The Happy Birthday melody is in the public domain (a 2016 US court ruling voided the claimed copyright and in the EU the term has expired),
// so quoting it here is fine. Its four phrases sit in the last 8 bars; the pickup notes of the first phrase are in the last beat of bar 16.
import type { Track } from '../Sequencer';
import { compose } from './lib/compose';

export default compose({
    id: 'credits',
    bpm: 100,
    sections: [
        {
            chords: 'C | G | Am | F | C | G | F | G',
            lead: 'E5:4 G5:4 C6:4 G5:4 | D6:4 B5:4 G5:4 B5:4 | C6:4 A5:4 E5:4 A5:4 | A5:4 F5:4 C5:4 F5:4 | E5:2 G5:2 C6:4 E6:4 C6:4 | D6:2 B5:2 G5:4 B5:4 D6:4 | C6:2 A5:2 F5:4 A5:4 C6:4 | B5:4 D6:4 G5:4 -:4',
            bass: 'rf',
            arp: 'slow',
            drums: 'soft',
            fill: 'fillsoft'
        },
        {
            chords: 'F | C | G | Am | F | C G | C | G',
            lead: 'A5:2 C6:2 F6:4 E6:2 C6:2 A5:4 | G5:2 C6:2 E6:4 D6:2 C6:2 G5:4 | B5:2 D6:2 G6:4 F6:2 D6:2 B5:4 | E6:2 C6:2 A5:4 C6:2 E6:2 A5:4 | F6:4 E6:2 D6:2 C6:4 A5:4 | G6:4 E6:2 C6:2 D6:4 B5:2 G5:2 | E6:4 G6:4 C6:4 E6:4 | B4:4 D5:4 -:4 G4:3 G4:1',
            bass: 'oct',
            arp: 'up',
            drums: 'four',
            fill: 'fill'
        },
        {
            chords: 'C | G7 | G7 | C | C | F | C C G C | C',
            lead: 'A4:4 G4:4 C5:4 B4:4 | B4:4 -:8 G4:3 G4:1 | A4:4 G4:4 D5:4 C5:4 | C5:4 -:8 G4:3 G4:1 | G5:4 E5:4 C5:4 B4:4 | A4:4 -:8 F5:3 F5:1 | E5:4 C5:4 D5:4 C5:4 | -:16',
            bass: 'half',
            arp: 'slow',
            drums: 'soft',
            fill: 'lull'
        }
    ]
}) satisfies Track;
