// "Sky Docks": a cargo port on stilts high above the sea.
// Four quays ring a dock basin; a cargo ship is moored in the basin far below. Shipping containers hang from
// overhead crane rails and glide back and forth across the gaps — stand on one to ride it across.
// The water is death. The ship is the only safe place to land, but falling too far kills you even there:
// jump, turn round, hook the nearest container (G) and cut the line (G or jump) to break your fall.
// Bridges join the quays at the corners, and stair towers climb from the ship's deck to the quays.
import { makeBox } from '../world.js';
import { digitBoxes } from '../props.js';
import { CargoLine } from '../cargo.js';

const OX = 0, OZ = -702, Y0 = 63;
const FH = 4.5;
const TX = { GLASS: 2, CONC: 3, PAVE: 4, METAL: 5, OFFICE: 6, ASPH: 7, SEATS: 8, LED: 9, PLASTER: 10, TILE: 11, WOOD: 12, BRICK: 13 };
const C = {
  conc: [0.7, 0.69, 0.66], concDark: [0.47, 0.47, 0.46], warm: [0.8, 0.76, 0.68], brick: [0.6, 0.37, 0.29],
  plaster: [0.85, 0.84, 0.81], floor: [0.6, 0.59, 0.57], pave: [0.68, 0.67, 0.64], asph: [0.24, 0.24, 0.25],
  glass: [0.38, 0.52, 0.6], steel: [0.58, 0.6, 0.63], dark: [0.16, 0.17, 0.19], white: [0.9, 0.9, 0.9],
  wood: [0.5, 0.35, 0.22], grass: [0.32, 0.46, 0.2], leaf: [0.25, 0.42, 0.18], fabric: [0.26, 0.28, 0.33],
  yellow: [0.95, 0.72, 0.1], light: [1, 0.96, 0.88], office: [0.8, 0.78, 0.74], metalClad: [0.66, 0.66, 0.64],
  tower: [0.94, 0.94, 0.93], pane: [0.62, 0.78, 0.86],
  deck: [0.42, 0.43, 0.45], stilt: [0.36, 0.37, 0.4], hull: [0.13, 0.17, 0.26], hullRed: [0.62, 0.16, 0.12], shipDeck: [0.32, 0.42, 0.34],
};
const BOXES = [[0.78, 0.2, 0.14], [0.16, 0.36, 0.62], [0.88, 0.6, 0.12], [0.2, 0.52, 0.36], [0.86, 0.86, 0.84], [0.52, 0.2, 0.46], [0.3, 0.32, 0.36], [0.9, 0.4, 0.12]];
const L = (x, y, z) => [OX + x, Y0 + y, OZ + z];

// ---- heights (local metres; the sea is at 0)
const QY = 26;          // quay deck
const LY = 31;          // loading decks for the east-west containers
const SY = 9;           // the ship's deck
const QUAYS = { N: [-70, -70, 70, -36], S: [-70, 36, 70, 70], W: [-100, -30, -64, 30], E: [64, -30, 100, 30] };
const LOAD = { W: [-76, -22, -64, 22], E: [64, -22, 76, 22] };
const SHIP = { x0: -50, x1: 50, z0: -11, z1: 11 };
const TOWERS = [[-44.2, -27.6, 1], [39.8, -27.6, 1], [-44.2, 20, -1], [39.8, 20, -1]];   // stair towers ship ↔ quay: [x, z, side]

const STATIONS = [[-22, QY, -48], [-40, QY, 46], [90, QY, -14], [0, SY, -4]];
const VAULTS = [[0, SY, 6], [4, QY, -54], [-20, QY, 56], [70, LY, 0]];
const NAV_CHAINS = [];
const GLASS = [];

