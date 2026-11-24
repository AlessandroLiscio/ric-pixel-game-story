// npm run check-privacy-nolog: reference_photos/ is private and must never reach the index, the
// history, the Pages build, the offline build or the zip; neither may a .env file or an obvious token.
// Checks: (1) git ls-files and `git log --all --name-only` (2) tracked text and history patches for
// token patterns (3) dist/, dist-offline/ and the zip. Where the private folder exists next to the
// main checkout (not in CI), file names found in it are also matched against everything above.
// The script never prints a file name from the private folder.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fail, log, ROOT } from './lib/run.mjs';
import { readZip } from './lib/zip.mjs';

const logFile = log('check-privacy', 'result');
const git = (args, max = 512 * 1024 * 1024) => {
    const r = spawnSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: max });
    if (r.status !== 0) fail('git', null, `git ${args.join(' ')} failed: ${(r.stderr ?? '').split('\n')[0]}`);
    return r.stdout;
};

const MEDIA = /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|avif|mp4|mov|avi|mkv|webm|m4v)$/i;
const TOKENS = [
    /ghp_[A-Za-z0-9]{36}/,
    /github_pat_[A-Za-z0-9_]{50,}/,
    /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{32,}/,
    /AKIA[0-9A-Z]{16}/,
    /xox[baprs]-[A-Za-z0-9-]{10,}/,
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
    /AIza[0-9A-Za-z_-]{35}/
];

// Names of the private files (lower case), from the main checkout's reference_photos/, if present.
function privateNames() {
    const candidates = [process.env.REFERENCE_PHOTOS_DIR];
    const common = spawnSync('git', ['-C', ROOT, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' });
    if (common.status === 0) candidates.push(join(dirname(common.stdout.trim()), 'reference_photos'));
    const names = new Set();
    for (const dir of candidates.filter((d) => d && existsSync(d))) {
        const walk = (d) => {
            for (const n of readdirSync(d)) {
                const p = join(d, n);
                if (statSync(p).isDirectory()) walk(p);
                else if (MEDIA.test(n)) names.add(n.toLowerCase());
            }
        };
        walk(dir);
    }
    return names;
}
const secret = privateNames();

const problems = [];
const add = (m) => problems.push(m);
const badPath = (path, where) => {
    const lower = path.replace(/\\/g, '/').toLowerCase();
    const base = basename(lower);
    if (lower.includes('reference_photos/')) add(`${where}: path under reference_photos/ (${lower.length > 80 ? '…' : lower})`);
    else if (secret.has(base)) add(`${where}: a file named like a private photo`);
    if (/^\.env(\..*)?$/.test(base) && base !== '.env.example') add(`${where}: .env file ${base}`);
};
const scanText = (text, where) => {
    for (const re of TOKENS) if (re.test(text)) add(`${where}: matches token pattern ${re.source.slice(0, 24)}…`);
};

// (1) index and history: names
const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);
for (const f of tracked) badPath(f, 'index');
const history = git(['log', '--all', '--name-only', '--format=']).split('\n').filter(Boolean);
for (const f of new Set(history)) badPath(f, 'history');

// (2) index and history: contents for token patterns
for (const f of tracked) {
    if (f === 'package-lock.json' || MEDIA.test(f) || /\.(ttf|woff2?|zip)$/i.test(f)) continue;
    const p = join(ROOT, f);
    if (existsSync(p)) scanText(readFileSync(p, 'utf8'), `index ${f}`);
}
scanText(git(['log', '--all', '-p', '--format=', '--', '.', ':(exclude)package-lock.json']), 'history');

// (3) build outputs: names, zip entries, jpeg data URIs (the game art is PNG only)
function* files(dir) {
    for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) yield* files(p);
        else yield p;
    }
}
const built = [];
for (const d of ['dist', 'dist-offline']) {
    const dir = join(ROOT, d);
    if (!existsSync(dir)) continue;
    for (const f of files(dir)) {
        built.push(f);
        badPath(f.slice(ROOT.length + 1), d);
        if (f.endsWith('.zip')) for (const e of readZip(readFileSync(f))) badPath(e.name, `${d} zip`);
        if (/\.(html|js|css)$/.test(f)) {
            const t = readFileSync(f, 'utf8');
            scanText(t, `${d}/${basename(f)}`);
            if (/data:image\/(jpe?g|heic|heif|webp)/i.test(t)) add(`${d}/${basename(f)}: inlined JPEG/HEIC/WebP image (game art must be PNG)`);
            if (extname(f) === '.html' && t.includes('reference_photos')) add(`${d}/${basename(f)}: mentions reference_photos`);
        }
    }
}

writeFileSync(logFile, `tracked files: ${tracked.length}\nhistory paths: ${new Set(history).size}\nbuilt files: ${built.length}\nprivate names known: ${secret.size}\nproblems: ${problems.length}\n${problems.join('\n')}\n`);
if (problems.length) fail('privacy', logFile, problems.slice(0, 5).join('\n'));
console.log('PASS privacy: no reference photos or secrets in index, history, or build');
