import Phaser from 'phaser';
import { audio } from '../../audio';
import rhythmTrack from '../../audio/music/rhythm';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config';
import { InstructionCard } from '../../ui/InstructionCard';
import { pixelStyle, t } from '../../ui/text';
import { MINIGAME_DONE, type MinigameDone } from '../types';
import { buildChart, LANE_COUNT, type ChartNote } from './chart';
import { rhythmCombo, rhythmHit } from '../fx';
import { LABELS } from './labels';

const ID = 'rhythm';

// ---- tuning (see docs/music.md) ----
const PERFECT = 0.06; // seconds either side of the note
const GOOD = 0.12;
const EARLY = 0.26; // a press this close to a note, but outside GOOD, counts that note as missed (no double penalty)
// Tuned with a scripted player on the old 91-note chart and checked by hand on the 77-note chart of the 36 s song (see docs/music.md). Round 4:
// the song lost its second A (14 bars, 28 s, about 61 notes) and a miss costs 2.5 instead of 1.25 (a wrong key too). Now a perfect run still ends
// near 93 (round 6 added 9 offbeat notes before the solo, 70 notes in all: a perfect run now reaches about 99), a player who hits about 8 notes in 10 holds 50 (8 * 0.6 - 2 * 2.5 is about 0 per 10 notes), one who hits 7 in 10 loses about 3 points
// per 10 notes and finishes near 30, and one who presses nothing loses at the 20th note, about 14 seconds into the song.
const GAIN = { perfect: 0.7, good: 0.5, miss: -2.5 };
const START_APPROVAL = 50;
const FALL_SECONDS = 1.6; // time a note needs to fall from the top of the screen to the hit line
const COUNT_STEP = 0.8; // seconds per number of the 3-2-1 countdown
const AUDIO_LATENCY = 0; // seconds; an extra manual offset on top of the output latency the beat clock already subtracts
const END_PAUSE_MS = 1500;
const SHAKE_FROM_COMBO = 6;

// ---- layout (640x360) ----
const LANE_W = 56;
const FIELD_X = (GAME_WIDTH - LANE_COUNT * LANE_W) / 2;
const HIT_Y = 268;
const SPEED = (HIT_Y + 12) / FALL_SECONDS; // pixels per second
const FLOOR_Y = 318;
const KEY_CODES = ['KeyQ', 'KeyW', 'KeyE', 'KeyR'];
const KEY_LABELS = ['Q', 'W', 'E', 'R'];
const LANE_COLORS = [0xe0485a, 0xf2c230, 0x4cc26a, 0x4a8cf0];
const LANE_HEX = ['#e0485a', '#f2c230', '#4cc26a', '#4a8cf0'];
const BAND = ['lollino', 'liscio', 'ric', 'lara', 'giuggiu'];
const SHADOW = { offsetX: 1, offsetY: 1, color: '#0a1040', blur: 0, stroke: false, fill: true };

const laneX = (lane: number): number => FIELD_X + lane * LANE_W + LANE_W / 2;

interface Falling {
    n: ChartNote;
    img: Phaser.GameObjects.Image;
    state: 'wait' | 'hit' | 'miss';
}

type Phase = 'card' | 'countdown' | 'play' | 'ending' | 'done';

/** Guitar-hero style: notes of the 'rhythm' track fall on four lanes (Q W E R); the audience approval bar decides. */
export default class RhythmMinigame extends Phaser.Scene {
    static KEY = `minigame-${ID}`;
    static ID = ID;

    /** The chart of this run; read by the browser test. */
    chart: ChartNote[] = [];
    phase: Phase = 'card';
    approval = START_APPROVAL;
    combo = 0;
    maxCombo = 0;

