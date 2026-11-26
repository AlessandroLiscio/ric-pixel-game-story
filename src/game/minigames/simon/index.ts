import Phaser from 'phaser';
import { audio } from '../../audio';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config';
import { panelTexture } from '../../ui/panel';
import { InstructionCard } from '../../ui/InstructionCard';
import { pixelStyle, t } from '../../ui/text';
import { runFlag } from '../flags';
import { MINIGAME_DONE, type MinigameDone } from '../types';
import { LABELS, QUESTIONS } from './labels';

// The id stays `simon` (scenes.json, the registry and the run results key on it); the game is now the pinhole camera quiz of scene universita.
const ID = 'simon';
const WIN_AT = 2; // right answers out of the 3 questions that win
const SHADOW = { offsetX: 1, offsetY: 1, color: '#0a1040', blur: 0, stroke: false, fill: true };
const OUTLINE = { stroke: '#0a1040', strokeThickness: 3 };
const UP = ['ArrowUp', 'KeyW'];
const DOWN = ['ArrowDown', 'KeyS'];
const CONFIRM = ['KeyX', 'Enter', 'Space'];

const ROW_X = 16;
const ROW_W = 608;
const ROW_Y = 112;
const ROW_H = 36;
const ROW_GAP = 6;
const LETTERS = ['A', 'B', 'C', 'D'];

type RowState = 'idle' | 'selected' | 'dim' | 'dimSelected' | 'right' | 'wrong';
const ROW_STYLE: Record<RowState, { fill: number; alpha: number; border: number; text: string }> = {
    idle: { fill: 0x1a2f8f, alpha: 0.92, border: 0xeef2ff, text: '#ffffff' },
    selected: { fill: 0x3a5cc7, alpha: 1, border: 0xffe27a, text: '#ffffff' },
    dim: { fill: 0x080c24, alpha: 0.85, border: 0x303a66, text: '#5a6288' },
    dimSelected: { fill: 0x10163a, alpha: 0.9, border: 0xb89a3a, text: '#707aa0' }, // the cursor on a darkened (wrong) answer
    right: { fill: 0x1f7a3a, alpha: 1, border: 0x9dffb0, text: '#ffffff' },
    wrong: { fill: 0x7a1f2a, alpha: 1, border: 0xff8a8a, text: '#ffffff' }
};

/** Scene universita minigame: a 3 question quiz on the pinhole camera, 4 answers each, one right. Up and down choose, X confirms; 2 right of 3 win.
 *  With the run flag `appunti` (Ric found a student's notes in the bin) the wrong answers are drawn dark, so the right one stands out. */
export default class QuizMinigame extends Phaser.Scene {
    static KEY = `minigame-${ID}`;
    static ID = ID;

    /** Public so tests can play: the row of the right answer, the row under the cursor, and whether the quiz takes an answer now. */
    correct = 0;
    sel = 0;
    accepting = false;
    score = 0;
    finished = false;

    private qi = 0;
    private notes = false;
    private rowGfx: Phaser.GameObjects.Graphics[] = [];
    private rowText: Phaser.GameObjects.Text[] = [];
    private pips!: Phaser.GameObjects.Graphics;
    private head!: Phaser.GameObjects.Text;
    private ask!: Phaser.GameObjects.Text;
    private foot!: Phaser.GameObjects.Text;
    private results: boolean[] = [];
    private rowOf: number[] = []; // row -> index in the question's answers (0 is the right one)
    private onAnswer: (() => void) | null = null;

    constructor() {
        super(QuizMinigame.KEY);
    }

    init(): void {
        this.correct = 0;
        this.sel = 0;
        this.accepting = false;
        this.score = 0;
        this.finished = false;
        this.qi = 0;
        this.results = [];
        this.rowGfx = [];
        this.rowText = [];
        this.onAnswer = null;
    }

