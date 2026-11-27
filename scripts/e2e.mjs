// npm run test:e2e-nolog: the end-to-end test. Prints `PASS e2e: <scenes> scenes, 6 minigames, ending and skydive, no console errors` (the
// scene count is read from src/data/scenes.json) or one FAIL block; the full
// step log is logs/e2e/steps.log (build logs beside it). Two single-file offline builds, both opened through file://:
//   logs/e2e/dist       VITE_TEST_BUILD=1 (test hooks): title, every scene, all 6 minigames, the ending, the skydive, the replay from the title.
//   logs/e2e/dist-prod  production: the title renders, the game starts, and no test hook ships.
// Real input: scene 1 (universita) is played with key presses only (arrows, X), and so is the last scene when it has no minigame (it
// plays by itself); simon (the pinhole camera quiz: arrows to the right answer, X), mash and d20 (X for its 5 s window) are
// played with real key presses in every scene; the other scenes teleport next to the friend and close dialogue with the test skip;
// slackline, cat-smoke (lost on purpose) and rhythm are forced through window.__ricTest, so both a win and a lose path are covered.
// At the Cortile Ric fetches Ros and Giusy where they end up, in the bottom right corner: he is put just above each one's live position.
// The Cortile lads and the hooded man must walk where the story puts them, and the speech of the ending and of the plane must wait for X.
// The skydive's fall, credits and landing are cut short with the test skip.
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
const keySrc = readFileSync(join(ROOT, 'src/game/testKey.ts'), 'utf8');
const SKIP_KEY = /TEST_SKIP_KEY\s*=\s*'([^']+)'/.exec(keySrc)?.[1];

