import { assetUrl } from 'asset-url';
import Phaser from 'phaser';
import { audio } from '../audio';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { MINIGAMES } from '../minigames/registry';
import { pixelStyle, t } from '../ui/text';
import { PEOPLE, SCENES } from './data';
import { TILE, TILESET_KEY, crowdSheets } from './tileMap';

const BAR_W = 240;
const BAR_H = 12;

/** Loads every image, then registers the minigame scenes and opens the title. */
export class BootScene extends Phaser.Scene {
    constructor() {
        super('boot');
    }

    preload(): void {
        const cx = GAME_WIDTH / 2;
        const cy = GAME_HEIGHT / 2;
        this.add.text(cx, cy - 28, t('ui.loading'), pixelStyle()).setOrigin(0.5);
        this.add.rectangle(cx, cy, BAR_W + 4, BAR_H + 4).setStrokeStyle(2, 0xffffff);
        const bar = this.add.rectangle(cx - BAR_W / 2, cy, 0, BAR_H, 0x6f8be6).setOrigin(0, 0.5);
        this.load.on('progress', (p: number) => (bar.width = BAR_W * p));
        this.load.on('loaderror', (file: Phaser.Loader.File) => console.error(`load failed: ${file.key}`));

        // every scene: the minigames draw their scene's room as a background, a native-scale 640x360 render of its tile map (scripts/art/room_backgrounds.py, about 650 KB in all)
        for (const s of SCENES) this.load.image(s.background, assetUrl(`backgrounds/${s.background.replace(/^bg-/, '')}.png`));
        this.load.spritesheet(TILESET_KEY, assetUrl('tiles/tileset.png'), { frameWidth: TILE, frameHeight: TILE });
        for (const sheet of crowdSheets()) this.load.spritesheet(`char-${sheet}`, assetUrl(`tiles/${sheet}.png`), { frameWidth: 32, frameHeight: 32 });
        for (const p of PEOPLE) {
            this.load.spritesheet(`char-${p.id}`, assetUrl(`characters/${p.id}.png`), { frameWidth: 32, frameHeight: 32 });
            if (p.portrait) this.load.image(p.portrait, assetUrl(`portraits/${p.id}.png`));
        }
    }

    create(): void {
        audio.init(this.game);
        for (const [id, cls] of Object.entries(MINIGAMES)) {
            const key = `minigame-${id}`;
            if (!this.scene.get(key)) this.scene.add(key, cls);
        }
        this.scene.start('title');
    }
}
