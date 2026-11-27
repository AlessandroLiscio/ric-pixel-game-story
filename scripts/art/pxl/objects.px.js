// Key room objects of the tile worlds, drawn with pxl (the skill in .claude/skills/pxl). Build: see scripts/art/pxl/README.md.
// Each sprite is its stamp's size minus 2 px on both axes: `selout` adds the 1 px outline all round, so the built PNG is exactly w*32 by h*32
// and the Python stamp pastes it over its own soft ground shadow (`pxl_object` in scripts/art/tiles_objects.py).
// Light comes from the top left like the tiles. The palette is the game's own, not pico8: every ramp runs dark to light with the hue shifted
// (cool shadow, warm light) and its middle tone is the colour of the object it replaces. Keys: 0 warm outline, 1 cool outline,
// a-d burgundy, e-h navy, i j l m black lacquer, q-t pale wood, T-W table oak, y z A B dark wood, C-F grey, K-N lamp green, 2-5 red,
// Z near black, w white, S cream, O orange, P candle, Q glass.

use(["#2a1a1e", "#1c2236"])
pal({
  a: "#4a1226", b: "#8a2a46", c: "#b34957", d: "#d98b84",
  e: "#171a30", f: "#2a3453", g: "#3f5073", h: "#6b84a4",
  i: "#16161c", j: "#2c2c38", l: "#544763", m: "#9e98af",
  q: "#6a4f35", r: "#8f7650", s: "#ad9666", t: "#d0c38f",
  T: "#7a4630", U: "#a2704a", V: "#bb9065", W: "#d9b98d",
  y: "#2a1810", z: "#43291c", A: "#5a3a28", B: "#7a5238",
  C: "#464650", D: "#696e78", E: "#9a9fac", F: "#c5c9d2",
  K: "#1c2a28", L: "#2d5a46", M: "#538c6b", N: "#82bd93",
  2: "#7a1424", 3: "#b71e2c", 4: "#d5272f", 5: "#e2594c",
  Z: "#111015", w: "#f4f1ea", S: "#e8e0d0", O: "#e86a3a", P: "#f0c060", Q: "#d4eaf5",
})
ramps("abcd", "efgh", "ijlm", "qrst", "TUVW", "yzAB", "CDEF", "KLMN", "2345")

// A solid lit from the top left in flat bands: ramp keys dark -> light, `lo` and `hi` are the darkest and lightest step used, the bands run
// along the diagonal, `r` chamfers the corners and `inside(i, j)` cuts any other shape.
function lit(c, x, y, w, h, K, r = 2, lo = 1, hi = K.length - 1, inside = null) {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      if (Math.min(i, w - 1 - i) + Math.min(j, h - 1 - j) < r - 1) continue
      if (inside && !inside(i, j)) continue
      const t = (i / Math.max(1, w - 1)) * 0.4 + (j / Math.max(1, h - 1)) * 0.6
      c.px(x + i, y + j, K[Math.round(lo + (1 - t) * (hi - lo))])
    }
}

// A stuffed cushion: `lit`, then a light rim on top and left and a dark rim at the bottom and right.
function puff(c, x, y, w, h, K, r = 3, lo = 1, hi = K.length - 1) {
  lit(c, x, y, w, h, K, r, lo, hi)
  const n = K.length - 1
  c.hline(x + r - 1, y, w - 2 * r + 2, K[n])
  c.vline(x, y + r - 1, h - 2 * r + 2, K[n - 1])
  c.hline(x + r - 1, y + h - 1, w - 2 * r + 2, K[0])
  c.vline(x + w - 1, y + r - 1, h - 2 * r + 2, K[0])
}

const ell = (cx, cy, rx, ry) => (i, j) => ((i - cx) / rx) ** 2 + ((j - cy) / ry) ** 2 <= 1

// ------------------------------------------------------------------------------------------------------------ Giuggiu's living room

