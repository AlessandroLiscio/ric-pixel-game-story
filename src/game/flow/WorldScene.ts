import { assetUrl } from 'asset-url';
import Phaser from 'phaser';
import { startAmbient } from '../ambient';
import { tvPortalGlow } from '../ambient/life';
import { audio } from '../audio';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { joinFx, resultFx } from '../fx/moments';
import { MINIGAME_DONE, type MinigameDone, type MinigameInit } from '../minigames/types';
import { Party } from '../party/Party';
import { idleLife } from '../party/idle';
import { ensureCharAnims, idleKey, walkKey, type Dir } from '../party/anims';
import { fadeToScene } from '../transitions';
import { showAchievement } from '../ui/Achievement';
import { askChoice } from '../ui/Choice';
import { DialogBox } from '../ui/DialogBox';
import { lines, pixelStyle, t } from '../ui/text';
import { SCENES, person } from './data';
import { BIN_BLOCK, BIN_RANGE, addBin, openPortal } from './props';
import { ACTIVE_MINIGAME_KEY, getRun, type RunState } from './RunState';
import type { BinDef, Facing, NpcDef, Point, Rect, SceneDef } from './sceneTypes';
import { BIN_ITEMS, EGG_ACHIEVEMENT, eggAfterMinigame, isSceneDone, joinersOf, minigamesOf } from './story';
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

// A person whose sheet is not in the game yet (the art of round 4 lands in a later merge) stands as `sconosciuta` in a colour of their own.
// shortcut: remove with the first people.json that lists them.
const STAND_IN = 'sconosciuta';
const STAND_IN_TINT: Record<string, number> = { frangetta: 0xffc4e0, slackgirl1: 0xc4f0ff, slackgirl2: 0xd8ffc4, slackgirl3: 0xffe8a8, albanese1: 0xffc890, albanese2: 0xd0a070, losco: 0x606878 };
const WALK_PX = 70; // px per second of a person walking on their own (the Cortile lads and the girls, the girl who leaves disgusted)
const LOSCO_AFTER = 5; // Cortile: pages of `meet` (up to Ros's line after Davide Gallo) before the hooded man walks up to Lara
const BESIDE = 22; // px between two people standing side by side
// Cortile: the girls and the lad who goes for each of them
const COUPLES = [
    ['ros', 'albanese1'],
    ['giusy', 'albanese2']
] as const;

// The object pictures of public/assets/objects, loaded by the world itself (BootScene does not know them). The glob only tells which files exist
// on this branch, so a missing picture is never requested; its code falls back to a drawn stand-in.
const OBJECT_ART = import.meta.glob('/public/assets/objects/*.png', { query: '?inline', import: 'default' });
const OBJECT_TEXTURES: Record<string, string> = { 'obj-carbonara': 'carbonara.png' };

interface Npc {
    def: NpcDef;
    sprite: Phaser.GameObjects.Sprite;
    /** The sheet the sprite is drawn from (`char-<sheet>`): the person's own, or the stand-in. */
    sheet: string;
    /** talks on X: 'friend' runs the scene's story, 'egg' plays an easter egg, 'bar' is Ros or Giusy while they are with the lads at the Cortile. */
    kind: 'friend' | 'egg' | 'decor' | 'bar';
    /** Walking on their own: nobody to talk to until they arrive. */
    walking?: boolean;
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
    /** Cortile: 'idle' until Ric crosses the trigger zone, 'away' while Ros and Giusy are with the lads, 'back' once they are in the train again. */
    private barState: 'idle' | 'away' | 'back' = 'idle';
    private barZone?: Rect; // the map's `trig_bar` zone in pixels
    private loscoDone = false; // the hooded man walked up to Lara and made his offer
    private tvOn = false; // Giuggiu's TV shows its green picture

    constructor() {
        super('world');
    }

    preload(): void {
        for (const [key, file] of Object.entries(OBJECT_TEXTURES)) {
            if (`/public/assets/objects/${file}` in OBJECT_ART && !this.textures.exists(key)) this.load.image(key, assetUrl(`objects/${file}`));
        }
    }

