// "Fortune Stadium": the semi-finals arena — one white tower on a test-range style plaza.
// The tower: a big glass lobby in front (a three-storey atrium with catwalks and railings overlooking it),
// a business building above (offices, meeting rooms, server rooms), the back stepping in as it rises,
// then two wings at the top joined by catwalks, each wing crowned with fins that lean back in.
// Two indoor lifts with call buttons run up the core; switchback stairs run all the way up.
// Lower-floor windows and the lobby glass are real, see-through and breakable. Cashout stations and
// vault spots for the cashout mode are listed below (cashout.js runs the match).
import { makeBox } from '../world.js';
import { digitBoxes } from '../props.js';

const OX = 0, OZ = -702, Y0 = 63;
const FH = 4.5;                                 // storey height
const TX = { GLASS: 2, CONC: 3, PAVE: 4, METAL: 5, OFFICE: 6, ASPH: 7, SEATS: 8, LED: 9, PLASTER: 10, TILE: 11, WOOD: 12, BRICK: 13 };
const C = {
  conc: [0.7, 0.69, 0.66], concDark: [0.47, 0.47, 0.46], warm: [0.8, 0.76, 0.68], brick: [0.6, 0.37, 0.29],
  plaster: [0.85, 0.84, 0.81], floor: [0.6, 0.59, 0.57], pave: [0.68, 0.67, 0.64], asph: [0.24, 0.24, 0.25],
  glass: [0.38, 0.52, 0.6], steel: [0.58, 0.6, 0.63], dark: [0.16, 0.17, 0.19], white: [0.9, 0.9, 0.9],
  wood: [0.5, 0.35, 0.22], grass: [0.32, 0.46, 0.2], leaf: [0.25, 0.42, 0.18], fabric: [0.26, 0.28, 0.33],
  yellow: [0.95, 0.72, 0.1], light: [1, 0.96, 0.88], office: [0.8, 0.78, 0.74], metalClad: [0.66, 0.66, 0.64],
  tower: [0.94, 0.94, 0.93], towerShade: [0.86, 0.87, 0.88], pane: [0.62, 0.78, 0.86],
};
const L = (x, y, z) => [OX + x, Y0 + y, OZ + z];

// ---- the tower's shape (local metres; +z is the front, toward the main spawn)
const TOP = 28;                                     // storeys; the wing roofs are at 126 m
const POD = { x0: -36, x1: 36, z0: 20, z1: 44 };    // the lobby podium in front, 3 storeys
const SHAFTS = [[-6.5, -3.6, -3.1, -0.4], [3.1, -3.6, 6.5, -0.4]];
const LIFT_STOPS = [0, 1, 2, 3, 5, 8, 11, 14, 17, 21];
const backZ = (k) => (k < 10 ? -20 : k < 18 ? -12 : -8);       // the back steps in as it rises
// footprint(s) of storey k: one block, or two wings at the top
function footprint(k) {
  const z0 = backZ(k);
  if (k < 22) return [[-24, z0, 24, 20]];
  const o = k < 25 ? 24 : 21;
  return [[-o, z0, -5, 20], [5, z0, o, 20]];
}

// cashout stations and vault (cash box) spots
const STATIONS = [[-60, 0, 30], [60, 0, 30], [-26, 9, 34], [0, 0, -55]];
const VAULTS = [[0, 0, 14], [26, 4.5, 34], [50, 0, -45], [22, 13.5, 32]];
const NAV_CHAINS = [];
const GLASS = [];

