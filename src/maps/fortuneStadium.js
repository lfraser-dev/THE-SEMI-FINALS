// "Fortune Stadium": the semi-finals arena, at full arena scale (~280 m x 180 m of play space).
// Six floating sectors hang over the void inside a real stadium bowl, joined by bridges and launch pads.
// Front row (nearest spawn), left to right:  1 the court building · 2 the electric building · 3 THE TOWER
// Back row:                                  6 the maze building  · 5 the vault           · 4 the giant atrium building
// Every building can be entered and has real floors you can climb (switchback stairs on every level).
// Surfaces use the renderer's procedural materials (glass, concrete, paving, metal, office facade, asphalt, seats, LED).
import { makeBox } from '../world.js';
import { digitBoxes } from '../props.js';

// origin: chosen so floors (every 4.5 m) and panel seams line up with the procedural textures
const OX = 0, OZ = -702, Y0 = 63;
const FH = 4.5;                                 // storey height
const TX = { GLASS: 2, CONC: 3, PAVE: 4, METAL: 5, OFFICE: 6, ASPH: 7, SEATS: 8, LED: 9 };
const C = {
  conc: [0.7, 0.69, 0.66], concDark: [0.47, 0.47, 0.46], warm: [0.8, 0.76, 0.68], brick: [0.6, 0.37, 0.29],
  plaster: [0.85, 0.84, 0.81], floor: [0.6, 0.59, 0.57], pave: [0.68, 0.67, 0.64], asph: [0.24, 0.24, 0.25],
  glass: [0.38, 0.52, 0.6], steel: [0.58, 0.6, 0.63], dark: [0.16, 0.17, 0.19], white: [0.9, 0.9, 0.9],
  wood: [0.5, 0.35, 0.22], grass: [0.32, 0.46, 0.2], leaf: [0.25, 0.42, 0.18], fabric: [0.26, 0.28, 0.33],
  yellow: [0.95, 0.72, 0.1], light: [1, 0.96, 0.88], office: [0.8, 0.78, 0.74], metalClad: [0.66, 0.66, 0.64],
};
// sponsor accents per sector (used sparingly: signage, awnings, painted bands)
const ACC = { 1: [0.9, 0.3, 0.14], 2: [0.98, 0.74, 0.12], 3: [0.1, 0.72, 0.66], 4: [0.85, 0.22, 0.5], 5: [0.25, 0.5, 0.98], 6: [0.58, 0.36, 0.95] };
// sector centres (each sector is 76 m square)
const SEC = { 1: [-100, 50], 2: [0, 50], 3: [100, 50], 6: [-100, -50], 5: [0, -50], 4: [100, -50] };
const HS = 38;

const L = (x, y, z) => [OX + x, Y0 + y, OZ + z];

// launch pads: plate centre and where they throw you (local); vy = minimum launch speed upward
const PADS = [
  { at: [-11, 0, 110], to: [-84, 18, 68], vy: 32, col: ACC[1] },      // spawn → sector 1 roof
  { at: [11, 0, 110], to: [78, 0, 63], vy: 24, col: ACC[3] },         // spawn → the tower courtyard
  { at: [-92, 0, 58], to: [-121, 36, 29], vy: 40, col: ACC[1] },      // sector 1 court → the high rooftop
  { at: [100, 0, -50], to: [100, 22.5, -74], vy: 36, col: ACC[4] },   // sector 4 atrium → roof
  { at: [120, 117, 40], to: [112, 22.5, -28], vy: 12, col: ACC[3] },  // tower roof → sector 4 roof
];

export default {
  name: 'FORTUNE STADIUM',
  origin: [OX, Y0, OZ],
  spawn: { pos: L(0, 0, 115), yaw: 0 },          // facing into the arena; the tower is on your right
  voidY: Y0 - 30,                                 // fall below this and you're out
  area: { min: [OX - 320, Y0 - 160, OZ - 320], max: [OX + 320, Y0 + 260, OZ + 320] },
  fog: 0.0026,
  shadowHalf: 80,
  pads: PADS.map((p) => ({ at: L(...p.at), to: L(...p.to), vy: p.vy })),
  lift: { x: OX + 89.6, z: OZ + 37, w: 3, d: 3, top: Y0 + 117, bottom: Y0 },
  liftDur: 11,
  dummies: [
    { pos: L(-100, 0, 44) }, { pos: L(-96, 18, 66) }, { pos: L(-121, 4.5, 60) }, { pos: L(-84, 9, 26) },
    { pos: L(-6, 0, 70) }, { pos: L(15, 4.5, 60) }, { pos: L(-11.5, 0, 36) }, { pos: L(10, 9, 22) }, { pos: L(-20, 13.5, 30) },
    { pos: L(70, 0, 40) }, { pos: L(70, 0, 22), move: { axis: 0, range: 5, speed: 3 } },
    { pos: L(112, 27, 34) }, { pos: L(100, 54, 56) }, { pos: L(120, 90, 44) }, { pos: L(112, 117, 52) },
    { pos: L(96, 0, -46) }, { pos: L(80, 13.5, -34) }, { pos: L(118, 22.5, -70) },
    { pos: L(-16, 0, -26) }, { pos: L(2, 0, -61) }, { pos: L(16, 0, -75), move: { axis: 0, range: 6, speed: 3.5 } },
    { pos: L(-100, 0, -44) }, { pos: L(-118, 4.5, -32) }, { pos: L(-82, 13.5, -66) },
  ],
  walls: [
    { origin: L(-72.37, 0, 64), cols: 12, rows: 6, axis: 2, color: [0.62, 0.4, 0.32] },    // sector 1, east face
    { origin: L(-92, 0, -16.37), cols: 12, rows: 6, axis: 0, color: [0.66, 0.64, 0.6] },    // sector 6, south face
    { origin: L(66.03, 0, -30), cols: 12, rows: 6, axis: 2, color: [0.78, 0.76, 0.72] },    // sector 4, west face
    { origin: L(96, 0, 30.03), cols: 8, rows: 6, axis: 0, color: [0.7, 0.72, 0.74] },       // tower lobby, north face
  ],
  build(world) { this.refs = buildStadium(world); },
};

// ================================================================ geometry helpers
let W = null;
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const EPS = 1e-6;

function box(x0, y0, z0, x1, y1, z1, o = {}) {
  return W.add(makeBox([OX + Math.min(x0, x1), Y0 + Math.min(y0, y1), OZ + Math.min(z0, z1)],
    [OX + Math.max(x0, x1), Y0 + Math.max(y0, y1), OZ + Math.max(z0, z1)], { grid: false, edges: false, ...o }));
}
const deco = (x0, y0, z0, x1, y1, z1, o = {}) => box(x0, y0, z0, x1, y1, z1, { solid: false, noShadow: true, ...o });
const glow = (x0, y0, z0, x1, y1, z1, col, e = 0.9, o = {}) => deco(x0, y0, z0, x1, y1, z1, { color: col, emissive: e, ...o });

// A solid panel running along `axis` from a0 to a1 (across: c0..c1), y0..y1, minus rectangular holes [s0, s1, yb, yt].
// Columns with the same holes are merged, so a wall with a few openings is only a handful of boxes.
function panel(axis, a0, a1, c0, c1, y0, y1, holes, o) {
  const cuts = [a0, a1];
  for (const h of holes) for (const v of [h[0], h[1]]) if (v > a0 + EPS && v < a1 - EPS) cuts.push(v);
  cuts.sort((p, q) => p - q);
  const cols = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const s0 = cuts[i], s1 = cuts[i + 1];
    if (s1 - s0 < 0.01) continue;
    const hs = holes.filter((h) => h[0] <= s0 + EPS && h[1] >= s1 - EPS && h[3] > y0 && h[2] < y1)
      .map((h) => [Math.max(h[2], y0), Math.min(h[3], y1)]).sort((p, q) => p[0] - q[0]);
    const key = JSON.stringify(hs), last = cols[cols.length - 1];
    if (last && last.key === key && Math.abs(last.s1 - s0) < EPS) last.s1 = s1;
    else cols.push({ s0, s1, hs, key });
  }
  const piece = (s0, s1, yb, yt) => {
    if (yt - yb < 0.01) return;
    if (axis === 'x') box(s0, yb, c0, s1, yt, c1, o); else box(c0, yb, s0, c1, yt, s1, o);
  };
  for (const { s0, s1, hs } of cols) {
    let y = y0;
    for (const [yb, yt] of hs) { piece(s0, s1, y, yb); y = Math.max(y, yt); }
    piece(s0, s1, y, y1);
  }
}
const wallX = (x0, x1, z, t, y0, y1, holes = [], o = {}) => panel('x', x0, x1, z - t / 2, z + t / 2, y0, y1, holes, o);
const wallZ = (z0, z1, x, t, y0, y1, holes = [], o = {}) => panel('z', z0, z1, x - t / 2, x + t / 2, y0, y1, holes, o);
// four walls inside a footprint; holes: n (the -z side), s (+z), w (-x), e (+x)
function walls4(x0, z0, x1, z1, y0, y1, H = {}, o = {}, t = 0.4) {
  wallX(x0, x1, z0 + t / 2, t, y0, y1, H.n || [], o);
  wallX(x0, x1, z1 - t / 2, t, y0, y1, H.s || [], o);
  wallZ(z0 + t, z1 - t, x0 + t / 2, t, y0, y1, H.w || [], o);
  wallZ(z0 + t, z1 - t, x1 - t / 2, t, y0, y1, H.e || [], o);
}
// a floor slab over a rectangle minus holes [x0, z0, x1, z1]
function slab(x0, z0, x1, z1, y0, y1, holes = [], o = {}) {
  const cuts = [x0, x1];
  for (const h of holes) for (const v of [h[0], h[2]]) if (v > x0 + EPS && v < x1 - EPS) cuts.push(v);
  cuts.sort((p, q) => p - q);
  const strips = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const xa = cuts[i], xb = cuts[i + 1];
    if (xb - xa < 0.01) continue;
    const hs = holes.filter((h) => h[0] <= xa + EPS && h[2] >= xb - EPS)
      .map((h) => [Math.max(h[1], z0), Math.min(h[3], z1)]).filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
    const iv = [];
    let z = z0;
    for (const [a, b] of hs) { if (a > z + 0.01) iv.push([z, a]); z = Math.max(z, b); }
    if (z < z1 - 0.01) iv.push([z, z1]);
    const key = JSON.stringify(iv), last = strips[strips.length - 1];
    if (last && last.key === key && Math.abs(last.xb - xa) < EPS) last.xb = xb;
    else strips.push({ xa, xb, iv, key });
  }
  for (const { xa, xb, iv } of strips) for (const [a, b] of iv) box(xa, y0, a, xb, y1, b, o);
}

