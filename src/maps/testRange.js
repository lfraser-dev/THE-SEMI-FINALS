// "Test Range": a white grid sandbox for checking movement and gunplay.
// Maps are just data + a build() function, so new arenas can be dropped in later.
import { makeBox, boxAt } from '../world.js';
import { digitBoxes } from '../props.js';

const WALL = [0.91, 0.91, 0.93];
const ACCENT = [0.86, 0.87, 0.9];
const CHAR = [0.27, 0.28, 0.31];      // charcoal structure
const RED = [0.95, 0.15, 0.1];
const LANE = [0.82, 0.83, 0.86];
const HAZ = [0.95, 0.2, 0.14];

// Parkour annex, through a doorway in the east wall
const GZ0 = -29.9, GZ1 = -5;             // doorway (z range) in the east wall
const AX1 = 73, AZ0 = -30, AZ1 = -5;      // annex extents (x from the arena wall at 32)
const HALF_PI = Math.PI / 2;
const DECK_Y = -16;                       // floor height of the underground combat arena
const CEIL_Y = DECK_Y + 13.5;              // underside of its ceiling (just below the range floor)
const HATCH = { x0: -30, x1: -27, z0: -4.5, z1: -1.5 };   // elevator shaft opening in the range floor

export default {
  name: 'TEST RANGE',
  spawn: { pos: [0, 0, 26], yaw: Math.PI }, // facing the weapon wall

  build(world) {
    const add = (b) => world.add(b);
    // decorative trim/floor markings don't collide unless asked to
    const deco = (min, max, o = {}) => add(makeBox(min, max, { grid: false, solid: false, ...o }));
    const S = 32; // half size of the arena
    const H = 9;

    // ---------------- floor + outer walls ----------------
    // floor, with a hatch for the elevator shaft
    add(makeBox([-S, -1, -S], [HATCH.x0, 0, S]));
    add(makeBox([HATCH.x1, -1, -S], [S, 0, S]));
    add(makeBox([HATCH.x0, -1, -S], [HATCH.x1, 0, HATCH.z0]));
    add(makeBox([HATCH.x0, -1, HATCH.z1], [HATCH.x1, 0, S]));
    add(makeBox([-S - 1, 0, -S - 1], [S + 1, H, -S], { color: WALL }));
    add(makeBox([-S - 1, 0, S], [S + 1, H, S + 1], { color: WALL }));
    add(makeBox([-S - 1, 0, -S], [-S, H, S], { color: WALL }));
    add(makeBox([S, 0, -S], [S + 1, H, GZ0], { color: WALL }));     // east wall, split by the
    add(makeBox([S, 0, GZ1], [S + 1, H, S], { color: WALL }));      // parkour doorway

    // skirting, red light strip and top trim on every wall
    const walls = [
      { a: 0, fixed: -S, sign: 1 }, { a: 0, fixed: S, sign: -1 },
      { a: 2, fixed: -S, sign: 1 }, { a: 2, fixed: S, sign: -1 },
    ];
    for (const w of walls) {
      const east = w.a === 2 && w.fixed === S;
      const band = (y0, y1, depth, o) => {
        for (const [a0, a1] of east ? [[-S, GZ0], [GZ1, S]] : [[-S, S]]) {
          const min = [0, y0, 0], max = [0, y1, 0];
          const across = w.a === 0 ? 2 : 0;
          min[w.a] = a0; max[w.a] = a1;
          const inner = w.fixed;
          min[across] = Math.min(inner, inner + w.sign * depth);
          max[across] = Math.max(inner, inner + w.sign * depth);
          deco(min, max, o);
        }
      };
      band(0, 0.45, 0.12, { color: CHAR, solid: true });
      band(3.4, 3.5, 0.06, { color: RED, emissive: 0.9, solid: false, noShadow: true });
      band(H - 0.35, H, 0.25, { color: CHAR });
      // pilasters every 8m
      for (let t = -S + 4; t <= S - 4; t += 8) {
        if (w.a === 0 && w.fixed === S && Math.abs(t) < 30) continue; // keep the weapon wall clear
        if (east && t > GZ0 - 0.5 && t < GZ1 + 0.5) continue;           // keep the doorway clear
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
    deco([-29.5, 0, 28.6], [29.5, 0.02, 31.8], { color: [0.3, 0.31, 0.34], edges: false });
    deco([-29.5, 0, 28.45], [29.5, 0.03, 28.6], { color: RED, emissive: 0.7, edges: false });
    // spawn pad
    deco([-1.5, 0, 24.5], [1.5, 0.02, 27.5], { color: LANE, edges: true });

    buildParkour(add, deco, H);
    this.deckRefs = buildDeck(add, deco);
    this.showroomRefs = buildShowroom(add);
  },

  // weapon cases along the south wall (the slot number is shown above each)
  cases: { z: 31.15, xs: [-27.6, -23, -18.4, -13.8, -9.2, -4.6, 4.6, 9.2, 13.8, 18.4, 23] },
  bench: { pos: [0, 0, 30.6] },            // gunsmith workbench (front edge), in the middle of the weapon stands

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

  // combat deck up the elevator (geometry in buildDeck below)
  elevator: { x: -28.5, z: -3, w: 3, d: 3, top: 0, bottom: DECK_Y },
  deck: {
    y: DECK_Y,
    area: { min: [-83, DECK_Y - 2, -29], max: [-26, CEIL_Y, 23] },
    respawn: { pos: [-39, DECK_Y, -3], yaw: HALF_PI },
    console: [-39.5, DECK_Y, -7.2],          // button pedestal (centre, floor)
    bounds: { min: [-81.3, -27.3], max: [-38.5, 21.3] },
    pods: [-17, -3, 11],                      // z of each spawn pod / gate
    podX: -78,
    gateX: -74,
    cam: {                                    // cutscene camera shots
      wide: { from: [-39, DECK_Y + 11.5, 16], to: [-50, DECK_Y + 9.5, 10], look: [-76, DECK_Y + 1, -3] },
      pods: { from: [-69.5, DECK_Y + 12.2, 5], to: [-71, DECK_Y + 11.6, -2], look: [-78.2, DECK_Y + 0.2, -3.2] },   // high, looking down into the open pods
    },
  },

  // main-menu showroom, deep underground and far away (lit by its own ceiling lamp)
  showroom: { spot: [300, -40, 332], cam: { eye: [300.25, -38.6, 327.3], look: [301.15, -38.95, 332] } },

  // parkour time trial (geometry is in buildParkour below)
  course: {
    area: { min: [31, -5, AZ0], max: [AX1, 60, AZ1] },
    start: { pos: [34, 0, -24], yaw: -HALF_PI },
    startGate: { min: [36, -1, -30], max: [37, 8, -18] },
    finishGate: { min: [35, -1, -17], max: [36.4, 8, -5] },
    checkpoints: [
      { min: [50.6, -1, -30], max: [52.2, 8, -18], respawn: { pos: [51.2, 0, -24], yaw: -HALF_PI } },   // after the vaults
      { min: [64.6, -1, -30], max: [67, 8, -18], respawn: { pos: [65.8, 0, -27], yaw: -HALF_PI } },     // after the wall run
      { min: [67, 5.2, -24], max: [73, 9, -12], respawn: { pos: [70.5, 5.41, -14.5], yaw: HALF_PI } },  // top of the climb
      { min: [46, -1, -17], max: [50, 8, -5], respawn: { pos: [48, 0, -11], yaw: HALF_PI } },           // after the stones
    ],
    hazards: [
      { min: [55.5, -1, -30], max: [64.5, 1, -18] },
      { min: [50.4, -1, -17], max: [68, 1, -5] },
      { min: [37.5, -1, -17], max: [46, 1, -5] },
    ],
  },

  walls: [
    { origin: [-12, 0, 8], cols: 12, rows: 6, axis: 0 },
    { origin: [18, 0, 18], cols: 10, rows: 6, axis: 2 },
  ],
};

// ---------------------------------------------------------------- parkour annex
// Outbound lane (south, heading east): vault hurdles → slide beam → wall run over the hazard →
// mantle → ledge grab. Return lane (north, heading west): stepping stones → wall run → finish.
function buildParkour(add, deco, H) {
  const S = 32;
  const box = (min, max, o = {}) => add(makeBox(min, max, o));
  // floor + walls
  box([S, -1, AZ0], [AX1, 0, AZ1]);
  box([S, 0, AZ0 - 1], [AX1 + 1, H, AZ0], { color: WALL });
  box([S, 0, AZ1], [AX1 + 1, H, AZ1 + 1], { color: WALL });
  box([AX1, 0, AZ0], [AX1 + 1, H, AZ1], { color: WALL });
  // trim: skirting + red light strip on the inner faces
  for (const [y0, y1, d, o] of [[0, 0.45, 0.12, { color: CHAR, solid: true }], [3.4, 3.5, 0.06, { color: RED, emissive: 0.9, solid: false, noShadow: true }]]) {
    deco([S + 1, y0, AZ0], [AX1, y1, AZ0 + d], o);
    deco([S + 1, y0, AZ1 - d], [AX1, y1, AZ1], o);
    deco([AX1 - d, y0, AZ0], [AX1, y1, AZ1], o);
  }
  // floodlights over the course
  for (const x of [44, 60]) for (const z of [AZ0 + 1.5, AZ1 - 1.5]) {
    add(boxAt(x, 0, z, 1, 12, 1, { color: CHAR, grid: false }));
    add(boxAt(x, 12, z, 2.4, 1.2, 2.4, { color: CHAR, grid: false }));
    add(boxAt(x, 11.85, z, 2, 0.15, 2, { color: [1, 1, 0.96], grid: false, emissive: 1, solid: false, noShadow: true }));
  }

  // lane divider (tall so you can't walk along its top)
  box([37, 0, -18], [68, 8, -17], { color: ACCENT });
  deco([37, 4.4, -18.06], [68, 4.5, -17.94], { color: RED, emissive: 0.8, solid: false, noShadow: true });

  const gate = (x, z0, z1, col) => {
    add(boxAt(x, 0, z0 + 0.4, 0.4, 4.4, 0.4, { color: CHAR, grid: false }));
    add(boxAt(x, 0, z1 - 0.4, 0.4, 4.4, 0.4, { color: CHAR, grid: false }));
    box([x - 0.2, 4.4, z0], [x + 0.2, 4.8, z1], { color: col, emissive: 1, grid: false, noShadow: true });
    deco([x - 0.2, 0, z0], [x + 0.2, 0.03, z1], { color: col, emissive: 0.9, edges: false, solid: false });
  };
  gate(36.2, -30, -18, RED);                // start
  gate(36.2, -17, -5, [1, 1, 0.97]);        // finish
  // checkered finish strip
  for (let i = 0; i < 12; i++) deco([35.4, 0, -17 + i], [35.8, 0.035, -16.5 + i], { color: CHAR, edges: false, solid: false });

  const cpLine = (x0, x1, z0, z1) => deco([x0, 0, z0], [x1, 0.03, z1], { color: [1, 1, 0.97], emissive: 0.8, edges: false, solid: false });

  // 1) vault hurdles
  [[40, 0.9], [44.5, 1.05], [49, 1.25]].forEach(([x, h]) => add(boxAt(x, 0, -24, 0.4, h, 12, { color: WALL })));
  cpLine(51.2, 51.5, -30, -18);
  // 2) slide beam (1.2 m clearance — slide or crouch under it)
  box([52.6, 1.2, -30], [54, 4.6, -18], { color: CHAR, grid: false });
  deco([52.6, 1.17, -30], [54, 1.2, -18], { color: RED, emissive: 0.8, solid: false, noShadow: true });
  // 3) hazard floor — wall run along the divider (or the outer wall) to cross it
  deco([55.5, 0, -30], [64.5, 0.025, -18], { color: HAZ, emissive: 0.55, edges: false, solid: false });
  for (let x = 56; x < 64.5; x += 1.5) deco([x, 0, -30], [x + 0.5, 0.03, -18], { color: [0.7, 0.08, 0.06], edges: false, solid: false });
  cpLine(65.6, 65.9, -24, -18);
  // 4) climb: mantle onto A, ledge-grab up to B
  box([67, 0, -30], [73, 1.8, -24]);
  box([67, 0, -24], [73, 5.4, -12]);      // too tall to mantle from A: jump, catch the edge, pull up
  deco([67, 5.4, -24], [73, 5.43, -23.7], { color: RED, emissive: 0.8, edges: false, solid: false });

  // 5) stepping stones over the return hazard
  deco([50.4, 0, -17], [68, 0.025, -5], { color: HAZ, emissive: 0.55, edges: false, solid: false });
  [[64.2, -11.8, 3.3], [60, -9.8, 2.5], [55.8, -11.8, 1.7], [51.6, -9.8, 1.0]].forEach(([x, z, h], i) =>
    add(boxAt(x, 0, z, 2.4, h, 2.4, { color: i % 2 ? ACCENT : WALL })));
  cpLine(48, 48.3, -17, -5);
  // 6) final wall run over the last hazard, then through the finish gate
  deco([37.5, 0, -17], [46, 0.025, -5], { color: HAZ, emissive: 0.55, edges: false, solid: false });
  box([37, 0, -11.2], [46.5, 4.2, -10.8], { color: ACCENT });
}

// ---------------------------------------------------------------- combat deck
// An arena 12 m up, west of the main range, reached by the elevator + bridge.
// East end: player base + console. Middle: wall-run walls, platform, grapple tower, cover.
// West end: the bot bay — three open-top spawn pods with doors, laid out like a firing range.
function buildDeck(add, deco) {
  const Y = DECK_Y;
  const box = (min, max, o = {}) => add(makeBox(min, max, o));
  const STEEL = [0.34, 0.35, 0.38];
  const CONC = [0.62, 0.62, 0.64];
  // floor slab and ceiling (this whole arena is underground, below the range)
  box([-83, Y - 1, -29], [-35, Y, 23]);
  box([-83, CEIL_Y, -29], [-35, CEIL_Y + 0.9, 23], { color: CONC, grid: false });
  // ceiling lamps: their light pools are done in the shader (one every 8 m)
  for (const x of [-76, -68, -60, -52, -44]) for (const z of [-20, -12, -4, 4, 12, 20]) {
    box([x - 1.7, CEIL_Y - 0.18, z - 0.4], [x + 1.7, CEIL_Y, z + 0.4], { color: [0.2, 0.21, 0.23], grid: false, solid: false });
    box([x - 1.5, CEIL_Y - 0.2, z - 0.25], [x + 1.5, CEIL_Y - 0.18, z + 0.25], { color: [1, 0.95, 0.85], emissive: 1, grid: false, solid: false, noShadow: true });
  }
  // ceiling beams
  for (const x of [-72, -56, -40]) box([x - 0.4, CEIL_Y - 0.7, -28], [x + 0.4, CEIL_Y, 22], { color: CHAR, grid: false, solid: false });
  // perimeter walls up to the ceiling (good for wall running), with a gap in the east wall for the tunnel
  const wallH = CEIL_Y - Y;
  box([-83, Y, -29], [-35, Y + wallH, -28], { color: WALL });
  box([-83, Y, 22], [-35, Y + wallH, 23], { color: WALL });
  box([-83, Y, -28], [-82, Y + wallH, 22], { color: WALL });
  box([-37, Y, -28], [-36, Y + wallH, -4.5], { color: WALL });
  box([-37, Y, -1.5], [-36, Y + wallH, 22], { color: WALL });
  box([-37, Y + 4, -4.5], [-36, Y + wallH, -1.5], { color: WALL });   // header over the entrance
  for (const [y0, y1, o] of [[0, 0.4, { color: CHAR, solid: true }], [3.4, 3.5, { color: RED, emissive: 0.9, noShadow: true }], [wallH - 0.3, wallH, { color: CHAR }]]) {
    deco([-82, Y + y0, -28], [-37, Y + y1, -27.88], o);
    deco([-82, Y + y0, 21.88], [-37, Y + y1, 22], o);
    deco([-82, Y + y0, -28], [-81.88, Y + y1, 22], o);
  }
  // access tunnel from the bottom of the elevator shaft into the arena
  box([-37, Y - 0.4, -4.5], [-30.4, Y, -1.5], { color: STEEL, grid: false });
  box([-37, Y, -5], [-30.4, Y + 4.4, -4.5], { color: CONC });
  box([-37, Y, -1.5], [-30.4, Y + 4.4, -1]);
  box([-37, Y + 4, -5], [-30.4, Y + 4.4, -1], { color: CONC });
  deco([-37, Y + 3.9, -3.2], [-30.4, Y + 3.98, -2.8], { color: [1, 0.95, 0.85], emissive: 1, noShadow: true });
  for (const z of [-4.5, -1.62]) deco([-37, Y + 0.02, z], [-30.4, Y + 0.05, z + 0.12], { color: [0.95, 0.75, 0.1], emissive: 0.4, edges: false });
  // the shaft itself, from the arena up to the underside of the range floor
  const SH = { x0: -30.4, x1: -26.6, z0: -4.9, z1: -1.1 };
  box([SH.x0, Y, SH.z0], [SH.x1, -1, SH.z0 + 0.3], { color: CONC });
  box([SH.x0, Y, SH.z1 - 0.3], [SH.x1, -1, SH.z1], { color: CONC });
  box([SH.x1 - 0.3, Y, SH.z0], [SH.x1, -1, SH.z1], { color: CONC });
  box([SH.x0, Y + 4.4, SH.z0], [SH.x0 + 0.1, -1, SH.z1], { color: CONC });
  box([SH.x0, Y - 1, SH.z0], [SH.x1, Y - 0.2, SH.z1], { color: CHAR, grid: false });   // pit floor
  for (let y = Y + 2; y < -2; y += 3) deco([SH.x1 - 0.32, y, -3.2], [SH.x1 - 0.3, y + 0.15, -2.8], { color: [1, 0.6, 0.15], emissive: 1, noShadow: true });

  // ---- player base: entry pad, console, low cover
  deco([-44, Y, -10], [-37, Y + 0.02, 4], { color: [0.3, 0.31, 0.34], edges: false });
  deco([-44.2, Y, -10], [-44, Y + 0.03, 4], { color: RED, emissive: 0.7, edges: false });
  const cx = -39.5, cz = -7.2;
  add(boxAt(cx, Y, cz, 0.9, 1.0, 0.7, { color: CHAR, grid: false }));                // pedestal
  add(boxAt(cx, Y + 1.0, cz, 1.1, 0.06, 0.85, { color: STEEL, grid: false }));         // top plate
  const buttonRing = add(boxAt(cx, Y + 1.06, cz, 0.42, 0.04, 0.42, { color: [0.12, 0.12, 0.13], grid: false, solid: false }));
  const button = add(boxAt(cx, Y + 1.1, cz, 0.3, 0.08, 0.3, { color: RED, emissive: 0.8, grid: false, solid: false }));
  // screen above the console
  add(boxAt(cx, Y + 1.5, cz - 0.9, 2.4, 1.5, 0.12, { color: [0.08, 0.09, 0.11], grid: false }));
  const screen = add(boxAt(cx, Y + 1.6, cz - 0.83, 2.1, 1.25, 0.02, { color: [0.15, 0.4, 0.9], grid: false, emissive: 0.35, solid: false, noShadow: true }));
  add(boxAt(cx - 1.05, Y, cz - 0.9, 0.12, 1.5, 0.12, { color: CHAR, grid: false }));
  add(boxAt(cx + 1.05, Y, cz - 0.9, 0.12, 1.5, 0.12, { color: CHAR, grid: false }));
  add(boxAt(-46, Y, -12, 0.5, 1.1, 6, { color: ACCENT }));
  add(boxAt(-46, Y, 6, 0.5, 1.1, 6, { color: ACCENT }));

  // ---- the field
  add(boxAt(-57, Y, -16, 18, 5, 0.5, { color: WALL }));     // wall-run walls
  add(boxAt(-57, Y, 10, 18, 5, 0.5, { color: WALL }));
  for (const z of [-16, 10]) deco([-66, Y + 2.4, z - 0.3], [-48, Y + 2.5, z + 0.3], { color: RED, emissive: 0.8, noShadow: true });
  add(boxAt(-58, Y, -3, 6, 3, 6));                          // central platform
  add(boxAt(-54.25, Y, -3, 1.5, 1.5, 2.5, { color: ACCENT }));   // step up to it
  add(boxAt(-61.75, Y, -3, 1.5, 1.5, 2.5, { color: ACCENT }));
  add(boxAt(-66, Y, -3, 2.4, 9, 2.4, { color: CHAR, grid: false }));    // grapple tower
  add(boxAt(-66, Y + 9, -3, 4, 0.4, 4, { color: STEEL, grid: false }));
  deco([-68, Y + 9.4, -5], [-64, Y + 9.43, -4.85], { color: RED, emissive: 0.8, noShadow: true });
  // cover: vaultable, mantle height, ledge-grab height, pillars
  add(boxAt(-50, Y, -22, 3, 1.2, 1, { color: ACCENT }));
  add(boxAt(-52, Y, 17, 1, 1.9, 3));
  add(boxAt(-62, Y, -22, 2, 2.6, 2, { color: WALL }));
  add(boxAt(-63, Y, 16, 4, 1.0, 1, { color: ACCENT }));
  add(boxAt(-70, Y, -10, 1, 2, 4));
  add(boxAt(-70, Y, 5, 1, 2, 4));
  add(boxAt(-49, Y, -8, 1.2, 2.2, 1.2, { color: CHAR, grid: false }));
  add(boxAt(-49, Y, 3, 1.2, 2.2, 1.2, { color: CHAR, grid: false }));
  add(boxAt(-56, Y, -24.5, 1.2, 1.4, 4, { color: ACCENT }));
  add(boxAt(-56, Y, 18.5, 1.2, 1.4, 4, { color: ACCENT }));

  // ---- bot bay: lane floor + firing-line strip, pods with doors
  deco([-82, Y, -28], [-72, Y + 0.02, 22], { color: LANE, grid: true, edges: false });
  deco([-72.2, Y, -28], [-72, Y + 0.03, 22], { color: RED, emissive: 0.75, edges: false });
  const doors = [], alarms = [], beams = [];
  for (const z of [-17, -3, 11]) {
    box([-81.5, Y, z - 2.6], [-74, Y + 4.2, z - 2.2], { color: CHAR, grid: false });   // pod side walls
    box([-81.5, Y, z + 2.2], [-74, Y + 4.2, z + 2.6], { color: CHAR, grid: false });
    deco([-81.5, Y + 4.2, z - 2.6], [-74, Y + 4.3, z - 2.2], { color: RED, emissive: 0.8, noShadow: true });
    deco([-81.5, Y + 4.2, z + 2.2], [-74, Y + 4.3, z + 2.6], { color: RED, emissive: 0.8, noShadow: true });
    deco([-81.5, Y, z - 2.2], [-74, Y + 0.025, z + 2.2], { color: [0.25, 0.26, 0.3], edges: false });  // pod floor
    add(boxAt(-73.8, Y + 4.2, z, 0.5, 0.5, 5.2, { color: CHAR, grid: false }));         // gate beam
    const door = box([-74, Y, z - 2.2], [-73.6, Y + 4.2, z + 2.2], { color: [0.55, 0.57, 0.6], grid: false });
    door.closedY = Y;
    doors.push(door);
    const alarm = add(boxAt(-73.8, Y + 4.7, z, 0.4, 0.25, 0.8, { color: [0.4, 0.06, 0.05], emissive: 0.3, grid: false, solid: false, noShadow: true }));
    alarms.push(alarm);
    beams.push(z);
  }
  // bay back wall lights
  for (let z = -26; z <= 20; z += 4) deco([-81.88, Y + 1, z], [-81.8, Y + 4.5, z + 0.25], { color: [1, 0.96, 0.9], emissive: 1, noShadow: true });
  return { doors, alarms, button, buttonRing, screen };
}

// ---------------------------------------------------------------- main menu showroom
function buildShowroom(add) {
  const box = (min, max, o = {}) => add(makeBox(min, max, { grid: false, ...o }));
  const Y = -40, X = 300, Z = 332;
  const BLK = [0.06, 0.06, 0.07];
  box([X - 14, Y - 1, Z - 12], [X + 14, Y, Z + 8], { color: [0.09, 0.09, 0.1] });                   // floor
  box([X - 14, Y, Z + 5.5], [X + 14, Y + 9, Z + 6], { color: BLK });                                 // back wall
  box([X - 14, Y + 8, Z - 12], [X + 14, Y + 9, Z + 6], { color: BLK });                              // ceiling
  for (const sx of [-1, 1]) box([X + sx * 9 - 0.5, Y, Z - 12], [X + sx * 9 + 0.5, Y + 9, Z + 6], { color: BLK });   // side walls
  // turntable the character stands on
  box([X - 1.3, Y, Z - 1.3], [X + 1.3, Y + 0.12, Z + 1.3], { color: [0.14, 0.14, 0.16] });
  box([X - 1.1, Y + 0.12, Z - 1.1], [X + 1.1, Y + 0.14, Z + 1.1], { color: [0.2, 0.2, 0.22], solid: false });
  const ring = [];
  for (const [a, b, c, d] of [[-1.32, -1.3, -1.32, 1.32], [1.3, 1.32, -1.32, 1.32], [-1.32, 1.32, -1.32, -1.3], [-1.32, 1.32, 1.3, 1.32]]) {
    ring.push(box([X + a, Y + 0.02, Z + c], [X + b, Y + 0.1, Z + d], { color: [0.92, 0.1, 0.08], emissive: 1, solid: false, noShadow: true }));
  }
  // light panels on the back wall (class colour), bars on the side walls
  const panels = [];
  for (let i = -4; i <= 4; i++) {
    const x0 = X + i * 1.6 - 0.6;
    panels.push(box([x0, Y + 0.6, Z + 5.4], [x0 + 1.2, Y + 7.2, Z + 5.5], { color: [0.92, 0.1, 0.08], emissive: i % 2 ? 0.45 : 0.85, solid: false, noShadow: true }));
  }
  const bars = [];
  for (const sx of [-1, 1]) for (let y = 0.8; y < 7.5; y += 1.1) {
    bars.push(box([X + sx * 8.48 - 0.02, Y + y, Z - 6], [X + sx * 8.5, Y + y + 0.08, Z + 5], { color: [0.92, 0.1, 0.08], emissive: 1, solid: false, noShadow: true }));
  }
  // floor strips leading to the turntable
  for (const sx of [-1, 1]) ring.push(box([X + sx * 2.4 - 0.05, Y, Z - 10], [X + sx * 2.4 + 0.05, Y + 0.012, Z + 5], { color: [0.92, 0.1, 0.08], emissive: 0.8, solid: false, noShadow: true }));
  return { panels, bars, ring };
}
