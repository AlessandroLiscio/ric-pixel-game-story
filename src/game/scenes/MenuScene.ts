import Phaser from 'phaser';
import { audio } from '../audio';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { SCENES } from '../flow/data';
import { ACTIVE_MINIGAME_KEY, getRun, resetRun } from '../flow/RunState';
import { isSceneDone } from '../flow/story';
import { DIALOGUE, pixelStyle, t } from '../ui/text';
import { panelTexture } from '../ui/panel';

type Mode = 'main' | 'diary' | 'controls' | 'confirm';

const CONFIRM_CODES = ['KeyX', 'Enter', 'Space'];
const BACK_CODES = ['Escape', 'KeyZ', 'KeyC'];
const GOLD = '#ffe27a';
const SHADOW = { offsetX: 1, offsetY: 1, color: '#0a1040', blur: 0, stroke: false, fill: true };

/**
 * The Esc menu, a RPG Maker style window over the paused world scene: Diario, Comandi, Esci al menu principale, Indietro.
 * Arrows and X choose, Esc or Z go back (and close the menu from the main window). The world scene starts it with
 * `scene.launch('menu')` and pauses itself; closing resumes the world.
 */
export class MenuScene extends Phaser.Scene {
    private mode: Mode = 'main';
    private sel = 0;
    private page = 0;
    private ui?: Phaser.GameObjects.Container;
    private leaving = false;
    private openedAt = 0;

    constructor() {
        super('menu');
    }

