// Class gadgets that are put into the world, made of ordinary world boxes so they block movement, bullets and
// sight like any other cover:
//   bar  BARRICADE (Heavy ability): a steel wall that rises out of the floor. Variant 'low' = BLOCKADE, wide and waist-high.
//   pad  BOUNCE PAD (Medium ability): throws anyone who steps on it straight up. Variant 'launch' = LAUNCH PAD, fires you forward.
//   pod  DRONE POD (Light heavy weapon): a little launcher that opens after 1.5 s (the drones live in heavy.js).
//   tur  TURRET (Heavy heavy weapon): a tripod and column; the rotating head and its shooting live in heavy.js.
// Placements carry an id so they can be mirrored online: everyone builds the same thing in the same spot.
import { boxAt, refreshBox } from './world.js';
import { compose, mat4, anglesFor } from './math.js';

export const BARRICADE = { hp: 450, life: 45, max: 2, cd: 10, len: 2.8, h: 2.05, thick: 0.32 };
export const BLOCKADE = { hp: 700, life: 45, max: 1, cd: 12, len: 4.2, h: 1.25, thick: 0.36 };
export const PAD = { life: 30, max: 1, cd: 14, r: 0.9, vy: 15.5 };
export const LAUNCH = { vy: 9, push: 17 };
export const POD = { hp: 80, delay: 1.5, max: 2 };
export const TURRET = { life: 25, max: 1 };

const STEEL = [0.25, 0.26, 0.29], STEEL2 = [0.34, 0.35, 0.38], CHAR = [0.13, 0.13, 0.15];
const HEAVY = [1, 0.68, 0.08], MED = [0.92, 0.1, 0.08], LIGHT = [0.25, 0.65, 1];

const dimsOf = (g) => (g.v === 'low' ? BLOCKADE : BARRICADE);

let seq = 0;
export class Gadgets {
  constructor(world, effects, sounds) {
    Object.assign(this, { world, effects, sounds });
    this.list = [];
    this.onPodOpen = null;     // set by heavy.js: (pod) => launch its drones
  }

  clear() { for (const g of [...this.list]) this.remove(g, false); }
  byId(gid) { return this.list.find((g) => g.gid === gid); }
  newId(owner) { return `${owner}:${++seq}:${Math.floor(Math.random() * 1e4)}`; }

  // ---- where would it go? (null = no room)
  // a wall: in front of you on the floor, square to where you face (snapped to the nearest axis)
  barricadeSpot(pos, yaw, B = BARRICADE) {
    const f = [-Math.sin(yaw), -Math.cos(yaw)];
    const ax = Math.abs(f[1]) >= Math.abs(f[0]) ? 0 : 2;          // 0: the wall runs along x
    for (const d of [1.7, 1.35, 2.1]) {
      const c = [pos[0] + f[0] * d, pos[1] + 1.4, pos[2] + f[1] * d];
      const hit = this.world.raycast(c, [0, -1, 0], 3.2, false);
      if (!hit || hit.normal[1] < 0.7) continue;
      const y = hit.point[1];
      const hx = ax === 0 ? B.len / 2 : B.thick / 2 + 0.08, hz = ax === 0 ? B.thick / 2 + 0.08 : B.len / 2;
      if (this.world.firstOverlap([c[0] - hx, y + 0.12, c[2] - hz], [c[0] + hx, y + B.h, c[2] + hz])) continue;
      return { p: [+c[0].toFixed(3), +y.toFixed(3), +c[2].toFixed(3)], ax };
    }
    return null;
  }
  // a turret: a 0.8 m square of floor in front of you with headroom
  turretSpot(pos, yaw) {
    const f = [-Math.sin(yaw), -Math.cos(yaw)];
    for (const d of [1.5, 1.15, 2]) {
      const c = [pos[0] + f[0] * d, pos[1] + 1.4, pos[2] + f[1] * d];
      const hit = this.world.raycast(c, [0, -1, 0], 3.2, false);
      if (!hit || hit.normal[1] < 0.7) continue;
      const y = hit.point[1];
      if (this.world.firstOverlap([c[0] - 0.4, y + 0.1, c[2] - 0.4], [c[0] + 0.4, y + 1.45, c[2] + 0.4])) continue;
      return { p: [+c[0].toFixed(3), +y.toFixed(3), +c[2].toFixed(3)], ax: 0, yaw: +yaw.toFixed(3) };
    }
    return null;
  }
  // pad or pod: where the crosshair meets the floor within 9 m, else at your feet
  padSpot(eye, fwd, pos, r = PAD.r) {
    const tryAt = (x, y0, z) => {
      const hit = this.world.raycast([x, y0, z], [0, -1, 0], 3, false);
      if (!hit || hit.normal[1] < 0.7) return null;
      const y = hit.point[1];
      if (this.world.firstOverlap([x - r, y + 0.05, z - r], [x + r, y + 1.6, z + r])) return null;
      return { p: [+x.toFixed(3), +y.toFixed(3), +z.toFixed(3)] };
    };
    const hit = this.world.raycast(eye, fwd, 9, false);
    if (hit && hit.normal[1] > 0.7) {
      const s = tryAt(hit.point[0], hit.point[1] + 0.6, hit.point[2]);
      if (s) return s;
    }
    const hl = Math.hypot(fwd[0], fwd[2]) || 1, fx = fwd[0] / hl, fz = fwd[2] / hl;
    return tryAt(pos[0] + fx * 1.3, pos[1] + 0.8, pos[2] + fz * 1.3) || tryAt(pos[0], pos[1] + 0.8, pos[2]);
  }

