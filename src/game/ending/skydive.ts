import Phaser from 'phaser';
import { audio } from '../audio';
import { BIRTHDAY_STEP } from '../audio/music/credits';
import { person } from '../flow/data';
import { resetRun } from '../flow/RunState';
import { CONFIRM_CODES } from '../ui/DialogBox';
import { DIALOGUE, lines, pixelStyle } from '../ui/text';
import { bandTexture, particleTextures, seeded } from './art';
import { SpeechBanner } from './banner';
import { finaleFx } from './fx';
import { LABELS } from './labels';
import { BAND_CX, BAND_TEXT_W, BAND_X, DEPTH, GAME_HEIGHT, GAME_WIDTH, SPEECH } from './layout';
import * as art from './sky-art';

const FINALE_CX = 494;
const CONFETTI = [0xff5a6e, 0xffd34a, 0x6ee08a, 0x6ab4ff, 0xff8ae0];
const LEAD_IN_MS = 2500; // the plane flies in before the first line
const SCROLL_MS = 45000; // the credits column has gone by in this long
const HURRY = 4; // how much faster the column runs while a confirm key is held
const CHUTE_OPEN_MS = 4700; // from the jump to the first canopy: about 3 s of free fall after the last one is out

/** Where the plane cruises (its middle); all the action stays left of the credits column. */
const CRUISE = { x: 196, y: 108 };
const GROUND_Y = GAME_HEIGHT - art.GROUND.h * art.SKY_SCALE;
const FEET_Y = 330; // where the three stand on the grass
/** From the top of a jumper's rig to the middle of the free fall picture, in screen pixels. */
const DIVER_DY = 48 * art.SKY_SCALE;

/** In jump order. `x` is the column of each one; `fallY` the middle of the body in free fall, `hangY` the top of the canopy on the way down. */
const SPOTS: { id: art.JumperId; x: number; fallY: number; hangY: number; jumpAt: number }[] = [
    { id: 'lara', x: 320, fallY: 142, hangY: 96, jumpAt: 500 },
    { id: 'ric', x: 198, fallY: 206, hangY: 62, jumpAt: 1100 },
    { id: 'liscio', x: 76, fallY: 168, hangY: 104, jumpAt: 1700 }
];
/** The windows of the plane, from the tail to the nose. */
const SEATS: art.JumperId[] = ['liscio', 'ric', 'lara'];
/** Cruise, free fall, under the canopies, on the ground: the speed the clouds go by at (near ones; the far ones are slower). */
const WIND = { plane: { x: -46, y: 0 }, fall: { x: 0, y: -520 }, chute: { x: -3, y: -34 }, ground: { x: -6, y: 0 } };

interface Beat {
    speaker: string;
    name: string;
    text: string;
}

/** One of the three after leaving the plane: a container with the canopy, the standing picture under it and the free fall picture. */
interface Jumper {
    spot: (typeof SPOTS)[number];
    rig: Phaser.GameObjects.Container;
    chute: Phaser.GameObjects.Image;
    body: Phaser.GameObjects.Sprite;
    diver: Phaser.GameObjects.Image;
    heap: Phaser.GameObjects.Image;
    bubble: Phaser.GameObjects.Container | null;
    mode: 'aboard' | 'fall' | 'chute' | 'down';
    /** The position the rig moves around; the wobble and the sway are added in update(). */
    at: { x: number; y: number; sway: number; tilt: number };
    landY: number;
}

interface Cloud {
    img: Phaser.GameObjects.Image;
    x: number;
    y: number;
    depth: number; // parallax: 1 for the near ones
}
interface CreditLine {
    obj: Phaser.GameObjects.Text;
    y: number;
}
type Phase = 'plane' | 'fall' | 'land' | 'finale';

/**
 * The `skydive` scene: the birthday present. A small plane flies in with Liscio, Ric and Lara at its windows and they talk in the banner,
 * one line per press of X; then they jump, fall, open their canopies and drift down while the credits roll on the right (holding X hurries
 * them). When the last credits line is gone the fields of Bologna rise, the three land, then "Buon compleanno Ric!" and the way back to the
 * title. Esc or C opens the menu over a paused scene.
 */