// Switchback stairs: two 1.6 m lanes side by side, a half landing at the far end, `floors` storeys high.
// (ax, az) is the near-left corner, `dir` is the way the first flight climbs ('+x', '-x', '+z', '-z');
// the lanes sit side by side toward +z (for x runs) or +x (for z runs).
// Returns the hole [x0, z0, x1, z1] each slab above must leave open.
function stairCore(ax, az, dir, y0, floors, fh = FH) {
  const s = dir[0] === '+' ? 1 : -1, alongX = dir[1] === 'x';
  const LW = 1.6, LA = 1.5, RUN = 3, LB = 1.6;
  const P = (u, v) => (alongX ? [ax + s * u, az + v] : [ax + v, az + s * u]);
  const rect = (u0, u1, v0, v1, yb, yt, o) => { const a = P(u0, v0), b = P(u1, v1); box(a[0], yb, a[1], b[0], yt, b[1], o); };
  const half = fh / 2, n = Math.max(1, Math.round(half / 0.45)), rise = half / n, run = RUN / n;
  const step = { color: C.concDark, tex: TX.CONC };
  const rail = { color: C.dark, mat: 'metal' };
  for (let k = 0; k < floors; k++) {
    const yb = y0 + k * fh, yt = yb + fh;
    for (let i = 0; i < n; i++) rect(LA + i * run, LA + (i + 1) * run, 0, LW, yb, yb + (i + 1) * rise, step);
    rect(LA + RUN, LA + RUN + LB, 0, 2 * LW, yb + half - 0.3, yb + half, step);
    for (let i = 0; i < n; i++) rect(LA + RUN - (i + 1) * run, LA + RUN - i * run, LW, 2 * LW, yb + half, yb + half + (i + 1) * rise, step);
    // railings round the stairwell on the floor above
    rect(LA, LA + RUN + LB, -0.08, 0, yt, yt + 1.05, rail);
    rect(LA, LA + RUN + LB, 2 * LW, 2 * LW + 0.08, yt, yt + 1.05, rail);
    rect(LA + RUN + LB, LA + RUN + LB + 0.08, -0.08, 2 * LW + 0.08, yt, yt + 1.05, rail);
  }
  rect(LA, LA + RUN, LW - 0.06, LW + 0.06, y0, y0 + floors * fh + 1.05, rail);   // the divider between the lanes
  const a = P(LA, 0), b = P(LA + RUN + LB, 2 * LW);
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}

// straight outdoor stairs: rise 0.5, run 0.6, from (x, z) climbing in `dir`, `width` across
function stairs(x, z, dir, width, y0, y1, o = { color: C.conc, tex: TX.CONC }) {
  const n = Math.round((y1 - y0) / 0.5), s = dir[0] === '+' ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const a = i * 0.6 * s, b = (i + 1) * 0.6 * s, top = y0 + (i + 1) * (y1 - y0) / n;
    if (dir[1] === 'x') box(x + a, y0, z - width / 2, x + b, top, z + width / 2, o);
    else box(x - width / 2, y0, z + a, x + width / 2, top, z + b, o);
  }
}

// A multi-storey building: facade walls (with holes), a floor slab per storey (minus voids and stairwells),
// stair cores, parapet, and an `inner(k, y)` callback to fit out each floor.
function building(b) {
  const fh = b.fh || FH, y0 = b.y0 || 0, top = y0 + b.floors * fh, t = 0.4;
  walls4(b.x0, b.z0, b.x1, b.z1, y0, top, b.holes || {}, { color: b.color, tex: b.tex });
  const cores = (b.cores || []).map((c) => ({ c, hole: stairCore(c.ax, c.az, c.dir, c.y0 ?? y0, c.floors ?? b.floors, fh) }));
  for (let k = 1; k <= b.floors; k++) {
    const y = y0 + k * fh;
    const holes = [...(b.voids ? b.voids(k) : []), ...cores.filter(({ c }) => k <= (c.floors ?? b.floors)).map((h) => h.hole), ...(b.extraHoles ? b.extraHoles(k) : [])];
    slab(b.x0 + t, b.z0 + t, b.x1 - t, b.z1 - t, y - 0.3, y, holes, { color: k === b.floors ? C.concDark : C.floor, tex: TX.CONC });
  }
  // polished floor finish on the ground storey
  deco(b.x0 + t, 0.001, b.z0 + t, b.x1 - t, 0.02, b.z1 - t, { color: C.floor, tex: TX.CONC, noShadow: true });
  if (b.parapet !== false) walls4(b.x0, b.z0, b.x1, b.z1, top, top + 1.1, b.parapetHoles || {}, { color: C.concDark, tex: TX.CONC }, 0.3);
  for (let k = 0; k < b.floors; k++) b.inner?.(k, y0 + k * fh);
  return top;
}

// door/window holes
const door = (c, w = 1.6, y = 0, h = 2.7) => [c - w / 2, c + w / 2, y, y + h];
const win = (c, w, y, sill = 1, h = 1.8) => [c - w / 2, c + w / 2, y + sill, y + sill + h];

// furniture and street props (rot swaps the x and z extents)
function prop(kind, x, y, z, rot = false) {
  const B = (a0, b0, c0, a1, b1, c1, o) => (rot ? box(x + c0, y + b0, z + a0, x + c1, y + b1, z + a1, o) : box(x + a0, y + b0, z + c0, x + a1, y + b1, z + c1, o));
  switch (kind) {
    case 'desk':
      B(-0.8, 0, -0.4, 0.8, 0.75, 0.4, { color: C.white, shape: 0.02 });
      B(-0.32, 0.75, 0.1, 0.32, 1.15, 0.14, { color: C.dark, mat: 'metal', solid: false });
      break;
    case 'desks':
      B(-1.7, 0, -0.8, 1.7, 0.75, 0.8, { color: C.white, shape: 0.02 });
      B(-1.4, 0.75, -0.04, 1.4, 1.2, 0.04, { color: [0.45, 0.5, 0.48], solid: false });
      break;
    case 'sofa':
      B(-1.1, 0, -0.45, 1.1, 0.45, 0.45, { color: C.fabric, shape: 0.12 });
      B(-1.1, 0.4, 0.22, 1.1, 0.95, 0.45, { color: C.fabric, shape: 0.08 });
      break;
    case 'table': B(-0.8, 0, -0.5, 0.8, 0.75, 0.5, { color: C.wood, shape: 0.02 }); break;
    case 'bed':
      B(-1, 0, -0.85, 1, 0.5, 0.85, { color: [0.9, 0.9, 0.88], shape: 0.1 });
      B(-1, 0, 0.85, 1, 1.1, 0.98, { color: C.wood });
      break;
    case 'shelf': B(-0.9, 0, -0.25, 0.9, 2.0, 0.25, { color: C.wood }); break;
    case 'plant':
      B(-0.3, 0, -0.3, 0.3, 0.55, 0.3, { color: [0.3, 0.3, 0.32], shape: 'cyl' });
      B(-0.45, 0.55, -0.45, 0.45, 1.6, 0.45, { color: C.leaf, shape: 'sphere', solid: false, noBullet: true });
      break;
    case 'counter':
      B(-1.5, 0, -0.35, 1.5, 0.95, 0.35, { color: C.white, shape: 0.02 });
      B(-1.52, 0.95, -0.37, 1.52, 1.0, 0.37, { color: C.dark });
      break;
    case 'crates':
      B(-0.6, 0, -0.6, 0.6, 1.2, 0.6, { color: [0.55, 0.43, 0.28] });
      B(0.65, 0, -0.6, 1.85, 1.2, 0.6, { color: [0.5, 0.4, 0.26] });
      B(0.1, 1.2, -0.55, 1.3, 2.4, 0.65, { color: [0.58, 0.45, 0.3] });
      break;
    case 'rack':
      B(-0.35, 0, -0.5, 0.35, 2.1, 0.5, { color: C.dark, mat: 'metal' });
      B(-0.36, 0.3, -0.42, -0.34, 1.9, 0.42, { color: [0.3, 0.9, 0.5], emissive: 0.6, solid: false, noShadow: true });
      break;
    case 'locker': B(-0.9, 0, -0.3, 0.9, 2.0, 0.3, { color: [0.4, 0.45, 0.5], mat: 'paint' }); break;
    case 'bench': B(-1, 0, -0.3, 1, 0.45, 0.3, { color: C.wood }); break;
    case 'barrier': B(-1.6, 0, -0.32, 1.6, 0.95, 0.32, { color: C.conc, tex: TX.CONC, shape: 0.15 }); break;
    case 'planter':
      B(-1.5, 0, -1.5, 1.5, 0.8, 1.5, { color: C.conc, tex: TX.CONC });
      B(-1.35, 0.8, -1.35, 1.35, 0.85, 1.35, { color: C.grass, solid: false });
      B(-0.7, 0.85, -0.7, 0.7, 2.1, 0.7, { color: C.leaf, shape: 'sphere', solid: false, noBullet: true });
      break;
    case 'tree':
      B(-0.22, 0, -0.22, 0.22, 3.4, 0.22, { color: [0.36, 0.27, 0.2], shape: 'cyl' });
      B(-2, 2.6, -2, 2, 6.4, 2, { color: C.leaf, shape: 'sphere', solid: false, noBullet: true });
      B(-1.3, 5.2, -1.4, 1.5, 7.4, 1.3, { color: [0.28, 0.46, 0.2], shape: 'sphere', solid: false, noBullet: true });
      break;
    case 'lamp':
      B(-0.1, 0, -0.1, 0.1, 6, 0.1, { color: C.dark, shape: 'cyl', mat: 'metal' });
      B(-0.15, 6, -0.6, 0.15, 6.15, 0.6, { color: C.dark });
      B(-0.12, 5.97, -0.5, 0.12, 6.0, 0.5, { color: C.light, emissive: 1, solid: false, noShadow: true });
      break;
    case 'vending':
      B(-0.5, 0, -0.45, 0.5, 2, 0.45, { color: [0.85, 0.2, 0.15], mat: 'paint' });
      B(-0.4, 0.8, 0.45, 0.4, 1.85, 0.47, { color: [0.6, 0.85, 1], emissive: 0.5, solid: false, noShadow: true });
      break;
  }
}
const ceilingLight = (x0, z0, x1, z1, y) => glow(x0, y - 0.33, z0, x1, y - 0.3, z1, C.light, 0.95);

