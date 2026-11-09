// Auto rifle: fire rate, recoil, spread/bloom, reload, ADS, and the first-person viewmodel.
import { compose, mul, mat4, damp, clamp, lerp } from './math.js';

const BLACK = [0.1, 0.1, 0.11];
const DARK = [0.2, 0.2, 0.22];
const RED = [0.95, 0.12, 0.1];
const FLASH = [1, 0.93, 0.75];

// Gun parts in gun-local space (-Z is forward). [center, size, color, rotX, emissive]
const PARTS = [
  { name: 'receiver', c: [0, 0, 0], s: [0.07, 0.095, 0.36], col: DARK },
  { name: 'handguard', c: [0, -0.004, -0.25], s: [0.066, 0.078, 0.18], col: BLACK },
  { name: 'barrel', c: [0, 0.012, -0.4], s: [0.028, 0.028, 0.18], col: BLACK },
  { name: 'muzzle', c: [0, 0.012, -0.5], s: [0.04, 0.04, 0.05], col: DARK },
  { name: 'sightbase', c: [0, 0.058, 0.0], s: [0.05, 0.02, 0.14], col: BLACK },
  // open-frame sight so you can see through it when aiming
  { name: 'sightL', c: [-0.021, 0.086, 0.01], s: [0.006, 0.036, 0.05], col: DARK },
  { name: 'sightR', c: [0.021, 0.086, 0.01], s: [0.006, 0.036, 0.05], col: DARK },
  { name: 'sightTop', c: [0, 0.106, 0.01], s: [0.048, 0.006, 0.05], col: DARK },
  { name: 'dot', c: [0, 0.086, 0.03], s: [0.0035, 0.0035, 0.001], col: RED, em: 1 },
  { name: 'grip', c: [0, -0.09, 0.1], s: [0.045, 0.11, 0.05], col: BLACK, rx: -0.3 },
  { name: 'stock', c: [0, -0.012, 0.27], s: [0.05, 0.085, 0.18], col: DARK },
  { name: 'stripe', c: [0.037, 0.018, -0.02], s: [0.004, 0.012, 0.3], col: RED, em: 1 },
  { name: 'mag', c: [0, -0.115, -0.05], s: [0.05, 0.16, 0.085], col: BLACK, rx: 0.22, mag: true },
];

export class Weapon {
  constructor() {
    this.magSize = 30;
    this.ammo = 30;
    this.rpm = 720;
    this.reloadTime = 1.7;
    this.cool = 0;
    this.reloading = 0;
    this.bloom = 0;
    this.kick = 0;      // vertical recoil (radians, added to camera pitch)
    this.kickYaw = 0;
    this.sinceShot = 1;
    this.adsT = 0;
    this.sprintT = 0;
    this.flash = 0;
    this.vmKick = 0;
    this.sway = [0, 0];
    this.shotsFired = 0;
    this.root = mat4();
    this.tmp = mat4();
    this.parts = PARTS.map((p) => ({ ...p, model: mat4(), local: mat4() }));
  }

  get ads() { return this.adsT > 0.5; }

  // fire(spread) is called once per bullet.
  update(dt, input, player, fire, sounds) {
    const wantAds = input.mouse(2) && !this.reloading && !player.sprinting;
    this.adsT += ((wantAds ? 1 : 0) - this.adsT) * damp(14, dt);
    this.sprintT += ((player.sprinting && !this.reloading ? 1 : 0) - this.sprintT) * damp(10, dt);

    if (input.hit('KeyR') && this.ammo < this.magSize && !this.reloading) this.startReload(sounds);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { this.reloading = 0; this.ammo = this.magSize; }
    }

    this.cool -= dt;
    this.sinceShot += dt;
    if (input.mouse(0) && !this.reloading && this.cool <= 0) {
      if (this.ammo > 0) {
        this.cool = Math.max(this.cool, 0) + 60 / this.rpm;
        this.ammo--;
        this.shotsFired++;
        this.sinceShot = 0;
        const s = this.spread(player);
        fire(s);
        const adsMul = this.ads ? 0.55 : 1;
        this.kick = Math.min(this.kick + 0.011 * adsMul, 0.14);
        this.kickYaw += (Math.random() - 0.45) * 0.007 * adsMul;
        this.bloom = Math.min(this.bloom + 0.0045, 0.035);
        this.flash = 0.045;
        this.vmKick = 1;
        sounds?.shot();
      } else if (input.mouseHit(0)) {
        sounds?.dry();
        this.startReload(sounds);
      }
    }

