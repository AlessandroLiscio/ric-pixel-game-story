import Phaser from 'phaser';
import { startAmbient } from '../ambient';
import { audio } from '../audio';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { joinFx, resultFx } from '../fx/moments';
import { MINIGAME_DONE, type MinigameDone, type MinigameInit } from '../minigames/types';
import { Party } from '../party/Party';
import { ensureCharAnims } from '../party/anims';
import { fadeToScene } from '../transitions';
import { DialogBox } from '../ui/DialogBox';
import { lines, pixelStyle, t } from '../ui/text';
import { SCENES, person } from './data';
import { ACTIVE_MINIGAME_KEY, getRun, type RunState } from './RunState';
import type { Facing, NpcDef, Rect, SceneDef } from './sceneTypes';
import { divanoEggs, eggAfterMinigame, isSceneDone, joinersOf, minigamesOf } from './story';
import { MAPS, TileWorld, resolveMapScene, feetOf } from './tileMap';

const SPEED = 80; // px per second
const TALK_RANGE = 34;
const TALK_RANGE_TILES = 52; // a tile room is bigger and has counters between people
const NPC_BLOCK = { x: 13, y: 7 }; // Ric cannot walk into a person: half width and half depth around the feet in a tile room
const DOOR_SLACK = 6; // the door counts a few pixels outside its rectangle, so walk limits that stop short still reach it
const CONFIRM_CODES = ['KeyX', 'Enter', 'Space'];
const OUTLINE = { stroke: '#0a1040', strokeThickness: 3 };

interface Npc {
    def: NpcDef;
    sprite: Phaser.GameObjects.Sprite;
    /** talks on X: 'friend' runs the scene's story, 'egg' plays an easter egg. */
    kind: 'friend' | 'egg' | 'decor';
}

type Keys = Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

/** One room: Ric walks inside the walk rectangles, talks to the friend (dialogue, minigame, join) and leaves by the door. */
export class WorldScene extends Phaser.Scene {
    private run!: RunState;
    private def!: SceneDef;
    private ric!: Phaser.GameObjects.Sprite;
    private party!: Party;
    private dialog!: DialogBox;
    private arrows!: Keys;
    private wasd!: Keys;
    private npcs: Npc[] = [];
    /** Set in a tile room (scenes.json `map`); the old picture rooms leave it undefined. */
    private tw?: TileWorld;
    private crowd: Phaser.GameObjects.Sprite[] = [];
    private talkHint!: Phaser.GameObjects.Text;
    private doorHint?: Phaser.GameObjects.Text;
    private facing: Facing = 'down';
    private busy = true; // true while a dialogue, a minigame or a fade owns the player
    private doorOpen = false;
    private leaving = false;

    constructor() {
        super('world');
    }

    init(): void {
        this.npcs = [];
        this.crowd = [];
        this.tw = undefined;
        this.facing = 'down';
        this.busy = true;
        this.doorOpen = false;
        this.leaving = false;
        this.doorHint = undefined;
    }