  // ---- build one: { gid, k: 'bar' | 'pad' | 'pod' | 'tur', v (variant), p, ax, yaw, owner, team, teamCol }
  place(spec) {
    if (this.byId(spec.gid)) return null;
    const mine = this.list.filter((g) => g.owner === spec.owner && g.k === spec.k);
    const max = spec.k === 'bar' ? dimsOf(spec).max : spec.k === 'pad' ? PAD.max : spec.k === 'pod' ? POD.max : TURRET.max;
    while (mine.length >= max) this.remove(mine.shift(), true);
    const g = { ...spec, t: 0, parts: [], flash: 0, squash: 0, yaw: spec.yaw ?? 0, pitch: 0 };
    if (spec.k === 'bar') { g.hp = g.maxHp = dimsOf(g).hp; g.life = dimsOf(g).life; this.buildBarricade(g); }
    else if (spec.k === 'pad') { g.life = PAD.life; this.buildPad(g); }
    else if (spec.k === 'pod') { g.hp = g.maxHp = POD.hp; g.life = POD.delay + 1.2; this.buildPod(g); }
    else { g.hp = g.maxHp = g.v === 'heavy' ? 400 : 300; g.life = TURRET.life; this.buildTurret(g); }
    for (const q of g.parts) { q.b.dynamic = true; q.b.ref = g; this.world.add(q.b); }
    this.list.push(g);
    this.grow(g, 0.02);
    if (spec.k === 'bar' || spec.k === 'tur') { this.sounds.barricade?.(); this.effects.dust(g.p, 6); } else { this.sounds.padDrop?.(); this.effects.dust(g.p, 3); }
    return g;
  }

  // a part: a box laid out in the gadget's own frame (u along the wall, v up, w across), from a base point
  part(g, u, v, w, su, sv, sw, o) {
    const [x, y, z] = g.p, along = g.ax === 0;
    const cx = x + (along ? u : w), cz = z + (along ? w : u);
    const sx = along ? su : sw, sz = along ? sw : su;
    const b = boxAt(cx, y + v, cz, sx, sv, sz, { grid: false, edges: false, ...o });
    g.parts.push({ b, v, sv });
    return b;
  }

