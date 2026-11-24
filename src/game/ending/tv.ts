import type Phaser from 'phaser';
import { rect, seeded } from './art';
import { SCREEN } from './layout';

type Ctx = CanvasRenderingContext2D;

const W = SCREEN.w;
const H = SCREEN.h;
const SAND_Y = H - 9;

/** Right-facing fish; letters are colours of the species palette: a body, c belly, d stripe, f fin, e eye. */
const FISH = ['...aaaaaa.....', '..aaadaaaa..ff', '.aeaadaaaaafff', '.cccdcccaa.ff.', '..cccdcccc....', '...cccccc.....'];
const TINY = ['.aaa.', 'aeaaf', '.aaa.'];
const CRAB = ['f.....f', '.f...f.', '.fffff.', 'fffffff', '.f.f.f.'];
const CRAB_B = ['f.....f', '.f...f.', '.fffff.', 'fffffff', 'f.f.f.f'];

interface Species {
    a: string;
    c: string;
    d: string;
    f: string;
    e: string;
}
const SPECIES: Species[] = [
    { a: '#ff7a1a', c: '#ffb36b', d: '#ffffff', f: '#e0560c', e: '#101828' },
    { a: '#2d6be0', c: '#8fb9ff', d: '#14327a', f: '#ffd23f', e: '#101828' },
    { a: '#ffd83a', c: '#fff3a8', d: '#e6a817', f: '#ffb020', e: '#101828' },
    { a: '#ff6fa8', c: '#ffc2dc', d: '#c43c78', f: '#ff9ac4', e: '#101828' }
];

function sprite(ctx: Ctx, rows: string[], pal: Record<string, string>, x: number, y: number, flip: boolean): void {
    const w = Math.max(...rows.map((r) => r.length));
    rows.forEach((row, r) =>
        [...row].forEach((ch, c) => {
            const color = pal[ch];
            if (color) rect(ctx, color, Math.round(flip ? x + w - 1 - c : x + c), Math.round(y + r), 1, 1);
        })
    );
}

interface Swimmer {
    x: number;
    y: number;
    vx: number;
    sp: number;
    ph: number;
}

/**
 * The fish documentary on the TV: a looping 112x72 pixel canvas, redrawn about 12 times a second.
 * Everything is drawn in code (fish, school, ray, jellyfish, crab, seaweed, bubbles, fake subtitles).
 */
export class FishTv {
    private readonly ctx: Ctx;
    private readonly refresh: () => void;
    private readonly back: HTMLCanvasElement;
    private readonly rnd = seeded(42);
    private readonly fish: Swimmer[] = [];
    private readonly bubbles: { x: number; y: number; v: number; ph: number; big: boolean }[] = [];
    private readonly seaweed = [8, 20, 31, 76, 90, 103];
    private last = 0;

    constructor(scene: Phaser.Scene, key: string) {
        const tex = scene.textures.exists(key) ? scene.textures.get(key) : scene.textures.createCanvas(key, W, H)!;
        const canvasTex = tex as Phaser.Textures.CanvasTexture;
        this.ctx = canvasTex.context;
        this.refresh = () => canvasTex.refresh();
        this.back = this.makeBackground();
        for (let i = 0; i < 5; i++) {
            this.fish.push({ x: this.rnd() * (W + 40) - 20, y: 14 + this.rnd() * 32, vx: (0.1 + this.rnd() * 0.18) * (this.rnd() > 0.35 ? 1 : -1), sp: i % SPECIES.length, ph: this.rnd() * 6 });
        }
        for (let i = 0; i < 9; i++) this.bubbles.push({ x: 4 + this.rnd() * (W - 8), y: this.rnd() * H, v: 0.012 + this.rnd() * 0.02, ph: this.rnd() * 6, big: this.rnd() > 0.6 });
    }

