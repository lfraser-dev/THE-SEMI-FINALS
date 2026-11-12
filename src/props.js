// Shootable things in the test range: red training dummies and a destructible wall.
import { Weapon } from './weapon.js';
import { compose, mat4 } from './math.js';
import { makeBox, moveBoxTo } from './world.js';

const RED = [0.92, 0.1, 0.08];

// Crash-test style training dummy on a steel stand. Parts relative to its feet: centre, size, colour.
const YEL = [0.98, 0.76, 0.12];      // painted body shells
const BLK = [0.09, 0.09, 0.1];       // rubber joints
const GRY = [0.32, 0.33, 0.36];
const STL = [0.55, 0.56, 0.6];
// faces +z (toward the firing line in the range)
const P = (c, s, col, shape, mat, head = false) => ({ c: [c[0], c[1], -c[2]], s, col, shape, mat, head });
const DUMMY = [
  P([0, 0.025, 0.12], [0.62, 0.05, 0.52], GRY, 0.02, 'metal'),                 // stand base
  P([0, 0.62, 0.2], [0.05, 1.2, 0.05], STL, 'cyl', 'steel'),                   // stand pole
  P([0, 1.2, 0.16], [0.16, 0.08, 0.06], GRY, 0.02, 'metal'),                   // back clamp
  ...[-1, 1].flatMap((s) => [
    P([s * 0.11, 0.05, -0.04], [0.12, 0.1, 0.27], BLK, 0.04, 'rubber'),        // boot
    P([s * 0.11, 0.32, 0], [0.13, 0.44, 0.14], YEL, 0.06, 'paint'),           // shin
    P([s * 0.11, 0.56, 0], [0.15, 0.13, 0.15], BLK, 'sphere', 'rubber'),       // knee
    P([s * 0.11, 0.79, 0], [0.17, 0.4, 0.18], YEL, 0.07, 'paint'),            // thigh
    P([s * 0.27, 1.47, 0], [0.15, 0.15, 0.15], BLK, 'sphere', 'rubber'),       // shoulder
    P([s * 0.3, 1.29, 0], [0.11, 0.3, 0.12], YEL, 0.05, 'paint'),             // upper arm
    P([s * 0.31, 1.13, 0], [0.1, 0.09, 0.1], BLK, 'sphere', 'rubber'),         // elbow
    P([s * 0.31, 0.99, -0.03], [0.095, 0.26, 0.1], YEL, 0.045, 'paint'),      // forearm
    P([s * 0.31, 0.82, -0.03], [0.08, 0.12, 0.09], BLK, 0.03, 'rubber'),       // hand
    P([s * 0.123, 1.77, 0], [0.01, 0.09, 0.09], BLK, 0.004, 'rubber', true),   // head target marks
    P([s * 0.124, 1.77, 0], [0.01, 0.045, 0.045], YEL, 0.002, 'paint', true),
  ]),
  P([0, 1.0, 0], [0.38, 0.2, 0.22], BLK, 0.08, 'rubber'),                      // pelvis
  P([0, 1.15, 0], [0.3, 0.16, 0.2], GRY, 0.07, 'rubber'),                      // abdomen
  P([0, 1.37, 0], [0.45, 0.34, 0.25], YEL, 0.11, 'paint'),                     // chest
  P([0, 1.39, -0.127], [0.13, 0.13, 0.01], BLK, 0.005, 'rubber'),              // chest target
  P([0, 1.39, -0.132], [0.065, 0.065, 0.01], YEL, 0.003, 'paint'),
  P([0, 1.6, 0], [0.1, 0.1, 0.1], BLK, 'cyl', 'rubber', true),                 // neck
  P([0, 1.77, 0], [0.24, 0.27, 0.25], YEL, 'sphere', 'paint', true),           // head
  P([0, 1.79, -0.11], [0.15, 0.04, 0.05], BLK, 0.015, 'rubber', true),         // brow line
];

export class Dummy {
  constructor(world, effects, pos, move = null) {
    this.world = world;
    this.effects = effects;
    this.base = [...pos];
    this.pos = [...pos];
    this.move = move; // { axis: 0|2, range, speed }
    this.alive = false;
    this.respawnIn = 0;
    this.boxes = [];
    this.phase = Math.random() * 10;
    this.spawn();
  }