// big sector number on a dark board, facing +z (toward the spawn)
function bigNum(n, x, y, z, h, col) {
  const w = h * 0.55;
  box(x - w / 2 - h * 0.25, y - h * 0.18, z - 0.3, x + w / 2 + h * 0.25, y + h * 1.18, z, { color: C.dark, mat: 'metal' });
  digitBoxes(String(n), OX + x - w / 2, Y0 + y, OZ + z + 0.05, h, 1, col, 0.85).forEach((b) => W.add(b));
}

// ================================================================ the arena
function buildStadium(world) {
  W = world;
  seed = 20261110;
  const refs = {};
  for (const n of [1, 2, 3, 4, 5, 6]) island(n);
  // bridges between the sectors
  bridge(-62, 47, -38, 53);     // 1 ↔ 2
  bridge(38, 47, 62, 53);       // 2 ↔ 3
  bridge(-3, 12, 3, -12);       // 2 ↔ 5
  bridge(-62, -53, -38, -47);   // 6 ↔ 5
  bridge(38, -53, 62, -47);     // 5 ↔ 4
  bridge(-103, 12, -97, -12);   // 1 ↔ 6
  bridge(-3, 88, 3, 104);       // spawn ↔ 2
  for (const p of PADS) pad(p);
  spawnDeck();
  sector1();
  sector2();
  sector3();
  sector4();
  sector5();
  sector6();
  refs.shoe = bowl();
  return refs;
}

// ---------------------------------------------------------------- islands, bridges, pads
const GAPS = {
  1: { e: [[47, 53]], n: [[-103, -97]] },
  2: { w: [[47, 53]], e: [[47, 53]], n: [[-3, 3]], s: [[-3, 3]] },
  3: { w: [[47, 53]] },
  6: { s: [[-103, -97]], e: [[-53, -47]] },
  5: { s: [[-3, 3]], w: [[-53, -47]], e: [[-53, -47]] },
  4: { w: [[-53, -47]] },
};
function island(n) {
  const [cx, cz] = SEC[n], x0 = cx - HS, x1 = cx + HS, z0 = cz - HS, z1 = cz + HS;
  box(x0, -3, z0, x1, 0, z1, { color: C.pave, tex: TX.PAVE });
  // the floating structure underneath: stepped machinery with thrusters
  box(x0 + 4, -10, z0 + 4, x1 - 4, -3, z1 - 4, { color: C.concDark, tex: TX.CONC });
  box(x0 + 12, -17, z0 + 12, x1 - 12, -10, z1 - 12, { color: [0.3, 0.31, 0.34], tex: TX.METAL });
  box(cx - 12, -23, cz - 12, cx + 12, -17, cz + 12, { color: C.dark, tex: TX.METAL });
  glow(cx - 8, -23.3, cz - 8, cx + 8, -23, cz + 8, [0.6, 0.85, 1], 1);
  // accent light line under the rim
  glow(x0 - 0.05, -1.6, z0 - 0.05, x1 + 0.05, -1.2, z1 + 0.05, ACC[n], 0.7);
  // kerb round the edge, open where bridges land
  const g = GAPS[n], o = { color: C.concDark, tex: TX.CONC };
  const holes = (k) => (g[k] || []).map(([a, b]) => [a, b, 0, 1]);
  wallX(x0, x1, z0 + 0.25, 0.5, 0, 0.6, holes('n'), o);
  wallX(x0, x1, z1 - 0.25, 0.5, 0, 0.6, holes('s'), o);
  wallZ(z0 + 0.5, z1 - 0.5, x0 + 0.25, 0.5, 0, 0.6, holes('w'), o);
  wallZ(z0 + 0.5, z1 - 0.5, x1 - 0.25, 0.5, 0, 0.6, holes('e'), o);
}
function bridge(x0, z0, x1, z1) {
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const ax0 = Math.min(x0, x1), ax1 = Math.max(x0, x1), az0 = Math.min(z0, z1), az1 = Math.max(z0, z1);
  box(ax0, -0.5, az0, ax1, 0, az1, { color: C.steel, tex: TX.METAL });
  const rail = { color: [0.7, 0.85, 0.9], alpha: 0.3, mat: [0.6, 0.05], noShadow: true };
  if (alongX) {
    const mz = (az0 + az1) / 2;
    box(ax0, -2.6, mz - 1.2, ax1, -0.5, mz + 1.2, { color: C.dark, tex: TX.METAL });
    for (const z of [az0, az1 - 0.08]) { box(ax0, 0, z, ax1, 1.05, z + 0.08, rail); box(ax0, 1.05, z - 0.02, ax1, 1.12, z + 0.1, { color: C.dark, mat: 'metal' }); }
    glow(ax0, -0.55, az0, ax1, -0.5, az0 + 0.2, C.light, 0.8);
    glow(ax0, -0.55, az1 - 0.2, ax1, -0.5, az1, C.light, 0.8);
  } else {
    const mx = (ax0 + ax1) / 2;
    box(mx - 1.2, -2.6, az0, mx + 1.2, -0.5, az1, { color: C.dark, tex: TX.METAL });
    for (const x of [ax0, ax1 - 0.08]) { box(x, 0, az0, x + 0.08, 1.05, az1, rail); box(x - 0.02, 1.05, az0, x + 0.1, 1.12, az1, { color: C.dark, mat: 'metal' }); }
    glow(ax0, -0.55, az0, ax0 + 0.2, -0.5, az1, C.light, 0.8);
    glow(ax1 - 0.2, -0.55, az0, ax1, -0.5, az1, C.light, 0.8);
  }
}
function pad({ at: [x, y, z], col }) {
  box(x - 1.6, y, z - 1.6, x + 1.6, y + 0.22, z + 1.6, { color: C.dark, tex: TX.METAL, shape: 0.08 });
  glow(x - 1.25, y + 0.22, z - 1.25, x + 1.25, y + 0.24, z + 1.25, col, 0.85);
  glow(x - 0.7, y + 0.24, z - 0.7, x + 0.7, y + 0.26, z + 0.7, [1, 1, 1], 0.9);
  for (const [a, b] of [[-1.62, -1.5], [1.5, 1.62]]) {
    glow(x + a, y + 0.05, z - 1.62, x + b, y + 0.18, z + 1.62, col, 1);
    glow(x - 1.62, y + 0.05, z + a, x + 1.62, y + 0.18, z + b, col, 1);
  }
}

// ---------------------------------------------------------------- spawn deck (behind sector 2, facing in)
function spawnDeck() {
  box(-18, -3, 104, 18, 0, 126, { color: C.pave, tex: TX.PAVE });
  box(-14, -9, 108, 14, -3, 124, { color: C.concDark, tex: TX.CONC });
  glow(-18.05, -1.6, 103.95, 18.05, -1.2, 126.05, [1, 0.25, 0.18], 0.8);
  const rail = { color: [0.7, 0.85, 0.9], alpha: 0.3, mat: [0.6, 0.05], noShadow: true };
  box(-18, 0, 104, -17.9, 1.1, 126, rail); box(17.9, 0, 104, 18, 1.1, 126, rail);
  box(-18, 0, 104, -3, 1.1, 104.1, rail); box(3, 0, 104, 18, 1.1, 104.1, rail);
  // the team gate: a big portal frame with an LED wall behind
  box(-16, 0, 124, 16, 16, 126, { color: C.dark, tex: TX.METAL });
  deco(-14, 2, 123.9, 14, 14, 124, { color: [0.95, 0.25, 0.2], tex: TX.LED, emissive: 0.55 });
  box(-17, 0, 121, -15, 18, 123, { color: C.dark, tex: TX.METAL });
  box(15, 0, 121, 17, 18, 123, { color: C.dark, tex: TX.METAL });
  box(-17, 18, 121, 17, 20, 123, { color: C.dark, tex: TX.METAL });
  glow(-15, 17.6, 120.9, 15, 18, 121, [1, 0.25, 0.18], 1);
  deco(-2, 0.001, 113, 2, 0.02, 117, { color: [0.3, 0.31, 0.34] });
  for (const x of [-6, 6]) prop('barrier', x, 0, 107);
}

