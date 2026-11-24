// Bridge between the vendored pixelfx library (src/vendor/pixelfx, plain JS that draws pixels into a frame) and Phaser.
// Every playing effect owns a small frame the size of the effect's own canvas (meta.size), composited into a pooled
// CanvasTexture at the effect's own frame rate (30 Hz) and shown as one Phaser image, so the cost follows the number and
// size of the effects, never the 640x360 screen. Use `fx.play(scene, 'ui/confetti', { x, y })`; see docs/pixelfx.md.
import Phaser from 'phaser';
import { clearFrame, composite, createFrame, createFx } from '../../vendor/pixelfx/core/index.js';
import { EFFECTS, PALETTES, type FxModule } from './effects';

/** front: over characters (depth 800); back: over the ground, under everything else; ysort: sorted with the characters by y. */
export type FxLayer = 'front' | 'back' | 'ysort';

export interface FxOptions {
    /** Position of the effect's origin (its feet, centre or emitter, see meta.origin): world pixels, or screen pixels when `world` is false. */
    x: number;
    y: number;
    layer?: FxLayer;
    /** Draw only the part behind (`back`) or in front of (`front`) a character; the default draws both into the one image. */
    only?: 'front' | 'back';
    /** A ramp name (PALETTES, or a library ramp such as `smoke`, `holy`, `ice`) or a dark-to-bright array of hex colours. */
    palette?: string | (string | number)[];
    /** One-shots start again when they end (after `loopDelay` seconds); effects that loop by themselves need no flag. */
    loop?: boolean;
    loopDelay?: number;
    /** true (default): world coordinates, the effect scrolls with the camera; false: screen coordinates, fixed on screen. */
    world?: boolean;
    /** Overrides the depth of `layer`. */
    depth?: number;
    /** Integer enlargement of the image (the 320x180 transitions use 2 to fill the 640x360 screen). x and y are then in output pixels. */
    scale?: number;
    /** Playback speed, 1 = as designed. */
    timeScale?: number;
    /** Start with the effect already this many seconds in (the second half of a scene transition). */
    startAt?: number;
    /** Freeze at this effect time until `resume()` (the covered moment of a transition); `onPause` fires then. */
    pauseAt?: number;
    onPause?: () => void;
    onDone?: () => void;
    /** Shows only this rectangle of the effect (same coordinates as x and y): fish on a TV screen, rays inside a window. */
    clip?: { x: number; y: number; w: number; h: number };
    /** Opacity of the whole image (0..1), for soft ambient layers. */
    alpha?: number;
    flip?: boolean;
    seed?: number;
    /** Any other key goes to the effect itself (its own options: count, text, radius, light, ...). */
    [option: string]: unknown;
}

export interface FxHandle {
    readonly alive: boolean;
    /** Lets a loop fade out (a one-shot is cut short); the effect is released when it is done. */
    stop(): void;
    /** Removes it at once. */
    destroy(): void;
    moveTo(x: number, y: number): void;
    resume(): void;
}

const NO_HANDLE: FxHandle = { alive: false, stop() {}, destroy() {}, moveTo() {}, resume() {} };
const BRIDGE_KEYS = new Set(['x', 'y', 'layer', 'only', 'palette', 'loop', 'loopDelay', 'world', 'depth', 'scale', 'timeScale', 'startAt', 'pauseAt', 'onPause', 'onDone', 'clip', 'alpha']);
const DEPTH = { front: 800, back: -5 };
const TICK = 1 / 30;
/** Simultaneous effects per scene; a new one over the cap evicts the oldest one-shot, or is dropped when only loops are left. */
export const MAX_ACTIVE = 12;

interface Slot {
    key: string;
    w: number;
    h: number;
    tex: Phaser.Textures.CanvasTexture;
    ctx: CanvasRenderingContext2D;
    data: ImageData;
    frame: ReturnType<typeof createFrame>;
}

let seedCounter = 1;
const stats = { updateMs: 0, active: 0, peakActive: 0, maxUpdateMs: 0 };

class Instance implements FxHandle {
    alive = true;
    readonly ambient: boolean;
    private fxo: ReturnType<typeof createFx>;
    private slot: Slot;
    private readonly image: Phaser.GameObjects.Image;
    private readonly scale: number;
    private readonly originX: number;
    private readonly originY: number;
    private acc = (seedCounter % 2) * (TICK / 2); // half the effects tick on the other frame, so their redraws do not pile up on one
    private wait = 0;
    private paused = false;
    private pauseAt: number;
    private stopped = false;
    private x: number;
    private y: number;