  buildBarricade(g) {
    const B = dimsOf(g), L = B.len, H = B.h, T = B.thick, low = g.v === 'low';
    const team = g.teamCol || HEAVY;
    g.core = this.part(g, 0, 0.05, 0, L - 0.3, H - 0.25, T, { color: STEEL, tex: 5, shape: 0.03, tag: 'barricade', mat: [0.6, 0.45] });
    // end posts and feet, ribs, a top rail, and hazard bands on both faces
    for (const s of [-1, 1]) {
      this.part(g, s * (L / 2 - 0.12), 0, 0, 0.26, H, T + 0.1, { color: CHAR, tex: 5, shape: 0.04, noBullet: true, solid: false });
      this.part(g, s * (L / 2 - 0.12), 0, 0, 0.34, 0.12, 0.95, { color: CHAR, tex: 5, shape: 0.03, solid: false });
    }
    const ribs = low ? [-1.3, -0.45, 0.45, 1.3] : [-0.62, 0.62];
    for (const u of ribs) this.part(g, u, 0.25, 0, 0.12, H - 0.6, T + 0.05, { color: STEEL2, tex: 5, solid: false, noBullet: true });
    this.part(g, 0, H - 0.2, 0, L, 0.16, T + 0.12, { color: CHAR, tex: 5, shape: 0.04, solid: false, noBullet: true });
    for (const s of [-1, 1]) {
      this.part(g, 0, H - (low ? 0.48 : 0.62), s * (T / 2 + 0.012), L - 0.6, low ? 0.12 : 0.16, 0.02, { color: HEAVY, emissive: 0.15, solid: false, noBullet: true });
      this.part(g, 0, 0.32, s * (T / 2 + 0.012), L - 0.6, 0.06, 0.02, { color: HEAVY, solid: false, noBullet: true });
      if (!low) this.part(g, 0, 1.38, s * (T / 2 + 0.012), 0.7, 0.07, 0.02, { color: [0.03, 0.03, 0.035], solid: false, noBullet: true });
    }
    g.light = this.part(g, 0, H - 0.03, 0, L - 0.5, 0.04, 0.08, { color: team, emissive: 1, solid: false, noBullet: true, noShadow: true });
  }

