// Small living details of a room, on top of the map's own glows and dust: flickering screens, candle wisps, steam, beams with dust, drifting
// pollen and clouds, birds and butterflies, the night outside a window. Positions come from the map's `lights` and `points`
// (obj_screen, obj_bar, obj_window, window...), so a rebuilt room keeps them. Cheap on purpose: a handful of Phaser emitters, images and
// tweens per room, and at most five pixelfx critters (the cap is 12 effects per scene). Everything is owned by the scene and dies with it.
// Depths: the room draws its floor at -10, objects and characters by y, the `above` layer at 700, the night overlay (multiply) at 750 and
// its glows at 760. FLOOR sits on the floor under everything, LIT over the characters but under the overlay (the room's light tints it),
// GLOW over the overlay (it shines by itself), FRONT over everything but the dialogue (900).
import Phaser from 'phaser';
import { fx } from '../fx';
import { TILE, type LightDef, type MapData, type MapPoint } from '../flow/tileMap';

const FLOOR = -9;
const LIT = 745;
const GLOW = 765;
const FRONT = 780;

type Rect = { x: number; y: number; w: number; h: number };
type Zone = Phaser.Types.GameObjects.Particles.RandomZoneSource;
/** A light cone or shaft: the centre and width at its start (x0, y0, w0) and at its end (x1, y1, w1). */
interface Beam {
    x0: number;
    y0: number;
    w0: number;
    x1: number;
    y1: number;
    w1: number;
}

const rectOf = (p: MapPoint): Rect => ({ x: p.x * TILE, y: p.y * TILE, w: (p.w ?? 1) * TILE, h: (p.h ?? 1) * TILE });
const rgb = (hex: string): number => parseInt(hex.slice(1), 16);
const isBlue = (l: LightDef): boolean => (rgb(l.color) & 255) > ((rgb(l.color) >> 16) & 255) + 60;
const CANDLE = '#ffb060'; // the colour of every candle light in the maps (pool 70 or less; the bar lights are bigger)

// ---- textures, made once per game ----

function texture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): string {
    if (!scene.textures.exists(key)) {
        const tex = scene.textures.createCanvas(key, w, h)!;
        draw(tex.getContext());
        tex.refresh();
    }
    return key;
}

const dot = (scene: Phaser.Scene): string =>
    texture(scene, 'amb-dot', 2, 2, (c) => {
        c.fillStyle = '#fff';
        c.fillRect(0, 0, 2, 2);
    });
const leaf = (scene: Phaser.Scene): string =>
    texture(scene, 'amb-leaf', 4, 3, (c) => {
        c.fillStyle = '#fff';
        c.fillRect(0, 1, 4, 1);
        c.fillRect(1, 0, 2, 3);
    });
const glow = (scene: Phaser.Scene): string =>
    texture(scene, 'amb-glow', 64, 64, (c) => {
        const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, 64, 64);
    });
const cloud = (scene: Phaser.Scene): string =>
    texture(scene, 'amb-cloud', 96, 48, (c) => {
        // a few overlapping soft blobs: a cloud's shadow on the grass
        for (const [x, y, r] of [[30, 26, 20], [50, 22, 22], [68, 28, 16], [44, 30, 18]]) {
            const g = c.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, 'rgba(0,0,0,0.55)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle = g;
            c.fillRect(0, 0, 96, 48);
        }
    });

/** A soft-edged light cone as an image: brightest at its start, fading towards its end (the edges are blurred with a canvas shadow). */
function beamImage(scene: Phaser.Scene, key: string, b: Beam, color: string, a0: number, a1: number, blend: Phaser.BlendModes, depth: number): void {
    const pad = 10;
    const hw = Math.max(b.w0, b.w1) / 2;
    const left = Math.min(b.x0, b.x1) - hw - pad;
    const top = Math.min(b.y0, b.y1) - pad;
    const w = Math.ceil(Math.abs(b.x1 - b.x0) + 2 * hw + 2 * pad);
    const h = Math.ceil(Math.abs(b.y1 - b.y0) + 2 * pad);
    texture(scene, key, w, h, (c) => {
        const g = c.createLinearGradient(0, b.y0 - top, 0, b.y1 - top);
        g.addColorStop(0, `rgba(255,255,255,${a0})`);
        g.addColorStop(1, `rgba(255,255,255,${a1})`);
        c.fillStyle = g;
        c.shadowColor = '#fff';
        c.shadowBlur = 8;
        c.shadowOffsetX = w; // the polygon is drawn off the canvas, only its blurred shadow lands inside
        c.beginPath();
        c.moveTo(b.x0 - b.w0 / 2 - left - w, b.y0 - top);
        c.lineTo(b.x0 + b.w0 / 2 - left - w, b.y0 - top);
        c.lineTo(b.x1 + b.w1 / 2 - left - w, b.y1 - top);
        c.lineTo(b.x1 - b.w1 / 2 - left - w, b.y1 - top);
        c.closePath();
        c.fill();
    });
    scene.add.image(left, top, key).setOrigin(0).setTint(rgb(color)).setBlendMode(blend).setDepth(depth);
}