    create(): void {
        this.run = getRun(this.game);
        const entry = SCENES[Phaser.Math.Clamp(this.run.sceneIndex, 0, SCENES.length - 1)];
        const map = entry.map ? MAPS[entry.map] : undefined;
        if (entry.map && !map) throw new Error(`scenes.json names the map "${entry.map}" but src/data/maps has no such file`);
        this.def = map ? resolveMapScene(entry, map) : entry;
        const { def, run } = this;

        if (map) {
            this.tw = new TileWorld(this, map);
        } else {
            this.add.image(0, 0, def.background).setOrigin(0).setDepth(-1);
            // the picture has no door here (giuggiu): a plain panel marks the exit
            if (def.door?.draw) this.add.rectangle(def.door.x, def.door.y, def.door.w, def.door.h, 0x5a3a22).setOrigin(0).setStrokeStyle(2, 0xd9b27a).setDepth(0);
        }
        audio.playTrack(def.music);

        ensureCharAnims(this, 'ric');
        this.ric = this.add.sprite(def.spawn.x, def.spawn.y, 'char-ric', 1).setOrigin(0.5, 1);
        if (map) this.facing = (def.spawn as { facing?: Facing }).facing ?? 'down';
        this.ric.play(`ric-idle-${this.facing}`);
        this.party = new Party(this, this.ric);
        run.party.forEach((id) => this.party.add(id));

        this.spawnNpcs();
        if (map && this.tw) this.spawnCrowd();
        startAmbient(this, { sceneId: def.id, lights: this.tw?.data.lights, spriteOf: (id) => this.npcs.find((n) => n.def.personId === id)?.sprite });
        if (this.tw) {
            const cam = this.cameras.main;
            cam.setBounds(0, 0, this.tw.widthPx, this.tw.heightPx);
            cam.startFollow(this.ric, true, 0.12, 0.12);
            cam.centerOn(this.ric.x, this.ric.y - 16);
        }
        this.talkHint = this.add.text(0, 0, t('ui.talk'), { ...pixelStyle(16), ...OUTLINE }).setOrigin(0.5, 1).setDepth(900).setVisible(false);
        this.dialog = new DialogBox(this);

        const kb = this.input.keyboard!;
        this.arrows = kb.createCursorKeys();
        this.wasd = kb.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' }) as Keys;
        kb.on('keydown', this.onKey, this);
        this.events.once('shutdown', () => kb.off('keydown', this.onKey, this));

        this.doorOpen = isSceneDone(def, run);
        if (this.doorOpen) this.showDoorHint();

        this.cameras.main.fadeIn(300);
        this.showTitle();
        // divano has no friend to talk to: the finale (meet, eggs, join) plays by itself after the arrival lines
        void this.say(lines(`scenes.${def.id}.arrival`)).then(() => {
            if (def.friend) this.busy = false;
            else void this.talkToFriend();
        });
    }

    update(_time: number, delta: number): void {
        if (!this.busy) this.moveRic(delta / 1000);
        else this.ric.anims.play(`ric-idle-${this.facing}`, true);
        this.party.update();
        this.ric.setDepth(this.ric.y);
        this.updateTalkHint();

        if (this.doorOpen && !this.busy && this.def.door && this.inRect(this.def.door, DOOR_SLACK)) this.leave();
    }

    // ---- walking ----

    private moveRic(dt: number): void {
        const a = this.arrows;
        const w = this.wasd;
        let dx = Number(a.right.isDown || w.right.isDown) - Number(a.left.isDown || w.left.isDown);
        let dy = Number(a.down.isDown || w.down.isDown) - Number(a.up.isDown || w.up.isDown);
        if (dx && dy) {
            // 4-directional: the axis pressed last wins
            const latest = (k: Phaser.Input.Keyboard.Key[]) => Math.max(...k.map((x) => (x.isDown ? x.timeDown : 0)));
            if (latest([a.left, a.right, w.left, w.right]) > latest([a.up, a.down, w.up, w.down])) dy = 0;
            else dx = 0;
        }
        if (!dx && !dy) {
            this.ric.anims.play(`ric-idle-${this.facing}`, true);
            return;
        }
        this.facing = dx ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        // each axis on its own, so Ric slides along the edge of a walk rectangle
        const nx = this.ric.x + dx * SPEED * dt;
        if (this.canStand(nx, this.ric.y)) this.ric.x = nx;
        const ny = this.ric.y + dy * SPEED * dt;
        if (this.canStand(this.ric.x, ny)) this.ric.y = ny;
        this.ric.anims.play(`ric-walk-${this.facing}`, true);
    }

    private canStand(x: number, y: number): boolean {
        if (this.tw) return this.tw.canStand(x, y) && !this.blockedByPerson(x, y);
        return this.def.walk.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    }

    /** True when (x, y) is inside a person and Ric is not already inside that person (so he can always step out). */
    private blockedByPerson(x: number, y: number): boolean {
        const inside = (px: number, py: number, s: Phaser.GameObjects.Sprite) => Math.abs(px - s.x) < NPC_BLOCK.x && Math.abs(py - s.y) < NPC_BLOCK.y;
        const people = [...this.npcs.map((n) => n.sprite), ...this.crowd];
        return people.some((s) => inside(x, y, s) && !inside(this.ric.x, this.ric.y, s));
    }

    private inRect(r: Rect, slack = 0): boolean {
        const { x, y } = this.ric;
        return x >= r.x - slack && x <= r.x + r.w + slack && y >= r.y - slack && y <= r.y + r.h + slack;
    }

