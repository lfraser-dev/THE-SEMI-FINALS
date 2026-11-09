// Contestants: the human characters used in the trailer (couch duo, trios, key art).
// A jointed box rig (two-bone IK for arms + legs) with outfit "skins" and a set of poses.
import { compose, mat4, anglesFor } from './math.js';

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
  }

  update(dt) { this.t += dt; }

  parts() {
    const S = this.skin, b = S.build || 1;
    const P = POSES[this.pose](this.t, this.talk);
    const out = [];
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const W = (v) => [this.pos[0] + cy * v[0] + sy * v[2], this.pos[1] + v[1], this.pos[2] - sy * v[0] + cy * v[2]];
    let mi = 0;
    const limb = (a, c, thick, color, extra = 1) => {
      const A = W(a), C = W(c), d = [C[0] - A[0], C[1] - A[1], C[2] - A[2]], len = Math.hypot(...d);
      const sc = [thick, thick * extra, len + thick * 0.5];
      compose(this.models[mi], mid(A, C), anglesFor(d), sc);
      out.push({ model: this.models[mi++], scale: sc, color, emissive: 0 });
    };
    const block = (c, size, rx, color, em = 0, ry = 0) => {
      compose(this.models[mi], W(c), [rx, this.yaw + ry, 0], size);
      out.push({ model: this.models[mi++], scale: size, color, emissive: em });
    };
    const breathe = P.breath != null ? Math.sin(P.breath * 2) * 0.01 : 0;
    const pelvis = P.pelvis;
    const lean = P.lean || 0, tw = P.twist || 0;
    const up = (v) => {   // offset from the pelvis, through torso twist + lean
      const x = v[0] * Math.cos(tw) + v[2] * Math.sin(tw), z = -v[0] * Math.sin(tw) + v[2] * Math.cos(tw);
      return add3(pelvis, [x, v[1] * Math.cos(lean) + z * Math.sin(lean), -v[1] * Math.sin(lean) + z * Math.cos(lean)]);
    };

    // legs
    [-1, 1].forEach((side, i) => {
      const hip = add3(pelvis, [side * 0.12 * b, -0.04, 0]);
      const foot = P.feet[i];
      const knee = ik(hip, foot, L, L, P.kneeHint || [0, 0.2, -1]);
      limb(hip, knee, 0.18 * b, S.bottom);
      limb(knee, foot, 0.15 * b, S.bottom);
      block(lerp3(knee, foot, 0.08), [0.17 * b, 0.12, 0.12], 0, S.accent);           // knee pad
      block([foot[0], 0.06, foot[2] - 0.05], [0.16 * b, 0.12, 0.3], 0, S.shoes);
      block([foot[0], 0.015, foot[2] - 0.05], [0.17 * b, 0.03, 0.31], 0, [0.1, 0.1, 0.1]);   // sole
    });
    block(add3(pelvis, [0, 0.04, 0]), [0.42 * b, 0.22, 0.26 * b], -lean * 0.5, S.bottom);
    block(up([0, 0.1, 0]), [0.44 * b, 0.06, 0.28 * b], -lean, [0.12, 0.1, 0.08]);          // belt

    // torso + outfit layers
    const chest = up([0, 0.36 + breathe, 0]);
    block(chest, [0.5 * b, 0.52, 0.28 * b], -lean, S.top, 0, tw);
    if (S.jacket) {
      block(up([-0.17 * b, 0.36, 0]), [0.2 * b, 0.54, 0.31 * b], -lean, S.jacket, 0, tw);
      block(up([0.17 * b, 0.36, 0]), [0.2 * b, 0.54, 0.31 * b], -lean, S.jacket, 0, tw);
      block(up([0, 0.6, 0.02]), [0.46 * b, 0.08, 0.32 * b], -lean, S.jacket, 0, tw);        // collar
    }
    if (S.vest) {
      block(up([0, 0.38, -0.15 * b]), [0.42 * b, 0.4, 0.06], -lean, S.vest, 0, tw);
      block(up([0, 0.38, 0.15 * b]), [0.42 * b, 0.4, 0.06], -lean, S.vest, 0, tw);
      block(up([0, 0.42, -0.19 * b]), [0.12, 0.08, 0.02], -lean, S.accent, 0.2, tw);
    } else {
      block(up([0, 0.42, -0.145 * b]), [0.3 * b, 0.05, 0.01], -lean, S.accent, 0.1, tw);   // chest stripe
    }
    if (S.scarf) block(up([0, 0.62, -0.04]), [0.32, 0.1, 0.3], -lean, S.scarf, 0, tw);

    // head
    const neck = up([0, 0.64, 0]);
    const [hy, hp] = P.head || [0, 0];
    const headC = add3(neck, [0, 0.17, 0]);
    const hr = (v) => {   // offset in head space: pitch (look up/down) then yaw (incl. torso twist)
      const yy = v[1] * Math.cos(hp) - v[2] * Math.sin(hp), zz = v[1] * Math.sin(hp) + v[2] * Math.cos(hp);
      const h = hy + tw;
      return add3(headC, [v[0] * Math.cos(h) + zz * Math.sin(h), yy, -v[0] * Math.sin(h) + zz * Math.cos(h)]);
    };
    const hb = (v, size, color, em = 0) => block(hr(v), size, hp, color, em, hy + tw);
    block(add3(neck, [0, 0.03, 0]), [0.13, 0.12, 0.13], 0, S.skin);
    hb([0, 0, 0], [0.27, 0.3, 0.28], S.skin);
    // face: eyes + mouth (mouth opens while talking)
    const mouth = P.mouth != null ? P.mouth : this.talk * (0.35 + 0.65 * Math.abs(Math.sin(this.t * 17)));
    const masked = S.head === 'mask' || S.head === 'helmet';
    if (!masked) {
      hb([-0.06, 0.03, -0.142], [0.05, 0.035, 0.01], [0.08, 0.06, 0.05]);
      hb([0.06, 0.03, -0.142], [0.05, 0.035, 0.01], [0.08, 0.06, 0.05]);
      hb([0, -0.07, -0.142], [0.09, 0.012 + 0.04 * mouth, 0.01], [0.3, 0.06, 0.06]);
      hb([0, -0.0, -0.15], [0.04, 0.05, 0.03], S.skin.map((v) => v * 0.92));              // nose
    }
    if (S.head === 'cap') {
      hb([0, 0.13, 0.01], [0.29, 0.1, 0.3], S.headCol);
      hb([0, 0.09, -0.2], [0.27, 0.025, 0.14], S.headCol);                                // brim
      hb([0, 0.0, 0.13], [0.28, 0.2, 0.04], S.hair);
    } else if (S.head === 'beanie') {
      hb([0, 0.12, 0.01], [0.3, 0.13, 0.3], S.headCol);
      hb([0, 0.06, 0.0], [0.31, 0.04, 0.31], S.accent);
    } else if (S.head === 'bucket') {
      hb([0, 0.13, 0], [0.29, 0.12, 0.29], S.headCol);
      hb([0, 0.08, 0], [0.4, 0.025, 0.4], S.headCol);
    } else if (S.head === 'hair') {
      hb([0, 0.14, 0.02], [0.29, 0.08, 0.3], S.hair);
      hb([0, 0.02, 0.13], [0.29, 0.26, 0.05], S.hair);
      hb([-0.135, 0.05, 0.03], [0.03, 0.16, 0.22], S.hair);
      hb([0.135, 0.05, 0.03], [0.03, 0.16, 0.22], S.hair);
    } else if (S.head === 'helmet') {
      hb([0, 0.04, 0.01], [0.33, 0.36, 0.33], S.headCol);
      hb([0, 0.03, -0.165], [0.26, 0.1, 0.02], S.visor, 0.6);
      hb([0, -0.12, -0.14], [0.2, 0.08, 0.06], S.headCol.map((v) => v * 0.8));
    } else if (S.head === 'mask') {
      hb([0, 0, -0.142], [0.27, 0.3, 0.02], S.headCol);
      hb([-0.065, 0.04, -0.155], [0.07, 0.03, 0.01], S.visor, 0.7);
      hb([0.065, 0.04, -0.155], [0.07, 0.03, 0.01], S.visor, 0.7);
      hb([0, 0.13, 0.01], [0.29, 0.08, 0.3], S.hair || S.headCol);
    }

    // arms (solved to the hands)
    [-1, 1].forEach((side, i) => {
      const sh = up([side * 0.29 * b, 0.56, 0]);
      const hand = P.hands[i];
      const out_ = P.elbowOut || 0.8;
      const elbow = ik(sh, hand, UA, FA, [side * out_, -0.7, 0.35]);
      limb(sh, elbow, 0.13 * b, S.jacket || S.top);
      limb(elbow, hand, 0.11 * b, S.jacket ? S.jacket : S.top);
      block(hand, [0.1, 0.1, 0.11], 0, S.gloves);
      block(sh, [0.17 * b, 0.12, 0.2 * b], -lean, S.vest || S.jacket || S.top, 0, tw);      // shoulder
    });

    // weapon prop
    if (P.gun) {
      const g = P.gun, c = g.c;
      block(c, [0.07, 0.11, 0.62], g.rx, [0.12, 0.12, 0.13], 0, g.ry);
      const dz = (o) => [c[0] - Math.sin(g.ry) * o * Math.cos(g.rx), c[1] + Math.sin(g.rx) * o, c[2] - Math.cos(g.ry) * o * Math.cos(g.rx)];
      block(dz(0.05), [0.05, 0.16, 0.08], g.rx, [0.25, 0.25, 0.27], 0, g.ry);              // mag
      block(dz(0.36), [0.035, 0.035, 0.14], g.rx, [0.08, 0.08, 0.09], 0, g.ry);           // barrel
      block(dz(-0.1).map((v, i) => v + (i === 1 ? 0.07 : 0)), [0.05, 0.05, 0.1], g.rx, [0.08, 0.08, 0.09], 0, g.ry);   // sight
      block(dz(0.0).map((v, i) => v + (i === 0 ? 0.037 : 0)), [0.005, 0.02, 0.4], g.rx, S.accent, 0.5, g.ry);         // stripe
    }
    return out;
  }
}