    /** The still part: water gradient, sand, rocks and corals. */
    private makeBackground(): HTMLCanvasElement {
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const ctx = c.getContext('2d')!;
        const top = [27, 127, 196];
        const bottom = [8, 40, 100];
        for (let y = 0; y < H; y++) {
            const k = y / (H - 1);
            const col = top.map((v, i) => Math.round(v + (bottom[i] - v) * k));
            rect(ctx, `rgb(${col[0]},${col[1]},${col[2]})`, 0, y, W, 1);
        }
        // distant reef silhouette
        const r = seeded(5);
        for (let x = 0; x < W; x += 6) rect(ctx, '#0d3f7c', x, SAND_Y - 8 - Math.floor(r() * 7), 6, 12);
        rect(ctx, '#0b3770', 0, SAND_Y - 3, W, 6);
        // sand with speckles
        rect(ctx, '#d6bf7a', 0, SAND_Y, W, H - SAND_Y);
        rect(ctx, '#e8d79a', 0, SAND_Y, W, 1);
        for (let i = 0; i < 40; i++) rect(ctx, i % 2 ? '#b49c5c' : '#f0e2aa', Math.floor(r() * W), SAND_Y + 2 + Math.floor(r() * (H - SAND_Y - 2)), 1, 1);
        // rocks
        for (const [x, w, h] of [[48, 14, 7], [60, 9, 5], [2, 10, 5]]) {
            rect(ctx, '#5f6a86', x, SAND_Y - h + 2, w, h);
            rect(ctx, '#7f8aa8', x + 1, SAND_Y - h + 2, w - 3, 2);
        }
        // coral fans
        for (const [x, col, hi] of [[40, '#e8505b', '#ff8a8a'], [66, '#f08ac0', '#ffc2dc'], [98, '#ff9a3a', '#ffcf8a']] as const) {
            rect(ctx, col, x, SAND_Y - 9, 2, 10);
            rect(ctx, col, x - 3, SAND_Y - 7, 2, 4);
            rect(ctx, col, x + 3, SAND_Y - 8, 2, 5);
            rect(ctx, hi, x - 3, SAND_Y - 7, 1, 1);
            rect(ctx, hi, x + 3, SAND_Y - 8, 1, 1);
            rect(ctx, hi, x, SAND_Y - 9, 1, 1);
        }
        // starfish
        rect(ctx, '#e8505b', 30, SAND_Y + 3, 5, 1);
        rect(ctx, '#e8505b', 32, SAND_Y + 1, 1, 5);
        return c;
    }

