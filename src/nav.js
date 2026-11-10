// Navigation for the bots: a grid of walkable points sampled on each floor level, joined to their
// neighbours, plus hand-placed routes up stairs between levels. A* finds paths over it.
const STEP = 1.5;

export class Nav {
  constructor(world) { this.world = world; this.ready = false; }

  // levels: [{ y, rects: [[x0, z0, x1, z1]] }], chains: [[[x, y, z], ...]], exclude: [[x0, z0, x1, z1]]
  build({ levels, chains = [], exclude = [] }) {
    const w = this.world;
    const X = [], Y = [], Z = [], adj = [];
    this.hash = new Map();
    const hk = (ix, iz, l) => `${ix},${iz},${l}`;
    const excluded = (x, z) => exclude.some(([a, b, c, d]) => x > a && x < c && z > b && z < d);
    const clear = (x, y, z) => !w.firstOverlap([x - 0.32, y + 0.42, z - 0.32], [x + 0.32, y + 1.8, z + 0.32]);
    const floor = (x, y, z) => !!w.firstOverlap([x - 0.08, y - 0.12, z - 0.08], [x + 0.08, y - 0.03, z + 0.08]);   // a small patch, so seams between slabs count
    const ok = (x, y, z) => !excluded(x, z) && floor(x, y, z) && clear(x, y, z);
    const addNode = (x, y, z) => { X.push(x); Y.push(y); Z.push(z); adj.push([]); return X.length - 1; };
    const link = (a, b) => { if (a !== b && !adj[a].includes(b)) { adj[a].push(b); adj[b].push(a); } };
    this.levels = levels.map((l) => l.y);
    this.chainIds = [];
    levels.forEach((lv, li) => {
      const seen = new Map();
      for (const [x0, z0, x1, z1] of lv.rects) {
        for (let x = Math.ceil(x0 / STEP) * STEP; x <= x1; x += STEP) {
          for (let z = Math.ceil(z0 / STEP) * STEP; z <= z1; z += STEP) {
            const ix = Math.round(x / STEP), iz = Math.round(z / STEP), k = hk(ix, iz, li);
            if (seen.has(k)) continue;
            seen.set(k, -1);
            if (!ok(x, lv.y, z)) continue;
            const n = addNode(x, lv.y, z);
            seen.set(k, n);
            this.hash.set(k, n);
          }
        }
      }
      // connect 8-neighbours when the way between is clear
      for (const [k, n] of seen) {
        if (n < 0) continue;
        const [ix, iz] = k.split(',').map(Number);
        for (const [dx, dz] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
          const m = seen.get(hk(ix + dx, iz + dz, li));
          if (m == null || m < 0) continue;
          if (dx && dz) {
            const a = seen.get(hk(ix + dx, iz, li)), b = seen.get(hk(ix, iz + dz, li));
            if (!(a >= 0) || !(b >= 0)) continue;
          }
          const mx = (X[n] + X[m]) / 2, mz = (Z[n] + Z[m]) / 2;
          if (ok(mx, lv.y, mz)) link(n, m);
        }
      }
    });
    // stair routes: chain the points together, tie both ends into the grid
    this.N = X.length;
    for (const ch of chains) {
      const ids = ch.map(([x, y, z]) => addNode(x, y, z));
      (this.chainIds = this.chainIds || []).push(ids);
      for (let i = 0; i < ids.length - 1; i++) link(ids[i], ids[i + 1]);
      for (const end of [ids[0], ids[ids.length - 1]]) {
        const li = this.levelOfY(Y[end], levels);
        if (li < 0) continue;
        const cx = Math.round(X[end] / STEP), cz = Math.round(Z[end] / STEP);
        const near = [];
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
          const n = this.hash.get(hk(cx + dx, cz + dz, li));
          if (n != null) near.push([Math.hypot(X[n] - X[end], Z[n] - Z[end]), n]);
        }
        near.sort((p, q) => p[0] - q[0]);
        for (const [d, n] of near.slice(0, 3)) if (d < 3) link(end, n);
      }
    }
    // chain ends that meet (one flight's top and the next flight's start, approach routes) join up
    const ends = [];
    for (const ch of this.chainIds || []) ends.push(ch[0], ch[ch.length - 1]);
    for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) {
      const p = ends[i], q = ends[j];
      if (Math.hypot(X[p] - X[q], Z[p] - Z[q]) < 2.5 && Math.abs(Y[p] - Y[q]) < 0.3) link(p, q);   // across a landing
    }
    this.X = Float32Array.from(X); this.Y = Float32Array.from(Y); this.Z = Float32Array.from(Z);
    this.adj = adj;
    this.count = X.length;
    this.ready = true;
  }

  levelOf(y) {
    let best = 0, d = Infinity;
    this.levels.forEach((ly, i) => { const e = Math.abs(ly - y); if (e < d) { d = e; best = i; } });
    return d < 2.4 ? best : -1;
  }

  levelOfY(y, levels) {
    let best = -1, d = 0.6;
    levels.forEach((l, i) => { const e = Math.abs(l.y - y); if (e < d) { d = e; best = i; } });
    return best;
  }

  nearest(p, r = 6) {
    const li = this.levelOf(p[1]);
    let best = -1, bd = Infinity;
    const cx = Math.round(p[0] / STEP), cz = Math.round(p[2] / STEP), R = Math.ceil(r / STEP);
    if (li >= 0) {
      for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
        const n = this.hash.get(`${cx + dx},${cz + dz},${li}`);
        if (n == null) continue;
        const d = Math.hypot(this.X[n] - p[0], this.Z[n] - p[2]);
        if (d < bd) { bd = d; best = n; }
      }
    }
    if (best < 0) {
      // on stairs or off-grid: any node close in 3D
      for (let n = 0; n < this.count; n++) {
        const d = Math.hypot(this.X[n] - p[0], (this.Y[n] - p[1]) * 2, this.Z[n] - p[2]);
        if (d < bd) { bd = d; best = n; }
      }
    }
    return best;
  }

  // grid nodes on the same level within r of p
  around(p, r) {
    const li = this.levelOf(p[1]), out = [];
    if (li < 0) return out;
    const cx = Math.round(p[0] / STEP), cz = Math.round(p[2] / STEP), R = Math.ceil(r / STEP);
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      const n = this.hash.get(`${cx + dx},${cz + dz},${li}`);
      if (n != null) out.push(n);
    }
    return out;
  }

  point(n) { return [this.X[n], this.Y[n], this.Z[n]]; }

  // A* from node a to node b; returns a list of points (or null)
  path(a, b) {
    if (a < 0 || b < 0) return null;
    if (a === b) return [this.point(b)];
    const N = this.count, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const h = (n) => Math.hypot(this.X[n] - this.X[b], (this.Y[n] - this.Y[b]) * 1.5, this.Z[n] - this.Z[b]);
    const heap = [];        // [f, n]
    const push = (f, n) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    g[a] = 0;
    push(h(a), a);
    let iter = 0;
    while (heap.length && iter++ < 60000) {
      const [, n] = pop();
      if (closed[n]) continue;
      if (n === b) break;
      closed[n] = 1;
      for (const m of this.adj[n]) {
        if (closed[m]) continue;
        const c = g[n] + Math.hypot(this.X[m] - this.X[n], this.Y[m] - this.Y[n], this.Z[m] - this.Z[n]);
        if (c < g[m]) { g[m] = c; from[m] = n; push(c + h(m), m); }
      }
    }
    if (from[b] < 0) return null;
    const out = [];
    for (let n = b; n >= 0 && n !== a; n = from[n]) out.push(this.point(n));
    out.reverse();
    // drop straight-line points on flat ground so bots move smoothly
    const pts = [];
    for (let i = 0; i < out.length; i++) {
      if (i > 0 && i < out.length - 1 && i % 2 === 1 && Math.abs(out[i][1] - out[i - 1][1]) < 0.01 && Math.abs(out[i + 1][1] - out[i][1]) < 0.01) continue;
      pts.push(out[i]);
    }
    return pts;
  }
}
