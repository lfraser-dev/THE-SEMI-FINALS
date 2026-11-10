// Indoor passenger lift: a car running in a shaft between floor stops, with sliding car doors,
// sliding landing doors at every stop, a call panel (▲ ▼) beside each landing door and a panel in the car.
// Look at a button and press E (main.js raycasts for boxes tagged 'liftbtn' and calls lift.press(ref)).
import { makeBox, moveBoxTo } from './world.js';

const STEEL = [0.74, 0.75, 0.77], DARK = [0.18, 0.19, 0.21], WALL = [0.9, 0.9, 0.88], FLOOR = [0.3, 0.3, 0.32];
const BTN = [0.92, 0.93, 0.95], LIT = [1, 0.62, 0.15];

export class Lift {
  // o: { x, z: car centre; w, d: car size; doorZ: z of the landing door plane (doors face +z); stops: [y...]; panelSide: ±1 }
  constructor(world, o) {
    Object.assign(this, { world, x: o.x, z: o.z, w: o.w || 3, d: o.d || 2.8, stops: o.stops, doorZ: o.doorZ, side: o.panelSide || 1 });
    this.i = 0;
    this.y = this.stops[0];
    this.v = 0;
    this.state = 'open';        // open | closing | moving | opening
    this.door = 1;              // 0 shut .. 1 open
    this.idleT = 0;
    this.target = null;
    this.queue = [];
    const add = (min, max, opt) => world.add(makeBox(min, max, { grid: false, edges: false, ...opt }));
    const { x, z, w, d } = this;
    const hw = w / 2, hd = d / 2, H = 2.75;
    // ---- the car (parts stored with their offset from (x, carFloor, z))
    this.parts = [];
    const part = (min, max, opt) => {
      const b = add([x + min[0], min[1], z + min[2]], [x + max[0], max[1], z + max[2]], opt);
      this.parts.push([b, [b.center[0] - x, b.center[1], b.center[2] - z]]);
      return b;
    };
    part([-hw, -0.2, -hd], [hw, 0, hd], { color: FLOOR, mat: [0.2, 0.4] });
    part([-hw, 0, -hd], [hw, H, -hd + 0.06], { color: STEEL, mat: 'steel' });                    // back wall (mirror steel)
    part([-hw, 0, -hd], [-hw + 0.06, H, hd], { color: WALL, tex: 5 });                           // side walls
    part([hw - 0.06, 0, -hd], [hw, H, hd], { color: WALL, tex: 5 });
    part([-hw, H, -hd], [hw, H + 0.12, hd], { color: DARK });                                    // ceiling
    part([-hw + 0.4, H - 0.03, -hd + 0.4], [hw - 0.4, H, hd - 0.4], { color: [1, 0.97, 0.9], emissive: 1, solid: false, noShadow: true });
    part([-hw + 0.08, 0.9, -hd + 0.06], [hw - 0.08, 0.94, -hd + 0.12], { color: STEEL, mat: 'steel', solid: false });   // handrail
    // car panel on the inside of one side wall, near the doors
    const px = this.side * (hw - 0.07);
    part([px - 0.02, 1.0, hd - 0.75], [px + 0.02, 1.65, hd - 0.45], { color: DARK, mat: 'metal', solid: false });
    this.carUp = part([px - 0.04, 1.4, hd - 0.66], [px + 0.04, 1.52, hd - 0.54], { color: BTN, emissive: 0.4, tag: 'liftbtn', noShadow: true });
    this.carDown = part([px - 0.04, 1.15, hd - 0.66], [px + 0.04, 1.27, hd - 0.54], { color: BTN, emissive: 0.4, tag: 'liftbtn', noShadow: true });
    this.carUp.ref = { lift: this, car: true, dir: 1 };
    this.carDown.ref = { lift: this, car: true, dir: -1 };
    // car doors: two leaves across the front, sliding apart
    this.carDoors = [-1, 1].map((s) => part([s < 0 ? -hw + 0.06 : 0, 0, hd - 0.1], [s < 0 ? 0 : hw - 0.06, H, hd - 0.04], { color: STEEL, mat: 'steel' }));
    this.carDoorBase = this.carDoors.map((b) => this.parts.find((p) => p[0] === b)[1].slice());

    // ---- landing doors and call panels at every stop
    const dz = this.doorZ, DW = 1.8, DH = 2.6;
    this.landings = this.stops.map((y, i) => {
      const leaves = [-1, 1].map((s) => add([x + (s < 0 ? -DW / 2 : 0), y, dz - 0.3], [x + (s < 0 ? 0 : DW / 2), y + DH, dz - 0.14], { color: STEEL, mat: 'steel' }));
      const base = leaves.map((b) => [...b.center]);
      // frame round the opening
      add([x - DW / 2 - 0.12, y, dz - 0.02], [x - DW / 2, y + DH + 0.12, dz + 0.04], { color: DARK, mat: 'metal', solid: false });
      add([x + DW / 2, y, dz - 0.02], [x + DW / 2 + 0.12, y + DH + 0.12, dz + 0.04], { color: DARK, mat: 'metal', solid: false });
      add([x - DW / 2 - 0.12, y + DH, dz - 0.02], [x + DW / 2 + 0.12, y + DH + 0.12, dz + 0.04], { color: DARK, mat: 'metal', solid: false });
      // floor indicator light above the door
      const ind = add([x - 0.25, y + DH + 0.22, dz], [x + 0.25, y + DH + 0.36, dz + 0.02], { color: [0.2, 0.2, 0.22], emissive: 0.3, solid: false, noShadow: true });
      // call panel beside the door
      const cx = x + this.side * (DW / 2 + 0.5);
      add([cx - 0.11, y + 1.0, dz], [cx + 0.11, y + 1.6, dz + 0.02], { color: DARK, mat: 'metal', solid: false });
      const up = add([cx - 0.06, y + 1.36, dz + 0.02], [cx + 0.06, y + 1.48, dz + 0.05], { color: BTN, emissive: 0.4, tag: 'liftbtn', noShadow: true });
      const down = add([cx - 0.06, y + 1.12, dz + 0.02], [cx + 0.06, y + 1.24, dz + 0.05], { color: BTN, emissive: 0.4, tag: 'liftbtn', noShadow: true });
      up.ref = { lift: this, stop: i, dir: 1 };
      down.ref = { lift: this, stop: i, dir: -1 };
      if (i === this.stops.length - 1) up.solid = false, up.color = [0.3, 0.3, 0.32], up.emissive = 0, up.tag = null;
      if (i === 0) down.solid = false, down.color = [0.3, 0.3, 0.32], down.emissive = 0, down.tag = null;
      return { y, leaves, base, ind, up, down, open: 0 };
    });
    this.landings[0].open = 1;
    this.place();
  }

