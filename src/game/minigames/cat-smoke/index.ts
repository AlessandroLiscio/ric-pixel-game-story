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

const SOFA_X = [140, 320, 500]; // left, middle, right = arrow keys LEFT, UP, RIGHT
const SOFA_Y = 236;
const SOFA_W = 120;
const SOFA_H = 80;
const SOFA_COLOR = [0xc4473f, 0xd9a43a, 0x6a4fb0];
const FEET_ON = SOFA_Y + 14; // the cat sits on the cushions
const FEET_FRONT = SOFA_Y + 68; // in front of the sofa, on the floor
const FEET_UNDER = SOFA_Y + 36; // hidden behind the sofa body
const CAT_SCALE = 2;
const HOP_SPEED = 200; // px per second along the floor (the first version ran at 100: the owner's playtest asked for double)
const HOP_MIN_MS = 500;
const HOP_ARC = 24;
const FOLLOW_MS = 3600; // how long the cat hops about before the fake-out; shorter hops, so about the same number of them
const GIUGGIU_SCALE = 3;
const GIUGGIU_FEET_Y = 344;
const GIUGGIU_EDGE = 40; // his x from the screen edge
const MAX_CLOUDS = 70;
const PUFF_EVERY_MS = 1700;
const COUNTDOWN = 3;
const KEY_SOFA: Record<string, number> = { ArrowLeft: 0, KeyA: 0, ArrowUp: 1, KeyW: 1, ArrowRight: 2, KeyD: 2 };
const FACE_ROW: Record<Face, number> = { down: 0, left: 1, right: 2, up: 3 };

const DEPTH = { floor: 0, trail: 12, under: 5, sofa: 10, giuggiu: 15, cat: 20, smoke: 30, hud: 40, banner: 950 };

