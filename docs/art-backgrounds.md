# Backgrounds: source choice and scene hints

Superseded in round 4: the six files in `public/assets/backgrounds/` are now renders of the tile rooms made by `scripts/art/room_backgrounds.py` from `src/data/maps/*.json` and the tileset only (no photo). The text below describes the earlier photo-based backgrounds and stays only as history.

For the scenes worker. All coordinates are in the 640x360 game space, x to the right and y down, rectangles as {x, y, w, h}. They were read off the final PNGs in `public/assets/backgrounds/`, so they are close but not pixel exact: tune them in the browser with a debug overlay. All six files share the 32 colours of `palette.json`. The pipeline is `scripts/art/backgrounds.py`, see `scripts/art/README-backgrounds.md`.

The backgrounds are true low-res pixel art: drawn on a 320x180 grid and shown 2x, so every art pixel is a 2x2 block of the 640x360 image (crops and framing are the same as the earlier blurry version, so every coordinate below still holds). Faces were replaced by simple featureless heads (hair-dark ellipse, small skin-tone face) before pixelising (circe, cortile, divano). No text of the photos remains readable (the sign of the music venue and the door sign in the kitchen were patched too). The patched people are still baked into the picture as flat silhouettes; Alessandro may paint them out by hand in Pixelorama.

## universita (scene 1, Prof. Pinolo, friend Lollino)

Source: `aula-lato-cattedra-professore`, the only landscape photo of the lecture hall that shows the whole room, the tiered benches, the lectern and the board. The other hall photo is a portrait close-up of empty benches, with no space for NPCs. The students are tiny and seen from behind, so no face is readable.

Walkable: the hall is a steep amphitheatre, so the only open floor is the stage in front of the board, {x: 340, y: 196, w: 250, h: 36}, plus the dark aisle between the benches at the lower left, {x: 40, y: 255, w: 130, h: 95}. Keep the player on the stage strip for the intro and let the aisle be optional.

Door: the wooden arch at the right, {x: 578, y: 165, w: 62, h: 90}; a second arch sits at {x: 356, y: 130, w: 40, h: 50} behind the lectern.

NPCs: Prof. Pinolo behind the lectern at about (440, 214). Lollino (friend) on the stage floor at about (520, 228) facing left, or in the left aisle at (110, 300).

Ambient ideas: flickering projector screen (the white board at {x: 395, y: 105, w: 125, h: 95}); sun shafts through the windows along the top; a few student heads nodding or writing (3 small tween sprites on the benches at y 230-300); dust motes drifting in the window light.

## giuggiu (scene 2, friend Giuggiu, the cat)

Source: `casa-giuggiu-salotto-lato-finestra`, the clearest view of the living room: window with the red lantern at the back, wardrobes, the glass table with chairs, parquet floor, sofa in the foreground. The photo `divani-e-puf` is much darker and the cat photo is a close-up. The feet in the photo's bottom-right corner are cropped out.

Walkable: the parquet floor in the middle, {x: 165, y: 282, w: 355, h: 52}, and the small pocket on the right of the table, {x: 420, y: 235, w: 100, h: 50}. The table (x 270-400, y 235-300) and the red sofa across the bottom (y > 335) are obstacles.

Door: the flat empty wall between the left wardrobe and the window, {x: 165, y: 100, w: 90, h: 115} (draw a door there), or the right wall {x: 590, y: 120, w: 50, h: 170}.

NPCs: Giuggiu near the table at about (450, 300) facing left. The cat (easter egg, cat-smoke minigame) on the red sofa at about (330, 345).

Ambient ideas: chandelier swaying slightly at the top ({x: 250, y: 0, w: 150, h: 45}); the red lantern swinging ({x: 290, y: 40, w: 70, h: 55}); flickering old CRT TV at the top right ({x: 570, y: 40, w: 35, h: 60}); a sun beam with dust from the window falling on the table.

## giardini (scene 3, friend Liscio, slackline)

Source: `giardini-margherita-1`, a screenshot of a street view of the park with no people. The UI of the screenshot (clock, icons, address, arrows) is cropped out, only the park remains. The other park photos show friends with clearly visible faces and were not used (they stay available for the slackline minigame art).

Walkable: all the grass, {x: 8, y: 238, w: 612, h: 112}. Trees at x 95-110, x 150-165, x 200-210 (trunks from y 235 to 300) and the big trunk at x 600-630 are obstacles; leave a gap between them.

