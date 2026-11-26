import Phaser from 'phaser';
import { audio } from '../audio';
import { person } from '../flow/data';
import { getRun, resetRun } from '../flow/RunState';
import { MAPS, TileWorld } from '../flow/tileMap';
import { panelTexture } from '../ui/panel';
import { DIALOGUE, pixelStyle } from '../ui/text';
import { balloonTexture, bandTexture, blanketTexture, glowTexture, particleTextures, pillowTexture, scanTexture } from './art';
import { finaleFx, startTvFx } from './fx';
import { LABELS } from './labels';
import { BALLOONS, BAND_CX, BAND_TEXT_W, BAND_X, DEPTH, GAME_HEIGHT, GAME_WIDTH, SCREEN, SPEECH, SPOTS, UPSTAIRS, type Spot } from './layout';
import { awayOf, type Beat, buildBeats, FINALE_MS, LOOP_MS } from './script';
import { FishTv } from './tv';

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
const SHADOW = { offsetX: 1, offsetY: 1, color: '#0a1040', blur: 0, stroke: false, fill: true };
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
 * The TV plays a fish documentary, and the whole party is asleep or half asleep on the sofa (seen from behind, facing the TV), the
 * chairs of the dinner table and the floor. The credits roll over a dark column on the right while the night scene of the divano room is
 * spoken in a banner along the bottom of the room (script.ts), with no input; then "Buon compleanno Ric!" and the way back to the title.
 * Esc or C opens the menu over a paused roll.
 */
export class EndingScene extends Phaser.Scene {
    private tv!: FishTv;
    private clock = 0;
    private tvAcc = 0;
    private flickerAcc = 0;
    private flicker = 1;
    private phase: Phase = 'credits';
    /** Roll time in ms, advanced by `rate` x the frame time; the roll (and the finale) ends at `rollMs`. */
    private roll = 0;
    private rollMs = FINALE_MS;
    private rate = 1;
    private musicStart = 0;
    private beats: Beat[] = [];
    private beatIx = 0;
    private activeBeat: Beat | null = null;
    private gagStart = Infinity;
    private left = false; // the ones who go upstairs have left the room
    private upstairsBusy = false; // they have reached the top of the stairs: the bed creaks
    private creakAcc = 0;
    private away: string[] = [];
    private talkers = new Map<string, { img: Phaser.GameObjects.Sprite; base: number }>();
    private speech!: Phaser.GameObjects.Container;
    private speechPanel!: Phaser.GameObjects.Image;
    private speechFace!: Phaser.GameObjects.Image;
    private speechName!: Phaser.GameObjects.Text;
    private speechBody!: Phaser.GameObjects.Text;
    private hearts!: Phaser.GameObjects.Particles.ParticleEmitter;
    private puffs!: Phaser.GameObjects.Particles.ParticleEmitter;
    private menuClosedAt = 0;
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
    private catSprite: Phaser.GameObjects.Sprite | null = null;
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
        this.roll = 0;
        this.rate = 1;
        this.beatIx = 0;
        this.activeBeat = null;
        this.creakAcc = 0;
        this.menuClosedAt = 0;
        this.talkers = new Map();
        this.credits = [];
        this.breathers = [];
        this.zzz = [];
        this.balloons = [];
        this.ricStand = null;
        this.catSprite = null;
        this.left = false;
        this.upstairsBusy = false;
        this.canRestart = false;
        this.leaving = false;
        this.showEnd = null;
        this.rain = [];

        const run = getRun(this.game);
        this.away = awayOf(run.flags);
        const { beats, rollMs } = buildBeats(run);
        this.beats = beats;
        this.rollMs = rollMs;
        this.gagStart = beats.find((b) => b.upstairs)?.start ?? Infinity;

        this.cameras.main.fadeIn(700, 0, 0, 0);
        audio.playTrack('credits');
        this.musicStart = performance.now();
        particleTextures(this);

