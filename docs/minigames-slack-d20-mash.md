# Minigames: slackline, d20, mash

Three scenes in `src/game/minigames/<id>/index.ts`, each a default-exported `Phaser.Scene` with `static KEY = 'minigame-<id>'` and `static ID = '<id>'`; the registry picks them up by folder name. Each one shows the instruction card first (texts of `minigames.<id>` in `dialogue.it.json`), plays, shows a short result banner with `winText` or `loseText`, then emits `MINIGAME_DONE` with `{ id, won, score }` and stops itself. The tiny HUD words that are not in the dialogue JSON (Italian) live in `<id>/labels.ts`. All three listen to the game event `debug:minigame` ({ won }) and finish at once with that result (the F7 and F8 debug keys and `window.__ricTest.win()` and `.lose()`). Textures are the boot-scene ones (`bg-giardini`, `bg-circe`, `char-ric`, `char-giusy`) plus shapes drawn with Graphics; the background is dimmed behind the panel-style UI.

## Slackline (scene giardini)

Ric stands on the left end of a line between two trees and has to cross in 5 steps. A marker sweeps along a bar with a green zone at each end; X or Space with the marker inside a zone is a hit (one step, `confirm`), a press in the middle is a miss (a bigger wobble, one of the 3 balance pips lost, `miss`). A zone gives at most one hit per pass, a second press inside the same zone is ignored, and a pass with no press costs nothing. Three misses, or 45 seconds without finishing, and Ric falls on the orange towel (`lose`). Five steps win (`win`). One sweep from end to end takes 2.4 s at the start and 0.2 s less per step done (1.6 s on the last), and each zone is 15% of the bar, so the marker spends about 0.36 s inside a zone at the start and 0.24 s at the end.

## D20 (scene circe, part a, wisdom)

A pixel icosahedron (a hexagon with an inner triangle and the joining edges) in the middle. X, Space or Enter rolls it (it rolls by itself after 12 s without a press): three turns, a toss and a bounce for 1.5 s, the number flickering slower and slower, then it lands on `crypto.getRandomValues` modulo 20 plus 1. More than 10 wins, so it is a plain 50%, as specified; the threshold is the constant `TARGET` at the top of the file if the odds should change. A natural 20 gets a gold flash, a screen shake and a spark burst, a natural 1 a red flash and a shake, each with its own line from `labels.ts`.

## Mash (scene circe, part b, strength)

After a short "Pronti... VIA!", X is pressed as fast as possible for 8 s. Each real key down (`event.repeat` false, a held key counts once) adds 4.6 to a 0 to 100 bar, which drains 12 per second while above 0. At 6 presses a second the net rise is 15.6 a second, so the bar fills in about 6.4 s and wins; the threshold for winning is about 5.4 presses a second (5 a second needs 9.3 s and loses, 7 a second needs 4.7 s). Giusy clings to the doorframe on the right and is dragged to the left a step with every press, Ric pulls from the left and leans back; full bar: Giusy lands on the floor and Ric falls on his back (`win`), time out: she snaps back to the frame and Ric is flung to the floor (`lose`). `GAIN` and `DRAIN` at the top of the file tune it.

## Checks

Each scene exposes a few public fields for tests (`markerPos`, `stepsDone`, `pips` and `zoneSide()` on the slackline; `roll` on the d20; `progress` and `presses` on mash). A throwaway Playwright script launched each scene directly through `window.__ricGame` (`?spike=1`) and checked: scripted correct play wins and no input loses for slackline and mash, a held key is ignored on mash, d20 rolls forced through `crypto.getRandomValues` (1, 5, 10, 11, 14, 20) end with a result that matches the roll plus random rolls, the 12 s automatic roll, and the debug event on all three.
