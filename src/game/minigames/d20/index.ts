import Phaser from 'phaser';
import { audio } from '../../audio';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config';
import { InstructionCard } from '../../ui/InstructionCard';
import { panelTexture } from '../../ui/panel';
import { pixelStyle, t } from '../../ui/text';
import { runFlag } from '../flags';
import { MINIGAME_DONE, type MinigameDone } from '../types';
import { d20Roll } from '../fx';
import { LABELS } from './labels';

const ID = 'd20';
const TARGET = 10; // success when the result is greater than this
const WINDOW_MS = 5000; // the time to press X
const MAX_PRESSES = 40; // presses beyond this are not counted: the 40th ends the window and rolls at once
const FUMO_BONUS = 2; // added to the result when the run flag `fumo` is set (Ric found the hash)
const MAX_ROLL = 20;
const TUMBLE_MS = 1500;
const DIE_X = GAME_WIDTH / 2;
const DIE_Y = 165;
const R = 64;
const BAR_W = 160;
const OUTLINE = { stroke: '#0a1040', strokeThickness: 3 };

/** The result of the presses: every 2 count 1, rounded up, at most 40 of them count (so 20 at most); the hash adds 2; never over 20. */
export const resultOf = (presses: number, fumo: boolean): number => Math.min(MAX_ROLL, Math.ceil(Math.min(presses, MAX_PRESSES) / 2) + (fumo ? FUMO_BONUS : 0));

/** Scene circe, part a (wisdom): press X as often as possible in 5 seconds (40 count at most, every 2 presses are 1 on the d20, the hash adds
 *  2), then the d20 tumbles and lands on that result; more than 10 wins. */
export default class D20Minigame extends Phaser.Scene {
    static KEY = `minigame-${ID}`;
    static ID = ID;

    /** The landed value, 0 until the die has landed. Public so tests can compare it with the result. */
    roll = 0;
    /** Presses so far in the window (the ones past MAX_PRESSES are not counted). */
    presses = 0;
    counting = false;
    rolling = false;
    ready = false;
    finished = false;

    private fumo = false;
    private leftMs = WINDOW_MS;
    private bars: Phaser.GameObjects.Rectangle[] = [];
    private bar!: Phaser.GameObjects.Rectangle;
    private timeBar!: Phaser.GameObjects.Rectangle;
    private die!: Phaser.GameObjects.Container;
    private number!: Phaser.GameObjects.Text;
    private hint!: Phaser.GameObjects.Text;
    private countText!: Phaser.GameObjects.Text;
    private clock!: Phaser.GameObjects.Text;

    constructor() {
        super(D20Minigame.KEY);
    }

    init(): void {
        this.roll = 0;
        this.presses = 0;
        this.counting = false;
        this.rolling = false;
        this.ready = false;
        this.finished = false;
        this.leftMs = WINDOW_MS;
    }

    async create(): Promise<void> {
        this.fumo = runFlag(this.game, 'fumo');
        this.game.events.on('debug:minigame', this.onDebug, this);
        this.events.once('shutdown', () => {
            this.game.events.off('debug:minigame', this.onDebug, this);
            this.input.keyboard?.off('keydown', this.onKey, this);
        });

        this.add.image(0, 0, 'bg-circe').setOrigin(0);
        this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050a28, 0.55).setOrigin(0);
        this.add.text(GAME_WIDTH / 2, 10, LABELS.stat, { ...pixelStyle(32, '#ffe27a'), ...OUTLINE }).setOrigin(0.5, 0);
        this.add.text(GAME_WIDTH / 2, 48, LABELS.need, { ...pixelStyle(16, '#cfe0ff'), ...OUTLINE }).setOrigin(0.5, 0);
        this.clock = this.add.text(GAME_WIDTH - 16, 10, '', { ...pixelStyle(16), ...OUTLINE }).setOrigin(1, 0);
        this.drawDie();
        this.number.setText(String(resultOf(0, this.fumo)));
        this.hint = this.add.text(GAME_WIDTH / 2, 268, LABELS.press, { ...pixelStyle(16), ...OUTLINE }).setOrigin(0.5, 0).setVisible(false);
        this.tweens.add({ targets: this.hint, alpha: 0.3, duration: 450, yoyo: true, repeat: -1 });
        this.countText = this.add.text(GAME_WIDTH / 2, 250, '', { ...pixelStyle(16, '#cfe0ff'), ...OUTLINE }).setOrigin(0.5, 0);
        this.bars = [
            this.add.rectangle(GAME_WIDTH / 2, 296, BAR_W + 4, 12, 0x0a1040).setOrigin(0.5),
            (this.bar = this.add.rectangle(GAME_WIDTH / 2 - BAR_W / 2, 296, 0, 8, 0xffe27a).setOrigin(0, 0.5)),
            this.add.rectangle(GAME_WIDTH / 2, 314, BAR_W + 4, 12, 0x0a1040).setOrigin(0.5),
            (this.timeBar = this.add.rectangle(GAME_WIDTH / 2 - BAR_W / 2, 314, BAR_W, 8, 0x6aa8ff).setOrigin(0, 0.5))
        ];
        this.showCount();

