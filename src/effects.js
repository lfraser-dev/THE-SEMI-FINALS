// Shatter debris, bullet tracers, impact sparks and bullet-hole decals.
import { compose, anglesFor, sub, len, mat4 } from './math.js';

const MAX_DEBRIS = 500;
const MAX_DECALS = 90;

export class Effects {
  constructor(world) {
    this.world = world;
    this.debris = [];
    this.tracers = [];
    this.decals = [];
    this.m = mat4();
  }

  clear() { this.debris.length = 0; this.tracers.length = 0; this.decals.length = 0; }

  spawnPiece(pos, size, vel, color, life, emissive = 0) {
    if (this.debris.length >= MAX_DEBRIS) this.debris.shift();
    this.debris.push({
      pos: [...pos], size, vel, color, emissive, life, maxLife: life,
      rot: [Math.random() * 6, Math.random() * 6, Math.random() * 6],
      spin: [(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14],
    });
  }

  // Break a box into n*n*n chunks that fly away from `from` along `push`.
  shatter(box, push = [0, 0, 0], n = 3, force = 5, emissive = 0) {
    const s = box.scale.map((v) => v / n);
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) {
      const p = [box.min[0] + s[0] * (x + 0.5), box.min[1] + s[1] * (y + 0.5), box.min[2] + s[2] * (z + 0.5)];
      const out = sub(p, box.center);
      const vel = [
        out[0] * force * 2 + push[0] * force + (Math.random() - 0.5) * force * 0.6,
        out[1] * force * 2 + Math.abs(push[1]) * force + Math.random() * force * 0.7 + 1.5,
        out[2] * force * 2 + push[2] * force + (Math.random() - 0.5) * force * 0.6,
      ];
      const shrink = 0.7 + Math.random() * 0.35;
      this.spawnPiece(p, s.map((v) => v * shrink), vel, box.color, 2.4 + Math.random() * 1.4, emissive);
    }
  }

  impact(point, normal, color) {
    for (let i = 0; i < 5; i++) {
      const v = [
        normal[0] * 3 + (Math.random() - 0.5) * 4,
        normal[1] * 3 + Math.random() * 3,
        normal[2] * 3 + (Math.random() - 0.5) * 4,
      ];
      const sz = 0.03 + Math.random() * 0.04;
      this.spawnPiece(point.map((c, k) => c + normal[k] * 0.05), [sz, sz, sz], v, color.map((c) => c * 0.75), 0.5 + Math.random() * 0.4);
    }
  }

  decal(point, normal) {
    if (this.decals.length >= MAX_DECALS) this.decals.shift();
    const size = [0.07, 0.07, 0.07];
    const ax = normal.findIndex((v) => v !== 0);
    size[ax] = 0.006;
    const p = point.map((c, k) => c + normal[k] * 0.003);
    const model = new Float32Array(16);
    compose(model, p, [0, 0, 0], size);
    this.decals.push({ model, size, life: 12 });
  }

  tracer(from, to) {
    const d = sub(to, from), l = len(d);
    if (l < 0.5) return;
    this.tracers.push({ from, to, dir: d, length: l, life: 0.07 });
  }

  update(dt) {
    const w = this.world;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      if (d.life <= 0) { this.debris.splice(i, 1); continue; }
      d.vel[1] -= 20 * dt;
      const hy = d.size[1] / 2;
      const nx = d.pos[0] + d.vel[0] * dt, ny = d.pos[1] + d.vel[1] * dt, nz = d.pos[2] + d.vel[2] * dt;
      let px = d.pos[0], py = d.pos[1], pz = d.pos[2];
      if (w.pointInside([px, ny - hy, pz])) {
        d.vel[1] *= -0.3; d.vel[0] *= 0.6; d.vel[2] *= 0.6;
        d.spin = d.spin.map((s) => s * 0.5);
      } else py = ny;
      if (w.pointInside([nx, py - hy + 0.01, pz])) d.vel[0] *= -0.4; else px = nx;
      if (w.pointInside([px, py - hy + 0.01, nz])) d.vel[2] *= -0.4; else pz = nz;
      d.pos[0] = px; d.pos[1] = py; d.pos[2] = pz;
      for (let k = 0; k < 3; k++) d.rot[k] += d.spin[k] * dt;
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      if ((this.tracers[i].life -= dt) <= 0) this.tracers.splice(i, 1);
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      if ((this.decals[i].life -= dt) <= 0) this.decals.splice(i, 1);
    }
  }

  drawOpaque(r) {
    for (const d of this.decals) r.draw(d.model, d.size, [0.12, 0.12, 0.13], 0, 0, 0.6);
    for (const d of this.debris) {
      if (d.life < 0.5) continue;
      compose(this.m, d.pos, d.rot, d.size);
      r.draw(this.m, d.size, d.color, 0, 1, d.emissive);
    }
  }

  drawTransparent(r) {
    for (const d of this.debris) {
      if (d.life >= 0.5) continue;
      compose(this.m, d.pos, d.rot, d.size);
      r.draw(this.m, d.size, d.color, 0, 1, d.emissive, d.life / 0.5);
    }
    for (const t of this.tracers) {
      // the tracer is a short streak travelling along the shot
      const prog = 1 - t.life / 0.07;
      const streak = Math.min(6, t.length * 0.5);
      const startT = Math.min(prog * t.length, t.length - streak) ;
      const center = t.from.map((c, k) => c + t.dir[k] / t.length * (startT + streak / 2));
      const s = [0.018, 0.018, streak];
      compose(this.m, center, anglesFor(t.dir), s);
      r.draw(this.m, s, [1, 0.85, 0.55], 0, 0, 1, 0.85);
    }
  }
}
