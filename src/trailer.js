// The Semi-Finals intro trailer: a ~60 s cinematic played live in the engine.
// Gameplay clips are real gameplay — the player is driven by a script (+ aim assist) —
// then the shot pulls out to a TV in a living room where two contestants trash-talk,
// trios pose on a light stage, "CAN YOU MAKE THE SEMI-FINALS?", key art, and into the game.
import { Contestant } from './contestant.js';

const HALF_PI = Math.PI / 2;
const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const sm = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

// Scripted stand-in for the keyboard/mouse while the trailer drives the player
class ScriptInput {
  constructor() { this.reset(); }
  reset() {
    this.held = new Set(); this.hits = new Set();
    this.aiming = false; this.fireDown = false; this.fireHit = false;
    this.act = {}; this.dx = 0; this.dy = 0;
  }
  down(k) { return this.held.has(k); }
  hit(k) { return this.hits.has(k); }
  mouse() { return false; }
  mouseHit() { return false; }
  endFrame() { this.hits.clear(); this.fireHit = false; this.act = {}; }
}

export class Trailer {
  // api: { reset, give(id, loadout), player, botMgr, map, step(dt), dummies, sounds, studioRefs, setSlowmo }
  constructor(api) {
    this.api = api;
    this.input = new ScriptInput();
    this.active = false;
    this.t = 0;
    this.shotIdx = -1;
    this.el = document.getElementById('trailer');
    this.capEl = this.el.querySelector('.cap');
    this.cardEl = this.el.querySelector('.tcard');
    this.glitchEl = this.el.querySelector('.tglitch');
    this.duo = [new Contestant('viper', api.map.studio.seats[0], 0), new Contestant('bolt', api.map.studio.seats[1], 0)];
    this.duo.forEach((c) => { c.pose = 'sit'; });
    this.stageCast = [];
    this.blipT = 0;
    this.shots = this.buildShots();
    this.length = this.shots.reduce((m, s) => Math.max(m, s.t0 + s.dur), 0);
  }

  // ---------------------------------------------------------------- gameplay clip helpers
  aimAt(target, rate = 14, dt = 1 / 60) {
    const p = this.api.player, e = p.eye();
    const d = [target[0] - e[0], target[1] - e[1], target[2] - e[2]];
    const yaw = Math.atan2(-d[0], -d[2]), pitch = Math.atan2(d[1], Math.hypot(d[0], d[2]));
    let dy = yaw - p.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const k = Math.min(1, dt * rate);
    p.yaw += dy * k;
    p.pitch += (pitch - p.pitch) * k;
    return Math.abs(dy) < 0.12;
  }

  nearestDummy(maxDist = 40) {
    const p = this.api.player.pos;
    let best = null, bd = maxDist;
    for (const d of this.api.dummies) {
      if (!d.alive) continue;
      const dist = Math.hypot(d.pos[0] - p[0], d.pos[2] - p[2]);
      if (dist < bd && d.pos[2] < p[2] + 2) { bd = dist; best = d; }
    }
    return best;
  }

  nearestBot() {
    const p = this.api.player.pos;
    let best = null, bd = 1e9;
    for (const b of this.api.botMgr.bots) {
      if (!b.alive || !b.visible) continue;
      const dist = Math.hypot(b.pos[0] - p[0], b.pos[2] - p[2]);
      if (dist < bd) { bd = dist; best = b; }
    }
    return best;
  }

  // place a fighting wave of bots in front of the player (no drop-in)
  arenaBots(spots, hp) {
    const m = this.api.botMgr;
    m.spawnWave(2, 0);
    m.bots.forEach((b, i) => {
      if (i >= spots.length) { b.alive = false; b.removed = true; b.remove(); return; }
      b.pos = [...spots[i]]; b.lastPos = [...spots[i]];
      b.state = 'fight'; b.dropT = 99; b.landed = true; b.hp = hp; b.maxHp = hp;
      b.place();
    });
    m.bots = m.bots.filter((b) => b.alive);
    m.doorTarget = 1;
    m.state = 'fight';
  }

