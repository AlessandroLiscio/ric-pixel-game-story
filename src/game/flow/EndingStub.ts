import Phaser from 'phaser';
import { audio } from '../audio';
import { GAME_WIDTH } from '../config';
import { pixelStyle, t } from '../ui/text';
import { getRun } from './RunState';

/** Stand-in for the `ending` scene until src/game/ending/index.ts exists: "Fine" and the whole party in a row. */
export class EndingStub extends Phaser.Scene {
    constructor() {
        super('ending');
    }

    create(): void {
        this.cameras.main.fadeIn(400);
        audio.playTrack('credits');
        this.add.text(GAME_WIDTH / 2, 90, t('ui.theEnd'), pixelStyle(32)).setOrigin(0.5);
        const crew = ['ric', ...getRun(this.game).party];
        crew.forEach((id, i) => this.add.image(GAME_WIDTH / 2 + (i - (crew.length - 1) / 2) * 44, 240, `char-${id}`, 1).setOrigin(0.5, 1).setScale(2));    }
}
