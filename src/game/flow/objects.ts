import Phaser from 'phaser';
import { lines, pixelStyle } from '../ui/text';
import { TILE, type TileWorld } from './tileMap';

/** Something in the room Ric can look at with X: a map point named `obj_<id>` (tile units, with a size), lines in
 *  dialogue.it.json under `objects.<sceneId>.<id>`. `lamp` and `puf` also do something (see WorldScene.useObject). */
export interface RoomObject {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

const REACH = 14; // px around the object's footprint where X works
const ACTIONS = new Set(['lamp', 'puf']);

/** The room's objects that have lines (or an action), in pixels. */
export function roomObjects(sceneId: string, tw: TileWorld | undefined): RoomObject[] {
    if (!tw) return [];
    return Object.entries(tw.data.points)
        .filter(([name]) => name.startsWith('obj_'))
        .map(([name, p]) => ({ id: name.slice(4), x: p.x * TILE, y: p.y * TILE, w: (p.w ?? 1) * TILE, h: (p.h ?? 1) * TILE }))
        .filter((o) => ACTIONS.has(o.id) || lines(`objects.${sceneId}.${o.id}`).length > 0);
}

export function objectNear(objects: RoomObject[], x: number, y: number): RoomObject | undefined {
    return objects.find((o) => x >= o.x - REACH && x <= o.x + o.w + REACH && y >= o.y - REACH && y <= o.y + o.h + REACH);
}

/** Switches the lamp's light off and on: the map's glows over the lamp, or a warm glow of its own when the map has none. */
export function toggleLamp(scene: Phaser.Scene, tw: TileWorld, o: RoomObject): void {
    const inside = (gx: number, gy: number) => gx >= o.x - TILE && gx <= o.x + o.w + TILE && gy >= o.y - 2 * TILE && gy <= o.y + o.h + TILE;
    let glows = tw.glows.filter((g) => inside(g.def.x, g.def.y)).map((g) => g.img);
    if (!glows.length) {
        const own = scene.add.image(o.x + o.w / 2, o.y + 6, 'tile-glow').setTint(0xffd27a).setBlendMode(Phaser.BlendModes.ADD).setDepth(650).setScale(1.6);
        own.setVisible(false);
        tw.glows.push({ def: { x: own.x, y: own.y, color: '#ffd27a', r: 50, kind: 'steady', period: 0 }, img: own });
        glows = [own];
    }
    const on = !glows[0].visible;
    for (const g of glows) g.setVisible(on);
}

/** Key codes that wake Ric from his nap: any way of walking. */
const MOVE_CODES = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];

/**
 * Ric sits on the pouf (drawn in front of him: his depth is one under the pouf's own row, kept in the sprite's data `sitDepth`, which the
 * world scene's update reads) and naps, a "z" floating up now and then, until a movement key is pressed; then he gets up and goes back.
 */
export async function dozeOnPuf(scene: Phaser.Scene, ric: Phaser.GameObjects.Sprite, o: RoomObject): Promise<void> {
    const from = { x: ric.x, y: ric.y };
    ric.anims.stop();
    ric.setFrame(1); // standing frame, facing down
    ric.setData('sitDepth', o.y + o.h - 1);
    await tween(scene, { targets: ric, x: o.x + o.w / 2, y: o.y + o.h / 2 + 2, duration: 300 });
    const zzz = scene.add.text(ric.x + 10, ric.y - 40, 'z', pixelStyle(16, '#cfe0ff')).setDepth(ric.depth + 1);
    const float = scene.tweens.add({ targets: zzz, y: zzz.y - 14, alpha: { from: 1, to: 0 }, duration: 900, repeat: -1, onRepeat: () => zzz.setText(zzz.text.length < 3 ? zzz.text + 'z' : 'z') });
    await new Promise<void>((resolve) => {
        const kb = scene.input.keyboard!;
        const onKey = (e: KeyboardEvent) => {
            if (!MOVE_CODES.includes(e.code)) return;
            kb.off('keydown', onKey);
            resolve();
        };
        kb.on('keydown', onKey);
        scene.events.once('shutdown', () => kb.off('keydown', onKey));
    });
    float.remove();
    zzz.destroy();
    await tween(scene, { targets: ric, x: from.x, y: from.y, duration: 300 });
    ric.setData('sitDepth', undefined);
}

function tween(scene: Phaser.Scene, cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => scene.tweens.add({ ...cfg, onComplete: () => resolve() }));
}