    constructor(
        private readonly mgr: Manager,
        private readonly mod: FxModule,
        private readonly opts: FxOptions,
        private readonly effectOptions: Record<string, unknown>
    ) {
        this.scale = Math.max(1, Math.floor(opts.scale ?? 1));
        this.x = Math.round(opts.x / this.scale);
        this.y = Math.round(opts.y / this.scale);
        let [w, h] = mod.meta.size;
        [this.originX, this.originY] = mod.meta.origin ?? [w / 2, h / 2];
        if (typeof effectOptions.angle === 'number' && effectOptions.angle !== 0) {
            // a rotated effect can reach anywhere round its origin: use a square canvas that holds the whole circle
            const r = Math.ceil(Math.hypot(Math.max(this.originX, w - this.originX), Math.max(this.originY, h - this.originY)));
            [w, h, this.originX, this.originY] = [2 * r, 2 * r, r, r];
        }
        this.ambient = !!mod.meta.loop || !!opts.loop;
        this.pauseAt = opts.pauseAt ?? Infinity;
        this.slot = mgr.acquire(w, h);
        this.fxo = this.makeFx();
        const world = opts.world !== false;
        const layer = opts.layer ?? 'front';
        this.image = mgr.scene.add
            .image(0, 0, this.slot.key)
            .setOrigin(0)
            .setScale(this.scale)
            .setScrollFactor(world ? 1 : 0)
            .setAlpha(opts.alpha ?? 1)
            .setDepth(opts.depth ?? (layer === 'ysort' ? opts.y : DEPTH[layer]));
        this.place();
        this.render();
    }

    private makeFx(): ReturnType<typeof createFx> {
        const f = createFx(this.mod, { ...this.effectOptions, x: this.x, y: this.y, seed: this.effectOptions.seed ?? seedCounter++ });
        // fast-forward past the start (also on every restart of a loop)
        for (let i = 0, n = Math.floor((this.opts.startAt ?? 0) / TICK); i < n; i++) f.update(TICK);
        return f;
    }

    private place(): void {
        const f = this.slot.frame;
        f.ox = this.x - this.originX;
        f.oy = this.y - this.originY;
        this.fxo.options.x = this.x;
        this.fxo.options.y = this.y;
        this.image.setPosition(f.ox * this.scale, f.oy * this.scale);
        if (this.opts.layer === 'ysort' && this.opts.depth === undefined) this.image.setDepth(this.y * this.scale);
        const c = this.opts.clip;
        if (c) {
            // crop in texture pixels: the overlap of the clip rectangle and the frame
            const x0 = Math.max(c.x / this.scale, f.ox);
            const y0 = Math.max(c.y / this.scale, f.oy);
            const x1 = Math.min((c.x + c.w) / this.scale, f.ox + this.slot.w);
            const y1 = Math.min((c.y + c.h) / this.scale, f.oy + this.slot.h);
            this.image.setCrop(Math.round(x0 - f.ox), Math.round(y0 - f.oy), Math.max(0, Math.round(x1 - x0)), Math.max(0, Math.round(y1 - y0)));
        }
    }

    private render(): void {
        const s = this.slot;
        clearFrame(s.frame);
        this.fxo.draw(s.frame, this.opts.only);
        composite(s.frame, s.data.data, null);
        s.ctx.putImageData(s.data, 0, 0);
        s.tex.refresh();
    }

    moveTo(x: number, y: number): void {
        if (!this.alive) return;
        this.x = Math.round(x / this.scale);
        this.y = Math.round(y / this.scale);
        this.place();
    }

    resume(): void {
        this.pauseAt = Infinity;
        this.paused = false;
    }

    stop(): void {
        if (!this.alive || this.stopped) return;
        this.stopped = true;
        this.fxo.stop();
    }

    destroy(): void {
        if (!this.alive) return;
        this.alive = false;
        this.image.destroy();
        this.mgr.release(this.slot);
        this.mgr.remove(this);
    }

    /** Called every frame with the scene's delta in seconds. */
    tick(dt: number): void {
        if (!this.alive || this.paused) return;
        this.acc += dt * (this.opts.timeScale ?? 1);
        let drawn = false;
        while (this.acc >= TICK && this.alive && !this.paused) {
            this.acc -= TICK;
            if (this.wait > 0) {
                this.wait -= TICK;
                if (this.wait <= 0) this.fxo = this.makeFx();
                continue;
            }
            this.fxo.update(TICK);
            drawn = true;
            if (this.fxo.t >= this.pauseAt) {
                this.paused = true;
                this.opts.onPause?.();
            } else if (this.fxo.done()) {
                if (this.opts.loop && !this.stopped) {
                    this.wait = this.opts.loopDelay ?? 0;
                    if (this.wait <= 0) this.fxo = this.makeFx();
                    else this.image.setVisible(false);
                } else {
                    this.opts.onDone?.();
                    this.destroy();
                    return;
                }
            }
        }
        if (drawn && this.alive) {
            if (this.wait <= 0) {
                this.image.setVisible(true);
                this.render();
            }
        }
    }
}

