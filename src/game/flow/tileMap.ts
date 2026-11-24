import Phaser from 'phaser';
import type { NpcDef, SceneDef } from './sceneTypes';

// Tile worlds (docs/tiles.md): a room is drawn from 32x32 tiles of public/assets/tiles/tileset.png. The map JSON in
// src/data/maps/<sceneId>.json is written by scripts/art/maps.py. Everything here is pure drawing and collision, the story
// logic stays in WorldScene.

export const TILE = 32;
export const TILESET_KEY = 'tileset';
const GLOW_KEY = 'tile-glow';
const SHADOW_KEY = 'tile-shadow';
const MOOD_DEPTH = 750; // over the characters and the `above` layer (700), under the glows, the dialogue and the hints

type LayerName = 'ground' | 'walls' | 'below' | 'objects' | 'above';

export interface MapPoint {
    x: number;
    y: number;
    w?: number;
    h?: number;
}
export interface LightDef {
    x: number;
    y: number;
    color: string;
    /** radius in px of the small additive glow (0 for none) */
    r: number;
    kind: 'steady' | 'flicker' | 'pulse';
    period: number;
    /** radius in px of the pool of light it brings back into the night overlay (0 for none) */
    pool?: number;
    /** how much of the colour the pool brings back, 0..1 */
    power?: number;
}
export interface CrowdDef {
    sheet: string;
    x: number;
    y: number;
    facing: 'down' | 'left' | 'right' | 'up';
    bob: number;
}
export interface DancerDef {
    sheet: string;
    x: number;
    y: number;
    facing: 'down' | 'left' | 'right' | 'up';
    /** ms between the two arm poses */
    period: number;
}
export interface MapData {
    id: string;
    tileSize: number;
    width: number;
    height: number;
    layers: Record<LayerName, number[][]>;
    collision: number[][];
    points: Record<string, MapPoint>;
    lights: LightDef[];
    /** an evening room: everything is multiplied by this colour, the lights bring pools of colour back (scripts/art/lighting.py) */
    mood?: { ambient: string };
    crowd: CrowdDef[];
    dancers?: DancerDef[];
}

const MAP_FILES = import.meta.glob('../../data/maps/*.json', { eager: true, import: 'default' }) as Record<string, MapData>;
export const MAPS: Record<string, MapData> = Object.fromEntries(Object.values(MAP_FILES).map((m) => [m.id, m]));

/** Every crowd sheet the maps use: BootScene loads them as `char-<sheet>`. */
export const crowdSheets = (): string[] => [
    ...new Set(Object.values(MAPS).flatMap((m) => [...m.crowd.map((c) => c.sheet), ...(m.dancers ?? []).map((d) => d.sheet)]))
];

const FACE_ROW = { down: 0, left: 1, right: 2, up: 3 } as const;

/** Feet position of a character standing on a tile: centred, a few pixels above the tile's lower edge. */
export const feetOf = (p: { x: number; y: number }): { x: number; y: number } => ({ x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE - 4 });

/** A copy of the scene entry with spawn, door and people turned from the map's named points into pixels. */
export function resolveMapScene(def: SceneDef, map: MapData): SceneDef {
    const at = (name: string): MapPoint => {
        const p = map.points[name];
        if (!p) throw new Error(`map ${map.id} has no point "${name}"`);
        return p;
    };
    const npc = (n: NpcDef): NpcDef => (n.at ? { ...n, ...feetOf(at(n.at)) } : n);
    const door = at('door');
    return {
        ...def,
        spawn: { ...def.spawn, ...feetOf(at('spawn')) },
        door: { x: door.x * TILE, y: door.y * TILE, w: (door.w ?? 1) * TILE, h: (door.h ?? 1) * TILE },
        walk: [],
        friend: def.friend ? npc(def.friend) : null,
        friend2: def.friend2 ? npc(def.friend2) : undefined,
        extras: def.extras.map(npc)
    };
}

/** Draws one map and answers collision questions. Layers: ground, walls and below baked under everyone; objects as single tiles
 *  sorted with the characters by their lower edge; above baked over everyone; glows and dust on top of the world. */
export class TileWorld {
    readonly widthPx: number;
    readonly heightPx: number;

    constructor(
        private readonly scene: Phaser.Scene,
        readonly data: MapData
    ) {
        this.widthPx = data.width * TILE;
        this.heightPx = data.height * TILE;
        this.draw();
    }

    // ---- collision ----

    solidAt(px: number, py: number): boolean {
        const tx = Math.floor(px / TILE);
        const ty = Math.floor(py / TILE);
        if (tx < 0 || ty < 0 || tx >= this.data.width || ty >= this.data.height) return true;
        return this.data.collision[ty][tx] === 1;
    }

