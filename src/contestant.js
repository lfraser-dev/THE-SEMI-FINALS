// Contestants: the human characters used in the trailer (couch duo, trios, key art).
// A jointed box rig (two-bone IK for arms + legs) with outfit "skins" and a set of poses.
import { compose, mat4, anglesFor } from './math.js';
import { Builder, at, pitchBasis, basisFrom } from './rig.js';

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm3 = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function ik(a, b, l1, l2, hint) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  let len = Math.hypot(...d);
  const u = d.map((v) => v / (len || 1));
  len = Math.min(len, l1 + l2 - 1e-3);
  const x = (l1 * l1 - l2 * l2 + len * len) / (2 * len);
  const h = Math.sqrt(Math.max(l1 * l1 - x * x, 0));
  const hd = hint[0] * u[0] + hint[1] * u[1] + hint[2] * u[2];
  let p = [hint[0] - u[0] * hd, hint[1] - u[1] * hd, hint[2] - u[2] * hd];
  const pl = Math.hypot(...p) || 1;
  p = p.map((v) => v / pl);
  return [a[0] + u[0] * x + p[0] * h, a[1] + u[1] * x + p[1] * h, a[2] + u[2] * x + p[2] * h];
}

// ---------------------------------------------------------------- skins
const SKIN = { light: [0.93, 0.76, 0.64], tan: [0.78, 0.57, 0.42], brown: [0.55, 0.37, 0.25], dark: [0.36, 0.24, 0.17] };
export const SKINS = {
  viper: { name: 'VIPER', skin: SKIN.tan, top: [0.08, 0.08, 0.09], jacket: [0.92, 0.1, 0.08], bottom: [0.16, 0.16, 0.18], shoes: [0.95, 0.95, 0.95],
    gloves: [0.1, 0.1, 0.1], accent: [1, 1, 1], head: 'cap', headCol: [0.92, 0.1, 0.08], hair: [0.1, 0.07, 0.05] },
  bolt: { name: 'BOLT', skin: SKIN.brown, top: [0.95, 0.75, 0.1], bottom: [0.12, 0.13, 0.16], shoes: [0.1, 0.1, 0.12], gloves: [0.15, 0.15, 0.16],
    accent: [0.1, 0.1, 0.12], head: 'beanie', headCol: [0.1, 0.1, 0.12], vest: [0.2, 0.21, 0.24], hair: [0.08, 0.06, 0.05] },
  // trio 1: blue squad
  frost: { name: 'FROST', skin: SKIN.light, top: [0.15, 0.4, 0.9], bottom: [0.9, 0.92, 0.95], shoes: [0.15, 0.4, 0.9], gloves: [0.9, 0.92, 0.95],
    accent: [0.6, 0.85, 1], head: 'helmet', headCol: [0.92, 0.94, 0.97], visor: [0.4, 0.8, 1], vest: [0.9, 0.92, 0.95] },
  tide: { name: 'TIDE', skin: SKIN.dark, top: [0.9, 0.92, 0.95], jacket: [0.1, 0.25, 0.6], bottom: [0.1, 0.25, 0.6], shoes: [0.95, 0.95, 0.95],
    gloves: [0.1, 0.1, 0.12], accent: [0.6, 0.85, 1], head: 'hair', hair: [0.06, 0.05, 0.05], scarf: [0.6, 0.85, 1] },
  glacier: { name: 'GLACIER', skin: SKIN.tan, top: [0.2, 0.22, 0.3], bottom: [0.2, 0.22, 0.3], shoes: [0.1, 0.1, 0.12], gloves: [0.6, 0.85, 1],
    accent: [0.6, 0.85, 1], head: 'mask', headCol: [0.9, 0.92, 0.95], visor: [0.4, 0.8, 1], vest: [0.15, 0.4, 0.9], build: 1.18 },
  // trio 2: gold squad
  jackpot: { name: 'JACKPOT', skin: SKIN.brown, top: [0.95, 0.72, 0.1], jacket: [0.95, 0.72, 0.1], bottom: [0.1, 0.1, 0.11], shoes: [0.95, 0.72, 0.1],
    gloves: [0.1, 0.1, 0.11], accent: [0.1, 0.1, 0.11], head: 'bucket', headCol: [0.1, 0.1, 0.11], hair: [0.06, 0.05, 0.05] },
  dice: { name: 'DICE', skin: SKIN.light, top: [0.98, 0.98, 0.98], bottom: [0.95, 0.72, 0.1], shoes: [0.98, 0.98, 0.98], gloves: [0.95, 0.72, 0.1],
    accent: [0.92, 0.1, 0.08], head: 'mask', headCol: [0.98, 0.98, 0.98], visor: [0.1, 0.1, 0.11] },
  brass: { name: 'BRASS', skin: SKIN.dark, top: [0.3, 0.22, 0.12], vest: [0.95, 0.72, 0.1], bottom: [0.3, 0.22, 0.12], shoes: [0.12, 0.1, 0.08],
    gloves: [0.12, 0.1, 0.08], accent: [0.95, 0.72, 0.1], head: 'helmet', headCol: [0.95, 0.72, 0.1], visor: [0.15, 0.12, 0.08], build: 1.2 },
  // trio 3: pink squad
  neon: { name: 'NEON', skin: SKIN.light, top: [0.95, 0.2, 0.6], bottom: [0.1, 0.1, 0.12], shoes: [0.95, 0.2, 0.6], gloves: [0.1, 0.1, 0.12],
    accent: [0.3, 1, 0.9], head: 'hair', hair: [0.95, 0.2, 0.6], scarf: [0.3, 1, 0.9] },
  glitch: { name: 'GLITCH', skin: SKIN.tan, top: [0.12, 0.12, 0.14], jacket: [0.55, 0.2, 0.9], bottom: [0.55, 0.2, 0.9], shoes: [0.3, 1, 0.9],
    gloves: [0.3, 1, 0.9], accent: [0.3, 1, 0.9], head: 'helmet', headCol: [0.12, 0.12, 0.14], visor: [0.3, 1, 0.9] },
  riot: { name: 'RIOT', skin: SKIN.brown, top: [0.95, 0.2, 0.6], vest: [0.12, 0.12, 0.14], bottom: [0.12, 0.12, 0.14], shoes: [0.95, 0.2, 0.6],
    gloves: [0.12, 0.12, 0.14], accent: [0.95, 0.2, 0.6], head: 'beanie', headCol: [0.95, 0.2, 0.6], hair: [0.06, 0.05, 0.05], build: 1.15 },
  // key art
  champ: { name: 'CHAMP', skin: SKIN.tan, top: [0.08, 0.08, 0.09], jacket: [0.98, 0.98, 0.98], bottom: [0.08, 0.08, 0.09], shoes: [0.92, 0.1, 0.08],
    gloves: [0.08, 0.08, 0.09], accent: [0.92, 0.1, 0.08], head: 'mask', headCol: [0.08, 0.08, 0.09], visor: [0.92, 0.1, 0.08], scarf: [0.92, 0.1, 0.08] },
};

