// The world is a list of axis-aligned boxes. They're used for both rendering and collision.
import { compose } from './math.js';

export const WHITE = [0.94, 0.94, 0.95];
let nextId = 1;

export function makeBox(min, max, o = {}) {
  const b = {
    id: nextId++,
    min: [...min],
    max: [...max],
    color: o.color || WHITE,
    grid: o.grid ?? true,
    edges: o.edges ?? true,
    solid: o.solid ?? true,
    emissive: o.emissive || 0,
    alpha: o.alpha ?? 1,          // < 1 = drawn in the transparent pass (glass)
    noBullet: !!o.noBullet,       // bullets pass through
    noShadow: !!o.noShadow,       // doesn't cast shadows
    hidden: !!o.hidden,           // collision / hitbox only, never drawn
    shape: o.shape,               // undefined = box, number = rounded edges (m), 'sphere', 'cyl'
    tex: o.tex || 0,              // procedural surface: 2 glass, 3 concrete, 4 paving, 5 metal, 6 office facade, 7 asphalt, 8 seats, 9 LED,
                                  // 10 plaster, 11 tiled slab, 12 wood slab, 13 brick facade
    mat: o.mat,                   // material name or [metalness, roughness]
    tag: o.tag || null,
    ref: o.ref || null,
    model: new Float32Array(16),
    scale: [0, 0, 0],
    center: [0, 0, 0],
  };
  refreshBox(b);
  return b;
}

export function refreshBox(b) {
  for (let i = 0; i < 3; i++) {
    b.center[i] = (b.min[i] + b.max[i]) / 2;
    b.scale[i] = b.max[i] - b.min[i];
  }
  compose(b.model, b.center, [0, 0, 0], b.scale);
  if (b.world) b.world.reinsert(b);       // keep the spatial grid in step when a box moves
}

export function moveBoxTo(b, center) {
  for (let i = 0; i < 3; i++) {
    const h = b.scale[i] / 2;
    b.min[i] = center[i] - h;
    b.max[i] = center[i] + h;
  }
  refreshBox(b);
}

// Helper: box from a center-bottom point and size (handy for map building)
export function boxAt(x, y, z, sx, sy, sz, o) {
  return makeBox([x - sx / 2, y, z - sz / 2], [x + sx / 2, y + sy, z + sz / 2], o);
}

// ---------------------------------------------------------------- spatial grid
// Boxes are bucketed into 6 m columns on the xz plane, so collision tests and ray casts only look at
// what's nearby instead of every box in the world. Very large boxes (floors, sky) sit in a short list
// that is always checked.
const CELL = 6, BIG = 400;
const key = (i, k) => i * 65536 + k;

export class World {
  constructor() { this.boxes = []; this.cells = new Map(); this.big = new Set(); this.stamp = 1; }

  add(b) { this.boxes.push(b); b.world = this; this.insert(b); return b; }
  remove(b) {
    const i = this.boxes.indexOf(b);
    if (i >= 0) this.boxes.splice(i, 1);
    this.unlink(b);
    b.world = null;
  }
  clear() { this.boxes.length = 0; this.cells.clear(); this.big.clear(); }

