// Team deathmatch for the semi-finals: two teams of four (you and three AI teammates against four AI
// enemies). Every elimination scores a point for the other team; the first team to 10 wins and advances.
// Everyone respawns at their team's end a few seconds after going down.
import { Bot, teamPalette } from './bots.js';
import { Nav } from './nav.js';
import { compose, mat4, clamp } from './math.js';

export const GOAL = 10;
const BOT_RESPAWN = 4;
const MAGS = { rifle: 30, rusher: 32, heavy: 60 };
const INTEL_TTL = 9;       // seconds a sighting / sound stays useful
const TYPE_OF = { light: 'rusher', medium: 'rifle', heavy: 'heavy' };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

// ---------------------------------------------------------------- one AI contestant
export class Agent {
  constructor(co, team, info, slot) {
    Object.assign(this, { co, team, name: info.name, cls: info.cls, slot });
    this.isPlayer = false;
    this.respawnT = 0;
    this.spawnBot();
  }

  spawnBot() {
    // line up across the spawn zone, a step behind its centre (where the player stands)
    const sp = this.team.spawn, a = (this.slot - 1.5) * 2.6 + (Math.random() - 0.5) * 0.6;
    const fwd = [-Math.sin(sp.yaw), -Math.cos(sp.yaw)], side = [fwd[1], -fwd[0]];
    const pos = [sp.pos[0] + side[0] * a - fwd[0] * 1.6, sp.pos[1], sp.pos[2] + side[1] * a - fwd[1] * 1.6];
    if (this.bot && !this.bot.removed) this.bot.remove();
    const b = new Bot(this.co.world, TYPE_OF[this.cls] || 'rifle', pos, sp.yaw, 0);
    b.state = 'wait'; b.landed = true; b.dropT = 1;
    b.name = this.name;
    b.pal = teamPalette(this.team.rgb);
    b.team = this.team.idx;
    b.agent = this;
    b.place();
    this.bot = b;
    this.path = null; this.pi = 0; this.goal = null; this.goalT = 0; this.repathT = 0;
    this.target = null; this.targetT = 0; this.los = false;
    this.burst = 0; this.shotCd = 0; this.pauseCd = 0.5 + Math.random();
    this.stuckT = 0; this.lastPos = [...pos];
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.dead = false;
    this.mag = MAGS[TYPE_OF[this.cls] || 'rifle']; this.ammo = this.mag; this.reloadT = 0;
    // a role for the squad: two push the middle, one flanks each side; heavies like to hold high ground
    this.role = this.cls === 'heavy' && this.co.map.nav.levels.length > 1 ? 'anchor' : ['push', 'flankL', 'push', 'flankR'][this.slot % 4];
    this.facing = null;     // where I'm watching (last known enemy position), for pre-aiming
  }

  get pos() { return this.bot.pos; }
  get alive() { return this.bot.alive; }
  eye() { return this.bot.eye(); }
  get hpFrac() { return this.bot.hp / this.bot.maxHp; }

  // the animation bookkeeping Bot.update normally does
  animate(dt) {
    const b = this.bot;
    b.flash -= dt; b.muzzleT -= dt;
    b.recoil *= Math.exp(-16 * dt); b.flinch *= Math.exp(-7 * dt); b.landK *= Math.exp(-3.5 * dt);
    b.breath += dt;
    const vx = (b.pos[0] - b.lastPos[0]) / Math.max(dt, 1e-4), vz = (b.pos[2] - b.lastPos[2]) / Math.max(dt, 1e-4);
    b.lastPos = [...b.pos];
    const cy = Math.cos(b.yaw), sy = Math.sin(b.yaw);
    const lx = cy * vx - sy * vz, lz = sy * vx + cy * vz;
    b.localVel[0] += (lx - b.localVel[0]) * Math.min(1, dt * 10);
    b.localVel[1] += (lz - b.localVel[1]) * Math.min(1, dt * 10);
  }

