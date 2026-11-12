// Combat bots for the deck: drop-in spawn, strafe / cover AI, burst fire with accuracy that
// drops when you move fast, and a wave manager.
import { makeBox, moveBoxTo } from './world.js';
import { compose, mat4, norm, clamp, anglesFor } from './math.js';
import { Builder, at, pitchBasis, basisFrom } from './rig.js';
import { takedownPose } from './takedown.js';

const DARK = [0.16, 0.17, 0.19];
const BLACK = [0.08, 0.08, 0.09];

// all bots are red like the range dummies; types differ in build and behaviour
const RED = [0.92, 0.1, 0.08], RED_HEAD = [1, 0.22, 0.16], RED_DARK = [0.55, 0.06, 0.05];
const GUN = [0.1, 0.1, 0.11], GUN2 = [0.2, 0.2, 0.22];
const FRAME = [0.11, 0.11, 0.125], JOINT = [0.26, 0.26, 0.28], SOLE = [0.06, 0.06, 0.07], GLOW = [1, 0.32, 0.18];
const TYPES = {
  rifle: { hp: 100, speed: 4.2, range: [11, 19], rpm: 560, burst: [3, 5], dmg: 6, acc: 1, pause: [0.7, 1.5], build: 1 },
  rusher: { hp: 80, speed: 5.6, range: [4, 8], rpm: 900, burst: [5, 8], dmg: 5, acc: 0.85, pause: [0.5, 1.0], build: 0.88 },
  heavy: { hp: 240, speed: 3.0, range: [9, 15], rpm: 720, burst: [8, 12], dmg: 6, acc: 0.9, pause: [1.0, 1.8], scale: 1.15, build: 1.3 },
};
const MUZZLE = [0.12, 1.29, -0.76];
const N_MODELS = 28;

// two-bone IK: joint between a and b (segment lengths l1, l2), bent toward `hint`
function ik(a, b, l1, l2, hint) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  let len = Math.hypot(...d);
  const u = d.map((v) => v / (len || 1));
  len = Math.min(len, l1 + l2 - 1e-3);
  const x = (l1 * l1 - l2 * l2 + len * len) / (2 * len);
  const h = Math.sqrt(Math.max(l1 * l1 - x * x, 0));
  // hint direction made perpendicular to the bone
  const hd = hint[0] * u[0] + hint[1] * u[1] + hint[2] * u[2];
  let p = [hint[0] - u[0] * hd, hint[1] - u[1] * hd, hint[2] - u[2] * hd];
  const pl = Math.hypot(...p) || 1;
  p = p.map((v) => v / pl);
  return [a[0] + u[0] * x + p[0] * h, a[1] + u[1] * x + p[1] * h, a[2] + u[2] * x + p[2] * h];
}
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
// tilt a bot-space offset forward by `a` (top goes toward -z)
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const lean = (v, a) => [v[0], v[1] * Math.cos(a) + v[2] * Math.sin(a), -v[1] * Math.sin(a) + v[2] * Math.cos(a)];

let nextId = 1;

// recolour a bot's red armour into a team colour: bot.pal = teamPalette([r, g, b])
export function teamPalette(c) {
  const m = (k) => c.map((v) => Math.min(1, v * k));
  return new Map([[RED, c], [RED_HEAD, m(1.18)], [RED_DARK, m(0.55)]]);
}

export class Bot {
  constructor(world, type, pos, yaw, dropDelay) {
    this.world = world;
    this.id = nextId++;
    this.name = `BOT-${String(this.id).padStart(2, '0')}`;
    this.type = type;
    this.t = TYPES[type];
    this.sc = this.t.scale || 1;
    this.pos = [...pos];
    this.yaw = yaw;
    this.hp = this.t.hp;
    this.maxHp = this.t.hp;
    this.alive = true;
    this.state = 'drop';            // drop | wait | fight
    this.dropDelay = dropDelay;
    this.dropT = 0;
    this.flash = 0;
    this.walk = 0;
    this.moving = 0;
    this.target = null;
    this.think = Math.random() * 0.5;
    this.burstLeft = 0;
    this.shotCd = 0;
    this.pauseCd = 0.6 + Math.random();
    this.losCd = 0;
    this.los = false;
    this.muzzleT = 0;
    this.stuck = 0;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.models = Array.from({ length: N_MODELS }, () => mat4());
    // animation state
    this.recoil = 0; this.flinch = 0; this.flinchTwist = 0; this.landK = 0;
    this.aimPitch = 0; this.breath = Math.random() * 6; this.lastPos = [...pos];
    this.localVel = [0, 0]; this.dying = -1; this.fallSign = 1;
    const s = this.sc;
    this.body = world.add(makeBox([0, 0, 0], [0.62 * s, 1.47 * s, 0.62 * s], { tag: 'bot', ref: this, hidden: true, noShadow: true }));
    this.headBox = world.add(makeBox([0, 0, 0], [0.32 * s, 0.32 * s, 0.32 * s], { tag: 'bot', ref: this, hidden: true, noShadow: true }));
    this.headBox.head = true;
    this.place();
  }

