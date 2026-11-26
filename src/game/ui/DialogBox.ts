import Phaser from 'phaser';
import { audio } from '../audio';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { person } from '../flow/data';
import type { Line } from '../flow/sceneTypes';
import { panelTexture } from './panel';
import { pixelStyle } from './text';

const PANEL_H = 100;
const PANEL_Y = GAME_HEIGHT - PANEL_H;
const PORTRAIT = 96;
const TEXT_X_PORTRAIT = 6 + PORTRAIT + 8;
const TEXT_X_FULL = 16;
// Where a page wraps: the whole width left of the right edge (with a portrait the box is narrower). scripts/check-dialogue.mjs measures against the same numbers.
export const WRAP_W = { portrait: GAME_WIDTH - TEXT_X_PORTRAIT - 14, full: GAME_WIDTH - TEXT_X_FULL - 16 };
const TICK_MS = 28;
const BLIP_EVERY = 3; // letters per blip
const CONFIRM_CODES = ['KeyX', 'Enter', 'Space'];

/**
 * RPG Maker VX Ace style dialogue window at the bottom of the screen.
 * show(lines) types each Line on its own page; X / Enter / Space completes the page, then moves on;
 * hold Z to type faster. A line from "narratore" (or with no portrait) uses the full width.
 */
export class DialogBox {
    /** scene.time.now when the last show() ended; callers use it to ignore the key press that closed the box. */
    lastClosed = 0;

    private readonly root: Phaser.GameObjects.Container;
    private readonly portrait: Phaser.GameObjects.Image;
    private readonly nameText: Phaser.GameObjects.Text;
    private readonly body: Phaser.GameObjects.Text;
    private readonly arrow: Phaser.GameObjects.Graphics;
    private readonly zKey: Phaser.Input.Keyboard.Key;
    private onConfirm?: () => void;
    private onSkip?: () => void;
    private open = false;

    constructor(private readonly scene: Phaser.Scene) {
        const shadow = { offsetX: 1, offsetY: 1, color: '#0a1040', blur: 0, stroke: false, fill: true };
        const panel = scene.add.image(0, PANEL_Y, panelTexture(scene, 'dialog-panel', GAME_WIDTH, PANEL_H)).setOrigin(0);
        this.portrait = scene.add.image(6, PANEL_Y + 2, '__DEFAULT').setOrigin(0);
        this.nameText = scene.add.text(TEXT_X_PORTRAIT, PANEL_Y + 8, '', { ...pixelStyle(16, '#ffe27a'), shadow });
        this.body = scene.add.text(TEXT_X_PORTRAIT, PANEL_Y + 26, '', { ...pixelStyle(), shadow, lineSpacing: 2 });
        this.arrow = scene.add.graphics().fillStyle(0xffffff).fillTriangle(-5, 0, 5, 0, 0, 6).setPosition(GAME_WIDTH / 2, GAME_HEIGHT - 12);
        scene.tweens.add({ targets: this.arrow, alpha: 0.15, duration: 380, yoyo: true, repeat: -1 });
        this.root = scene.add.container(0, 0, [panel, this.portrait, this.nameText, this.body, this.arrow]).setDepth(1000).setScrollFactor(0).setVisible(false);

        this.zKey = scene.input.keyboard!.addKey('Z');
        scene.input.keyboard!.on('keydown', this.handleKey, this);
        scene.game.events.on('test-skip', this.handleSkip, this);
        scene.events.once('shutdown', () => this.destroy());
    }

    /** Puts the whole window at the top of the screen instead of the bottom (for scenes where the speakers stand low in the view). */
    setAtTop(top: boolean): void {
        this.root.setY(top ? -PANEL_Y : 0);
    }

    get isOpen(): boolean {
        return this.open;
    }

    /** Shows the lines one page at a time; resolves after the last page is confirmed. */
    async show(lines: Line[]): Promise<void> {
        if (!lines.length) return;
        this.open = true;
        this.root.setVisible(true);
        for (const line of lines) await this.page(line);
        this.root.setVisible(false);
        this.open = false;
        this.lastClosed = this.scene.time.now;
    }

    destroy(): void {
        this.scene.input.keyboard?.off('keydown', this.handleKey, this);
        this.scene.game.events.off('test-skip', this.handleSkip, this);
    }

    private async page(line: Line): Promise<void> {
        const who = line.speaker === 'narratore' ? undefined : person(line.speaker);
        const hasPortrait = !!who?.portrait && this.scene.textures.exists(who.portrait);
        const x = hasPortrait ? TEXT_X_PORTRAIT : TEXT_X_FULL;
        this.portrait.setVisible(hasPortrait);
        if (hasPortrait) this.portrait.setTexture(who!.portrait!);
        this.nameText.setText(who?.name ?? '').setX(x);
        this.body.setWordWrapWidth(hasPortrait ? WRAP_W.portrait : WRAP_W.full).setText('').setPosition(x, who ? PANEL_Y + 26 : PANEL_Y + 14);
        this.arrow.setVisible(false);
        if (line.pause) await this.wait(line.pause);

        await new Promise<void>((resolve) => {
            let shown = 0;
            let letters = 0;
            // the text reflows to the box: an old hard break counts as a space, and the wrap is worked out once for the whole page so a word never jumps while it types
            const raw = line.text.replace(/\{ric\}/g, person('ric')?.name ?? 'Ric').replace(/\s*\n\s*/g, ' ');
            const full = this.body.getWrappedText(raw).join('\n');
            let done = false;
            const timer = this.scene.time.addEvent({
                delay: TICK_MS,
                loop: true,
                callback: () => {
                    const step = this.zKey.isDown ? 4 : 1;
                    for (let i = 0; i < step && shown < full.length; i++) {
                        if (full[shown++].trim() && ++letters % BLIP_EVERY === 0) audio.sfx('blip');
                    }
                    this.body.setText(full.slice(0, shown));
                    if (shown >= full.length) finishTyping();
                }
            });
            const finishTyping = () => {
                timer.remove();
                this.body.setText(full);
                this.arrow.setVisible(true);
                done = true;
            };
            this.onConfirm = () => {
                if (!done) return finishTyping();
                audio.sfx('confirm');
                this.onConfirm = this.onSkip = undefined;
                resolve();
            };
            this.onSkip = () => {
                timer.remove();
                this.onConfirm = this.onSkip = undefined;
                resolve();
            };
        });
    }

    private wait(ms: number): Promise<void> {
        return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
    }

    private handleKey(e: KeyboardEvent): void {
        if (!e.repeat && CONFIRM_CODES.includes(e.code)) this.onConfirm?.();
    }

    private handleSkip(): void {
        this.onSkip?.();
    }
}
