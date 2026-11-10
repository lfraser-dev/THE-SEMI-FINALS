// Static batching: scenery that never moves is grouped into spatial chunks and drawn with one instanced
// draw call per mesh per chunk, instead of one draw call (and ~10 uniform uploads) per box. That was the
// main cost of a frame. Every frame each batched box is checked against a snapshot of how it looked when
// it was batched; if it has moved, changed colour, glows differently, been hidden or removed, it drops out
// of its batch (which is rebuilt) and goes back to being drawn on its own.
import { INST_FLOATS } from './renderer.js';

const CHUNK = 28;          // m, chunk size on the xz plane
const BIG_R = 40;          // boxes bigger than this go in their own per-mesh "big" chunk

const snap = (b) => [b.center[0], b.center[1], b.center[2], b.scale[0], b.scale[1], b.scale[2],
  b.color[0], b.color[1], b.color[2], b.emissive || 0, b.alpha ?? 1, b.tex || 0, b.shape, b.color];
function same(b, s) {
  return !b.hidden && s[0] === b.center[0] && s[1] === b.center[1] && s[2] === b.center[2]
    && s[3] === b.scale[0] && s[4] === b.scale[1] && s[5] === b.scale[2]
    && s[13] === b.color && s[6] === b.color[0] && s[7] === b.color[1] && s[8] === b.color[2]
    && s[9] === (b.emissive || 0) && s[10] === (b.alpha ?? 1) && s[11] === (b.tex || 0) && s[12] === b.shape;
}

export class StaticBatches {
  constructor(renderer) { this.r = renderer; this.groups = []; this.world = null; this.data = new Float32Array(INST_FLOATS * 64); }

  clear() {
    for (const g of this.groups) { this.r.freeBatch(g.batch); for (const b of g.members) { b.batched = null; b._snap = null; } }
    this.groups = [];
  }

  // zoneOf(b) -> a key for which area the box belongs to (only one area is drawn at a time)
  build(world, zoneOf) {
    this.clear();
    this.world = world;
    const map = new Map();
    for (const b of world.boxes) {
      if (b.hidden || (b.alpha ?? 1) < 1 || b.dynamic) continue;
      const mesh = this.r.meshFor(b.shape, b.scale);
      const rad = 0.5 * Math.hypot(b.scale[0], b.scale[1], b.scale[2]);
      const cell = rad > BIG_R ? 'B' : `${Math.floor(b.center[0] / CHUNK)},${Math.floor(b.center[2] / CHUNK)}`;
      const zone = zoneOf(b);
      const key = `${zone}|${cell}|${mesh.id}`;
      let g = map.get(key);
      if (!g) { g = { zone, mesh, members: [], dirty: true, batch: this.r.makeBatch(mesh), center: [0, 0, 0], radius: 0 }; map.set(key, g); }
      g.members.push(b);
      b.batched = g;
      b._snap = snap(b);
    }
    this.groups = [...map.values()].filter((g) => {
      if (g.members.length > 1) return true;
      // a lone box gains nothing from instancing
      this.r.freeBatch(g.batch); g.members[0].batched = null; g.members[0]._snap = null;
      return false;
    });
    for (const g of this.groups) this.rebuild(g);
  }

  rebuild(g) {
    const n = g.members.length;
    if (this.data.length < n * INST_FLOATS) this.data = new Float32Array(n * INST_FLOATS * 2);
    // shadow casters first so the shadow pass can draw just the front of the list
    g.members.sort((a, b) => (a.noShadow ? 1 : 0) - (b.noShadow ? 1 : 0));
    let casters = 0;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    g.members.forEach((b, i) => {
      this.r.instanceData(this.data, i, b);
      if (!b.noShadow) casters++;
      for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], b.min[k]); hi[k] = Math.max(hi[k], b.max[k]); }
    });
    this.r.fillBatch(g.batch, this.data, n, casters);
    g.center = lo.map((v, k) => (v + hi[k]) / 2);
    g.radius = 0.5 * Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
    g.dirty = false;
  }

  // drop anything that changed since it was batched; rebuild the groups that lost members
  sync() {
    for (const g of this.groups) {
      let lost = false;
      for (let i = g.members.length - 1; i >= 0; i--) {
        const b = g.members[i];
        if (b.world === this.world && same(b, b._snap)) continue;
        b.batched = null; b._snap = null; b.dynamic = true;     // it moves / changes: never batch it again
        g.members.splice(i, 1);
        lost = true;
      }
      if (lost) this.rebuild(g);
    }
  }

  // cull(center, radius) -> draw this chunk?
  draw(zone, cull) {
    for (const g of this.groups) if (g.zone === zone && g.members.length && cull(g.center, g.radius)) this.r.drawBatch(g.batch);
    this.r.endBatches();
  }

  drawShadows(zone, cull) {
    for (const g of this.groups) if (g.zone === zone && g.members.length && cull(g.center, g.radius)) this.r.shadowBatch(g.batch);
    this.r.gl.bindVertexArray(null); this.r.boundMesh = null;
  }

  get count() { return this.groups.reduce((n, g) => n + g.members.length, 0); }
}