// ---------------------------------------------------------------- sector 1: the court building (ring, 4 storeys, high rooftop)
function sector1() {
  const col = ACC[1];
  const court = [-114, 36, -86, 64];
  const hNW = [-124.5, 24, -119.9, 27.2];        // stairwell up to the high rooftop
  const winRow = (cs, w) => [1, 2, 3].flatMap((k) => cs.map((c) => win(c, w, k * FH)));
  building({
    x0: -128, z0: 22, x1: -72, z1: 78, floors: 4, tex: TX.OFFICE, color: C.brick,
    holes: {
      s: [[-103, -97, 0, 4.2], door(-120, 3, 0, 3.2), door(-80, 3, 0, 3.2), ...winRow([-121, -79], 3)],
      n: [door(-100, 3, 0, 3.2), ...winRow([-90, -110], 3)],
      w: [door(54, 3, 0, 3.2), ...winRow([60], 3)],
      e: [door(44, 3, 0, 3.2), [64, 70, 0, 3], ...winRow([30], 3)],
    },
    voids: () => [court],
    cores: [{ ax: -127, az: 44, dir: '+z' }, { ax: -77.6, az: 56, dir: '-z' }],
    extraHoles: (k) => (k === 4 ? [hNW] : []),
    parapetHoles: {},
    inner: (k, y) => {
      const pt = { color: C.plaster };
      const top = y + FH - 0.3;
      wallZ(22.4, 35.6, -107, 0.2, y, top, [door(29, 1.6, y)], pt);
      wallZ(22.4, 35.6, -93, 0.2, y, top, [door(29, 1.6, y)], pt);
      wallZ(64.4, 77.6, -107, 0.2, y, top, [door(71, 1.6, y)], pt);
      wallZ(64.4, 77.6, -93, 0.2, y, top, [door(71, 1.6, y)], pt);
      wallX(-127.6, -114.4, 57, 0.2, y, top, [door(-121, 1.6, y)], pt);
      wallX(-85.6, -72.4, 42, 0.2, y, top, [door(-79, 1.6, y)], pt);
      const kinds = ['desks', 'sofa', 'table', 'shelf', 'bed', 'plant', 'counter', 'crates'];
      for (const [x, z, r] of [[-120, 30, false], [-100, 26, false], [-80, 31, true], [-121, 70, false], [-100, 74, false], [-80, 72, false], [-120, 40, true], [-79, 62, true]]) {
        if (rnd() < 0.75) prop(kinds[Math.floor(rnd() * kinds.length)], x, y, z, r);
      }
      for (const [x0, z0, x1, z1] of [[-124, 28, -76, 29], [-124, 71, -76, 72], [-121.5, 38, -120.5, 62], [-79.5, 38, -78.5, 62]]) ceilingLight(x0, z0, x1, z1, y + FH);
    },
  });
  // the inner walls round the court
  const cw = [1, 2, 3].flatMap((k) => [win(-108, 2.4, k * FH), win(-92, 2.4, k * FH)]);
  const cz = [1, 2, 3].flatMap((k) => [win(42, 2.4, k * FH), win(58, 2.4, k * FH)]);
  walls4(-114.4, 35.6, -85.6, 64.4, 0, 18, {
    n: [[-103, -97, 0, 4.2], ...cw], s: [[-103, -97, 0, 4.2], ...cw],
    w: [door(50, 2.4, 0, 3.2), ...cz], e: [door(50, 2.4, 0, 3.2), ...cz],
  }, { color: [0.82, 0.8, 0.76], tex: TX.OFFICE });
  walls4(-114.4, 35.6, -85.6, 64.4, 18, 19.1, {}, { color: C.concDark, tex: TX.CONC }, 0.3);
  // the high rooftop: a 4-storey block on the north-west corner, its own stair continuing up
  walls4(-128, 22, -114, 36, 18, 36, { e: [win(29, 3, 18 + FH), win(29, 3, 18 + 2 * FH)], s: [win(-121, 3, 18 + FH), win(-121, 3, 18 + 3 * FH)] }, { color: C.brick, tex: TX.OFFICE });
  const nwHole = stairCore(-126, 24, '+x', 18, 4);
  for (let k = 1; k <= 4; k++) slab(-127.6, 22.4, -114.4, 35.6, 18 + k * FH - 0.3, 18 + k * FH, [nwHole], { color: k === 4 ? C.concDark : C.floor, tex: TX.CONC });
  walls4(-128, 22, -114, 36, 36, 37.1, {}, { color: C.concDark, tex: TX.CONC }, 0.3);
  box(-118, 36, 29, -115, 40, 32, { color: C.steel, tex: TX.METAL, shape: 'cyl' });               // water tank
  box(-118.3, 40, 28.7, -114.7, 40.3, 32.3, { color: C.dark, shape: 'cyl' });
  box(-127, 36, 33, -126.8, 46, 33.2, { color: C.dark });                                            // antenna
  glow(-127.1, 46, 32.9, -126.7, 46.4, 33.3, [1, 0.15, 0.1], 1);
  // rooftop kit on the ring
  for (const [x, z] of [[-122, 70], [-80, 26], [-78, 70]]) box(x - 1.5, 18, z - 1.2, x + 1.5, 19.6, z + 1.2, { color: C.steel, tex: TX.METAL });
  // billboard on the south roof, facing the spawn
  for (const x of [-110, -90]) box(x - 0.2, 18, 75.5, x + 0.2, 21, 75.9, { color: C.dark });
  box(-112, 21, 75.5, -88, 30, 75.9, { color: C.dark, tex: TX.METAL });
  deco(-111.5, 21.5, 75.9, -88.5, 29.5, 76, { color: col, tex: TX.LED, emissive: 0.5 });
  bigNum(1, -84, 21, 77.4, 7, col);
  // the court: asphalt, lines, hoops, bleachers, floodlights
  deco(-113.6, 0.001, 36.4, -86.4, 0.03, 63.6, { color: [0.3, 0.34, 0.42], tex: TX.ASPH });
  const line = (x0, z0, x1, z1) => deco(x0, 0.03, z0, x1, 0.035, z1, { color: C.white });
  line(-112, 38, -88, 38.12); line(-112, 61.88, -88, 62); line(-112, 38, -111.88, 62); line(-88.12, 38, -88, 62); line(-112, 49.94, -88, 50.06);
  for (const [z, s] of [[38.6, 1], [61.4, -1]]) {
    box(-100.12, 0, z - 0.12, -99.88, 3.4, z + 0.12, { color: C.dark, mat: 'metal' });
    box(-100.9, 2.9, z + s * 0.15, -99.1, 3.95, z + s * 0.22, { color: [0.95, 0.95, 0.97], alpha: 0.7, noShadow: true });
    deco(-100.23, 3.02, z + s * 0.25, -99.77, 3.06, z + s * 0.7, { color: [0.95, 0.45, 0.1], shape: 'cyl' });
  }
  for (let i = 0; i < 3; i++) box(-113.6 + i * 0.9, 0, 42, -112.7 + i * 0.9, 0.5 + i * 0.5, 58, { color: C.steel, mat: 'metal' });
  for (const [x, z] of [[-113, 37], [-87, 37], [-113, 63], [-87, 63]]) {
    box(x - 0.15, 0, z - 0.15, x + 0.15, 12, z + 0.15, { color: C.dark, mat: 'metal' });
    box(x - 0.8, 12, z - 0.5, x + 0.8, 12.8, z + 0.5, { color: C.dark });
    glow(x - 0.7, 11.97, z - 0.4, x + 0.7, 12, z + 0.4, C.light, 1);
  }
  // street side: trees, lamps, benches along the south and west
  for (const x of [-124, -110, -90, -76]) { prop('tree', x, 0, 83); prop('lamp', x + 6, 0, 84); }
  for (const z of [30, 70]) prop('tree', -133, 0, z);
  for (const x of [-117, -83]) prop('bench', x, 0, 85);
  prop('barrier', -66, 0, 30, true); prop('barrier', -66, 0, 70, true); prop('vending', -71, 0, 82);
}

