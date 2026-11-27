import { SCENES } from './data';
import type { RunState } from './RunState';
import type { SceneDef } from './sceneTypes';

// Story rules that scenes.json does not carry.

/** Scene 4 runs two minigames in a row; every other scene has at most one (SceneDef.minigame). */
const SEQUENCES: Record<string, string[]> = { circe: ['d20', 'mash'] };

/** An easter egg played after the win/lose lines, before the friend joins. */
const EGG_AFTER_MINIGAME: Record<string, string> = { cortile: 'fede' };

export const minigamesOf = (def: SceneDef): string[] => SEQUENCES[def.id] ?? (def.minigame ? [def.minigame] : []);

/** Who joins in this scene: the friend, plus friend2 in circe; nobody in divano. */
export const joinersOf = (def: SceneDef): string[] => [def.friend, def.friend2].flatMap((f) => (f ? [f.personId] : []));

export const eggAfterMinigame = (def: SceneDef): string | undefined => EGG_AFTER_MINIGAME[def.id];

/** The friends who would have joined before scene `index` (used when a debug key jumps into the middle of the story). */
export const friendsBefore = (index: number): string[] => SCENES.slice(0, index).flatMap(joinersOf);

/** True once the scene's friend has joined: the minigames are done and the door is open. */
export const isSceneDone = (def: SceneDef, run: RunState): boolean => !!def.friend && run.party.includes(def.friend.personId);

/** Every earlier minigame counted as won (the scene jump of the Esc menu and the debug keys). */
export const resultsBefore = (index: number): Record<string, boolean> => Object.fromEntries(SCENES.slice(0, index).flatMap(minigamesOf).map((id) => [id, true]));

/** What each bin item gives: the lines (an `easterEggs` key). */
export const BIN_ITEMS: Record<string, string> = {
    appunti: 'appuntiFound',
    portalGun: 'portalFound',
    peroni: 'peroniFound',
    fumo: 'fumoFound',
    soldi: 'soldiFound'
};