  get visible() { return this.alive && !(this.state === 'drop' && this.dropT < this.dropDelay); }

  place() {
    const s = this.sc, p = this.pos;
    const off = this.visible ? 0 : -200;   // park hitboxes out of the way until they've landed
    moveBoxTo(this.body, [p[0], p[1] + 0.735 * s + off, p[2]]);
    moveBoxTo(this.headBox, [p[0], p[1] + 1.64 * s + off, p[2]]);
  }

  // local bot-space point -> world
  toWorld(c) {
    const s = this.sc, cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const x = c[0] * s, y = c[1] * s, z = c[2] * s;
    return [this.pos[0] + cy * x + sy * z, this.pos[1] + y, this.pos[2] - sy * x + cy * z];
  }

  eye() { return this.toWorld([0, 1.66, -0.1]); }
  muzzle() { return this.muzzlePt || this.toWorld(MUZZLE); }

  damage(amount, dir) {
    if (!this.alive || !this.visible) return false;
    this.hp -= amount;
    this.flash = 0.08;
    if (this.state === 'fight') this.think = Math.min(this.think, 0.15);   // react: move
    this.flinch = 1;
    this.flinchTwist = (Math.random() - 0.5) * 0.6;
    if (this.hp <= 0) {
      this.alive = false;
      this.killDir = dir;
      this.dying = 0;
      // fall away from the shot
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      const lz = sy * (dir?.[0] || 0) + cy * (dir?.[2] || 0);
      this.fallSign = lz >= 0 ? 1 : -1;
      return true;
    }
    return false;
  }

  remove() {
    this.world.remove(this.body);
    this.world.remove(this.headBox);
  }

  // collision against the world, ignoring our own hitboxes
  blocked(p) {
    const r = 0.3 * this.sc, h = 1.75 * this.sc;
    return !!this.world.firstOverlap([p[0] - r, p[1] + 0.3, p[2] - r], [p[0] + r, p[1] + h, p[2] + r], this);
  }

  // line of sight: glass and other bots' hitboxes don't block it
  canSee(from, to, ignore = null) {
    const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    const dist = Math.hypot(...d);
    const hit = this.world.raycast(from, d.map((v) => v / dist), dist, true, (b) => b.tag === 'glass' || b.tag === 'bot' || b.ref === this || (ignore && b.ref === ignore));
    return !hit || hit.t > dist - 0.4;
  }

  update(dt, g) {
    this.flash -= dt;
    this.muzzleT -= dt;
    this.recoil *= Math.exp(-16 * dt);
    this.flinch *= Math.exp(-7 * dt);
    this.landK *= Math.exp(-3.5 * dt);
    this.breath += dt;
    // movement in bot space, for leg swing direction
    const vx = (this.pos[0] - this.lastPos[0]) / Math.max(dt, 1e-4), vz = (this.pos[2] - this.lastPos[2]) / Math.max(dt, 1e-4);
    this.lastPos = [...this.pos];
    const cy0 = Math.cos(this.yaw), sy0 = Math.sin(this.yaw);
    const lx = cy0 * vx - sy0 * vz, lz = sy0 * vx + cy0 * vz;
    this.localVel[0] += (lx - this.localVel[0]) * Math.min(1, dt * 10);
    this.localVel[1] += (lz - this.localVel[1]) * Math.min(1, dt * 10);
    if (this.state === 'drop') {
      this.dropT += dt;
      const t = this.dropT - this.dropDelay;
      if (t < 0) return;
      const fall = clamp(t / 0.55, 0, 1);
      this.dropY = (1 - fall * fall) * 10;
      if (fall >= 1 && !this.landed) { this.landed = true; this.landK = 1; g.onLand(this); }
      this.place();
      if (fall >= 1) this.state = 'wait';
      return;
    }
    this.dropY = 0;
    const pl = g.player, pe = pl.eye();
    const dx = pl.pos[0] - this.pos[0], dz = pl.pos[2] - this.pos[2];
    const dist = Math.hypot(dx, dz);
    // always face the player
    const want = Math.atan2(-dx, -dz);
    let dy = want - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 8);
    const pitchWant = Math.atan2(pe[1] - (this.pos[1] + 1.4 * this.sc), Math.max(dist, 0.5));
    this.aimPitch += (pitchWant - this.aimPitch) * Math.min(1, dt * 6);
    if (this.state !== 'fight' || !g.active) { this.place(); return; }