// The long burgundy sofa against the left wall, facing east: a tall back on the left, three seat cushions, a bolster arm at each end.
sprite("giuggiu_sofa_burgundy", { w: 62, h: 126, selout: "0" }, (c) => {
  const K = "abcd"
  c.rect(2, 8, 54, 108, "a") // the frame, seen in the gaps
  for (const [y0, y1] of [[14, 41], [42, 69], [70, 97]]) {
    puff(c, 0, y0, 21, y1 - y0 + 1, K, 5, 1, 2) // the back cushions, a step darker than the seats
    puff(c, 23, y0, 34, y1 - y0 + 1, K, 5, 1, 2) // the seat cushions
    c.px(10, Math.floor((y0 + y1) / 2), "a") // a tufting button
    c.hline(29, Math.floor((y0 + y1) / 2) + 2, 22, "b") // the crease of the seat
  }
  puff(c, 0, 0, 58, 14, K, 6, 1, 2) // the north arm, a rolled bolster
  puff(c, 0, 98, 58, 21, K, 7, 1, 2) // the south arm, taller because it is nearest
  c.rect(4, 116, 47, 3, "a") // the front rail in shadow
  c.rect(2, 120, 4, 4, "Z") // the feet
  c.rect(52, 120, 4, 4, "Z")
  puff(c, 24, 22, 17, 9, "efgh", 2, 1, 3) // the patterned dark cushion on the middle seat
  for (let k = 0; k < 3; k++) c.px(28 + k * 5, 26, "w")
  c.rect(28, 38, 6, 3, "Z") // a USB stick
  c.px(29, 39, "5")
})

// The navy sofa that faces the viewer, with the red ribbed throw on its right half and the grey octagon cushion on the left.
sprite("giuggiu_sofa_navy", { w: 126, h: 62, selout: "1" }, (c) => {
  const K = "efgh"
  c.rect(6, 6, 108, 50, "e") // the frame, seen in the gaps
  puff(c, 12, 2, 48, 25, K, 6, 1, 3) // two back cushions
  puff(c, 62, 2, 48, 25, K, 6, 1, 3)
  puff(c, 12, 27, 48, 24, K, 6, 1, 3) // two seat cushions
  puff(c, 62, 27, 48, 24, K, 6, 1, 3)
  puff(c, 0, 6, 14, 49, K, 6, 1, 3) // the rolled arms
  puff(c, 108, 6, 14, 49, K, 6, 1, 3)
  c.rect(3, 52, 116, 5, "f") // the front rail
  c.hline(3, 52, 116, "g")
  c.hline(3, 56, 116, "e")
  c.rect(3, 57, 4, 3, "Z") // the feet
  c.rect(115, 57, 4, 3, "Z")
  c.rect(3, 10, 7, 5, "Z") // the remote control on the left arm
  c.px(5, 12, "5")
  c.px(7, 12, "D")
  puff(c, 17, 28, 30, 21, "CDEF", 7, 0, 3) // the grey octagon cushion
  c.px(31, 38, "C")
  // the red throw over the right seat, down the front and over the arm
  c.poly([76, 26, 117, 20, 122, 54, 98, 58, 72, 50], "4")
  c.poly([76, 26, 117, 20, 117, 26, 92, 33, 76, 36], "5")
  c.poly([72, 50, 98, 58, 122, 54, 122, 51, 98, 53], "3")
  c.line(76, 26, 117, 20, "5")
  c.line(72, 50, 98, 58, "2")
  c.line(98, 58, 122, 54, "2")
  c.line(78, 40, 100, 37, "3")
  for (let x = 79; x < 118; x += 3) for (let y = 24; y < 56; y++) if (c.is(x, y, "34")) c.px(x, y, c.is(x, y, "3") ? "2" : "3")
  c.rect(104, 58, 9, 3, "3") // the hem hanging in front
})

