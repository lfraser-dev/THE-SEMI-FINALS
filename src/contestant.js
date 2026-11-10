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
      // side cargo pocket on the outside of the thigh
      const tmid = lerp3(hip, knee, 0.55);
      if (!S.zip) bd.capsule(W(add3(tmid, [side * 0.07 * b, 0.05, 0])), W(add3(tmid, [side * 0.07 * b, -0.06, 0])), 0.045, 0.045, shade(low, 0.82));
      // knee pad: a flat plate on the front of the knee
      const kd = norm3(sub3(ankle, hip));
      const kf = norm3([-kd[2] * 0 + 0, 0, -1]);
      const KB = basisFrom(Wd(norm3(sub3(hip, ankle))), Wd([-kf[0], -kf[1], -kf[2]]));
      if (!S.zip) bd.rbox(W(add3(knee, [0, 0.0, -0.06])), KB, [0.11 * b, 0.12, 0.05], 0.022, S.kneeCol || [0.16, 0.16, 0.17]);
      // boot: shaft, foot, toe cap, sole
      const FB = HB0;
      bd.capsule(W([foot[0], 0.11, foot[2] + 0.01]), W(lerp3(knee, ankle, 0.72)), 0.07 * b, 0.072 * b, S.shoes);
      bd.rbox(W([foot[0], 0.075, foot[2] - 0.03]), FB, [0.13 * b, 0.13, 0.27], 0.055, S.shoes);
      bd.ellipsoid(W([foot[0], 0.06, foot[2] - 0.13]), FB, [0.125 * b, 0.11, 0.13], S.shoes);
      bd.rbox(W([foot[0], 0.018, foot[2] - 0.04]), FB, [0.14 * b, 0.036, 0.31], 0.015, [0.08, 0.08, 0.09]);
      bd.rbox(W([foot[0], 0.13, foot[2] - 0.05]), FB, [0.1 * b, 0.02, 0.1], 0.008, shade(S.shoes, 0.7));      // laces
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
    if (S.jacket) {
      const jk = S.jacket;
      bd.capsule(T([0, 0.17, 0.0]), T([0, 0.3, 0.0]), 0.14 * b, 0.158 * b, jk);
      for (const sx of [-1, 1]) bd.rbox(T([sx * 0.115 * b, 0.42, 0]), TB, [0.2 * b, 0.32, 0.26 * b], 0.1, jk);  // jacket halves (open front)
      bd.rbox(T([0, 0.42, 0.05]), TB, [0.42 * b, 0.3, 0.17 * b], 0.09, jk);
      bd.rbox(T([0, 0.585, 0.02]), TB, [0.24 * b, 0.07, 0.2 * b], 0.032, shade(jk, 0.82));                         // collar
      bd.rbox(T([0, 0.18, 0]), TB, [0.34 * b, 0.05, 0.3 * b], 0.024, shade(jk, 0.82));                           // hem
      bd.rbox(T([0.012, 0.4, -0.133 * b]), TB, [0.01, 0.34, 0.008], 0.003, shade(jk, 0.45));                    // zip
    }
    if (S.vest) {
      const vs = S.vest;
      bd.rbox(T([0, 0.38, 0.0]), TB, [0.42 * b, 0.33, 0.27 * b], 0.12, vs);
      for (const sx of [-1, 1]) {
        bd.rbox(T([sx * 0.11 * b, 0.575, 0.0]), TB, [0.075, 0.05, 0.26 * b], 0.022, vs);                         // straps
        bd.rbox(T([sx * 0.1 * b, 0.3, -0.142 * b]), TB, [0.09, 0.11, 0.05], 0.018, shade(vs, 0.78));             // pouches
      }
      bd.rbox(T([0, 0.47, -0.138 * b]), TB, [0.12, 0.055, 0.012], 0.006, S.accent, 0.15);                      // patch
    } else if (!S.jacket && !S.zip) {
      bd.rbox(T([0, 0.47, -0.118 * b]), TB, [0.2 * b, 0.03, 0.01], 0.004, S.accent);                           // chest stripe
    }
    if (S.zip && !S.jacket) {
      const zc = shade(top, 0.8);
      bd.rbox(T([0, 0.6, 0.015]), TB, [0.17 * b, 0.075, 0.15 * b], 0.035, top);                                   // stand-up collar
      bd.rbox(T([0, 0.53, -0.108 * b]), TB, [0.008, 0.16, 0.008], 0.003, zc);                                     // zip
      bd.rbox(T([0, 0.58, -0.114 * b]), TB, [0.012, 0.024, 0.008], 0.004, [0.7, 0.7, 0.72]);                     // zip pull
    }
    if (S.logo) {   // chest emblem: a chevron on the left chest
      const lc = T([-0.085 * b, 0.5, -0.113 * b]);
      for (const sx of [-1, 1]) {
        const a = sx * 0.62, ca = Math.cos(a), sa = Math.sin(a);
        const LB = { R: TB.R.map((v, k) => v * ca + TB.U[k] * sa), U: TB.U.map((v, k) => v * ca - TB.R[k] * sa), B: TB.B };
        bd.rbox(at(lc, TB, [sx * 0.011, 0, 0]), LB, [0.012, 0.042, 0.008], 0.003, S.logo, 0.35);
      }
    }
    if (S.scarf) bd.capsule(T([-0.1, 0.62, -0.02]), T([0.1, 0.62, -0.02]), 0.07, 0.07, S.scarf);

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
    bd.ellipsoid(H([0, 0.01, 0.005]), HB, [0.19, 0.225, 0.215], skin);                    // skull
    bd.rbox(H([0, -0.058, -0.006]), HB, [0.13, 0.1, 0.15], 0.05, skin);                     // jaw
    bd.ellipsoid(H([0, -0.088, -0.05]), HB, [0.05, 0.034, 0.04], skin);                    // chin
    const masked = S.head === 'mask', visored = S.head === 'helmet';
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
      bd.ellipsoid(H([0, 0.06, 0.008]), HB, [0.21, 0.19, 0.225], S.headCol);
      bd.capsule(H([0, 0.028, 0.008]), H([0, 0.058, 0.008]), 0.108, 0.105, S.accent);
    } else if (S.head === 'bucket') {
      bd.ellipsoid(H([0, 0.03, 0.02]), HB, [0.2, 0.2, 0.215], hair);
      bd.capsule(H([0, 0.05, 0.005]), H([0, 0.115, 0.005]), 0.108, 0.1, S.headCol);
      bd.capsule(H([0, 0.045, 0.005]), H([0, 0.05, 0.005]), 0.16, 0.16, S.headCol);
    } else if (S.head === 'hair') {
      bd.ellipsoid(H([0, 0.035, 0.022]), HB, [0.2, 0.205, 0.215], hair);
      bd.ellipsoid(H([0.02, 0.085, -0.05]), HB, [0.15, 0.06, 0.09], hair);                                       // quiff
    } else if (S.head === 'helmet') {
      bd.ellipsoid(H([0, 0.03, 0.008]), HB, [0.235, 0.235, 0.25], S.headCol);
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
      bd.capsule(W(sh), W(elbow), 0.056 * b, 0.046 * b, sleeve);
      bd.ellipsoid(W(elbow), HB0, [0.09 * b, 0.09 * b, 0.09 * b], sleeve);                                   // elbow fill
      bd.capsule(W(elbow), W(wrist), 0.046 * b, 0.034 * b, S.sleeves === 'short' ? skin : sleeve);
      if (S.jacket) bd.capsule(W(lerp3(elbow, hand, 0.68)), W(lerp3(elbow, hand, 0.8)), 0.047 * b, 0.044 * b, shade(S.jacket, 0.82));   // cuff
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
      bd.rbox(hc, GB, [0.07 * b, 0.08, 0.1], 0.03, S.gloves);
      bd.capsule(at(hc, GB, [-side * 0.035, 0.015, -0.01]), at(hc, GB, [-side * 0.045, 0.03, -0.055]), 0.016, 0.013, S.gloves);   // thumb
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
