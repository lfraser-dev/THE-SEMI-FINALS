// A held weapon: firing, recoil, spread, reloads (mag / shell-by-shell), pump & bolt
// cycling, equip animation, and the first-person viewmodel with hands.
import { compose, mul, mat4, damp, clamp, lerp, anglesFor } from './math.js';

const GLOVE = [0.86, 0.86, 0.88];
const SLEEVE = [0.16, 0.16, 0.19];
const FLASH = [1, 0.93, 0.75];
const RED = [0.95, 0.12, 0.1];

const smooth = (t) => t * t * (3 - 2 * t);
const seg = (t, a, b) => smooth(clamp((t - a) / (b - a), 0, 1));
const crossed = (prev, now, at) => prev < at && now >= at;

function transformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export class Weapon {
  constructor(def) {
    this.def = def;
    this.ammo = def.mag;
    this.cool = 0;
    this.reload = null;
    this.cycleT = null;   // pump/bolt cycle timer (null = not cycling)
    this.cycleLen = 0.5;
    this.bloom = 0;
    this.kick = 0;
    this.kickYaw = 0;
    this.sinceShot = 1;
    this.adsT = 0;
    this.sprintT = 0;
    this.slideT = 0;
    this.flash = 0;
    this.vmKick = 0;
    this.boltKick = 0;
    this.sway = [0, 0];
    this.equipT = 1;
    this.queued = 0;
    this.events = [];
    this.root = mat4();
    this.tmp = mat4();
    this.parts = def.parts.map((p) => ({ ...p, model: mat4(), local: mat4() }));
    this.handModels = [mat4(), mat4(), mat4(), mat4(), mat4()];
  }

  get ads() { return this.adsT > 0.5; }
  get reloading() { return !!this.reload; }
  get scoped() { return !!this.def.scope && this.adsT > 0.8; }

  equip() {
    this.equipT = 0;
    this.reload = null;
    this.cycleT = null;
    this.adsT = 0;
    this.kick = 0;
    this.kickYaw = 0;
  }

  // ctx = { fire(weapon), sounds }
  update(dt, input, player, ctx) {
    const d = this.def;
    this.equipT = Math.min(1, this.equipT + dt / 0.4);

    const wantAds = input.mouse(2) && !player.sprinting && !this.reload && this.equipT > 0.6;
    this.adsT += ((wantAds ? 1 : 0) - this.adsT) * damp(d.adsSpeed, dt);
    this.sprintT += ((player.sprinting && !this.reload ? 1 : 0) - this.sprintT) * damp(10, dt);
    this.slideT += ((player.sliding ? 1 : 0) - this.slideT) * damp(9, dt);

    if (input.hit('KeyR')) this.startReload(ctx);
    this.updateReload(dt, ctx);
    this.updateCycle(dt, ctx);

    this.cool -= dt;
    this.sinceShot += dt;
    if (input.mouseHit(0)) this.queued = 0.18; // click buffer for semi-autos
    this.queued -= dt;
    const trigger = d.auto ? input.mouse(0) : this.queued > 0;

    if (trigger && this.reload?.shell && this.ammo > 0) this.reload.interrupt = true;
    const blocked = this.reload || this.equipT < 0.75 || this.cycleT !== null;
    if (trigger && !blocked && this.cool <= 0) {
      if (this.ammo > 0) this.shoot(ctx);
      else if (input.mouseHit(0)) { ctx.sounds?.dry(); this.startReload(ctx); }
    }
    // auto-reload shortly after running dry
    if (this.ammo === 0 && !this.reload && this.cycleT === null && this.sinceShot > 0.3 && this.equipT >= 1) this.startReload(ctx);

    if (this.sinceShot > 0.09) {
      const k = damp(d.action ? 5 : 7, dt);
      this.kick -= this.kick * k;
      this.kickYaw -= this.kickYaw * k;
    }
    this.bloom -= this.bloom * damp(6, dt);
    this.flash -= dt;
    this.vmKick -= this.vmKick * damp(16, dt);
    this.boltKick -= this.boltKick * damp(28, dt);
    this.sway[0] += (clamp(-input.dx * 0.0005, -0.04, 0.04) - this.sway[0]) * damp(10, dt);
    this.sway[1] += (clamp(input.dy * 0.0005, -0.04, 0.04) - this.sway[1]) * damp(10, dt);
  }

  shoot(ctx) {
    const d = this.def;
    this.queued = 0;
    this.cool = Math.max(this.cool, 0) + 60 / d.rpm;
    this.ammo--;
    this.sinceShot = 0;
    ctx.fire(this);
    const am = lerp(1, 0.55, this.adsT);
    this.kick = Math.min(this.kick + d.recoil.up * am, 0.18);
    this.kickYaw += (Math.random() - 0.45) * d.recoil.side * am;
    this.bloom = Math.min(this.bloom + d.spread.bloom, d.spread.bloomMax);
    this.flash = 0.045;
    this.vmKick = d.recoil.vm;
    if (d.action) {
      this.cycleT = -0.12;
      this.cycleLen = Math.min(0.6, (60 / d.rpm) * 0.72);
    } else {
      this.boltKick = 1;
      this.eject();
    }
    ctx.sounds?.shot(d.sound);
  }

  eject() {
    const r = Math.random();
    this.events.push({
      type: 'eject',
      pos: transformPoint(this.root, this.def.eject),
      vel: [1.6 + r, 1.8 + r * 0.8, 0.4],
    });
  }

  startReload(ctx) {
    const d = this.def;
    if (this.reload || this.ammo >= d.mag || this.equipT < 0.8) return;
    this.cycleT = null;
    if (d.reloadStyle === 'shell') {
      this.reload = { shell: true, stage: 'in', t: 0, interrupt: false, needPump: this.ammo === 0 };
    } else {
      const empty = this.ammo === 0;
      this.reload = { t: 0, total: empty ? d.reloadEmpty : d.reload, empty, filled: false };
    }
    ctx.sounds?.cloth();
  }

  updateReload(dt, ctx) {
    const r = this.reload;
    if (!r) return;
    const d = this.def, s = ctx.sounds;
    const prev = r.t;
    r.t += dt;
    if (!r.shell) {
      const p0 = prev / r.total, p = r.t / r.total;
      if (crossed(p0, p, 0.2)) {
        s?.magOut();
        this.events.push({ type: 'magdrop', pos: transformPoint(this.root, add3(d.magPos, [0, -0.08, 0])), part: d.parts.find((q) => q.mag) });
      }
      if (crossed(p0, p, 0.6)) s?.magIn();
      if (p >= 0.64 && !r.filled) { r.filled = true; this.ammo = d.mag; }
      if (r.empty && crossed(p0, p, 0.8)) s?.bolt();
      if (p >= 1) this.reload = null;
      return;
    }
    if (r.stage === 'in') {
      if (r.t >= 0.28) { r.stage = 'load'; r.t = 0; }
    } else if (r.stage === 'load') {
      if (crossed(prev, r.t, d.shellTime * 0.62)) { this.ammo = Math.min(d.mag, this.ammo + 1); s?.shell(); }
      if (r.t >= d.shellTime) {
        r.t = 0;
        if (this.ammo >= d.mag || r.interrupt) r.stage = 'out';
      }
    } else if (r.stage === 'out') {
      const len = r.needPump ? 0.5 : 0.28;
      if (r.needPump && crossed(prev, r.t, 0.15)) s?.pump();
      if (r.t >= len) this.reload = null;
    }
  }

  updateCycle(dt, ctx) {
    if (this.cycleT === null) return;
    const prev = this.cycleT;
    this.cycleT += dt;
    const p0 = prev / this.cycleLen, p = this.cycleT / this.cycleLen;
    if (this.def.action === 'pump') {
      if (crossed(p0, p, 0)) ctx.sounds?.pump();
      if (crossed(p0, p, 0.38)) this.eject();
    } else {
      if (crossed(p0, p, 0.2)) ctx.sounds?.bolt();
      if (crossed(p0, p, 0.45)) this.eject();
    }
    if (p >= 1) this.cycleT = null;
  }

  spread(player) {
    const s = this.def.spread;
    let v = s.base + this.bloom;
    v += Math.min(player.hSpeed / 8, 1) * s.move;
    if (!player.grounded) v += s.air;
    if (player.crouching && !player.sliding) v *= 0.8;
    return v * lerp(1, s.ads, this.adsT);
  }

  // ---------------------------------------------------------------- viewmodel
  viewmodel(player, time) {
    const d = this.def;
    if (this.scoped) return [];
    const a = this.adsT, sp = this.sprintT, sl = this.slideT;

    const bob = player.bobAmt * (1 - a * 0.85);
    const bx = Math.cos(player.bobT) * 0.012 * bob;
    const by = -Math.abs(Math.sin(player.bobT)) * 0.014 * bob;
    const idle = Math.sin(time * 1.6) * 0.003 * (1 - a);
    const e = 1 - smooth(this.equipT);

    // --- animation channels ---
    let tilt = 0, rollDir = 1, bump = 0;
    let magOff = [0, 0, 0], magVisible = true, magRot = 0;
    let handT = 0, handTarget = d.foreGrip;
    let boltBack = 0, pumpBack = 0;
    let shellVisible = false, shellPos = d.magPos;

    const r = this.reload;
    if (r && !r.shell) {
      const p = r.t / r.total;
      tilt = seg(p, 0, 0.14) * (1 - seg(p, 0.86, 1));
      bump = seg(p, 0.58, 0.61) * (1 - seg(p, 0.61, 0.7));
      const hb = seg(p, 0.06, 0.16) * (1 - seg(p, 0.64, 0.74));
      if (p < 0.2) {
        magOff = [0, -0.07 * seg(p, 0.13, 0.2), 0.01];
      } else if (p < 0.36) {
        magVisible = false;
        magOff = [0, -0.4, 0];
      } else {
        const ins = seg(p, 0.38, 0.6);
        magOff = [0, -0.4 * (1 - ins), 0.04 * (1 - ins)];
        magRot = 0.4 * (1 - ins);
      }
      handT = hb;
      handTarget = add3(add3(d.magPos, magOff), [0, -0.05, 0]);
      if (r.empty || d.slide) {
        const bh = seg(p, 0.7, 0.78) * (1 - seg(p, 0.88, 0.95));
        if (bh > 0 && !d.slide) { handT = bh; handTarget = add3(d.bolt, [0.035, 0, 0.02]); }
        if (r.empty) boltBack = seg(p, 0.78, 0.82) * (1 - seg(p, 0.83, 0.86));
        if (d.slide && r.empty && p < 0.82) boltBack = 1;
      }
    } else if (r && r.shell) {
      rollDir = -1;
      if (r.stage === 'in') tilt = seg(r.t, 0, 0.28);
      else if (r.stage === 'load') {
        tilt = 1;
        const p = r.t / d.shellTime;
        const up = seg(p, 0, 0.45), push = seg(p, 0.45, 0.62), down = seg(p, 0.66, 1);
        shellPos = add3(d.magPos, [0.01, -0.3 * (1 - up) - 0.3 * down + 0.02 * push, 0.03 - 0.03 * push]);
        shellVisible = p < 0.62;
        bump = push * (1 - seg(p, 0.62, 0.75)) * 0.4;
        handT = 1;
        handTarget = add3(shellPos, [0, -0.035, 0.01]);
      } else {
        const len = r.needPump ? 0.5 : 0.28;
        tilt = 1 - seg(r.t, 0, Math.min(len, 0.3));
        handT = 1 - seg(r.t, 0, 0.15);
        handTarget = add3(d.magPos, [0, -0.3, 0]);
        if (r.needPump) pumpBack = seg(r.t, 0.12, 0.25) * (1 - seg(r.t, 0.3, 0.45));
      }
    }

    if (this.cycleT !== null && this.cycleT >= 0) {
      const p = this.cycleT / this.cycleLen;
      if (d.action === 'pump') {
        pumpBack = seg(p, 0, 0.38) * (1 - seg(p, 0.48, 0.9));
      } else {
        const hb = seg(p, 0, 0.15) * (1 - seg(p, 0.85, 1));
        handT = hb;
        handTarget = add3(d.bolt, [0.035, 0, 0.02]);
        boltBack = seg(p, 0.25, 0.45) * (1 - seg(p, 0.55, 0.72));
        tilt = 0.25 * hb;
      }
    }
    if (d.slide && this.ammo === 0 && !(r && r.t / r.total > 0.82)) boltBack = Math.max(boltBack, 1);
    boltBack = Math.max(boltBack, this.boltKick * 0.7);

    // --- root transform ---
    const hip = d.hip, adsPos = [0, -d.sightY, d.adsZ];
    const pos = [
      lerp(hip[0], adsPos[0], a) + bx + this.sway[0] - sp * 0.04 - tilt * 0.03 - sl * 0.05,
      lerp(hip[1], adsPos[1], a) + by + idle - this.sway[1] - tilt * 0.035 - sp * 0.04 + player.stepSmooth * 0.3 - e * 0.28 + bump * 0.012 - sl * 0.02,
      lerp(hip[2], adsPos[2], a) + this.vmKick * 0.04,
    ];
    const rot = [
      this.vmKick * 0.06 + tilt * 0.14 - sp * 0.25 + this.sway[1] * 2 - e * 0.9 + bump * 0.06,
      sp * 0.55 + this.sway[0] * 2 + tilt * 0.12 * rollDir,
      tilt * 0.5 * rollDir + sp * 0.15 - this.sway[0] * 1.5 + sl * 0.3,
    ];
    compose(this.root, pos, rot, [1, 1, 1]);

    const out = [];
    for (const p of this.parts) {
      if (p.hidden) continue;
      let c = p.c, rx = p.rx || 0;
      if (p.mag) {
        if (!magVisible) continue;
        c = add3(c, magOff);
        rx += magRot;
      }
      if (p.bolt) c = add3(c, [0, 0, (d.slide ? 0.04 : 0.05) * boltBack]);
      if (p.pump) c = add3(c, [0, 0, 0.09 * pumpBack]);
      compose(p.local, c, [rx, 0, 0], p.s);
      mul(p.model, this.root, p.local);
      out.push({ model: p.model, scale: p.s, color: p.col, emissive: p.em || 0 });
    }
    if (shellVisible) {
      const s = [0.024, 0.024, 0.06];
      compose(this.tmp, shellPos, [0, 0, 0], s);
      const m = mat4();
      mul(m, this.root, this.tmp);
      out.push({ model: m, scale: s, color: RED, emissive: 0.3 });
    }

    // --- hands & arms ---
    let left = d.foreGrip;
    if (d.action === 'pump') left = add3(left, [0, 0, 0.09 * pumpBack]);
    left = lerp3(left, handTarget, handT);
    const right = d.grip;
    const glove = [0.05, 0.09, 0.13];
    const palm = [0.085, 0.07, 0.1];
    const hm = this.handModels;
    compose(this.tmp, add3(left, [-0.042, -0.03, 0]), [0.1, 0, -0.25], glove);
    mul(hm[0], this.root, this.tmp);
    out.push({ model: hm[0], scale: glove, color: GLOVE, emissive: 0.25 });
    compose(this.tmp, add3(right, [0.004, -0.01, 0.005]), [-0.3, 0, 0], palm);
    mul(hm[1], this.root, this.tmp);
    out.push({ model: hm[1], scale: palm, color: GLOVE, emissive: 0.25 });

    const lv = transformPoint(this.root, left), rv = transformPoint(this.root, right);
    const lShoulder = lerp3([-0.32, -0.62, 0.0], [-0.24, -0.55, 0.05], a);
    const rShoulder = lerp3([0.34, -0.5, 0.12], [0.16, -0.46, 0.18], a);
    [[lv, lShoulder, hm[2]], [rv, rShoulder, hm[3]]].forEach(([hand, sh, m]) => {
      const d0 = [sh[0] - hand[0], sh[1] - hand[1], sh[2] - hand[2]];
      const l0 = Math.hypot(...d0);
      const h = hand.map((v, k) => v + d0[k] / l0 * 0.075); // start the sleeve at the wrist
      const dir = [sh[0] - h[0], sh[1] - h[1], sh[2] - h[2]];
      const len = Math.hypot(...dir);
      const c = [h[0] + dir[0] * 0.5, h[1] + dir[1] * 0.5, h[2] + dir[2] * 0.5];
      const s = [0.075, 0.075, len];
      compose(m, c, anglesFor(dir), s);
      out.push({ model: m, scale: s, color: SLEEVE, emissive: 0 });
    });

    if (this.flash > 0) {
      const f = hm[4], s = [0.09, 0.09, 0.12];
      compose(this.tmp, add3(d.muzzle, [0, 0, -0.06]), [0, 0, Math.random() * Math.PI], s);
      mul(f, this.root, this.tmp);
      out.push({ model: f, scale: s, color: FLASH, emissive: 1 });
    }
    return out;
  }

  // gun parts for display in the world (weapon cases)
  static worldParts(def, matrix) {
    const local = mat4();
    return def.parts.filter((p) => !p.hidden).map((p) => {
      compose(local, p.c, [p.rx || 0, 0, 0], p.s);
      const m = mat4();
      mul(m, matrix, local);
      return { model: m, scale: p.s, color: p.col, emissive: p.em || 0 };
    });
  }
}
