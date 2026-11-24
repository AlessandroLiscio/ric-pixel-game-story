import Phaser from 'phaser';
import { BAND_X, GAME_HEIGHT, GAME_WIDTH, SCREEN, SOFA, TV_CX } from './layout';

type Ctx = CanvasRenderingContext2D;

/** A filled pixel rectangle. */
export const rect = (ctx: Ctx, color: string, x: number, y: number, w: number, h: number): void => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
};

/** Small deterministic random numbers, so the room looks the same on every run. */
export function seeded(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

/** Creates a canvas texture once (the textures live as long as the game); returns null when it already exists. */
function canvas(scene: Phaser.Scene, key: string, w: number, h: number): { ctx: Ctx; done: () => void } | null {
    if (scene.textures.exists(key)) return null;
    const tex = scene.textures.createCanvas(key, w, h)!;
    return { ctx: tex.context, done: () => tex.refresh() };
}

// 5x7 digits for the foil balloons.
const DIGITS: Record<string, string[]> = {
    '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110']
};

function drawBalloon(ctx: Ctx, digit: string, x: number, y: number): void {
    // outline, gold body, light edge: the digit is drawn three times at slightly different offsets
    const rows = DIGITS[digit];
    const S = 5;
    const paint = (color: string, ox: number, oy: number, grow: number) => {
        rows.forEach((row, r) =>
            [...row].forEach((c, col) => {
                if (c === '1') rect(ctx, color, x + col * S + ox - grow, y + r * S + oy - grow, S + grow * 2, S + grow * 2);
            })
        );
    };
    paint('#3a2a10', 0, 0, 2);
    paint('#c88a14', 0, 0, 0);
    paint('#ffd34a', -1, -1, 0);
    // string
    rect(ctx, '#cfd6ff', x + 12, y + 7 * S + 2, 1, 22);
}

