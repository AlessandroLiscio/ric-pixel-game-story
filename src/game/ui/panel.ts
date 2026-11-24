import type Phaser from 'phaser';

/**
 * A "VX Ace" window: 2 px light border with cut corners, vertical blue gradient, slightly translucent.
 * Drawn once into a canvas texture (integer rectangles only, so it stays crisp at any zoom).
 */
export function panelTexture(scene: Phaser.Scene, key: string, w: number, h: number): string {
    if (scene.textures.exists(key)) return key;
    const tex = scene.textures.createCanvas(key, w, h)!;
    const ctx = tex.context;
    ctx.fillStyle = '#eef2ff';
    ctx.fillRect(0, 0, w, h);
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#3a5cc7');
    gradient.addColorStop(1, '#1a2f8f');
    ctx.clearRect(2, 2, w - 4, h - 4); // so the translucent gradient does not blend with the border colour
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = gradient;
    ctx.fillRect(2, 2, w - 4, h - 4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#6f8be6'; // thin inner line
    ctx.fillRect(2, 2, w - 4, 1);
    ctx.fillRect(2, h - 3, w - 4, 1);
    ctx.fillRect(2, 2, 1, h - 4);
    ctx.fillRect(w - 3, 2, 1, h - 4);
    for (const [cx, cy] of [[0, 0], [w - 2, 0], [0, h - 2], [w - 2, h - 2]]) ctx.clearRect(cx, cy, 2, 2); // rounded corners
    tex.refresh();
    return key;
}
