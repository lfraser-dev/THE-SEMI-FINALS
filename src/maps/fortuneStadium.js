// "Fortune Stadium": the semi-finals arena.
// Six floating sectors hang over the void inside a stadium bowl, joined by bridges and launch pads.
// Front row (nearest spawn), left to right: 1 court building, 2 electric building, 3 the tower.
// Back row: 6 maze building, 5 the vault (cashout), 4 the giant atrium building.
// The whole stadium sits far from the test range and high up, so the two never see each other.
import { makeBox } from '../world.js';
import { digitBoxes } from '../props.js';

// stadium origin: x/z are offset from here, and y = 0 is the top of the sector floors
const OX = 0, OZ = -700, Y0 = 60;

const WALL = [0.91, 0.91, 0.93];
const ACCENT = [0.86, 0.87, 0.9];
const CHAR = [0.27, 0.28, 0.31];
const STEEL = [0.36, 0.37, 0.4];
const ROCK = [0.5, 0.51, 0.55];
const GLASS = [0.16, 0.22, 0.3];
const SEC = {
  1: [1, 0.36, 0.06],     // orange
  2: [1, 0.84, 0.1],      // electric yellow
  3: [0.1, 0.8, 0.78],    // teal
  4: [0.95, 0.22, 0.62],  // magenta
  5: [0.25, 0.5, 1],      // blue
  6: [0.62, 0.36, 1],     // purple
};

// launch pads: plate centre (local) and where they throw you (local); vy = launch speed upward
const PADS = [
  { at: [-7, 3, 67], to: [-34, 8, 39.5], vy: 21, col: SEC[1] },  // spawn → sector 1 rooftop
  { at: [7, 3, 67], to: [40, 0, 38.5], vy: 17, col: SEC[3] },     // spawn → the tower courtyard
  { at: [44, 0, 16.8], to: [47, 13, -3], vy: 26, col: SEC[4] },   // tower → sector 4 rooftop
  { at: [42, 0, -12], to: [42, 13, -21.5], vy: 27, col: SEC[4] }, // sector 4 atrium → roof
];

const L = (x, y, z) => [OX + x, Y0 + y, OZ + z];

