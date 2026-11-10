// "Container Ship": the semi-finals arena is one enormous freighter, ploughing through fog.
// Its deck is a maze of container stacks (one to five high) with lanes, open bays and a stern bridge.
// Shipping containers hang from rails that cross the ship: they slide out of the fog on one side, over the deck,
// and back into the fog on the other. Ride them across, but get off before the fog takes you.
// The sea is death. Drops over 18 m kill; 9 m+ hurts.
import { makeBox } from '../world.js';
import { digitBoxes } from '../props.js';
import { CargoLine } from '../cargo.js';

const OX = 0, OZ = -702, Y0 = 63;
const FH = 4.5;
const TX = { GLASS: 2, CONC: 3, PAVE: 4, METAL: 5, OFFICE: 6, ASPH: 7, SEATS: 8, LED: 9, PLASTER: 10, TILE: 11, WOOD: 12, BRICK: 13, BOX: 14, SEA: 15 };
const C = {
  conc: [0.7, 0.69, 0.66], concDark: [0.47, 0.47, 0.46], warm: [0.8, 0.76, 0.68], brick: [0.6, 0.37, 0.29],
  plaster: [0.85, 0.84, 0.81], floor: [0.6, 0.59, 0.57], pave: [0.68, 0.67, 0.64], asph: [0.24, 0.24, 0.25],
  glass: [0.38, 0.52, 0.6], steel: [0.58, 0.6, 0.63], dark: [0.16, 0.17, 0.19], white: [0.9, 0.9, 0.9],
  wood: [0.5, 0.35, 0.22], grass: [0.32, 0.46, 0.2], leaf: [0.25, 0.42, 0.18], fabric: [0.26, 0.28, 0.33],
  yellow: [0.95, 0.72, 0.1], light: [1, 0.96, 0.88], office: [0.8, 0.78, 0.74], metalClad: [0.66, 0.66, 0.64],
  tower: [0.94, 0.94, 0.93], pane: [0.62, 0.78, 0.86],
  hull: [0.12, 0.16, 0.24], hullRed: [0.55, 0.13, 0.1], deck: [0.3, 0.38, 0.33], sea: [0.1, 0.22, 0.27], rail: [0.85, 0.85, 0.82],
};
const L = (x, y, z) => [OX + x, Y0 + y, OZ + z];

// ---- the ship (local metres: +x is the bow, the sea is at 0)
const SY = 12.4;                         // main deck (Y0 + SY is a multiple of 2.6, so container seams line up)
const HX0 = -140, HX1 = 140, HB = 24;    // hull from stern to where the bow starts tapering; half beam
const BOW = 34;                          // the bow taper beyond HX1
const CW = 2.44, CL = 12.2, CH = 2.6;    // container width, length, height
const ROW0 = CW * Math.round((OZ - 19.52) / CW) - OZ;      // first row edge, on the world 2.44 m grid
const ROWS = 16;
const BAYS = 15, BAY0 = -95, BAYSTEP = 14;
const CLEAR = [2, 7, 12];                // open bays: fighting pits for the vaults and stations
const bayX = (i) => BAY0 + i * BAYSTEP;   // a bay's stern edge
const RAIL_BAYS = [4, 9];                 // bays the moving containers cross over (stacks there stop at four high)
const RAIL_Y = SY + 24;
const RIDE_Y = SY + 4 * CH + 0.1 + CH / 2;   // centre of a moving container: just clears four-high stacks, level with five-high

const mid = (i) => bayX(i) + CL / 2;
const STATIONS = [[mid(2), SY, -11], [mid(7), SY, 11], [mid(12), SY, -11], [124, SY, 0]];
const VAULTS = [[mid(2), SY, 10], [mid(7), SY, -10], [mid(12), SY, 10], [-96, SY, 0]];
const NAV_CHAINS = [];
const GLASS = [];

