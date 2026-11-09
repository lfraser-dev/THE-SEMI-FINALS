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

export class World {
  constructor() { this.boxes = []; }
  add(b) { this.boxes.push(b); return b; }
  remove(b) { const i = this.boxes.indexOf(b); if (i >= 0) this.boxes.splice(i, 1); }
  clear() { this.boxes.length = 0; }

  firstOverlap(min, max) {
    for (const b of this.boxes) {
      if (!b.solid) continue;
      if (min[0] < b.max[0] && max[0] > b.min[0] &&
          min[1] < b.max[1] && max[1] > b.min[1] &&
          min[2] < b.max[2] && max[2] > b.min[2]) return b;
    }
    return null;
  }

  pointInside(p) {
    for (const b of this.boxes) {
      if (!b.solid) continue;
      if (p[0] > b.min[0] && p[0] < b.max[0] && p[1] > b.min[1] && p[1] < b.max[1] &&
          p[2] > b.min[2] && p[2] < b.max[2]) return b;
    }
    return null;
  }

  // Slab-method ray cast. Returns { t, box, point, normal } or null.
  raycast(o, d, maxT = 500, bullets = true) {
    let best = null, bestT = maxT;
    for (const b of this.boxes) {
      if (!b.solid || (bullets && b.noBullet)) continue;
      let tmin = -Infinity, tmax = Infinity, axis = 0, sign = 0, miss = false;
      for (let a = 0; a < 3; a++) {
        if (Math.abs(d[a]) < 1e-9) {
          if (o[a] < b.min[a] || o[a] > b.max[a]) { miss = true; break; }
          continue;
        }
        const inv = 1 / d[a];
        let t1 = (b.min[a] - o[a]) * inv, t2 = (b.max[a] - o[a]) * inv, s = -1;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
        if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) { miss = true; break; }
      }
      if (miss || tmin < 0 || tmin >= bestT) continue;
      bestT = tmin;
      const normal = [0, 0, 0];
      normal[axis] = sign;
      best = { t: tmin, box: b, normal };
    }
    if (best) best.point = [o[0] + d[0] * best.t, o[1] + d[1] * best.t, o[2] + d[2] * best.t];
    return best;
  }
}
