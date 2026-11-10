// Cashout mode for the semi-finals arena.
// A cash box spawns in a vault, locked for 30 s. Grab it (you can still shoot while carrying it), take it to an
// active cashout station and deposit it. The station counts down; any other team can steal it by standing on the
// station (players hold E). When the countdown ends, the team that holds the station banks $1,000.
// First team to $2,000 wins. You play with two AI teammates against three AI teams of three.
import { Bot, teamPalette } from './bots.js';
import { Nav } from './nav.js';
import { compose, mat4, clamp } from './math.js';

export const CASH_TIME = 45, LOCK_TIME = 30, STEAL_TIME = 4, PRIZE = 1000, GOAL = 2000;
const BOT_RESPAWN = 8, ROUND_GAP = 6;
const TYPE_OF = { light: 'rusher', medium: 'rifle', heavy: 'heavy' };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const near = (a, b, r, dy = 1.6) => dist2(a, b) < r && Math.abs(a[1] - b[1]) < dy;

// ---------------------------------------------------------------- one AI contestant
class Agent {
  constructor(co, team, info, slot) {
    Object.assign(this, { co, team, name: info.name, cls: info.cls, slot });
    this.isPlayer = false;
    this.respawnT = 0;
    this.spawnBot();
  }

  spawnBot() {
    const sp = this.team.spawn, a = this.slot * 2.1 - 2.1;
    const fwd = [-Math.sin(sp.yaw), -Math.cos(sp.yaw)], side = [fwd[1], -fwd[0]];
    const pos = [sp.pos[0] + side[0] * a, sp.pos[1], sp.pos[2] + side[1] * a];
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

    // ---- what am I doing?
    this.goalT -= dt;
    if (this.goalT <= 0) {
      this.goalT = 0.4 + Math.random() * 0.3;
      const ng = co.goalFor(this);
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

    // ---- who am I shooting?
    this.targetT -= dt;
    if (this.targetT <= 0) {
      this.targetT = 0.25 + Math.random() * 0.15;
      this.target = null;
      let best = 1e9;
      for (const e of co.entities()) {
        if (e.team === this.team || !e.alive) continue;
        const d = Math.hypot(e.pos[0] - b.pos[0], e.pos[1] - b.pos[1], e.pos[2] - b.pos[2]);
        if (d > 46 || d > best) continue;
        if (!b.canSee(b.eye(), e.eye(), e.isPlayer ? null : e.bot)) continue;
        best = d; this.target = e;
      }
    }
    const tgt = this.target && this.target.alive ? this.target : null;
    const tDist = tgt ? Math.hypot(tgt.pos[0] - b.pos[0], tgt.pos[2] - b.pos[2]) : 0;

    // ---- move: follow the path; hold and strafe in a fight unless the objective can't wait
    const urgent = this.goal && (this.goal.mode === 'carry' || this.goal.mode === 'steal' || this.goal.mode === 'grab');
    const [lo, hi] = b.t.range;
    const carrying = co.box.carrier === this;
    let speed = b.t.speed * (carrying ? 0.85 : 1);
    let moved = 0;
    const atGoal = this.goal && dist2(b.pos, this.goal.pos) < (this.goal.r || 1.2) && Math.abs(b.pos[1] - this.goal.pos[1]) < 1.5;
    if (tgt && !urgent && tDist < hi * 1.4) {
      // fighting: strafe sideways, keep my height
      const dx = tgt.pos[0] - b.pos[0], dz = tgt.pos[2] - b.pos[2], l = Math.hypot(dx, dz) || 1;
      const sx = -dz / l * this.strafe, sz = dx / l * this.strafe;
      const st = b.t.speed * 0.55 * dt;
      const nx = [b.pos[0] + sx * st, b.pos[1], b.pos[2] + sz * st];
      if (!b.blocked(nx) && co.world.pointInside([nx[0], nx[1] - 0.06, nx[2]])) { b.pos[0] = nx[0]; b.pos[2] = nx[2]; moved = st; }
      else this.strafe *= -1;
      if (Math.random() < dt * 0.6) this.strafe *= -1;
      this.repathT = Math.min(this.repathT, 0.5);
    } else if (this.path && this.pi < this.path.length && !atGoal) {
      if (tgt) speed *= 0.75;
      moved = this.follow(dt, speed);
    }
    b.moving += ((moved > 0.001 ? 1 : 0) - b.moving) * Math.min(1, dt * 8);
    b.walk += dt * (moved / Math.max(dt, 1e-4)) * 2.2;
    // stuck? get a fresh path
    if (dist2(b.pos, this.lastPos) > 0.6) { this.lastPos = [...b.pos]; this.stuckT = 0; }
    else if (!atGoal && !tgt) { this.stuckT += dt; if (this.stuckT > 2.5) { this.stuckT = 0; this.repathT = 0; } }

    // ---- face the target, or where I'm going
    let want = b.yaw;
    if (tgt) want = Math.atan2(-(tgt.pos[0] - b.pos[0]), -(tgt.pos[2] - b.pos[2]));
    else if (this.path && this.pi < this.path.length) { const p = this.path[this.pi]; if (dist2(p, b.pos) > 0.2) want = Math.atan2(-(p[0] - b.pos[0]), -(p[2] - b.pos[2])); }
    let dy = want - b.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    b.yaw += dy * Math.min(1, dt * 7);
    if (tgt) {
      const pe = tgt.eye();
      b.aimPitch += (Math.atan2(pe[1] - (b.pos[1] + 1.4 * b.sc), Math.max(tDist, 0.5)) - b.aimPitch) * Math.min(1, dt * 6);
    } else b.aimPitch *= Math.exp(-4 * dt);

    // ---- shoot in bursts
    this.shotCd -= dt; this.pauseCd -= dt;
    if (tgt && tDist < 46 && Math.abs(dy) < 0.5) {
      if (this.burst <= 0 && this.pauseCd <= 0) { const [a, c] = b.t.burst; this.burst = a + Math.floor(Math.random() * (c - a + 1)); }
      if (this.burst > 0 && this.shotCd <= 0) {
        this.shotCd = 60 / b.t.rpm;
        this.burst--;
        if (this.burst === 0) { const [p0, p1] = b.t.pause; this.pauseCd = p0 + Math.random() * (p1 - p0); }
        this.fire(tgt, tDist, g);
      }
    } else this.burst = 0;

    // ---- objective: grab the box, deposit it
    co.tryInteract(this);
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
    b.muzzleT = 0.05; b.recoil = 1;
    const aim = [tgt.pos[0], tgt.pos[1] + 1.2, tgt.pos[2]];
    let chance;
    if (tgt.isPlayer) {
      const pl = g.player, hs = Math.hypot(pl.vel[0], pl.vel[2]);
      chance = (0.42 - Math.max(0, dist - 8) * 0.016) * b.t.acc * 0.85;
      chance -= Math.min(hs / 14, 1) * 0.3;
      if (pl.sliding) chance -= 0.1;
      if (!pl.grounded) chance -= 0.08;
      if (pl.dash || pl.grapple?.phase === 'pull') chance -= 0.2;
    } else {
      chance = (0.4 - Math.max(0, dist - 6) * 0.012) * b.t.acc;
    }
    chance = clamp(chance, 0.04, 0.85);
    let end;
    if (Math.random() < chance) {
      end = aim;
      if (tgt.isPlayer) g.hitPlayer(b.t.dmg, b, from);
      else {
        const d = [aim[0] - from[0], aim[1] - from[1], aim[2] - from[2]], l = Math.hypot(...d) || 1;
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
export class Cashout {
  constructor(world, map) {
    this.world = world;
    this.map = map;
    this.nav = new Nav(world);
    this.agents = [];
    this.active = false;
    this.box = { state: 'none', pos: [0, 0, 0], carrier: null, station: null, t: 0 };
    this.stations = [];
    this.parts = Array.from({ length: 6 }, () => mat4());
    this.events = [];
  }

  // match: { teams: [{ name, col, mine, players: [{ name, cls, you }] }] }
  start(match, player, classOf) {
    this.stop();
    if (!this.nav.ready) this.nav.build(this.map.nav);
    this.player = player;
    this.teams = match.teams.map((t, i) => ({ name: t.name, col: t.col, rgb: hex(t.col), idx: i, mine: t.mine, cash: 0, spawn: this.map.spawns[i] }));
    this.myTeam = this.teams.find((t) => t.mine);
    this.you = {
      isPlayer: true, team: this.myTeam, name: 'YOU', cls: classOf,
      get pos() { return player.pos; }, get alive() { return !player.dead; }, eye: () => player.eye(),
    };
    this.agents = [];
    match.teams.forEach((t, i) => t.players.forEach((p, k) => { if (!p.you) this.agents.push(new Agent(this, this.teams[i], p, k)); }));
    this.stations = this.map.refs.stations.map((s, i) => ({ ...s, i, active: false, owner: null, t: 0, steal: null }));
    this.vaults = this.map.refs.vaults;
    this.round = 0;
    this.lastVault = -1;
    this.over = null;
    this.active = true;
    this.nextRound();
  }

  stop() {
    for (const a of this.agents) if (!a.bot.removed) { a.bot.remove(); a.bot.removed = true; }
    this.agents = [];
    this.active = false;
    this.box = { state: 'none', pos: [0, 0, 0], carrier: null, station: null, t: 0 };
    for (const s of this.stations) { s.active = false; s.owner = null; }
    this.paintStations();
    this.paintVaults(-1);
  }

  entities() { return [this.you, ...this.agents]; }
  teamOf(e) { return e.team; }

  nextRound() {
    this.round++;
    let v;
    do v = Math.floor(Math.random() * this.vaults.length); while (v === this.lastVault && this.vaults.length > 1);
    this.lastVault = v;
    this.vaultIdx = v;
    this.box = { state: 'locked', t: LOCK_TIME, pos: [...this.vaults[v].pos], carrier: null, station: null };
    // two cashout stations open each round
    const order = this.stations.map((s) => s.i).sort(() => Math.random() - 0.5);
    for (const s of this.stations) { s.active = order.indexOf(s.i) < 2; s.owner = null; s.t = 0; s.steal = null; }
    this.betweenT = 0;
    this.events.push({ type: 'round', round: this.round });
    this.paintStations();
  }

  // ---- what an AI should do right now
  goalFor(a) {
    const box = this.box, team = a.team;
    const ring = (p, r) => { const ang = (a.slot / 3) * Math.PI * 2 + team.idx; return [p[0] + Math.cos(ang) * r, p[1], p[2] + Math.sin(ang) * r]; };
    if (this.over) return { pos: a.pos, mode: 'idle' };
    if (box.state === 'none') return { pos: ring(this.vaults[this.vaultIdx]?.pos || a.pos, 4), mode: 'idle' };
    if (box.carrier === a) {
      const st = this.bestStation(a.pos);
      return st ? { pos: st.pos, mode: 'carry', r: 1.4 } : { pos: a.pos, mode: 'idle' };
    }
    if (box.state === 'deposited') {
      const st = box.station;
      if (st.owner === team.idx) return { pos: ring(st.pos, 3.5 + a.slot), mode: 'defend', r: 1.5 };
      return { pos: st.pos, mode: 'steal', r: 1.2 };
    }
    if (box.carrier) {
      if (box.carrier.team === team) return { pos: ring(box.carrier.pos, 3), mode: 'escort', r: 2 };
      return { pos: box.carrier.pos, mode: 'hunt', r: 3 };
    }
    if (box.state === 'locked') return { pos: ring(box.pos, 3 + a.slot * 0.8), mode: 'wait', r: 1.5 };
    return { pos: box.pos, mode: 'grab', r: 0.8 };
  }

  bestStation(p) {
    let best = null, bd = Infinity;
    for (const s of this.stations) {
      if (!s.active || s.owner != null) continue;
      const d = Math.hypot(s.pos[0] - p[0], (s.pos[1] - p[1]) * 3, s.pos[2] - p[2]);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // bots pick up / deposit automatically
  tryInteract(a) {
    const box = this.box;
    if ((box.state === 'ready' || box.state === 'dropped') && near(a.pos, box.pos, 2.5)) this.pickUp(a);
    else if (box.carrier === a) {
      const st = this.bestStation(a.pos);
      if (st && near(a.pos, st.pos, 2.2)) this.deposit(a, st);
    }
  }

  // ---- the player's E key: returns the action taken (or what's possible, with dry = true)
  playerAction(dry = false) {
    if (!this.active || this.over || !this.you.alive) return null;
    const box = this.box, p = this.player.pos;
    if ((box.state === 'ready' || box.state === 'dropped') && near(p, box.pos, 2.2)) { if (!dry) this.pickUp(this.you); return 'pickup'; }
    if (box.state === 'locked' && near(p, box.pos, 2.4)) return 'locked';
    if (box.carrier === this.you) {
      const st = this.bestStation(p);
      if (st && near(p, st.pos, 2.6)) { if (!dry) this.deposit(this.you, st); return 'deposit'; }
    }
    if (box.state === 'deposited' && box.station.owner !== this.you.team.idx && near(p, box.station.pos, 2.6)) return 'steal';
    return null;
  }

  pickUp(e) {
    const box = this.box;
    box.state = 'carried';
    box.carrier = e;
    this.events.push({ type: 'pickup', who: e });
    this.paintVaults(-1);
  }

  deposit(e, st) {
    const box = this.box;
    box.state = 'deposited';
    box.carrier = null;
    box.station = st;
    box.pos = [st.pos[0], st.pos[1] + 1.43, st.pos[2]];
    st.owner = e.team.idx;
    st.t = CASH_TIME;
    st.steal = null;
    for (const s of this.stations) if (s !== st) s.active = false;
    this.events.push({ type: 'deposit', who: e, team: e.team });
    this.paintStations();
  }

  drop(e) {
    const box = this.box;
    if (box.carrier !== e) return;
    box.carrier = null;
    box.state = 'dropped';
    box.pos = [e.pos[0], e.pos[1], e.pos[2]];
    this.events.push({ type: 'drop', who: e });
  }

  onDeath(a) { this.drop(a); }

  // ---- per frame
  update(dt, g, holdE) {
    if (!this.active) return;
    for (const a of this.agents) a.update(dt, g);
    if (this.over) return;
    const box = this.box;
    if (!this.you.alive && box.carrier === this.you) this.drop(this.you);
    if (box.state === 'locked') {
      box.t -= dt;
      if (box.t <= 0) { box.state = 'ready'; this.events.push({ type: 'unlock' }); }
    }
    if (box.carrier) box.pos = [box.carrier.pos[0], box.carrier.pos[1], box.carrier.pos[2]];
    if (box.state === 'dropped' && box.pos[1] < this.map.voidY) { box.pos = [...this.vaults[this.vaultIdx].pos]; }
    // the cashout countdown, and steals
    if (box.state === 'deposited') {
      const st = box.station;
      st.t -= dt;
      let thief = null;
      for (const e of this.entities()) {
        if (!e.alive || e.team.idx === st.owner || !near(e.pos, st.pos, 2.4)) continue;
        if (e.isPlayer && !holdE) continue;
        thief = e; break;
      }
      if (thief) {
        if (!st.steal || st.steal.team !== thief.team.idx) st.steal = { team: thief.team.idx, t: 0, who: thief };
        st.steal.t += dt;
        st.steal.grace = 0.5;
        if (st.steal.t >= STEAL_TIME) {
          st.owner = thief.team.idx;
          st.t = Math.max(st.t, 15);
          this.events.push({ type: 'steal', team: thief.team, who: thief });
          st.steal = null;
          this.paintStations();
        }
      } else if (st.steal) {
        st.steal.grace -= dt;
        if (st.steal.grace <= 0) st.steal = null;
      }
      if (st.t <= 0) {
        const team = this.teams[st.owner];
        team.cash += PRIZE;
        this.events.push({ type: 'cashout', team });
        box.state = 'none';
        box.station = null;
        st.active = false; st.owner = null;
        this.betweenT = ROUND_GAP;
        this.paintStations();
        if (team.cash >= GOAL) {
          this.over = { winner: team, standings: [...this.teams].sort((x, y) => y.cash - x.cash) };
          this.events.push({ type: 'end', winner: team });
        }
      }
    }
    if (box.state === 'none' && !this.over) {
      this.betweenT -= dt;
      if (this.betweenT <= 0) this.nextRound();
    }
    // station lights
    const pulse = 0.55 + 0.35 * Math.sin(performance.now() * 0.006);
    for (const s of this.stations) {
      if (s.owner != null) { s.beam.alpha = 0.3; s.ring.emissive = 1; }
      else if (s.active) { s.ring.emissive = pulse; s.top.emissive = pulse; }
    }
    this.paintVaults(this.vaultIdx);
  }

  paintStations() {
    for (const s of this.stations) {
      let c = [0.3, 0.31, 0.34], e = 0.2, beam = 0;
      if (s.active) { c = [0.95, 0.95, 1]; e = 0.8; }
      if (s.owner != null && this.teams) { c = this.teams[s.owner].rgb; e = 1; beam = 0.3; }
      s.ring.color = c; s.top.color = c; s.ring.emissive = e; s.top.emissive = e;
      s.beam.color = c; s.beam.alpha = beam;
    }
  }

  paintVaults(active) {
    (this.vaults || this.map.refs?.vaults || []).forEach((v, i) => {
      let c = [0.3, 0.31, 0.34], e = 0.2;
      if (i === active && this.box.state === 'locked') { c = [1, 0.2, 0.15]; e = 0.9; }
      else if (i === active && this.box.state === 'ready') { c = [0.25, 1, 0.45]; e = 1; }
      v.ring.color = c; v.cap.color = c; v.ring.emissive = e; v.cap.emissive = e;
    });
  }

  // ---- drawing: bots, muzzle flashes, and the cash box when it isn't in your hands
  drawParts(time) {
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
    const box = this.box;
    if (box.state === 'none' || box.carrier === this.you) return out;
    let c, rot;
    if (box.carrier) { const b = box.carrier.bot; c = b.toWorld([0.42, 1.0, -0.1]); rot = [0, b.yaw, 0]; }
    else if (box.state === 'deposited') { c = [box.pos[0], box.pos[1] + 0.25, box.pos[2]]; rot = [0, time * 1.5, 0]; }
    else { c = [box.pos[0], box.pos[1] + 0.32 + Math.sin(time * 2.4) * 0.06, box.pos[2]]; rot = [0, time * 0.8, 0]; }
    out.push(...cashBoxParts(this.parts, c, rot, box.state === 'locked'));
    return out;
  }

  // HUD: what's happening, from your team's point of view
  objective() {
    const box = this.box, me = this.myTeam;
    const t = (s) => `${Math.floor(s / 60)}:${String(Math.ceil(s % 60) === 60 ? 0 : Math.ceil(s % 60)).padStart(2, '0')}`;
    if (this.over) return { text: `${this.over.winner.name} WIN`, col: this.over.winner.col };
    if (box.state === 'none') return { text: `NEXT VAULT IN ${Math.ceil(this.betweenT)}`, col: '#ffffff' };
    if (box.state === 'locked') return { text: `VAULT OPENS IN ${t(box.t)}`, col: '#ff6a5a', sub: 'GET TO THE CASH BOX' };
    if (box.state === 'ready') return { text: 'CASH BOX READY', col: '#4dff7a', sub: 'GRAB IT' };
    if (box.state === 'dropped') return { text: 'CASH BOX DROPPED', col: '#ffd04a', sub: 'PICK IT UP' };
    if (box.state === 'carried') {
      if (box.carrier === this.you) return { text: 'YOU HAVE THE CASH BOX', col: '#ffd04a', sub: 'TAKE IT TO A CASHOUT STATION' };
      const c = box.carrier.team;
      return c === me ? { text: `${box.carrier.name} HAS THE CASH BOX`, col: c.col, sub: 'ESCORT THEM' } : { text: `${c.name} HAVE THE CASH BOX`, col: c.col, sub: 'TAKE THEM OUT' };
    }
    if (box.state === 'deposited') {
      const st = box.station, o = this.teams[st.owner];
      const steal = st.steal ? ` · STEAL ${Math.round((st.steal.t / STEAL_TIME) * 100)}%` : '';
      return { text: `${o === me ? 'CASHING OUT' : o.name + ' CASHING OUT'} ${t(Math.max(0, st.t))}`, col: o.col, sub: (o === me ? 'DEFEND THE STATION' : 'STEAL IT: HOLD E ON THE STATION') + steal, steal: st.steal ? st.steal.t / STEAL_TIME : 0 };
    }
    return null;
  }

  // things to mark on screen: { pos, kind, label, col }
  markers() {
    if (!this.active) return [];
    const out = [];
    const box = this.box;
    for (const s of this.stations) {
      if (!s.active && s.owner == null) continue;
      const o = s.owner != null ? this.teams[s.owner] : null;
      out.push({ pos: [s.pos[0], s.pos[1] + 2.4, s.pos[2]], kind: 'station', label: o ? `CASHOUT ${Math.ceil(Math.max(0, s.t))}s` : 'CASHOUT', col: o ? o.col : '#ffffff' });
    }
    if (box.state === 'locked' || box.state === 'ready' || box.state === 'dropped') {
      out.push({ pos: [box.pos[0], box.pos[1] + 1.4, box.pos[2]], kind: 'box', label: box.state === 'locked' ? `LOCKED ${Math.ceil(box.t)}s` : 'CASH BOX', col: box.state === 'locked' ? '#ff6a5a' : '#ffd04a' });
    } else if (box.carrier && box.carrier !== this.you) {
      out.push({ pos: [box.carrier.pos[0], box.carrier.pos[1] + 2.4, box.carrier.pos[2]], kind: 'carrier', label: box.carrier.name, col: box.carrier.team.col });
    }
    return out;
  }
}

// the cash box: a gold case with a dark band, handle and corner guards
const GOLD = [1, 0.74, 0.18];
export function cashBoxParts(ms, c, rot, locked) {
  const parts = [];
  const cy = Math.cos(rot[1]), sy = Math.sin(rot[1]);
  const at = (o) => [c[0] + cy * o[0] + sy * o[2], c[1] + o[1], c[2] - sy * o[0] + cy * o[2]];
  const P = (i, o, s, color, emissive = 0, shape = 0.04, mat = 'paint') => { compose(ms[i], at(o), rot, s); parts.push({ model: ms[i], scale: s, color, emissive, shape, mat }); };
  P(0, [0, 0, 0], [0.62, 0.4, 0.4], GOLD, 0.15, 0.05, 'steel');
  P(1, [0, 0.02, 0], [0.64, 0.07, 0.42], [0.12, 0.12, 0.13], 0, 0.02, 'metal');
  P(2, [0, 0.24, 0], [0.24, 0.05, 0.06], [0.12, 0.12, 0.13], 0, 0.02, 'metal');
  P(3, [0, 0, 0.205], [0.16, 0.12, 0.02], locked ? [1, 0.2, 0.15] : [0.3, 1, 0.5], 1, 0.01);
  return parts;
}
