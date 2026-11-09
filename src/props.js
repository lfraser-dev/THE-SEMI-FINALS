// Shootable things in the test range: red training dummies and a destructible wall.
import { Weapon } from './weapon.js';
import { compose, mat4 } from './math.js';
import { makeBox, moveBoxTo } from './world.js';

const RED = [0.92, 0.1, 0.08];
const RED_HEAD = [1, 0.22, 0.16];

// Dummy parts relative to its feet: [center, size, color]
const DUMMY = [
  { c: [0, 0.38, 0], s: [0.42, 0.76, 0.26], col: RED },        // legs
  { c: [0, 1.1, 0], s: [0.58, 0.7, 0.3], col: RED },           // torso
  { c: [0, 1.62, 0], s: [0.3, 0.32, 0.3], col: RED_HEAD, head: true },
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
      color: [...p.col], grid: false, emissive: 0.18, tag: 'dummy', ref: this,
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
      b.emissive = f ? 0.9 : 0.18;
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
  constructor(world, effects, origin, { cols = 12, rows = 6, chunk = 0.5, thick = 0.35, axis = 0 } = {}) {
    Object.assign(this, { world, effects, origin, cols, rows, chunk, thick, axis });
    this.color = [0.9, 0.9, 0.92];
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
