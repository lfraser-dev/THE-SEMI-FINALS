// The semi-finals arenas: team-deathmatch maps in the test range's style (white grid blocks, charcoal trim,
// red light strips) with simple, chunky obstacles: cubes, walls, pillars, platforms and stairs. Layouts are
// written at a base size and scaled up by S across the floor (heights stay put). THE COLOSSEUM is a round,
// gladiator-style bowl: a sand floor, a stone ring wall, tiered stands and a gate at each end.
// Each arena is built far from the range and from each other; only the one you're playing in is drawn.
// Two teams spawn at opposite ends (x < 0 and x > 0), and every layout is point-symmetric so neither side has the edge.
import { makeBox, boxAt } from '../world.js';

const WALL = [0.91, 0.91, 0.93];
const ACCENT = [0.86, 0.87, 0.9];
const CHAR = [0.27, 0.28, 0.31];
const RED = [0.95, 0.15, 0.1];
const LIGHT = [1, 1, 0.96];
const Y0 = 60;
const H = 10;          // wall height
const STONE = [0.88, 0.84, 0.76], STONE2 = [0.8, 0.75, 0.66], DARKSTONE = [0.5, 0.46, 0.41], SAND = [0.84, 0.74, 0.56];

// ---------------------------------------------------------------- layouts (local metres, floor at y = 0)
// b: [x, z, sx, sy, sz, colour?, rounded?]   p: platform [x, z, sx, sz, h]   s: stairs [ex, ez, dirx, dirz, h, width]
// Everything listed is mirrored through the centre for the other team, except items flagged `mid` (already central).
const LAYOUTS = [
  {
    name: 'BLOCKYARD', W: 34, D: 24, S: 1.45, ox: -780,
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
        [-22, -10, 2.2, 2.2, 2.2, WALL, 0.12], [-4, -18, 2.4, 1.2, 2.4, CHAR], [-14, 19, 0.6, 2.8, 4, ACCENT],
        [-26, -3, 1.4, 1.2, 3, CHAR], [-6, 3, 2, 2, 2, ACCENT, 0.12],
      ],
      p: [[-23, -18, 6, 6, 2.4]],
      s: [[-20, -18, 1, 0, 2.4, 2.4]],
    },
  },
  {
    name: 'THE SPLIT', W: 36, D: 26, S: 1.4, ox: -260,
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
        [-9, 22, 2.2, 2.2, 2.2, CHAR, 0.12], [-28, 10, 0.6, 1.4, 5, ACCENT], [-8, -4, 2.4, 1.1, 0.6, CHAR],
        [-24, 0, 2, 2, 2, WALL, 0.12], [-12, 6, 1.4, 4.5, 1.4, CHAR],
      ],
      hut: [[-17, -12, 7, 7]],          // a hut with doors on both x sides: [x, z, sx, sz]
      p: [[-22, 18, 12, 6, 3]],          // side deck
      s: [[-16, 18, 1, 0, 3, 3]],
    },
  },
  {
    name: 'HIGH GROUND', W: 40, D: 26, S: 1.4, ox: 260,
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
        [-25, 15, 2.4, 2.4, 2.4, ACCENT, 0.12], [-28, -16, 0.6, 1.3, 5, ACCENT], [-12, -12, 2.2, 1.1, 2.2, CHAR],
        [-3, 3, 1.4, 4, 1.4, CHAR],
      ],
    },
  },
  {
    name: 'THE COLOSSEUM', W: 40, D: 40, S: 1, ox: 780, round: true,
    blurb: 'A SAND PIT IN A STONE BOWL, A GATE AT EACH END',
    mid: {
      p: [[0, 0, 9, 9, 1.6]],
      s: [[0, 4.5, 0, 1, 1.6, 3], [0, -4.5, 0, -1, 1.6, 3]],
      b: [[0, 0, 1.6, 6.5, 1.6, DARKSTONE, 'cylY', 1.6], [0, 0, 2.4, 0.5, 2.4, STONE2, 0.1, 8.1]],   // the centre column
    },
    side: {
      b: [
        [-34, -6, 0.8, 1.3, 4, STONE2], [-34, 6, 0.8, 1.3, 4, STONE2],                 // spawn cover outside the gate
        // a ring of columns round the centre, some broken
        [-12, 0, 1.4, 5, 1.4, STONE, 'cylY'], [-8.5, 8.5, 1.4, 2.4, 1.4, STONE, 'cylY'], [-8.5, -8.5, 1.4, 5, 1.4, STONE, 'cylY'], [0, 12, 1.4, 3.4, 1.4, STONE, 'cylY'],
        // low stone walls and fallen blocks
        [-20, -10, 0.8, 1.3, 6, STONE2], [-20, 10, 0.8, 1.3, 6, STONE2], [-26, 0, 2.6, 2.4, 2.6, STONE, 0.15],
        [-16, -20, 5, 1.2, 0.8, STONE2], [-16, 20, 2.6, 2.6, 2.6, STONE, 0.15], [-13.5, 21, 1.4, 1.2, 1.4, STONE2, 0.12],
        [-26, -16, 1.4, 1.4, 5, DARKSTONE, 'cylY'], [-5, -22, 2.4, 2.4, 2.4, STONE, 0.15], [-6, 24, 0.8, 1.3, 5, STONE2],
        [-30, 14, 2, 2, 2, STONE2, 0.12], [-14, -4, 2.2, 1.1, 2.2, DARKSTONE, 0.12],
        // weapon racks by the gate (charcoal posts)
        [-31, -11, 0.3, 2, 2.4, CHAR], [-31, 11, 0.3, 2, 2.4, CHAR],
      ],
      p: [[-22, -24, 6, 5, 2.4]],
      s: [[-22, -21.5, 0, 1, 2.4, 2.4]],
    },
  },
];