  buildPad(g) {
    const R = PAD.r, team = g.teamCol || MED, launch = g.v === 'launch';
    if (launch) { const f = [-Math.sin(g.yaw), -Math.cos(g.yaw)]; g.ax = Math.abs(f[1]) >= Math.abs(f[0]) ? 2 : 0; g.dirSign = (g.ax === 2 ? f[1] : f[0]) > 0 ? 1 : -1; }
    this.part(g, 0, 0, 0, 2 * R + 0.16, 0.07, 2 * R + 0.16, { color: CHAR, shape: 'cylY', solid: false, noBullet: true });
    g.core = this.part(g, 0, 0, 0, 2 * R, 0.16, 2 * R, { color: STEEL, shape: 'cylY', tag: 'pad', noBullet: true, tex: 5 });
    g.ring = this.part(g, 0, 0.155, 0, 2 * R - 0.08, 0.025, 2 * R - 0.08, { color: team, emissive: 0.85, shape: 'cylY', solid: false, noBullet: true, noShadow: true });
    g.top = this.part(g, 0, 0.17, 0, 2 * R - 0.32, 0.07, 2 * R - 0.32, { color: [0.2, 0.2, 0.22], shape: 'cylY', solid: false, noBullet: true, tex: 5 });
    g.dot = this.part(g, 0, 0.24, 0, 0.42, 0.012, 0.42, { color: [1, 1, 0.96], emissive: 1, shape: 'cylY', solid: false, noBullet: true, noShadow: true });
    g.extra = [];
    if (launch) {
      // three glowing chevrons pointing the way it throws you, and a backstop ramp
      for (let k = 0; k < 3; k++) {
        const u = g.dirSign * (-0.35 + k * 0.3);
        for (const s of [-1, 1]) g.extra.push(this.part(g, u - g.dirSign * 0.06, 0.245, s * 0.1, 0.06, 0.012, 0.2, { color: team, emissive: 1, solid: false, noBullet: true, noShadow: true }));
      }
      this.part(g, -g.dirSign * (R - 0.05), 0, 0, 0.16, 0.34, 1.1, { color: CHAR, tex: 5, shape: 0.03, solid: false, noBullet: true });
    }
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      this.part(g, Math.cos(a) * (R + 0.02), 0, Math.sin(a) * (R + 0.02), 0.22, 0.12, 0.22, { color: CHAR, shape: 0.03, solid: false, noBullet: true });
    }
  }

  buildPod(g) {
    const team = g.teamCol || LIGHT;
    this.part(g, 0, 0, 0, 0.62, 0.06, 0.62, { color: CHAR, shape: 'cylY', solid: false, noBullet: true });
    g.core = this.part(g, 0, 0.04, 0, 0.44, 0.34, 0.44, { color: STEEL, tex: 5, shape: 0.03, tag: 'pod', mat: [0.6, 0.45] });
    for (const s of [-1, 1]) this.part(g, 0, 0.12, s * 0.225, 0.3, 0.05, 0.012, { color: team, emissive: 0.9, solid: false, noBullet: true, noShadow: true });
    g.lidL = this.part(g, -0.11, 0.38, 0, 0.22, 0.04, 0.44, { color: STEEL2, tex: 5, solid: false, noBullet: true });
    g.lidR = this.part(g, 0.11, 0.38, 0, 0.22, 0.04, 0.44, { color: STEEL2, tex: 5, solid: false, noBullet: true });
    g.light = this.part(g, 0, 0.42, 0, 0.06, 0.03, 0.06, { color: [1, 0.2, 0.1], emissive: 1, solid: false, noBullet: true, noShadow: true });
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      this.part(g, Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26, 0.1, 0.1, 0.1, { color: CHAR, solid: false, noBullet: true });
    }
  }

  buildTurret(g) {
    const team = g.teamCol || HEAVY;
    // splayed tripod-ish feet, a column, a turntable (the head is drawn by heavy.js)
    for (const [u, w] of [[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]]) {
      this.part(g, u * 0.55, 0, w * 0.55, 0.1, 0.5, 0.1, { color: CHAR, tex: 5, solid: false, noBullet: true });
      this.part(g, u, 0, w, 0.16, 0.05, 0.16, { color: CHAR, tex: 5, solid: false, noBullet: true });
      this.part(g, u * 0.78, 0.04, w * 0.78, 0.28, 0.06, 0.06, { color: STEEL2, solid: false, noBullet: true });
    }
    g.core = this.part(g, 0, 0.05, 0, 0.3, 0.92, 0.3, { color: STEEL, tex: 5, shape: 0.03, tag: 'turret', mat: [0.6, 0.45] });
    this.part(g, 0, 0.94, 0, 0.46, 0.06, 0.46, { color: CHAR, shape: 'cylY', solid: false, noBullet: true });
    g.light = this.part(g, 0, 0.6, 0, 0.32, 0.04, 0.32, { color: team, emissive: 1, solid: false, noBullet: true, noShadow: true });
  }

  // rise out of the floor (k: 0..1)
  grow(g, k) {
    for (const q of g.parts) {
      const b = q.b, base = g.p[1] + q.v * k;
      b.min[1] = base; b.max[1] = base + q.sv * k;
      if (b.max[1] - b.min[1] < 0.002) b.max[1] = b.min[1] + 0.002;
      refreshBox(b);
    }
  }

  remove(g, effect = true) {
    const i = this.list.indexOf(g);
    if (i < 0) return;
    this.list.splice(i, 1);
    for (const q of g.parts) this.world.remove(q.b);
    g.dead = true;
    if (effect) {
      if (g.k === 'bar' || g.k === 'tur') { this.effects.shatter(g.core, [0, 0, 0], 3, 3); this.effects.dust(g.p, 8); this.sounds.barricadeBreak?.(); }
      else this.effects.dust(g.p, 4);
    }
  }

  // a bullet hit one; returns true if it broke
  damage(g, dmg) {
    if (!g || g.hp == null || !this.list.includes(g)) return false;
    g.hp -= dmg;
    g.flash = 0.08;
    if (g.hp <= 0) { this.remove(g, true); return true; }
    return false;
  }

  // per frame: rise / pop animations, timers, and bouncing whoever's on a pad
  // movers: [{ pos, vel, dead, onBounce(vy, push) }]
  update(dt, movers) {
    for (const g of [...this.list]) {
      g.t += dt;
      g.life -= dt;
      if (g.life <= 0) { this.remove(g, g.k !== 'pod'); continue; }
      g.flash -= dt;
      if (g.k === 'bar' || g.k === 'tur') {
        const k = g.t < 0.32 ? 1 - Math.pow(1 - g.t / 0.32, 3) : 1;
        const over = g.t < 0.5 ? Math.sin(Math.min(1, g.t / 0.5) * Math.PI) * 0.04 : 0;
        if (g.t < 0.6) this.grow(g, Math.min(1.04, k + over));
        else if (!g.settled) { this.grow(g, 1); g.settled = true; }
        const dmgK = 1 - Math.max(0, g.hp) / g.maxHp;
        g.core.color = g.flash > 0 ? [0.7, 0.7, 0.72] : [STEEL[0] - dmgK * 0.08, STEEL[1] - dmgK * 0.09, STEEL[2] - dmgK * 0.1];
        g.light.emissive = g.life < 5 ? (Math.sin(g.t * 18) > 0 ? 1 : 0.1) : 1;
      } else if (g.k === 'pod') {
        if (g.t < 0.2) this.grow(g, g.t / 0.2); else if (!g.settled) { this.grow(g, 1); g.settled = true; }
        g.core.color = g.flash > 0 ? [0.7, 0.7, 0.72] : STEEL;
        g.light.emissive = Math.sin(g.t * (6 + g.t * 10)) > 0 ? 1 : 0.1;
        if (!g.opened && g.t >= POD.delay) {
          // the lids flip open and the drones go
          g.opened = true;
          for (const [lid, s] of [[g.lidL, -1], [g.lidR, 1]]) { lid.min[0] += s * 0.2; lid.max[0] += s * 0.2; lid.min[2] += s * 0; refreshBox(lid); }
          this.sounds.padDrop?.();
          this.effects.dust([g.p[0], g.p[1] + 0.4, g.p[2]], 4, [0, 4, 0]);
          this.onPodOpen?.(g);
        }
      } else {
        // the pad pops up, then the top squashes when it fires someone off
        if (g.t < 0.25) this.grow(g, Math.min(1, g.t / 0.2));
        else if (!g.settled) { this.grow(g, 1); g.settled = true; }
        g.squash *= Math.exp(-9 * dt);
        if (g.settled) {
          const top = g.top, base = g.p[1] + 0.17 - g.squash * 0.1;
          top.min[1] = base; top.max[1] = base + 0.07; refreshBox(top);
          const dot = g.dot; dot.min[1] = base + 0.07; dot.max[1] = base + 0.082; refreshBox(dot);
        }
        const pulse = 0.55 + 0.35 * Math.sin(g.t * 5) + (g.squash > 0.2 ? 0.5 : 0);
        g.ring.emissive = g.life < 5 ? pulse * (Math.sin(g.t * 18) > 0 ? 1 : 0.15) : pulse;
        g.extra.forEach((c, i) => { c.emissive = 0.3 + 0.7 * Math.max(0, Math.sin(g.t * 8 - i * 0.9)); });
        const topY = g.p[1] + 0.25;
        for (const m of movers) {
          if (!m || m.dead) continue;
          const dx = m.pos[0] - g.p[0], dz = m.pos[2] - g.p[2];
          if (dx * dx + dz * dz > (PAD.r + 0.12) ** 2) continue;
          if (m.pos[1] < topY - 0.35 || m.pos[1] > topY + 0.45 || m.vel[1] > 3) continue;
          if ((m.padCd || 0) > 0) continue;
          m.padCd = 0.35;
          g.squash = 1;
          this.sounds.bounce?.();
          this.effects.dust([g.p[0], topY, g.p[2]], 5, [0, 5, 0]);
          if (g.v === 'launch') m.onBounce(LAUNCH.vy, [-Math.sin(g.yaw) * LAUNCH.push, -Math.cos(g.yaw) * LAUNCH.push]);
          else m.onBounce(PAD.vy, null);
        }
      }
    }
    for (const m of movers) if (m && m.padCd > 0) m.padCd -= dt;
  }
}