    // line of sight, refreshed a few times a second
    this.losCd -= dt;
    if (this.losCd <= 0) { this.losCd = 0.18 + Math.random() * 0.1; this.los = !pl.dead && this.canSee(this.eye(), pe); }

    // --- decide where to stand
    this.think -= dt;
    if (this.think <= 0 || !this.target) {
      this.think = 0.8 + Math.random() * 1.2;
      this.target = this.pickSpot(g, dist);
    }
    // --- move
    let speed = 0;
    if (this.target) {
      const tx = this.target[0] - this.pos[0], tz = this.target[1] - this.pos[2];
      const td = Math.hypot(tx, tz);
      if (td > 0.3) {
        speed = this.t.speed * (this.burstLeft > 0 ? 0.6 : 1);
        const step = Math.min(td, speed * dt);
        const before = [...this.pos];
        const nx = [this.pos[0] + tx / td * step, this.pos[1], this.pos[2]];
        if (!this.blocked(nx)) this.pos[0] = nx[0];
        const nz = [this.pos[0], this.pos[1], this.pos[2] + tz / td * step];
        if (!this.blocked(nz)) this.pos[2] = nz[2];
        const moved = Math.hypot(this.pos[0] - before[0], this.pos[2] - before[2]);
        if (moved < step * 0.3) { this.stuck += dt; if (this.stuck > 0.4) { this.stuck = 0; this.target = null; this.strafe *= -1; } }
        else this.stuck = 0;
        const b = g.bounds;
        this.pos[0] = clamp(this.pos[0], b.min[0], b.max[0]);
        this.pos[2] = clamp(this.pos[2], b.min[1], b.max[1]);
      }
    }
    this.moving += ((speed > 0 ? 1 : 0) - this.moving) * Math.min(1, dt * 8);
    this.walk += dt * speed * 2.2;

