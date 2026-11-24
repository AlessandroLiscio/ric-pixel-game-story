import peopleJson from '../../data/people.json';
import scenesJson from '../../data/scenes.json';
import type { PersonDef, SceneDef } from './sceneTypes';

export const SCENES = scenesJson as unknown as SceneDef[];
export const PEOPLE = peopleJson as unknown as PersonDef[];

export function person(id: string): PersonDef | undefined {
    return PEOPLE.find((p) => p.id === id);
}
