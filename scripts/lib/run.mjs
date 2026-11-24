// Quiet-script helpers (core:quiet-scripts contract): full output goes to logs/<script>/<stage>.log
// (gitignored), the console gets nothing on success except the script's own PASS line, and on failure
// one FAIL line, the log path and at most 5 decisive lines. Exit code 0 only on success.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const rel = (p) => relative(ROOT, p).split('\\').join('/');
export const log = (script, stage) => {
    const dir = join(ROOT, 'logs', script);
    mkdirSync(dir, { recursive: true });
    return join(dir, `${stage}.log`);
};

/** Print a FAIL line (plus up to 5 lines from the log) and exit 1. */
export function fail(stage, logFile, message) {
    console.log(logFile ? `FAIL ${stage} → ${rel(logFile)}` : `FAIL ${stage}`);
    const lines = [];
    if (message) lines.push(...String(message).split('\n'));
    else if (logFile && existsSync(logFile)) {
        const all = readFileSync(logFile, 'utf8').split('\n').filter((l) => l.trim());
        const hits = all.filter((l) => /error|fail|exception|cannot|not found/i.test(l)).slice(0, 5);
        lines.push(...(hits.length ? hits : all.slice(-5)));
    }
    for (const l of lines.slice(0, 5)) console.log(`     ${l.slice(0, 300)}`);
    process.exit(1);
}

/** Run a node script (path relative to ROOT) with args; log everything; exit on failure. */
export function runNode(script, stage, args, env = {}) {
    const logFile = log(script, stage);
    const r = spawnSync(process.execPath, args, {
        cwd: ROOT,
        env: { ...process.env, ...env },
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024
    });
    writeFileSync(logFile, `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? String(r.error) : ''}`);
    if (r.status !== 0) fail(stage, logFile);
    return logFile;
}

export const viteBin = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
export const tscBin = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
export const viteBuild = (script, stage, config, extra = [], env = {}) =>
    runNode(script, stage, [viteBin, 'build', '--config', config, ...extra], env);

export const CHROME_ARGS = { channel: 'chrome', headless: true };