  insert(b) {
    const i0 = Math.floor(b.min[0] / CELL), i1 = Math.floor(b.max[0] / CELL);
    const k0 = Math.floor(b.min[2] / CELL), k1 = Math.floor(b.max[2] / CELL);
    b.gx = [i0, i1, k0, k1];
    if ((i1 - i0 + 1) * (k1 - k0 + 1) > BIG) { this.big.add(b); return; }
    for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) {
      const kk = key(i, k);
      let c = this.cells.get(kk);
      if (!c) { c = []; this.cells.set(kk, c); }
      c.push(b);
    }
  }
  unlink(b) {
    if (!b.gx) return;
    if (this.big.delete(b)) { b.gx = null; return; }
    const [i0, i1, k0, k1] = b.gx;
    for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) {
      const c = this.cells.get(key(i, k));
      if (!c) continue;
      const j = c.indexOf(b);
      if (j >= 0) { c[j] = c[c.length - 1]; c.pop(); }
    }
    b.gx = null;
  }
  reinsert(b) {
    const g = b.gx;
    if (g && Math.floor(b.min[0] / CELL) === g[0] && Math.floor(b.max[0] / CELL) === g[1] &&
        Math.floor(b.min[2] / CELL) === g[2] && Math.floor(b.max[2] / CELL) === g[3]) return;
    this.unlink(b);
    this.insert(b);
  }

  // every box whose column overlaps [min, max] (each once)
  near(min, max, fn) {
    const st = ++this.stamp;
    for (const b of this.big) { b.qs = st; if (fn(b)) return b; }
    const i0 = Math.floor(min[0] / CELL), i1 = Math.floor(max[0] / CELL);
    const k0 = Math.floor(min[2] / CELL), k1 = Math.floor(max[2] / CELL);
    for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) {
      const c = this.cells.get(key(i, k));
      if (!c) continue;
      for (let j = 0; j < c.length; j++) {
        const b = c[j];
        if (b.qs === st) continue;
        b.qs = st;
        if (fn(b)) return b;
      }
    }
    return null;
  }

  firstOverlap(min, max, ignore = null) {
    return this.near(min, max, (b) => b.solid && (ignore == null || (b.ref !== ignore && b !== ignore)) &&
      min[0] < b.max[0] && max[0] > b.min[0] && min[1] < b.max[1] && max[1] > b.min[1] && min[2] < b.max[2] && max[2] > b.min[2]);
  }

  pointInside(p) {
    return this.near(p, p, (b) => b.solid && p[0] > b.min[0] && p[0] < b.max[0] && p[1] > b.min[1] && p[1] < b.max[1] &&
      p[2] > b.min[2] && p[2] < b.max[2]);
  }

  // Slab-method ray cast, walking the grid columns along the ray. Returns { t, box, point, normal } or null.
  // skip(box) -> true ignores a box (e.g. see-through glass for line of sight).
  raycast(o, d, maxT = 500, bullets = true, skip = null) {
    let best = null, bestT = maxT;
    const st = ++this.stamp;
    const test = (b) => {
      if (b.qs === st) return;
      b.qs = st;
      if (!b.solid || (bullets && b.noBullet) || (skip && skip(b))) return;
      let tmin = -Infinity, tmax = Infinity, axis = 0, sign = 0;
      for (let a = 0; a < 3; a++) {
        if (Math.abs(d[a]) < 1e-9) {
          if (o[a] < b.min[a] || o[a] > b.max[a]) return;
          continue;
        }
        const inv = 1 / d[a];
        let t1 = (b.min[a] - o[a]) * inv, t2 = (b.max[a] - o[a]) * inv, s = -1;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
        if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return;
      }
      if (tmin < 0 || tmin >= bestT) return;
      bestT = tmin;
      const normal = [0, 0, 0];
      normal[axis] = sign;
      best = { t: tmin, box: b, normal };
    };
    for (const b of this.big) test(b);
    // 2D DDA over the xz columns
    let i = Math.floor(o[0] / CELL), k = Math.floor(o[2] / CELL);
    const sx = d[0] > 0 ? 1 : -1, sz = d[2] > 0 ? 1 : -1;
    const tdx = Math.abs(d[0]) > 1e-9 ? CELL / Math.abs(d[0]) : Infinity;
    const tdz = Math.abs(d[2]) > 1e-9 ? CELL / Math.abs(d[2]) : Infinity;
    let tx = Math.abs(d[0]) > 1e-9 ? ((sx > 0 ? (i + 1) * CELL - o[0] : o[0] - i * CELL) / Math.abs(d[0])) : Infinity;
    let tz = Math.abs(d[2]) > 1e-9 ? ((sz > 0 ? (k + 1) * CELL - o[2] : o[2] - k * CELL) / Math.abs(d[2])) : Infinity;
    let t = 0;
    for (let n = 0; n < 2000; n++) {
      const c = this.cells.get(key(i, k));
      if (c) for (let j = 0; j < c.length; j++) test(c[j]);
      const next = Math.min(tx, tz);
      if (bestT <= next || next > maxT) break;
      t = next;
      if (tx < tz) { i += sx; tx += tdx; } else { k += sz; tz += tdz; }
    }
    void t;
    if (best) best.point = [o[0] + d[0] * best.t, o[1] + d[1] * best.t, o[2] + d[2] * best.t];
    return best;
  }
}
