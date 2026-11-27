import Phaser from 'phaser';
import { audio } from '../../audio';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config';
import { ensureCharAnims } from '../../party/anims';
import { InstructionCard } from '../../ui/InstructionCard';
import { panelTexture } from '../../ui/panel';
import { pixelStyle, t } from '../../ui/text';
import { MINIGAME_DONE, type MinigameDone } from '../types';
import { mashStrain } from '../fx';
import { LABELS } from './labels';

const ID = 'mash';
const TIME_MS = 8000;
// Round 6: harder again (DRAIN was 16, a win from about 7.1 presses a second). Net fill per second = presses * GAIN - DRAIN, and 100
// has to fill within the 8 s, so the win starts at about 7.6 presses a second (7 a second: net 10, 80 after 8 s, a loss; 8 a second:
// net 14, a win in 7.1 s; 9 a second: 5.6 s). It takes fast mashing. docs/minigames-slack-d20-mash.md has the table.
const GAIN = 4; // progress points per press (full is 100)
const DRAIN = 18; // progress points lost per second while above 0
const FLOOR_Y = 290;
const GIUSY_X0 = 515;
const PULL_PX = 260; // how far Giusy is dragged from the doorframe when the bar is full
const POST_X = 548;
const ARM_GAP = 84; // Ric stands this far left of Giusy
const BAR_X = 96;
const BAR_W = 400;
const OUTLINE = { stroke: '#0a1040', strokeThickness: 3 };

/** Scene circe, part b (strength): mash X to drag Giusy out of the bathroom before the 8 seconds run out. */
export default class MashMinigame extends Phaser.Scene {
    static KEY = `minigame-${ID}`;
    static ID = ID;

    /** 0 to 100. Public so tests can read it. */
    progress = 0;
    presses = 0;
    playing = false;
    finished = false;

    private leftMs = TIME_MS;
    private jitter = 0; // a few pixels of shake after each press, decays
    private ric!: Phaser.GameObjects.Sprite;
    private giusy!: Phaser.GameObjects.Sprite;
    private arms!: Phaser.GameObjects.Graphics;
    private fill!: Phaser.GameObjects.Rectangle;
    private timeFill!: Phaser.GameObjects.Rectangle;
    private counter!: Phaser.GameObjects.Text;
    private seconds!: Phaser.GameObjects.Text;

    constructor() {
        super(MashMinigame.KEY);
    }

    init(): void {
        this.progress = 0;
        this.presses = 0;
        this.playing = false;
        this.finished = false;
        this.leftMs = TIME_MS;
        this.jitter = 0;
    }

    async create(): Promise<void> {
        this.game.events.on('debug:minigame', this.onDebug, this);
        this.events.once('shutdown', () => {
            this.game.events.off('debug:minigame', this.onDebug, this);
            this.input.keyboard?.off('keydown', this.onKey, this);
        });

        this.drawScene();
        this.drawHud();
        this.place();
        await InstructionCard.show(this, ID);
        if (this.finished) return;
        await this.countIn();
        if (this.finished) return;
        this.input.keyboard!.on('keydown', this.onKey, this);
        this.playing = true;
    }

    update(_time: number, delta: number): void {
        if (!this.playing) return;
        this.leftMs = Math.max(0, this.leftMs - delta);
        this.progress = Math.max(0, this.progress - (DRAIN * delta) / 1000);
        this.jitter *= 0.85;
        this.place();
        this.fill.width = (BAR_W * this.progress) / 100;
        this.timeFill.width = (BAR_W * this.leftMs) / TIME_MS;
        this.timeFill.fillColor = this.leftMs < TIME_MS * 0.25 ? 0xff6a6a : 0xffe27a;
        this.seconds.setText((this.leftMs / 1000).toFixed(1));
        if (this.leftMs <= 0) this.lose();
    }

    // ---- input ----

