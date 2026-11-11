// The semi-finals arenas: three small team-deathmatch maps in the test range's style (white grid blocks,
// charcoal trim, red light strips) with simple, chunky obstacles: cubes, walls, pillars, platforms and stairs.
// Each arena is built far from the range and from each other; only the one you're playing in is drawn.
// Two teams spawn at opposite ends (x < 0 and x > 0), and every layout is point-symmetric so neither side has the edge.
import { makeBox, boxAt } from '../world.js';

const WALL = [0.91, 0.91, 0.93];
const ACCENT = [0.86, 0.87, 0.9];
const CHAR = [0.27, 0.28, 0.31];
const RED = [0.95, 0.15, 0.1];
const LIGHT = [1, 1, 0.96];
const Y0 = 60;
const H = 9;           // wall height

// ---------------------------------------------------------------- layouts (local metres, floor at y = 0)
// b: [x, z, sx, sy, sz, colour?, rounded?]   p: platform [x, z, sx, sz, h]   s: stairs [ex, ez, dirx, dirz, h, width]
// Everything listed is mirrored through the centre for the other team, except items flagged `mid` (already central).
const LAYOUTS = [
  {
    name: 'BLOCKYARD', W: 34, D: 24, ox: -520,
    blurb: 'CUBES, PILLARS AND A RAISED CENTRE',
    mid: {
      p: [[0, 0, 8, 8, 3]],
      s: [[4, 0, 1, 0, 3, 3], [-4, 0, -1, 0, 3, 3]],
      b: [[0, 2.6, 2.4, 1.1, 0.5, CHAR], [0, -2.6, 2.4, 1.1, 0.5, CHAR]],     // cover on the platform
    },
    side: {
      b: [
        [-24, -7, 0.6, 1.2, 4, ACCENT], [-24, 7, 0.6, 1.2, 4, ACCENT],        // spawn cover
        [-17, 0, 0.6, 3.2, 7], [-20, 13, 2.2, 2.2, 2.2, WALL, 0.12], [-20, 15.2, 2.2, 2.2, 2.2, ACCENT, 0.12],
        [-12, -15, 2.2, 2.2, 2.2, CHAR, 0.12], [-12, -15, 1.4, 3.6, 1.4, CHAR],
        [-7, 9, 2.4, 2.4, 2.4, WALL, 0.12], [-9, -6, 1.4, 5.5, 1.4, CHAR], [-13, 6, 6, 1.2, 0.6, ACCENT],
        [-28, 18, 2, 2, 2, ACCENT, 0.1], [-26, 18, 2, 2, 2, WALL, 0.1], [-27, 18, 1.6, 3.8, 1.6, CHAR],
        [-29, -17, 3, 1.4, 3, ACCENT], [-3, 17, 6, 2.6, 0.6], [-17, -20, 0.6, 2.6, 5],
      ],
    },
  },
  {
    name: 'THE SPLIT', W: 36, D: 26, ox: 0,
    blurb: 'A DIVIDING WALL, HUTS AND A SIDE DECK',
    mid: {
      b: [
        [0, -21, 0.8, 3, 10], [0, -6, 0.8, 3, 8], [0, 6, 0.8, 3, 8], [0, 21, 0.8, 3, 10],    // the dividing wall, three gaps
        [0, 0, 3, 1.2, 1.2, CHAR],                                                            // a waist-high block in the middle gap
      ],
    },
    side: {
      b: [
        [-26, -6, 0.6, 1.2, 4, ACCENT], [-26, 6, 0.6, 1.2, 4, ACCENT],
        [-10, 14, 2.2, 2.2, 2.2, WALL, 0.12], [-6, -14, 2.2, 2.2, 2.2, CHAR, 0.12], [-6, -11.8, 2.2, 1.1, 2.2, ACCENT, 0.12],
        [-4, 3, 1.4, 4.5, 1.4, CHAR], [-14, -2, 4, 1.2, 0.6, ACCENT], [-20, 21, 0.6, 2.6, 6],
        [-31, -21, 2, 2, 2, WALL, 0.1], [-29, -21, 2, 2, 2, ACCENT, 0.1],
      ],
      hut: [[-17, -12, 7, 7]],          // a hut with doors on both x sides: [x, z, sx, sz]
      p: [[-22, 18, 12, 6, 3]],          // side deck
      s: [[-16, 18, 1, 0, 3, 3]],
    },
  },
  {
    name: 'HIGH GROUND', W: 40, D: 26, ox: 520,
    blurb: 'A LOOKOUT EACH, TRENCH WALLS IN THE MIDDLE',
    mid: {
      b: [[0, 0, 3, 3, 3, WALL, 0.3], [0, -10, 0.6, 1.4, 6, ACCENT], [0, 10, 0.6, 1.4, 6, ACCENT]],
    },
    side: {
      p: [[-26, 0, 7, 7, 4.2], [-8, -19, 10, 4, 2.4]],
      s: [[-22.5, 0, 1, 0, 4.2, 3], [-3, -19, 1, 0, 2.4, 3]],
      b: [
        [-26, 2.8, 4, 1.1, 0.4, CHAR, 0, 4.2], [-26, -2.8, 4, 1.1, 0.4, CHAR, 0, 4.2], [-28.8, 0, 0.4, 1.1, 7, CHAR, 0, 4.2],   // tower parapets
        [-33, -10, 0.6, 1.2, 4, ACCENT], [-33, 10, 0.6, 1.2, 4, ACCENT],
        [-15, -6, 0.6, 1.3, 5, ACCENT], [-11, 5, 0.6, 1.3, 5, ACCENT], [-6, -4, 0.6, 1.3, 4, ACCENT],      // staggered trench walls
        [-17, 12, 2.6, 2.6, 2.6, WALL, 0.3], [-9, 17, 2.2, 2.2, 2.2, CHAR, 0.12], [-19, -15, 1.4, 5, 1.4, CHAR],
        [-34, 20, 3, 1.4, 3, ACCENT], [-5, 12, 4, 2.4, 0.6],
      ],
    },
  },
];

