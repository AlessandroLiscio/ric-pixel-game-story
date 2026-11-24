// Validates src/data/dialogue.it.json against the contract (see docs/dialogue-it.md).
// Standard library only. Quiet: prints one PASS line, or up to 20 errors and exits 1.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const file = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'dialogue.it.json');
const MAX_LINES = 3;
const MAX_CHARS = 44;
const PERSONS = ['ric', 'lara', 'liscio', 'ros', 'lollino', 'fede', 'giuggiu', 'giusy', 'pinolo', 'gatto', 'sconosciuta', 'narratore'];
const SCENES = ['universita', 'giuggiu', 'giardini', 'circe', 'cortile', 'divano'];
const SCENE_KEYS = ['arrival', 'meet', 'minigameIntro', 'win', 'lose', 'join'];
const EMPTY_OK = { divano: ['minigameIntro', 'win', 'lose'] };
const SCENE_EXTRA_KEYS = { circe: ['minigameIntro2', 'win2', 'lose2'] };
const MINIGAMES = ['simon', 'cat-smoke', 'slackline', 'd20', 'mash', 'rhythm'];
const EGGS = ['pinolo-pinhole', 'gatto', 'ric-sedia', 'ros-trellone', 'giusy-divano', 'ric-sopra', 'fede', 'extra-1', 'extra-2', 'extra-3'];
const UI_KEYS = ['start', 'continue', 'pressX', 'win', 'lose', 'fullscreen', 'mute'];

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

function checkLines(where, arr, allowEmpty = false) {
  if (!Array.isArray(arr)) return err(where, 'not an array');
  if (arr.length === 0 && !allowEmpty) err(where, 'empty array');
  arr.forEach((line, i) => {
    const w = `${where}[${i}]`;
    if (line === null || typeof line !== 'object') return err(w, 'not an object');
    for (const k of Object.keys(line)) if (!['speaker', 'text', 'pause'].includes(k)) err(w, `unknown key ${k}`);
    if (!PERSONS.includes(line.speaker)) err(w, `bad speaker "${line.speaker}"`);
    checkText(w, line.text, MAX_LINES, MAX_CHARS);
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

sameKeys('root', data, ['ui', 'scenes', 'minigames', 'easterEggs', 'credits', 'titleScreen']);

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
sameKeys('scenes', data.scenes ?? {}, SCENES);
if (JSON.stringify(Object.keys(data.scenes ?? {})) !== JSON.stringify(SCENES)) err('scenes', `order must be ${SCENES.join(', ')}`);
for (const id of SCENES) {
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
const trellone = data.easterEggs?.['ros-trellone'] ?? [];
if (!trellone.some((l) => l.speaker === 'ric' && l.text === "Per l'amor di dio basta!")) {
  err('easterEggs.ros-trellone', "needs a ric line with the exact text \"Per l'amor di dio basta!\"");
}

const fede = data.easterEggs?.fede ?? [];
if (fede.length !== 2 || fede[0].speaker !== 'ric' || fede[0].text !== "Allora, Fede dov'è?" || fede[1].speaker !== 'lara' || fede[1].text !== 'Ha paccato.') {
  err('easterEggs.fede', 'must be exactly 2 lines: ric "Allora, Fede dov\'è?" then lara "Ha paccato."');
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