export default {
  name: 'SKY DOCKS',
  origin: [OX, Y0, OZ],
  spawn: { pos: L(-62, QY, -46), yaw: Math.PI },
  spawns: [
    { pos: L(-62, QY, -46), yaw: Math.PI }, { pos: L(95, QY, 20), yaw: Math.PI / 2 },
    { pos: L(62, QY, 46), yaw: 0 }, { pos: L(-95, QY, -16), yaw: -Math.PI / 2 },
  ],
  voidText: ['SPLASH', 'YOU HIT THE WATER'],
  voidY: Y0 + 0.6,                    // touching the water = out
  fallLethal: 15,                     // a drop bigger than this kills you; 8 m+ hurts
  fallHurt: 8,
  hook: true,                         // everyone can hook containers with G here
  area: { min: [OX - 320, Y0 - 160, OZ - 320], max: [OX + 320, Y0 + 260, OZ + 320] },
  fog: 0.0048,
  shadowHalf: 70,
  pads: [],
  lifts: [],
  stations: STATIONS.map((p) => L(...p)),
  vaults: VAULTS.map((p) => L(...p)),
  dummies: [],
  walls: [
    { origin: L(-36, QY, -60), cols: 12, rows: 6, axis: 2, color: [0.62, 0.64, 0.68] },
    { origin: L(30, QY, 48), cols: 12, rows: 6, axis: 2, color: [0.62, 0.64, 0.68] },
    { origin: L(-90, QY, -8), cols: 12, rows: 6, axis: 0, color: [0.62, 0.64, 0.68] },
    { origin: L(84, QY, 6), cols: 12, rows: 6, axis: 0, color: [0.62, 0.64, 0.68] },
  ],
  nav: {
    levels: [
      { y: Y0 + SY, rects: [[OX - 60, OZ - 31, OX + 60, OZ + 31]] },
      { y: Y0 + QY, rects: Object.values(QUAYS).map(([a, b, c, d]) => [OX + a, OZ + b, OX + c, OZ + d]).concat([[OX - 70, OZ - 36, OX - 64, OZ - 30], [OX + 64, OZ - 36, OX + 70, OZ - 30], [OX - 70, OZ + 30, OX - 64, OZ + 36], [OX + 64, OZ + 30, OX + 70, OZ + 36]]) },
      { y: Y0 + LY, rects: Object.values(LOAD).map(([a, b, c, d]) => [OX + a, OZ + b, OX + c, OZ + d]) },
    ],
    chains: [],
    exclude: [],
  },
  build(world) {
    this.refs = buildDocks(world);
    this.cargo = this.refs.cargo;
    this.nav.chains = NAV_CHAINS.map((ch) => ch.map((p) => L(...p)));
    this.glassBoxes = this.spawnGlass(world);
  },
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
  // wide, gentle switchback stairs: 2.2 m lanes, 0.28 m steps, roomy landings, a low wall between the lanes
  const s = dir[0] === '+' ? 1 : -1, alongX = dir[1] === 'x';
  const LW = 2.2, LA = 1.8, RUN = 3.6, LB = 2.2;
  const P = (u, v) => (alongX ? [ax + s * u, az + v] : [ax + v, az + s * u]);
  const rect = (u0, u1, v0, v1, yb, yt, o) => { const a = P(u0, v0), b = P(u1, v1); box(a[0], yb, a[1], b[0], yt, b[1], o); };
  const half = fh / 2, n = Math.max(1, Math.round(half / 0.28)), rise = half / n, run = RUN / n;
  const step = { color: [0.82, 0.82, 0.8], tex: TX.CONC };
  const nose = { color: C.dark, solid: false, noShadow: true };
  const rail = { color: C.steel, mat: 'steel' };
  const glassR = { color: [0.7, 0.85, 0.9], alpha: 0.25, mat: [0.6, 0.05], noShadow: true };
  for (let k = 0; k < floors; k++) {
    const yb = y0 + k * fh, yt = yb + fh;
    for (let i = 0; i < n; i++) {
      const h = yb + (i + 1) * rise;
      rect(LA + i * run, LA + (i + 1) * run, 0, LW, yb, h, step);
      rect(LA + i * run, LA + i * run + 0.04, 0.05, LW - 0.05, h - 0.01, h + 0.005, nose);           // dark step nosing
      const h2 = yb + half + (i + 1) * rise;
      rect(LA + RUN - (i + 1) * run, LA + RUN - i * run, LW, 2 * LW, yb + half, h2, step);
      rect(LA + RUN - i * run - 0.04, LA + RUN - i * run, LW + 0.05, 2 * LW - 0.05, h2 - 0.01, h2 + 0.005, nose);
    }
    rect(LA + RUN, LA + RUN + LB, 0, 2 * LW, yb + half - 0.3, yb + half, step);
    // the stairwell's walls: both sides and the far end, open only at the landing end
    const SW = { color: [0.9, 0.9, 0.88], tex: TX.PLASTER };
    rect(LA - 0.2, LA + RUN + LB + 0.2, -0.2, 0, yb, yt, SW);
    rect(LA - 0.2, LA + RUN + LB + 0.2, 2 * LW, 2 * LW + 0.2, yb, yt, SW);
    rect(LA + RUN + LB, LA + RUN + LB + 0.2, -0.2, 2 * LW + 0.2, yb, yt, SW);
    glow(...P(LA + RUN + LB - 0.02, 0.4).flatMap((v, i) => (i === 0 ? [v, yb + half + 2.6] : [v])), ...P(LA + RUN + LB, 2 * LW - 0.4).flatMap((v, i) => (i === 0 ? [v, yb + half + 2.7] : [v])), C.light, 0.9);
    // glass balustrade round the stairwell at the top
    if (k === floors - 1) for (const [u0, u1, v0, v1] of [[LA, LA + RUN + LB, -0.05, 0], [LA, LA + RUN + LB, 2 * LW, 2 * LW + 0.05], [LA + RUN + LB, LA + RUN + LB + 0.05, -0.05, 2 * LW + 0.05]]) {
      rect(u0, u1, v0, v1, yt, yt + 1.0, glassR);
      rect(u0, u1, v0 - 0.03, v1 + 0.03, yt + 1.0, yt + 1.06, rail);
    }
    // the wall between the lanes rises with the flights, topped with a handrail
    rect(LA, LA + RUN, LW - 0.08, LW + 0.08, yb, yb + half + 1.0, { color: [0.86, 0.86, 0.85], tex: TX.CONC });
    rect(LA, LA + RUN, LW - 0.1, LW + 0.1, yb + half + 1.0, yb + half + 1.06, rail);
  }
  // the walking route up each flight, for the bots
  for (let k = 0; k < floors; k++) {
    const yb = y0 + k * fh;
    NAV_CHAINS.push([[0.8, LW / 2, yb], [LA, LW / 2, yb], [LA + RUN, LW / 2, yb + half], [LA + RUN + LB / 2, LW, yb + half],
      [LA + RUN, LW * 1.5, yb + half], [LA, LW * 1.5, yb + fh], [0.8, LW * 1.5, yb + fh]].map(([u, v, y]) => { const q = P(u, v); return [q[0], y, q[1]]; }));
  }
  const a = P(LA, 0), b = P(LA + RUN + LB, 2 * LW);
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}