        this.buildRoom();
        this.buildParty();
        this.buildLight();
        this.buildUpstairs();
        this.buildSpeech();
        this.buildCredits();
        startTvFx(this);

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
        this.talkers.set(id, { img, base: s.y });
        return img;
    }

    /** Someone lying on their back, turned by `angle` (the picture keeps its face to the viewer): the spot is the middle of the body. */
    private lying(id: string, s: Spot, angle: number): Phaser.GameObjects.Sprite {
        const img = this.add.sprite(s.x, s.y, `char-${id}`, FACE.down).setRotation(angle).setDepth(s.depth);
        this.breathers.push({ img, base: s.y, phase: this.breathers.length * 1.3 });
        this.talkers.set(id, { img, base: s.y });
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

        // everyone is in the room for the whole night; the ones who go upstairs (Liscio and Lara, or Ric) leave when the gag starts (leave())
        const ricOnChair = slackline;

        // the sofa, seen from behind, facing the TV: Liscio, Ric (Ros while Ric balances on the chair) and Lara
        this.person('liscio', SPOTS.sofaLeft, FACE.up);
        this.person(slackline ? 'ros' : 'ric', SPOTS.sofaMid, FACE.up);
        this.person('lara', SPOTS.sofaRight, FACE.up);

        // the chairs of the dinner table: Giusy asleep on the left one (it faces east), the right one (it faces west) is Ric's stage when he won the slackline
        const { chairLeft, chairRight, chairRightStand } = SPOTS;
        this.person('giusy', chairLeft, FACE.right);
        this.sleepy(chairLeft.x + 8, chairLeft.y - 38);
        if (ricOnChair) {
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
            // curled up from behind (the rear row of the sheet shows the striped tail), the tail wagging until he dozes off with the gag
            this.catSprite = this.person('gatto', SPOTS.cat, FACE.up);
            this.sleepy(SPOTS.cat.x + 8, SPOTS.cat.y - 28);
        }
    }

    // ---- light ----

    private buildLight(): void {
        // the TV throws a soft flickering light on the room, over the night overlay of the map (which already holds its steady pools)
        this.glow = this.add.image(SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h / 2, glowTexture(this)).setDepth(DEPTH.tvGlow).setBlendMode(Phaser.BlendModes.ADD);
        this.dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05071a, 1).setOrigin(0).setDepth(DEPTH.dim).setAlpha(0);
    }

    // ---- upstairs: the bed is never shown, only what drifts down from the top of the stairs ----

    private buildUpstairs(): void {
        const x = { min: UPSTAIRS.x - 5, max: UPSTAIRS.x + 5 };
        this.hearts = this.add.particles(0, 0, 'ending-heart', {
            x,
            y: UPSTAIRS.y,
            speedY: { min: -26, max: -16 },
            speedX: { min: -8, max: 10 },
            lifespan: 2600,
            alpha: { start: 1, end: 0 },
            scale: { start: 1, end: 1.5 },
            tint: [0xff7ab8, 0xff9ad0, 0xff5a9a],
            frequency: 420
        });
        this.puffs = this.add.particles(0, 0, 'ending-z', {
            x,
            y: UPSTAIRS.y + 2,
            speedY: { min: -14, max: -9 },
            speedX: { min: 2, max: 9 },
            lifespan: 3200,
            alpha: { start: 0.9, end: 0 },
            scale: { start: 0.8, end: 1.6 },
            tint: 0xffb8dc,
            frequency: 700
        });
        this.hearts.setDepth(DEPTH.hearts);
        this.puffs.setDepth(DEPTH.hearts);
        this.hearts.stop(); // nobody is upstairs yet: the emitters start with the gag (leave())
        this.puffs.stop();
    }

    /** The gag starts: the ones who go upstairs get up, walk to the top of the stairs and are gone; then the bed starts creaking. */
    private leave(): void {
        for (const id of this.away) {
            const who = this.talkers.get(id);
            if (!who) continue;
            this.talkers.delete(id);
            this.breathers = this.breathers.filter((b) => b.img !== who.img);
            if (who.img === this.ricStand) this.ricStand = null;
            who.img.setRotation(0).setFrame(FACE.up);
            this.tweens.add({ targets: who.img, x: UPSTAIRS.x, y: UPSTAIRS.y + 26, alpha: 0, duration: 1800, ease: 'Sine.easeIn' });
        }
        this.time.delayedCall(1800, () => {
            if (this.phase !== 'credits') return; // a skip straight into the finale: no hearts over "Buon compleanno"
            this.upstairsBusy = true; // real time, like the walk: a faster roll after the menu cannot start the creaks early
            this.hearts.start();
            this.puffs.start();
        });
    }

    // ---- speech: the night scene of the divano room, one line at a time ----

    private buildSpeech(): void {
        const style = { ...pixelStyle(16), shadow: SHADOW, lineSpacing: 2 };
        this.speechPanel = this.add.image(0, 0, '__DEFAULT').setOrigin(0);
        this.speechFace = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setScale(SPEECH.portrait / 96);
        this.speechName = this.add.text(0, 0, '', { ...style, color: '#ffe27a' });
        this.speechBody = this.add.text(0, 0, '', style);
        this.speech = this.add.container(0, 0, [this.speechPanel, this.speechFace, this.speechName, this.speechBody]).setDepth(DEPTH.speech).setAlpha(0);
    }

    /** Shows `b` in the banner (or hides it for null): portrait and name of the speaker, or the plain narrator text. */
    private showBeat(b: Beat | null): void {
        this.tweens.killTweensOf(this.speech);
        if (!b) {
            this.tweens.add({ targets: this.speech, alpha: 0, duration: 120 });
            return;
        }
        const face = person(b.speaker)?.portrait;
        const hasFace = !!face && this.textures.exists(face);
        const textX = SPEECH.x + (hasFace ? SPEECH.portrait + 14 : 10);
        const bodyY = b.name ? 24 : 8;
        this.speechBody.setWordWrapWidth(SPEECH.x + SPEECH.w - 8 - textX).setText(b.text).setColor(b.name ? '#ffffff' : '#d6e4ff');
        const h = Math.max(hasFace ? SPEECH.portrait + 12 : 0, bodyY + Math.ceil(this.speechBody.height) + 8);
        const top = SPEECH.bottom - h;
        this.speechPanel.setTexture(panelTexture(this, `ending-panel-${SPEECH.w}x${h}`, SPEECH.w, h)).setPosition(SPEECH.x, top);
        this.speechFace.setVisible(hasFace).setPosition(SPEECH.x + 6, top + 6);
        if (hasFace) this.speechFace.setTexture(face);
        this.speechName.setText(b.name).setPosition(textX, top + 6);
        this.speechBody.setPosition(textX, top + bodyY);
        this.speech.setAlpha(0);
        this.tweens.add({ targets: this.speech, alpha: 1, duration: 120 });
    }

    private runBeats(): void {
        while (this.beatIx < this.beats.length && this.roll >= this.beats[this.beatIx].end) this.beatIx++;
        const b = this.beats[this.beatIx];
        const now = b && this.roll >= b.start ? b : null;
        if (now !== this.activeBeat) {
            this.activeBeat = now;
            this.showBeat(now);
        }
        if (this.roll >= this.gagStart && !this.left) {
            this.left = true;
            this.leave();
        }
    }

    /** A bed creaking upstairs: two low blips, only once someone has gone up there. */
    private creak(delta: number): void {
        if (!this.upstairsBusy) return;
        this.creakAcc += delta;
        if (this.creakAcc < 720) return;
        this.creakAcc = 0;
        audio.tone(Phaser.Math.Between(88, 120), 70);
        this.time.delayedCall(110, () => audio.tone(Phaser.Math.Between(120, 150), 60));
    }

    /** The menu was closed: the music kept playing, so stretch or squeeze the rest of the roll to make its end meet the next Happy Birthday phrase. */
    private resync(): void {
        this.rate = 1;
        if (this.phase !== 'credits') return;
        const left = this.rollMs - this.roll;
        const now = performance.now();
        let best = 0;
        for (let j = 0; j < 8; j++) {
            const gap = this.musicStart + FINALE_MS + j * LOOP_MS - now;
            const r = gap > 0 ? left / gap : 0;
            if (r >= 0.7 && r <= 1.4 && (!best || Math.abs(Math.log(r)) < Math.abs(Math.log(best)))) best = r;
        }
        if (best) this.rate = best;
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
        if (this.catSprite) this.catSprite.setFrame(this.roll >= this.gagStart ? FACE.up : Math.sin(t / 380) > 0 ? STEP_L : STEP_R);
        for (const z of this.zzz) {
            if (this.roll < this.gagStart) break; // they talk through the night and only doze off once the gag starts
            z.imgs.forEach((img, i) => {
                const p = ((t + i * 1100) % 3300) / 3300;
                img.setPosition(Math.round(z.x + p * 10 + Math.sin(p * 8) * 2), Math.round(z.y - p * 22));
                img.setAlpha(Math.sin(p * Math.PI));
                img.setScale(p < 0.45 ? 1 : 1.5);
            });
        }

        // whoever speaks hops a little (the ones gone upstairs are no longer in the room)
        if (this.activeBeat) {
            const who = this.talkers.get(this.activeBeat.speaker);
            if (who) who.img.y = who.base - (Math.floor(t / 130) % 2) * 2;
        }

        if (this.phase === 'credits') this.rollCredits(delta);
    }

    private rollCredits(delta: number): void {
        this.roll += delta * this.rate;
        this.runBeats();
        this.creak(delta);
        this.scroll = (this.maxScroll * this.roll) / this.rollMs;
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
        this.activeBeat = null;
        this.showBeat(null);
        this.hearts.stop();
        this.puffs.stop();
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

    /** Esc (or C, since the browser keeps Esc to leave fullscreen): the menu runs over this scene, which stays paused and drawn until the menu resumes it. */
    private openMenu(): void {
        if (this.leaving) return;
        audio.sfx('confirm');
        this.events.once('resume', () => {
            this.input.keyboard!.resetKeys();
            this.menuClosedAt = performance.now();
            this.resync();
        });
        this.scene.launch('menu', { from: 'ending' });
        this.scene.pause();
    }

    private onKey(e: KeyboardEvent): void {
        if (e.repeat || this.leaving || performance.now() - this.menuClosedAt < 250) return;
        if (e.code === 'Escape' || e.code === 'KeyC') return this.openMenu();
        if (!this.canRestart || !RESTART_CODES.includes(e.code)) return;
        this.leaving = true;
        audio.sfx('confirm');
        audio.stopTrack();
        audio.stopAmbience();
        resetRun(this.game);
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('title'));
    }

    /** Test builds only (the 'test-skip' event): the first skip ends the roll, the next shows the prompt at once. */
    private onSkip(): void {
        if (this.phase === 'credits') this.roll = this.rollMs;
        else if (!this.canRestart) this.showEnd?.();
    }
}

export default EndingScene;