    private onKey(e: KeyboardEvent): void {
        if (e.repeat || e.code !== 'KeyX' || !this.playing) return; // held-key auto-repeat never counts
        this.presses++;
        this.progress = Math.min(100, this.progress + GAIN);
        this.jitter = 4;
        this.counter.setText(`${LABELS.presses}: ${this.presses}`);
        audio.sfx('blip');
        mashStrain(this, this.ric.x - 4, FLOOR_Y + 2);
        if (this.progress >= 100) this.win();
    }

    /** The debug keys: the flow reports the result and stops this scene itself, so only stop playing here (no second MINIGAME_DONE). */
    private onDebug(): void {
        this.finished = true;
        this.playing = false;
        this.input.keyboard?.off('keydown', this.onKey, this);
    }

    // ---- outcomes ----

    private win(): void {
        this.playing = false;
        this.fill.width = BAR_W;
        audio.sfx('win');
        this.arms.clear();
        // Giusy lets go and lands on the floor, Ric falls on his back
        this.tweens.add({ targets: this.giusy, angle: 90, x: this.giusy.x - 12, y: FLOOR_Y - 24, duration: 380, ease: 'Bounce.Out' });
        this.tweens.add({ targets: this.ric, angle: -90, x: this.ric.x - 30, y: FLOOR_Y - 24, duration: 420, ease: 'Bounce.Out' });
        this.cameras.main.shake(260, 0.006);
        this.time.delayedCall(700, () => this.end(true));
    }

    private lose(): void {
        this.playing = false;
        audio.sfx('lose');
        this.arms.clear();
        // Giusy snaps back to the doorframe, Ric is flung to the floor
        this.tweens.add({ targets: this.giusy, x: GIUSY_X0, duration: 300, ease: 'Back.Out' });
        this.tweens.add({ targets: this.ric, angle: -90, x: this.ric.x - 50, y: FLOOR_Y - 24, duration: 420, ease: 'Bounce.Out' });
        this.time.delayedCall(700, () => this.end(false));
    }

    private end(won: boolean): void {
        if (this.finished) return;
        this.finished = true;
        this.showBanner(t(`minigames.${ID}.${won ? 'winText' : 'loseText'}`), won);
        this.time.delayedCall(1500, () => this.emitDone(won));
    }

    private emitDone(won: boolean): void {
        this.input.keyboard?.off('keydown', this.onKey, this);
        this.game.events.emit(MINIGAME_DONE, { id: ID, won, score: this.presses } satisfies MinigameDone);
        this.scene.stop();
    }

    private showBanner(text: string, good: boolean): void {
        const w = 440;
        const h = 56;
        const y = 124;
        const panel = this.add.image((GAME_WIDTH - w) / 2, y, panelTexture(this, `mini-banner-${w}x${h}`, w, h)).setOrigin(0).setDepth(800);
        const label = this.add
            .text(GAME_WIDTH / 2, y + h / 2, text, { ...pixelStyle(16, good ? '#ffe27a' : '#ff8a8a'), ...OUTLINE, align: 'center' })
            .setOrigin(0.5)
            .setDepth(801);
        this.tweens.add({ targets: [panel, label], alpha: { from: 0, to: 1 }, duration: 160 });
    }

    // ---- drawing ----

