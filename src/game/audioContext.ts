// ONE AudioContext for the whole game. Phaser's sound manager is given this context through
// `audio.context` in the game config; the chiptune sequencer and SFX synth (W2/W3) must use it too.
// Browsers keep a new context suspended until a user gesture: call unlockAudio() from a key press.
let ctx: AudioContext | undefined;

export function getAudioContext(): AudioContext {
    ctx ??= new AudioContext();
    return ctx;
}

export async function unlockAudio(): Promise<AudioContext> {
    const c = getAudioContext();
    if (c.state !== 'running') await c.resume();
    return c;
}

/** Short square-wave beep on the shared context. */
export function beep(freq = 880, seconds = 0.08, volume = 0.05): void {
    const c = getAudioContext();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + seconds);
}