    create(): void {
        this.mode = 'main';
        this.sel = 0;
        this.leaving = false;
        this.openedAt = performance.now();
        this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.4).setOrigin(0).setDepth(0);
        const kb = this.input.keyboard!;
        kb.on('keydown', this.onKey, this);
        this.events.once('shutdown', () => kb.off('keydown', this.onKey, this));
        this.render();
    }

    private get items(): { label: string; run: () => void }[] {
        return [
            { label: t('menu.diary'), run: () => this.go('diary') },
            { label: t('menu.controls'), run: () => this.go('controls') },
            { label: t('menu.quit'), run: () => this.go('confirm') },
            { label: t('menu.back'), run: () => this.close() }
        ];
    }

    /** The scenes Ric reached so far, each with whether its friend already joined. */
    private get entries(): { id: string; title: string; done: boolean }[] {
        const run = getRun(this.game);
        return SCENES.slice(0, run.sceneIndex + 1).map((s, i) => ({ id: s.id, title: s.title, done: i < run.sceneIndex || isSceneDone(s, run) }));
    }

    // ---- keys ----

    private onKey(e: KeyboardEvent): void {
        if (this.leaving || performance.now() - this.openedAt < 150) return; // the Esc that opened the menu may still reach this scene
        const left = ['ArrowLeft', 'KeyA'].includes(e.code);
        const right = ['ArrowRight', 'KeyD'].includes(e.code);
        const up = ['ArrowUp', 'KeyW'].includes(e.code);
        const down = ['ArrowDown', 'KeyS'].includes(e.code);
        if (e.repeat && !(up || down || left || right)) return;

        if (BACK_CODES.includes(e.code)) return this.back();
        if (this.mode === 'main' && (up || down)) this.move(up ? -1 : 1, this.items.length);
        else if (this.mode === 'main' && CONFIRM_CODES.includes(e.code)) {
            audio.sfx('confirm');
            this.items[this.sel].run();
        } else if (this.mode === 'diary' && (left || right)) {
            const next = Phaser.Math.Clamp(this.page + (right ? 1 : -1), 0, this.entries.length - 1);
            if (next !== this.page) {
                this.page = next;
                audio.sfx('blip');
                this.render();
            }
        } else if (this.mode === 'diary' && CONFIRM_CODES.includes(e.code)) this.back();
        else if (this.mode === 'controls' && CONFIRM_CODES.includes(e.code)) this.back();
        else if (this.mode === 'confirm' && (left || right || up || down)) this.move(left || up ? -1 : 1, 2);
        else if (this.mode === 'confirm' && CONFIRM_CODES.includes(e.code)) {
            if (this.sel === 0) return this.quit();
            this.back();
        }
    }

    private move(step: number, count: number): void {
        this.sel = (this.sel + step + count) % count;
        audio.sfx('blip');
        this.render();
    }

    private go(mode: Mode): void {
        this.mode = mode;
        this.page = this.entries.length - 1; // the diary opens on the newest page
        this.sel = mode === 'confirm' ? 1 : 0; // "No" is the default
        this.render();
    }

    private back(): void {
        audio.sfx('cancel');
        if (this.mode === 'main') return this.close();
        const from = this.mode;
        this.mode = 'main';
        this.sel = from === 'diary' ? 0 : from === 'controls' ? 1 : 2;
        this.render();
    }

    private close(): void {
        this.leaving = true;
        this.scene.resume('world');
        this.scene.stop();
    }

    /** Back to the title screen with a fresh run, as a new game starts. */
    private quit(): void {
        this.leaving = true;
        audio.stopTrack();
        audio.stopAmbience();
        const veil = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setOrigin(0).setDepth(100);
        this.tweens.add({
            targets: veil,
            alpha: 1,
            duration: 350,
            onComplete: () => {
                resetRun(this.game);
                this.game.registry.set(ACTIVE_MINIGAME_KEY, undefined);
                this.scene.stop('world');
                this.scene.start('title');
            }
        });
    }

    // ---- drawing ----

    private render(): void {
        this.ui?.destroy();
        this.ui = this.add.container(0, 0).setDepth(10);
        if (this.mode === 'main') this.drawMain();
        else if (this.mode === 'diary') this.drawDiary();
        else if (this.mode === 'controls') this.drawControls();
        else this.drawConfirm();
    }

    /** A window of w x h in the middle of the screen (or at `y`); returns its top left corner. */
    private window(w: number, h: number, y = Math.round((GAME_HEIGHT - h) / 2)): { x: number; y: number } {
        const x = Math.round((GAME_WIDTH - w) / 2);
        this.ui!.add(this.add.image(x, y, panelTexture(this, `menu-panel-${w}x${h}`, w, h)).setOrigin(0));
        return { x, y };
    }

    private text(x: number, y: number, s: string, color = '#ffffff', size = 16): Phaser.GameObjects.Text {
        const label = this.add.text(x, y, s, { ...pixelStyle(size, color), shadow: SHADOW, lineSpacing: 6 });
        this.ui!.add(label);
        return label;
    }

    private cursor(x: number, y: number): void {
        this.ui!.add(this.add.graphics().fillStyle(0xffe27a).fillTriangle(x, y, x, y + 10, x + 7, y + 5));
    }

    private drawMain(): void {
        const items = this.items;
        const { x, y } = this.window(300, 52 + items.length * 28);
        this.text(x + 16, y + 10, t('menu.title'), GOLD);
        items.forEach((item, i) => {
            const row = y + 40 + i * 28;
            this.text(x + 36, row, item.label, i === this.sel ? GOLD : '#ffffff');
            if (i === this.sel) this.cursor(x + 18, row + 4);
        });
    }

    private drawDiary(): void {
        const entries = this.entries;
        const e = entries[this.page];
        const { x, y } = this.window(584, 232);
        this.text(x + 16, y + 10, t('menu.diaryTitle'), GOLD);
        this.text(x + 584 - 16, y + 10, `${this.page + 1}/${entries.length}`, '#cfe0ff').setOrigin(1, 0);
        this.text(x + 16, y + 48, e.title, '#ffffff');
        // a check box, ticked when the friend of the scene already joined
        const boxX = x + 584 - 16 - 88;
        const g = this.add.graphics().lineStyle(2, 0xeef2ff).strokeRect(boxX, y + 51, 12, 12);
        if (e.done) g.lineStyle(3, 0x7dff5a).beginPath().moveTo(boxX + 2, y + 57).lineTo(boxX + 5, y + 61).lineTo(boxX + 12, y + 47).strokePath();
        this.ui!.add(g);
        this.text(boxX + 20, y + 48, t(e.done ? 'menu.done' : 'menu.todo'), e.done ? '#9bff7a' : '#cfe0ff');
        this.text(x + 16, y + 84, DIALOGUE.diary[e.id] ?? '');
        this.text(x + 16, y + 232 - 28, t(entries.length > 1 ? 'menu.pageHint' : 'menu.backHint'), '#9ec8ff');
    }

    private drawControls(): void {
        const rows = [...DIALOGUE.controls.rows, ...(getRun(this.game).portalGun ? [DIALOGUE.controls.portal] : [])];
        const h = 90 + rows.length * 22;
        const { x, y } = this.window(440, h);
        this.text(x + 16, y + 10, t('menu.controlsTitle'), GOLD);
        rows.forEach((r, i) => this.text(x + 24, y + 44 + i * 22, r));
        this.text(x + 16, y + h - 28, t('menu.backHint'), '#9ec8ff');
    }

    private drawConfirm(): void {
        const { x, y } = this.window(300, 116);
        this.text(x + 16, y + 12, t('menu.sure'), GOLD);
        this.text(x + 16, y + 40, t('menu.sureNote'), '#cfe0ff');
        [t('menu.yes'), t('menu.no')].forEach((label, i) => {
            const cx = x + 56 + i * 110;
            this.text(cx, y + 76, label, i === this.sel ? GOLD : '#ffffff');
            if (i === this.sel) this.cursor(cx - 18, y + 80);
        });
    }
}
