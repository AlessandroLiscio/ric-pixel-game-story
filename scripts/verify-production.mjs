// npm run verify-production-nolog: the production outputs (dist/, dist-offline/, the zip) must not
// contain the test skip key. Run `npm run build-nolog` first. As a control, it also builds a test
// variant (VITE_TEST_BUILD=1) into logs/ and requires the key THERE, so a broken grep cannot pass.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, log, ROOT, viteBuild } from './lib/run.mjs';
import { readZip } from './lib/zip.mjs';

const S = 'verify-production';
const logFile = log(S, 'result');
const keySrc = readFileSync(join(ROOT, 'src/game/testKey.ts'), 'utf8');
const key = /TEST_SKIP_KEY\s*=\s*'([^']+)'/.exec(keySrc)?.[1];
if (!key) fail('key', null, 'cannot read TEST_SKIP_KEY from src/game/testKey.ts');

function* files(dir) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) yield* files(p);
        else yield p;
    }
}
const needle = Buffer.from(key);
const hits = (dir) => {
    const found = [];
    for (const f of files(dir)) {
        const buf = readFileSync(f);
        if (buf.includes(needle)) found.push(f);
        if (f.endsWith('.zip')) for (const e of readZip(buf)) if (e.data.includes(needle)) found.push(`${f}!${e.name}`);
    }
    return found;
};

const out = [];
for (const d of ['dist', 'dist-offline']) {
    try {
        statSync(join(ROOT, d));
    } catch {
        fail('missing', null, `${d}/ not found: run npm run build-nolog first`);
    }
    const h = hits(join(ROOT, d));
    out.push(`${d}: ${h.length} hits`);
    if (h.length) fail('production', logFile, `test skip key found in production output: ${h.slice(0, 3).join(', ')}`);
}

viteBuild(S, 'test-build', 'vite/config.prod.mjs', ['--outDir', 'logs/verify-production/test-build'], { VITE_TEST_BUILD: '1' });
const control = hits(join(ROOT, 'logs/verify-production/test-build'));
out.push(`test build control: ${control.length} hits`);
writeFileSync(logFile, `${out.join('\n')}\n`);
if (!control.length) fail('control', logFile, 'test build does not contain the key: the check cannot be trusted');
console.log('PASS production: no test skip key');
