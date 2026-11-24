import Phaser from 'phaser';
import { audio } from '../../audio';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config';
import { ensureCharAnims } from '../../party/anims';
import { InstructionCard } from '../../ui/InstructionCard';
import { panelTexture } from '../../ui/panel';
import { pixelStyle, t } from '../../ui/text';
import { MINIGAME_DONE, type MinigameDone } from '../types';
import { LABELS } from './labels';

const ID = 'slackline';
const STEPS = 5;
const PIPS = 3;
const TIME_LIMIT = 45000; // ms of play; running out of time counts as a fall
/** Milliseconds for one sweep from one end of the bar to the other, per step already made (it gets faster). */
const SWEEP_MS = [2400, 2200, 2000, 1800, 1600];
const ZONE = 0.15; // each end zone covers this fraction of the bar

const LINE_Y = 205;
const X0 = 110;
const X1 = 530;
const BAR_X = 120;
const BAR_W = 400;
const BAR_Y = 250;
const BAR_H = 20;
const TOWEL = { x: 270, y: 306, w: 120, h: 34 };
const OUTLINE = { stroke: '#0a1040', strokeThickness: 3 };
const HIT_KEYS = ['KeyX', 'Space'];

/** Scene giardini: cross the slackline in 5 steps by pressing X when the marker is inside a green end zone. */
export default class SlacklineMinigame extends Phaser.Scene {
    static KEY = `minigame-${ID}`;
    static ID = ID;

    /** Marker position on the bar, 0 (left end) to 1 (right end). Public so tests can aim. */
    markerPos = 0;
    stepsDone = 0;
    pips = PIPS;
    playing = false;
    finished = false;

    private dir = 1;
    private consumed = false; // the zone the marker is in already gave its hit
    private playMs = 0;
    private rig!: Phaser.GameObjects.Container;
    private ric!: Phaser.GameObjects.Sprite;
    private marker!: Phaser.GameObjects.Rectangle;
    private stepText!: Phaser.GameObjects.Text;
    private pipGfx!: Phaser.GameObjects.Graphics;
    private timeBar!: Phaser.GameObjects.Rectangle;

    constructor() {
        super(SlacklineMinigame.KEY);
    }

    init(): void {
        this.markerPos = 0;
        this.stepsDone = 0;
        this.pips = PIPS;
        this.playing = false;
        this.finished = false;
        this.dir = 1;
        this.consumed = false;
        this.playMs = 0;
    }

    async create(): Promise<void> {
        this.game.events.on('debug:minigame', this.onDebug, this);
        this.events.once('shutdown', () => {
            this.game.events.off('debug:minigame', this.onDebug, this);
            this.input.keyboard?.off('keydown', this.onKey, this);
        });

        this.drawScene();
        this.drawHud();
        await InstructionCard.show(this, ID);
        if (this.finished) return;
        this.input.keyboard!.on('keydown', this.onKey, this);
        this.playing = true;
    }

    update(_time: number, delta: number): void {
        if (!this.playing) return;
        this.playMs += delta;
        this.timeBar.width = Math.max(0, (GAME_WIDTH - 32) * (1 - this.playMs / TIME_LIMIT));
        if (this.playMs >= TIME_LIMIT) return this.fall();

        this.markerPos += (this.dir * delta) / SWEEP_MS[Math.min(this.stepsDone, STEPS - 1)];
        if (this.markerPos >= 1) [this.markerPos, this.dir] = [1, -1];
        else if (this.markerPos <= 0) [this.markerPos, this.dir] = [0, 1];
        if (this.zoneSide() < 0) this.consumed = false;
        this.marker.x = BAR_X + BAR_W * this.markerPos;
    }

    /** 0 inside the left end zone, 1 inside the right one, -1 in the middle. */
    zoneSide(): number {
        if (this.markerPos <= ZONE) return 0;
        if (this.markerPos >= 1 - ZONE) return 1;
        return -1;
    }

    // ---- input ----

