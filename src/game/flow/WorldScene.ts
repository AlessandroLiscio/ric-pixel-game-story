import Phaser from 'phaser';
import { startAmbient } from '../ambient';
import { audio } from '../audio';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { joinFx, resultFx } from '../fx/moments';
import { MINIGAME_DONE, type MinigameDone, type MinigameInit } from '../minigames/types';
import { Party } from '../party/Party';
import { idleLife } from '../party/idle';
import { ensureCharAnims, walkKey, type Dir } from '../party/anims';
import { fadeToScene } from '../transitions';
import { DialogBox } from '../ui/DialogBox';
import { lines, pixelStyle, t } from '../ui/text';
import { SCENES, person } from './data';
import { BIN_BLOCK, BIN_RANGE, addBin, openPortal } from './props';
import { ACTIVE_MINIGAME_KEY, getRun, type RunState } from './RunState';
import type { BinDef, Facing, NpcDef, Rect, SceneDef } from './sceneTypes';
import { divanoEggs, eggAfterMinigame, isSceneDone, joinersOf, minigamesOf } from './story';
import { MAPS, TILE, TileWorld, resolveMapScene, feetOf } from './tileMap';
import { dozeOnPuf, objectNear, roomObjects, toggleLamp, type RoomObject } from './objects';