    // ---- people ----

    private spawnNpcs(): void {
        const { def, run } = this;
        if (def.friend && !isSceneDone(def, run)) {
            this.addNpc(def.friend, 'friend');
            if (def.friend2) this.addNpc(def.friend2, 'friend'); // circe: Giusy joins together with Ros
        }
        for (const extra of def.extras) {
            if (!this.npcs.some((n) => n.def.personId === extra.personId && n.kind === 'friend')) this.addNpc(extra, extra.egg ? 'egg' : 'decor');
        }
    }

    private addNpc(npcDef: NpcDef, kind: Npc['kind']): Npc {
        ensureCharAnims(this, npcDef.personId);
        const sprite = this.add.sprite(npcDef.x, npcDef.y, `char-${npcDef.personId}`, 1).setOrigin(0.5, 1).setDepth(npcDef.y);
        sprite.play(`${npcDef.personId}-idle-${npcDef.facing}`);
        const npc: Npc = { def: npcDef, sprite, kind };
        this.npcs.push(npc);
        return npc;
    }

    /** The audience of a tile room: people standing still, breathing in slow bobs. Ric cannot walk through them. */
    private spawnCrowd(): void {
        for (const c of this.tw!.data.crowd) {
            const id = c.sheet;
            ensureCharAnims(this, id);
            const at = feetOf(c);
            const sprite = this.add.sprite(at.x, at.y, `char-${id}`, 1).setOrigin(0.5, 1).setDepth(at.y);
            sprite.play(`${id}-idle-${c.facing}`);
            this.tweens.add({ targets: sprite, y: at.y - 1, duration: c.bob / 2, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: Phaser.Math.Between(0, c.bob) });
            this.crowd.push(sprite);
        }
    }

    private nearestTalkable(): Npc | undefined {
        let best: Npc | undefined;
        let bestDist = this.tw ? TALK_RANGE_TILES : TALK_RANGE;
        for (const n of this.npcs) {
            if (n.kind === 'decor') continue;
            const d = Phaser.Math.Distance.Between(this.ric.x, this.ric.y, n.sprite.x, n.sprite.y);
            if (d <= bestDist) [best, bestDist] = [n, d];
        }
        return best;
    }

    private updateTalkHint(): void {
        const near = this.busy ? undefined : this.nearestTalkable();
        this.talkHint.setVisible(!!near);
        if (near) this.talkHint.setPosition(near.sprite.x, near.sprite.y - 36);
    }

    private face(n: Npc): void {
        const dx = this.ric.x - n.sprite.x;
        const dy = this.ric.y - n.sprite.y;
        const dir: Facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        n.sprite.play(`${n.def.personId}-idle-${dir}`);
    }

    // ---- talking ----

    private onKey(e: KeyboardEvent): void {
        if (e.repeat || !CONFIRM_CODES.includes(e.code) || this.busy || this.time.now - this.dialog.lastClosed < 250) return;
        const npc = this.nearestTalkable();
        if (!npc) return;
        this.busy = true;
        this.face(npc);
        const story = npc.kind === 'friend' ? this.talkToFriend(npc) : this.say(lines(`easterEggs.${npc.def.egg}`));
        void story.then(() => (this.busy = this.leaving));
    }

    private async talkToFriend(friend?: Npc): Promise<void> {
        const { def, run } = this;
        const L = (key: string) => lines(`scenes.${def.id}.${key}`);
        await this.say(L('meet'));

        if (def.id === 'divano') {
            for (const egg of divanoEggs(run.results)) await this.say(lines(`easterEggs.${egg}`));
            await this.say(L('join'));
            this.leave();
            return;
        }

        for (const [i, id] of minigamesOf(def).entries()) {
            const n = i ? String(i + 1) : ''; // circe: minigameIntro2 / win2 / lose2 for the second one
            await this.say(L(`minigameIntro${n}`));
            const result = await this.runMinigame(id);
            run.results[id] = result.won;
            resultFx(this, result.won);
            await this.banner(result.won ? t('ui.win') : t('ui.lose'), result.won);
            await this.say(L(`${result.won ? 'win' : 'lose'}${n}`));
        }
        const egg = eggAfterMinigame(def);
        if (egg) await this.say(lines(`easterEggs.${egg}`));
        await this.say(L('join'));
        await this.join(friend!);
    }