export default {
  name: 'FORTUNE STADIUM',
  origin: [OX, Y0, OZ],
  spawn: { pos: L(0, 3, 72), yaw: 0 },              // facing into the arena, the tower on your right
  voidY: Y0 - 24,                                    // fall below this and you're out
  area: { min: [OX - 140, Y0 - 80, OZ - 140], max: [OX + 140, Y0 + 120, OZ + 180] },
  fog: 0.0062,
  pads: PADS.map((p) => ({ at: L(...p.at), to: L(...p.to), vy: p.vy })),
  lift: { x: OX + 39.4, z: OZ + 25, w: 3, d: 3, top: Y0 + 48, bottom: Y0 },
  dummies: [
    { pos: L(-45, 0, 27) }, { pos: L(-39, 4, 40) },
    { pos: L(5, 4, 35) }, { pos: L(-6, 0, 25) },
    { pos: L(31, 0, 30) }, { pos: L(47, 48, 22) },
    { pos: L(40, 6.5, -21) }, { pos: L(50, 0, -3) },
    { pos: L(8, 0, -21) }, { pos: L(0, 0, -24), move: { axis: 0, range: 5, speed: 3 } },
    { pos: L(-42.5, 0, -19) }, { pos: L(-33, 0, -5) },
  ],
  walls: [
    { origin: L(-54.98, 0, 27), cols: 12, rows: 6, axis: 2 },   // sector 1 west breach
    { origin: L(-10, 0, 17.02), cols: 8, rows: 6, axis: 0 },     // sector 2 back wall
    { origin: L(-54, 0, -0.38), cols: 8, rows: 6, axis: 0 },     // sector 6 south room
  ],

  build(world) {
    const add = (b) => world.add(b);
    // local-coordinate box; options as makeBox
    const box = (x0, y0, z0, x1, y1, z1, o = {}) =>
      add(makeBox([OX + Math.min(x0, x1), Y0 + Math.min(y0, y1), OZ + Math.min(z0, z1)],
        [OX + Math.max(x0, x1), Y0 + Math.max(y0, y1), OZ + Math.max(z0, z1)], o));
    const deco = (x0, y0, z0, x1, y1, z1, o = {}) => box(x0, y0, z0, x1, y1, z1, { grid: false, solid: false, noShadow: true, ...o });
    const glow = (x0, y0, z0, x1, y1, z1, col, e = 0.9, o = {}) => deco(x0, y0, z0, x1, y1, z1, { color: col, emissive: e, edges: false, ...o });
    const sign = (text, x, y, z, h, col) => digitBoxes(text, OX + x, Y0 + y, OZ + z, h, 1, col, 0.95).forEach(add);

    // A straight wall along one axis with openings. axis 'x' runs along x at z = c0..c1 (and vice versa).
    // openings: [centre, width, top, bottom = 0]; top >= h means a full-height gap.
    const wallLine = (axis, a0, a1, c0, c1, y0, h, openings = [], o = {}) => {
      const piece = (s0, s1, yb, yt) => {
        if (s1 - s0 < 0.01 || yt - yb < 0.01) return;
        if (axis === 'x') box(s0, y0 + yb, c0, s1, y0 + yt, c1, { color: WALL, ...o });
        else box(c0, y0 + yb, s0, c1, y0 + yt, s1, { color: WALL, ...o });
      };
      let cur = a0;
      for (const [c, w, top, bottom = 0] of [...openings].sort((p, q) => p[0] - q[0])) {
        piece(cur, c - w / 2, 0, h);
        if (bottom > 0) piece(c - w / 2, c + w / 2, 0, bottom);
        if (top < h) piece(c - w / 2, c + w / 2, top, h);
        cur = c + w / 2;
      }
      piece(cur, a1, 0, h);
    };
    // four walls round a footprint: n = the far (-z) side, s = the near (+z) side, w = -x, e = +x
    const walls = (x0, z0, x1, z1, y0, h, ops = {}, t = 0.4, o = {}) => {
      wallLine('x', x0, x1, z0, z0 + t, y0, h, ops.n, o);
      wallLine('x', x0, x1, z1 - t, z1, y0, h, ops.s, o);
      wallLine('z', z0 + t, z1 - t, x0, x0 + t, y0, h, ops.w, o);
      wallLine('z', z0 + t, z1 - t, x1 - t, x1, y0, h, ops.e, o);
    };
    // floor/roof slab with one rectangular hole [hx0, hz0, hx1, hz1]
    const slab = (x0, z0, x1, z1, y0, y1, hole, o = {}) => {
      if (!hole) return box(x0, y0, z0, x1, y1, z1, o);
      const [hx0, hz0, hx1, hz1] = hole;
      box(x0, y0, z0, x1, y1, hz0, o);
      box(x0, y0, hz1, x1, y1, z1, o);
      box(x0, y0, hz0, hx0, y1, hz1, o);
      box(hx1, y0, hz0, x1, y1, hz1, o);
    };
    // solid stairs, 0.5 m rise and 0.6 m run. Runs from (x, z) in direction dir ('+x', '-x', '+z', '-z').
    const stairs = (x, z, dir, width, y0, y1, o = { color: ACCENT }) => {
      const n = Math.round((y1 - y0) / 0.5), s = dir[0] === '+' ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const a = i * 0.6 * s, b = (i + 1) * 0.6 * s, top = y0 + (i + 1) * (y1 - y0) / n;
        if (dir[1] === 'x') box(x + a, y0, z - width / 2, x + b, top, z + width / 2, o);
        else box(x - width / 2, y0, z + a, x + width / 2, top, z + b, o);
      }
    };
    const crate = (x, z, s = 1.2, y = 0, col = [0.62, 0.5, 0.34]) => box(x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2, { color: col, grid: false });
    const barrier = (x, z, alongX, len = 3, h = 1.1) => alongX
      ? box(x - len / 2, 0, z - 0.3, x + len / 2, h, z + 0.3, { color: ACCENT })
      : box(x - 0.3, 0, z - len / 2, x + 0.3, h, z + len / 2, { color: ACCENT });

    // ---------------- a floating sector: floor slab, glowing rim, rocky underside, number sign
    const island = (n, x0, z0, x1, z1) => {
      const col = SEC[n], cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      box(x0, -2, z0, x1, 0, z1);
      glow(x0 - 0.05, -0.7, z0 - 0.05, x1 + 0.05, -0.35, z1 + 0.05, col, 0.85);
      // edge warning strips on the floor
      for (const [a, b, c, d] of [[x0, z0, x1, z0 + 0.35], [x0, z1 - 0.35, x1, z1], [x0, z0, x0 + 0.35, z1], [x1 - 0.35, z0, x1, z1]]) {
        deco(a, 0, b, c, 0.02, d, { color: col, emissive: 0.35, edges: false });
      }
      box(x0 + 2, -6, z0 + 2, x1 - 2, -2, z1 - 2, { color: ROCK, grid: false });
      box(x0 + 5, -11, z0 + 5, x1 - 5, -6, z1 - 5, { color: ROCK, grid: false });
      box(cx - 6, -15, cz - 6, cx + 6, -11, cz + 6, { color: CHAR, grid: false });
      glow(cx - 3, -15.25, cz - 3, cx + 3, -15, cz + 3, col, 1);
      // the sector number on a post at the front-left corner, facing the spawn
      box(x0 + 1.2, 0, z1 - 1.4, x0 + 1.4, 4.4, z1 - 1.2, { color: CHAR, grid: false });
      box(x0 + 1.0, 4.4, z1 - 1.45, x0 + 3.4, 7.6, z1 - 1.15, { color: CHAR, grid: false });
      sign(String(n), x0 + 1.55, 4.75, z1 - 1.1, 2.5, col);
    };
    const bridge = (x0, z0, x1, z1, col) => {
      box(x0, -0.4, z0, x1, 0, z1, { color: CHAR, grid: false });
      const alongX = x1 - x0 > z1 - z0;
      if (alongX) {
        box(x0, 0, z0, x1, 0.3, z0 + 0.15, { color: STEEL, grid: false });
        box(x0, 0, z1 - 0.15, x1, 0.3, z1, { color: STEEL, grid: false });
        glow(x0, 0, (z0 + z1) / 2 - 0.08, x1, 0.02, (z0 + z1) / 2 + 0.08, col, 0.8);
      } else {
        box(x0, 0, z0, x0 + 0.15, 0.3, z1, { color: STEEL, grid: false });
        box(x1 - 0.15, 0, z0, x1, 0.3, z1, { color: STEEL, grid: false });
        glow((x0 + x1) / 2 - 0.08, 0, z0, (x0 + x1) / 2 + 0.08, 0.02, z1, col, 0.8);
      }
      glow(x0, -0.55, z0, x1, -0.4, z1, col, 0.6);
    };
    const pad = ({ at: [x, y, z], col }) => {
      box(x - 1.2, y, z - 1.2, x + 1.2, y + 0.25, z + 1.2, { color: CHAR, grid: false });
      glow(x - 0.9, y + 0.25, z - 0.9, x + 0.9, y + 0.27, z + 0.9, col, 1);
      glow(x - 1.25, y + 0.05, z - 1.25, x + 1.25, y + 0.15, z + 1.25, col, 0.7);
      deco(x - 0.12, y + 0.27, z - 0.12, x + 0.12, y + 3.5, z + 0.12, { color: col, emissive: 1, alpha: 0.35, noBullet: true });
    };

    // ================================================================ the islands
    island(1, -57, 15, -27, 45);
    island(2, -15, 15, 15, 45);
    island(3, 27, 15, 57, 45);
    island(6, -57, -27, -27, 3);
    island(5, -15, -27, 15, 3);
    island(4, 27, -27, 57, 3);

    bridge(-27, 28.5, -15, 31.5, SEC[1]);   // 1 ↔ 2
    bridge(15, 28.5, 27, 31.5, SEC[3]);     // 2 ↔ 3
    bridge(-1.5, 3, 1.5, 15, SEC[5]);       // 2 ↔ 5
    bridge(-27, -13.5, -15, -10.5, SEC[6]); // 5 ↔ 6
    bridge(15, -13.5, 27, -10.5, SEC[4]);   // 5 ↔ 4
    bridge(-44, 3, -41, 15, SEC[6]);        // 1 ↔ 6
    PADS.forEach(pad);

    // ================================================================ spawn platform
    box(-10, 1, 64, 10, 3, 77);
    box(-8, -4, 66, 8, 1, 75, { color: ROCK, grid: false });
    glow(-10.05, 2.2, 63.95, 10.05, 2.5, 77.05, [1, 0.2, 0.15], 0.9);
    for (const sx of [-1, 1]) box(sx * 10 - (sx > 0 ? 0.3 : 0), 3, 64, sx * 10 + (sx < 0 ? 0.3 : 0), 4.1, 77, { color: ACCENT });
    box(-10, 3, 76.7, 10, 4.1, 77, { color: ACCENT });
    deco(-1.5, 3, 70.5, 1.5, 3.02, 73.5, { color: [0.82, 0.83, 0.86], edges: true });
    // stairs down to the bridge, then the bridge to sector 2
    for (let i = 0; i < 6; i++) box(-1.8, 0, 63.4 - i * 0.9, 1.8, 3 - i * 0.5, 64.3 - i * 0.9, { color: ACCENT });
    bridge(-1.8, 45, 1.8, 58.9, [1, 0.2, 0.15]);
    // spawn gate behind you: a big arch with a red light bar
    box(-9, 3, 75.5, -8, 12, 76.5, { color: CHAR, grid: false });
    box(8, 3, 75.5, 9, 12, 76.5, { color: CHAR, grid: false });
    box(-9, 12, 75.5, 9, 13.5, 76.5, { color: CHAR, grid: false });
    glow(-8, 11.6, 75.4, 8, 12, 75.5, [1, 0.2, 0.15], 1);

    // ================================================================ sector 1: the court building
    {
      const c = SEC[1];
      walls(-55, 17, -29, 43, 0, 8, {
        s: [[-42, 3, 3], [-50, 2.5, 6.8, 5], [-34, 2.5, 6.8, 5]],
        n: [[-42, 3, 3], [-50, 2.5, 6.8, 5], [-34, 2.5, 6.8, 5]],
        e: [[30, 3, 3], [22, 2.5, 6.8, 5], [38, 2.5, 6.8, 5]],
        w: [[30, 6, 3], [22, 2.5, 6.8, 5], [38, 2.5, 6.8, 5]],     // the middle gap is a destructible wall
      });
      // inner courtyard walls with doors on every side
      walls(-48, 24, -36, 36, 0, 8, {
        n: [[-42, 2.4, 3], [-45, 2, 6.8, 5], [-39, 2, 6.8, 5]], s: [[-42, 2.4, 3], [-45, 2, 6.8, 5], [-39, 2, 6.8, 5]],
        w: [[30, 2.4, 3]], e: [[30, 2.4, 3]],
      });
      // upper floor (a ring round the court) with a stair hole in the south wing
      const F = { color: WALL };
      box(-54.6, 3.7, 17.4, -29.4, 4, 24, F);
      box(-54.6, 3.7, 24, -48, 4, 36, F);
      box(-36, 3.7, 24, -29.4, 4, 36, F);
      box(-54.6, 3.7, 36, -52.6, 4, 42.6, F);
      box(-52.6, 3.7, 36, -47.2, 4, 39.2, F);
      box(-47.2, 3.7, 36, -29.4, 4, 42.6, F);
      stairs(-52, 40.9, '+x', 3, 0, 4);
      // roof, with the court open to the sky and a stair hole in the north wing
      box(-55, 7.7, 17, -36.8, 8, 24);
      box(-36.8, 7.7, 21.2, -31.6, 8, 24);
      box(-31.6, 7.7, 17, -29, 8, 24);
      box(-55, 7.7, 36, -29, 8, 43);
      box(-55, 7.7, 24, -48, 8, 36);
      box(-36, 7.7, 24, -29, 8, 36);
      stairs(-32, 19.3, '-x', 3, 4, 8);
      glow(-55.05, 7.75, 16.95, -28.95, 7.95, 43.05, c, 0.85);
      // high rooftops: mantle up to the raised block in the north-west corner
      box(-55, 8, 17, -47, 12, 25, { color: ACCENT });
      box(-49.5, 8, 25, -46, 10, 28);
      box(-53, 12, 19, -51, 14.5, 21, { color: STEEL, grid: false, shape: 'cyl' });   // water tank
      // the court: orange floor, white lines, two hoops
      deco(-47.6, 0, 24.4, -36.4, 0.02, 35.6, { color: [0.78, 0.3, 0.1], edges: false });
      deco(-47.6, 0, 29.92, -36.4, 0.03, 30.08, { color: [1, 1, 1], edges: false });
      deco(-43.5, 0, 28.5, -40.5, 0.03, 31.5, { color: [0.95, 0.95, 0.95], edges: false, alpha: 0.35 });
      for (const [z, s] of [[24.9, 1], [35.1, -1]]) {
        box(-42.1, 0, z - 0.1, -41.9, 3.3, z + 0.1, { color: CHAR, grid: false });
        box(-42.8, 2.9, z + s * 0.12, -41.2, 3.9, z + s * 0.2, { color: [0.95, 0.95, 0.97], grid: false });
        deco(-42.3, 3.05, z + s * 0.2, -41.7, 3.1, z + s * 0.75, { color: c, emissive: 0.5 });
      }
      crate(-51, 20); crate(-51, 21.3); crate(-50.4, 20.6, 1.2, 1.2);
      crate(-32, 40); barrier(-33, 32, false);
      barrier(-38, 20.5, true); barrier(-46, 39.5, true);
    }

    // ================================================================ sector 2: open deck + electric building
    {
      const c = SEC[2];
      // the electric building (back half)
      walls(-13, 17, 13, 30, 0, 9, {
        s: [[-6, 3, 3], [6, 3, 3], [0, 3, 7, 4]],
        n: [[-8, 4, 3], [5, 3, 3]],                       // -8 is a destructible wall
        w: [[23.5, 2.6, 3]], e: [[28, 2.6, 3]],
      });
      slab(-13, 17, 13, 30, 8.7, 9, null);
      glow(-13.05, 8.74, 16.95, 13.05, 8.96, 30.05, c, 1);
      for (const x of [-12.9, 12.9]) for (const z of [17.5, 29.5]) glow(x - 0.15, 0.4, z - 0.15, x + 0.15, 8.1, z + 0.15, c, 0.9);
      // mezzanine along the south wall at the upper door, with stairs from the ground
      box(-12.6, 3.7, 25, 12.6, 4, 29.6, { color: STEEL, grid: false });
      box(-12.6, 4, 25, 9.6, 5, 25.15, { color: CHAR, grid: false });
      stairs(11.1, 20.2, '+z', 2.8, 0, 4);
      // transformers and generators
      for (const x of [-9, -3]) {
        box(x - 1.4, 0, 19, x + 1.4, 3, 22, { color: CHAR, grid: false });
        for (const y of [0.6, 1.4, 2.2]) glow(x - 1.45, y, 18.95, x + 1.45, y + 0.25, 22.05, c, 0.8);
      }
      box(1, 0, 19, 4, 3.2, 22, { color: STEEL, grid: false, shape: 'cyl' });
      box(5, 0, 19.5, 7, 2.2, 21.5, { color: STEEL, grid: false, shape: 'cyl' });
      glow(-12.6, 6.6, 22.9, 12.6, 6.75, 23.1, c, 1);           // cable tray light
      // roof units you can mantle around
      box(-8, 9, 20, -4, 11, 24, { color: STEEL, grid: false });
      box(3, 9, 19, 9, 10.6, 22, { color: STEEL, grid: false });
      glow(3, 10.6, 20.2, 9, 10.7, 20.8, c, 1);

      // the open two-floor deck in front (pillars, stairs up both sides, low walls)
      box(-13, 3.7, 30, 13, 4, 40, { color: WALL });
      for (const x of [-12, -4, 4, 12]) box(x - 0.35, 0, 38.8, x + 0.35, 3.7, 39.5, { color: CHAR, grid: false });
      for (const x of [-12, 12]) box(x - 0.35, 0, 31, x + 0.35, 3.7, 31.7, { color: CHAR, grid: false });
      stairs(-10, 44.8, '-z', 2.6, 0, 4);
      stairs(10, 44.8, '-z', 2.6, 0, 4);
      box(-8.7, 4, 39.7, 8.7, 5, 40, { color: ACCENT });
      box(-13, 4, 30.5, -12.7, 5, 37.5, { color: ACCENT });
      box(12.7, 4, 30.5, 13, 5, 37.5, { color: ACCENT });
      glow(-13, 3.4, 39.95, 13, 3.6, 40.05, c, 0.9);
      // cover below and on the deck
      barrier(0, 34, true, 4); crate(-6, 36); crate(7, 33.5);
      box(-3, 4, 34, -1.5, 5.6, 35.5, { color: CHAR, grid: false });
      crate(6, 35.5, 1.2, 4);
      barrier(-6, 43, true, 2.5); barrier(6, 43, true, 2.5);
    }

    // ================================================================ sector 3: the tower (on the right from spawn)
    {
      const c = SEC[3], T = 48;
      // lobby
      walls(41, 19, 53, 31, 0, 4, { s: [[47, 3, 3]], n: [[47, 3, 3]], w: [[20.8, 2.4, 3]], e: [[25, 2.4, 3]] });
      box(41, 3.7, 19, 53, 4, 31);
      glow(46, 3.66, 22, 48, 3.7, 28, [1, 0.97, 0.9], 1);
      // the tower itself
      box(41, 4, 19, 53, T, 31, { color: WALL });
      for (let y = 6; y < T - 4; y += 4) deco(40.92, y, 18.92, 53.08, y + 1.6, 31.08, { color: GLASS, emissive: 0.12, edges: true });
      for (const [x, z] of [[41, 19], [53, 19], [41, 31], [53, 31]]) glow(x - 0.2, 4, z - 0.2, x + 0.2, T, z + 0.2, c, 0.85);
      glow(40.95, T - 4, 18.95, 53.05, T - 2.8, 31.05, c, 1);   // the crown
      // balconies on the spawn-facing side: grapple targets on the way up
      for (const y of [12, 24, 36]) {
        box(43, y - 0.3, 31, 51, y, 32.8, { color: STEEL, grid: false });
        box(43, y, 32.65, 51, y + 1.05, 32.8, { color: [0.7, 0.9, 0.95], alpha: 0.3, grid: false, noShadow: true });
        glow(43, y - 0.4, 32.7, 51, y - 0.3, 32.8, c, 0.9);
      }
      // rooftop: parapet (gap for the lift), helipad, antenna with a beacon
      walls(41, 19, 53, 31, T, 1.1, { w: [[25, 3.2, 1.2]] }, 0.3, { color: ACCENT });
      deco(44, T, 21, 50, T + 0.02, 29, { color: CHAR, edges: false });
      glow(45.2, T, 23, 45.8, T + 0.03, 27, [1, 1, 1], 0.6);
      glow(48.2, T, 23, 48.8, T + 0.03, 27, [1, 1, 1], 0.6);
      glow(45.8, T, 24.7, 48.2, T + 0.03, 25.3, [1, 1, 1], 0.6);
      box(51.2, T, 20.2, 52.2, T + 1.2, 21.2, { color: STEEL, grid: false });
      box(51.55, T + 1.2, 20.55, 51.85, T + 12, 20.85, { color: CHAR, grid: false });
      glow(51.4, T + 12, 20.4, 52, T + 12.6, 21, [1, 0.15, 0.1], 1);
      // lift shaft rails up the west face (the lift itself is built by main.js)
      for (const z of [23.35, 26.65]) box(37.7, 0, z - 0.1, 37.9, T, z + 0.1, { color: CHAR, grid: false, solid: false });
      for (const z of [23.1, 26.75]) glow(37.7, 0, z, 37.9, T, z + 0.15, c, 0.9);
      for (let y = 8; y < T; y += 8) box(37.7, y, 23.25, 37.9, y + 0.2, 26.75, { color: CHAR, grid: false, solid: false });

      // the courtyard beside the tower
      deco(28, 0, 16, 38.5, 0.02, 44, { color: [0.8, 0.82, 0.8], edges: false });
      box(29, 0, 17, 35, 3.6, 22, { color: ACCENT });                 // kiosk (mantle up)
      box(28.8, 3.6, 16.8, 35.2, 3.9, 22.2, { color: CHAR, grid: false });
      glow(29, 2.4, 22, 35, 2.7, 22.05, c, 0.9);
      for (const [x, z] of [[30, 27], [30, 33], [36, 33]]) {
        box(x - 1.2, 0, z - 1.2, x + 1.2, 0.8, z + 1.2, { color: ACCENT });
        box(x - 1, 0.8, z - 1, x + 1, 0.9, z + 1, { color: [0.3, 0.55, 0.32], grid: false, solid: false });
        box(x - 0.6, 0.9, z - 0.6, x + 0.6, 2.4, z + 0.6, { color: [0.28, 0.5, 0.3], grid: false, shape: 'sphere' });
      }
      box(31, 0, 38, 35, 0.6, 42, { color: ACCENT, shape: 'cyl' });   // fountain
      glow(31.6, 0.6, 38.6, 34.4, 0.62, 41.4, c, 0.5, { alpha: 0.7 });
      box(32.7, 0.6, 39.7, 33.3, 1.8, 40.3, { color: STEEL, grid: false, shape: 'cyl' });
      barrier(45, 38, true, 4); barrier(52, 41, false, 3); crate(55, 34); crate(55, 35.3);
      barrier(47, 43, true, 3);
    }

    // ================================================================ sector 4: the giant building with a launch pad in the atrium
    {
      const c = SEC[4], H = 13;
      walls(29, -25, 55, 1, 0, H, {
        n: [[42, 3, 3.5], [34, 3, 11, 8], [50, 3, 11, 8]],
        s: [[36, 3, 3.5], [48, 3, 3.5], [42, 3, 11, 8]],
        w: [[-12, 3, 3.5], [-20, 3, 11, 8], [-4, 3, 11, 8]],
        e: [[-12, 3, 11, 8]],
      });
      // the atrium: open to the sky, doors on the ground and the upper floor
      walls(37, -17, 47, -7, 0, H, {
        n: [[42, 3, 3.5], [42, 4, 9.5, 6.5]], s: [[42, 3, 3.5], [42, 4, 9.5, 6.5]],
        w: [[-12, 3, 3.5], [-12, 4, 9.5, 6.5]], e: [[-12, 3, 3.5], [-12, 4, 9.5, 6.5]],
      });
      // upper floor ring at 6.5 m, stairs up the east wing
      const F = { color: WALL };
      box(29.4, 6.2, -24.6, 54.6, 6.5, -17, F);
      box(29.4, 6.2, -7, 54.6, 6.5, 0.6, F);
      box(29.4, 6.2, -17, 37, 6.5, -7, F);
      box(47, 6.2, -17, 49.8, 6.5, -7, F);
      box(53.2, 6.2, -17, 54.6, 6.5, -7, F);
      box(49.8, 6.2, -17, 53.2, 6.5, -15.2, F);
      stairs(51.5, -7.4, '-z', 3.4, 0, 6.5);
      // roof with the atrium hole, parapet, glowing corner fins
      slab(29, -25, 55, 1, H - 0.3, H, [37, -17, 47, -7]);
      walls(29, -25, 55, 1, H, 1.1, {}, 0.3, { color: ACCENT });
      for (const [x, z] of [[29, -25], [55, -25], [29, 1], [55, 1]]) glow(x - 0.3, 0.5, z - 0.3, x + 0.3, H + 1.1, z + 0.3, c, 0.9);
      glow(36.95, H - 0.6, -17.05, 47.05, H - 0.35, -16.95, c, 1);         // a band round the atrium rim
      glow(36.95, H - 0.6, -7.05, 47.05, H - 0.35, -6.95, c, 1);
      glow(36.95, H - 0.6, -17, 37.05, H - 0.35, -7, c, 1);
      glow(46.95, H - 0.6, -17, 47.05, H - 0.35, -7, c, 1);
      // atrium floor marking round the pad, rooftop units
      deco(38, 0, -16, 46, 0.02, -8, { color: [0.3, 0.31, 0.34], edges: false });
      box(31, H, -23, 35, H + 2, -19, { color: STEEL, grid: false });
      box(49, H, -5, 53, H + 1.6, -1, { color: STEEL, grid: false });
      box(31, H, -4, 34, H + 1.2, -1, { color: STEEL, grid: false });
      // ground-floor cover and the open ground at the front
      crate(32, -21); crate(33.3, -21); crate(52, -21); barrier(42, -21, true, 4);
      barrier(33, -3, false, 3); crate(42, -3);
      barrier(42, 2.2, true, 6, 0.9);
    }

    // ================================================================ sector 5: the vault
    {
      const c = SEC[5];
      walls(-6, -18, 6, -6, 0, 5, { s: [[0, 2.6, 3]], n: [[0, 2.6, 3]] }, 1.0, { color: STEEL, grid: false });
      box(-6, 4.6, -18, 6, 5, -6, { color: CHAR, grid: false });
      // hazard frames on the vault doors
      for (const z of [-6, -18]) {
        for (let i = 0; i < 6; i++) {
          const col = i % 2 ? CHAR : [0.95, 0.72, 0.1];
          deco(-1.7, i * 0.55, z - 0.05, -1.3, (i + 1) * 0.55, z + 0.05, { color: col, edges: false });
          deco(1.3, i * 0.55, z - 0.05, 1.7, (i + 1) * 0.55, z + 0.05, { color: col, edges: false });
        }
        glow(-1.7, 3.3, z - 0.06, 1.7, 3.5, z + 0.06, c, 1);
      }
      glow(-6.05, 4.65, -18.05, 6.05, 4.9, -5.95, c, 1);
      // the cashout station inside, with its light beam out through the roof
      box(-1.2, 0, -13.2, 1.2, 1.1, -10.8, { color: CHAR, grid: false });
      glow(-0.9, 1.1, -12.9, 0.9, 1.16, -11.1, c, 1);
      glow(-0.6, 1.16, -12.6, 0.6, 30, -11.4, c, 1, { alpha: 0.28, noBullet: true });
      // open ground all round: cover to fight over
      for (const [x, z, ax] of [[-10, -20, false], [10, -20, false], [-10, -4, false], [10, -4, false], [0, -23, true], [0, -1.5, true]]) barrier(x, z, ax, 3.5);
      for (const [x, z] of [[-11, -12], [11, -12]]) box(x - 0.7, 0, z - 0.7, x + 0.7, 2.6, z + 0.7, { color: CHAR, grid: false });
      crate(-12, -24); crate(12.5, 0); crate(12.5, -1.3); crate(-12.5, -0.5, 1.2, 0, [0.5, 0.52, 0.56]);
      box(-14, 0, -16, -12.5, 1.6, -8, { color: ACCENT });
      box(12.5, 0, -16, 14, 1.6, -8, { color: ACCENT });
    }

    // ================================================================ sector 6: the maze building (tight corridors, many rooms)
    {
      const c = SEC[6], H = 4.6;
      walls(-55, -24, -30, 0, 0, H, {
        n: [[-42.5, 2.2, 2.6]], s: [[-42.5, 2.2, 2.6], [-52, 4, 3]],   // -52 is a destructible wall
        w: [[-12, 2.2, 2.6]], e: [[-12, 2.2, 2.6]],
      });
      box(-55, H, -24, -30, H + 0.4, 0, { color: WALL });
      walls(-55, -24, -30, 0, H + 0.4, 0.9, { e: [[-7, 3, 1]] }, 0.3, { color: ACCENT });
      glow(-55.05, H + 0.05, -24.05, -29.95, H + 0.3, 0.05, c, 0.9);
      const D = 2.6;                                               // door height inside
      // north-south corridor (x -43.6 … -41.4), crossing the east-west corridor (z -13.1 … -10.9)
      wallLine('z', -23.6, -0.4, -44, -43.6, 0, H, [[-12, 3, H], [-18.5, 1.2, D], [-5.5, 1.2, D]]);
      wallLine('z', -23.6, -0.4, -41.4, -41, 0, H, [[-12, 3, H], [-18.5, 1.2, D], [-5.5, 1.2, D]]);
      wallLine('x', -54.6, -30.4, -13.5, -13.1, 0, H, [[-42.5, 3, H], [-52, 1.2, D], [-33, 1.2, D]]);
      wallLine('x', -54.6, -30.4, -10.9, -10.5, 0, H, [[-42.5, 3, H], [-52, 1.2, D], [-33, 1.2, D]]);
      // room dividers
      wallLine('z', -23.6, -13.5, -49.5, -49.1, 0, H, [[-20, 1.2, D]]);
      wallLine('z', -10.5, -0.4, -49.5, -49.1, 0, H, [[-4, 1.2, D]]);
      wallLine('z', -23.6, -13.5, -35.9, -35.5, 0, H, [[-17, 1.2, D]]);
      wallLine('z', -10.5, -0.4, -35.9, -35.5, 0, H, [[-6, 1.2, D]]);
      // corridor lights in the ceiling
      glow(-42.8, H - 0.04, -23.6, -42.2, H, -0.4, [0.92, 0.88, 1], 0.9);
      glow(-54.6, H - 0.04, -12.3, -30.4, H, -11.7, [0.92, 0.88, 1], 0.9);
      // furniture in the rooms
      crate(-53, -22); crate(-46, -16, 1.2, 0, [0.5, 0.52, 0.56]); crate(-38.5, -21);
      box(-34, 0, -22.5, -31, 0.9, -20.5, { color: CHAR, grid: false });
      crate(-46.5, -3); box(-39, 0, -2.5, -37, 0.9, -1, { color: CHAR, grid: false }); crate(-32, -8);
      // stairs to the roof on the east side, rooftop units
      stairs(-28.7, -1.6, '-z', 2.2, 0, 5);
      box(-50, H + 0.4, -20, -46, H + 2, -16, { color: STEEL, grid: false });
      box(-38, H + 0.4, -6, -34, H + 1.6, -3, { color: STEEL, grid: false });
    }

    buildBowl(box, deco, glow);
  },
};

