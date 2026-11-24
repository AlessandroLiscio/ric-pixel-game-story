// Type-only stand-ins for modules owned by the other W2 workers (audio, party, transitions, debug).
// Wildcard ambient modules only apply while the real file does not resolve, so once the branches are
// merged the real files win and this whole folder can be deleted.

declare module '*/scenes.json' {
    const scenes: unknown;
    export default scenes;
}

declare module '*/audio' {
    export const audio: {
        init(game: import('phaser').Game): void;
        sfx(name: string): void;
        playTrack(trackId: string): void;
        stopTrack(): void;
        setVolume(v: number): void;
        mute(on: boolean): void;
        getBeatClock(): number;
    };
}

declare module '*/party/Party' {
    export class Party {
        constructor(scene: import('phaser').Scene, leader: import('phaser').GameObjects.Sprite);
        add(personId: string): void;
        update(): void;
        setPaused(p: boolean): void;
        ids(): string[];
    }
}

declare module '*/party/anims' {
    export function ensureCharAnims(scene: import('phaser').Scene, personId: string): void;
}

declare module '*/transitions' {
    export function fadeToScene(scene: import('phaser').Scene, toKey: string, data?: object): void;
}

declare module '*/debug' {
    export function installDebug(game: import('phaser').Game): void;
}
