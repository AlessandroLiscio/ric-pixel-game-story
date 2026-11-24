import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { MAPS, TILE } from '../flow/tileMap';

export { GAME_HEIGHT, GAME_WIDTH };

// The credits play in the real tile room: src/data/maps/divano.json (scripts/art/rooms/divano.py), drawn from the top left corner of
// the screen, so a map pixel is a screen pixel. Everything below is read from the map's named points, so moving the TV or the bed in
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
    // the sofa bed: head and shoulders show above the mattress (the quilt, a tile with a higher depth, hides the hips)
    bedLeft: spot('seat_bed_l', 30, 9, 10),
    bedRight: spot('seat_bed_r', 33, 9, 10),
    /** The middle of the sleeper lying across the foot of the bed, on top of the quilt. */
    bedFoot: spot('seat_bed_foot', 14, -2, 36),
    // the white chairs face west: the seat (a tile of depth 32 more) hides the legs
    chairLeft: spot('seat_chair_l', 14, 24, 31),
    chairRight: spot('seat_chair_r', 14, 24, 31),
    /** Standing on the seat of the right chair (the slackline win). */
    chairRightStand: spot('seat_chair_r', 14, 16, 33),
    // on the floor behind the pink pouf: the pouf hides all but the head and shoulders
    pouf: spot('seat_pouf', 16, 20, 20),
    /** The middle of the sleeper on the floor in front of the coffee table. */
    floor: spot('seat_floor', 16, 16, 16),
    cat: spot('seat_cat', 16, 28, 28)
} as const;

/** Where the foil "30" balloons float: over the shelves, by the chairs. */
export const BALLOONS = { x: 376, y: 44 };

// The credits column on the right of the screen.
export const BAND_X = 424;
export const BAND_CX = 534;
export const BAND_TEXT_W = 190;

/** Sort depths of everything the ending adds over the room (the map's tiles stay under 400, its night overlay is at 750, its glows at 760 and its dust at 770). */
export const DEPTH = {
    tvGlow: 757,
    tvPicture: 765,
    dim: 780,
    band: 800,
    credits: 801,
    finaleFx: 805,
    finaleText: 810,
    particles: 820
} as const;