// straight stairs with small steps (rise ~0.3, run 0.45), from (x, z) climbing in `dir`, `width` across
function grandStairs(x, z, dir, width, y0, y1, o = { color: C.tower, tex: TX.CONC }) {
  const n = Math.round((y1 - y0) / 0.3), s = dir[0] === '+' ? 1 : -1, rise = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const a = i * 0.45 * s, b = (i + 1) * 0.45 * s, top = y0 + (i + 1) * rise;
    if (dir[1] === 'x') box(x + a, y0, z - width / 2, x + b, top, z + width / 2, o);
    else box(x - width / 2, y0, z + a, x + width / 2, top, z + b, o);
  }
  return n * 0.45;
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


// ================================================================ the docks
function buildDocks(world) {
  W = world;
  seed = 20261110;
  GLASS.length = 0;
  NAV_CHAINS.length = 0;
  const refs = {};
  sea();
  for (const [k, q] of Object.entries(QUAYS)) quay(k, ...q);
  cornerBridges();
  loadingDecks();
  ship();
  for (const [x, z, side] of TOWERS) stairTower(x, z, side);
  refs.cargo = cargoLines(world);
  cranes();
  refs.stations = STATIONS.map((p) => station(...p));
  refs.vaults = VAULTS.map((p) => vault(...p));
  return refs;
}

// ---------------------------------------------------------------- the sea, far below
function sea() {
  deco(-420, -1, -420, 420, 0, 420, { color: [0.1, 0.24, 0.3], tex: TX.ASPH, mat: [0.2, 0.08] });
  // a light swell of foam lines, and a breakwater ring round the basin
  for (let z = -380; z <= 380; z += 46) glow(-420, 0.01, z - 0.25, 420, 0.03, z + 0.25, [0.6, 0.78, 0.82], 0.15);
  for (const [x0, z0, x1, z1] of [[-130, -100, 130, -94], [-130, 94, 130, 100], [-130, -94, -124, 94], [124, -94, 130, 94]]) box(x0, -1, z0, x1, 3, z1, { color: C.concDark, tex: TX.CONC });
}

