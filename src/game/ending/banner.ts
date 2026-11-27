import Phaser from 'phaser';
import { person } from '../flow/data';
import { pressArrow } from '../ui/DialogBox';
import { panelTexture } from '../ui/panel';
import { pixelStyle } from '../ui/text';

const SHADOW = { offsetX: 1, offsetY: 1, color: '#0a1040', blur: 0, stroke: false, fill: true };

/** Where the banner stands: its left edge, width and lower edge in screen pixels, and the size of the speaker's portrait. */
export interface BannerLayout {
    x: number;
    w: number;
    bottom: number;
    portrait: number;
}

/**
 * The speech banner of the ending and the skydive: a VX Ace window along the bottom of the screen with the speaker's portrait and gold name,
 * or the narrator's plain text in pale blue, and the blinking "press X" arrow. It grows upward with the number of rows.
 */
export class SpeechBanner {
    private readonly root: Phaser.GameObjects.Container;
    private readonly panel: Phaser.GameObjects.Image;
    private readonly face: Phaser.GameObjects.Image;
    private readonly nameText: Phaser.GameObjects.Text;
    private readonly body: Phaser.GameObjects.Text;

    constructor(private readonly scene: Phaser.Scene, private readonly layout: BannerLayout, depth: number) {
        const style = { ...pixelStyle(16), shadow: SHADOW, lineSpacing: 2 };
        this.panel = scene.add.image(0, 0, '__DEFAULT').setOrigin(0);
        this.face = scene.add.image(0, 0, '__DEFAULT').setOrigin(0).setScale(layout.portrait / 96);
        this.nameText = scene.add.text(0, 0, '', { ...style, color: '#ffe27a' });
        this.body = scene.add.text(0, 0, '', style);
        const arrow = pressArrow(scene, layout.x + layout.w / 2, layout.bottom - 7, 5);
        this.root = scene.add.container(0, 0, [this.panel, this.face, this.nameText, this.body, arrow]).setDepth(depth).setAlpha(0);
    }

    /** Shows the line `b` (or hides the banner for null): `speaker` is a person id or `narratore`, whose `name` is empty. */
    show(b: { speaker: string; name: string; text: string } | null): void {
        this.scene.tweens.killTweensOf(this.root);
        if (!b) {
            this.scene.tweens.add({ targets: this.root, alpha: 0, duration: 120 });
            return;
        }
        const { x, w, bottom, portrait } = this.layout;
        const face = person(b.speaker)?.portrait;
        const hasFace = !!face && this.scene.textures.exists(face);
        const textX = x + (hasFace ? portrait + 14 : 10);
        const bodyY = b.name ? 24 : 8;
        this.body.setWordWrapWidth(x + w - 8 - textX).setText(b.text).setColor(b.name ? '#ffffff' : '#d6e4ff');
        const h = Math.max(hasFace ? portrait + 12 : 0, bodyY + Math.ceil(this.body.height) + 8);
        const top = bottom - h;
        this.panel.setTexture(panelTexture(this.scene, `ending-panel-${w}x${h}`, w, h)).setPosition(x, top);
        this.face.setVisible(hasFace).setPosition(x + 6, top + 6);
        if (hasFace) this.face.setTexture(face);
        this.nameText.setText(b.name).setPosition(textX, top + 6);
        this.body.setPosition(textX, top + bodyY);
        this.root.setAlpha(0);
        this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 120 });
    }
}
