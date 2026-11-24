import { SCENES } from './data';
import type { RunState } from './RunState';
import type { SceneDef } from './sceneTypes';

// Story rules that scenes.json does not carry.

/** Scene 4 runs two minigames in a row; every other scene has at most one (SceneDef.minigame). */
const SEQUENCES: Record<string, string[]> = { circe: ['d20', 'mash'] };

/** A second friend who joins together with SceneDef.friend. */
const CO_JOINERS: Record<string, string> = { circe: 'giusy' };

/** An easter egg played after the win/lose lines, before the friend joins. */
const EGG_AFTER_MINIGAME: Record<string, string> = { cortile: 'fede' };

/** The divano eggs, in play order, each shown only when its minigame was won. */
const DIVANO_EGGS: [egg: string, minigame: string][] = [
    ['pinolo-pinhole', 'simon'],
    ['gatto', 'cat-smoke'],
    ['ric-sedia', 'slackline'],
    ['ros-trellone', 'd20'],
    ['giusy-divano', 'mash'],
    ['ric-sopra', 'rhythm']
];

export const minigamesOf = (def: SceneDef): string[] => SEQUENCES[def.id] ?? (def.minigame ? [def.minigame] : []);

export const joinersOf = (def: SceneDef): string[] => [def.friend.personId, ...(CO_JOINERS[def.id] ? [CO_JOINERS[def.id]] : [])];

export const eggAfterMinigame = (def: SceneDef): string | undefined => EGG_AFTER_MINIGAME[def.id];

export const divanoEggs = (results: RunState['results']): string[] => DIVANO_EGGS.filter(([, mg]) => results[mg]).map(([egg]) => egg);

/** The friends who would have joined before scene `index` (used when a debug key jumps into the middle of the story). */
export const friendsBefore = (index: number): string[] => SCENES.slice(0, index).flatMap(joinersOf);

/** True once the scene's friend has joined: the minigames are done and the door is open. */
export const isSceneDone = (def: SceneDef, run: RunState): boolean => run.party.includes(def.friend.personId);