  update(dt, g) {
    const co = this.co, b = this.bot;
    if (!b.alive) {
      if (!this.dead) {
        this.dead = true;
        this.respawnT = BOT_RESPAWN;
        co.onDeath(this);
      }
      if (b.dying >= 0) {
        b.dying += dt; b.flash -= dt;
        if (b.dying > 0.75 && !b.shattered) { b.shattered = true; b.remove(); b.removed = true; g.onShatter?.(b); }
      }
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.spawnBot();
      return;
    }
    this.animate(dt);

    // ---- health: hurt recently? heal up after 5 s out of the fight
    if (this.lastHp == null) this.lastHp = b.hp;
    if (b.hp < this.lastHp - 0.01) this.hurtT = 0; else this.hurtT = (this.hurtT ?? 9) + dt;
    if (this.hurtT > 5 && b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + 30 * dt);
    this.lastHp = b.hp;
    // ---- what am I doing? (badly hurt: fall back to my team to heal)
    this.goalT -= dt;
    if (this.goalT <= 0) {
      this.goalT = 0.4 + Math.random() * 0.3;
      const ng = this.hpFrac < 0.3 && this.hurtT < 6 ? co.retreatGoal(this) : co.goalFor(this);
      if (!this.goal || !ng || dist2(ng.pos, this.goal.pos) > 2.5 || Math.abs(ng.pos[1] - this.goal.pos[1]) > 1 || ng.mode !== this.goal.mode) { this.goal = ng; this.repathT = 0; }
      else this.goal.pos = ng.pos;
    }
    this.repathT -= dt;
    if (this.goal && this.repathT <= 0) {
      this.repathT = 2 + Math.random();
      const nav = co.nav;
      const a = nav.nearest(b.pos), z = nav.nearest(this.goal.pos);
      this.path = nav.path(a, z);
      this.pi = 0;
      this.seg = null;
    }

    // ---- reloading: a few seconds to top up, spent getting into cover
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) this.ammo = this.mag; }

    // ---- who am I shooting? the closest threat I can see (sticking with my current target, finishing off the wounded,
    //      helping a teammate who's already on someone). Anything I see gets called out to the team.
    this.targetT -= dt;
    if (this.targetT <= 0) {
      this.targetT = 0.22 + Math.random() * 0.12;
      const prev = this.target;
      this.target = null;
      let best = 1e9;
      for (const e of co.entities()) {
        if (e.team === this.team || !e.alive) continue;
        const d = Math.hypot(e.pos[0] - b.pos[0], e.pos[1] - b.pos[1], e.pos[2] - b.pos[2]);
        if (d > 48 || (e.cloaked && d > 4)) continue;          // a cloaked player is invisible unless right up close
        let score = d;
        if (e === prev) score -= 6;                                  // stick with a target
        if (!e.isPlayer && e.hpFrac < 0.4) score -= 5;                // finish off the wounded
        if (score > best) continue;
        if (co.focus(this.team) === e) score -= 4;                     // focus fire
        if (!b.canSee(b.eye(), e.eye(), e.isPlayer ? null : e.bot)) continue;
        best = score; this.target = e;
      }
      if (this.target) co.spot(this.team, this.target, this.target.pos, true);
      if (this.target !== prev && this.target) {
        // quicker on the draw if they show up where I was already watching
        let react = 0.22 + Math.random() * 0.3;
        if (this.facing) {
          const a1 = Math.atan2(this.facing[0] - b.pos[0], this.facing[2] - b.pos[2]), a2 = Math.atan2(this.target.pos[0] - b.pos[0], this.target.pos[2] - b.pos[2]);
          let da = Math.abs(a1 - a2); if (da > Math.PI) da = 2 * Math.PI - da;
          if (da < 0.35) react *= 0.45;
        }
        this.react = react; this.track = 0; this.cover = null;
      } else if (!this.target) this.cover = null;
    }
    const tgt = this.target && this.target.alive ? this.target : null;
    const tDist = tgt ? Math.hypot(tgt.pos[0] - b.pos[0], tgt.pos[2] - b.pos[2]) : 0;
    this.react = Math.max(0, (this.react || 0) - dt);
    this.track = tgt ? Math.min(1.5, (this.track || 0) + dt) : 0;

    // ---- move: follow the path; in a fight, duck into cover between bursts and strafe while shooting
    const [, hi] = b.t.range;
    let speed = b.t.speed;
    let moved = 0;
    const atGoal = this.goal && dist2(b.pos, this.goal.pos) < (this.goal.r || 1.2) && Math.abs(b.pos[1] - this.goal.pos[1]) < 1.5;
    const stepTo = (tx, tz, sp) => {
      const dx = tx - b.pos[0], dz = tz - b.pos[2], l = Math.hypot(dx, dz);
      if (l < 0.05) return 0;
      const st = Math.min(l, sp * dt);
      const nx = [b.pos[0] + dx / l * st, b.pos[1], b.pos[2] + dz / l * st];
      if (b.blocked(nx) || !co.world.firstOverlap([nx[0] - 0.08, nx[1] - 0.12, nx[2] - 0.08], [nx[0] + 0.08, nx[1] - 0.03, nx[2] + 0.08])) return -1;
      b.pos[0] = nx[0]; b.pos[2] = nx[2];
      return st;
    };
    if (tgt && tDist < hi * 1.5) {
      const wantCover = this.pauseCd > 0.35 || this.hpFrac < 0.5 || this.reloadT > 0;
      // heavies throw up a barricade when they're taking a beating with nowhere to hide
      this.barCd = (this.barCd ?? 3) - dt;
      if (wantCover && this.cls === 'heavy' && this.barCd <= 0 && this.hpFrac < 0.75 && tDist > 5 && g.barricade) {
        this.barCd = g.barricade(this, tgt) ? 20 : 2;
      }
      // gear: every bot carries its class's heavy weapon and a fighting ability, and uses them on whoever it's fighting
      this.gearCd = (this.gearCd ?? 4 + Math.random() * 8) - dt;
      if (this.gearCd <= 0 && g.botGear) this.gearCd = g.botGear(this, tgt, tDist, wantCover) || 1.5;
      if (wantCover && !this.cover) this.cover = co.findCover(this, tgt) || { none: true };
      if (!wantCover) this.cover = null;
      if (this.cover && !this.cover.none) {
        const r = stepTo(this.cover.pos[0], this.cover.pos[2], b.t.speed);
        if (r < 0) this.cover = { none: true }; else moved = r;
      } else {
        // strafe sideways round the target
        const dx = tgt.pos[0] - b.pos[0], dz = tgt.pos[2] - b.pos[2], l = Math.hypot(dx, dz) || 1;
        const r = stepTo(b.pos[0] - dz / l * this.strafe, b.pos[2] + dx / l * this.strafe, b.t.speed * 0.6);
        if (r < 0) this.strafe *= -1; else moved = r;
        if (Math.random() < dt * 0.7) this.strafe *= -1;
      }
      this.repathT = Math.min(this.repathT, 0.5);
    } else if (this.path && this.pi < this.path.length && !atGoal) {
      if (tgt) speed *= 0.8;
      moved = this.follow(dt, speed);
    }
    b.moving += ((moved > 0.001 ? 1 : 0) - b.moving) * Math.min(1, dt * 8);
    b.walk += dt * (moved / Math.max(dt, 1e-4)) * 2.2;
    // stuck? get a fresh path
    if (dist2(b.pos, this.lastPos) > 0.6) { this.lastPos = [...b.pos]; this.stuckT = 0; }
    else if (!atGoal && !tgt) { this.stuckT += dt; if (this.stuckT > 2.5) { this.stuckT = 0; this.repathT = 0; } }

    // ---- face the target, or where I'm going
    let want = b.yaw;
    const intel = tgt ? null : co.nearestIntel(this);
    this.facing = tgt ? [...tgt.pos] : intel ? intel.pos : null;
    if (tgt) want = Math.atan2(-(tgt.pos[0] - b.pos[0]), -(tgt.pos[2] - b.pos[2]));
    else if (intel && dist2(intel.pos, b.pos) < 30 && this.goal?.mode !== 'retreat') want = Math.atan2(-(intel.pos[0] - b.pos[0]), -(intel.pos[2] - b.pos[2]));   // pre-aim where they were
    else if (this.path && this.pi < this.path.length) { const p = this.path[this.pi]; if (dist2(p, b.pos) > 0.2) want = Math.atan2(-(p[0] - b.pos[0]), -(p[2] - b.pos[2])); }
    let dy = want - b.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    b.yaw += dy * Math.min(1, dt * 8);
    if (tgt) {
      const pe = tgt.eye();
      b.aimPitch += (Math.atan2(pe[1] - (b.pos[1] + 1.4 * b.sc), Math.max(tDist, 0.5)) - b.aimPitch) * Math.min(1, dt * 6);
    } else b.aimPitch *= Math.exp(-4 * dt);

    // ---- shoot in bursts, after a moment to react; not from inside cover
    this.shotCd -= dt; this.pauseCd -= dt;
    const inCover = this.cover && !this.cover.none && dist2(b.pos, this.cover.pos) < 0.4;
    if (tgt && tDist < 48 && Math.abs(dy) < 0.45 && this.react <= 0 && !inCover && this.reloadT <= 0) {
      if (this.burst <= 0 && this.pauseCd <= 0) { const [a, c] = b.t.burst; this.burst = a + Math.floor(Math.random() * (c - a + 1)); }
      if (this.burst > 0 && this.shotCd <= 0) {
        this.shotCd = 60 / b.t.rpm;
        this.burst--;
        if (this.burst === 0) { const [p0, p1] = b.t.pause; this.pauseCd = p0 + Math.random() * (p1 - p0); }
        this.fire(tgt, tDist, g);
        if (--this.ammo <= 0) { this.reloadT = 2 + Math.random() * 0.6; this.burst = 0; }
      }
    } else this.burst = 0;

    b.place();
  }

  follow(dt, speed) {
    const b = this.bot;
    let left = speed * dt, moved = 0;
    while (left > 0 && this.pi < this.path.length) {
      const p = this.path[this.pi];
      if (!this.seg) this.seg = { from: [...b.pos], len: Math.max(0.01, dist2(b.pos, p)) };
      const dx = p[0] - b.pos[0], dz = p[2] - b.pos[2], d = Math.hypot(dx, dz);
      if (d < 0.05 || d <= left) {
        b.pos[0] = p[0]; b.pos[2] = p[2]; b.pos[1] = p[1];
        left -= d; moved += d;
        this.pi++; this.seg = null;
        continue;
      }
      b.pos[0] += dx / d * left; b.pos[2] += dz / d * left;
      moved += left;
      const k = clamp(1 - (d - left) / this.seg.len, 0, 1);
      b.pos[1] = this.seg.from[1] + (p[1] - this.seg.from[1]) * k;
      left = 0;
    }
    return moved;
  }

  fire(tgt, dist, g) {
    const b = this.bot, from = b.muzzle();
    this.co.heard(this, from);
    b.muzzleT = 0.05; b.recoil = 1;
    const aim = [tgt.pos[0], tgt.pos[1] + 1.2, tgt.pos[2]];
    let chance;
    if (tgt.isPlayer) {
      const pl = g.player, hs = Math.hypot(pl.vel[0], pl.vel[2]);
      chance = (0.42 - Math.max(0, dist - 8) * 0.016) * b.t.acc * 0.85;
      chance -= Math.min(hs / 14, 1) * 0.3 * (this.track > 1 && !pl.dash ? 0.65 : 1);   // a long track learns your strafe
      if (pl.sliding) chance -= 0.1;
      if (!pl.grounded) chance -= 0.08;
      if (pl.dash || pl.grapple?.phase === 'pull') chance -= 0.2;
    } else {
      chance = (0.4 - Math.max(0, dist - 6) * 0.012) * b.t.acc;
    }
    chance *= 0.55 + 0.45 * Math.min(1, (this.track || 0) / 1.2);      // the longer they track you, the better they shoot
    chance = clamp(chance, 0.04, 0.85);
    let end;
    if (Math.random() < chance) {
      end = aim;
      if (tgt.isPlayer) g.hitPlayer(b.t.dmg, b, from);
      else if (tgt.isRemote) this.co.netHit?.(tgt, b.t.dmg, this, from);     // a real player online
      else {
        const d = [aim[0] - from[0], aim[1] - from[1], aim[2] - from[2]], l = Math.hypot(...d) || 1;
        tgt.lastHitBy = this;
        const dead = tgt.bot.damage(b.t.dmg, d.map((v) => v / l));
        if (dead) g.onBotKill?.(this, tgt);
      }
    } else {
      const miss = [aim[0] + (Math.random() - 0.5) * 2.4, aim[1] + (Math.random() - 0.3) * 1.6, aim[2] + (Math.random() - 0.5) * 2.4];
      const d = [miss[0] - from[0], miss[1] - from[1], miss[2] - from[2]], l = Math.hypot(...d) || 1;
      const u = d.map((v) => v / l);
      const hit = this.co.world.raycast(from, u, 120, true, (bx) => bx.ref === b);
      end = hit ? hit.point : from.map((c, i) => c + u[i] * 120);
      if (hit && hit.box.tag !== 'bot') g.impact(hit, u);
      if (tgt.isPlayer) g.whiz(from, end);
    }
    const pd = g.player ? Math.hypot(g.player.pos[0] - from[0], g.player.pos[2] - from[2]) : 30;
    g.shot(b, from, end, pd);
  }
}