// The old tube TV on its low wooden stand, seen from behind: tapering housing, vents, bezel at the sides, a cable down the stand.
sprite("giuggiu_tv", { w: 94, h: 62, selout: "1" }, (c) => {
  c.rect(10, 44, 4, 16, "z") // stand legs
  c.rect(80, 44, 4, 16, "z")
  c.vline(10, 44, 16, "B")
  c.vline(80, 44, 16, "B")
  lit(c, 4, 36, 86, 8, "yzAB", 1, 1, 3) // the stand's top, lit
  c.hline(4, 36, 86, "B")
  lit(c, 4, 44, 86, 7, "yzAB", 1, 0, 2) // its back apron
  c.rect(8, 53, 78, 3, "z")
  c.hline(8, 53, 78, "A")
  lit(c, 10, 8, 74, 28, "CDEF", 1, 0, 2) // the bezel at the sides
  c.hline(10, 8, 74, "E")
  c.vline(10, 8, 28, "E")
  c.vline(83, 9, 27, "Z")
  c.poly([22, 4, 72, 4, 80, 9, 14, 9], "D") // the top of the housing
  c.hline(22, 4, 50, "F")
  lit(c, 18, 9, 58, 27, "ijl", 1, 0, 1) // the dark back of the tube
  c.vline(75, 9, 27, "Z")
  for (let k = 0; k < 4; k++) c.hline(28, 14 + k * 3, 38, "Z") // the vents
  c.rect(37, 27, 20, 6, "C") // the socket panel
  c.rect(40, 29, 4, 2, "Z")
  c.rect(48, 29, 4, 2, "Z")
  c.px(68, 13, "N") // the standby light
  c.line(46, 31, 56, 52, "Z") // the cable down the stand
})

// ------------------------------------------------------------------------------------------------------------ Casa Circe

// The navy sofa seen from behind (the one that faces the TV): two back panels, wide arms with a piped top, short feet.
sprite("circe_sofa_back", { w: 94, h: 62, selout: "1" }, (c) => {
  const K = "efgh"
  c.rect(10, 14, 74, 36, "e")
  puff(c, 11, 10, 36, 40, K, 3, 1, 2) // the two back panels
  puff(c, 47, 10, 36, 40, K, 3, 1, 2)
  c.hline(16, 16, 26, "g") // the piping below the top
  c.hline(52, 16, 26, "g")
  for (const x of [28, 64]) for (const y of [24, 34]) c.px(x, y, "e") // tufting buttons
  puff(c, 0, 6, 14, 48, K, 4, 1, 3) // the arms, a little higher than the back
  puff(c, 80, 6, 14, 48, K, 4, 1, 3)
  c.rect(8, 50, 78, 5, "f") // the base rail
  c.hline(8, 50, 78, "g")
  c.hline(8, 54, 78, "e")
  c.rect(4, 56, 5, 3, "Z") // the feet
  c.rect(85, 56, 5, 3, "Z")
})

// ------------------------------------------------------------------------------------------------------------ Giardini and Cortile

// The park bench: pale slats with grain, iron legs.
sprite("giardini_bench_wood", { w: 62, h: 30, selout: "0" }, (c) => {
  c.rect(5, 17, 6, 11, "Z") // legs
  c.rect(51, 17, 6, 11, "Z")
  c.vline(5, 17, 11, "D")
  c.vline(51, 17, 11, "D")
  for (const y of [2, 9, 16]) {
    c.rect(0, y, 62, 6, "s")
    c.hline(0, y, 62, "t") // the lit top edge of the slat
    c.hline(0, y + 5, 62, "q") // its shaded lower edge
    c.hline(6, y + 2, 14, "r") // grain
    c.hline(30, y + 3, 18, "r")
  }
  for (const [x, y] of [[4, 4], [57, 4], [4, 18], [57, 18]]) c.px(x, y, "Z") // bolts
})

// The round table of the Cortile, a candle, a plate and glasses on it.
sprite("cortile_table_big", { w: 62, h: 62, selout: "0" }, (c) => {
  c.rect(27, 40, 8, 12, "A") // the pedestal
  c.vline(27, 40, 12, "B")
  c.vline(34, 40, 12, "y")
  lit(c, 18, 50, 26, 9, "yzAB", 3, 0, 2, ell(12.5, 4, 13, 4.5)) // the foot
  lit(c, 2, 12, 58, 32, "TUVW", 1, 0, 1, ell(28.5, 16, 29, 16)) // the thickness under the top
  lit(c, 2, 6, 58, 32, "TUVW", 1, 1, 3, ell(28.5, 16, 29, 16)) // the top
  c.ellipse(31, 22, 26, 13, "W", true) // the bevel
  for (const [x, y, liquid] of [[12, 27, "P"], [42, 31, "S"], [30, 9, "4"]]) { // three glasses with their drinks
    c.rect(x, y, 5, 6, "Q")
    c.rect(x + 1, y + 2, 3, 3, liquid)
    c.hline(x, y + 5, 5, "E")
    c.px(x, y, "w")
    c.px(x + 4, y, "w")
  }
  for (const [x, y, n] of [[15, 12, 7], [38, 21, 5], [24, 33, 6]]) c.hline(x, y, n, "U") // grain of the top
  lit(c, 19, 17, 24, 11, "ESFw", 3, 0, 3, ell(11.5, 5, 12, 5.5)) // the plate
  c.ellipse(31, 23, 7, 3, "S")
  c.ellipse(31, 22, 3, 1, "P") // an egg on it
  c.px(30, 22, "w")
  c.rect(44, 10, 7, 8, "O") // the candle jar, glowing
  c.rect(45, 11, 3, 5, "P")
  c.hline(44, 17, 7, "5")
  c.vline(50, 10, 8, "4")
  c.rect(46, 6, 3, 4, "P") // its flame
  c.px(47, 8, "w")
})

