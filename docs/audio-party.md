# Audio, party and transitions

`src/game/audio/AudioEngine.ts` owns one `AudioContext` (Phaser's own when `game.sound.context` exists, else the shared one of `src/game/audioContext.ts`), a master gain and a music bus. `audio.init(game)` is called once at boot; it resumes the context on the first key press or click, and the key M toggles mute. The API is `audio.sfx(name)`, `audio.playTrack(id)`, `audio.stopTrack()`, `audio.setVolume(0..1)`, `audio.mute(on)`, `audio.isMuted()`, `audio.getBeatClock()` and `audio.tone(freq, ms)` (a square beep through the master gain, so mute and volume apply); effects are dropped silently while the context is still suspended.

`src/game/audio/Sequencer.ts` plays a `Track` on the AudioContext clock: a timer every 25 ms schedules every 16th-note step that falls in the next 100 ms, so the timing does not depend on frame rate. Channels are `square`, `triangle`, `noise` or `pulse25`; the beat clock (`getBeatClock()`) is the seconds of the track the listener hears now (the context clock minus `outputLatency`, or `baseLatency` when that is 0 or missing, capped at 0.5 s), never negative, and 0 when nothing plays. `renderTrack()` writes a whole track into any context, which is how `scripts/check-audio.mjs` renders it offline.

`src/game/audio/synth.ts` holds the pure helpers (`noteFreq`, `voice`) and `src/game/audio/sfx.ts` the ten effects (`blip, confirm, cancel, hit, miss, win, lose, door, step, meow`) as `playSfx(ctx, destination, name, when)`. Neither imports Phaser, so they run on an `OfflineAudioContext`. Gains are chosen so that every effect peaks below 0.4 and a four-channel track stays below 1.0.

A track is one file `src/game/audio/music/<trackId>.ts` with `export default` a `Track`; the engine collects the folder with `import.meta.glob`, so nothing else needs registering, and `playTrack` of an unknown id only logs a warning in dev. `notes` has one entry per 16th note: a name such as `"C4"`, `"G#3"`, `"Bb2"`, `"-"` or `null` for a rest, and `"="` to hold the previous note one more step (an addition to the contract). A channel shorter than `steps` repeats.

```ts
import type { Track } from '../Sequencer';
export default { id: 'demo', bpm: 120, steps: 8, channels: [{ wave: 'square', volume: 0.8, notes: ['C5', '-', 'E5', '=', 'G5', '-', 'E5', '-'] }, { wave: 'triangle', volume: 1, notes: ['C3', '-', '-', '-', 'G2', '-', '-', '-'] }] } satisfies Track;
```

`src/game/party/Party.ts` makes the follow train. `new Party(scene, ricSprite)`, then `party.update()` every frame after Ric moved. It records Ric's path every 4 px of travel and puts follower `i` on that path 12 samples (48 px) times `i + 1` behind Ric's live position, so followers glide instead of stepping; the direction and the walk or idle animation come from each follower's own movement, and depth is the sprite's y (Ric's depth is set to his y too). `add(id)` spawns the follower at the end of the trail with a pop-in and the `confirm` sound; `add(id, { instant: true })` skips both, for rebuilding the party when a new scene starts. `setPaused(true)` freezes the train and shows the idle frames, `ids()` and `positions()` read it, `destroy()` removes the sprites. The texture `char-<id>` must be a spritesheet with 32x32 frames.

`src/game/party/anims.ts` has `ensureCharAnims(scene, personId)`, which creates `<id>-walk-down|left|right|up` (columns 0, 1, 2, 1 at 8 fps, repeating) and `<id>-idle-<dir>` (the stand frame) once; the rows of the 96x128 sheet are down, left, right, up.

`src/game/transitions/index.ts` has `fadeToScene(scene, toKey, data?)`: input off, the `door` sound, a 400 ms fade to black, start the next scene with `data`, and a 400 ms fade in that the new scene runs on its own `create` event (so its `create()` needs no call; input is restored on the old scene). A second call during a transition is ignored. `fadeIn(scene)` is the same fade for a first entry such as the title scene.

`node scripts/check-audio.mjs` bundles the pure audio modules with Vite into `logs/check-audio/harness`, loads them in the installed Chrome and prints `PASS audio: sequencer and sfx render non-silent`; peak, RMS and length per effect are in `logs/check-audio/details.log`.
