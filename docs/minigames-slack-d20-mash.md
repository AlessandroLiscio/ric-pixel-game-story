# Minigames: slackline, d20, mash

Three scenes in `src/game/minigames/<id>/index.ts`, each a default-exported `Phaser.Scene` with `static KEY = 'minigame-<id>'` and `static ID = '<id>'`; the registry picks them up by folder name. Each one shows the instruction card first (texts of `minigames.<id>` in `dialogue.it.json`), plays, shows a short result banner with `winText` or `loseText`, then emits `MINIGAME_DONE` with `{ id, won, score }` and stops itself. The tiny HUD words that are not in the dialogue JSON (Italian) live in `<id>/labels.ts`. All three listen to the game event `debug:minigame` ({ won }) and finish at once with that result (the F7 and F8 debug keys and `window.__ricTest.win()` and `.lose()`). Textures are the boot-scene ones (`bg-giardini`, `bg-circe`, `char-ric`, `char-giusy`) plus shapes drawn with Graphics; the background is the render of the scene's tile room, dimmed behind the panel-style UI. Run flags (`getRun(game).flags?.[name]`, through `minigames/flags.ts`) change two of them: `peroniBevuta` (slackline) and `fumo` (d20).

## Slackline (scene giardini)

Ric stands on the left trunk of the slackline drawn in the room render (the trunks, the line and the orange towel are the room's own, no scenery is drawn by the scene) and has to cross in 5 steps. A marker sweeps along a bar with a green zone at each end; X or Space with the marker inside a zone is a hit (one step, `confirm`), a press in the middle is a miss (a bigger wobble, one of the 3 balance pips lost, `miss`). A zone gives at most one hit per pass, a second press inside the same zone is ignored, and a pass with no press costs nothing. Three misses, or 45 seconds without finishing, and Ric falls on the towel (`lose`). Five steps win (`win`). One sweep from end to end takes 0.8 s at the start and 0.067 s less per step done (0.53 s on the last).

Round 4: each zone is 11.25% of the bar (it was 7.5%, 1.5 times as wide), so the marker spends about 0.09 s inside a zone at the start and 0.06 s on the last step. With the run flag `peroniBevuta` the sweep speed changes every 3 seconds, alternating faster then slower than normal: 1.4 times normal for the first 3 s, 0.7 times for the next 3 s, and so on from the first frame of play (the marker is tinted red while it speeds up and blue while it slows down; `speedMul` on the scene is the current factor).

## D20 (scene circe, part a, wisdom)

After a short "Pronti... VIA!" the player has 5 seconds to press X as many times as possible (a held key counts once; only X counts). 60 presses are the most that count and the 60th ends the window at once. The result is `round(presses * 20 / 60)`, so about every 3 presses are +1 starting from 0 (60 presses give 20, 2 give 1, none give 0; 32 are needed to win, 26 with the hash); with the run flag `fumo` (Ric found the hash) 2 is added, capped at 20. More than 10 wins (the constant `TARGET`). While the window is open the screen shows the countdown (top right, red under 1.5 s), the running count (`Colpi 14/60`, with `Fumo +2` when the flag is set), a fill bar and a time bar, and the number on the die is the result the presses give so far; the die swells and rattles with each press. When the window closes the d20 tumbles (three turns and more, a toss and a bounce for 1.5 to 2.4 s, the number flickering slower and slower) and lands on the result. A result of 20 gets a gold flash, a screen shake and a spark burst, a result of 0 or 1 a red flash and a shake. The instruction card and the screen say d20 (the game device); no dialogue line of the story mentions a die. Pure function `resultOf(presses, fumo)` is exported from `d20/index.ts`.

## Mash (scene circe, part b, strength)

After a short "Pronti... VIA!", X is pressed as fast as possible for 8 s. Each real key down (`event.repeat` false, a held key counts once) adds `GAIN` to a 0 to 100 bar, which drains `DRAIN` per second while above 0. Giusy clings to the doorframe on the right and is dragged to the left a step with every press, Ric pulls from the left and leans back; full bar: Giusy lands on the floor and Ric falls on his back (`win`), time out: she snaps back to the frame and Ric is flung to the floor (`lose`).

Harder in rounds 4 and 6. `GAIN` is 4 and `DRAIN` is 18 per second (round 4 had 16). The net rise per second is presses times `GAIN` minus `DRAIN`, and 100 has to fill within the 8 s, so the win starts at about 7.6 presses a second (it was about 7.1):

| presses a second | net rise a second | result |
|---|---|---|
| 6 | 6 | loses (48 after 8 s) |
| 7 | 10 | loses (80 after 8 s) |
| 7.5 | 12 | loses by a hair (96 after 8 s) |
| 7.7 | 12.8 | wins in 7.8 s |
| 8 | 14 | wins in 7.1 s |
| 9 | 18 | wins in 5.6 s |
| 12 | 30 | wins in 3.3 s |

An average player mashing one key sustains about 6 to 7 presses a second over 8 seconds (the first seconds are faster, then the finger tires), so winning takes fast mashing: a quick player (8 or more) wins, an average one usually loses. This is an estimate from typical tapping rates, not a measured sample: if the playtest says otherwise, `GAIN` and `DRAIN` at the top of the file tune it (one more point of `DRAIN` moves the threshold by 0.25 presses a second).

## Checks

Each scene exposes a few public fields for tests (`markerPos`, `stepsDone`, `pips`, `speedMul` and `zoneSide()` on the slackline; `presses`, `roll`, `counting` on the d20; `progress` and `presses` on mash). `scripts/e2e.mjs` plays mash and the d20 with real key presses (the d20 check also compares the landed value with `round(presses / 3)` plus the hash bonus) and forces the slackline through `window.__ricTest`.
