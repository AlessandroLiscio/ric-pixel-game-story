import Phaser from 'phaser';
import { MenuScene } from '../scenes/MenuScene';
import { TitleScene } from '../scenes/TitleScene';
import { BootScene } from './BootScene';
import { EndingStub } from './EndingStub';
import { WorldScene } from './WorldScene';

// src/game/ending/index.ts (`ending`) and skydive.ts (`skydive`) export their scene classes, as default or named exports.
// Without them a stub `ending` scene stands in.
const endingModules = import.meta.glob<Record<string, unknown>>(['../ending/index.ts', '../ending/skydive.ts'], { eager: true });

const isSceneClass = (v: unknown): v is Phaser.Types.Scenes.SceneType => typeof v === 'function' && v.prototype instanceof Phaser.Scene;

/** Every scene registered at game start. The minigame scenes are added by BootScene from minigames/registry.ts. */
export function gameScenes(): Phaser.Types.Scenes.SceneType[] {
    const exported = Object.values(endingModules).flatMap((mod) => Object.values(mod).flatMap((v) => (Array.isArray(v) ? v : [v])));
    const ending = [...new Set(exported)].filter(isSceneClass); // default and named export may be the same class
    return [BootScene, TitleScene, WorldScene, MenuScene, ...(ending.length ? ending : [EndingStub])];
}
