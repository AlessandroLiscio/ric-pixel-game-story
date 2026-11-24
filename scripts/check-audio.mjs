// Run: node scripts/check-audio.mjs
// Proves, in the installed Chrome (Playwright channel 'chrome'), that the audio code makes sound:
//   1. noteFreq maps note names to the right pitches
//   2. every sfx name renders non-silent (peak > 0.01, below 1.0) in an OfflineAudioContext
//   3. an inline 4-channel track renders non-silent in an OfflineAudioContext, with peak below 1.0, and an all-rest track is silent
//   4. the real Sequencer schedules notes on a live AudioContext (look-ahead timer, beat clock advances, signal on an AnalyserNode, no exception)
// How: the pure modules src/game/audio/{synth,sfx,Sequencer}.ts (no Phaser) are bundled with Vite into logs/check-audio/harness
// and run inside a blank page. Peak, RMS and length per sfx go to logs/check-audio/details.log only (agents have no ears).
// Prints `PASS audio: sequencer and sfx render non-silent` or a FAIL block.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { build } from 'vite';
import { fail, log, ROOT } from './lib/run.mjs';

const S = 'check-audio';
const detailsFile = log(S, 'details');
const harnessDir = join(ROOT, 'logs', S, 'harness');
mkdirSync(harnessDir, { recursive: true });
const audioDir = join(ROOT, 'src', 'game', 'audio').split('\\').join('/');

const entry = join(harnessDir, 'entry.ts');
writeFileSync(
    entry,
    `import { noteFreq } from '${audioDir}/synth';
import { playSfx, SFX_NAMES } from '${audioDir}/sfx';
import { renderTrack, Sequencer, type Track } from '${audioDir}/Sequencer';

const RATE = 44100;
function stats(buf: AudioBuffer) {
    const d = buf.getChannelData(0);
    let peak = 0, sum = 0, last = 0;
    for (let i = 0; i < d.length; i++) {
        const a = Math.abs(d[i]);
        if (a > peak) peak = a;
        sum += d[i] * d[i];
        if (a > 0.001) last = i;
    }
    return { peak, rms: Math.sqrt(sum / d.length), seconds: last / RATE };
}
async function offline(seconds: number, fill: (c: OfflineAudioContext) => void) {
    const c = new OfflineAudioContext(1, Math.ceil(RATE * seconds), RATE);
    fill(c);
    return stats(await c.startRendering());
}
const track = (id: string, notes: (string | null)[][]): Track => ({
    id, bpm: 140, steps: 16,
    channels: [
        { wave: 'square', volume: 1, notes: notes[0] },
        { wave: 'triangle', volume: 1, notes: notes[1] },
        { wave: 'noise', volume: 1, notes: notes[2] },
        { wave: 'pulse25', volume: 1, notes: notes[3] }
    ]
});
const melody = ['C5', '-', 'E5', '=', 'G5', '-', 'C6', '-', 'B4', '-', 'G4', '=', 'E4', '-', 'C4', '-'];
const bass = ['C3', '-', '-', '-', 'G2', '-', '-', '-', 'A2', '-', '-', '-', 'F2', '-', '-', '-'];
const drums = ['C4', '-', 'C5', '-', 'C4', '-', 'C5', 'C5', 'C4', '-', 'C5', '-', 'C4', '-', 'C5', '-'];
const arp = ['E4', 'G4', 'C5', 'G4', 'E4', 'G4', 'C5', 'G4', 'D4', 'F4', 'B4', 'F4', 'D4', 'F4', 'B4', 'F4'];
const rests = Array(16).fill('-');

(window as any).harness = {
    async run() {
        const out: any = { notes: {}, sfx: {}, track: null, silent: null, live: null, errors: [] };
        out.notes = { a4: noteFreq('A4'), c4: noteFreq('C4'), gs3: noteFreq('G#3'), bb2: noteFreq('Bb2'), rest: noteFreq('-'), nul: noteFreq(null) };

        for (const name of SFX_NAMES) {
            out.sfx[name] = await offline(1, (c) => playSfx(c, c.destination, name, 0));
        }
        const t = track('inline', [melody, bass, drums, arp]);
        out.track = await offline(4, (c) => { renderTrack(c, c.destination, t, 0, 2); });
        out.silent = await offline(1, (c) => { renderTrack(c, c.destination, track('rests', [rests, rests, rests, rests]), 0, 1); });

        // Live context: the real Sequencer with its look-ahead timer.
        const ctx = new AudioContext();
        await ctx.resume();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.connect(ctx.destination);
        const seq = new Sequencer(ctx, analyser);
        const buf = new Float32Array(analyser.fftSize);
        let peak = 0;
        const sample = () => {
            analyser.getFloatTimeDomainData(buf);
            for (const v of buf) peak = Math.max(peak, Math.abs(v));
        };
        const timer = setInterval(sample, 10);
        const clock0 = seq.getBeatClock();
        seq.play(t);
        await new Promise((r) => setTimeout(r, 900));
        const clock1 = seq.getBeatClock();
        seq.stop();
        const afterStop = seq.getBeatClock();
        await new Promise((r) => setTimeout(r, 200));
        clearInterval(timer);
        out.live = { state: ctx.state, clock0, clock1, afterStop, peak };
        await ctx.close();
        return out;
    }
};
`
);

