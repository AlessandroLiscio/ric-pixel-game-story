import Phaser from 'phaser';
import { audio } from '../../audio';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config';
import { ensureCharAnims } from '../../party/anims';
import { InstructionCard } from '../../ui/InstructionCard';
import { panelTexture } from '../../ui/panel';
import { pixelStyle, t } from '../../ui/text';
import { MINIGAME_DONE, type MinigameDone } from '../types';
import { catSmokeCloud } from '../fx';
import { LABELS } from './labels';

type Face = 'down' | 'left' | 'right' | 'up';

const ID = 'cat-smoke';
const SHADOW = { offsetX: 1, offsetY: 1, color: '#0a1040', blur: 0, stroke: false, fill: true };

// The three sofas as in Casa Giuggiu: the long burgundy one along the left wall, the navy one in the middle facing down toward the TV, the navy one against
// the right wall (arrow keys LEFT, UP, RIGHT). `len` runs along the sofa, `thick` across it; `rot` turns the horizontal drawing so its back rest meets the wall.
const SOFAS = [
    { cx: 46, cy: 184, len: 128, thick: 64, rot: -90, color: 0x8a2a3c, lift: 90 },
    { cx: 320, cy: 184, len: 160, thick: 68, rot: 0, color: 0x2e4a86, lift: 80 },
    { cx: 594, cy: 184, len: 116, thick: 64, rot: 90, color: 0x2e4a86, lift: 90 }
];
// Where the cat may stand (feet). The floor nodes are open floor; the `under` nodes sit under a sofa (0, 1, 2), where the cat is hidden.
// It moves only along the EDGES, straight, so it never crosses furniture: it passes through a sofa only by going under it. No spot lies behind the
// sofas: from one side to the other the cat runs along the bottom, below the middle sofa, where the smoke is thick.
type Spot = { x: number; y: number; under?: number };
const SPOTS: Spot[] = [
    { x: 112, y: 208 }, // 0 in front of the left sofa
    { x: 190, y: 216 }, // 1 left of the middle sofa
    { x: 190, y: 304 }, // 2 bottom lane, left
    { x: 450, y: 216 }, // 3 right of the middle sofa
    { x: 450, y: 304 }, // 4 bottom lane, right
    { x: 528, y: 208 }, // 5 in front of the right sofa
    { x: 320, y: 304 }, // 6 bottom lane, middle
    { x: 46, y: 208, under: 0 }, // 7 under the left sofa
    { x: 320, y: 216, under: 1 }, // 8 under the middle sofa
    { x: 594, y: 208, under: 2 } // 9 under the right sofa
];
const EDGES: [number, number][] = [[0, 1], [1, 2], [0, 2], [3, 4], [3, 5], [4, 5], [2, 6], [6, 4], [0, 7], [1, 8], [8, 3], [5, 9]];
const NEIGHBORS: number[][] = SPOTS.map((_, i) => EDGES.flatMap(([a, b]) => (a === i ? [b] : b === i ? [a] : [])));
const SOFA_SPOT = [7, 8, 9]; // the spot under each sofa
const CAT_SCALE = 2;
const HOP_SPEED = 400; // px per second along the floor (the first version ran at 100, then 200: the owner's playtest asked for double each time)
const HOP_MIN_MS = 120;
const PAUSE_MS: [number, number] = [0, 90]; // a short stop between two moves, so the cat changes direction at once and often
const HIDE_MS: [number, number] = [180, 420]; // how long it stays under a sofa before moving on
const FINAL_SLIDE_MS = 380; // the last slide under the right sofa stays slow enough to see at any speed
const FOLLOW_MS = 3600; // how long the cat roams before the fake-out
const GIUGGIU_SCALE = 3;
const GIUGGIU_FEET_Y = 344;
const GIUGGIU_EDGE = 24; // his x from the screen edge: at the very right, below the right sofa, his opaque pixels just inside the screen
const EFFECT_CHANCE = 0.15; // per trickle tick, an extra smoke effect somewhere in the room
const MAX_CLOUDS = 90;
const PUFF_EVERY_MS = 1000;
const PUFF_CLOUDS = 9; // 10 while the cat also ran behind the sofas: very slightly less smoke now that it runs through the thick of it
const TRICKLE_MS = 160;
const COUNTDOWN = 3;
const KEY_SOFA: Record<string, number> = { ArrowLeft: 0, KeyA: 0, ArrowUp: 1, KeyW: 1, ArrowRight: 2, KeyD: 2 };
const FACE_ROW: Record<Face, number> = { down: 0, left: 1, right: 2, up: 3 };

