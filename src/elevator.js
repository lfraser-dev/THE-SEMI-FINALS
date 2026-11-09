// Cage elevator from the range floor down to the underground arena.
// Stand in the car for a moment and it goes; stand near either landing and it comes to you.
// Each landing has a gate that only opens when the car is there.
import { makeBox, moveBoxTo } from './world.js';

const STEEL = [0.36, 0.37, 0.4];
const DARK = [0.16, 0.17, 0.19];
const PLATE = [0.42, 0.43, 0.46];
const YELLOW = [0.95, 0.72, 0.1];

export class Elevator {
  constructor(world, { x, z, w = 3, d = 3, top = 0, bottom = -16 }) {
    Object.assign(this, { world, x, z, w, d, top, bottom });
    this.y = top;             // car floor height
    this.state = 'idle';
    this.from = top; this.to = top; this.t = 0; this.dur = 4.2;
    this.ride = 0;
    this.mustExit = false;
    const hw = w / 2, hd = d / 2;
    const add = (min, max, o) => world.add(makeBox(min, max, { grid: false, ...o }));

    // ---- the car: moving parts stored with their offset from (x, carFloor, z)
    this.parts = [];
    const part = (min, max, o) => {
      const b = add([x + min[0], min[1], z + min[2]], [x + max[0], max[1], z + max[2]], o);
      this.parts.push([b, [b.center[0] - x, b.center[1], b.center[2] - z]]);
      return b;
    };
    part([-hw, -0.25, -hd], [hw, 0, hd], { color: PLATE });                                     // floor
    part([-hw + 0.1, 0.001, -hd + 0.15], [hw - 0.1, 0.012, hd - 0.15], { color: [0.3, 0.31, 0.34], solid: false, edges: false });
    for (const sx of [-1, 1]) {                                                                // hazard edges at both openings
      for (let i = 0; i < 6; i++) {
        const z0 = -hd + i * (d / 6);
        part([sx * hw - (sx > 0 ? 0.22 : 0), 0.002, z0], [sx * hw + (sx > 0 ? 0 : 0.22), 0.014, z0 + d / 6],
          { color: i % 2 ? DARK : YELLOW, solid: false, edges: false });
      }
    }
    for (const sz of [-1, 1]) {                                                                // side walls
      const zz = sz * hd;
      part([-hw, 0, zz - (sz > 0 ? 0.08 : 0)], [hw, 2.55, zz + (sz > 0 ? 0 : 0.08)], { color: STEEL });
      part([-hw + 0.25, 0.9, zz - sz * 0.09 - 0.005], [hw - 0.25, 2.2, zz - sz * 0.09 + 0.005], { color: [0.26, 0.27, 0.3], solid: false });   // panel inset
      part([-hw + 0.15, 0.95, zz - sz * 0.16 - 0.025], [hw - 0.15, 1.0, zz - sz * 0.16 + 0.025], { color: [0.7, 0.71, 0.74], solid: false });  // handrail
      part([-hw, 2.55, zz - 0.06], [hw, 2.62, zz + 0.06], { color: [0.95, 0.15, 0.1], emissive: 0.7, solid: false, noShadow: true });
    }
    part([-hw, 2.62, -hd], [hw, 2.8, hd], { color: DARK });                                      // roof
    part([-0.7, 2.58, -0.25], [0.7, 2.62, 0.25], { color: [1, 0.96, 0.88], emissive: 1, solid: false, noShadow: true });   // roof light
    part([hw - 0.75, 1.2, -hd + 0.09], [hw - 0.4, 1.7, -hd + 0.14], { color: DARK, solid: false });                      // control panel
    this.panelLight = part([hw - 0.66, 1.52, -hd + 0.14], [hw - 0.49, 1.6, -hd + 0.15], { color: [0.95, 0.15, 0.1], emissive: 1, solid: false, noShadow: true });
    part([hw - 0.66, 1.32, -hd + 0.14], [hw - 0.49, 1.4, -hd + 0.15], { color: [0.9, 0.9, 0.92], emissive: 0.6, solid: false, noShadow: true });

    // ---- the cage above the range floor (top landing)
    const H = 3.4, px = [-hw - 0.05, hw + 0.05], pz = [-hd - 0.05, hd + 0.05];
    for (const sx of px) for (const sz of pz) add([x + sx - 0.12, top, z + sz - 0.12], [x + sx + 0.12, top + H, z + sz + 0.12], { color: DARK });
    add([x - hw - 0.2, top + H, z - hd - 0.2], [x + hw + 0.2, top + H + 0.25, z + hd + 0.2], { color: DARK });
    add([x - hw - 0.05, top + H - 0.02, z - 0.3], [x + hw + 0.05, top + H + 0.3, z + 0.3], { color: [0.95, 0.15, 0.1], emissive: 0.6, solid: false, noShadow: true });
    // slatted sides (north, south, west) — solid panel for collision, bars for looks
    const slats = (x0, x1, z0, z1) => {
      add([x0, top, z0], [x1, top + H, z1], { color: DARK, alpha: 0.0, noShadow: true, hidden: true });     // collider
      const alongX = (x1 - x0) > (z1 - z0);
      const L = alongX ? x1 - x0 : z1 - z0;
      for (let i = 0; i <= L / 0.22; i++) {
        const t = i * 0.22;
        if (alongX) add([x0 + t - 0.025, top, z0], [x0 + t + 0.025, top + H, z1], { color: STEEL, solid: false });
        else add([x0, top, z0 + t - 0.025], [x1, top + H, z0 + t + 0.025], { color: STEEL, solid: false });
      }
      for (const y of [0.05, 1.1, 2.3]) add([x0 - 0.01, top + y, z0 - 0.01], [x1 + 0.01, top + y + 0.1, z1 + 0.01], { color: DARK, solid: false });
    };
    slats(x - hw, x + hw, z - hd - 0.1, z - hd - 0.02);
    slats(x - hw, x + hw, z + hd + 0.02, z + hd + 0.1);
    slats(x - hw - 0.1, x - hw - 0.02, z - hd, z + hd);
    // hazard stripes around the hatch on the range floor
    for (let i = 0; i < 8; i++) {
      const t0 = -hd - 0.35 + i * ((d + 0.7) / 8), t1 = t0 + (d + 0.7) / 8;
      const col = i % 2 ? DARK : YELLOW;
      add([x + hw + 0.12, top, z + t0], [x + hw + 0.5, top + 0.012, z + t1], { color: col, solid: false, edges: false });
    }

    // ---- gates: top one on the east side, bottom one on the west side (into the tunnel)
    this.gates = [
      this.makeGate(add, [x + hw + 0.04, top, z - hd], [x + hw + 0.12, top + 2.6, z + hd], top),
      this.makeGate(add, [x - hw - 0.12, bottom, z - hd], [x - hw - 0.04, bottom + 2.6, z + hd], bottom),
    ];
    this.place();
  }

