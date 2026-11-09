// Cage elevator between the main range floor and the combat deck.
// Stand on the car for a moment and it goes; stand next to the shaft and it comes to you.
import { makeBox, moveBoxTo } from './world.js';

const STEEL = [0.34, 0.35, 0.38];
const CHAR = [0.27, 0.28, 0.31];
const GO = [0.15, 0.9, 0.35], MOVING = [1, 0.55, 0.1];

export class Elevator {
  constructor(world, { x, z, w = 3, d = 3, top = 12 }) {
    Object.assign(this, { world, x, z, w, d, top });
    this.y = 0;               // car floor top height
    this.state = 'idle';      // idle | moving
    this.from = 0; this.to = 0; this.t = 0; this.dur = 3.2;
    this.ride = 0;            // how long the player has stood on / waited for the car
    this.carried = false;
    const add = (min, max, o) => world.add(makeBox(min, max, { grid: false, ...o }));
    // moving parts: [box, offset of its centre from (x, carTop, z)]
    const hw = w / 2, hd = d / 2;
    this.parts = [];
    const part = (min, max, o) => {
      const b = add(min, max, o);
      this.parts.push([b, [b.center[0] - x, b.center[1], b.center[2] - z]]);
      return b;
    };
    part([x - hw, -0.2, z - hd], [x + hw, 0, z + hd], { color: STEEL });                         // floor
    part([x - hw, 0, z - hd], [x + hw, 1.1, z - hd + 0.1], { color: STEEL });                    // side rails
    part([x - hw, 0, z + hd - 0.1], [x + hw, 1.1, z + hd], { color: STEEL });
    part([x - hw, 1.1, z - hd], [x + hw, 1.15, z - hd + 0.1], { color: [0.95, 0.15, 0.1], emissive: 0.8, solid: false, noShadow: true });
    part([x - hw, 1.1, z + hd - 0.1], [x + hw, 1.15, z + hd], { color: [0.95, 0.15, 0.1], emissive: 0.8, solid: false, noShadow: true });
    part([x - hw + 0.2, 0.001, z - hd + 0.2], [x + hw - 0.2, 0.02, z + hd - 0.2], { color: [0.22, 0.23, 0.26], solid: false, edges: false });
    // shaft: four posts, a roof and status lights
    const H = top + 3.6;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add([x + sx * (hw + 0.02) - (sx > 0 ? 0 : 0.3), 0, z + sz * (hd + 0.02) - (sz > 0 ? 0 : 0.3)],
        [x + sx * (hw + 0.02) + (sx > 0 ? 0.3 : 0), H, z + sz * (hd + 0.02) + (sz > 0 ? 0.3 : 0)], { color: CHAR });
    }
    add([x - hw - 0.35, H, z - hd - 0.35], [x + hw + 0.35, H + 0.3, z + hd + 0.35], { color: CHAR });
    for (const y of [3, 6, 9]) {   // cross bracing on the back
      add([x - hw - 0.3, y, z - hd - 0.3], [x + hw + 0.3, y + 0.12, z - hd - 0.22], { color: CHAR });
      add([x - hw - 0.3, y, z + hd + 0.22], [x + hw + 0.3, y + 0.12, z + hd + 0.3], { color: CHAR });
    }
    this.lights = [];
    for (const y of [2.2, top + 2.2]) {
      this.lights.push(add([x + hw + 0.32, y, z - 0.25], [x + hw + 0.4, y + 0.5, z + 0.25], { color: [...GO], emissive: 1, solid: false, noShadow: true }));
    }
    // floor markings at the bottom
    add([x - hw - 0.5, 0, z - hd - 0.5], [x + hw + 0.5, 0.012, z + hd + 0.5], { color: [0.3, 0.31, 0.34], solid: false, edges: false });
    add([x + hw + 0.5, 0, z - hd - 0.5], [x + hw + 0.6, 0.02, z + hd + 0.5], { color: [0.95, 0.15, 0.1], emissive: 0.7, solid: false, edges: false });
    this.place();
  }

  place() {
    for (const [b, o] of this.parts) moveBoxTo(b, [this.x + o[0], this.y + o[1], this.z + o[2]]);
  }

  onCar(p) {
    return Math.abs(p.pos[0] - this.x) < this.w / 2 - 0.1 && Math.abs(p.pos[2] - this.z) < this.d / 2 - 0.1 &&
      Math.abs(p.pos[1] - this.y) < 0.08;
  }

  near(p, level) {
    return Math.abs(p.pos[1] - level) < 0.6 && Math.hypot(p.pos[0] - this.x, p.pos[2] - this.z) < 5 && !this.onCar(p);
  }

  go(to, sounds) {
    if (to === this.y) return;
    this.state = 'moving';
    this.from = this.y; this.to = to; this.t = 0;
    this.lights.forEach((l) => { l.color = [...MOVING]; });
    sounds?.elevatorStart?.();
  }

  // call before the player moves this frame
  update(dt, player, sounds) {
    const on = this.onCar(player) && player.grounded;
    if (this.state === 'idle') {
      const other = this.y < 1 ? this.top : 0;
      if (!on) this.mustExit = false;          // after arriving, step off before it'll go again
      if (on && this.mustExit) { this.ride = 0; return; }
      if (on) { this.ride += dt; if (this.ride > 0.7) { this.ride = 0; this.go(other, sounds); } }
      else if (this.near(player, other)) { this.ride += dt; if (this.ride > 0.4) { this.ride = 0; this.go(other, sounds); } }
      else this.ride = 0;
      return;
    }
    this.t += dt / this.dur;
    const k = Math.min(this.t, 1);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;   // ease in-out
    this.y = this.from + (this.to - this.from) * e;
    this.place();
    if (on) {
      // carry the rider with the car
      player.pos[1] = this.y + 0.001;
      player.vel[1] = 0;
      player.grounded = true;
    }
    if (k >= 1) {
      this.state = 'idle';
      this.mustExit = on;
      this.lights.forEach((l) => { l.color = [...GO]; });
      sounds?.elevatorDing?.();
    }
  }
}