const DEPTH = { floor: 0, trail: 12, under: 5, sofa: 10, giuggiu: 15, cat: 20, smoke: 30, hud: 40, banner: 950 };

/** Scene 2 minigame: a cat runs about Casa Giuggiu's sofa triangle (crossing it along the bottom, hiding only under the sofas) while Giuggiu, at the right edge of the screen, puffs smoke that drifts across the room; the cat ends under one sofa and the player lifts the right one. */
export default class CatSmokeMinigame extends Phaser.Scene {
    static KEY = `minigame-${ID}`;
    static ID = ID;

    private cat!: Phaser.GameObjects.Sprite;
    private sofas: Phaser.GameObjects.Container[] = [];
    private floorPatch: Phaser.GameObjects.Graphics[] = [];
    private clouds = new Set<Phaser.GameObjects.Image>();
    private smoke!: Phaser.GameObjects.Container; // every cloud lives here, so one alpha tween thins them all out
    private giuggiu!: Phaser.GameObjects.Sprite;
    private ember!: Phaser.GameObjects.Rectangle;
    private dir = -1; // -1: Giuggiu stands at the right edge and the smoke drifts left (1 would be the other way round)
    private mouth = { x: 0, y: 0 };
    private emitting = false;
    private confirmEarly = false;
    private cursor!: Phaser.GameObjects.Graphics;
    private tag!: Phaser.GameObjects.Text;
    private status!: Phaser.GameObjects.Text;
    private countdownText!: Phaser.GameObjects.Text;
    private confirmHint!: Phaser.GameObjects.Text;
    private smokeTimer?: Phaser.Time.TimerEvent;
    private puffTimer?: Phaser.Time.TimerEvent;
    private targetChance = 0;
    private spot = 0; // index in SPOTS where the cat stands
    private prevSpot = -1;
    private hideIndex = 0;
    private selected = -1;
    private picking = false;
    private done = false;
    private ending = false;
    private onConfirm: (() => void) | null = null;

    constructor() {
        super(CatSmokeMinigame.KEY);
    }

    async create(): Promise<void> {
        this.done = false;
        this.ending = false;
        this.picking = false;
        this.selected = -1;
        this.targetChance = 0;
        this.onConfirm = null;
        this.clouds = new Set();
        this.emitting = false;
        this.confirmEarly = false;
        this.dir = -1; // always at the right edge (the owner's call): from there the smoke reaches all three sofas
        this.sofas = [];
        this.floorPatch = [];

        ensureCharAnims(this, 'gatto');
        ensureCharAnims(this, 'giuggiu');
        this.buildRoom();
        this.buildGiuggiu();
        this.hideIndex = Phaser.Math.Between(0, 2);
        this.spot = Phaser.Math.RND.pick(SPOTS.map((s, i) => (s.under === undefined ? i : -1)).filter((i) => i >= 0));
        this.prevSpot = -1;
        this.cat = this.add.sprite(SPOTS[this.spot].x, SPOTS[this.spot].y, 'char-gatto', 4).setOrigin(0.5, 1).setScale(CAT_SCALE).setDepth(DEPTH.cat);
        this.face('down');

        // The debug keys: the flow reports the result and stops this scene itself, so only stop playing here (no second MINIGAME_DONE).
        const onDebug = (): void => {
            this.done = true;
        };
        this.game.events.on('debug:minigame', onDebug);
        this.input.keyboard!.on('keydown', this.onKey, this);
        this.events.once('shutdown', () => {
            this.done = true;
            this.game.events.off('debug:minigame', onDebug);
            this.input.keyboard?.off('keydown', this.onKey, this);
        });

        await InstructionCard.show(this, ID);
        if (this.done) return;
        await this.phaseFollow();
        if (this.done) return;
        await this.phasePick();
    }

