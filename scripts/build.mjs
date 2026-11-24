// npm run build-nolog: typecheck, Pages build (dist/), offline single-file build (dist-offline/),
// offline zip (dist/ric-pixel-game-story-offline.zip). Quiet: prints PASS build or one FAIL block.
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, log, ROOT, runNode, tscBin, viteBuild } from './lib/run.mjs';
import { readZip, writeZip } from './lib/zip.mjs';

const S = 'build';
runNode(S, 'typecheck', [tscBin, '--noEmit']);
viteBuild(S, 'pages', 'vite/config.prod.mjs');
viteBuild(S, 'offline', 'vite/config.offline.mjs');

const html = join(ROOT, 'dist-offline', 'index.html');
const zipFile = join(ROOT, 'dist', 'ric-pixel-game-story-offline.zip');
const zipLog = log(S, 'zip');
try {
    const data = readFileSync(html);
    if (data.length > 20 * 1024 * 1024) throw new Error(`offline html too big: ${data.length} bytes`);
    mkdirSync(join(ROOT, 'dist'), { recursive: true });
    writeFileSync(zipFile, writeZip([{ name: 'index.html', data }]));
    const back = readZip(readFileSync(zipFile)); // round-trip check (CRC verified)
    if (back.length !== 1 || !back[0].data.equals(data)) throw new Error('zip round-trip mismatch');
    writeFileSync(zipLog, `index.html ${data.length} bytes, zip ${statSync(zipFile).size} bytes\n`);
} catch (e) {
    writeFileSync(zipLog, String(e.stack ?? e));
    fail('zip', zipLog, String(e.message ?? e));
}
console.log('PASS build');
