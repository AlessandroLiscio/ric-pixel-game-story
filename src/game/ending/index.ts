import Phaser from 'phaser';
import { audio } from '../audio';
import { getRun, resetRun } from '../flow/RunState';
import { MAPS, TileWorld } from '../flow/tileMap';
import { DIALOGUE, pixelStyle } from '../ui/text';
import { balloonTexture, bandTexture, blanketTexture, glowTexture, particleTextures, pillowTexture, scanTexture } from './art';
import { finaleFx, startTvFx } from './fx';
import { LABELS } from './labels';
import { BALLOONS, BAND_CX, BAND_TEXT_W, BAND_X, DEPTH, GAME_HEIGHT, GAME_WIDTH, SCREEN, SPOTS, type Spot } from './layout';
import { FishTv } from './tv';

/** The credits roll lasts about as long as the credits track (24 bars at 100 bpm, 57.6 s): the finale lands on its Happy Birthday phrase. */
const CREDITS_MS = 42000;
const FAST = 4;
const FINALE_CX = 494;
const RESTART_CODES = ['KeyX', 'Enter', 'Space'];
const CONFETTI = [0xff5a6e, 0xffd34a, 0x6ee08a, 0x6ab4ff, 0xff8ae0];

/** Frames of a character sheet (3 columns, rows down, left, right, up): the standing frame of each facing, and the two steps of the up row. */
const FACE = { down: 1, left: 4, right: 7, up: 10 } as const;
const STEP_L = 9;
const STEP_R = 11;

interface Breather {
    img: Phaser.GameObjects.Sprite;
    base: number;
    phase: number;
}
interface Zzz {
    imgs: Phaser.GameObjects.Image[];
    x: number;
    y: number;
}
interface CreditLine {
    obj: Phaser.GameObjects.Text;
    y: number;
}
type Phase = 'credits' | 'finale';

/**
 * The `ending` scene: Casa Circe late at night, the real tile room of the divano scene (src/data/maps/divano.json) as the backdrop.
 * The sofa is opened into a bed, the TV plays a fish documentary, and the whole party is asleep or half asleep on the bed, the
 * chairs and the floor. The credits roll over a dark column on the right, then "Buon compleanno Ric!" and the way back to the title.
 */
export class EndingScene extends Phaser.Scene {
    private tv!: FishTv;
    private clock = 0;
    private tvAcc = 0;
    private flickerAcc = 0;
    private flicker = 1;
    private phase: Phase = 'credits';
    private scroll = 0;
    private maxScroll = 1;
    private credits: CreditLine[] = [];
    private creditsTop = GAME_HEIGHT + 8;
    private breathers: Breather[] = [];
    private zzz: Zzz[] = [];
    private balloons: { img: Phaser.GameObjects.Image; base: number; phase: number }[] = [];
    private glow!: Phaser.GameObjects.Image;
    private band!: Phaser.GameObjects.Image;
    private dim!: Phaser.GameObjects.Rectangle;
    private ricStand: Phaser.GameObjects.Sprite | null = null;
    private keyX!: Phaser.Input.Keyboard.Key;
    private keyShift!: Phaser.Input.Keyboard.Key;
    private canRestart = false;
    private leaving = false;
    private showEnd: (() => void) | null = null;
    private rain: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

    constructor() {
        super('ending');
    }

