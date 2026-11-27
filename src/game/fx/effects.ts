// The pixelfx effects the game can play, by catalog id (`<category>/<name>`). Each one is a static import so the build
// tree-shakes the other ~200 modules of src/vendor/pixelfx/fx. To use another effect: import it here and add one line.
import { PAL } from '../../vendor/pixelfx/core/index.js';
import * as blinds from '../../vendor/pixelfx/fx/transitions/blinds.js';
import * as diamondWipe from '../../vendor/pixelfx/fx/transitions/diamond-wipe.js';
import * as iris from '../../vendor/pixelfx/fx/transitions/iris.js';
import * as pixelDissolve from '../../vendor/pixelfx/fx/transitions/pixel-dissolve.js';
import * as starIris from '../../vendor/pixelfx/fx/transitions/star-iris.js';
import * as comboCounter from '../../vendor/pixelfx/fx/ui/combo-counter.js';
import * as confetti from '../../vendor/pixelfx/fx/ui/confetti.js';
import * as critNumber from '../../vendor/pixelfx/fx/ui/crit-number.js';
import * as damageNumber from '../../vendor/pixelfx/fx/ui/damage-number.js';
import * as collectBurst from '../../vendor/pixelfx/fx/pickups/collect-burst.js';
import * as powerStar from '../../vendor/pixelfx/fx/pickups/power-star.js';
import * as poof from '../../vendor/pixelfx/fx/spawn/poof.js';
import * as smokeBomb from '../../vendor/pixelfx/fx/explosions/smoke-bomb.js';
import * as cartoonPow from '../../vendor/pixelfx/fx/explosions/cartoon-pow.js';
import * as fireworkBurst from '../../vendor/pixelfx/fx/explosions/firework-burst.js';
import * as fireworkRocket from '../../vendor/pixelfx/fx/explosions/firework-rocket.js';
import * as hitSpark from '../../vendor/pixelfx/fx/impacts/hit-spark.js';
import * as impactFrame from '../../vendor/pixelfx/fx/impacts/impact-frame.js';
import * as bubbles from '../../vendor/pixelfx/fx/water/bubbles.js';
import * as splash from '../../vendor/pixelfx/fx/water/splash.js';
import * as bird from '../../vendor/pixelfx/fx/critters/bird.js';
import * as butterfly from '../../vendor/pixelfx/fx/critters/butterfly.js';
import * as fishSchool from '../../vendor/pixelfx/fx/critters/fish-school.js';
import * as jellyfish from '../../vendor/pixelfx/fx/critters/jellyfish.js';
import * as fireflies from '../../vendor/pixelfx/fx/weather/fireflies.js';
import * as godRays from '../../vendor/pixelfx/fx/weather/god-rays.js';
import * as candle from '../../vendor/pixelfx/fx/fire/candle.js';

/** A pixelfx effect module: `meta` plus either `create(options)` or a `draw(painter, t, options)` function. */
export interface FxModule {
    meta: { size: number[]; origin?: number[]; duration?: number; loop?: boolean; fps?: number; options?: Record<string, unknown> };
}

export const EFFECTS: Record<string, FxModule> = {
    'transitions/blinds': blinds,
    'transitions/diamond-wipe': diamondWipe,
    'transitions/iris': iris,
    'transitions/pixel-dissolve': pixelDissolve,
    'transitions/star-iris': starIris,
    'ui/combo-counter': comboCounter,
    'ui/confetti': confetti,
    'ui/crit-number': critNumber,
    'ui/damage-number': damageNumber,
    'pickups/collect-burst': collectBurst,
    'pickups/power-star': powerStar,
    'spawn/poof': poof,
    'explosions/smoke-bomb': smokeBomb,
    'explosions/cartoon-pow': cartoonPow,
    'explosions/firework-burst': fireworkBurst,
    'explosions/firework-rocket': fireworkRocket,
    'impacts/hit-spark': hitSpark,
    'impacts/impact-frame': impactFrame,
    'water/bubbles': bubbles,
    'water/splash': splash,
    'critters/bird': bird,
    'critters/butterfly': butterfly,
    'critters/fish-school': fishSchool,
    'critters/jellyfish': jellyfish,
    'weather/fireflies': fireflies,
    'weather/god-rays': godRays,
    'fire/candle': candle
};

/** Named colour ramps (dark to bright, hex strings) of the game, next to the library's own `PAL` ramps (fire, ice, smoke, holy...). */
export const PALETTES: Record<string, (string | number)[]> = {
    ...(PAL as Record<string, string[]>),
    // translucent god rays: the first step is 0 (nothing), so the effect leaves the rest of its canvas clear
    beams: [0, "#3a2810", "#7a5a24", "#c89a44", "#f2d27a", "#fff2c4", "#ffffff"],
    // pale blue-grey smoke for the cat-smoke clouds
    greySmoke: ['#2b2d36', '#454856', '#62667a', '#858a9e', '#a9aebf', '#cfd3e0', '#eef0f7'],
    // warm party gold used for finale sparks and the stage
    partyGold: ['#3a2208', '#7a4a0c', '#c27c14', '#f0b424', '#ffd84a', '#fff09a', '#fffbe6', '#ffffff'],
    // the blue light of the TV
    tvBlue: ['#0c1430', '#162c5c', '#1f4f94', '#2f7fcc', '#58b4ec', '#9bdcff', '#d8f4ff', '#ffffff']
};