// ---- small helpers ----

/** A random point inside a light cone. */
const inBeam = (b: Beam): Zone => ({
    getRandomPoint: (p) => {
        const t = Math.random();
        p.x = Phaser.Math.Linear(b.x0, b.x1, t) + (Math.random() - 0.5) * Phaser.Math.Linear(b.w0, b.w1, t);
        p.y = Phaser.Math.Linear(b.y0, b.y1, t);
    }
});
const inRect = (r: Rect): Zone => ({
    getRandomPoint: (p) => {
        p.x = r.x + Math.random() * r.w;
        p.y = r.y + Math.random() * r.h;
    }
});

/** Dust motes: tiny additive dots that fade in and out while they drift in a zone. `over` replaces any of the settings. */
function motes(scene: Phaser.Scene, zone: Zone, color: number, depth: number, frequency: number, lifespan: number, alpha = 0.55, over: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {}): void {
    scene.add
        .particles(0, 0, dot(scene), {
            emitZone: { type: 'random', source: zone },
            tint: color,
            alpha: { values: [0, alpha, 0], interpolation: 'linear' },
            speedX: { min: -4, max: 4 },
            speedY: { min: -6, max: 2 },
            lifespan: { min: lifespan * 0.7, max: lifespan },
            frequency,
            blendMode: 'ADD',
            ...over
        })
        .setDepth(depth);
}

/** A light that jitters like a screen: a random brightness every 60 to 220 ms, and a random pick of tints. */
function jitter(scene: Phaser.Scene, img: Phaser.GameObjects.Image, lo: number, hi: number, tints: number[]): void {
    const next = (): void => {
        img.setAlpha(Phaser.Math.FloatBetween(lo, hi)).setTint(Phaser.Utils.Array.GetRandom(tints));
        scene.time.delayedCall(Phaser.Math.Between(60, 220), next);
    };
    scene.time.delayedCall(Phaser.Math.Between(0, 200), next);
}

const glowAt = (scene: Phaser.Scene, x: number, y: number, w: number, h: number, depth: number): Phaser.GameObjects.Image =>
    scene.add.image(x, y, glow(scene)).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth).setDisplaySize(w, h);

/** Moves something along a looping path of its own, once a frame while the scene runs. */
function wander(scene: Phaser.Scene, ms: number, step: (t: number) => void): void {
    scene.tweens.addCounter({ from: 0, to: 1, duration: ms, repeat: -1, onUpdate: (tw) => step(tw.getValue() ?? 0) });
}

// ---- rules that read the map's lights ----

function lightLife(scene: Phaser.Scene, lights: LightDef[]): void {
    // blue lights are screens: they flicker like one
    for (const l of lights.filter((l) => l.kind === 'steady' && isBlue(l))) {
        const r = l.r > 0 ? l.r * 1.6 : Math.min((l.pool ?? 0) * 0.45, 30);
        jitter(scene, glowAt(scene, l.x, l.y, r * 2, r * 2, GLOW), 0.12, 0.4, [rgb(l.color), 0xbfe0ff, 0x7aa8ff]);
    }
    // a single pulsing light is a TV: its glow flickers, and so does the light it throws on the floor in front of it
    const pulses = lights.filter((l) => l.kind === 'pulse');
    if (pulses.length === 1) {
        const l = pulses[0];
        const tints = [rgb(l.color), 0x8ab0ff, 0xff8ad0, 0xffffff];
        jitter(scene, glowAt(scene, l.x, l.y, l.r * 3.4, l.r * 2.4, GLOW), 0.1, 0.34, tints);
        jitter(scene, glowAt(scene, l.x, l.y + 64, 190, 84, FLOOR), 0.08, 0.3, tints);
    }
    // candles: a thin wisp of smoke from the flame
    const candles = lights.filter((l) => l.color.toLowerCase() === CANDLE && (l.pool ?? 0) <= 70);
    if (candles.length) {
        scene.add
            .particles(0, 0, glow(scene), {
                emitZone: { type: 'random', source: { getRandomPoint: (p) => { const c = Phaser.Utils.Array.GetRandom(candles); p.x = c.x; p.y = c.y - 4; } } },
                tint: 0xd8dce8,
                alpha: { start: 0.6, end: 0 },
                scale: { start: 0.07, end: 0.18 },
                speedX: { min: -3, max: 3 },
                speedY: { min: -14, max: -8 },
                lifespan: 1700,
                frequency: 500 / candles.length
            })
            .setDepth(LIT);
    }
}