Door (exit): the right edge of the path, {x: 625, y: 245, w: 15, h: 100}, or the left edge {x: 0, y: 238, w: 14, h: 112}.

NPCs: Liscio in the open sun at about (400, 275) facing left. Slackline anchors: the trunks at about (104, 300) and (203, 270).

Ambient ideas: leaves rustling (small tween on the canopy at {x: 0, y: 0, w: 640, h: 130}); drifting pollen or dust in the light; tree shadows swaying on the grass ({x: 0, y: 240, w: 640, h: 110}); a distant bird crossing the sky gap at {x: 220, y: 0, w: 150, h: 130}.

## circe (scene 4, friends Ros and Giusy)

Source: `casa-circe-zona-cucina`, the brightest and clearest view of the flat: kitchen, shelves, white door, tiled floor on the right. The other candidate (`foto-verso-ingresso`) is dark and shows the dinner table with five faces. In this one the five faces and the door sign are patched out.

Walkable: the tiles at the lower right, {x: 400, y: 285, w: 240, h: 55}, and the left corner, {x: 0, y: 300, w: 110, h: 60}. The dinner table and chairs in the middle (x 130-420, y 230-360) are an obstacle. The kitchen strip behind the guests is not reliably walkable.

Door: the white door at the back left, {x: 172, y: 20, w: 68, h: 120}.

NPCs: Ros and Giusy on the tiles at about (470, 310) and (530, 305), both facing left. The baked-in silhouettes at the table can stay as extra people.

Ambient ideas: steam over the pan on the kitchen counter ({x: 360, y: 105, w: 60, h: 40}); light flicker on the lamp-lit wall at the right (x 520-640); a candle or fairy light twinkle on the shelf at {x: 0, y: 0, w: 160, h: 90}; a kettle shine.

## cortile (scene 5, friend Lara, rhythm)

Source: `cortile-cafe-lato-scale`, the only photo that shows the whole venue: balcony, stage with the lights and the crowd. The photo of the stage is a close-up of the band with readable faces, and the third is a social media screenshot. The sign above the stage and about a dozen faces (balcony and crowd) are patched out. The photo is dark; it was lifted so the room reads.

Walkable: the dark crowd floor along the bottom, {x: 0, y: 252, w: 640, h: 103}. The stage area (y 130-250) is an obstacle.

Door: the lit staircase and entrance on the left, {x: 138, y: 120, w: 36, h: 130}.

NPCs: Lara in the crowd in front of the stage at about (330, 275) facing up. Extra audience NPCs along y 270-320.

Ambient ideas: stage lights flashing and changing colour ({x: 290, y: 130, w: 350, h: 120}, a tint overlay with a beat tween); crowd heads bobbing (small sprites or a tween on the dark band y 245-300); the ceiling projection flickering at the top right; a chandelier swaying at {x: 540, y: 0, w: 100, h: 80}.

## divano (scene 6, ending, no minigame)

Source: `casa-circe-tavolo-divano`, cropped to the sofa side of the flat: patterned red sofa, coat rack with jackets, glass balcony door with the scooter, world map on the wall. The right side of the photo (a woman at the table) is cropped out and the face of the person on the sofa is patched, so a blurred person is still baked into the sofa at about (480, 175); the easter egg `giusy-divano` can be placed there or Alessandro can paint it out. The photo `divano-aperto` (the open sofa bed with a man in a hood) was not used: its face is large and the room is hard to read.

Walkable: this view has almost no floor, the table fills the bottom. Use the shadow gap in front of the sofa, {x: 215, y: 280, w: 300, h: 40}, and the dark carpet left of the sofa, {x: 20, y: 255, w: 190, h: 60}, or make the scene a fixed one where the player only walks to the sofa.

Door: the glass balcony door at the left, {x: 35, y: 0, w: 125, h: 245}. A character leaving or "the girl upstairs" could arrive through it.

NPCs: Ros and Giusy are already in the party; place the party on the left floor at about (120, 290), (160, 295) and the stranger (sconosciuta) at the door.

Ambient ideas: flicker of the floor lamp lights in the glass door ({x: 70, y: 0, w: 90, h: 60}); dust in the light shaft near the map; the cloth or coat on the rack swaying; a slow day-to-evening tint to close the story.
