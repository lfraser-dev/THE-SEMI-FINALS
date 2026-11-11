// A held weapon: firing, recoil, spread, reloads (mag / shell-by-shell), pump & bolt
// cycling, equip animation, and the first-person viewmodel with hands.
import { compose, mul, mat4, damp, clamp, lerp, anglesFor, spring } from './math.js';

const GLOVE = [0.3, 0.29, 0.27];
const SLEEVE = [0.22, 0.24, 0.25];
const FLASH = [1, 0.93, 0.75];
const RED = [0.95, 0.12, 0.1];

const smooth = (t) => t * t * (3 - 2 * t);
const seg = (t, a, b) => smooth(clamp((t - a) / (b - a), 0, 1));
const crossed = (prev, now, at) => prev < at && now >= at;

// Which mesh each gun part uses: tubes are cylinders, everything else gets softly rounded edges.
const ROUND = /^(barrel|muzzle|tube|scope|scopeF|scBody|scBell|scEye|lens|scLens|suppressor|supRing|supCap|choke|compensator|bead|shell|front)$/;
export function partShape(p) {
  if (p.shape !== undefined) return p.shape;
  if (ROUND.test(p.name) || (p.name === 'brake' && p.s[0] === p.s[1])) return 'cyl';
  const m = Math.min(...p.s);
  if (m < 0.006) return undefined;                 // tiny details stay crisp
  return Math.min(0.014, m * 0.3);                  // rounded edges scaled to the part
}
// how long each gun's draw animation takes (s)
const DRAW_TIME = { pistol: 0.85, smg: 0.85, ar: 1.05, shotgun: 1.05, sniper: 1.1, lmg: 1.1 };
// moments in each draw animation that get a sound + camera jolt: [time, sound, jolt]
const DRAW_BEATS = {
  pistol: [[0.0, 'spin', 0], [0.5, 'catch', 0.5], [0.56, 'spin', 0], [0.8, 'click', 0.25], [0.88, 'bolt', 0.2]],
  smg: [[0.0, 'spin', 0], [0.2, 'spin', 0], [0.47, 'catch', 0.5], [0.62, 'magIn', 0.4], [0.86, 'click', 0.2]],
  ar: [[0.0, 'spin', 0], [0.35, 'catch', 0.6], [0.47, 'bolt', 0.3], [0.58, 'cloth', 0], [0.82, 'click', 0.35]],
  shotgun: [[0.05, 'cloth', 0], [0.3, 'spin', 0], [0.45, 'pump', 0.4], [0.6, 'catch', 0.9], [0.66, 'pump', 0.7], [0.92, 'click', 0.2]],
  sniper: [[0.0, 'spin', 0], [0.36, 'catch', 0.6], [0.48, 'bolt', 0.4], [0.68, 'cloth', 0], [0.9, 'click', 0.2]],
  lmg: [[0.05, 'cloth', 0], [0.4, 'land', 1.0], [0.55, 'magIn', 0.7], [0.68, 'cloth', 0], [0.9, 'click', 0.3]],
};

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
    this.swayV = [0, 0];
    this.lag = [0, 0, 0];      // inertia: the gun trails your movement a little
    this.lagV = [0, 0, 0];
    this.mantleT = 0;          // traversal poses (blend 0..1)
    this.vaultT = 0;
    this.wallT = 0;
    this.wallSide = 1;
    this.dashT = 0;
    this.slamT = 0;
    this.grapT = 0;
    this.equipT = 1;
    this.queued = 0;
    this.events = [];
    this.root = mat4();
    this.tmp = mat4();
    this.magFrame = mat4();
    this.parts = def.parts.map((p) => ({ ...p, shape: partShape(p), model: mat4(), local: mat4() }));
    // gun length (for the shine sweep): stock end to muzzle end
    this.zBack = Math.max(...def.parts.filter((p) => !p.hidden).map((p) => p.c[2] + p.s[2] / 2));
    this.zFront = Math.min(...def.parts.filter((p) => !p.hidden).map((p) => p.c[2] - p.s[2] / 2));
    this.handModels = Array.from({ length: 9 }, () => mat4());
  }

  // swap in a new definition (e.g. after changing attachments); refills the gun
  setDef(def) {
    this.def = def;
    this.parts = def.parts.map((p) => ({ ...p, shape: partShape(p), model: mat4(), local: mat4() }));
    // gun length (for the shine sweep): stock end to muzzle end
    this.zBack = Math.max(...def.parts.filter((p) => !p.hidden).map((p) => p.c[2] + p.s[2] / 2));
    this.zFront = Math.min(...def.parts.filter((p) => !p.hidden).map((p) => p.c[2] - p.s[2] / 2));
    this.ammo = def.mag;
    this.reload = null;
    this.cycleT = null;
  }

  // laser emitter position in view space (after viewmodel() ran this frame), or null
  laserPoint() { return this.def.laser ? transformPoint(this.root, this.def.laser) : null; }
  // any gun-local point in view space (uses the pose from the last viewmodel() call)
  gunPoint(p) { return transformPoint(this.root, p); }

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

  drawEvents(q0, q1, ctx) {
    for (const [at, snd, jolt] of DRAW_BEATS[this.def.style || this.def.id] || []) {
      if (!crossed(q0, q1, at)) continue;
      if (snd === 'click') ctx.sounds?.click(2600, 0.3, 4); else ctx.sounds?.[snd]?.();
      if (jolt) this.events.push({ type: 'jolt', amt: jolt });
    }
  }

  // ctx = { fire(weapon), sounds }
  update(dt, input, player, ctx) {
    const d = this.def;
    const eq0 = this.equipT;
    this.equipT = Math.min(1, this.equipT + dt / (DRAW_TIME[d.style || d.id] || 0.5));
    if (eq0 < 1) this.drawEvents(eq0, this.equipT, ctx);

    const tr = player.trav;
    const wantAds = input.aiming && !player.sprinting && !this.reload && this.equipT > 0.5 && !tr;
    const climb = tr?.kind === 'mantle' || tr?.kind === 'hang' || player.press != null;
    this.mantleT += ((climb ? 1 : 0) - this.mantleT) * damp(tr ? 18 : 9, dt);
    const wr = player.wallRun;
    this.wallT += ((wr ? 1 : 0) - this.wallT) * damp(12, dt);
    if (wr) this.wallSide = wr.side;
    this.dashT += ((player.dash ? 1 : 0) - this.dashT) * damp(player.dash ? 30 : 8, dt);
    this.slamT += ((player.slam?.phase === 'fall' ? 1 : 0) - this.slamT) * damp(14, dt);
    const gp = player.grapple && player.grapple.phase !== 'miss';
    this.grapT += ((gp ? 1 : 0) - this.grapT) * damp(gp ? 20 : 10, dt);
    this.vaultT += ((tr?.kind === 'vault' ? 1 : 0) - this.vaultT) * damp(tr ? 20 : 9, dt);
    this.adsT += ((wantAds ? 1 : 0) - this.adsT) * damp(d.adsSpeed, dt);
    this.sprintT += ((player.sprinting && !this.reload ? 1 : 0) - this.sprintT) * damp(10, dt);
    this.slideT += ((player.sliding ? 1 : 0) - this.slideT) * damp(9, dt);
    this.player = player;

    if (input.hit('KeyR')) this.startReload(ctx);
    this.updateReload(dt, ctx);
    this.updateCycle(dt, ctx);

    this.cool -= dt;
    this.sinceShot += dt;
    if (input.fireHit) this.queued = 0.18; // click buffer for semi-autos
    this.queued -= dt;
    let trigger = d.auto ? input.fireDown : this.queued > 0;
    // burst guns: a click starts a burst, which then fires itself out
    if (d.burst) {
      if (trigger && !(this.burstLeft > 0) && this.cool <= 0 && this.ammo > 0 && !this.reload) this.burstLeft = d.burst;
      if (this.ammo <= 0 || this.reload) this.burstLeft = 0;
      trigger = this.burstLeft > 0 || (trigger && this.ammo <= 0);
    }

    if (trigger && this.reload?.shell && this.ammo > 0) this.reload.interrupt = true;
    // the show-off end of a draw never gets in the way: shoot or aim and it snaps straight to ready
    if (this.equipT >= 0.5 && this.equipT < 1 && (trigger || input.aiming)) this.equipT = 1;
    const blocked = this.reload || this.equipT < 0.5 || this.cycleT !== null || tr || this.mantleT + this.vaultT > 0.3;
    if (trigger && !blocked && this.cool <= 0) {
      if (this.ammo > 0) this.shoot(ctx);
      else if (input.fireHit) { ctx.sounds?.dry(); this.startReload(ctx); }
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
    this.vmRollKick = (this.vmRollKick || 0) * Math.exp(-14 * dt);
    this.boltKick -= this.boltKick * damp(28, dt);
    // springy sway from mouse look
    const swayT = [clamp(-input.dx * 0.0005, -0.04, 0.04), clamp(input.dy * 0.0005, -0.04, 0.04)];
    for (let k = 0; k < 2; k++) [this.sway[k], this.swayV[k]] = spring(this.sway[k], this.swayV[k], swayT[k], 160, 17, dt);
    // movement inertia, in view space (right / up / forward)
    const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw), v = player.vel;
    const vr = v[0] * cy - v[2] * sy, vf = -v[0] * sy - v[2] * cy;
    const ads = 1 - this.adsT * 0.8;
    const lagT = [
      clamp(-vr * 0.0032, -0.025, 0.025) * ads,
      clamp(-v[1] * 0.0035, -0.03, 0.03) * ads,
      clamp(vf * 0.0016, -0.012, 0.016) * ads,
    ];
    for (let k = 0; k < 3; k++) [this.lag[k], this.lagV[k]] = spring(this.lag[k], this.lagV[k], lagT[k], 90, 13, dt);
  }

  shoot(ctx) {
    const d = this.def;
    this.queued = 0;
    this.cool = Math.max(this.cool, 0) + 60 / d.rpm;
    if (d.burst) { this.burstLeft--; if (this.burstLeft <= 0) this.cool += d.burstGap; }
    this.ammo--;
    this.sinceShot = 0;
    ctx.fire(this);
    const am = lerp(1, 0.55, this.adsT);
    // shooting mid-slide: no stable stance, so two-handed guns kick a lot harder
    const sliding = this.player?.sliding;
    const sm = sliding ? (d.oneHanded ? 1.0 : 1.8) : 1;
    this.kick = Math.min(this.kick + d.recoil.up * am * sm, 0.22);
    this.kickYaw += (Math.random() - 0.45) * d.recoil.side * am * (sliding && !d.oneHanded ? 2.2 : 1);
    this.bloom = Math.min(this.bloom + d.spread.bloom * sm, d.spread.bloomMax * sm);
    this.flash = 0.045;
    this.vmKick = d.recoil.vm * (sliding && !d.oneHanded ? 1.7 : 1);
    this.vmRollKick = sliding && !d.oneHanded ? (Math.random() - 0.3) * 0.12 : 0;
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
      if (crossed(p0, p, 0.6)) { s?.magIn(); this.events.push({ type: 'jolt', amt: 0.6 }); }
      if (r.empty && !d.slide && crossed(p0, p, 0.82)) this.events.push({ type: 'jolt', amt: 0.8 });
      if (r.empty && d.slide && crossed(p0, p, 0.82)) { s?.bolt(); this.events.push({ type: 'jolt', amt: 0.5 }); }
      if (p >= 0.64 && !r.filled) { r.filled = true; this.ammo = d.mag; }
      if (crossed(p0, p, 0.36)) s?.spin();
      if (crossed(p0, p, 0.87)) s?.spin();
      if (crossed(p0, p, 0.985)) { s?.catch?.(); this.events.push({ type: 'jolt', amt: 0.35 }); }
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
      const len = r.needPump ? 0.62 : 0.34;
      if (r.needPump && crossed(prev, r.t, 0.15)) { s?.pump(); this.events.push({ type: 'jolt', amt: 0.7 }); }
      if (crossed(prev, r.t, r.needPump ? 0.24 : 0.02)) s?.spin();
      if (crossed(prev, r.t, len - 0.06)) { s?.catch?.(); this.events.push({ type: 'jolt', amt: 0.4 }); }
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
    if (player.sliding && !this.def.oneHanded) v += 0.012;  // two-handed guns are shaky mid-slide
    if (player.crouching && !player.sliding) v *= 0.8;
    return v * lerp(this.def.hipSpread ?? 1, s.ads, this.adsT);
  }

  // ---------------------------------------------------------------- viewmodel
  viewmodel(player, time) {
    const d = this.def;
    if (this.scoped) return [];
    const a = this.adsT, sp = this.sprintT;
    const na = 1 - a;                               // pose offsets fade out while aiming so sights line up
    const sl = this.slideT * na;
    const one = !!d.oneHanded;
    const sl2 = one ? 0 : sl, sl1 = one ? sl : 0;   // two-handed: cant + tuck, one-handed: arm out

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

    // extra flourish offsets on top of everything: pos xyz + rot xyz
    const fl = [0, 0, 0, 0, 0, 0];
    let magSpin = 0, shellSpin = 0;
    let shine = -1;                                 // 0..1 = a highlight sweeping from the stock to the muzzle
    const heavy = (d.style || d.id) === 'lmg', pistol = !!d.slide || (d.style || d.id) === 'pistol';

    const r = this.reload;
    if (r && !r.shell) {
      const p = r.t / r.total;
      // roll the gun in hard so the mag well faces you
      tilt = seg(p, 0, 0.12) * (1 - seg(p, 0.86, 1)) * (heavy ? 0.85 : 1);
      fl[1] += seg(p, 0, 0.12) * (1 - seg(p, 0.86, 1)) * 0.025;
      // wrist flick that throws the old mag clear
      const flick = seg(p, 0.15, 0.2) * (1 - seg(p, 0.2, 0.34));
      fl[5] += flick * 0.22; fl[1] += flick * 0.02; fl[3] -= flick * 0.1;
      // mag slap: the whole gun jolts up
      bump = seg(p, 0.565, 0.595) * (1 - seg(p, 0.6, 0.74));
      fl[3] += bump * 0.16; fl[1] += bump * 0.025; fl[5] -= bump * 0.08;
      const hb = seg(p, 0.06, 0.14) * (1 - seg(p, 0.64, 0.74));
      if (p < 0.2) {
        magOff = [0, -0.07 * seg(p, 0.13, 0.2), 0.01];
      } else if (p < 0.34) {
        magVisible = false;
        magOff = [0, -0.45, 0];
      } else {
        // fresh mag comes up from the pouch with a twirl, then gets seated
        const rise = seg(p, 0.34, 0.47), ins = seg(p, 0.47, 0.58);
        magOff = [0.05 * (1 - rise), -0.45 + 0.33 * rise + 0.12 * ins, 0.07 * (1 - ins)];
        magRot = 0.55 * (1 - ins) + (heavy ? 0 : (1 - rise) * Math.PI * 2);   // end-over-end tumble
        magSpin = heavy ? 0 : (1 - rise) * Math.PI * 2;
        fl[1] += Math.sin(Math.PI * rise) * 0.02;
      }
      handT = hb;
      handTarget = add3(add3(d.magPos, magOff), [0, -0.05, 0]);
      if (r.empty && !pistol) {
        // charging handle: counter-roll the gun, rip the handle back, let it slam home
        const bh = seg(p, 0.68, 0.76) * (1 - seg(p, 0.88, 0.95));
        if (bh > 0) { handT = bh; handTarget = add3(d.bolt || [0.04, 0.02, 0.02], [0.035, 0, 0.02]); }
        const over = seg(p, 0.66, 0.76) * (1 - seg(p, 0.86, 0.97));
        fl[5] -= over * 0.75; fl[3] -= over * 0.3; fl[4] -= over * 0.1; fl[0] -= over * 0.02; fl[1] += over * 0.02;
        boltBack = seg(p, 0.77, 0.81) * (1 - seg(p, 0.82, 0.85));
        fl[3] += seg(p, 0.82, 0.84) * (1 - seg(p, 0.84, 0.93)) * 0.14;
      }
      if (pistol) {
        if (r.empty && p < 0.82) boltBack = 1;
        const tw = r.empty ? seg(p, 0.82, 0.985) : seg(p, 0.74, 0.96);
        fl[5] += tw * Math.PI * 2;                                    // full twirl around the barrel
        fl[3] -= tw * Math.PI * 2;                                    // ...and a gunslinger spin around the trigger
        fl[1] += Math.sin(Math.PI * tw) * 0.06;
      }
      // finisher: a full barrel roll with a little toss (LMG: a heavy hip bounce), a shine sweeps along the gun
      const fin = seg(p, 0.87, 0.985);
      if (!pistol) {
        if (heavy) { fl[1] += Math.sin(Math.PI * fin) * 0.05; fl[3] += Math.sin(Math.PI * fin) * 0.22; fl[5] += Math.sin(Math.PI * 2 * fin) * 0.25; }
        else { fl[5] += fin * Math.PI * 2; fl[1] += Math.sin(Math.PI * fin) * 0.045; fl[3] += Math.sin(Math.PI * fin) * 0.12; }
      }
      if (p > 0.86) shine = seg(p, 0.86, 1);
      // springy settle at the end
      const q = p - 0.985;
      if (q > 0) fl[5] += Math.sin(q * 90) * Math.exp(-q * 40) * 0.08;
    } else if (r && r.shell) {
      rollDir = -1;
      if (r.stage === 'in') {
        const k = seg(r.t, 0, 0.28);
        tilt = k;
        fl[4] += k * 0.18; fl[3] += k * 0.06;         // flip the loading port up toward you
      } else if (r.stage === 'load') {
        tilt = 1;
        fl[4] += 0.18; fl[3] += 0.06;
        const p = r.t / d.shellTime;
        const up = seg(p, 0, 0.45), push = seg(p, 0.45, 0.62), down = seg(p, 0.66, 1);
        shellPos = add3(d.magPos, [0.01 + 0.035 * (1 - up), -0.3 * (1 - up) - 0.3 * down + 0.02 * push, 0.03 - 0.03 * push]);
        shellSpin = (1 - up) * Math.PI * 1.5;           // the shell flips between your fingers
        shellVisible = p < 0.62;
        bump = push * (1 - seg(p, 0.62, 0.75)) * 0.55;
        fl[5] += bump * 0.12 * (this.ammo % 2 ? 1 : -1); // gun rocks with each shell
        handT = 1;
        handTarget = add3(shellPos, [0, -0.035, 0.01]);
      } else {
        const len = r.needPump ? 0.62 : 0.34;
        const back = 1 - seg(r.t, 0, Math.min(len, 0.3));
        tilt = back;
        fl[4] += 0.18 * back; fl[3] += 0.06 * back;
        handT = 1 - seg(r.t, 0, 0.15);
        handTarget = add3(d.magPos, [0, -0.3, 0]);
        if (r.needPump) {
          pumpBack = seg(r.t, 0.12, 0.25) * (1 - seg(r.t, 0.3, 0.45));
          const whip = seg(r.t, 0.1, 0.22) * (1 - seg(r.t, 0.3, 0.5));   // whip the gun to rack it
          fl[3] += whip * 0.4; fl[1] += whip * 0.045; fl[5] -= whip * 0.25;
          const sc = seg(r.t, 0.24, 0.54);                               // spin-cock: full flip over the hand
          fl[3] += sc * Math.PI * 2; fl[1] += Math.sin(Math.PI * sc) * 0.08;
          shine = seg(r.t, 0.4, 0.62);
        } else {
          const rl = seg(r.t, 0.02, 0.28);                                // topped up: a quick barrel roll
          fl[5] -= rl * Math.PI * 2; fl[1] += Math.sin(Math.PI * rl) * 0.03;
          shine = seg(r.t, 0.12, 0.34);
        }
        const q = r.t - (len - 0.06);
        if (q > 0) fl[5] += Math.sin(q * 60) * Math.exp(-q * 20) * 0.07;
      }
    }

    // ---- draw animations: every gun has its own entrance ----
    if (this.equipT < 1) {
      const q = this.equipT;
      const settle = (t0, amp, f = 55, k = 18) => { const u = q - t0; return u > 0 ? Math.sin(u * f) * Math.exp(-u * k) * amp : 0; };
      const TAU = Math.PI * 2;
      const style = d.style || d.id;
      if (style === 'pistol') {
        // flipped up from the hip with two flips and a roll, caught, gunslinger twirl, press check
        const up = seg(q, 0, 0.32), fall = seg(q, 0.32, 0.5);
        fl[1] += -0.36 * (1 - up) + 0.13 * up * (1 - fall);
        fl[0] += 0.1 * (1 - up);
        fl[3] += (1 - seg(q, 0, 0.5)) * TAU * 2;
        fl[5] += (1 - seg(q, 0, 0.5)) * TAU;
        const tw = seg(q, 0.56, 0.78);
        fl[3] -= tw * TAU; fl[1] += Math.sin(Math.PI * tw) * 0.04; fl[0] += Math.sin(Math.PI * tw) * 0.02;
        fl[3] += settle(0.5, 0.12, 50, 16) + settle(0.78, 0.08, 50, 16);
        boltBack = Math.max(boltBack, seg(q, 0.86, 0.9) * (1 - seg(q, 0.91, 0.97)));
        shine = q > 0.78 ? seg(q, 0.78, 1) : -1;
      } else if (style === 'smg') {
        // lobbed in with a double front flip, caught, turned to show it off, mag slapped
        const up = seg(q, 0, 0.47);
        fl[1] += -0.34 * (1 - up) + Math.sin(Math.PI * up) * 0.12;
        fl[0] -= (1 - up) * 0.12;
        fl[3] += (1 - up) * TAU * 2;
        fl[2] += (1 - up) * 0.08;
        const show = seg(q, 0.5, 0.6) * (1 - seg(q, 0.74, 0.86));
        fl[4] -= show * 0.75; fl[5] -= show * 0.55; fl[0] -= show * 0.06; fl[1] += show * 0.03; fl[2] -= show * 0.04;
        const slap = seg(q, 0.56, 0.62) * (1 - seg(q, 0.64, 0.74));
        handT = Math.max(handT, slap);
        if (slap > 0) handTarget = add3(d.magPos, [0, -0.06, 0]);
        fl[1] += seg(q, 0.61, 0.63) * (1 - seg(q, 0.63, 0.7)) * 0.025;
        fl[5] += settle(0.47, 0.18, 45, 14) + settle(0.86, 0.08);
        shine = q > 0.58 ? seg(q, 0.58, 0.84) : -1;
      } else if (style === 'ar') {
        // tossed in from the bottom right with a full barrel roll, caught, racked, shown off, snapped to ready
        const toss = seg(q, 0, 0.35);
        fl[0] += (1 - toss) * 0.3;
        fl[1] += -(1 - toss) * 0.32 + Math.sin(Math.PI * toss) * 0.1;
        fl[4] += (1 - toss) * 1.2;
        fl[5] += (1 - toss) * TAU;
        fl[3] += settle(0.35, 0.14, 45, 14);
        const rack = seg(q, 0.38, 0.45) * (1 - seg(q, 0.52, 0.6));
        fl[5] -= rack * 0.6; fl[3] += rack * 0.1;
        handT = Math.max(handT, rack);
        if (rack > 0) handTarget = add3(d.bolt || [0.04, 0.02, 0.02], [0.035, 0, 0.02]);
        boltBack = Math.max(boltBack, seg(q, 0.45, 0.49) * (1 - seg(q, 0.5, 0.54)));
        const show = seg(q, 0.57, 0.66) * (1 - seg(q, 0.8, 0.88));
        fl[4] -= show * 0.95; fl[5] -= show * 0.45; fl[3] += show * 0.12; fl[0] -= show * 0.07; fl[1] += show * 0.04; fl[2] -= show * 0.05;
        fl[5] += settle(0.88, 0.1);
        shine = q > 0.6 ? seg(q, 0.6, 0.86) : -1;
      } else if (style === 'shotgun') {
        // brought up from low, spun over the hand (spin-cock), slammed, racked again, rested muzzle-up for a beat
        const up = seg(q, 0, 0.3);
        fl[1] -= (1 - up) * 0.32; fl[3] -= (1 - up) * 0.7; fl[5] += (1 - up) * 0.4;
        const sc = seg(q, 0.3, 0.6);
        fl[3] += sc * TAU; fl[1] += Math.sin(Math.PI * sc) * 0.1; fl[2] -= Math.sin(Math.PI * sc) * 0.05;
        pumpBack = Math.max(pumpBack, seg(q, 0.4, 0.46) * (1 - seg(q, 0.5, 0.56)), seg(q, 0.64, 0.68) * (1 - seg(q, 0.7, 0.76)));
        const whip = seg(q, 0.62, 0.68) * (1 - seg(q, 0.72, 0.8));
        fl[3] += whip * 0.4; fl[1] += whip * 0.05; fl[5] -= whip * 0.25;
        const rest = seg(q, 0.76, 0.84) * (1 - seg(q, 0.9, 0.97));
        fl[3] += rest * 0.65; fl[1] += rest * 0.05; fl[5] += rest * 0.3;
        fl[3] += settle(0.6, 0.12, 45, 14) + settle(0.97, 0.06);
        shine = q > 0.74 ? seg(q, 0.74, 0.95) : -1;
      } else if (style === 'sniper') {
        // thrown up spinning around the barrel, caught, bolt worked with a big roll, tilted up so the glass glints
        const toss = seg(q, 0, 0.36);
        fl[1] += -0.32 * (1 - toss) + Math.sin(Math.PI * toss) * 0.11;
        fl[3] -= (1 - toss) * 0.5;
        fl[5] += (1 - toss) * TAU;
        fl[3] += settle(0.36, 0.12, 40, 13);
        const work = seg(q, 0.4, 0.46) * (1 - seg(q, 0.58, 0.66));
        handT = Math.max(handT, work);
        if (work > 0) handTarget = add3(d.bolt || [0.04, 0.02, 0.02], [0.035, 0, 0.02]);
        boltBack = Math.max(boltBack, seg(q, 0.46, 0.52) * (1 - seg(q, 0.54, 0.6)));
        fl[5] += work * 0.5;
        const look = seg(q, 0.64, 0.72) * (1 - seg(q, 0.84, 0.92));
        fl[3] += look * 0.3; fl[4] -= look * 0.35; fl[1] += look * 0.03;
        fl[5] += settle(0.92, 0.07);
        shine = q > 0.66 ? seg(q, 0.66, 0.9) : -1;
      } else {
        // LMG: heaved up and dropped with a thud, feed cover slapped, then a heavy swagger bounce
        const heave = seg(q, 0, 0.4);
        fl[0] -= (1 - heave) * 0.22; fl[1] -= (1 - heave) * 0.38 - Math.sin(Math.PI * heave) * 0.08;
        fl[4] -= (1 - heave) * 0.7; fl[5] -= (1 - heave) * 0.6;
        const thud = seg(q, 0.4, 0.43) * (1 - seg(q, 0.43, 0.56));
        fl[1] -= thud * 0.05; fl[3] -= thud * 0.14;
        const slap = seg(q, 0.46, 0.53) * (1 - seg(q, 0.57, 0.66));
        handT = Math.max(handT, slap);
        if (slap > 0) handTarget = [0, 0.09, 0.02];
        fl[1] -= seg(q, 0.54, 0.56) * (1 - seg(q, 0.56, 0.64)) * 0.03;
        const sw = seg(q, 0.66, 0.9);
        fl[5] += Math.sin(sw * Math.PI * 2) * 0.3 * (1 - sw * 0.5); fl[1] += Math.sin(sw * Math.PI) * 0.04; fl[4] += Math.sin(sw * Math.PI) * 0.25;
        fl[3] += settle(0.43, 0.08, 35, 10) + settle(0.9, 0.05, 35, 10);
        shine = q > 0.66 ? seg(q, 0.66, 0.92) : -1;
      }
    }

    if (this.cycleT !== null && this.cycleT >= 0) {
      const p = this.cycleT / this.cycleLen;
      if (d.action === 'pump') {
        pumpBack = seg(p, 0, 0.38) * (1 - seg(p, 0.48, 0.9));
        fl[3] += pumpBack * 0.1; fl[5] -= pumpBack * 0.12;            // rack with a little whip
      } else {
        const hb = seg(p, 0, 0.15) * (1 - seg(p, 0.85, 1));
        handT = hb;
        handTarget = add3(d.bolt || [0.04, 0.02, 0.02], [0.035, 0, 0.02]);
        boltBack = seg(p, 0.25, 0.45) * (1 - seg(p, 0.55, 0.72));
        tilt = 0.4 * hb;
        fl[5] += hb * 0.25; fl[3] += seg(p, 0.55, 0.62) * (1 - seg(p, 0.62, 0.8)) * 0.08;   // roll in, snap the bolt home
      }
    }
    if (d.slide && this.ammo === 0 && !(r && r.t / r.total > 0.82)) boltBack = Math.max(boltBack, 1);
    boltBack = Math.max(boltBack, this.boltKick * 0.7);

    // --- root transform ---
    const hip = d.hip, adsPos = [0, -d.sightY, d.adsZ];
    const mt = this.mantleT, vt = this.vaultT, lag = this.lag, wt = this.wallT * this.wallSide * na;
    const dt_ = this.dashT * na, st = this.slamT, gt = this.grapT * na;
    const land = player.landOff;
    // sprint gets a bigger figure-8 swing so running reads clearly
    const sx = Math.sin(player.bobT) * 0.018 * sp * player.bobAmt;
    const syb = -Math.abs(Math.cos(player.bobT)) * 0.012 * sp * player.bobAmt;
    const pos = [
      lerp(hip[0], adsPos[0], a) + bx + sx + this.sway[0] + lag[0] - sp * 0.04 - tilt * 0.12 - sl2 * 0.07 + sl1 * 0.02 + mt * 0.04 + vt * 0.07,
      lerp(hip[1], adsPos[1], a) + by + syb + idle - this.sway[1] + lag[1] + tilt * 0.075 - sp * 0.04 + player.stepSmooth * 0.3 + land * 0.35
        + bump * 0.012 - sl2 * 0.035 + sl1 * 0.01 - mt * 0.1 - vt * 0.08,
      lerp(hip[2], adsPos[2], a) + this.vmKick * 0.04 + lag[2] + mt * 0.06 + vt * 0.03 + dt_ * 0.06 + sl2 * 0.05 - sl1 * 0.07,
    ];
    pos[0] += gt * 0.03 + st * 0.02 + fl[0];
    pos[1] += -dt_ * 0.03 - st * 0.06 - gt * 0.02 + fl[1];
    pos[2] += fl[2];
    const rot = [
      this.vmKick * 0.06 + tilt * 0.12 - sp * 0.25 + this.sway[1] * 2 + bump * 0.06 + land * 0.9 - mt * 0.55 - vt * 0.3 - lag[1] * 2
        - dt_ * 0.12 - st * 0.45 + sl2 * 0.08 + this.vmKick * 0.05 * sl2,
      sp * 0.55 + this.sway[0] * 2 + tilt * 0.3 * rollDir + mt * 0.25 - vt * 0.4 + lag[0] * 2.5 + sl2 * 0.12 - sl1 * 0.06,
      tilt * 0.45 * rollDir + sp * 0.15 - this.sway[0] * 1.5 + sl2 * 0.55 - sl1 * 0.3 + mt * 0.35 + vt * 0.75 - lag[0] * 3 + wt * 0.3
        + (this.vmRollKick || 0)
        + dt_ * 0.35 + gt * 0.25,
    ];
    rot[0] += fl[3]; rot[1] += fl[4]; rot[2] += fl[5];
    compose(this.root, pos, rot, [1, 1, 1]);

    const out = [];
    // the magazine (all its parts) moves and spins as one piece around its own centre
    const mp = d.magPos;
    compose(this.magFrame, add3(mp, magOff), [magRot, 0, magSpin], [1, 1, 1]);
    for (const p of this.parts) {
      if (p.hidden) continue;
      let c = p.c;
      const rx = p.rx || 0, ry = p.ry || 0, rz = p.rz || 0;
      if (p.bolt) c = add3(c, [0, 0, (d.slide ? 0.04 : 0.05) * boltBack]);
      if (p.pump) c = add3(c, [0, 0, 0.09 * pumpBack]);
      if (p.mag) {
        if (!magVisible) continue;
        compose(this.tmp, [c[0] - mp[0], c[1] - mp[1], c[2] - mp[2]], [rx, ry, rz], p.s);
        mul(p.local, this.magFrame, this.tmp);
      } else compose(p.local, c, [rx, ry, rz], p.s);
      mul(p.model, this.root, p.local);
      if (shine >= 0) {
        const zS = this.zBack + (this.zFront - this.zBack) * shine;
        const k = Math.exp(-(((p.c[2] - zS) / 0.06) ** 2)) * Math.sin(Math.PI * shine);
        if (k > 0.02) {
          const col = p.shineCol || (p.shineCol = [0, 0, 0]);
          for (let n = 0; n < 3; n++) col[n] = p.col[n] + (1 - p.col[n]) * k * 0.7;
          out.push({ model: p.model, scale: p.s, color: col, emissive: Math.max(p.em || 0, k * 0.55), shape: p.shape, mat: p.m });
          continue;
        }
      }
      out.push({ model: p.model, scale: p.s, color: p.col, emissive: p.em || 0, shape: p.shape, mat: p.m });
    }
    if (shellVisible) {
      const s = [0.024, 0.024, 0.06];
      compose(this.tmp, shellPos, [shellSpin, 0, 0], s);
      const m = mat4();
      mul(m, this.root, this.tmp);
      out.push({ model: m, scale: s, color: RED, emissive: 0.3, shape: 'cyl' });
    }

    // --- hands & arms ---
    let left = d.foreGrip;
    if (d.action === 'pump') left = add3(left, [0, 0, 0.09 * pumpBack]);
    left = lerp3(left, handTarget, handT);
    const right = d.grip;
    const glove = [0.05, 0.09, 0.13];
    const palm = [0.085, 0.07, 0.1];
    const hm = this.handModels;
    // left hand leaves the gun to plant on the ledge / wall top during mantles and vaults
    const plant = this.plantTarget(player);
    let lv = transformPoint(this.root, left);
    if (plant && plant.t > 0.001) {
      const h = plant.t;
      const onGun = transformPoint(this.root, add3(left, [-0.042, -0.03, 0]));
      const hp = lerp3(onGun, plant.pos, h);
      const gr = [rot[0] + 0.1, rot[1], rot[2] - 0.25];
      compose(hm[0], hp, lerp3(gr, plant.rot, smooth(h)), glove);
      lv = lerp3(lv, add3(plant.pos, [0.03, 0.02, 0.02]), h);
    } else {
      compose(this.tmp, add3(left, [-0.042, -0.03, 0]), [0.1, 0, -0.25], glove);
      mul(hm[0], this.root, this.tmp);
    }
    out.push({ model: hm[0], scale: glove, color: GLOVE, emissive: 0, shape: 0.024 });
    compose(this.tmp, add3(right, [0.004, -0.01, 0.005]), [-0.3, 0, 0], palm);
    mul(hm[1], this.root, this.tmp);
    out.push({ model: hm[1], scale: palm, color: GLOVE, emissive: 0, shape: 0.026 });
    // trigger finger + thumb on the grip hand
    const fing = [0.018, 0.018, 0.055];
    compose(this.tmp, add3(right, [0.0, 0.025, -0.055]), [-0.15, 0, 0], fing);
    mul(hm[5], this.root, this.tmp);
    out.push({ model: hm[5], scale: fing, color: GLOVE, emissive: 0, shape: 0.008 });
    compose(this.tmp, add3(right, [-0.04, 0.03, -0.01]), [-0.2, 0, 0], fing);
    mul(hm[6], this.root, this.tmp);
    out.push({ model: hm[6], scale: fing, color: GLOVE, emissive: 0, shape: 0.008 });

    const rv = transformPoint(this.root, right);
    let lShoulder = lerp3([-0.32, -0.62, 0.0], [-0.24, -0.55, 0.05], a);
    if (plant && plant.t > 0.001) lShoulder = lerp3(lShoulder, [-0.36, -0.68, -0.28], plant.t); // reach the arm out, away from the lens
    const rShoulder = lerp3([0.34, -0.5, 0.12], [0.16, -0.46, 0.18], a);
    [[lv, lShoulder, hm[2]], [rv, rShoulder, hm[3]]].forEach(([hand, sh, m]) => {
      const d0 = [sh[0] - hand[0], sh[1] - hand[1], sh[2] - hand[2]];
      const l0 = Math.hypot(...d0);
      const h = hand.map((v, k) => v + d0[k] / l0 * 0.075); // start the sleeve at the wrist
      const dir = [sh[0] - h[0], sh[1] - h[1], sh[2] - h[2]];
      const len = Math.hypot(...dir);
      const c = [h[0] + dir[0] * 0.5, h[1] + dir[1] * 0.5, h[2] + dir[2] * 0.5];
      const th = m === hm[2] && plant ? lerp(0.075, 0.062, plant.t) : 0.075;
      const s = [th, th, len];
      compose(m, c, anglesFor(dir), s);
      out.push({ model: m, scale: s, color: SLEEVE, emissive: 0, shape: 'cyl' });
      // cuff at the wrist
      const cm = m === hm[2] ? hm[7] : hm[8], cs = [th * 1.12, th * 1.12, 0.04];
      compose(cm, h.map((v, k) => v + dir[k] / len * 0.02), anglesFor(dir), cs);
      out.push({ model: cm, scale: cs, color: [0.12, 0.12, 0.13], emissive: 0, shape: 'cyl' });
    });

    const fs = d.flashScale ?? 1;
    if (this.flash > 0 && fs > 0) {
      const f = hm[4], s = [0.09 * fs, 0.09 * fs, 0.12 * fs];
      compose(this.tmp, add3(d.muzzle, [0, 0, -0.06]), [0, 0, Math.random() * Math.PI], s);
      mul(f, this.root, this.tmp);
      out.push({ model: f, scale: s, color: FLASH, emissive: 1, shape: 'sphere' });
    }
    return out;
  }

  // Where the free hand goes (view space) while mantling or vaulting, and how much (t).
  plantTarget(player) {
    const tr = player.trav;
    if (player.press != null) {
      // console button: reach out, punch it, pull back
      const p = player.press;
      const reach = seg(p, 0, 0.35), push = seg(p, 0.38, 0.5) * (1 - seg(p, 0.55, 0.7)), back = seg(p, 0.7, 1);
      return { t: reach * (1 - back), pos: [-0.08, -0.12 - push * 0.03, -0.46 - push * 0.1], rot: [-0.6, 0.1, 1.3] };
    }
    if (!tr && player.grapple && player.grapple.phase !== 'miss') {
      // grapple: free hand thrust out toward the hook
      const g = player.grapple;
      const t = smooth(clamp((g.phase === 'fire' ? g.t : 1) / 0.08, 0, 1));
      return { t, pos: [-0.17, -0.1, -0.62], rot: [-0.1, 0.1, 0.3] };
    }
    if (!tr && player.sliding && this.def.oneHanded && this.slideT > 0.05 && !this.reload) {
      const t = smooth(clamp(this.slideT * (1 - this.adsT), 0, 1));
      const drag = Math.sin(player.slideTime * 30) * 0.008;
      return { t, pos: [-0.34, -0.36 + drag, -0.3], rot: [-0.15, 0.4, 1.2] };
    }
    if (!tr) {
      // wall run on your left: free hand braces against the wall
      if (!player.wallRun || player.wallRun.side > 0) return null;
      const w = player.wallRun;
      const t = smooth(clamp(w.t / 0.12, 0, 1));
      const pat = Math.sin(w.t * 18) * 0.015;          // hand patters along the wall
      return { t, pos: [-0.3, -0.02 + pat, -0.36 - pat], rot: [-0.5, 0.25, 0.05] };
    }
    if (tr.kind === 'hang') {
      return { t: smooth(clamp(tr.t / 0.1, 0, 1)), pos: [-0.14, 0.17, -0.5], rot: [-0.15, 0.3, 1.3] };
    }
    const p = tr.p;
    if (tr.kind === 'mantle') {
      // reach up to the lip, then the hand slides down the view as you push yourself over it
      const reach = seg(p, 0, 0.2), release = seg(p, 0.82, 1);
      const push = seg(p, 0.15, 0.85);
      return {
        t: reach * (1 - release),
        pos: [-0.19 + push * 0.04, -0.01 - push * 0.27, -0.46 - push * 0.03],
        rot: [-0.2 + push * 0.15, 0.3, 1.3],
      };
    }
    // vault: plant on the top while hopping, body swings past the hand, let go on the drop
    const ua = tr.ta / tr.T, ub = (tr.ta + tr.tb) / tr.T;
    const reach = seg(p, 0, Math.max(ua * 0.85, 0.05)), release = seg(p, ub, Math.min(1, ub + 0.16));
    const pass = seg(p, ua * 0.6, ub);
    return {
      t: reach * (1 - release),
      pos: [-0.11 - pass * 0.08, -0.12 - pass * 0.24, -0.5 + pass * 0.06],
      rot: [-0.25 + pass * 0.1, 0.45 - pass * 0.25, 1.25 + pass * 0.15],
    };
  }

  // gun parts for display in the world (weapon cases)
  static worldParts(def, matrix) {
    const local = mat4();
    return def.parts.filter((p) => !p.hidden).map((p) => {
      compose(local, p.c, [p.rx || 0, p.ry || 0, p.rz || 0], p.s);
      const m = mat4();
      mul(m, matrix, local);
      return { model: m, scale: p.s, color: p.col, emissive: p.em || 0, shape: partShape(p), mat: p.m };
    });
  }
}
