// Validates src/data/dialogue.it.json against the contract (see docs/dialogue-it.md).
// Standard library only. Quiet: prints one PASS line, or up to 20 errors and exits 1.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const file = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'dialogue.it.json');
const MAX_LINES = 3;
const MAX_CHARS = 44;
// A dialogue page wraps to the width of the box (ui/DialogBox.ts WRAP_W, keep these in step) and must fit MAX_LINES wrapped lines; a "\n" in a text counts as a space.
// The width of a text is measured with the advances of the game's own font (public/assets/fonts/PixelOperator.ttf) at 16 px, with the wrap rule of Phaser's basic word wrap.
const BOX_W = 640;
const WRAP_PORTRAIT = BOX_W - (6 + 96 + 8) - 14;
const WRAP_FULL = BOX_W - 16 - 16;
const WRAP_SAFETY = 6; // px kept free on every line, for the shadow and for a font that rounds differently
const PERSONS = ['ric', 'lara', 'liscio', 'ros', 'lollino', 'fede', 'giuggiu', 'giusy', 'pinolo', 'gatto', 'sconosciuta', 'alessandro', 'rosanna', 'roberto', 'armando', 'carolina', 'papa', 'mamma', 'frangetta', 'slackgirl1', 'slackgirl2', 'slackgirl3', 'albanese1', 'albanese2', 'losco', 'narratore'];
const SCENES = ['universita', 'giuggiu', 'giardini', 'circe', 'cortile'];
// the old night scene stays in the file: its lines move to the credits (they are not played in the world any more)
const CREDITS_SCENE = 'divano';
const SCENE_KEYS = ['arrival', 'meet', 'minigameIntro', 'win', 'lose', 'join'];
const EMPTY_OK = { divano: ['minigameIntro', 'win', 'lose'] };
const SCENE_EXTRA_KEYS = { circe: ['minigameIntro2', 'win2', 'lose2'] };
const MINIGAMES = ['simon', 'cat-smoke', 'slackline', 'd20', 'mash', 'rhythm'];
const EGGS = ['fede', 'extra-3', 'extra-rosanna', 'extra-genitori', 'extra-armando', 'extra-carolina', 'slackgirl1', 'slackgirl2', 'slackgirl3', 'frangetta', 'frangettaNumber', 'frangettaNo', 'frangettaAgain', 'frangettaBurp', 'loscoApproach', 'losco', 'albanese', 'albanesi', 'barBusy', 'barSoldi', 'barSoldiAfter', 'barFetch', 'fumoRos', 'portalFound', 'portalNotYet', 'portalGirls', 'appuntiFound', 'peroniFound', 'peroniDrink', 'peroniKeep', 'fumoFound', 'soldiFound', 'binTaken'];
const UI_KEYS = ['start', 'continue', 'pressX', 'win', 'lose', 'fullscreen', 'mute', 'exit', 'run', 'menu', 'look','drinkPeroni', 'askNumber'];
const MENU_KEYS = ['title', 'diary', 'jump', 'controls', 'quit', 'back', 'sure', 'sureNote', 'yes', 'no', 'diaryTitle', 'jumpTitle', 'jumpHint', 'controlsTitle', 'done', 'todo', 'pageHint', 'backHint'];

const EVENTS = ['losco']; // happenings a line of `meet` can set off (WorldScene.talkToFriend)
// obj_* points of the maps that need no lines: the ids code acts on (src/game/flow/objects.ts ACTIONS) and footprints code only reads (ambient/life.ts)
const OBJECT_ACTIONS = ['lamp', 'puf'];
const OBJECT_FOOTPRINTS = { cortile: ['bar'], giuggiu: ['plates'] };

const CLOSING_LINE ='Meh, sciamanin.';

const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
let lineCount = 0;

const len = (s) => Array.from(s).length;

function checkText(where, text, maxLines, maxChars) {
  if (typeof text !== 'string' || text.trim() === '') return err(where, 'text missing or empty');
  const rows = text.split('\n');
  if (rows.length > maxLines) err(where, `${rows.length} lines, max ${maxLines}`);
  rows.forEach((row, i) => {
    if (row.trim() === '') err(where, `row ${i + 1} is empty`);
    if (len(row) > maxChars) err(where, `row ${i + 1} has ${len(row)} chars, max ${maxChars}: "${row}"`);
  });
  for (const m of text.matchAll(/\{([^}]*)\}/g)) {
    if (m[1] !== 'ric') err(where, `unknown placeholder {${m[1]}}`);
  }
}

