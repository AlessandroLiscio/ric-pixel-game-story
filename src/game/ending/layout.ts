import { GAME_HEIGHT, GAME_WIDTH } from '../config';

export { GAME_HEIGHT, GAME_WIDTH };

/** Where the things of the living room stand (640x360 pixels). */
export const TV_CX = 190;
export const SCREEN = { x: TV_CX - 56, y: 40, w: 112, h: 72 };
export const SOFA = { x: TV_CX - 125, y: 250, w: 250, h: 52 };
export const SEAT_X = [TV_CX - 60, TV_CX, TV_CX + 60] as const;
/** Bottom of the sprites that sit on the sofa: the backrest hides everything below SOFA.y. */
export const SEATED_BOTTOM = 268;
export const CHAIR_TOP = 262;
export const CHAIR_LEFT_X = 40;
export const CHAIR_RIGHT_X = 352;
export const TABLE = { x: TV_CX, y: 322 };
export const BAND_X = 424;
export const BAND_CX = 534;
export const BAND_TEXT_W = 190;
