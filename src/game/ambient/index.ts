// Ambient pixelfx effects of a room. Nothing here knows a room's geometry: positions come from the map's `lights` at runtime, so a rebuilt
// or a new tile room gets them for free. Rules by light kind: a group of two or more `pulse` lights (stage spots) throws golden beams with dust
// through them. `flicker` and `steady` lights get nothing: the map already flickers their glow, and its tables carry their own candles.
// Smoke puffs (trellone) follow the people named in JOINTS. Called once from WorldScene.create.
import type Phaser from 'phaser';
import { fx } from '../fx';
import type { FxHandle } from '../fx';
import type { MapData } from '../flow/tileMap';

type Light = MapData['lights'][number];

/** Who smokes where: scene id -> person ids (the sprite of a person is looked up while the scene runs, so the puff ends when the person leaves). */
const JOINTS: Record<string, string[]> = { giuggiu: ['giuggiu'], circe: ['ros'] };

export interface AmbientContext {
    sceneId: string;
    /** Set in a tile room. */
    lights?: Light[];
    /** The sprite of a person standing in the room, if there is one. */
    spriteOf: (personId: string) => Phaser.GameObjects.Sprite | undefined;
}

export function startAmbient(scene: Phaser.Scene, ctx: AmbientContext): void {
    if (ctx.lights) lightFx(scene, ctx.lights);
    for (const id of JOINTS[ctx.sceneId] ?? []) smokePuff(scene, () => ctx.spriteOf(id));
}

function lightFx(scene: Phaser.Scene, lights: Light[]): void {
    const spots = lights.filter((l) => l.kind === 'pulse');
    if (spots.length >= 2) {
        const cx = Math.round(spots.reduce((s, l) => s + l.x, 0) / spots.length);
        const cy = Math.round(spots.reduce((s, l) => s + l.y, 0) / spots.length);
        // the beams fan down from the top left of the effect's canvas: its origin is the floor pool, 110 px under the spots
        // (the clip drops the hard floor pool the effect draws on its last rows)
        const y = cy + 110;
        fx.play(scene, 'weather/god-rays', { x: cx, y, layer: 'front', palette: 'beams', light: 0.55, alpha: 0.7, depth: 640, clip: { x: cx - 160, y: y - 170, w: 320, h: 168 } });
    }
}

/** A loop of grey smoke puffs at a person's mouth, following them; ends when the person is gone. */
function smokePuff(scene: Phaser.Scene, who: () => Phaser.GameObjects.Sprite | undefined): void {
    const at = (s: Phaser.GameObjects.Sprite) => ({ x: Math.round(s.x + (s.flipX ? -10 : 10)), y: Math.round(s.y - 38) });
    const first = who();
    if (!first) return;
    const handle: FxHandle = fx.play(scene, 'spawn/poof', { ...at(first), loop: true, loopDelay: 1.4, palette: 'greySmoke', alpha: 0.6, layer: 'front', depth: 780, timeScale: 0.5, startAt: 0.3 });
    const follow = () => {
        const s = who();
        if (!s?.active) {
            scene.events.off('update', follow);
            handle.stop();
            return;
        }
        const p = at(s);
        handle.moveTo(p.x, p.y);
    };
    scene.events.on('update', follow);
    scene.events.once('shutdown', () => scene.events.off('update', follow));
}
