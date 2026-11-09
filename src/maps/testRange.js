// "Test Range": a white grid sandbox for checking movement and gunplay.
// Maps are just data + a build() function, so new arenas can be dropped in later.
import { makeBox, boxAt } from '../world.js';

const WALL = [0.9, 0.9, 0.92];
const ACCENT = [0.86, 0.87, 0.9];

export default {
  name: 'TEST RANGE',
  spawn: { pos: [0, 0, 22], yaw: 0 },

  build(world) {
    const add = (b) => world.add(b);
    const S = 32; // half size of the arena

    // floor + outer walls
    add(makeBox([-S, -1, -S], [S, 0, S]));
    add(makeBox([-S - 1, 0, -S - 1], [S + 1, 9, -S], { color: WALL }));
    add(makeBox([-S - 1, 0, S], [S + 1, 9, S + 1], { color: WALL }));
    add(makeBox([-S - 1, 0, -S], [-S, 9, S], { color: WALL }));
    add(makeBox([S, 0, -S], [S + 1, 9, S], { color: WALL }));

    // --- shooting lane (north): low dividers and a backstop ---
    add(boxAt(-10, 0, -14, 0.4, 1.2, 24, { color: ACCENT }));
    add(boxAt(10, 0, -14, 0.4, 1.2, 24, { color: ACCENT }));
    add(boxAt(0, 0, -27, 20.4, 4, 1));
    add(boxAt(0, 0, -1.5, 6, 1.0, 0.6, { color: ACCENT }));   // waist-high firing line
    add(boxAt(-6, 0, -1.5, 2, 1.4, 0.6));
    add(boxAt(6, 0, -1.5, 2, 1.4, 0.6));

    // --- step test near spawn (east): 0.25, 0.5, 0.75 (needs jump), 1.0 ---
    [0.25, 0.5, 0.75, 1.0].forEach((h, i) => add(boxAt(6 + i * 2.2, 0, 18, 2, h, 2)));

    // --- stair platform (east) ---
    const px = 20, pz = 4;
    add(boxAt(px, 0, pz - 4, 8, 3, 8));
    for (let i = 0; i < 6; i++) add(boxAt(px, 0, pz + 0.3 + i * 0.6 - 0 + 0.0, 3, 3 - i * 0.5, 0.6, { color: ACCENT }));
    add(boxAt(px - 3.2, 3, pz - 7.5, 1.6, 1.1, 0.3, { color: WALL })); // railing bits
    add(boxAt(px + 3.2, 3, pz - 7.5, 1.6, 1.1, 0.3, { color: WALL }));

    // --- parkour tower (west) ---
    const tx = -22, tz = 6;
    [[0, 1.0], [2.4, 2.0], [4.8, 3.0], [7.2, 4.0], [9.6, 5.0]].forEach(([dz, h]) =>
      add(boxAt(tx + 4, 0, tz + 10 - dz, 2, h, 2, { color: ACCENT })));
    add(boxAt(tx, 0, tz - 2, 5, 6, 5));
    add(boxAt(tx - 2.2, 6, tz - 2, 0.6, 1.1, 5, { color: WALL }));

    // --- cover pieces scattered around the middle ---
    add(boxAt(-5, 0, 10, 3, 1.2, 1));
    add(boxAt(5, 0, 8, 1, 2.6, 3));
    add(boxAt(0, 0, 4, 1.2, 3.2, 1.2, { color: WALL }));
    add(boxAt(-14, 0, 18, 4, 2.2, 0.6));
    add(boxAt(14, 0, 13, 0.6, 2.2, 4));
    add(boxAt(-24, 0, 24, 6, 0.6, 6, { color: ACCENT }));  // low pad
    add(boxAt(24, 0, -20, 3, 7, 3, { color: WALL }));      // pillar

    // a low tunnel to crouch/slide under
    add(boxAt(-16, 1.3, -4, 4, 0.5, 6, { color: ACCENT }));
    add(boxAt(-17.8, 0, -4, 0.4, 1.3, 6));
    add(boxAt(-14.2, 0, -4, 0.4, 1.3, 6));
  },

  // props to place after the static map is built
  dummies: [
    { pos: [-6, 0, -8] },
    { pos: [4, 0, -12] },
    { pos: [-2, 0, -18] },
    { pos: [7, 0, -23] },
    { pos: [-7, 0, -24] },
    { pos: [0, 0, -21], move: { axis: 0, range: 7, speed: 4 } },
    { pos: [20, 3, -2] },          // on the platform
    { pos: [-22, 6, 6 - 3] },      // on the tower
    { pos: [24, 0, -17] },
  ],

  walls: [
    { origin: [-12, 0, 8], cols: 12, rows: 6, axis: 0 },
    { origin: [18, 0, 18], cols: 10, rows: 6, axis: 2 },
  ],
};
