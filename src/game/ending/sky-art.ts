// The pictures of the skydive scene, drawn in code like art.ts: whole pixels only (no arcs, paths or anti-aliasing). Everything is drawn at one art
// pixel per texel; the scene shows it at SKY_SCALE (the far clouds at 1), so the plane, the canopies and the people share one pixel size.
import Phaser from 'phaser';
import { rect, seeded } from './art';

export const SKY_SCALE = 2;
const LINE = '#1c2236';

type Ctx = CanvasRenderingContext2D;

/** The three who jump. `top` and `shoulder` are the rows of the standing frame of their `char-<id>` sheet where the head starts and the shoulders are. */
export const JUMPERS = {
    liscio: { top: 1, shoulder: 15, skin: '#dba577', shirt: ['#a6aab3', '#c9cdd6', '#767a89'], shorts: '#b79d6b', shoe: '#f4f1ea', dress: false },
    ric: { top: 0, shoulder: 14, skin: '#dba577', shirt: ['#8c2a3a', '#b3424c', '#5e1b2e'], shorts: '#b79d6b', shoe: '#3b3f4c', dress: false },
    lara: { top: 3, shoulder: 18, skin: '#f4cba8', shirt: ['#f4f1ea', '#ffffff', '#cbbfb4'], shorts: '#f4f1ea', shoe: '#e7dcc0', dress: true }
} as const;
export type JumperId = keyof typeof JUMPERS;

/** The part of the 32 x 32 down-facing standing frame that holds a head. */
const HEAD = { x: 6, w: 20, h: 15 };
/** The frame of a `char-<id>` sheet that stands facing the viewer. */
export const STAND_FRAME = 1;

/** The plane faces right. `windows` are the top left corners of the three head windows (20 x 16); `door` is the middle of the jump door. */
export const PLANE = {
    w: 148,
    h: 60,
    windows: [{ x: 51, y: 25 }, { x: 74, y: 25 }, { x: 97, y: 25 }],
    door: { x: 37, y: 34 },
    prop: { x: 141, y: 34 }
} as const;

/** The size of a canopy with its lines, and the row where the lines meet the jumper's shoulders. */
export const CHUTE = { w: 54, h: 43, shoulderY: 42 } as const;
/** The landscape: it covers the screen width and its lower edge sits on the lower edge of the screen. */
export const GROUND = { w: 320, h: 130 } as const;
export const CLOUD_SHAPES = 3;

/** Creates a canvas texture once; `draw` paints it. Returns the key. */
function texture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): string {
    if (scene.textures.exists(key)) return key;
    const tex = scene.textures.createCanvas(key, w, h)!;
    draw(tex.context);
    tex.refresh();
    return key;
}

/** A one pixel outline around everything painted so far. */
function outline(ctx: Ctx, color = LINE): void {
    const { width: w, height: h } = ctx.canvas;
    const a = ctx.getImageData(0, 0, w, h).data;
    const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] > 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) rect(ctx, color, x, y, 1, 1);
}

/** A straight line of square dots, `size` px wide. */
function line(ctx: Ctx, color: string, x0: number, y0: number, x1: number, y1: number, size = 1): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) rect(ctx, color, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), size, size);
}

/** Fills row by row between the left and right edge `span` gives for each row from `y0` to `y1`. */
function rows(ctx: Ctx, color: string, y0: number, y1: number, span: (y: number) => [number, number]): void {
    for (let y = y0; y <= y1; y++) {
        const [a, b] = span(y).map(Math.round);
        if (b >= a) rect(ctx, color, a, y, b - a + 1, 1);
    }
}

function disc(ctx: Ctx, color: string, cx: number, cy: number, r: number): void {
    rows(ctx, color, cy - r, cy + r, (y) => {
        const half = Math.sqrt(r * r + r - (y - cy) ** 2);
        return [cx - half, cx + half];
    });
}

const sheet = (scene: Phaser.Scene, id: JumperId): CanvasImageSource => scene.textures.get(`char-${id}`).getSourceImage() as HTMLImageElement;

/** Copies the head of a character's standing frame (column 1 of the 3 x 4 sheet) to (x, y). */
function drawHead(scene: Phaser.Scene, ctx: Ctx, id: JumperId, x: number, y: number): void {
    ctx.drawImage(sheet(scene, id), 32 + HEAD.x, JUMPERS[id].top, HEAD.w, HEAD.h, x, y, HEAD.w, HEAD.h);
}

/** A head to put in a window of the plane (20 x 16, resting on the lower edge). */
export function headTexture(scene: Phaser.Scene, id: JumperId): string {
    return texture(scene, `sky-head-${id}`, HEAD.w, HEAD.h + 1, (ctx) => drawHead(scene, ctx, id, 0, 1));
}