const SPEED = 80; // px per second
const RUN_FACTOR = 1.8; // holding Shift
const RUN_ANIM = 1.7; // walk animation speed while running
const EDGE = 4; // px: a scene with `exit: "edge"` is left when Ric's feet get this close to a limit of the walkable map
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
    private metFriend = false; // the scene's meet lines played (circe: only once, when Ros is the first one talked to)
    private shift!: Phaser.Input.Keyboard.Key;
    /** Sprites of the bins the flow draws itself (the others are part of the room map); Ric cannot walk into them. */
    private binSprites: Phaser.GameObjects.Image[] = [];
    private binHint!: Phaser.GameObjects.Text;
    private objects: RoomObject[] = [];
    private menuClosedAt = -1000; // performance.now() when the Esc menu closed: ignores the key press that closed it
    private portalWalk = false; // Ric is walking into a portal: his walk animation is not reset to idle

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
        this.metFriend = false;
        this.leaving = false;
        this.doorHint = undefined;
        this.binSprites = [];
        this.portalWalk = false;
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
        audio.playAmbience(def.id);

        ensureCharAnims(this, 'ric');
        this.ric = this.add.sprite(def.spawn.x, def.spawn.y, 'char-ric', 1).setOrigin(0.5, 1);
        if (map) this.facing = (def.spawn as { facing?: Facing }).facing ?? 'down';
        this.ric.play(`ric-idle-${this.facing}`);
        this.party = new Party(this, this.ric);
        run.party.forEach((id) => this.party.add(id, { instant: true })); // a rebuilt party: no pop-in, no join sound
        // Ric never walks in divano before the credits, so the trail would keep everyone hidden: line them up beside him
        if (!def.friend) this.party.lineUpBeside(28, this.facing);

        this.spawnNpcs();
        if (map && this.tw) this.spawnCrowd();
        startAmbient(this, { sceneId: def.id, map: this.tw?.data, spriteOf: (id) => this.npcs.find((n) => n.def.personId === id)?.sprite });
        if (this.tw) {
            const cam = this.cameras.main;
            cam.setBounds(0, 0, this.tw.widthPx, this.tw.heightPx);
            cam.startFollow(this.ric, true, 0.12, 0.12);
            cam.centerOn(this.ric.x, this.ric.y - 16);
        }
        this.talkHint = this.add.text(0, 0, t('ui.talk'), { ...pixelStyle(16), ...OUTLINE }).setOrigin(0.5, 1).setDepth(900).setVisible(false);
        this.dialog = new DialogBox(this);
        this.spawnBins();
        this.objects = roomObjects(def.id, this.tw);
        this.showKeyHints();

        const kb = this.input.keyboard!;
        this.arrows = kb.createCursorKeys();
        this.wasd = kb.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' }) as Keys;
        this.shift = kb.addKey('SHIFT');
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
        else if (!this.portalWalk) this.ric.anims.play(`ric-idle-${this.facing}`, true);
        this.party.update();
        this.ric.setDepth(this.ric.y);
        this.updateTalkHint();
        this.updateBinHint();

        if (this.doorOpen && !this.busy && ((this.def.door && this.inRect(this.def.door, DOOR_SLACK)) || this.atEdge())) this.leave();
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
        const running = this.shift.isDown;
        this.ric.anims.timeScale = running ? RUN_ANIM : 1;
        if (!dx && !dy) {
            this.ric.anims.play(`ric-idle-${this.facing}`, true);
            return;
        }
        this.facing = dx ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        // each axis on its own, so Ric slides along the edge of a walk rectangle
        const speed = running ? SPEED * RUN_FACTOR : SPEED;
        if (dx) this.ric.x = this.reach(dx * speed * dt, (v) => this.canStand(v, this.ric.y), this.ric.x);
        if (dy) this.ric.y = this.reach(dy * speed * dt, (v) => this.canStand(this.ric.x, v), this.ric.y);
        this.ric.anims.play(`ric-walk-${this.facing}`, true);
    }

    /** Moves `from` by `step`, or as far as it can in 1 px steps when the full step is blocked, so Ric always reaches
     *  walls and map edges (an edge exit must not depend on the frame rate). */
    private reach(step: number, ok: (v: number) => boolean, from: number): number {
        if (ok(from + step)) return from + step;
        const s = Math.sign(step);
        let v = from;
        while (Math.abs(v + s - from) <= Math.abs(step) && ok(v + s)) v += s;
        return v;
    }

    private canStand(x: number, y: number): boolean {
        if (this.tw) return this.tw.canStand(x, y) && !this.blockedByPerson(x, y);
        return this.def.walk.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    }

    /** True when (x, y) is inside a person and Ric is not already inside that person (so he can always step out). */
    private blockedByPerson(x: number, y: number): boolean {
        const inside = (px: number, py: number, s: Phaser.GameObjects.Sprite) => Math.abs(px - s.x) < NPC_BLOCK.x && Math.abs(py - s.y) < NPC_BLOCK.y;
        const people = [...this.npcs.map((n) => n.sprite), ...this.crowd];
        const inBin = (px: number, py: number, s: Phaser.GameObjects.Image) => Math.abs(px - s.x) < BIN_BLOCK.x && Math.abs(py - s.y) < BIN_BLOCK.y;
        return people.some((s) => inside(x, y, s) && !inside(this.ric.x, this.ric.y, s)) || this.binSprites.some((s) => inBin(x, y, s) && !inBin(this.ric.x, this.ric.y, s));
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
        idleLife(this).add(sprite, { look: true, shift: kind !== 'friend', canLook: () => !this.busy });
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
            idleLife(this).add(sprite, { period: c.bob, look: true, shift: true }); // a soft breath, now and then a glance or a shift of weight
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
        if (e.repeat || this.busy || this.time.now - this.dialog.lastClosed < 250 || performance.now() - this.menuClosedAt < 250) return;
        if (e.code === 'Escape' || e.code === 'KeyC') return this.openMenu(); // C too: the browser keeps Esc to leave fullscreen
        if (e.code === 'KeyP') return void this.usePortal();
        if (!CONFIRM_CODES.includes(e.code)) return;
        const npc = this.nearestTalkable();
        if (!npc) {
            if (this.nearestBin()) void this.checkBin();
            else if (this.nearestObject()) void this.useObject(this.nearestObject()!);
            return;
        }
        this.busy = true;
        this.face(npc);
        const story = npc.kind === 'friend' ? this.talkToFriend(npc) : this.say(lines(`easterEggs.${npc.def.egg}`));
        void story.then(() => (this.busy = this.leaving));
    }

    private async talkToFriend(friend?: Npc): Promise<void> {
        const { def, run } = this;
        const L = (key: string) => lines(`scenes.${def.id}.${key}`);
        // circe has two friends, each with her own minigame (friend: minigame, friend2: minigame2): talking to one plays only
        // her part, in any order; the group joins once both parts are done
        const games = minigamesOf(def);
        const second = !!def.friend2 && friend?.def === def.friend2;
        const mine = def.friend2 ? games.filter((_, i) => (i === 1) === second) : games;
        if (!second && !this.metFriend) await this.say(L('meet'));
        this.metFriend ||= !second;

        if (def.id === 'divano') {
            for (const egg of divanoEggs(run.results)) await this.say(lines(`easterEggs.${egg}`));
            await this.say(L('join'));
            this.leave();
            return;
        }

        for (const id of mine) {
            if (id in run.results) continue; // this friend's part is already done
            const n = games.indexOf(id) ? String(games.indexOf(id) + 1) : ''; // circe: minigameIntro2 / win2 / lose2 for the second one
            await this.say(L(`minigameIntro${n}`));
            const result = await this.runMinigame(id);
            run.results[id] = result.won;
            resultFx(this, result.won);
            audio.sfx(result.won ? 'win' : 'lose'); // the minigame already showed its own result panel; only the jingle stays
            await this.say(L(`${result.won ? 'win' : 'lose'}${n}`));
        }
        if (!games.every((id) => id in run.results)) return; // the other friend's part is still to play
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

    // ---- menu, edge exit, bins and the portal gun ----

    /** Esc: the menu scene runs over this one, which stays paused (and drawn) until the menu resumes it. */
    private openMenu(): void {
        this.busy = true;
        audio.sfx('confirm');
        this.events.once('resume', () => {
            this.input.keyboard!.resetKeys();
            this.menuClosedAt = performance.now();
            this.busy = this.leaving;
        });
        this.scene.launch('menu');
        this.scene.pause();
    }

    /** A room with `exit: "edge"` is left by walking to a limit of the map (Ric's feet box is 18 x 7 px, see TileWorld.canStand). */
    private atEdge(): boolean {
        if (this.def.exit !== 'edge' || !this.tw) return false;
        const { x, y } = this.ric;
        return x <= 9 + EDGE || x >= this.tw.widthPx - 9 - EDGE || y <= 7 + EDGE || y >= this.tw.heightPx - EDGE;
    }

    private spawnBins(): void {
        for (const b of this.def.bins ?? []) if (b.draw !== false) this.binSprites.push(addBin(this, b.x, b.y));
        this.binHint = this.add.text(0, 0, t('ui.look'), { ...pixelStyle(16), ...OUTLINE }).setOrigin(0.5, 1).setDepth(900).setVisible(false);
    }

    private showKeyHints(): void {
        this.add.text(8, 6, `${t('ui.menu')}\n${t('ui.run')}`, { ...pixelStyle(16, '#cfe0ff'), ...OUTLINE }).setAlpha(0.85).setDepth(900).setScrollFactor(0);
    }

    private nearestBin(): BinDef | undefined {
        return (this.def.bins ?? []).find((b) => Phaser.Math.Distance.Between(this.ric.x, this.ric.y, b.x, b.y) <= BIN_RANGE);
    }

    private updateBinHint(): void {
        const free = !this.busy && !this.nearestTalkable();
        const bin = free ? this.nearestBin() : undefined;
        const obj = free && !bin ? this.nearestObject() : undefined;
        this.binHint.setVisible(!!bin || !!obj);
        if (bin) this.binHint.setPosition(bin.x, bin.y - 28);
        else if (obj) this.binHint.setPosition(obj.x + obj.w / 2, obj.y - 4);
    }

    private nearestObject(): RoomObject | undefined {
        return objectNear(this.objects, this.ric.x, this.ric.y);
    }

    /** X next to an object of the room: its lines, or its action (the lamp switches, Ric naps on the pouf). */
    private async useObject(o: RoomObject): Promise<void> {
        this.busy = true;
        if (o.id === 'lamp' && this.tw) {
            toggleLamp(this, this.tw, o);
            audio.sfx('confirm');
        } else if (o.id === 'puf') {
            await dozeOnPuf(this, this.ric, o);
        }
        const said = lines(`objects.${this.def.id}.${o.id}`);
        if (said.length && o.id !== 'lamp') await this.say(said);
        if (o.id === 'cat') this.cameras.main.shake(150, 0.004); // Giuggiu's sneeze
        this.busy = this.leaving;
    }

    /** X next to a bin. The first one Ric checks in a run holds Rick's portal gun; the others hold a joke. */
    private async checkBin(): Promise<void> {
        this.busy = true;
        if (!this.run.portalGun) {
            this.run.portalGun = true;
            await this.say(lines('easterEggs.portalFound'));
        } else {
            await this.say([Phaser.Utils.Array.GetRandom(lines('easterEggs.binEmpty'))]);
        }
        this.busy = this.leaving;
    }

    /** The wall in front of Ric, if one is within reach: where it meets the floor in his lane, and whether it faces him. */
    private wallAhead(): { x: number; y: number; wide: boolean } | undefined {
        const tw = this.tw!;
        const { x, y } = this.ric;
        for (let reach = 2; reach <= 24; reach += 2) {
            const probe = { up: [x, y - 7 - reach], down: [x, y - 1 + reach], left: [x - 9 - reach, y - 4], right: [x + 9 + reach, y - 4] }[this.facing];
            if (!tw.solidAt(probe[0], probe[1])) continue;
            const edgeX = Math.floor(probe[0] / TILE) * TILE;
            const edgeY = Math.floor(probe[1] / TILE) * TILE;
            if (this.facing === 'up') return { x, y: edgeY + TILE, wide: true };
            if (this.facing === 'down') return { x, y: edgeY, wide: true };
            return { x: this.facing === 'left' ? edgeX + TILE : edgeX, y, wide: false };
        }
        return undefined;
    }

    /** P with the portal gun: opens a portal on the wall Ric faces and the whole party walks in; the scene ends as through the exit. */
    private async usePortal(): Promise<void> {
        if (!this.run.portalGun || !this.tw) return;
        if (!this.doorOpen) {
            this.busy = true;
            await this.say(lines('easterEggs.portalNotYet'));
            this.busy = this.leaving;
            return;
        }
        const wall = this.wallAhead();
        if (!wall) return void audio.sfx('cancel');
        this.busy = true;
        this.portalWalk = true;
        const face = this.facing;
        // the oval stands on the wall face above the contact line; on a wall seen from above it lies on the wall top
        const portal = openPortal(this, wall.x, face === 'down' ? wall.y + 4 : face === 'up' ? wall.y - 16 : wall.y - 14, wall.wide);
        const base = { x: wall.x + (face === 'left' ? 3 : face === 'right' ? -3 : 0), y: wall.y + (face === 'up' ? 3 : face === 'down' ? -2 : 0) };
        const wait = (ms: number) => new Promise<void>((resolve) => this.time.delayedCall(ms, resolve));
        const move = (s: Phaser.GameObjects.Sprite, delay: number, speed: number) =>
            new Promise<void>((resolve) => {
                const dx = base.x - s.x;
                const dy = base.y - s.y;
                const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
                const id = s.texture.key.slice('char-'.length);
                this.tweens.add({
                    targets: s,
                    x: base.x,
                    y: base.y,
                    delay,
                    duration: Math.max(200, (Math.hypot(dx, dy) / speed) * 1000),
                    onStart: () => s.play(walkKey(id, dir)),
                    onComplete: () => this.tweens.add({ targets: s, alpha: 0, scaleX: 0.3, scaleY: 0.3, duration: 150, onComplete: () => resolve() })
                });
            });

        await wait(450);
        await move(this.ric, 0, SPEED);
        // the followers walk in one after the other, the one nearest to the portal first
        this.party.setPaused(true);
        const mates = this.children.list
            .filter((o): o is Phaser.GameObjects.Sprite => o instanceof Phaser.GameObjects.Sprite && o !== this.ric && this.run.party.some((id) => o.texture.key === `char-${id}`) && !this.npcs.some((n) => n.sprite === o))
            .sort((a, b) => Phaser.Math.Distance.BetweenPoints(a, base) - Phaser.Math.Distance.BetweenPoints(b, base));
        await Promise.all(mates.map((m, i) => move(m, i * 160, SPEED * 1.4)));
        portal.close();
        await wait(300);
        this.leave();
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