// ---------------------------------------------------------------- a quay deck on stilts
function quay(name, x0, z0, x1, z1) {
  box(x0, QY - 1.2, z0, x1, QY, z1, { color: C.deck, tex: TX.CONC });
  box(x0 + 1, QY - 3, z0 + 1, x1 - 1, QY - 1.2, z1 - 1, { color: C.stilt, tex: TX.METAL });
  // stilts down to the sea, with cross-bracing
  for (let x = x0 + 4; x <= x1 - 4; x += 16) for (let z = z0 + 4; z <= z1 - 4; z += 14) {
    box(x - 0.9, -1, z - 0.9, x + 0.9, QY - 3, z + 0.9, { color: C.stilt, tex: TX.CONC });
    box(x - 0.6, 10, z - 0.6, x + 0.6, 10.8, z + 13.4 > z1 - 4 ? z + 0.6 : z + 13.4, { color: C.stilt, tex: TX.METAL, noShadow: true });
  }
  // yellow safety line and a low kerb along the basin-side edge, painted lines
  const edge = { N: [x0, z1 - 0.4, x1, z1], S: [x0, z0, x1, z0 + 0.4], W: [x1 - 0.4, z0, x1, z1], E: [x0, z0, x0 + 0.4, z1] }[name];
  deco(edge[0], QY, edge[1], edge[2], QY + 0.02, edge[3], { color: C.yellow, emissive: 0.2 });
  for (let i = 0; i < 4; i++) deco(x0 + 2, QY, z0 + 2 + i * 0.01, x1 - 2, QY + 0.015, z0 + 2.12 + i * 0.01, { color: [0.85, 0.85, 0.8] });
  // the outer edges get railings; the basin side stays open (that's where the containers dock)
  const rr = { color: C.yellow, mat: 'paint' };
  const railX = (a, b, z) => { box(a, QY, z - 0.05, b, QY + 1.1, z + 0.05, { color: [0.3, 0.3, 0.32], alpha: 0.0, hidden: true }); box(a, QY + 1.0, z - 0.06, b, QY + 1.1, z + 0.06, rr); for (let x = a; x <= b; x += 3) box(x - 0.04, QY, z - 0.04, x + 0.04, QY + 1.0, z + 0.04, rr); };
  const railZ = (a, b, x) => { box(x - 0.05, QY, a, x + 0.05, QY + 1.1, b, { hidden: true }); box(x - 0.06, QY + 1.0, a, x + 0.06, QY + 1.1, b, rr); for (let z = a; z <= b; z += 3) box(x - 0.04, QY, z - 0.04, x + 0.04, QY + 1.0, z + 0.04, rr); };
  if (name === 'N') { railX(x0, x1, z0 + 0.1); railZ(z0, z1 - 6.5, x0 + 0.1); railZ(z0, z1 - 6.5, x1 - 0.1); }
  if (name === 'S') { railX(x0, x1, z1 - 0.1); railZ(z0 + 6.5, z1, x0 + 0.1); railZ(z0 + 6.5, z1, x1 - 0.1); }
  if (name === 'W') { railZ(z0, z1, x0 + 0.1); railX(x0, x1 - 6.5, z0 + 0.1); railX(x0, x1 - 6.5, z1 - 0.1); }
  if (name === 'E') { railZ(z0, z1, x1 - 0.1); railX(x0 + 6.5, x1, z0 + 0.1); railX(x0 + 6.5, x1, z1 - 0.1); }
  // what's on each quay
  if (name === 'N' || name === 'S') {
    const s = name === 'N' ? -1 : 1, zb = name === 'N' ? z0 : z1;          // zb = the far (outer) edge
    warehouse(-62, -36, zb, s);
    warehouse(36, 62, zb, s);
    // container stacks for cover, with single boxes as steps up
    for (const [x, z, h] of [[-12, 52, 2], [-4, 52, 1], [20, 50, 2], [48, 44, 1], [-52, 44, 1], [8, 62, 1]]) stack(x, s * z, h, s);
    // bollards along the basin edge
    for (let x = x0 + 6; x < x1 - 4; x += 12) box(x - 0.35, QY, s * 37.2 - 0.35, x + 0.35, QY + 0.8, s * 37.2 + 0.35, { color: C.dark, shape: 'cyl' });
    for (const x of [-56, -20, 20, 56]) prop('lamp', x, QY, s * 66);
  } else {
    const s = name === 'W' ? -1 : 1;
    stack(s * 92, -24, 1, 0, true); stack(s * 92, 24, 1, 0, true); stack(s * 84, -12, 2, 0, true); stack(s * 84, 14, 1, 0, true);
    for (const z of [-26, 26]) prop('lamp', s * 98, QY, z);
    box(s * 96 - 2, QY, -6, s * 96 + 2, QY + 3, 6, { color: C.metalClad, tex: TX.METAL });      // site office
    deco(s * 96 - 2.02, QY + 2.2, -6.02, s * 96 + 2.02, QY + 2.6, 6.02, { color: s < 0 ? [0.16, 0.36, 0.62] : [0.78, 0.2, 0.14] });
  }
}
// a warehouse on the outer edge of a quay: metal shed with roller doors you can walk through
function warehouse(x0, x1, zb, s) {
  const zIn = zb - s * 2, zOut = zb - s * 18;
  const a = Math.min(zIn, zOut), b = Math.max(zIn, zOut);
  const H = 9;
  const mid = (x0 + x1) / 2;
  walls4(x0, a, x1, b, QY, QY + H, {
    [s < 0 ? 's' : 'n']: [door(mid - 6, 4.5, QY, 4.2), door(mid + 6, 4.5, QY, 4.2)],
    w: [door((a + b) / 2, 3, QY, 3)], e: [door((a + b) / 2, 3, QY, 3)],
  }, { color: [0.7, 0.72, 0.75], tex: TX.METAL }, 0.3);
  box(x0 - 0.4, QY + H, a - 0.4, x1 + 0.4, QY + H + 0.5, b + 0.4, { color: [0.55, 0.57, 0.6], tex: TX.METAL });
  deco(x0 - 0.05, QY + H - 1.4, a - 0.05, x1 + 0.05, QY + H - 0.9, b + 0.05, { color: s < 0 ? [0.16, 0.36, 0.62] : [0.78, 0.2, 0.14] });
  // inside: a mezzanine office along the back, racks of crates, a forklift
  const zb2 = s < 0 ? a + 0.3 : b - 0.3, zm = zb2 - s * 4;
  box(x0 + 0.3, QY + 4.2, Math.min(zb2, zm), x1 - 0.3, QY + 4.5, Math.max(zb2, zm), { color: C.steel, tex: TX.METAL });
  const sx0 = x1 - 3.9, sx1 = x1 - 1.1;
  for (let x = x0 + 2; x < x1 - 2; x += 3.2) if (x < sx0 - 0.2 || x > sx1 + 0.2) box(x - 0.08, QY, zm - 0.08, x + 0.08, QY + 4.2, zm + 0.08, { color: C.yellow, mat: 'paint' });
  wallX(x0 + 0.3, x1 - 0.3, zm, 0.06, QY + 4.5, QY + 5.5, [[sx0, sx1, QY, QY + 9]], { color: C.yellow, mat: 'paint' });
  grandStairs(x1 - 2.5, zm - s * 7.6, s < 0 ? '-z' : '+z', 2.4, QY, QY + 4.5, { color: C.steel, tex: TX.METAL });
  for (const x of [x0 + 4, x0 + 10]) prop('crates', x, QY, zm + s * 5);
  prop('crates', x1 - 9, QY + 4.5, zb2 - s * 2);
  prop('desk', x0 + 4, QY + 4.5, zb2 - s * 2);
  // windows on the office mezzanine (breakable)
  for (let x = x0 + 2; x < x1 - 6; x += 3) GLASS.push([[OX + x, Y0 + QY + 5.6, OZ + zm - 0.03], [OX + x + 2.6, Y0 + QY + 7.6, OZ + zm + 0.03]]);
  ceilingLight(x0 + 2, (a + b) / 2 - 0.3, x1 - 2, (a + b) / 2 + 0.3, QY + H);
}
// a stack of shipping containers (h high); `ew` turns them east-west
function stack(x, z, h, s, ew = false) {
  for (let i = 0; i < h; i++) {
    const c = BOXES[Math.floor(rnd() * BOXES.length)];
    const [sx, sz] = ew ? [2.5, 6] : [6, 2.5];
    const y = QY + i * 2.6;
    box(x - sx / 2, y, z - sz / 2, x + sx / 2, y + 2.6, z + sz / 2, { color: c, tex: TX.METAL, tag: 'cargo' });
    deco(x - sx / 2 - 0.01, y + 2.4, z - sz / 2 - 0.01, x + sx / 2 + 0.01, y + 2.6, z + sz / 2 + 0.01, { color: c.map((v) => v * 0.7) });
  }
  void s;
}