/** Belly down in free fall, seen from below: arms and legs spread, the head of the sheet on top. */
export function diverTexture(scene: Phaser.Scene, id: JumperId): string {
    const p = JUMPERS[id];
    return texture(scene, `sky-diver-${id}`, 46, 42, (ctx) => {
        const [base, light, dark] = p.shirt;
        for (const side of [-1, 1]) {
            const at = (dx: number) => 22 + side * dx;
            line(ctx, base, at(4), 18, at(11), 19, 3); // upper arm, out
            line(ctx, p.skin, at(12), 19, at(18), 11, 3); // forearm, up
            disc(ctx, p.skin, at(19) + 1, 9, 2);
            line(ctx, p.shorts, at(3), 28, at(8), 31, 4); // thigh
            line(ctx, p.skin, at(8), 31, at(13), 36, 3);
            rect(ctx, p.shoe, at(14) - 1, 36, 5, 3);
        }
        rows(ctx, base, 15, 29, (y) => (p.dress && y > 23 ? [17 - (y - 23), 28 + (y - 23)] : [17, 28]));
        rect(ctx, light, 17, 15, 3, 12);
        rect(ctx, dark, 26, 17, 3, 11);
        if (!p.dress) rect(ctx, p.shorts, 17, 27, 12, 3);
        outline(ctx);
        drawHead(scene, ctx, id, 13, 22 - p.shoulder + p.top);
    });
}

// 5 x 7 digits for the "30" on Ric's canopy.
const DIGITS = [
    ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    ['01110', '10001', '10001', '10001', '10001', '10001', '01110']
];

/** An open canopy in the colour of the shirt, seen from the front, with its suspension lines down to the shoulders. Ric's says "30". */
export function chuteTexture(scene: Phaser.Scene, id: JumperId): string {
    const [base, light, dark] = JUMPERS[id].shirt;
    return texture(scene, `sky-chute-${id}`, CHUTE.w, CHUTE.h, (ctx) => {
        const cx = CHUTE.w / 2;
        const half = (y: number) => 25.5 * Math.sqrt(1 - ((20 - y) / 20.5) ** 2);
        // the lines first, so the fabric covers their upper ends
        for (const [x, side] of [[2, -1], [12, -1], [21, -1], [33, 1], [42, 1], [52, 1]]) line(ctx, '#3a3f58', x, 18, cx + side * 7, CHUTE.shoulderY);
        const cloth = document.createElement('canvas');
        cloth.width = CHUTE.w;
        cloth.height = CHUTE.h;
        const c = cloth.getContext('2d')!;
        for (let x = 1; x < CHUTE.w - 1; x++) {
            // five scallops along the lower edge
            const bottom = 22 - Math.round(3 * Math.abs(Math.sin((Math.PI * (x - 1)) / 10.4)));
            for (let y = 1; y <= bottom; y++) {
                const u = (x + 0.5 - cx) / half(Math.min(y, 20));
                if (Math.abs(u) > 1) continue;
                const gore = Math.min(4, Math.floor(((u + 1) / 2) * 5));
                const color = y >= bottom - 1 ? dark : gore % 2 ? light : gore === 4 ? dark : base;
                rect(c, color, x, y, 1, 1);
            }
        }
        for (let y = 3; y < 9; y++) rect(c, '#ffffff', Math.round(cx - half(y) * 0.75), y, 2, 1); // a glint
        outline(c);
        ctx.drawImage(cloth, 0, 0);
        if (id !== 'ric') return;
        const digits = (color: string, grow: number) =>
            DIGITS.forEach((d, i) =>
                d.forEach((row, r) => [...row].forEach((bit, col) => bit === '1' && rect(ctx, color, cx - 11 + i * 12 + col * 2 - grow, 4 + r * 2 - grow, 2 + grow * 2, 2 + grow * 2)))
            );
        digits('#2a1408', 1);
        digits('#ffd34a', 0);
    });
}

/** A canopy collapsed flat on the grass, with its slack lines trailing to the left, toward its owner. */
export function heapTexture(scene: Phaser.Scene, id: JumperId): string {
    const [base, light, dark] = JUMPERS[id].shirt;
    return texture(scene, `sky-heap-${id}`, 46, 11, (ctx) => {
        // low soft folds, then the gores as slanted stripes and a few creases
        const top = (x: number) => 9 - 4.5 * Math.sin((Math.PI * (x - 11)) / 34) - Math.sin((x - 12) / 2.2);
        for (let x = 12; x <= 43; x++) {
            for (let y = Math.round(top(x)); y <= 9; y++) rect(ctx, y === 9 ? dark : [base, light, base][Math.floor((x + y * 2) / 5) % 3], x, y, 1, 1);
        }
        for (const [x, y] of [[17, 8], [25, 6], [33, 7]]) line(ctx, dark, x, y, x + 6, y + 1);
        outline(ctx);
        line(ctx, '#2c3a30', 11, 8, 1, 5);
        line(ctx, '#2c3a30', 11, 9, 1, 9);
    });
}

