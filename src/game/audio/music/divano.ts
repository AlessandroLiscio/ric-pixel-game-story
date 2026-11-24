// Divano: slow, sleepy, cozy music-box lullaby, 72 bpm, Bb major, 16 bars (A A' B A).
import type { Track } from '../Sequencer';
import { compose } from './lib/compose';

const feel = { bass: 'half', arp: 'slow', drums: 'lull', fill: 'lull' } as const;
const A_CHORDS = 'Bb | Eb | Bb F | Bb';

export default compose({
    id: 'divano',
    bpm: 72,
    flats: true,
    lead: { wave: 'square', volume: 0.8 },
    harm: { wave: 'pulse25', volume: 0.35 },
    noiseVolume: 0.15,
    sections: [
        { ...feel, chords: A_CHORDS, lead: 'F5:4 D5:4 F5:4 Bb5:4 | G5:4 Eb5:4 G5:4 Bb5:4 | D5:4 F5:4 C5:4 A4:4 | Bb4:4 -:12' },
        { ...feel, chords: A_CHORDS, lead: 'F5:4 D5:4 Bb4:4 D5:4 | Eb5:4 G5:4 Bb5:4 G5:4 | D5:4 F5:4 A4:4 C5:4 | Bb4:4 -:12' },
        { ...feel, chords: 'Gm | Cm | F7 | F', lead: 'G5:4 Bb5:4 D6:4 Bb5:4 | Eb6:4 C6:4 G5:4 Eb5:4 | A5:4 F5:4 C5:4 Eb5:4 | F5:4 -:12' },
        { ...feel, chords: A_CHORDS, lead: 'F5:4 D5:4 F5:4 Bb5:4 | G5:4 Eb5:4 G5:4 Bb5:4 | D5:4 F5:4 C5:4 A4:4 | Bb4:4 -:12' }
    ]
}) satisfies Track;
