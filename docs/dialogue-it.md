# Dialogue (Italian) for the Ric game

All player-visible text lives in `src/data/dialogue.it.json`, written in Italian and following the dialogue contract (`ui`, `scenes`, `minigames`, `easterEggs`, `credits`, `titleScreen`). Check it with `node scripts/check-dialogue.mjs`: it prints `PASS dialogue: <N> lines, all within limits` or the first 20 problems.

## Structure

A Line is `{ "speaker", "text", "pause"? }`. One Line is one box page: at most 3 rows separated by `\n`, at most 44 characters per row. Speakers are the personIds (`ric`, `lara`, `liscio`, `ros`, `lollino`, `fede`, `giuggiu`, `giusy`, `pinolo`, `gatto`, `sconosciuta`) or `narratore`. The only placeholder is `{ric}`; the validator counts the raw text, so the real length after substitution is shorter.

`scenes` holds the six sceneIds in order, each with `arrival`, `meet`, `minigameIntro`, `win`, `lose` and `join`. The flow plays arrival, meet, minigameIntro, the minigame, then win or lose, then join (the friend joins the party in both cases). Every scene path is about 8 to 15 pages.

Deviations from the contract, both needed by the story and listed here for the flow worker. First, `scenes.circe` also has `minigameIntro2`, `win2` and `lose2` for the second minigame of the scene: `minigameIntro`, `win` and `lose` belong to the d20 (Ros) and the `*2` keys to mash (Giusy); `join` closes the scene and covers Ros and Giusy together. Second, `scenes.divano` has no minigame, so `minigameIntro`, `win` and `lose` are empty arrays; `meet` is the sofa banter during the fish documentary, the easter eggs play after `meet` in the order the flow chooses, and `join` is the last pair of pages before the credits.

`minigames.<id>` has `title` (max 32 characters), `instructions` (max 2 rows of 44), `winText` and `loseText` (max 2 rows of 44, a short result card). `easterEggs` holds the ten eggs; `credits` and `titleScreen` follow the contract. `ui` has the keys the contract names plus a few extras (`confirm`, `fastForward`, `talk`, `exit`, `loading`, `joined`, `theEnd`) that the UI worker may use or ignore.

## Easter egg triggers (assumed)

The six divano eggs play in the final scene only when their minigame was won: `pinolo-pinhole` (simon), `gatto` (cat-smoke), `ric-sedia` (slackline), `ros-trellone` (d20), `giusy-divano` (mash), `ric-sopra` (rhythm). `ros-trellone` contains the exact Ric line `Per l'amor di dio basta!` and the validator checks it. `fede` is a joke in the cortile scene, not an NPC (author decision): the generator still draws a Fede sheet and portrait (used in the title and credits), but no scene places him, and `scenes.cortile` has no Fede line. After the stage with Lara, Ric can ask her; the egg is exactly 2 Lines, `ric` "Allora, Fede dov'è?" and `lara` "Ha paccato.", and the validator enforces both texts. It is always available, not tied to a win. The `ric-sopra` egg is a cheeky non-explicit joke (thumps from upstairs, a closed door, a neighbour knocking); the girl upstairs speaks as `sconosciuta`.

## Extra NPC lines the author can swap

`extra-1`, `extra-2` and `extra-3` are my own invention, placed so that they fit the scenes: `extra-1` is a student in the lecture hall (universita), `extra-2` is a dog walker who notices Liscio on the slackline (giardini), `extra-3` is a barista who offers Ric a beer (cortile). The generic passersby speak as `narratore` with their role as a label inside the text (for example `Studente: «...»`), because the contract has no speaker id for them; the scenes worker places them in `extras` using any sprite. `extra-2` also has a Liscio reply. Swap or delete freely, keeping the ids (the validator expects all three).

## Assumptions

- Working title: `Ric 30: Un Venerdì a Bologna`. Subtitle and press text as briefed.
- Genders: Ric and Prof. Pinolo are male, Giusy is female (the brief says "her seat"). For everyone else the lines avoid gendered forms.
- "Trellone" is used as the author's own word, always as a light joke, never as an instruction or praise; the friends' personalities are light inventions: Lollino studious (notes and colour pens), Giuggiu the chill host, Liscio the sporty acrobat, Ros the sarcastic rebel, Giusy always late, Lara the musical one.
- The cat only says `Miao.` with a parenthetical translation in some lines.
- The two cortile guitarists and the drummer are never named.
- A flat path through the game is about 100 dialogue pages; with six minigames (about 1 minute each) the run is about 20 minutes.

## Line counts

| Part | Lines |
| --- | --- |
| scenes.universita | 19 |
| scenes.giuggiu | 20 |
| scenes.giardini | 17 |
| scenes.circe | 22 |
| scenes.cortile | 16 |
| scenes.divano | 12 |
| easterEggs (10) | 39 |
| Total in the validator (all Lines) | 145 |

The per-scene figures are all Lines in the scene, so a single run shows about 8 to 15 of them per scene (win and lose are alternatives).
