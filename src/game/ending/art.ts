import Phaser from 'phaser';
import { BAND_X, GAME_HEIGHT, GAME_WIDTH, SCREEN } from './layout';

type Ctx = CanvasRenderingContext2D;

/** A filled pixel rectangle. */
export const rect = (ctx: Ctx, color: string, x: number, y: number, w: number, h: number): void => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
};

/** Small deterministic random numbers, so the picture looks the same on every run. */
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
    const S = 4;
    const paint = (color: string, ox: number, oy: number, grow: number) => {
        rows.forEach((row, r) =>
            [...row].forEach((c, col) => {
                if (c === '1') rect(ctx, color, x + col * S + ox - grow, y + r * S + oy - grow, S + grow * 2, S + grow * 2);
            })
        );
    };
    paint('#3a2a10', 0, 0, 1);
    paint('#c88a14', 0, 0, 0);
    paint('#ffd34a', -1, -1, 0);
    // string
    rect(ctx, '#cfd6ff', x + 10, y + 7 * S + 1, 1, 18);
}

/** The pillow under Giuggiu's head, seen from above (small: people are 32 px tall in the tile room). */
export function pillowTexture(scene: Phaser.Scene): string {
    const key = 'ending-pillow';
    const c = canvas(scene, key, 12, 16);
    if (!c) return key;
    const { ctx } = c;
    rect(ctx, '#8d96c8', 1, 0, 10, 16);
    rect(ctx, '#e8ecff', 1, 1, 10, 14);
    rect(ctx, '#c3c9ef', 1, 12, 10, 3);
    rect(ctx, '#ffffff', 2, 2, 3, 1);
    c.done();
    return key;
}

/** The striped blanket over Giuggiu: teal with gold stripes. */
export function blanketTexture(scene: Phaser.Scene): string {
    const key = 'ending-blanket';
    const c = canvas(scene, key, 24, 20);
    if (!c) return key;
    const { ctx } = c;
    rect(ctx, '#1d4a46', 0, 1, 24, 18);
    rect(ctx, '#2f6f6a', 0, 1, 24, 16);
    rect(ctx, '#3f8f86', 0, 1, 24, 2);
    for (let x = 3; x < 24; x += 6) rect(ctx, '#e8d18a', x, 1, 2, 16);
    rect(ctx, '#2f6f6a', 2, 0, 20, 1);
    c.done();
    return key;
}

/** Floating gold "30" balloons, drawn once. */
export function balloonTexture(scene: Phaser.Scene, digit: '3' | '0'): string {
    const key = `ending-balloon-${digit}`;
    const c = canvas(scene, key, 26, 54);
    if (!c) return key;
    drawBalloon(c.ctx, digit, 3, 3);
    c.done();
    return key;
}

/** Soft light thrown by the TV (additive), centred on the screen. */
export function glowTexture(scene: Phaser.Scene): string {
    const key = 'ending-glow';
    const c = canvas(scene, key, 400, 320);
    if (!c) return key;
    const { ctx } = c;
    const g = ctx.createRadialGradient(200, 160, 10, 200, 160, 200);
    g.addColorStop(0, 'rgba(190,150,255,0.45)');
    g.addColorStop(0.35, 'rgba(120,120,255,0.24)');
    g.addColorStop(0.7, 'rgba(60,90,220,0.09)');
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
    for (let i = 0; i < 14; i++) rect(ctx, 'rgba(255,255,255,0.09)', 6 + i * 1, 3 + i, 8 - Math.floor(i / 2), 1);
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
    if (!scene.textures.exists('ending-heart')) {
        // a 7 x 6 pixel heart (the upstairs gag)
        const g = scene.make.graphics({ x: 0, y: 0 }, false);
        g.fillStyle(0xffffff, 1);
        for (const [x, y, w] of [[1, 0, 2], [4, 0, 2], [0, 1, 7], [0, 2, 7], [1, 3, 5], [2, 4, 3], [3, 5, 1]]) g.fillRect(x, y, w, 1);
        g.generateTexture('ending-heart', 7, 6);
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
