import Phaser from 'phaser';
import { beep, getAudioContext } from './audioContext';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { TitleScene } from './scenes/TitleScene';
import { installTestSkip } from './testKey';
import { installIntegerZoom } from './zoom';

export async function startGame(parent: string): Promise<Phaser.Game> {
    const scenes: Phaser.Types.Scenes.SceneType[] = [TitleScene];
    // ?spike=1 adds the W0 spike scene (used by `npm run spike-nolog`); it is not reachable from the game.
    if (new URLSearchParams(location.search).has('spike')) {
        const { SpikeScene } = await import('../spike/SpikeScene');
        scenes.push(SpikeScene);
    }

    const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        backgroundColor: '#000000',
        pixelArt: true, // nearest-neighbour textures; Phaser also sets antialias=false and roundPixels=true
        roundPixels: true,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        loader: { imageLoadType: 'HTMLImageElement' }, // no XHR: works from file:// and with data: URIs
        audio: { context: getAudioContext() },
        scene: scenes
    });

    installIntegerZoom(game, document.getElementById(parent)!);
    installTestSkip(() => game.events.emit('test-skip')); // W2/W4 listen to 'test-skip' (test builds only)
    if (new URLSearchParams(location.search).has('spike')) {
        Object.assign(window, { __ricGame: game, __ricPhaser: Phaser, __ricAudio: { ctx: getAudioContext(), beep } });
    }
    return game;
}