// the outer shell of a box arena: floor, banded walls, posts, floodlights, halfway line and spawn zones
function buildBoxShell(A, box, at, deco) {
  const W = A.W, D = A.D, SZ = 8 * A.S;
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
    at(cx, 0, cz, 1.2, 16, 1.2, { color: CHAR, grid: false });
    at(cx, 16, cz, 3, 1.6, 3, { color: CHAR, grid: false });
    at(cx, 15.8, cz, 2.6, 0.2, 2.6, { color: LIGHT, grid: false, emissive: 1, solid: false, noShadow: true });
  }
  // a halfway line and the spawn zones
  deco([-0.12, 0, -D], [0.12, 0.02, D], { color: RED, emissive: 0.6 });
  for (const s of [-1, 1]) {
    const x0 = s * (W - 6), x1 = s * W;
    deco([Math.min(x0, x1), 0, -SZ], [Math.max(x0, x1), 0.015, SZ], { color: CHAR });
    deco([Math.min(x0, x1) + (s < 0 ? 5.7 : 0), 0, -SZ], [Math.min(x0, x1) + (s < 0 ? 6 : 0.3), 0.025, SZ], { color: RED, emissive: 0.7 });
  }
}

// THE COLOSSEUM: a round sand floor ringed by a stone wall, tiered stands rising behind it, a colonnade on top,
// and a gated tunnel at each end where the teams come out. The ring is built from short stone blocks set round
// a circle (the world is boxes), overlapping so there are no gaps.
function buildBowl(A, box, at, deco) {
  const R = A.W, GATE = 0.15;        // gate half-angle (rad), for keeping banners clear of the gates
  const stone = (o = {}) => ({ color: STONE, grid: false, tex: 3, ...o });
  // floor: sand inside, stone outside
  box([-R - 30, -1, -R - 30], [R + 30, 0, R + 30], { color: STONE2, grid: false, tex: 3 });
  at(0, 0, 0, 2 * R + 0.6, 0.02, 2 * R + 0.6, { color: SAND, grid: false, tex: 3, shape: 'cylY', solid: false, noShadow: true });
  at(0, 0.02, 0, 7, 0.01, 7, { color: RED, emissive: 0.5, grid: false, shape: 'cylY', solid: false, noShadow: true });
  at(0, 0.03, 0, 6.4, 0.01, 6.4, { color: SAND, grid: false, tex: 3, shape: 'cylY', solid: false, noShadow: true });
  // a ring of blocks: radius r, block size s, height h from y0
  const ring = (r, s, h, y0, o, skipGate = true, every = 1) => {
    const n = Math.ceil((2 * Math.PI * r) / (s * 0.82));
    for (let i = 0; i < n; i += every) {
      const a = (i / n) * Math.PI * 2;
      if (skipGate && Math.abs(Math.cos(a)) > 0.5 && Math.abs(Math.sin(a) * r) < 7 + s / 2) continue;   // leave the gates open
      at(Math.cos(a) * r, y0, Math.sin(a) * r, s, h, s, o(i));
    }
  };
  // the arena wall: too tall to climb, with a red light strip and a dark plinth
  ring(R + 1.1, 2.2, 5.2, 0, () => stone({ shape: 0.08 }));
  ring(R + 0.25, 0.7, 0.5, 0, () => ({ color: DARKSTONE, grid: false, tex: 3, solid: false }));
  ring(R + 0.35, 0.5, 0.12, 3.3, () => ({ color: RED, emissive: 0.9, grid: false, solid: false, noShadow: true }));
  ring(R + 1.1, 2.5, 0.35, 5.2, () => ({ color: DARKSTONE, grid: false, tex: 3, solid: false }));
  // tiered stands
  const tiers = [[R + 3.4, 6.2], [R + 5.8, 7.4], [R + 8.2, 8.6], [R + 10.6, 9.8], [R + 13, 11]];
  tiers.forEach(([r, h], k) => ring(r, 2.6, h, 0, () => stone({ color: k % 2 ? STONE : STONE2, shape: 0.06 })));
  // the outer wall and a colonnade of pillars on top
  ring(R + 15.6, 2.6, 15, 0, () => stone({ color: STONE }));
  ring(R + 15.6, 1.3, 5, 15, (i) => stone({ color: STONE2, shape: 'cylY' }), true, 3);
  ring(R + 15.6, 2.8, 0.8, 20, () => stone({ color: DARKSTONE }));
  // banners hanging off the wall, red and charcoal
  for (let i = 0; i < 16; i++) {
    const a = ((i + 0.5) / 16) * Math.PI * 2;
    if (Math.abs(Math.sin(a)) < Math.sin(GATE) * 2) continue;
    const r = R + 0.1, x = Math.cos(a) * r, z = Math.sin(a) * r;
    at(x, 2.2, z, 0.9, 2.8, 0.9, { color: i % 2 ? RED : CHAR, emissive: i % 2 ? 0.15 : 0, grid: false, solid: false, noShadow: true });
  }
  // floodlights on four masts above the stands
  for (let i = 0; i < 4; i++) {
    const a = (i + 0.5) * Math.PI / 2, r = R + 17, x = Math.cos(a) * r, z = Math.sin(a) * r;
    at(x, 0, z, 1.4, 26, 1.4, { color: CHAR, grid: false });
    at(x * 0.97, 26, z * 0.97, 4, 2, 4, { color: CHAR, grid: false });
    at(x * 0.97, 25.8, z * 0.97, 3.6, 0.2, 3.6, { color: LIGHT, grid: false, emissive: 1, solid: false, noShadow: true });
  }
  // the gates: a tunnel through the stands at each end, with an arch, a raised portcullis and team lights
  for (const s of [-1, 1]) {
    const x0 = s * (R - 0.6), x1 = s * (R + 17), lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    const hw = 5.4;
    box([lo, 0, -hw - 1.6], [hi, 6.4, -hw], stone({ color: STONE2 }));       // tunnel walls
    box([lo, 0, hw], [hi, 6.4, hw + 1.6], stone({ color: STONE2 }));
    box([lo, 6.4, -hw - 1.6], [hi, 7.4, hw + 1.6], stone({ color: DARKSTONE })); // roof
    box([s > 0 ? hi - 1 : lo, 0, -hw], [s > 0 ? hi : lo + 1, 6.4, hw], stone({ color: DARKSTONE }));   // back wall
    // the facade over the gate
    const fx = s * (R + 0.4);
    at(fx, 0, -hw - 1.2, 1.8, 9, 2.4, stone({ shape: 0.08 }));
    at(fx, 0, hw + 1.2, 1.8, 9, 2.4, stone({ shape: 0.08 }));
    at(fx, 6.4, 0, 1.8, 2.6, 2 * hw + 4.8, stone({ color: STONE2 }));
    at(fx, 9, 0, 2.2, 0.5, 2 * hw + 5.4, { color: DARKSTONE, grid: false, tex: 3 });
    at(fx - s * 0.95, 7.2, 0, 0.12, 0.25, 2 * hw - 0.6, { color: RED, emissive: 0.9, grid: false, solid: false, noShadow: true });
    for (let k = -4; k <= 4; k++) at(fx, 5.6, k * 1.2, 0.2, 0.8, 0.14, { color: CHAR, grid: false, solid: false });   // portcullis teeth
    at(fx, 6.1, 0, 0.3, 0.3, 2 * hw, { color: CHAR, grid: false, solid: false });
    // the spawn floor inside the gate, and lamps along the tunnel
    deco([lo + 0.5, 0, -hw], [hi - 0.5, 0.015, hw], { color: CHAR });
    for (let t = 3; t < 16; t += 4) for (const z of [-hw + 0.06, hw - 0.06]) at(s * (R + t), 4.6, z, 1.2, 0.18, 0.12, { color: LIGHT, emissive: 1, grid: false, solid: false, noShadow: true });
  }
}

