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
    /** Sits on a chair: the map point may be a blocked chair tile, and the person is drawn in front of the chair with the chair's depth. */
    seat?: boolean;
}

/**
 * A litter bin at `x`,`y` (its feet, pixels). `draw: false` means the room map already draws it; otherwise the flow draws a bin there.
 * `item` is what the bin holds, found once per run (a flag of RunState.flags, `portalGun` is its own field): `appunti`, `portalGun`,
 * `peroni`, `fumo`, `soldi`. A second look says a "già preso" line.
 */
export interface BinDef extends Point {
    draw?: boolean;
    item?: string;
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
    /** From the map point `door` in a tile room (every room is one). */
    door: (Rect & { draw?: boolean }) | null;
    walk: Rect[];
    /** `"edge"`: once the scene is done Ric also leaves by walking to any edge of the map (a room with no visible door). */
    exit?: 'edge';
    /** Litter bins Ric can check with X, each with its item. */
    bins?: BinDef[];
    /** The scene's friend, who joins after the minigame. */
    friend: NpcDef | null;
    /** The second friend who joins in the same scene (circe: Giusy). */
    friend2?: NpcDef;
    extras: NpcDef[];
    minigame: string | null;
    ambient: Record<string, unknown>[];
}

/** One box page: the text wraps to the width of the box (a `\n` counts as a space), at most 3 wrapped lines. `pause` is a beat (ms) before the page starts. */
export interface Line {
    speaker: string;
    text: string;
    pause?: number;
    /** In a scene's `meet`: the happening that follows this line (`losco`: the hooded man walks up to Lara). */
    event?: 'losco';
    /** The line the whole room laughs at during the credits (one in `scenes.divano`). */
    laugh?: boolean;
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
    /** Easter egg id -> the name shown in the popup (ui/Achievement.ts), the one table of egg names. */
    achievements: Record<string, string>;
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