function buildArena(world, A) {
  const O = [A.ox, Y0, -700], W = A.W, D = A.D;
  const add = (b) => world.add(b);
  const L = (x, y, z) => [O[0] + x, O[1] + y, O[2] + z];
  const box = (min, max, o = {}) => add(makeBox(L(...min), L(...max), o));
  const at = (x, y, z, sx, sy, sz, o = {}) => add(boxAt(O[0] + x, O[1] + y, O[2] + z, sx, sy, sz, o));
  const deco = (min, max, o = {}) => box(min, max, { grid: false, solid: false, noShadow: true, ...o });

  // ---- floor and walls, banded like the range
  box([-W - 1, -1, -D - 1], [W + 1, 0, D + 1]);
  box([-W - 1, 0, -D - 1], [W + 1, H, -D], { color: WALL });
  box([-W - 1, 0, D], [W + 1, H, D + 1], { color: WALL });
  box([-W - 1, 0, -D], [-W, H, D], { color: WALL });
  box([W, 0, -D], [W + 1, H, D], { color: WALL });
  const band = (y0, y1, t, o) => {
    box([-W, y0, -D], [W, y1, -D + t], o); box([-W, y0, D - t], [W, y1, D], o);
    box([-W, y0, -D], [-W + t, y1, D], o); box([W - t, y0, -D], [W, y1, D], o);
  };
  band(0, 0.45, 0.12, { color: CHAR, grid: false });
  band(3.4, 3.5, 0.06, { color: RED, emissive: 0.9, solid: false, noShadow: true, grid: false });
  band(H - 0.35, H, 0.25, { color: CHAR, grid: false });
  for (let t = -W + 4; t <= W - 4; t += 8) for (const z of [-D, D - 0.4]) box([t - 0.4, 0, z], [t + 0.4, H, z + 0.4], { color: CHAR, grid: false });
  for (let t = -D + 4; t <= D - 4; t += 8) for (const x of [-W, W - 0.4]) box([x, 0, t - 0.4], [x + 0.4, H, t + 0.4], { color: CHAR, grid: false });
  // floodlight towers in the corners
  for (const [cx, cz] of [[-W + 1.5, -D + 1.5], [W - 1.5, -D + 1.5], [-W + 1.5, D - 1.5], [W - 1.5, D - 1.5]]) {
    at(cx, 0, cz, 1.2, 14, 1.2, { color: CHAR, grid: false });
    at(cx, 14, cz, 3, 1.6, 3, { color: CHAR, grid: false });
    at(cx, 13.8, cz, 2.6, 0.2, 2.6, { color: LIGHT, grid: false, emissive: 1, solid: false, noShadow: true });
  }
  // a halfway line and the spawn zones
  deco([-0.12, 0, -D], [0.12, 0.02, D], { color: RED, emissive: 0.6 });
  for (const s of [-1, 1]) {
    const x0 = s * (W - 6), x1 = s * W;
    deco([Math.min(x0, x1), 0, -8], [Math.max(x0, x1), 0.015, 8], { color: CHAR });
    deco([Math.min(x0, x1) + (s < 0 ? 5.7 : 0), 0, -8], [Math.min(x0, x1) + (s < 0 ? 6 : 0.3), 0.025, 8], { color: RED, emissive: 0.7 });
  }

  // ---- obstacles
  const plats = [], chains = [];
  const place = (list, mirror) => {
    const flip = (x, z) => (mirror ? [-x, -z] : [x, z]);
    for (const [x0, z0, sx, sy, sz, color, round, y = 0] of list.b || []) {
      const [x, z] = flip(x0, z0);
      at(x, y, z, sx, sy, sz, { color: color || WALL, shape: round || undefined, grid: color !== CHAR, edges: !round });
    }
    for (const [x0, z0, sx, sz, h] of list.p || []) {
      const [x, z] = flip(x0, z0);
      at(x, 0, z, sx, h, sz, { color: WALL });
      at(x, h - 0.12, z, sx + 0.06, 0.12, sz + 0.06, { color: CHAR, grid: false });       // charcoal lip
      plats.push({ y: h, rect: [O[0] + x - sx / 2 + 0.5, O[2] + z - sz / 2 + 0.5, O[0] + x + sx / 2 - 0.5, O[2] + z + sz / 2 - 0.5] });
    }
    for (const [ex0, ez0, dx0, dz0, h, w] of list.s || []) {
      const [ex, ez] = flip(ex0, ez0), [dx, dz] = mirror ? [-dx0, -dz0] : [dx0, dz0];
      const n = Math.ceil(h / 0.4), rise = h / n, run = 0.55;
      const chain = [L(ex - dx * 1.2, h, ez - dz * 1.2)];
      for (let i = 0; i < n; i++) {
        const d = (i + 0.5) * run, top = h - i * rise;
        const cx = ex + dx * d, cz = ez + dz * d;
        at(cx, 0, cz, dx ? run : w, top, dz ? run : w, { color: i % 2 ? ACCENT : WALL });
        chain.push(L(cx, top, cz));
      }
      chain.push(L(ex + dx * (n * run + 0.9), 0, ez + dz * (n * run + 0.9)));
      chain.reverse();
      chains.push(chain);
    }
    for (const [x0, z0, sx, sz] of list.hut || []) {
      // four walls with a doorway in each x-facing side, and a roof
      const [x, z] = flip(x0, z0), t = 0.4, h = 3.2, door = 2.4;
      for (const s of [-1, 1]) at(x, 0, z + s * (sz / 2 - t / 2), sx, h, t, { color: WALL });
      for (const s of [-1, 1]) for (const k of [-1, 1]) {
        const len = (sz - door) / 2 - t;
        at(x + s * (sx / 2 - t / 2), 0, z + k * (door / 2 + len / 2), t, h, len, { color: WALL });
      }
      for (const s of [-1, 1]) at(x + s * (sx / 2 - t / 2), 2.3, z, t, h - 2.3, door, { color: CHAR, grid: false });   // lintels
      at(x, h, z, sx + 0.4, 0.3, sz + 0.4, { color: CHAR, grid: false });
    }
  };
  place(A.mid || {}, false);
  place(A.side || {}, false);
  place(A.side || {}, true);

  // ---- bot navigation: the floor plus each platform height
  const heights = [...new Set(plats.map((p) => p.y))];
  A.nav = {
    levels: [
      { y: O[1], rects: [[O[0] - W + 0.8, O[2] - D + 0.8, O[0] + W - 0.8, O[2] + D - 0.8]] },
      ...heights.map((h) => ({ y: O[1] + h, rects: plats.filter((p) => p.y === h).map((p) => p.rect) })),
    ],
    chains,
    exclude: [],
  };
  A.origin = O;
  A.spawns = [
    { pos: L(-W + 4.5, 0, 0), yaw: -Math.PI / 2 },
    { pos: L(W - 4.5, 0, 0), yaw: Math.PI / 2 },
  ];
  A.spawn = A.spawns[0];
  A.area = { min: [O[0] - W - 60, O[1] - 40, O[2] - D - 60], max: [O[0] + W + 60, O[1] + 80, O[2] + D + 60] };
}

export const ARENAS = LAYOUTS.map((A) => ({
  ...A,
  fog: 0.0055,
  shadowHalf: Math.max(A.W, A.D) + 6,
  voidY: Y0 - 30,
  voidText: ['OUT', 'FELL OUT OF THE ARENA'],
  fallLethal: 0,
  fallHurt: 0,
  hook: false,
  pads: [],
  lifts: [],
  dummies: [],
  walls: [],
  cargo: [],
  glassBoxes: [],
  refs: {},
  spawnGlass: () => [],
  build(world) { buildArena(world, this); },
}));
