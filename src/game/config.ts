/** The logical game space: every scene lays out and moves things in 640x360 pixels (the 32 px tile world, the minigames, the HUD). */
export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 360;
/** The canvas renders at RENDER_SCALE x the logical size (HD): hdCamera.ts zooms every scene camera by it, text is rasterised at it. */
export const RENDER_SCALE = 2;
export const CANVAS_WIDTH = GAME_WIDTH * RENDER_SCALE;
export const CANVAS_HEIGHT = GAME_HEIGHT * RENDER_SCALE;
export const FONT_FAMILY = 'PixelOperator';
