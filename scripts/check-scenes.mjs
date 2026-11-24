// Validates src/data/scenes.json against the contract (see docs/scenes.md).
// Standard library only. Quiet: prints one PASS line, or up to 20 errors and exits 1.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => JSON.parse(readFileSync(resolve(root, rel), 'utf8'));
const scenes = read(process.argv[2] ?? 'src/data/scenes.json');
const people = new Set(read('src/data/people.json').map((p) => p.id));
const eggs = new Set(Object.keys(read('src/data/dialogue.it.json').easterEggs));

const W = 640;
const H = 360;
const SCENES = ['universita', 'giuggiu', 'giardini', 'circe', 'cortile', 'divano'];
const FRIENDS = { universita: 'lollino', giuggiu: 'giuggiu', giardini: 'liscio', circe: 'ros', cortile: 'lara', divano: null };
const MINIGAMES = { universita: 'simon', giuggiu: 'cat-smoke', giardini: 'slackline', circe: 'd20', cortile: 'rhythm', divano: null };
const FACINGS = ['down', 'left', 'right', 'up'];
const PRESETS = {
  particles: ['dust', 'pollen', 'steam', 'sparkle'],
  tween: ['flicker', 'sway', 'pulse'],
  sprite: ['heads-bob']
};
const EXTRA_EGGS = ['extra-1', 'extra-2', 'extra-3'];

const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

function rectOk(where, r) {
  if (r === null || typeof r !== 'object' || !['x', 'y', 'w', 'h'].every((k) => isNum(r[k]))) {
    err(where, 'not a rectangle {x,y,w,h} of numbers');
    return false;
  }
  if (r.w <= 0 || r.h <= 0) err(where, 'w and h must be positive');
  if (r.x < 0 || r.y < 0 || r.x + r.w > W || r.y + r.h > H) err(where, `outside ${W}x${H}: ${JSON.stringify(r)}`);
  return true;
}
// Rectangles overlap or share an edge segment.
const touch = (a, b) => a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

function pointOk(where, p, walk) {
  if (p === null || typeof p !== 'object' || !isNum(p.x) || !isNum(p.y)) return err(where, 'x and y must be numbers');
  if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) err(where, `outside ${W}x${H}`);
  if (p.facing !== undefined && !FACINGS.includes(p.facing)) err(where, `bad facing "${p.facing}"`);
  if (!walk.some((r) => inside(p, r))) err(where, `(${p.x},${p.y}) is not inside any walk rectangle`);
}

function personOk(where, p, walk) {
  if (p === null || typeof p !== 'object') return err(where, 'not an object');
  if (!people.has(p.personId)) err(where, `personId "${p.personId}" is not in people.json`);
  if (!FACINGS.includes(p.facing)) err(where, `bad facing "${p.facing}"`);
  pointOk(where, p, walk);
}

if (!Array.isArray(scenes) || scenes.length !== SCENES.length) err('scenes', `expected ${SCENES.length} scenes`);
const usedEggs = [];

(Array.isArray(scenes) ? scenes : []).forEach((sc, i) => {
  const id = SCENES[i];
  const at = `scenes[${i}] ${sc?.id}`;
  if (sc.id !== id) err(at, `expected id "${id}" at position ${i}`);
  if (sc.background !== `bg-${sc.id}`) err(at, `background must be "bg-${sc.id}"`);
  if (typeof sc.title !== 'string' || sc.title.trim() === '') err(at, 'title missing');
  if (sc.music !== sc.id) err(at, `music must be the track "${sc.id}"`);
  if (sc.minigame !== MINIGAMES[id]) err(at, `minigame must be ${JSON.stringify(MINIGAMES[id])}`);
  if (id === 'circe' ? sc.minigame2 !== 'mash' : sc.minigame2 !== undefined) err(at, 'minigame2 is "mash" in circe and absent elsewhere');

  const walk = Array.isArray(sc.walk) ? sc.walk.filter((r, j) => rectOk(`${at} walk[${j}]`, r)) : [];
  if (walk.length === 0) return err(at, 'walk must hold at least one rectangle');

  // One connected walkable area: flood over rectangles that overlap or touch.
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const a = queue.pop();
    walk.forEach((r, j) => {
      if (!seen.has(j) && touch(walk[a], r)) (seen.add(j), queue.push(j));
    });
  }
  if (seen.size !== walk.length) err(at, `walk rectangles are not one connected area (${seen.size} of ${walk.length} reachable from the first)`);

  pointOk(`${at} spawn`, sc.spawn, walk);

  if (id === 'divano') {
    if (sc.door !== null) err(at, 'door must be null in divano');
  } else if (rectOk(`${at} door`, sc.door)) {
    if (!walk.some((r) => touch(r, sc.door))) err(at, 'door does not touch any walk rectangle');
  }

  if (FRIENDS[id] === null) {
    if (sc.friend !== null) err(at, 'friend must be null in divano');
  } else {
    personOk(`${at} friend`, sc.friend, walk);
    if (sc.friend?.personId !== FRIENDS[id]) err(at, `friend must be "${FRIENDS[id]}"`);
  }
  if (id === 'circe') {
    personOk(`${at} friend2`, sc.friend2, walk);
    if (sc.friend2?.personId !== 'giusy') err(at, 'friend2 must be "giusy"');
  } else if (sc.friend2 !== undefined) err(at, 'friend2 only exists in circe');

  if (!Array.isArray(sc.extras)) err(at, 'extras must be an array');
  (sc.extras ?? []).forEach((e, j) => {
    const w = `${at} extras[${j}]`;
    personOk(w, e, walk);
    if (e.egg !== undefined) {
      usedEggs.push(e.egg);
      if (!eggs.has(e.egg)) err(w, `egg "${e.egg}" is not in dialogue.it.json easterEggs`);
    }
    if (e.egg === undefined && e.intro !== true && e.sfx === undefined) err(w, 'an extra needs one of egg, intro or sfx');
    if (e.tint !== undefined && !/^#[0-9a-f]{6}$/i.test(e.tint)) err(w, 'tint must be #rrggbb');
  });

  if (!Array.isArray(sc.ambient)) err(at, 'ambient must be an array');
  (sc.ambient ?? []).forEach((a, j) => {
    const w = `${at} ambient[${j}]`;
    if (!PRESETS[a.type]) return err(w, `bad type "${a.type}"`);
    if (!PRESETS[a.type].includes(a.preset)) err(w, `bad preset "${a.preset}" for ${a.type}`);
    rectOk(`${w} area`, a.area);
    if (a.alpha !== undefined && !(Array.isArray(a.alpha) && a.alpha.length === 2 && a.alpha.every((n) => isNum(n) && n >= 0 && n <= 1))) err(w, 'alpha must be [min,max] within 0..1');
  });
});

for (const egg of EXTRA_EGGS) {
  const n = usedEggs.filter((e) => e === egg).length;
  if (n !== 1) err('extras', `egg "${egg}" is used ${n} times, expected once`);
}

if (errors.length) {
  console.error(errors.slice(0, 20).join('\n'));
  if (errors.length > 20) console.error(`... and ${errors.length - 20} more`);
  console.error(`FAIL scenes: ${errors.length} problem(s)`);
  process.exit(1);
}
console.log(`PASS scenes: ${scenes.length} scenes, all positions valid`);