    // --- shoot
    this.shotCd -= dt;
    this.pauseCd -= dt;
    if (this.los && !pl.dead && dist < 45) {
      if (this.burstLeft <= 0 && this.pauseCd <= 0) {
        const [a, b] = this.t.burst;
        this.burstLeft = a + Math.floor(Math.random() * (b - a + 1));
      }
      if (this.burstLeft > 0 && this.shotCd <= 0) {
        this.shotCd = 60 / this.t.rpm;
        this.burstLeft--;
        if (this.burstLeft === 0) { const [p0, p1] = this.t.pause; this.pauseCd = p0 + Math.random() * (p1 - p0); }
        this.fire(g, dist);
      }
    } else this.burstLeft = 0;
    this.place();
  }

  // choose a nearby spot at a good range, preferring ones that can see the player (or cover when hurt)
  pickSpot(g, dist) {
    const [lo, hi] = this.t.range;
    const pl = g.player;
    const wantCover = this.hp < this.maxHp * 0.4 && Math.random() < 0.6;
    let best = null, bestScore = -1e9;
    const toP = norm([pl.pos[0] - this.pos[0], 0, pl.pos[2] - this.pos[2]]);
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 5;
      // bias toward strafing sideways relative to the player
      const side = [-toP[2] * this.strafe, toP[0] * this.strafe];
      const c = [this.pos[0] + Math.cos(a) * r + side[0] * 2, this.pos[2] + Math.sin(a) * r + side[1] * 2];
      const b = g.bounds;
      if (c[0] < b.min[0] || c[0] > b.max[0] || c[1] < b.min[1] || c[1] > b.max[1]) continue;
      if (this.blocked([c[0], this.pos[1], c[1]])) continue;
      const d = Math.hypot(pl.pos[0] - c[0], pl.pos[2] - c[1]);
      let score = -Math.abs(d - (lo + hi) / 2) * (d < lo || d > hi ? 1.5 : 0.4);
      const sees = this.canSee([c[0], this.pos[1] + 1.6 * this.sc, c[1]], pl.eye());
      score += wantCover ? (sees ? -6 : 6) : (sees ? 5 : -3);
      // don't bunch up
      for (const o of g.bots) if (o !== this && o.alive) { const od = Math.hypot(o.pos[0] - c[0], o.pos[2] - c[1]); if (od < 2.5) score -= (2.5 - od) * 3; }
      score += Math.random() * 1.5;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (Math.random() < 0.25) this.strafe *= -1;
    return best;
  }

  fire(g, dist) {
    const pl = g.player;
    const from = this.muzzle();
    this.muzzleT = 0.05;
    this.recoil = 1;
    // harder to hit you when you're fast, sliding, in the air or far away
    const hs = Math.hypot(pl.vel[0], pl.vel[2]);
    let chance = (0.5 - Math.max(0, dist - 8) * 0.018) * this.t.acc * g.accMul;
    chance -= Math.min(hs / 14, 1) * 0.35;
    if (pl.sliding) chance -= 0.12;
    if (!pl.grounded) chance -= 0.1;
    if (pl.dash || pl.grapple?.phase === 'pull') chance -= 0.2;
    chance = clamp(chance, 0.05, 0.9);
    const target = [pl.pos[0], pl.pos[1] + 1.2, pl.pos[2]];
    let end;
    if (Math.random() < chance) {
      end = target;
      g.hitPlayer(this.t.dmg, this, from);
    } else {
      // near miss: pass close by the player and hit whatever is behind
      const miss = [target[0] + (Math.random() - 0.5) * 2.2, target[1] + (Math.random() - 0.3) * 1.6, target[2] + (Math.random() - 0.5) * 2.2];
      const d = norm([miss[0] - from[0], miss[1] - from[1], miss[2] - from[2]]);
      const hit = this.world.raycast(from, d, 120);
      end = hit ? hit.point : from.map((c, i) => c + d[i] * 120);
      if (hit && hit.box.tag !== 'bot') g.impact(hit);
      g.whiz(from, end);
    }
    g.shot(this, from, end, dist);
  }

  // ---------------------------------------------------------------- articulated model
  // Everything is posed in bot space (feet at origin, facing -z) then moved into the world.
  parts() {
    const dyingT = this.dying;
    if (!this.alive && (dyingT < 0 || (dyingT > 0.75 && !this.downed))) return [];     // downed: stays lying there
    if (this.alive && !this.visible) return [];
    const t = this.t, s = this.sc, b = t.build;
    const g = this.moving, w = this.walk;
    const lv = this.localVel, ls = Math.hypot(lv[0], lv[1]);
    const md = ls > 0.2 ? [lv[0] / ls, lv[1] / ls] : [0, -1];        // stride direction (bot space)
    const fl = this.flash > 0 ? 0.85 : 0;
    const col = (c0) => { const c = (this.pal && this.pal.get(c0)) || c0; return fl ? c.map((v) => v + (1 - v) * fl) : c; };
    const em = fl ? 0.9 : 0.1, emD = fl ? 0.9 : 0;
    // whole-body fall when dying
    const fa = dyingT >= 0 ? Math.min(1, dyingT / 0.6) ** 2 * 1.45 : 0, fs = this.fallSign;
    // a takedown (or cutscene) pose: whole-body offset and pitch, crouch, hand and foot targets
    const P = this.pose || (this.tdAnim && this.alive ? takedownPose(this.tdAnim.kind, this.tdAnim.t) : null);
    const pr = P ? P.rot : 0, pc = Math.cos(pr), ps = Math.sin(pr);
    const posed = (v) => {
      if (!P) return v;
      const y = v[1] - 0.95, z = v[2];
      return [v[0] + P.off[0], 0.95 + y * pc + z * ps + P.off[1], z * pc - y * ps + P.off[2]];
    };
    const fall0 = (v) => fa ? [v[0], v[1] * Math.cos(fa) - v[2] * fs * Math.sin(fa), v[2] * Math.cos(fa) + v[1] * fs * Math.sin(fa)] : v;
    const fall = (v) => fall0(posed(v));
    const lift = this.dropY || 0;
    const W = (v) => { const p = this.toWorld(fall(v)); p[1] += lift; return p; };
    const O = W([0, 0, 0]);
    const dirW = (v) => { const p = W(v); const d = [p[0] - O[0], p[1] - O[1], p[2] - O[2]]; const l = Math.hypot(...d) || 1; return d.map((x) => x / l); };
    const bd = (this.bd = this.bd || new Builder()).reset();
    // colour-flashing wrappers (sizes are in bot units, scaled by the bot's size)
    const cap = (a, c, r1, r2, color, e = em) => bd.capsule(W(a), W(c), r1 * s, r2 * s, col(color), e);
    const ell = (c, B, size, color, e = em) => bd.ellipsoid(W(c), B, size.map((v) => v * s), col(color), e);
    const box = (c, B, size, r, color, e = em) => bd.rbox(W(c), B, size.map((v) => v * s), r * s, col(color), e);

    // --- pose parameters
    const crouch = this.landK * 0.28 + (dyingT >= 0 ? Math.min(1, dyingT / 0.5) * 0.35 : 0) + (P ? P.crouch : 0);
    const bob = -Math.abs(Math.sin(w)) * 0.06 * g;
    const breathe = Math.sin(this.breath * 2.1) * 0.012 * (1 - g);
    const pelvis = [0, 0.95 + bob - crouch, 0];
    const leanF = 0.12 * g + (this.type === 'rusher' ? 0.12 * g : 0) - this.flinch * 0.35 - this.recoil * 0.05 + this.landK * 0.2;
    const twist = Math.sin(w) * 0.12 * g + this.flinch * this.flinchTwist;
    const tr = (v) => lean([v[0] * Math.cos(twist) + v[2] * Math.sin(twist), v[1], -v[0] * Math.sin(twist) + v[2] * Math.cos(twist)], leanF);
    const up = (v) => add3(pelvis, tr(v));
    const BB = { R: dirW([1, 0, 0]), U: dirW([0, 1, 0]), B: dirW([0, 0, 1]) };                  // body basis
    const TB = { R: dirW(tr([1, 0, 0])), U: dirW(tr([0, 1, 0])), B: dirW(tr([0, 0, 1])) };       // torso basis
    const heavy = this.type === 'heavy';

    // --- legs: dark frame with red armour shells, knee joints, armoured boots
    const legL = 0.47;
    for (const side of [-1, 1]) {
      const ph = w + (side > 0 ? Math.PI : 0);
      const swing = Math.sin(ph) * 0.42 * g;
      const hip = add3(pelvis, [side * 0.12 * b, -0.04, 0]);
      const footLift = Math.max(0, Math.cos(ph)) * 0.14 * g;
      const foot = side > 0 && P?.footR ? P.footR : [hip[0] + md[0] * Math.sin(swing) * 0.8 + side * 0.03, footLift + 0.06, hip[2] + md[1] * Math.sin(swing) * 0.8];
      const knee = ik(hip, foot, legL, legL, [0, 0.2, -1]);
      const ankle = add3(foot, [0, 0.07, 0.03]);
      ell(hip, BB, [0.15 * b, 0.15, 0.15], FRAME, emD);                                      // hip joint
      cap(hip, knee, 0.065 * b, 0.05 * b, FRAME, emD);
      cap(lerp3(hip, knee, 0.08), lerp3(hip, knee, 0.78), 0.1 * b, 0.075 * b, RED);          // thigh armour
      ell(knee, BB, [0.12 * b, 0.12, 0.12], JOINT, emD);
      cap(knee, ankle, 0.05 * b, 0.04 * b, FRAME, emD);
      cap(lerp3(knee, ankle, 0.12), lerp3(knee, ankle, 0.85), 0.082 * b, 0.06 * b, RED);    // shin shell
      const kd = norm(sub3(W(knee), W(ankle)));
      bd.rbox(W(add3(knee, [0, 0.02, -0.06])), basisFrom(kd, BB.B), [0.1 * b * s, 0.13 * s, 0.05 * s], 0.022 * s, col(RED_HEAD), em);  // knee cap
      box([foot[0], 0.07 + footLift * 0.5, foot[2] - 0.04], BB, [0.15 * b, 0.12, 0.27], 0.05, FRAME, emD);   // boot
      ell([foot[0], 0.075 + footLift * 0.5, foot[2] - 0.13], BB, [0.14 * b, 0.11, 0.13], RED);              // toe cap
      box([foot[0], 0.02 + footLift * 0.5, foot[2] - 0.05], BB, [0.16 * b, 0.035, 0.31], 0.014, SOLE, emD);
    }

    // --- pelvis, spine, chest
    box(add3(pelvis, [0, 0.02, 0]), BB, [0.34 * b, 0.18, 0.24], 0.08, FRAME, emD);
    box(add3(pelvis, [0, 0.0, -0.11]), BB, [0.22 * b, 0.14, 0.05], 0.025, RED);             // codpiece plate
    cap(up([0, 0.08, 0]), up([0, 0.28, 0]), 0.11 * b, 0.13 * b, FRAME, emD);                // spine core
    for (const y of [0.13, 0.21]) cap(up([0, y, 0]), up([0, y + 0.035, 0]), 0.135 * b, 0.14 * b, JOINT, emD);   // ribbed waist
    box(up([0, 0.42 + breathe, 0.0]), TB, [0.48 * b, 0.34, 0.3 * b], 0.12, RED);            // chest
    box(up([0, 0.44 + breathe, -0.14 * b]), TB, [0.32 * b, 0.22, 0.05], 0.035, RED_HEAD);   // chest plate
    ell(up([0, 0.43 + breathe, -0.168 * b]), TB, [0.07, 0.07, 0.02], GLOW, fl ? 1 : 0.9);  // power core
    box(up([0, 0.4, 0.16 * b]), TB, [0.3 * b, 0.3, 0.09], 0.04, FRAME, emD);               // back unit
    for (const sx of [-1, 1]) box(up([sx * 0.08, 0.42, 0.21 * b]), TB, [0.05, 0.2, 0.02], 0.008, GLOW, fl ? 1 : 0.7);   // vents

    // --- head: rounded helmet with a glowing visor band, no face
    const neck = up([0, 0.6, 0]);
    const headC = add3(up([0, 0.62, 0]), [0, 0.17, -0.01]);
    const hp = this.aimPitch * 0.6 - leanF * 0.3;
    const HB = pitchBasis(BB, hp);
    const hc = Math.cos(hp), hs = Math.sin(hp);
    const hO = (v) => add3(headC, [v[0], v[1] * hc - v[2] * hs, v[1] * hs + v[2] * hc]);   // head-space offset
    cap(neck, add3(neck, [0, 0.12, 0]), 0.07, 0.06, FRAME, emD);
    ell(headC, HB, [0.25, 0.28, 0.28], RED_HEAD);                                             // helmet
    box(hO([0, -0.1, -0.005]), HB, [0.17, 0.08, 0.19], 0.04, JOINT, emD);              // jaw
    ell(hO([0, 0.01, -0.03]), HB, [0.244, 0.09, 0.265], GLOW, fl ? 1 : 0.95);       // visor band
    ell(hO([0, 0.01, -0.025]), HB, [0.25, 0.11, 0.262], FRAME, emD);                 // visor rim
    for (const sx of [-1, 1]) ell(hO([sx * 0.125, -0.0, 0.01]), HB, [0.04, 0.1, 0.1], FRAME, emD);   // ear pods
    box(hO([0, 0.13, 0.02]), HB, [0.045, 0.04, 0.2], 0.015, RED, em);               // crest

    // --- gun held at the chest, aimed at you, kicking back when it fires
    const cp = Math.cos(this.aimPitch), sp = Math.sin(this.aimPitch);
    const gd = [0, sp, -cp];                                           // gun direction (bot space)
    const gunC = add3(up([0.12 * b, 0.42, -0.3]), [0, this.recoil * 0.025, this.recoil * 0.07]);
    const noGun = !!P?.hands;
    const GB = pitchBasis(BB, this.aimPitch + this.recoil * 0.12);
    const gat = (v) => add3(gunC, [v[0], v[1] * cp - v[2] * sp, v[1] * sp + v[2] * cp]);   // gun-space offset (z back)
    if (!noGun) {
      box(gunC, GB, [0.075, 0.11, 0.4], 0.02, GUN, emD);                                          // receiver
      box(gat([0, 0.07, 0.02]), GB, [0.06, 0.04, 0.14], 0.015, GUN2, emD);                        // top rail / optic
      ell(gat([0, 0.09, 0.0]), GB, [0.03, 0.03, 0.02], GLOW, fl ? 1 : 0.9);                      // optic lens
      bd.rbox(W(add3(gunC, gd.map((v) => v * 0.28))), GB, [0.038 * s, 0.038 * s, 0.2 * s], 0.017 * s, col(GUN2), emD);   // barrel
      bd.rbox(W(add3(gunC, gd.map((v) => v * 0.36))), GB, [0.05 * s, 0.05 * s, 0.05 * s], 0.018 * s, col(GUN), emD);     // muzzle
      box(gat([0, -0.1, 0.06]), pitchBasis(GB, 0.2), [0.05, 0.13, 0.08], 0.015, GUN2, emD);    // mag
      box(gat([0.04, 0.0, 0.0]), GB, [0.006, 0.022, 0.3], 0.003, GLOW, fl ? 1 : 0.8);          // light strip
    }
    const muz = add3(gunC, gd.map((v) => v * 0.39));
    this.muzzlePt = W(muz);
    let gripR = add3(gunC, [0, -0.05, 0.16]), gripL = add3(gunC, gd.map((v) => v * 0.18)).map((v, i) => v + (i === 1 ? -0.05 : 0));
    if (noGun) { gripL = P.hands[0]; gripR = P.hands[1]; }
    this.armW = { hL: W(gripL), hR: W(gripR) };

    // --- arms solved to the gun
    for (const [side, hand] of [[-1, gripL], [1, gripR]]) {
      const sh = up([side * 0.27 * b, 0.55, 0]);
      const elbow = ik(sh, hand, 0.31, 0.3, [side * 0.8, -0.6, 0.2]);
      if (side > 0) this.armW.eR = W(elbow); else this.armW.eL = W(elbow);
      ell(sh, TB, [0.14 * b, 0.14, 0.14], JOINT, emD);
      cap(sh, elbow, 0.05 * b, 0.042 * b, FRAME, emD);
      cap(lerp3(sh, elbow, 0.25), lerp3(sh, elbow, 0.85), 0.07 * b, 0.06 * b, RED);          // upper arm shell
      ell(elbow, BB, [0.095 * b, 0.095, 0.095], JOINT, emD);
      cap(elbow, hand, 0.045 * b, 0.036 * b, FRAME, emD);
      cap(lerp3(elbow, hand, 0.1), lerp3(elbow, hand, 0.72), 0.072 * b, 0.058 * b, RED);     // forearm shell
      box(hand, BB, [0.085, 0.095, 0.1], 0.035, FRAME, emD);
      // pauldron
      const pd = heavy ? 1.3 : 1;
      box(up([side * 0.3 * b, 0.565, 0]), TB, [0.17 * b * pd, 0.11 * pd, 0.22 * pd], 0.05 * pd, RED_HEAD);
    }
    return bd.out;
  }

}