    /** Draws the frame for `time` milliseconds and uploads it. */
    draw(time: number): void {
        const ctx = this.ctx;
        const dt = Math.min(120, time - this.last);
        this.last = time;
        ctx.drawImage(this.back, 0, 0);
        const t = time;

        // light rays
        for (let i = 0; i < 3; i++) {
            const x0 = 14 + i * 38 + Math.sin(t / 2600 + i * 2) * 7;
            for (let y = 0; y < 52; y++) rect(ctx, 'rgba(255,255,255,0.075)', Math.round(x0 + y * 0.4), y, 7 + (i % 2), 1);
        }

        // a manta ray gliding far behind
        const mx = ((t / 150) % (W + 70)) - 50;
        const my = 24 + Math.sin(t / 1400) * 3;
        for (let r = -3; r <= 3; r++) {
            const w = 22 - 5 * Math.abs(r);
            rect(ctx, '#0f4f8c', Math.round(mx + 15 - w / 2), Math.round(my + r), w, 1);
        }
        rect(ctx, '#0f4f8c', Math.round(mx + 14), Math.round(my - 4), 2, 1);
        rect(ctx, '#0f4f8c', Math.round(mx - 6), Math.round(my), 8, 1);

        // seaweed
        this.seaweed.forEach((x, i) => {
            const h = 16 + (i % 3) * 5;
            for (let k = 0; k < h; k++) {
                const sway = Math.round(Math.sin(t / 520 + k * 0.32 + i * 1.7) * (k / h) * 3);
                rect(ctx, i % 2 ? '#2fa04a' : '#3fb85a', x + sway, SAND_Y + 1 - k, 2, 1);
                if (k % 5 === 2) rect(ctx, '#1f7a3a', x + sway + (i % 2 ? 2 : -1), SAND_Y + 1 - k, 1, 2);
            }
        });

        // jellyfish
        for (let i = 0; i < 2; i++) {
            const jx = 26 + i * 54 + Math.sin(t / 1900 + i * 3) * 6;
            const jy = 16 + i * 6 + Math.sin(t / 1100 + i * 2) * 7;
            const pulse = Math.sin(t / 380 + i) > 0 ? 0 : 1;
            rect(ctx, 'rgba(255,170,220,0.85)', Math.round(jx + 1), Math.round(jy), 5, 1);
            rect(ctx, 'rgba(255,170,220,0.85)', Math.round(jx), Math.round(jy + 1), 7, 2 - pulse);
            rect(ctx, 'rgba(255,230,245,0.9)', Math.round(jx + 2), Math.round(jy + 1), 2, 1);
            for (const dx of [1, 3, 5]) for (let k = 0; k < 5; k++) rect(ctx, 'rgba(255,170,220,0.6)', Math.round(jx + dx + Math.sin(t / 300 + k + dx) * 0.8), Math.round(jy + 3 - pulse + k), 1, 1);
        }

        // the school: seven tiny silver fish drifting together
        const sx = ((t / 110) % (W + 60)) - 30;
        for (let i = 0; i < 7; i++) {
            const ox = (i % 3) * 7 - ((i * 5) % 6);
            const oy = Math.sin(t / 700 + i * 1.3) * 3 + i * 2 - 6;
            sprite(ctx, TINY, { a: '#cfe8ff', e: '#304060', f: '#8fb0d8' }, W - sx + ox - 20, 40 + oy, true);
        }

        // the stars of the documentary
        for (const f of this.fish) {
            f.x += f.vx * dt * 0.12;
            if (f.vx > 0 && f.x > W + 18) this.respawn(f, -16);
            if (f.vx < 0 && f.x < -18) this.respawn(f, W + 16);
            const bob = Math.sin(t / 650 + f.ph) * 2.5;
            sprite(ctx, FISH, { ...SPECIES[f.sp] }, f.x, f.y + bob, f.vx < 0);
        }

        // crab scuttling on the sand
        const cx = 18 + (Math.sin(t / 3800) * 0.5 + 0.5) * 70;
        const legs = Math.sin(t / 160) > 0;
        sprite(ctx, legs ? CRAB : CRAB_B, { f: '#e8505b' }, cx, SAND_Y - 4, false);
        rect(ctx, '#101828', Math.round(cx + 2), SAND_Y - 4, 1, 1);
        rect(ctx, '#101828', Math.round(cx + 5), SAND_Y - 4, 1, 1);

        // bubbles
        for (const b of this.bubbles) {
            b.y -= b.v * dt;
            if (b.y < -4) {
                b.y = H - 8;
                b.x = 4 + this.rnd() * (W - 8);
            }
            const x = Math.round(b.x + Math.sin(t / 420 + b.ph) * 1.5);
            const y = Math.round(b.y);
            if (b.big) {
                rect(ctx, 'rgba(225,245,255,0.8)', x + 1, y, 1, 1);
                rect(ctx, 'rgba(225,245,255,0.8)', x, y + 1, 1, 1);
                rect(ctx, 'rgba(225,245,255,0.8)', x + 2, y + 1, 1, 1);
                rect(ctx, 'rgba(225,245,255,0.8)', x + 1, y + 2, 1, 1);
            } else {
                rect(ctx, 'rgba(225,245,255,0.85)', x, y, 2, 2);
            }
        }

        // fake subtitles: grey dashes, new sentence every 2.6 s
        rect(ctx, 'rgba(0,0,0,0.55)', 10, H - 17, W - 20, 12);
        const line = seeded(Math.floor(t / 2600) * 977 + 3);
        for (let row = 0; row < 2; row++) {
            let x = 16 + Math.floor(line() * 14);
            const end = W - 16 - Math.floor(line() * (row ? 30 : 8));
            while (x < end - 4) {
                const w = 3 + Math.floor(line() * 6);
                rect(ctx, '#f4f4f4', x, H - 15 + row * 4, Math.min(w, end - x), 2);
                x += w + 2;
            }
        }

        this.refresh();
    }

    private respawn(f: Swimmer, x: number): void {
        f.x = x;
        f.y = 10 + this.rnd() * 36;
        f.sp = Math.floor(this.rnd() * SPECIES.length);
        f.vx = Math.sign(f.vx) * (0.1 + this.rnd() * 0.18);
    }
}
