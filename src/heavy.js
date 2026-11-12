// Heavy weapons (Q): things that fly, explode and shoot on their own.
//   DRONE POD / SWARM POD (Light): the pod (gadgets.js) opens after 1.5 s and lets out 1 or 3 drones. Each rises,
//     hunts for 5 s, then dives at the first enemy it can see and explodes on contact; if it finds nobody it blows up
//     where it is.
//   FRAG / STICKY / FIREBOMB LAUNCHER (Medium): one grenade on an arc. Frag goes off on impact, sticky clings to what
//     it hits (people too) and goes off 1.2 s later, firebomb leaves a pool of fire that sets people alight.
//   MG / CANNON TURRET (Heavy): the turret base is a gadget; this file turns its head, picks targets and shoots.
// Only the owner's game decides who gets hurt (through hooks.hit). Online, everyone else gets the launches, drone
// positions, turret shots and explosions as messages and just draws them.
import { compose, mat4, anglesFor } from './math.js';
import { ropeSeg } from './gadgets.js';

export const HEAVY_STATS = {
  dronepod: { cd: 18, drones: 1, dmg: 90, r: 3.6, speed: 15, name: 'DRONE POD' },
  swarmpod: { cd: 20, drones: 3, dmg: 40, r: 2.6, speed: 17, name: 'SWARM POD' },
  gl_frag: { cd: 9, dmg: 85, r: 4, name: 'FRAG LAUNCHER', col: [0.36, 0.42, 0.22] },
  gl_sticky: { cd: 11, dmg: 110, r: 3.6, fuse: 1.2, name: 'STICKY LAUNCHER', col: [1, 0.78, 0.1] },
  gl_fire: { cd: 13, dmg: 30, r: 3.5, fire: 5, burn: { dps: 15, dur: 2 }, name: 'FIREBOMB LAUNCHER', col: [1, 0.35, 0.05] },
  turret_mg: { cd: 24, range: 30, rate: 0.12, dmg: 8, spread: 0.035, turn: 7, name: 'MG TURRET' },
  turret_heavy: { cd: 28, range: 45, rate: 1.1, dmg: 45, spread: 0.006, turn: 3.5, name: 'CANNON TURRET' },
};

const DARK = [0.16, 0.16, 0.18], STEEL = [0.45, 0.46, 0.5], RED = [1, 0.15, 0.1];
const GRAV = 14, SEEK = 5, SEE = 32;

let did = 0;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
// distance from point c to the segment p .. p + d
const segDist = (p, d, c) => {
  const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1;
  const t = Math.max(0, Math.min(1, ((c[0] - p[0]) * d[0] + (c[1] - p[1]) * d[1] + (c[2] - p[2]) * d[2]) / dd));
  return dist([p[0] + d[0] * t, p[1] + d[1] * t, p[2] + d[2] * t], c);
};

export class Heavy {
  // hooks: { targets() -> [{ ref, pos, chest }], hit(ref, dmg, point, dir, name), ignite(ref, burn, name),
  //          gadgetHit(g, dmg), me() -> my owner id, myTeam() -> team idx or -1, send(msg) | null, shake(pos, r) }
  constructor(world, effects, sounds, gadgets, hooks) {
    Object.assign(this, { world, effects, sounds, gadgets, hooks });
    this.grenades = [];
    this.drones = [];
    this.fires = [];
    this.sendT = 0;
    gadgets.onPodOpen = (pod) => this.podOpened(pod);
  }

  clear() { this.grenades.length = 0; this.drones.length = 0; this.fires.length = 0; }

  // can `from` see this target (nothing solid in between other than the target itself)?
  sees(from, tg) {
    const to = tg.chest, d = dist(from, to);
    if (d < 0.01) return true;
    const hit = this.world.raycast(from, norm([to[0] - from[0], to[1] - from[1], to[2] - from[2]]), d, false);
    return !hit || hit.t > d - 0.4 || hit.box.ref === tg.ref;
  }
  nearest(from, range, filter) {
    let best = null, bd = range;
    for (const tg of this.hooks.targets()) {
      const d = dist(from, tg.chest);
      if (d < bd && (!filter || filter(tg)) && this.sees(from, tg)) { best = tg; bd = d; }
    }
    return best;
  }

