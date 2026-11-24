// Run: node scripts/check-music.mjs
// Proves, in the installed Chrome (Playwright channel 'chrome'), that the nine music tracks are valid and make sound:
//   1. every track id exists (title universita giuggiu giardini circe cortile divano credits rhythm) and its shape is valid:
//      bpm, steps (16 to 32 bars of 16 steps), 3 or 4 channels, every channel as long as `steps`, every note parses
//   2. every pitched note stays in the track's key (at most 10 percent out of key)
//   3. each track renders one loop through the real Sequencer code (renderTrack) into an OfflineAudioContext: not silent, peak below 0.95
//   4. the chart of the rhythm minigame (built from the lead channel) has the right length, lanes and spacing
// How: the pure modules are bundled with Vite into logs/check-music/harness and run in a blank page. Duration, peak and RMS per track go to
// logs/check-music/details.log only (agents have no ears). Prints `PASS music: 9 tracks, rendered, no clipping` or a FAIL block.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { build } from 'vite';
import { fail, log, ROOT } from './lib/run.mjs';

const S = 'check-music';
const detailsFile = log(S, 'details');
const harnessDir = join(ROOT, 'logs', S, 'harness');
mkdirSync(harnessDir, { recursive: true });
const posix = (p) => p.split('\\').join('/');
const audioDir = posix(join(ROOT, 'src', 'game', 'audio'));
const rhythmDir = posix(join(ROOT, 'src', 'game', 'minigames', 'rhythm'));

