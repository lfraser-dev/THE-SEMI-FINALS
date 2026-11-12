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
import { ropeSeg, ropeParts, TETHER_COL } from './gadgets.js';

export const HEAVY_STATS = {
  dronepod: { cd: 18, drones: 1, dmg: 90, r: 3.6, speed: 15, name: 'DRONE POD' },
  swarmpod: { cd: 20, drones: 3, dmg: 40, r: 2.6, speed: 17, name: 'SWARM POD' },
  gl_frag: { cd: 9, dmg: 85, r: 4, name: 'FRAG LAUNCHER', col: [0.36, 0.42, 0.22] },
  gl_sticky: { cd: 11, dmg: 110, r: 3.6, fuse: 1.2, name: 'STICKY LAUNCHER', col: [1, 0.78, 0.1] },
  gl_fire: { cd: 13, dmg: 30, r: 3.5, fire: 5, burn: { dps: 15, dur: 2 }, name: 'FIREBOMB LAUNCHER', col: [1, 0.35, 0.05] },
  tether: { name: 'TETHER LAUNCHER', col: TETHER_COL, grav: 0.35 },
  gl_cluster: { cd: 12, dmg: 20, r: 2.2, name: 'CLUSTER LAUNCHER', col: [0.25, 0.6, 1], bomblets: 5 },
  bomblet: { dmg: 35, r: 2.5, name: 'CLUSTER LAUNCHER', col: [0.25, 0.6, 1], fuse: 0.9 },
  mines: { cd: 20, dmg: 70, r: 3.2, trig: 2.2, name: 'PROXIMITY MINES' },
  turret_mg: { cd: 24, range: 30, rate: 0.12, dmg: 8, spread: 0.035, turn: 7, name: 'MG TURRET', reach: 0.7 },
  turret_heavy: { cd: 28, range: 45, rate: 1.1, dmg: 45, spread: 0.006, turn: 3.5, name: 'CANNON TURRET', reach: 0.86 },
  turret_flame: { cd: 26, range: 12, rate: 0.08, dmg: 3, cone: 0.28, turn: 5, name: 'FLAME TURRET', reach: 0.6, burn: { dps: 14, dur: 2.5 } },
};

