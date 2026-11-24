import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config';
import { InstructionCard } from '../../ui/InstructionCard';
import { pixelStyle, t } from '../../ui/text';
import { MINIGAME_DONE, type MinigameDone } from '../types';

/** Placeholder used while a minigame has no folder yet: X wins, Z loses. */
export function makeStubMinigame(id: string): typeof Phaser.Scene {
    return class StubMinigame extends Phaser.Scene {
        static KEY = `minigame-${id}`;
        static ID = id;

        constructor() {
            super(StubMinigame.KEY);
        }

        async create(): Promise<void> {
            this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x101a4a).setOrigin(0);
            await InstructionCard.show(this, id);
            this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `${t(`minigames.${id}.title`)}\n\nX: ${t('ui.win')}   Z: ${t('ui.lose')}`, {
                ...pixelStyle(16),
                align: 'center'
            }).setOrigin(0.5);
            const finish = (won: boolean) => {
                this.input.keyboard!.off('keydown-X', onWin);
                this.input.keyboard!.off('keydown-Z', onLose);
                this.game.events.emit(MINIGAME_DONE, { id, won } satisfies MinigameDone);
                this.scene.stop();
            };
            const onWin = () => finish(true);
            const onLose = () => finish(false);
            this.input.keyboard!.on('keydown-X', onWin);
            this.input.keyboard!.on('keydown-Z', onLose);
        }
    };
}