// ---------------------------------------------------------------- poses
// Each returns targets in character space (feet at origin, facing -z). t = time, talk = 0..1
const L = 0.47, UA = 0.3, FA = 0.29;
function standLegs(p, spread = 0.15, stagger = 0) {
  p.feet = [[-spread, 0.05, stagger], [spread, 0.05, -stagger]];
}
export const POSES = {
  lobby(t) {
    // relaxed low-ready: rifle held across the body in both hands, muzzle angled down to the left
    const sway = Math.sin(t * 0.8), look = Math.sin(t * 0.31), br = Math.sin(t * 1.7);
    const p = { pelvis: [0.012 + sway * 0.01, 1.0 + br * 0.004, 0], lean: 0.0, twist: 0.1 + sway * 0.012,
      head: [-0.08 + look * 0.09, 0.02 + Math.sin(t * 0.47) * 0.02] };
    p.feet = [[-0.14, 0.05, 0.02], [0.15, 0.05, -0.05]];
    p.gun = { c: [0.03, 1.07 + br * 0.003, -0.24], rx: -0.42, ry: 0.62 };
    p.holdGun = true;        // hands go to the gun's grip + foregrip
    p.armHint = [[-0.8, -0.7, 0.2], [0.7, -0.6, 0.6]];
    p.hands = [[-0.1, 1.0, -0.38], [0.14, 1.06, -0.12]];
    p.breath = t;
    return p;
  },
  sit(t, talk) {
    const g = Math.sin(t * 7) * talk;
    return {
      pelvis: [0, 0.52, 0.12], lean: -0.12 + talk * 0.08, twist: Math.sin(t * 2.3) * 0.05 * talk,
      feet: [[-0.2, 0.05, -0.45], [0.22, 0.05, -0.5]], kneeHint: [0, 0.6, -1],
      hands: [[-0.24, 0.62, -0.22], [0.26 + 0.04 * g, 0.66 + 0.2 * talk + 0.07 * g, -0.3 - 0.1 * talk]],
      head: [Math.sin(t * 1.3) * 0.08 + talk * Math.sin(t * 5) * 0.08, 0.04 + talk * Math.sin(t * 9) * 0.05],
    };
  },
  sitLean(t, talk) {
    const g = Math.sin(t * 8) * talk;
    return {
      pelvis: [0, 0.52, 0.05], lean: 0.42, twist: 0,
      feet: [[-0.22, 0.05, -0.42], [0.2, 0.05, -0.38]], kneeHint: [0, 0.6, -1],
      hands: [[-0.08 + 0.05 * g, 0.78 + 0.1 * talk, -0.42], [0.1 + 0.08 * g, 0.8 + 0.18 * talk + 0.05 * g, -0.45]],
      head: [0, 0.25 + talk * Math.sin(t * 9) * 0.06],
    };
  },
  laugh(t) {
    const k = Math.sin(t * 16) * 0.5 + 0.5;
    return {
      pelvis: [0, 0.52, 0.14], lean: -0.3 - k * 0.08, twist: 0.1,
      feet: [[-0.2, 0.05, -0.45], [0.22, 0.05, -0.5]], kneeHint: [0, 0.6, -1],
      hands: [[-0.22, 0.75, -0.18], [0.08, 0.98 + k * 0.03, -0.18]],
      head: [0.1, -0.3 - k * 0.1], mouth: 0.6 + k * 0.4,
    };
  },
  heroGun(t) {
    const p = { pelvis: [0, 0.95, 0], lean: 0.02, twist: 0.25, head: [-0.2, 0.0] };
    standLegs(p, 0.19, 0.1);
    p.gun = { c: [0.05, 1.22, -0.25], rx: 0.15, ry: 0.5 };
    p.hands = [[-0.12, 1.2, -0.42], [0.14, 1.12, -0.1]];
    p.breath = t;
    return p;
  },
  heroShoulder(t) {
    const p = { pelvis: [0.03, 0.95, 0], lean: -0.04, twist: -0.15, head: [0.15, 0.05] };
    standLegs(p, 0.22, -0.08);
    p.gun = { c: [0.24, 1.62, 0.08], rx: 1.15, ry: 0.05 };       // resting on the shoulder, muzzle up
    p.hands = [[-0.3, 0.98, 0.0], [0.27, 1.45, -0.08]];
    p.breath = t;
    return p;
  },
  heroArms(t) {
    const p = { pelvis: [0, 0.95, 0], lean: -0.05, twist: 0.05, head: [0, 0.08] };
    standLegs(p, 0.2, 0);
    p.hands = [[0.16, 1.2, -0.18], [-0.16, 1.18, -0.2]];   // arms crossed
    p.elbowOut = 1.4;
    p.breath = t;
    return p;
  },
  heroPoint(t) {
    const p = { pelvis: [0, 0.95, 0], lean: 0.08, twist: -0.2, head: [0, 0.05] };
    standLegs(p, 0.17, 0.12);
    p.hands = [[-0.22, 0.95, -0.05], [0.2, 1.45, -0.62]];  // pointing at the camera
    p.gun = { c: [-0.25, 0.85, -0.05], rx: -1.2, ry: 0.1 }; // rifle hanging in the other hand
    p.breath = t;
    return p;
  },
  heroHip(t) {
    const p = { pelvis: [0.04, 0.95, 0], lean: -0.02, twist: 0.3, head: [-0.25, -0.02] };
    standLegs(p, 0.21, -0.06);
    p.hands = [[-0.25, 0.98, 0.05], [0.24, 0.98, -0.05]];
    p.elbowOut = 1.2;
    p.gun = { c: [0.32, 0.6, -0.15], rx: -1.35, ry: -0.1 };
    p.breath = t;
    return p;
  },
};

// ---------------------------------------------------------------- the character
export class Contestant {
  constructor(skin, pos = [0, 0, 0], yaw = 0) {
    this.skin = typeof skin === 'string' ? SKINS[skin] : skin;
    this.pos = [...pos];
    this.yaw = yaw;
    this.pose = 'heroGun';
    this.talk = 0;
    this.t = Math.random() * 10;
    this.models = Array.from({ length: 48 }, () => mat4());
    this.gunMatrix = mat4();
    this.realGun = false;
  }

  update(dt) { this.t += dt; }