/** The jump plane: white with a red stripe, a high wing, three windows with the heads inside, and the rear door, shut or slid open. */
export function planeTexture(scene: Phaser.Scene, open: boolean): string {
    return texture(scene, open ? 'sky-plane-open' : 'sky-plane', PLANE.w, PLANE.h, (ctx) => {
        const white = '#f4f1ea';
        const shade = '#c3c9e0';
        const red = '#c8362f';
        // the tail fin, swept back
        rows(ctx, red, 4, 28, (y) => [3 + (y - 4) * 0.15, 14 + (y - 4) * 0.8]);
        rows(ctx, white, 11, 14, (y) => [3 + (y - 4) * 0.15, 14 + (y - 4) * 0.8]);
        // the fuselage: the thin tail grows into the cabin, then the rounded nose
        const top = (x: number) => (x < 30 ? 28 - ((x - 4) / 26) * 6 : x < 120 ? 22 : 22 + ((x - 120) / 18) ** 2 * 8);
        const bottom = (x: number) => (x < 40 ? 34 + ((x - 4) / 36) * 12 : x < 122 ? 46 : 46 - ((x - 122) / 16) ** 2 * 7);
        for (let x = 4; x <= 138; x++) {
            const a = Math.round(top(x));
            const b = Math.round(bottom(x));
            rect(ctx, white, x, a, 1, b - a + 1);
            rect(ctx, shade, x, b - 2, 1, 3);
            rect(ctx, red, x, b - 6, 1, 3);
        }
        rows(ctx, red, 30, 33, (y) => [1, 26 - (y - 30) * 2]); // the tail plane
        // the high wing along the cabin roof: a rounded leading edge to the right, thinning to the trailing edge
        rows(ctx, red, 16, 22, (y) => [58 - (y - 16) * 2, 112 + (y < 19 ? (y - 16) * 2 : (22 - y) * 2)]);
        rect(ctx, '#e8665a', 60, 17, 51, 1);
        rect(ctx, shade, 50, 21, 62, 2);
        // fixed landing gear
        for (const x of [62, 112]) {
            line(ctx, '#767a89', x, 46, x + 3, 52, 2);
            disc(ctx, '#2b2f3c', x + 4, 54, 4);
            disc(ctx, '#a6aab3', x + 4, 54, 1);
        }
        // the spinner
        rows(ctx, '#a6aab3', 31, 37, (y) => [138, 145 - Math.abs(y - 34) * 1.6]);
        outline(ctx);
        // the three windows, framed, with the dim cabin behind the heads
        for (const w of PLANE.windows) {
            rect(ctx, LINE, w.x - 1, w.y - 1, 22, 18);
            rect(ctx, '#4a6a9c', w.x, w.y, 20, 16);
            rect(ctx, '#6f95c4', w.x, w.y, 20, 3);
        }
        // the cockpit glass
        rows(ctx, LINE, 24, 33, (y) => [120, 129 + (y - 24)]);
        rows(ctx, '#8fd0f0', 25, 32, (y) => [121, 128 + (y - 24)]);
        line(ctx, '#e8f8ff', 123, 31, 128, 26, 1);
        // the door
        rect(ctx, LINE, 29, 24, 17, 20);
        if (open) {
            rect(ctx, '#232a42', 30, 25, 15, 18);
            rect(ctx, '#39425f', 30, 39, 15, 4);
            rect(ctx, shade, 30, 25, 15, 3); // the door rolled up at the top of the opening
            rect(ctx, white, 30, 25, 15, 1);
        } else {
            rect(ctx, white, 30, 25, 15, 18);
            rect(ctx, shade, 30, 37, 15, 6);
            rect(ctx, '#4a6a9c', 33, 28, 9, 6);
            rect(ctx, LINE, 40, 36, 3, 1);
        }
    });
}

