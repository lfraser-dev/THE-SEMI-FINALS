// Takedown choreography: the attacker's whole-body animation for each finisher, and the props they swing.
// Poses are in bot space (x right, y up, -z forward, feet at the origin), with the downed body lying
// about REACH metres in front. The same poses drive your own body in the takedown cutscene, bots doing
// takedowns, and other players' bodies online.
import { Builder, basisFrom } from './rig.js';

export const REACH = 1.25;          // how far in front of the attacker the downed body's chest lies
const PI = Math.PI;

// keyframes: [[time, value], ...] with smooth easing between them; values are numbers or arrays
function kf(frames, t) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, v1] = frames[i];
    if (t <= t1) {
      const [t0, v0] = frames[i - 1];
      let u = (t - t0) / Math.max(1e-4, t1 - t0);
      u = u * u * (3 - 2 * u);
      return Array.isArray(v0) ? v0.map((a, k) => a + (v1[k] - a) * u) : v0 + (v1 - v0) * u;
    }
  }
  return frames[frames.length - 1][1];
}

const GUARD_L = [-0.18, 1.15, -0.32], GUARD_R = [0.2, 1.15, -0.32], FOOT_R = [0.12, 0.06, 0];

// each: off (body offset), rot (whole-body pitch, + leans forward), crouch, hands [L, R], footR, and a prop
const ANIMS = {
  blade: {
    trail: 'tip',
    off: [[0, [0, 0, 0]], [0.3, [0, 0, -0.5]], [1.25, [0, 0, -0.5]], [1.5, [0, 0, 0]]],
    rot: [[0, 0], [0.3, 0.55], [1.25, 0.55], [1.5, 0]],
    crouch: [[0, 0], [0.3, 0.42], [1.25, 0.42], [1.5, 0]],
    L: [[0, GUARD_L], [0.3, [-0.22, 1.2, -0.3]], [1.5, GUARD_L]],
    R: [[0, GUARD_R], [0.38, [0.48, 1.3, -0.12]], [0.55, [-0.18, 0.9, -0.55]], [0.75, [-0.25, 1.2, -0.3]], [1.0, [0.32, 0.85, -0.58]], [1.25, [0.3, 1.0, -0.4]], [1.5, GUARD_R]],
    prop: 'knife',
  },
  flipkick: {
    spin: true, trail: 'foot',
    off: [[0, [0, 0, 0]], [0.35, [0, 0, -0.35]], [0.75, [0, 0, -0.4]], [1.1, [0, 0.95, 0.1]], [1.45, [0, 0.4, 0.6]], [1.6, [0, 0, 0.7]], [1.7, [0, 0, 0.7]]],
    rot: [[0, 0], [0.75, -0.15], [0.85, -0.35], [1.5, -2 * PI], [1.7, -2 * PI]],
    crouch: [[0, 0], [0.3, 0.25], [0.5, 0], [0.95, 0.1], [1.55, 0.35], [1.7, 0]],
    L: [[0, GUARD_L], [0.5, [-0.5, 1.25, -0.1]], [1.3, [-0.35, 1.0, -0.2]], [1.7, GUARD_L]],
    R: [[0, GUARD_R], [0.5, [0.5, 1.25, 0.05]], [1.3, [0.35, 1.0, -0.2]], [1.7, GUARD_R]],
    footR: [[0, FOOT_R], [0.4, [0.12, 0.06, 0.1]], [0.6, [0.12, 0.4, 0.3]], [0.75, [0.1, 0.28, -0.82]], [0.95, [0.1, 0.65, -0.5]], [1.3, [0.12, 0.3, 0]], [1.7, FOOT_R]],
    prop: null,
  },
  shockpalm: {
    trail: 'hand',
    off: [[0, [0, 0, 0]], [0.35, [0, 0, -0.5]], [1.3, [0, 0, -0.5]], [1.6, [0, 0, 0]]],
    rot: [[0, 0], [0.35, 0.3], [0.75, 0.2], [1.05, 0.6], [1.3, 0.6], [1.6, 0]],
    crouch: [[0, 0], [0.35, 0.4], [1.05, 0.45], [1.3, 0.45], [1.6, 0]],
    L: [[0, GUARD_L], [0.4, [-0.3, 1.0, -0.25]], [1.6, GUARD_L]],
    R: [[0, GUARD_R], [0.75, [0.32, 1.1, 0.18]], [0.9, [0.3, 1.12, 0.2]], [1.05, [0.1, 0.55, -0.62]], [1.3, [0.1, 0.6, -0.55]], [1.6, GUARD_R]],
    prop: 'orb',
  },
  buttstroke: {
    trail: 'tip',
    off: [[0, [0, 0, 0]], [0.25, [0, 0, -0.45]], [1.35, [0, 0, -0.45]], [1.6, [0, 0, 0]]],
    rot: [[0, 0], [0.3, -0.1], [0.55, 0.45], [0.8, -0.05], [1.1, 0.5], [1.35, 0.45], [1.6, 0]],
    crouch: [[0, 0], [0.3, 0.1], [0.55, 0.3], [0.8, 0.12], [1.1, 0.32], [1.35, 0.3], [1.6, 0]],
    L: [[0, [-0.1, 1.1, -0.5]], [0.3, [0.0, 1.45, -0.15]], [0.55, [0.0, 0.75, -0.6]], [0.8, [0.0, 1.45, -0.15]], [1.1, [0.0, 0.68, -0.62]], [1.35, [0.0, 0.75, -0.6]], [1.6, [-0.1, 1.1, -0.5]]],
    R: [[0, [0.2, 1.15, -0.25]], [0.3, [0.15, 1.75, 0.1]], [0.55, [0.1, 1.2, -0.3]], [0.8, [0.15, 1.75, 0.1]], [1.1, [0.1, 1.15, -0.32]], [1.35, [0.1, 1.2, -0.3]], [1.6, [0.2, 1.15, -0.25]]],
    prop: 'rifle',
  },
  pocketnade: {
    trail: 'hand',
    off: [[0, [0, 0, 0]], [0.4, [0, 0, -0.45]], [0.9, [0, 0, -0.45]], [1.25, [0, 0, 0.55]], [1.9, [0, 0, 0.55]]],
    rot: [[0, 0], [0.4, 0.6], [0.9, 0.6], [1.25, -0.12], [1.9, 0]],
    crouch: [[0, 0], [0.4, 0.55], [0.9, 0.55], [1.25, 0.1], [1.9, 0]],
    L: [[0, GUARD_L], [0.3, [0.06, 1.22, -0.36]], [0.5, [-0.4, 1.3, -0.1]], [0.9, [-0.3, 1.0, -0.2]], [1.25, [-0.1, 1.48, -0.25]], [1.9, [-0.1, 1.48, -0.25]]],
    R: [[0, [0.15, 1.2, -0.35]], [0.35, [0.1, 1.2, -0.38]], [0.8, [0.08, 0.45, -0.65]], [0.95, [0.1, 0.5, -0.6]], [1.25, [0.1, 1.48, -0.25]], [1.9, [0.1, 1.48, -0.25]]],
    prop: 'nade',
  },
  elbowdrop: {
    spin: true, trail: 'elbow',
    off: [[0, [0, 0, 0]], [0.25, [0, 0, -0.1]], [0.65, [0, 1.0, -0.35]], [1.05, [0, -0.55, -0.75]], [1.3, [0, -0.5, -0.7]], [1.7, [0, 0, -0.2]]],
    rot: [[0, 0], [0.25, 0.1], [0.65, 0.45], [1.05, 1.35], [1.3, 1.3], [1.7, 0]],
    crouch: [[0, 0], [0.25, 0.4], [0.45, 0], [1.3, 0.1], [1.55, 0.35], [1.7, 0]],
    L: [[0, GUARD_L], [0.6, [-0.5, 1.6, -0.1]], [0.95, [-0.2, 1.3, -0.25]], [1.7, GUARD_L]],
    R: [[0, GUARD_R], [0.6, [0.5, 1.75, 0.0]], [0.95, [0.12, 1.32, -0.12]], [1.3, [0.12, 1.3, -0.12]], [1.7, GUARD_R]],
    prop: null,
  },
  stomp: {
    trail: 'foot',
    off: [[0, [0, 0, 0]], [0.3, [0, 0, -0.55]], [1.5, [0, 0, -0.55]]],
    rot: [[0, 0], [0.7, -0.08], [0.95, 0.2], [1.2, 0.15], [1.5, 0]],
    crouch: [[0, 0], [0.7, 0], [0.95, 0.22], [1.2, 0.2], [1.5, 0]],
    L: [[0, GUARD_L], [0.7, [-0.48, 1.45, -0.05]], [0.95, [-0.35, 0.95, -0.1]], [1.5, GUARD_L]],
    R: [[0, GUARD_R], [0.7, [0.48, 1.45, -0.05]], [0.95, [0.35, 0.95, -0.1]], [1.5, GUARD_R]],
    footR: [[0, FOOT_R], [0.3, [0.12, 0.06, -0.1]], [0.7, [0.12, 0.78, -0.5]], [0.95, [0.12, 0.16, -0.72]], [1.2, [0.12, 0.16, -0.72]], [1.5, FOOT_R]],
    prop: null,
  },
  sledge: {
    trail: 'tip',
    off: [[0, [0, 0, 0]], [0.4, [0, 0, -0.3]], [1.9, [0, 0, -0.3]]],
    rot: [[0, 0], [0.5, -0.12], [0.9, -0.25], [1.3, 0.55], [1.6, 0.5], [1.9, 0]],
    crouch: [[0, 0], [0.9, 0], [1.3, 0.35], [1.6, 0.32], [1.9, 0]],
    L: [[0, [0.05, 0.95, -0.2]], [0.5, [0.08, 1.85, 0.05]], [0.9, [0.06, 1.85, 0.15]], [1.3, [0.03, 0.85, -0.45]], [1.6, [0.03, 0.85, -0.45]], [1.9, [0.05, 0.95, -0.2]]],
    R: [[0, [0.15, 1.0, -0.3]], [0.5, [0.12, 1.8, 0.25]], [0.9, [0.1, 1.7, 0.4]], [1.3, [0.05, 0.75, -0.6]], [1.6, [0.05, 0.75, -0.6]], [1.9, [0.15, 1.0, -0.3]]],
    prop: 'hammer',
  },
  bodyslam: {
    spin: true, trail: 'hand',
    off: [[0, [0, 0, 0]], [0.3, [0, 0, 0]], [0.75, [0, 1.5, -0.6]], [1.1, [0, -0.6, -0.9]], [1.35, [0, 0.3, -0.6]], [1.6, [0, 0, -0.3]], [1.8, [0, 0, -0.3]]],
    rot: [[0, 0], [0.3, 0.15], [0.75, 0.35], [1.1, 1.5], [1.35, 0.8], [1.6, 0], [1.8, 0]],
    crouch: [[0, 0], [0.3, 0.45], [0.5, 0], [1.6, 0.3], [1.8, 0]],
    L: [[0, GUARD_L], [0.6, [-0.58, 1.35, -0.15]], [1.35, [-0.58, 1.3, -0.2]], [1.8, GUARD_L]],
    R: [[0, GUARD_R], [0.6, [0.58, 1.35, -0.15]], [1.35, [0.58, 1.3, -0.2]], [1.8, GUARD_R]],
    prop: null,
  },
};