    private countIn(): Promise<void> {
        const word = this.add.text(GAME_WIDTH / 2, 120, LABELS.ready, { ...pixelStyle(32, '#ffffff'), ...OUTLINE }).setOrigin(0.5).setDepth(50);
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

    private place(): void {
        const gx = GIUSY_X0 - (PULL_PX * this.progress) / 100 + this.jitter * 0.5;
        this.giusy.setPosition(gx, FLOOR_Y);
        this.ric.setPosition(gx - ARM_GAP - this.jitter, FLOOR_Y).setAngle(-6 - this.jitter);
        this.arms.clear();
        this.arms.lineStyle(4, 0xf1c6a0);
        this.arms.lineBetween(this.ric.x + 18, FLOOR_Y - 50, this.giusy.x - 18, FLOOR_Y - 50); // Ric's hands hold Giusy
        this.arms.lineBetween(this.giusy.x + 15, FLOOR_Y - 63, POST_X, FLOOR_Y - 100); // her other arm clings to the frame
        this.arms.fillStyle(0xf1c6a0).fillRect(POST_X - 4, FLOOR_Y - 104, 8, 8);
    }

    private drawScene(): void {
        this.add.image(0, 0, 'bg-circe').setOrigin(0);
        this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050a28, 0.62).setOrigin(0);
        const g = this.add.graphics();
        // floor
        g.fillStyle(0x24305f).fillRect(0, FLOOR_Y, GAME_WIDTH, GAME_HEIGHT - FLOOR_Y);
        g.fillStyle(0x3a4a86).fillRect(0, FLOOR_Y, GAME_WIDTH, 3);
        // the bathroom door: a dark opening with a wooden frame
        g.fillStyle(0x16202c).fillRect(POST_X + 6, 150, GAME_WIDTH - POST_X - 6, FLOOR_Y - 150);
        g.fillStyle(0x7a5232).fillRect(POST_X - 6, 142, 12, FLOOR_Y - 142); // the post Giusy clings to
        g.fillStyle(0x7a5232).fillRect(POST_X - 6, 142, GAME_WIDTH - POST_X + 6, 12); // top beam
        g.fillStyle(0xa8754a).fillRect(POST_X - 6, 142, 4, FLOOR_Y - 142);
        this.add.text(POST_X + 46, 164, LABELS.sign, { ...pixelStyle(16, '#cfe0ff') }).setOrigin(0.5, 0);
        // a toilet silhouette inside, to make it clear where Giusy hides
        g.fillStyle(0x2c3e52).fillRect(POST_X + 30, FLOOR_Y - 46, 34, 46).fillRect(POST_X + 24, FLOOR_Y - 60, 46, 16);

        ensureCharAnims(this, 'ric');
        ensureCharAnims(this, 'giusy');
        this.giusy = this.add.sprite(GIUSY_X0, FLOOR_Y, 'char-giusy', 4).setOrigin(0.5, 1).setScale(3).setDepth(10); // faces left
        this.ric = this.add.sprite(GIUSY_X0 - ARM_GAP, FLOOR_Y, 'char-ric', 7).setOrigin(0.5, 1).setScale(3).setDepth(11); // faces right
        this.arms = this.add.graphics().setDepth(12);
    }

    private drawHud(): void {
        this.add.text(16, 14, LABELS.strength, { ...pixelStyle(16), ...OUTLINE }).setDepth(20);
        this.add.rectangle(BAR_X - 3, 15, BAR_W + 6, 22, 0x0a1040).setOrigin(0).setStrokeStyle(2, 0xeef2ff).setDepth(20);
        this.fill = this.add.rectangle(BAR_X, 18, 0, 16, 0x3fd05a).setOrigin(0).setDepth(21);
        this.counter = this.add.text(BAR_X + BAR_W + 12, 14, `${LABELS.presses}: 0`, { ...pixelStyle(16, '#ffe27a'), ...OUTLINE }).setDepth(20);

        this.add.text(16, 46, LABELS.time, { ...pixelStyle(16), ...OUTLINE }).setDepth(20);
        this.add.rectangle(BAR_X - 3, 49, BAR_W + 6, 14, 0x0a1040).setOrigin(0).setStrokeStyle(2, 0xeef2ff).setDepth(20);
        this.timeFill = this.add.rectangle(BAR_X, 52, BAR_W, 8, 0xffe27a).setOrigin(0).setDepth(21);
        this.seconds = this.add.text(BAR_X + BAR_W + 12, 46, (TIME_MS / 1000).toFixed(1), { ...pixelStyle(16), ...OUTLINE }).setDepth(20);

        const hint = this.add.text(GAME_WIDTH / 2, 90, LABELS.keys, { ...pixelStyle(16, '#cfe0ff'), ...OUTLINE }).setOrigin(0.5, 0).setDepth(20);
        this.tweens.add({ targets: hint, alpha: 0.3, duration: 350, yoyo: true, repeat: -1 });
    }
}