  spawn() {
    this.alive = true;
    this.hp = 100;
    this.flash = 0;
    this.boxes = DUMMY.map((p) => this.world.add(makeBox([0, 0, 0], p.s, {
      color: [...p.col], grid: false, edges: false, emissive: 0, tag: 'dummy', ref: this, shape: p.shape, mat: p.mat,
    })));
    this.boxes.forEach((b, i) => { b.head = !!DUMMY[i].head; });
    this.place();
  }

  // returns true if this hit killed it
  damage(amount, dir) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.flash = 0.07;
    if (this.hp <= 0) { this.kill(dir); return true; }
    return false;
  }

  place() {
    this.boxes.forEach((b, i) => {
      const c = DUMMY[i].c;
      moveBoxTo(b, [this.pos[0] + c[0], this.pos[1] + c[1], this.pos[2] + c[2]]);
    });
  }

  kill(dir) {
    if (!this.alive) return;
    this.alive = false;
    this.respawnIn = 2.5;
    for (const [i, b] of this.boxes.entries()) {
      b.color = [...DUMMY[i].col];
      this.world.remove(b);
      this.effects.shatter(b, dir, 3, 4.5, 0.18);
    }
    this.boxes = [];
  }

  update(dt, time) {
    if (!this.alive) {
      this.respawnIn -= dt;
      if (this.respawnIn <= 0) this.spawn();
      return;
    }
    this.flash -= dt;
    const f = this.flash > 0 ? 1 : 0;
    this.boxes.forEach((b, i) => {
      const col = DUMMY[i].col;
      for (let k = 0; k < 3; k++) b.color[k] = col[k] + (1 - col[k]) * f * 0.85;
      b.emissive = f ? 0.9 : 0;
    });
    if (this.move) {
      const m = this.move;
      this.pos[m.axis] = this.base[m.axis] + Math.sin((time + this.phase) * m.speed / m.range) * m.range;
      this.place();
    }
  }

  reset() {
    for (const b of this.boxes) this.world.remove(b);
    this.boxes = [];
    this.pos = [...this.base];
    this.spawn();
  }
}

// A wall made of small chunks. Shoot chunks out; anything no longer connected
// to the ground collapses.
export class DestructibleWall {
  // origin = min corner. Runs along +X (axis 0) or +Z (axis 2).
  constructor(world, effects, origin, { cols = 12, rows = 6, chunk = 0.5, thick = 0.35, axis = 0, color = null } = {}) {
    Object.assign(this, { world, effects, origin, cols, rows, chunk, thick, axis });
    this.color = color || [0.9, 0.9, 0.92];
    this.cells = [];
    this.build();
  }

