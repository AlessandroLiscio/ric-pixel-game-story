// Types for src/data/scenes.json and src/data/dialogue.it.json (shapes fixed in the W1/W2 contracts).
export type Facing = 'down' | 'left' | 'right' | 'up';

export interface Point {
    x: number;
    y: number;
}

export interface Rect extends Point {
    w: number;
    h: number;
}

/** A character standing in a room. `egg` names an entry of dialogue `easterEggs` played when Ric talks to it. */
export interface NpcDef extends Point {
    personId: string;
    facing: Facing;
    egg?: string;
    intro?: boolean;
}

/** One entry of scenes.json. Coordinates are 640x360 pixels; a character's x,y is where its feet are. */
export interface SceneDef {
    id: string;
    background: string;
    title: string;
    music: string;
    spawn: Point;
    door: Rect;
    walk: Rect[];
    friend: NpcDef;
    extras: NpcDef[];
    minigame: string | null;
    ambient: Record<string, unknown>[];
}

/** One box page: at most 3 rows of at most 44 characters. `pause` is a beat (ms) before the page starts. */
export interface Line {
    speaker: string;
    text: string;
    pause?: number;
}

export interface SceneLines {
    arrival: Line[];
    meet: Line[];
    minigameIntro: Line[];
    win: Line[];
    lose: Line[];
    join: Line[];
    // Scene 4 (circe) has a second minigame.
    minigameIntro2?: Line[];
    win2?: Line[];
    lose2?: Line[];
}

export interface MinigameTexts {
    title: string;
    instructions: string;
    winText: string;
    loseText: string;
}

export interface Dialogue {
    ui: Record<string, string>;
    scenes: Record<string, SceneLines>;
    minigames: Record<string, MinigameTexts>;
    easterEggs: Record<string, Line[]>;
    credits: { title: string; lines: string[] };
    titleScreen: { title: string; subtitle: string; press: string };
}

export interface PersonDef {
    id: string;
    name: string;
    role: 'hero' | 'friend' | 'npc' | 'animal';
    sprite: string;
    portrait: string | null;
}