  // ---------------------------------------------------------------- the edit
  buildShots() {
    const A = this.api, D = A.map.deck.y, I = this.input;
    const W = ['KeyW', 'ShiftLeft'];
    const shots = [];
    let t = 0;
    const push = (dur, s) => { shots.push({ t0: t, dur, ...s }); t += dur; };

    // --- clips (each sets the world up, then gets ticked with clip time ct)
    const clips = {
      slideShoot: {
        setup: () => { A.reset(); A.give('ar', { optic: 'holo' }); A.player.teleport([3, 0, 15], 0); A.player.pitch = -0.05; },
        tick: (ct, dt) => {
          I.held = new Set(ct < 0.25 ? W : [...W, 'ControlLeft']);
          if (ct > 0.24 && ct < 0.3) I.hits.add('ControlLeft');
          const d = this.nearestDummy();
          if (d) { const on = this.aimAt([d.pos[0], d.pos[1] + 1.15, d.pos[2]], 10, dt); I.fireDown = ct > 0.4 && on; }
        },
      },
      wallRun: {
        setup: () => { A.reset(); A.give('smg'); A.player.teleport([54.5, 0, -18.7], -HALF_PI); },
        tick: (ct, dt) => {
          I.held = new Set(W);
          if (ct > 0.12 && ct < 0.16) I.hits.add('Space');
          // once on the wall, look down the lane instead of at the wall
          if (A.player.wallRunning) A.player.yaw += (-HALF_PI + 0.35 - A.player.yaw) * Math.min(1, dt * 5);
        },
      },
      grapple: {
        setup: () => { A.reset(); A.give('ar'); A.player.teleport([-21, 0, 16], 0.05); A.player.pitch = 0.42; },
        tick: (ct, dt) => {
          I.held = new Set(['KeyW']);
          if (ct > 0.08 && !this.flag) { this.flag = true; I.act = { grapple: true }; }
          if (A.player.grapple?.phase === 'pull') A.player.pitch += (0.15 - A.player.pitch) * Math.min(1, dt * 3);
        },
      },
      slamWall: {
        setup: () => { A.reset(); A.give('shotgun'); A.player.teleport([-9, 5.5, 5.6], Math.PI); A.player.pitch = -0.45; },
        tick: (ct) => { if (ct > 0.12 && !this.flag) { this.flag = true; I.act = { slam: true }; } },
      },
      vault: {
        setup: () => { A.reset(); A.give('ar'); A.player.teleport([35, 0, -24], -HALF_PI); },
        tick: () => {
          I.held = new Set(W);
          const x = A.player.pos[0];
          for (const hx of [40, 44.5, 49]) if (hx - x > 0.6 && hx - x < 1.6) I.hits.add('Space');
        },
      },
      chainRun: {
        setup: () => { A.reset(); A.give('pistol'); A.player.teleport([2.5, 0, 26], 0); this.phase = 'run'; this.pt = 0; },
        tick: (ct, dt) => {
          const held = new Set(W);
          this.pt += dt;
          if (this.phase === 'run' && this.pt > 0.4) { this.phase = 'slide'; this.pt = 0; I.hits.add('ControlLeft'); }
          if (this.phase === 'slide') { held.add('ControlLeft'); if (this.pt > 0.17) { I.hits.add('Space'); this.phase = 'air'; this.pt = 0; } }
          else if (this.phase === 'air') { if (this.pt > 0.15) held.add('ControlLeft'); if (A.player.grounded && this.pt > 0.1) { this.phase = 'slide'; this.pt = 0; } }
          I.held = held;
        },
      },
      pods: {
        setup: () => {
          A.reset();
          A.player.teleport(A.map.deck.respawn.pos, A.map.deck.respawn.yaw);
          A.botMgr.spawnWave(2, 0.35);
          A.botMgr.state = 'intro';
        },
        tick: (ct) => { if (ct > 1.7) A.botMgr.doorTarget = 1; },
        cam: (ct, dur) => {
          const c = A.map.deck.cam.pods, k = sm(ct / dur);
          const eye = lerp3(c.from, c.to, k);
          return { eye, fwd: norm(c.look.map((v, i) => v - eye[i])), fov: 62 };
        },
      },
      arenaFight: {
        setup: () => {
          A.reset(); A.give('ar', { optic: 'holo', muzzle: 'compensator' });
          A.player.teleport([-44.5, D, -2], HALF_PI);
          this.arenaBots([[-53, D, -7], [-56, D, 3], [-51, D, 7], [-59, D, -11]], 45);
        },
        tick: (ct, dt) => {
          I.held = new Set([ct % 1.2 < 0.6 ? 'KeyA' : 'KeyD']);
          if (ct > 1.1 && ct < 1.15) I.hits.add('Space');
          const b = this.nearestBot();
          if (b) { const on = this.aimAt([b.pos[0], b.pos[1] + 1.25, b.pos[2]], 9, dt); I.fireDown = ct > 0.35 && on; }
        },
      },
      dashSlam: {
        setup: () => {
          A.reset(); A.give('shotgun');
          A.player.teleport([-42.5, D, 5], HALF_PI);
          A.player.pitch = -0.08;
          this.arenaBots([[-50, D, 3.6], [-51.2, D, 5.8], [-49.4, D, 7.2]], 50);
        },
        tick: (ct) => {
          I.held = new Set(W);
          if (ct > 0.2 && !this.flag) { this.flag = true; I.act = { dash: true }; }
          if (ct > 0.45 && ct < 0.5) I.hits.add('Space');
          if (ct > 0.72 && !this.flag2) { this.flag2 = true; I.act = { slam: true }; }
        },
      },
      sniper: {
        setup: () => {
          A.reset(); A.give('sniper');
          A.player.teleport([-44, D, -3], HALF_PI);
          this.arenaBots([[-62, D, -6.5], [-66, D, 4]], 40);
        },
        tick: (ct, dt) => {
          const b = this.nearestBot();
          I.aiming = ct > 0.25 && ct < 2.2;
          if (b) this.aimAt([b.pos[0], b.pos[1] + 1.62 * b.sc, b.pos[2]], ct < 0.3 ? 30 : 7, dt);
          if (ct > 1.4 && !this.flag && b) { this.flag = true; I.fireHit = true; I.fireDown = true; A.setSlowmo(0.8); }
          else I.fireDown = false;
        },
      },
    };
    this.clips = clips;

    // --- the cut (times in seconds)
    push(1.8, { kind: 'card', card: { small: 'SEMI STUDIOS PRESENTS', big: '', style: 'studio' } });
    push(2.2, { kind: 'card', card: { small: 'TOURNAMENT ROUND 1', big: 'THE TEST RANGE', style: 'red' }, hit: true });
    push(2.1, { kind: 'game', clip: 'slideShoot' });
    push(1.7, { kind: 'game', clip: 'wallRun', skip: 0.1 });
    push(1.9, { kind: 'game', clip: 'grapple' });
    push(1.6, { kind: 'game', clip: 'slamWall' });
    push(1.7, { kind: 'game', clip: 'vault', skip: 0.2 });
    // pull out: the chain run keeps playing on the TV
    push(4.6, { kind: 'studio', clip: 'chainRun', cam: 'pullout' });
    push(2.5, { kind: 'studio', clip: 'chainRun', clipCont: true, cam: 'cuViper', who: 0, line: 'THAT\'S YOU? SLIDING FACE-FIRST INTO A WALL?' });
    push(2.3, { kind: 'studio', clip: 'chainRun', clipCont: true, cam: 'cuBolt', who: 1, line: 'THAT WALL HAD IT COMING.', boltPose: 'sitLean' });
    push(2.5, { kind: 'studio', clip: 'chainRun', clipCont: true, cam: 'twoShot', who: 0, line: 'YOU COULDN\'T EVEN CLEAR WAVE ONE.' });
    push(2.4, { kind: 'studio', clip: 'chainRun', clipCont: true, cam: 'cuBoltLean', who: 1, line: 'WATCH ME. I\'M MAKING THE SEMI-FINALS.', boltPose: 'sitLean' });
    push(1.9, { kind: 'studio', clip: 'chainRun', clipCont: true, cam: 'cuViper', who: 0, line: 'THE SEMI-FINALS? YOU?', viperPose: 'laugh' });
    // underground
    push(2.5, { kind: 'cine', clip: 'pods' });
    push(2.6, { kind: 'game', clip: 'arenaFight' });
    push(2.2, { kind: 'game', clip: 'dashSlam' });
    push(2.6, { kind: 'game', clip: 'sniper' });
    // season 1 trios
    push(1.4, { kind: 'card', card: { small: '', big: 'WELCOME TO', style: 'white' }, hit: true });
    push(2.0, { kind: 'stage', trio: ['frost', 'tide', 'glacier'], poses: ['heroGun', 'heroArms', 'heroShoulder'], color: [0.15, 0.4, 0.95], label: 'SEASON 1' });
    push(2.0, { kind: 'stage', trio: ['jackpot', 'dice', 'brass'], poses: ['heroShoulder', 'heroPoint', 'heroArms'], color: [1, 0.68, 0.08], label: 'SEASON 1' });
    push(2.0, { kind: 'stage', trio: ['neon', 'glitch', 'riot'], poses: ['heroHip', 'heroGun', 'heroShoulder'], color: [0.95, 0.15, 0.6], label: 'SEASON 1' });
    // the big question
    push(0.75, { kind: 'card', card: { small: '', big: 'CAN YOU', style: 'red' }, hit: true });
    push(0.75, { kind: 'card', card: { small: '', big: 'MAKE THE', style: 'red' }, hit: true });
    push(1.5, { kind: 'card', card: { small: '', big: 'SEMI-FINALS?', style: 'redbig' }, hit: true });
    // burst
    push(0.9, { kind: 'game', clip: 'grapple', skip: 0.35 });
    push(0.9, { kind: 'game', clip: 'wallRun', skip: 0.45 });
    push(0.9, { kind: 'game', clip: 'dashSlam', skip: 0.45 });
    push(0.9, { kind: 'game', clip: 'slamWall', skip: 0.35 });
    // key art
    push(5.0, { kind: 'stage', hero: true, color: [0.92, 0.1, 0.08] });
    return shots;
  }

