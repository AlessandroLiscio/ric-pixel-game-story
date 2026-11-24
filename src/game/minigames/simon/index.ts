import Phaser from 'phaser';
import { audio } from '../../audio';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config';
import { panelTexture } from '../../ui/panel';
import { InstructionCard } from '../../ui/InstructionCard';
import { pixelStyle, t } from '../../ui/text';
import { MINIGAME_DONE, type MinigameDone } from '../types';
import { LABELS } from './labels';

type Dir = 'up' | 'right' | 'down' | 'left';
type PadState = 'dim' | 'lit' | 'bad';

const ID = 'simon';
const LENGTHS = [4, 5, 6]; // keys to remember in rounds 1, 2, 3
const MAX_HEARTS = 3;
const SHOW_MS = 380; // a key stays lit this long while the demonstrator shows it
const GAP_MS = 190;
const IDLE_MS = 8000; // no key for this long counts as a mistake
const SHADOW = { offsetX: 1, offsetY: 1, color: '#0a1040', blur: 0, stroke: false, fill: true };

const PAD_SIZE = 56;
const PAD_POS: Record<Dir, [number, number]> = { up: [440, 112], left: [374, 178], right: [506, 178], down: [440, 244] };
const PAD_COLOR: Record<Dir, { dim: number; lit: number }> = {
    up: { dim: 0x6b2a2a, lit: 0xff6a5e },
    right: { dim: 0x2a5a36, lit: 0x6aef88 },
    down: { dim: 0x2a3f6e, lit: 0x6aa8ff },
    left: { dim: 0x6b5a22, lit: 0xffe27a }
};
const PITCH: Record<Dir, number> = { left: 392, down: 523, up: 659, right: 784 }; // G4 C5 E5 G5, a distinct tone per key
const KEYS: Record<string, Dir> = {
    ArrowUp: 'up',
    KeyW: 'up',
    ArrowDown: 'down',
    KeyS: 'down',
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right'
};
const DIRS: Dir[] = ['up', 'right', 'down', 'left'];

// A pixel-art arrow pointing up, in pad-local pixels; the other directions rotate it.
const ARROW_UP: [number, number][] = [[0, -18], [17, 0], [7, 0], [7, 17], [-7, 17], [-7, 0], [-17, 0]];
function arrowPoints(dir: Dir, dx = 0, dy = 0): Phaser.Math.Vector2[] {
    return ARROW_UP.map(([x, y]) => {
        const [rx, ry] = dir === 'up' ? [x, y] : dir === 'right' ? [-y, x] : dir === 'down' ? [-x, -y] : [y, -x];
        return new Phaser.Math.Vector2(rx + dx, ry + dy);
    });
}

const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];

/** Scene 1 minigame: Prof. Pinolo shows a key sequence on a big arrow pad, the player retypes it. 3 rounds (4, 5, 6 keys), 3 hearts. */
export default class SimonMinigame extends Phaser.Scene {
    static KEY = `minigame-${ID}`;
    static ID = ID;

    private pads = {} as Record<Dir, Phaser.GameObjects.Graphics>;
    private hearts: Phaser.GameObjects.Image[] = [];
    private dots!: Phaser.GameObjects.Graphics;
    private roundText!: Phaser.GameObjects.Text;
    private status!: Phaser.GameObjects.Text;
    private pinolo!: Phaser.GameObjects.Sprite;
    private heartsLeft = MAX_HEARTS;
    private roundsDone = 0;
    private done = false;
    private ending = false;
    private pending: { seq: Dir[]; index: number; resolve: (ok: boolean) => void; idle: Phaser.Time.TimerEvent } | null = null;

    constructor() {
        super(SimonMinigame.KEY);
    }

    async create(): Promise<void> {
        this.done = false;
        this.ending = false;
        this.pending = null;
        this.heartsLeft = MAX_HEARTS;
        this.roundsDone = 0;
        this.hearts = [];

        this.buildScene();
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
        await this.run();
    }

    // ---- scene ----

    private buildScene(): void {
        this.add.image(0, 0, 'bg-universita').setOrigin(0);
        this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a1040, 0.62).setOrigin(0);

        // chalkboard with the round and the hearts
        const board = this.add.graphics();
        board.fillStyle(0x6b4a2a).fillRect(10, 8, 196, 90);
        board.fillStyle(0x1f4a3a).fillRect(14, 12, 188, 82);
        board.fillStyle(0x2d6450, 0.5).fillRect(14, 12, 188, 2);
        this.roundText = this.add.text(108, 18, '', { ...pixelStyle(32, '#f4f1de'), shadow: SHADOW }).setOrigin(0.5, 0);
        this.makeHeartTextures();
        for (let i = 0; i < MAX_HEARTS; i++) this.hearts.push(this.add.image(108 + (i - 1) * 30, 74, 'simon-heart-full').setOrigin(0.5));