  parts() {
    const S = this.skin, b = S.build || 1;
    const P = POSES[this.pose](this.t, this.talk);
    const bd = (this.bd = this.bd || new Builder()).reset();
    bd.mat = 'cloth';
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const Wd = (v) => [cy * v[0] + sy * v[2], v[1], -sy * v[0] + cy * v[2]];
    const W = (v) => { const d = Wd(v); return [this.pos[0] + d[0], this.pos[1] + d[1], this.pos[2] + d[2]]; };
    const shade = (c, k) => c.map((v) => Math.min(1, v * k));
    const breathe = P.breath != null ? Math.sin(P.breath * 2) * 0.008 : 0;
    const pelvis = P.pelvis;
    const lean = P.lean || 0, tw = P.twist || 0;
    const tr = (v) => {   // torso-space direction (twist, then lean)
      const x = v[0] * Math.cos(tw) + v[2] * Math.sin(tw), z = -v[0] * Math.sin(tw) + v[2] * Math.cos(tw);
      return [x, v[1] * Math.cos(lean) + z * Math.sin(lean), -v[1] * Math.sin(lean) + z * Math.cos(lean)];
    };
    const up = (v) => add3(pelvis, tr(v));
    const TB = { R: Wd(tr([1, 0, 0])), U: Wd(tr([0, 1, 0])), B: Wd(tr([0, 0, 1])) };      // torso basis (world)
    const HB0 = { R: Wd([1, 0, 0]), U: Wd([0, 1, 0]), B: Wd([0, 0, 1]) };                   // character basis
    const T = (v) => W(up(v));
    const skin = S.skin, top = S.top, low = S.bottom;
    const legSt = S.legStyle || (S.zip ? 'slim' : 'cargo');
    const shoeSt = S.shoeStyle || 'boot';
    const topSt = S.topStyle || (S.zip ? 'zip' : 'tee');
    const jackSt = S.jacketStyle || 'bomber';
    const vestSt = S.vestStyle || 'field';
    const withMat = (m, fn) => { const o = bd.mat; bd.mat = m; fn(); bd.mat = o; };
    // a basis whose back axis points along v (for discs, links, patches)
    const facing = (v, upHint = [0, 1, 0]) => basisFrom(Math.abs(v[1]) > 0.95 ? [1, 0, 0] : upHint, v);
    // z of the front of the outermost torso layer at torso-space (x, y): lets neckwear lie on the clothes
    const layerK = S.jacket ? (S.jacketStyle === 'puffer' ? 1.2 : 1.09) : S.vest ? 1.1 : 1;
    const chestFront = (x, y) => {
      const ex = x / (0.19 * b * layerK), ey = (y - 0.42) / (0.2 * layerK);
      const q = 1 - ex * ex - ey * ey;
      return q > 0 ? 0.006 - 0.116 * b * layerK * Math.sqrt(q) : 0.006;
    };
    // ring of capsules around the torso at height y (torso space), ellipse radii rx / rz centred on z0
    const ring = (y, rx, rz, z0, r, color, n = 16, yFront = 0) => {
      let prev = null;
      for (let k = 0; k <= n; k++) {
        const a2 = (k / n) * Math.PI * 2;
        const fr = (1 - Math.cos(a2)) / 2;                    // 0 at back, 1 at front
        const pt = T([Math.sin(a2) * rx, y - yFront * fr * fr, z0 + Math.cos(a2) * rz]);
        if (prev) bd.capsule(prev, pt, r, r, color);
        prev = pt;
      }
    };

    // ---- legs: tapered thigh + shin, knee pad, boot
    [-1, 1].forEach((side, i) => {
      const hip = add3(pelvis, [side * 0.1 * b, -0.06, 0]);
      const foot = P.feet[i];
      const knee = ik(hip, foot, L, L, P.kneeHint || [0, 0.2, -1]);
      const ankle = add3(foot, [0, 0.07, 0.02]);
      const shinTop = lerp3(knee, ankle, 0.04);
      bd.ellipsoid(W(hip), HB0, [0.19 * b, 0.19 * b, 0.19 * b], low);                                          // hip joint fill
      bd.capsule(W(hip), W(knee), 0.095 * b, 0.064 * b, low);
      bd.ellipsoid(W(knee), HB0, [0.128 * b, 0.128 * b, 0.128 * b], low);                                      // knee fill
      bd.capsule(W(knee), W(lerp3(knee, ankle, 0.8)), 0.064 * b, 0.054 * b, low);
      const KB = basisFrom(Wd(norm3(sub3(hip, ankle))), Wd([0, 0, 1]));
      const tmid = lerp3(hip, knee, 0.55);
      // a point on the trouser surface: t along the leg (0 hip .. 1 knee .. 2 ankle), angle around (0 = outside)
      const legPt = (t, ang, out = 0.004) => {
        const onThigh = t <= 1, u = onThigh ? t : t - 1;
        const c = onThigh ? lerp3(hip, knee, u) : lerp3(knee, ankle, u * 0.8);
        const r = (onThigh ? 0.095 + (0.064 - 0.095) * u : 0.064 + (0.054 - 0.064) * u) * b + out;
        return [c[0] + side * Math.cos(ang) * r, c[1], c[2] - Math.sin(ang) * r];
      };
      if (legSt === 'cargo' || legSt === 'camo') {
        // bellowed side pockets with flaps, and knee pads
        const PB = basisFrom(Wd(norm3(sub3(hip, knee))), Wd([side, 0, 0]));
        bd.rbox(W(add3(tmid, [side * 0.088 * b, 0.0, 0])), PB, [0.12, 0.15, 0.04], 0.016, shade(low, 0.88));
        bd.rbox(W(add3(tmid, [side * 0.095 * b, 0.07, 0])), PB, [0.125, 0.035, 0.03], 0.01, shade(low, 0.78));
        if (S.kneePads) bd.rbox(W(add3(knee, [0, 0.0, -0.06])), KB, [0.11 * b, 0.12, 0.05], 0.022, S.kneeCol || [0.16, 0.16, 0.17]);
        if (legSt === 'camo') {
          const blots = [[0.2, 0.4, 0.07], [0.35, 2.2, 0.06], [0.55, 4.1, 0.07], [0.7, 1.2, 0.05], [0.85, 3.3, 0.06], [1.3, 0.9, 0.05], [1.45, 2.9, 0.05], [1.6, 4.9, 0.045], [1.15, 5.6, 0.05], [0.45, 5.4, 0.055]];
          blots.forEach(([t, ang, sz], k) => {
            const pt = legPt(t, ang, -0.006), ctr = t <= 1 ? lerp3(hip, knee, t) : lerp3(knee, ankle, (t - 1) * 0.8);
            const n = norm3(sub3(pt, [ctr[0], pt[1], ctr[2]]));
            bd.ellipsoid(W(pt), facing(Wd(n)), [sz * 1.4, sz * 1.1, 0.03], k % 2 ? S.camo2 || shade(low, 0.6) : S.camo3 || shade(low, 1.45));
          });
        }
      } else if (legSt === 'track') {
        for (const dz of [-0.014, 0.014]) {     // two white side stripes, hip to ankle
          bd.capsule(W(add3(legPt(0.05, 0), [0, 0, dz])), W(add3(legPt(1, 0), [0, 0, dz])), 0.008, 0.008, S.stripe || [0.95, 0.95, 0.95]);
          bd.capsule(W(add3(legPt(1, 0), [0, 0, dz])), W(add3(legPt(1.95, 0), [0, 0, dz])), 0.008, 0.008, S.stripe || [0.95, 0.95, 0.95]);
        }
        bd.capsule(W(lerp3(knee, ankle, 0.78)), W(lerp3(knee, ankle, 0.82)), 0.06 * b, 0.06 * b, shade(low, 0.8));   // elastic cuff
      } else if (legSt === 'chino') {
        bd.capsule(W(lerp3(knee, ankle, 0.74)), W(lerp3(knee, ankle, 0.8)), 0.06 * b, 0.06 * b, shade(low, 0.9));   // rolled hem
        bd.capsule(W(legPt(0.05, 0.8)), W(legPt(0.95, 0.4)), 0.004, 0.004, shade(low, 0.75));                        // seam
      }
      const FB = HB0, fx = foot[0], fz = foot[2], sh = S.shoes;
      if (shoeSt === 'boot') {
        // combat boot: shaft, foot, toe cap, lugged sole, laces
        bd.capsule(W([fx, 0.11, fz + 0.01]), W(lerp3(knee, ankle, 0.72)), 0.07 * b, 0.072 * b, sh);
        bd.rbox(W([fx, 0.075, fz - 0.03]), FB, [0.13 * b, 0.13, 0.27], 0.055, sh);
        bd.ellipsoid(W([fx, 0.06, fz - 0.13]), FB, [0.125 * b, 0.11, 0.13], shade(sh, 0.85));
        bd.rbox(W([fx, 0.018, fz - 0.04]), FB, [0.14 * b, 0.036, 0.31], 0.015, [0.08, 0.08, 0.09]);
        for (let k = 0; k < 4; k++) bd.rbox(W([fx, 0.008, fz + 0.08 - k * 0.07]), FB, [0.142 * b, 0.016, 0.03], 0.006, [0.05, 0.05, 0.06]);
        for (let k = 0; k < 4; k++) bd.rbox(W([fx, 0.12 + k * 0.035, fz - 0.06 + k * 0.012]), FB, [0.08 * b, 0.008, 0.012], 0.003, shade(sh, 0.55));
      } else {
        // low trainer: sock above, rounded upper, thick sole, toe box, heel tab, laces, side swoosh
        const sole = shoeSt === 'runner' ? (S.soleCol || [0.65, 1, 0.2]) : [0.95, 0.95, 0.95];
        const up = shoeSt === 'runner' ? [0.1, 0.1, 0.12] : sh;
        const gold = shoeSt === 'gold';
        bd.capsule(W([fx, 0.1, fz + 0.01]), W(lerp3(knee, ankle, 0.75)), 0.05 * b, 0.052 * b, [0.95, 0.95, 0.95]);   // sock
        withMat(gold ? 'brass' : 'cloth', () => {
          bd.rbox(W([fx, 0.08, fz - 0.015]), FB, [0.125 * b, 0.11, 0.25], 0.05, up);
          bd.ellipsoid(W([fx, 0.065, fz - 0.12]), FB, [0.12 * b, 0.09, 0.13], up);
          bd.ellipsoid(W([fx, 0.11, fz + 0.075]), FB, [0.11 * b, 0.08, 0.08], up);                                   // heel counter
        });
        withMat('rubber', () => {
          bd.rbox(W([fx, 0.022, fz - 0.03]), FB, [0.135 * b, 0.044, 0.3], 0.02, sole);
          bd.rbox(W([fx, 0.13, fz + 0.115]), FB, [0.04, 0.05, 0.012], 0.006, shoeSt === 'runner' ? sole : shade(up, 0.7));   // heel tab
        });
        for (let k = 0; k < 3; k++) bd.rbox(W([fx, 0.122 - k * 0.012, fz - 0.03 - k * 0.035]), pitchBasis(FB, 0.35), [0.07 * b, 0.007, 0.012], 0.003, gold ? [0.95, 0.95, 0.95] : shade(up, 0.6));
        for (const sx of [-1, 1]) {   // side swoosh
          bd.capsule(W([fx + sx * 0.064 * b, 0.065, fz + 0.06]), W([fx + sx * 0.066 * b, 0.085, fz - 0.07]), 0.007, 0.004, shoeSt === 'runner' ? sole : gold ? [0.95, 0.95, 0.95] : S.accent || [0.1, 0.1, 0.12]);
        }
      }
    });

    // ---- hips, belt, torso
    bd.ellipsoid(T([0, -0.01, 0.005]), TB, [0.335 * b, 0.25, 0.235 * b], low);                                 // pelvis
    if (!S.zip) {
      bd.rbox(T([0, 0.085, 0]), TB, [0.315 * b, 0.045, 0.215 * b], 0.02, [0.1, 0.09, 0.08]);
      bd.rbox(T([0, 0.09, -0.112 * b]), TB, [0.065, 0.042, 0.02], 0.008, [0.72, 0.68, 0.52]);                       // buckle
    }
    bd.capsule(T([0, 0.06, 0.0]), T([0, 0.3, 0.0]), 0.128 * b, 0.142 * b, top);                                  // waist
    bd.ellipsoid(T([0, 0.42 + breathe, 0.006]), TB, [0.38 * b, 0.4, 0.232 * b], top);                           // ribcage + chest in one smooth shape
    for (const sx of [-1, 1]) bd.capsule(T([sx * 0.06 * b, 0.56, 0.01]), T([sx * 0.2 * b, 0.505, 0.006]), 0.068 * b, 0.064 * b, S.jacket || top);   // sloped shoulders
    for (const sx of [-1, 1]) bd.ellipsoid(T([sx * 0.215 * b, 0.51, 0.004]), TB, [0.125 * b, 0.12, 0.13 * b], S.jacket || top);   // deltoids
    // ---- top layer styles
    if (!S.jacket && !(S.vest && vestSt === 'field' && topSt !== 'hoodie')) {
      if (topSt === 'zip') {
        const zc = shade(top, 0.8);
        bd.rbox(T([0, 0.6, 0.015]), TB, [0.17 * b, 0.075, 0.15 * b], 0.035, top);                                 // stand-up collar
        bd.rbox(T([0, 0.53, -0.108 * b]), TB, [0.008, 0.16, 0.008], 0.003, zc);                                   // zip
        bd.rbox(T([0, 0.58, -0.114 * b]), TB, [0.012, 0.024, 0.008], 0.004, [0.7, 0.7, 0.72]);                   // zip pull
      } else if (topSt === 'tee') {
        ring(0.585, 0.075, 0.07, 0.012, 0.016, shade(top, 0.88), 16, 0.03);                                      // crew neck rib
        if (S.print) {     // chest graphic: a ring emblem with a bar under it
          bd.cyl(T([0, 0.47, -0.114 * b]), facing(TB.B.map((v) => -v), TB.U), [0.1, 0.1, 0.006], S.print, 0.1);
          bd.cyl(T([0, 0.47, -0.117 * b]), facing(TB.B.map((v) => -v), TB.U), [0.066, 0.066, 0.006], top);
          bd.rbox(T([0, 0.395, -0.115 * b]), TB, [0.13, 0.022, 0.008], 0.004, S.print, 0.1);
        }
        bd.capsule(T([0, 0.08, 0]), T([0, 0.12, 0]), 0.145 * b, 0.145 * b, top);                                 // loose hem over the waistband
      } else if (topSt === 'hoodie') {
        bd.ellipsoid(T([0, 0.6, 0.085]), TB, [0.27 * b, 0.15, 0.15], shade(top, 0.92));                         // hood bunched behind the neck
        bd.ellipsoid(T([0, 0.62, 0.11]), TB, [0.2 * b, 0.13, 0.1], shade(top, 0.8));                            // hood inner fold
        ring(0.59, 0.085, 0.075, 0.01, 0.02, shade(top, 0.9), 16, 0.035);                                       // neck opening
        for (const sx of [-1, 1]) {                                                                              // drawstrings + aglets
          bd.capsule(T([sx * 0.035, 0.57, -0.1 * b]), T([sx * 0.045, 0.42, -0.125 * b]), 0.006, 0.006, S.accent || [0.95, 0.95, 0.95]);
          bd.capsule(T([sx * 0.045, 0.42, -0.125 * b]), T([sx * 0.046, 0.395, -0.126 * b]), 0.008, 0.008, [0.75, 0.75, 0.78]);
        }
        bd.ellipsoid(T([0, 0.24, -0.03]), TB, [0.25 * b, 0.13, 0.215 * b], shade(top, 0.95));                     // kangaroo pocket bulge
        for (const sx of [-1, 1]) bd.capsule(T([sx * 0.1 * b, 0.29, -0.118 * b]), T([sx * 0.12 * b, 0.2, -0.122 * b]), 0.006, 0.006, shade(top, 0.7));   // pocket openings
        bd.capsule(T([0, 0.07, 0]), T([0, 0.13, 0]), 0.15 * b, 0.15 * b, shade(top, 0.88));                     // ribbed hem
      }
      if (S.logo) {   // chest emblem: a chevron on the left chest
        const lc = T([-0.085 * b, 0.5, -0.113 * b]);
        for (const sx of [-1, 1]) {
          const a = sx * 0.62, ca = Math.cos(a), sa = Math.sin(a);
          const LB = { R: TB.R.map((v, k) => v * ca + TB.U[k] * sa), U: TB.U.map((v, k) => v * ca - TB.R[k] * sa), B: TB.B };
          bd.rbox(at(lc, TB, [sx * 0.011, 0, 0]), LB, [0.012, 0.042, 0.008], 0.003, S.logo, 0.35);
        }
      }
    }

    // ---- outerwear
    if (S.jacket) {
      const jk = S.jacket, rib = S.trim || shade(jk, 0.72);
      if (jackSt === 'puffer') {
        // quilted: stacked puffy bands, each a little proud of the last
        [0.12, 0.24, 0.36, 0.48].forEach((y, k) => bd.ellipsoid(T([0, y, 0.004]), TB, [(0.42 - (k === 0 ? 0.03 : 0)) * b, 0.15, 0.27 * b], k % 2 ? jk : shade(jk, 0.94)));
        bd.capsule(T([0, 0.55, 0.01]), T([0, 0.65, 0.012]), 0.1 * b, 0.092 * b, jk);                            // high puffy collar
        bd.rbox(T([0, 0.34, -0.136 * b]), TB, [0.01, 0.44, 0.01], 0.004, shade(jk, 0.5));                       // zip
      } else {
        bd.capsule(T([0, 0.12, 0.0]), T([0, 0.3, 0.0]), 0.142 * b, 0.155 * b, jk);                              // shell over the waist
        bd.ellipsoid(T([0, 0.42 + breathe, 0.008]), TB, [0.4 * b, 0.42, 0.252 * b], jk);                        // shell over the chest
        ring(0.11, 0.152 * b, 0.135 * b, 0.0, 0.022, rib, 18);                                                    // hem band
        if (jackSt === 'bomber') {
          ring(0.6, 0.085, 0.078, 0.01, 0.026, rib, 16, 0.04);                                                   // ribbed collar
          bd.rbox(T([0, 0.36, -0.128 * b]), TB, [0.01, 0.42, 0.008], 0.003, [0.7, 0.7, 0.72], 0);                // zip
          bd.rbox(T([0, 0.58, -0.134 * b]), TB, [0.016, 0.03, 0.01], 0.004, [0.75, 0.75, 0.78]);                // pull
          for (const sx of [-1, 1]) bd.rbox(T([sx * 0.1 * b, 0.24, -0.126 * b]), pitchBasis(TB, sx * 0), [0.012, 0.1, 0.012], 0.005, shade(jk, 0.6));   // welt pockets
        } else if (jackSt === 'track') {
          bd.rbox(T([0, 0.6, 0.02]), TB, [0.2 * b, 0.08, 0.17 * b], 0.035, jk);                                 // stand-up collar
          bd.rbox(T([0, 0.6, 0.02]), TB, [0.205 * b, 0.012, 0.175 * b], 0.005, S.stripe || [0.95, 0.95, 0.95]);
          bd.rbox(T([0, 0.36, -0.128 * b]), TB, [0.012, 0.44, 0.008], 0.004, S.stripe || [0.95, 0.95, 0.95]);   // contrast zip
        } else if (jackSt === 'champion') {
          ring(0.6, 0.088, 0.08, 0.01, 0.026, rib, 16, 0.04);
          bd.rbox(T([0, 0.36, -0.128 * b]), TB, [0.012, 0.44, 0.008], 0.004, rib);
          bd.rbox(T([0, 0.38, -0.127 * b]), TB, [0.4 * b, 0.03, 0.01], 0.006, rib);                             // chest band
          // gold star patch on the left chest
          const sc = T([-0.1 * b, 0.48, -0.126 * b]);
          withMat('brass', () => {
            for (let k = 0; k < 5; k++) {
              const a = (k / 5) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
              const SB = { R: TB.R.map((v, n) => v * ca + TB.U[n] * sa), U: TB.U.map((v, n) => v * ca - TB.R[n] * sa), B: TB.B };
              bd.ellipsoid(at(sc, SB, [0, 0.016, 0]), SB, [0.014, 0.036, 0.008], [1, 0.75, 0.2], 0.15);
            }
          });
        }
      }
    }
    if (S.vest) {
      const vs = S.vest;
      if (vestSt === 'waistcoat') {
        // fitted satin waistcoat: V opening, lapel edges, buttons, welt pockets
        withMat('paint', () => {
          bd.ellipsoid(T([0, 0.42 + breathe, 0.006]), TB, [0.4 * b, 0.43, 0.25 * b], vs);
          bd.capsule(T([0, 0.08, 0]), T([0, 0.3, 0]), 0.15 * b, 0.156 * b, vs);
        });
        for (const sx of [-1, 1]) {                                                                              // the V shows the top underneath
          const VB = { R: TB.R, U: TB.U.map((v, n) => v + TB.R[n] * sx * 0.32), B: TB.B };
          bd.rbox(T([sx * 0.013, 0.555, chestFront(sx * 0.013, 0.555) - 0.002]), VB, [0.018, 0.09, 0.008], 0.004, top);
          bd.rbox(T([sx * 0.044, 0.53, chestFront(sx * 0.044, 0.53) - 0.008]), VB, [0.008, 0.16, 0.01], 0.003, shade(vs, 0.7));
        }
        withMat('brass', () => { for (let k = 0; k < 4; k++) bd.ellipsoid(T([0, 0.42 - k * 0.07, chestFront(0, 0.42 - k * 0.07) - 0.004]), TB, [0.018, 0.018, 0.012], [0.95, 0.92, 0.85]); });
        for (const sx of [-1, 1]) bd.rbox(T([sx * 0.08 * b, 0.22, -0.153 * b]), TB, [0.07, 0.008, 0.008], 0.003, shade(vs, 0.65));
      } else {
        // plate carrier: front + back plates, shoulder straps, cummerbund, magazine pouches, patch
        bd.rbox(T([0, 0.38, -0.02]), TB, [0.42 * b, 0.33, 0.27 * b], 0.12, vs);
        bd.capsule(T([0, 0.2, 0]), T([0, 0.26, 0]), 0.155 * b, 0.155 * b, shade(vs, 0.85));
        for (const sx of [-1, 1]) bd.rbox(T([sx * 0.11 * b, 0.575, 0.0]), TB, [0.075, 0.05, 0.26 * b], 0.022, vs);
        for (let k = -1; k <= 1; k++) {
          bd.rbox(T([k * 0.095 * b, 0.27, -0.155 * b]), TB, [0.08, 0.12, 0.05], 0.016, shade(vs, 0.8));
          bd.rbox(T([k * 0.095 * b, 0.335, -0.158 * b]), TB, [0.084, 0.025, 0.054], 0.008, shade(vs, 0.7));
        }
        bd.rbox(T([0, 0.47, -0.152 * b]), TB, [0.12, 0.055, 0.012], 0.006, S.accent, 0.15);
        if (S.camo2) [[-0.12, 0.45], [0.1, 0.4], [0.02, 0.5], [-0.05, 0.36]].forEach(([x, y], k) => bd.ellipsoid(T([x * b, y, -0.149 * b]), TB, [0.07, 0.05, 0.01], k % 2 ? S.camo2 : S.camo3 || shade(vs, 1.3)));
      }
    }

    // ---- neckwear
    const nk = S.neckStyle || (S.scarf ? 'snood' : null);
    if (nk === 'chain') {
      // a heavy curb chain: alternating flat links resting on the chest, with a medallion
      withMat('brass', () => {
        const N = 30, pts = [];
        for (let k = 0; k <= N; k++) {
          const a = (k / N) * Math.PI * 2, c = Math.cos(a), fr = ((1 + c) / 2) ** 1.6;
          const x = Math.sin(a) * (0.082 + 0.03 * fr) * b, y = 0.615 - 0.16 * fr;
          let z = 0.02 - (0.075 + 0.05 * fr) * b * c;
          if (c > 0) z = Math.min(z, chestFront(x, y) - 0.014);    // lie on top of the clothes
          pts.push(up([x, y, z]));
        }
        const ctr = up([0, 0.56, 0.01]);
        for (let k = 0; k < N; k++) {
          const A = pts[k], C = pts[k + 1], mid = lerp3(A, C, 0.5), tng = Wd(norm3(sub3(C, A)));
          const outv = Wd(norm3(sub3(mid, ctr)));
          const side2 = [tng[1] * outv[2] - tng[2] * outv[1], tng[2] * outv[0] - tng[0] * outv[2], tng[0] * outv[1] - tng[1] * outv[0]];
          const LB = basisFrom(k % 2 ? outv : side2, tng);
          bd.ellipsoid(W(mid), LB, [0.024, 0.011, Math.hypot(...sub3(C, A)) * 1.25], S.chainCol || [1, 0.78, 0.25]);
        }
        const pz = chestFront(0, 0.43) - 0.018;
        const pm = T([0, 0.43, pz]);
        const fwd = TB.B.map((v) => -v);
        bd.ellipsoid(T([0, 0.468, pz + 0.004]), TB, [0.018, 0.026, 0.012], S.chainCol || [1, 0.78, 0.25]);      // bail
        bd.cyl(pm, facing(fwd, TB.U), [0.07, 0.07, 0.012], S.chainCol || [1, 0.78, 0.25]);                    // medallion
        bd.cyl(at(pm, TB, [0, 0, -0.007]), facing(fwd, TB.U), [0.05, 0.05, 0.006], [0.85, 0.6, 0.12]);        // inner face
        bd.ellipsoid(at(pm, TB, [0, 0, -0.011]), TB, [0.02, 0.02, 0.006], [0.9, 0.1, 0.08], 0.4);             // ruby
      });
    } else if (nk === 'bandana') {
      const bc = S.scarf;
      ring(0.6, 0.074, 0.07, 0.012, 0.024, bc, 16, 0.02);                                                        // rolled band
      const fwd = TB.B.map((v) => -v);
      for (const a of [Math.PI / 4]) {                                                                           // folded triangle hanging at the front
        const ca = Math.cos(a), sa = Math.sin(a);
        const DB = { R: TB.R.map((v, n) => v * ca + TB.U[n] * sa), U: TB.U.map((v, n) => v * ca - TB.R[n] * sa), B: TB.B };
        bd.rbox(T([0, 0.475, chestFront(0, 0.475) + 0.012]), pitchBasis(DB, -0.62), [0.17, 0.17, 0.012], 0.014, bc);
      }
      for (const [x, y] of [[-0.025, 0.52], [0.028, 0.49], [0.0, 0.445], [0.035, 0.545], [-0.04, 0.475]]) bd.ellipsoid(T([x, y, chestFront(x, y) - 0.016]), TB, [0.012, 0.012, 0.004], [0.95, 0.95, 0.95]);   // paisley dots
      bd.ellipsoid(T([0, 0.6, 0.085]), TB, [0.05, 0.04, 0.035], bc);                                             // knot at the back
      for (const sx of [-1, 1]) bd.capsule(T([sx * 0.015, 0.6, 0.095]), T([sx * 0.035, 0.53, 0.115]), 0.013, 0.006, bc);
      void fwd;
    } else if (nk === 'scarf') {
      const sc2 = S.scarf, st = S.scarfStripe || [0.95, 0.95, 0.95];
      ring(0.6, 0.085, 0.08, 0.012, 0.042, sc2, 18, 0.015);                                                      // chunky knit loop
      ring(0.565, 0.09, 0.085, 0.012, 0.034, shade(sc2, 0.92), 18, 0.01);
      // two tails falling down the front, striped, with fringe
      const tails = [[-0.05, 0.0], [0.035, 0.03]];
      tails.forEach(([x, dz], k) => {
        const top0 = 0.56, len = 0.26 + k * 0.04;
        bd.rbox(T([x * b, top0 - len / 2, chestFront(x * b, top0 - len / 2) - 0.016 - dz * 0.1]), pitchBasis(TB, 0.08), [0.075, len, 0.024], 0.012, sc2);
        for (const yy of [0.08, 0.13]) bd.rbox(T([x * b, top0 - len + yy, chestFront(x * b, top0 - len / 2) - 0.017 - dz * 0.1]), pitchBasis(TB, 0.08), [0.077, 0.018, 0.026], 0.006, st);
        for (let f = 0; f < 5; f++) { const fz = chestFront(x * b, top0 - len / 2) - 0.02; bd.capsule(T([x * b - 0.028 + f * 0.014, top0 - len, fz]), T([x * b - 0.028 + f * 0.014, top0 - len - 0.03, fz - 0.002]), 0.004, 0.003, sc2); }
      });
    } else if (nk === 'snood') {
      bd.capsule(T([-0.1, 0.62, -0.02]), T([0.1, 0.62, -0.02]), 0.07, 0.07, S.scarf);
    }

    // ---- neck + head
    const [hy, hp] = P.head || [0, 0];
    const neckB = T([0, 0.57, 0.01]), neckT = T([0, 0.68, 0.0]);
    bd.capsule(neckB, neckT, 0.058, 0.052, skin);
    bd.ellipsoid(T([0, 0.565, 0.015]), TB, [0.22 * b, 0.1, 0.16 * b], S.vest || S.jacket || top);    // trapezius / shoulder line
    const headC = T([0, 0.775, -0.01]);
    let HB = { R: TB.R, U: TB.U, B: TB.B };
    // head yaw then pitch, relative to the torso
    const c1 = Math.cos(hy), s1 = Math.sin(hy);
    HB = { U: HB.U, R: HB.R.map((v, i) => v * c1 - HB.B[i] * s1), B: HB.B.map((v, i) => v * c1 + HB.R[i] * s1) };
    HB = pitchBasis(HB, hp + lean * 0.6);
    const H = (v) => at(headC, HB, v);
    bd.ellipsoid(H([0, -0.004, 0.005]), HB, [0.19, 0.252, 0.215], skin);                  // head: one smooth egg, jaw included
    bd.ellipsoid(H([0, -0.088, -0.05]), HB, [0.05, 0.034, 0.04], skin);                     // chin
    const masked = S.head === 'mask' || S.head === 'facemask', visored = S.head === 'helmet';
    if (!masked) for (const sx of [-1, 1]) bd.ellipsoid(H([sx * 0.096, 0.0, 0.012]), HB, [0.03, 0.055, 0.04], shade(skin, 0.93));   // ears
    if (!masked) {
      const talk = P.mouth != null ? P.mouth : this.talk * (0.35 + 0.65 * Math.abs(Math.sin(this.t * 17)));
      if (!visored) for (const sx of [-1, 1]) {
        bd.ellipsoid(H([sx * 0.038, 0.018, -0.094]), HB, [0.028, 0.017, 0.012], [0.07, 0.05, 0.045]);          // eyes
        bd.rbox(H([sx * 0.04, 0.045, -0.096]), HB, [0.045, 0.011, 0.012], 0.005, S.hair || [0.12, 0.08, 0.06]);  // brows
      }
      bd.ellipsoid(H([0, -0.01, -0.104]), HB, [0.022, 0.04, 0.028], shade(skin, 0.97));                         // nose
      bd.rbox(H([0, -0.058, -0.094]), HB, [0.05, 0.008 + 0.025 * talk, 0.01], 0.004, shade(skin, 0.6));         // mouth
    }
    const hair = S.hair || [0.1, 0.07, 0.05];
    if (S.head === 'cap') {
      bd.ellipsoid(H([0, 0.03, 0.02]), HB, [0.2, 0.2, 0.215], hair);
      bd.ellipsoid(H([0, 0.065, 0.006]), HB, [0.205, 0.15, 0.222], S.headCol);
      bd.rbox(H([0, 0.045, -0.12]), pitchBasis(HB, 0.12), [0.17, 0.016, 0.1], 0.008, S.headCol);              // brim
      bd.ellipsoid(H([0, 0.138, 0.005]), HB, [0.025, 0.016, 0.025], shade(S.headCol, 0.7));
    } else if (S.head === 'beanie') {
      // knit beanie: dome, folded ribbed cuff, pom-pom
      bd.ellipsoid(H([0, 0.065, 0.008]), HB, [0.212, 0.2, 0.226], S.headCol);
      for (let k = 0; k < 3; k++) bd.capsule(H([0, 0.02 + k * 0.016, 0.008]), H([0, 0.03 + k * 0.016, 0.008]), 0.112 - k * 0.002, 0.11 - k * 0.002, k === 1 ? S.accent : shade(S.headCol, 0.9));
      bd.ellipsoid(H([0, 0.17, 0.01]), HB, [0.06, 0.055, 0.06], S.accent);
      bd.ellipsoid(H([0.015, 0.18, -0.005]), HB, [0.04, 0.04, 0.04], shade(S.accent, 1.2));
    } else if (S.head === 'bucket') {
      // bucket hat: crown, band, wide sloping brim with a stitched edge
      bd.ellipsoid(H([0, 0.03, 0.02]), HB, [0.2, 0.2, 0.215], hair);
      const DB = { R: HB.R, U: HB.B.map((v) => -v), B: HB.U };      // disc basis: axis = head up
      bd.cyl(H([0, 0.085, 0.005]), DB, [0.21, 0.226, 0.1], S.headCol);
      bd.ellipsoid(H([0, 0.135, 0.005]), HB, [0.205, 0.04, 0.22], S.headCol);
      bd.cyl(H([0, 0.045, 0.005]), DB, [0.216, 0.232, 0.022], shade(S.headCol, 0.7));                      // band
      bd.cyl(H([0, 0.03, 0.005]), DB, [0.36, 0.37, 0.012], S.headCol);                                     // brim
      bd.cyl(H([0, 0.026, 0.005]), DB, [0.37, 0.38, 0.008], shade(S.headCol, 0.85));
    } else if (S.head === 'spiky') {
      bd.ellipsoid(H([0, 0.035, 0.022]), HB, [0.2, 0.205, 0.215], hair);
      const spikes = [[0, 0.12, -0.05, 0.1, -0.1], [-0.05, 0.11, -0.02, -0.08, -0.04], [0.05, 0.11, -0.02, 0.1, -0.03], [0, 0.125, 0.02, 0, 0.06], [-0.06, 0.09, 0.05, -0.1, 0.07], [0.06, 0.09, 0.05, 0.1, 0.07], [0, 0.1, 0.08, 0, 0.1], [-0.03, 0.12, -0.07, -0.04, -0.12], [0.03, 0.12, -0.07, 0.06, -0.12]];
      for (const [x, y, z, dx, dz] of spikes) bd.capsule(H([x, y - 0.03, z]), H([x + dx * 0.4, y + 0.06, z + dz * 0.4]), 0.032, 0.006, hair, S.hairGlow || 0);
    } else if (S.head === 'facemask') {
      // smooth performer mask over the face, hair behind
      bd.ellipsoid(H([0, 0.035, 0.03]), HB, [0.2, 0.205, 0.205], hair);
      withMat('paint', () => {
        bd.ellipsoid(H([0, -0.005, -0.012]), HB, [0.196, 0.262, 0.214], S.headCol);
        bd.rbox(H([0, 0.045, -0.096]), pitchBasis(HB, 0.15), [0.14, 0.02, 0.03], 0.01, shade(S.headCol, 0.85));   // brow ridge
      });
      for (const sx of [-1, 1]) {
        const EB = { R: HB.R.map((v, n) => v * Math.cos(sx * 0.25) + HB.U[n] * Math.sin(sx * 0.25)), U: HB.U.map((v, n) => v * Math.cos(sx * 0.25) - HB.R[n] * Math.sin(sx * 0.25)), B: HB.B };
        bd.ellipsoid(H([sx * 0.04, 0.012, -0.104]), EB, [0.05, 0.022, 0.012], S.visor, S.visorGlow || 0);           // eye slits
      }
      bd.rbox(H([0, -0.065, -0.1]), HB, [0.05, 0.006, 0.01], 0.003, shade(S.headCol, 0.6));
      if (S.maskStripe) bd.rbox(H([0, 0.02, -0.112]), HB, [0.012, 0.2, 0.01], 0.004, S.maskStripe, 0.3);
    } else if (S.head === 'hair') {
      bd.ellipsoid(H([0, 0.035, 0.022]), HB, [0.2, 0.205, 0.215], hair);
      bd.ellipsoid(H([0.02, 0.085, -0.05]), HB, [0.15, 0.06, 0.09], hair);                                       // quiff
    } else if (S.head === 'helmet') {
      withMat(S.headMat || 'paint', () => bd.ellipsoid(H([0, 0.03, 0.008]), HB, [0.235, 0.235, 0.25], S.headCol));
      bd.ellipsoid(H([0, 0.012, -0.022]), HB, [0.226, 0.085, 0.236], S.visor, 0.6);                              // wraparound visor
      bd.ellipsoid(H([0, 0.012, -0.018]), HB, [0.232, 0.1, 0.236], shade(S.headCol, 0.5));                       // visor rim (shows as a thin dark edge)
      for (const sx of [-1, 1]) bd.ellipsoid(H([sx * 0.112, 0.0, 0]), HB, [0.035, 0.08, 0.08], shade(S.headCol, 0.6));
      bd.rbox(H([0, 0.1, -0.02]), HB, [0.04, 0.03, 0.16], 0.012, shade(S.headCol, 0.8));                        // crest
    } else if (S.head === 'mask') {                                                                               // balaclava + goggles
      bd.ellipsoid(H([0, 0.008, 0.008]), HB, [0.212, 0.245, 0.232], S.headCol);
      bd.rbox(H([0, -0.06, -0.018]), HB, [0.165, 0.125, 0.175], 0.06, S.headCol);
      bd.ellipsoid(H([0, -0.03, -0.098]), HB, [0.05, 0.06, 0.04], shade(S.headCol, 1.15));                          // nose under the fabric
      bd.ellipsoid(H([0, 0.022, -0.016]), HB, [0.222, 0.06, 0.232], S.visor, 0.7);                                   // goggle lens
      bd.ellipsoid(H([0, 0.022, -0.012]), HB, [0.226, 0.075, 0.232], [0.06, 0.06, 0.065]);                           // goggle frame
    }

    if (P.holdGun && P.gun && this.gunDef) {
      const g = P.gun, cx = Math.cos(g.rx), sx = Math.sin(g.rx), cyy = Math.cos(g.ry), syy = Math.sin(g.ry);
      const toChar = (q) => {   // gun space -> character space (Ry * Rx, like compose)
        const y1 = q[1] * cx - q[2] * sx, z1 = q[1] * sx + q[2] * cx;
        return [g.c[0] + q[0] * cyy + z1 * syy, g.c[1] + y1, g.c[2] - q[0] * syy + z1 * cyy];
      };
      const d = this.gunDef;
      P.hands = [toChar(d.foreGrip || [0, -0.04, -0.25]), toChar(d.grip || [0, -0.08, 0.1])];
    }
    // ---- arms (solved to the hands): tapered upper arm + forearm, glove with thumb
    [-1, 1].forEach((side, i) => {
      const sh = up([side * 0.22 * b, 0.52, 0]);
      const hand = P.hands[i];
      const out_ = P.elbowOut || 0.8;
      const elbow = ik(sh, hand, UA, FA, P.armHint ? P.armHint[i] : [side * out_, -0.7, 0.35]);
      const sleeve = S.jacket || top;
      const wrist = lerp3(elbow, hand, 0.84);
      const shortSl = !S.jacket && topSt === 'tee';
      if (shortSl) {
        bd.capsule(W(sh), W(elbow), 0.05 * b, 0.042 * b, skin);
        bd.capsule(W(sh), W(lerp3(sh, elbow, 0.5)), 0.064 * b, 0.06 * b, sleeve);                          // short sleeve
        bd.capsule(W(lerp3(sh, elbow, 0.46)), W(lerp3(sh, elbow, 0.52)), 0.062 * b, 0.062 * b, shade(sleeve, 0.88));
        bd.ellipsoid(W(elbow), HB0, [0.084 * b, 0.084 * b, 0.084 * b], skin);
        bd.capsule(W(elbow), W(wrist), 0.042 * b, 0.032 * b, skin);
      } else if (S.jacket && jackSt === 'puffer') {
        for (let k = 0; k < 3; k++) bd.capsule(W(lerp3(sh, elbow, k / 3)), W(lerp3(sh, elbow, (k + 1) / 3)), 0.082 * b, 0.075 * b, k % 2 ? sleeve : shade(sleeve, 0.94));
        for (let k = 0; k < 3; k++) bd.capsule(W(lerp3(elbow, wrist, k / 3)), W(lerp3(elbow, wrist, (k + 1) / 3)), 0.072 * b, 0.064 * b, k % 2 ? shade(sleeve, 0.94) : sleeve);
        bd.capsule(W(lerp3(elbow, hand, 0.8)), W(lerp3(elbow, hand, 0.84)), 0.05 * b, 0.05 * b, shade(sleeve, 0.7));
      } else {
        const sw = S.jacket ? 0.008 : 0;
        bd.capsule(W(sh), W(elbow), (0.056 + sw) * b, (0.046 + sw) * b, sleeve);
        bd.ellipsoid(W(elbow), HB0, [(0.09 + sw * 2) * b, (0.09 + sw * 2) * b, (0.09 + sw * 2) * b], sleeve);     // elbow fill
        bd.capsule(W(elbow), W(wrist), (0.046 + sw) * b, (0.036 + sw) * b, sleeve);
        if (S.jacket || topSt === 'hoodie') bd.capsule(W(lerp3(elbow, hand, 0.72)), W(lerp3(elbow, hand, 0.82)), 0.046 * b, 0.044 * b, S.trim || shade(sleeve, 0.75));   // ribbed cuff
        if (S.jacket && jackSt === 'track') {
          // two contrast stripes down the outside of each sleeve
          const ad = norm3(sub3(elbow, sh)), od = norm3(sub3([side, 0, 0], ad.map((v) => v * ad[0] * side)));
          const ad2 = norm3(sub3(wrist, elbow)), od2 = norm3(sub3([side, 0, 0], ad2.map((v) => v * ad2[0] * side)));
          for (const dz of [-0.012, 0.012]) {
            bd.capsule(W(add3(add3(sh, od.map((v) => v * 0.062 * b)), [0, 0, dz])), W(add3(add3(elbow, od.map((v) => v * 0.054 * b)), [0, 0, dz])), 0.007, 0.007, S.stripe || [0.95, 0.95, 0.95]);
            bd.capsule(W(add3(add3(elbow, od2.map((v) => v * 0.054 * b)), [0, 0, dz])), W(add3(add3(wrist, od2.map((v) => v * 0.044 * b)), [0, 0, dz])), 0.007, 0.007, S.stripe || [0.95, 0.95, 0.95]);
          }
        }
        if (S.jacket && jackSt === 'bomber' && side < 0) {
          bd.rbox(W(lerp3(sh, elbow, 0.35)), basisFrom(Wd(norm3(sub3(sh, elbow))), Wd([-1, 0, 0])), [0.05, 0.06, 0.02], 0.008, shade(S.jacket, 0.82));   // sleeve pocket
          withMat('brass', () => bd.rbox(W(add3(lerp3(sh, elbow, 0.3), [-0.004, 0, 0])), basisFrom(Wd(norm3(sub3(sh, elbow))), Wd([-1, 0, 0])), [0.008, 0.02, 0.006], 0.002, [0.75, 0.75, 0.78]));
        }
      }
      // glove: oriented along the forearm
      const fd = [hand[0] - elbow[0], hand[1] - elbow[1], hand[2] - elbow[2]];
      const fl = Math.hypot(...fd);
      const back = Wd(fd.map((v) => -v / fl));
      let upv = Wd([side * 0.3, 1, 0]);
      const dp = upv[0] * back[0] + upv[1] * back[1] + upv[2] * back[2];
      upv = upv.map((v, k) => v - back[k] * dp);
      const ul = Math.hypot(...upv); upv = upv.map((v) => v / ul);
      const R = [upv[1] * back[2] - upv[2] * back[1], upv[2] * back[0] - upv[0] * back[2], upv[0] * back[1] - upv[1] * back[0]];
      const GB = { R, U: upv, B: back };
      const hc = W(hand);
      const gst = S.gloveStyle || 'plain', gc = gst === 'tape' ? skin : S.gloves;
      bd.rbox(at(hc, GB, [0, 0.005, 0.012]), GB, [0.07 * b, 0.075, 0.075], 0.03, gc);                          // palm
      bd.rbox(at(hc, GB, [0, -0.008, -0.042]), pitchBasis(GB, -0.55), [0.068 * b, 0.05, 0.06], 0.022, gc);    // curled fingers
      bd.capsule(at(hc, GB, [-side * 0.035, 0.015, -0.0]), at(hc, GB, [-side * 0.045, 0.03, -0.05]), 0.016, 0.013, gc);   // thumb
      if (gst === 'tactical') {
        bd.rbox(at(hc, GB, [0, 0.034, -0.02]), GB, [0.06 * b, 0.018, 0.035], 0.008, shade(S.gloves, 1.8));     // knuckle guard
        bd.capsule(at(hc, GB, [0, 0, 0.055]), at(hc, GB, [0, 0, 0.07]), 0.04 * b, 0.04 * b, shade(S.gloves, 1.4));   // wrist strap
      } else if (gst === 'tape') {
        for (const [z, r] of [[0.055, 0.037], [0.075, 0.036], [0.01, 0.04], [-0.02, 0.039]]) bd.capsule(at(hc, GB, [0, 0.004, z - 0.006]), at(hc, GB, [0, 0.004, z + 0.006]), r * b, r * b, S.gloves);
      } else if (gst === 'host') {
        bd.capsule(at(hc, GB, [0, 0, 0.05]), at(hc, GB, [0, 0, 0.085]), 0.04 * b, 0.048 * b, S.gloves);      // flared cuff
        for (const x of [-0.016, 0, 0.016]) bd.rbox(at(hc, GB, [x, 0.04, 0.012]), GB, [0.004, 0.003, 0.05], 0.001, shade(S.gloves, 0.6));   // stitching
      }
    });

    // ---- weapon: either a real gun model (gunMatrix, drawn by the caller) or a simple prop
    if (P.gun && this.realGun) {
      const g = P.gun;
      compose(this.gunMatrix, W(g.c), [g.rx, this.yaw + g.ry, 0], [1, 1, 1]);
    } else if (P.gun) {
      const g = P.gun;
      compose(this.gunMatrix, W(g.c), [g.rx, this.yaw + g.ry, 0], [1, 1, 1]);
    }
    return bd.out;
  }
}