// the pose for a takedown at time t (seconds)
export function takedownPose(kind, t) {
  const a = ANIMS[kind];
  if (!a) return null;
  return {
    off: kf(a.off, t), rot: kf(a.rot, t), crouch: kf(a.crouch, t),
    hands: [kf(a.L, t), kf(a.R, t)], footR: a.footR ? kf(a.footR, t) : null, spin: !!a.spin,
  };
}

// props in the attacker's hands, swing trails and sparks (needs bot.armW from the bot's last parts() call).
// `def` gives hitAt; `bodyPt` is where the downed body's chest is.
export function takedownProps(out, bot, kind, t, def, bodyPt, accent = [1, 0.68, 0.08]) {
  const a = ANIMS[kind], arm = bot.armW;
  if (!a || !arm) return;
  const bd = (bot.propBd ||= new Builder()).reset();
  const [hL, hR] = [arm.hL, arm.hR];
  const along = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
  const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  const side = nrm([Math.cos(bot.yaw), 0, -Math.sin(bot.yaw)]);
  const steel = [0.78, 0.8, 0.84], dark = [0.07, 0.07, 0.08], grip = [0.14, 0.14, 0.15], wood = [0.42, 0.27, 0.13];
  const h = def.hitAt;
  let tip = null;
  switch (a.prop) {
    case 'knife': {
      // a combat knife: ridged grip, guard, a clip-point blade with a bright edge
      const d = nrm([hR[0] - arm.eR[0], hR[1] - arm.eR[1], hR[2] - arm.eR[2]]);
      const B = basisFrom(d, side);
      bd.capsule(along(hR, d, -0.02), along(hR, d, 0.1), 0.02, 0.018, grip, 0);
      for (const k of [0.01, 0.04, 0.07]) bd.rbox(along(hR, d, k), B, [0.045, 0.008, 0.045], 0.004, dark, 0);
      bd.rbox(along(hR, d, 0.115), B, [0.085, 0.014, 0.03], 0.006, dark, 0);
      bd.rbox(along(hR, d, 0.23), B, [0.01, 0.22, 0.05], 0.004, steel, 0.2);
      bd.rbox(along(along(hR, d, 0.24), B.B, -0.024), B, [0.006, 0.2, 0.008], 0.002, [0.95, 0.97, 1], 0.6);
      bd.rbox(along(along(hR, d, 0.345), B.B, 0.008), B, [0.009, 0.03, 0.03], 0.004, steel, 0.2);
      tip = along(hR, d, 0.36);
      break;
    }
    case 'orb': {
      // the shock glove: a gauntlet with coils that charge up and arc into them at the hit
      const e = t < h ? Math.min(1, t / h) ** 1.5 : Math.max(0, 1 - (t - h) / 0.3);
      const d = nrm([hR[0] - arm.eR[0], hR[1] - arm.eR[1], hR[2] - arm.eR[2]]);
      const B = basisFrom(d, side);
      bd.rbox(along(hR, d, -0.02), B, [0.13, 0.16, 0.13], 0.04, dark, 0);
      for (const k of [-0.08, -0.13]) bd.capsule(along(along(hR, d, k), B.B, 0.07), along(along(hR, d, k), B.B, 0.071), 0.03, 0.03, [0.3 + 0.4 * e, 0.75, 1], 0.3 + 0.7 * e);
      if (e > 0.05) bd.ellipsoid(along(hR, d, 0.06), B, [0.1 + 0.16 * e, 0.1 + 0.16 * e, 0.1 + 0.16 * e], [0.55, 0.88, 1], 1);
      // arcs: jagged bolts out of the hand (and into the body at the hit)
      const arcs = t > h - 0.12 && t < h + 0.3 && bodyPt ? 4 : e > 0.4 ? 2 : 0;
      for (let n = 0; n < arcs; n++) {
        const to = t > h - 0.12 && bodyPt ? bodyPt.map((v, i) => v + (Math.random() - 0.5) * 0.5) : along(hR, [Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5], 0.4);
        let p0 = hR;
        for (let k = 1; k <= 5; k++) {
          const u = k / 5, j = k < 5 ? 0.09 : 0;
          const p1 = p0.map((_, i) => hR[i] + (to[i] - hR[i]) * u + (Math.random() - 0.5) * j * 2);
          bd.capsule(p0, p1, 0.012, 0.012, [0.7, 0.92, 1], 1);
          p0 = p1;
        }
      }
      tip = hR;
      break;
    }
    case 'rifle': {
      // the team rifle held upside down, stock first
      const d = nrm([hL[0] - hR[0], hL[1] - hR[1], hL[2] - hR[2]]);
      const B = basisFrom(d, side);
      bd.rbox(along(hR, d, 0.14), B, [0.07, 0.4, 0.12], 0.02, [0.13, 0.13, 0.14], 0);
      bd.rbox(along(along(hR, d, 0.14), B.R, 0.037), B, [0.006, 0.3, 0.02], 0.003, accent, 0.4);
      bd.rbox(along(along(hR, d, 0.2), B.B, 0.08), B, [0.05, 0.08, 0.14], 0.015, dark, 0);       // mag
      bd.capsule(along(hR, d, -0.06), along(hR, d, -0.48), 0.02, 0.018, [0.22, 0.22, 0.24], 0);   // barrel
      bd.rbox(along(hR, d, -0.5), B, [0.045, 0.06, 0.045], 0.015, dark, 0);
      bd.rbox(along(hL, d, 0.2), B, [0.06, 0.28, 0.12], 0.025, [0.17, 0.17, 0.18], 0);           // stock
      bd.rbox(along(hL, d, 0.35), B, [0.07, 0.04, 0.14], 0.012, dark, 0);                        // butt pad
      tip = along(hL, d, 0.37);
      break;
    }
    case 'nade': {
      const B = basisFrom([0, 1, 0], side);
      const blink = Math.floor(t * 12) % 2 === 1;
      const nade = (p, lit) => {
        bd.ellipsoid(p, B, [0.08, 0.1, 0.08], [0.24, 0.3, 0.14], 0);
        bd.rbox(along(p, [0, 1, 0], 0.06), B, [0.035, 0.03, 0.035], 0.008, [0.3, 0.3, 0.32], 0);
        if (lit) bd.ellipsoid(along(p, [0, 1, 0], 0.085), B, [0.03, 0.03, 0.03], [1, 0.25, 0.1], 1);
      };
      if (t < 0.85) nade(hR, t > 0.4 && blink);
      else if (t < h && bodyPt) nade(bodyPt, blink);
      if (t > 0.3 && t < 1.25) bd.capsule(hL, along(hL, [0, -1, 0], 0.001), 0.022, 0.022, [0.85, 0.75, 0.3], 0.2);   // the pin ring
      tip = hR;
      break;
    }
    case 'hammer': {
      // a sledgehammer: a long wooden handle with a taped grip, a heavy steel head with a team band
      const d = nrm([hR[0] - hL[0], hR[1] - hL[1], hR[2] - hL[2]]);
      const end = along(hL, d, 0.92);
      bd.capsule(along(hL, d, -0.1), end, 0.024, 0.022, wood, 0);
      bd.capsule(along(hL, d, -0.1), along(hL, d, 0.12), 0.028, 0.028, dark, 0);
      const B = basisFrom(d, side), HB = { R: B.B, U: B.R, B: B.U };
      bd.rbox(end, HB, [0.38, 0.17, 0.17], 0.035, [0.3, 0.3, 0.33], 0);
      for (const k of [-1, 1]) bd.rbox(along(end, B.B, k * 0.2), HB, [0.04, 0.19, 0.19], 0.02, steel, 0.15);
      bd.rbox(end, HB, [0.12, 0.18, 0.18], 0.01, accent, 0.2);
      tip = along(end, B.B, -0.22);
      break;
    }
    default:
      tip = a.trail === 'foot' ? bot.footW : a.trail === 'elbow' ? arm.eR : a.trail === 'hand' ? hR : null;
  }
  if (!tip && a.trail === 'foot') tip = bot.footW;
  // a swing trail: the last few tip positions, bright where it's moving fast
  if (tip) {
    const tr = (bot.tdTrail ||= []);
    if (tr.lastT > t) tr.length = 0;
    tr.lastT = t;
    tr.unshift([...tip]);
    if (tr.length > 9) tr.length = 9;
    for (let k = 1; k < tr.length; k++) {
      const p0 = tr[k - 1], p1 = tr[k], sp = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      if (sp < 0.04) continue;
      const f = 1 - k / tr.length, r = 0.028 * f + 0.004;
      bd.capsule(p0, p1, r, r * 0.8, accent.map((c) => c * 0.5 + 0.5), 0.9 * f);
    }
  }
  for (const p of bd.out) out.push(p);
}
