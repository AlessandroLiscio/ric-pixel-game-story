import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { MAPS, TILE } from '../flow/tileMap';

export { GAME_HEIGHT, GAME_WIDTH };

// The credits play in the real tile room: src/data/maps/divano.json (scripts/art/rooms/divano.py), drawn from the top left corner of
// the screen, so a map pixel is a screen pixel. Everything below is read from the map's named points, so moving the TV or the sofa in
// the room script moves the ending with it.
const map = MAPS.divano;
if (!map) throw new Error('the ending needs src/data/maps/divano.json');
const px = (name: string): { x: number; y: number } => {
    const p = map.points[name];
    if (!p) throw new Error(`map divano has no point "${name}"`);
    return { x: p.x * TILE, y: p.y * TILE };
};

/** The TV screen: the stamp `divano_tv_unit` has its 96 x 54 picture at (16, 6) inside the stamp (SCREEN in scripts/art/stamps/divano.py). */
const tv = px('tv');
export const SCREEN = { x: tv.x + 16, y: tv.y + 6, w: 96, h: 54 };

/** Where a person stands, in screen pixels: `x` the middle of the feet, `y` the feet, `depth` the sort depth against the room's tiles
 *  (an `objects` tile has the depth of its lower edge, so a person is hidden by a tile of a higher depth). */
export interface Spot {
    x: number;
    y: number;
    depth: number;
}
const spot = (name: string, dx: number, dy: number, depthDy: number): Spot => {
    const p = px(name);
    return { x: p.x + dx, y: p.y + dy, depth: p.y + depthDy };
};

export const SPOTS = {
    // the navy sofa on the south wall, seen from behind, facing the TV: the heads show over the backrest (a tile of the sofa, with a
    // higher depth, hides the bodies)
    sofaLeft: spot('seat_sofa_l', 16, 20, 31),
    sofaMid: spot('seat_sofa_m', 16, 20, 31),
    sofaRight: spot('seat_sofa_r', 16, 20, 31),
    // the chairs of the dinner table: the white one on the west side faces east, the clear one on the east side faces west; the seat (a
    // tile of depth 32 more) hides the legs
    chairLeft: spot('seat_chair_l', 15, 24, 31),
    chairRight: spot('seat_chair_r', 14, 24, 31),
    // on the floor behind the pink pouf: the pouf hides all but the head and shoulders
    pouf: spot('seat_pouf', 16, 20, 20),
    /** The middle of the sleeper on the floor in front of the coffee table. */
    floor: spot('seat_floor', 16, 16, 16)
} as const;

/** Where the foil "30" balloons float: over the TV wall, by the fairy lights. */
export const BALLOONS = { x: 296, y: 42 };

/** The top of the staircase on the TV wall (the dark landing at the left end of the steps): the hearts and puffs of the upstairs gag leave from here. */
export const UPSTAIRS = { x: 230, y: 62 };

/** The speech banner of the credits: along the bottom of the room, left of the credits column; it grows upward with the number of rows. */
export const SPEECH = { x: 6, w: 394, bottom: GAME_HEIGHT - 6, portrait: 48 };

// The credits column on the right of the screen.
export const BAND_X = 424;
export const BAND_CX = 534;
export const BAND_TEXT_W = 190;

/** Sort depths of everything the ending adds over the room (the map's tiles stay under 400, its night overlay is at 750, its glows at 760 and its dust at 770). */
export const DEPTH = {
    tvGlow: 757,
    hearts: 758,
    tvPicture: 765,
    dim: 780,
    speech: 790,
    band: 800,
    credits: 801,
    finaleFx: 805,
    finaleText: 810,
    particles: 820
} as const;