/** Scene 2 minigame: a cat hops between three sofas while Giuggiu, at one edge of the screen, puffs smoke that drifts across the room; the cat hides under one and the player lifts the right sofa. */
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
    private dir = 1; // 1: Giuggiu stands at the left edge and the smoke drifts right, -1: the other way round
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
    private current = 0; // sofa the cat is on
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
        this.dir = Math.random() < 0.5 ? 1 : -1;
        this.sofas = [];
        this.floorPatch = [];

        ensureCharAnims(this, 'gatto');
        ensureCharAnims(this, 'giuggiu');
        this.buildRoom();
        this.buildGiuggiu();
        this.hideIndex = Phaser.Math.Between(0, 2);
        this.current = Phaser.Math.Between(0, 2);
        this.cat = this.add.sprite(SOFA_X[this.current], FEET_ON, 'char-gatto', 4).setOrigin(0.5, 1).setScale(CAT_SCALE).setDepth(DEPTH.cat);
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
        g.fillStyle(0xd9d0a0).fillRect(40, 150, 560, 196); // rug
        g.fillStyle(0x2f6b78).fillRect(44, 154, 552, 188);
        g.fillStyle(0x3a8294).fillRect(60, 170, 520, 156);
        g.fillStyle(0xa8d4e8).fillRect(480, 12, 100, 42).fillStyle(0xe8f4ff).fillRect(484, 16, 92, 34); // window
        g.fillStyle(0xa8d4e8).fillRect(528, 16, 4, 34).fillRect(484, 31, 92, 3);

        // smoke texture: stacked translucent circles make a dense, soft puff (the first version was 0.11 per ring: too thin)
        if (!this.textures.exists('cat-smoke-cloud-2')) {
            const s = this.add.graphics();
            for (let r = 48; r >= 6; r -= 3) s.fillStyle(0xc9cdd9, 0.2).fillCircle(48, 48, r);
            s.generateTexture('cat-smoke-cloud-2', 96, 96);
            s.destroy();
        }
        this.smoke = this.add.container(0, 0).setDepth(DEPTH.smoke);

        for (let i = 0; i < 3; i++) {
            const patch = this.add.graphics({ x: SOFA_X[i], y: SOFA_Y }).setDepth(DEPTH.floor + 1);
            patch.fillStyle(0x000000, 0.28).fillRect(-SOFA_W / 2 + 2, -SOFA_H / 2 + 6, SOFA_W - 4, SOFA_H - 6);
            this.floorPatch.push(patch);
            this.sofas.push(this.makeSofa(i));
            this.makeKeyLabel(i);
        }
        this.cursor = this.add.graphics().setDepth(DEPTH.hud);
        this.tweens.add({ targets: this.cursor, alpha: 0.45, duration: 280, yoyo: true, repeat: -1 });

        this.tag = this.add.text(8, 6, LABELS.constitution, { ...pixelStyle(16, '#ffe27a'), shadow: SHADOW }).setDepth(DEPTH.hud);
        this.status = this.add.text(GAME_WIDTH / 2, 26, '', { ...pixelStyle(32, '#ffffff'), shadow: SHADOW }).setOrigin(0.5, 0).setDepth(DEPTH.hud);
        this.countdownText = this.add.text(GAME_WIDTH / 2, 80, '',{ ...pixelStyle(32, '#ffe27a'), shadow: SHADOW }).setOrigin(0.5, 0).setDepth(DEPTH.hud);
        this.confirmHint = this.add.text(GAME_WIDTH / 2, 122, t('ui.confirm'), { ...pixelStyle(16, '#cfe0ff'), shadow: SHADOW }).setOrigin(0.5, 0).setDepth(DEPTH.hud).setVisible(false);
        this.setStatus(LABELS.follow);
    }

    private makeSofa(i: number): Phaser.GameObjects.Container {
        const base = SOFA_COLOR[i];
        const dark = Phaser.Display.Color.IntegerToColor(base).darken(28).color;
        const mid = Phaser.Display.Color.IntegerToColor(base).darken(12).color;
        const light = Phaser.Display.Color.IntegerToColor(base).lighten(14).color;
        const g = this.add.graphics();
        const hw = SOFA_W / 2;
        const hh = SOFA_H / 2;
        g.fillStyle(0x000000, 0.3).fillRect(-hw + 3, -hh + 4, SOFA_W, SOFA_H); // shadow
        g.fillStyle(dark).fillRect(-hw, -hh, SOFA_W, SOFA_H);
        g.fillStyle(mid).fillRect(-hw + 2, -hh + 2, SOFA_W - 4, 22); // back rest
        g.fillStyle(mid).fillRect(-hw + 2, -hh + 2, 16, SOFA_H - 4).fillRect(hw - 18, -hh + 2, 16, SOFA_H - 4); // armrests
        g.fillStyle(base).fillRect(-hw + 20, -hh + 26, SOFA_W - 40, SOFA_H - 30); // seat
        for (const cx of [-hw + 22, 1]) {
            g.fillStyle(light).fillRect(cx, -hh + 28, 38, SOFA_H - 34); // cushions
            g.fillStyle(dark).fillRect(cx, -hh + 28, 38, 1).fillRect(cx, -hh + 28, 1, SOFA_H - 34);
        }
        g.fillStyle(0x000000, 0.18).fillRect(-hw + 2, -hh + 24, SOFA_W - 4, 2);
        return this.add.container(SOFA_X[i], SOFA_Y, [g]).setDepth(DEPTH.sofa);
    }

    /** Arrow icon plus Italian word under each sofa: the key that picks it. */
    private makeKeyLabel(i: number): void {
        const label = this.add.text(0, SOFA_Y + 46, LABELS.sofa[i], { ...pixelStyle(16, '#ffffff'), shadow: SHADOW }).setDepth(DEPTH.hud);
        const total = label.width + 20;
        const x0 = SOFA_X[i] - total / 2;
        label.setX(x0 + 20);
        const cy = SOFA_Y + 54;
        const a = this.add.graphics().setDepth(DEPTH.hud).fillStyle(0xffe27a);
        if (i === 0) a.fillTriangle(x0, cy, x0 + 12, cy - 7, x0 + 12, cy + 7);
        else if (i === 1) a.fillTriangle(x0 + 6, cy - 7, x0 - 1, cy + 6, x0 + 13, cy + 6);
        else a.fillTriangle(x0 + 12, cy, x0, cy - 7, x0, cy + 7);
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

    /** One hop to another sofa along the floor with a little arc, leaving fading paw dots on the path. */
    private async hop(to: number): Promise<void> {
        const from = this.cat.x;
        const dx = SOFA_X[to] - from;
        const duration = Math.max(HOP_MIN_MS, (Math.abs(dx) / HOP_SPEED) * 1000);
        this.face(dx > 0 ? 'right' : 'left', true);
        this.cat.setDepth(DEPTH.cat);
        const p = { k: 0 };
        let nextDot = 0;
        await this.tween({
            targets: p,
            k: 1,
            duration,
            ease: 'Linear',
            onUpdate: () => {
                this.cat.x = from + dx * p.k;
                this.cat.y = FEET_ON - Math.sin(Math.PI * p.k) * HOP_ARC;
                if (Math.abs(dx * p.k) >= nextDot) {
                    nextDot += 26;
                    const dot = this.add.circle(this.cat.x, FEET_ON - 2, 3, 0xfff2c0, 0.85).setDepth(DEPTH.trail);
                    this.tweens.add({ targets: dot, alpha: 0, duration: 1500, onComplete: () => dot.destroy() });
                }
            }
        });
        this.current = to;
        this.cat.setPosition(SOFA_X[to], FEET_ON);
        this.face('down');
        audio.sfx('step');
    }

    private async walkFront(): Promise<void> {
        this.face('down', true);
        await this.tween({ targets: this.cat, y: FEET_FRONT, duration: 280 });
        this.face('down');
    }

    /** Slides under the sofa it is standing in front of; `depth` of the cat goes below the sofa body. */
    private async slideUnder(toY: number, duration: number): Promise<void> {
        this.cat.setDepth(DEPTH.under);
        this.face('up', true);
        await this.tween({ targets: this.cat, y: toY, duration, ease: 'Sine.easeIn' });
        this.face('up');
    }

    private async popOut(): Promise<void> {
        this.face('down', true);
        await this.tween({ targets: this.cat, y: FEET_FRONT, duration: 160 });
        this.cat.setDepth(DEPTH.cat);
        this.face('down');
        await this.wait(120);
        this.face('up', true);
        await this.tween({ targets: this.cat, y: FEET_ON, duration: 280 });
        this.face('down');
    }

    // ---- Giuggiu and the smoke ----

    /** Giuggiu stands at one edge of the screen, a cigarette in his mouth; every puff he breathes in, leans out and blows a burst of smoke across the room. */
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
                for (let i = 0; i < 8; i++) this.time.delayedCall(i * 60, () => this.emitting && this.spawnCloud(this.mouth.x, this.mouth.y, true));
            }
        });
    }

    private startSmoke(): void {
        this.emitting = true;
        this.puff();
        this.puffTimer = this.time.addEvent({ delay: PUFF_EVERY_MS, loop: true, callback: () => this.puff() });
        this.smokeTimer = this.time.addEvent({
            delay: 200,
            loop: true,
            callback: () => {
                if (!this.emitting) return;
                this.spawnCloud(this.mouth.x, this.mouth.y, false); // the trickle between two puffs
                if (Math.random() < 0.12) catSmokeCloud(this, Phaser.Math.Between(60, GAME_WIDTH - 60), Phaser.Math.Between(120, GAME_HEIGHT - 50));
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
        const reach = local ? Phaser.Math.Between(-20, 20) : this.dir * Phaser.Math.Between(180, 640);
        const toY = local ? y + Phaser.Math.Between(-30, 4) : Phaser.Math.Between(90, GAME_HEIGHT - 20);
        this.tweens.add({ targets: cloud, scale: Phaser.Math.FloatBetween(burst ? 2.4 : 1.6, burst ? 3.6 : 2.6), x: x + reach, y: toY, duration: life, ease: 'Sine.easeOut' });
        this.tweens.add({
            targets: cloud,
            alpha: burst || local ? 0.95 : 0.8,
            duration: life / 2,
            yoyo: true,
            onComplete: () => {
                this.clouds.delete(cloud);
                cloud.destroy();
            }
        });
    }

    /** Giuggiu stops smoking and what hangs in the air fades to a haze, so the last hop and the hiding can be seen. */
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

    private otherSofa(from: number, farChance = 0.15): number {
        if (from === 1) return Math.random() < 0.5 ? 0 : 2;
        return Math.random() < farChance ? 2 - from : 1;
    }

    private async phaseFollow(): Promise<void> {
        this.startSmoke();
        this.targetChance = 0.3;
        await this.wait(1200); // the first puffs fill the room before the cat moves

        const start = this.time.now;
        while (this.time.now - start < FOLLOW_MS) {
            if (this.done) return;
            await this.hop(this.otherSofa(this.current));
            await this.wait(Phaser.Math.Between(200, 350));
        }

        // fake-out: it ducks half way under a sofa, comes back out and hops on
        this.targetChance = 0.2;
        await this.hop(this.otherSofa(this.current, 0));
        await this.walkFront();
        await this.slideUnder(FEET_UNDER + 18, 210);
        await this.wait(100);
        await this.popOut();
        if (this.done) return;

        // the real hiding place; Giuggiu stops and the smoke thins out so a careful player can see it
        this.targetChance = 0;
        this.thinSmoke();
        await this.hop(this.otherSofa(this.current, 0));
        if (this.current !== this.hideIndex) await this.hop(this.hideIndex);
        await this.wait(200);
        await this.walkFront();
        await this.wait(150);
        await this.slideUnder(FEET_UNDER, 400);
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
        const x = SOFA_X[i];
        this.cursor.lineStyle(3, 0xffe27a).strokeRect(x - SOFA_W / 2 - 4, SOFA_Y - SOFA_H / 2 - 4, SOFA_W + 8, SOFA_H + 8);
        this.cursor.fillStyle(0xffe27a).fillTriangle(x - 10, SOFA_Y - SOFA_H / 2 - 22, x + 10, SOFA_Y - SOFA_H / 2 - 22, x, SOFA_Y - SOFA_H / 2 - 9);
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
        return this.tween({ targets: this.sofas[i], y: SOFA_Y - 74, duration: 520, ease: 'Back.Out' });
    }

    private async reveal(choice: number): Promise<void> {
        const won = choice === this.hideIndex;
        this.cursor.clear();
        if (choice >= 0) await this.lift(choice);
        await this.wait(250);
        if (won) {
            this.cat.setDepth(DEPTH.cat);
            this.face('down');
            await this.tween({ targets: this.cat, y: FEET_UNDER + 10, duration: 240 });
            audio.sfx('meow');
            this.tweens.add({ targets: this.cat, scaleX: CAT_SCALE * 1.15, scaleY: CAT_SCALE * 1.15, duration: 160, yoyo: true, repeat: 1 });
            await this.wait(500);
        } else {
            // nothing under that sofa: dust on the bare floor, then the right sofa goes up too
            if (choice >= 0) {
                const dust = this.add.graphics({ x: SOFA_X[choice], y: SOFA_Y + 14 }).setDepth(DEPTH.floor + 2);
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