    // ---- room ----

    private buildRoom(): void {
        const g = this.add.graphics().setDepth(DEPTH.floor);
        g.fillStyle(0x3b4a7a).fillRect(0, 0, GAME_WIDTH, 66); // wall
        for (let x = 0; x < GAME_WIDTH; x += 32) g.fillStyle(0x34426e).fillRect(x, 0, 16, 66);
        g.fillStyle(0x2a355c).fillRect(0, 66, GAME_WIDTH, 6); // baseboard
        for (let y = 72, i = 0; y < GAME_HEIGHT; y += 24, i++) {
            g.fillStyle(i % 2 ? 0x8f6140 : 0x9a6a44).fillRect(0, y, GAME_WIDTH, 24);
            g.fillStyle(0x6e4a30).fillRect(0, y, GAME_WIDTH, 1);
            for (let x = (i % 3) * 70; x < GAME_WIDTH; x += 210) g.fillRect(x, y, 1, 24);
        }
        g.fillStyle(0xd9d0a0).fillRect(100, 100, 440, 236); // rug under the triangle of sofas
        g.fillStyle(0x2f6b78).fillRect(104, 104, 432, 228);
        g.fillStyle(0x3a8294).fillRect(120, 120, 400, 196);
        g.fillStyle(0x3a2a1c).fillRect(272, 330, 96, 22).fillStyle(0x111419).fillRect(284, 312, 72, 38).fillStyle(0x1d2a3a).fillRect(288, 316, 64, 28); // the TV on its table, bottom wall
        g.fillStyle(0xa8d4e8).fillRect(480, 12, 100, 42).fillStyle(0xe8f4ff).fillRect(484, 16, 92, 34); // window
        g.fillStyle(0xa8d4e8).fillRect(528, 16, 4, 34).fillRect(484, 31, 92, 3);

        // smoke texture: stacked translucent circles make a dense, soft puff (the first version was 0.11 per ring: too thin)
        if (!this.textures.exists('cat-smoke-cloud-2')) {
            const s = this.add.graphics();
            for (let r = 48; r >= 6; r -= 3) s.fillStyle(0xc9cdd9, 0.27).fillCircle(48, 48, r);
            s.generateTexture('cat-smoke-cloud-2', 96, 96);
            s.destroy();
        }
        this.smoke = this.add.container(0, 0).setDepth(DEPTH.smoke);

        for (let i = 0; i < 3; i++) {
            const { w, h } = this.sofaSize(i);
            const patch = this.add.graphics({ x: SOFAS[i].cx, y: SOFAS[i].cy }).setDepth(DEPTH.floor + 1);
            patch.fillStyle(0x000000, 0.28).fillRect(-w / 2 + 2, -h / 2 + 6, w - 4, h - 6);
            this.floorPatch.push(patch);
            this.sofas.push(this.makeSofa(i));
            this.makeKeyLabel(i);
        }
        this.cursor = this.add.graphics().setDepth(DEPTH.hud);
        this.tweens.add({ targets: this.cursor, alpha: 0.45, duration: 280, yoyo: true, repeat: -1 });

        this.tag = this.add.text(8, 6, LABELS.constitution, { ...pixelStyle(16, '#ffe27a'), shadow: SHADOW }).setDepth(DEPTH.hud);
        this.status = this.add.text(GAME_WIDTH / 2, 26, '', { ...pixelStyle(32, '#ffffff'), shadow: SHADOW }).setOrigin(0.5, 0).setDepth(DEPTH.hud);
        this.countdownText = this.add.text(GAME_WIDTH / 2, 62, '',{ ...pixelStyle(32, '#ffe27a'), shadow: SHADOW }).setOrigin(0.5, 0).setDepth(DEPTH.hud);
        this.confirmHint = this.add.text(GAME_WIDTH / 2, 102, t('ui.confirm'), { ...pixelStyle(16, '#cfe0ff'), shadow: SHADOW }).setOrigin(0.5, 0).setDepth(DEPTH.hud).setVisible(false);
        this.setStatus(LABELS.follow);
    }

