// npm run verify-offline-nolog: extracts dist/ric-pixel-game-story-offline.zip and opens its
// index.html through file:// in Chrome. Every request must be file: or data:; the title screen must show.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fail, log, ROOT } from './lib/run.mjs';
import { litPixels, openGame } from './lib/page.mjs';
import { readZip } from './lib/zip.mjs';

const S = 'verify-offline';
const logFile = log(S, 'result');
const zipPath = join(ROOT, 'dist', 'ric-pixel-game-story-offline.zip');
let entries;
try {
    entries = readZip(readFileSync(zipPath));
} catch (e) {
    fail('zip', null, `cannot read dist/ric-pixel-game-story-offline.zip (run npm run build-nolog): ${e.message}`);
}
const dir = join(ROOT, 'logs', S, 'extracted');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
for (const e of entries) {
    if (e.name.includes('..') || e.name.startsWith('/')) fail('zip', null, `unsafe entry name ${e.name}`);
    writeFileSync(join(dir, e.name), e.data); // flat zip: index.html only
}

const url = pathToFileURL(join(dir, 'index.html')).href;
const problems = [];
let browser;
try {
    const r = await openGame(url);
    browser = r.browser;
    const bad = r.requests.filter((u) => !/^(file|data):/.test(u));
    if (bad.length) problems.push(`network requests: ${bad.slice(0, 3).join(', ')}`);
    if (r.errors.length) problems.push(`console errors: ${r.errors.slice(0, 3).join(' | ')}`);
    const lit = await litPixels(r.context, r.page);
    if (lit < 200) problems.push(`title screen looks blank (${lit} lit pixels)`);
    writeFileSync(logFile, `zip entries: ${entries.map((e) => e.name).join(', ')}\nrequests: ${r.requests.length} (${r.requests.map((u) => u.slice(0, 40)).join(' | ')})\nlit pixels: ${lit}\n`);
} catch (e) {
    problems.push(`cannot load title screen: ${e.message}`);
} finally {
    await browser?.close();
}
if (problems.length) fail('offline', logFile, problems.join('\n'));
console.log('PASS offline: no network requests, title screen loaded');
