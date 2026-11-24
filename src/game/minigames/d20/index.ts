import Phaser from 'phaser';
import { audio } from '../../audio';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config';
import { InstructionCard } from '../../ui/InstructionCard';
import { panelTexture } from '../../ui/panel';
import { pixelStyle, t } from '../../ui/text';
import { MINIGAME_DONE, type MinigameDone } from '../types';
import { d20Roll } from '../fx';
import { LABELS } from './labels';

const ID = 'd20';
const TARGET = 10; // success when the roll is greater than this
const AUTO_MS = 12000; // rolls by itself when the player does not press
const TUMBLE_MS = 1500;
const DIE_X = GAME_WIDTH / 2;
const DIE_Y = 165;
const R = 64;
const OUTLINE = { stroke: '#0a1040', strokeThickness: 3 };
const ROLL_KEYS = ['KeyX', 'Space', 'Enter'];

/** A fair integer 1..20 from the browser's random source. */
function rollD20(): number {
    const c = globalThis.crypto;
    if (c?.getRandomValues) {
        const a = new Uint32Array(1);
        c.getRandomValues(a);
        return (a[0] % 20) + 1;
    }
    return Math.floor(Math.random() * 20) + 1;
}

/** Scene circe, part a (wisdom): press X, the d20 tumbles and lands; more than 10 wins. */
export default class D20Minigame extends Phaser.Scene {
    static KEY = `minigame-${ID}`;
    static ID = ID;

    /** The landed value, 0 until the die has landed. Public so tests can compare it with the result. */
    roll = 0;
    rolling = false;
    ready = false;
    finished = false;

    private waitMs = 0;
    private die!: Phaser.GameObjects.Container;
    private number!: Phaser.GameObjects.Text;
    private hint!: Phaser.GameObjects.Text;
    private countdown!: Phaser.GameObjects.Text;

    constructor() {
        super(D20Minigame.KEY);
    }

    init(): void {
        this.roll = 0;
        this.rolling = false;
        this.ready = false;
        this.finished = false;
        this.waitMs = 0;
    }

    async create(): Promise<void> {
        this.game.events.on('debug:minigame', this.onDebug, this);
        this.events.once('shutdown', () => {
            this.game.events.off('debug:minigame', this.onDebug, this);
            this.input.keyboard?.off('keydown', this.onKey, this);
        });

        this.add.image(0, 0, 'bg-circe').setOrigin(0);
        this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050a28, 0.55).setOrigin(0);
        this.add.text(GAME_WIDTH / 2, 10, LABELS.stat, { ...pixelStyle(32, '#ffe27a'), ...OUTLINE }).setOrigin(0.5, 0);
        this.add.text(GAME_WIDTH / 2, 48, LABELS.need, { ...pixelStyle(16, '#cfe0ff'), ...OUTLINE }).setOrigin(0.5, 0);
        this.drawDie();
        this.hint = this.add.text(GAME_WIDTH / 2, 246, LABELS.press, { ...pixelStyle(16), ...OUTLINE }).setOrigin(0.5, 0);
        this.tweens.add({ targets: this.hint, alpha: 0.3, duration: 450, yoyo: true, repeat: -1 });
        this.countdown = this.add.text(GAME_WIDTH / 2, 270, '', { ...pixelStyle(16, '#cfe0ff'), ...OUTLINE }).setOrigin(0.5, 0);

        await InstructionCard.show(this, ID);
        if (this.finished) return;
        this.input.keyboard!.on('keydown', this.onKey, this);
        this.ready = true;
    }

    update(_time: number, delta: number): void {
        if (!this.ready || this.rolling) return;
        this.waitMs += delta;
        const left = Math.max(0, Math.ceil((AUTO_MS - this.waitMs) / 1000));
        this.countdown.setText(`${LABELS.auto} ${left}`);
        if (this.waitMs >= AUTO_MS) this.startRoll();
    }

    private onKey(e: KeyboardEvent): void {
        if (e.repeat || !ROLL_KEYS.includes(e.code)) return;
        this.startRoll();
    }

    /** The debug keys: the flow reports the result and stops this scene itself, so only stop playing here (no second MINIGAME_DONE). */
    private onDebug(): void {
        this.finished = true;
        this.ready = false;
        this.input.keyboard?.off('keydown', this.onKey, this);
    }

    // ---- the roll ----

    private startRoll(): void {
        if (!this.ready || this.rolling) return;
        this.rolling = true;
        this.hint.setVisible(false);
        this.countdown.setVisible(false);
        this.input.keyboard?.off('keydown', this.onKey, this);
        const value = rollD20();

        // tumble: three turns slowing down, a toss up and a bouncing fall, the number flickering slower and slower
        this.tweens.add({ targets: this.die, angle: 1080, duration: TUMBLE_MS, ease: 'Cubic.Out' });
        this.tweens.add({ targets: this.die, y: DIE_Y - 30, duration: 300, ease: 'Quad.Out' });
        this.tweens.add({ targets: this.die, y: DIE_Y, delay: 300, duration: TUMBLE_MS - 300, ease: 'Bounce.Out' });
        const started = this.time.now;
        const flicker = (): void => {
            const k = Math.min(1, (this.time.now - started) / TUMBLE_MS);
            if (k >= 1) return this.land(value);
            this.number.setText(String(Phaser.Math.Between(1, 20)));
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
        const special = value === 20 ? LABELS.nat20 : value === 1 ? LABELS.nat1 : '';
        if (value === 20) {
            audio.sfx('win');
            this.cameras.main.flash(450, 255, 226, 122);
            this.cameras.main.shake(500, 0.012);
            this.sparkle();
        } else if (value === 1) {
            audio.sfx('lose');
            this.cameras.main.flash(450, 255, 70, 70);
            this.cameras.main.shake(500, 0.012);
        } else audio.sfx(won ? 'confirm' : 'miss');

        const color = won ? '#ffe27a' : '#ff8a8a';
        this.add
            .text(GAME_WIDTH / 2, 238, `${LABELS.roll}: ${value}`, { ...pixelStyle(32, color), ...OUTLINE })
            .setOrigin(0.5, 0);
        this.add
            .text(GAME_WIDTH / 2, 276, special || (won ? LABELS.ok : LABELS.ko), { ...pixelStyle(16, color), ...OUTLINE })
            .setOrigin(0.5, 0);

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
        this.game.events.emit(MINIGAME_DONE, { id: ID, won, score: this.roll || undefined } satisfies MinigameDone);
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
        this.number = this.add.text(0, 6, '20', { ...pixelStyle(32), stroke: '#0a1040', strokeThickness: 4 }).setOrigin(0.5);
        this.die = this.add.container(DIE_X, DIE_Y, [g, this.number]);
    }
}