    init(): void {
        this.barState = 'idle';
        this.barZone = undefined;
        this.loscoDone = false;
        this.tvOn = false;
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

        this.spawnNpcs();
        if (map && this.tw) this.spawnCrowd();
        startAmbient(this, { sceneId: def.id, map: this.tw?.data, spriteOf: (id) => this.npcs.find((n) => n.def.personId === id)?.sprite });
        if (this.tw) {
            const cam = this.cameras.main;
            // The camera runs zoomed with origin 0 (hdCamera.ts), but its follow and clamp code assumes origin 0.5: a half-view offset on
            // the bounds and on the follow target makes both work in the 640x360 logical space.
            const hx = GAME_WIDTH / 2;
            const hy = GAME_HEIGHT / 2;
            cam.setBounds(hx, hy, this.tw.widthPx, this.tw.heightPx);
            cam.startFollow(this.ric, true, 0.12, 0.12, hx, hy);
            cam.setScroll(this.ric.x - hx, this.ric.y - 16 - hy); // startFollow's own first scroll assumes origin 0.5
            cam.scrollX = cam.clampX(cam.scrollX);
            cam.scrollY = cam.clampY(cam.scrollY);
        }
        this.talkHint = this.add.text(0, 0, t('ui.talk'), { ...pixelStyle(16), ...OUTLINE }).setOrigin(0.5, 1).setDepth(900).setVisible(false);
        this.dialog = new DialogBox(this);
        this.spawnBins();
        this.objects = roomObjects(def.id, this.tw);
        const zone = this.tw?.data.points.trig_bar;
        if (zone) this.barZone = { x: zone.x * TILE, y: zone.y * TILE, w: (zone.w ?? 1) * TILE, h: (zone.h ?? 1) * TILE };
        this.showKeyHints();

        const kb = this.input.keyboard!;
        this.arrows = kb.createCursorKeys();
        this.wasd = kb.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' }) as Keys;
        this.shift = kb.addKey('SHIFT');
        kb.on('keydown', this.onKey, this);
        this.events.once('shutdown', () => kb.off('keydown', this.onKey, this));

        this.openDoorIfReady();

        this.cameras.main.fadeIn(300);
        this.showTitle();
        void this.say(lines(`scenes.${def.id}.arrival`)).then(() => (this.busy = false));
    }

    update(_time: number, delta: number): void {
        if (!this.busy) this.moveRic(delta / 1000);
        else if (!this.portalWalk) this.ric.anims.play(`ric-idle-${this.facing}`, true);
        this.party.update();
        this.ric.setDepth((this.ric.getData('sitDepth') as number | undefined) ?? this.ric.y); // napping on the pouf, Ric sits behind it
        this.updateTalkHint();
        this.updateBinHint();
        // Cortile: a few steps in, the Albanian lads go for Ros and Giusy
        if (this.barZone && this.barState === 'idle' && !this.busy && this.inRect(this.barZone) && ['ros', 'giusy'].every((id) => this.run.party.includes(id))) void this.albanesiApproach();

        if (this.doorOpen && this.barState !== 'away' && !this.busy && ((this.def.door && this.inRect(this.def.door, DOOR_SLACK)) || this.atEdge())) this.leave();
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
        const own = this.textures.exists(`char-${npcDef.personId}`);
        const sheet = own ? npcDef.personId : STAND_IN;
        ensureCharAnims(this, sheet);
        const sprite = this.add.sprite(npcDef.x, npcDef.y, `char-${sheet}`, 1).setOrigin(0.5, 1).setDepth(npcDef.y);
        if (!own && STAND_IN_TINT[npcDef.personId]) sprite.setTint(STAND_IN_TINT[npcDef.personId]);
        sprite.play(idleKey(sheet, npcDef.facing));
        // someone on a chair is drawn in front of it (the chair's row sorts at the row's lower edge)
        if (npcDef.seat) sprite.setDepth(npcDef.y + 5);
        else idleLife(this).add(sprite, { look: true, shift: kind !== 'friend', canLook: () => !this.busy });
        const npc: Npc = { def: npcDef, sprite, sheet, kind };
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
            if (n.kind === 'decor' || n.walking) continue;
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
        if (n.def.seat) return; // sitting down, he keeps facing the table
        const dx = this.ric.x - n.sprite.x;
        const dy = this.ric.y - n.sprite.y;
        const dir: Facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        n.sprite.play(idleKey(n.sheet, dir));
    }

    // ---- talking ----

