import Phaser from 'phaser';
import { audio } from '../audio';
import { getRun } from '../flow/RunState';
import { MAPS, TileWorld } from '../flow/tileMap';
import { fadeToScene } from '../transitions';
import { CONFIRM_CODES } from '../ui/DialogBox';
import { pixelStyle } from '../ui/text';
import { balloonTexture, blanketTexture, glowTexture, particleTextures, pillowTexture, scanTexture } from './art';
import { SpeechBanner } from './banner';
import { startTvFx } from './fx';
import { LABELS } from './labels';
import { BALLOONS, DEPTH, SCREEN, SPEECH, SPOTS, UPSTAIRS, type Spot } from './layout';
import { awayOf, type Beat, buildBeats, LEAD_IN_MS } from './script';
import { FishTv } from './tv';

const LINGER_MS = 1500; // how long the hearts run after the last line, before the sky

/** Frames of a character sheet (3 columns, rows down, left, right, up): the standing frame of each facing. */
const FACE = { down: 1, left: 4, right: 7, up: 10 } as const;

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

/**
 * The `ending` scene: Casa Circe late at night, the real tile room of the divano scene (src/data/maps/divano.json) as the backdrop.
 * The TV plays a fish documentary, and the whole party is asleep or half asleep on the sofa (seen from behind, facing the TV), the
 * chairs of the dinner table and the floor. The night scene of the divano room is spoken in a banner along the bottom of the room
 * (script.ts), one line per press of X like any dialogue; once the last line is read and the hearts have run a moment, the game goes on
 * to the `skydive` scene. Esc or C opens the menu over the paused room.
 */
export class EndingScene extends Phaser.Scene {
    private tv!: FishTv;
    private clock = 0;
    private tvAcc = 0;
    private flickerAcc = 0;
    private flicker = 1;
    private beats: Beat[] = [];
    /** The line on screen (`activeBeat`); -1 before the first one, `beats.length` once all are read. */
    private beatIx = -1;
    private laughs: Phaser.GameObjects.Text[] = [];
    private left = false; // the ones who go upstairs have left the room
    private upstairsBusy = false; // they have reached the top of the stairs: the bed creaks
    private creakAcc = 0;
    private away: string[] = [];
    private talkers = new Map<string, { img: Phaser.GameObjects.Sprite; base: number }>();
    private banner!: SpeechBanner;
    private hearts!: Phaser.GameObjects.Particles.ParticleEmitter;
    private puffs!: Phaser.GameObjects.Particles.ParticleEmitter;
    private menuClosedAt = 0;
    private breathers: Breather[] = [];
    private zzz: Zzz[] = [];
    private balloons: { img: Phaser.GameObjects.Image; base: number; phase: number }[] = [];
    private glow!: Phaser.GameObjects.Image;
    private linger = 0; // time the hearts have run since the last line was read
    private leaving = false;

    constructor() {
        super('ending');
    }

    private get activeBeat(): Beat | null {
        return this.beats[this.beatIx] ?? null;
    }

    create(): void {
        this.clock = 0;
        this.tvAcc = 0;
        this.flickerAcc = 0;
        this.flicker = 1;
        this.beatIx = -1;
        this.laughs = [];
        this.creakAcc = 0;
        this.menuClosedAt = 0;
        this.talkers = new Map();
        this.breathers = [];
        this.zzz = [];
        this.balloons = [];
        this.left = false;
        this.upstairsBusy = false;
        this.linger = 0;
        this.leaving = false;

        const run = getRun(this.game);
        this.away = awayOf(run.flags);
        this.beats = buildBeats(run);

        this.cameras.main.fadeIn(700, 0, 0, 0);
        audio.playTrack('circe');
        audio.playAmbience('circe'); // indoors: the house's clock bed takes over from the Cortile's street
        particleTextures(this);

        this.buildRoom();
        this.buildParty();
        this.buildLight();
        this.buildUpstairs();
        this.banner = new SpeechBanner(this, SPEECH, DEPTH.speech);
        startTvFx(this);

        this.input.keyboard!.on('keydown', this.onKey, this);
        this.game.events.on('test-skip', this.handOver, this); // emitted by test builds only
        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keydown', this.onKey, this);
            this.game.events.off('test-skip', this.handOver, this);
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
        // everyone is in the room for the whole night; the ones who go upstairs (Liscio and Lara, or Ric) leave when the gag starts (leave())

        // the sofa, seen from behind, facing the TV: Liscio, Ric and Lara
        this.person('liscio', SPOTS.sofaLeft, FACE.up);
        this.person('ric', SPOTS.sofaMid, FACE.up);
        this.person('lara', SPOTS.sofaRight, FACE.up);

        // the chairs of the dinner table: Giusy asleep on the left one (it faces east), Ros on the right one (it faces west)
        const { chairLeft, chairRight } = SPOTS;
        this.person('giusy', chairLeft, FACE.right);
        this.sleepy(chairLeft.x + 8, chairLeft.y - 38);
        this.person('ros', chairRight);

        // the floor: Lollino leans against the pink pouf (it hides all but his head and shoulders), Giuggiu sleeps on her back under a blanket
        const pouf = this.person('lollino', SPOTS.pouf, FACE.up);
        this.sleepy(pouf.x + 6, pouf.y - 36);

        const g = SPOTS.floor;
        this.add.image(g.x - 17, g.y, pillowTexture(this)).setDepth(g.depth - 1);
        this.lying('giuggiu', g, -Math.PI / 2);
        this.add.image(g.x + 7, g.y + 2, blanketTexture(this)).setDepth(g.depth + 1);
        this.sleepy(g.x - 6, g.y - 14);
    }