    async create(): Promise<void> {
        this.notes = runFlag(this.game, 'appunti');
        const onDebug = (): void => {
            // the flow reports the result and stops this scene itself, so only stop playing here (no second MINIGAME_DONE)
            this.finished = true;
            this.accepting = false;
        };
        this.game.events.on('debug:minigame', onDebug);
        this.input.keyboard!.on('keydown', this.onKey, this);
        this.events.once('shutdown', () => {
            this.finished = true;
            this.game.events.off('debug:minigame', onDebug);
            this.input.keyboard?.off('keydown', this.onKey, this);
        });

        this.buildScene();
        await InstructionCard.show(this, ID);
        if (this.finished) return;
        await this.run();
    }

    // ---- scene ----

    private buildScene(): void {
        this.add.image(0, 0, 'bg-universita').setOrigin(0);
        this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a1040, 0.6).setOrigin(0);

        this.head = this.add.text(16, 8, '', { ...pixelStyle(16), ...OUTLINE }).setDepth(5);
        if (this.notes) this.add.text(GAME_WIDTH / 2, 8, LABELS.notes, { ...pixelStyle(16, '#ffe27a'), ...OUTLINE }).setOrigin(0.5, 0).setDepth(5);
        this.pips = this.add.graphics().setDepth(5);

        this.add.image(ROW_X, 30, panelTexture(this, 'quiz-ask', ROW_W, 70)).setOrigin(0);
        this.ask = this.add.text(GAME_WIDTH / 2, 65, '', { ...pixelStyle(16), shadow: SHADOW, align: 'center', lineSpacing: 6, wordWrap: { width: ROW_W - 24 } }).setOrigin(0.5);