    private onKey(e: KeyboardEvent): void {
        if (e.repeat || !HIT_KEYS.includes(e.code) || !this.playing) return;
        if (this.zoneSide() >= 0) {
            if (this.consumed) return; // a second press inside the same zone is ignored, not punished
            this.consumed = true;
            this.hit();
        } else this.miss();
    }

    private onDebug({ won }: { won: boolean }): void {
        this.finished = true;
        this.playing = false;
        this.emitDone(won);
    }

    // ---- outcomes ----

    private hit(): void {
        this.stepsDone++;
        audio.sfx('confirm');
        this.stepText.setText(`${LABELS.steps} ${this.stepsDone}/${STEPS}`);
        this.wobble(7, 1);
        this.ric.play('ric-walk-right', true);
        const last = this.stepsDone >= STEPS;
        if (last) this.playing = false;
        this.tweens.add({
            targets: this.rig,
            x: X0 + ((X1 - X0) * this.stepsDone) / STEPS,
            duration: 260,
            ease: 'Sine.InOut',
            onComplete: () => {
                if (this.finished) return;
                this.ric.play('ric-idle-right', true);
                if (last) this.end(true);
            }
        });
        this.tweens.add({ targets: this.rig, y: LINE_Y - 8, duration: 130, yoyo: true });
    }

    private miss(): void {
        this.pips--;
        audio.sfx('miss');
        this.drawPips();
        this.wobble(22, 3);
        this.cameras.main.shake(140, 0.004);
        if (this.pips <= 0) this.fall();
    }

    private fall(): void {
        if (!this.playing) return;
        this.playing = false;
        audio.sfx('lose');
        this.tweens.killTweensOf(this.ric);
        this.tweens.killTweensOf(this.rig);
        this.ric.setAngle(0).play('ric-idle-down', true);
        this.rig.setDepth(30).setY(LINE_Y);
        // comic spin down onto the towel, ending lying on his side (810 degrees = 90)
        const landX = Phaser.Math.Clamp(this.rig.x, TOWEL.x + 6, TOWEL.x + TOWEL.w - 70);
        this.tweens.add({ targets: this.rig, angle: 810, x: landX, y: TOWEL.y + 14, duration: 750, ease: 'Quad.In' });
        this.tweens.add({ targets: this.rig, scaleY: 0.85, duration: 90, yoyo: true, delay: 760, onComplete: () => this.end(false) });
    }

    private wobble(amplitude: number, repeat: number): void {
        this.tweens.killTweensOf(this.ric);
        this.ric.setAngle(0);
        this.tweens.add({
            targets: this.ric,
            angle: { from: -amplitude, to: amplitude },
            duration: 80,
            yoyo: true,
            repeat,
            ease: 'Sine.InOut',
            onComplete: () => this.ric.setAngle(0)
        });
    }

    private end(won: boolean): void {
        if (this.finished) return;
        this.finished = true;
        this.playing = false;
        this.showBanner(t(`minigames.${ID}.${won ? 'winText' : 'loseText'}`), won);
        this.time.delayedCall(1500, () => this.emitDone(won));
    }

    private emitDone(won: boolean): void {
        this.input.keyboard?.off('keydown', this.onKey, this);
        this.game.events.emit(MINIGAME_DONE, { id: ID, won, score: this.stepsDone } satisfies MinigameDone);
        this.scene.stop();
    }

    private showBanner(text: string, good: boolean): void {
        const w = 440;
        const h = 56;
        const x = (GAME_WIDTH - w) / 2;
        const y = 70;
        const panel = this.add.image(x, y, panelTexture(this, `mini-banner-${w}x${h}`, w, h)).setOrigin(0).setDepth(800);
        const label = this.add
            .text(GAME_WIDTH / 2, y + h / 2, text, { ...pixelStyle(16, good ? '#ffe27a' : '#ff8a8a'), ...OUTLINE, align: 'center' })
            .setOrigin(0.5)
            .setDepth(801);
        this.tweens.add({ targets: [panel, label], alpha: { from: 0, to: 1 }, duration: 160 });
    }

    // ---- drawing ----