export default {
  name: 'CONTAINER SHIP',
  origin: [OX, Y0, OZ],
  spawn: { pos: L(132, SY, 0), yaw: Math.PI / 2 },
  spawns: [
    { pos: L(134, SY, 0), yaw: Math.PI / 2 }, { pos: L(30, SY, -21.5), yaw: Math.PI },
    { pos: L(-97, SY, -12), yaw: -Math.PI / 2 }, { pos: L(30, SY, 21.5), yaw: 0 },
  ],
  voidText: ['SPLASH', 'OVERBOARD'],
  voidY: Y0 + 0.6,
  fallLethal: 18,
  fallHurt: 9,
  hook: false,
  area: { min: [OX - 320, Y0 - 160, OZ - 320], max: [OX + 320, Y0 + 260, OZ + 320] },
  fog: 0.0072,
  shadowHalf: 75,
  pads: [],
  lifts: [],
  stations: STATIONS.map((p) => L(...p)),
  vaults: VAULTS.map((p) => L(...p)),
  dummies: [],
  walls: [],
  nav: {
    levels: [{ y: Y0 + SY, rects: [[OX + HX0 + 2, OZ - HB + 1, OX + HX1 + BOW - 6, OZ + HB - 1]] }],
    chains: [],
    exclude: [],
  },
  build(world) {
    this.refs = buildShip(world);
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



// ================================================================ the ship
function buildShip(world) {
  W = world;
  seed = 20261110;
  GLASS.length = 0;
  NAV_CHAINS.length = 0;
  const refs = {};
  sea();
  hull();
  cargoBays();
  bridge();
  refs.cargo = crossings(world);
  refs.stations = STATIONS.map((p) => station(...p));
  refs.vaults = VAULTS.map((p) => vault(...p));
  return refs;
}

function sea() {
  deco(-700, -1, -700, 700, 0, 700, { color: C.sea, tex: TX.SEA });
}

// half-width of the deck at x (the bow tapers to a point)
const halfBeam = (x) => (x <= HX1 ? HB : Math.max(1.5, HB * Math.sqrt(Math.max(0, 1 - ((x - HX1) / BOW) ** 2))));

function hull() {
  const H = { color: C.hull, tex: TX.METAL }, R = { color: C.hullRed, tex: TX.METAL };
  // main hull: dark blue topsides, a red boot-top at the waterline, the deck on top
  box(HX0, -8, -HB, HX1, 2.5, HB, R);
  box(HX0, 2.5, -HB, HX1, SY - 0.6, HB, H);
  box(HX0, 2.3, -HB - 0.02, HX1, 2.7, HB + 0.02, { color: [0.85, 0.85, 0.8] });                // boot-top line
  box(HX0 + 0.4, SY - 0.6, -HB + 0.4, HX1, SY, HB - 0.4, { color: C.deck, tex: TX.ASPH });
  // the bow: slices narrowing to a stem, rising a little
  for (let i = 0; i < 12; i++) {
    const x0 = HX1 + i * (BOW / 12), x1 = x0 + BOW / 12, hb = halfBeam(x1 - 0.01);
    box(x0, -8 + i * 0.6, -hb, x1, 2.5, hb, R);
    box(x0, 2.5, -hb, x1, SY - 0.6 + i * 0.12, hb, H);
    box(x0, SY - 0.6 + i * 0.12, -hb + 0.4, x1, SY + i * 0.12, hb - 0.4, { color: C.deck, tex: TX.ASPH });
    for (const s of [-1, 1]) box(x0, SY + i * 0.12, s * (hb - 0.25) - 0.15, x1, SY + i * 0.12 + 1.1, s * (hb - 0.25) + 0.15, H);
  }
  // the stern: a flat transom
  box(HX0 - 0.6, -8, -HB + 1, HX0, SY + 1.1, HB - 1, H);
  // bulwarks (solid at the bow, railings along the sides)
  for (const s of [-1, 1]) {
    for (let x = HX0; x < HX1; x += 3) box(x - 0.05, SY, s * (HB - 0.3) - 0.05, x + 0.05, SY + 1.05, s * (HB - 0.3) + 0.05, { color: C.rail, mat: 'paint' });
    box(HX0, SY + 1.0, s * (HB - 0.3) - 0.07, HX1, SY + 1.1, s * (HB - 0.3) + 0.07, { color: C.rail, mat: 'paint' });
    box(HX0, SY, s * (HB - 0.3) - 0.05, HX1, SY + 1.1, s * (HB - 0.3) + 0.05, { hidden: true });
    // white foam along the waterline
    glow(HX0, 0.02, s * (HB + 0.2) - 1.2, HX1 + BOW * 0.5, 0.08, s * (HB + 0.2) + 1.2, [0.85, 0.92, 0.94], 0.25, { alpha: 0.7 });
  }
  glow(HX1 + BOW - 6, 0.02, -6, HX1 + BOW + 10, 0.1, 6, [0.9, 0.95, 0.96], 0.3, { alpha: 0.7 });          // bow wave
  glow(HX0 - 30, 0.02, -14, HX0, 0.06, 14, [0.82, 0.9, 0.92], 0.2, { alpha: 0.6 });                        // wake
  // the ship's name low on the bow, mooring winches, a mast with lights at the bow
  bigNum(7, HX1 + 6, 4.5, HB - 4.2, 2.6, [0.95, 0.95, 0.9]);
  for (const s of [-1, 1]) for (const x of [HX1 + 6, HX1 + 14]) {
    box(x - 1.2, SY + 0.6, s * 7 - 1, x + 1.2, SY + 2.0, s * 7 + 1, { color: C.yellow, tex: TX.METAL, shape: 0.2 });
    box(x - 0.4, SY + 0.6, s * 7 - 1.4, x + 0.4, SY + 2.4, s * 7 + 1.4, { color: C.dark, shape: 'cyl' });
  }
  box(HX1 + 20, SY + 1, -0.3, HX1 + 20.6, SY + 16, 0.3, { color: C.rail, mat: 'paint' });
  glow(HX1 + 19.9, SY + 16, -0.4, HX1 + 20.7, SY + 16.6, 0.4, [1, 0.95, 0.85], 1);
  // deck lights on short masts along both walkways
  for (let x = HX0 + 30; x < HX1; x += 20) for (const s of [-1, 1]) {
    box(x - 0.08, SY, s * (HB - 0.9) - 0.08, x + 0.08, SY + 5, s * (HB - 0.9) + 0.08, { color: C.dark });
    glow(x - 0.3, SY + 4.8, s * (HB - 1.3) - 0.3, x + 0.3, SY + 5, s * (HB - 1.3) + 0.3, [1, 0.92, 0.75], 1);
  }
}

// ---------------------------------------------------------------- the container stacks
function cargoBays() {
  const hm = (i, j) => {
    // a rolling skyline of stacks, 1-5 high; lanes stay clear
    const v = 2.6 + 1.6 * Math.sin(i * 0.85 + j * 0.35) + 1.2 * Math.cos(j * 1.25 - i * 0.55) + (rnd() - 0.5) * 1.6;
    return Math.max(0, Math.min(5, Math.round(v)));
  };
  for (let i = 0; i < BAYS; i++) {
    if (CLEAR.includes(i)) { pit(i); continue; }
    const x0 = bayX(i), x1 = x0 + CL;
    for (let j = 0; j < ROWS; j++) {
      let h = hm(i, j);
      if ((j === 7 || j === 8) && i % 3 !== 1) h = 0;          // the centre lane, broken every third bay
      if (j === 0 || j === ROWS - 1) h = Math.min(h, 2);         // lower at the edges so you can climb up
      if (RAIL_BAYS.includes(i)) h = Math.min(h, 4);
      if (!h) continue;
      const z0 = ROW0 + j * CW;
      box(x0, SY, z0 + 0.02, x1, SY + h * CH, z0 + CW - 0.02, { color: [rnd(), rnd(), rnd()], tex: TX.BOX, tag: 'cargo' });
    }
    // lashing bridge across the gap behind every other bay: a raised walkway at three-high
    if (i % 2 === 0 && i < BAYS - 1 && !CLEAR.includes(i + 1)) {
      const xb = x1 + 0.15, y = SY + 3 * CH;
      box(xb, y - 0.25, ROW0, xb + 1.5, y, ROW0 + ROWS * CW, { color: C.yellow, tex: TX.METAL });
      for (const z of [ROW0, ROW0 + ROWS * CW]) box(xb, SY, z - 0.15, xb + 0.3, y, z + 0.15, { color: C.yellow, tex: TX.METAL });
    }
  }
}
// an open bay: a sunken hatch with low cover round the vault or station
function pit(i) {
  const x0 = bayX(i) - 0.9, x1 = bayX(i) + CL + 0.9;
  deco(x0, SY, ROW0, x1, SY + 0.02, ROW0 + ROWS * CW, { color: C.hullRed.map((v) => v * 0.85), tex: TX.METAL });
  deco(x0, SY, ROW0, x1, SY + 0.03, ROW0 + 0.3, { color: C.yellow, emissive: 0.2 });
  deco(x0, SY, ROW0 + ROWS * CW - 0.3, x1, SY + 0.03, ROW0 + ROWS * CW, { color: C.yellow, emissive: 0.2 });
  // a few single containers and cover blocks inside the pit
  for (const [dx, z, h] of [[2, -3, 1], [CL - 3, 4, 1], [CL / 2, -0.5, 2]]) {
    box(bayX(i) + dx - 1.22, SY, z - 3, bayX(i) + dx + 1.22, SY + h * CH, z + 3, { color: [rnd(), rnd(), rnd()], tex: TX.BOX, tag: 'cargo' });
  }
  for (const [dx, z] of [[1.5, 6], [CL - 1.5, -6]]) box(bayX(i) + dx - 1.6, SY, z - 0.35, bayX(i) + dx + 1.6, SY + 0.95, z + 0.35, { color: C.conc, tex: TX.CONC, shape: 0.12 });
  for (const s of [-1, 1]) box(bayX(i) + CL / 2 - 0.1, SY, s * 17 - 0.1, bayX(i) + CL / 2 + 0.1, SY + 7, s * 17 + 0.1, { color: C.dark }),
    glow(bayX(i) + CL / 2 - 0.5, SY + 7, s * 17 - 0.5, bayX(i) + CL / 2 + 0.5, SY + 7.2, s * 17 + 0.5, [1, 0.92, 0.75], 1);
}

// ---------------------------------------------------------------- the bridge block at the stern
function bridge() {
  const x0 = -128, x1 = -104, W2 = 15;
  const WH = { color: [0.9, 0.9, 0.88], tex: TX.OFFICE };
  for (let k = 0; k < 6; k++) {
    const y = SY + k * 3.6, w = W2 - (k > 3 ? 1 : 0);
    walls4(x0, -w, x1, w, y, y + 3.6, {}, WH, 0.35);
    box(x0, y + 3.3, -w, x1, y + 3.6, w, { color: C.white, tex: TX.CONC });
  }
  const yb = SY + 6 * 3.6;
  // the wheelhouse: wide bridge wings, windows all round (breakable)
  box(x0 - 2, yb - 0.3, -HB + 0.5, x1 + 2, yb, HB - 0.5, { color: C.white, tex: TX.CONC });
  walls4(x0 + 4, -HB + 2, x1, HB - 2, yb, yb + 3.4, { e: [[-HB + 3, HB - 3, yb + 1, yb + 3]], n: [], s: [] }, { color: C.white, tex: TX.CONC }, 0.3);
  for (let z = -HB + 3; z < HB - 3; z += 2.5) GLASS.push([[OX + x1 - 0.18, Y0 + yb + 1, OZ + z], [OX + x1 - 0.12, Y0 + yb + 3, OZ + z + 2.3]]);
  box(x0 + 3, yb + 3.4, -HB + 1.5, x1 + 1, yb + 3.8, HB - 1.5, { color: C.white, tex: TX.CONC });
  // radar mast and the funnel
  box(x0 + 12, yb + 3.8, -0.2, x0 + 12.4, yb + 12, 0.2, { color: C.rail, mat: 'paint' });
  box(x0 + 10, yb + 10, -2.5, x0 + 14.4, yb + 10.3, 2.5, { color: C.dark });
  glow(x0 + 11.9, yb + 12, -0.3, x0 + 12.5, yb + 12.5, 0.3, [1, 0.15, 0.1], 1);
  box(x0 - 10, SY, -5, x0 - 2, SY + 30, 5, { color: C.hullRed, tex: TX.METAL });
  box(x0 - 10.05, SY + 24, -5.05, x0 - 1.95, SY + 27, 5.05, { color: [0.95, 0.75, 0.15] });
  box(x0 - 10.05, SY + 29, -5.05, x0 - 1.95, SY + 30, 5.05, { color: C.dark });
}

// ---------------------------------------------------------------- containers crossing out of the fog
function crossings(world) {
  const lines = [];
  for (const [r, bi] of RAIL_BAYS.entries()) {
    const x = bayX(bi) + CL / 2;
    // the rail, running out over the sea into the fog both ways, on pylons standing in the water
    box(x - 0.35, RAIL_Y, -220, x + 0.35, RAIL_Y + 0.8, 220, { color: C.yellow, tex: TX.METAL, noShadow: true });
    for (const z of [-200, -120, -60, 60, 120, 200]) {
      box(x - 1.2, -1, z - 1.2, x + 1.2, RAIL_Y + 0.8, z + 1.2, { color: [0.3, 0.32, 0.36], tex: TX.METAL });
      box(x - 3, RAIL_Y + 0.8, z - 0.6, x + 3, RAIL_Y + 1.6, z + 0.6, { color: C.yellow, tex: TX.METAL });
      glow(x - 0.3, RAIL_Y + 1.6, z - 0.3, x + 0.3, RAIL_Y + 2.1, z + 0.3, [1, 0.15, 0.1], 1);
    }
    // four containers per rail, evenly spaced, all heading the same way (alternating per rail)
    const dir = r % 2 ? -1 : 1, y = RIDE_Y;
    for (let k = 0; k < 4; k++) {
      lines.push(new CargoLine(world, {
        a: L(x, y, -210 * dir), b: L(x, y, 210 * dir), size: [CL, CH, CW], color: [rnd(), rnd(), rnd()], tex: TX.BOX,
        speed: 7, loop: true, phase: k / 4 + r * 0.125, railY: Y0 + RAIL_Y,
      }));
    }
  }
  return lines;
}


// ---------------------------------------------------------------- cashout stations and vaults (The Finals style)
// A cashout station: a squat plinth with hazard edges, a white terminal column, a cradle on top where the
// cash box sits, light fins at the corners and a floating hologram "$" that glows in the owning team's colour.
function station(x, y, z) {
  box(x - 1.3, y, z - 1.3, x + 1.3, y + 0.3, z + 1.3, { color: [0.16, 0.17, 0.19], tex: TX.METAL, shape: 0.08 });
  for (let i = 0; i < 8; i++) {
    const t = -1.3 + i * 0.325, c = i % 2 ? C.dark : C.yellow;
    deco(x + t, y + 0.3, z - 1.31, x + t + 0.325, y + 0.31, z - 1.2, { color: c }); deco(x + t, y + 0.3, z + 1.2, x + t + 0.325, y + 0.31, z + 1.31, { color: c });
  }
  box(x - 0.55, y + 0.3, z - 0.55, x + 0.55, y + 1.75, z + 0.55, { color: [0.92, 0.92, 0.9], tex: TX.METAL, shape: 0.12 });
  box(x - 0.7, y + 1.75, z - 0.7, x + 0.7, y + 1.95, z + 0.7, { color: [0.16, 0.17, 0.19], shape: 0.06 });
  // screens on all four sides of the column
  const top = glow(x - 0.42, y + 1.0, z + 0.56, x + 0.42, y + 1.55, z + 0.57, [0.85, 0.85, 0.9], 0.7);
  glow(x - 0.42, y + 1.0, z - 0.57, x + 0.42, y + 1.55, z - 0.56, [0.85, 0.85, 0.9], 0.7);
  const ring = glow(x - 1.32, y + 0.08, z - 1.32, x + 1.32, y + 0.2, z + 1.32, [0.85, 0.85, 0.9], 0.7);
  const fins = [];
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) fins.push(glow(x + a * 0.68 - 0.06, y + 1.95, z + b * 0.68 - 0.06, x + a * 0.68 + 0.06, y + 2.6, z + b * 0.68 + 0.06, [0.85, 0.85, 0.9], 0.8));
  // the hologram: a "$" made of glowing bars, floating above
  const hy = y + 3.4, holo = [];
  const H = (x0, y0, x1, y1) => holo.push(glow(x + x0, hy + y0, z - 0.06, x + x1, hy + y1, z + 0.06, [0.85, 0.85, 0.9], 0.9, { alpha: 0.75 }));
  H(-0.45, 1.1, 0.45, 1.25); H(-0.45, 0.6, -0.3, 1.25); H(-0.45, 0.55, 0.45, 0.7); H(0.3, 0, 0.45, 0.7); H(-0.45, -0.05, 0.45, 0.1);
  H(-0.06, -0.3, 0.06, 1.5);
  for (const a of [Math.PI / 2]) void a;
  const holo2 = [];
  const H2 = (x0, y0, x1, y1) => holo2.push(glow(x - 0.06, hy + y0, z + x0, x + 0.06, hy + y1, z + x1, [0.85, 0.85, 0.9], 0.9, { alpha: 0.75 }));
  H2(-0.45, 1.1, 0.45, 1.25); H2(-0.45, 0.6, -0.3, 1.25); H2(-0.45, 0.55, 0.45, 0.7); H2(0.3, 0, 0.45, 0.7); H2(-0.45, -0.05, 0.45, 0.1); H2(-0.06, -0.3, 0.06, 1.5);
  const beam = glow(x - 0.5, y + 1.95, z - 0.5, x + 0.5, y + 60, z + 0.5, [1, 1, 1], 1, { alpha: 0 });
  return { ring, top, beam, fins, holo: [...holo, ...holo2], pos: L(x, y, z), slot: 1.95 };
}
// A vault: a big armoured safe with a round door, a spoked handle wheel and a status light bar.
function vault(x, y, z) {
  const S = { color: [0.24, 0.25, 0.28], tex: TX.METAL };
  box(x - 1.5, y, z - 1.5, x + 1.5, y + 0.25, z + 1.5, { color: [0.16, 0.17, 0.19], tex: TX.METAL, shape: 0.06 });
  box(x - 1.1, y + 0.25, z - 1.1, x + 1.1, y + 2.25, z + 1.1, { ...S, shape: 0.12 });
  // the door faces the nearer walkway side (±z) and both ends get one for looks
  for (const s of [-1, 1]) {
    box(x - 0.8, y + 0.45, z + s * 1.1 - 0.06, x + 0.8, y + 2.05, z + s * 1.1 + 0.06, { color: [0.36, 0.37, 0.4], mat: 'steel', shape: 0.3, solid: false });
    deco(x - 0.06, y + 0.75, z + s * 1.19 - 0.02, x + 0.06, y + 1.75, z + s * 1.19 + 0.02, { color: [0.85, 0.7, 0.3], mat: 'steel' });
    deco(x - 0.5, y + 1.19, z + s * 1.19 - 0.02, x + 0.5, y + 1.31, z + s * 1.19 + 0.02, { color: [0.85, 0.7, 0.3], mat: 'steel' });
    deco(x - 0.12, y + 1.13, z + s * 1.21 - 0.03, x + 0.12, y + 1.37, z + s * 1.21 + 0.03, { color: [0.85, 0.7, 0.3], mat: 'steel', shape: 'sphere' });
  }
  const ring = glow(x - 1.12, y + 2.05, z - 1.12, x + 1.12, y + 2.12, z + 1.12, [1, 0.2, 0.15], 0.9);
  const cap = glow(x - 0.9, y + 2.25, z - 0.9, x + 0.9, y + 2.28, z + 0.9, [1, 0.2, 0.15], 0.9);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + a * 1.05 - 0.12, y + 0.25, z + b * 1.05 - 0.12, x + a * 1.05 + 0.12, y + 2.3, z + b * 1.05 + 0.12, { color: [0.95, 0.72, 0.1], tex: TX.METAL, solid: false });
  return { ring, cap, pos: L(x, y + 2.3, z) };
}