// ---------------------------------------------------------------- bridges at the corners
function cornerBridges() {
  for (const [x0, z0, x1, z1] of [[-70, -36, -64, -30], [64, -36, 70, -30], [-70, 30, -64, 36], [64, 30, 70, 36]]) {
    box(x0, QY - 0.6, z0, x1, QY, z1, { color: C.steel, tex: TX.METAL });
    box(x0, QY - 2.2, (z0 + z1) / 2 - 0.6, x1, QY - 0.6, (z0 + z1) / 2 + 0.6, { color: C.dark, tex: TX.METAL });
    for (const x of [x0, x1 - 0.08]) { box(x, QY, z0, x + 0.08, QY + 1.05, z1, { color: [0.7, 0.85, 0.9], alpha: 0.3, noShadow: true }); box(x - 0.02, QY + 1.05, z0, x + 0.1, QY + 1.12, z1, { color: C.yellow }); }
  }
}

// ---------------------------------------------------------------- loading decks for the east-west containers
function loadingDecks() {
  for (const [k, [x0, z0, x1, z1]] of Object.entries(LOAD)) {
    const s = k === 'W' ? -1 : 1;
    box(x0, LY - 0.5, z0, x1, LY, z1, { color: C.steel, tex: TX.METAL });
    for (const x of [x0 + 1, x1 - 1]) for (const z of [z0 + 1, 0, z1 - 1]) box(x - 0.3, QY, z - 0.3, x + 0.3, LY - 0.5, z + 0.3, { color: C.yellow, mat: 'paint' });
    // stairs up from the quay, both ends
    const sx = s < 0 ? -84 : 84;
    grandStairs(sx, 0, s < 0 ? '+x' : '-x', 5, QY, LY, { color: C.steel, tex: TX.METAL });
    NAV_CHAINS.push([[sx - s * 0.8, QY, 0], [sx, QY, 0], [sx - s * 7.65, LY, 0], [sx - s * 9, LY, 0]]);
    // rails: the outer and side edges; the basin edge is open where the containers dock
    const rr = { color: C.yellow, mat: 'paint' };
    const xo = s < 0 ? x0 : x1, xi = s < 0 ? x1 : x0;
    wallZ(z0, z1, xo, 0.08, LY, LY + 1.05, [[-2.6, 2.6, LY, LY + 2]], rr);
    wallX(x0, x1, z0, 0.08, LY, LY + 1.05, [], rr);
    wallX(x0, x1, z1, 0.08, LY, LY + 1.05, [], rr);
    wallZ(z0, z1, xi, 0.08, LY, LY + 1.05, [[-17.6, -14.4, LY, LY + 2], [14.4, 17.6, LY, LY + 2]], rr);
    deco(xi - s * 0.4, LY, z0, xi, LY + 0.02, z1, { color: C.yellow, emissive: 0.2 });
    // gantry pylons at the docking end, carrying the overhead rails
    for (const z of [-16, 16]) for (const dz of [-2.2, 2.2]) box(xi + s * 3 - 0.4, LY, z + dz - 0.4, xi + s * 3 + 0.4, 46, z + dz + 0.4, { color: C.yellow, tex: TX.METAL });
  }
}

