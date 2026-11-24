import Phaser from 'phaser';
import scenesJson from '../../data/scenes.json';

// Loaded only through the guarded dynamic import in ./index.ts. Touches the flow code only through
// game.registry ('run') and game.events ('debug:*'), so it type-checks without the flow present.

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}
interface Spot {
    x: number;
    y: number;
    personId?: string;
}
interface SceneData {
    id: string;
    spawn: Spot;
    door: Rect | null;
    walk: Rect[];
    friend: Spot | null;
    friend2?: Spot;
    extras: Spot[];
}

const SCENES = scenesJson as unknown as SceneData[];
const WORLD_KEY = 'world';
const OVERLAY_DEPTH = 10_000;

interface Overlay {
    gfx: Phaser.GameObjects.Graphics;
    labels: Phaser.GameObjects.Text[];
}

export function installDebugTools(game: Phaser.Game): void {
    let overlayOn = false;
    const overlays = new WeakMap<Phaser.Scene, Overlay>();

    const sceneIndex = (): number => {
        const run = game.registry.get('run') as { sceneIndex?: number } | undefined;
        return Math.min(Math.max(run?.sceneIndex ?? 0, 0), SCENES.length - 1);
    };
    const worldScene = (): Phaser.Scene | undefined => game.scene.getScenes(true).find((s) => s.scene.key === WORLD_KEY);

    const hideOverlay = (scene: Phaser.Scene): void => {
        const o = overlays.get(scene);
        if (!o) return;
        o.gfx.destroy();
        o.labels.forEach((l) => l.destroy());
        overlays.delete(scene);
    };

    const overlayFor = (scene: Phaser.Scene): Overlay => {
        let o = overlays.get(scene);
        if (!o) {
            o = { gfx: scene.add.graphics().setDepth(OVERLAY_DEPTH), labels: [] };
            overlays.set(scene, o);
            scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => overlays.delete(scene));
        }
        return o;
    };

    const label = (scene: Phaser.Scene, o: Overlay, n: number, text: string, x: number, y: number): void => {
        let t = o.labels[n];
        if (!t) {
            t = scene.add.text(0, 0, '', { fontSize: '8px', color: '#ffffff', backgroundColor: '#000000aa' }).setDepth(OVERLAY_DEPTH + 1);
            o.labels[n] = t;
        }
        t.setText(text).setPosition(Math.round(x), Math.round(y)).setVisible(true);
    };

    const draw = (scene: Phaser.Scene): void => {
        // the world scene holds the resolved entry (a tile room takes spawn, door and people from its map) and the tile world
        const live = scene as unknown as { def?: SceneData; tw?: { data: { collision: number[][] } } };
        const def = live.def ?? SCENES[sceneIndex()];
        const o = overlayFor(scene);
        const g = o.gfx;
        g.clear();
        live.tw?.data.collision.forEach((row, ty) =>
            row.forEach((blocked, tx) => {
                if (blocked) g.fillStyle(0xff3030, 0.28).fillRect(tx * 32, ty * 32, 32, 32);
            })
        );
        for (const r of def.walk) {
            g.fillStyle(0x00ff00, 0.22).fillRect(r.x, r.y, r.w, r.h);
            g.lineStyle(1, 0x00ff00, 1).strokeRect(r.x, r.y, r.w, r.h);
        }
        if (def.door) {
            g.fillStyle(0xff0000, 0.25).fillRect(def.door.x, def.door.y, def.door.w, def.door.h);
            g.lineStyle(1, 0xff0000, 1).strokeRect(def.door.x, def.door.y, def.door.w, def.door.h);
        }
        let n = 0;
        const mark = (s: Spot, color: number, name: string): void => {
            g.fillStyle(color, 1).fillCircle(s.x, s.y, 2);
            g.lineStyle(1, color, 1).strokeRect(s.x - 16, s.y - 32, 32, 32);
            label(scene, o, n++, name, s.x - 16, s.y - 42);
        };
        mark(def.spawn, 0x00ccff, 'spawn');
        if (def.friend) mark(def.friend, 0xffff00, def.friend.personId ?? 'friend');
        if (def.friend2) mark(def.friend2, 0xffff00, def.friend2.personId ?? 'friend2');
        for (const e of def.extras) mark(e, 0xff00ff, e.personId ?? 'extra');
        for (; n < o.labels.length; n++) o.labels[n].setVisible(false);
    };

    // Redraw each frame so the overlay follows scene changes and restarts.
    game.events.on(Phaser.Core.Events.POST_STEP, () => {
        const scene = worldScene();
        if (!scene) return;
        if (overlayOn) draw(scene);
        else hideOverlay(scene);
    });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
        const m = /^F([1-9])$/.exec(e.key);
        if (!m) return;
        const n = Number(m[1]);
        e.preventDefault();
        if (n <= SCENES.length) game.events.emit('debug:jump', { sceneIndex: n - 1 });
        else if (n === 7) game.events.emit('debug:minigame', { won: true });
        else if (n === 8) game.events.emit('debug:minigame', { won: false });
        else overlayOn = !overlayOn;
    });
}