    // ---- light ----

    private buildLight(): void {
        // the TV throws a soft flickering light on the room, over the night overlay of the map (which already holds its steady pools)
        this.glow = this.add.image(SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h / 2, glowTexture(this)).setDepth(DEPTH.tvGlow).setBlendMode(Phaser.BlendModes.ADD);
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
            who.img.setRotation(0).setFrame(FACE.up);
            this.tweens.add({ targets: who.img, x: UPSTAIRS.x, y: UPSTAIRS.y + 26, alpha: 0, duration: 1800, ease: 'Sine.easeIn' });
        }
        this.time.delayedCall(1800, () => {
            this.upstairsBusy = true; // real time, like the walk
            this.hearts.start();
            this.puffs.start();
        });
    }

    // ---- speech: the night scene of the divano room, one line at a time ----

    /** Puts line `beatIx` on screen (nothing once all are read); the first line of the gag sends its people upstairs. */
    private speak(): void {
        this.banner.show(this.activeBeat);
        this.laugh(!!this.activeBeat?.laugh);
        if (this.activeBeat?.upstairs && !this.left) {
            this.left = true;
            this.leave();
        }
    }

    /** Everyone bursts out laughing: an "AH!" pops over every head (their hops are in update()). */
    private laugh(on: boolean): void {
        for (const text of this.laughs) {
            this.tweens.killTweensOf(text);
            text.destroy();
        }
        this.laughs = [];
        if (!on) return;
        this.laughs = [...this.talkers.values()].map(({ img }, i) => {
            const lying = img.rotation !== 0;
            const y = img.y - (lying ? 22 : 40) - (i % 2) * 9; // every other one higher, so neighbours on the sofa do not overlap
            const x = img.x - (lying ? 34 : 0); // over the sleeper's head, clear of the sofa
            const text = this.add.text(x, y, LABELS.laugh, { ...pixelStyle(16, '#ffe27a'), stroke: '#05071a', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(DEPTH.speech);
            this.tweens.add({ targets: text, y: y - 5, duration: 160, delay: (i * 70) % 300, yoyo: true, repeat: -1 });
            return text;
        });
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
        for (const z of this.zzz) {
            if (!this.left) break; // they talk through the night and only doze off once the gag starts
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
            // and the whole room shakes with laughter, out of step
            if (this.activeBeat.laugh) {
                let i = 0;
                for (const l of this.talkers.values()) l.img.y = l.base - ((Math.floor(t / 110) + i++) % 2) * 3;
            }
        }

        // the first line comes after a quiet moment
        if (this.beatIx < 0 && t >= LEAD_IN_MS) {
            this.beatIx = 0;
            this.speak();
        }
        this.creak(delta);
        // all read: the hearts get their moment (counted only once they run, after the walk upstairs), then the sky
        if (this.upstairsBusy && this.beatIx >= this.beats.length) {
            this.linger += delta;
            if (this.linger >= LINGER_MS) this.handOver();
        }
    }

    // ---- on to the sky ----

    /** Fades to the `skydive` scene, once; keys do nothing from here on. Test builds also call it on the 'test-skip' event. */
    private handOver(): void {
        if (this.leaving) return;
        this.leaving = true;
        fadeToScene(this, 'skydive');
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
        this.scene.launch('menu', { from: 'ending' });
        this.scene.bringToTop('menu'); // the menu is registered before this scene, so it would be drawn under the room
        this.scene.pause();
    }

    private onKey(e: KeyboardEvent): void {
        if (e.repeat || this.leaving || performance.now() - this.menuClosedAt < 250) return;
        if (e.code === 'Escape' || e.code === 'KeyC') return this.openMenu();
        if (!CONFIRM_CODES.includes(e.code) || !this.activeBeat) return;
        audio.sfx('confirm');
        this.beatIx++;
        this.speak();
    }
}

export default EndingScene;
