import type Phaser from 'phaser';
import { audio } from '../audio';
import { ensureCharAnims, idleKey, walkKey, type Dir } from './anims';

const SAMPLE_PX = 4; // Ric's position is recorded every ~4 px of travel
const SAMPLES_BEHIND = 12; // follower i trails Ric by 12*(i+1) samples
const MOVE_EPS = 0.05; // px per update below which a follower counts as stopped
const POP_MS = 220;

interface Follower {
    id: string;
    sprite: Phaser.GameObjects.Sprite;
    dir: Dir;
    moving: boolean;
    /** Rebuilt at a scene start: stays hidden until Ric has walked far enough to leave it a spot behind him, so it never sits on top of him. */
    hideUntilTrail: boolean;
    /** Placed by lineUpBeside: holds its spot until the trail behind Ric is long enough to take it over. */
    anchored?: boolean;
}

/** RPG Maker style follow train: each follower walks the path Ric walked, a fixed distance behind. */
export class Party {
    private readonly followers: Follower[] = [];
    // Recorded points, newest first. The leader's live position is the head of the path, so followers glide
    // smoothly between samples instead of stepping 4 px at a time.
    private readonly history: { x: number; y: number }[] = [];
    private paused = false;

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly leader: Phaser.GameObjects.Sprite
    ) {
        this.history.push({ x: leader.x, y: leader.y });
    }

    /**
     * Adds a follower at the end of the trail with a small pop-in and the `confirm` sound. Ignores ids already in
     * the party. `{ instant: true }` (an addition to the contract) skips both, for rebuilding the party in a new scene.
     */
    add(personId: string, opts: { instant?: boolean } = {}): void {
        if (this.followers.some((f) => f.id === personId)) return;
        const texture = `char-${personId}`;
        if (!this.scene.textures.exists(texture)) {
            if (import.meta.env.DEV) console.warn(`[party] missing texture ${texture}`);
            return;
        }
        ensureCharAnims(this.scene, personId);
        const index = this.followers.length;
        const at = this.pointBehind(index);
        const sprite = this.scene.add.sprite(at.x, at.y, texture, 1);
        sprite.setOrigin(this.leader.originX, this.leader.originY);
        sprite.setDepth(at.y);
        const follower: Follower = { id: personId, sprite, dir: 'down', moving: false, hideUntilTrail: !!opts.instant };
        sprite.play(idleKey(personId, 'down'));
        sprite.setVisible(!(follower.hideUntilTrail && at.short));
        this.followers.push(follower);

        if (opts.instant) return;
        const scale = sprite.scaleX;
        sprite.setAlpha(0).setScale(scale * 0.2);
        this.scene.tweens.add({ targets: sprite, alpha: 1, scaleX: scale, scaleY: scale, duration: POP_MS, ease: 'Back.Out' });
        audio.sfx('confirm');
    }

    /** Call every frame after the leader moved. */
    update(_dt?: number): void {
        if (this.paused) return;
        this.record();
        this.leader.setDepth(this.leader.y);
        this.followers.forEach((f, i) => {
            const target = this.pointBehind(i);
            if (f.anchored) {
                if (target.short) return; // placed by lineUpBeside: stays put until Ric leaves it a spot on the trail
                f.anchored = false;
            }
            const dx = target.x - f.sprite.x;
            const dy = target.y - f.sprite.y;
            f.sprite.setPosition(target.x, target.y);
            f.sprite.setDepth(target.y);
            if (f.hideUntilTrail) {
                f.sprite.setVisible(!target.short);
                if (!target.short) f.hideUntilTrail = false;
            }
            const moving = Math.abs(dx) > MOVE_EPS || Math.abs(dy) > MOVE_EPS;
            const dir: Dir = moving ? (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down') : f.dir;
            if (moving !== f.moving || dir !== f.dir) {
                f.moving = moving;
                f.dir = dir;
                f.sprite.play(moving ? walkKey(f.id, dir) : idleKey(f.id, dir), true);
            }
        });
    }

    /**
     * Shows the whole party at once in a row beside Ric (alternating right and left, `gap` px apart), facing `dir`,
     * for a scene where Ric does not walk before everyone must be seen (the last scene). Each follower keeps that
     * spot until Ric walks far enough to give it a place on the trail.
     */
    lineUpBeside(gap: number, dir: Dir): void {
        this.followers.forEach((f, i) => {
            const side = i % 2 === 0 ? 1 : -1;
            const x = this.leader.x + side * gap * (Math.floor(i / 2) + 1);
            f.sprite.setPosition(x, this.leader.y).setDepth(this.leader.y).setVisible(true);
            f.hideUntilTrail = false;
            f.anchored = true;
            f.dir = dir;
            f.sprite.play(idleKey(f.id, dir), true);
        });
    }

    /** Freeze the train (dialogue, fades). Followers switch to their idle frame. */
    setPaused(p: boolean): void {
        this.paused = p;
        if (!p) return;
        for (const f of this.followers) {
            f.moving = false;
            f.sprite.play(idleKey(f.id, f.dir), true);
        }
    }

    /** Person ids in train order, first follower first. */
    ids(): string[] {
        return this.followers.map((f) => f.id);
    }

    /** Current positions of the followers, in train order. */
    positions(): { id: string; x: number; y: number }[] {
        return this.followers.map((f) => ({ id: f.id, x: f.sprite.x, y: f.sprite.y }));
    }

    destroy(): void {
        this.followers.forEach((f) => f.sprite.destroy());
        this.followers.length = 0;
    }

    private record(): void {
        const last = this.history[0];
        const dist = Math.hypot(this.leader.x - last.x, this.leader.y - last.y);
        if (dist >= SAMPLE_PX) {
            this.history.unshift({ x: this.leader.x, y: this.leader.y });
            const keep = SAMPLES_BEHIND * (this.followers.length + 1) + 2;
            if (this.history.length > keep) this.history.length = keep;
        }
    }

    // Point on the leader's path at SAMPLES_BEHIND*(index+1) samples (SAMPLE_PX each) behind its live position.
    // `short` is true while the recorded path is shorter than that gap (the point is then the oldest one, where the leader started).
    private pointBehind(index: number): { x: number; y: number; short: boolean } {
        let remaining = SAMPLES_BEHIND * SAMPLE_PX * (index + 1);
        let px = this.leader.x;
        let py = this.leader.y;
        for (const p of this.history) {
            const seg = Math.hypot(p.x - px, p.y - py);
            if (seg >= remaining && seg > 0) {
                const k = remaining / seg;
                return { x: px + (p.x - px) * k, y: py + (p.y - py) * k, short: false };
            }
            remaining -= seg;
            px = p.x;
            py = p.y;
        }
        return { x: px, y: py, short: true }; // path shorter than the gap: wait at its oldest point
    }
}
