import dialogueJson from '../../data/dialogue.it.json';
import { FONT_FAMILY, RENDER_SCALE } from '../config';
import type { Dialogue, Line } from '../flow/sceneTypes';

export const DIALOGUE = dialogueJson as unknown as Dialogue;

function at(path: string): unknown {
    return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], DIALOGUE);
}

/** A string of dialogue.it.json by dotted path, e.g. t('minigames.simon.title'). A missing path returns the path itself. */
export function t(path: string): string {
    const v = at(path);
    if (typeof v === 'string') return v;
    console.warn(`text: missing string "${path}"`);
    return path;
}

/** A list of Lines of dialogue.it.json by dotted path, e.g. lines('scenes.universita.meet'). Missing: empty list. */
export function lines(path: string): Line[] {
    const v = at(path);
    return Array.isArray(v) ? (v as Line[]) : [];
}

/** Text style in the pixel font (16 px keeps the font on its pixel grid), rasterised at the canvas scale so it is crisp under the camera zoom. */
export function pixelStyle(size = 16, color = '#ffffff'): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color, resolution: RENDER_SCALE };
}
