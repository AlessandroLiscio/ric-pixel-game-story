import Phaser from 'phaser';
import { idleKey, type Dir } from './anims';

const TAU = Math.PI * 2;
const STILL_MS = 150; // a sprite that has not moved for this long counts as standing
const IDLE_ANIM = /-idle-(down|left|right|up)$/;

export interface IdleOptions {
    /** Length of one breath in ms; each sprite gets a random 0.85..1.2 variation on top and its own phase. Default 2400..3800. */
    period?: number;
    /** Now and then glances to another side for about a second and turns back. */
    look?: boolean;
    /** Now and then shifts its weight by one pixel sideways (never for a sprite whose x matters, such as Ric). */
    shift?: boolean;
    /** The glance and the shift wait while this returns false (a friend in the middle of a dialogue). */
    canLook?: () => boolean;
    /** The owner replays its own idle animation every frame (Ric's update does): the glance is put back after each of them. */
    reassert?: boolean;
}

interface Entry {
    sprite: Phaser.GameObjects.Sprite;
    id: string; // person id: the texture is `char-<id>`
    base: number; // the sprite's own scaleY, restored when it moves
    period: number;
    amp: number;
    phase: number;
    look: boolean;
    shift: boolean;
    canLook: () => boolean;
    reassert: boolean;
    x: number;
    y: number;
    stillSince: number;
    nextLook: number;
    lookKey?: string;
    backKey?: string;
    lookUntil: number;
    nextShift: number;
    shiftDx: number;
    shiftUntil: number;
}

const managers = new WeakMap<Phaser.Scene, IdleLife>();

/** The idle-life manager of a scene, created on first use and dropped at its shutdown (WorldScene restarts on the same instance). */
export function idleLife(scene: Phaser.Scene): IdleLife {
    let m = managers.get(scene);
    if (!m) {
        m = new IdleLife(scene);
        managers.set(scene, m);
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            m!.stop();
            managers.delete(scene);
        });
    }
    return m;
}

/**
 * Keeps standing characters alive: a soft breathing bob (the sprite stretches up from its feet by about one pixel, each one with its own period and
 * phase), now and then a glance to another side and back, and for the crowd a one pixel shift of weight. One listener for the whole scene, a few
 * arithmetic operations per sprite and frame, so the crowd of the cortile costs nothing. A sprite that moves is left alone and gets its scale back.
 * It never changes a position (except the one pixel shift, only where `shift` is set), so collision, depth and the follow trail are not touched.
 */
export class IdleLife {
    private readonly entries: Entry[] = [];

    constructor(private readonly scene: Phaser.Scene) {
        // after scene.update: Ric's own update plays his idle animation first, and a glance has to win over it
        scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.step, this);
    }

    add(sprite: Phaser.GameObjects.Sprite, opts: IdleOptions = {}): void {
        const id = sprite.texture.key.replace(/^char-/, '');
        const period = (opts.period ?? Phaser.Math.Between(2400, 3800)) * Phaser.Math.FloatBetween(0.85, 1.2);
        this.entries.push({
            sprite,
            id,
            base: sprite.scaleY,
            period,
            amp: Phaser.Math.FloatBetween(0.03, 0.05),
            phase: Math.random(),
            look: !!opts.look,
            shift: !!opts.shift,
            canLook: opts.canLook ?? (() => true),
            reassert: !!opts.reassert,
            x: sprite.x,
            y: sprite.y,
            stillSince: this.scene.time.now,
            nextLook: this.scene.time.now + Phaser.Math.Between(800, 6000),
            lookUntil: 0,
            nextShift: this.scene.time.now + Phaser.Math.Between(3000, 9000),
            shiftDx: 0,
            shiftUntil: 0
        });
    }

    stop(): void {
        this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.step, this);
        this.entries.length = 0;
    }

    private step(time: number): void {
        for (let i = this.entries.length - 1; i >= 0; i--) {
            const e = this.entries[i];
            const s = e.sprite;
            if (!s.active) {
                this.entries.splice(i, 1);
                continue;
            }
            if (Math.abs(s.x - e.x) > 0.01 || Math.abs(s.y - e.y) > 0.01) {
                this.rest(e);
                e.stillSince = time;
                e.x = s.x;
                e.y = s.y;
                continue;
            }
            if (time - e.stillSince < STILL_MS) continue;

            s.scaleY = e.base * (1 + e.amp * (0.5 - 0.5 * Math.cos(((time / e.period + e.phase) % 1) * TAU)));
            if (e.look) this.glance(e, time);
            if (e.shift) this.sway(e, time);
        }
    }

    /** The sprite moves (or is taken over): back to its own scale, no glance, no shift. */
    private rest(e: Entry): void {
        e.sprite.scaleY = e.base;
        e.lookKey = undefined;
        if (e.shiftDx) e.sprite.x -= e.shiftDx;
        e.shiftDx = 0;
    }

    private glance(e: Entry, time: number): void {
        const s = e.sprite;
        const key = s.anims.currentAnim?.key;
        if (e.lookKey) {
            if (!e.canLook() || (key !== e.lookKey && !e.reassert)) e.lookKey = undefined; // taken over: leave the animation the other code chose
            else if (time >= e.lookUntil) {
                e.lookKey = undefined;
                s.anims.play(e.backKey!, true);
                e.nextLook = time + Phaser.Math.Between(3000, 9000);
            } else if (key !== e.lookKey) s.anims.play(e.lookKey, true);
            return;
        }
        if (time < e.nextLook || !e.canLook()) return;
        const m = key ? IDLE_ANIM.exec(key) : null;
        if (!m) {
            e.nextLook = time + 1000; // walking or in a dialogue pose: try again later
            return;
        }
        const base = m[1] as Dir;
        const options: Dir[] = base === 'up' || base === 'down' ? ['left', 'right'] : [base === 'left' ? 'right' : 'left', 'down'];
        e.backKey = key;
        e.lookKey = idleKey(e.id, Phaser.Utils.Array.GetRandom(options));
        e.lookUntil = time + Phaser.Math.Between(700, 1500);
        s.anims.play(e.lookKey, true);
    }

    private sway(e: Entry, time: number): void {
        if (e.shiftDx) {
            if (time < e.shiftUntil) return;
            e.sprite.x -= e.shiftDx;
            e.x = e.sprite.x;
            e.shiftDx = 0;
            e.nextShift = time + Phaser.Math.Between(5000, 12000);
        } else if (time >= e.nextShift && e.canLook()) {
            e.shiftDx = Math.random() < 0.5 ? -1 : 1;
            e.sprite.x += e.shiftDx;
            e.x = e.sprite.x;
            e.shiftUntil = time + Phaser.Math.Between(500, 900);
        }
    }
}