    private onKey(e: KeyboardEvent): void {
        if (e.repeat || this.busy || this.time.now - this.dialog.lastClosed < 250 || performance.now() - this.menuClosedAt < 250) return;
        if (e.code === 'Escape' || e.code === 'KeyC') return this.openMenu(); // C too: the browser keeps Esc to leave fullscreen
        if (e.code === 'KeyZ') return void this.usePortal(); // Z only in free walk: the dialogue box (hold: faster text) and the menus (back) read it themselves
        if (!CONFIRM_CODES.includes(e.code)) return;
        const npc = this.nearestTalkable();
        if (!npc) {
            if (this.nearestBin()) void this.checkBin();
            else if (this.nearestObject()) void this.useObject(this.nearestObject()!);
            return;
        }
        this.busy = true;
        this.face(npc);
        void this.talkTo(npc).then(() => (this.busy = this.leaving));
    }

    /** X next to a person: the friend runs the scene's story, the bar girls the Cortile bar scene, the others play their easter egg (some with a twist). */
    private talkTo(npc: Npc): Promise<void> {
        if (npc.kind === 'friend') return this.talkToFriend(npc);
        if (npc.kind === 'bar') return this.barGirls();
        if (npc.def.personId === 'frangetta') return this.frangetta(npc);
        if (npc.def.personId === 'losco') return this.losco();
        return this.sayEgg(npc.def.egg!); // an egg without an entry in EGG_ACHIEVEMENT (the dog girl) shows no popup
    }

    /** The first time an egg triggers in a run its popup shows (the `achievements` table of dialogue.it.json). */
    private award(id: string | undefined): void {
        if (id) showAchievement(this, id);
    }

    private async sayEgg(egg: string): Promise<void> {
        this.award(EGG_ACHIEVEMENT[egg]);
        await this.say(lines(`easterEggs.${egg}`));
    }

    private async talkToFriend(friend?: Npc): Promise<void> {
        const { def, run } = this;
        const L = (key: string) => lines(`scenes.${def.id}.${key}`);
        // circe has two friends, each with her own minigame (friend: minigame, friend2: minigame2): talking to one plays only
        // her part, in any order; the group joins once both parts are done
        const games = minigamesOf(def);
        const second = !!def.friend2 && friend?.def === def.friend2;
        const mine = def.friend2 ? games.filter((_, i) => (i === 1) === second) : games;
        if (!second && !this.metFriend) {
            const meet = L('meet');
            // Cortile: a few lines in, the hooded man walks up to Lara and makes his offer, then the talk goes on
            if (def.id === 'cortile' && !this.loscoDone) {
                await this.say(meet.slice(0, LOSCO_AFTER));
                await this.losco();
                if (friend) this.face(friend);
                await this.say(meet.slice(LOSCO_AFTER));
            } else await this.say(meet);
        }
        this.metFriend ||= !second;

        for (const id of mine) {
            if (id in run.results) continue; // this friend's part is already done
            const n = games.indexOf(id) ? String(games.indexOf(id) + 1) : ''; // circe: minigameIntro2 / win2 / lose2 for the second one
            // Giuggiu's room: the TV shows Rick and Morty, a green portal picture, while the cat game is set up
            if (def.id === 'giuggiu') this.tvPortal();
            await this.say(L(`minigameIntro${n}`));
            // Casa Circe: with the hash from the bin Ric has an extra exchange with Ros before the roll
            if (def.id === 'circe' && id === 'd20' && run.flags.fumo) await this.say(lines('easterEggs.fumoRos'));
            const result = await this.runMinigame(id);
            run.results[id] = result.won;
            resultFx(this, result.won);
            audio.sfx(result.won ? 'win' : 'lose'); // the minigame already showed its own result panel; only the jingle stays
            await this.say(L(`${result.won ? 'win' : 'lose'}${n}`));
        }
        if (!games.every((id) => id in run.results)) return; // the other friend's part is still to play
        const egg = eggAfterMinigame(def);
        if (egg) await this.sayEgg(egg);
        await this.say(L('join'));
        await this.join(friend!);
    }

    private tvPortal(): void {
        const tv = this.objects.find((o) => o.id === 'tv');
        if (!tv || this.tvOn) return;
        tvPortalGlow(this, tv);
        this.tvOn = true;
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
        this.openDoorIfReady();
    }

    /** The exit opens once the scene's friend joined and, at the Cortile, Ros and Giusy are back in the train. */
    private openDoorIfReady(): void {
        if (this.doorOpen || !isSceneDone(this.def, this.run) || this.barState === 'away') return;
        this.doorOpen = true;
        this.showDoorHint();
    }

