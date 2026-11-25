// Validates src/data/scenes.json against the contract (see docs/scenes.md).
// Standard library only. Quiet: prints one PASS line, or up to 20 errors and exits 1.
import { existsSync, readFileSync } from 'node:fs';
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
const EXTRA_EGGS = ['extra-1', 'extra-2', 'extra-3', 'extra-rosanna']; // extra-genitori goes into circe once the rebuilt room is in

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

// Tile-world scenes (`map`): positions come from the map's named points (src/data/maps/<map>.json), checked on its collision grid.
const MAP_LAYERS = ['ground', 'walls', 'below', 'objects', 'above'];
const tilesInfo = JSON.parse(readFileSync(resolve(root, 'public/assets/tiles/tiles.json'), 'utf8'));

function mapScene(at, sc, id) {
  if (typeof sc.map !== 'string' || sc.map !== sc.id) return err(at, `map must be "${sc.id}" (src/data/maps/${sc.id}.json)`);
  let map;
  try {
    map = JSON.parse(readFileSync(resolve(root, `src/data/maps/${sc.map}.json`), 'utf8'));
  } catch (e) {
    return err(at, `cannot read map ${sc.map}: ${e.message}`);
  }
  const w = `${at} map`;
  const { width, height } = map;
  if (!Number.isInteger(width) || !Number.isInteger(height) || map.tileSize !== 32) return err(w, 'width, height and tileSize 32 are required');
  if (width * 32 <= W || height * 32 <= H) err(w, `a tile world must be bigger than the ${W}x${H} screen so the camera scrolls`);
  const gridOk = (grid, name, max) => {
    if (!Array.isArray(grid) || grid.length !== height || grid.some((r) => !Array.isArray(r) || r.length !== width)) return err(w, `${name} must be ${width}x${height}`), false;
    if (grid.some((r) => r.some((v) => !Number.isInteger(v) || v < 0 || v > max))) return err(w, `${name} holds a value outside 0..${max}`), false;
    return true;
  };
  for (const l of MAP_LAYERS) gridOk(map.layers?.[l], `layer ${l}`, tilesInfo.count - 1);
  if (!gridOk(map.collision, 'collision', 1)) return;
  const free = (x, y) => x >= 0 && y >= 0 && x < width && y < height && map.collision[y][x] === 0;
  const pt = (name) => map.points?.[name];
  const spawn = pt('spawn');
  if (!spawn || !free(spawn.x, spawn.y)) return err(w, 'point "spawn" is missing or on a blocked tile');
  // BFS over walkable tiles from the spawn
  const seen = new Set([`${spawn.x},${spawn.y}`]);
  const queue = [[spawn.x, spawn.y]];
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (free(x + dx, y + dy) && !seen.has(k)) (seen.add(k), queue.push([x + dx, y + dy]));
    }
  }
  const door = pt('door');
  if (!door || !Number.isInteger(door.w) || !Number.isInteger(door.h)) err(w, 'point "door" needs x, y, w, h in tiles');
  else {
    let reach = false;
    for (let y = door.y; y < door.y + door.h; y++) for (let x = door.x; x < door.x + door.w; x++) if (seen.has(`${x},${y}`)) reach = true;
    if (!reach) err(w, 'door is not reachable from the spawn over walkable tiles');
  }
  if (sc.door !== null && sc.door !== undefined && typeof sc.door !== 'object') err(at, 'door comes from the map point "door"; scenes.json door must be null');
  if (sc.exit !== undefined && sc.exit !== 'edge') err(at, 'exit is "edge" when present');
  // litter bins (x, y are the feet in pixels): a drawn one stands on a free tile next to a wall, away from the people and the door;
  // one the map already draws (draw: false) sits on a blocked tile; either way a walkable tile reachable from the spawn is next to it
  if (!Array.isArray(sc.bins) || sc.bins.length === 0) err(at, 'bins must list at least one litter bin');
  (sc.bins ?? []).forEach((b, j) => {
    const where = `${at} bins[${j}]`;
    if (!isNum(b?.x) || !isNum(b?.y)) return err(where, 'x and y must be numbers (pixels)');
    const bx = Math.floor(b.x / 32);
    const by = Math.floor((b.y - 1) / 32);
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [bx + dx, by + dy]);
    if (b.draw === false) {
      if (free(bx, by)) err(where, `draw is false but (${bx},${by}) is a free tile: the map draws no bin there`);
    } else {
      if (!free(bx, by)) err(where, `(${bx},${by}) is a blocked tile`);
      if (!near.some(([x, y]) => !free(x, y))) err(where, `(${bx},${by}) is not next to a wall`);
      const tooClose = [spawn, door, ...Object.values(map.points ?? {})].some((p) => p && Math.abs(p.x - bx) + Math.abs(p.y - by) < 2);
      if (tooClose) err(where, `(${bx},${by}) is right next to the spawn, the door or a person`);
    }
    if (!near.some(([x, y]) => seen.has(`${x},${y}`))) err(where, `no tile next to (${bx},${by}) can be reached from the spawn`);
  });

  const person = (where, p, mustReach) => {
    if (p === null || typeof p !== 'object') return err(where, 'not an object');
    if (!people.has(p.personId)) err(where, `personId "${p.personId}" is not in people.json`);
    if (!FACINGS.includes(p.facing)) err(where, `bad facing "${p.facing}"`);
    const q = pt(p.at);
    if (!q) return err(where, `"at" names the point "${p.at}", which the map does not have`);
    if (!free(q.x, q.y)) err(where, `point "${p.at}" (${q.x},${q.y}) is on a blocked tile`);
    else if (mustReach && !seen.has(`${q.x},${q.y}`)) err(where, `point "${p.at}" cannot be reached from the spawn`);
  };
  if (FRIENDS[id] === null) {
    if (sc.friend !== null) err(at, 'friend must be null in divano');
  } else {
    person(`${at} friend`, sc.friend, true);
    if (sc.friend?.personId !== FRIENDS[id]) err(at, `friend must be "${FRIENDS[id]}"`);
  }
  (sc.extras ?? []).forEach((e, j) => {
    const where = `${at} extras[${j}]`;
    person(where, e, e.egg !== undefined);
    if (e.egg !== undefined) {
      usedEggs.push(e.egg);
      if (!eggs.has(e.egg)) err(where, `egg "${e.egg}" is not in dialogue.it.json easterEggs`);
    }
    if (e.egg === undefined && e.intro !== true && e.sfx === undefined) err(where, 'an extra needs one of egg, intro or sfx');
  });
  (map.crowd ?? []).forEach((c, j) => {
    const where = `${w} crowd[${j}]`;
    if (!free(c.x, c.y)) err(where, `(${c.x},${c.y}) is on a blocked tile`);
    if (!FACINGS.includes(c.facing)) err(where, `bad facing "${c.facing}"`);
    if (!existsSync(resolve(root, `public/assets/tiles/${c.sheet}.png`))) err(where, `sheet "${c.sheet}" has no file in public/assets/tiles`);
  });
  (map.lights ?? []).forEach((l, j) => {
    if (![l.x, l.y, l.r, l.period].every(isNum) || l.x < 0 || l.y < 0 || l.x > width * 32 || l.y > height * 32) err(`${w} lights[${j}]`, 'x, y, r, period must be numbers inside the map');
    if (!['steady', 'flicker', 'pulse'].includes(l.kind)) err(`${w} lights[${j}]`, `bad kind "${l.kind}"`);
  });
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

  if (sc.map !== undefined) return mapScene(at, sc, id);

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