    /** Feet box of 18 x 7 px at (x, y), where y is the lowest pixel row. */
    canStand(x: number, y: number): boolean {
        const l = x - 9;
        const r = x + 9;
        const b = y - 1;
        const t = y - 7;
        return !(this.solidAt(l, b) || this.solidAt(r, b) || this.solidAt(l, t) || this.solidAt(r, t));
    }

    // ---- drawing ----

    private bake(key: string, layers: LayerName[], depth: number): void {
        if (!this.scene.textures.exists(key)) {
            const tex = this.scene.textures.createCanvas(key, this.widthPx, this.heightPx)!;
            const ctx = tex.getContext();
            ctx.imageSmoothingEnabled = false;
            const src = this.scene.textures.get(TILESET_KEY).getSourceImage() as CanvasImageSource & { width: number };
            const cols = Math.floor(src.width / TILE);
            for (const layer of layers) {
                this.data.layers[layer].forEach((row, y) =>
                    row.forEach((idx, x) => {
                        if (idx > 0) ctx.drawImage(src, (idx % cols) * TILE, Math.floor(idx / cols) * TILE, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
                    })
                );
            }
            tex.refresh();
        }
        this.scene.add.image(0, 0, key).setOrigin(0).setDepth(depth);
    }

    private draw(): void {
        const { scene, data } = this;
        this.bake(`map-${data.id}-under`, ['ground', 'walls', 'below'], -10);
        data.layers.objects.forEach((row, y) =>
            row.forEach((idx, x) => {
                if (idx > 0) scene.add.image(x * TILE, y * TILE, TILESET_KEY, idx).setOrigin(0).setDepth((y + 1) * TILE);
            })
        );
        this.bake(`map-${data.id}-over`, ['above'], 700);
        this.addCharacterShadows();
        this.addDancers();
        this.addMood();
        this.addLights();
        this.addDust();
    }

    /** A soft ground shadow under every character sprite of the scene (texture key `char-*`: Ric, the people, the party, the crowd,
     *  the dancers), so nobody floats. Found by scanning the scene a few times a second, followed every frame, so the scene that owns
     *  the sprites needs no code for it. The shadow sits half a depth step under its character and is dropped with it. */
    private addCharacterShadows(): void {
        const { scene } = this;
        if (!scene.textures.exists(SHADOW_KEY)) {
            const tex = scene.textures.createCanvas(SHADOW_KEY, 24, 8)!;
            const ctx = tex.getContext();
            ctx.fillStyle = 'rgba(22,8,34,0.2)';
            ctx.beginPath();
            ctx.ellipse(12, 4, 12, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(22,8,34,0.22)';
            ctx.beginPath();
            ctx.ellipse(12, 4, 9, 3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(22,8,34,0.26)';
            ctx.beginPath();
            ctx.ellipse(12, 4, 5.5, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            tex.refresh();
        }
        const shadows = new Map<Phaser.GameObjects.Sprite, Phaser.GameObjects.Image>();
        let frame = 0;
        const sync = (): void => {
            if (frame++ % 20 === 0) {
                for (const o of scene.children.list) {
                    if (o instanceof Phaser.GameObjects.Sprite && o.texture.key.startsWith('char-') && !shadows.has(o)) {
                        shadows.set(o, scene.add.image(o.x, o.y, SHADOW_KEY));
                    }
                }
            }
            for (const [o, img] of shadows) {
                if (!o.active) {
                    img.destroy();
                    shadows.delete(o);
                    continue;
                }
                img.setPosition(o.x, Math.round(o.y) - 1).setDepth(o.depth - 0.5).setVisible(o.visible).setAlpha(o.alpha);
            }
        };
        scene.events.on(Phaser.Scenes.Events.UPDATE, sync);
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, sync));
    }

    /** People who dance: the two arm poses of the crowd sheet (columns 0 and 2) swap every `period` ms with a hop of two pixels.
     *  Their tiles are blocked in the map's collision grid, so they need no other logic. */
    private addDancers(): void {
        for (const d of this.data.dancers ?? []) {
            const at = feetOf(d);
            const row = FACE_ROW[d.facing] * 3;
            const sprite = this.scene.add.sprite(at.x, at.y, `char-${d.sheet}`, row).setOrigin(0.5, 1).setDepth(at.y);
            let pose = Phaser.Math.Between(0, 1);
            this.scene.time.addEvent({
                delay: d.period,
                loop: true,
                callback: () => sprite.setFrame(row + (pose++ % 2) * 2)
            });
            this.scene.tweens.add({ targets: sprite, y: at.y - 2, duration: d.period / 2, yoyo: true, repeat: -1, ease: 'Quad.Out', delay: Phaser.Math.Between(0, d.period) });
        }
    }

    /** The night mood (scripts/art/lighting.py is the same model): a canvas the size of the room filled with the ambient colour, a
     *  radial pool of each light's colour added on top ('lighter', clamped at white), drawn over everything with MULTIPLY. Baked once. */
    private addMood(): void {
        const { mood } = this.data;
        if (!mood) return;
        const key = `map-${this.data.id}-mood`;
        if (!this.scene.textures.exists(key)) {
            const tex = this.scene.textures.createCanvas(key, this.widthPx, this.heightPx)!;
            const ctx = tex.getContext();
            ctx.fillStyle = mood.ambient;
            ctx.fillRect(0, 0, this.widthPx, this.heightPx);
            ctx.globalCompositeOperation = 'lighter';
            for (const l of this.data.lights) {
                const pool = l.pool ?? 0;
                if (pool <= 0) continue;
                const c = Phaser.Display.Color.HexStringToColor(l.color);
                const power = l.power ?? 1;
                const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, pool);
                g.addColorStop(0, `rgba(${c.red},${c.green},${c.blue},${power})`);
                g.addColorStop(0.4, `rgba(${c.red},${c.green},${c.blue},${0.6 * power})`);
                g.addColorStop(1, `rgba(${c.red},${c.green},${c.blue},0)`);
                ctx.fillStyle = g;
                ctx.fillRect(l.x - pool, l.y - pool, pool * 2, pool * 2);
            }
            tex.refresh();
        }
        this.scene.add.image(0, 0, key).setOrigin(0).setDepth(MOOD_DEPTH).setBlendMode(Phaser.BlendModes.MULTIPLY);
    }

    private glowTexture(): string {
        const { textures } = this.scene;
        if (!textures.exists(GLOW_KEY)) {
            const tex = textures.createCanvas(GLOW_KEY, 64, 64)!;
            const ctx = tex.getContext();
            const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 64, 64);
            tex.refresh();
        }
        return GLOW_KEY;
    }