    /** In a scrolling room the box moves to the top when Ric (or who he talks to) stands in the lower half of the view, so it never hides the speakers. */
    private async say(dialogLines: ReturnType<typeof lines>): Promise<void> {
        const cam = this.cameras.main;
        // the camera centres Ric's feet exactly on the middle line, so a few pixels of margin keep the box at the bottom there
        const lowest = Math.max(this.ric.y, this.nearestTalkable()?.sprite.y ?? 0);
        this.dialog.setAtTop(!!this.tw && lowest - cam.scrollY > GAME_HEIGHT / 2 + 4); // origin 0: scrollY is the top of the view
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

    /** X next to an object of the room: its lines, or its action (the lamp switches, Ric naps on the pouf until he moves). */
    private async useObject(o: RoomObject): Promise<void> {
        this.busy = true;
        if (o.id === 'lamp' && this.tw) {
            toggleLamp(this, this.tw, o);
            audio.sfx('confirm');
        } else if (o.id === 'puf') {
            this.award('puf');
            await dozeOnPuf(this, this.ric, o);
        }
        const said = lines(`objects.${this.def.id}.${o.id}`);
        if (said.length && o.id !== 'lamp') await this.say(said);
        if (o.id === 'cat') this.cameras.main.shake(150, 0.004); // Giuggiu's sneeze
        this.busy = this.leaving;
    }

    private hasItem(item: string): boolean {
        return item === 'portalGun' ? this.run.portalGun : !!this.run.flags[item];
    }

    /** X next to a bin: the item the room's bin holds (scenes.json `item`), found once per run; a second look says "già preso". */
    private async checkBin(): Promise<void> {
        this.busy = true;
        const item = this.nearestBin()?.item;
        const info = item ? BIN_ITEMS[item] : undefined;
        if (!item || !info || this.hasItem(item)) {
            await this.say([Phaser.Utils.Array.GetRandom(lines('easterEggs.binTaken'))]);
        } else {
            if (item === 'portalGun') this.run.portalGun = true;
            else this.run.flags[item] = true;
            this.award(info.achievement);
            await this.say(lines(`easterEggs.${info.lines}`));
            if (item === 'peroni') await this.drinkPeroni();
        }
        this.busy = this.leaving;
    }

    /** Right after finding the Peroni: drink it or keep it. Drinking sets `peroniBevuta`, which the slack minigame and the fringe girl read. */
    private async drinkPeroni(): Promise<void> {
        if (await askChoice(this, t('ui.drinkPeroni'))) {
            this.run.flags.peroniBevuta = true;
            await this.say(lines('easterEggs.peroniDrink'));
        } else {
            await this.say(lines('easterEggs.peroniKeep'));
        }
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

    /** Z with the portal gun: opens a portal on the wall Ric faces and the whole party walks in; the scene ends as through the exit. */
    private async usePortal(): Promise<void> {
        if (!this.run.portalGun || !this.tw) return;
        if (!this.doorOpen || this.barState === 'away') {
            this.busy = true;
            // the friend joined but Ros and Giusy are still with the lads
            await this.say(lines(isSceneDone(this.def, this.run) && this.barState === 'away' ? 'easterEggs.portalGirls' : 'easterEggs.portalNotYet'));
            this.busy = this.leaving;
            return;
        }
        const wall = this.wallAhead();
        if (!wall) return void audio.sfx('cancel');
        this.busy = true;
        this.award('portal');
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

    // ---- extras with a story of their own ----

    /** Giardini: the girl with the blunt fringe. Ric can ask for her number (yes or no); after a drunk Peroni he burps instead and she walks off. */
    private async frangetta(npc: Npc): Promise<void> {
        const { run } = this;
        if (run.flags.numeroFrangetta) return this.say(lines('easterEggs.frangettaAgain'));
        if (run.flags.peroniBevuta) {
            this.award('rutto');
            await this.say(lines('easterEggs.frangettaBurp'));
            this.cameras.main.shake(260, 0.006);
            this.npcs = this.npcs.filter((n) => n !== npc);
            void this.walkOff(npc.sprite); // she walks to the exit while Ric is free again
            return;
        }
        await this.say(lines('easterEggs.frangetta'));
        if (await askChoice(this, t('ui.askNumber'))) {
            run.flags.numeroFrangetta = true;
            this.award('numero');
            await this.say(lines('easterEggs.frangettaNumber'));
        } else {
            await this.say(lines('easterEggs.frangettaNo'));
        }
    }

    /** Cortile: the hooded man offers Lara some "cocco"; Ric pulls her away and thanks him. The first time, while Lara is still in the room, he walks up to her. */
    private async losco(): Promise<void> {
        const man = this.npcs.find((n) => n.def.personId === 'losco');
        const lara = this.npcs.find((n) => n.kind === 'friend' && n.def.personId === 'lara');
        if (!this.loscoDone && man && lara) {
            this.loscoDone = true;
            man.walking = true;
            const away = this.ric.x < lara.sprite.x ? 1 : -1; // on the side of Lara Ric is not on
            const to = this.beside(lara.sprite, away);
            const facing: Dir = to.x > lara.sprite.x ? 'left' : 'right';
            await Promise.all([this.walkAlong(man.sprite, this.pathTo(man.sprite, to), facing), this.say(lines('easterEggs.loscoApproach'))]);
            man.walking = false;
            lara.sprite.play(idleKey(lara.sheet, facing === 'left' ? 'right' : 'left'));
        }
        this.award('losco');
        await this.say(lines('easterEggs.losco'));
    }

    /** The free spot next to someone, on the `side` asked for (1 right, -1 left) or else on the other one; their own spot when neither is free. */
    private beside(of: Point, side: number): Point {
        const spot = [side, -side].map((s) => ({ x: of.x + s * BESIDE, y: of.y })).find((p) => !this.tw || this.tw.canStand(p.x, p.y));
        return spot ?? { x: of.x, y: of.y };
    }

    // ---- the Cortile lads: Ros and Giusy leave the train, Ric fetches them ----

    /** A few steps in, two Albanian lads walk over to Ros and Giusy; then all four go to the bottom wall and stand close together. */
    private async albanesiApproach(): Promise<void> {
        this.busy = true;
        this.barState = 'away';
        const four: Npc[] = [];
        const approaches: Promise<void>[] = [];
        for (const [girlId, ladId] of COUPLES) {
            const sprite = this.party.release(girlId);
            if (!sprite) continue;
            const def: NpcDef = { personId: girlId, facing: 'down', x: sprite.x, y: sprite.y };
            const girl: Npc = { def, sprite, sheet: girlId, kind: 'bar', walking: true };
            this.npcs.push(girl);
            four.push(girl);
            sprite.play(idleKey(girlId, 'down'));
            const lad = this.npcs.find((n) => n.def.personId === ladId);
            if (!lad) continue;
            lad.walking = true;
            four.push(lad);
            const to = this.beside(sprite, lad.sprite.x < sprite.x ? -1 : 1);
            approaches.push(this.walkAlong(lad.sprite, this.pathTo(lad.sprite, to)));
        }
        await this.say(lines('easterEggs.albanesi')); // the lads cross the room while the narrator speaks
        this.busy = this.leaving; // Ric is free to walk on
        await Promise.all(approaches);
        await Promise.all(
            four.map(async (n) => {
                const points = this.tw?.data.points;
                const id = n.def.personId;
                // shortcut: a map without the wall_* points sends them to the old bar points; drop the fallback once every cortile map has them
                const spot = points?.[`wall_${id}`] ?? points?.[`bar_${id}`] ?? points?.[id];
                if (spot) await this.walkAlong(n.sprite, this.pathTo(n.sprite, feetOf(spot)));
            })
        );
        // each of a couple turns to the other
        for (const [girlId, ladId] of COUPLES) {
            const [a, b] = [girlId, ladId].map((id) => four.find((n) => n.def.personId === id));
            if (!a || !b) continue;
            a.sprite.play(idleKey(a.sheet, b.sprite.x < a.sprite.x ? 'left' : 'right'));
            b.sprite.play(idleKey(b.sheet, a.sprite.x < b.sprite.x ? 'left' : 'right'));
        }
        for (const n of four) n.walking = false; // nobody is talked to until all four have arrived
    }

    /** X on Ros or Giusy while they are with the lads: with the 20 EUR Ric buys the round and the lads leave; after the minigame he can just fetch them; before it they are busy. */
    private async barGirls(): Promise<void> {
        const { run } = this;
        if (run.flags.soldi && !run.flags.soldiUsati) {
            await this.say(lines('easterEggs.barSoldi'));
            run.flags.soldiUsati = true;
            this.award('albanesi');
            for (const lad of this.npcs.filter((n) => n.def.personId.startsWith('albanese'))) {
                this.npcs = this.npcs.filter((n) => n !== lad);
                void this.walkOff(lad.sprite);
            }
            await this.wait(1400);
            await this.say(lines('easterEggs.barSoldiAfter'));
            await this.girlsRejoin();
        } else if (isSceneDone(this.def, run)) {
            await this.say(lines('easterEggs.barFetch'));
            await this.girlsRejoin();
        } else {
            await this.say(lines('easterEggs.barBusy'));
        }
    }

    /** Ros and Giusy walk to Ric and are in the train again; the exit opens if the minigame is done. */
    private async girlsRejoin(): Promise<void> {
        const girls = this.npcs.filter((n) => n.kind === 'bar');
        this.npcs = this.npcs.filter((n) => n.kind !== 'bar');
        await Promise.all(
            girls.map(async (g) => {
                await this.walkAlong(g.sprite, this.pathTo(g.sprite, { x: this.ric.x, y: this.ric.y }));
                g.sprite.destroy();
                this.party.add(g.def.personId);
            })
        );
        this.barState = 'back';
        this.openDoorIfReady();
    }

    /** Someone walks to the room's door and is gone. */
    private async walkOff(sprite: Phaser.GameObjects.Sprite): Promise<void> {
        const d = this.def.door;
        if (d) await this.walkAlong(sprite, this.pathTo(sprite, { x: d.x + d.w / 2, y: d.y + d.h / 2 }));
        sprite.destroy();
    }

    private wait(ms: number): Promise<void> {
        return new Promise((resolve) => this.time.delayedCall(ms, resolve));
    }

    /** The way from one point to another over the free tiles of the room (breadth first, 4 directions), as the feet points to walk through; a straight line when there is none. */
    private pathTo(from: Point, to: Point): Point[] {
        const tw = this.tw;
        if (!tw) return [to];
        const { width, height, collision } = tw.data;
        const tile = (p: Point) => ({ x: Math.floor(p.x / TILE), y: Math.floor((p.y - 1) / TILE) });
        const a = tile(from);
        const b = tile(to);
        const id = (x: number, y: number) => y * width + x;
        const prev = new Map<number, number>([[id(a.x, a.y), -1]]);
        const queue = [a];
        for (let i = 0; i < queue.length && !prev.has(id(b.x, b.y)); i++) {
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const x = queue[i].x + dx;
                const y = queue[i].y + dy;
                if (x < 0 || y < 0 || x >= width || y >= height || collision[y][x] === 1 || prev.has(id(x, y))) continue;
                prev.set(id(x, y), id(queue[i].x, queue[i].y));
                queue.push({ x, y });
            }
        }
        if (!prev.has(id(b.x, b.y))) return [to];
        const tiles: Point[] = [];
        for (let k = id(b.x, b.y); k !== -1; k = prev.get(k)!) tiles.unshift({ x: k % width, y: Math.floor(k / width) });
        const pts = [...tiles.slice(1).map(feetOf), to];
        // keep only the corners: a straight run is one walk
        return pts.filter((p, i) => {
            const before = i ? pts[i - 1] : from;
            const after = pts[i + 1];
            return !after || !((before.x === p.x && p.x === after.x) || (before.y === p.y && p.y === after.y));
        });
    }

    /** A person walks through the points one after the other at WALK_PX, with their walk animation, then stands facing `end` (the way of their last step when omitted). */
    private async walkAlong(sprite: Phaser.GameObjects.Sprite, path: Point[], end?: Dir): Promise<void> {
        const sheet = sprite.texture.key.slice('char-'.length);
        let dir: Dir = end ?? 'down';
        for (const p of path) {
            const dx = p.x - sprite.x;
            const dy = p.y - sprite.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 0.5 || !sprite.active) continue;
            dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
            sprite.play(walkKey(sheet, dir), true);
            await new Promise<void>((resolve) =>
                this.tweens.add({ targets: sprite, x: p.x, y: p.y, duration: (dist / WALK_PX) * 1000, onUpdate: () => sprite.setDepth(sprite.y), onComplete: () => resolve() })
            );
        }
        if (sprite.active) sprite.play(idleKey(sheet, end ?? dir), true);
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
        if (next >= SCENES.length) return fadeToScene(this, 'ending');
        this.run.sceneIndex = next;
        fadeToScene(this, 'world');
    }
}