export function roomTexture(scene: Phaser.Scene): string {
    const key = 'ending-room';
    const c = canvas(scene, key, GAME_WIDTH, GAME_HEIGHT);
    if (!c) return key;
    const { ctx } = c;
    const wallH = 156;

    // wall: striped paper, panelled lower wall, trim
    rect(ctx, '#1e2655', 0, 0, GAME_WIDTH, wallH);
    for (let x = 0; x < GAME_WIDTH; x += 16) if ((x / 16) % 2 === 0) rect(ctx, '#232c5f', x, 0, 16, 112);
    for (let x = 8; x < GAME_WIDTH; x += 32) for (let y = 6; y < 108; y += 12) rect(ctx, '#2c3774', x, y, 2, 2);
    rect(ctx, '#161c40', 0, 0, GAME_WIDTH, 5);
    rect(ctx, '#2b2146', 0, 112, GAME_WIDTH, wallH - 112);
    for (let x = 0; x < GAME_WIDTH; x += 32) rect(ctx, '#211a38', x, 118, 2, 32);
    rect(ctx, '#7a628f', 0, 112, GAME_WIDTH, 1);
    rect(ctx, '#5a4670', 0, 113, GAME_WIDTH, 3);
    rect(ctx, '#171028', 0, 150, GAME_WIDTH, 6);

    // floor: planks with staggered joints
    rect(ctx, '#3b2a33', 0, wallH, GAME_WIDTH, GAME_HEIGHT - wallH);
    for (let y = wallH, row = 0; y < GAME_HEIGHT; y += 14, row++) {
        rect(ctx, row % 2 ? '#37262f' : '#402e37', 0, y, GAME_WIDTH, 13);
        rect(ctx, '#2a1c24', 0, y + 13, GAME_WIDTH, 1);
        for (let x = (row % 3) * 21; x < GAME_WIDTH; x += 64) rect(ctx, '#2a1c24', x, y, 1, 13);
    }
    rect(ctx, '#241822', 0, wallH, GAME_WIDTH, 3);
    rect(ctx, '#2c1f29', 0, wallH + 3, GAME_WIDTH, 4);

    // window with the moon
    rect(ctx, '#4a3a58', 14, 26, 84, 82);
    rect(ctx, '#0b1235', 20, 32, 72, 66);
    const rnd = seeded(7);
    for (let i = 0; i < 12; i++) rect(ctx, i % 3 ? '#8f9bd8' : '#ffffff', 22 + Math.floor(rnd() * 66), 34 + Math.floor(rnd() * 40), 1, 1);
    rect(ctx, '#f3eec8', 62, 44, 14, 14);
    rect(ctx, '#0b1235', 68, 42, 12, 12); // crescent bite
    rect(ctx, '#e3dcae', 62, 50, 6, 6);
    rect(ctx, '#4a3a58', 55, 32, 4, 66);
    rect(ctx, '#4a3a58', 20, 62, 72, 4);
    rect(ctx, '#2a3470', 20, 82, 72, 16); // distant rooftops
    for (let x = 20; x < 92; x += 12) rect(ctx, '#2a3470', x, 76 + ((x / 12) % 3) * 3, 10, 10);
    for (let x = 24; x < 90; x += 12) if (rnd() > 0.5) rect(ctx, '#ffd86a', x, 84, 2, 2);
    rect(ctx, '#5a4670', 10, 108, 92, 6);
    rect(ctx, '#6b2d3a', 14, 26, 12, 70); // curtains
    rect(ctx, '#6b2d3a', 86, 26, 12, 70);
    rect(ctx, '#4d1f2b', 18, 26, 2, 70);
    rect(ctx, '#4d1f2b', 90, 26, 2, 70);

    // bunting left over from the party
    const flags = ['#e8505b', '#ffd34a', '#4fc17a', '#5aa0f0', '#f08ac0'];
    rect(ctx, '#9aa4d8', 104, 17, 1, 1);
    for (let i = 0, x = 106; x < 330; x += 20, i++) {
        const sag = Math.round(Math.sin(((x - 106) / 224) * Math.PI) * 6);
        rect(ctx, '#9aa4d8', x, 18 + sag, 20, 1);
        for (let r = 0; r < 9; r++) rect(ctx, flags[i % flags.length], x + 3 + Math.floor(r / 2), 19 + sag + r, 14 - r - Math.floor(r / 2) * 2, 1);
    }

    // bookshelf
    rect(ctx, '#2a1d17', 452, 46, 112, 106);
    rect(ctx, '#3a2a22', 456, 50, 104, 98);
    const books = ['#a8323e', '#2f6fb0', '#d6a53a', '#3f8f5a', '#7a4aa8', '#d9d2c0', '#c8642a'];
    for (let shelf = 0; shelf < 3; shelf++) {
        const y = 52 + shelf * 32;
        rect(ctx, '#251912', 456, y + 28, 104, 4);
        let x = 459;
        while (x < 554) {
            const w = 4 + Math.floor(rnd() * 4);
            const h = 18 + Math.floor(rnd() * 9);
            rect(ctx, books[Math.floor(rnd() * books.length)], x, y + 28 - h, w, h);
            rect(ctx, 'rgba(255,255,255,0.18)', x, y + 28 - h, 1, h);
            x += w + (rnd() > 0.8 ? 5 : 0);
        }
    }
    // plant
    rect(ctx, '#7a3b2a', 584, 128, 26, 24);
    rect(ctx, '#5c2a1d', 584, 128, 26, 4);
    const leaf = ['#2f8f4a', '#3fae5c', '#256f3a'];
    for (let i = 0; i < 9; i++) {
        const lx = 590 + Math.floor(rnd() * 14);
        const ly = 92 + Math.floor(rnd() * 34);
        rect(ctx, leaf[i % 3], lx - 6, ly, 12, 5);
        rect(ctx, leaf[(i + 1) % 3], lx - 3, ly - 4, 6, 5);
    }
    rect(ctx, '#2a6a3a', 596, 108, 3, 22);

    // rug
    rect(ctx, '#8a3b4a', 58, 300, 276, 58);
    rect(ctx, '#6b2d3a', 62, 304, 268, 50);
    rect(ctx, '#d9a441', 66, 308, 260, 1);
    rect(ctx, '#d9a441', 66, 349, 260, 1);
    for (let x = 74; x < 320; x += 16) {
        rect(ctx, '#8a3b4a', x, 322, 6, 6);
        rect(ctx, '#d9a441', x + 2, 324, 2, 2);
    }
    c.done();
    return key;
}