/** Width in px of a text in the game font at `size` px: the advance of every glyph from the font's own tables (cmap format 4, hmtx). */
function loadFont(path) {
  const b = readFileSync(path);
  const u16 = (o) => b.readUInt16BE(o);
  const u32 = (o) => b.readUInt32BE(o);
  const tables = {};
  for (let i = 0; i < u16(4); i++) tables[b.toString('latin1', 12 + i * 16, 16 + i * 16)] = u32(20 + i * 16);
  const unitsPerEm = u16(tables.head + 18);
  const numH = u16(tables.hhea + 34);
  const cm = tables.cmap;
  let sub = -1;
  for (let i = 0; i < u16(cm + 2); i++) {
    const platform = u16(cm + 4 + i * 8);
    const enc = u16(cm + 6 + i * 8);
    if ((platform === 3 && enc === 1) || platform === 0) sub = cm + u32(cm + 8 + i * 8);
  }
  if (sub < 0 || u16(sub) !== 4) throw new Error('the font has no format 4 cmap');
  const segs = u16(sub + 6) / 2;
  const end = sub + 14;
  const start = end + 2 * segs + 2;
  const delta = start + 2 * segs;
  const range = delta + 2 * segs;
  const glyph = (code) => {
    for (let i = 0; i < segs; i++) {
      if (code > u16(end + 2 * i)) continue;
      if (u16(start + 2 * i) > code) return 0;
      const ro = u16(range + 2 * i);
      if (ro === 0) return (code + u16(delta + 2 * i)) & 0xffff;
      const g = u16(range + 2 * i + ro + 2 * (code - u16(start + 2 * i)));
      return g ? (g + u16(delta + 2 * i)) & 0xffff : 0;
    }
    return 0;
  };
  return (text, size = 16) => [...text].reduce((w, ch) => w + (u16(tables.hmtx + 4 * Math.min(glyph(ch.codePointAt(0)), numH - 1)) * size) / unitsPerEm, 0);
}
const textWidth = loadFont(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'fonts', 'PixelOperator.ttf'));

/** The wrapped lines of a page at `width` px, the way Phaser's basic word wrap breaks them (the trailing space counts). */
function wrapLines(text, width) {
  const space = textWidth(' ');
  const out = [];
  let row = '';
  let left = width;
  text.split(' ').forEach((word, j) => {
    const w = textWidth(word);
    if (w + space > left) {
      if (j > 0) (out.push(row), (row = ''));
      left = width - w;
    } else left -= w + space;
    row += (row && j > 0 ? ' ' : '') + word;
  });
  out.push(row);
  return out;
}

/** A page of the dialogue box: at most MAX_LINES wrapped lines at the width of its layout (portrait for a speaker with a portrait, full width for the narrator). */
function checkPage(where, text, speaker) {
  if (typeof text !== 'string' || text.trim() === '') return err(where, 'text missing or empty');
  const flat = text.replace(/\s*\n\s*/g, ' ').replace(/\{ric\}/g, 'Ric');
  // every speaker but the narrator is measured in the narrower layout with a portrait (a person without a portrait would only get more room)
  const rows = wrapLines(flat, (speaker === 'narratore' ? WRAP_FULL : WRAP_PORTRAIT) - WRAP_SAFETY);
  if (rows.length > MAX_LINES) err(where, `${rows.length} wrapped lines, max ${MAX_LINES}: "${text.replace(/\n/g, ' ').slice(0, 60)}..."`);
  for (const m of text.matchAll(/\{([^}]*)\}/g)) if (m[1] !== 'ric') err(where, `unknown placeholder {${m[1]}}`);
}