try {
    await build({
        configFile: false,
        logLevel: 'silent',
        root: ROOT,
        build: {
            outDir: harnessDir,
            emptyOutDir: false,
            minify: false,
            lib: { entry, name: 'AudioHarness', formats: ['iife'], fileName: () => 'harness.js' }
        }
    });
} catch (e) {
    writeFileSync(detailsFile, String(e.stack ?? e));
    fail('bundle', detailsFile, String(e.message ?? e));
}

const lines = [];
const problems = [];
const check = (ok, msg) => ok || problems.push(msg);
let browser;
try {
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && pageErrors.push(`console.error: ${m.text()}`));
    await page.setContent('<!doctype html><title>audio harness</title>');
    await page.addScriptTag({ path: join(harnessDir, 'harness.js') });
    const r = await page.evaluate(() => window.harness.run());

    const f = (n) => Number(n).toFixed(3);
    lines.push(`notes ${JSON.stringify(r.notes)}`);
    check(Math.abs(r.notes.a4 - 440) < 0.01, `A4 is ${r.notes.a4}, expected 440`);
    check(Math.abs(r.notes.c4 - 261.6256) < 0.01, `C4 is ${r.notes.c4}, expected 261.63`);
    check(Math.abs(r.notes.gs3 - 207.652) < 0.01, `G#3 is ${r.notes.gs3}, expected 207.65`);
    check(Math.abs(r.notes.bb2 - 116.541) < 0.01, `Bb2 is ${r.notes.bb2}, expected 116.54`);
    check(r.notes.rest === null && r.notes.nul === null, 'rests must give null');

    const expected = ['blip', 'confirm', 'cancel', 'hit', 'miss', 'win', 'lose', 'door', 'step', 'meow'];
    check(JSON.stringify(Object.keys(r.sfx)) === JSON.stringify(expected), `sfx names are ${Object.keys(r.sfx).join(',')}`);
    for (const [name, s] of Object.entries(r.sfx)) {
        lines.push(`sfx ${name.padEnd(8)} peak ${f(s.peak)} rms ${f(s.rms)} length ${f(s.seconds)}s`);
        check(s.peak > 0.01, `sfx ${name} is silent (peak ${f(s.peak)})`);
        check(s.peak < 1, `sfx ${name} clips (peak ${f(s.peak)})`);
        check(s.seconds > 0.02 && s.seconds < 1, `sfx ${name} length ${f(s.seconds)}s outside 0.02..1 s`);
    }
    lines.push(`track inline peak ${f(r.track.peak)} rms ${f(r.track.rms)} length ${f(r.track.seconds)}s`);
    check(r.track.peak > 0.05, `track renders silent (peak ${f(r.track.peak)})`);
    check(r.track.peak < 1, `track clips (peak ${f(r.track.peak)})`);
    // 16 steps at 140 bpm = 1.714 s per loop, 2 loops.
    check(r.track.seconds > 3, `track too short: ${f(r.track.seconds)}s`);
    lines.push(`track rests peak ${f(r.silent.peak)}`);
    check(r.silent.peak === 0, 'an all-rest track must be silent');
    lines.push(`live ${JSON.stringify(r.live)}`);
    check(r.live.state === 'running', `live context is ${r.live.state}`);
    check(r.live.clock1 > 0.2 && r.live.clock1 < 1.5, `beat clock after 0.9 s (headless output may start late) is ${f(r.live.clock1)}`);
    check(r.live.afterStop === 0, 'beat clock must be 0 after stop');
    check(r.live.peak > 0.02 && r.live.peak < 1, `live signal peak ${f(r.live.peak)}`);
    check(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`);
} catch (e) {
    problems.push(String(e.message ?? e));
} finally {
    await browser?.close();
}

writeFileSync(detailsFile, `${lines.join('\n')}\n${problems.length ? `PROBLEMS\n${problems.join('\n')}\n` : ''}`);
if (problems.length) fail('audio', detailsFile, problems.slice(0, 5).join('\n'));
console.log('PASS audio: sequencer and sfx render non-silent');