// ---------------------------------------------------------------- the cargo ship moored in the basin
function ship() {
  const { x0, x1, z0, z1 } = SHIP;
  box(x0, -3, z0, x1, 4, z1, { color: C.hull, tex: TX.METAL });
  box(x0, 4, z0, x1, SY - 0.6, z1, { color: C.hullRed, tex: TX.METAL });
  box(x0 + 0.5, SY - 0.6, z0 + 0.5, x1 - 0.5, SY, z1 - 0.5, { color: C.shipDeck, tex: TX.ASPH });
  // the bow, stepping in to a point
  for (let i = 0; i < 6; i++) {
    const w = (z1 - z0) / 2 * (1 - i / 6);
    box(x1 + i * 2, -3 + i * 0.4, -w, x1 + (i + 1) * 2, SY + 0.6, w, { color: i < 3 ? C.hull : C.hullRed, tex: TX.METAL });
  }
  box(x1, SY, z0 + 0.5, x1 + 12, SY + 0.8, z1 - 0.5, { color: C.shipDeck, tex: TX.ASPH, solid: false });
  // gunwales round the deck
  for (const z of [z0 + 0.2, z1 - 0.2]) box(x0, SY, z - 0.2, x1, SY + 1.0, z + 0.2, { color: C.hullRed, tex: TX.METAL });
  // the bridge superstructure at the stern: four decks, windows all round, a funnel
  const bx0 = x0 + 1, bx1 = x0 + 14;
  for (let k = 0; k < 4; k++) {
    const y = SY + k * 4, w = 9 - k * 0.8;
    walls4(bx0, -w, bx1, w, y, y + 4, { e: [door(0, 2, y, 2.6)] }, { color: C.white, tex: TX.OFFICE }, 0.3);
    box(bx0, y + 3.7, -w, bx1, y + 4, w, { color: C.white, tex: TX.CONC });
    if (k === 3) for (let z = -w + 0.6; z < w - 0.6; z += 2.4) GLASS.push([[OX + bx1 - 0.03, Y0 + y + 1.4, OZ + z], [OX + bx1 + 0.03, Y0 + y + 3.3, OZ + z + 2.0]]);
  }
  box(bx0 - 1, SY + 16, -11, bx1 + 1, SY + 16.4, 11, { color: C.white, tex: TX.CONC });          // bridge wings
  box(bx0 + 3, SY + 16.4, -2, bx0 + 7, SY + 22, 2, { color: C.hullRed, tex: TX.METAL });
  box(bx0 + 3, SY + 21, -2.05, bx0 + 7, SY + 22, 2.05, { color: C.dark });
  // ladders up the outside of the superstructure (vault up 2 m ledges): steps on the starboard side
  for (let k = 0; k < 4; k++) box(bx1, SY + k * 4 + 3.7, -9 + k * 0.8, bx1 + 2, SY + k * 4 + 4, -6 + k * 0.8, { color: C.steel, tex: TX.METAL });
  // container stacks on the deck, with gaps to fight through
  const bays = [[-30, -6, 2], [-30, 6, 1], [-18, -6, 1], [-18, 6, 3], [8, -6, 2], [8, 6, 1], [20, -6, 3], [20, 6, 2], [32, -6, 1], [32, 6, 2]];
  for (const [x, z, h] of bays) for (let i = 0; i < h; i++) {
    const c = BOXES[Math.floor(rnd() * BOXES.length)], y = SY + i * 2.6;
    box(x - 5, y, z - 1.25, x + 5, y + 2.6, z + 1.25, { color: c, tex: TX.METAL, tag: 'cargo' });
    deco(x - 5.01, y + 2.4, z - 1.26, x + 5.01, y + 2.6, z + 1.26, { color: c.map((v) => v * 0.7) });
  }
  // hatch covers and deck lights
  for (const x of [-6, 44]) box(x - 4, SY, -4, x + 4, SY + 0.6, 4, { color: C.hullRed.map((v) => v * 0.8), tex: TX.METAL });
  for (const x of [-25, 0, 25]) { box(x - 0.08, SY, z1 - 0.8, x + 0.08, SY + 5, z1 - 0.64, { color: C.dark }); glow(x - 0.3, SY + 5, z1 - 1, x + 0.3, SY + 5.2, z1 - 0.4, C.light, 1); }
  bigNum(7, x0 + 8, 4.6, z1 + 0.05, 2.2, [0.95, 0.95, 0.9]);
}