function checkLines(where, arr, allowEmpty = false) {
  if (!Array.isArray(arr)) return err(where, 'not an array');
  if (arr.length === 0 && !allowEmpty) err(where, 'empty array');
  arr.forEach((line, i) => {
    const w = `${where}[${i}]`;
    if (line === null || typeof line !== 'object') return err(w, 'not an object');
    for (const k of Object.keys(line)) if (!['speaker', 'text', 'pause', 'event', 'laugh'].includes(k)) err(w, `unknown key ${k}`);
    if ('event' in line && !EVENTS.includes(line.event)) err(w, `unknown event "${line.event}"`);
    if ('laugh' in line && line.laugh !== true) err(w, 'laugh must be true when present');
    if (!PERSONS.includes(line.speaker)) err(w, `bad speaker "${line.speaker}"`);
    checkPage(w, line.text, line.speaker);
    if ('pause' in line && !(Number.isInteger(line.pause) && line.pause >= 0)) err(w, 'pause must be a non-negative integer (ms)');
    lineCount += 1;
  });
}

function sameKeys(where, obj, expected) {
  const keys = Object.keys(obj);
  for (const k of expected) if (!keys.includes(k)) err(where, `missing key ${k}`);
  for (const k of keys) if (!expected.includes(k)) err(where, `unexpected key ${k}`);
}

let data;
try {
  data = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.log(`FAIL dialogue: cannot read or parse ${file}: ${e.message}`);
  process.exit(1);
}

sameKeys('root', data, ['ui', 'menu', 'controls', 'diary', 'scenes', 'minigames', 'easterEggs', 'objects', 'credits', 'ending', 'titleScreen']);

// objects: X next to an obj_<id> point of a room map (src/game/flow/objects.ts) plays objects.<sceneId>.<id>
for (const [sid, objs] of Object.entries(data.objects ?? {})) {
  if (!SCENES.includes(sid)) err(`objects.${sid}`, "not a scene id");
  for (const [oid, arr] of Object.entries(objs)) checkLines(`objects.${sid}.${oid}`, arr);
}
// every obj_<id> point of every map has its lines (but the exceptions above), and no lines lack a point
const mapDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'maps');
for (const f of readdirSync(mapDir).filter((n) => n.endsWith('.json'))) {
  const room = f.slice(0, -'.json'.length);
  const skip = [...OBJECT_ACTIONS, ...(OBJECT_FOOTPRINTS[room] ?? [])];
  const ids = Object.keys(JSON.parse(readFileSync(join(mapDir, f), 'utf8')).points).filter((n) => n.startsWith('obj_')).map((n) => n.slice(4));
  sameKeys(`objects.${room}`, data.objects?.[room] ?? {}, ids.filter((id) => !skip.includes(id)));
}

// menu, controls (the Esc menu) and diary (one entry per scene, up to 4 rows)
sameKeys('menu', data.menu ?? {}, MENU_KEYS);
for (const k of MENU_KEYS) checkText(`menu.${k}`, data.menu?.[k], 1, MAX_CHARS);
sameKeys('controls', data.controls ?? {}, ['rows', 'portal']);
checkText('controls.portal', data.controls?.portal, 1, MAX_CHARS);
if (!Array.isArray(data.controls?.rows) || data.controls.rows.length === 0 || data.controls.rows.length > 9) err('controls.rows', 'needs 1 to 9 rows');
else data.controls.rows.forEach((r, i) => checkText(`controls.rows[${i}]`, r, 1, MAX_CHARS));
sameKeys('diary', data.diary ?? {}, SCENES);
for (const id of SCENES) checkText(`diary.${id}`, data.diary?.[id], 4, MAX_CHARS);

// ui
for (const k of UI_KEYS) if (typeof data.ui?.[k] !== 'string') err(`ui.${k}`, 'missing string');
for (const [k, v] of Object.entries(data.ui ?? {})) {
  if (typeof v !== 'string') err(`ui.${k}`, 'not a string');
  else checkText(`ui.${k}`, v, 1, MAX_CHARS);
}

// titleScreen
for (const k of ['title', 'subtitle', 'press']) {
  if (typeof data.titleScreen?.[k] !== 'string') err(`titleScreen.${k}`, 'missing string');
  else checkText(`titleScreen.${k}`, data.titleScreen[k], 1, MAX_CHARS);
}