const KEYS = {
    title: ['C', 'major'],
    universita: ['G', 'major'],
    giuggiu: ['F', 'major'],
    giardini: ['D', 'major'],
    circe: ['A', 'minor'],
    cortile: ['A', 'major'],
    divano: ['Bb', 'major'],
    credits: ['C', 'major'],
    rhythm: ['C', 'major']
};
const IDS = Object.keys(KEYS);
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10, 11]; // natural minor plus the raised seventh (harmonic)
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pcOf = (name) => {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    return (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
};
const NOTE = /^([A-G][#b]?-?\d|-|=)$/;
const MAX_OUT_OF_KEY = 0.1;
const RENDER_RATE = 16000;
const FALL_MIN_FIRST = 1.7; // the first chart note must be later than the fall time of the minigame (1.6 s)

const entry = join(harnessDir, 'entry.ts');
writeFileSync(
    entry,
    `import { renderTrack, type Track } from '${audioDir}/Sequencer';
import { buildChartInfo } from '${rhythmDir}/chart';

const mods = import.meta.glob('/src/game/audio/music/*.ts', { eager: true }) as Record<string, { default?: Track }>;

(window as any).harness = {
    tracks: Object.fromEntries(Object.entries(mods).map(([path, m]) => [path.split('/').pop()!.replace(/\\.ts$/, ''), m.default ?? null])),
    async render(id: string, RATE = 44100) {
        const track = (mods['/src/game/audio/music/' + id + '.ts'] ?? {}).default as Track;
        const seconds = (track.steps * 60) / track.bpm / 4;
        const c = new OfflineAudioContext(1, Math.ceil(RATE * (seconds + 1)), RATE);
        renderTrack(c, c.destination, track, 0, 1);
        const d = (await c.startRendering()).getChannelData(0);
        let peak = 0, sum = 0;
        for (let i = 0; i < d.length; i++) {
            const a = Math.abs(d[i]);
            if (a > peak) peak = a;
            sum += d[i] * d[i];
        }
        return { seconds, peak, rms: Math.sqrt(sum / d.length) };
    },
    chart(id: string) {
        const track = (mods['/src/game/audio/music/' + id + '.ts'] ?? {}).default as Track;
        return { info: buildChartInfo(track), seconds: (track.steps * 60) / track.bpm / 4 };
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
            lib: { entry, name: 'MusicHarness', formats: ['iife'], fileName: () => 'harness.js' }
        }
    });
} catch (e) {
    writeFileSync(detailsFile, String(e.stack ?? e));
    fail('bundle', detailsFile, String(e.message ?? e));
}

const lines = [];
const problems = [];
const check = (ok, msg) => ok || problems.push(msg);
const f = (n) => Number(n).toFixed(3);
let browser;
try {
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && pageErrors.push(`console.error: ${m.text()}`));
    await page.setContent('<!doctype html><title>music harness</title>');
    await page.addScriptTag({ path: join(harnessDir, 'harness.js') });
    const tracks = await page.evaluate(() => window.harness.tracks);
    // The offline render is CPU bound (45 s of audio takes about 45 s at 44.1 kHz here), so all tracks render in parallel at 16 kHz.
    const present = IDS.filter((id) => tracks[id]);
    const renders = await page.evaluate(([ids, rate]) => Promise.all(ids.map((i) => window.harness.render(i, rate))), [present, RENDER_RATE]);

    for (const id of IDS) {
        const t = tracks[id];
        if (!t) {
            problems.push(`track ${id} is missing (src/game/audio/music/${id}.ts with a default Track)`);
            continue;
        }
        check(t.id === id, `${id}: id is "${t.id}"`);
        check(Number.isFinite(t.bpm) && t.bpm >= 60 && t.bpm <= 200, `${id}: bpm ${t.bpm}`);
        check(Number.isInteger(t.steps) && t.steps % 16 === 0 && t.steps >= 256 && t.steps <= 512, `${id}: steps ${t.steps} is not 16 to 32 bars`);
        check(Array.isArray(t.channels) && t.channels.length >= 3 && t.channels.length <= 4, `${id}: ${t.channels?.length} channels, need 3 or 4`);
        let pitched = 0;
        let out = 0;
        const [tonic, mode] = KEYS[id];
        const scale = new Set((mode === 'major' ? MAJOR : MINOR).map((i) => (pcOf(`${tonic}4`) + i) % 12));
        for (const [ci, ch] of (t.channels ?? []).entries()) {
            check(['square', 'triangle', 'noise', 'pulse25'].includes(ch.wave), `${id}: channel ${ci} wave "${ch.wave}"`);
            check(ch.volume > 0 && ch.volume <= 1, `${id}: channel ${ci} volume ${ch.volume}`);
            check(ch.notes.length === t.steps, `${id}: channel ${ci} has ${ch.notes.length} notes, steps is ${t.steps}`);
            const unparsed = ch.notes.filter((n) => n !== null && !NOTE.test(n));
            check(unparsed.length === 0, `${id}: channel ${ci} has notes that do not parse: ${unparsed.slice(0, 3).join(' ')}`);
            check(ch.notes.some((n) => n && /^[A-G]/.test(n)), `${id}: channel ${ci} has no notes`);
            if (ch.wave === 'noise') continue;
            for (const n of ch.notes) {
                if (!n || !/^[A-G]/.test(n)) continue;
                pitched++;
                if (!scale.has(pcOf(n))) out++;
            }
        }
        const share = pitched ? out / pitched : 1;
        check(share <= MAX_OUT_OF_KEY, `${id}: ${(share * 100).toFixed(1)}% of the notes are out of ${tonic} ${mode} (max 10%)`);
        const r = renders[present.indexOf(id)];
        lines.push(`${id.padEnd(10)} ${t.bpm} bpm ${t.steps / 16} bars ${f(r.seconds)}s peak ${f(r.peak)} rms ${f(r.rms)} out-of-key ${(share * 100).toFixed(1)}%`);
        check(r.peak > 0.05, `${id}: renders silent (peak ${f(r.peak)})`);
        check(r.peak < 0.95, `${id}: clips (peak ${f(r.peak)})`);
        check(r.rms > 0.005, `${id}: rms ${f(r.rms)} is too quiet`);
    }
    for (const id of Object.keys(tracks)) check(IDS.includes(id), `unexpected track file ${id}.ts`);

    if (tracks.rhythm) {
        const { info, seconds } = await page.evaluate(() => window.harness.chart('rhythm'));
        const n = info.notes;
        const lanes = [0, 1, 2, 3].map((l) => n.filter((x) => x.lane === l).length);
        let minGap = Infinity;
        for (let l = 0; l < 4; l++) {
            const ts = n.filter((x) => x.lane === l).map((x) => x.t);
            for (let i = 1; i < ts.length; i++) minGap = Math.min(minGap, ts[i] - ts[i - 1]);
        }
        lines.push(`rhythm chart ${n.length} notes, song ${f(seconds)}s, first ${f(n[0]?.t)}s, last ${f(n.at(-1)?.t)}s, per lane ${lanes.join('/')}, min same-lane gap ${f(minGap)}s, offbeat skipped ${info.skippedOffbeat}, dropped ${info.dropped}`);
        check(seconds >= 45 && seconds <= 60, `rhythm song is ${f(seconds)}s, need 45 to 60`);
        check(n.length >= 40 && n.length <= 140, `rhythm chart has ${n.length} notes`);
        check(lanes.every((c) => c >= 8), `rhythm chart lanes are uneven: ${lanes.join('/')}`);
        check(minGap >= 0.25, `rhythm chart same-lane gap ${f(minGap)}s is under 250 ms`);
        check(info.dropped === 0, `rhythm chart dropped ${info.dropped} lead notes (fix the melody)`);
        check(n[0]?.t >= FALL_MIN_FIRST, `rhythm chart starts at ${f(n[0]?.t)}s, before the notes can fall`);
    }
    check(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`);
} catch (e) {
    problems.push(String(e.stack ?? e.message ?? e));
} finally {
    await browser?.close();
}

writeFileSync(detailsFile, `${lines.join('\n')}\n${problems.length ? `PROBLEMS\n${problems.join('\n')}\n` : ''}`);
if (problems.length) fail('music', detailsFile, problems.slice(0, 5).join('\n'));
console.log(`PASS music: ${IDS.length} tracks, rendered, no clipping`);