function buildArena(world, A) {
  const O = [A.ox, Y0, -700], W = A.W, D = A.D, S = A.S;
  const add = (b) => world.add(b);
  const L = (x, y, z) => [O[0] + x, O[1] + y, O[2] + z];
  const box = (min, max, o = {}) => add(makeBox(L(...min), L(...max), o));
  const at = (x, y, z, sx, sy, sz, o = {}) => add(boxAt(O[0] + x, O[1] + y, O[2] + z, sx, sy, sz, o));
  const deco = (min, max, o = {}) => box(min, max, { grid: false, solid: false, noShadow: true, ...o });
  if (A.round) buildBowl(A, box, at, deco); else buildBoxShell(A, box, at, deco);

  // ---- obstacles (layout units are scaled by S across the floor; heights stay the same)
  const plats = [], chains = [];
  A.dwalls = [];
  const surf = (color) => (A.round ? { grid: false, tex: 3 } : { grid: color !== CHAR });
  const place = (list, mirror) => {
    const flip = (x, z) => (mirror ? [-x * S, -z * S] : [x * S, z * S]);
    for (const [x0, z0, sx0, sy, sz0, color, round, y = 0] of list.b || []) {
      const [x, z] = flip(x0, z0);
      const k = round === 'cylY' ? 1 : S;          // columns stay round
      // walls (thin, long, standing on the floor) are destructible: built later out of chunks
      const sx = sx0 * k, sz = sz0 * k, thin = Math.min(sx0, sz0), long = Math.max(sx, sz);
      if (!round && y === 0 && thin <= 0.8 && long >= 2.4 && sy >= 1) {
        const axis = sx >= sz ? 0 : 2, cols = Math.max(2, Math.round(long / 0.5)), rows = Math.max(2, Math.round(sy / 0.5));
        const origin = [O[0] + x - sx / 2, O[1], O[2] + z - sz / 2];
        A.dwalls.push({ origin, cols, rows, chunk: long / cols, ch: sy / rows, thick: axis === 0 ? sz : sx, axis, color: color || (A.round ? STONE2 : WALL), hp: 45, tex: A.round ? 3 : 0 });
        continue;
      }
      at(x, y, z, sx0 * k, sy, sz0 * k, { color: color || WALL, shape: round || undefined, ...surf(color), edges: !round });
    }
    for (const [x0, z0, sx0, sz0, h] of list.p || []) {
      const [x, z] = flip(x0, z0), sx = sx0 * S, sz = sz0 * S;
      at(x, 0, z, sx, h, sz, { color: A.round ? STONE2 : WALL, ...surf() });
      at(x, h - 0.12, z, sx + 0.06, 0.12, sz + 0.06, { color: A.round ? DARKSTONE : CHAR, grid: false });       // lip
      plats.push({ y: h, rect: [O[0] + x - sx / 2 + 0.5, O[2] + z - sz / 2 + 0.5, O[0] + x + sx / 2 - 0.5, O[2] + z + sz / 2 - 0.5] });
    }
    for (const [ex0, ez0, dx0, dz0, h, w0] of list.s || []) {
      const [ex, ez] = flip(ex0, ez0), [dx, dz] = mirror ? [-dx0, -dz0] : [dx0, dz0], w = w0 * S;
      const n = Math.ceil(h / 0.4), rise = h / n, run = 0.55;
      const chain = [L(ex - dx * 1.2, h, ez - dz * 1.2)];
      for (let i = 0; i < n; i++) {
        const d = (i + 0.5) * run, top = h - i * rise;
        const cx = ex + dx * d, cz = ez + dz * d;
        at(cx, 0, cz, dx ? run : w, top, dz ? run : w, { color: A.round ? (i % 2 ? STONE : STONE2) : i % 2 ? ACCENT : WALL, ...surf() });
        chain.push(L(cx, top, cz));
      }
      chain.push(L(ex + dx * (n * run + 0.9), 0, ez + dz * (n * run + 0.9)));
      chain.reverse();
      chains.push(chain);
    }
    for (const [x0, z0, sx0, sz0] of list.hut || []) {
      // four walls with a doorway in each x-facing side, and a roof
      const [x, z] = flip(x0, z0), sx = sx0 * S, sz = sz0 * S, t = 0.4, h = 3.2, door = 2.4;
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
  let floorRects = [[O[0] - W + 0.8, O[2] - D + 0.8, O[0] + W - 0.8, O[2] + D - 0.8]];
  if (A.round) {
    // the round floor as strips, plus the two gate tunnels
    floorRects = [];
    for (let z = -W; z < W; z += 3) {
      const zm = Math.max(Math.abs(z), Math.abs(z + 3));
      const hw = Math.sqrt(Math.max(0, W * W - zm * zm)) - 1.2;
      if (hw > 1) floorRects.push([O[0] - hw, O[2] + z, O[0] + hw, O[2] + z + 3]);
    }
    floorRects.push([O[0] - W - 16, O[2] - 4.8, O[0] - W + 1, O[2] + 4.8], [O[0] + W - 1, O[2] - 4.8, O[0] + W + 16, O[2] + 4.8]);
  }
  A.nav = {
    levels: [
      { y: O[1], rects: floorRects },
      ...heights.map((h) => ({ y: O[1] + h, rects: plats.filter((p) => p.y === h).map((p) => p.rect) })),
    ],
    chains,
    exclude: [],
  };
  A.origin = O;
  const sx = A.round ? W + 3 : W - 4.5;
  A.spawns = [
    { pos: L(-sx, 0, 0), yaw: -Math.PI / 2 },
    { pos: L(sx, 0, 0), yaw: Math.PI / 2 },
  ];
  A.spawn = A.spawns[0];
  const pad = A.round ? 40 : 60;
  A.area = { min: [O[0] - W - pad, O[1] - 40, O[2] - D - pad], max: [O[0] + W + pad, O[1] + 80, O[2] + D + pad] };
}

export const ARENAS = LAYOUTS.map((A) => ({
  ...A,
  W: A.round ? A.W : A.W * A.S,
  D: A.round ? A.D : A.D * A.S,
  fog: A.round ? 0.0045 : 0.005,
  shadowHalf: (A.round ? A.W + 8 : Math.max(A.W, A.D) * A.S + 6),
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