// ---------------------------------------------------------------- the match
export class Deathmatch {
  constructor(world) {
    this.world = world;
    this.agents = [];
    this.active = false;
    this.events = [];
    this.box = { carrier: null };     // (no objective to carry in deathmatch)
  }

  // match: { teams: [{ name, col, mine, players: [{ name, cls, you }] }] }, map: the arena
  start(match, map, player, classOf) {
    this.stop();
    this.map = map;
    if (!map.navObj) { map.navObj = new Nav(this.world); map.navObj.build(map.nav); }
    this.nav = map.navObj;
    this.player = player;
    this.teams = match.teams.map((t, i) => ({ name: t.name, col: t.col, rgb: hex(t.col), idx: i, mine: t.mine, kills: 0, spawn: map.spawns[i] }));
    this.myTeam = this.teams.find((t) => t.mine);
    this.you = {
      isPlayer: true, team: this.myTeam, name: 'YOU', cls: classOf, kills: 0, deaths: 0,
      get pos() { return player.pos; }, get alive() { return !player.dead; }, eye: () => player.eye(),
    };
    this.agents = [];
    for (const t of this.teams) t.intel = new Map();     // enemy → { pos, t, seen }
    match.teams.forEach((t, i) => t.players.forEach((p, k) => { if (!p.you) this.agents.push(new Agent(this, this.teams[i], p, k)); }));
    this.anchors = this.highSpots();
    this.over = null;
    this.youDead = false;
    this.t = 0;
    this.active = true;
    this.events.push({ type: 'start' });
  }