    /** The size of sofa `i` on the screen (a turned one swaps its length and thickness). */
    private sofaSize(i: number): { w: number; h: number } {
        const s = SOFAS[i];
        return s.rot ? { w: s.thick, h: s.len } : { w: s.len, h: s.thick };
    }

    private makeSofa(i: number): Phaser.GameObjects.Container {
        const { cx, cy, len, thick, rot, color: base } = SOFAS[i];
        const dark = Phaser.Display.Color.IntegerToColor(base).darken(28).color;
        const mid = Phaser.Display.Color.IntegerToColor(base).darken(12).color;
        const light = Phaser.Display.Color.IntegerToColor(base).lighten(14).color;
        const g = this.add.graphics();
        const hw = len / 2;
        const hh = thick / 2;
        const cushion = (len - 40) / 2 - 2;
        g.fillStyle(0x000000, 0.3).fillRect(-hw + 3, -hh + 4, len, thick); // shadow
        g.fillStyle(dark).fillRect(-hw, -hh, len, thick);
        g.fillStyle(mid).fillRect(-hw + 2, -hh + 2, len - 4, 22); // back rest
        g.fillStyle(mid).fillRect(-hw + 2, -hh + 2, 16, thick - 4).fillRect(hw - 18, -hh + 2, 16, thick - 4); // armrests
        g.fillStyle(base).fillRect(-hw + 20, -hh + 26, len - 40, thick - 30); // seat
        for (const x of [-hw + 22, 1]) {
            g.fillStyle(light).fillRect(x, -hh + 28, cushion, thick - 34); // cushions
            g.fillStyle(dark).fillRect(x, -hh + 28, cushion, 1).fillRect(x, -hh + 28, 1, thick - 34);
        }
        g.fillStyle(0x000000, 0.18).fillRect(-hw + 2, -hh + 24, len - 4, 2);
        return this.add.container(cx, cy, [g]).setAngle(rot).setDepth(DEPTH.sofa);
    }

    /** Arrow icon plus Italian word for each sofa: the key that picks it. The side sofas carry it above them, the middle one on its seat. */
    private makeKeyLabel(i: number): void {
        const { cx, cy } = SOFAS[i];
        const ly = i === 1 ? cy - 4 : cy - this.sofaSize(i).h / 2 - 46;
        const label = this.add.text(0, ly, LABELS.sofa[i], { ...pixelStyle(16, '#ffffff'), shadow: SHADOW }).setDepth(DEPTH.hud);
        const total = label.width + 20;
        const x0 = Phaser.Math.Clamp(cx - total / 2, 4, GAME_WIDTH - 4 - total);
        label.setX(x0 + 20);
        const ay = ly + 8;
        const a = this.add.graphics().setDepth(DEPTH.hud).fillStyle(0xffe27a);
        if (i === 0) a.fillTriangle(x0, ay, x0 + 12, ay - 7, x0 + 12, ay + 7);
        else if (i === 1) a.fillTriangle(x0 + 6, ay - 7, x0 - 1, ay + 6, x0 + 13, ay + 6);
        else a.fillTriangle(x0 + 12, ay, x0, ay - 7, x0, ay + 7);
    }

    private setStatus(text: string): void {
        this.status.setText(text);
    }

    // ---- cat ----

    private wait(ms: number): Promise<void> {
        return new Promise((resolve) => this.time.delayedCall(ms, resolve));
    }