  // ---------------------------------------------------------------- explosions
  boom(pos, r, dmg, name, mine, kind = 'frag') {
    const fx = this.effects;
    const big = kind === 'mini' ? 0.7 : 1;
    for (let k = 0; k < 26 * big; k++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 - 0.2, sp = (3 + Math.random() * 7) * big;
      fx.flame(pos, [Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp, Math.sin(a) * Math.cos(e) * sp], (2.2 + Math.random() * 2.5) * big);
    }
    fx.dust(pos, 8, [0, 4, 0]);
    for (let k = 0; k < 8; k++) fx.spawnPiece(pos, [0.05, 0.05, 0.05], [(Math.random() - 0.5) * 14, Math.random() * 9, (Math.random() - 0.5) * 14], [0.15, 0.15, 0.16], 1.2);
    this.sounds.boom?.(big);
    this.hooks.shake?.(pos, r);
    if (kind === 'fire') this.fires.push({ pos: [...pos], r: HEAVY_STATS.gl_fire.r, t: HEAVY_STATS.gl_fire.fire, tick: 0, mine, name });
    if (!mine) return;
    this.hooks.send?.({ t: 'boom', p: pos.map((v) => +v.toFixed(2)), r, k: kind });
    const from = [pos[0], pos[1] + 0.3, pos[2]];
    for (const tg of this.hooks.targets()) {
      const d = dist(pos, tg.chest);
      if (d > r + 0.5 || !this.sees(from, tg)) continue;
      const k = 1 - 0.6 * Math.min(1, d / r);
      this.hooks.hit(tg.ref, Math.round(dmg * k), tg.chest, norm([tg.chest[0] - pos[0], 0.5, tg.chest[2] - pos[2]]), name);
    }
    // enemy gadgets in the blast take a beating too
    const team = this.hooks.myTeam();
    for (const g of [...this.gadgets.list]) {
      if (g.hp == null || (team >= 0 && g.team === team) || g.owner === this.hooks.me()) continue;
      if (dist(pos, [g.p[0], g.p[1] + 0.8, g.p[2]]) < r + 1.2) this.hooks.gadgetHit(g, dmg);
    }
  }

  // ---------------------------------------------------------------- grenade launcher
  launch(kind, pos, vel, mine, name) {
    const s = HEAVY_STATS[kind];
    this.grenades.push({ kind, pos: [...pos], vel: [...vel], t: 0, mine, name: name || s.name, stuck: null, fuse: s.fuse, col: s.col, spin: 0 });
    this.sounds.launcher?.();
    if (mine) this.hooks.send?.({ t: 'gl', k: kind, p: pos.map((v) => +v.toFixed(2)), v: vel.map((v) => +v.toFixed(2)) });
  }

  detonate(gr, at) {
    const s = HEAVY_STATS[gr.kind];
    this.grenades.splice(this.grenades.indexOf(gr), 1);
    if (!gr.mine) return;             // the owner sends the explosion
    this.boom(at, s.r, s.dmg, gr.name, true, gr.kind === 'gl_fire' ? 'fire' : 'frag');
  }