    create(): void {
        this.clock = 0;
        this.tvAcc = 0;
        this.flickerAcc = 0;
        this.flicker = 1;
        this.phase = 'credits';
        this.scroll = 0;
        this.credits = [];
        this.breathers = [];
        this.zzz = [];
        this.balloons = [];
        this.ricStand = null;
        this.canRestart = false;
        this.leaving = false;
        this.showEnd = null;
        this.rain = [];

        this.cameras.main.fadeIn(700, 0, 0, 0);
        audio.playTrack('credits');
        particleTextures(this);

        this.buildRoom();
        this.buildParty();
        this.buildLight();
        this.buildCredits();
        startTvFx(this);

        this.keyX = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
        this.keyShift = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        this.input.keyboard!.on('keydown', this.onKey, this);
        this.game.events.on('test-skip', this.onSkip, this); // emitted by test builds only
        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keydown', this.onKey, this);
            this.game.events.off('test-skip', this.onSkip, this);
        });
    }

    // ---- the room ----

    private buildRoom(): void {
        new TileWorld(this, MAPS.divano); // the real room: its night mood, lights, fairy lights and dust come with it
        for (const [i, digit] of (['3', '0'] as const).entries()) {
            const img = this.add.image(BALLOONS.x + i * 28, BALLOONS.y, balloonTexture(this, digit)).setOrigin(0).setDepth(DEPTH.tvGlow); // foil: it catches the TV light, so it sits over the night overlay
            this.balloons.push({ img, base: img.y, phase: i * 1.7 });
        }

        // the fish documentary over the screen of the TV in the room, above the night overlay: it is a light, not a surface
        this.tv = new FishTv(this, 'ending-fish');
        this.tv.draw(0);
        this.add.image(SCREEN.x, SCREEN.y, 'ending-fish').setOrigin(0).setDepth(DEPTH.tvPicture);
        this.add.image(SCREEN.x, SCREEN.y, scanTexture(this)).setOrigin(0).setDepth(DEPTH.tvPicture + 1);
    }

    // ---- the party ----

    private person(id: string, s: Spot, frame: number = FACE.left): Phaser.GameObjects.Sprite {
        const img = this.add.sprite(s.x, s.y, `char-${id}`, frame).setOrigin(0.5, 1).setDepth(s.depth);
        this.breathers.push({ img, base: s.y, phase: this.breathers.length * 1.3 });
        return img;
    }

    /** Someone lying on their back, turned by `angle` (the picture keeps its face to the viewer): the spot is the middle of the body. */
    private lying(id: string, s: Spot, angle: number): Phaser.GameObjects.Sprite {
        const img = this.add.sprite(s.x, s.y, `char-${id}`, FACE.down).setRotation(angle).setDepth(s.depth);
        this.breathers.push({ img, base: s.y, phase: this.breathers.length * 1.3 });
        return img;
    }

    private sleepy(x: number, y: number): void {
        const imgs = [0, 1, 2].map(() => this.add.image(x, y, 'ending-z').setDepth(DEPTH.tvGlow).setAlpha(0));
        this.zzz.push({ imgs, x, y });
    }

    private buildParty(): void {
        const results = getRun(this.game).results;
        const slackline = results.slackline === true;
        const cat = results['cat-smoke'] === true;

        // the bed: Liscio and Ric (Ros while Ric balances on the chair) lean on the backrest, Lara lies across the foot on the quilt
        this.person('liscio', SPOTS.bedLeft);
        this.person(slackline ? 'ros' : 'ric', SPOTS.bedRight);
        this.lying('lara', SPOTS.bedFoot, Math.PI / 2);

        // the chairs: Giusy asleep on the left one, the right one is Ric's stage when he won the slackline
        const { chairLeft, chairRight, chairRightStand } = SPOTS;
        this.person('giusy', chairLeft);
        this.sleepy(chairLeft.x + 8, chairLeft.y - 38);
        if (slackline) {
            // standing on one foot on the seat, wobbling
            this.ricStand = this.person('ric', chairRightStand, STEP_L);
            this.breathers.pop(); // the wobble replaces the breathing
        } else {
            this.person('ros', chairRight);
        }

        // the floor: Lollino leans against the pink pouf (it hides all but his head and shoulders), Giuggiu sleeps on her back under a blanket
        const pouf = this.person('lollino', SPOTS.pouf, FACE.up);
        this.sleepy(pouf.x + 6, pouf.y - 36);

        const g = SPOTS.floor;
        this.add.image(g.x - 17, g.y, pillowTexture(this)).setDepth(g.depth - 1);
        this.lying('giuggiu', g, -Math.PI / 2);
        this.add.image(g.x + 7, g.y + 2, blanketTexture(this)).setDepth(g.depth + 1);
        this.sleepy(g.x - 6, g.y - 14);

        if (cat) {
            this.person('gatto', SPOTS.cat, FACE.down);
            this.sleepy(SPOTS.cat.x + 8, SPOTS.cat.y - 28);
        }
    }

    // ---- light ----

    private buildLight(): void {
        // the TV throws a soft flickering light on the room, over the night overlay of the map (which already holds its steady pools)
        this.glow = this.add.image(SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h / 2, glowTexture(this)).setDepth(DEPTH.tvGlow).setBlendMode(Phaser.BlendModes.ADD);
        this.dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05071a, 1).setOrigin(0).setDepth(DEPTH.dim).setAlpha(0);
    }

    // ---- credits ----

    private buildCredits(): void {
        this.band = this.add.image(BAND_X - 24, 0, bandTexture(this)).setOrigin(0).setDepth(DEPTH.band);
        const { title, lines } = DIALOGUE.credits;
        const entries = lines.filter((l) => !/compleanno/i.test(l) || l.includes(' ... '));
        const look = { align: 'center', wordWrap: { width: BAND_TEXT_W }, lineSpacing: 2, stroke: '#05071a', strokeThickness: 3 } as const;
        let y = this.creditsTop;
        const put = (text: string, color: string, gap: number): void => {
            const obj = this.add.text(BAND_CX, y, text, { ...pixelStyle(16, color), ...look }).setOrigin(0.5, 0).setDepth(DEPTH.credits);
            this.credits.push({ obj, y });
            y += obj.height + gap;
        };
        put(title, '#ffe27a', 26);
        let plainBefore = false;
        for (const line of entries) {
            const [name, role] = line.split(' ... ');
            if (role !== undefined) {
                put(name, '#ffe27a', 1);
                put(role, '#cfe0ff', 15);
            } else {
                if (!plainBefore) y += 8;
                plainBefore = true;
                put(line, '#ffffff', 15);
            }
        }
        this.maxScroll = y; // y is now below the last line: scrolled by that much, the last line has left the top of the screen
    }

    // ---- loop ----

    update(_time: number, rawDelta: number): void {
        const delta = Math.min(rawDelta, 100);
        this.clock += delta;
        const t = this.clock;

        // the documentary on the TV (12 fps) and the light it throws
        this.tvAcc += delta;
        if (this.tvAcc >= 80) {
            this.tvAcc = 0;
            this.tv.draw(t);
        }
        this.flickerAcc += delta;
        if (this.flickerAcc >= 90) {
            this.flickerAcc = 0;
            this.flicker += (0.72 + Math.random() * 0.28 - this.flicker) * 0.6;
            this.glow.setAlpha(0.55 + 0.45 * this.flicker);
        }

        // breathing: one pixel up and down, out of step
        for (const b of this.breathers) b.img.y = b.base + (Math.sin(t / 640 + b.phase) > 0.15 ? 1 : 0);
        for (const b of this.balloons) b.img.y = b.base + Math.round(Math.sin(t / 900 + b.phase) * 2);
        if (this.ricStand) {
            this.ricStand.setRotation(Math.sin(t / 330) * 0.08 + Math.sin(t / 870) * 0.05);
            this.ricStand.setFrame(Math.sin(t / 470) > 0 ? STEP_L : STEP_R);
        }
        for (const z of this.zzz) {
            z.imgs.forEach((img, i) => {
                const p = ((t + i * 1100) % 3300) / 3300;
                img.setPosition(Math.round(z.x + p * 10 + Math.sin(p * 8) * 2), Math.round(z.y - p * 22));
                img.setAlpha(Math.sin(p * Math.PI));
                img.setScale(p < 0.45 ? 1 : 1.5);
            });
        }

        if (this.phase === 'credits') this.rollCredits(delta);
    }

    private rollCredits(delta: number): void {
        this.scroll += (this.maxScroll / CREDITS_MS) * delta * (this.keyX.isDown ? FAST : this.keyShift.isDown ? 2 : 1); // Shift: twice as fast
        for (const line of this.credits) {
            const y = Math.round(line.y - this.scroll);
            line.obj.setY(y);
            const mid = y + line.obj.height / 2;
            line.obj.setAlpha(Phaser.Math.Clamp(mid / 40, 0, 1) * Phaser.Math.Clamp((GAME_HEIGHT - mid) / 24, 0, 1));
        }
        if (this.scroll >= this.maxScroll) this.startFinale();
    }

    // ---- finale ----

    private startFinale(): void {
        this.phase = 'finale';
        finaleFx(this);
        this.tweens.add({ targets: this.band, alpha: 0.45, duration: 700 });
        for (const line of this.credits) line.obj.destroy();
        this.tweens.add({ targets: this.dim, alpha: 0.5, duration: 1000 });

        const shadow = { stroke: '#05071a', strokeThickness: 5 };
        const title = this.add.text(FINALE_CX, 74, LABELS.birthday, { ...pixelStyle(32, '#ffe27a'), ...shadow }).setOrigin(0.5).setDepth(DEPTH.finaleText).setScale(0.2).setAlpha(0);
        this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 800, ease: 'Back.Out', delay: 400 });
        this.tweens.add({ targets: title, y: 70, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: 1400 });

        // confetti burst from the title, then a light rain, and sparkles that keep twinkling around the text
        this.time.delayedCall(600, () => {
            audio.sfx('win');
            CONFETTI.forEach((tint) => {
                const burst = this.add.particles(FINALE_CX, 74, 'ending-dot', {
                    speed: { min: 90, max: 300 },
                    angle: { min: 0, max: 360 },
                    gravityY: 260,
                    lifespan: { min: 1400, max: 2600 },
                    scale: { start: 1.6, end: 1 },
                    alpha: { start: 1, end: 0.2 },
                    rotate: { min: 0, max: 360 },
                    tint,
                    emitting: false
                });
                burst.setDepth(DEPTH.particles).explode(14);
                const rain = this.add.particles(0, 0, 'ending-dot', {
                    x: { min: 0, max: GAME_WIDTH },
                    y: -6,
                    speedY: { min: 50, max: 110 },
                    speedX: { min: -25, max: 25 },
                    lifespan: 4200,
                    scale: { min: 1, max: 1.6 },
                    rotate: { min: 0, max: 360 },
                    frequency: 380,
                    maxAliveParticles: 24,
                    tint
                });
                rain.setDepth(DEPTH.particles);
                this.rain.push(rain);
            });
            this.add
                .particles(0, 0, 'ending-star', {
                    x: { min: FINALE_CX - 150, max: FINALE_CX + 150 },
                    y: { min: 56, max: 92 },
                    lifespan: 900,
                    scale: { start: 1.4, end: 0.4 },
                    alpha: { start: 1, end: 0 },
                    frequency: 110,
                    blendMode: 'ADD',
                    tint: 0xfff2a8
                })
                .setDepth(DEPTH.particles);
        });

        const theEnd = this.add.text(FINALE_CX, 126, DIALOGUE.ui.theEnd ?? LABELS.theEnd, { ...pixelStyle(32, '#ffffff'), ...shadow }).setOrigin(0.5).setDepth(DEPTH.finaleText).setAlpha(0);
        const prompt = this.add.text(FINALE_CX, 168, LABELS.restart, { ...pixelStyle(16, '#ffffff'), stroke: '#05071a', strokeThickness: 3 }).setOrigin(0.5).setDepth(DEPTH.finaleText).setAlpha(0);
        const show = (): void => {
            this.tweens.killTweensOf([theEnd, prompt]);
            theEnd.setAlpha(1);
            prompt.setAlpha(1);
            this.tweens.add({ targets: prompt, alpha: 0.2, duration: 560, yoyo: true, repeat: -1 });
            this.canRestart = true;
        };
        this.showEnd = show;
        this.time.delayedCall(3200, () => this.tweens.add({ targets: theEnd, alpha: 1, duration: 600 }));
        this.time.delayedCall(5200, () => {
            if (this.canRestart) return;
            this.tweens.add({ targets: prompt, alpha: 1, duration: 500, onComplete: show });
        });
    }

    // ---- input ----

    private onKey(e: KeyboardEvent): void {
        if (e.repeat || !this.canRestart || this.leaving || !RESTART_CODES.includes(e.code)) return;
        this.leaving = true;
        audio.sfx('confirm');
        audio.stopTrack();
        resetRun(this.game);
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('title'));
    }

    /** Test builds only (the 'test-skip' event): the first skip ends the roll, the next shows the prompt at once. */
    private onSkip(): void {
        if (this.phase === 'credits') this.scroll = this.maxScroll;
        else if (!this.canRestart) this.showEnd?.();
    }
}

export default EndingScene;