  stop() {
    for (const a of this.agents) if (!a.bot.removed) { a.bot.remove(); a.bot.removed = true; }
    this.agents = [];
    this.active = false;
  }

  entities() { return [this.you, ...this.agents]; }

  // someone went down: the other team scores (with two teams and no friendly fire, the killer is always on it)
  score(victim, killer) {
    if (this.over) return;
    const team = killer?.team && killer.team !== victim.team ? killer.team : this.teams.find((t) => t !== victim.team);
    team.kills++;
    if (killer) killer.kills = (killer.kills || 0) + 1;
    this.events.push({ type: 'kill', team, victim, killer });
    if (team.kills >= GOAL) {
      this.over = { winner: team, standings: [...this.teams].sort((x, y) => y.kills - x.kills) };
      this.events.push({ type: 'end', winner: team });
    }
  }

  onDeath(a) { a.deaths = (a.deaths || 0) + 1; this.score(a, a.lastHitBy || null); a.lastHitBy = null; }

  // ---- what the team knows: sightings (shared instantly, like callouts) and gunfire heard nearby
  spot(team, e, pos, seen) {
    if (team === e.team) return;
    team.intel.set(e, { pos: [...pos], t: this.t, seen });
  }

  heard(shooter, from) {
    for (const t of this.teams) {
      if (t === shooter.team) continue;
      for (const a of this.agents) {
        if (a.team !== t || !a.alive) continue;
        const d = dist2(a.pos, from);
        if (d < 38) {
          const n = d * 0.12;      // the further away, the vaguer
          this.spot(t, shooter, [from[0] + (Math.random() - 0.5) * n, shooter.pos[1], from[2] + (Math.random() - 0.5) * n], false);
          break;
        }
      }
    }
  }