// ---------------------------------------------------------------- stair towers: ship deck ↔ quay
function stairTower(x, z, side) {
  // side 1: north tower (the quay is to the -z), -1: south tower. The A end (where each flight starts) faces
  // the quay; the flights climb toward the ship. w = metres from the A end toward the ship.
  const fh = (QY - SY) / 4;
  const zA = side > 0 ? z : z + 7.6;
  const Z = (w) => zA + side * w;
  const zs = (w0, w1) => [Math.min(Z(w0), Z(w1)), Math.max(Z(w0), Z(w1))];
  stairCore(x, zA, side > 0 ? '+z' : '-z', SY, 4, fh);
  const ST = { color: C.steel, tex: TX.METAL }, YL = { color: C.yellow, mat: 'paint' };
  // corner posts down to the sea
  for (const xx of [x - 2.1, x + 6.5]) for (const w of [-2.9, 10.5]) box(xx - 0.25, -1, Z(w) - 0.25, xx + 0.25, QY + 4, Z(w) + 0.25, { color: C.yellow, tex: TX.METAL });
  // base deck all round the tower at ship-deck height, and a gangway to the ship
  let [a, b] = zs(-2.6, 10.2);
  box(x - 1.8, SY - 0.4, a, x + 6.2, SY, b, ST);
  const wShip = (side > 0 ? SHIP.z0 + 0.5 - zA : zA - (SHIP.z1 - 0.5));
  [a, b] = zs(10.2, wShip);
  box(x, SY - 0.3, a, x + 4.4, SY, b, ST);
  box(x, SY, a, x + 0.05, SY + 1.05, b, YL); box(x + 4.35, SY, a, x + 4.4, SY + 1.05, b, YL);
  // a landing at each turn, railed on the open sides; the top one joins a bridge to the quay
  for (let k = 1; k <= 4; k++) {
    const y = SY + k * fh;
    [a, b] = zs(-2.6, 1.8);
    box(x - 0.2, y - 0.3, a, x + 4.6, y, b, ST);
    if (k < 4) {
      [a, b] = zs(-2.65, -2.6); box(x - 0.2, y, a, x + 4.6, y + 1.05, b, YL);
      [a, b] = zs(-2.6, 1.6); box(x - 0.25, y, a, x - 0.2, y + 1.05, b, YL); box(x + 4.6, y, a, x + 4.65, y + 1.05, b, YL);
    }
  }
  [a, b] = zs(-8.6, -2.6);
  box(x - 0.2, QY - 0.3, a, x + 4.6, QY, b, ST);
  [a, b] = zs(-8.6, 1.6);
  box(x - 0.25, QY, a, x - 0.2, QY + 1.05, b, YL); box(x + 4.6, QY, a, x + 4.65, QY + 1.05, b, YL);
  glow(x - 0.2, QY + 3.2, Z(-0.1) - 0.1, x + 4.6, QY + 3.4, Z(-0.1) + 0.1, [1, 0.6, 0.15], 0.9);
  // routes for the bots: from the ship, round the tower to the first flight; and off the top onto the quay
  NAV_CHAINS.push([[x + 2.2, SY, Z(wShip + 1)], [x + 2.2, SY, Z(11)], [x + 2.2, SY, Z(9.6)], [x - 1, SY, Z(9.6)], [x - 1, SY, Z(-1.6)], [x + 1.1, SY, Z(-1.6)], [x + 1.1, SY, Z(0.8)]]);
  NAV_CHAINS.push([[x + 3.3, QY, Z(0.8)], [x + 2.2, QY, Z(-2.6)], [x + 2.2, QY, Z(-9.8)]]);
}

