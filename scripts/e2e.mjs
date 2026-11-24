// npm run test:e2e-nolog: the end-to-end test. Prints `PASS e2e: 6 scenes, 6 minigames, no console errors` or one FAIL block; the full
// step log is logs/e2e/steps.log (build logs beside it). Two single-file offline builds, both opened through file://:
//   logs/e2e/dist       VITE_TEST_BUILD=1 (test hooks): title, all 6 scenes, all 6 minigames, the ending, the replay from the title.
//   logs/e2e/dist-prod  production: the title renders, the game starts, and no test hook ships.
// Real input: scene 1 (universita) and the last scene (divano) are played with key presses only (arrows, X); simon, mash and d20 are
// played with real key presses in every scene; the other scenes teleport next to the friend and close dialogue with the test skip;
// slackline, cat-smoke (lost on purpose) and rhythm are forced through window.__ricTest, so both a win and a lose path are covered.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fail, log, ROOT, viteBuild } from './lib/run.mjs';
import { litPixels, openGame } from './lib/page.mjs';

const S = 'e2e';
const logFile = log(S, 'steps');
const steps = [];
const t0 = Date.now();
const note = (m) => steps.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`);
const check = (cond, msg) => {
    if (!cond) throw new Error(msg);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

viteBuild(S, 'build-test', 'vite/config.offline.mjs', ['--outDir', 'logs/e2e/dist'], { VITE_TEST_BUILD: '1' });
viteBuild(S, 'build-prod', 'vite/config.offline.mjs', ['--outDir', 'logs/e2e/dist-prod'], { VITE_TEST_BUILD: '' });
note('built test and production');

const SCENES = JSON.parse(readFileSync(join(ROOT, 'src/data/scenes.json'), 'utf8'));
const MINIGAME_IDS = ['simon', 'cat-smoke', 'slackline', 'd20', 'mash', 'rhythm'];
const minigamesOf = (s) => [s.minigame, s.minigame2].filter(Boolean);
const friendsOf = (s) => [s.friend?.personId, s.friend2?.personId].filter(Boolean);
const LOSE = 'cat-smoke'; // lost on purpose, to cover the lose path
const REAL = ['simon', 'mash', 'd20']; // played with key presses; the rest is forced through window.__ricTest
const ARROW = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const keySrc = readFileSync(join(ROOT, 'src/game/testKey.ts'), 'utf8');
const SKIP_KEY = /TEST_SKIP_KEY\s*=\s*'([^']+)'/.exec(keySrc)?.[1];

let browser;
let prod;
try {
    // the scene and minigame lists are the contract of the final count: report a drift instead of faking the numbers
    check(SCENES.length === 6, `scenes.json holds ${SCENES.length} scenes, not 6`);
    const listed = [...new Set(SCENES.flatMap(minigamesOf))];
    check(listed.length === 6 && MINIGAME_IDS.every((id) => listed.includes(id)), `scenes.json lists ${listed.length} minigames (${listed}), not the 6 ${MINIGAME_IDS}`);
    check(!!SKIP_KEY, 'cannot read TEST_SKIP_KEY from src/game/testKey.ts');

    const r = await openGame(pathToFileURL(join(ROOT, 'logs/e2e/dist/index.html')).href + '?spike=1'); // ?spike=1 exposes window.__ricGame
    browser = r.browser;
    const { page, context, errors, requests } = r;
    const state = () => page.evaluate(() => window.__ricState());
    const test = (fn) => page.evaluate((f) => window.__ricTest[f](), fn);
    const until = async (cond, label, ms = 25000) => {
        const end = Date.now() + ms;
        for (;;) {
            const s = await state();
            if (cond(s)) return s;
            if (Date.now() > end) throw new Error(`timeout waiting for ${label}; state ${JSON.stringify(s)}`);
            await sleep(100);
        }
    };
    const world = (i) => (s) => s.scene === 'world' && s.sceneIndex === i;
    const teleport = (x, y) => page.evaluate(([px, py]) => window.__ricGame.scene.getScene('world').ric.setPosition(px, py), [x, y]);
    const press = async (key) => {
        await page.keyboard.press(key);
    };

    // every minigame the flow launches, whatever the polling saw: the registry key the flow sets before it launches one
    await page.evaluate(() => {
        window.__e2eEntered = [];
        const on = (_p, k, v) => k === 'activeMinigame' && v && window.__e2eEntered.push(v);
        window.__ricGame.registry.events.on('setdata', on);
        window.__ricGame.registry.events.on('changedata', on);
    });
    const entered = () => page.evaluate(() => [...window.__e2eEntered]);
    const how = {}; // minigame id -> real | forced

    /** Plays the running minigame: real key presses for simon, mash and d20, a forced result for the others. */
    const playMinigame = async (id) => {
        const scene = `minigame-${id}`;
        const end = Date.now() + 60000;
        const running = async () => (await state()).scene === scene;
        if (!REAL.includes(id)) {
            await sleep(300);
            await test(id === LOSE ? 'lose' : 'win');
            how[id] = 'forced';
        } else if (id === 'simon') {
            // X closes the card; then retype the sequence the scene is listening for (its pending field), arrow by arrow
            while (await running()) {
                check(Date.now() < end, 'simon did not finish in 60 s');
                const p = await page.evaluate((sc) => {
                    const pending = window.__ricGame.scene.getScene(sc)?.pending;
                    return pending ? { dir: pending.seq[pending.index] } : null;
                }, scene);
                await press(p ? ARROW[p.dir] : 'x');
                await sleep(p ? 90 : 120);
            }
            how[id] = 'real';
        } else {
            // mash: X as fast as possible (about 12 a second, the win needs 5.4); d20: X rolls, any result is valid
            const gap = id === 'mash' ? 70 : 250;
            while (await running()) {
                check(Date.now() < end, `${id} did not finish in 60 s`);
                await press('x');
                await sleep(gap);
            }
            how[id] = 'real';
        }
        await until((x) => x.scene === 'world', `back to the world after ${id}`);
    };

    // ---- title ----
    let s = await until((x) => x.scene === 'title', 'title');
    check((await litPixels(context, page)) > 200, 'title screen looks blank');
    await press('Enter');
    await until(world(0), 'world 0');
    note('title -> world 0');

    // debug jumps, as in smoke-walk: F2 then F1
    await press('F2');
    s = await until(world(1), 'F2 jump');
    check(s.party.join() === 'lollino', `F2 party ${s.party}`);
    await press('F1');
    s = await until(world(0), 'F1 jump');
    check(s.party.length === 0, `F1 party ${s.party}`);
    note('debug jumps F2/F1 ok');

    // ---- the six scenes ----
    const party = [];
    for (let i = 0; i < 6; i++) {
        await until(world(i), `world ${i}`);
        await page.waitForFunction((sid) => window.__ricGame.scene.getScene('world').def?.id === sid, SCENES[i].id, { timeout: 10000 });
        // a tile room takes door and friend positions from its map: read the resolved entry from the live scene
        const live = await page.evaluate(() => {
            const d = window.__ricGame.scene.getScene('world').def;
            return { friend: d.friend, door: d.door };
        });
        const def = { ...SCENES[i], ...live };
        const before = (await entered()).length;
        const want = friendsOf(SCENES[i]);
        party.push(...want);
        const real = i === 0 || i === 5;

        if (i === 5) {
            // divano: the finale plays by itself; close every page with X only, no test skip
            for (let n = 0; n < 900; n++) {
                s = await state();
                if (s.scene === 'ending') break;
                await press('x');
                await sleep(110);
            }
        } else if (i === 0) {
            // real play: hold the right arrow, close dialogue and talk with X, play the minigame, and walk out through the door
            await page.keyboard.down('ArrowRight');
            for (let n = 0; n < 900; n++) {
                s = await state();
                if (s.sceneIndex > 0) break;
                if (s.scene.startsWith('minigame-')) {
                    await page.keyboard.up('ArrowRight');
                    await playMinigame(s.scene.slice('minigame-'.length));
                    await page.keyboard.down('ArrowRight'); // the flow resets the keys when the world wakes up
                } else {
                    await press('x');
                    await sleep(110);
                }
            }
            await page.keyboard.up('ArrowRight');
        } else {
            for (let n = 0; n < 10; n++) {
                await test('skip'); // arrival lines
                await sleep(150);
            }
            await teleport(def.friend.x - 22, def.friend.y);
            for (let n = 0; n < 600; n++) {
                s = await state();
                if (want.every((id) => s.party.includes(id))) break;
                if (s.scene.startsWith('minigame-')) {
                    await playMinigame(s.scene.slice('minigame-'.length));
                } else {
                    await press('x');
                    await sleep(120);
                    await test('skip');
                    await sleep(120);
                }
            }
            for (let n = 0; n < 20; n++) {
                // the join banners come first; the door only opens after them
                await sleep(500);
                await teleport(def.door.x + def.door.w / 2, def.door.y + def.door.h / 2);
                await sleep(300);
                if ((await state()).sceneIndex > i || (await state()).scene === 'ending') break;
            }
        }

        s = await until((x) => (i === 5 ? x.scene === 'ending' : world(i + 1)(x)), `leaving scene ${i} (${SCENES[i].id})`, 15000);
        const went = (await entered()).slice(before);
        check(s.party.join() === party.join(), `scene ${i} ${SCENES[i].id}: party ${s.party}, wanted ${party}`);
        check(went.join() === minigamesOf(SCENES[i]).join(), `scene ${i} ${SCENES[i].id}: minigames entered [${went}], wanted [${minigamesOf(SCENES[i])}]`);
        note(`scene ${i} ${SCENES[i].id} (${real ? 'real keys' : 'teleport + skip'}): minigames [${went}], party ${s.party}`);
    }

    // ---- ending ----
    s = await until((x) => x.scene === 'ending', 'ending scene');
    const all = await entered();
    check(new Set(all).size === 6 && MINIGAME_IDS.every((id) => all.includes(id)), `distinct minigames entered: ${[...new Set(all)]} (${new Set(all).size}), wanted 6`);
    check(s.party.join() === party.join(), `final party ${s.party}`);
    for (const id of MINIGAME_IDS) check(typeof s.results[id] === 'boolean', `result ${id} = ${s.results[id]}`);
    for (const id of ['simon', 'slackline', 'mash', 'rhythm']) check(s.results[id] === true, `result ${id} = ${s.results[id]}`);
    check(s.results[LOSE] === false, `result ${LOSE} = ${s.results[LOSE]}`);
    check((await litPixels(context, page)) > 200, 'ending looks blank');
    note(`ending: party ${s.party}, results ${JSON.stringify(s.results)}, minigames ${JSON.stringify(how)}`);

    // credits roll for ~42 s; the test skip ends them, then the restart key works (the scene's canRestart field says when)
    for (let n = 0; n < 100; n++) {
        if (await page.evaluate(() => window.__ricGame.scene.getScene('ending').canRestart)) break;
        await test('skip');
        await sleep(300);
    }
    check(await page.evaluate(() => window.__ricGame.scene.getScene('ending').canRestart), 'ending never offered the restart');
    await press('Enter');
    s = await until((x) => x.scene === 'title', 'title after the ending');
    check(s.sceneIndex === 0 && s.party.length === 0 && Object.keys(s.results).length === 0, `run not reset by the replay: ${JSON.stringify(s)}`);
    check((await litPixels(context, page)) > 200, 'title after the ending looks blank');
    await press('Enter');
    s = await until(world(0), 'a new run from the title');
    check(s.party.length === 0 && Object.keys(s.results).length === 0, `second run is not fresh: ${JSON.stringify(s)}`);
    note('title replay restarted a fresh run');

    const bad = requests.filter((u) => !/^(file|data):/.test(u));
    check(bad.length === 0, `network requests: ${bad.slice(0, 3).join(', ')}`);
    check(errors.length === 0, `console errors: ${errors.slice(0, 3).join(' | ')}`);
    note(`test build: ${requests.length} requests, all file: or data:, no console errors`);
    await browser.close();
    browser = undefined;

    // ---- production build: it works and ships no test hook ----
    const prodFile = join(ROOT, 'logs/e2e/dist-prod/index.html');
    const html = readFileSync(prodFile, 'utf8');
    for (const needle of [SKIP_KEY, '__ricTest']) check(!html.includes(needle), `production build contains "${needle}"`);
    prod = await openGame(pathToFileURL(prodFile).href);
    browser = prod.browser;
    const pstate = () => prod.page.evaluate(() => window.__ricState());
    check((await litPixels(prod.context, prod.page)) > 200, 'production title screen looks blank');
    const hooks = await prod.page.evaluate((key) => ({ test: typeof window.__ricTest, skip: typeof window[key], game: typeof window.__ricGame }), SKIP_KEY);
    check(hooks.test === 'undefined' && hooks.skip === 'undefined', `test hooks present in production: ${JSON.stringify(hooks)}`);
    await prod.page.keyboard.press('Enter');
    for (let n = 0; n < 50 && (await pstate()).scene !== 'world'; n++) await sleep(100);
    check((await pstate()).scene === 'world', 'production game did not start from the title');
    await sleep(500);
    await prod.page.keyboard.press('F2'); // the debug jump must not exist in production
    await sleep(700);
    check((await pstate()).sceneIndex === 0, 'F2 debug jump works in production');
    const pbad = prod.requests.filter((u) => !/^(file|data):/.test(u));
    check(pbad.length === 0, `production network requests: ${pbad.slice(0, 3).join(', ')}`);
    check(prod.errors.length === 0, `production console errors: ${prod.errors.slice(0, 3).join(' | ')}`);
    note(`production build: title renders, game starts, no __ricTest, no ${SKIP_KEY}, no debug jump, ${prod.requests.length} requests all file: or data:`);
} catch (e) {
    note(`ERROR ${e.message}`);
    writeFileSync(logFile, `${steps.join('\n')}\n`);
    await browser?.close();
    fail(S, logFile, e.message);
}
writeFileSync(logFile, `${steps.join('\n')}\n`);
await browser?.close();
console.log('PASS e2e: 6 scenes, 6 minigames, no console errors');