// scenes
sameKeys('scenes', data.scenes ?? {}, [...SCENES, CREDITS_SCENE]);
if (JSON.stringify(Object.keys(data.scenes ?? {})) !== JSON.stringify([...SCENES, CREDITS_SCENE])) err('scenes', `order must be ${[...SCENES, CREDITS_SCENE].join(', ')}`);
for (const id of [...SCENES, CREDITS_SCENE]) {
  const scene = data.scenes?.[id];
  if (!scene || typeof scene !== 'object' || Array.isArray(scene)) {
    err(`scenes.${id}`, 'must be an object');
    continue;
  }
  sameKeys(`scenes.${id}`, scene, [...SCENE_KEYS, ...(SCENE_EXTRA_KEYS[id] ?? [])]);
  for (const k of Object.keys(scene)) checkLines(`scenes.${id}.${k}`, scene[k], (EMPTY_OK[id] ?? []).includes(k));
}

// minigames
sameKeys('minigames', data.minigames ?? {}, MINIGAMES);
for (const id of MINIGAMES) {
  const m = data.minigames?.[id];
  if (!m || typeof m !== 'object' || Array.isArray(m)) {
    err(`minigames.${id}`, 'must be an object');
    continue;
  }
  sameKeys(`minigames.${id}`, m, ['title', 'instructions', 'winText', 'loseText']);
  checkText(`minigames.${id}.title`, m.title, 1, 32);
  checkText(`minigames.${id}.instructions`, m.instructions, 2, MAX_CHARS);
  checkText(`minigames.${id}.winText`, m.winText, 2, MAX_CHARS);
  checkText(`minigames.${id}.loseText`, m.loseText, 2, MAX_CHARS);
}

// easter eggs
sameKeys('easterEggs', data.easterEggs ?? {}, EGGS);
for (const id of EGGS) checkLines(`easterEggs.${id}`, data.easterEggs?.[id]);

const fede = data.easterEggs?.fede ?? [];
if (fede.length !== 2 || fede[0].speaker !== 'ric' || fede[0].text !== "Allora, Fede dov'è?" || fede[1].speaker !== 'lara' || fede[1].text !== 'Ha paccato.') {
  err('easterEggs.fede', 'must be exactly 2 lines: ric "Allora, Fede dov\'è?" then lara "Ha paccato."');
}

// every scene with a next destination ends on Ric's closing line
for (const id of SCENES) {
  const join = data.scenes?.[id]?.join ?? [];
  const last = join[join.length - 1];
  if (!last || last.speaker !== 'ric' || last.text !== CLOSING_LINE) err(`scenes.${id}.join`, `last line must be ric "${CLOSING_LINE}"`);
}