// ---- per scene ----

/** Steam over the cups of the cortile bar, spread along the bar's length. */
function barSteam(scene: Phaser.Scene, bar: Rect): void {
    for (const f of [0.18, 0.5, 0.82]) {
        scene.add
            .particles(bar.x + bar.w / 2, bar.y + bar.h * f, glow(scene), {
                tint: 0xffffff,
                alpha: { start: 0.85, end: 0 },
                scale: { start: 0.1, end: 0.28 },
                speedX: { min: -3, max: 3 },
                speedY: { min: -16, max: -9 },
                lifespan: 1500,
                frequency: 230 + f * 120
            })
            .setDepth(LIT);
    }
}

/** The cinema: the projector's cone from the back of the hall to the screen, with dust, and a flickering screen. */
function cinema(scene: Phaser.Scene, map: MapData): void {
    const s = rectOf(map.points.obj_screen);
    const pic = { x: s.x + 14, y: s.y + 12, w: s.w - 28, h: s.h - 24 }; // the lit picture inside the screen's frame
    const cone: Beam = { x0: s.x + s.w / 2, y0: map.height * TILE - 18, w0: 6, x1: pic.x + pic.w / 2, y1: pic.y + pic.h, w1: pic.w };
    beamImage(scene, 'amb-cone-cinema', cone, '#cfe4ff', 0.22, 0.1, Phaser.BlendModes.ADD, LIT);
    motes(scene, inBeam(cone), 0xdfeaff, LIT, 240, 5200);
    const screen = scene.add.image(pic.x, pic.y, dot(scene)).setOrigin(0).setDisplaySize(pic.w, pic.h).setBlendMode(Phaser.BlendModes.ADD).setDepth(GLOW);
    jitter(scene, screen, 0, 0.16, [0xcfe4ff, 0xffe8c0, 0xb0c8ff]);
}

/** The flat: three slanted shafts of daylight through the window panes, onto the floor, with dust floating in them. */
function windowShafts(scene: Phaser.Scene, win: Rect): void {
    const paneW = win.w / 3;
    for (let i = 0; i < 3; i++) {
        const cx = win.x + paneW * (i + 0.5);
        const shaft: Beam = { x0: cx, y0: win.y + win.h, w0: paneW - 10, x1: cx + 150, y1: win.y + win.h + 210, w1: paneW + 6 };
        beamImage(scene, `amb-shaft-${i}`, shaft, '#fff0c8', 0.38, 0.14, Phaser.BlendModes.ADD, FLOOR);
        motes(scene, inBeam(shaft), 0xfff4d0, LIT, 700, 6000, 0.8);
    }
}