class Manager {
    private readonly active: Instance[] = [];
    private readonly free = new Map<string, Slot[]>();
    private readonly all: Slot[] = [];
    private serial = 0;

    constructor(readonly scene: Phaser.Scene) {
        scene.events.on('update', this.update, this);
        scene.events.once('shutdown', this.destroy, this);
        scene.events.once('destroy', this.destroy, this);
    }

    acquire(w: number, h: number): Slot {
        const pooled = this.free.get(`${w}x${h}`)?.pop();
        if (pooled) return pooled;
        const key = `pfx-${this.scene.scene.key}-${w}x${h}-${this.serial++}`;
        const tex = this.scene.textures.createCanvas(key, w, h)!;
        const ctx = tex.getContext();
        ctx.imageSmoothingEnabled = false;
        const slot: Slot = { key, w, h, tex, ctx, data: ctx.createImageData(w, h), frame: createFrame(w, h, 0, 0) };
        this.all.push(slot);
        return slot;
    }

    release(slot: Slot): void {
        const id = `${slot.w}x${slot.h}`;
        const list = this.free.get(id) ?? [];
        list.push(slot);
        this.free.set(id, list);
    }

    remove(inst: Instance): void {
        const i = this.active.indexOf(inst);
        if (i >= 0) this.active.splice(i, 1);
    }

    add(inst: Instance): void {
        this.active.push(inst);
    }

    /** Makes room for one more effect: evicts the oldest one-shot when the cap is reached; false when only loops remain. */
    makeRoom(): boolean {
        if (this.active.length < MAX_ACTIVE) return true;
        const victim = this.active.find((i) => !i.ambient);
        if (!victim) return false;
        victim.destroy();
        return true;
    }

    get count(): number {
        return this.active.length;
    }

    private update(_time: number, delta: number): void {
        const t0 = performance.now();
        const dt = Math.min(delta, 100) / 1000;
        for (const inst of [...this.active]) inst.tick(dt);
        const ms = performance.now() - t0;
        stats.updateMs = stats.updateMs * 0.9 + ms * 0.1;
        stats.maxUpdateMs = Math.max(stats.maxUpdateMs, ms);
        stats.active = this.active.length;
        stats.peakActive = Math.max(stats.peakActive, this.active.length);
    }

    stopAll(): void {
        for (const inst of [...this.active]) inst.destroy();
    }

    destroy(): void {
        this.scene.events.off('update', this.update, this);
        this.scene.events.off('shutdown', this.destroy, this);
        this.scene.events.off('destroy', this.destroy, this);
        this.stopAll();
        for (const s of this.all) this.scene.textures.remove(s.key);
        this.all.length = 0;
        this.free.clear();
        managers.delete(this.scene);
    }
}

const managers = new WeakMap<Phaser.Scene, Manager>();
const managerOf = (scene: Phaser.Scene): Manager => {
    let m = managers.get(scene);
    if (!m) managers.set(scene, (m = new Manager(scene)));
    return m;
};

function resolvePalette(p: string | (string | number)[] | undefined): (string | number)[] | undefined {
    if (!p) return undefined;
    if (Array.isArray(p)) return p;
    const ramp = PALETTES[p];
    if (!ramp) throw new Error(`pixelfx: unknown palette "${p}"`);
    return ramp;
}

export const fx = {
    /** Switch every effect off (a debug aid and the baseline of the frame-time test): play() then returns an inert handle. */
    enabled: true,

    /** Plays an effect of src/game/fx/effects.ts in `scene`. Never throws: a failure is logged and an inert handle returned, so a broken effect cannot stop the story. */
    play(scene: Phaser.Scene, id: string, options: FxOptions): FxHandle {
        if (!fx.enabled) return NO_HANDLE;
        try {
            const mod = EFFECTS[id];
            if (!mod) throw new Error(`pixelfx: no effect "${id}" in src/game/fx/effects.ts`);
            const mgr = managerOf(scene);
            if (!mgr.makeRoom()) return NO_HANDLE;
            const effectOptions: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(options)) if (!BRIDGE_KEYS.has(k)) effectOptions[k] = v;
            const palette = resolvePalette(options.palette);
            if (palette) effectOptions.palette = palette;
            const inst = new Instance(mgr, mod, options, effectOptions);
            mgr.add(inst);
            return inst;
        } catch (e) {
            console.warn(e);
            return NO_HANDLE;
        }
    },

    /** Removes every effect of a scene (they also go by themselves when the scene shuts down). */
    stopAll(scene: Phaser.Scene): void {
        managers.get(scene)?.stopAll();
    },

    /** How many effects are playing in a scene. */
    count(scene: Phaser.Scene): number {
        return managers.get(scene)?.count ?? 0;
    }
};

if (import.meta.env.VITE_TEST_BUILD === '1' && typeof window !== 'undefined') {
    (window as unknown as { __ricFx: unknown }).__ricFx = { fx, stats };
}