// ---------------------------------------------------------------- waves
export class BotManager {
  constructor(world, deck, refs) {
    this.world = world;
    this.deck = deck;
    this.refs = refs;
    this.bots = [];
    this.wave = 0;
    this.state = 'idle';          // idle | intro | countdown | fight | cleared
    this.timer = 0;
    this.doorOpen = 0;            // 0 closed .. 1 open
    this.doorTarget = 0;
    this.alarm = 0;
    this.best = 0;
    try { this.best = +localStorage.getItem('semifinals.bestwave') || 0; } catch { /* ignore */ }
    this.flashM = mat4();
  }

  get active() { return this.state === 'fight'; }
  get running() { return this.state !== 'idle'; }
  get alive() { return this.bots.filter((b) => b.alive).length; }

  composition(n) {
    const count = Math.min(3 + n * 2, 14);
    const list = [];
    for (let i = 0; i < count; i++) {
      if (n >= 3 && i % 5 === 4) list.push('heavy');
      else if (n >= 2 && i % 3 === 2) list.push('rusher');
      else list.push('rifle');
    }
    return list;
  }

  spawnWave(n, dropStart) {
    this.clearBots();
    this.wave = n;
    const d = this.deck;
    const types = this.composition(n);
    types.forEach((type, i) => {
      const pod = d.pods[i % 3];
      const k = Math.floor(i / 3);
      const pos = [d.podX + (k % 2) * 1.6 - 0.8, d.y, pod + ((k * 0.9) % 3) - 1.3];
      this.bots.push(new Bot(this.world, type, pos, -Math.PI / 2, dropStart + i * 0.13));
    });
    this.accMul = 0.78 + n * 0.05;
    this.doorTarget = 0;
    this.alarm = 4;
  }