  // ---------------------------------------------------------------- run
  start(onEnd) {
    this.onEnd = onEnd;
    this.active = true;
    this.t = 0;
    this.shotIdx = -1;
    this.el.classList.remove('hidden');
    document.body.classList.add('trailer', 'cine');
  }

  skip() { if (this.active) this.finish(); }

  finish() {
    this.active = false;
    this.input.reset();
    this.el.classList.add('hidden');
    document.body.classList.remove('trailer', 'cine');
    this.api.setSlowmo(0);
    this.onEnd?.();
  }

  get shot() { return this.shots[this.shotIdx]; }
  get view() { const s = this.shot; return !s ? 'card' : s.kind; }
  get simulating() { const s = this.shot; return !!(s && s.clip); }

  enterShot(i) {
    const prev = this.shots[this.shotIdx];
    this.shotIdx = i;
    const s = this.shots[i];
    this.ct = 0;
    this.flag = false; this.flag2 = false;
    this.input.reset();
    // cards
    if (s.kind === 'card') {
      this.cardEl.className = `tcard ${s.card.style}`;
      this.cardEl.querySelector('small').textContent = s.card.small;
      this.cardEl.querySelector('b').textContent = s.card.big;
      this.cardEl.querySelector('b').dataset.text = s.card.big;
      if (s.hit) this.api.sounds.slam?.(0.6);
    } else this.cardEl.className = 'tcard hidden';
    // captions
    if (s.line) {
      this.capEl.innerHTML = '';
      const n = document.createElement('b'); n.textContent = this.duo[s.who].skin.name;
      const l = document.createElement('span'); l.textContent = s.line;
      this.capEl.append(n, l);
      this.capEl.classList.add('on');
      this.api.sounds.grunt?.(s.who);
    } else this.capEl.classList.remove('on');
    // stage
    this.el.classList.toggle('show-season', !!s.label);
    this.el.classList.toggle('show-keyart', !!s.hero);
    if (s.kind === 'stage') this.setupStage(s);
    // gameplay clip
    const continuing = s.clipCont && prev && prev.clip === s.clip;
    if (s.clip && !continuing) {
      const c = this.clips[s.clip];
      c.setup();
      this.api.player.invuln = 999;
      if (s.skip) this.api.step(s.skip, (ct, dt) => c.tick(ct, dt));
      this.clipT = s.skip || 0;
    }
  }