export class SkydiveScene extends Phaser.Scene {
    private phase: Phase = 'plane';
    private beats: Beat[] = [];
    /** The line on screen; -1 before the first one, `beats.length` once all are read. */
    private beatIx = -1;
    private canRestart = false;
    private leaving = false;
    private showEnd: (() => void) | null = null;
    private clock = 0;
    private menuClosedAt = 0;
    private banner!: SpeechBanner;
    private plane!: Phaser.GameObjects.Container;
    private planeBody!: Phaser.GameObjects.Image;
    private prop!: Phaser.GameObjects.Image;
    private propFrames: string[] = [];
    private heads = new Map<string, { img: Phaser.GameObjects.Image; base: number }>();
    /** The cruise position of the plane: it flies in, and out again, by tweening this. */
    private flight = { x: 0, y: 0 };
    private droneAcc = 0;
    private droneStep = 0;
    private jumpers: Jumper[] = [];
    private landed = 0;
    private clouds: Cloud[] = [];
    private wind = { x: 0, y: 0 };
    private windTarget: { x: number; y: number } = WIND.plane;
    private streaks!: Phaser.GameObjects.Particles.ParticleEmitter;
    private ground!: Phaser.GameObjects.Image;
    private band!: Phaser.GameObjects.Image;
    private dim!: Phaser.GameObjects.Rectangle;
    private credits: CreditLine[] = [];
    private creditsTop = GAME_HEIGHT + 8;
    /** Time of the credits column in ms: it has gone by at SCROLL_MS. */
    private roll = 0;
    private maxScroll = 1;
    private hurryKeys: Phaser.Input.Keyboard.Key[] = [];

    constructor() {
        super('skydive');
    }

    private get activeBeat(): Beat | null {
        return this.beats[this.beatIx] ?? null;
    }

    create(): void {
        this.phase = 'plane';
        this.beatIx = -1;
        this.canRestart = false;
        this.leaving = false;
        this.showEnd = null;
        this.clock = 0;
        this.menuClosedAt = 0;
        this.heads = new Map();
        this.droneAcc = 0;
        this.droneStep = 0;
        this.jumpers = [];
        this.landed = 0;
        this.clouds = [];
        this.wind = { ...WIND.plane };
        this.windTarget = WIND.plane;
        this.credits = [];
        this.roll = 0;

        this.beats = lines('skydive.plane').map((l) => ({ speaker: l.speaker, name: person(l.speaker)?.name ?? '', text: l.text.replace(/\s*\n\s*/g, ' ') }));

        this.cameras.main.fadeIn(700, 0, 0, 0);
        audio.stopAmbience(); // no street noise up here
        audio.playTrack('credits');
        particleTextures(this);

        this.buildSky();
        this.buildPlane();
        this.buildJumpers();
        this.banner = new SpeechBanner(this, SPEECH, DEPTH.speech);
        this.buildCredits();
        this.dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05071a, 1).setOrigin(0).setDepth(DEPTH.dim).setAlpha(0);