    // recoil recovery once you stop shooting
    if (this.sinceShot > 0.09) {
      const k = damp(7, dt);
      this.kick -= this.kick * k;
      this.kickYaw -= this.kickYaw * k;
    }
    this.bloom -= this.bloom * damp(6, dt);
    this.flash -= dt;
    this.vmKick -= this.vmKick * damp(18, dt);
    this.sway[0] += (clamp(-input.dx * 0.0005, -0.04, 0.04) - this.sway[0]) * damp(10, dt);
    this.sway[1] += (clamp(input.dy * 0.0005, -0.04, 0.04) - this.sway[1]) * damp(10, dt);
  }

  startReload(sounds) {
    if (this.reloading || this.ammo === this.magSize) return;
    this.reloading = this.reloadTime;
    sounds?.reload();
  }

  spread(player) {
    let s = 0.004 + this.bloom;
    const hs = player.hSpeed;
    s += Math.min(hs / 8, 1) * 0.018;
    if (!player.grounded) s += 0.03;
    if (player.crouching && !player.sliding) s *= 0.75;
    s *= lerp(1, 0.25, this.adsT);
    return s;
  }

  // Builds view-space model matrices for each gun part.
  viewmodel(player, time) {
    const a = this.adsT, sp = this.sprintT;
    const hip = [0.17, -0.185, -0.56], adsPos = [0, -0.086, -0.27];
    const bob = player.bobAmt * (1 - a * 0.85);
    const bx = Math.cos(player.bobT) * 0.012 * bob;
    const by = -Math.abs(Math.sin(player.bobT)) * 0.014 * bob;
    const idle = Math.sin(time * 1.6) * 0.003 * (1 - a);

    let rp = 0, rr = 0, dip = 0, magDrop = 0;
    if (this.reloading > 0) {
      const t = 1 - this.reloading / this.reloadTime;
      dip = Math.sin(Math.PI * t);
      rp = -0.35 * dip;
      rr = 0.55 * dip;
      if (t > 0.18 && t < 0.72) magDrop = Math.sin(Math.PI * (t - 0.18) / 0.54);
    }

    const pos = [
      lerp(hip[0], adsPos[0], a) + bx + this.sway[0] - sp * 0.04,
      lerp(hip[1], adsPos[1], a) + by + idle - this.sway[1] - dip * 0.1 - sp * 0.04 + (player.stepSmooth * 0.3),
      lerp(hip[2], adsPos[2], a) + this.vmKick * 0.045,
    ];
    const rot = [
      this.vmKick * 0.06 + rp - sp * 0.25 + this.sway[1] * 2,
      sp * 0.55 + this.sway[0] * 2,
      rr + sp * 0.15 - this.sway[0] * 1.5,
    ];
    compose(this.root, pos, rot, [1, 1, 1]);

    const out = [];
    for (const p of this.parts) {
      const c = p.mag ? [p.c[0], p.c[1] - magDrop * 0.28, p.c[2] + magDrop * 0.05] : p.c;
      compose(p.local, c, [(p.rx || 0) + (p.mag ? magDrop * 0.6 : 0), 0, 0], p.s);
      mul(p.model, this.root, p.local);
      out.push({ model: p.model, scale: p.s, color: p.col, emissive: p.em || 0 });
    }
    if (this.flash > 0) {
      const f = mat4();
      const r = Math.random() * Math.PI;
      compose(this.tmp, [0, 0.012, -0.6], [0, 0, r], [0.09, 0.09, 0.12]);
      mul(f, this.root, this.tmp);
      out.push({ model: f, scale: [0.09, 0.09, 0.12], color: FLASH, emissive: 1 });
    }
    return out;
  }

  // Approximate muzzle position in world space for tracers.
  muzzleOffset() {
    return lerp(1, 0, this.adsT);
  }
}