  // a button was pressed (ref from the button box)
  press(ref, sounds) {
    sounds?.button?.();
    if (ref.car) {
      // each press takes the trip one stop further in that direction
      const from = this.target ?? this.i;
      const t = from + ref.dir;
      if (t < 0 || t >= this.stops.length) return;
      if (this.target != null && Math.sign(this.target - this.i) === ref.dir) this.target = t;
      else this.request(t);
      (ref.dir > 0 ? this.carUp : this.carDown).color = LIT;
    } else {
      if (ref.stop === this.i && this.state !== 'moving' && this.state !== 'closing') { this.state = 'opening'; this.idleT = 0; return; }
      this.request(ref.stop);
      const L = this.landings[ref.stop];
      (ref.dir > 0 ? L.up : L.down).color = LIT;
    }
  }

  request(t) {
    if (this.target === t || this.queue.includes(t)) return;
    if (this.target == null) this.target = t; else this.queue.push(t);
  }

  place() {
    for (const [b, o] of this.parts) moveBoxTo(b, [this.x + o[0], this.y + o[1], this.z + o[2]]);
    // car doors slide apart
    this.carDoors.forEach((b, k) => {
      const o = this.carDoorBase[k], s = k === 0 ? -1 : 1;
      moveBoxTo(b, [this.x + o[0] + s * this.door * (this.w / 2 - 0.12), this.y + o[1], this.z + o[2]]);
      b.solid = this.door < 0.6;
    });
  }

  carHas(p) {
    return Math.abs(p[0] - this.x) < this.w / 2 - 0.1 && Math.abs(p[2] - this.z) < this.d / 2 - 0.05;
  }

  update(dt, player, sounds) {
    const at = this.stops[this.i];
    if (this.state === 'open') {
      this.idleT += dt;
      // hold the doors while you're in the doorway
      const inDoor = Math.abs(player.pos[0] - this.x) < 1 && Math.abs(player.pos[2] - (this.z + this.d / 2)) < 0.6 && Math.abs(player.pos[1] - at) < 1;
      if (this.target != null && this.target !== this.i && this.idleT > 1.2 && !inDoor) this.state = 'closing';
      else if (this.target === this.i) this.target = this.queue.shift() ?? null;
    } else if (this.state === 'closing') {
      this.door = Math.max(0, this.door - dt * 1.6);
      if (this.door === 0) { this.state = 'moving'; sounds?.elevatorStart?.(); }
    } else if (this.state === 'moving') {
      const ty = this.stops[this.target], dy = ty - this.y, dir = Math.sign(dy);
      const maxV = 6.5, brake = Math.sqrt(2 * 3.2 * Math.abs(dy));
      this.v = Math.min(maxV, this.v + 4 * dt, brake);
      const step = Math.min(Math.abs(dy), this.v * dt);
      this.y += dir * step;
      // carry the rider
      if (this.carHas(player.pos) && Math.abs(player.pos[1] - (this.y - dir * step)) < 0.7) {
        player.pos[1] = this.y + 0.001;
        if (player.vel[1] < 0 || dir > 0) player.vel[1] = 0;
        player.grounded = true;
      }
      if (Math.abs(ty - this.y) < 1e-3) {
        this.y = ty;
        this.v = 0;
        this.i = this.target;
        this.target = this.queue.shift() ?? null;
        if (this.target === this.i) this.target = this.queue.shift() ?? null;
        this.state = 'opening';
        sounds?.elevatorDing?.();
        const L = this.landings[this.i];
        L.up.color = L.up.tag ? BTN : L.up.color;
        L.down.color = L.down.tag ? BTN : L.down.color;
        this.carUp.color = BTN; this.carDown.color = BTN;
      }
    } else if (this.state === 'opening') {
      this.door = Math.min(1, this.door + dt * 1.6);
      if (this.door === 1) { this.state = 'open'; this.idleT = 0; }
    }
    // landing doors: only the one at the car's floor opens, in step with the car doors
    this.landings.forEach((L, k) => {
      const want = k === this.i && this.state !== 'moving' ? this.door : 0;
      L.open = want;
      L.leaves.forEach((b, s) => moveBoxTo(b, [L.base[s][0] + (s === 0 ? -1 : 1) * L.open * 0.86, L.base[s][1], L.base[s][2]]));
      L.leaves.forEach((b) => { b.solid = L.open < 0.6; });
      const here = Math.abs(this.y - L.y) < 0.3;
      L.ind.color = here ? [0.3, 1, 0.5] : [0.2, 0.2, 0.22];
      L.ind.emissive = here ? 1 : 0.3;
    });
    this.place();
  }
}