  updateGrenades(dt) {
    for (const gr of [...this.grenades]) {
      gr.t += dt;
      gr.spin += dt * 20;
      if (gr.stuck) {
        // stuck to something: ride along with it, then go off
        const st = gr.stuck;
        if (st.ref && st.ref.pos) gr.pos = st.ref.pos.map((v, i) => v + st.off[i]);
        gr.fuse -= dt;
        if (Math.floor(gr.fuse * 8) !== Math.floor((gr.fuse + dt) * 8)) this.sounds.click?.(3200, 0.12, 5);
        if (gr.fuse <= 0) this.detonate(gr, gr.pos);
        continue;
      }
      if (gr.t > 6) { this.detonate(gr, gr.pos); continue; }
      gr.vel[1] -= GRAV * dt;
      const step = gr.vel.map((v) => v * dt), l = Math.hypot(...step);
      const dir = norm(step);
      // a direct hit on someone
      let tgHit = null;
      // (checked along the whole step, so a fast grenade can't skip through someone between frames)
      if (gr.mine) for (const tg of this.hooks.targets()) if (segDist(gr.pos, step, tg.chest) < 0.75) { tgHit = tg; break; }
      const hit = tgHit ? null : this.world.raycast(gr.pos, dir, l + 0.05, false);
      if (tgHit || hit) {
        const at = tgHit ? [tgHit.chest[0], tgHit.chest[1] - 0.2, tgHit.chest[2]] : hit.point.map((v, i) => v + hit.normal[i] * 0.06);
        if (gr.kind === 'gl_sticky') {
          const ref = tgHit ? tgHit.ref : (hit.box.tag === 'bot' || hit.box.tag === 'dummy') ? hit.box.ref : null;
          gr.stuck = { ref, off: ref ? at.map((v, i) => v - ref.pos[i]) : null };
          gr.pos = at;
          this.sounds.click?.(1400, 0.4, 3);
          continue;
        }
        if (!gr.mine) { this.grenades.splice(this.grenades.indexOf(gr), 1); continue; }
        this.detonate(gr, at);
        continue;
      }
      for (let k = 0; k < 3; k++) gr.pos[k] += step[k];
      if (Math.random() < dt * 30) this.effects.dust(gr.pos, 1);
    }
  }