/** TV and its cabinet (the screen itself is a separate, animated canvas). */
export function tvTexture(scene: Phaser.Scene): string {
    const key = 'ending-tvset';
    const w = 152;
    const h = 176;
    const c = canvas(scene, key, w, h);
    if (!c) return key;
    const { ctx } = c;
    const x0 = TV_CX - w / 2;
    const px = (x: number) => x - x0;
    const y0 = TV_SET_TOP;
    // bezel
    rect(ctx, '#0c0c14', px(TV_CX - 66), 0, 132, 92);
    rect(ctx, '#1d1f2e', px(TV_CX - 64), 2, 128, 88);
    rect(ctx, '#2d3046', px(TV_CX - 64), 2, 128, 2);
    rect(ctx, '#0c0c14', px(SCREEN.x - 3), SCREEN.y - y0 - 3, SCREEN.w + 6, SCREEN.h + 6);
    rect(ctx, '#5d6075', px(TV_CX + 46), 82, 4, 2); // power led housing
    rect(ctx, '#ff5050', px(TV_CX + 48), 83, 2, 1);
    // stand and cabinet
    rect(ctx, '#15161f', px(TV_CX - 22), 92, 44, 6);
    rect(ctx, '#3a2a22', px(TV_CX - 72), 98, 144, 34);
    rect(ctx, '#4d3a2e', px(TV_CX - 72), 98, 144, 3);
    rect(ctx, '#2a1d17', px(TV_CX - 72), 128, 144, 4);
    rect(ctx, '#2a1d17', px(TV_CX - 1), 102, 2, 26);
    rect(ctx, '#d9a441', px(TV_CX - 6), 112, 3, 3);
    rect(ctx, '#d9a441', px(TV_CX + 3), 112, 3, 3);
    rect(ctx, '#2a1d17', px(TV_CX - 68), 132, 6, 8);
    rect(ctx, '#2a1d17', px(TV_CX + 62), 132, 6, 8);
    // little things on the cabinet: a console and a plant
    rect(ctx, '#2d3046', px(TV_CX - 66), 90, 22, 8);
    rect(ctx, '#7ad0ff', px(TV_CX - 62), 92, 3, 3);
    rect(ctx, '#d6a53a', px(TV_CX + 50), 82, 14, 16);
    rect(ctx, '#7a3b2a', px(TV_CX + 52), 90, 10, 8);
    rect(ctx, '#2f8f4a', px(TV_CX + 52), 82, 3, 9);
    rect(ctx, '#3fae5c', px(TV_CX + 57), 80, 3, 10);
    c.done();
    return key;
}

/** The tvset image's top edge, so that its screen opening lines up with SCREEN. */
export const TV_SET_TOP = SCREEN.y - 14;

export function sofaTexture(scene: Phaser.Scene): string {
    const key = 'ending-sofa';
    const c = canvas(scene, key, SOFA.w, SOFA.h);
    if (!c) return key;
    const { ctx } = c;
    const w = SOFA.w;
    // backrest, seen from behind
    rect(ctx, '#1f1a2e', 6, 0, w - 12, 40);
    rect(ctx, '#3a3560', 8, 1, w - 16, 38);
    rect(ctx, '#4a447a', 8, 1, w - 16, 3);
    // three cushion backs
    for (let i = 0; i < 3; i++) {
        const x = 18 + i * 72;
        rect(ctx, '#34305a', x, 6, 68, 32);
        rect(ctx, '#2b2749', x, 36, 68, 2);
        rect(ctx, '#443f72', x + 2, 8, 64, 2);
        rect(ctx, '#2b2749', x + 66, 6, 2, 32);
        rect(ctx, '#5a548f', x + 30, 18, 2, 2); // button
    }
    // arms
    for (const x of [0, w - 20]) {
        rect(ctx, '#1f1a2e', x, 4, 20, 40);
        rect(ctx, '#443f72', x + 2, 6, 16, 36);
        rect(ctx, '#5a548f', x + 2, 6, 16, 3);
        rect(ctx, '#2b2749', x + 2, 40, 16, 2);
    }
    // base and feet
    rect(ctx, '#1f1a2e', 4, 40, w - 8, 6);
    rect(ctx, '#15111f', 10, 46, 6, 6);
    rect(ctx, '#15111f', w - 16, 46, 6, 6);
    // a blanket thrown over the right arm
    rect(ctx, '#d9a441', w - 18, 6, 16, 6);
    rect(ctx, '#b3822a', w - 18, 10, 16, 2);
    c.done();
    return key;
}

export const CHAIR_W = 40;
export const CHAIR_H = 50;