    private drawScene(): void {
        this.add.image(0, 0, 'bg-giardini').setOrigin(0);
        this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050a28, 0.5).setOrigin(0);

        const g = this.add.graphics();
        for (const tx of [70, 570]) {
            g.fillStyle(0x5a3a22).fillRect(tx - 9, 80, 18, 230);
            g.fillStyle(0x7a5232).fillRect(tx - 9, 80, 5, 230);
            g.fillStyle(0x2f6b34).fillCircle(tx, 78, 46).fillCircle(tx - 30, 98, 32).fillCircle(tx + 30, 98, 32);
            g.fillStyle(0x3f8a45).fillCircle(tx - 8, 68, 30);
        }
        // the slackline, tied to both trunks
        g.lineStyle(3, 0xe9e9ee).lineBetween(70, LINE_Y, 570, LINE_Y);
        // the orange towel on the grass
        g.fillStyle(0xf08a24).fillRect(TOWEL.x, TOWEL.y, TOWEL.w, TOWEL.h);
        g.fillStyle(0xffb04c);
        for (let i = 0; i < TOWEL.w; i += 20) g.fillRect(TOWEL.x + i, TOWEL.y, 10, TOWEL.h);
        g.lineStyle(2, 0xb85a10).strokeRect(TOWEL.x, TOWEL.y, TOWEL.w, TOWEL.h);

        ensureCharAnims(this, 'ric');
        this.ric = this.add.sprite(0, 0, 'char-ric', 7).setOrigin(0.5, 1).setScale(2);
        this.ric.play('ric-idle-right');
        this.rig = this.add.container(X0, LINE_Y, [this.ric]).setDepth(10);
    }

    private drawHud(): void {
        this.stepText = this.add.text(16, 8, `${LABELS.steps} 0/${STEPS}`, { ...pixelStyle(16), ...OUTLINE }).setDepth(20);
        this.add.text(544, 8, LABELS.balance, { ...pixelStyle(16, '#cfe0ff'), ...OUTLINE }).setOrigin(1, 0).setDepth(20);
        this.pipGfx = this.add.graphics().setDepth(20);
        this.drawPips();
        this.add.rectangle(16, 32, GAME_WIDTH - 32, 6, 0x0a1040).setOrigin(0).setDepth(20);
        this.timeBar = this.add.rectangle(16, 32, GAME_WIDTH - 32, 6, 0xffe27a).setOrigin(0).setDepth(21);

        // the sweeping bar: a framed track, a green zone at each end and the white marker
        const frame = this.add.image(BAR_X - 8, BAR_Y - 8, panelTexture(this, 'slack-bar-panel', BAR_W + 16, BAR_H + 16)).setOrigin(0);
        frame.setDepth(20);
        this.add.rectangle(BAR_X, BAR_Y, BAR_W, BAR_H, 0x0a1040).setOrigin(0).setDepth(21);
        const zoneW = BAR_W * ZONE;
        this.add.rectangle(BAR_X, BAR_Y, zoneW, BAR_H, 0x3fd05a).setOrigin(0).setDepth(22);
        this.add.rectangle(BAR_X + BAR_W - zoneW, BAR_Y, zoneW, BAR_H, 0x3fd05a).setOrigin(0).setDepth(22);
        this.marker = this.add.rectangle(BAR_X, BAR_Y + BAR_H / 2, 6, BAR_H + 12, 0xffffff).setStrokeStyle(2, 0x0a1040).setDepth(23);
        this.add.text(GAME_WIDTH / 2, BAR_Y - 34, LABELS.keys, { ...pixelStyle(16, '#cfe0ff'), ...OUTLINE }).setOrigin(0.5, 0).setDepth(20);
    }

    private drawPips(): void {
        this.pipGfx.clear();
        for (let i = 0; i < PIPS; i++) {
            const on = i < this.pips;
            this.pipGfx.fillStyle(0x0a1040).fillCircle(566 + i * 24, 16, 9);
            this.pipGfx.fillStyle(on ? 0x3fd05a : 0x39406e).fillCircle(566 + i * 24, 16, 6);
        }
    }
}