  // the freshest-and-closest thing my team knows about
  nearestIntel(a) {
    let best = null, bs = Infinity;
    for (const [e, k] of a.team.intel) {
      if (!e.alive || this.t - k.t > INTEL_TTL) { if (!e.alive) a.team.intel.delete(e); continue; }
      const sc = dist2(k.pos, a.pos) + (this.t - k.t) * 3;
      if (sc < bs) { bs = sc; best = { e, pos: k.pos, age: this.t - k.t }; }
    }
    return best;
  }

  // who most of my team is shooting
  focus(team) {
    const n = new Map();
    for (const a of this.agents) if (a.team === team && a.alive && a.target?.alive) n.set(a.target, (n.get(a.target) || 0) + 1);
    let best = null, bn = 1;
    for (const [e, c] of n) if (c > bn) { bn = c; best = e; }
    return best;
  }

  // nav points on raised platforms, for anchors to hold
  highSpots() {
    const nav = this.nav, out = [];
    if (!nav?.levels || nav.levels.length < 2) return out;
    for (let n = 0; n < nav.N; n++) if (nav.Y[n] > nav.levels[0] + 1) out.push(n);
    return out;
  }

  // ---- what an AI should do
  goalFor(a) {
    if (this.over) return { pos: a.pos, mode: 'idle' };
    const o = this.map.origin, W = this.map.W || 30, D = this.map.D || 20;
    const myEnd = a.team.spawn.pos[0] < o[0] ? -1 : 1;
    const intel = this.nearestIntel(a);
    const mates = this.agents.filter((m) => m.team === a.team && m.alive).length + (this.you.team === a.team && this.you.alive ? 1 : 0);
    const foes = this.entities().filter((e) => e.team !== a.team && e.alive).length;
    // outnumbered: hold a defensive spot near my team instead of running in
    if (foes - mates >= 2 && intel && dist2(intel.pos, a.pos) < 24) return { pos: [...a.pos], mode: 'hold', r: 3 };
    // anchors hold the high ground on their half, and only leave it to chase something close
    if (a.role === 'anchor' && this.anchors.length && !(intel && intel.age < 3 && dist2(intel.pos, a.pos) < 14)) {
      if (a.anchorN == null || Math.random() < 0.01) {
        const mine = this.anchors.filter((n) => Math.sign(this.nav.X[n] - o[0]) === myEnd || Math.abs(this.nav.X[n] - o[0]) < 6);
        const list = mine.length ? mine : this.anchors;
        a.anchorN = list[Math.floor(Math.random() * list.length)];
      }
      return { pos: this.nav.point(a.anchorN), mode: 'anchor', r: 1.5 };
    }
    if (intel) {
      // go where they were last seen; flankers swing wide of it, pushers spread round it
      const p = intel.pos, far = dist2(p, a.pos) > 16;
      if (far && (a.role === 'flankL' || a.role === 'flankR')) {
        const side = (a.role === 'flankL' ? -1 : 1) * myEnd;
        const fz = clamp(p[2] + side * 10, o[2] - D + 2, o[2] + D - 2);
        return { pos: [p[0] - myEnd * 4, p[1], fz], mode: 'flank', r: 3 };
      }
      const ang = (a.slot / 4) * Math.PI * 2 + a.team.idx * 0.8, r = far ? 5 : 2.5;
      return { pos: [p[0] + Math.cos(ang) * r, p[1], p[2] + Math.sin(ang) * r], mode: intel.age < 2 ? 'hunt' : 'search', r: 2.5 };
    }
    // nothing known: sweep forward down my lane toward their end
    const lane = a.role === 'flankL' ? -0.6 : a.role === 'flankR' ? 0.6 : (a.slot % 2 ? 0.2 : -0.2);
    const push = clamp(this.t * 0.012, 0, 1);
    const x = o[0] - myEnd * W * (0.1 + 0.45 * push);
    return { pos: [x, o[1], o[2] + lane * D * myEnd], mode: 'sweep', r: 3 };
  }