        for (let i = 0; i < 4; i++) {
            const y = ROW_Y + i * (ROW_H + ROW_GAP);
            this.rowGfx.push(this.add.graphics({ x: ROW_X, y }));
            this.add.text(ROW_X + 20, y + ROW_H / 2, LETTERS[i], { ...pixelStyle(16, '#0a1040') }).setOrigin(0.5);
            this.rowText.push(this.add.text(ROW_X + 44, y + ROW_H / 2, '', { ...pixelStyle(16), shadow: SHADOW }).setOrigin(0, 0.5));
        }
        this.foot = this.add.text(GAME_WIDTH / 2, 286, '', { ...pixelStyle(16, '#cfe0ff'), ...OUTLINE, align: 'center', lineSpacing: 4, wordWrap: { width: ROW_W - 24 } }).setOrigin(0.5, 0);
    }

    private drawRow(i: number, state: RowState): void {
        const s = ROW_STYLE[state];
        const g = this.rowGfx[i];
        g.clear();
        g.fillStyle(0x0a1040).fillRect(2, 3, ROW_W, ROW_H); // drop shadow
        g.fillStyle(s.border).fillRect(0, 0, ROW_W, ROW_H);
        g.fillStyle(s.fill, s.alpha).fillRect(2, 2, ROW_W - 4, ROW_H - 4);
        g.fillStyle(s.border, state === 'dim' || state === 'dimSelected' ? 0.5 : 1).fillRect(8, 6, 24, ROW_H - 12); // the letter badge
        this.rowText[i].setColor(s.text);
    }

    private drawRows(): void {
        for (let i = 0; i < 4; i++) this.drawRow(i, this.restState(i));
    }

    private restState(i: number): RowState {
        const dim = this.notes && i !== this.correct;
        if (i === this.sel && this.accepting) return dim ? 'dimSelected' : 'selected';
        return dim ? 'dim' : 'idle';
    }

    private drawPips(): void {
        this.pips.clear();
        for (let i = 0; i < QUESTIONS.length; i++) {
            const r = this.results[i];
            this.pips.fillStyle(0x0a1040).fillCircle(566 + i * 24, 16, 9);
            this.pips.fillStyle(r === undefined ? 0x39406e : r ? 0x3fd05a : 0xff6a6a).fillCircle(566 + i * 24, 16, 6);
        }
    }

    // ---- play ----

    private wait(ms: number): Promise<void> {
        return new Promise((resolve) => this.time.delayedCall(ms, resolve));
    }

    private showQuestion(): void {
        const q = QUESTIONS[this.qi];
        this.head.setText(`${LABELS.question} ${this.qi + 1}/${QUESTIONS.length}`);
        this.ask.setText(q.ask);
        this.rowOf = Phaser.Utils.Array.Shuffle([0, 1, 2, 3]);
        this.correct = this.rowOf.indexOf(0);
        this.sel = 0;
        this.rowOf.forEach((a, i) => {
            this.rowText[i].setText(q.answers[a]);
            this.rowGfx[i].setAlpha(1);
        });
        this.foot.setText(LABELS.keys).setColor('#cfe0ff');
        this.drawPips();
    }

    private async run(): Promise<void> {
        for (this.qi = 0; this.qi < QUESTIONS.length; this.qi++) {
            this.showQuestion();
            this.accepting = true;
            this.drawRows();
            await new Promise<void>((resolve) => (this.onAnswer = resolve));
            if (this.finished) return;
            this.reveal();
            await this.wait(2600);
            if (this.finished) return;
        }
        await this.endWith(this.score >= WIN_AT);
    }

    private onKey(e: KeyboardEvent): void {
        if (!this.accepting || e.repeat || this.finished) return;
        if (UP.includes(e.code) || DOWN.includes(e.code)) {
            this.sel = (this.sel + (UP.includes(e.code) ? 3 : 1)) % 4;
            audio.sfx('blip');
            this.drawRows();
        } else if (CONFIRM.includes(e.code)) {
            this.accepting = false;
            this.onAnswer?.();
        }
    }

    private reveal(): void {
        const ok = this.sel === this.correct;
        this.results[this.qi] = ok;
        if (ok) this.score++;
        for (let i = 0; i < 4; i++) {
            this.drawRow(i, i === this.correct ? 'right' : i === this.sel ? 'wrong' : 'dim');
            if (i !== this.correct && i !== this.sel) this.rowGfx[i].setAlpha(0.6);
        }
        this.drawPips();
        audio.sfx(ok ? 'confirm' : 'miss');
        if (!ok) this.cameras.main.shake(160, 0.004);
        this.foot.setText(`${ok ? LABELS.right : LABELS.wrong} ${QUESTIONS[this.qi].why}`).setColor(ok ? '#9dffb0' : '#ffb0b0');
    }

    // ---- end ----

    private async endWith(won: boolean): Promise<void> {
        if (this.finished) return;
        audio.sfx(won ? 'win' : 'lose');
        const w = 400;
        const h = 96;
        const x = (GAME_WIDTH - w) / 2;
        const y = (GAME_HEIGHT - h) / 2;
        const parts = [
            this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45).setOrigin(0),
            this.add.image(x, y, panelTexture(this, 'quiz-banner', w, h)).setOrigin(0),
            this.add.text(GAME_WIDTH / 2, y + 12, t(won ? 'ui.win' : 'ui.lose'), { ...pixelStyle(32, won ? '#ffe27a' : '#ff8a8a'), shadow: SHADOW }).setOrigin(0.5, 0),
            this.add.text(GAME_WIDTH / 2, y + 58, t(`minigames.${ID}.${won ? 'winText' : 'loseText'}`), { ...pixelStyle(16, '#ffffff'), shadow: SHADOW, align: 'center' }).setOrigin(0.5, 0)
        ];
        parts.forEach((p) => p.setDepth(950));
        this.tweens.add({ targets: parts.slice(1), alpha: { from: 0, to: 1 }, duration: 200 });
        await this.wait(1500);
        if (this.finished) return;
        this.finished = true;
        this.game.events.emit(MINIGAME_DONE, { id: ID, won, score: this.score } satisfies MinigameDone);
        this.scene.stop();
    }
}