const DARK = [0.16, 0.16, 0.18], STEEL = [0.45, 0.46, 0.5], RED = [1, 0.15, 0.1], BLACK = [0.08, 0.08, 0.09], OLIVE = [0.33, 0.35, 0.24], BRASS = [0.8, 0.62, 0.28];
const turretStats = (g) => HEAVY_STATS[g.v === 'heavy' ? 'turret_heavy' : g.v === 'flame' ? 'turret_flame' : 'turret_mg'];
const GRAV = 14, SEEK = 5, SEE = 32;
// TETHER LAUNCHER (Light ability): a bolt that ties whoever it hits to the nearest wall or floor; one that hits a surface
// sets itself as a trap and snags the first enemy to come close
export const TETHER = { len: 1.8, dur: 4, trapR: 2.4, trapLife: 20, cd: 9, dmg: 10 };
const notPeople = (b) => b.tag === 'bot' || b.tag === 'dummy';

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
    this.tethers = [];     // { ref | remoteId | me, anchor, len, t }
    this.traps = [];       // { id, pos, normal, t, mine }
    this.sendT = 0;
    gadgets.onPodOpen = (pod) => this.podOpened(pod);
  }

  clear() { this.grenades.length = 0; this.drones.length = 0; this.fires.length = 0; this.tethers.length = 0; this.traps.length = 0; }

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
    this.boom(at, s.r, s.dmg, gr.name, true, gr.kind === 'gl_fire' ? 'fire' : gr.kind === 'bomblet' || gr.kind === 'gl_cluster' ? 'mini' : 'frag');
    if (gr.kind === 'gl_cluster') {
      // five bomblets thrown out in a ring
      for (let k = 0; k < s.bomblets; k++) {
        const a = (k / s.bomblets) * Math.PI * 2 + Math.random() * 0.6, sp = 3.5 + Math.random() * 3;
        this.launch('bomblet', [at[0], at[1] + 0.35, at[2]], [Math.cos(a) * sp, 4 + Math.random() * 2.5, Math.sin(a) * sp], true, s.name);
      }
    }
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
      if (gr.t > 6 || (gr.kind === 'bomblet' && gr.t > gr.fuse)) { if (gr.mine) this.detonate(gr, gr.pos); else this.grenades.splice(this.grenades.indexOf(gr), 1); continue; }
      gr.vel[1] -= GRAV * (HEAVY_STATS[gr.kind].grav ?? 1) * dt;
      const step = gr.vel.map((v) => v * dt), l = Math.hypot(...step);
      const dir = norm(step);
      // a direct hit on someone
      let tgHit = null;
      // (checked along the whole step, so a fast grenade can't skip through someone between frames)
      if (gr.mine) for (const tg of this.hooks.targets()) if (segDist(gr.pos, step, tg.chest) < 0.75) { tgHit = tg; break; }
      const hit = tgHit ? null : this.world.raycast(gr.pos, dir, l + 0.05, false);
      if (tgHit || hit) {
        const at = tgHit ? [tgHit.chest[0], tgHit.chest[1] - 0.2, tgHit.chest[2]] : hit.point.map((v, i) => v + hit.normal[i] * 0.06);
        if (gr.kind === 'tether') {
          this.grenades.splice(this.grenades.indexOf(gr), 1);
          if (!gr.mine) continue;
          const person = tgHit || ((hit.box.tag === 'bot' || hit.box.tag === 'dummy') && this.hooks.targets().find((x) => x.ref === hit.box.ref));
          if (person) this.tetherTarget(person, null, gr.name);
          else this.setTrap(hit.point.map((v, i) => v + hit.normal[i] * 0.03), hit.normal, true);
          continue;
        }
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
      if (gr.kind !== 'tether' && Math.random() < dt * 30) this.effects.dust(gr.pos, 1);
    }
  }

  // ---------------------------------------------------------------- tethers
  // the closest wall or floor to someone (down, or out to the sides), ignoring people
  anchorFor(pos) {
    const from = [pos[0], pos[1] + 0.7, pos[2]];
    let best = null;
    for (const d of [[0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
      const h = this.world.raycast(from, d, d[1] ? 2.2 : 3.2, false, notPeople);
      if (h && (!best || h.t < best.t)) best = h;
    }
    return best ? best.point.map((v, i) => v + best.normal[i] * 0.03) : [pos[0], pos[1], pos[2]];
  }
  tetherTarget(tg, anchor, name) {
    const a = anchor || this.anchorFor(tg.pos);
    this.tethers = this.tethers.filter((t) => t.ref !== tg.ref);
    this.tethers.push({ ref: tg.ref, anchor: a, len: TETHER.len, t: TETHER.dur, max: TETHER.dur });
    this.sounds.tether?.();
    this.effects.impact(a, [0, 1, 0], [1, 0.55, 0.15]);
    this.hooks.hit(tg.ref, TETHER.dmg, tg.chest, [0, 0, 0], name || 'TETHER');
    this.hooks.onTether?.(tg.ref, a, TETHER.len, TETHER.dur);
  }
  setTrap(pos, normal, mine, id) {
    const tr = { id: id || `${this.hooks.me()}-t${++did}`, pos: [...pos], normal: [...normal], t: TETHER.trapLife, mine };
    this.traps.push(tr);
    this.sounds.click?.(1600, 0.4, 3);
    if (mine) this.hooks.send?.({ t: 'trap', tid: tr.id, p: pos.map((v) => +v.toFixed(2)), n: normal });
  }
  // a tether someone else's game told us about (we're drawing it; if it's us, main.js holds us)
  addTether(t) { this.tethers = this.tethers.filter((x) => (t.me ? !x.me : x.remoteId !== t.remoteId)); this.tethers.push({ ...t, max: t.t }); this.sounds.tether?.(); }
  updateTethers(dt) {
    for (const tr of [...this.traps]) {
      tr.t -= dt;
      let gone = tr.t <= 0;
      if (!gone && tr.mine) {
        const tg = this.hooks.targets().find((x) => dist(x.pos, tr.pos) < TETHER.trapR || dist(x.chest, tr.pos) < TETHER.trapR);
        if (tg) { this.tetherTarget(tg, tr.pos, 'TETHER TRAP'); gone = true; this.hooks.send?.({ t: 'trapgone', tid: tr.id }); }
      }
      if (gone) this.traps.splice(this.traps.indexOf(tr), 1);
    }
    for (const t of [...this.tethers]) {
      t.t -= dt;
      const pos = t.me ? this.hooks.playerPos() : t.ref ? t.ref.pos : t.remoteId ? this.hooks.remotePos?.(t.remoteId) : null;
      if (t.t <= 0 || !pos || (t.ref && !t.ref.alive)) { this.tethers.splice(this.tethers.indexOf(t), 1); continue; }
      // hold bots (and dummies) within the line's length of the anchor
      if (t.ref) {
        t.ref.held = 0.2;                     // range dummies stop walking their line
        const dx = pos[0] - t.anchor[0], dz = pos[2] - t.anchor[2], d = Math.hypot(dx, dz);
        if (d > t.len) { pos[0] = t.anchor[0] + (dx / d) * t.len; pos[2] = t.anchor[2] + (dz / d) * t.len; t.ref.place?.(); }
      }
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
      const s = turretStats(g);
      const head = [g.p[0], g.p[1] + 1.16, g.p[2]];
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
      } else if (g.aimT > 0) {
        g.aimT -= dt;
        if (g.v === 'flame' && g.cool <= 0) { g.cool = s.rate; this.shotFx(g, this.muzzle(g, this.headDir(g)), g.aimTo, s); }
      } else aimAt = null;
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
      const muzzle = this.muzzle(g, f);
      if (g.v === 'flame') {
        // a hose of fire: everyone in the cone it can reach gets scorched and set alight
        for (const tg of this.hooks.targets()) {
          const d = [tg.chest[0] - muzzle[0], tg.chest[1] - muzzle[1], tg.chest[2] - muzzle[2]], l = Math.hypot(...d);
          if (l > s.range || (d[0] * f[0] + d[1] * f[1] + d[2] * f[2]) / l < Math.cos(s.cone) || !this.sees(muzzle, tg)) continue;
          this.hooks.hit(tg.ref, s.dmg, tg.chest, f, s.name);
          this.hooks.ignite(tg.ref, s.burn, s.name);
        }
        const end = muzzle.map((v, i) => v + f[i] * s.range);
        this.shotFx(g, muzzle, end, s);
        if ((g.sendT = (g.sendT || 0) - 1) <= 0) { g.sendT = 3; this.hooks.send?.({ t: 'tsh', gid: g.gid, to: end.map((v) => +v.toFixed(2)) }); }
        continue;
      }
      const dir = norm(f.map((v) => v + (Math.random() - 0.5) * 2 * s.spread));
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
  muzzle(g, f) { const L = turretStats(g).reach; return [g.p[0] + f[0] * L, g.p[1] + 1.13 + f[1] * L, g.p[2] + f[2] * L]; }
  shotFx(g, muzzle, end, s) {
    if (s === HEAVY_STATS.turret_flame) {
      const f = norm([end[0] - muzzle[0], end[1] - muzzle[1], end[2] - muzzle[2]]);
      for (let k = 0; k < 4; k++) {
        const sp = 9 + Math.random() * 8, j = () => (Math.random() - 0.5) * 2.4;
        this.effects.flame(muzzle, [f[0] * sp + j(), f[1] * sp + j(), f[2] * sp + j()], 1.4 + Math.random());
      }
      g.muzzleT = 0.08;
      if (Math.random() < 0.3) this.sounds.ignite?.();
      return;
    }
    this.effects.tracer(muzzle, end);
    g.muzzleT = 0.05; g.recoil = 1;
    g.barrel = ((g.barrel || 0) + 1) % 2;
    if (s === HEAVY_STATS.turret_heavy) { this.sounds.turretHeavy?.(); this.effects.dust(muzzle, 2); } else this.sounds.turret?.();
  }

  // ---------------------------------------------------------------- online: someone else's stuff
  remote(m) {
    if (m.t === 'gl') this.launch(m.k, m.p, m.v, false);
    else if (m.t === 'boom') this.boom(m.p, m.r, 0, '', false, m.k);
    else if (m.t === 'trap') this.setTrap(m.p, m.n, false, m.tid);
    else if (m.t === 'gdel') { const g = this.gadgets.byId(m.gid); if (g) this.gadgets.remove(g, false); }
    else if (m.t === 'trapgone') this.traps = this.traps.filter((t) => t.id !== m.tid);
    else if (m.t === 'teth') {
      if (m.who === this.hooks.me()) { this.hooks.tetherMe?.(m.a, m.len, m.dur); this.addTether({ me: true, anchor: m.a, len: m.len, t: m.dur }); }
      else this.addTether({ remoteId: m.who, anchor: m.a, len: m.len, t: m.dur });
    }
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
      g.aimT = g.v === 'flame' ? 0.3 : 0.6;
      this.shotFx(g, this.muzzle(g, this.headDir(g)), m.to, turretStats(g));
    }
  }

  // proximity mines: the owner's game sets them off when an enemy steps close
  updateMines() {
    for (const g of [...this.gadgets.list]) {
      if (g.k !== 'mine' || g.owner !== this.hooks.me() || g.t < 1) continue;
      const s = HEAVY_STATS.mines, at = [g.p[0], g.p[1] + 0.2, g.p[2]];
      if (!this.hooks.targets().some((x) => dist(x.pos, at) < s.trig || dist(x.chest, at) < s.trig)) continue;
      this.gadgets.remove(g, false);
      this.hooks.send?.({ t: 'gdel', gid: g.gid });
      this.sounds.lock?.();
      this.boom(at, s.r, s.dmg, s.name, true, 'frag');
    }
  }

  update(dt) {
    this.updateMines();
    this.updateGrenades(dt);
    this.updateTethers(dt);
    this.updateFires(dt);
    this.updateDrones(dt);
    this.updateTurrets(dt);
  }

  // ---------------------------------------------------------------- drawing
  // a part laid out in a frame looking along f: centre + right*x + up*y + back*z (so -z is forward, as on the guns),
  // oriented along f
  static framePart(out, c, f, x, y, z, size, color, extra = {}) {
    const fl = norm(f), ang = anglesFor(fl);
    const r = norm([-fl[2], 0, fl[0]]);
    const u = [r[1] * fl[2] - r[2] * fl[1], r[2] * fl[0] - r[0] * fl[2], r[0] * fl[1] - r[1] * fl[0]];
    const p = [0, 1, 2].map((i) => c[i] + r[i] * x + u[i] * y - fl[i] * z);
    const m = mat4();
    compose(m, p, ang, size);
    out.push({ model: m, scale: size, color, emissive: extra.em || 0, shape: extra.shape, edges: 0, mat: extra.mat });
  }

  parts(out, time) {
    const P = Heavy.framePart;
    // turrets: splayed legs, a yoke that turns, and an armoured gun that tilts, all pointing where it shoots
    for (const g of this.gadgets.list) {
      if (g.k !== 'tur') continue;
      const grow = Math.min(1, g.t / 0.5), team = g.teamCol || [1, 0.68, 0.08];
      const base = g.p, top = [base[0], base[1] + 0.45 * grow, base[2]];
      for (let k = 0; k < 3; k++) {
        const a = (g.spec0 ?? (g.spec0 = g.yaw)) + Math.PI + (k - 1) * 2.1, foot = [base[0] + Math.cos(a) * 0.6, base[1] + 0.02, base[2] + Math.sin(a) * 0.6];
        const knee = [base[0] + Math.cos(a) * 0.36, base[1] + 0.3 * grow, base[2] + Math.sin(a) * 0.36];
        ropeSeg(out, top, knee, 0.055, DARK);
        ropeSeg(out, knee, foot, 0.045, DARK);
        P(out, foot, [0, 0, -1], 0, 0, 0, [0.13, 0.035, 0.13], BLACK, { mat: 'rubber' });
        ropeSeg(out, knee, [base[0] + Math.cos(a) * 0.36, base[1] + 0.3 * grow - 0.06, base[2] + Math.sin(a) * 0.36], 0.07, STEEL);
      }
      if (grow < 1) continue;
      const fy = [-Math.sin(g.yaw), 0, -Math.cos(g.yaw)], f = this.headDir(g);
      const c0 = [base[0], base[1] + 1.0, base[2]], c = [base[0], base[1] + 1.16, base[2]];
      const rk = 0.06 * (g.recoil || 0), v = g.v;
      // the yoke: a plate and two arms holding the gun's trunnions
      P(out, c0, fy, 0, 0.02, 0, [0.38, 0.04, 0.34], DARK, { mat: 'metal' });
      for (const s of [-1, 1]) {
        P(out, c, fy, s * 0.205, -0.05, 0.02, [0.04, 0.2, 0.17], STEEL, { mat: 'metal' });
        P(out, c, fy, s * 0.232, 0, 0.02, [0.016, 0.08, 0.08], DARK, { mat: 'metal' });
      }
      // the gun housing: body, top and side armour (with the team stripe), a sloped front plate, vents, a sensor
      P(out, c, f, 0, 0, 0.04, [0.32, 0.2, 0.44], DARK, { mat: 'metal' });
      P(out, c, f, 0, 0.115, 0.0, [0.3, 0.03, 0.42], STEEL, { mat: 'metal' });
      for (const s of [-1, 1]) {
        P(out, c, f, s * 0.17, 0, 0.04, [0.02, 0.19, 0.42], STEEL, { mat: 'metal' });
        P(out, c, f, s * 0.181, 0.05, 0.04, [0.004, 0.03, 0.34], team, { em: 0.8 });
      }
      P(out, c, f, 0, 0.02, -0.2, [0.34, 0.25, 0.03], STEEL, { mat: 'metal' });
      P(out, c, f, 0, 0.1, -0.205, [0.3, 0.05, 0.032], team, { em: 0.35 });
      for (let k = 0; k < 4; k++) P(out, c, f, 0, -0.06 + k * 0.035, 0.265, [0.26, 0.012, 0.012], BLACK);
      P(out, c, f, 0.09, 0.16, -0.08, [0.07, 0.06, 0.09], DARK, { mat: 'metal' });
      P(out, c, f, 0.09, 0.16, -0.126, [0.045, 0.045, 0.006], RED, { em: 0.6 + 0.4 * Math.sin(time * 9), shape: 'cyl' });
      P(out, c, f, -0.1, 0.22, 0.12, [0.012, 0.12, 0.012], BLACK);
      P(out, c, f, -0.1, 0.285, 0.12, [0.025, 0.012, 0.025], team, { em: 1 });
      if (v === 'heavy') {
        // cannon: one big barrel through a recoil sleeve, a slotted muzzle brake, a shell box
        P(out, c, f, 0, -0.03, -0.5 + rk, [0.075, 0.075, 0.56], BLACK, { shape: 'cyl', mat: 'metal' });
        P(out, c, f, 0, -0.03, -0.27 + rk * 0.4, [0.12, 0.12, 0.13], DARK, { shape: 'cyl', mat: 'metal' });
        P(out, c, f, 0, -0.03, -0.8 + rk, [0.14, 0.09, 0.11], STEEL, { mat: 'metal' });
        for (const s of [-1, 1]) P(out, c, f, s * 0.071, -0.03, -0.8 + rk, [0.004, 0.06, 0.06], BLACK);
        P(out, c, f, 0.25, -0.04, 0.06, [0.11, 0.18, 0.26], OLIVE, { mat: 'paint' });
        if (g.muzzleT > 0) P(out, c, f, 0, -0.03, -0.92, [0.24, 0.24, 0.24], [1, 0.75, 0.3], { em: 1, shape: 'sphere' });
      } else if (v === 'flame') {
        // flamer: a nozzle with a flickering pilot light, a hose, two red fuel tanks on the back
        P(out, c, f, 0, -0.03, -0.37, [0.065, 0.065, 0.32], DARK, { shape: 'cyl', mat: 'metal' });
        P(out, c, f, 0, -0.03, -0.55, [0.09, 0.09, 0.05], [0.55, 0.35, 0.18], { shape: 'cyl', mat: 'metal' });
        P(out, c, f, 0, 0.035, -0.52, [0.03, 0.03, 0.03], [1, 0.55, 0.12], { em: 0.6 + 0.4 * Math.random(), shape: 'sphere' });
        for (const s of [-1, 1]) {
          P(out, c, f, s * 0.09, 0.0, 0.36, [0.11, 0.11, 0.3], [0.75, 0.12, 0.08], { shape: 'cyl', mat: 'paint' });
          P(out, c, f, s * 0.09, 0.0, 0.52, [0.04, 0.04, 0.03], DARK, { shape: 'cyl', mat: 'metal' });
        }
        P(out, c, f, 0, -0.1, -0.05, [0.03, 0.03, 0.4], BLACK, { shape: 'cyl', mat: 'rubber' });
      } else {
        // MG: twin barrels with perforated shrouds, a side ammo box and a brass belt into the feed
        for (const s of [-1, 1]) {
          const r2 = g.barrel === (s > 0 ? 1 : 0) ? rk : 0;
          P(out, c, f, s * 0.055, -0.03, -0.43 + r2, [0.03, 0.03, 0.42], BLACK, { shape: 'cyl', mat: 'metal' });
          P(out, c, f, s * 0.055, -0.03, -0.3 + r2 * 0.5, [0.052, 0.052, 0.17], DARK, { shape: 'cyl', mat: 'metal' });
          P(out, c, f, s * 0.055, -0.03, -0.645 + r2, [0.042, 0.042, 0.03], STEEL, { shape: 'cyl', mat: 'metal' });
          if (g.muzzleT > 0 && g.barrel === (s > 0 ? 1 : 0)) P(out, c, f, s * 0.055, -0.03, -0.72, [0.12, 0.12, 0.12], [1, 0.75, 0.3], { em: 1, shape: 'sphere' });
        }
        P(out, c, f, 0.26, -0.06, 0.06, [0.12, 0.16, 0.22], OLIVE, { mat: 'paint' });
        P(out, c, f, 0.2, 0.0, -0.03, [0.05, 0.02, 0.12], BRASS, { mat: 'metal' });
      }
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
    // tether lines: from the waist to a spike in the wall or floor
    for (const t of this.tethers) {
      const pos = t.me ? this.hooks.playerPos() : t.ref ? t.ref.pos : this.hooks.remotePos?.(t.remoteId);
      if (!pos) continue;
      const w = [pos[0], pos[1] + 0.95, pos[2]], taut = Math.min(1, dist(w, t.anchor) / (t.len + 1));
      out.push(...ropeParts(w, t.anchor, { sag: 0.25 * (1 - taut), wave: t.max - t.t < 0.3 ? 0.15 : 0, t: time, thick: 0.03, accent: TETHER_COL }));
      P(out, t.anchor, [0, 1, 0.001], 0, 0, 0, [0.09, 0.09, 0.09], DARK, { shape: 'sphere', mat: 'metal' });
      P(out, w, [0, 0, -1], 0, 0, 0, [0.22, 0.05, 0.22], TETHER_COL, { em: 0.6 + 0.4 * Math.sin(time * 12), shape: 'cylY' });
    }
    for (const tr of this.traps) {
      P(out, tr.pos, tr.normal, 0, 0, 0, [0.12, 0.12, 0.06], DARK, { shape: 'cyl', mat: 'metal' });
      P(out, tr.pos, tr.normal, 0, 0, -0.035, [0.08, 0.08, 0.012], TETHER_COL, { em: 0.5 + 0.5 * (Math.sin(time * 6) > 0 ? 1 : 0), shape: 'cyl' });
    }
    // grenades (and tether bolts)
    for (const gr of this.grenades) {
      if (gr.kind === 'tether') {
        P(out, gr.pos, gr.vel, 0, 0, 0, [0.035, 0.035, 0.22], DARK, { shape: 'cyl', mat: 'metal' });
        for (const s of [-1, 1]) P(out, gr.pos, gr.vel, s * 0.03, 0, 0.1, [0.04, 0.008, 0.05], TETHER_COL, { em: 0.8 });
        continue;
      }
      const f = gr.stuck ? [0, 0, -1] : gr.vel;
      if (gr.kind === 'bomblet') { P(out, gr.pos, f, 0, 0, 0, [0.06, 0.06, 0.06], gr.col, { shape: 'sphere', em: Math.sin(time * 40) > 0 ? 0.9 : 0.2 }); continue; }
      P(out, gr.pos, f, 0, 0, 0, [0.07, 0.07, 0.11], DARK, { shape: 'cyl', mat: 'metal' });
      P(out, gr.pos, f, 0, 0, -0.06, [0.072, 0.072, 0.02], gr.col || [0.5, 0.5, 0.5], { shape: 'cyl', em: gr.stuck ? (Math.sin(time * 30) > 0 ? 1 : 0.2) : 0.3 });
    }
    void ropeSeg;
  }
}
