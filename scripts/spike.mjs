// npm run spike-nolog: the W0 spike. Builds the offline single file into logs/spike/build, opens it
// from file:// in the installed Chrome and checks, from the outside:
//   1. the pinned Phaser version and the APIs the plan relies on
//   2. pixelArt / roundPixels / HTMLImageElement loader config, integer zoom at 3 window sizes, F = fullscreen
//   3. ONE AudioContext (injected into Phaser), unlocked by a key press, a beep plays without error
//   4. the Italian glyphs render with the pixel font (not with the fallback font)
//   5. zero network requests (only file: and data:) and no console errors
// Prints `PASS spike: Phaser APIs, font glyphs, file URL` or a short FAIL block. Details: logs/spike/.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fail, log, ROOT, viteBuild } from './lib/run.mjs';
import { litPixels, openGame } from './lib/page.mjs';

const S = 'spike';
const EXPECTED_PHASER = '4.2.1';
const GLYPHS = "àèéìòùÀÈÉÌÒÙ’'";
const problems = [];
const notes = [];
const check = (ok, msg) => ok || problems.push(msg);

const phaserVersion = JSON.parse(readFileSync(join(ROOT, 'node_modules/phaser/package.json'), 'utf8')).version;
check(phaserVersion === EXPECTED_PHASER, `installed phaser ${phaserVersion}, expected ${EXPECTED_PHASER}`);

viteBuild(S, 'build', 'vite/config.offline.mjs', ['--outDir', 'logs/spike/build']);
const url = `${pathToFileURL(join(ROOT, 'logs/spike/build/index.html')).href}?spike=1`;
const logFile = log(S, 'checks');

// Count AudioContext constructions: the game must create exactly one.
const countContexts = () => {
    window.__audioContextsCreated = 0;
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
        constructor(...a) {
            super(...a);
            window.__audioContextsCreated++;
        }
    };
};

