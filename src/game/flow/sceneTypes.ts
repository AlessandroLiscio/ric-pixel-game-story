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
    /** Tile worlds: name of a point in the scene's map; the flow turns it into x and y (the scenes.json entry then omits them). */
    at?: string;
}

/** A litter bin at `x`,`y` (its feet, pixels). `draw: false` means the room map already draws it; otherwise the flow draws a bin there. */
export interface BinDef extends Point {
    draw?: boolean;
}

/** One entry of scenes.json. Coordinates are 640x360 pixels; a character's x,y is where its feet are. */
export interface SceneDef {
    id: string;
    background: string;
    /** Id of a map in src/data/maps: the room is a tile world and spawn, door, friend and extras come from the map's points. */
    map?: string;
    title: string;
    music: string;
    spawn: Point;
    /** null in the last scene (divano), which has no door. */
    door: (Rect & { draw?: boolean }) | null;
    walk: Rect[];
    /** `"edge"`: once the scene is done Ric also leaves by walking to any edge of the map (a room with no visible door). */
    exit?: 'edge';
    /** Litter bins Ric can check with X (the first one he checks in a run holds the portal gun). */
    bins?: BinDef[];
    /** null in the last scene (divano), which has no friend to talk to. */
    friend: NpcDef | null;
    /** The second friend who joins in the same scene (circe: Giusy). */
    friend2?: NpcDef;
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
    /** The Esc menu: its labels, the key list (`portal` is shown once the portal gun is found) and one diary entry per scene id. */
    menu: Record<string, string>;
    controls: { rows: string[]; portal: string };
    diary: Record<string, string>;
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