    private falling: Falling[] = [];
    private beatLines: { t: number; line: Phaser.GameObjects.Rectangle }[] = [];
    private glow: number[] = [0, 0, 0, 0];
    private glowRects: Phaser.GameObjects.Rectangle[] = [];
    private pads: Phaser.GameObjects.Rectangle[] = [];
    private spots?: Phaser.GameObjects.Graphics;
    private band: Phaser.GameObjects.Sprite[] = [];
    private meterFill?: Phaser.GameObjects.Rectangle;
    private meterValue?: Phaser.GameObjects.Text;
    private comboText?: Phaser.GameObjects.Text;
    private shown = START_APPROVAL;
    private perfects = 0;
    private goods = 0;
    private songStartedAt = 0;
    /** The clock the notes are drawn at: before the song everything waits above the screen, after it everything freezes. */
    private clock = -10;
    private useWall = false;
    private endAt = 0;
    private soloShown = false;
    private finished = false;
    private doneEmitted = false;
    private bound = false;

    constructor() {
        super(RhythmMinigame.KEY);
    }

    async create(): Promise<void> {
        this.resetState();
        this.drawBackdrop();
        this.drawField();
        this.drawHud();
        this.drawBand();
        this.chart = buildChart(rhythmTrack);
        this.buildNotes();

        this.bindEvents();
        await InstructionCard.show(this, ID);
        if (this.finished) return; // the debug keys ended the minigame while the card was up
        await this.countdown();
        if (this.finished) return;
        this.startSong();
    }

    // ---- public for the test ----

    /** Seconds since the track started; the audio beat clock, or the wall clock when the audio is not running. */
    songClock(): number {
        if (this.useWall) return this.wallClock();
        const a = audio.getBeatClock();
        const wall = this.wallClock();
        if (wall > 0.8 && a < 0.05) { // 0.8 s: the clock stays at 0 for the 50 ms count-in plus the output latency (up to 0.5 s)
            this.useWall = true; // no audio (blocked or muted context): the game stays playable on its own clock
            return wall;
        }
        return a;
    }

    // ---- setup ----

    private resetState(): void {
        this.phase = 'card';
        this.approval = START_APPROVAL;
        this.shown = START_APPROVAL;
        this.combo = 0;
        this.maxCombo = 0;
        this.perfects = 0;
        this.goods = 0;
        this.falling = [];
        this.beatLines = [];
        this.glow = [0, 0, 0, 0];
        this.glowRects = [];
        this.pads = [];
        this.band = [];
        this.useWall = false;
        this.clock = -10;
        this.finished = false;
        this.soloShown = false;
        this.doneEmitted = false;
        this.endAt = (rhythmTrack.steps * 60) / rhythmTrack.bpm / 4 - 0.2;
    }

    private bindEvents(): void {
        if (this.bound) return;
        this.bound = true;
        this.input.keyboard!.on('keydown', this.onKey, this);
        this.game.events.on('debug:minigame', this.onDebug, this);
        this.events.once('shutdown', () => {
            this.bound = false;
            this.finished = true;
            this.phase = 'done';
            this.input.keyboard?.off('keydown', this.onKey, this);
            this.game.events.off('debug:minigame', this.onDebug, this);
            audio.stopTrack();
        });
    }