// the whole file: names capitalised, the cat is Gatto di Paz, "slack" not "fettuccia", no birthday inside the story
const strings = []; // [path, text, speaker of the line it belongs to]
const walk = (v, path, speaker) => {
  if (typeof v === 'string') strings.push([path, v, speaker]);
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`, speaker));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'speaker') walk(x, path ? `${path}.${k}` : k, v.speaker ?? speaker);
};
walk(data, '');
// Lollino is Tuscan without the gorgia spelling: no word starting with a mute "h" but the verb forms, no "h" for a hard c inside a word
const GORGIA = /(?<![\p{L}])h(?!(?:o|a|ai|anno)(?![\p{L}]))\p{L}|[aeiouàèéìòù]h[aouàòù]/iu;
const word = (w) => new RegExp(`(?<![\\p{L}\\p{N}_])${w}(?![\\p{L}\\p{N}_])`, 'u');
const LOWER_NAMES = ['ric', 'lollino', 'pinolo', 'giuggiu', 'liscio', 'ros', 'giusy', 'lara', 'fede', 'gatto'].map((n) => [n, word(n)]);
const BAD_CAT = /Gatto(?! di Paz)/u;
const BIRTHDAY = /compleann|festegg|auguri|trentenn|\b30\b/i; // "trent'anni" alone is Pinolo's thirty years of pinhole cameras
for (const [path, raw, speaker] of strings) {
  if (/trellon/i.test(raw) && speaker !== 'giuggiu') err(path, 'only Giuggiu says "trellone": use canna, cannetta or cannone');
  if (/\bnonn[aie]\b/i.test(raw)) err(path, 'no grandmother in the story');
  if (speaker === 'lollino' && GORGIA.test(raw)) err(path, 'no gorgia spelling ("h" for a hard c) in Lollino\'s lines');
  const text = raw.replace(/\{ric\}/g, 'Ric').replace(/\n/g, ' '); // a name may be split over two rows
  for (const [n, re] of LOWER_NAMES) if (re.test(text)) err(path, `lowercase "${n}": names start with a capital, the cat is "Gatto di Paz"`);
  if (BAD_CAT.test(text)) err(path, 'the cat is "Gatto di Paz", never "Gatto" alone');
  if (/fettuccia/i.test(text)) err(path, 'say "slack", never "fettuccia"');
  if (!path.startsWith('credits') && !path.startsWith('titleScreen') && BIRTHDAY.test(text)) err(path, 'no birthday reference inside the story');
}
// bins: each binTaken entry is one "già preso" variant, picked at random; portalNotYet is one fixed line
if ((data.easterEggs?.binTaken ?? []).length < 3) err('easterEggs.binTaken', 'needs at least 3 variants');
const notYet = data.easterEggs?.portalNotYet ?? [];
if (notYet.length !== 1 || notYet[0].text.replace(/\n/g, ' ') !== "Meh, non abbiamo mica finito qui. C'è ancora da fare.") err('easterEggs.portalNotYet', 'must be exactly one line: "Meh, non abbiamo mica finito qui. C\'è ancora da fare." (a row break instead of the space)');

// the lines spoken during the credits (src/game/ending/script.ts): the banner is narrower than the dialogue box, so a line stays under 110 characters
const bannerFits = (where, list) =>
  (list ?? []).forEach((l, i) => {
    if (typeof l?.text === 'string' && len(l.text.replace(/\n/g, ' ')) > 110) err(`${where}[${i}]`, 'more than 110 characters: the credits banner shows at most 3 rows');
  });
for (const k of ['arrival', 'meet', 'join']) bannerFits(`scenes.${CREDITS_SCENE}.${k}`, data.scenes?.[CREDITS_SCENE]?.[k]);
// the TV exchange: the documentary's punchline, then the laugh (the one line marked `laugh`, the one the whole room laughs at)
const spoken = Object.values(data.scenes?.[CREDITS_SCENE] ?? {}).flat();
const laughs = spoken.filter((l) => l?.laugh);
if (laughs.length !== 1) err(`scenes.${CREDITS_SCENE}`, `needs exactly one line with "laugh": true, has ${laughs.length}`);
else {
  const punchline = spoken[spoken.indexOf(laughs[0]) - 1];
  if (punchline?.speaker !== 'narratore' || !/\.\.\. ?le acciughe!$/.test(punchline.text)) err(`scenes.${CREDITS_SCENE}`, 'the line before the laugh must be the narrator\'s and end "... le acciughe!" (the space is optional)');
}

// ending: the upstairs gag
sameKeys('ending', data.ending ?? {}, ['fromUpstairs', 'upstairs', 'upstairsFrangetta']);
checkText('ending.fromUpstairs', data.ending?.fromUpstairs, 1, MAX_CHARS);
for (const k of ['upstairs', 'upstairsFrangetta']) {
  checkLines(`ending.${k}`, data.ending?.[k]);
  bannerFits(`ending.${k}`, data.ending?.[k]);
}

// credits
checkText('credits.title', data.credits?.title, 1, MAX_CHARS);
if (!Array.isArray(data.credits?.lines) || data.credits.lines.length === 0) err('credits.lines', 'missing or empty');
else data.credits.lines.forEach((l, i) => checkText(`credits.lines[${i}]`, l, 1, MAX_CHARS));

if (errors.length) {
  console.log(`FAIL dialogue: ${errors.length} problem(s)`);
  for (const e of errors.slice(0, 20)) console.log(`  ${e}`);
  if (errors.length > 20) console.log(`  ... and ${errors.length - 20} more`);
  process.exit(1);
}
console.log(`PASS dialogue: ${lineCount} lines, all within limits`);