// ---------------------------------------------------------------- the grappling line
// A rope from a to b made of short round segments. While the hook is flying the line snakes out in a wave
// that dies down along its length; once it bites it pulls taut (the sag and wobble ease off over a moment).
const ROPE = [0.1, 0.1, 0.11], ROPE2 = [0.2, 0.55, 1];
export const TETHER_COL = [1, 0.5, 0.08];
export { seg as ropeSeg };
function seg(out, p, q, th, color, emissive = 0) {
  const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], l = Math.hypot(d[0], d[1], d[2]);
  if (l < 0.004) return;
  const m = mat4(), s = [th, th, l + th * 0.6];
  compose(m, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2], anglesFor(d), s);
  out.push({ model: m, scale: s, color, emissive, shape: 'cyl', edges: 0 });
}
export function ropeParts(a, b, { sag = 0, wave = 0, t = 0, thick = 0.016, accent = ROPE2 } = {}) {
  const out = [], N = 18;
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d) || 1;
  // sideways and up directions across the rope, for the wave
  let u = [-d[2], 0, d[0]]; const ul = Math.hypot(...u) || 1; u = u.map((v) => v / ul);
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const k = i / N, bell = 4 * k * (1 - k);
    const w = wave * Math.sin(k * Math.PI * 4 - t * 38) * bell * Math.min(1, L / 6);
    const w2 = wave * 0.6 * Math.cos(k * Math.PI * 3 - t * 31) * bell * Math.min(1, L / 6);
    pts.push([a[0] + d[0] * k + u[0] * w, a[1] + d[1] * k - sag * bell + w2, a[2] + d[2] * k + u[2] * w]);
  }
  for (let i = 0; i < N; i++) seg(out, pts[i], pts[i + 1], thick, i % 5 === 2 ? accent : ROPE, i % 5 === 2 ? 0.6 : 0);
  return out;
}
// the hook: a steel shaft with a glowing collar, a nose, and three claws that fold open when it bites
export function hookParts(tip, dir, spin = 0, open = 1, accent = ROPE2) {
  const out = [];
  const l = Math.hypot(...dir) || 1, f = dir.map((v) => v / l);
  let u = Math.abs(f[1]) < 0.9 ? [f[2], 0, -f[0]] : [1, 0, 0];
  const ul = Math.hypot(...u); u = u.map((v) => v / ul);
  const v = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]];
  const at = (k, r = [0, 0, 0], rk = 0) => [0, 1, 2].map((i) => tip[i] + f[i] * k + r[i] * rk);
  const steel = [0.5, 0.52, 0.56], dark = [0.16, 0.16, 0.18];
  seg(out, at(-0.26), at(-0.02), 0.042, dark);
  seg(out, at(-0.2), at(-0.15), 0.052, accent, 0.9);
  seg(out, at(-0.06), at(0.03), 0.05, steel);
  const nose = mat4(), ns = [0.05, 0.05, 0.05];
  compose(nose, at(0.03), [0, 0, 0], ns);
  out.push({ model: nose, scale: ns, color: steel, shape: 'sphere', edges: 0 });
  for (let j = 0; j < 3; j++) {
    const a = spin + (j * Math.PI * 2) / 3, c = Math.cos(a), s = Math.sin(a);
    const r = [0, 1, 2].map((i) => u[i] * c + v[i] * s);
    const base = at(-0.04), elbow = at(-0.13 + 0.03 * open, r, 0.05 + 0.08 * open), claw = at(-0.06 + 0.06 * open, r, 0.07 + 0.09 * open);
    seg(out, base, elbow, 0.02, steel);
    seg(out, elbow, claw, 0.018, steel);
  }
  return out;
}
