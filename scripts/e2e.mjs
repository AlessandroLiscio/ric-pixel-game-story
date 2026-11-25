// npm run test:e2e-nolog: the end-to-end test. Prints `PASS e2e: 6 scenes, 6 minigames, no console errors` or one FAIL block; the full
// step log is logs/e2e/steps.log (build logs beside it). Two single-file offline builds, both opened through file://:
//   logs/e2e/dist       VITE_TEST_BUILD=1 (test hooks): title, all 6 scenes, all 6 minigames, the ending, the replay from the title.
//   logs/e2e/dist-prod  production: the title renders, the game starts, and no test hook ships.
// Real input: scene 1 (universita) and the last scene (divano) are played with key presses only (arrows, X); simon, mash and d20 are
// played with real key presses in every scene; the other scenes teleport next to the friend and close dialogue with the test skip;
// slackline, cat-smoke (lost on purpose) and rhythm are forced through window.__ricTest, so both a win and a lose path are covered.
// Also covered: Shift runs, the Esc menu (opens, pauses the world, controls and diary, quit to the title resets the run), a litter bin
// (the first one gives the portal gun), the portal (scene 2 is left through a wall) and the edge exit (giardini has no door). A last step plays
// cat-smoke with real keys and picks the right sofa the moment the cat hides (regression: that pick used to be dropped and lose the round).
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

    // ---- run, the Esc menu and leaving it for the title (scene 1, before any story) ----
    const closeDialogue = async () => {
        for (let n = 0; n < 10; n++) {
            await test('skip');
            await sleep(120);
        }
        await sleep(350); // the world ignores a key for 250 ms after a box closes
    };
    const worldProp = (name) => page.evaluate((k) => window.__ricGame.scene.getScene('world')[k], name);
    const menuProp = (name) => page.evaluate((k) => window.__ricGame.scene.getScene('menu')[k], name);
    await closeDialogue();
    const walkLeft = async (shift) => {
        await teleport(240, 188);
        await sleep(200);
        const x0 = await page.evaluate(() => window.__ricGame.scene.getScene('world').ric.x);
        if (shift) await page.keyboard.down('Shift');
        await page.keyboard.down('ArrowLeft');
        await sleep(400);
        await page.keyboard.up('ArrowLeft');
        if (shift) await page.keyboard.up('Shift');
        return x0 - (await page.evaluate(() => window.__ricGame.scene.getScene('world').ric.x));
    };
    const [walked, ran] = [await walkLeft(false), await walkLeft(true)];
    check(walked > 15 && ran > walked * 1.4, `Shift does not run: walked ${walked} px, ran ${ran} px in 400 ms`);
    await teleport(240, 188);
    await sleep(200);
    await press('Escape');
    await until((x) => x.scene === 'menu', 'the Esc menu');
    await sleep(300);
    check(await page.evaluate(() => window.__ricGame.scene.isPaused('world')), 'the world is not paused behind the menu');
    check((await menuProp('mode')) === 'main', 'the menu does not open on its main window');
    for (const [keys, mode] of [[['ArrowDown', 'x'], 'controls'], [['Escape', 'ArrowUp', 'x'], 'diary'], [['Escape'], 'main']]) {
        for (const k of keys) {
            await press(k);
            await sleep(150);
        }
        check((await menuProp('mode')) === mode, `menu window "${mode}" expected, got "${await menuProp('mode')}"`);
    }
    await press('Escape'); // closes the menu and resumes the world
    s = await until((x) => x.scene === 'world', 'back to the world after the menu');
    check(!(await page.evaluate(() => window.__ricGame.scene.isPaused('world'))), 'the world stays paused after the menu closes');
    check(s.sceneIndex === 0, `menu changed the scene: ${s.sceneIndex}`);
    await sleep(400);
    // Esc, "Esci al menu principale", "Sì": back to the title with a fresh run
    await press('Escape');
    await until((x) => x.scene === 'menu', 'the Esc menu, second time');
    await sleep(300);
    for (const k of ['ArrowDown', 'ArrowDown', 'x']) {
        await press(k);
        await sleep(150);
    }
    check((await menuProp('mode')) === 'confirm' && (await menuProp('sel')) === 1, 'the quit question does not default to No');
    await press('ArrowLeft');
    await sleep(150);
    await press('x');
    s = await until((x) => x.scene === 'title', 'title after quitting from the menu');
    check(s.sceneIndex === 0 && s.party.length === 0 && Object.keys(s.results).length === 0 && !s.portalGun, `quit did not reset the run: ${JSON.stringify(s)}`);
    await press('Enter');
    await until(world(0), 'a new run after quitting');
    note(`menu: opens, pauses the world, controls and diary windows, quit to the title resets the run; Shift runs (${Math.round(walked)} px walking, ${Math.round(ran)} px running in 400 ms)`);

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
            if (i === 1) {
                // the first bin of the run holds the portal gun; P before the scene is done gets the "not yet" line
                const bin = SCENES[i].bins[0];
                check(!(await state()).portalGun, 'the portal gun is found before any bin was checked');
                await teleport(bin.x - 24, bin.y);
                await sleep(300);
                await press('x');
                await sleep(300);
                check(await page.evaluate(() => window.__ricGame.scene.getScene('world').dialog.isOpen), 'X next to a bin opens no dialogue');
                await closeDialogue();
                check((await state()).portalGun, 'the first bin did not give the portal gun');
                await press('p');
                await sleep(400);
                await press('x'); // completes the typing of the page
                await sleep(200);
                const said = await page.evaluate(() => window.__ricGame.scene.getScene('world').dialog.body.text);
                check(said.replace(/\n/g, ' ') === "Meh, non abbiamo mica finito qui. C'è ancora da fare.", `P before the minigame said "${said}"`);
                await closeDialogue();
                await press('x'); // a second bin check: a joke line, the gun stays
                await sleep(300);
                check(await page.evaluate(() => window.__ricGame.scene.getScene('world').dialog.isOpen), 'a second look in the bin opens no dialogue');
                await closeDialogue();
                note('bin: the first one gave the portal gun, a second one a joke, P before the minigame said the not-yet line');
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
                // the join banners come first; the exit only opens after them
                await sleep(500);
                if (i === 1) {
                    // the portal gun: face the back wall and press P; the party walks in and the next scene starts
                    await teleport(200, 156);
                    await page.evaluate(() => (window.__ricGame.scene.getScene('world').facing = 'up'));
                    await sleep(1200);
                    await press('p');
                    for (let k = 0; k < 40 && (await state()).sceneIndex <= i; k++) await sleep(200); // the portal walk takes a few seconds
                } else if (SCENES[i].exit === 'edge') {
                    // no door: walk to the left edge of the map
                    await teleport(120, 470);
                    await page.keyboard.down('ArrowLeft');
                    await sleep(1500);
                    await page.keyboard.up('ArrowLeft');
                } else {
                    await teleport(def.door.x + def.door.w / 2, def.door.y + def.door.h / 2);
                    await sleep(300);
                }
                if ((await state()).sceneIndex > i || (await state()).scene === 'ending') break;
            }
            if (i === 1) note('portal: P on the back wall took the party to the next scene');
            if (SCENES[i].exit === 'edge') note(`${SCENES[i].id}: left by walking to the edge of the map`);
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

    // ---- cat-smoke regression: a pick made the moment the cat has slipped under the right sofa, before the countdown, must win ----
    // (the scene used to drop keys until the countdown started, so a quick player who chose the right sofa lost the round)
    await page.evaluate(() => {
        const g = window.__ricGame;
        g.scene.getScenes(true).forEach((sc) => sc.scene.stop());
        window.__catDone = null;
        g.events.once('minigame:done', (d) => (window.__catDone = d));
        g.scene.start('minigame-cat-smoke', { sceneId: 'giuggiu' });
    });
    await sleep(700);
    await press('x'); // closes the instruction card
    await page.evaluate(() => {
        const sc = window.__ricGame.scene.getScene('minigame-cat-smoke');
        sc.tweens.timeScale = 4; // the hops and the hiding play four times faster, the logic is the same
        sc.time.timeScale = 4;
    });
    // hidden = under the sofa body (depth 5, feet at 272) and no tween moving it any more; read the sofa from the cat, not from the scene's own field
    await page.waitForFunction(
        () => {
            const sc = window.__ricGame.scene.getScene('minigame-cat-smoke');
            return sc.cat.depth === 5 && sc.cat.y <= 273 && sc.tweens.getTweensOf(sc.cat).length === 0;
        },
        null,
        { timeout: 60000, polling: 50 }
    );
    const sofaOfCat = await page.evaluate(() => {
        const x = window.__ricGame.scene.getScene('minigame-cat-smoke').cat.x;
        return x < 230 ? 0 : x < 410 ? 1 : 2;
    });
    await press(['ArrowLeft', 'ArrowUp', 'ArrowRight'][sofaOfCat]);
    await press('x');
    await page.waitForFunction(() => window.__catDone !== null, null, { timeout: 20000 });
    const catDone = await page.evaluate(() => window.__catDone);
    check(catDone.id === 'cat-smoke' && catDone.won === true, `cat-smoke: the right sofa (${sofaOfCat}) picked as soon as the cat hid did not win: ${JSON.stringify(catDone)}`);
    note(`cat-smoke: early pick of sofa ${sofaOfCat} wins`);

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