    private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
        return new Promise((resolve) => this.tweens.add({ ...config, onComplete: () => resolve() }));
    }

    private face(dir: Face, walking = false): void {
        if (walking) this.cat.play(`gatto-walk-${dir}`, true);
        else this.cat.stop().setFrame(FACE_ROW[dir] * 3 + 1);
    }

    /** One straight move along an edge to spot `to` (or only `part` of the way, for the fake-out). A move that starts or ends under furniture runs below it, so the sofa covers the cat. */
    private async move(to: number, { part = 1, ms = 0, under = false } = {}): Promise<void> {
        const from = this.spot;
        const a = { x: this.cat.x, y: this.cat.y };
        const dx = (SPOTS[to].x - a.x) * part;
        const dy = (SPOTS[to].y - a.y) * part;
        const dist = Math.hypot(dx, dy);
        const hidden = under || SPOTS[from].under !== undefined || SPOTS[to].under !== undefined;
        this.face(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up', true);
        this.cat.setDepth(hidden ? DEPTH.under : DEPTH.cat);
        const p = { k: 0 };
        let nextDot = 0;
        await this.tween({
            targets: p,
            k: 1,
            duration: ms || Math.max(HOP_MIN_MS, (dist / HOP_SPEED) * 1000),
            ease: 'Linear',
            onUpdate: () => {
                this.cat.setPosition(a.x + dx * p.k, a.y + dy * p.k);
                if (!hidden && dist * p.k >= nextDot) {
                    nextDot += 26;
                    const dot = this.add.circle(this.cat.x, this.cat.y - 2, 3, 0xfff2c0, 0.85).setDepth(DEPTH.trail);
                    this.tweens.add({ targets: dot, alpha: 0, duration: 1500, onComplete: () => dot.destroy() });
                }
            }
        });
        if (part < 1) return; // the fake-out stops half way under and goes back
        this.prevSpot = from;
        this.spot = to;
        this.cat.setPosition(SPOTS[to].x, SPOTS[to].y);
        if (SPOTS[to].under === undefined) this.cat.setDepth(DEPTH.cat);
        audio.sfx('step');
    }

    /** Where the cat can go next. From under the middle sofa only out the side it went in: that sofa is no shortcut, it crosses along the bottom. */
    private exits(): number[] {
        return this.spot === SOFA_SPOT[1] ? [this.prevSpot] : NEIGHBORS[this.spot];
    }

    /** The next spot of the random walk: any exit, but mostly not the spot it just came from, so it keeps turning. */
    private nextSpot(): number {
        const all = this.exits();
        const fresh = all.filter((n) => n !== this.prevSpot);
        return Phaser.Math.RND.pick(fresh.length && Math.random() < 0.8 ? fresh : all);
    }

    /** The open-floor spots next to `target` (a spot under a sofa), where the cat can start its slide. */
    private approaches(target: number): number[] {
        return NEIGHBORS[target].filter((n) => SPOTS[n].under === undefined);
    }

    /** The shortest walk over open floor from where the cat is to any spot in `goals`; leaves the first move out of an under spot. */
    private route(goals: number[]): number[] {
        const prev = new Map<number, number>([[this.spot, -1]]);
        const queue = [this.spot];
        for (let q = 0; q < queue.length; q++) {
            const at = queue[q];
            if (goals.includes(at)) {
                const path: number[] = [];
                for (let n = at; n !== this.spot; n = prev.get(n)!) path.unshift(n);
                return path;
            }
            for (const n of at === this.spot ? this.exits() : NEIGHBORS[at]) {
                if (!prev.has(n) && SPOTS[n].under === undefined) {
                    prev.set(n, at);
                    queue.push(n);
                }
            }
        }
        return [];
    }

    private async walkTo(goals: number[]): Promise<void> {
        for (const n of this.route(goals)) {
            if (this.done) return;
            await this.move(n);
        }
    }

    // ---- Giuggiu and the smoke ----

    /** Giuggiu stands at the right edge of the screen, a cigarette in his mouth; every puff he breathes in, leans out and blows a burst of smoke across the room. */
    private buildGiuggiu(): void {
        const x = this.dir > 0 ? GIUGGIU_EDGE : GAME_WIDTH - GIUGGIU_EDGE;
        const face: Face = this.dir > 0 ? 'right' : 'left';
        this.giuggiu = this.add.sprite(x, GIUGGIU_FEET_Y, 'char-giuggiu', FACE_ROW[face] * 3 + 1).setOrigin(0.5, 1).setScale(GIUGGIU_SCALE).setDepth(DEPTH.giuggiu);
        // the mouth of the 32 px frame is 7 px from the centre toward where he looks and 21 px above the frame bottom
        this.mouth = { x: x + this.dir * 7 * GIUGGIU_SCALE, y: GIUGGIU_FEET_Y - 21 * GIUGGIU_SCALE };
        const cig = this.add.graphics().setDepth(DEPTH.giuggiu + 1);
        const x0 = this.dir > 0 ? this.mouth.x : this.mouth.x - 10;
        cig.fillStyle(0xf2efe6).fillRect(x0, this.mouth.y, 10, 3);
        this.ember = this.add.rectangle(this.dir > 0 ? x0 + 11.5 : x0 - 1.5, this.mouth.y + 1.5, 3, 3, 0xff7a2a).setDepth(DEPTH.giuggiu + 1);
        this.tweens.add({ targets: this.ember, alpha: 0.5, duration: 330, yoyo: true, repeat: -1 });
    }

    private puff(): void {
        const x = this.giuggiu.x;
        // breathe in: the chest swells and the ember glows
        this.ember.setFillStyle(0xffd070);
        this.tweens.add({
            targets: this.giuggiu,
            scaleY: GIUGGIU_SCALE * 1.07,
            scaleX: GIUGGIU_SCALE * 0.96,
            duration: 320,
            ease: 'Sine.easeOut',
            onComplete: () => {
                // breathe out: a lean toward the room and a burst of clouds
                this.ember.setFillStyle(0xff7a2a);
                this.tweens.add({ targets: this.giuggiu, scaleX: GIUGGIU_SCALE, scaleY: GIUGGIU_SCALE, angle: this.dir * 5, x: x + this.dir * 3, duration: 160, hold: 380, yoyo: true });
                if (!this.emitting) return;
                for (let i = 0; i < PUFF_CLOUDS; i++) this.time.delayedCall(i * 45, () => this.emitting && this.spawnCloud(this.mouth.x, this.mouth.y, true));
            }
        });
    }

    private startSmoke(): void {
        this.emitting = true;
        this.puff();
        this.puffTimer = this.time.addEvent({ delay: PUFF_EVERY_MS, loop: true, callback: () => this.puff() });
        this.smokeTimer = this.time.addEvent({
            delay: TRICKLE_MS,
            loop: true,
            callback: () => {
                if (!this.emitting) return;
                this.spawnCloud(this.mouth.x, this.mouth.y, false); // the trickle between two puffs
                if (Math.random() < EFFECT_CHANCE) catSmokeCloud(this, Phaser.Math.Between(60, GAME_WIDTH - 60), Phaser.Math.Between(120, GAME_HEIGHT - 50));
                if (this.targetChance > 0 && Math.random() < this.targetChance) this.spawnCloud(this.cat.x + Phaser.Math.Between(-18, 18), this.cat.y - 30 + Phaser.Math.Between(-12, 12), false, true);
            }
        });
    }

    /** One cloud from `(x, y)`: it grows, drifts toward the far edge and spreads over the whole height of the room; `burst` clouds are bigger and denser. */
    private spawnCloud(x: number, y: number, burst: boolean, local = false): void {
        if (this.clouds.size >= MAX_CLOUDS) return;
        const cloud = this.add.image(x, y, 'cat-smoke-cloud-2').setAlpha(0).setScale(0.4);
        this.smoke.add(cloud);
        const life = Phaser.Math.Between(2800, 4200);
        this.clouds.add(cloud);
        // a quarter of the clouds rise near Giuggiu over the sofa on his side, the rest cross the room, so all three sofas are covered
        const near = !local && Math.random() < 0.25;
        const reach = local ? Phaser.Math.Between(-20, 20) : this.dir * (near ? Phaser.Math.Between(0, 120) : Phaser.Math.Between(60, 640));
        const toY = local ? y + Phaser.Math.Between(-30, 4) : near ? Phaser.Math.Between(110, 240) : Phaser.Math.Between(90, GAME_HEIGHT - 20);
        this.tweens.add({ targets: cloud, scale: Phaser.Math.FloatBetween(burst ? 2.4 : 1.6, burst ? 3.6 : 2.6), x: x + reach, y: toY, duration: life, ease: 'Sine.easeOut' });
        this.tweens.add({
            targets: cloud,
            alpha: burst || local ? 0.95 : 0.9,
            duration: life / 2,
            yoyo: true,
            onComplete: () => {
                this.clouds.delete(cloud);
                cloud.destroy();
            }
        });
    }

    /** Giuggiu stops smoking and what hangs in the air fades to a haze. */
    private thinSmoke(): void {
        this.emitting = false;
        this.tweens.add({ targets: this.smoke, alpha: 0.3, duration: 600 });
    }

    private clearSmoke(): void {
        this.emitting = false;
        this.smokeTimer?.remove();
        this.puffTimer?.remove();
        this.tweens.add({
            targets: this.smoke,
            alpha: 0,
            duration: 450,
            onComplete: () => {
                for (const c of this.clouds) {
                    this.tweens.killTweensOf(c);
                    c.destroy();
                }
                this.clouds.clear();
            }
        });
    }

    // ---- phase 1: follow the cat ----

    private async phaseFollow(): Promise<void> {
        this.startSmoke();
        this.targetChance = 0.3;
        await this.wait(1200); // the first puffs fill the room before the cat moves

        // the cat roams in short moves and picks a new way at every spot, hiding for a moment whenever it goes under a sofa
        const start = this.time.now;
        while (this.time.now - start < FOLLOW_MS) {
            if (this.done) return;
            const to = this.nextSpot();
            await this.move(to);
            if (SPOTS[to].under !== undefined) {
                this.face('up');
                await this.wait(Phaser.Math.Between(...HIDE_MS));
            } else await this.wait(Phaser.Math.Between(...PAUSE_MS));
        }

        // fake-out: it ducks half way under another sofa, comes back out and walks on
        this.targetChance = 0.2;
        const fake = SOFA_SPOT[Phaser.Math.RND.pick([0, 1, 2].filter((i) => i !== this.hideIndex && SOFA_SPOT[i] !== this.spot))];
        await this.walkTo(this.approaches(fake));
        const back = this.spot;
        await this.move(fake, { part: 0.5 });
        await this.wait(100);
        await this.move(back, { under: true });
        if (this.done) return;

        // the real hiding place: no more clouds on the cat, so a careful player can see it. Giuggiu stops only once it is under the sofa.
        this.targetChance = 0;
        const target = SOFA_SPOT[this.hideIndex];
        await this.walkTo(this.approaches(target));
        await this.move(target, { ms: FINAL_SLIDE_MS });
        this.face('up');
        this.thinSmoke();
        // the player may already pick the sofa the cat went under: keys count from here on, not only from the countdown
        // (root cause of the "wrong sofa" bug: a pick made before the countdown was thrown away and the round was lost)
        this.picking = true;
        this.setStatus(LABELS.pick);
        this.confirmHint.setVisible(true);
        await this.wait(300);
        this.clearSmoke();
        await this.wait(600);
    }

    // ---- phase 2: pick a sofa ----

    private setSelected(i: number): void {
        this.selected = i;
        this.cursor.clear();
        if (i < 0) return;
        const { cx, cy } = SOFAS[i];
        const { w, h } = this.sofaSize(i);
        this.cursor.lineStyle(3, 0xffe27a).strokeRect(cx - w / 2 - 4, cy - h / 2 - 4, w + 8, h + 8);
        this.cursor.fillStyle(0xffe27a).fillTriangle(cx - 10, cy - h / 2 - 22, cx + 10, cy - h / 2 - 22, cx, cy - h / 2 - 9);
    }

    private onKey(e: KeyboardEvent): void {
        if (!this.picking || e.repeat || this.done) return;
        if (e.code in KEY_SOFA) {
            if (this.selected !== KEY_SOFA[e.code]) audio.sfx('blip');
            this.setSelected(KEY_SOFA[e.code]);
        } else if ((e.code === 'KeyX' || e.code === 'Enter' || e.code === 'Space') && this.selected >= 0) {
            if (this.onConfirm) this.onConfirm();
            else this.confirmEarly = true; // confirmed before the countdown starts: phasePick reveals at once
        }
    }

    private async phasePick(): Promise<void> {
        this.picking = true;
        this.setStatus(LABELS.pick);
        this.confirmHint.setVisible(true);
        await new Promise<void>((resolve) => {
            if (this.confirmEarly) return resolve();
            let left = COUNTDOWN;
            this.countdownText.setText(String(left));
            const tick = this.time.addEvent({
                delay: 1000,
                repeat: COUNTDOWN - 1,
                callback: () => {
                    left--;
                    this.countdownText.setText(left > 0 ? String(left) : '');
                    if (left > 0) audio.sfx('blip');
                    else resolve();
                }
            });
            this.onConfirm = () => {
                tick.remove();
                resolve();
            };
        });
        this.picking = false;
        this.onConfirm = null;
        this.confirmHint.setVisible(false);
        this.countdownText.setText('');
        if (this.done) return;
        await this.reveal(this.selected);
    }

    private lift(i: number): Promise<void> {
        return this.tween({ targets: this.sofas[i], y: SOFAS[i].cy - SOFAS[i].lift, duration: 520, ease: 'Back.Out' });
    }

    private async reveal(choice: number): Promise<void> {
        const won = choice === this.hideIndex;
        this.cursor.clear();
        if (choice >= 0) await this.lift(choice);
        await this.wait(250);
        if (won) {
            this.cat.setDepth(DEPTH.cat);
            this.face('down');
            await this.tween({ targets: this.cat, y: SPOTS[SOFA_SPOT[this.hideIndex]].y + 12, duration: 240 });
            audio.sfx('meow');
            this.tweens.add({ targets: this.cat, scaleX: CAT_SCALE * 1.15, scaleY: CAT_SCALE * 1.15, duration: 160, yoyo: true, repeat: 1 });
            await this.wait(500);
        } else {
            // nothing under that sofa: dust on the bare floor, then the right sofa goes up too
            if (choice >= 0) {
                const dust = this.add.graphics({ x: SOFAS[choice].cx, y: SOFAS[choice].cy + 14 }).setDepth(DEPTH.floor + 2);
                dust.fillStyle(0x6e4a30).fillCircle(-18, 0, 6).fillCircle(4, 6, 8).fillCircle(24, -2, 5);
                audio.sfx('miss');
            }
            await this.wait(700);
            await this.lift(this.hideIndex);
            await this.wait(500);
        }
        await this.endWith(won);
    }

    // ---- end ----

    private async endWith(won: boolean): Promise<void> {
        if (this.ending || this.done) return;
        this.ending = true;
        audio.sfx(won ? 'win' : 'lose');
        const w = 440;
        const h = 92;
        const x = (GAME_WIDTH - w) / 2;
        const y = 4;
        this.status.setText('');
        this.tag.setVisible(false);
        const parts = [
            this.add.image(x, y, panelTexture(this, 'cat-smoke-banner', w, h)).setOrigin(0),
            this.add.text(GAME_WIDTH / 2, y + 10, t(won ? 'ui.win' : 'ui.lose'), { ...pixelStyle(32, won ? '#ffe27a' : '#ff8a8a'), shadow: SHADOW }).setOrigin(0.5, 0),
            this.add.text(GAME_WIDTH / 2, y + 54, t(`minigames.${ID}.${won ? 'winText' : 'loseText'}`), { ...pixelStyle(16, '#ffffff'), shadow: SHADOW, align: 'center' }).setOrigin(0.5, 0)
        ];
        parts.forEach((p) => p.setDepth(DEPTH.banner));
        this.tweens.add({ targets: parts, alpha: { from: 0, to: 1 }, duration: 200 });
        await this.wait(1500);
        this.emitDone(won);
    }

    private emitDone(won: boolean): void {
        if (this.done) return;
        this.done = true;
        this.game.events.emit(MINIGAME_DONE, { id: ID, won, score: won ? 1 : 0 } satisfies MinigameDone);
        this.scene.stop();
    }
}