// ---------------------------------------------------------------- sector 2: open two-level deck → the electric building
function sector2() {
  const col = ACC[2];
  const inner = [-26, 20, 26, 40], well = [-12, 24, 12, 36];
  const band = (y) => [[-26, -14, y + 1.2, y + 3.4], [-10, 6, y + 1.2, y + 3.4], [14, 21, y + 1.2, y + 3.4]];
  building({
    x0: -30, z0: 16, x1: 30, z1: 44, floors: 3, tex: TX.METAL, color: C.metalClad,
    holes: {
      s: [[-4, 4, 0, 6], door(-18, 3, 0, 3.2), door(18, 3, 0, 3.2), [8, 12, 4.5, 7.6], ...band(9)],
      n: [door(0, 3, 0, 3.2), ...band(9)],
      w: [door(30, 3, 0, 3.2), [22, 38, 10.2, 12.4]],
      e: [door(26, 3, 0, 3.2), [18, 34, 10.2, 12.4]],
    },
    voids: (k) => (k === 1 ? [inner] : k === 2 ? [well] : []),
    cores: [{ ax: 22, az: 43.6, dir: '-z' }],
    inner: (k, y) => {
      if (k === 0) {
        // the hall: transformers, tanks, switchgear
        for (const x of [-17, -6]) transformer(x, y, 29);
        for (const x of [6, 12]) { box(x - 1.6, y, 23, x + 1.6, y + 5, 26.2, { color: [0.55, 0.57, 0.6], tex: TX.METAL, shape: 'cyl' }); }
        for (let x = -25; x < 18; x += 2.2) if (x + 2 < -2 || x > 2) box(x, y, 16.4, x + 2, y + 2.3, 17.2, { color: [0.62, 0.64, 0.66], mat: 'paint' });
        glow(-25, y + 1.6, 17.21, 18, y + 1.7, 17.25, [0.4, 1, 0.5], 0.8);
        for (const z of [21, 39]) deco(-24, 0.03, z, 18, 0.04, z + 0.15, { color: C.yellow });
        glow(-25, y + 8.3, 29.9, 25, y + 8.45, 30.1, col, 0.9);   // cable tray light
      }
      if (k === 1) {
        // mezzanine railings round the hall (gap where the stairs come up)
        const r = { color: C.dark, mat: 'metal' };
        wallX(-26, 26, 20, 0.08, y, y + 1.05, [], r);
        wallX(-26, 26, 40, 0.08, y, y + 1.05, [[21.9, 25.3, y, y + 2]], r);
        wallZ(20, 40, -26, 0.08, y, y + 1.05, [], r);
        wallZ(20, 40, 26, 0.08, y, y + 1.05, [], r);
        for (const x of [-22, -10, 2, 14]) prop('locker', x, y, 18.4);
      }
      if (k === 2) {
        // control room round the light well
        const r = { color: C.dark, mat: 'metal' };
        wallX(-12, 12, 24, 0.08, y, y + 1.05, [], r); wallX(-12, 12, 36, 0.08, y, y + 1.05, [], r);
        wallZ(24, 36, -12, 0.08, y, y + 1.05, [], r); wallZ(24, 36, 12, 0.08, y, y + 1.05, [], r);
        for (const [x, z] of [[-22, 22], [-22, 30], [-22, 38], [17, 20], [-4, 41], [4, 19]]) prop('desks', x, y, z);
        for (let x = -26; x < -16; x += 1.2) prop('rack', x, y, 41.5, true);
        wallZ(16.4, 23.8, 0, 0.2, y, y + FH - 0.3, [door(20.5, 1.6, y)], { color: C.plaster });
      }
      ceilingLight(-24, 18, 24, 18.6, y + FH); ceilingLight(-24, 41.4, 20, 42, y + FH);
    },
  });
  // glass in the window bands
  const glass = { color: [0.55, 0.7, 0.78], alpha: 0.32, mat: [0.7, 0.05], noBullet: true, noShadow: true };
  for (const [a, b] of [[-26, -14], [-10, 6], [14, 21]]) { box(a, 10.2, 43.75, b, 12.4, 43.85, glass); box(a, 10.2, 16.15, b, 12.4, 16.25, glass); }
  box(-29.85, 10.2, 22, -29.75, 12.4, 38, glass); box(29.75, 10.2, 18, 29.85, 12.4, 34, glass);
  // painted sponsor band round the top, roof plant, the sign
  for (const [x0, z0, x1, z1] of [[-30.05, 43.95, 30.05, 44.05], [-30.05, 15.95, 30.05, 16.05]]) deco(x0, 12.7, z0, x1, 13.3, z1, { color: col });
  for (const x of [-20, -8, 4]) { box(x, 13.5, 20, x + 6, 16, 26, { color: C.steel, tex: TX.METAL }); box(x + 1, 16, 21, x + 5, 16.4, 25, { color: C.dark, shape: 'cyl' }); }
  for (const x of [-25, -22]) box(x, 13.5, 34, x + 1, 19, 35, { color: C.steel, shape: 'cyl' });
  bigNum(2, -22, 15, 42.8, 6, col);
  // outside transformer yard (east)
  transformer(34, 0, 22); transformer(34, 0, 34);
  // the open two-level deck at 4.5 m, columns, a big double-height opening, stairs up the front
  const DY = 4.5, deckVoid = [-12, 62, 12, 76];
  slab(-32, 54, 32, 82, DY - 0.35, DY, [deckVoid], { color: C.pave, tex: TX.PAVE });
  for (const x of [-30, -20, -12.6, 12.6, 20, 30]) for (const z of [55, 68, 81]) box(x - 0.5, 0, z - 0.5, x + 0.5, DY - 0.35, z + 0.5, { color: C.conc, tex: TX.CONC });
  const par = { color: [0.7, 0.85, 0.9], alpha: 0.3, mat: [0.6, 0.05], noShadow: true };
  wallX(-32, 32, 82, 0.1, DY, DY + 1.05, [[-28, -22, DY, DY + 2], [22, 28, DY, DY + 2]], par);
  wallX(-32, 32, 54, 0.1, DY, DY + 1.05, [[8, 12, DY, DY + 2]], par);
  wallZ(54, 82, -32, 0.1, DY, DY + 1.05, [], par); wallZ(54, 82, 32, 0.1, DY, DY + 1.05, [], par);
  wallX(-12, 12, 62, 0.1, DY, DY + 1.05, [], par); wallX(-12, 12, 76, 0.1, DY, DY + 1.05, [], par);
  wallZ(62, 76, -12, 0.1, DY, DY + 1.05, [], par); wallZ(62, 76, 12, 0.1, DY, DY + 1.05, [], par);
  for (const x of [-25, 25]) stairs(x, 87.4, '-z', 6, 0, DY);
  // footbridge from the deck into the building's mezzanine
  box(8, DY - 0.3, 44, 12, DY, 54, { color: C.steel, tex: TX.METAL });
  box(8, DY, 44, 8.08, DY + 1.05, 54, par); box(11.92, DY, 44, 12, DY + 1.05, 54, par);
  // on the deck: seating, planters, a kiosk
  for (const [x, z] of [[-24, 60], [24, 60], [-24, 74], [24, 74]]) prop('planter', x, DY, z);
  for (const [x, z] of [[-18, 66], [18, 66]]) prop('bench', x, DY, z, true);
  box(-30, DY, 70, -26, DY + 3, 78, { color: C.white, tex: TX.METAL });
  deco(-30.05, DY + 2.6, 69.95, -25.95, DY + 3.1, 78.05, { color: col });
  // ground level under the deck: kiosks, vending, cover, a sculpture in the opening
  for (const [x, z] of [[-26, 64], [26, 72]]) { box(x - 2, 0, z - 3, x + 2, 3, z + 3, { color: [0.82, 0.82, 0.8], tex: TX.METAL }); deco(x - 2.05, 2.5, z - 3.05, x + 2.05, 3, z + 3.05, { color: col }); }
  for (const [x, z] of [[-15, 58], [15, 58], [-15, 80], [15, 80]]) prop('vending', x, 0, z);
  for (const [x, z, r] of [[-6, 58, false], [6, 80, false], [-20, 70, true], [20, 64, true]]) prop('barrier', x, 0, z, r);
  box(-2, 0, 67, 2, 1, 71, { color: C.conc, tex: TX.CONC });
  box(-0.8, 1, 68.2, 0.8, 7, 69.8, { color: [0.85, 0.7, 0.3], mat: 'steel', shape: 0.3 });
  box(-1.8, 7, 68, 1.8, 9.2, 70, { color: [0.85, 0.7, 0.3], mat: 'steel', shape: 'sphere' });
  for (const x of [-34, 34]) for (const z of [50, 86]) prop('lamp', x, 0, z);
}
function transformer(x, y, z) {
  box(x - 2.5, y, z - 2, x + 2.5, y + 3.6, z + 2, { color: [0.48, 0.52, 0.5], tex: TX.METAL });
  for (const dz of [-2.4, 2.1]) box(x - 2.2, y + 0.3, z + dz, x + 2.2, y + 3.2, z + dz + 0.3, { color: [0.4, 0.43, 0.42], tex: TX.METAL });
  for (const dx of [-1.4, 0, 1.4]) {
    box(x + dx - 0.2, y + 3.6, z - 0.2, x + dx + 0.2, y + 5, z + 0.2, { color: [0.62, 0.38, 0.22], shape: 'cyl' });
  }
  for (let i = 0; i < 4; i++) deco(x - 2.51, y + 0.2 + i * 0.4, z - 2.01, x - 2.49, y + 0.4 + i * 0.4, z - 1.2, { color: i % 2 ? C.dark : C.yellow });
}

