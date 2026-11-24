import Phaser from 'phaser';
import { TitleScene } from '../scenes/TitleScene';
import { BootScene } from './BootScene';
import { EndingStub } from './EndingStub';
import { WorldScene } from './WorldScene';

// W4 adds src/game/ending/index.ts exporting its scene classes (`ending`, `credits`), as default or named exports.
// Until then a stub `ending` scene stands in.
const endingModules = import.meta.glob<Record<string, unknown>>('../ending/index.ts', { eager: true });

const isSceneClass = (v: unknown): v is Phaser.Types.Scenes.SceneType => typeof v === 'function' && v.prototype instanceof Phaser.Scene;

/** Every scene registered at game start. The minigame scenes are added by BootScene from minigames/registry.ts. */
export function gameScenes(): Phaser.Types.Scenes.SceneType[] {
    const exported = Object.values(endingModules).flatMap((mod) => Object.values(mod).flatMap((v) => (Array.isArray(v) ? v : [v])));
    const ending = [...new Set(exported)].filter(isSceneClass); // default and named export may be the same class
    return [BootScene, TitleScene, WorldScene, ...(ending.length ? ending : [EndingStub])];
}