  // ---------------------------------------------------------------- fire pools
  updateFires(dt) {
    for (const f of [...this.fires]) {
      f.t -= dt;
      if (f.t <= 0) { this.fires.splice(this.fires.indexOf(f), 1); continue; }
      const n = Math.floor(dt * 70 + Math.random());
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * f.r;
        this.effects.flame([f.pos[0] + Math.cos(a) * rr, f.pos[1] + 0.05, f.pos[2] + Math.sin(a) * rr], [0, 0.8, 0], 1.4 + Math.random() * 1.6);
      }
      if (!f.mine) continue;
      f.tick -= dt;
      if (f.tick > 0) continue;
      f.tick = 0.3;
      for (const tg of this.hooks.targets()) {
        const dx = tg.pos[0] - f.pos[0], dz = tg.pos[2] - f.pos[2];
        if (dx * dx + dz * dz < f.r * f.r && Math.abs(tg.pos[1] - f.pos[1]) < 1.6) this.hooks.ignite(tg.ref, HEAVY_STATS.gl_fire.burn, f.name);
      }
    }
  }

  // ---------------------------------------------------------------- drones
  podOpened(pod) {
    if (pod.owner !== this.hooks.me()) return;          // the owner flies them; others get positions
    const s = HEAVY_STATS[pod.v === 'swarm' ? 'swarmpod' : 'dronepod'];
    for (let k = 0; k < s.drones; k++) {
      const a = (k / s.drones) * Math.PI * 2 + Math.random();
      this.drones.push({
        id: `${this.hooks.me()}-${++did}`, mine: true, kind: s.drones > 1 ? 'mini' : 'frag', s,
        pos: [pod.p[0], pod.p[1] + 0.45, pod.p[2]], vel: [0, 6, 0], phase: 'rise', t: 0, target: null, look: 0,
        drift: s.drones > 1 ? [Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2] : [0, 0, 0], yaw: a, name: s.name,
      });
    }
    this.sounds.drone?.();
  }

  droneBoom(dr) {
    this.drones.splice(this.drones.indexOf(dr), 1);
    if (dr.mine) this.boom(dr.pos, dr.s.r, dr.s.dmg, dr.name, true, dr.kind);
  }

  updateDrones(dt) {
    for (const dr of [...this.drones]) {
      dr.t += dt;
      if (!dr.mine) { if ((dr.stale += dt) > 0.8) this.drones.splice(this.drones.indexOf(dr), 1); else dr.pos = dr.pos.map((v, i) => v + (dr.to[i] - v) * Math.min(1, dt * 12)); continue; }
      if (dr.phase === 'rise') {
        dr.vel = [dr.drift[0], 6 * (1 - dr.t / 0.55), dr.drift[2]];
        if (dr.t > 0.55) { dr.phase = 'seek'; dr.t = 0; }
      } else if (dr.phase === 'seek') {
        // hover and scan; spread out a bit
        dr.vel = [dr.drift[0] * Math.exp(-dr.t), Math.sin(dr.t * 4) * 0.4, dr.drift[2] * Math.exp(-dr.t)];
        dr.yaw += dt * 2.4;
        dr.look -= dt;
        if (dr.look <= 0) {
          dr.look = 0.15;
          const tg = this.nearest(dr.pos, SEE);
          if (tg) { dr.target = tg.ref; dr.phase = 'dive'; dr.t = 0; this.sounds.lock?.(); }
        }
        if (dr.phase === 'seek' && dr.t > SEEK) { this.droneBoom(dr); continue; }
      } else {
        // dive: home in on them
        const tg = this.hooks.targets().find((x) => x.ref === dr.target);
        if (!tg || dr.t > 4) { this.droneBoom(dr); continue; }
        const want = norm([tg.chest[0] - dr.pos[0], tg.chest[1] - dr.pos[1], tg.chest[2] - dr.pos[2]]).map((v) => v * dr.s.speed);
        const k = Math.min(1, dt * 5);
        dr.vel = dr.vel.map((v, i) => v + (want[i] - v) * k);
        dr.yaw = Math.atan2(-dr.vel[0], -dr.vel[2]);
        if (dist(dr.pos, tg.chest) < 1.1) { this.droneBoom(dr); continue; }
      }
      const nxt = dr.pos.map((v, i) => v + dr.vel[i] * dt);
      if (this.world.pointInside(nxt)) { this.droneBoom(dr); continue; }
      dr.pos = nxt;
    }
    // tell everyone else where my drones are
    this.sendT -= dt;
    const mine = this.drones.filter((d) => d.mine);
    if (mine.length && this.sendT <= 0 && this.hooks.send) {
      this.sendT = 0.1;
      this.hooks.send({ t: 'drn', ds: mine.map((d) => [d.id, ...d.pos.map((v) => +v.toFixed(2)), +d.yaw.toFixed(2), d.kind === 'mini' ? 1 : 0]) });
    }
  }

  // ---------------------------------------------------------------- turrets
  updateTurrets(dt) {
    for (const g of this.gadgets.list) {
      if (g.k !== 'tur' || g.t < 0.5) continue;
      const s = HEAVY_STATS[g.v === 'heavy' ? 'turret_heavy' : 'turret_mg'];
      const head = [g.p[0], g.p[1] + 1.18, g.p[2]];
      g.cool = (g.cool ?? 0.6) - dt;
      g.muzzleT = Math.max(0, (g.muzzleT || 0) - dt);
      g.recoil = (g.recoil || 0) * Math.exp(-12 * dt);
      let aimAt = g.aimTo;
      if (g.owner === this.hooks.me()) {
        g.look = (g.look || 0) - dt;
        if (g.look <= 0) {
          g.look = 0.25;
          const tg = this.nearest(head, s.range);
          g.tgRef = tg ? tg.ref : null;
        }
        const tg = g.tgRef && this.hooks.targets().find((x) => x.ref === g.tgRef);
        aimAt = tg ? tg.chest : null;
        if (!tg) g.tgRef = null;
      } else if (g.aimT > 0) g.aimT -= dt; else aimAt = null;
      // turn the head
      let wantYaw = g.yaw + dt * 0.6, wantPitch = 0;
      if (aimAt) {
        const d = [aimAt[0] - head[0], aimAt[1] - head[1], aimAt[2] - head[2]];
        wantYaw = Math.atan2(-d[0], -d[2]);
        wantPitch = Math.atan2(d[1], Math.hypot(d[0], d[2]));
      }
      let dy = wantYaw - g.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      const turn = s.turn * dt;
      g.yaw += Math.max(-turn, Math.min(turn, dy));
      g.pitch += Math.max(-turn, Math.min(turn, wantPitch - g.pitch));
      if (!aimAt || g.owner !== this.hooks.me() || Math.abs(dy) > 0.08 || g.cool > 0) continue;
      // fire
      g.cool = s.rate;
      const f = this.headDir(g);
      const dir = norm(f.map((v) => v + (Math.random() - 0.5) * 2 * s.spread));
      const muzzle = this.muzzle(g, f);
      const hit = this.world.raycast(muzzle, dir, s.range * 1.3, false);
      const end = hit ? hit.point : muzzle.map((v, i) => v + dir[i] * s.range * 1.3);
      if (hit && (hit.box.tag === 'bot' || hit.box.tag === 'dummy') && this.hooks.targets().some((x) => x.ref === hit.box.ref)) {
        this.hooks.hit(hit.box.ref, s.dmg, hit.point, dir, s.name);
      } else if (hit && hit.box.tag !== 'bot') this.effects.impact(hit.point, hit.normal, hit.box.color || [0.8, 0.8, 0.8]);
      this.shotFx(g, muzzle, end, s);
      this.hooks.send?.({ t: 'tsh', gid: g.gid, to: end.map((v) => +v.toFixed(2)) });
    }
  }
  headDir(g) { const cp = Math.cos(g.pitch); return [-Math.sin(g.yaw) * cp, Math.sin(g.pitch), -Math.cos(g.yaw) * cp]; }
  muzzle(g, f) { return [g.p[0] + f[0] * 0.55, g.p[1] + 1.2 + f[1] * 0.55, g.p[2] + f[2] * 0.55]; }
  shotFx(g, muzzle, end, s) {
    this.effects.tracer(muzzle, end);
    g.muzzleT = 0.05; g.recoil = 1;
    if (s === HEAVY_STATS.turret_heavy) { this.sounds.turretHeavy?.(); this.effects.dust(muzzle, 2); } else this.sounds.turret?.();
  }

  // ---------------------------------------------------------------- online: someone else's stuff
  remote(m) {
    if (m.t === 'gl') this.launch(m.k, m.p, m.v, false);
    else if (m.t === 'boom') this.boom(m.p, m.r, 0, '', false, m.k);
    else if (m.t === 'drn') {
      for (const [id, x, y, z, yaw, mini] of m.ds) {
        let d = this.drones.find((q) => q.id === id);
        if (!d) { d = { id, mine: false, pos: [x, y, z], to: [x, y, z], yaw, kind: mini ? 'mini' : 'frag', stale: 0 }; this.drones.push(d); }
        d.to = [x, y, z]; d.yaw = yaw; d.stale = 0;
      }
    } else if (m.t === 'tsh') {
      const g = this.gadgets.byId(m.gid);
      if (!g) return;
      g.aimTo = m.to; g.aimT = 0.6;
      this.shotFx(g, this.muzzle(g, this.headDir(g)), m.to, HEAVY_STATS[g.v === 'heavy' ? 'turret_heavy' : 'turret_mg']);
    }
  }

  update(dt) {
    this.updateGrenades(dt);
    this.updateFires(dt);
    this.updateDrones(dt);
    this.updateTurrets(dt);
  }

  // ---------------------------------------------------------------- drawing
  // a part laid out in a frame: centre + right*x + up*y + fwd*z, oriented along fwd
  static framePart(out, c, f, x, y, z, size, color, extra = {}) {
    const fl = norm(f), ang = anglesFor(fl);
    const r = norm([-fl[2], 0, fl[0]]);
    const u = [r[1] * fl[2] - r[2] * fl[1], r[2] * fl[0] - r[0] * fl[2], r[0] * fl[1] - r[1] * fl[0]];
    const p = [0, 1, 2].map((i) => c[i] + r[i] * x + u[i] * y + fl[i] * z);
    const m = mat4();
    compose(m, p, ang, size);
    out.push({ model: m, scale: size, color, emissive: extra.em || 0, shape: extra.shape, edges: 0, mat: extra.mat });
  }

  parts(out, time) {
    const P = Heavy.framePart;
    // turret heads
    for (const g of this.gadgets.list) {
      if (g.k !== 'tur') continue;
      const grow = Math.min(1, g.t / 0.5);
      const c = [g.p[0], g.p[1] + 0.98 + 0.2 * grow, g.p[2]], f = this.headDir(g), hv = g.v === 'heavy';
      const team = g.teamCol || [1, 0.68, 0.08], rk = -0.06 * (g.recoil || 0);
      P(out, c, f, 0, 0, 0.02, [0.36, 0.26, 0.46], DARK, { mat: 'metal' });
      P(out, c, f, 0, 0.15, 0.02, [0.3, 0.05, 0.36], STEEL, { mat: 'metal' });
      for (const s of [-1, 1]) P(out, c, f, s * 0.19, 0, 0.02, [0.03, 0.2, 0.4], DARK, { mat: 'metal' });
      P(out, c, f, 0.22, -0.03, 0.06, [0.1, 0.16, 0.2], [0.33, 0.35, 0.24], { mat: 'paint' });   // ammo box
      P(out, c, f, 0, 0.06, -0.24, [0.24, 0.04, 0.02], team, { em: 1 });                          // eye strip
      P(out, c, f, 0, 0.0, -0.235, [0.08, 0.08, 0.01], [1, 0.2, 0.1], { em: 0.6 + 0.4 * Math.sin(time * 10) });
      if (hv) {
        P(out, c, f, 0, -0.04, -0.42 + rk, [0.07, 0.07, 0.44], DARK, { shape: 'cyl', mat: 'metal' });
        P(out, c, f, 0, -0.04, -0.66 + rk, [0.11, 0.09, 0.08], STEEL, { mat: 'metal' });
      } else {
        for (const s of [-1, 1]) P(out, c, f, s * 0.05, -0.05, -0.38 + rk, [0.035, 0.035, 0.34], DARK, { shape: 'cyl', mat: 'metal' });
        P(out, c, f, 0, -0.05, -0.3, [0.14, 0.05, 0.05], STEEL, { mat: 'metal' });
      }
      if (g.muzzleT > 0) P(out, c, f, 0, -0.04, hv ? -0.78 : -0.6, [0.14, 0.14, 0.14], [1, 0.75, 0.3], { em: 1, shape: 'sphere' });
    }
    // drones: a flat body, four rotors, a red eye that goes solid when it locks on
    for (const d of this.drones) {
      const mini = d.kind === 'mini', k = mini ? 0.65 : 1;
      const f = [-Math.sin(d.yaw), 0, -Math.cos(d.yaw)];
      P(out, d.pos, f, 0, 0, 0, [0.22 * k, 0.07 * k, 0.26 * k], DARK, { mat: 'metal' });
      P(out, d.pos, f, 0, -0.05 * k, 0.02, [0.12 * k, 0.05 * k, 0.12 * k], [0.33, 0.35, 0.24], { mat: 'paint' });
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        P(out, d.pos, f, x * 0.15 * k, 0, z * 0.15 * k, [0.1 * k, 0.02 * k, 0.03 * k], DARK);
        P(out, d.pos, f, x * 0.2 * k, 0.04 * k, z * 0.2 * k, [0.17 * k, 0.006, 0.17 * k], [0.5, 0.5, 0.55], { shape: 'cylY' });
      }
      const lock = d.phase === 'dive' || !d.mine;
      P(out, d.pos, f, 0, 0, -0.14 * k, [0.05 * k, 0.03 * k, 0.012], RED, { em: lock ? 1 : 0.4 + 0.6 * (Math.sin(time * 20) > 0 ? 1 : 0) });
    }
    // grenades
    for (const gr of this.grenades) {
      const f = gr.stuck ? [0, 0, -1] : gr.vel;
      P(out, gr.pos, f, 0, 0, 0, [0.07, 0.07, 0.11], DARK, { shape: 'cyl', mat: 'metal' });
      P(out, gr.pos, f, 0, 0, -0.06, [0.072, 0.072, 0.02], gr.col || [0.5, 0.5, 0.5], { shape: 'cyl', em: gr.stuck ? (Math.sin(time * 30) > 0 ? 1 : 0.2) : 0.3 });
    }
    void ropeSeg;
  }
}