// ---------------------------------------------------------------- sector 3: THE TOWER + the courtyard beside it
function sector3() {
  const col = ACC[3], F = 26, T = F * FH;   // 26 storeys, roof at 117 m
  const balS = [], balW = [];
  for (let k = 2; k < F - 1; k += 3) balS.push(k);
  for (let k = 3; k < F - 1; k += 3) balW.push(k);
  building({
    x0: 92, z0: 30, x1: 126, z1: 64, floors: F, tex: TX.GLASS, color: C.glass,
    holes: {
      s: [[104, 114, 0, 4.2], ...balS.map((k) => [98, 120, k * FH, k * FH + 3.2])],
      w: [door(46, 3, 0, 3.2), ...balW.map((k) => [41, 56, k * FH, k * FH + 3.2])],
      e: [door(47, 3, 0, 3.2), ...[4, 11, 17, 22].map((k) => win(40, 4, k * FH, 1, 2))],
      n: [[96, 100, 0, 3], door(118.5, 3, 0, 3.2), ...[6, 13, 20].map((k) => win(110, 4, k * FH, 1, 2))],
    },
    cores: [{ ax: 105, az: 51.4, dir: '+x' }],
    parapetHoles: { w: [[35.5, 38.5, T, T + 2]] },
    inner: (k, y) => {
      const top = y + FH - 0.3, pt = { color: C.plaster };
      if (k === 0) {
        // the lobby: reception, seating, lift doors on the core
        prop('counter', 109, y, 58);
        prop('sofa', 98, y, 58); prop('sofa', 120, y, 40, true); prop('plant', 95, y, 61); prop('plant', 123, y, 61);
        for (const x of [106, 109.5]) deco(x, y, 42.9, x + 2.2, y + 2.8, 43, { color: [0.7, 0.72, 0.75], mat: 'steel' });
        glow(105, y + 3, 42.89, 113, y + 3.2, 42.9, col, 0.9);
      } else {
        // apartments: partitions round the core with doorways (layout alternates floor to floor)
        const a = k % 2;
        wallX(92.4, 105, a ? 37 : 39, 0.2, y, top, [door(a ? 99 : 101, 1.6, y)], pt);
        wallZ(30.4, 43, a ? 118 : 116, 0.2, y, top, [door(37, 1.6, y)], pt);
        wallX(113, 125.6, a ? 58 : 56, 0.2, y, top, [door(a ? 119 : 121, 1.6, y)], pt);
        wallZ(51, 63.6, a ? 99 : 101, 0.2, y, top, [door(57, 1.6, y)], pt);
        const kinds = ['sofa', 'bed', 'table', 'counter', 'shelf', 'plant', 'desk'];
        for (const [x, z, r] of [[96, 33, false], [122, 34, true], [121, 61, false], [95, 56, true]]) prop(kinds[Math.floor(rnd() * kinds.length)], x, y, z, r);
      }
      ceilingLight(95, 46.8, 103, 47.3, y + FH); ceilingLight(115, 46.8, 123, 47.3, y + FH);
      ceilingLight(108, 33, 110, 40, y + FH);
    },
  });
  // the service core (lift shafts) through every floor
  box(105, 0, 43, 113, T + 3, 51, { color: C.conc, tex: TX.CONC });
  // structural corner columns standing proud of the glass, and a crown band per 10 floors
  for (const [x, z] of [[92, 30], [126, 30], [92, 64], [126, 64]]) box(x - 0.9, 0, z - 0.9, x + 0.9, T + 1.1, z + 0.9, { color: C.conc, tex: TX.CONC });
  for (const y of [45, 90]) walls4(91.8, 29.8, 126.2, 64.2, y - 0.6, y, {}, { color: C.concDark, tex: TX.CONC }, 0.25);
  // balconies (south: facing the spawn, west: over the courtyard)
  const rail = { color: [0.7, 0.85, 0.9], alpha: 0.3, mat: [0.6, 0.05], noShadow: true };
  for (const k of balS) {
    const y = k * FH;
    box(98, y - 0.3, 64, 120, y, 66.8, { color: C.conc, tex: TX.CONC });
    box(98, y, 66.7, 120, y + 1.1, 66.8, rail); box(98, y, 64, 98.1, y + 1.1, 66.8, rail); box(119.9, y, 64, 120, y + 1.1, 66.8, rail);
    glow(98, y - 0.35, 66.6, 120, y - 0.3, 66.8, col, 0.8);
  }
  for (const k of balW) {
    const y = k * FH;
    box(89.2, y - 0.3, 41, 92, y, 56, { color: C.conc, tex: TX.CONC });
    box(89.2, y, 41, 89.3, y + 1.1, 56, rail); box(89.2, y, 41, 92, y + 1.1, 41.1, rail); box(89.2, y, 55.9, 92, y + 1.1, 56, rail);
  }
  // entrance canopy
  box(101, 4.2, 64, 117, 4.6, 70, { color: C.dark, tex: TX.METAL });
  for (const x of [101.5, 116.5]) box(x - 0.15, 0, 69.4, x + 0.15, 4.2, 69.7, { color: C.dark, mat: 'metal' });
  glow(101, 4.15, 64, 117, 4.2, 70, C.light, 0.7);
  // LED banner down the south face
  deco(120.6, 30, 64, 124.6, 100, 64.35, { color: col, tex: TX.LED, emissive: 0.55 });
  bigNum(3, 109, 101, 64.6, 10, col);
  // the crown: steel fins, ring frames, helipad, antenna with a beacon
  const M = { color: C.steel, tex: TX.METAL };
  for (const [x, z] of [[92, 30], [126, 30], [92, 64], [126, 64]]) box(x - 0.6, T + 1.1, z - 0.6, x + 0.6, T + 20, z + 0.6, M);
  for (const y of [T + 9, T + 19]) {
    box(91.4, y, 29.4, 126.6, y + 1, 30.6, M); box(91.4, y, 63.4, 126.6, y + 1, 64.6, M);
    box(91.4, y, 30.6, 92.6, y + 1, 63.4, M); box(125.4, y, 30.6, 126.6, y + 1, 63.4, M);
    glow(91.35, y - 0.12, 29.35, 126.65, y, 64.65, col, 0.9);
  }
  deco(100, T + 0.001, 41, 118, T + 0.03, 59, { color: [0.2, 0.21, 0.23], tex: TX.ASPH });
  for (const [x0, z0, x1, z1] of [[105, 46, 106, 54], [112, 46, 113, 54], [106, 49.5, 112, 50.5]]) deco(x0, T + 0.03, z0, x1, T + 0.04, z1, { color: C.white });
  for (const [x0, z0, x1, z1] of [[100, 41, 118, 41.2], [100, 58.8, 118, 59], [100, 41, 100.2, 59], [117.8, 41, 118, 59]]) glow(x0, T + 0.03, z0, x1, T + 0.05, z1, C.yellow, 0.7);
  box(122, T, 32, 124, T + 2, 34, { color: C.dark, tex: TX.METAL });
  box(122.8, T + 2, 32.8, 123.2, T + 40, 33.2, { color: C.dark, mat: 'metal' });
  glow(122.6, T + 40, 32.6, 123.4, T + 40.8, 33.4, [1, 0.15, 0.1], 1);
  // the outside lift (the car is built in main.js): landing plate at the roof, rails down the west face
  box(91.1, T - 0.3, 35.5, 92.4, T, 38.5, { color: C.steel, tex: TX.METAL });
  for (const z of [35.3, 38.6]) box(87.6, 0, z - 0.1, 87.8, T + 3.4, z + 0.1, { color: C.dark, solid: false, mat: 'metal' });
  for (let y = 9; y < T; y += 9) box(87.6, y, 35.2, 87.8, y + 0.25, 38.8, { color: C.dark, solid: false });
  glow(87.55, 0, 36.9, 87.6, T, 37.1, col, 0.8);

  // the courtyard: paving with planting beds, a fountain, trees, a café pavilion with a roof terrace
  deco(63, 0.001, 13, 90, 0.02, 87, { color: [0.74, 0.72, 0.68], tex: TX.PAVE });
  box(70, 0, 44, 80, 0.7, 54, { color: C.conc, tex: TX.CONC, shape: 'cyl' });
  glow(70.8, 0.7, 44.8, 79.2, 0.72, 53.2, [0.45, 0.75, 0.9], 0.35, { alpha: 0.8 });
  box(74.5, 0.7, 48.5, 75.5, 3.2, 49.5, { color: C.steel, mat: 'steel', shape: 'cyl' });
  for (const [x, z] of [[67, 20], [83, 20], [67, 34], [83, 34], [67, 62], [86, 62]]) prop('tree', x, 0, z);
  for (const [x, z] of [[75, 28], [75, 40], [85, 46]]) prop('planter', x, 0, z);
  for (const [x, z, r] of [[66, 49, true], [84, 49, true], [75, 58, false]]) prop('bench', x, 0, z, r);
  for (const [x, z] of [[64, 16], [64, 44], [88, 16], [88, 70]]) prop('lamp', x, 0, z);
  building({
    x0: 64, z0: 70, x1: 80, z1: 86, floors: 1, tex: TX.GLASS, color: [0.55, 0.66, 0.68],
    holes: { e: [door(78, 3, 0, 3.2)], s: [door(72, 3, 0, 3.2)], n: [door(68, 2, 0, 3)] },
    parapetHoles: { e: [[79.6, 82.6, 4.5, 6]] },
    inner: (k, y) => { prop('counter', 72, y, 73); for (const [x, z] of [[67, 80], [71, 82], [76, 79]]) prop('table', x, y, z); ceilingLight(66, 77, 78, 78, y + FH); },
  });
  box(80, 4.2, 79.6, 84, 4.5, 82.6, { color: C.conc, tex: TX.CONC });
  stairs(82.5, 87.4, '-z', 3, 0, 4.5);
  deco(63.9, 3.2, 69.9, 80.1, 3.6, 86.1, { color: ACC[3] });
  for (const [x, z] of [[68, 74], [75, 82]]) { box(x - 0.05, 4.5, z - 0.05, x + 0.05, 6.8, z + 0.05, { color: C.dark }); box(x - 1.4, 6.8, z - 1.4, x + 1.4, 7.1, z + 1.4, { color: C.white, solid: false, shape: 0.12 }); }
  // the plaza in front of the tower and along the east edge
  for (const [x, z, r] of [[100, 78, false], [118, 78, false], [131, 40, true], [131, 56, true]]) prop('barrier', x, 0, z, r);
  for (const [x, z] of [[96, 84], [122, 84], [132, 20]]) prop('tree', x, 0, z);
  for (const [x, z] of [[104, 82], [114, 82]]) prop('planter', x, 0, z);
}

// ---------------------------------------------------------------- sector 4: the giant building, a launch pad in the atrium
function sector4() {
  const col = ACC[4], F = 5, T = F * FH;
  const atrium = [88, -62, 112, -38];
  const upS = [1, 2, 3, 4].flatMap((k) => [win(83, 6, k * FH), win(117, 6, k * FH)]);
  const upW = [1, 2, 3, 4].flatMap((k) => [win(-68, 6, k * FH), win(-50, 4, k * FH)]);
  building({
    x0: 66, z0: -84, x1: 134, z1: -16, floors: F, tex: TX.OFFICE, color: C.office,
    holes: {
      n: [door(86, 4, 0, 4), door(114, 4, 0, 4), ...upS],
      s: [[96, 104, 0, 4.5], door(74, 4, 0, 4), door(118, 4, 0, 4), ...upS],
      w: [door(-50, 4, 0, 4), [-30, -24, 0, 3], ...upW],
      e: [door(-50, 4, 0, 4), door(-28, 4, 0, 4), ...upW],
    },
    voids: () => [atrium],
    cores: [{ ax: 70, az: -82, dir: '+x' }, { ax: 130, az: -21.4, dir: '-x' }],
    inner: (k, y) => {
      const top = y + FH - 0.3, pt = { color: C.plaster };
      wallZ(-83.6, -62, 88, 0.2, y, top, [door(-72, 1.8, y)], pt);
      wallZ(-83.6, -62, 112, 0.2, y, top, [door(-72, 1.8, y)], pt);
      wallZ(-38, -16.4, 88, 0.2, y, top, [door(-28, 1.8, y)], pt);
      wallZ(-38, -16.4, 112, 0.2, y, top, [door(-28, 1.8, y)], pt);
      wallX(66.4, 88, -50, 0.2, y, top, [door(80, 1.8, y)], pt);
      wallX(112, 133.6, -50, 0.2, y, top, [door(120, 1.8, y)], pt);
      if (k > 0) {
        // balconies round the atrium on every floor
        const r = { color: [0.7, 0.85, 0.9], alpha: 0.3, mat: [0.6, 0.05], noShadow: true };
        wallX(88, 112, -62, 0.08, y, y + 1.05, [], r); wallX(88, 112, -38, 0.08, y, y + 1.05, [], r);
        wallZ(-62, -38, 88, 0.08, y, y + 1.05, [], r); wallZ(-62, -38, 112, 0.08, y, y + 1.05, [], r);
        glow(88, y - 0.35, -62.1, 112, y - 0.3, -61.9, col, 0.8);
      }
      for (const [x, z, r] of [[76, -70, false], [100, -76, false], [124, -70, false], [76, -30, false], [100, -24, false], [124, -30, false], [76, -44, true], [124, -56, true]]) {
        if (rnd() < 0.8) prop(rnd() < 0.6 ? 'desks' : ['shelf', 'sofa', 'plant', 'counter'][Math.floor(rnd() * 4)], x, y, z, r);
      }
      for (const [x0, z0, x1, z1] of [[70, -73, 130, -72.4], [70, -27.6, 130, -27], [76.5, -60, 77.1, -40], [122.9, -60, 123.5, -40]]) ceilingLight(x0, z0, x1, z1, y + FH);
    },
  });
  for (const [x, z] of [[88, -62], [112, -62], [88, -38], [112, -38]]) box(x - 0.5, 0, z - 0.5, x + 0.5, T, z + 0.5, { color: C.conc, tex: TX.CONC });
  glow(87.9, T - 0.4, -62.1, 112.1, T - 0.25, -37.9, col, 0.9);
  walls4(88, -62, 112, -38, T, T + 1.1, {}, { color: C.concDark, tex: TX.CONC }, 0.3);
  // the atrium floor: pad in the middle, planters round it
  deco(89, 0.001, -61, 111, 0.025, -39, { color: [0.62, 0.6, 0.58], tex: TX.PAVE });
  for (const [x, z] of [[92, -58], [108, -58], [92, -42], [108, -42]]) prop('planter', x, 0, z);
  // corner glass towers on the facade and a sponsor band
  for (const [x0, z0] of [[65.8, -84.2], [131.2, -84.2], [65.8, -18.8], [131.2, -18.8]]) box(x0, 0, z0, x0 + 3, T + 2, z0 + 3, { color: C.glass, tex: TX.GLASS });
  for (const [x0, z0, x1, z1] of [[66, -16.05, 134, -15.9], [66, -84.1, 134, -83.95]]) deco(x0, T - 1.6, z0, x1, T - 0.9, z1, { color: col });
  // roof: plant, a big LED billboard facing the spawn, the sign
  for (const [x, z] of [[74, -76], [124, -76], [74, -50], [126, -44]]) box(x - 2, T, z - 1.5, x + 2, T + 2, z + 1.5, { color: C.steel, tex: TX.METAL });
  for (const x of [80, 120]) box(x - 0.25, T, -21, x + 0.25, T + 4, -20.5, { color: C.dark });
  box(76, T + 4, -21, 122, T + 16, -20.5, { color: C.dark, tex: TX.METAL });
  deco(77, T + 5, -20.5, 121, T + 15, -20.4, { color: col, tex: TX.LED, emissive: 0.5 });
  bigNum(4, 129, T + 5, -20.3, 7, col);
  // outside: cover on the open ground
  for (const [x, z, r] of [[78, -10, false], [100, -6, false], [122, -10, false], [137, -50, true]]) prop('barrier', x, 0, z, r);
  for (const [x, z] of [[70, -8], [130, -8]]) prop('tree', x, 0, z);
  for (const [x, z] of [[90, -10], [110, -10]]) prop('lamp', x, 0, z);
}