// ---------------------------------------------------------------- the moving containers and their rails
function cargoLines(world) {
  const lines = [];
  const RAIL = { color: [0.95, 0.72, 0.1], tex: TX.METAL, noShadow: true };
  // north ↔ south over the ship: top flush with the quays, so you can step on and off
  [-30, 0, 30].forEach((x, i) => {
    const y = QY - 1.3;
    lines.push(new CargoLine(world, { a: L(x, y, -30), b: L(x, y, 30), size: [2.8, 2.6, 12], color: BOXES[i * 2 % BOXES.length], speed: 6, pause: 3.5, phase: i / 3, railY: Y0 + 38 }));
    box(x - 0.35, 38, -50, x + 0.35, 38.7, 50, RAIL);
    for (const z of [-46, 46]) for (const dx of [-2.6, 2.6]) box(x + dx - 0.35, QY, z - 0.35, x + dx + 0.35, 38.7, z + 0.35, { color: C.yellow, tex: TX.METAL });
    for (const z of [-46, 46]) box(x - 2.9, 38.7, z - 0.4, x + 2.9, 39.3, z + 0.4, { color: C.yellow, tex: TX.METAL });
  });
  // west ↔ east, higher up, from loading deck to loading deck
  [-16, 16].forEach((z, i) => {
    const y = LY - 1.3;
    lines.push(new CargoLine(world, { a: L(-58, y, z), b: L(58, y, z), size: [12, 2.6, 2.8], color: BOXES[(i * 3 + 1) % BOXES.length], speed: 8, pause: 3.5, phase: i * 0.5 + 0.25, railY: Y0 + 45 }));
    box(-73, 45, z - 0.35, 73, 45.7, z + 0.35, RAIL);
    for (const x of [-73, 73]) box(x - 0.4, 45.7, z - 2.9, x + 0.4, 46.3, z + 2.9, { color: C.yellow, tex: TX.METAL });
  });
  return lines;
}

// ---------------------------------------------------------------- ship-to-shore cranes (scenery and grapple points)
function cranes() {
  for (const [cx, side] of [[15, -1], [-15, 1]]) {
    const zq0 = side < 0 ? -64 : 42, zq1 = side < 0 ? -42 : 64;
    const Y = { color: [0.88, 0.32, 0.12], tex: TX.METAL };
    for (const x of [cx - 4, cx + 4]) for (const z of [zq0, zq1]) box(x - 0.6, QY, z - 0.6, x + 0.6, 56, z + 0.6, Y);
    for (const z of [zq0, zq1]) box(cx - 4.6, 52, z - 0.7, cx + 4.6, 54, z + 0.7, Y);
    const b0 = side < 0 ? -70 : -4, b1 = side < 0 ? 4 : 70;
    box(cx - 1.2, 56, b0, cx + 1.2, 58, b1, Y);
    box(cx - 2, 56, (zq0 + zq1) / 2 - 3, cx + 2, 60, (zq0 + zq1) / 2 + 3, { color: C.white, tex: TX.OFFICE });
    glow(cx - 0.3, 58, (side < 0 ? b1 : b0) - 0.3, cx + 0.3, 58.6, (side < 0 ? b1 : b0) + 0.3, [1, 0.15, 0.1], 1);
  }
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