export default {
  name: 'FORTUNE STADIUM',
  origin: [OX, Y0, OZ],
  spawn: { pos: L(0, 0, 88), yaw: 0 },
  // one spawn per team (team i uses spawns[i])
  spawns: [
    { pos: L(0, 0, 88), yaw: 0 }, { pos: L(80, 0, 12), yaw: Math.PI / 2 },
    { pos: L(0, 0, -72), yaw: Math.PI }, { pos: L(-80, 0, 12), yaw: -Math.PI / 2 },
  ],
  voidY: Y0 - 30,
  area: { min: [OX - 320, Y0 - 160, OZ - 320], max: [OX + 320, Y0 + 260, OZ + 320] },
  fog: 0.0042,
  shadowHalf: 70,
  pads: [],
  lifts: [
    { x: OX - 4.8, z: OZ - 2.0, w: 3, d: 2.8, doorZ: OZ, stops: LIFT_STOPS.map((k) => Y0 + k * FH), panelSide: 1 },
    { x: OX + 4.8, z: OZ - 2.0, w: 3, d: 2.8, doorZ: OZ, stops: LIFT_STOPS.map((k) => Y0 + k * FH), panelSide: -1 },
  ],
  stations: STATIONS.map((p) => L(...p)),
  vaults: VAULTS.map((p) => L(...p)),
  dummies: [],
  walls: [
    { origin: L(-24.2, 4.5, 24), cols: 12, rows: 6, axis: 2, color: [0.88, 0.87, 0.84] },
    { origin: L(23.8, 4.5, 36), cols: 12, rows: 6, axis: 2, color: [0.88, 0.87, 0.84] },
    { origin: L(-30, 9, 31.6), cols: 12, rows: 6, axis: 0, color: [0.88, 0.87, 0.84] },
    { origin: L(24, 9, 26), cols: 12, rows: 6, axis: 0, color: [0.88, 0.87, 0.84] },
    { origin: L(-30, 0, 30), cols: 12, rows: 6, axis: 0, color: [0.88, 0.87, 0.84] },
    { origin: L(24, 0, 35.5), cols: 12, rows: 6, axis: 0, color: [0.88, 0.87, 0.84] },
    { origin: L(-50, 0, -30), cols: 12, rows: 6, axis: 0 }, { origin: L(44, 0, -30), cols: 12, rows: 6, axis: 0 },
    { origin: L(-56, 0, 60), cols: 12, rows: 6, axis: 2 }, { origin: L(56, 0, 52), cols: 12, rows: 6, axis: 2 },
  ],
  // where the bots can walk: sampled levels, the stair routes between them, and places to keep out of
  nav: {
    levels: [
      { y: Y0, rects: [[OX - 88, OZ - 78, OX + 88, OZ + 98]] },
      { y: Y0 + 4.5, rects: [[OX - 36, OZ + 20, OX + 36, OZ + 44], [OX - 24, OZ - 20, OX + 24, OZ + 20]] },
      { y: Y0 + 9, rects: [[OX - 36, OZ + 20, OX + 36, OZ + 44], [OX - 24, OZ - 20, OX + 24, OZ + 20]] },
      { y: Y0 + 13.5, rects: [[OX - 36, OZ + 20, OX + 36, OZ + 44]] },
    ],
    chains: [],
    exclude: SHAFTS.map(([a, b, c, d]) => [OX + a - 0.4, OZ + b, OX + c + 0.4, OZ + d + 1.2]),
  },
  build(world) {
    this.refs = buildTower(world);
    this.nav.chains = NAV_CHAINS.filter((ch) => ch[0][1] < 13.6).map((ch) => ch.map((p) => L(...p)));
    this.glassBoxes = this.spawnGlass(world);
  },
  // (re)create every glass pane; returns the boxes
  spawnGlass(world) {
    return GLASS.map(([min, max]) => world.add(makeBox(min, max, {
      color: C.pane, alpha: 0.24, mat: [0.65, 0.04], grid: false, edges: false, noShadow: true, tag: 'glass',
    })));
  },
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
  // the walking route up each flight, for the bots
  for (let k = 0; k < floors; k++) {
    const yb = y0 + k * fh;
    NAV_CHAINS.push([[0.6, LW / 2, yb], [LA, LW / 2, yb], [LA + RUN, LW / 2, yb + half], [LA + RUN + LB / 2, LW, yb + half],
      [LA + RUN, LW * 1.5, yb + half], [LA, LW * 1.5, yb + fh], [0.6, LW * 1.5, yb + fh]].map(([u, v, y]) => { const q = P(u, v); return [q[0], y, q[1]]; }));
  }
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
    slab(b.x0 + t, b.z0 + t, b.x1 - t, b.z1 - t, y - 0.3, y, holes, { color: C.floor, tex: b.slabTex || TX.TILE });
    // the roof gets a concrete finish on top of the last slab
    if (k === b.floors) slab(b.x0 + t, b.z0 + t, b.x1 - t, b.z1 - t, y, y + 0.02, holes, { color: C.concDark, tex: TX.CONC, solid: false, noShadow: true });
  }
  // floor finish on the ground storey
  deco(b.x0 + t, 0.001, b.z0 + t, b.x1 - t, 0.02, b.z1 - t, { color: C.floor, tex: b.slabTex || TX.TILE, noShadow: true });
  if (b.parapet !== false) walls4(b.x0, b.z0, b.x1, b.z1, top, top + 1.1, b.parapetHoles || {}, { color: C.concDark, tex: TX.CONC }, 0.3);
  for (let k = 0; k < b.floors; k++) b.inner?.(k, y0 + k * fh);
  return top;
}

// door/window holes
const door = (c, w = 1.6, y = 0, h = 2.7) => [c - w / 2, c + w / 2, y, y + h];
const win = (c, w, y, sill = 1, h = 1.8) => [c - w / 2, c + w / 2, y + sill, y + sill + h];