  build() {
    for (const row of this.cells) for (const b of row) if (b) this.world.remove(b);
    this.cells = [];
    const { origin: o, chunk: c, thick: t } = this;
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let k = 0; k < this.cols; k++) {
        const min = [...o], max = [...o];
        const along = this.axis, across = this.axis === 0 ? 2 : 0;
        min[along] += k * c; max[along] += (k + 1) * c;
        min[1] += r * c; max[1] += (r + 1) * c;
        max[across] += t;
        const b = makeBox(min, max, { color: this.color, grid: false, tag: 'chunk', ref: this });
        b.cell = [r, k];
        row.push(this.world.add(b));
      }
      this.cells.push(row);
    }
  }

  hit(box, dir) {
    const [r, k] = box.cell;
    const remove = [[r, k]];
    for (const [dr, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (Math.random() < 0.3) remove.push([r + dr, k + dk]);
    let count = 0;
    for (const [rr, kk] of remove) {
      const b = this.cells[rr]?.[kk];
      if (!b) continue;
      this.cells[rr][kk] = null;
      this.world.remove(b);
      this.effects.shatter(b, dir, 2, 3);
      count++;
    }
    count += this.collapse(dir);
    return count;
  }

  // Flood-fill from the bottom row; drop everything not reached.
  collapse(dir) {
    const seen = new Set(), q = [];
    for (let k = 0; k < this.cols; k++) if (this.cells[0][k]) { q.push([0, k]); seen.add(`0,${k}`); }
    while (q.length) {
      const [r, k] = q.pop();
      for (const [dr, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nk = k + dk, key = `${nr},${nk}`;
        if (seen.has(key) || !this.cells[nr]?.[nk]) continue;
        seen.add(key);
        q.push([nr, nk]);
      }
    }
    let dropped = 0;
    for (let r = 0; r < this.rows; r++) for (let k = 0; k < this.cols; k++) {
      const b = this.cells[r][k];
      if (b && !seen.has(`${r},${k}`)) {
        this.cells[r][k] = null;
        this.world.remove(b);
        this.effects.spawnPiece(b.center, b.scale.map((v) => v * 0.95),
          [dir[0] * 1.5 + (Math.random() - 0.5), Math.random() * 1.5, dir[2] * 1.5 + (Math.random() - 0.5)],
          this.color, 3 + Math.random());
        dropped++;
      }
    }
    return dropped;
  }

  reset() { this.build(); }
}

// ---------------------------------------------------------------- weapon cases

const CASE_DARK = [0.22, 0.23, 0.26];
const GLASS = [0.75, 0.85, 0.95];

// A glass display case with a slowly spinning gun. Walk up and press E.
export class WeaponCase {
  constructor(world, def, center, slot) {
    this.def = def;
    this.center = center;          // centre of the case floor
    this.slot = slot;
    const [x, y, z] = center;
    const add = (min, max, o) => world.add(makeBox(min, max, o));
    add([x - 0.75, y, z - 0.45], [x + 0.75, y + 1.0, z + 0.45], { color: CASE_DARK, grid: false });
    add([x - 0.76, y + 0.78, z - 0.46], [x + 0.76, y + 0.84, z - 0.4], { color: [0.95, 0.15, 0.1], grid: false, emissive: 0.85, solid: false, noShadow: true });
    this.glass = add([x - 0.7, y + 1.0, z - 0.4], [x + 0.7, y + 2.1, z + 0.4], { color: GLASS, grid: false, alpha: 0.16, noBullet: true, noShadow: true });
    add([x - 0.75, y + 2.1, z - 0.45], [x + 0.75, y + 2.22, z + 0.45], { color: CASE_DARK, grid: false });
    add([x - 0.6, y + 2.08, z - 0.3], [x + 0.6, y + 2.1, z + 0.3], { color: [1, 1, 0.97], grid: false, emissive: 1, solid: false, noShadow: true });
    // wall panel behind the case
    add([x - 1.1, y, z + 0.5], [x + 1.1, y + 3.6, z + 0.75], { color: [0.97, 0.97, 0.98], grid: false });
    add([x - 1.1, y + 3.6, z + 0.45], [x + 1.1, y + 3.75, z + 0.75], { color: CASE_DARK, grid: false });
    digitBoxes(String(slot), x + 0.18, y + 2.55, z + 0.48, 0.7, -1, [0.95, 0.15, 0.1], 0.9).forEach((b) => world.add(b));
    this.matrix = mat4();
  }

  parts(time) {
    const [x, y, z] = this.center;
    const s = 1.5;
    compose(this.matrix, [x, y + 1.5 + Math.sin(time * 1.5 + this.slot) * 0.03, z], [0, time * 0.6 + this.slot, 0], [s, s, s]);
    return Weapon.worldParts(this.def, this.matrix).map((p) => ({ ...p, scale: p.scale.map((v) => v * s) }));
  }
}

// ---------------------------------------------------------------- 7-seg digits
const SEGS = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd',
  6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g',
};
// Builds boxes spelling `text` on a wall. dir = +1 reads from +Z side, -1 from -Z side
// (text runs along -X when read from -Z). (x, y, z) = bottom-left from the reader's view.
export function digitBoxes(text, x, y, z, h, dir, color, emissive = 0) {
  const w = h * 0.55, t = h * 0.13, gap = h * 0.25, depth = 0.04;
  const segs = {
    a: [w / 2, h - t / 2, w, t], b: [w - t / 2, h * 0.75, t, h / 2], c: [w - t / 2, h * 0.25, t, h / 2],
    d: [w / 2, t / 2, w, t], e: [t / 2, h * 0.25, t, h / 2], f: [t / 2, h * 0.75, t, h / 2], g: [w / 2, h / 2, w, t],
  };
  const out = [];
  [...text].forEach((ch, i) => {
    const u0 = i * (w + gap);
    for (const s of SEGS[ch] || '') {
      const [u, v, sw, sh] = segs[s];
      const cx = x + dir * (u0 + u);
      out.push(makeBox([cx - sw / 2, y + v - sh / 2, z - depth / 2], [cx + sw / 2, y + v + sh / 2, z + depth / 2],
        { color, grid: false, edges: false, emissive, solid: false, noShadow: true }));
    }
  });
  return out;
}

// ---------------------------------------------------------------- workbench
// A gunsmith bench against the wall. Walk up and press E to change attachments.
export class Workbench {
  constructor(world, center) {
    this.center = center;   // front-centre of the bench at floor level
    const [x, y, z] = center;
    const add = (min, max, o) => world.add(makeBox(min, max, { grid: false, ...o }));
    const STEEL = [0.32, 0.33, 0.36], TOP = [0.45, 0.36, 0.26], PEG = [0.78, 0.74, 0.66];
    // legs, frame, wooden top, lower shelf
    for (const dx of [-1.4, 1.4]) for (const dz of [0.1, 0.85]) add([x + dx - 0.05, y, z + dz - 0.05], [x + dx + 0.05, y + 0.9, z + dz + 0.05], { color: STEEL });
    add([x - 1.5, y + 0.9, z], [x + 1.5, y + 0.98, z + 0.95], { color: TOP });
    add([x - 1.45, y + 0.25, z + 0.05], [x + 1.45, y + 0.3, z + 0.9], { color: STEEL });
    // pegboard + frame
    add([x - 1.6, y + 1.1, z + 1.0], [x + 1.6, y + 2.8, z + 1.05], { color: PEG });
    add([x - 1.65, y + 2.8, z + 0.95], [x + 1.65, y + 2.9, z + 1.06], { color: STEEL });
    // tools and parts on the pegboard
    const tool = (x0, y0, w, h, col) => add([x + x0, y + y0, z + 0.97], [x + x0 + w, y + y0 + h, z + 1.0], { color: col, solid: false, noShadow: true });
    tool(-1.4, 1.5, 0.5, 0.08, [0.15, 0.15, 0.17]);   // barrel blanks
    tool(-1.4, 1.7, 0.4, 0.06, [0.15, 0.15, 0.17]);
    tool(-0.8, 1.4, 0.06, 0.5, [0.6, 0.15, 0.1]);     // wrench
    tool(-0.6, 1.4, 0.06, 0.4, [0.2, 0.22, 0.25]);
    tool(-0.3, 2.0, 0.35, 0.12, [0.12, 0.12, 0.13]);  // scope
    tool(0.2, 1.3, 0.08, 0.25, [0.12, 0.12, 0.13]);   // mags
    tool(0.35, 1.3, 0.08, 0.25, [0.12, 0.12, 0.13]);
    tool(0.5, 1.3, 0.08, 0.25, [0.12, 0.12, 0.13]);
    tool(0.8, 1.6, 0.5, 0.06, [0.3, 0.3, 0.32]);      // suppressor
    tool(0.8, 2.2, 0.25, 0.25, [0.95, 0.15, 0.1]);    // red sign
    // stuff on the bench top
    add([x - 1.1, y + 0.98, z + 0.4], [x - 0.6, y + 1.08, z + 0.7], { color: [0.12, 0.12, 0.13] });   // ammo can
    add([x + 0.5, y + 0.98, z + 0.3], [x + 1.2, y + 1.0, z + 0.65], { color: [0.2, 0.42, 0.3] });    // mat
    add([x + 0.7, y + 1.0, z + 0.42], [x + 1.0, y + 1.04, z + 0.5], { color: [0.1, 0.1, 0.11] });   // part on the mat
    // hanging work light
    add([x - 0.03, y + 2.9, z + 0.4], [x + 0.03, y + 3.4, z + 0.46], { color: STEEL, solid: false });
    add([x - 0.5, y + 2.8, z + 0.25], [x + 0.5, y + 2.9, z + 0.6], { color: STEEL, solid: false });
    add([x - 0.45, y + 2.78, z + 0.3], [x + 0.45, y + 2.8, z + 0.55], { color: [1, 0.97, 0.88], emissive: 1, solid: false, noShadow: true });
    // floor mat marking the spot
    add([x - 1.6, y, z - 1.3], [x + 1.6, y + 0.015, z], { color: [0.3, 0.31, 0.34], solid: false, edges: false });
    add([x - 1.6, y, z - 1.32], [x + 1.6, y + 0.02, z - 1.25], { color: [0.95, 0.15, 0.1], emissive: 0.7, solid: false, edges: false });
  }
}

// ---------------------------------------------------------------- gun crates
// Military weapon crates either side of the workbench: olive-drab wooden crates with steel corners, rope handles,
// stencilled markings and the lid propped open behind, every gun jammed in muzzle-first. Round them: stacked ammo
// cans (one open, full of rounds), loose mags, shell boxes and a belt of rounds. Look at a gun and press E to take
// it; look at an ammo can and press E to fill up both guns.
const OD = [0.29, 0.33, 0.2], OD_D = [0.2, 0.23, 0.14], STEELD = [0.17, 0.17, 0.18], STEN = [0.92, 0.8, 0.3], STENW = [0.88, 0.88, 0.84];
const ROPE = [0.55, 0.47, 0.32], BRASSC = [0.8, 0.62, 0.28], TIP = [0.5, 0.3, 0.18];
export function gunCrates(world, defs, benchPos) {
  const add = (min, max, o) => world.add(makeBox(min, max, { grid: false, ...o }));
  const at = (x, y, z, sx, sy, sz, o) => add([x - sx / 2, y, z - sz / 2], [x + sx / 2, y + sy, z + sz / 2], o);
  const deco = (min, max, o) => add(min, max, { solid: false, noShadow: true, ...o });
  const [bx, by, bz] = benchPos;
  const W = 3.1, D = 1.25, Hh = 0.62, t = 0.05;
  const crates = [[bx - 3.65, bz + 0.62], [bx + 3.65, bz + 0.62]];
  const items = [];
  const half = Math.ceil(defs.length / 2);
  // stencil "text": a row of short bars of varying width, like letters at a distance
  const stencil = (x0, y0, z, w, h, seed, col = STEN, face = -1) => {
    let x = x0, k = seed;
    while (x < x0 + w - 0.02) {
      k = (k * 9301 + 49297) % 233280;
      const lw = 0.025 + (k / 233280) * 0.035;
      if (x + lw > x0 + w) break;
      deco([x, y0, z - 0.004 * (face < 0 ? 1 : 0)], [x + lw, y0 + h, z + 0.004 * (face > 0 ? 1 : 0)], { color: col, emissive: 0.08 });
      x += lw + 0.012;
    }
  };
  // a steel ammo can: body, lid with a handle, latch, yellow stencil band
  const ammoCan = (x, y, z, open = false, rotY = 0) => {
    const sx = rotY ? 0.16 : 0.3, sz = rotY ? 0.3 : 0.16;
    at(x, y, z, sx, 0.19, sz, { color: OD, mat: 'paint' });
    if (!open) {
      at(x, y + 0.19, z, sx + 0.012, 0.025, sz + 0.012, { color: OD_D, mat: 'paint' });
      at(x, y + 0.215, z, rotY ? 0.03 : 0.12, 0.018, rotY ? 0.12 : 0.03, { color: STEELD, mat: 'metal' });
    } else {
      // lid flipped back, rounds stood up inside
      at(x, y + 0.19, z + (rotY ? 0 : sz / 2 + 0.012), sx + 0.012, 0.2, 0.012, { color: OD_D, mat: 'paint' });
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
        const px = x - sx / 2 + 0.03 + i * ((sx - 0.06) / 5), pz = z - sz / 2 + 0.03 + j * ((sz - 0.06) / 2);
        at(px, y + 0.17, pz, 0.016, 0.05, 0.016, { color: BRASSC, mat: 'metal', solid: false, shape: 'cyl' });
        at(px, y + 0.22, pz, 0.011, 0.016, 0.011, { color: TIP, mat: 'metal', solid: false, noShadow: true });
      }
    }
    at(x + (rotY ? 0 : sx / 2 + 0.006), y + 0.12, z + (rotY ? sz / 2 + 0.006 : 0), rotY ? 0.04 : 0.012, 0.05, rotY ? 0.012 : 0.04, { color: STEELD, mat: 'metal', solid: false });
    deco([x - sx / 2 - 0.001, y + 0.06, z - sz / 2 - 0.004], [x + sx / 2 + 0.001, y + 0.085, z - sz / 2 + 0.001], { color: STEN, emissive: 0.05 });
    return [x, y + 0.2, z];
  };
  crates.forEach(([cx, cz], ci) => {
    const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2, y = by;
    // the crate: painted planks (wood grain under olive paint), a darker plinth, steel corners and bands
    add([x0, y, z0], [x1, y + 0.08, z1], { color: OD_D, tex: 12, mat: 'paint' });
    add([x0, y, z0], [x1, y + Hh, z0 + t], { color: OD, tex: 12, mat: 'paint' });
    add([x0, y, z1 - t], [x1, y + Hh, z1], { color: OD, tex: 12, mat: 'paint' });
    add([x0, y, z0], [x0 + t, y + Hh, z1], { color: OD, tex: 12, mat: 'paint' });
    add([x1 - t, y, z0], [x1, y + Hh, z1], { color: OD, tex: 12, mat: 'paint' });
    add([x0 - 0.02, y, z0 - 0.02], [x1 + 0.02, y + 0.06, z1 + 0.02], { color: OD_D, mat: 'paint' });                       // skid
    for (const xx of [x0, x1]) for (const zz of [z0, z1]) add([xx - 0.035, y, zz - 0.035], [xx + 0.035, y + Hh + 0.015, zz + 0.035], { color: STEELD, mat: 'metal' });
    for (const yy of [0.18, 0.46]) deco([x0 - 0.012, y + yy, z0 - 0.012], [x1 + 0.012, y + yy + 0.04, z0 + 0.001], { color: STEELD, mat: 'metal' });     // steel bands
    deco([x0 - 0.012, y + Hh - 0.03, z0 - 0.012], [x1 + 0.012, y + Hh, z1 + 0.012], { color: OD_D, mat: 'paint' });                                     // rim
    // stencils on the front: a big line of "text", a smaller one, and a yellow hazard band at the end
    stencil(x0 + 0.18, y + 0.27, z0 - 0.012, 1.3, 0.07, 17 + ci * 31);
    stencil(x0 + 0.18, y + 0.37, z0 - 0.012, 0.8, 0.04, 91 + ci * 7, STENW);
    deco([x1 - 0.42, y + 0.26, z0 - 0.016], [x1 - 0.14, y + 0.42, z0 - 0.001], { color: STEN, emissive: 0.06 });
    for (let k = 0; k < 4; k++) deco([x1 - 0.4 + k * 0.07, y + 0.26, z0 - 0.018], [x1 - 0.37 + k * 0.07, y + 0.42, z0 - 0.015], { color: [0.08, 0.08, 0.08] });
    // rope handles at both ends
    for (const [xx, s] of [[x0, -1], [x1, 1]]) {
      at(xx + s * 0.03, y + 0.42, cz - 0.16, 0.04, 0.04, 0.04, { color: STEELD, mat: 'metal', solid: false });
      at(xx + s * 0.03, y + 0.42, cz + 0.16, 0.04, 0.04, 0.04, { color: STEELD, mat: 'metal', solid: false });
      at(xx + s * 0.06, y + 0.38, cz, 0.03, 0.03, 0.36, { color: ROPE, mat: 'cloth', solid: false, shape: 'cyl' });
    }
    // the lid, propped open against the wall behind, with its own stencil and hinges
    add([x0 + 0.05, y + 0.05, z1 + 0.04], [x1 - 0.05, y + 0.95, z1 + 0.1], { color: OD, tex: 12, mat: 'paint', solid: false });
    stencil(x0 + 0.3, y + 0.62, z1 + 0.039, 1.6, 0.09, 53 + ci * 13);
    for (const xx of [x0 + 0.4, x1 - 0.4]) at(xx, y + Hh - 0.03, z1 + 0.04, 0.1, 0.06, 0.04, { color: STEELD, mat: 'metal', solid: false });
    // the guns: two rows, jammed in at odd angles
    const mine = defs.slice(ci * half, ci * half + half);
    const cols = Math.ceil(mine.length / 2);
    mine.forEach((def, i) => {
      const row = i % 2, col = Math.floor(i / 2);
      const rnd = (k) => { const v = Math.sin((i + 1) * 12.9898 + (ci + 1) * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
      const px = x0 + 0.3 + (col + 0.5) * ((W - 0.6) / cols) + (rnd(1) - 0.5) * 0.08;
      const pz = row ? cz + 0.24 : cz - 0.2;
      const len = Math.max(...def.parts.map((p) => -(p.c[2] - p.s[2] / 2)));
      const py = y + Math.max(Hh + 0.08, 0.2 + len * 0.9);
      const up = norm3([(rnd(2) - 0.5) * 0.7, 1, (rnd(3) - 0.5) * 0.35 - 0.12]);
      const f = [Math.sin((rnd(4) - 0.5) * 0.8), 0, -Math.cos((rnd(4) - 0.5) * 0.8)];
      const fd = f[0] * up[0] + f[1] * up[1] + f[2] * up[2];
      const xa = norm3([f[0] - up[0] * fd, f[1] - up[1] * fd, f[2] - up[2] * fd]);
      const ya = [up[1] * xa[2] - up[2] * xa[1], up[2] * xa[0] - up[0] * xa[2], up[0] * xa[1] - up[1] * xa[0]];
      const m = mat4();
      m.set([...xa, 0, ...ya, 0, ...up, 0, px, py, pz, 1]);
      items.push({
        def, base: m, lift: 0, crate: ci,
        aim: [px + up[0] * 0.18, py + up[1] * 0.18, pz + up[2] * 0.18],
        center: [px, y, pz],
        parts(time, hot) {
          this.lift += ((hot ? 0.14 : 0) - this.lift) * 0.2;
          const mm = mat4();
          mm.set(this.base);
          mm[12] += up[0] * this.lift; mm[13] += up[1] * this.lift; mm[14] += up[2] * this.lift;
          return Weapon.worldParts(this.def, mm).map((p) => (hot ? { ...p, emissive: Math.max(p.emissive, 0.12) } : p));
        },
      });
    });
    // ammo round the crate: a stack of cans (top one open), loose mags, a box of shells, a belt of rounds
    const sx = ci ? x1 + 0.3 : x0 - 0.3;
    ammoCan(sx, y, cz - 0.3, false);
    ammoCan(sx, y, cz + 0.05, false);
    const top = ammoCan(sx, y + 0.24, cz - 0.12, true);
    items.push({ ammo: true, aim: top, center: [sx, y, cz], parts: () => [] });
    for (let k = 0; k < 3; k++) {
      const mx = cx - 0.5 + k * 0.28, mz = z0 - 0.22 - (k % 2) * 0.07;
      at(mx, y, mz, 0.05, 0.03, 0.16, { color: [0.12, 0.12, 0.13], mat: 'metal', solid: false });
      at(mx, y + 0.03, mz - 0.05, 0.03, 0.006, 0.03, { color: BRASSC, mat: 'metal', solid: false, noShadow: true });
    }
    at(cx + 0.55, y, z0 - 0.25, 0.22, 0.07, 0.12, { color: [0.75, 0.12, 0.08], mat: 'paint', solid: false });
    at(cx + 0.55, y + 0.07, z0 - 0.25, 0.224, 0.012, 0.124, { color: STENW, mat: 'paint', solid: false });
    for (let k = 0; k < 9; k++) at(cx + 0.1 + k * 0.035, y, z0 - 0.42 + Math.sin(k * 0.8) * 0.04, 0.014, 0.014, 0.055, { color: k % 3 ? BRASSC : [0.25, 0.22, 0.18], mat: 'metal', solid: false, noShadow: true });
  });
  return items;
}
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

