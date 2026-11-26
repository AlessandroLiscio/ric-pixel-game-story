// npm run smoke-walk-nolog: a quick smoke of the whole flow (the final e2e is W4). Builds the offline single file with
// VITE_TEST_BUILD=1 into logs/smoke-walk/dist, opens it through file:// with ?spike=1 (exposes window.__ricGame), and walks
// the five scenes: title, a real walk, real key presses at the friend in scene 1, door exits, minigames forced through
// window.__ricTest, the end. Asserts results, party and no console errors. Prints PASS or one FAIL block; log in logs/smoke-walk/.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fail, log, ROOT, viteBuild } from './lib/run.mjs';
import { openGame } from './lib/page.mjs';

const S = 'smoke-walk';
const logFile = log(S, 'steps');
const steps = [];
const note = (m) => steps.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`);
const t0 = Date.now();

viteBuild(S, 'build', 'vite/config.offline.mjs', ['--outDir', 'logs/smoke-walk/dist'], { VITE_TEST_BUILD: '1' });

const SCENES = JSON.parse(readFileSync(join(ROOT, 'src/data/scenes.json'), 'utf8'));
const JOINED = [['lollino'], ['giuggiu'], ['liscio'], ['ros', 'giusy'], ['lara']];
const LOSE = 'cat-smoke'; // lost on purpose, to cover the lose path
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let browser;
try {
    const r = await openGame(`${pathToFileURL(join(ROOT, 'logs/smoke-walk/dist/index.html')).href}?spike=1`);
    browser = r.browser;
    const { page, errors } = r;
    const state = () => page.evaluate(() => window.__ricState());
    const test = (fn) => page.evaluate((f) => window.__ricTest[f](), fn);
    const check = (cond, msg) => {
        if (!cond) throw new Error(msg);
    };
    const until = async (cond, label, ms = 25000) => {
        const end = Date.now() + ms;
        for (;;) {
            const s = await state();
            if (cond(s)) return s;
            if (Date.now() > end) throw new Error(`timeout waiting for ${label}; state ${JSON.stringify(s)}`);
            await sleep(100);
        }
    };
    const teleport = (x, y) =>
        page.evaluate(([px, py]) => window.__ricGame.scene.getScene('world').ric.setPosition(px, py), [x, y]);
    /** Closes the arrival lines with the test skip, a few pages. */
    const skipArrival = async () => {
        for (let i = 0; i < 10; i++) {
            await test('skip');
            await sleep(150);
        }
    };
    const world = (i) => (s) => s.scene === 'world' && s.sceneIndex === i;

    // title -> world
    await page.keyboard.press('Enter');
    await until(world(0), 'world 0');
    note('title -> world 0');

    // debug jumps: F2 then F1
    await page.keyboard.press('F2');
    let s = await until(world(1), 'F2 jump');
    check(s.party.join() === 'lollino', `F2 party ${s.party}`);
    await page.keyboard.press('F1');
    s = await until(world(0), 'F1 jump');
    check(s.party.length === 0, `F1 party ${s.party}`);
    note('debug jumps F2/F1 ok');

    for (let i = 0; i < SCENES.length; i++) {
        await until(world(i), `world ${i}`);
        // a tile room takes door and friend positions from its map: read the resolved entry from the live scene
        await page.waitForFunction((sid) => window.__ricGame.scene.getScene('world').def?.id === sid, SCENES[i].id, { timeout: 10000 });
        const live = await page.evaluate(() => {
            const d = window.__ricGame.scene.getScene('world').def;
            return { friend: d.friend, friend2: d.friend2, door: d.door };
        });
        const def = { ...SCENES[i], ...live };
        await skipArrival();
        if (def.friend) {
            if (i === 0) {
                // real play: walk right with the arrow key, talk with X, then leave by the door
                await page.keyboard.down('ArrowRight');
                await sleep(500);
                await page.keyboard.up('ArrowRight');
            } else {
                await teleport(def.friend.x - 22, def.friend.y);
            }
            const want = JOINED[i];
            const seen = new Set();
            for (let n = 0; n < 400; n++) {
                s = await state();
                if (want.every((id) => s.party.includes(id))) break;
                if (s.scene.startsWith('minigame-')) {
                    seen.add(s.scene);
                    await sleep(300);
                    await test(s.scene === `minigame-${LOSE}` ? 'lose' : 'win');
                    await until((x) => x.scene === 'world', 'back to world');
                    // circe: Ros plays only her minigame, then Giusy (friend2) plays hers
                    if (def.friend2 && seen.size === 1) await teleport(def.friend2.x - 22, def.friend2.y);
                } else {
                    await page.keyboard.press('x');
                    await sleep(120);
                    await test('skip');
                    await sleep(120);
                }
            }
            s = await state();
            check(want.every((id) => s.party.includes(id)), `scene ${i}: party ${s.party}, wanted ${want}`);
            check(seen.size === (i === 3 ? 2 : 1), `scene ${i}: minigames played ${[...seen]}`);
            note(`scene ${i} ${def.id}: played ${[...seen]}, party ${s.party}`);
            // leave by the door: real walking in scene 0, a teleport onto the door elsewhere
            if (i === 0) {
                await page.keyboard.down('ArrowRight');
                await until(world(1), 'door exit', 8000);
                await page.keyboard.up('ArrowRight');
            } else {
                await sleep(2500); // join banners
                await teleport(def.door.x + def.door.w / 2, def.door.y + def.door.h / 2);
                // the last scene (cortile) leaves for the ending
                await until(i === SCENES.length - 1 ? (x) => x.scene === 'ending' : world(i + 1), `door exit of scene ${i}`, 8000);
            }
        }
    }

    s = await until((x) => x.scene === 'ending', 'ending scene');
    check(s.party.join() === JOINED.flat().join(), `final party ${s.party}`);
    for (const id of ['simon', 'slackline', 'd20', 'mash', 'rhythm']) check(s.results[id] === true, `result ${id} = ${s.results[id]}`);
    check(s.results[LOSE] === false, `result ${LOSE} = ${s.results[LOSE]}`);
    note(`ending: party ${s.party}, results ${JSON.stringify(s.results)}`);
    check(errors.length === 0, `console errors: ${errors.slice(0, 3).join(' | ')}`);
} catch (e) {
    note(`ERROR ${e.message}`);
    writeFileSync(logFile, `${steps.join('\n')}\n`);
    await browser?.close();
    fail(S, logFile, e.message);
}
writeFileSync(logFile, `${steps.join('\n')}\n`);
await browser?.close();
console.log('PASS smoke: 5 scenes walked, no console errors');