export function chairTexture(scene: Phaser.Scene): string {
    const key = 'ending-chair';
    const c = canvas(scene, key, CHAIR_W, CHAIR_H);
    if (!c) return key;
    const { ctx } = c;
    rect(ctx, '#2a1d17', 3, 0, 34, 28);
    rect(ctx, '#6b4a34', 5, 1, 30, 26);
    rect(ctx, '#7f5a40', 5, 1, 30, 3);
    for (const x of [10, 17, 24, 31]) rect(ctx, '#4d3523', x, 6, 2, 21);
    rect(ctx, '#2a1d17', 1, 27, 38, 5);
    rect(ctx, '#7f5a40', 2, 28, 36, 3);
    rect(ctx, '#2a1d17', 4, 32, 4, 18);
    rect(ctx, '#2a1d17', 32, 32, 4, 18);
    rect(ctx, '#15111f', 4, 48, 4, 2);
    rect(ctx, '#15111f', 32, 48, 4, 2);
    c.done();
    return key;
}

export function poufTexture(scene: Phaser.Scene, key: string, base: string, light: string): string {
    const c = canvas(scene, key, 64, 24);
    if (!c) return key;
    const { ctx } = c;
    const rows = [
        [10, 44],
        [4, 56],
        [1, 62],
        [0, 64],
        [0, 64],
        [0, 64],
        [1, 62],
        [3, 58],
        [8, 48]
    ];
    rows.forEach(([x, w], i) => rect(ctx, base, x, 3 + i * 2, w, 2));
    rect(ctx, light, 8, 5, 40, 2);
    rect(ctx, 'rgba(0,0,0,0.3)', 4, 17, 56, 3);
    c.done();
    return key;
}

export function blanketTexture(scene: Phaser.Scene): string {
    const key = 'ending-blanket';
    const c = canvas(scene, key, 44, 26);
    if (!c) return key;
    const { ctx } = c;
    rect(ctx, '#2f6f6a', 0, 4, 44, 20);
    rect(ctx, '#2f6f6a', 3, 2, 38, 2);
    rect(ctx, '#3f8f86', 0, 4, 44, 3);
    for (let x = 4; x < 44; x += 8) rect(ctx, '#e8d18a', x, 4, 3, 20);
    rect(ctx, '#1d4a46', 0, 22, 44, 2);
    c.done();
    return key;
}

export function pillowTexture(scene: Phaser.Scene): string {
    const key = 'ending-pillow';
    const c = canvas(scene, key, 26, 34);
    if (!c) return key;
    const { ctx } = c;
    rect(ctx, '#8d96c8', 1, 0, 24, 34);
    rect(ctx, '#e8ecff', 2, 1, 22, 32);
    rect(ctx, '#c3c9ef', 2, 28, 22, 5);
    rect(ctx, '#ffffff', 4, 3, 6, 2);
    c.done();
    return key;
}

/** Coffee table seen from the front with the leftovers of the party. */
export function tableTexture(scene: Phaser.Scene): string {
    const key = 'ending-table';
    const w = 100;
    const h = 40;
    const c = canvas(scene, key, w, h);
    if (!c) return key;
    const { ctx } = c;
    rect(ctx, '#2a1d17', 2, 12, w - 4, 20);
    rect(ctx, '#7f5a40', 4, 14, w - 8, 14);
    rect(ctx, '#92684a', 4, 14, w - 8, 3);
    rect(ctx, '#2a1d17', 4, 28, w - 8, 4);
    rect(ctx, '#2a1d17', 6, 32, 5, 8);
    rect(ctx, '#2a1d17', w - 11, 32, 5, 8);
    // cake: white, pink icing, candles blown out
    rect(ctx, '#e8d9c8', 14, 4, 30, 12);
    rect(ctx, '#f08ac0', 14, 4, 30, 5);
    rect(ctx, '#f9b8da', 16, 4, 8, 2);
    rect(ctx, '#ffffff', 22, 0, 2, 5);
    rect(ctx, '#5aa0f0', 30, 0, 2, 5);
    rect(ctx, '#ffd34a', 36, 1, 2, 4);
    rect(ctx, '#7f7f95', 23, -1, 1, 1);
    // pizza box and cups
    rect(ctx, '#d9c8a0', 52, 7, 26, 8);
    rect(ctx, '#b8a47a', 52, 14, 26, 2);
    rect(ctx, '#c8642a', 60, 8, 8, 2);
    rect(ctx, '#e8505b', 84, 2, 5, 10);
    rect(ctx, '#ffffff', 84, 2, 5, 2);
    rect(ctx, '#5aa0f0', 91, 4, 4, 8);
    rect(ctx, '#2f6fb0', 91, 4, 4, 2);
    c.done();
    return key;
}