  setupStage(s) {
    const R = this.api.studioRefs, st = this.api.map.studio.stage;
    const col = s.color;
    for (const p of [...R.panels, R.strip, ...R.bars]) p.color = [...col];
    R.panels.forEach((p, i) => { p.emissive = i % 2 ? 0.75 : 1; });
    if (s.hero) {
      const c = new Contestant('champ', [298.6, -40, 331.0], -0.45);
      c.pose = 'heroShoulder';
      this.stageCast = [c];
    } else {
      this.stageCast = s.trio.map((k, i) => {
        const c = new Contestant(k, st.spots[i], [0.25, 0, -0.25][i]);
        c.pose = s.poses[i];
        return c;
      });
    }
  }

  // advance the edit (real time), returns false when done
  update(rdt) {
    if (!this.active) return;
    this.t += rdt;
    if (this.t >= this.length) { this.finish(); return; }
    let i = this.shotIdx;
    while (i + 1 < this.shots.length && this.t >= this.shots[i + 1].t0) i++;
    if (i !== this.shotIdx) this.enterShot(Math.max(i, 0));
    if (this.shotIdx < 0) this.enterShot(0);
    const s = this.shot;
    this.ct = this.t - s.t0;
    // characters
    const talker = s.line != null ? s.who : -1;
    this.duo.forEach((c, k) => {
      c.update(rdt);
      c.talk += ((k === talker && this.ct > 0.15 ? 1 : 0) - c.talk) * Math.min(1, rdt * 10);
      c.pose = k === 0 ? (s.viperPose || 'sit') : (s.boltPose || 'sit');
    });
    this.stageCast.forEach((c) => c.update(rdt));
    if (s.kind === 'stage') {
      const R = this.api.studioRefs, pulse = 0.75 + 0.25 * Math.sin(this.ct * 9);
      R.panels.forEach((p, i) => { p.emissive = (i % 2 ? 0.7 : 1) * (i % 2 ? pulse : 1); });
      const sEl = this.el.querySelector('.season');
      const k = Math.min(1, this.ct / 0.15);
      sEl.style.opacity = k.toFixed(3);
      sEl.style.transform = `translateY(-50%) skewX(-8deg) translateX(${((1 - k) * -60 + this.ct * 12).toFixed(1)}px)`;
    }
    // captions slide in
    if (s.line) { const k = Math.min(1, this.ct / 0.14); this.capEl.style.opacity = k.toFixed(3); this.capEl.style.transform = `translate(-50%, ${((1 - k) * 8).toFixed(1)}px)`; }
    else this.capEl.style.opacity = 0;
    // glitch on every cut + card fades, all driven by trailer time (so recordings match playback)
    const g = Math.max(0, 1 - this.ct / 0.2);
    this.glitchEl.style.opacity = g.toFixed(3);
    this.glitchEl.style.transform = g > 0 ? `translateX(${(Math.sin(this.ct * 90) * 30 * g).toFixed(1)}px) scaleY(${(1 + g * 0.3).toFixed(2)})` : '';
    if (s.kind === 'card') {
      const k = s.card.style === 'studio' ? Math.min(1, this.ct / 0.5, (s.dur - this.ct) / 0.4) : 1;
      this.cardEl.firstChild.style.opacity = Math.max(0, k).toFixed(3);
      const pop = Math.max(0, 1 - this.ct / 0.18);
      this.cardEl.firstChild.style.transform = `scale(${(1 + pop * 0.25).toFixed(3)})`;
    }
    // talk blips
    if (talker >= 0 && this.ct > 0.15 && this.ct < s.dur - 0.4) {
      this.blipT -= rdt;
      if (this.blipT <= 0) { this.blipT = 0.075 + Math.random() * 0.05; this.api.sounds.talk?.(talker); }
    }
  }