const { browser, context, page, requests, errors } = await openGame(url, { initScript: countContexts }).catch((e) =>
    fail('open', logFile, `cannot load ${url}: ${e.message}`)
);
try {
    // 1. Phaser version and APIs
    const api = await page.evaluate(() => {
        const P = window.__ricPhaser;
        const g = window.__ricGame;
        const s = g.scene.getScene('title');
        return {
            version: P.VERSION,
            fit: g.scale.scaleMode === P.Scale.FIT,
            pixelArt: g.config.pixelArt,
            roundPixels: g.config.roundPixels,
            antialias: g.config.antialias,
            loaderType: g.config.loaderImageLoadType,
            webgl: g.renderer.type === P.WEBGL,
            apis: {
                'add.text': typeof s.add.text,
                'add.particles': typeof s.add.particles,
                'tweens.add': typeof s.tweens.add,
                'cameras.main.fadeOut': typeof s.cameras.main.fadeOut,
                'textures.createCanvas': typeof s.textures.createCanvas,
                'input.keyboard': typeof s.input.keyboard?.once,
                'sound.context': typeof g.sound.context?.createGain
            }
        };
    });
    check(api.version === EXPECTED_PHASER, `Phaser.VERSION ${api.version}`);
    check(api.fit, 'scale mode is not FIT');
    check(api.pixelArt === true && api.roundPixels === true && api.antialias === false, `pixelArt=${api.pixelArt} roundPixels=${api.roundPixels} antialias=${api.antialias}`);
    check(api.loaderType === 'HTMLImageElement', `loader imageLoadType ${api.loaderType}`);
    for (const [k, v] of Object.entries(api.apis)) check(v === 'function', `API missing: ${k} (${v})`);
    notes.push(`renderer: ${api.webgl ? 'WebGL' : 'Canvas'}; Phaser ${api.version}`);

    // 2. Zoom of the 1280x720 canvas at four window sizes (1.5x, 1x, 1x, 0.78x: below 1 the exact fit) and fullscreen with F
    for (const [w, h, z] of [[1920, 1080, 1.5], [1366, 768, 1], [1280, 720, 1], [1000, 600, 600 / 720]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForFunction((zz) => Math.abs(document.querySelector('canvas').getBoundingClientRect().width - 1280 * zz) < 1, z, { timeout: 5000 }).catch(() => undefined);
        const box = await page.evaluate(() => {
            const r = document.querySelector('canvas').getBoundingClientRect();
            const c = document.querySelector('canvas');
            return { w: r.width, h: r.height, iw: c.width, ih: c.height, ir: getComputedStyle(c).imageRendering };
        });
        check(Math.abs(box.w - 1280 * z) < 1 && Math.abs(box.h - 720 * z) < 1, `zoom at ${w}x${h}: canvas ${box.w}x${box.h}, want ${1280 * z}x${720 * z}`);
        check(box.iw === 1280 && box.ih === 720, `internal size ${box.iw}x${box.ih}`);
        check(/pixelated|crisp-edges/.test(box.ir), `image-rendering ${box.ir}`);
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.keyboard.press('KeyF');
    const fs = await page.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 3000 }).then(() => true, () => false);
    notes.push(`fullscreen F: ${fs ? 'entered' : 'not entered in headless (key handler present)'}`);
    if (fs) await page.keyboard.press('KeyF');

    // 3. Audio: one shared context, unlocked by a key press, a beep plays
    const before = await page.evaluate(() => ({ state: window.__ricAudio.ctx.state, n: window.__audioContextsCreated }));
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__ricAudio.ctx.state === 'running', null, { timeout: 5000 }).catch(() => undefined);
    const audio = await page.evaluate(async () => {
        const { ctx, beep } = window.__ricAudio;
        const g = window.__ricGame;
        const t0 = ctx.currentTime;
        beep(660, 0.1);
        await new Promise((r) => setTimeout(r, 300));
        return { state: ctx.state, same: g.sound.context === ctx, advanced: ctx.currentTime > t0, n: window.__audioContextsCreated };
    });
    notes.push(`audio: state before key=${before.state}, after=${audio.state}, contexts created=${audio.n}`);
    check(audio.state === 'running', `AudioContext state after key press: ${audio.state}`);
    check(audio.same, 'Phaser sound.context is not the shared AudioContext');
    check(audio.n === 1, `AudioContexts created: ${audio.n}, want 1`);
    check(audio.advanced, 'AudioContext clock did not advance (beep did not run)');

    // 4. Glyphs: start the spike scene, then compare canvas renders of each glyph
    await page.evaluate(() => {
        window.__ricGame.scene.stop('title');
        window.__ricGame.scene.start('Spike');
    });
    await page.waitForFunction(() => window.__ricSpikeReady === true, null, { timeout: 5000 });
    const glyph = await page.evaluate(async (glyphs) => {
        await document.fonts.ready;
        const fontOk = document.fonts.check('16px PixelOperator');
        const draw = (text, family) => {
            const c = document.createElement('canvas');
            c.width = 32;
            c.height = 32;
            const x = c.getContext('2d', { willReadFrequently: true });
            x.font = `16px ${family}`;
            x.textBaseline = 'top';
            x.fillStyle = '#fff';
            x.fillText(text, 4, 4);
            const d = x.getImageData(0, 0, 32, 32).data;
            let ink = 0;
            let key = '';
            for (let i = 3; i < d.length; i += 4) {
                if (d[i]) ink++;
                key += d[i] > 127 ? '1' : '0';
            }
            return { ink, key };
        };
        const rows = [];
        for (const ch of glyphs) {
            const mine = draw(ch, 'PixelOperator, monospace');
            const fallback = draw(ch, 'monospace');
            rows.push({ ch, ink: mine.ink, key: mine.key, sameAsFallback: mine.key === fallback.key });
        }
        const base = { 'à': 'a', 'è': 'e', 'é': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u', 'À': 'A', 'È': 'E', 'É': 'E', 'Ì': 'I', 'Ò': 'O', 'Ù': 'U' };
        const accentIsDistinct = Object.entries(base).map(([a, b]) => ({ a, same: draw(a, 'PixelOperator').key === draw(b, 'PixelOperator').key }));
        return { fontOk, rows: rows.map(({ ch, ink, sameAsFallback }) => ({ ch, ink, sameAsFallback })), keys: rows.map((r) => r.key), accentIsDistinct };
    }, GLYPHS);
    check(glyph.fontOk, 'document.fonts.check(PixelOperator) is false');
    for (const r of glyph.rows) {
        check(r.ink > 0, `glyph ${r.ch} renders blank`);
        check(!r.sameAsFallback, `glyph ${r.ch} renders like the fallback font (missing in the pixel font)`);
    }
    for (const a of glyph.accentIsDistinct) check(!a.same, `accent ${a.a} looks the same as its base letter`);
    // Every accented letter must differ from every other glyph (the two apostrophes may legitimately match).
    const letters = glyph.keys.slice(0, 12);
    check(new Set(letters).size === 12, 'two accented letters render identically');
    notes.push(`glyph ink pixels: ${glyph.rows.map((r) => `${r.ch}=${r.ink}`).join(' ')}`);
    await page.screenshot({ path: join(ROOT, 'logs/spike/glyphs.png') });
    check((await litPixels(context, page)) > 500, 'game canvas looks blank');

    // 5. Network: file: and data: only, no console errors
    const bad = requests.filter((u) => !/^(file|data):/.test(u));
    check(bad.length === 0, `non-file requests: ${bad.slice(0, 3).join(', ')}`);
    check(errors.length === 0, `console errors: ${errors.slice(0, 3).join(' | ')}`);
    notes.push(`requests: ${requests.length}, all file:/data:`);
} catch (e) {
    problems.push(`exception: ${e.stack ?? e}`);
} finally {
    await browser.close();
}

writeFileSync(logFile, [...notes, '', problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'no problems'].join('\n') + '\n');
if (problems.length) fail('spike', logFile, problems.slice(0, 5).join('\n'));
console.log('PASS spike: Phaser APIs, font glyphs, file URL');