/** The park: shadows of clouds crossing the grass, drifting pollen and leaves, two butterflies, and now and then a bird. */
function park(scene: Phaser.Scene, map: MapData): void {
    const W = map.width * TILE;
    const H = map.height * TILE;
    const air: Rect = { x: 0, y: 110, w: W, h: H - 110 };
    // pollen: pale specks on the wind (normal blend: additive light would vanish on the bright grass)
    motes(scene, inRect(air), 0xfff2b0, FRONT, 420, 8000, 0.9, { blendMode: 'NORMAL', speedX: { min: 8, max: 20 }, speedY: { min: -5, max: 4 } });
    scene.add
        .particles(0, 0, leaf(scene), {
            emitZone: { type: 'random', source: inRect(air) },
            tint: [0x6fa83a, 0x9ac04a, 0xc89a3a],
            alpha: { values: [0, 1, 1, 0], interpolation: 'linear' },
            speedX: { min: 12, max: 26 },
            speedY: { min: 4, max: 12 },
            rotate: { min: 0, max: 360 },
            lifespan: 8000,
            frequency: 1500
        })
        .setDepth(FRONT);

    // cloud shadows: slow dark blobs under the objects and the characters, drifting right and wrapping round
    for (const [i, scale] of [3, 4.2, 2.6].entries()) {
        const img = scene.add.image(0, (H / 4) * (i + 0.7), cloud(scene)).setScale(scale).setAlpha(0.28).setDepth(FLOOR);
        const speed = 7 + i * 2;
        const run = (from: number): void => {
            const to = W + img.displayWidth;
            scene.tweens.add({ targets: img, x: to, duration: ((to - from) / speed) * 1000, ease: 'Linear', onComplete: () => {
                    img.x = -img.displayWidth;
                    run(img.x);
                } });
        };
        img.x = Math.round((W / 3) * i);
        run(img.x);
    }

    // butterflies on loops of their own, over the open grass
    for (const [cx, cy, ax, ay, ms] of [[430, 330, 110, 46, 13000], [640, 260, 80, 36, 17000]]) {
        const b = fx.play(scene, 'critters/butterfly', { x: cx, y: cy, layer: 'front', depth: FRONT - 5, seed: Math.round(cx) });
        wander(scene, ms, (t) => b.moveTo(Math.round(cx + ax * Math.sin(t * Math.PI * 2)), Math.round(cy + ay * Math.sin(t * Math.PI * 4))));
    }

    // a bird crosses the top of the park every 10 to 18 seconds
    const bird = (): void => {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const y = Phaser.Math.Between(40, 150);
        const x0 = dir > 0 ? -60 : W + 60;
        const b = fx.play(scene, 'critters/bird', { x: x0, y, layer: 'front', depth: FRONT, flip: dir < 0 });
        scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 7000,
            onUpdate: (tw) => {
                const t = tw.getValue() ?? 0;
                b.moveTo(Math.round(x0 + dir * (W + 120) * t), Math.round(y + 14 * Math.sin(t * 9)));
            },
            onComplete: () => b.destroy()
        });
        scene.time.delayedCall(Phaser.Math.Between(10000, 18000), bird);
    };
    scene.time.delayedCall(Phaser.Math.Between(2500, 5000), bird);
}

/** The night behind the glass door: a moon with its glow, and a few fireflies. */
function nightWindow(scene: Phaser.Scene, win: Rect): void {
    const glass: Rect = { x: win.x + win.w * 0.45, y: win.y + win.h * 0.1, w: win.w * 0.5, h: win.h * 0.85 };
    const moon = { x: glass.x + glass.w * 0.7, y: glass.y + 8 };
    scene.add.circle(moon.x, moon.y, 3, 0xf4f0d8).setDepth(GLOW);
    const halo = glowAt(scene, moon.x, moon.y, 44, 44, GLOW).setTint(0xcfd8ff).setAlpha(0.45);
    scene.tweens.add({ targets: halo, alpha: 0.7, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    // fireflies
    motes(scene, inRect({ ...glass, y: glass.y + glass.h * 0.35, h: glass.h * 0.65 }), 0xd6ff5a, GLOW + 1, 650, 3600, 1, {
        alpha: { values: [0, 1, 0.3, 1, 0], interpolation: 'linear' },
        speedX: { min: -5, max: 5 },
        speedY: { min: -5, max: 3 },
        lifespan: 3600,
        maxAliveParticles: 6
    });
}

/** Starts the living details of a room. Called once from startAmbient. */
export function startLife(scene: Phaser.Scene, sceneId: string, map: MapData | undefined): void {
    if (!map) return;
    lightLife(scene, map.lights);
    const p = map.points;
    if (sceneId === 'cortile' && p.obj_bar) barSteam(scene, rectOf(p.obj_bar));
    if (sceneId === 'universita' && p.obj_screen) cinema(scene, map);
    if (sceneId === 'giuggiu' && p.obj_window) windowShafts(scene, rectOf(p.obj_window));
    if (sceneId === 'giardini') park(scene, map);
    if (sceneId === 'divano' && p.window) nightWindow(scene, rectOf(p.window));
}