        await InstructionCard.show(this, ID);
        if (this.finished) return;
        await this.countIn();
        if (this.finished) return;
        this.input.keyboard!.on('keydown', this.onKey, this);
        this.hint.setVisible(true);
        this.counting = true;
        this.ready = true;
    }

    update(_time: number, delta: number): void {
        if (!this.counting) return;
        this.leftMs = Math.max(0, this.leftMs - delta);
        this.clock.setText(`${LABELS.time} ${(this.leftMs / 1000).toFixed(1)}`).setColor(this.leftMs < 1500 ? '#ff8a8a' : '#ffffff');
        this.timeBar.width = (BAR_W * this.leftMs) / WINDOW_MS;
        if (this.leftMs <= 0) this.startRoll();
    }

    /** Every real key down of X counts (a held key counts once); the 40th ends the window. */
    private onKey(e: KeyboardEvent): void {
        if (e.repeat || e.code !== 'KeyX' || !this.counting) return;
        this.presses = Math.min(MAX_PRESSES, this.presses + 1);
        const k = this.presses / MAX_PRESSES;
        this.bar.width = BAR_W * k;
        this.die.setScale(1 + 0.25 * k);
        this.die.setAngle(Phaser.Math.Between(-6, 6) * (1 + 2 * k));
        this.number.setText(String(resultOf(this.presses, this.fumo)));
        this.showCount();
        audio.sfx('blip');
        if (this.presses >= MAX_PRESSES) this.startRoll();
    }

    private showCount(): void {
        this.countText.setText(`${LABELS.presses} ${this.presses}/${MAX_PRESSES}${this.fumo ? `   ${LABELS.fumo}` : ''}`);
    }

    private countIn(): Promise<void> {
        const word = this.add.text(GAME_WIDTH / 2, 282, LABELS.ready, { ...pixelStyle(32), ...OUTLINE }).setOrigin(0.5).setDepth(50);
        return new Promise((resolve) => {
            this.time.delayedCall(800, () => {
                if (this.finished) return resolve();
                audio.sfx('confirm');
                word.setText(LABELS.go).setColor('#ffe27a');
                this.tweens.add({ targets: word, scale: { from: 0.7, to: 1.3 }, alpha: { from: 1, to: 0 }, duration: 600, onComplete: () => word.destroy() });
                resolve();
            });
        });
    }

    /** The debug keys: the flow reports the result and stops this scene itself, so only stop playing here (no second MINIGAME_DONE). */
    private onDebug(): void {
        this.finished = true;
        this.ready = false;
        this.counting = false;
        this.input.keyboard?.off('keydown', this.onKey, this);
    }

    // ---- the roll ----

    private startRoll(): void {
        if (!this.counting || this.rolling) return;
        this.rolling = true;
        this.counting = false;
        this.hint.setVisible(false);
        this.clock.setText(`${LABELS.time} 0.0`);
        this.input.keyboard?.off('keydown', this.onKey, this);
        const value = resultOf(this.presses, this.fumo);

        // tumble: turns slowing down, a toss up and a bouncing fall, the number flickering slower and slower; more presses throw it higher,
        // spin it more and keep it in the air longer
        const c = this.presses / MAX_PRESSES;
        const tumble = TUMBLE_MS + 900 * c;
        this.bar.width = 0;
        this.tweens.add({ targets: this.die, scale: 1, duration: 300 });
        this.tweens.add({ targets: this.die, angle: 1080 + 1440 * c, duration: tumble, ease: 'Cubic.Out' });
        this.tweens.add({ targets: this.die, y: DIE_Y - 30 - 50 * c, duration: 300 + 200 * c, ease: 'Quad.Out' });
        this.tweens.add({ targets: this.die, y: DIE_Y, delay: 300 + 200 * c, duration: tumble - 300 - 200 * c, ease: 'Bounce.Out' });
        const started = this.time.now;
        const flicker = (): void => {
            if (this.finished) return;
            const k = Math.min(1, (this.time.now - started) / tumble);
            if (k >= 1) return this.land(value);
            this.number.setText(String(Phaser.Math.Between(1, MAX_ROLL)));
            audio.sfx('blip');
            this.time.delayedCall(40 + 180 * k * k, flicker);
        };
        flicker();
    }

    private land(value: number): void {
        this.roll = value;
        this.die.setAngle(0).setY(DIE_Y);
        this.number.setText(String(value));
        const won = value > TARGET;
        this.tweens.add({ targets: this.die, scale: { from: 1.3, to: 1 }, duration: 260, ease: 'Back.Out' });

        d20Roll(this, value, DIE_X, DIE_Y);
        const special = value === MAX_ROLL ? LABELS.max : value <= 1 ? LABELS.low : '';
        if (value === MAX_ROLL) {
            audio.sfx('win');
            this.cameras.main.flash(450, 255, 226, 122);
            this.cameras.main.shake(500, 0.012);
            this.sparkle();
        } else if (value <= 1) {
            audio.sfx('lose');
            this.cameras.main.flash(450, 255, 70, 70);
            this.cameras.main.shake(500, 0.012);
        } else audio.sfx(won ? 'confirm' : 'miss');

        const color = won ? '#ffe27a' : '#ff8a8a';
        this.bars.forEach((b) => b.setVisible(false));
        this.add.text(GAME_WIDTH / 2, 266, `${LABELS.roll}: ${value}`, { ...pixelStyle(32, color), ...OUTLINE }).setOrigin(0.5, 0);
        this.add.text(GAME_WIDTH / 2, 66, special || (won ? LABELS.ok : LABELS.ko), { ...pixelStyle(16, color), ...OUTLINE }).setOrigin(0.5, 0);

        this.time.delayedCall(700, () => {
            if (this.finished) return;
            this.finished = true;
            this.showBanner(t(`minigames.${ID}.${won ? 'winText' : 'loseText'}`), won);
            this.time.delayedCall(1500, () => this.emitDone(won));
        });
    }

    private sparkle(): void {
        for (let i = 0; i < 28; i++) {
            const a = (Math.PI * 2 * i) / 28;
            const dot = this.add.rectangle(DIE_X, DIE_Y, 6, 6, i % 2 ? 0xffe27a : 0xffffff).setDepth(50);
            this.tweens.add({
                targets: dot,
                x: DIE_X + Math.cos(a) * Phaser.Math.Between(90, 150),
                y: DIE_Y + Math.sin(a) * Phaser.Math.Between(70, 110),
                alpha: 0,
                duration: 800,
                ease: 'Quad.Out',
                onComplete: () => dot.destroy()
            });
        }
    }

    private emitDone(won: boolean): void {
        this.input.keyboard?.off('keydown', this.onKey, this);
        this.game.events.emit(MINIGAME_DONE, { id: ID, won, score: this.roll } satisfies MinigameDone);
        this.scene.stop();
    }

    private showBanner(text: string, good: boolean): void {
        const w = 440;
        const h = 56;
        const y = GAME_HEIGHT - h - 8;
        const panel = this.add.image((GAME_WIDTH - w) / 2, y, panelTexture(this, `mini-banner-${w}x${h}`, w, h)).setOrigin(0).setDepth(800);
        const label = this.add
            .text(GAME_WIDTH / 2, y + h / 2, text, { ...pixelStyle(16, good ? '#ffe27a' : '#ff8a8a'), ...OUTLINE, align: 'center' })
            .setOrigin(0.5)
            .setDepth(801);
        this.tweens.add({ targets: [panel, label], alpha: { from: 0, to: 1 }, duration: 160 });
    }

    // ---- drawing ----

    /** An icosahedron seen from the front: a hexagon outline, an inner triangle and the edges joining them. */
    private drawDie(): void {
        const hex = (deg: number, r = R) => new Phaser.Math.Vector2(Math.cos(Phaser.Math.DegToRad(deg)) * r, Math.sin(Phaser.Math.DegToRad(deg)) * r);
        const outer = [-90, -30, 30, 90, 150, 210].map((d) => hex(d));
        const inner = [-90, 30, 150].map((d) => hex(d, R * 0.5));
        const g = this.add.graphics();
        g.fillStyle(0x0a1040).fillPoints(outer.map((p) => new Phaser.Math.Vector2(p.x * 1.07, p.y * 1.07)), true); // dark rim
        g.fillStyle(0x3a5cc7).fillPoints(outer, true);
        g.fillStyle(0x6f8be6).fillPoints(inner, true);
        g.lineStyle(2, 0xeef2ff);
        g.strokePoints([...outer, outer[0]]);
        g.strokePoints([...inner, inner[0]]);
        const joins: [number, number[]][] = [[0, [1, 5]], [1, [1, 3]], [2, [3, 5]]];
        for (const [i, hexIdx] of joins) for (const h of hexIdx) g.lineBetween(inner[i].x, inner[i].y, outer[h].x, outer[h].y);
        this.number = this.add.text(0, 6, '0', { ...pixelStyle(32), stroke: '#0a1040', strokeThickness: 4 }).setOrigin(0.5);
        this.die = this.add.container(DIE_X, DIE_Y, [g, this.number]);
    }
}