  makeGate(add, min, max, level) {
    const g = { level, open: 0, parts: [] };
    const col = add(min, max, { color: DARK, hidden: true, noShadow: true });    // collider
    g.collider = col;
    const alongZ = true, n = 10;
    for (let i = 0; i <= n; i++) {
      const zz = min[2] + (max[2] - min[2]) * (i / n);
      g.parts.push(add([min[0], min[1] + 0.1, zz - 0.02], [max[0], max[1], zz + 0.02], { color: YELLOW, solid: false }));
    }
    for (const y of [0.1, 1.3, 2.5]) g.parts.push(add([min[0] - 0.01, min[1] + y, min[2]], [max[0] + 0.01, min[1] + y + 0.1, max[2]], { color: DARK, solid: false }));
    g.base = g.parts.map((b) => [...b.center]);
    g.colBase = [...col.center];
    void alongZ;
    return g;
  }

  place() {
    for (const [b, o] of this.parts) moveBoxTo(b, [this.x + o[0], this.y + o[1], this.z + o[2]]);
  }

  onCar(p) {
    return Math.abs(p.pos[0] - this.x) < this.w / 2 - 0.05 && Math.abs(p.pos[2] - this.z) < this.d / 2 - 0.05 &&
      Math.abs(p.pos[1] - this.y) < 0.1;
  }

  near(p, level) {
    return Math.abs(p.pos[1] - level) < 0.6 && Math.hypot(p.pos[0] - this.x, p.pos[2] - this.z) < 4.5 && !this.onCar(p);
  }

  go(to, sounds) {
    if (to === this.y) return;
    this.state = 'moving';
    this.from = this.y; this.to = to; this.t = 0;
    this.panelLight.color = [1, 0.6, 0.1];
    sounds?.elevatorStart?.();
  }

  // call before the player moves this frame
  update(dt, player, sounds) {
    const on = this.onCar(player) && player.grounded;
    // gates slide up into the frame when the car is at their landing
    for (const g of this.gates) {
      const want = this.state === 'idle' && Math.abs(this.y - g.level) < 0.01 ? 1 : 0;
      g.open += (want - g.open) * Math.min(1, dt * (want ? 4 : 6));
      const lift = g.open * 2.5;
      g.parts.forEach((b, i) => moveBoxTo(b, [g.base[i][0], g.base[i][1] + lift, g.base[i][2]]));
      moveBoxTo(g.collider, [g.colBase[0], g.colBase[1] + lift, g.colBase[2]]);
      g.collider.solid = g.open < 0.6;
    }
    if (this.state === 'idle') {
      const other = this.y > (this.top + this.bottom) / 2 ? this.bottom : this.top;
      if (!on) this.mustExit = false;
      if (on && this.mustExit) { this.ride = 0; return; }
      if (on) { this.ride += dt; if (this.ride > 0.7) { this.ride = 0; this.go(other, sounds); } }
      else if (this.near(player, other)) { this.ride += dt; if (this.ride > 0.4) { this.ride = 0; this.go(other, sounds); } }
      else this.ride = 0;
      return;
    }
    // wait for the gate to shut before moving (the rider is held in the car meanwhile)
    if (this.gates.some((g) => g.open > 0.05)) {
      if (on) this.carrying = true;
      return;
    }
    this.t += dt / this.dur;
    const k = Math.min(this.t, 1);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    this.y = this.from + (this.to - this.from) * e;
    this.place();
    if (on || (this.carrying && this.onCarLoose(player))) {
      // keep the rider clear of the open edges so they never clip the hatch rim
      const m = Math.min(this.w, this.d) / 2 - 0.36;
      player.pos[0] = this.x + Math.max(-m, Math.min(m, player.pos[0] - this.x));
      player.pos[2] = this.z + Math.max(-m, Math.min(m, player.pos[2] - this.z));
      player.vel[0] = 0; player.vel[2] = 0;
      player.pos[1] = this.y + 0.001;
      player.vel[1] = 0;
      player.grounded = true;
      this.carrying = true;
    }
    if (k >= 1) {
      this.state = 'idle';
      this.mustExit = on || this.carrying;
      this.carrying = false;
      this.panelLight.color = [0.95, 0.15, 0.1];
      sounds?.elevatorDing?.();
    }
  }

  // looser test used once the ride has started (fast descents can lift you off the floor a hair)
  onCarLoose(p) {
    return Math.abs(p.pos[0] - this.x) < this.w / 2 && Math.abs(p.pos[2] - this.z) < this.d / 2 && Math.abs(p.pos[1] - this.y) < 0.6;
  }
}