  // a nearby spot the target can't see from (for ducking out of a fight between bursts)
  findCover(a, tgt) {
    const nav = this.nav, b = a.bot, te = tgt.eye();
    let best = null, bs = Infinity;
    const ids = nav.around(b.pos, 7);
    for (let k = 0; k < Math.min(ids.length, 22); k++) {
      const n = ids[(k * 7 + a.slot) % ids.length];
      const p = nav.point(n);
      const d = dist2(p, b.pos);
      if (d < 1 || d > 7) continue;
      if (b.canSee([p[0], p[1] + 1.5 * b.sc, p[2]], te, tgt.isPlayer ? null : tgt.bot)) continue;
      const sc = d + Math.random() * 1.5;
      if (sc < bs) { bs = sc; best = { pos: p }; }
    }
    return best;
  }

  // badly hurt: back to the nearest teammate (or my spawn) to heal
  retreatGoal(a) {
    let best = null, bd = Infinity;
    for (const o of this.agents) {
      if (o === a || o.team !== a.team || !o.alive) continue;
      const d = dist2(o.pos, a.pos);
      if (d > 4 && d < bd) { bd = d; best = o.pos; }
    }
    return { pos: best ? [...best] : [...a.team.spawn.pos], mode: 'retreat', r: 2.5 };
  }