    /** Warm and coloured glows that flicker or pulse. In a day room they sit under the `above` layer and over the characters; in an
     *  evening room they sit over the night overlay, so a lamp stays bright. */
    private addLights(): void {
        const key = this.glowTexture();
        const depth = this.data.mood ? MOOD_DEPTH + 10 : 650;
        for (const l of this.data.lights) {
            if (l.r <= 0) continue;
            const img = this.scene.add
                .image(l.x, l.y, key)
                .setTint(Phaser.Display.Color.HexStringToColor(l.color).color)
                .setBlendMode(Phaser.BlendModes.ADD)
                .setDepth(depth)
                .setScale((l.r * 2) / 64);
            if (l.kind === 'steady') {
                img.setAlpha(0.55);
                continue;
            }
            const flicker = l.kind === 'flicker';
            img.setAlpha(flicker ? 0.55 : 0.25);
            this.scene.tweens.add({
                targets: img,
                alpha: flicker ? { from: 0.4, to: 0.8 } : { from: 0.1, to: 0.7 },
                duration: flicker ? 160 + (l.period % 5) * 40 : l.period / 2,
                yoyo: true,
                repeat: -1,
                hold: flicker ? 60 + (l.period % 7) * 30 : 0,
                delay: Phaser.Math.Between(0, 600),
                ease: flicker ? 'Quad.InOut' : 'Sine.InOut'
            });
        }
    }

    /** A handful of dust motes drifting up through the warm air. */
    private addDust(): void {
        const { widthPx, heightPx } = this;
        for (let i = 0; i < 22; i++) {
            const x = Phaser.Math.Between(TILE, widthPx - TILE);
            const y = Phaser.Math.Between(5 * TILE, heightPx - 2 * TILE);
            const mote = this.scene.add.rectangle(x, y, 2, 2, 0xffe9b0).setDepth(this.data.mood ? MOOD_DEPTH + 20 : 660).setAlpha(0);
            this.scene.tweens.add({
                targets: mote,
                y: y - Phaser.Math.Between(24, 60),
                x: x + Phaser.Math.Between(-14, 14),
                alpha: { from: 0, to: 0.55 },
                duration: Phaser.Math.Between(3500, 7000),
                yoyo: true,
                repeat: -1,
                delay: Phaser.Math.Between(0, 5000),
                ease: 'Sine.InOut'
            });
        }
    }
}