        // the demonstrator, pointing his stick at the top corner of the board
        this.add.graphics().lineStyle(3, 0xd9b27a).lineBetween(216, 70, 200, 14);
        const chalk = this.add.circle(201, 12, 5, 0xffe27a);
        this.tweens.add({ targets: chalk, alpha: 0.25, duration: 500, yoyo: true, repeat: -1 });
        this.pinolo = this.add.sprite(238, 100, 'char-pinolo', 4).setOrigin(0.5, 1).setScale(2);

        this.status = this.add.text(108, 150, '', { ...pixelStyle(32, '#ffe27a'), shadow: SHADOW, align: 'center' }).setOrigin(0.5, 0);
        this.dots = this.add.graphics();

        // the arrow pad
        for (const dir of DIRS) {
            const [x, y] = PAD_POS[dir];
            this.pads[dir] = this.add.graphics({ x, y });
            this.drawPad(dir, 'dim');
        }
        this.setRound(0);
    }

    private makeHeartTextures(): void {
        for (const [key, color] of [['simon-heart-full', 0xff5a6a], ['simon-heart-empty', 0x3a3f66]] as const) {
            if (this.textures.exists(key)) continue;
            const g = this.add.graphics();
            g.fillStyle(color);
            HEART.forEach((row, y) => [...row].forEach((c, x) => c === 'X' && g.fillRect(x * 3, y * 3, 3, 3)));
            g.generateTexture(key, 21, 18);
            g.destroy();
        }
    }

    private drawPad(dir: Dir, state: PadState): void {
        const g = this.pads[dir];
        const half = PAD_SIZE / 2;
        const color = state === 'dim' ? PAD_COLOR[dir].dim : state === 'lit' ? PAD_COLOR[dir].lit : 0xff2a2a;
        g.clear();
        if (state !== 'dim') g.fillStyle(color, 0.35).fillRect(-half - 6, -half - 6, PAD_SIZE + 12, PAD_SIZE + 12);
        g.fillStyle(0x0a1040).fillRect(-half + 3, -half + 3, PAD_SIZE, PAD_SIZE); // drop shadow
        g.fillStyle(state === 'dim' ? 0x6f8be6 : 0xffffff).fillRect(-half, -half, PAD_SIZE, PAD_SIZE);
        g.fillStyle(color).fillRect(-half + 2, -half + 2, PAD_SIZE - 4, PAD_SIZE - 4);
        g.fillStyle(0x000000, state === 'dim' ? 0.35 : 0.18).fillPoints(arrowPoints(dir, 2, 2), true);
        g.fillStyle(state === 'dim' ? 0xb8c4f0 : 0xffffff).fillPoints(arrowPoints(dir), true);
    }

    private setRound(round: number): void {
        this.roundText.setText(`${LABELS.round} ${round + 1}/${LENGTHS.length}`);
    }

    private setStatus(text: string, color = '#ffe27a'): void {
        this.status.setText(text).setColor(color);
    }

    private drawDots(done: number, total: number): void {
        this.dots.clear();
        const step = 18;
        const x0 = 108 - ((total - 1) * step) / 2;
        for (let i = 0; i < total; i++) {
            const x = x0 + i * step;
            this.dots.fillStyle(0xeef2ff).fillRect(x - 6, 208, 12, 12);
            this.dots.fillStyle(i < done ? 0xffe27a : 0x1a2f8f).fillRect(x - 4, 210, 8, 8);
        }
    }

    private loseHeart(): void {
        this.heartsLeft--;
        const heart = this.hearts[this.heartsLeft];
        heart.setTexture('simon-heart-empty');
        this.tweens.add({ targets: heart, scale: { from: 1.7, to: 1 }, duration: 260, ease: 'Back.Out' });
    }

    // ---- play ----

    private wait(ms: number): Promise<void> {
        return new Promise((resolve) => this.time.delayedCall(ms, resolve));
    }

    private tone(dir: Dir): void {
        audio.tone(PITCH[dir], 160);
    }

    private flash(dir: Dir, ms: number, state: PadState = 'lit'): void {
        this.drawPad(dir, state);
        this.time.delayedCall(ms, () => this.drawPad(dir, 'dim'));
    }

    private makeSequence(length: number): Dir[] {
        const seq: Dir[] = [];
        while (seq.length < length) {
            const d = DIRS[Phaser.Math.Between(0, 3)];
            if (seq.length >= 2 && seq[seq.length - 1] === d && seq[seq.length - 2] === d) continue; // never three of a kind in a row
            seq.push(d);
        }
        return seq;
    }

    private async run(): Promise<void> {
        for (let round = 0; round < LENGTHS.length; round++) {
            this.setRound(round);
            const seq = this.makeSequence(LENGTHS[round]);
            let again = false;
            await this.wait(800);
            for (;;) {
                if (this.done) return;
                this.drawDots(0, seq.length);
                this.setStatus(again ? LABELS.watchAgain : LABELS.watch);
                await this.wait(450);
                await this.demonstrate(seq);
                if (this.done) return;
                this.setStatus(LABELS.yours, '#9dffb0');
                if (await this.listen(seq)) break;
                if (this.done) return;
                this.setStatus(LABELS.wrong, '#ff8a8a');
                audio.sfx('miss');
                this.cameras.main.shake(180, 0.004);
                this.loseHeart();
                if (this.heartsLeft <= 0) return this.endWith(false);
                again = true;
                await this.wait(1000);
            }
            this.roundsDone++;
            this.setStatus(LABELS.good, '#ffe27a');
            audio.sfx('confirm');
            await this.wait(1100);
        }
        this.endWith(true);
    }

    private async demonstrate(seq: Dir[]): Promise<void> {
        for (const [i, dir] of seq.entries()) {
            if (this.done) return;
            this.flash(dir, SHOW_MS);
            this.tone(dir);
            this.pinolo.setFrame(i % 2 ? 3 : 5); // he sways while he shows the keys
            await this.wait(SHOW_MS + GAP_MS);
        }
        this.pinolo.setFrame(4);
    }

    private listen(seq: Dir[]): Promise<boolean> {
        return new Promise((resolve) => {
            this.drawDots(0, seq.length);
            this.pending = { seq, index: 0, resolve, idle: this.armIdle(resolve) };
        });
    }

    /** No key for IDLE_MS counts as a mistake, so a player who walks away still gets an end. */
    private armIdle(resolve: (ok: boolean) => void): Phaser.Time.TimerEvent {
        return this.time.delayedCall(IDLE_MS, () => {
            this.pending = null;
            resolve(false);
        });
    }

    private onKey(e: KeyboardEvent): void {
        const p = this.pending;
        const dir = KEYS[e.code];
        if (!p || !dir || e.repeat || this.done) return;
        p.idle.remove();
        if (dir === p.seq[p.index]) {
            this.flash(dir, 170);
            this.tone(dir);
            p.index++;
            this.drawDots(p.index, p.seq.length);
            if (p.index === p.seq.length) {
                this.pending = null;
                p.resolve(true);
            } else {
                p.idle = this.armIdle(p.resolve);
            }
        } else {
            this.pending = null;
            this.flash(dir, 450, 'bad');
            p.resolve(false);
        }
    }

    // ---- end ----

    private async endWith(won: boolean): Promise<void> {
        if (this.ending || this.done) return;
        this.ending = true;
        this.pending = null;
        audio.sfx(won ? 'win' : 'lose');
        const w = 400;
        const h = 96;
        const x = (GAME_WIDTH - w) / 2;
        const y = (GAME_HEIGHT - h) / 2;
        const parts = [
            this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45).setOrigin(0),
            this.add.image(x, y, panelTexture(this, 'simon-banner', w, h)).setOrigin(0),
            this.add.text(GAME_WIDTH / 2, y + 12, t(won ? 'ui.win' : 'ui.lose'), { ...pixelStyle(32, won ? '#ffe27a' : '#ff8a8a'), shadow: SHADOW }).setOrigin(0.5, 0),
            this.add.text(GAME_WIDTH / 2, y + 58, t(`minigames.${ID}.${won ? 'winText' : 'loseText'}`), { ...pixelStyle(16, '#ffffff'), shadow: SHADOW, align: 'center' }).setOrigin(0.5, 0)
        ];
        parts.forEach((p) => p.setDepth(950));
        this.tweens.add({ targets: parts.slice(1), alpha: { from: 0, to: 1 }, duration: 200 });
        await this.wait(1500);
        this.emitDone(won);
    }

    private emitDone(won: boolean): void {
        if (this.done) return;
        this.done = true;
        this.game.events.emit(MINIGAME_DONE, { id: ID, won, score: this.roundsDone } satisfies MinigameDone);
        this.scene.stop();
    }
}