/** The three frames of the spinning propeller: the blade across, foreshortened, and a faint blur. */
export function propTextures(scene: Phaser.Scene): string[] {
    return [0, 1, 2].map((i) =>
        texture(scene, `sky-prop-${i}`, 7, 40, (ctx) => {
            if (i === 2) {
                rect(ctx, 'rgba(60,70,90,0.28)', 1, 2, 5, 36);
                rect(ctx, 'rgba(255,255,255,0.45)', 3, 6, 1, 28);
                return;
            }
            const half = i === 0 ? 19 : 11;
            rows(ctx, '#3b3f4c', 20 - half, 20 + half, (y) => (Math.abs(y - 20) > half - 3 ? [3, 4] : [2, 4]));
            rect(ctx, '#ffd34a', 2, 20 - half, 3, 3);
            rect(ctx, '#ffd34a', 2, 18 + half, 3, 3);
        })
    );
}

/** A thin streak of wind for the free fall. */
export function streakTexture(scene: Phaser.Scene): string {
    return texture(scene, 'sky-streak', 1, 14, (ctx) => {
        rect(ctx, 'rgba(255,255,255,0.9)', 0, 0, 1, 7);
        rect(ctx, 'rgba(255,255,255,0.45)', 0, 7, 1, 7);
    });
}

/** The day sky (320 x 180): flat bands of blue, paler toward the horizon, with two checkered rows between one band and the next. */
export function skyTexture(scene: Phaser.Scene): string {
    const bands = ['#3f78cc', '#4a86d6', '#5896de', '#68a6e4', '#7ab6ea', '#8ec6f0', '#a4d4f4', '#bce2f8', '#d2ecf8'];
    return texture(scene, 'sky-gradient', 320, 180, (ctx) => {
        bands.forEach((color, i) => {
            rect(ctx, color, 0, i * 20, 320, 20);
            if (i === 0) return;
            for (let x = 0; x < 320; x += 2) {
                rect(ctx, color, x, i * 20 - 1, 1, 1);
                rect(ctx, bands[i - 1], x + 1, i * 20, 1, 1);
            }
        });
    });
}

/** Puffy clouds with a flat shaded belly. */
export function cloudTexture(scene: Phaser.Scene, shape: number): string {
    const puffs = [
        [[14, 20, 9], [27, 14, 12], [42, 18, 10], [53, 22, 7]],
        [[12, 21, 8], [24, 18, 10], [37, 12, 11], [50, 20, 9], [62, 23, 6]],
        [[12, 21, 7], [23, 17, 10], [35, 21, 8]]
    ][shape];
    return texture(scene, `sky-cloud-${shape}`, 72, 32, (ctx) => {
        const paint = (color: string, shrink: number, lift: number) => {
            for (const [x, y, r] of puffs) disc(ctx, color, x, y - lift, r - shrink);
        };
        paint('#c4dcf4', 0, 0);
        paint('#e4f0fc', 1, 1);
        paint('#ffffff', 3, 3);
        ctx.clearRect(0, 27, 72, 5);
        const xs = puffs.map(([x]) => x);
        rect(ctx, '#c4dcf4', Math.min(...xs), 25, Math.max(...xs) - Math.min(...xs), 2);
        outline(ctx, '#a9c9ec');
    });
}

/** One of the Due Torri: a brick shaft from `base` up `h` rows whose top is `lean` px to the side of its foot, `w` px wide. */
function tower(ctx: Ctx, x: number, base: number, h: number, w: number, lean: number): number {
    for (let i = 0; i <= h; i++) {
        const left = x + Math.round((lean * i) / h);
        rect(ctx, '#3c1c20', left - 1, base - i, w + 2, 1);
        rect(ctx, '#b4583e', left, base - i, w, 1);
        rect(ctx, '#d2795a', left, base - i, 2, 1);
        rect(ctx, '#863a30', left + w - 3, base - i, 3, 1);
        if (i % 9 === 5 && i < h - 3) rect(ctx, '#3c1c20', left + Math.floor(w / 2) - 1, base - i, 1, 2); // the little windows
    }
    return x + lean;
}

/**
 * The fields at the end of the fall, with Bologna far away: hazy hills with San Luca, the roofs of the old town and the Due Torri (the tall
 * thin Asinelli and the shorter, leaning Garisenda). The sky above the hills is transparent. Everything above row 84 stays clear of the people.
 */
