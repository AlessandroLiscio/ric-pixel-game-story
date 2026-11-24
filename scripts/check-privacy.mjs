// npm run check-privacy-nolog: reference_photos/ is private and must never reach the index, the
// history, the Pages build, the offline build or the zip; neither may a .env file or an obvious token.
// Checks: (1) file names in `git ls-files` and `git log --all --name-only` (2) tracked text and history
// patches for token patterns (3) names of files in dist/, dist-offline/ and the zip.
// When the private folder exists (next to the main checkout, or REF_PHOTOS_DIR; not in CI) its files
// are also matched by CONTENT: SHA-256 of every file there against (a) every blob in the index and in
// all history (binary included) and (b) every built file, zip entry and base64 data: URI payload.
// An image with the same byte size as a private file but a different hash is a WARN line in the log only.
// Limit: a re-encoded, resized or cropped copy has another hash and is not caught (docs/w0-spike.md).
// The script never prints a file name from the private folder.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fail, log, ROOT } from './lib/run.mjs';
import { readZip } from './lib/zip.mjs';

const logFile = log('check-privacy', 'result');
const GIT_BUF = 1024 * 1024 * 1024;
const git = (args, input, binary = Boolean(input)) => {
    const r = spawnSync('git', ['-C', ROOT, ...args], { encoding: binary ? 'buffer' : 'utf8', input, maxBuffer: GIT_BUF });
    if (r.status !== 0) fail('git', null, `git ${args.join(' ')} failed: ${String(r.stderr ?? '').split('\n')[0]}`);
    return r.stdout;
};
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const TEXT_LIKE = /\.(html?|m?js|cjs|jsx?|tsx?|css|json|svg|md|txt|ya?ml)$/i;
const TEXT_BLOB_CAP = 8 * 1024 * 1024;
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