    private async join(friend: Npc): Promise<void> {
        for (const id of joinersOf(this.def)) {
            if (!this.run.party.includes(id)) this.run.party.push(id);
            this.party.add(id);
            const spot = this.party.positions().find((p) => p.id === id);
            if (spot) joinFx(this, spot.x, spot.y);
            this.npcs.filter((n) => n.kind === 'friend' && n.def.personId === id).forEach((n) => n.sprite.destroy());
            await this.banner(`${person(id)?.name ?? id} ${t('ui.joined')}`, true, 20);
        }
        this.npcs = this.npcs.filter((n) => n !== friend && n.sprite.active);
        this.doorOpen = true;
        this.showDoorHint();
    }

    /** In a scrolling room the box moves to the top when Ric (or who he talks to) stands in the lower half of the view, so it never hides the speakers. */
    private async say(dialogLines: ReturnType<typeof lines>): Promise<void> {
        const cam = this.cameras.main;
        // the camera centres Ric's feet exactly on the middle line, so a few pixels of margin keep the box at the bottom there
        const lowest = Math.max(this.ric.y, this.nearestTalkable()?.sprite.y ?? 0);
        this.dialog.setAtTop(!!this.tw && lowest - cam.scrollY > GAME_HEIGHT / 2 + 4);
        await this.dialog.show(dialogLines);
    }

    /** Sleeps this scene, runs the minigame scene on its own, and resumes when it reports MINIGAME_DONE. */
    private runMinigame(id: string): Promise<MinigameDone> {
        return new Promise((resolve) => {
            const key = `minigame-${id}`;
            const onDone = (done: MinigameDone) => {
                if (done.id !== id) return;
                this.game.events.off(MINIGAME_DONE, onDone);
                this.game.registry.set(ACTIVE_MINIGAME_KEY, undefined);
                this.scene.stop(key);
                this.events.once('wake', () => {
                    this.input.keyboard!.resetKeys();
                    audio.playTrack(this.def.music);
                    resolve(done);
                });
                this.scene.wake();
            };
            this.game.events.on(MINIGAME_DONE, onDone);
            this.events.once('shutdown', () => this.game.events.off(MINIGAME_DONE, onDone));
            this.game.registry.set(ACTIVE_MINIGAME_KEY, id);
            this.scene.launch(key, { sceneId: this.def.id } satisfies MinigameInit);
            this.scene.sleep();
        });
    }

    // ---- texts on screen ----

    private showTitle(): void {
        const title = this.add.text(GAME_WIDTH / 2, 8, this.def.title, { ...pixelStyle(16), ...OUTLINE }).setOrigin(0.5, 0).setDepth(900).setScrollFactor(0);
        this.tweens.add({ targets: title, alpha: 0, delay: 2600, duration: 600, onComplete: () => title.destroy() });
    }

    private showDoorHint(): void {
        this.doorHint ??= this.add.text(GAME_WIDTH / 2, 8, t('ui.exit'), { ...pixelStyle(16, '#ffe27a'), ...OUTLINE }).setOrigin(0.5, 0).setDepth(900).setScrollFactor(0);
        this.tweens.add({ targets: this.doorHint, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
    }

    /** A big word in the middle of the screen for about a second. */
    private banner(text: string, good: boolean, size = 32): Promise<void> {
        audio.sfx(good ? 'win' : 'lose');
        const label = this.add
            .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, text, { ...pixelStyle(size, good ? '#ffe27a' : '#ff8a8a'), ...OUTLINE })
            .setOrigin(0.5)
            .setDepth(950)
            .setScrollFactor(0);
        this.tweens.add({ targets: label, scale: { from: 0.6, to: 1 }, duration: 220, ease: 'Back.Out' });
        return new Promise((resolve) =>
            this.time.delayedCall(1100, () => {
                label.destroy();
                resolve();
            })
        );
    }

    // ---- leaving ----

    private leave(): void {
        this.busy = true;
        this.leaving = true;
        const next = this.run.sceneIndex + 1;
        if (this.def.id === 'divano' || next >= SCENES.length) return fadeToScene(this, 'ending');
        this.run.sceneIndex = next;
        fadeToScene(this, 'world');
    }
}