export function groundTexture(scene: Phaser.Scene): string {
    return texture(scene, 'sky-ground', GROUND.w, GROUND.h, (ctx) => {
        const rnd = seeded(30);
        const W = GROUND.w;
        // far hills, then nearer ones
        const farHill = (x: number) => 64 - 17 * Math.exp(-(((x - 34) / 34) ** 2)) - 7 * Math.exp(-(((x - 205) / 50) ** 2)) + 2 * Math.sin(x / 17);
        const nearHill = (x: number) => 73 + 3 * Math.sin(x / 29 + 2) + 1.5 * Math.sin(x / 11);
        // San Luca on its hill: the ochre sanctuary and its dome
        const sl = Math.round(farHill(34));
        rect(ctx, '#d8a878', 23, sl - 4, 22, 6);
        rect(ctx, '#e8c090', 29, sl - 8, 10, 6);
        rows(ctx, '#7fb0a8', sl - 14, sl - 9, (y) => [34 - (y - (sl - 15)) * 0.9, 34 + (y - (sl - 15)) * 0.9]);
        rect(ctx, '#e8c090', 33, sl - 17, 2, 3);
        rect(ctx, '#d8a878', 46, sl - 7, 3, 9);
        for (let x = 0; x < W; x++) {
            const a = Math.round(farHill(x));
            rect(ctx, '#7ea6b8', x, a, 1, 90 - a);
            rect(ctx, '#94bac6', x, a, 1, 1);
            const b = Math.round(nearHill(x));
            rect(ctx, '#6a9a80', x, b, 1, 90 - b);
        }
        // the old town: two rows of houses with terracotta roofs
        const walls = ['#d89a5c', '#c8744c', '#e4b878', '#b8604a', '#d8886a'];
        const houses = (base: number, minH: number) => {
            for (let x = -3; x < W; ) {
                const w = 7 + Math.floor(rnd() * 9);
                const h = minH + Math.floor(rnd() * 6);
                const wall = walls[Math.floor(rnd() * walls.length)];
                rect(ctx, wall, x, base - h, w, h);
                rows(ctx, '#a0402c', base - h - 3, base - h, (y) => [x - 1 + (base - h - y), x + w - (base - h - y)]);
                rect(ctx, '#c05a3c', x, base - h - 1, w, 1);
                for (let wx = x + 2; wx < x + w - 1; wx += 3) rect(ctx, '#5a3030', wx, base - h + 2, 1, 2);
                x += w + 1;
            }
        };
        houses(80, 4);
        // the Due Torri: Asinelli with its crown and lantern, Garisenda cut short and leaning away
        const asinelli = tower(ctx, 96, 82, 66, 8, 2);
        rect(ctx, '#3c1c20', asinelli - 2, 12, 12, 6);
        rect(ctx, '#c4684a', asinelli - 1, 13, 10, 4);
        for (let i = 0; i < 10; i += 3) rect(ctx, '#3c1c20', asinelli + i - 1, 12, 1, 2);
        rect(ctx, '#3c1c20', asinelli + 1, 7, 6, 6);
        rect(ctx, '#b4583e', asinelli + 2, 8, 4, 4);
        rect(ctx, '#3c1c20', asinelli + 4, 1, 1, 7);
        const garisenda = tower(ctx, 112, 82, 38, 10, 9);
        rect(ctx, '#3c1c20', garisenda - 1, 43, 12, 2);
        rect(ctx, '#d2795a', garisenda, 44, 10, 1);
        houses(87, 3);
        // the fields: bands that get taller toward the viewer, with furrows that run to the horizon
        const bands = [['#5e9a48', 86, 3], ['#c8bc58', 89, 3], ['#6cac4c', 92, 5], ['#559040', 97, 6], ['#74b650', 103, 10], ['#66a846', 113, 17]] as const;
        for (const [color, y, h] of bands) rect(ctx, color, 0, y, W, h);
        for (let i = -8; i <= 8; i++) line(ctx, 'rgba(30,70,30,0.22)', 160 + i * 9, 87, 160 + i * 46, GROUND.h - 1);
        // round trees and cypresses along the edge of the town
        for (let x = 4; x < W; x += 9 + Math.floor(rnd() * 14)) {
            if (rnd() < 0.3) {
                rows(ctx, '#2f5e3a', 76, 87, (y) => [x - Math.min(2, (y - 75) / 3), x + Math.min(2, (y - 75) / 3)]);
            } else {
                disc(ctx, '#3a6e34', x, 85, 3);
                disc(ctx, '#4e8a3e', x - 1, 84, 2);
            }
        }
        // tufts of grass and flowers in the meadow
        for (let i = 0; i < 260; i++) {
            const x = Math.floor(rnd() * W);
            const y = 98 + Math.floor(rnd() * (GROUND.h - 100));
            if (i % 9 === 0) rect(ctx, ['#fff2a8', '#ffffff', '#ff9ab0'][i % 3], x, y, 2, 1);
            else {
                rect(ctx, '#3f7c34', x, y, 1, 2);
                rect(ctx, '#8cca60', x + 1, y - 1, 1, 2);
            }
        }
    });
}