  // the player has no objective to interact with
  playerAction() { return null; }

  // ---- per frame
  update(dt, g) {
    if (!this.active) return;
    this.t += dt;
    // being shot tells you where the shooter is
    for (const a of this.agents) if (a.alive && a.lastHitBy && a.hurtT === 0) this.spot(a.team, a.lastHitBy, a.lastHitBy.pos, false);
    for (const a of this.agents) a.update(dt, g);
    // your own deaths count too
    if (!this.you.alive && !this.youDead) { this.youDead = true; this.you.deaths++; this.score(this.you, this.player.lastHitBy || null); this.player.lastHitBy = null; }
    if (this.you.alive) this.youDead = false;
  }

  // ---- drawing: bots and their muzzle flashes
  drawParts() {
    const out = [];
    for (const a of this.agents) {
      const b = a.bot;
      out.push(...b.parts());
      if (b.alive && b.muzzleT > 0) {
        const m = mat4(), p = b.muzzle(), s = [0.14, 0.14, 0.14];
        compose(m, p, [0, b.yaw, Math.random() * 3], s);
        out.push({ model: m, scale: s, color: [1, 0.85, 0.5], emissive: 1 });
      }
    }
    return out;
  }

  // HUD: the score from your team's point of view
  objective() {
    const me = this.myTeam, them = this.teams.find((t) => t !== me);
    if (this.over) return { text: `${this.over.winner.name} WIN`, col: this.over.winner.col, sub: `${me.kills} – ${them.kills}` };
    const lead = me.kills - them.kills;
    return { text: `${me.kills}  –  ${them.kills}`, col: lead > 0 ? me.col : lead < 0 ? them.col : '#ffffff', sub: `TEAM DEATHMATCH · FIRST TO ${GOAL}` };
  }

  markers() { return []; }
}