/** Floating gold "30" balloons, drawn once. */
export function balloonTexture(scene: Phaser.Scene, digit: '3' | '0'): string {
    const key = `ending-balloon-${digit}`;
    const c = canvas(scene, key, 34, 70);
    if (!c) return key;
    drawBalloon(c.ctx, digit, 4, 4);
    c.done();
    return key;
}

/** Soft blue light thrown by the TV (additive). */
export function glowTexture(scene: Phaser.Scene): string {
    const key = 'ending-glow';
    const c = canvas(scene, key, 400, 320);
    if (!c) return key;
    const { ctx } = c;
    const g = ctx.createRadialGradient(200, 90, 10, 200, 130, 200);
    g.addColorStop(0, 'rgba(150,200,255,0.55)');
    g.addColorStop(0.35, 'rgba(90,140,255,0.28)');
    g.addColorStop(0.7, 'rgba(60,90,220,0.1)');
    g.addColorStop(1, 'rgba(40,60,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 400, 320);
    c.done();
    return key;
}

/** Dark column on the right that carries the credits; its left edge fades out. */
export function bandTexture(scene: Phaser.Scene): string {
    const key = 'ending-band';
    const w = GAME_WIDTH - BAND_X + 24;
    const c = canvas(scene, key, w, GAME_HEIGHT);
    if (!c) return key;
    const { ctx } = c;
    const g = ctx.createLinearGradient(0, 0, 24, 0);
    g.addColorStop(0, 'rgba(5,7,26,0)');
    g.addColorStop(1, 'rgba(5,7,26,0.82)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 24, GAME_HEIGHT);
    rect(ctx, 'rgba(5,7,26,0.82)', 24, 0, w - 24, GAME_HEIGHT);
    c.done();
    return key;
}

/** Scanlines, a darkened rim and a glare over the TV screen. */
export function scanTexture(scene: Phaser.Scene): string {
    const key = 'ending-scan';
    const c = canvas(scene, key, SCREEN.w, SCREEN.h);
    if (!c) return key;
    const { ctx } = c;
    for (let y = 0; y < SCREEN.h; y += 2) rect(ctx, 'rgba(0,0,20,0.16)', 0, y, SCREEN.w, 1);
    rect(ctx, 'rgba(0,0,20,0.28)', 0, 0, SCREEN.w, 2);
    rect(ctx, 'rgba(0,0,20,0.28)', 0, SCREEN.h - 2, SCREEN.w, 2);
    rect(ctx, 'rgba(0,0,20,0.28)', 0, 0, 2, SCREEN.h);
    rect(ctx, 'rgba(0,0,20,0.28)', SCREEN.w - 2, 0, 2, SCREEN.h);
    for (let i = 0; i < 14; i++) rect(ctx, 'rgba(255,255,255,0.09)', 8 + i * 1, 4 + i, 10 - Math.floor(i / 2), 1);
    c.done();
    return key;
}

/** Small white shapes the particle emitters tint. */
export function particleTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists('ending-dot')) {
        const g = scene.make.graphics({ x: 0, y: 0 }, false);
        g.fillStyle(0xffffff, 1);
        g.fillRect(0, 0, 3, 3);
        g.generateTexture('ending-dot', 3, 3);
        g.destroy();
    }
    if (!scene.textures.exists('ending-star')) {
        const g = scene.make.graphics({ x: 0, y: 0 }, false);
        g.fillStyle(0xffffff, 1);
        g.fillRect(2, 0, 1, 5);
        g.fillRect(0, 2, 5, 1);
        g.fillStyle(0xffffff, 0.6);
        g.fillRect(1, 1, 3, 3);
        g.generateTexture('ending-star', 5, 5);
        g.destroy();
    }
    if (!scene.textures.exists('ending-z')) {
        // a pixel "z" bubble
        const g = scene.make.graphics({ x: 0, y: 0 }, false);
        g.fillStyle(0xeaf0ff, 1);
        g.fillRect(0, 0, 7, 2);
        g.fillRect(4, 2, 2, 1);
        g.fillRect(3, 3, 2, 1);
        g.fillRect(1, 4, 2, 1);
        g.fillRect(0, 5, 7, 2);
        g.generateTexture('ending-z', 7, 7);
        g.destroy();
    }
}
