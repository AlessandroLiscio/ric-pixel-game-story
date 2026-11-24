import { assetUrl } from 'asset-url';
import { FONT_FAMILY } from './game/config';
import { startGame } from './game/main';

// Load the pixel font before the game starts, so the first frame already uses it.
// Same code path for Pages (relative file) and the offline build (data: URI).
async function loadFont(): Promise<void> {
    const face = new FontFace(FONT_FAMILY, `url(${assetUrl('fonts/PixelOperator.ttf')})`);
    document.fonts.add(await face.load());
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadFont();
    await startGame('game-container');
});