// furniture and street props. Room "sets" (lounge, bedroom, kitchen, ...) are a few pieces arranged together.
// rot swaps the x and z extents. Small details don't cast shadows or collide.
const RUGS = [[0.55, 0.22, 0.18], [0.2, 0.3, 0.45], [0.7, 0.62, 0.48], [0.28, 0.4, 0.3], [0.35, 0.33, 0.4]];
const DUVETS = [[0.82, 0.8, 0.74], [0.3, 0.38, 0.52], [0.6, 0.3, 0.25], [0.4, 0.45, 0.38]];
const BOOKS = [[0.55, 0.16, 0.12], [0.16, 0.3, 0.5], [0.75, 0.62, 0.3], [0.2, 0.4, 0.28], [0.85, 0.82, 0.76], [0.3, 0.2, 0.35]];
const pick = (a) => a[Math.floor(rnd() * a.length)];
function prop(kind, x, y, z, rot = false) {
  const B = (a0, b0, c0, a1, b1, c1, o) => (rot ? box(x + c0, y + b0, z + a0, x + c1, y + b1, z + a1, o) : box(x + a0, y + b0, z + c0, x + a1, y + b1, z + c1, o));
  const D = (a0, b0, c0, a1, b1, c1, o) => B(a0, b0, c0, a1, b1, c1, { solid: false, noShadow: true, ...o });
  const at = (dx, dz, k, r = rot) => prop(k, x + (rot ? dz : dx), y, z + (rot ? dx : dz), r);
  const MET = { color: C.dark, mat: 'metal' };
  switch (kind) {
    // ---- single pieces
    case 'desk':
      B(-0.8, 0.71, -0.4, 0.8, 0.75, 0.4, { color: [0.88, 0.87, 0.84] });
      B(-0.78, 0, -0.38, -0.74, 0.71, 0.38, MET); B(0.74, 0, -0.38, 0.78, 0.71, 0.38, MET);
      D(-0.03, 0.75, 0.12, 0.03, 0.98, 0.18, MET);
      D(-0.32, 0.92, 0.12, 0.32, 1.28, 0.15, { color: C.dark, mat: 'metal' });
      D(-0.29, 0.95, 0.115, 0.29, 1.25, 0.12, { color: [0.35, 0.55, 0.85], emissive: 0.35 });
      D(-0.22, 0.75, -0.12, 0.22, 0.77, 0.04, { color: [0.2, 0.2, 0.22] });
      at(0, -0.75, 'chair');
      break;
    case 'chair':
      D(-0.04, 0, -0.04, 0.04, 0.42, 0.04, MET);
      D(-0.3, 0, -0.3, 0.3, 0.05, 0.3, { color: C.dark, shape: 'cyl' });
      B(-0.26, 0.42, -0.26, 0.26, 0.5, 0.26, { color: C.fabric, shape: 0.03 });
      D(-0.24, 0.5, -0.3, 0.24, 1.0, -0.24, { color: C.fabric, shape: 0.03 });
      break;
    case 'sofa': {
      const fab = pick([C.fabric, [0.45, 0.4, 0.34], [0.22, 0.3, 0.26], [0.5, 0.25, 0.2]]);
      B(-1.1, 0.08, -0.45, 1.1, 0.42, 0.45, { color: fab, shape: 0.06 });
      B(-1.1, 0.08, 0.22, 1.1, 0.88, 0.45, { color: fab, shape: 0.08 });
      for (const s of [-1, 1]) B(s * 1.1 - 0.12, 0.08, -0.45, s * 1.1 + 0.12, 0.62, 0.45, { color: fab, shape: 0.08 });
      for (const s of [-0.5, 0.5]) D(s - 0.48, 0.42, -0.4, s + 0.48, 0.54, 0.22, { color: fab.map((v) => v * 1.12), shape: 0.05 });
      D(-1.05, 0, -0.4, 1.05, 0.08, 0.4, { color: C.dark });
      break;
    }
    case 'coffee': B(-0.55, 0, -0.32, 0.55, 0.4, 0.32, { color: C.wood, shape: 0.02 }); D(-0.2, 0.4, -0.1, 0.1, 0.43, 0.12, { color: pick(BOOKS) }); break;
    case 'tv':
      B(-0.9, 0, -0.22, 0.9, 0.5, 0.22, { color: [0.22, 0.2, 0.19] });
      D(-0.75, 0.5, -0.03, 0.75, 1.36, 0.03, { color: [0.05, 0.05, 0.06], mat: [0.5, 0.15] });
      D(-0.72, 0.53, -0.035, 0.72, 1.33, -0.03, { color: [0.25, 0.4, 0.6], emissive: 0.3 });
      break;
    case 'rug': D(-1.4, 0.005, -1, 1.4, 0.02, 1, { color: pick(RUGS), tex: TX.ASPH }); break;
    case 'bed': {
      B(-1, 0, -0.9, 1, 0.32, 0.9, { color: C.wood });
      B(-0.97, 0.32, -0.87, 0.97, 0.54, 0.87, { color: [0.93, 0.93, 0.91], shape: 0.06 });
      D(-0.99, 0.5, -0.89, 0.99, 0.6, 0.35, { color: pick(DUVETS), shape: 0.05 });
      for (const s of [-0.45, 0.45]) D(s - 0.3, 0.54, 0.45, s + 0.3, 0.68, 0.82, { color: [0.96, 0.96, 0.95], shape: 0.06 });
      B(-1.05, 0, 0.9, 1.05, 1.15, 1.0, { color: C.wood, shape: 0.03 });
      for (const s of [-1, 1]) {
        B(s * 1.35 - 0.25, 0, 0.55, s * 1.35 + 0.25, 0.5, 0.98, { color: C.wood });
        D(s * 1.35 - 0.1, 0.5, 0.7, s * 1.35 + 0.1, 0.8, 0.9, { color: [1, 0.92, 0.75], emissive: 0.6, shape: 'cyl' });
      }
      break;
    }
    case 'table':
      B(-0.8, 0.72, -0.48, 0.8, 0.76, 0.48, { color: C.wood, shape: 0.01 });
      for (const [a, c] of [[-0.72, -0.4], [0.72, -0.4], [-0.72, 0.4], [0.72, 0.4]]) D(a - 0.03, 0, c - 0.03, a + 0.03, 0.72, c + 0.03, MET);
      break;
    case 'dchair':
      B(-0.22, 0.44, -0.22, 0.22, 0.48, 0.22, { color: C.wood });
      D(-0.22, 0.48, 0.18, 0.22, 0.95, 0.22, { color: C.wood });
      D(-0.2, 0, -0.2, 0.2, 0.44, 0.2, { color: C.dark, mat: 'metal', alpha: 1, shape: 'cyl' });
      break;
    case 'shelf': {
      B(-0.9, 0, -0.2, 0.9, 2.0, 0.2, { color: [0.36, 0.25, 0.16] });
      for (let i = 0; i < 4; i++) {
        const yb = 0.12 + i * 0.47;
        let u = -0.84;
        while (u < 0.8) {
          const w = 0.18 + rnd() * 0.36, h = 0.26 + rnd() * 0.12;
          D(u, yb, -0.215, Math.min(u + w, 0.84), yb + h, -0.2, { color: pick(BOOKS) });
          u += w + 0.03 + (rnd() < 0.2 ? 0.2 : 0);
        }
      }
      break;
    }
    case 'plant':
      B(-0.28, 0, -0.28, 0.28, 0.5, 0.28, { color: [0.82, 0.8, 0.76], shape: 'cyl' });
      D(-0.25, 0.48, -0.25, 0.25, 0.5, 0.25, { color: [0.25, 0.18, 0.12], shape: 'cyl' });
      D(-0.45, 0.5, -0.45, 0.45, 1.3, 0.45, { color: C.leaf, shape: 'sphere', noBullet: true });
      D(-0.3, 1.0, -0.25, 0.35, 1.7, 0.35, { color: [0.3, 0.5, 0.22], shape: 'sphere', noBullet: true });
      D(-0.4, 0.8, -0.1, 0.0, 1.45, 0.3, { color: [0.2, 0.36, 0.15], shape: 'sphere', noBullet: true });
      break;
    case 'counter':
      B(-1.5, 0, -0.32, 1.5, 0.88, 0.32, { color: [0.9, 0.9, 0.88] });
      B(-1.52, 0.88, -0.35, 1.52, 0.92, 0.35, { color: [0.2, 0.2, 0.22], mat: [0.1, 0.25] });
      for (const u of [-0.75, 0, 0.75]) D(u - 0.005, 0.05, -0.325, u + 0.005, 0.85, -0.32, { color: C.dark });
      D(0.3, 0.9, -0.2, 0.9, 0.925, 0.2, { color: [0.6, 0.62, 0.65], mat: 'steel' });
      D(0.58, 0.92, 0.18, 0.62, 1.2, 0.22, { color: [0.7, 0.72, 0.75], mat: 'steel', shape: 'cyl' });
      break;
    case 'fridge':
      B(-0.4, 0, -0.35, 0.4, 1.9, 0.35, { color: [0.75, 0.77, 0.8], mat: 'paint', shape: 0.03 });
      D(-0.4, 1.1, -0.355, 0.4, 1.11, -0.35, { color: C.dark });
      D(0.3, 1.2, -0.38, 0.33, 1.6, -0.35, { color: [0.85, 0.86, 0.88], mat: 'steel' });
      break;
    case 'crates': {
      const crate = (a, b, c, s) => {
        B(a - s / 2, b, c - s / 2, a + s / 2, b + s, c + s / 2, { color: [0.56, 0.44, 0.29] });
        D(a - s / 2 - 0.01, b + s * 0.15, c - s / 2 - 0.01, a + s / 2 + 0.01, b + s * 0.22, c + s / 2 + 0.01, { color: [0.3, 0.24, 0.17] });
        D(a - s / 2 - 0.01, b + s * 0.78, c - s / 2 - 0.01, a + s / 2 + 0.01, b + s * 0.85, c + s / 2 + 0.01, { color: [0.3, 0.24, 0.17] });
      };
      B(-0.7, 0, -0.65, 2.0, 0.14, 0.65, { color: [0.48, 0.38, 0.25] });
      crate(0, 0.14, 0, 1.2); crate(1.3, 0.14, 0, 1.1); crate(0.5, 1.34, 0, 1.0);
      break;
    }
    case 'rack':
      B(-0.32, 0, -0.5, 0.32, 2.1, 0.5, { color: [0.12, 0.12, 0.14], mat: 'metal' });
      D(-0.33, 0.1, -0.45, -0.32, 2.0, 0.45, { color: [0.2, 0.25, 0.3], alpha: 0.6, mat: [0.6, 0.1] });
      for (let i = 0; i < 9; i++) D(-0.335, 0.2 + i * 0.2, -0.38 + (i % 3) * 0.05, -0.33, 0.24 + i * 0.2, -0.1 + (i % 3) * 0.05, { color: i % 4 ? [0.3, 0.95, 0.5] : [1, 0.6, 0.15], emissive: 0.9 });
      break;
    case 'locker':
      B(-0.9, 0, -0.25, 0.9, 1.95, 0.25, { color: [0.38, 0.44, 0.52], mat: 'paint' });
      for (const u of [-0.3, 0.3]) D(u - 0.006, 0.02, -0.26, u + 0.006, 1.93, -0.25, { color: C.dark });
      for (const u of [-0.6, 0, 0.6]) D(u - 0.15, 1.6, -0.256, u + 0.15, 1.75, -0.25, { color: [0.25, 0.28, 0.33] });
      break;
    case 'filing': B(-0.25, 0, -0.3, 0.25, 1.3, 0.3, { color: [0.5, 0.52, 0.55], mat: 'paint' }); for (const h of [0.43, 0.86]) D(-0.25, h, -0.305, 0.25, h + 0.01, -0.3, { color: C.dark }); break;
    case 'cooler':
      B(-0.18, 0, -0.18, 0.18, 1.0, 0.18, { color: [0.88, 0.88, 0.9] });
      D(-0.15, 1.0, -0.15, 0.15, 1.45, 0.15, { color: [0.45, 0.7, 0.95], alpha: 0.55, shape: 'cyl', mat: [0.3, 0.1] });
      break;
    case 'whiteboard':
      B(-1.2, 0, -0.04, 1.2, 0.05, 0.04, MET);
      D(-1.2, 0.9, -0.03, 1.2, 2.1, 0.03, { color: [0.95, 0.95, 0.96], mat: [0, 0.3] });
      D(-1, 1.5, -0.035, 0.2, 1.53, -0.03, { color: [0.2, 0.35, 0.8] }); D(-0.6, 1.3, -0.035, 0.6, 1.33, -0.03, { color: [0.85, 0.2, 0.15] });
      for (const s of [-1.15, 1.15]) D(s - 0.03, 0, -0.03, s + 0.03, 2.1, 0.03, MET);
      break;
    case 'bench': B(-1, 0.4, -0.3, 1, 0.47, 0.3, { color: C.wood }); for (const s of [-0.8, 0.8]) B(s - 0.05, 0, -0.28, s + 0.05, 0.4, 0.28, MET); break;
    case 'barrier':
      B(-1.6, 0, -0.32, 1.6, 0.95, 0.32, { color: C.conc, tex: TX.CONC, shape: 0.15 });
      D(-1.55, 0.6, -0.326, 1.55, 0.7, 0.326, { color: [0.95, 0.75, 0.15] });
      break;
    case 'planter':
      B(-1.5, 0, -1.5, 1.5, 0.8, 1.5, { color: C.conc, tex: TX.CONC });
      B(-1.35, 0.8, -1.35, 1.35, 0.85, 1.35, { color: C.grass, solid: false });
      B(-0.7, 0.85, -0.7, 0.7, 2.1, 0.7, { color: C.leaf, shape: 'sphere', solid: false, noBullet: true });
      D(-1.1, 0.85, 0.2, -0.3, 1.4, 1.0, { color: [0.3, 0.48, 0.2], shape: 'sphere', noBullet: true });
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
      D(-0.4, 0.8, -0.47, 0.4, 1.85, -0.45, { color: [0.6, 0.85, 1], emissive: 0.5 });
      D(-0.4, 0.2, -0.47, 0.4, 0.45, -0.45, { color: C.dark });
      break;
    // ---- room sets
    case 'lounge': at(0, 0, 'rug'); at(0, 0.9, 'sofa'); at(0, -0.1, 'coffee'); at(0, -1.6, 'tv'); at(1.7, 0.9, 'plant'); break;
    case 'bedroom': at(0, 0.4, 'rug'); at(0, -0.3, 'bed'); break;
    case 'kitchen': at(0, 0.6, 'counter'); at(1.95, 0.6, 'fridge'); at(0, -1.0, 'table'); for (const s of [-0.5, 0.5]) { at(s, -1.6, 'dchair'); } break;
    case 'dining': at(0, 0, 'rug'); at(0, 0, 'table'); for (const s of [-0.45, 0.45]) { at(s, -0.75, 'dchair'); at(s, 0.75, 'dchair'); } at(1.6, 0.6, 'plant'); break;
    case 'office': at(-0.85, 0, 'desk'); at(0.85, 0, 'desk'); at(1.95, 0.4, 'filing'); if (rnd() < 0.5) at(-1.95, 0.5, 'plant'); break;
    case 'meeting': at(0, 0, 'table'); at(0, 0.75, 'dchair'); at(0, -0.75, 'dchair'); at(0, 1.6, 'whiteboard'); at(1.5, 0.8, 'cooler'); break;
    case 'library': at(0, 0.4, 'shelf'); at(1.9, 0.4, 'shelf'); at(0.9, -0.9, 'sofa'); break;
    case 'storage': at(0, 0, 'crates'); at(0.2, 1.4, 'shelf'); break;
    case 'servers': at(0, 0, 'rack'); at(0.7, 0, 'rack'); at(-0.7, 0, 'rack'); break;
    case 'lockers': at(0, 0, 'locker'); at(1.85, 0, 'locker'); break;
    case 'desks': at(0, 0, 'office'); break;
  }
}
// framed artwork on a wall: a thin panel with a coloured canvas
function art(x0, y0, z0, x1, y1, z1, r) {
  deco(x0, y0, z0, x1, y1, z1, { color: [0.15, 0.13, 0.11] });
  const th = 0.08, alongX = x1 - x0 > z1 - z0;
  const pal = [[0.85, 0.45, 0.2], [0.2, 0.4, 0.65], [0.85, 0.75, 0.4], [0.3, 0.55, 0.45], [0.75, 0.3, 0.4]];
  const c1 = pal[Math.floor(r * 5)], c2 = pal[Math.floor(r * 25) % 5];
  if (alongX) {
    const m = x0 + (x1 - x0) * (0.3 + 0.4 * r);
    deco(x0 + th, y0 + th, z0 - 0.005, m, y1 - th, z0, { color: c1 });
    deco(m, y0 + th, z0 - 0.005, x1 - th, y1 - th, z0, { color: c2 });
  } else {
    const m = z0 + (z1 - z0) * (0.3 + 0.4 * r);
    deco(x0 - 0.005, y0 + th, z0 + th, x0, y1 - th, m, { color: c1 });
    deco(x0 - 0.005, y0 + th, m, x0, y1 - th, z1 - th, { color: c2 });
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
function buildTower(world) {
  W = world;
  seed = 20261110;
  GLASS.length = 0;
  NAV_CHAINS.length = 0;
  const refs = {};
  plaza();
  tower();
  lobby();
  refs.stations = STATIONS.map((p) => station(...p));
  refs.vaults = VAULTS.map((p) => vault(...p));
  return refs;
}

// ---------------------------------------------------------------- the plaza: test-range floor and walls
function plaza() {
  const WALLC = [0.91, 0.91, 0.93], CHAR = [0.27, 0.28, 0.31], RED = [0.95, 0.15, 0.1];
  const G = { color: [0.94, 0.94, 0.95], grid: true, edges: true };
  box(-90, -1, -80, 90, 0, 100, G);
  const H = 12;
  box(-91, 0, -81, 91, H, -80, { ...G, color: WALLC }); box(-91, 0, 100, 91, H, 101, { ...G, color: WALLC });
  box(-91, 0, -80, -90, H, 100, { ...G, color: WALLC }); box(90, 0, -80, 91, H, 100, { ...G, color: WALLC });
  for (const [y0, y1, d, o] of [[0, 0.45, 0.12, { color: CHAR }], [3.4, 3.5, 0.06, { color: RED, emissive: 0.9, solid: false, noShadow: true }], [H - 0.35, H, 0.25, { color: CHAR }]]) {
    box(-90, y0, -80, 90, y1, -80 + d, { grid: false, ...o }); box(-90, y0, 100 - d, 90, y1, 100, { grid: false, ...o });
    box(-90, y0, -80, -90 + d, y1, 100, { grid: false, ...o }); box(90 - d, y0, -80, 90, y1, 100, { grid: false, ...o });
  }
  for (const [cx, cz] of [[-88, -78], [88, -78], [-88, 98], [88, 98]]) {
    box(cx - 0.8, 0, cz - 0.8, cx + 0.8, 22, cz + 0.8, { color: CHAR });
    box(cx - 2, 22, cz - 2, cx + 2, 24, cz + 2, { color: CHAR });
    glow(cx - 1.8, 21.8, cz - 1.8, cx + 1.8, 22, cz + 1.8, [1, 1, 0.96], 1);
  }
  // cover blocks, test-range style
  const blk = (x, z, sx, h, sz, c = [0.94, 0.94, 0.95]) => box(x - sx / 2, 0, z - sz / 2, x + sx / 2, h, z + sz / 2, { color: c, grid: true, edges: true });
  const ACC = [0.86, 0.87, 0.9], CH = [0.27, 0.28, 0.31];
  blk(-30, 66, 6, 1.2, 1); blk(30, 66, 6, 1.2, 1); blk(-14, 74, 1, 2.4, 4, ACC); blk(14, 74, 1, 2.4, 4, ACC);
  blk(-48, 46, 3, 3.2, 3, CH); blk(48, 46, 3, 3.2, 3, CH); blk(-70, 40, 8, 1.1, 1, ACC); blk(70, 40, 8, 1.1, 1, ACC);
  blk(-60, 8, 1, 2.2, 8); blk(60, 8, 1, 2.2, 8); blk(-44, -10, 4, 1.6, 4, ACC); blk(44, -10, 4, 1.6, 4, ACC);
  blk(-30, -48, 6, 1.2, 1); blk(30, -48, 6, 1.2, 1); blk(-18, -64, 1, 2.6, 6, CH); blk(18, -64, 1, 2.6, 6, CH);
  blk(-66, -56, 6, 0.6, 6, ACC); blk(66, -56, 6, 0.6, 6, ACC); blk(-74, 78, 4, 7, 4, CH); blk(74, 78, 4, 7, 4, CH);
  blk(0, -36, 10, 1.0, 1.2, ACC); blk(-36, 86, 2, 1.6, 6); blk(36, 86, 2, 1.6, 6);
  // team spawn pads
  for (const [x, z] of [[0, 88], [80, 12], [0, -72], [-80, 12]]) deco(x - 3, 0.001, z - 3, x + 3, 0.02, z + 3, { color: [0.3, 0.31, 0.34] });
}

// ---------------------------------------------------------------- the tower
function glassWall(axis, a0, a1, c, k0, k1, openings = [], bay = 4) {
  // a curtain wall of real glass panes between white mullions, with a white spandrel at each slab
  const y0 = k0 * FH, y1 = (k1 + 1) * FH;
  const along = (s0, s1, yb, yt, t0, t1, o) => (axis === 'x' ? box(s0, yb, t0, s1, yt, t1, o) : box(t0, yb, s0, t1, yt, s1, o));
  const M = { color: C.tower, tex: TX.CONC };
  for (let s = a0; s <= a1 + 1e-6; s += bay) along(s - 0.16, s + 0.16, y0, y1, c - 0.22, c + 0.22, M);
  for (let k = k0; k <= k1; k++) {
    along(a0, a1, (k + 1) * FH - 0.3, (k + 1) * FH, c - 0.25, c + 0.25, M);
    for (let s = a0; s < a1 - 1e-6; s += bay) {
      if (openings.some(([o0, o1, ok]) => ok === k && s >= o0 - 1e-6 && s + bay <= o1 + 1e-6)) continue;
      const yb = k * FH + (k === 0 ? 0 : 0), yt = (k + 1) * FH - 0.3;
      const mn = axis === 'x' ? [s + 0.16, yb, c - 0.03] : [c - 0.03, yb, s + 0.16];
      const mx = axis === 'x' ? [s + bay - 0.16, yt, c + 0.03] : [c + 0.03, yt, s + bay - 0.16];
      GLASS.push([[OX + mn[0], Y0 + mn[1], OZ + mn[2]], [OX + mx[0], Y0 + mx[1], OZ + mx[2]]]);
    }
  }
}
function rail(axis, a0, a1, c, y, holes = []) {
  const r = { color: [0.7, 0.85, 0.9], alpha: 0.25, mat: [0.6, 0.05], noShadow: true };
  const hs = holes.map(([h0, h1]) => [h0, h1, y - 1, y + 3]);
  if (axis === 'x') { wallX(a0, a1, c, 0.05, y, y + 1.0, hs, r); wallX(a0, a1, c, 0.1, y + 1.0, y + 1.08, hs, { color: C.steel, mat: 'steel' }); }
  else { wallZ(a0, a1, c, 0.05, y, y + 1.0, hs, r); wallZ(a0, a1, c, 0.1, y + 1.0, y + 1.08, hs, { color: C.steel, mat: 'steel' }); }
}

function tower() {
  const WT = { color: C.tower, tex: TX.OFFICE };
  const stairHole = stairCore(-20.6, 5, '+z', 0, TOP);
  const podW = stairCore(-33.2, 22, '+z', 0, 3), podE = stairCore(30, 22, '+z', 0, 3);
  const atrT = [-16, 4, 16, 20], atrP = [-16, 20, 16, 44];

  // ---- facades: real glass on storeys 0-6 (and the podium), white ribbon-window facade above
  glassWall('z', -20, 20, -24, 0, 6, [[12, 16, 0]]);
  glassWall('z', -20, 20, 24, 0, 6, [[12, 16, 0]]);
  glassWall('x', -24, 24, -20, 0, 6, [[-4, 4, 0]]);
  glassWall('x', -24, 24, 20, 3, 6, [[-8, -4, 3], [4, 8, 3]]);
  glassWall('x', -36, 36, 44, 0, 2, [[-4, 4, 0], [-28, -24, 0], [24, 28, 0]]);
  glassWall('z', 20, 44, -36, 0, 2, [[28, 32, 0]]);
  glassWall('z', 20, 44, 36, 0, 2, [[28, 32, 0]]);
  glassWall('x', -36, -24, 20, 0, 2); glassWall('x', 24, 36, 20, 0, 2);     // podium back corners, beside the tower
  // the solid upper facade, section by section
  const sections = [[7, 9], [10, 17], [18, 21], [22, 24], [25, TOP - 1]];
  for (const [k0, k1] of sections) {
    const y0 = k0 * FH, y1 = (k1 + 1) * FH;
    for (const [x0, z0, x1, z1] of footprint(k0)) {
      const doorBack = k0 === 10 || k0 === 18 ? [door((x0 + x1) / 2, 2.4, y0, 2.8)] : [];
      const inner = k0 >= 22 ? [22, 23, 25, 27].filter((k) => k >= k0 && k <= k1).map((k) => [4.5, 6.5, k * FH, k * FH + 2.7]) : [];
      walls4(x0, z0, x1, z1, y0, y1, {
        n: doorBack,
        e: x1 === -5 ? inner : [], w: x0 === 5 ? inner : [],
      }, WT);
    }
  }
  // ---- floor slabs (each covers the storey below it, so set-backs become terraces)
  for (let k = 1; k <= TOP; k++) {
    const y = k * FH;
    for (const fp of footprint(k - 1)) {
      const [x0, z0, x1, z1] = fp;
      const holes = [];
      if (k <= 21) holes.push(...SHAFTS);
      holes.push(stairHole);
      if (k <= 2) holes.push(atrT);
      slab(x0 + 0.4, z0 + 0.4, x1 - 0.4, Math.min(z1, 20), y - 0.3, y, holes.filter((h) => h[0] < x1 && h[2] > x0), { color: C.floor, tex: k === TOP ? TX.CONC : TX.TILE });
    }
  }
  // podium floors (1, 2) and roof (3), the atrium open through them
  for (let k = 1; k <= 3; k++) {
    const y = k * FH;
    const holes = [podW, podE, k < 3 ? atrP : [-16.01, 20, 16.01, 44]];
    slab(-35.6, 20, 35.6, 43.6, y - 0.3, y, holes, { color: C.floor, tex: k === 3 ? TX.CONC : TX.TILE });
  }
  // parapets on the podium roof and the terraces, the wing roofs and the crown
  walls4(-36, 20, 36, 44, 13.5, 14.6, { n: [[-8, -4, 13.5, 15], [4, 8, 13.5, 15]] }, { color: C.tower, tex: TX.CONC }, 0.3);
  wallX(-24, 24, -19.85, 0.3, 45, 46.1, [], { color: C.tower }); wallX(-24, 24, -11.85, 0.3, 81, 82.1, [], { color: C.tower });
  wallZ(-20, -12, -23.85, 0.3, 45, 46.1, [], { color: C.tower }); wallZ(-20, -12, 23.85, 0.3, 45, 46.1, [], { color: C.tower });
  wallZ(-12, -8, -23.85, 0.3, 81, 82.1, [], { color: C.tower }); wallZ(-12, -8, 23.85, 0.3, 81, 82.1, [], { color: C.tower });
  for (const [x0, , x1] of footprint(TOP - 1)) walls4(x0, -8, x1, 20, TOP * FH, TOP * FH + 1.1, { e: x1 === -5 ? [[4, 7, 0, 999]] : [], w: x0 === 5 ? [[4, 7, 0, 999]] : [] }, { color: C.tower, tex: TX.CONC }, 0.3);
  // the terrace between the wings at storey 22, and catwalks across the gap
  rail('x', -5, 5, 19.8, 22 * FH); rail('x', -5, 5, -7.8, 22 * FH);
  for (const k of [23, 25, 27, TOP]) {
    const y = k * FH;
    box(-5, y - 0.3, 4, 5, y, 7, { color: C.steel, tex: TX.METAL });
    rail('x', -5, 5, 4.05, y); rail('x', -5, 5, 6.95, y);
    glow(-5, y - 0.35, 3.9, 5, y - 0.3, 4.1, [0.6, 0.85, 1], 0.9); glow(-5, y - 0.35, 6.9, 5, y - 0.3, 7.1, [0.6, 0.85, 1], 0.9);
  }
  // the crown: on each wing, fins stepping back in toward the middle, a beacon on top
  for (const s of [-1, 1]) {
    const o = 21;
    const fin = (a, b, y0, y1, z0, z1) => box(Math.min(s * a, s * b), y0, z0, Math.max(s * a, s * b), y1, z1, { color: C.tower, tex: TX.CONC });
    fin(o, o - 1.2, TOP * FH, TOP * FH + 12, -8, 20);
    fin(o - 2.4, o - 3.6, TOP * FH + 12, TOP * FH + 20, -4, 16);
    fin(o - 5, o - 6.2, TOP * FH + 20, TOP * FH + 26, 0, 12);
    fin(o - 7.8, o - 9, TOP * FH + 26, TOP * FH + 30, 3, 9);
    glow(s * (o - 8.4) - 0.3, TOP * FH + 30, 5.7, s * (o - 8.4) + 0.3, TOP * FH + 30.6, 6.3, [1, 0.15, 0.1], 1);
    for (const y of [TOP * FH + 6, TOP * FH + 16]) glow(Math.min(s * o, s * (o - 1.25)), y, -8.05, Math.max(s * o, s * (o - 1.25)), y + 0.3, 20.05, [0.6, 0.85, 1], 0.9);
  }
  // ---- the core (two lift shafts with landing doors at every stop)
  const CORE = { color: [0.86, 0.86, 0.85], tex: TX.CONC };
  const coreTop = 22 * FH;
  box(-7.6, 0, -7.6, 7.6, coreTop, -3.6, CORE);
  box(-7.6, 0, -3.6, -6.5, coreTop, 0, CORE); box(-3.1, 0, -3.6, 3.1, coreTop, 0, CORE); box(6.5, 0, -3.6, 7.6, coreTop, 0, CORE);
  for (const cx of [-4.8, 4.8]) wallX(cx - 1.7, cx + 1.7, -0.2, 0.4, 0, coreTop, LIFT_STOPS.map((k) => [cx - 0.9, cx + 0.9, k * FH, k * FH + 2.6]), CORE);
  // floor numbers over the lift lobby at each stop
  for (const k of LIFT_STOPS) digitBoxes(String(k), OX - 0.45 * (String(k).length > 1 ? 1.4 : 0.5), Y0 + k * FH + 3.0, OZ + 0.05, 0.8, 1, [0.2, 0.22, 0.25], 0).forEach((b) => W.add(b));

  // ---- fitting out the office floors
  for (let k = 0; k < TOP; k++) {
    const y = k * FH;
    for (const [x0, z0, x1] of footprint(k)) {
      const cx = (x0 + x1) / 2;
      if (k >= 3) {
        const kinds = ['office', 'office', 'meeting', 'lounge', 'library', 'servers', 'kitchen', 'storage'];
        const spots = k < 22 ? [[-15, z0 + 3.2], [15, z0 + 3.2], [-13, 14], [13, 14], [0, 13]] : [[cx, z0 + 3.4], [cx, 14]];
        for (const [x, z] of spots) if (rnd() < 0.8) prop(kinds[Math.floor(rnd() * kinds.length)], x, y, z, false);
        // a row of offices along the back with doors
        if (k < 22) {
          wallX(-23.6, -8, z0 + 7, 0.2, y, y + FH - 0.3, [door(-12, 1.8, y), door(-19, 1.8, y)], { color: C.plaster, tex: TX.PLASTER });
          wallX(8, 23.6, z0 + 7, 0.2, y, y + FH - 0.3, [door(12, 1.8, y), door(19, 1.8, y)], { color: C.plaster, tex: TX.PLASTER });
        }
      }
      if (k >= 3) ceilingLight(cx - 8, 10, cx + 8, 10.6, y + FH);
      if (k < 22) ceilingLight(-20, z0 + 3.5, 20, z0 + 4.1, y + FH);
    }
  }
}

// ---------------------------------------------------------------- the lobby: atrium, catwalks, grand stairs
function lobby() {
  // L1 catwalk across the atrium, the grand stairs up to it, the L2 catwalk at the front
  box(-16, 4.2, 28, 16, 4.5, 31.6, { color: C.steel, tex: TX.METAL });
  box(-16, 8.7, 38, 16, 9, 41, { color: C.steel, tex: TX.METAL });
  for (const x of [-13, 13]) {
    stairs(x, 36.6, '-z', 3, 0, 4.5, { color: C.tower, tex: TX.CONC });
    NAV_CHAINS.push([[x, 0, 38], [x, 0, 37], [x, 4.5, 31.2], [x, 4.5, 30]]);
  }
  rail('x', -16, 16, 28.05, 4.5);
  rail('x', -16, 16, 31.55, 4.5, [[-14.5, -11.5], [11.5, 14.5]]);
  rail('x', -16, 16, 38.05, 9); rail('x', -16, 16, 40.95, 9);
  // railings along the atrium edges on L1 and L2 (gaps where the catwalks join)
  for (const [y, gaps] of [[4.5, [[28, 31.6]]], [9, [[38, 41]]]]) {
    rail('z', 4, 44, -16, y, gaps); rail('z', 4, 44, 16, y, gaps);
    rail('x', -16, 16, 4, y);
  }
  // atrium ceiling over the tower part, skylight of breakable glass over the podium part
  for (let x = -16; x < 16; x += 8) for (let z = 20; z < 44; z += 8) {
    GLASS.push([[OX + x + 0.1, Y0 + 13.38, OZ + z + 0.1], [OX + x + 7.9, Y0 + 13.46, OZ + z + 7.9]]);
  }
  for (const x of [-16, -8, 0, 8, 16]) box(x - 0.15, 13.0, 20, x + 0.15, 13.5, 44, { color: C.tower, tex: TX.CONC });
  for (const z of [20, 28, 36, 44]) box(-16, 13.0, z - 0.15, 16, 13.5, z + 0.15, { color: C.tower, tex: TX.CONC });
  // reception, seating, planters with trees, a hanging light sculpture, an LED wall
  prop('counter', -1.6, 0, 36.6); prop('counter', 1.6, 0, 36.6);
  glow(-3.2, 1.0, 36.95, 3.2, 1.25, 37.0, [0.55, 0.85, 1], 0.9);
  for (const [x, z] of [[-8, 24], [8, 24], [-8, 42], [8, 42]]) prop('planter', x, 0, z);
  for (const [x, z] of [[-26, 40], [26, 40]]) prop('lounge', x, 0, z);
  for (const [x, z, r] of [[-26, 24, false], [26, 24, false]]) prop('office', x, 0, z, r);
  for (const [s, y, r] of [[1, 10.5, 5], [-1, 8.5, 3.6], [1, 6.8, 2.4]]) {
    const z = 30;
    glow(-r, y, z - r, r, y + 0.12, z - r + 0.12, [0.6, 0.85, 1], 0.9);
    glow(-r, y, z + r - 0.12, r, y + 0.12, z + r, [0.6, 0.85, 1], 0.9);
    glow(-r, y, z - r, -r + 0.12, y + 0.12, z + r, [0.6, 0.85, 1], 0.9);
    glow(r - 0.12, y, z - r, r, y + 0.12, z + r, [0.6, 0.85, 1], 0.9);
    void s;
  }
  deco(-10, 9.6, 4.25, 10, 13.0, 4.35, { color: [0.95, 0.3, 0.2], tex: TX.LED, emissive: 0.5 });
  // mezzanine offices in the podium wings and the tower part of L1 and L2
  for (const y of [4.5, 9]) {
    for (const [x, z] of [[-25, 26], [28, 40], [-18, -14], [18, -14], [-14, -2], [14, -2]]) if (rnd() < 0.85) prop(['office', 'meeting', 'lounge', 'library'][Math.floor(rnd() * 4)], x, y, z);
    ceilingLight(-34, 30, -18, 30.6, y + FH); ceilingLight(18, 30, 34, 30.6, y + FH);
  }
  ceilingLight(-34, 30, -18, 30.6, 4.5); ceilingLight(18, 30, 34, 30.6, 4.5);
  ceilingLight(-12, 12, 12, 12.6, 13.5); ceilingLight(-20, -12, 20, -11.4, 4.5);
  // entrance canopy and big letters on the podium
  box(-8, 4.6, 44, 8, 5.0, 49, { color: C.tower, tex: TX.CONC });
  glow(-8, 4.55, 44, 8, 4.6, 49, C.light, 0.7);
}

// ---------------------------------------------------------------- cashout stations and vault spots
function station(x, y, z) {
  box(x - 1, y, z - 1, x + 1, y + 0.18, z + 1, { color: C.dark, tex: TX.METAL });
  box(x - 0.45, y + 0.18, z - 0.45, x + 0.45, y + 1.25, z + 0.45, { color: [0.85, 0.86, 0.88], tex: TX.METAL, shape: 0.06 });
  box(x - 0.55, y + 1.25, z - 0.55, x + 0.55, y + 1.4, z + 0.55, { color: C.dark, shape: 0.05 });
  const ring = glow(x - 1.05, y + 0.05, z - 1.05, x + 1.05, y + 0.14, z + 1.05, [0.85, 0.85, 0.9], 0.7);
  const top = glow(x - 0.42, y + 1.4, z - 0.42, x + 0.42, y + 1.43, z + 0.42, [0.85, 0.85, 0.9], 0.8);
  const beam = glow(x - 0.3, y + 1.43, z - 0.3, x + 0.3, y + 40, z + 0.3, [1, 1, 1], 1, { alpha: 0 });
  return { ring, top, beam, pos: L(x, y, z) };
}
function vault(x, y, z) {
  box(x - 0.9, y, z - 0.9, x + 0.9, y + 0.5, z + 0.9, { color: C.tower, tex: TX.CONC, shape: 0.05 });
  for (const [a, b] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) box(x + a - 0.07, y + 0.5, z + b - 0.07, x + a + 0.07, y + 2.1, z + b + 0.07, { color: C.dark, mat: 'metal' });
  box(x - 0.95, y + 2.1, z - 0.95, x + 0.95, y + 2.2, z + 0.95, { color: C.dark, mat: 'metal' });
  const ring = glow(x - 0.92, y + 0.5, z - 0.92, x + 0.92, y + 0.53, z + 0.92, [1, 0.2, 0.15], 0.9);
  const cap = glow(x - 0.8, y + 2.05, z - 0.8, x + 0.8, y + 2.1, z + 0.8, [1, 0.2, 0.15], 0.9);
  return { ring, cap, pos: L(x, y + 0.5, z) };
}