    private drawBackdrop(): void {
        const g = this.add.graphics().setDepth(0);
        // back wall: dark purple bands with faint brick lines
        const bands = [0x160c28, 0x1a0f30, 0x1e1238, 0x23153f, 0x281846, 0x2c1a4d];
        bands.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, Math.floor((i * FLOOR_Y) / bands.length), GAME_WIDTH, Math.ceil(FLOOR_Y / bands.length) + 1));
        g.fillStyle(0xffffff, 0.05);
        for (let y = 28; y < FLOOR_Y; y += 16) g.fillRect(0, y, GAME_WIDTH, 1);
        // curtains
        for (const [x0, x1] of [[0, 172], [468, GAME_WIDTH]]) {
            for (let x = x0; x < x1; x += 14) g.fillStyle(((x - x0) / 14) % 2 ? 0x741624 : 0x8c1c2c, 1).fillRect(x, 0, Math.min(14, x1 - x), FLOOR_Y);
            g.fillStyle(0x000000, 0.25).fillRect(x0 === 0 ? x1 - 6 : x0, 0, 6, FLOOR_Y);
        }
        // valance with scallops
        g.fillStyle(0x5e0f1d, 1).fillRect(0, 0, GAME_WIDTH, 14);
        for (let x = 8; x < GAME_WIDTH; x += 32) g.fillStyle(0x5e0f1d, 1).fillCircle(x + 8, 14, 12);
        g.fillStyle(0xf2c230, 1).fillRect(0, 0, GAME_WIDTH, 2);
        // wooden floor
        g.fillStyle(0x6b4426, 1).fillRect(0, FLOOR_Y, GAME_WIDTH, GAME_HEIGHT - FLOOR_Y);
        g.fillStyle(0x9a6a3a, 1).fillRect(0, FLOOR_Y, GAME_WIDTH, 2);
        g.fillStyle(0x4f301a, 1);
        for (let x = 0; x < GAME_WIDTH; x += 40) g.fillRect(x, FLOOR_Y + 2, 1, GAME_HEIGHT - FLOOR_Y);
        for (let y = FLOOR_Y + 14; y < GAME_HEIGHT; y += 14) g.fillRect(0, y, GAME_WIDTH, 1);
        this.spots = this.add.graphics().setDepth(1);
    }

    private drawField(): void {
        const panel = this.add.rectangle(FIELD_X - 3, 0, LANE_COUNT * LANE_W + 6, FLOOR_Y, 0x0a0618, 0.82).setOrigin(0).setDepth(2);
        panel.setStrokeStyle(1, 0x6f8be6, 0.8);
        for (let i = 0; i < LANE_COUNT; i++) {
            const x = FIELD_X + i * LANE_W;
            if (i % 2) this.add.rectangle(x, 0, LANE_W, FLOOR_Y, 0xffffff, 0.04).setOrigin(0).setDepth(2);
            if (i > 0) this.add.rectangle(x, 0, 1, FLOOR_Y, 0xffffff, 0.15).setOrigin(0).setDepth(2);
            this.glowRects.push(this.add.rectangle(x, 0, LANE_W, HIT_Y + 10, LANE_COLORS[i], 0).setOrigin(0).setDepth(3));
        }
        // beat and bar lines
        const beat = 60 / rhythmTrack.bpm;
        const total = rhythmTrack.steps / 4; // beats in the song
        for (let b = 0; b <= total; b++) {
            const bar = b % 4 === 0;
            const line = this.add.rectangle(FIELD_X, -10, LANE_COUNT * LANE_W, 1, 0xffffff, bar ? 0.22 : 0.08).setOrigin(0).setDepth(3).setVisible(false);
            this.beatLines.push({ t: b * beat, line });
        }
        // hit line, pads and key labels
        this.add.rectangle(FIELD_X, HIT_Y + 1, LANE_COUNT * LANE_W, 2, 0xffffff, 0.9).setOrigin(0).setDepth(4);
        for (let i = 0; i < LANE_COUNT; i++) {
            const pad = this.add.rectangle(laneX(i), HIT_Y + 1, LANE_W - 8, 16, LANE_COLORS[i], 0.18).setDepth(4);
            pad.setStrokeStyle(2, LANE_COLORS[i], 1);
            this.pads.push(pad);
            const key = this.add.rectangle(laneX(i), HIT_Y + 30, 28, 22, 0x1a2f8f, 1).setDepth(7); // above the notes, so a missed note slides behind its key
            key.setStrokeStyle(2, 0xeef2ff, 1);
            this.add
                .text(laneX(i), HIT_Y + 30, KEY_LABELS[i], { ...pixelStyle(16, LANE_HEX[i]), shadow: SHADOW })
                .setOrigin(0.5)
                .setDepth(8);
        }
        for (let i = 0; i < LANE_COUNT; i++) {
            const key = `rhythm-note-${i}`;
            if (this.textures.exists(key)) continue;
            const c = this.textures.createCanvas(key, 48, 14)!;
            const ctx = c.context;
            const hex = LANE_HEX[i];
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 48, 14);
            ctx.fillStyle = hex;
            ctx.fillRect(2, 2, 44, 10);
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fillRect(2, 2, 44, 3);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(2, 9, 44, 3);
            ctx.clearRect(0, 0, 2, 2);
            ctx.clearRect(46, 0, 2, 2);
            ctx.clearRect(0, 12, 2, 2);
            ctx.clearRect(46, 12, 2, 2);
            c.refresh();
        }
    }

    private buildNotes(): void {
        this.falling = this.chart.map((n) => ({
            n,
            state: 'wait' as const,
            img: this.add.image(laneX(n.lane), -40, `rhythm-note-${n.lane}`).setDepth(6).setVisible(false)
        }));
    }

    private drawHud(): void {
        // audience meter, left
        this.add.text(38, 30, LABELS.audience, { ...pixelStyle(16, '#ffe27a'), shadow: SHADOW }).setOrigin(0.5, 0).setDepth(8);
        const mx = 24;
        const my = 64;
        const mw = 28;
        const mh = 192;
        this.add.rectangle(mx - 2, my - 2, mw + 4, mh + 4, 0x0a0618, 0.9).setOrigin(0).setDepth(8).setStrokeStyle(2, 0xeef2ff, 1);
        this.meterFill = this.add.rectangle(mx, my + mh, mw, mh / 2, 0xf2c230, 1).setOrigin(0, 1).setDepth(9);
        this.add.rectangle(mx - 4, my + mh / 2, mw + 8, 1, 0xffffff, 0.7).setOrigin(0).setDepth(10); // the 50 mark: where a finished song still wins
        this.meterValue = this.add.text(38, my + mh + 8, String(START_APPROVAL), { ...pixelStyle(16), shadow: SHADOW }).setOrigin(0.5, 0).setDepth(8);
        // title and combo, right
        this.add.text(554, 22, t('minigames.rhythm.title'), { ...pixelStyle(16, '#ffe27a'), shadow: SHADOW, align: 'center', wordWrap: { width: 150 } }).setOrigin(0.5, 0).setDepth(8);
        this.add.text(554, 90, LABELS.combo, { ...pixelStyle(16, '#cfe0ff'), shadow: SHADOW }).setOrigin(0.5, 0).setDepth(8);
        this.comboText = this.add.text(554, 112, '0', { ...pixelStyle(32), shadow: SHADOW }).setOrigin(0.5, 0).setDepth(8);
    }

    private drawBand(): void {
        BAND.forEach((id, i) => {
            const key = `char-${id}`;
            if (!this.textures.exists(key)) return;
            const x = 120 + i * 100;
            const s = this.add.sprite(x, GAME_HEIGHT - 8, key, 1).setOrigin(0.5, 1).setDepth(7);
            this.band.push(s);
        });
    }

    // ---- flow ----

    private countdown(): Promise<void> {
        this.phase = 'countdown';
        const words = ['3', '2', '1', LABELS.go];
        return new Promise((resolve) => {
            words.forEach((w, i) => {
                this.time.delayedCall(i * COUNT_STEP * 1000, () => {
                    if (this.finished) return;
                    const txt = this.add
                        .text(GAME_WIDTH / 2, 120, w, { ...pixelStyle(32, i === 3 ? '#ffe27a' : '#ffffff'), shadow: SHADOW })
                        .setOrigin(0.5)
                        .setDepth(20);
                    audio.sfx(i === 3 ? 'confirm' : 'blip');
                    this.tweens.add({ targets: txt, scale: { from: 2.2, to: 1 }, alpha: { from: 1, to: 0.2 }, duration: COUNT_STEP * 1000 * 0.9, onComplete: () => txt.destroy() });
                    if (i === words.length - 1) resolve();
                });
            });
        });
    }

    private startSong(): void {
        this.phase = 'play';
        this.songStartedAt = this.time.now;
        audio.playTrack(rhythmTrack.id);
    }

    private wallClock(): number {
        return (this.time.now - this.songStartedAt) / 1000 - 0.05;
    }

    /** The debug keys: the flow reports the result and stops this scene itself, so only stop playing here (no second MINIGAME_DONE). */
    private onDebug = (): void => {
        if (this.finished) return;
        this.finished = true;
        this.phase = 'ending';
        audio.stopTrack();
    };

    // ---- input and judging ----

    private onKey(e: KeyboardEvent): void {
        const lane = KEY_CODES.indexOf(e.code);
        if (lane < 0 || e.repeat || this.phase !== 'play') return;
        this.glow[lane] = 1;
        const clock = this.songClock() - AUDIO_LATENCY;
        let best: Falling | undefined;
        let bestD = Infinity;
        for (const f of this.falling) {
            if (f.state !== 'wait' || f.n.lane !== lane) continue;
            const d = Math.abs(f.n.t - clock);
            if (d < bestD) {
                best = f;
                bestD = d;
            }
        }
        if (best && bestD <= GOOD) this.hit(best, bestD <= PERFECT);
        else if (best && bestD <= EARLY) this.miss(best);
        else this.wrongKey(lane);
    }

    private hit(f: Falling, perfect: boolean): void {
        f.state = 'hit';
        f.img.setVisible(false);
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        if (perfect) this.perfects++;
        else this.goods++;
        audio.sfx('hit');
        const lane = f.n.lane;
        const flash = this.add.rectangle(laneX(lane), HIT_Y + 1, LANE_W - 8, 16, perfect ? 0xffffff : LANE_COLORS[lane], 0.95).setDepth(7);
        this.tweens.add({ targets: flash, scaleX: 1.5, scaleY: 2.6, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
        this.floatText(lane, perfect ? LABELS.perfect : LABELS.good, perfect ? '#ffe27a' : '#9be8a8');
        rhythmHit(this, laneX(lane), HIT_Y, LANE_HEX[lane], perfect);
        rhythmCombo(this, this.combo, 554, 222);
        this.refreshCombo(true);
        this.addApproval(perfect ? GAIN.perfect : GAIN.good);
    }

    private miss(f: Falling): void {
        f.state = 'miss';
        f.img.setTint(0x666666).setAlpha(0.55);
        this.floatText(f.n.lane, LABELS.miss, '#ff8a8a');
        this.breakCombo();
        audio.sfx('miss');
        this.addApproval(GAIN.miss);
    }

    private wrongKey(lane: number): void {
        this.floatText(lane, LABELS.wrong, '#ff8a8a');
        this.breakCombo();
        audio.sfx('miss');
        this.addApproval(GAIN.miss);
    }

    private breakCombo(): void {
        if (this.combo >= SHAKE_FROM_COMBO) this.cameras.main.shake(180, 0.006);
        this.combo = 0;
        this.refreshCombo(false);
    }

    private refreshCombo(bump: boolean): void {
        this.comboText?.setText(String(this.combo));
        if (bump) this.tweens.add({ targets: this.comboText, scale: { from: 1.35, to: 1 }, duration: 120 });
    }

    private floatText(lane: number, word: string, color: string): void {
        const txt = this.add
            .text(laneX(lane), HIT_Y - 22, word, { ...pixelStyle(16, color), shadow: SHADOW, align: 'center' })
            .setOrigin(0.5)
            .setDepth(12);
        this.tweens.add({ targets: txt, y: HIT_Y - 58, alpha: 0, duration: 520, onComplete: () => txt.destroy() });
    }

    private addApproval(delta: number): void {
        if (this.finished) return;
        this.approval = Math.min(100, Math.max(0, this.approval + delta));
        if (this.approval >= 100) this.finish(true);
        else if (this.approval <= 0) this.finish(false);
    }

    // ---- end ----

    private finish(won: boolean): void {
        if (this.finished) return;
        this.finished = true;
        this.phase = 'ending';
        audio.stopTrack();
        audio.sfx(won ? 'win' : 'lose');
        this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0).setDepth(30);
        this.add
            .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, t(`minigames.rhythm.${won ? 'winText' : 'loseText'}`), {
                ...pixelStyle(32, won ? '#ffe27a' : '#ff8a8a'),
                shadow: SHADOW,
                align: 'center',
                wordWrap: { width: 560 }
            })
            .setOrigin(0.5)
            .setDepth(31);
        this.time.delayedCall(END_PAUSE_MS, () => this.emitDone(won));
    }

    private emitDone(won: boolean): void {
        if (this.doneEmitted) return;
        this.doneEmitted = true;
        this.phase = 'done';
        const score = this.perfects * 100 + this.goods * 50;
        this.game.events.emit(MINIGAME_DONE, { id: ID, won, score } satisfies MinigameDone);
        this.scene.stop();
    }

    // ---- per frame ----

    update(_time: number, delta: number): void {
        if (this.phase === 'play') {
            this.clock = this.songClock() - AUDIO_LATENCY;
            this.updatePlay(this.clock);
        }
        this.updateVisuals(delta / 1000, this.clock);
    }

    private updatePlay(clock: number): void {
        for (const f of this.falling) {
            if (f.state === 'wait' && f.n.t < clock - GOOD) this.miss(f);
        }
        // the bass solo is announced as its first notes start to fall
        const soloAt = this.chart.find((n) => n.solo)?.t;
        if (!this.soloShown && soloAt !== undefined && clock >= soloAt - FALL_SECONDS - 0.4) this.showSolo();
        if (clock >= this.endAt) this.finish(this.approval >= 50);
    }

    private showSolo(): void {
        this.soloShown = true;
        const txt = this.add
            .text(GAME_WIDTH / 2, 64, LABELS.solo, { ...pixelStyle(32, '#ffe27a'), shadow: SHADOW, stroke: '#0a1040', strokeThickness: 4 })
            .setOrigin(0.5)
            .setDepth(20);
        this.tweens.add({ targets: txt, scale: { from: 2.4, to: 1 }, duration: 260, ease: 'Back.Out' });
        this.tweens.add({ targets: txt, alpha: 0.35, delay: 300, duration: 220, yoyo: true, repeat: 5 });
        this.tweens.add({ targets: txt, alpha: 0, delay: 3200, duration: 400, onComplete: () => txt.destroy() });
        this.cameras.main.shake(260, 0.006);
    }

    private updateVisuals(dt: number, clock: number): void {
        for (const f of this.falling) {
            if (f.state === 'hit') continue;
            const y = HIT_Y + 1 - (f.n.t - clock) * SPEED;
            f.img.y = Math.round(y);
            f.img.setVisible(y > -14 && y < FLOOR_Y - 8);
        }
        for (const b of this.beatLines) {
            const y = HIT_Y + 1 - (b.t - clock) * SPEED;
            b.line.y = Math.round(y);
            b.line.setVisible(y > 0 && y < HIT_Y + 8);
        }
        for (let i = 0; i < LANE_COUNT; i++) {
            this.glow[i] = Math.max(0, this.glow[i] - dt * 6);
            this.glowRects[i]?.setFillStyle(LANE_COLORS[i], this.glow[i] * 0.35);
            this.pads[i]?.setFillStyle(LANE_COLORS[i], 0.18 + this.glow[i] * 0.6);
        }
        // approval meter eases towards the real value
        this.shown += (this.approval - this.shown) * Math.min(1, dt * 10);
        const shown = Math.min(100, Math.max(0, this.shown));
        if (this.meterFill) {
            this.meterFill.setSize(28, Math.max(1, (192 * shown) / 100));
            this.meterFill.setFillStyle(shown >= 60 ? 0x4cc26a : shown >= 35 ? 0xf2c230 : 0xe0485a, 1);
        }
        this.meterValue?.setText(String(Math.round(this.approval)));
        // the band jumps a little on every beat; the spotlights breathe with the approval
        const beat = clock > -1 ? clock / (60 / rhythmTrack.bpm) : 0;
        const phase = beat - Math.floor(beat);
        const hop = clock > 0 ? Math.max(0, 1 - phase * 4) * 5 : 0;
        const even = Math.floor(Math.max(0, beat)) % 2 === 0;
        this.band.forEach((s, i) => {
            s.y = GAME_HEIGHT - 8 - Math.round(hop * (i % 2 ? 0.7 : 1));
            s.setFrame(clock > 0 ? (even !== (i % 2 === 0) ? 0 : 2) : 1);
        });
        const g = this.spots;
        if (g) {
            g.clear();
            const a = 0.05 + (this.shown / 100) * 0.1 + (clock > 0 ? Math.max(0, 1 - phase * 3) * 0.05 : 0);
            g.fillStyle(0xffe27a, a);
            g.fillTriangle(110, 14, 20, FLOOR_Y, 230, FLOOR_Y);
            g.fillTriangle(530, 14, 410, FLOOR_Y, 620, FLOOR_Y);
        }
    }
}
