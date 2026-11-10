// Moving shipping containers for Sky Docks: each one hangs from a trolley on an overhead crane rail and glides
// from one quay to the other, pauses, and comes back. Stand on top to ride it across; hook it (G) to save a fall.
import { makeBox, moveBoxTo } from './world.js';

const RIB = 5;    // ribbed-metal surface

export class CargoLine {
  // o: { a: [x, y, z] dock A (container centre), b: dock B, size: [sx, sy, sz], color, speed, pause, phase (0..1), railY }
  constructor(world, o) {
    Object.assign(this, { world, a: o.a, b: o.b, size: o.size, speed: o.speed || 6, pause: o.pause ?? 3, railY: o.railY });
    const d = [this.b[0] - this.a[0], this.b[1] - this.a[1], this.b[2] - this.a[2]];
    this.len = Math.hypot(...d);
    this.travel = this.len / this.speed;
    this.cycle = 2 * (this.travel + this.pause);
    this.t = (o.phase || 0) * this.cycle;
    const [sx, sy, sz] = this.size;
    const add = (c, s, opt) => world.add(makeBox([c[0] - s[0] / 2, c[1] - s[1] / 2, c[2] - s[2] / 2], [c[0] + s[0] / 2, c[1] + s[1] / 2, c[2] + s[2] / 2], { grid: false, edges: false, ...opt }));
    this.parts = [];
    const part = (off, s, opt) => { const b = add(this.a.map((v, i) => v + off[i]), s, opt); this.parts.push([b, off]); return b; };
    // the container itself (the hook targets this box), end doors and corner posts
    this.box = part([0, 0, 0], this.size, { color: o.color, tex: RIB, tag: 'cargo' });
    const along = sx > sz ? 0 : 2;
    const endOff = (s) => (along === 0 ? [s * (sx / 2 + 0.01), 0, 0] : [0, 0, s * (sz / 2 + 0.01)]);
    const endSize = along === 0 ? [0.04, sy - 0.2, sz - 0.2] : [sx - 0.2, sy - 0.2, 0.04];
    for (const s of [-1, 1]) part(endOff(s), endSize, { color: o.color.map((v) => v * 0.75), solid: false, noShadow: true });
    for (const cx of [-1, 1]) for (const cz of [-1, 1]) part([cx * (sx / 2 - 0.08), 0, cz * (sz / 2 - 0.08)], [0.18, sy + 0.02, 0.18], { color: [0.15, 0.15, 0.17], solid: false, noShadow: true });
    // a hazard stripe along the top edge so you can see where to stand
    part([0, sy / 2 + 0.006, 0], along === 0 ? [sx - 0.4, 0.012, 0.18] : [0.18, 0.012, sz - 0.4], { color: [0.95, 0.72, 0.1], solid: false, noShadow: true, emissive: 0.25 });
    // trolley on the rail and four cables down to the container's corners
    const top = sy / 2, cableH = this.railY - (this.a[1] + top);
    this.trolley = part([0, cableH + top + 0.4, 0], [2.2, 0.8, 2.2], { color: [0.95, 0.72, 0.1], tex: RIB, solid: false });
    for (const cx of [-1, 1]) for (const cz of [-1, 1]) part([cx * (along === 0 ? sx / 2 - 0.6 : 0.9) * 0.6, top + cableH / 2, cz * (along === 0 ? 0.9 : sz / 2 - 0.6) * 0.6], [0.05, cableH, 0.05], { color: [0.12, 0.12, 0.13], solid: false, noShadow: true });
    this.lamp = part([0, top + 0.05, 0], [0.4, 0.1, 0.4], { color: [1, 0.6, 0.15], emissive: 1, solid: false, noShadow: true });
    this.pos = [...this.a];
    this.place();
  }

  // where the container is at time t: A → (pause) → B → (pause) → A
  at(t) {
    const c = ((t % this.cycle) + this.cycle) % this.cycle, T = this.travel, P = this.pause;
    let k;
    if (c < P) k = 0;
    else if (c < P + T) k = ease((c - P) / T);
    else if (c < 2 * P + T) k = 1;
    else k = 1 - ease((c - 2 * P - T) / T);
    return this.a.map((v, i) => v + (this.b[i] - v) * k);
  }

  place() {
    for (const [b, off] of this.parts) moveBoxTo(b, [this.pos[0] + off[0], this.pos[1] + off[1], this.pos[2] + off[2]]);
  }

  // call before the player moves: carries anyone standing on top
  update(dt, player) {
    const prev = this.pos;
    this.t += dt;
    this.pos = this.at(this.t);
    const d = [this.pos[0] - prev[0], this.pos[1] - prev[1], this.pos[2] - prev[2]];
    const [sx, sy, sz] = this.size, p = player.pos;
    const onTop = Math.abs(p[0] - prev[0]) < sx / 2 + 0.25 && Math.abs(p[2] - prev[2]) < sz / 2 + 0.25 && Math.abs(p[1] - (prev[1] + sy / 2)) < 0.2;
    if (onTop && (player.grounded || player.vel[1] <= 0.1)) { p[0] += d[0]; p[1] += d[1]; p[2] += d[2]; }
    const moving = Math.hypot(...d) > 1e-4;
    this.lamp.emissive = moving ? (Math.sin(this.t * 8) > 0 ? 1 : 0.2) : 0.4;
    this.place();
  }

  get top() { return this.pos[1] + this.size[1] / 2; }
}

const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