        const kb = this.input.keyboard!;
        this.hurryKeys = ['X', 'ENTER', 'SPACE'].map((k) => kb.addKey(k, false));
        kb.on('keydown', this.onKey, this);
        this.game.events.on('test-skip', this.onSkip, this); // emitted by test builds only
        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keydown', this.onKey, this);
            this.game.events.off('test-skip', this.onSkip, this);
        });
    }

    // ---- the sky and what is below it ----

    private buildSky(): void {
        this.add.image(0, 0, art.skyTexture(this)).setOrigin(0).setScale(art.SKY_SCALE);
        const rnd = seeded(7);
        // far clouds at 1x, slow and pale; near ones at 2x
        for (let i = 0; i < 12; i++) {
            const near = i >= 7;
            const img = this.add
                .image(0, 0, art.cloudTexture(this, i % art.CLOUD_SHAPES))
                .setScale(near ? art.SKY_SCALE : 1)
                .setAlpha(near ? 0.95 : 0.7)
                .setDepth(near ? 20 : 10);
            const slot = near ? i - 7 : i;
            this.clouds.push({ img, x: ((slot + rnd() * 0.6) * 800) / (near ? 5 : 7), y: 20 + rnd() * (near ? 330 : 240), depth: near ? 1 : 0.35 });
        }
        for (const c of this.clouds) c.img.setPosition(Math.round(c.x), Math.round(c.y));

        this.streaks = this.add.particles(0, 0, art.streakTexture(this), {
            x: { min: 4, max: BAND_X - 24 },
            y: { min: GAME_HEIGHT, max: GAME_HEIGHT + 60 },
            speedY: { min: -900, max: -640 },
            scaleX: art.SKY_SCALE,
            scaleY: { min: 1, max: 3 },
            alpha: { min: 0.35, max: 0.8 },
            lifespan: 700,
            frequency: 28
        });
        this.streaks.setDepth(30).stop();

        this.ground = this.add.image(0, GAME_HEIGHT, art.groundTexture(this)).setOrigin(0).setScale(art.SKY_SCALE).setDepth(60);
    }

    private moveClouds(delta: number): void {
        const ease = Math.min(1, delta / 350);
        this.wind.x += (this.windTarget.x - this.wind.x) * ease;
        this.wind.y += (this.windTarget.y - this.wind.y) * ease;
        for (const c of this.clouds) {
            c.x += (this.wind.x * c.depth * delta) / 1000;
            c.y += (this.wind.y * c.depth * delta) / 1000;
            if (c.x < -80) c.x += 800;
            if (c.y < -40) {
                c.y += 440;
                c.x = Math.random() * GAME_WIDTH;
            }
            c.img.setPosition(Math.round(c.x), Math.round(c.y));
        }
    }

    // ---- the plane ----

    private buildPlane(): void {
        const ox = -art.PLANE.w / 2;
        const oy = -art.PLANE.h / 2;
        art.planeTexture(this, true);
        this.planeBody = this.add.image(ox, oy, art.planeTexture(this, false)).setOrigin(0);
        const heads = SEATS.map((id, i) => {
            const w = art.PLANE.windows[i];
            const img = this.add.image(ox + w.x, oy + w.y + 16, art.headTexture(this, id)).setOrigin(0, 1);
            this.heads.set(id, { img, base: img.y });
            return img;
        });
        this.propFrames = art.propTextures(this);
        this.prop = this.add.image(ox + art.PLANE.prop.x, oy + art.PLANE.prop.y, this.propFrames[0]);
        this.flight = { x: -art.PLANE.w - 20, y: CRUISE.y - 26 };
        this.plane = this.add.container(this.flight.x, this.flight.y, [this.planeBody, ...heads, this.prop]).setScale(art.SKY_SCALE).setDepth(100);
        this.tweens.add({ targets: this.flight, x: CRUISE.x, y: CRUISE.y, duration: LEAD_IN_MS + 300, ease: 'Sine.easeOut' });
    }

    /** A low square wave stuttering under the music, while the plane is in sight. */
    private drone(delta: number): void {
        if (!this.plane.visible || this.plane.x > GAME_WIDTH) return;
        this.droneAcc += delta;
        if (this.droneAcc < 90) return;
        this.droneAcc = 0;
        audio.tone(this.droneStep++ % 2 ? 55 : 49, 45);
    }

    // ---- the jump ----

    private buildJumpers(): void {
        for (const spot of SPOTS) {
            const { shoulder } = art.JUMPERS[spot.id];
            const bodyY = art.CHUTE.shoulderY - shoulder;
            const landY = FEET_Y - (bodyY + 31) * art.SKY_SCALE; // the feet are on row 31 of the standing frame
            const chute = this.add.image(0, 0, art.chuteTexture(this, spot.id)).setOrigin(0.5, 0);
            const body = this.add.sprite(0, bodyY, `char-${spot.id}`, art.STAND_FRAME).setOrigin(0.5, 0);
            const diver = this.add.image(0, DIVER_DY / art.SKY_SCALE, art.diverTexture(this, spot.id));
            const rig = this.add.container(0, 0, [chute, body, diver]).setScale(art.SKY_SCALE).setDepth(DEPTH.dim + 5).setVisible(false); // over the finale's dim
            // the collapsed canopy lies just behind its owner, to the right
            const heap = this.add.image(spot.x + 8, FEET_Y - 2, art.heapTexture(this, spot.id)).setOrigin(0, 1).setScale(art.SKY_SCALE).setDepth(DEPTH.dim + 4).setVisible(false);
            this.jumpers.push({ spot, rig, chute, body, diver, heap, bubble: null, mode: 'aboard', at: { x: spot.x, y: 0, sway: 0, tilt: 0 }, landY });
        }
    }

    /** The last line is read: the door opens, the three jump one after the other, the plane flies off and the credits start. */
    private jump(): void {
        this.phase = 'fall';
        this.beatIx = this.beats.length;
        this.banner.show(null);
        this.planeBody.setTexture(art.planeTexture(this, true));
        audio.sfx('door');
        this.tweens.add({ targets: this.band, alpha: 1, duration: 700 });
        const later = (ms: number, run: () => void) => this.time.delayedCall(ms, () => this.phase === 'fall' && run());
        later(500, () => {
            this.windTarget = WIND.fall;
            this.streaks.start();
        });
        this.jumpers.forEach((j, i) => {
            later(j.spot.jumpAt, () => this.leap(j));
            later(CHUTE_OPEN_MS + i * 220, () => this.openChute(j));
        });
        later(SPOTS[SPOTS.length - 1].jumpAt + 500, () =>
            this.tweens.add({ targets: this.flight, x: GAME_WIDTH + art.PLANE.w * 1.5, y: -20, duration: 2200, ease: 'Sine.easeIn', onComplete: () => this.plane.setVisible(false) })
        );
        later(CHUTE_OPEN_MS, () => {
            this.windTarget = WIND.chute;
            this.streaks.stop();
        });
    }

    private leap(j: Jumper): void {
        this.heads.get(j.spot.id)?.img.setVisible(false);
        const door = { x: this.plane.x + (art.PLANE.door.x - art.PLANE.w / 2) * art.SKY_SCALE, y: this.plane.y + (art.PLANE.door.y - art.PLANE.h / 2) * art.SKY_SCALE };
        j.mode = 'fall';
        j.at = { x: door.x, y: door.y - DIVER_DY, sway: 0, tilt: -1.5 };
        j.rig.setPosition(j.at.x, j.at.y).setVisible(true);
        j.chute.setVisible(false);
        j.body.setVisible(false);
        j.diver.setVisible(true).setScale(0.5);
        this.tweens.add({ targets: j.diver, scale: 1, duration: 500, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: j.at, x: j.spot.x, tilt: 0, duration: 900, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: j.at, y: j.spot.fallY - DIVER_DY, duration: 900, ease: 'Back.easeOut' });
        audio.sfx('miss'); // a falling whistle
        j.bubble = this.shout(LABELS.shouts[j.spot.id]);
        this.time.delayedCall(1300, () => this.dropBubble(j));
    }

    /** A little speech bubble with a shout, its tail at (0, 0); update() keeps it over its jumper. */
    private shout(text: string): Phaser.GameObjects.Container {
        const label = this.add.text(0, -18, text, pixelStyle(16, '#1c2236')).setOrigin(0.5);
        const w = Math.ceil(label.width / 2) * 2 + 14;
        const back = this.add.graphics().fillStyle(0x1c2236).fillRect(-w / 2, -30, w, 24).fillTriangle(-6, -7, 6, -7, 0, 2);
        back.fillStyle(0xffffff).fillRect(-w / 2 + 2, -28, w - 4, 20).fillTriangle(-3, -9, 3, -9, 0, -3);
        const bubble = this.add.container(-100, -100, [back, label]).setDepth(DEPTH.speech).setScale(0.3);
        this.tweens.add({ targets: bubble, scale: 1, duration: 220, ease: 'Back.easeOut' });
        return bubble;
    }

    private dropBubble(j: Jumper): void {
        j.bubble?.destroy();
        j.bubble = null;
    }

    private openChute(j: Jumper): void {
        this.dropBubble(j);
        j.mode = 'chute';
        j.diver.setVisible(false);
        j.body.setVisible(true);
        j.chute.setVisible(true).setScale(0.15, 0.35);
        this.tweens.add({ targets: j.chute, scaleX: 1, scaleY: 1, duration: 420, ease: 'Back.easeOut' });
        this.tweens.add({ targets: j.at, x: j.spot.x, y: j.spot.hangY, duration: 1200, ease: 'Back.easeOut' });
        this.tweens.add({ targets: j.at, sway: 1, duration: 2000 });
        this.puff(j.spot.x, j.at.y + 40, 0xffffff);
        audio.sfx('step'); // the pop of the canopy
        audio.tone(190, 60);
    }

    private puff(x: number, y: number, tint: number): void {
        const burst = this.add.particles(x, y, 'ending-dot', { speed: { min: 50, max: 140 }, lifespan: 450, scale: { start: 2, end: 0.5 }, alpha: { start: 1, end: 0 }, tint, emitting: false });
        burst.setDepth(DEPTH.speech).explode(18);
        this.time.delayedCall(600, () => burst.destroy());
    }

    private moveJumpers(t: number): void {
        this.jumpers.forEach((j, i) => {
            const ph = i * 2.1;
            if (j.mode === 'fall') {
                j.rig.setPosition(Math.round(j.at.x + Math.sin(t / 170 + ph) * 4), Math.round(j.at.y + Math.sin(t / 95 + ph) * 3));
                j.diver.setRotation(j.at.tilt + Math.sin(t / 150 + ph) * 0.16);
            } else if (j.mode === 'chute') {
                const swing = Math.sin(t / 950 + ph);
                j.rig.setPosition(Math.round(j.at.x + swing * 12 * j.at.sway), Math.round(j.at.y + Math.sin(t / 640 + ph) * 4 * j.at.sway)).setRotation(-swing * 0.07 * j.at.sway);
            }
            j.bubble?.setPosition(Math.round(j.rig.x), Math.round(j.rig.y + DIVER_DY - 42));
        });
    }

    // ---- landing ----

    /** The credits are gone: the fields rise from below and the three come down on the grass. */
    private startLanding(): void {
        this.phase = 'land';
        this.windTarget = WIND.ground;
        this.tweens.add({ targets: this.ground, y: GROUND_Y, duration: 3400, ease: 'Sine.easeOut' });
        this.jumpers.forEach((j, i) => {
            this.tweens.add({ targets: j.at, x: j.spot.x, y: j.landY, sway: 0, duration: 3500 + i * 350, ease: 'Sine.easeInOut', onComplete: () => this.touchdown(j) });
        });
    }

    /** Feet on the grass: the canopy folds down behind its owner. The finale follows the last one. */
    private touchdown(j: Jumper): void {
        j.mode = 'down';
        j.rig.setPosition(j.at.x, j.at.y).setRotation(0);
        this.tweens.add({ targets: j.chute, y: 52, scaleX: 0.8, scaleY: 0.2, alpha: 0, duration: 500, ease: 'Sine.easeIn' });
        j.heap.setVisible(true).setAlpha(0).setScale(art.SKY_SCALE, art.SKY_SCALE * 2);
        this.tweens.add({ targets: j.heap, alpha: 1, scaleY: art.SKY_SCALE, duration: 400, delay: 250 });
        this.puff(j.spot.x, FEET_Y, 0xe8dcb0);
        audio.sfx('step');
        if (++this.landed === this.jumpers.length) this.time.delayedCall(900, () => this.phase === 'land' && this.startFinale());
    }

    /** Everything in its place on the ground, whatever was still moving (a test skip lands here from the free fall). */
    private settle(): void {
        this.tweens.killAll();
        this.time.removeAllEvents();
        this.streaks.stop();
        this.streaks.killAll();
        this.windTarget = WIND.ground;
        this.plane.setVisible(false);
        this.band.setAlpha(1);
        this.ground.setY(GROUND_Y);
        for (const j of this.jumpers) {
            this.dropBubble(j);
            j.mode = 'down';
            j.rig.setPosition(j.spot.x, j.landY).setRotation(0).setVisible(true);
            j.diver.setVisible(false);
            j.chute.setVisible(false);
            j.body.setVisible(true);
            j.heap.setVisible(true).setAlpha(1).setScale(art.SKY_SCALE);
        }
    }

    // ---- credits ----

    private buildCredits(): void {
        this.band = this.add.image(BAND_X - 24, 0, bandTexture(this)).setOrigin(0).setDepth(DEPTH.band).setAlpha(0); // it comes with the jump
        const { title, lines: all } = DIALOGUE.credits;
        const entries = all.filter((l) => !/compleanno/i.test(l) || l.includes(' ... '));
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

    private rollCredits(delta: number): void {
        this.roll = Math.min(SCROLL_MS, this.roll + delta * (this.hurryKeys.some((k) => k.isDown) ? HURRY : 1));
        const scroll = (this.maxScroll * this.roll) / SCROLL_MS;
        for (const line of this.credits) {
            const y = Math.round(line.y - scroll);
            line.obj.setY(y);
            const mid = y + line.obj.height / 2;
            line.obj.setAlpha(Phaser.Math.Clamp(mid / 40, 0, 1) * Phaser.Math.Clamp((GAME_HEIGHT - mid) / 24, 0, 1));
        }
        if (this.roll >= SCROLL_MS) this.startLanding();
    }

    // ---- loop ----

    update(_time: number, rawDelta: number): void {
        const delta = Math.min(rawDelta, 100);
        this.clock += delta;
        const t = this.clock;

        if (this.phase === 'plane' && this.beatIx < 0 && t >= LEAD_IN_MS) {
            this.beatIx = 0;
            this.banner.show(this.activeBeat);
        }

        this.moveClouds(delta);
        this.plane.setPosition(Math.round(this.flight.x), Math.round(this.flight.y + Math.sin(t / 420) * 5));
        this.prop.setTexture(this.propFrames[Math.floor(t / 45) % this.propFrames.length]);
        // whoever speaks hops in the window
        for (const [id, head] of this.heads) head.img.y = head.base - (id === this.activeBeat?.speaker ? Math.floor(t / 130) % 2 : 0);
        this.drone(delta);
        this.moveJumpers(t);

        if (this.phase === 'fall') this.rollCredits(delta);
    }

    // ---- finale ----

    private startFinale(): void {
        this.phase = 'finale';
        this.beatIx = this.beats.length;
        this.settle();
        this.banner.show(null);
        audio.playTrack('credits', BIRTHDAY_STEP); // the player sets the pace, so the music jumps to meet the title
        finaleFx(this);
        this.tweens.add({ targets: this.band, alpha: 0.45, duration: 700 });
        for (const line of this.credits) line.obj.destroy();
        this.credits = [];
        this.tweens.add({ targets: this.dim, alpha: 0.35, duration: 1000 }); // lighter than at night: the towers stay readable

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
        });
        this.scene.launch('menu', { from: 'skydive' });
        this.scene.bringToTop('menu'); // the menu is registered before this scene, so it would be drawn under the sky
        this.scene.pause();
    }

    private onKey(e: KeyboardEvent): void {
        if (e.repeat || this.leaving || performance.now() - this.menuClosedAt < 250) return;
        if (e.code === 'Escape' || e.code === 'KeyC') return this.openMenu();
        if (!CONFIRM_CODES.includes(e.code)) return;
        if (this.phase === 'plane') {
            if (!this.activeBeat) return;
            audio.sfx('confirm');
            this.beatIx++;
            if (!this.activeBeat) return this.jump(); // that was the last line
            return this.banner.show(this.activeBeat);
        }
        if (!this.canRestart) return;
        this.leaving = true;
        audio.sfx('confirm');
        audio.stopTrack();
        audio.stopAmbience();
        resetRun(this.game);
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('title'));
    }

    /** Test builds only (the 'test-skip' event): from the plane to the jump, from the fall to the finale, then the prompt at once. */
    private onSkip(): void {
        if (this.phase === 'plane') this.jump();
        else if (this.phase !== 'finale') this.startFinale();
        else if (!this.canRestart) this.showEnd?.();
    }
}

export default SkydiveScene;