// The lamp post: a green pole on a round foot, a frosted globe.
sprite("giardini_lamp", { w: 30, h: 62, selout: "1" }, (c) => {
  lit(c, 7, 50, 16, 10, "KLMN", 3, 0, 2, ell(7.5, 4.5, 8, 5)) // the foot
  c.rect(12, 18, 6, 34, "L")
  c.vline(12, 18, 34, "M")
  c.vline(13, 18, 34, "N")
  c.vline(17, 18, 34, "K")
  c.rect(10, 44, 10, 3, "M") // the collar
  c.hline(10, 44, 10, "N")
  c.hline(10, 46, 10, "K")
  c.rect(9, 16, 12, 3, "L") // the cap under the globe
  c.hline(9, 16, 12, "N")
  c.hline(9, 18, 12, "K")
  lit(c, 4, 0, 22, 17, "ESQw", 1, 0, 3, ell(10.5, 8.5, 11, 8.5)) // the milky globe
  c.px(8, 3, "w")
  c.hline(7, 4, 3, "w")
})

// ------------------------------------------------------------------------------------------------------------ Pickups

// A white plate of spaghetti carbonara seen from the top front: a plate 19 px wide, a mound of pale yellow pasta with a few strands drawn on it,
// guanciale bits and pepper. Not a stamp: the built PNG is 32x32, copied from out/sprites to public/assets/objects/carbonara.png (texture key
// `obj-carbonara`, loaded by the scene that shows it). New keys: G H I pasta, J R guanciale, X pepper.
pal({ G: "#d4a94a", H: "#e8c566", I: "#f6e19a", J: "#b8604a", R: "#e9b895", X: "#2a2420" })
ramps("GHI")
sprite("carbonara", { w: 30, h: 30, selout: "0" }, (c) => {
  const ox = 6, oy = 10 // the plate's top left in the sprite
  const px = (x, y, k) => c.px(ox + x, oy + y, k)
  lit(c, ox, oy, 19, 11, "EFSw", 1, 0, 3, ell(9, 5, 9.5, 5.5)) // the rim, lit from the top left
  c.hline(ox + 4, oy + 10, 11, "E") // the lower rim in shade
  lit(c, ox + 2, oy + 2, 15, 8, "EFSw", 1, 1, 2, ell(7, 3.5, 7.5, 4)) // the well of the plate
  lit(c, ox + 2, oy + 1, 15, 8, "GHI", 1, 0, 2, ell(7, 3.5, 7.2, 4)) // the mound of pasta
  for (const [x, y, n] of [[4, 2, 5], [3, 4, 7], [5, 6, 6], [9, 3, 5], [8, 5, 6]]) c.hline(ox + x, oy + y, n, "G") // the strands, dark gaps
  for (const [x, y, n] of [[5, 1, 4], [4, 3, 5], [10, 2, 3], [7, 4, 4], [9, 6, 4]]) c.hline(ox + x, oy + y, n, "I") // and their lit tops
  for (const [x, y] of [[6, 2], [11, 4], [4, 5], [9, 6], [13, 5]]) { // guanciale bits, a fatty pale top on a pink brown body
    c.rect(ox + x, oy + y, 2, 2, "J")
    px(x, y, "R")
  }
  for (const [x, y] of [[5, 3], [8, 2], [10, 3], [7, 5], [12, 3], [11, 6], [5, 7], [14, 4]]) px(x, y, "X") // pepper
  px(7, 3, "w") // a crumb of pecorino
  px(10, 5, "w")
})
