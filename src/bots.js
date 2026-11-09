// Combat bots for the deck: drop-in spawn, strafe / cover AI, burst fire with accuracy that
// drops when you move fast, and a wave manager.
import { makeBox, moveBoxTo } from './world.js';
import { compose, mat4, norm, clamp } from './math.js';

const DARK = [0.16, 0.17, 0.19];
const BLACK = [0.08, 0.08, 0.09];

const TYPES = {
  rifle: { hp: 100, speed: 4.2, range: [11, 19], body: [0.55, 0.57, 0.6], visor: [1, 0.55, 0.1], rpm: 560, burst: [3, 5], dmg: 6, acc: 1, pause: [0.7, 1.5] },
  rusher: { hp: 80, speed: 5.6, range: [4, 8], body: [0.85, 0.75, 0.25], visor: [1, 0.95, 0.3], rpm: 900, burst: [5, 8], dmg: 5, acc: 0.85, pause: [0.5, 1.0] },
  heavy: { hp: 240, speed: 3.0, range: [9, 15], body: [0.45, 0.16, 0.14], visor: [1, 0.2, 0.15], rpm: 720, burst: [8, 12], dmg: 6, acc: 0.9, pause: [1.0, 1.8], scale: 1.15 },
};

// model parts in bot space: feet at y=0, facing -z
const PARTS = [
  { c: [-0.12, 0.42, 0], s: [0.17, 0.84, 0.19], col: DARK, leg: -1 },
  { c: [0.12, 0.42, 0], s: [0.17, 0.84, 0.19], col: DARK, leg: 1 },
  { c: [0, 0.9, 0], s: [0.42, 0.18, 0.26], col: DARK },
  { c: [0, 1.23, 0], s: [0.5, 0.52, 0.3], col: 'body' },
  { c: [0, 1.27, -0.16], s: [0.38, 0.3, 0.04], col: 'visor', em: 0.25 },
  { c: [0, 1.22, 0.19], s: [0.38, 0.42, 0.12], col: DARK },
  { c: [0, 1.64, 0], s: [0.27, 0.29, 0.29], col: 'body', head: true },
  { c: [0, 1.66, -0.15], s: [0.21, 0.07, 0.02], col: 'visor', em: 1 },
  { c: [-0.28, 1.25, -0.16], s: [0.12, 0.12, 0.42], col: DARK },
  { c: [0.28, 1.22, -0.12], s: [0.12, 0.12, 0.36], col: DARK },
  { c: [0.12, 1.27, -0.44], s: [0.07, 0.1, 0.58], col: BLACK, gun: true },
];
const MUZZLE = [0.12, 1.29, -0.76];

let nextId = 1;

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
    this.models = PARTS.map(() => mat4());
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
  muzzle() { return this.toWorld(MUZZLE); }

  damage(amount, dir) {
    if (!this.alive || !this.visible) return false;
    this.hp -= amount;
    this.flash = 0.08;
    if (this.state === 'fight') this.think = Math.min(this.think, 0.15);   // react: move
    if (this.hp <= 0) { this.alive = false; this.killDir = dir; return true; }
    return false;
  }

  remove() {
    this.world.remove(this.body);
    this.world.remove(this.headBox);
  }

  // collision against the world, ignoring our own hitboxes
  blocked(p) {
    const r = 0.3 * this.sc, h = 1.75 * this.sc;
    for (const b of this.world.boxes) {
      if (!b.solid || b.ref === this) continue;
      if (p[0] - r < b.max[0] && p[0] + r > b.min[0] && p[1] + 0.3 < b.max[1] && p[1] + h > b.min[1] &&
          p[2] - r < b.max[2] && p[2] + r > b.min[2]) return true;
    }
    return false;
  }

  canSee(from, to) {
    const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    const dist = Math.hypot(...d);
    const hit = this.world.raycast(from, d.map((v) => v / dist), dist);
    return !hit || hit.t > dist - 0.4 || hit.box.ref === this;
  }

  update(dt, g) {
    this.flash -= dt;
    this.muzzleT -= dt;
    if (this.state === 'drop') {
      this.dropT += dt;
      const t = this.dropT - this.dropDelay;
      if (t < 0) return;
      const fall = clamp(t / 0.55, 0, 1);
      this.dropY = (1 - fall * fall) * 10;
      if (fall >= 1 && !this.landed) { this.landed = true; g.onLand(this); }
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

  // drawable parts (with walk cycle, hit flash, drop-in offset)
  parts() {
    if (!this.visible) return [];
    const out = [];
    const t = this.t, s = this.sc, cy = this.yaw;
    const sw = Math.sin(this.walk) * 0.5 * this.moving;
    const lift = this.dropY || 0;
    const fl = this.flash > 0 ? 0.8 : 0;
    PARTS.forEach((p, i) => {
      let c = [...p.c], rx = 0;
      if (p.leg) { rx = sw * p.leg; c[2] += Math.sin(this.walk) * 0.1 * p.leg * this.moving; }
      const w = this.toWorld(c);
      w[1] += lift + (p.leg ? 0 : Math.abs(Math.cos(this.walk)) * 0.03 * this.moving);
      const sc = p.s.map((v) => v * s);
      compose(this.models[i], w, [rx, cy, 0], sc);
      let col = p.col === 'body' ? t.body : p.col === 'visor' ? t.visor : p.col;
      if (fl) col = col.map((v) => v + (1 - v) * fl);
      out.push({ model: this.models[i], scale: sc, color: col, emissive: fl ? 0.9 : (p.em || 0) });
    });
    return out;
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
      if (b.visible && b.muzzleT > 0) {
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
      out.push({ model: m, scale: s, color: b.t.visor, emissive: 1, alpha: 0.28 * a });
    }
    return out;
  }
}
