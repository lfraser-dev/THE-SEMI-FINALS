// "Test Range": a white grid sandbox for checking movement and gunplay.
// Maps are just data + a build() function, so new arenas can be dropped in later.
import { makeBox, boxAt } from '../world.js';
import { digitBoxes } from '../props.js';

const WALL = [0.91, 0.91, 0.93];
const ACCENT = [0.86, 0.87, 0.9];
const CHAR = [0.27, 0.28, 0.31];      // charcoal structure
const RED = [0.95, 0.15, 0.1];
const LANE = [0.82, 0.83, 0.86];

export default {
  name: 'TEST RANGE',
  spawn: { pos: [0, 0, 26], yaw: Math.PI }, // facing the weapon wall

  build(world) {
    const add = (b) => world.add(b);
    const deco = (min, max, o = {}) => add(makeBox(min, max, { grid: false, ...o }));
    const S = 32; // half size of the arena
    const H = 9;

    // ---------------- floor + outer walls ----------------
    add(makeBox([-S, -1, -S], [S, 0, S]));
    add(makeBox([-S - 1, 0, -S - 1], [S + 1, H, -S], { color: WALL }));
    add(makeBox([-S - 1, 0, S], [S + 1, H, S + 1], { color: WALL }));
    add(makeBox([-S - 1, 0, -S], [-S, H, S], { color: WALL }));
    add(makeBox([S, 0, -S], [S + 1, H, S], { color: WALL }));

    // skirting, red light strip and top trim on every wall
    const walls = [
      { a: 0, fixed: -S, sign: 1 }, { a: 0, fixed: S, sign: -1 },
      { a: 2, fixed: -S, sign: 1 }, { a: 2, fixed: S, sign: -1 },
    ];
    for (const w of walls) {
      const band = (y0, y1, depth, o) => {
        const min = [0, y0, 0], max = [0, y1, 0];
        const across = w.a === 0 ? 2 : 0;
        min[w.a] = -S; max[w.a] = S;
        const inner = w.fixed;
        min[across] = Math.min(inner, inner + w.sign * depth);
        max[across] = Math.max(inner, inner + w.sign * depth);
        deco(min, max, o);
      };
      band(0, 0.45, 0.12, { color: CHAR });
      band(3.4, 3.5, 0.06, { color: RED, emissive: 0.9, solid: false, noShadow: true });
      band(H - 0.35, H, 0.25, { color: CHAR });
      // pilasters every 8m
      for (let t = -S + 4; t <= S - 4; t += 8) {
        if (w.a === 0 && w.fixed === S && Math.abs(t) < 17) continue; // keep the weapon wall clear
        const min = [0, 0, 0], max = [0, H, 0];
        const across = w.a === 0 ? 2 : 0;
        min[w.a] = t - 0.4; max[w.a] = t + 0.4;
        min[across] = Math.min(w.fixed, w.fixed + w.sign * 0.4);
        max[across] = Math.max(w.fixed, w.fixed + w.sign * 0.4);
        add(makeBox(min, max, { color: CHAR, grid: false }));
      }
    }

    // floodlight towers in the corners
    for (const [cx, cz] of [[-S + 1.5, -S + 1.5], [S - 1.5, -S + 1.5], [-S + 1.5, S - 1.5], [S - 1.5, S - 1.5]]) {
      add(boxAt(cx, 0, cz, 1.2, 14, 1.2, { color: CHAR, grid: false }));
      add(boxAt(cx, 14, cz, 3, 1.6, 3, { color: CHAR, grid: false }));
      add(boxAt(cx, 13.8, cz, 2.6, 0.2, 2.6, { color: [1, 1, 0.96], grid: false, emissive: 1, solid: false, noShadow: true }));
    }

    // ---------------- shooting lanes (north) ----------------
    add(boxAt(-10, 0, -14, 0.4, 1.2, 24, { color: ACCENT }));
    add(boxAt(10, 0, -14, 0.4, 1.2, 24, { color: ACCENT }));
    add(boxAt(0, 0, -27, 20.4, 4, 1));
    deco([-9.8, 0, -26.5], [9.8, 0.02, -1.2], { color: LANE, grid: true, edges: false });   // lane floor
    deco([-9.8, 0, -1.2], [9.8, 0.03, -0.95], { color: RED, emissive: 0.7, edges: false }); // firing line
    for (const x of [-5, 0, 5]) deco([x - 0.04, 0, -26.5], [x + 0.04, 0.025, -1.2], { color: CHAR, edges: false });
    add(boxAt(0, 0, -0.5, 6, 1.0, 0.6, { color: ACCENT }));
    add(boxAt(-6, 0, -0.5, 2, 1.4, 0.6));
    add(boxAt(6, 0, -0.5, 2, 1.4, 0.6));

    // overhead trusses over the lanes (great for shadows)
    add(boxAt(-10.7, 0, -14, 0.5, 7, 0.5, { color: CHAR, grid: false }));
    add(boxAt(10.7, 0, -14, 0.5, 7, 0.5, { color: CHAR, grid: false }));
    for (const z of [-4, -14, -24]) add(makeBox([-11, 7, z - 0.25], [11, 7.5, z + 0.25], { color: CHAR, grid: false }));
    add(makeBox([-11, 7.5, -26], [-10.4, 7.8, -2], { color: CHAR, grid: false }));
    add(makeBox([10.4, 7.5, -26], [11, 7.8, -2], { color: CHAR, grid: false }));
    for (const x of [-11, 11]) add(boxAt(x, 0, -26, 0.5, 7.5, 0.5, { color: CHAR, grid: false }));
    for (const x of [-11, 11]) add(boxAt(x, 0, -2, 0.5, 7.5, 0.5, { color: CHAR, grid: false }));

    // distance signs (metres from the firing line)
    for (const [dist, z] of [[10, -11], [20, -21]]) {
      add(boxAt(-8.6, 0, z, 0.12, 2.2, 0.12, { color: CHAR, grid: false }));
      add(boxAt(-8.6, 2.2, z, 1.3, 0.85, 0.08, { color: CHAR, grid: false }));
      digitBoxes(String(dist), -8.6 - 0.45, 2.33, z + 0.06, 0.6, 1, [1, 1, 1], 0.9).forEach(add);
    }
    digitBoxes('25', -1.0, 1.4, -26.48, 1.6, 1, CHAR).forEach(add);

    // ---------------- step test near spawn (east): 0.25 / 0.5 / 0.75 / 1.0 ----------------
    [0.25, 0.5, 0.75, 1.0].forEach((h, i) => add(boxAt(6 + i * 2.2, 0, 18, 2, h, 2)));

    // ---------------- stair platform (east) ----------------
    const px = 20, pz = 4;
    add(boxAt(px, 0, pz - 4, 8, 3, 8));
    for (let i = 0; i < 6; i++) add(boxAt(px, 0, pz + 0.3 + i * 0.6, 3, 3 - i * 0.5, 0.6, { color: ACCENT }));
    add(boxAt(px - 3.2, 3, pz - 7.5, 1.6, 1.1, 0.3, { color: CHAR, grid: false }));
    add(boxAt(px + 3.2, 3, pz - 7.5, 1.6, 1.1, 0.3, { color: CHAR, grid: false }));
    deco([px - 4, 2.98, pz - 8], [px + 4, 3.04, pz - 7.8], { color: RED, emissive: 0.7 });

    // ---------------- parkour tower (west) ----------------
    const tx = -22, tz = 6;
    [[0, 1.0], [2.4, 2.0], [4.8, 3.0], [7.2, 4.0], [9.6, 5.0]].forEach(([dz, h], i) =>
      add(boxAt(tx + 4, 0, tz + 10 - dz, 2, h, 2, { color: i % 2 ? ACCENT : WALL })));
    add(boxAt(tx, 0, tz - 2, 5, 6, 5));
    add(boxAt(tx - 2.2, 6, tz - 2, 0.6, 1.1, 5, { color: CHAR, grid: false }));
    deco([tx - 2.5, 5.98, tz + 0.45], [tx + 2.5, 6.04, tz + 0.55], { color: RED, emissive: 0.7 });
    // a tall mantle wall next to the tower (2m)
    add(boxAt(tx + 7, 0, tz - 6, 4, 2.0, 1.2, { color: ACCENT }));

    // ---------------- cover pieces ----------------
    add(boxAt(-5, 0, 10, 3, 1.2, 1));
    add(boxAt(5, 0, 8, 1, 2.6, 3, { color: CHAR, grid: false }));
    add(boxAt(0, 0, 4, 1.2, 3.2, 1.2, { color: WALL }));
    add(boxAt(-14, 0, 18, 4, 2.2, 0.6));
    add(boxAt(14, 0, 13, 0.6, 2.2, 4));
    add(boxAt(-24, 0, 24, 6, 0.6, 6, { color: ACCENT }));
    add(boxAt(24, 0, -20, 3, 7, 3, { color: CHAR, grid: false }));
    add(boxAt(-24, 0, -18, 2, 1.6, 6, { color: ACCENT }));    // mantle-height block
    add(boxAt(-24, 0, -10, 6, 1.0, 2, { color: WALL }));

    // a low tunnel to slide under
    add(boxAt(-16, 1.3, -4, 4, 0.5, 6, { color: CHAR, grid: false }));
    add(boxAt(-17.8, 0, -4, 0.4, 1.3, 6));
    add(boxAt(-14.2, 0, -4, 0.4, 1.3, 6));

    // ---------------- weapon wall (south) ----------------
    deco([-16, 0, 28.6], [16, 0.02, 31.8], { color: [0.3, 0.31, 0.34], edges: false });
    deco([-16, 0, 28.45], [16, 0.03, 28.6], { color: RED, emissive: 0.7, edges: false });
    // spawn pad
    deco([-1.5, 0, 24.5], [1.5, 0.02, 27.5], { color: LANE, edges: true });
  },

  // weapon cases along the south wall (the slot number is shown above each)
  cases: { z: 31.15, xs: [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5] },

  dummies: [
    { pos: [-6, 0, -8] },
    { pos: [4, 0, -12] },
    { pos: [-2, 0, -18] },
    { pos: [7, 0, -23] },
    { pos: [-7, 0, -24] },
    { pos: [0, 0, -21], move: { axis: 0, range: 7, speed: 4 } },
    { pos: [3, 0, -6], move: { axis: 0, range: 3, speed: 2.5 } },
    { pos: [20, 3, -2] },
    { pos: [-22, 6, 3] },
    { pos: [24, 0, -17] },
  ],

  walls: [
    { origin: [-12, 0, 8], cols: 12, rows: 6, axis: 0 },
    { origin: [18, 0, 18], cols: 10, rows: 6, axis: 2 },
  ],
};