// The private files: names, SHA-256 hashes and byte sizes of every media file in reference_photos/.
function privateFiles() {
    const candidates = [process.env.REF_PHOTOS_DIR];
    const common = spawnSync('git', ['-C', ROOT, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' });
    if (common.status === 0) candidates.push(join(dirname(common.stdout.trim()), 'reference_photos'));
    const out = { names: new Set(), hashes: new Set(), sizes: new Set() };
    for (const dir of candidates.filter((d) => d && existsSync(d))) {
        const walk = (d) => {
            for (const n of readdirSync(d)) {
                const p = join(d, n);
                if (statSync(p).isDirectory()) walk(p);
                else if (MEDIA.test(n)) {
                    const buf = readFileSync(p);
                    out.names.add(n.toLowerCase());
                    out.hashes.add(sha256(buf));
                    out.sizes.add(buf.length);
                }
            }
        };
        walk(dir);
    }
    return out;
}
const priv = privateFiles();

const problems = [];
const warns = [];
const add = (m) => problems.push(m);
const badPath = (path, where) => {
    const lower = path.replace(/\\/g, '/').toLowerCase();
    const base = basename(lower);
    if (lower.includes('reference_photos/')) add(`${where}: path under reference_photos/ (${lower.length > 80 ? '…' : lower})`);
    else if (priv.names.has(base)) add(`${where}: a file named like a private photo`);
    if (/^\.env(\..*)?$/.test(base) && base !== '.env.example') add(`${where}: .env file ${base}`);
};
const scanText = (text, where) => {
    // Base64 image payloads can contain token-shaped runs by chance; they are hash-checked as data: URIs instead.
    const plain = text.replace(/data:image\/[\w+.-]+;base64,[A-Za-z0-9+/=]+/g, 'data:image;base64,');
    for (const re of TOKENS) if (re.test(plain)) add(`${where}: matches token pattern ${re.source.slice(0, 24)}…`);
};
/** Content match of one buffer against the private files. */
const matchBytes = (buf, where) => {
    if (!priv.sizes.has(buf.length)) return;
    if (priv.hashes.has(sha256(buf))) add(`${where}: identical to a private photo (SHA-256 match)`);
    else warns.push(`WARN ${where}: ${buf.length} bytes, same size as a private file but different hash`);
};
/** Decode every base64 data: URI in a text and match each payload. */
const DATA_URI = /data:[\w/+.-]*(?:;[\w=.+-]+)*;base64,([A-Za-z0-9+/]{64,}={0,2})/g;
let dataUris = 0;
const scanDataUris = (text, where) => {
    if (!priv.hashes.size) return;
    for (const m of text.matchAll(DATA_URI)) {
        dataUris++;
        matchBytes(Buffer.from(m[1], 'base64'), `${where} data: URI`);
    }
};

// (1) index and history: names
const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);
for (const f of tracked) badPath(f, 'index');
const history = git(['log', '--all', '--name-only', '--format=']).split('\n').filter(Boolean);
for (const f of new Set(history)) badPath(f, 'history');

// (2) contents for token patterns (and data: URIs): the INDEX blobs (what the next commit would hold,
// even when the working file was changed after `git add`), the working files that are tracked or
// untracked-but-not-ignored (what a later `git add` would stage), and the history patches.
// Binary files (a NUL byte in the first 8000 bytes) are skipped; text over 8 MB gives a WARN.
const SKIP_PATH = (f) => f === 'package-lock.json' || MEDIA.test(f) || /\.(ttf|woff2?|zip)$/i.test(f);
const scanBuf = (buf, where) => {
    if (buf.subarray(0, 8000).includes(0)) return;
    const text = buf.toString('utf8');
    scanText(text, where);
    scanDataUris(text, where);
};
const indexBlobs = new Map(); // oid -> first path
for (const l of git(['ls-files', '-s', '-z']).split('\0').filter(Boolean)) {
    const path = l.split('\t')[1];
    if (!SKIP_PATH(path) && !indexBlobs.has(l.split(/\s+/)[1])) indexBlobs.set(l.split(/\s+/)[1], path);
}
if (indexBlobs.size) {
    const sizes = git(['cat-file', '--batch-check'], Buffer.from([...indexBlobs.keys()].join('\n') + '\n')).toString('utf8').split('\n').filter(Boolean);
    const small = [];
    for (const line of sizes) {
        const [oid, type, size] = line.split(' ');
        if (type !== 'blob') continue;
        if (Number(size) > TEXT_BLOB_CAP) warns.push(`WARN index ${indexBlobs.get(oid)}: ${size} bytes, over 8 MB, not scanned for tokens`);
        else small.push(oid);
    }
    if (small.length) {
        const out = git(['cat-file', '--batch'], Buffer.from(small.join('\n') + '\n'));
        let p = 0;
        while (p < out.length) {
            const nl = out.indexOf(10, p);
            const [oid, , size] = out.toString('utf8', p, nl).split(' ');
            scanBuf(out.subarray(nl + 1, nl + 1 + Number(size)), `index ${indexBlobs.get(oid)}`);
            p = nl + 1 + Number(size) + 1;
        }
    }
}
const untracked = git(['ls-files', '-o', '--exclude-standard', '-z']).split('\0').filter(Boolean);
for (const f of untracked) badPath(f, 'untracked');
for (const f of [...tracked, ...untracked]) {
    const p = join(ROOT, f);
    if (SKIP_PATH(f) || !existsSync(p) || !statSync(p).isFile()) continue;
    if (statSync(p).size > TEXT_BLOB_CAP) warns.push(`WARN working ${f}: over 8 MB, not scanned for tokens`);
    else scanBuf(readFileSync(p), `working ${f}`);
}
scanText(git(['log', '--all', '-p', '--format=', '--', '.', ':(exclude)package-lock.json']), 'history');

// (2b) every blob in the index and in all history, by content (only when there are private files)
let blobs = 0;
if (priv.hashes.size) {
    const idx = git(['ls-files', '-s', '-z']).split('\0').filter(Boolean).map((l) => ({ oid: l.split(/\s+/)[1], path: l.split('\t')[1] }));
    const hist = git(['rev-list', '--objects', '--all']).split('\n').filter(Boolean).map((l) => ({ oid: l.slice(0, 40), path: l.slice(41) }));
    const seen = new Map(); // oid -> paths it had
    for (const b of [...idx, ...hist]) seen.set(b.oid, [...(seen.get(b.oid) ?? []), b.path]);
    const list = [...seen.keys()].join('\n') + '\n';
    // batch-check prints "<oid> <type> <size>". A whole-file copy has exactly a private file's size; a photo
    // inlined as a data: URI sits inside a bigger text blob, so text-like blobs (up to 8 MB) are read and decoded.
    const checked = git(['cat-file', '--batch-check'], Buffer.from(list)).toString('utf8').split('\n').filter(Boolean);
    const textOids = [];
    for (const line of checked) {
        const [oid, type, size] = line.split(' ');
        if (type !== 'blob') continue;
        blobs++;
        const name = `git blob ${oid.slice(0, 10)} (${seen.get(oid)[0] ?? '?'})`;
        if (priv.sizes.has(Number(size))) matchBytes(git(['cat-file', 'blob', oid], undefined, true), name);
        if (seen.get(oid).some((p) => TEXT_LIKE.test(p))) {
            if (Number(size) > TEXT_BLOB_CAP) warns.push(`WARN ${name}: ${size} bytes, text blob over 8 MB not scanned for data: URIs`);
            else textOids.push(oid);
        }
    }
    // One `cat-file --batch` call for all text blobs: output is "<oid> blob <size>\n<bytes>\n" per blob.
    if (textOids.length) {
        const out = git(['cat-file', '--batch'], Buffer.from(textOids.join('\n') + '\n'));
        let p = 0;
        while (p < out.length) {
            const nl = out.indexOf(10, p);
            const [oid, , size] = out.toString('utf8', p, nl).split(' ');
            const body = out.subarray(nl + 1, nl + 1 + Number(size));
            scanDataUris(body.toString('utf8'), `git blob ${oid.slice(0, 10)} (${seen.get(oid)[0] ?? '?'})`);
            p = nl + 1 + Number(size) + 1;
        }
    }
}

// (3) build outputs: names, content, zip entries, data: URIs, JPEG/HEIC data URIs (the game art is PNG)
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
        const where = `${d}/${basename(f)}`;
        badPath(f.slice(ROOT.length + 1), d);
        const buf = readFileSync(f);
        if (priv.hashes.size) matchBytes(buf, where);
        if (f.endsWith('.zip')) {
            for (const e of readZip(buf)) {
                badPath(e.name, `${d} zip`);
                if (priv.hashes.size) matchBytes(e.data, `${where}!${e.name}`);
                if (/\.(html|js|css)$/.test(e.name)) {
                    scanText(e.data.toString('utf8'), `${where}!${e.name}`);
                    scanDataUris(e.data.toString('utf8'), `${where}!${e.name}`);
                }
            }
        }
        if (/\.(html|js|css)$/.test(f)) {
            const t = buf.toString('utf8');
            scanText(t, where);
            scanDataUris(t, where);
            if (/data:image\/(jpe?g|heic|heif|webp)/i.test(t)) add(`${where}: inlined JPEG/HEIC/WebP image (game art must be PNG)`);
            if (extname(f) === '.html' && t.includes('reference_photos')) add(`${where}: mentions reference_photos`);
        }
    }
}

writeFileSync(
    logFile,
    `tracked files: ${tracked.length}\nhistory paths: ${new Set(history).size}\nblobs checked by content: ${blobs}\nbuilt files: ${built.length}\ndata: URIs decoded: ${dataUris}\nprivate files known: ${priv.hashes.size} (content check ${priv.hashes.size ? 'on' : 'off: no reference_photos folder here'})\nproblems: ${problems.length}\n${problems.join('\n')}\nwarnings: ${warns.length}\n${warns.join('\n')}\n`
);
if (problems.length) fail('privacy', logFile, problems.slice(0, 5).join('\n'));
console.log('PASS privacy: no reference photos or secrets in index, history, or build');