  start(withIntro) {
    const n = this.state === 'idle' ? 1 : this.wave + 1;
    this.spawnWave(n, withIntro ? 1.9 : 0.3);
    this.state = withIntro ? 'intro' : 'countdown';
    this.timer = withIntro ? 0 : 2.4;
  }

  stop() {
    this.clearBots();
    this.state = 'idle';
    this.wave = 0;
    this.doorTarget = 0;
    this.alarm = 0;
  }

  clearBots() {
    for (const b of this.bots) b.remove();
    this.bots = [];
  }

  beginFight() {
    this.state = 'fight';
    this.doorTarget = 1;
    for (const b of this.bots) if (b.alive) b.state = 'fight';
  }

  // g: { player, hitPlayer, shot, impact, whiz, onLand, onKill }
  update(dt, g) {
    g.bots = this.bots;
    g.bounds = this.deck.bounds;
    g.active = this.state === 'fight';
    g.accMul = this.accMul || 1;
    for (const b of this.bots) {
      if (!b.alive) {
        if (!b.removed) { b.removed = true; b.remove(); g.onKill?.(b); }
        if (b.dying >= 0) {
          b.dying += dt;
          b.flash -= dt;
          if (b.dying > 0.75 && !b.shattered) { b.shattered = true; g.onShatter?.(b); }
        }
        continue;
      }
      b.update(dt, g);
      if (b.state === 'wait' && this.state === 'fight') b.state = 'fight';
    }
    // doors slide up into the gate beam
    this.doorOpen += (this.doorTarget - this.doorOpen) * Math.min(1, dt * 3);
    for (const door of this.refs.doors) {
      const c = [...door.center];
      c[1] = door.closedY + 2.1 + this.doorOpen * 4.0;
      moveBoxTo(door, c);
    }
    // alarm lights
    this.alarm = Math.max(0, this.alarm - dt);
    const on = this.alarm > 0 && Math.floor(this.alarm * 4) % 2 === 0;
    for (const a of this.refs.alarms) { a.color = on ? [1, 0.12, 0.08] : [0.4, 0.06, 0.05]; a.emissive = on ? 1 : 0.3; }
    if (this.state === 'countdown') {
      this.timer -= dt;
      if (this.timer <= 0) this.beginFight();
    }
    if (this.state === 'fight' && this.alive === 0 && this.bots.every((b) => b.landed || !b.alive)) {
      this.state = 'cleared';
      this.timer = 5;
      if (this.wave > this.best) { this.best = this.wave; try { localStorage.setItem('semifinals.bestwave', String(this.best)); } catch { /* ignore */ } }
      g.onCleared?.(this.wave);
    } else if (this.state === 'cleared') {
      this.timer -= dt;
      if (this.timer <= 0) { this.start(false); g.onNextWave?.(this.wave); }
    }
  }

  drawParts() {
    const out = [];
    for (const b of this.bots) {
      out.push(...b.parts());
      if (b.alive && b.visible && b.muzzleT > 0) {
        const m = mat4(), p = b.muzzle(), s = [0.14, 0.14, 0.14];
        compose(m, p, [0, b.yaw, Math.random() * 3], s);
        out.push({ model: m, scale: s, color: [1, 0.85, 0.5], emissive: 1 });
      }
    }
    return out;
  }

  // light beams the bots drop down
  beams() {
    const out = [];
    for (const b of this.bots) {
      if (b.state !== 'drop' || !b.alive) continue;
      const t = b.dropT - b.dropDelay;
      if (t < -0.35 || t > 0.9) continue;
      const a = t < 0 ? (t + 0.35) / 0.35 : t < 0.55 ? 1 : 1 - (t - 0.55) / 0.35;
      const m = mat4(), s = [0.9, 14, 0.9];
      compose(m, [b.pos[0], b.pos[1] + 7, b.pos[2]], [0, 0, 0], s);
      out.push({ model: m, scale: s, color: [1, 0.25, 0.15], emissive: 1, alpha: 0.28 * a });
    }
    return out;
  }
}
