import Phaser from 'phaser';
import { RENDER_SCALE } from './config';

/**
 * Scene plugin (registered in main.ts): on every scene start the main camera zooms by RENDER_SCALE with its origin at the top-left, so a
 * scene keeps its 640x360 logical coordinates on the 1280x720 canvas. Origin 0 keeps scroll 0 at the top-left of the logical space, scroll-factor-0
 * HUD objects in place and Camera.cull exact; the one thing it changes is that the camera's own follow and bounds code assumes the default
 * origin of 0.5, so a following scene offsets them (WorldScene).
 */
export class HdCameraPlugin extends Phaser.Plugins.ScenePlugin {
    boot(): void {
        this.systems!.events.on(Phaser.Scenes.Events.START, this.onStart, this);
    }

    private onStart(): void {
        this.systems!.cameras.main.setZoom(RENDER_SCALE).setOrigin(0, 0);
    }
}