  // called each sim step during clips
  tickClip(dt) {
    const s = this.shot;
    if (!s || !s.clip) return;
    this.clipT += dt;
    this.clips[s.clip].tick(this.clipT, dt);
  }

  cineCam() {
    const s = this.shot;
    return s && this.clips[s.clip]?.cam ? this.clips[s.clip].cam(this.ct, s.dur) : null;
  }

  // ---------------------------------------------------------------- studio cameras
  studioCam() {
    const s = this.shot, k = sm(this.ct / s.dur);
    const tv = this.api.map.studio.tv;
    const tvC = [(tv.x0 + tv.x1) / 2, (tv.y0 + tv.y1) / 2, tv.z];
    const look = (eye, at, fov = 50) => ({ eye, fwd: norm(at.map((v, i) => v - eye[i])), fov });
    if (s.kind === 'stage') {
      if (s.hero) return look(lerp3([300.4, -38.55, 327.8], [300.2, -38.6, 328.3], k), [299.7, -38.72, 331.3], 46);
      return look(lerp3([300.95, -38.95, 327.4], [300.55, -38.9, 328.0], k), [300.55, -38.95, 331.4], 50);
    }
    switch (s.cam) {
      case 'pullout': {
        // start with the screen filling the frame, then pull back over the couch
        const e = sm(Math.max(0, this.ct - 0.5) / (s.dur - 0.5));
        const start = [tvC[0], tvC[1], tv.z + 1.58];
        const end = [300, -37.55, 305.7];
        const eye = lerp3(start, end, e);
        const at = lerp3(tvC, [300, -38.85, 297], e);
        return look(eye, at, 50);
      }
      case 'cuViper': return look(lerp3([299.05, -38.85, 300.65], [299.12, -38.85, 300.9], k), [299.35, -38.66, 302.3], 46);
      case 'cuBolt': return look(lerp3([300.95, -38.85, 300.65], [300.88, -38.85, 300.9], k), [300.65, -38.66, 302.3], 46);
      case 'cuBoltLean': return look(lerp3([300.8, -38.95, 300.5], [300.78, -38.95, 300.75], k), [300.65, -38.82, 302.0], 44);
      case 'twoShot': return look(lerp3([300, -39.0, 299.4], [300, -38.95, 299.75], k), [300, -38.75, 302.3], 52);
      default: return look([300, -38, 306], tvC);
    }
  }

  parts() {
    const s = this.shot;
    if (!s) return [];
    if (s.kind === 'stage') return this.stageCast.flatMap((c) => c.parts());
    if (s.kind === 'studio') return this.duo.flatMap((c) => c.parts());
    return [];
  }
}