// ---------------------------------------------------------------- the stadium bowl round the void
function buildBowl(box, deco, glow) {
  const X = 82, ZN = -58, ZS = 104, N = 12, DEPTH = 2.6, RISE = 1.8, YB = -12, BACK = 34;
  const seat = [[0.22, 0.23, 0.26], [0.3, 0.31, 0.35]];
  const fan = [SEC[1], SEC[2], SEC[3], SEC[4], SEC[5], SEC[6], [0.95, 0.95, 0.97], [0.95, 0.2, 0.15]];
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < N; i++) {
    const top = YB + i * RISE, o = i * DEPTH, col = { color: seat[i % 2], grid: false };
    box(-X - BACK, -45, ZN - o, -X - o, top, ZS + o, col);       // west stand
    box(X + o, -45, ZN - o, X + BACK, top, ZS + o, col);         // east stand
    box(-X - o, -45, ZN - BACK, X + o, top, ZN - o, col);        // north stand
    box(-X - o, -45, ZS + o, X + o, top, ZS + BACK, col);        // south stand
    // the crowd: blocks of fans in sector colours along each row
    if (i % 2 === 1) {
      const row = (len, put) => { for (let t = -len / 2 + 2; t < len / 2 - 4;) { const w = 3 + rnd() * 7; if (rnd() < 0.7) put(t, Math.min(t + w, len / 2 - 2), fan[Math.floor(rnd() * fan.length)]); t += w + 1 + rnd() * 4; } };
      const zc = (ZN + ZS) / 2, zl = ZS - ZN + 2 * o, xl = 2 * (X + o);
      const h = { grid: false, solid: false, edges: false, noShadow: true, emissive: 0.15 };
      row(zl, (a, b, cl) => { box(-X - o - 1.6, top, zc + a, -X - o - 0.4, top + 0.9, zc + b, { ...h, color: cl }); });
      row(zl, (a, b, cl) => { box(X + o + 0.4, top, zc + a, X + o + 1.6, top + 0.9, zc + b, { ...h, color: cl }); });
      row(xl, (a, b, cl) => { box(a, top, ZN - o - 1.6, b, top + 0.9, ZN - o - 0.4, { ...h, color: cl }); });
      row(xl, (a, b, cl) => { box(a, top, ZS + o + 0.4, b, top + 0.9, ZS + o + 1.6, { ...h, color: cl }); });
    }
  }
  // LED ribbon boards along the front of the stands
  const rib = [1, 0.2, 0.15];
  glow(-X - 0.1, YB - 1.4, ZN, -X, YB - 0.4, ZS, rib, 1);
  glow(X, YB - 1.4, ZN, X + 0.1, YB - 0.4, ZS, rib, 1);
  glow(-X, YB - 1.4, ZN - 0.1, X, YB - 0.4, ZN, rib, 1);
  glow(-X, YB - 1.4, ZS, X, YB - 0.4, ZS + 0.1, rib, 1);
  // back walls and the roof canopy, with floodlight strips under its edge
  const TOPY = YB + N * RISE, CAN = TOPY + 9, IN = X + N * DEPTH - 6;
  const zn = ZN - N * DEPTH + 6, zs = ZS + N * DEPTH - 6;
  box(-X - BACK - 1, TOPY - 2, ZN - BACK - 1, -X - BACK, CAN, ZS + BACK + 1, { color: [0.2, 0.21, 0.24], grid: false });
  box(X + BACK, TOPY - 2, ZN - BACK - 1, X + BACK + 1, CAN, ZS + BACK + 1, { color: [0.2, 0.21, 0.24], grid: false });
  box(-X - BACK, TOPY - 2, ZN - BACK - 1, X + BACK, CAN, ZN - BACK, { color: [0.2, 0.21, 0.24], grid: false });
  box(-X - BACK, TOPY - 2, ZS + BACK, X + BACK, CAN, ZS + BACK + 1, { color: [0.2, 0.21, 0.24], grid: false });
  const roof = { color: [0.88, 0.89, 0.92], grid: false, noShadow: true };
  box(-X - BACK, CAN, ZN - BACK, -IN, CAN + 1.2, ZS + BACK, roof);
  box(IN, CAN, ZN - BACK, X + BACK, CAN + 1.2, ZS + BACK, roof);
  box(-IN, CAN, ZN - BACK, IN, CAN + 1.2, zn, roof);
  box(-IN, CAN, zs, IN, CAN + 1.2, ZS + BACK, roof);
  const lamp = [1, 0.98, 0.9];
  glow(-IN, CAN - 0.25, zn, -IN + 1.2, CAN, zs, lamp, 1);
  glow(IN - 1.2, CAN - 0.25, zn, IN, CAN, zs, lamp, 1);
  glow(-IN, CAN - 0.25, zn, IN, CAN, zn + 1.2, lamp, 1);
  glow(-IN, CAN - 0.25, zs - 1.2, IN, CAN, zs, lamp, 1);
  // floodlight masts in the corners
  for (const [x, z] of [[-X - 20, ZN - 20], [X + 20, ZN - 20], [-X - 20, ZS + 20], [X + 20, ZS + 20]]) {
    box(x - 1, -45, z - 1, x + 1, CAN + 22, z + 1, { color: [0.2, 0.21, 0.24], grid: false, noShadow: true });
    const sx = -Math.sign(x), sz = -Math.sign(z);
    box(x - 5, CAN + 18, z - 5, x + 5, CAN + 26, z + 5, { color: [0.2, 0.21, 0.24], grid: false, noShadow: true });
    glow(sx > 0 ? x + 5 : x - 5.1, CAN + 18.6, z - 4.4, sx > 0 ? x + 5.1 : x - 5, CAN + 25.4, z + 4.4, lamp, 1);
    glow(x - 4.4, CAN + 18.6, sz > 0 ? z + 5 : z - 5.1, x + 4.4, CAN + 25.4, sz > 0 ? z + 5.1 : z - 5, lamp, 1);
  }
  // the centre-hung scoreboard cube over the arena
  const cx = 0, cz = 9, cy = 40;
  box(cx - 8, cy, cz - 8, cx + 8, cy + 9, cz + 8, { color: [0.12, 0.12, 0.14], grid: false, noShadow: true });
  const scr = [0.18, 0.45, 1];
  glow(cx - 7, cy + 1, cz + 8, cx + 7, cy + 8, cz + 8.1, scr, 0.85);
  glow(cx - 7, cy + 1, cz - 8.1, cx + 7, cy + 8, cz - 8, scr, 0.85);
  glow(cx - 8.1, cy + 1, cz - 7, cx - 8, cy + 8, cz + 7, scr, 0.85);
  glow(cx + 8, cy + 1, cz - 7, cx + 8.1, cy + 8, cz + 7, scr, 0.85);
  glow(cx - 8.05, cy - 0.3, cz - 8.05, cx + 8.05, cy, cz + 8.05, [1, 0.2, 0.15], 1);
  box(cx - 6, cy - 2, cz - 6, cx + 6, cy, cz + 6, { color: [0.12, 0.12, 0.14], grid: false, noShadow: true });
  for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) box(cx + x - 0.1, cy + 9, cz + z - 0.1, cx + x + 0.1, cy + 60, cz + z + 0.1, { color: CHAR, grid: false, solid: false, noShadow: true });
  // a giant hologram trophy floating over the gap between the rows
  const tz = 9, ty = 16, gold = [1, 0.78, 0.25], H = { alpha: 0.32, noBullet: true };
  glow(-2.2, ty, tz - 2.2, 2.2, ty + 1, tz + 2.2, gold, 0.9, H);
  glow(-0.5, ty + 1, tz - 0.5, 0.5, ty + 4, tz + 0.5, gold, 0.9, { ...H, shape: 'cyl' });
  glow(-3, ty + 4, tz - 3, 3, ty + 9, tz + 3, gold, 0.9, { ...H, shape: 'sphere' });
  glow(-4.6, ty + 5.5, tz - 0.4, -2.6, ty + 8, tz + 0.4, gold, 0.9, { ...H, shape: 'sphere' });
  glow(2.6, ty + 5.5, tz - 0.4, 4.6, ty + 8, tz + 0.4, gold, 0.9, { ...H, shape: 'sphere' });
  // the void: a dark floor far below with glowing seams, lost in the haze
  deco(-150, -46, -150, 150, -45, 200, { color: [0.07, 0.08, 0.11], edges: false });
  for (const z of [-30, 10, 50]) glow(-150, -45, z - 0.4, 150, -44.9, z + 0.4, [0.9, 0.15, 0.1], 0.7);
  for (const x of [-40, 0, 40]) glow(x - 0.4, -45, -150, x + 0.4, -44.9, 200, [0.9, 0.15, 0.1], 0.7);
}