// ---------------------------------------------------------------- sector 5: the vault (bank building on an open plaza)
function sector5() {
  const col = ACC[5], stone = [0.82, 0.78, 0.7];
  const hall = [-19.6, -52, 19.6, -40.4];
  building({
    x0: -20, z0: -70, x1: 20, z1: -40, floors: 2, tex: TX.CONC, color: stone,
    holes: {
      s: [door(-8, 3, 0, 4), door(0, 3, 0, 4), door(8, 3, 0, 4), [-17, -13, 1, 8], [13, 17, 1, 8]],
      n: [door(0, 3, 0, 3.2), win(-12, 3, 4.5, 1, 2), win(12, 3, 4.5, 1, 2)],
      w: [door(-58, 3, 0, 3.2), [-48, -44, 1, 8], win(-64, 3, 4.5, 1, 2)],
      e: [[-48, -44, 1, 8], win(-64, 3, 4.5, 1, 2), win(-58, 3, 0, 1, 2)],
    },
    voids: (k) => (k === 1 ? [hall] : []),
    cores: [{ ax: 12, az: -53, dir: '-z' }],
    inner: (k, y) => {
      if (k === 0) {
        // banking hall: teller counter, queue posts, benches
        prop('counter', -6, y, -50); prop('counter', 6, y, -50, false);
        for (const x of [-12, 12]) prop('bench', x, y, -44);
        for (let x = -4; x <= 4; x += 2) box(x - 0.06, y, -46.06, x + 0.06, y + 1, -45.94, { color: [0.8, 0.7, 0.35], mat: 'steel' });
        // the vault: thick steel walls, an open door, the cashout station and its beam
        const V = { color: [0.3, 0.32, 0.36], tex: TX.METAL };
        walls4(-8, -68, 8, -55, y, y + 4.2, { s: [door(0, 3, y, 3.2)] }, V, 1);
        box(1.6, y, -55, 2.2, y + 3.6, -51.4, { color: [0.55, 0.57, 0.6], mat: 'steel', shape: 0.25 });
        for (let i = 0; i < 6; i++) {
          const c = i % 2 ? C.dark : C.yellow;
          deco(-2, y + i * 0.55, -54.98, -1.6, y + (i + 1) * 0.55, -54.9, { color: c });
          deco(1.6, y + i * 0.55, -54.98, 2, y + (i + 1) * 0.55, -54.9, { color: c });
        }
        glow(-2, y + 3.4, -54.98, 2, y + 3.6, -54.9, col, 1);
        box(-1.2, y, -62.2, 1.2, y + 1.1, -59.8, { color: C.dark, tex: TX.METAL });
        glow(-0.9, y + 1.1, -61.9, 0.9, y + 1.16, -60.1, col, 1);
        glow(-0.5, y + 1.16, -61.5, 0.5, y + 60, -60.5, col, 1, { alpha: 0.25, noBullet: true });
        for (const [x, z] of [[-5, -66], [5, -66], [-5, -58]]) prop('crates', x, y, z);
        glow(-7, y + 4.15, -67, 7, y + 4.2, -66.6, C.light, 0.9);
        ceilingLight(-16, -46.5, 16, -45.9, y + 2 * FH);
      } else {
        // offices over the vault, a gallery overlooking the hall
        wallX(-19.6, 19.6, -52, 0.08, y, y + 1.05, [], { color: C.dark, mat: 'metal' });
        wallZ(-69.6, -52, -6, 0.2, y, y + FH - 0.3, [door(-60, 1.6, y)], { color: C.plaster });
        for (const [x, z] of [[-14, -64], [-14, -57], [0, -64], [4, -58]]) prop('desk', x, y, z);
        prop('shelf', -18, y, -68, false); prop('plant', 18, y, -68);
      }
      ceilingLight(-16, -62, 10, -61.4, y + FH);
    },
  });
  // portico on the plaza side: columns, entablature, the sign
  for (const x of [-15, -9, -3, 3, 9, 15]) {
    box(x - 0.7, 0, -37.7, x + 0.7, 8.4, -36.3, { color: stone, shape: 'cyl' });
    box(x - 0.9, 0, -37.9, x + 0.9, 0.4, -36.1, { color: stone, tex: TX.CONC });
  }
  box(-18, 8.4, -40, 18, 9.9, -35, { color: stone, tex: TX.CONC });
  box(-16, 9.9, -40, 16, 11, -36.5, { color: stone, tex: TX.CONC });
  deco(-14, 8.9, -34.98, 14, 9.5, -34.9, { color: col });
  bigNum(5, 0, 12, -38, 5, col);
  box(-6, 9, -66, 6, 9.6, -56, { color: [0.6, 0.75, 0.82], alpha: 0.45, mat: [0.6, 0.05], noShadow: true });   // skylight
  // the open ground round the vault: cover, an armoured truck, a statue, lamps
  for (const [x, z, r] of [[-30, -24, false], [30, -24, false], [-30, -78, false], [30, -78, false], [-26, -55, true], [26, -55, true], [-10, -26, false], [10, -26, false]]) prop('barrier', x, 0, z, r);
  for (const [x, z] of [[-32, -40], [32, -40], [-32, -66], [32, -66], [-12, -80], [12, -80]]) prop('planter', x, 0, z);
  box(18, 0, -30, 25, 2.8, -27.2, { color: [0.3, 0.33, 0.3], tex: TX.METAL, shape: 0.2 });
  box(25, 0, -30, 27.5, 2.2, -27.2, { color: [0.3, 0.33, 0.3], tex: TX.METAL, shape: 0.2 });
  box(25.5, 1.3, -30.02, 27.3, 2.0, -27.18, { color: [0.15, 0.2, 0.24], mat: [0.8, 0.1], solid: false });
  for (const x of [19.5, 23.5, 26.3]) for (const z of [-30.15, -27.05]) box(x - 0.5, 0, z - 0.1, x + 0.5, 1, z + 0.1, { color: C.dark, solid: false });
  box(-24, 0, -32, -20, 1.6, -28, { color: stone, tex: TX.CONC });
  box(-23, 1.6, -31, -21, 2.4, -29, { color: [0.75, 0.6, 0.3], mat: 'steel' });
  box(-22.6, 2.4, -30.6, -21.4, 4.6, -29.4, { color: [0.75, 0.6, 0.3], mat: 'steel', shape: 0.3 });
  box(-22.5, 4.6, -30.5, -21.5, 5.5, -29.5, { color: [0.75, 0.6, 0.3], mat: 'steel', shape: 'sphere' });
  for (const [x, z] of [[-34, -20], [34, -20], [-34, -84], [34, -84], [0, -84]]) prop('lamp', x, 0, z);
  for (const x of [-6, -2, 2, 6]) box(x - 0.2, 0, -33.2, x + 0.2, 0.9, -32.8, { color: C.dark, shape: 'cyl', mat: 'metal' });
}