let browser;
let prod;
try {
    // the scene and minigame lists are the contract of the final count: report a drift instead of faking the numbers
    const N = SCENES.length; // every scene count below comes from the data, so a scene added or removed needs no edit here
    const LAST = N - 1;
    check(N >= 2, `scenes.json holds ${N} scenes`);
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
    // HD: every running scene's main camera is the zoom-2, origin-0 camera of hdCamera.ts, so the 640x360 layouts fill the 1280x720 canvas
    const hdCameras = () =>
        page.evaluate(() => window.__ricGame.scene.getScenes(true).map((s) => `${s.scene.key}:${s.cameras.main.zoom}:${s.cameras.main.originX}:${s.cameras.main.width}x${s.cameras.main.height}`));
    const checkHd = async (where) => {
        const cams = await hdCameras();
        check(cams.length > 0 && cams.every((c) => /:2:0:1280x720$/.test(c)), `${where}: cameras not zoom 2 / origin 0 / 1280x720: ${cams}`);
    };
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
        await checkHd(scene);
        if (!REAL.includes(id)) {
            await sleep(300);
            await test(id === LOSE ? 'lose' : 'win');
            how[id] = 'forced';
        } else if (id === 'simon') {
            // the pinhole camera quiz: X closes the card; then, for each question, arrow down to the row of the right answer (the scene's
            // `correct` and `sel` fields) and confirm with X, so the quiz is won
            await sleep(300);
            await press('x');
            while (await running()) {
                check(Date.now() < end, 'the quiz did not finish in 60 s');
                const q = await page.evaluate((sc) => {
                    const s = window.__ricGame.scene.getScene(sc);
                    return s?.accepting ? { sel: s.sel, correct: s.correct } : null;
                }, scene);
                if (q) await press(q.sel === q.correct ? 'x' : 'ArrowDown');
                await sleep(q ? 120 : 200);
            }
            how[id] = 'real';
        } else {
            // mash: X as fast as possible (about 12 a second, the win needs about 7.6); d20: X for its 5 s window (about 8 a second, or the
            // 60 that end it early); any result is valid, but the landed value must be the one the presses give
            const gap = id === 'mash' ? 70 : 120;
            let seen = null;
            while (await running()) {
                check(Date.now() < end, `${id} did not finish in 60 s`);
                await press('x');
                await sleep(gap);
                if (id === 'd20') seen = (await page.evaluate((sc) => { const s = window.__ricGame.scene.getScene(sc); return s ? { presses: s.presses, roll: s.roll, fumo: s.fumo } : null; }, scene)) ?? seen;
            }
            if (id === 'd20') check(seen && seen.presses > 0 && seen.fumo === true && seen.roll === Math.min(20, Math.round(Math.min(seen.presses, 60) / 3) + 2), `d20: ${JSON.stringify(seen)} is not min(20, round(presses / 3) + 2) with the hash`);
            how[id] = 'real';
        }
        await until((x) => x.scene === 'world', `back to the world after ${id}`);
    };

    // ---- title ----
    let s = await until((x) => x.scene === 'title', 'title');
    check((await litPixels(context, page)) > 200, 'title screen looks blank');
    await checkHd('title');
    check((await page.evaluate(() => [document.querySelector('canvas').width, document.querySelector('canvas').height])).join('x') === '1280x720', 'canvas is not 1280x720');
    await press('Enter');
    await until(world(0), 'world 0');
    await checkHd('world');
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
    for (const [keys, mode] of [[['ArrowDown', 'x'], 'jump'], [['Escape', 'ArrowDown', 'x'], 'controls'], [['Escape', 'ArrowUp', 'ArrowUp', 'x'], 'diary'], [['Escape'], 'main']]) {
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
    for (const k of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'x']) {
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

    // ---- the scenes ----
    const party = [];
    for (let i = 0; i < N; i++) {
        await until(world(i), `world ${i}`);
        await page.waitForFunction((sid) => window.__ricGame.scene.getScene('world').def?.id === sid, SCENES[i].id, { timeout: 10000 });
        // a tile room takes door and friend positions from its map: read the resolved entry from the live scene
        const live = await page.evaluate(() => {
            const d = window.__ricGame.scene.getScene('world').def;
            return { friend: d.friend, friend2: d.friend2, door: d.door };
        });
        const def = { ...SCENES[i], ...live };
        const before = (await entered()).length;
        // Ric carries the hash into Casa Circe, so the d20 check below covers its +2 bonus
        if (SCENES[i].id === 'circe') await page.evaluate(() => { window.__ricGame.registry.get('run').flags.fumo = true; });
        const want = friendsOf(SCENES[i]);
        party.push(...want);
        const finale = i === LAST && minigamesOf(SCENES[i]).length === 0;
        const real = i === 0 || finale;

        if (finale) {
            // a last scene with no minigame (divano): the finale plays by itself; close every page with X only, no test skip
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
            // room objects: X on Giuggiu's pouf makes Ric doze there and get up again; at Circe's the TV has its lines and the lamp toggles
            const ricAt = () => page.evaluate(() => { const r = window.__ricGame.scene.getScene('world').ric; return { x: r.x, y: r.y }; });
            if (SCENES[i].id === 'giuggiu') {
                await teleport(104, 336); // right of the pouf (tile 2,10)
                await sleep(200);
                await press('x');
                await sleep(800);
                check((await ricAt()).x < 100, 'X next to the pouf did not sit Ric on it');
                await sleep(2500);
                check((await ricAt()).x < 100, 'Ric got up from the pouf before he moved');
                await page.keyboard.down('ArrowRight'); // the nap lasts until Ric moves
                await sleep(400);
                await page.keyboard.up('ArrowRight');
                await sleep(300);
                check((await ricAt()).x >= 100, 'a move key did not get Ric up from the pouf');
                note('objects: the pouf nap lasts until Ric moves');
            }
            if (SCENES[i].id === 'circe') {
                const glowsOn = () => page.evaluate(() => window.__ricGame.scene.getScene('world').tw.glows.filter((g) => g.img.visible).length);
                await teleport(368, 200); // below the TV (tiles 10-12, 4-5)
                await sleep(200);
                await press('x');
                await sleep(1500); // the line types itself out
                const tvLine = await page.evaluate(() => { const w = window.__ricGame.scene.getScene('world'); return w.dialog.isOpen ? w.dialog.body.text : ''; });
                check(tvLine.includes('Vampire Diaries'), `X below the TV said "${tvLine}"`);
                await closeDialogue();
                await teleport(566, 200); // left of the floor lamp (tile 18, 3-5)
                await sleep(200);
                const before = await glowsOn();
                await press('x');
                await sleep(300);
                const after = await glowsOn();
                check(after !== before, `the lamp did not toggle (${before} lit glows before, ${after} after)`);
                await press('x');
                await sleep(300);
                check((await glowsOn()) === before, 'a second X did not switch the lamp back');
                note('objects: the Circe TV lines and the lamp toggle work');
            }
            if (i === 1) {
                // Giuggiu's bin holds the portal gun; Z before the scene is done gets the "not yet" line
                const bin = SCENES[i].bins[0];
                check(!(await state()).portalGun, 'the portal gun is found before any bin was checked');
                await teleport(bin.x - 24, bin.y);
                await sleep(300);
                await press('x');
                await sleep(300);
                check(await page.evaluate(() => window.__ricGame.scene.getScene('world').dialog.isOpen), 'X next to a bin opens no dialogue');
                await closeDialogue();
                check((await state()).portalGun, "Giuggiu's bin did not give the portal gun");
                await press('z');
                await sleep(400);
                await press('x'); // completes the typing of the page
                await sleep(200);
                const said = await page.evaluate(() => window.__ricGame.scene.getScene('world').dialog.body.text);
                check(said.replace(/\n/g, ' ').startsWith('Meh, non abbiamo mica finito qui'), `Z before the minigame said "${said}"`);
                await closeDialogue();
                await press('x'); // a second look in the bin: the "already taken" line, the gun stays
                await sleep(300);
                check(await page.evaluate(() => window.__ricGame.scene.getScene('world').dialog.isOpen), 'a second look in the bin opens no dialogue');
                await closeDialogue();
                note('bin: it gave the portal gun, a second look the already-taken line, Z before the minigame said the not-yet line');
            }
            // the Cortile: a few steps in, the two lads walk over to Ros and Giusy and all four end up close together, two by two
            if (SCENES[i].id === 'cortile') {
                await page.evaluate(() => {
                    const w = window.__ricGame.scene.getScene('world');
                    w.ric.setPosition(w.barZone.x + w.barZone.w / 2, w.barZone.y + w.barZone.h / 2);
                });
                for (let n = 0; n < 50 && (await worldProp('barState')) !== 'away'; n++) await sleep(100);
                check((await worldProp('barState')) === 'away', 'the trigger zone did not send the lads to Ros and Giusy');
                await closeDialogue();
                const four = () =>
                    page.evaluate(() =>
                        window.__ricGame.scene
                            .getScene('world')
                            .npcs.filter((n) => n.kind === 'bar' || n.def.personId.startsWith('albanese'))
                            .map((n) => ({ id: n.def.personId, walking: !!n.walking, x: n.sprite.x, y: n.sprite.y }))
                    );
                let there = await four();
                for (let n = 0; n < 150 && there.some((p) => p.walking); n++) {
                    await sleep(200);
                    there = await four();
                }
                check(there.length === 4 && there.every((p) => !p.walking), `the four did not arrive: ${JSON.stringify(there)}`);
                const at = Object.fromEntries(there.map((p) => [p.id, p]));
                for (const [girl, lad] of [['ros', 'albanese1'], ['giusy', 'albanese2']]) check(Math.hypot(at[girl].x - at[lad].x, at[girl].y - at[lad].y) <= 70, `${girl} and ${lad} do not stand together: ${JSON.stringify(there)}`);
                note(`cortile: the lads walked over, all four arrived ${JSON.stringify(there.map((p) => `${p.id} ${Math.round(p.x)},${Math.round(p.y)}`))}`);
            }
            // circe: talk to Giusy (friend2) first, then Ros; each plays only her own minigame, whatever the order
            const talks = def.friend2 ? [def.friend2, def.friend] : [def.friend];
            await teleport(talks[0].x - 22, talks[0].y);
            for (let n = 0; n < 600; n++) {
                s = await state();
                if (want.every((id) => s.party.includes(id))) break;
                if (s.scene.startsWith('minigame-')) {
                    await playMinigame(s.scene.slice('minigame-'.length));
                    talks.shift();
                    if (talks.length) await teleport(talks[0].x - 22, talks[0].y);
                } else {
                    await press('x');
                    await sleep(120);
                    await test('skip');
                    await sleep(120);
                }
            }
            if (SCENES[i].id === 'cortile') {
                // the talk with Lara brought the hooded man to her side
                const gap = await page.evaluate(([x, y]) => { const m = window.__ricGame.scene.getScene('world').npcs.find((n) => n.def.personId === 'losco'); return Math.hypot(m.sprite.x - x, m.sprite.y - y); }, [def.friend.x, def.friend.y]);
                check((await worldProp('loscoDone')) && gap <= 30, `the hooded man did not walk up to Lara (${Math.round(gap)} px away)`);
                check((await worldProp('barState')) === 'away', 'Ros and Giusy came back before Ric fetched them');
            }
            // the Cortile: while Ros and Giusy are with the lads, the exit stays shut until Ric fetches them with X (from above: a lad stands beside each)
            for (let n = 0; n < 60 && (await page.evaluate(() => window.__ricGame.scene.getScene('world').barState)) === 'away'; n++) {
                const girl = await page.evaluate(() => { const g = window.__ricGame.scene.getScene('world').npcs.find((x) => x.kind === 'bar' && !x.walking); return g ? { x: g.sprite.x, y: g.sprite.y } : null; });
                if (girl) await teleport(girl.x, girl.y - 22);
                await sleep(200);
                await press('x');
                await sleep(300);
                await test('skip');
                await sleep(300);
            }
            if (SCENES[i].id === 'cortile') note('cortile: Ros and Giusy fetched from the bottom right corner before the exit');
            for (let n = 0; n < 20; n++) {
                // the join banners come first; the exit only opens after them
                await sleep(500);
                if (i === 1) {
                    // the portal gun: face the back wall and press Z; the party walks in and the next scene starts
                    await teleport(200, 156);
                    await page.evaluate(() => (window.__ricGame.scene.getScene('world').facing = 'up'));
                    await sleep(1200);
                    await press('z');
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
            if (i === 1) note('portal: Z on the back wall took the party to the next scene');
            if (SCENES[i].exit === 'edge') note(`${SCENES[i].id}: left by walking to the edge of the map`);
        }

        s = await until((x) => (i === LAST ? x.scene === 'ending' : world(i + 1)(x)), `leaving scene ${i} (${SCENES[i].id})`, 15000);
        const went = (await entered()).slice(before);
        check([...s.party].sort().join() === [...party].sort().join(), `scene ${i} ${SCENES[i].id}: party ${s.party}, wanted ${party}`); // Ros and Giusy rejoin from the Cortile bar at the end of the train
        // circe is talked to Giusy first, so her mash comes before Ros's d20
        const wanted = SCENES[i].friend2 ? [...minigamesOf(SCENES[i])].reverse() : minigamesOf(SCENES[i]);
        check(went.join() === wanted.join(), `scene ${i} ${SCENES[i].id}: minigames entered [${went}], wanted [${wanted}]`);
        note(`scene ${i} ${SCENES[i].id} (${real ? 'real keys' : 'teleport + skip'}): minigames [${went}], party ${s.party}`);
    }

    // ---- ending ----
    s = await until((x) => x.scene === 'ending', 'ending scene');
    const all = await entered();
    check(new Set(all).size === 6 && MINIGAME_IDS.every((id) => all.includes(id)), `distinct minigames entered: ${[...new Set(all)]} (${new Set(all).size}), wanted 6`);
    check([...s.party].sort().join() === [...party].sort().join(), `final party ${s.party}`);
    for (const id of MINIGAME_IDS) check(typeof s.results[id] === 'boolean', `result ${id} = ${s.results[id]}`);
    for (const id of ['simon', 'slackline', 'mash', 'rhythm']) check(s.results[id] === true, `result ${id} = ${s.results[id]}`);
    check(s.results[LOSE] === false, `result ${LOSE} = ${s.results[LOSE]}`);
    check((await litPixels(context, page)) > 200, 'ending looks blank');
    note(`ending: party ${s.party}, results ${JSON.stringify(s.results)}, minigames ${JSON.stringify(how)}`);

    // Esc over the night room: the menu must be drawn above it, not only take the keys (it is registered before the ending scenes)
    await press('Escape');
    await until((x) => x.scene === 'menu', 'the Esc menu over the ending');
    await sleep(300);
    const order = await page.evaluate(() => window.__ricGame.scene.getScenes(false).map((x) => x.scene.key));
    check(order.indexOf('menu') > order.indexOf('ending'), `the menu is drawn under the night room: ${order}`);
    await press('Escape');
    await until((x) => x.scene === 'ending', 'back to the ending after the menu');
    await sleep(400);

    // the speech of the ending and of the plane: a line stays until X (nothing moves it on by itself), then X walks through all of them
    const speech = (key) =>
        page.evaluate((k) => {
            const e = window.__ricGame.scene.getScene(k);
            return { ix: e.beatIx, total: e.beats?.length ?? 0, text: e.beats?.[e.beatIx]?.text ?? '', laughs: e.laughs?.length ?? 0, phase: e.phase };
        }, key);
    /** Returns what each line of the scene `key` showed. */
    const readAll = async (key) => {
        let c = await speech(key);
        for (let n = 0; n < 100 && !c.text; n++) {
            await sleep(100);
            c = await speech(key);
        }
        check(c.ix === 0 && c.text, `the ${key} speech did not start: ${JSON.stringify(c)}`);
        await sleep(8000);
        check((await speech(key)).ix === 0, `a ${key} line moved on without X`);
        const said = [];
        for (let n = 0; n < 60 && c.ix < c.total; n++) {
            said.push(c);
            await press('x');
            await sleep(200);
            c = await speech(key);
        }
        check(c.ix === c.total && said.length === c.total, `X did not walk through the ${c.total} ${key} lines: ${JSON.stringify(c)}`);
        return said;
    };
    const said = await readAll('ending');
    const laugh = said.findIndex((x) => x.laughs > 0);
    check(laugh > 0 && said[laugh - 1].text.endsWith('... le acciughe!') && said[laugh].laughs >= 7, `no room-wide laugh after the anchovies: ${JSON.stringify(said[laugh])}`);
    await until((x) => x.scene === 'skydive', 'the skydive after the last ending line', 15000);
    note(`ending: ${said.length} lines advanced with X, the room laughed, then the skydive`);

    // ---- skydive: the plane, the jump, then (by the test skip) the finale ----
    await sleep(1500); // the transition opens over the sky
    check((await litPixels(context, page)) > 200, 'skydive looks blank');
    await checkHd('skydive');
    const plane = await readAll('skydive');
    check(plane.every((x) => x.phase === 'plane'), `a plane line showed outside the plane phase: ${JSON.stringify(plane.map((x) => x.phase))}`);
    const sky = (field) => page.evaluate((k) => window.__ricGame.scene.getScene('skydive')[k], field);
    const reach = async (phase, label) => {
        for (let n = 0; n < 150 && (await sky('phase')) !== phase; n++) await sleep(100);
        check((await sky('phase')) === phase, `${label}: phase is "${await sky('phase')}"`);
    };
    await reach('fall', 'no jump after the last plane line');
    await test('skip'); // the credits and the landing take about a minute
    await reach('finale', 'no finale after the skip in the fall');
    check((await litPixels(context, page)) > 200, 'skydive finale looks blank');
    note(`skydive: ${plane.length} plane lines advanced with X, the jump, then the finale`);

    // the test skip shows the prompt at once, then the restart key works (the scene's canRestart field says when)
    for (let n = 0; n < 100; n++) {
        if (await sky('canRestart')) break;
        await test('skip');
        await sleep(300);
    }
    check(await sky('canRestart'), 'the skydive never offered the restart');
    await press('x');
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
    // hidden for good = the scene takes picks (it does only after the last slide) with the cat under the sofa body (depth 5) and no tween moving it; read the sofa from the cat, not from the scene's own field
    await page.waitForFunction(
        () => {
            const sc = window.__ricGame.scene.getScene('minigame-cat-smoke');
            return sc.picking === true && sc.cat.depth === 5 && sc.tweens.getTweensOf(sc.cat).length === 0;
        },
        null,
        { timeout: 60000, polling: 50 }
    );
    const sofaOfCat = await page.evaluate(() => {
        const x = window.__ricGame.scene.getScene('minigame-cat-smoke').cat.x; // the sofas stand at x 46 (left), 320 (middle), 594 (right)
        return x < 183 ? 0 : x < 457 ? 1 : 2;
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
console.log(`PASS e2e: ${SCENES.length} scenes, ${MINIGAME_IDS.length} minigames, ending and skydive, no console errors`);