// ---------------------------------------------------------------- sector 6: the maze (tight corridors, many rooms, 3 storeys)
function sector6() {
  const col = ACC[6], F = 3;
  const GX = [-122.67, -111.33, -88.67, -77.33], GZ = [-72.67, -61.33, -38.67, -27.33];
  const CX = [-101.4, -98.6], CZ = [-51.4, -48.6];       // the two crossing corridors
  building({
    x0: -134, z0: -84, x1: -66, z1: -16, floors: F, tex: TX.OFFICE, color: [0.64, 0.62, 0.6],
    holes: {
      s: [door(-116.5, 3, 0, 3.2), door(-83.5, 3, 0, 3.2), [CX[0], CX[1], 0, 3], [-92, -86, 0, 3], win(-128, 3, 4.5), win(-72, 3, 9)],
      n: [[CX[0], CX[1], 0, 3], door(-118.5, 3, 0, 3.2), win(-80, 3, 4.5), win(-128, 3, 9)],
      w: [[CZ[0], CZ[1], 0, 3], win(-30, 3, 4.5), win(-70, 3, 9)],
      e: [[CZ[0], CZ[1], 0, 3], win(-24, 3, 9), win(-76, 3, 4.5)],
    },
    cores: [{ ax: -132, az: -82, dir: '+x' }, { ax: -68, az: -21.6, dir: '-x' }],
    inner: (k, y) => {
      const top = y + FH - 0.3, pt = { color: [0.82, 0.8, 0.76] };
      // the corridors: lined both sides, a door into every room, ceiling lights down the middle
      const segZ = [-83.6, ...GZ.slice(0, 2), CZ[0], CZ[1], ...GZ.slice(2), -16.4];
      const segX = [-133.6, ...GX.slice(0, 2), CX[0], CX[1], ...GX.slice(2), -66.4];
      const corrDoors = (segs, cross) => {
        const h = [[cross[0], cross[1], y, top]];
        for (let i = 0; i < segs.length - 1; i++) {
          const a = segs[i], b = segs[i + 1];
          if (a === cross[0]) continue;
          h.push(door(a + 1.6 + rnd() * (b - a - 3.2), 1.4, y, 2.6));
        }
        return h;
      };
      for (const x of CX) wallZ(-83.6, -16.4, x, 0.25, y, top, corrDoors(segZ, CZ), pt);
      for (const z of CZ) wallX(-133.6, -66.4, z, 0.25, y, top, corrDoors(segX, CX), pt);
      // room walls on the grid: each stretch gets a doorway, is left open, or is solid
      const roomHoles = (segs, cross) => {
        const h = [[cross[0] - 0.01, cross[1] + 0.01, y, top]];
        for (let i = 0; i < segs.length - 1; i++) {
          const a = segs[i], b = segs[i + 1];
          if (a === cross[0]) continue;
          const r = rnd();
          if (r < 0.62) { const c = a + 1.4 + rnd() * (b - a - 2.8); h.push([c - 0.7, c + 0.7, y, top]); }
          else if (r < 0.8) h.push([a + 1.5, b - 1.5, y, top]);
        }
        return h;
      };
      for (const x of GX) wallZ(-83.6, -16.4, x, 0.25, y, top, roomHoles(segZ, CZ), pt);
      for (const z of GZ) wallX(-133.6, -66.4, z, 0.25, y, top, roomHoles(segX, CX), pt);
      ceilingLight(-100.3, -83, -99.7, -17, y + FH); ceilingLight(-133, -50.3, -67, -49.7, y + FH);
      // the rooms: crates, shelves, desks, racks
      const kinds = ['crates', 'shelf', 'desk', 'rack', 'locker', 'table', 'bed', 'sofa'];
      for (let i = 0; i < 12; i++) {
        const cx = [-128, -117, -106, -94, -83, -72][Math.floor(rnd() * 6)], cz = [-78, -67, -56, -44, -33, -22][Math.floor(rnd() * 6)];
        if ((cx === -128 && cz === -78) || (cx === -72 && cz === -22)) continue;   // stairwells
        prop(kinds[Math.floor(rnd() * kinds.length)], cx + (rnd() - 0.5) * 4, y, cz + (rnd() - 0.5) * 4, rnd() < 0.5);
      }
      for (const [cx, cz] of [[-117, -67], [-83, -33], [-117, -33], [-83, -67]]) ceilingLight(cx - 2, cz - 0.3, cx + 2, cz + 0.3, y + FH);
    },
  });
  // roof: plant, skylights, a water tower, the sign
  const T = F * FH;
  for (const [x, z] of [[-124, -74], [-80, -70], [-120, -30]]) box(x - 2, T, z - 1.5, x + 2, T + 2, z + 1.5, { color: C.steel, tex: TX.METAL });
  for (const [x, z] of [[-110, -60], [-90, -40]]) box(x - 3, T, z - 3, x + 3, T + 0.8, z + 3, { color: [0.55, 0.7, 0.78], alpha: 0.45, mat: [0.6, 0.05] });
  for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) box(-75 + dx - 0.15, T, -78 + dz - 0.15, -75 + dx + 0.15, T + 5, -78 + dz + 0.15, { color: C.dark });
  box(-77.5, T + 5, -80.5, -72.5, T + 9, -75.5, { color: [0.45, 0.32, 0.22], shape: 'cyl' });
  deco(-134.05, T - 1.6, -16.1, -65.95, T - 0.9, -15.95, { color: col });
  bigNum(6, -100, T + 1.5, -17.5, 6, col);
  // outside
  for (const [x, z, r] of [[-120, -9, false], [-80, -9, false], [-137, -30, true], [-137, -70, true]]) prop('barrier', x, 0, z, r);
  for (const [x, z] of [[-130, -10], [-70, -10]]) prop('tree', x, 0, z);
}

// ---------------------------------------------------------------- the stadium bowl round the void
function bowl() {
  const XI = 178, ZN = -132, ZS = 152, N = 22, DEP = 2.6, RISE = 1.6, YB = -14, BACK = N * DEP + 4;
  const seat = { color: [0.24, 0.26, 0.31], tex: TX.SEATS };
  for (let i = 0; i < N; i++) {
    const top = YB + (i + 1) * RISE, o = i * DEP;
    box(-XI - BACK, -60, ZN - o, -XI - o, top, ZS + o, seat);
    box(XI + o, -60, ZN - o, XI + BACK, top, ZS + o, seat);
    box(-XI - o, -60, ZN - BACK, XI + o, top, ZN - o, seat);
    box(-XI - o, -60, ZS + o, XI + o, top, ZS + BACK, seat);
  }
  // LED ribbon boards along the front of the lower tier
  const rib = { tex: TX.LED, emissive: 0.5 };
  deco(-XI - 0.1, YB - 0.2, ZN, -XI, YB + 1.5, ZS, { color: [0.95, 0.3, 0.2], ...rib });
  deco(XI, YB - 0.2, ZN, XI + 0.1, YB + 1.5, ZS, { color: [0.95, 0.3, 0.2], ...rib });
  deco(-XI, YB - 0.2, ZN - 0.1, XI, YB + 1.5, ZN, { color: [0.95, 0.3, 0.2], ...rib });
  deco(-XI, YB - 0.2, ZS, XI, YB + 1.5, ZS + 0.1, { color: [0.95, 0.3, 0.2], ...rib });
  // hospitality boxes round the top, the back wall, the roof canopy with floodlights under its edge
  const TOPY = YB + N * RISE, CAN = TOPY + 26, IN = 30;
  const xo = XI + BACK, zn = ZN - BACK, zs = ZS + BACK;
  const back = { color: [0.3, 0.31, 0.34], tex: TX.METAL };
  box(-xo - 2, TOPY - 4, zn - 2, -xo, CAN, zs + 2, back); box(xo, TOPY - 4, zn - 2, xo + 2, CAN, zs + 2, back);
  box(-xo, TOPY - 4, zn - 2, xo, CAN, zn, back); box(-xo, TOPY - 4, zs, xo, CAN, zs + 2, back);
  const boxes = { color: C.glass, tex: TX.GLASS };
  box(-xo, TOPY, zn, -xo + 6, TOPY + 9, zs, boxes); box(xo - 6, TOPY, zn, xo, TOPY + 9, zs, boxes);
  box(-xo + 6, TOPY, zn, xo - 6, TOPY + 9, zn + 6, boxes); box(-xo + 6, TOPY, zs - 6, xo - 6, TOPY + 9, zs, boxes);
  const roof = { color: [0.86, 0.87, 0.9], tex: TX.METAL, noShadow: true };
  const ix = XI + IN, izn = ZN - IN, izs = ZS + IN;
  box(-xo - 2, CAN, zn - 2, -ix, CAN + 2, zs + 2, roof); box(ix, CAN, zn - 2, xo + 2, CAN + 2, zs + 2, roof);
  box(-ix, CAN, zn - 2, ix, CAN + 2, izn, roof); box(-ix, CAN, izs, ix, CAN + 2, zs + 2, roof);
  glow(-ix, CAN - 0.4, izn, -ix + 2, CAN, izs, C.light, 1); glow(ix - 2, CAN - 0.4, izn, ix, CAN, izs, C.light, 1);
  glow(-ix, CAN - 0.4, izn, ix, CAN, izn + 2, C.light, 1); glow(-ix, CAN - 0.4, izs - 2, ix, CAN, izs, C.light, 1);
  for (let x = -ix + 20; x < ix; x += 40) { deco(x - 0.6, CAN - 3, zn, x + 0.6, CAN, izn + 2, { color: C.dark }); deco(x - 0.6, CAN - 3, izs - 2, x + 0.6, CAN, zs, { color: C.dark }); }
  for (let z = izn + 20; z < izs; z += 40) { deco(-xo, CAN - 3, z - 0.6, -ix + 2, CAN, z + 0.6, { color: C.dark }); deco(ix - 2, CAN - 3, z - 0.6, xo, CAN, z + 0.6, { color: C.dark }); }
  // giant screens hung under the canopy at both ends
  for (const [z, s] of [[izn + 6, 1], [izs - 6, -1]]) {
    deco(-36, CAN - 30, z - 1, 36, CAN - 4, z + 1, { color: C.dark });
    deco(-34, CAN - 28, z + s * 1.02, 34, CAN - 6, z + s * 1.08, { color: [0.25, 0.5, 1], tex: TX.LED, emissive: 0.55 });
  }
  // the centre-hung scoreboard
  const cy = 74;
  box(-11, cy, -11, 11, cy + 13, 11, { color: C.dark, tex: TX.METAL, noShadow: true });
  for (const [a, b, c, d] of [[-10, 11, 10, 11.1], [-10, -11.1, 10, -11]]) deco(a, cy + 1, b, c, cy + 12, d, { color: [0.3, 0.55, 1], tex: TX.LED, emissive: 0.6 });
  for (const [a, b, c, d] of [[11, -10, 11.1, 10], [-11.1, -10, -11, 10]]) deco(a, cy + 1, b, c, cy + 12, d, { color: [0.3, 0.55, 1], tex: TX.LED, emissive: 0.6 });
  glow(-11.05, cy - 0.4, -11.05, 11.05, cy, 11.05, [1, 0.25, 0.18], 1);
  // the holographic sneaker floating over the arena
  const H = (x0, y0, z0, x1, y1, z1, c, shape) => glow(x0, y0, z0, x1, y1, z1, c, 0.85, { alpha: 0.3, noBullet: true, shape });
  const sy = 44, cyan = [0.35, 0.9, 1], pink = [1, 0.35, 0.8];
  const shoe = [
    H(-15, sy, -5, 15, sy + 2.4, 5, [0.85, 0.95, 1], 1.1),
    H(-15, sy + 2.4, -5.1, 15, sy + 3.2, 5.1, pink, 0.35),
    H(-12, sy + 3.2, -4.6, 8, sy + 10, 4.6, cyan, 2),
    H(5, sy + 2.6, -4.7, 15.4, sy + 7.6, 4.7, cyan, 'sphere'),
    H(-15.3, sy + 2.8, -4.2, -8, sy + 13, 4.2, cyan, 1.6),
    H(-6, sy + 9, -3.2, 1, sy + 14.5, 3.2, [0.6, 0.95, 1], 1.2),
    H(-8, sy + 5, -4.75, 4, sy + 7, 4.75, pink, 0.5),
    ...[-3.5, -1, 1.5, 4].map((x) => H(x - 0.3, sy + 10.1, -3.4, x + 0.3, sy + 10.5, 3.4, [1, 1, 1], 0.12)),
  ];
  // the void: a dark floor far below with faint seams
  deco(-400, -120, -400, 400, -118, 420, { color: [0.05, 0.06, 0.08] });
  for (const z of [-60, 0, 60]) glow(-400, -118, z - 0.5, 400, -117.9, z + 0.5, [0.85, 0.2, 0.15], 0.5);
  for (const x of [-100, 0, 100]) glow(x - 0.5, -118, -400, x + 0.5, -117.9, 420, [0.85, 0.2, 0.15], 0.5);
  return shoe;
}
