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
    off: [[0, [0, 0, 0]], [0.3, [0, 0, -0.5]], [1.25, [0, 0, -0.5]], [1.5, [0, 0, 0]]],
    rot: [[0, 0], [0.3, 0.55], [1.25, 0.55], [1.5, 0]],
    crouch: [[0, 0], [0.3, 0.42], [1.25, 0.42], [1.5, 0]],
    L: [[0, GUARD_L], [0.3, [-0.22, 1.2, -0.3]], [1.5, GUARD_L]],
    R: [[0, GUARD_R], [0.38, [0.48, 1.3, -0.12]], [0.55, [-0.18, 0.9, -0.55]], [0.75, [-0.25, 1.2, -0.3]], [1.0, [0.32, 0.85, -0.58]], [1.25, [0.3, 1.0, -0.4]], [1.5, GUARD_R]],
    prop: 'knife',
  },
  flipkick: {
    off: [[0, [0, 0, 0]], [0.35, [0, 0, -0.35]], [0.75, [0, 0, -0.4]], [1.1, [0, 0.95, 0.1]], [1.45, [0, 0.4, 0.6]], [1.6, [0, 0, 0.7]], [1.7, [0, 0, 0.7]]],
    rot: [[0, 0], [0.75, -0.15], [0.85, -0.35], [1.5, -2 * PI], [1.7, -2 * PI]],
    crouch: [[0, 0], [0.3, 0.25], [0.5, 0], [0.95, 0.1], [1.55, 0.35], [1.7, 0]],
    L: [[0, GUARD_L], [0.5, [-0.5, 1.25, -0.1]], [1.3, [-0.35, 1.0, -0.2]], [1.7, GUARD_L]],
    R: [[0, GUARD_R], [0.5, [0.5, 1.25, 0.05]], [1.3, [0.35, 1.0, -0.2]], [1.7, GUARD_R]],
    footR: [[0, FOOT_R], [0.4, [0.12, 0.06, 0.1]], [0.6, [0.12, 0.4, 0.3]], [0.75, [0.1, 0.28, -0.82]], [0.95, [0.1, 0.65, -0.5]], [1.3, [0.12, 0.3, 0]], [1.7, FOOT_R]],
    prop: null,
  },
  shockpalm: {
    off: [[0, [0, 0, 0]], [0.35, [0, 0, -0.5]], [1.3, [0, 0, -0.5]], [1.6, [0, 0, 0]]],
    rot: [[0, 0], [0.35, 0.3], [0.75, 0.2], [1.05, 0.6], [1.3, 0.6], [1.6, 0]],
    crouch: [[0, 0], [0.35, 0.4], [1.05, 0.45], [1.3, 0.45], [1.6, 0]],
    L: [[0, GUARD_L], [0.4, [-0.3, 1.0, -0.25]], [1.6, GUARD_L]],
    R: [[0, GUARD_R], [0.75, [0.32, 1.1, 0.18]], [0.9, [0.3, 1.12, 0.2]], [1.05, [0.1, 0.55, -0.62]], [1.3, [0.1, 0.6, -0.55]], [1.6, GUARD_R]],
    prop: 'orb',
  },
  buttstroke: {
    off: [[0, [0, 0, 0]], [0.25, [0, 0, -0.45]], [1.35, [0, 0, -0.45]], [1.6, [0, 0, 0]]],
    rot: [[0, 0], [0.3, -0.1], [0.55, 0.45], [0.8, -0.05], [1.1, 0.5], [1.35, 0.45], [1.6, 0]],
    crouch: [[0, 0], [0.3, 0.1], [0.55, 0.3], [0.8, 0.12], [1.1, 0.32], [1.35, 0.3], [1.6, 0]],
    L: [[0, [-0.1, 1.1, -0.5]], [0.3, [0.0, 1.45, -0.15]], [0.55, [0.0, 0.75, -0.6]], [0.8, [0.0, 1.45, -0.15]], [1.1, [0.0, 0.68, -0.62]], [1.35, [0.0, 0.75, -0.6]], [1.6, [-0.1, 1.1, -0.5]]],
    R: [[0, [0.2, 1.15, -0.25]], [0.3, [0.15, 1.75, 0.1]], [0.55, [0.1, 1.2, -0.3]], [0.8, [0.15, 1.75, 0.1]], [1.1, [0.1, 1.15, -0.32]], [1.35, [0.1, 1.2, -0.3]], [1.6, [0.2, 1.15, -0.25]]],
    prop: 'rifle',
  },
  pocketnade: {
    off: [[0, [0, 0, 0]], [0.4, [0, 0, -0.45]], [0.9, [0, 0, -0.45]], [1.25, [0, 0, 0.55]], [1.9, [0, 0, 0.55]]],
    rot: [[0, 0], [0.4, 0.6], [0.9, 0.6], [1.25, -0.12], [1.9, 0]],
    crouch: [[0, 0], [0.4, 0.55], [0.9, 0.55], [1.25, 0.1], [1.9, 0]],
    L: [[0, GUARD_L], [0.3, [0.06, 1.22, -0.36]], [0.5, [-0.4, 1.3, -0.1]], [0.9, [-0.3, 1.0, -0.2]], [1.25, [-0.1, 1.48, -0.25]], [1.9, [-0.1, 1.48, -0.25]]],
    R: [[0, [0.15, 1.2, -0.35]], [0.35, [0.1, 1.2, -0.38]], [0.8, [0.08, 0.45, -0.65]], [0.95, [0.1, 0.5, -0.6]], [1.25, [0.1, 1.48, -0.25]], [1.9, [0.1, 1.48, -0.25]]],
    prop: 'nade',
  },
  elbowdrop: {
    off: [[0, [0, 0, 0]], [0.25, [0, 0, -0.1]], [0.65, [0, 1.0, -0.35]], [1.05, [0, -0.55, -0.75]], [1.3, [0, -0.5, -0.7]], [1.7, [0, 0, -0.2]]],
    rot: [[0, 0], [0.25, 0.1], [0.65, 0.45], [1.05, 1.35], [1.3, 1.3], [1.7, 0]],
    crouch: [[0, 0], [0.25, 0.4], [0.45, 0], [1.3, 0.1], [1.55, 0.35], [1.7, 0]],
    L: [[0, GUARD_L], [0.6, [-0.5, 1.6, -0.1]], [0.95, [-0.2, 1.3, -0.25]], [1.7, GUARD_L]],
    R: [[0, GUARD_R], [0.6, [0.5, 1.75, 0.0]], [0.95, [0.12, 1.32, -0.12]], [1.3, [0.12, 1.3, -0.12]], [1.7, GUARD_R]],
    prop: null,
  },
  stomp: {
    off: [[0, [0, 0, 0]], [0.3, [0, 0, -0.55]], [1.5, [0, 0, -0.55]]],
    rot: [[0, 0], [0.7, -0.08], [0.95, 0.2], [1.2, 0.15], [1.5, 0]],
    crouch: [[0, 0], [0.7, 0], [0.95, 0.22], [1.2, 0.2], [1.5, 0]],
    L: [[0, GUARD_L], [0.7, [-0.48, 1.45, -0.05]], [0.95, [-0.35, 0.95, -0.1]], [1.5, GUARD_L]],
    R: [[0, GUARD_R], [0.7, [0.48, 1.45, -0.05]], [0.95, [0.35, 0.95, -0.1]], [1.5, GUARD_R]],
    footR: [[0, FOOT_R], [0.3, [0.12, 0.06, -0.1]], [0.7, [0.12, 0.78, -0.5]], [0.95, [0.12, 0.16, -0.72]], [1.2, [0.12, 0.16, -0.72]], [1.5, FOOT_R]],
    prop: null,
  },
  sledge: {
    off: [[0, [0, 0, 0]], [0.4, [0, 0, -0.3]], [1.9, [0, 0, -0.3]]],
    rot: [[0, 0], [0.5, -0.12], [0.9, -0.25], [1.3, 0.55], [1.6, 0.5], [1.9, 0]],
    crouch: [[0, 0], [0.9, 0], [1.3, 0.35], [1.6, 0.32], [1.9, 0]],
    L: [[0, [0.05, 0.95, -0.2]], [0.5, [0.08, 1.85, 0.05]], [0.9, [0.06, 1.85, 0.15]], [1.3, [0.03, 0.85, -0.45]], [1.6, [0.03, 0.85, -0.45]], [1.9, [0.05, 0.95, -0.2]]],
    R: [[0, [0.15, 1.0, -0.3]], [0.5, [0.12, 1.8, 0.25]], [0.9, [0.1, 1.7, 0.4]], [1.3, [0.05, 0.75, -0.6]], [1.6, [0.05, 0.75, -0.6]], [1.9, [0.15, 1.0, -0.3]]],
    prop: 'hammer',
  },
  bodyslam: {
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
    hands: [kf(a.L, t), kf(a.R, t)], footR: a.footR ? kf(a.footR, t) : null,
  };
}

// props in the attacker's hands (needs bot.armW from the bot's last parts() call). `def` gives hitAt.
export function takedownProps(out, bot, kind, t, def, bodyPt) {
  const a = ANIMS[kind], arm = bot.armW;
  if (!a || !arm || !a.prop) return;
  const bd = (bot.propBd ||= new Builder()).reset();
  const [hL, hR] = [arm.hL, arm.hR];
  const along = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
  const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  const side = nrm([Math.cos(bot.yaw), 0, -Math.sin(bot.yaw)]);
  const metal = [0.75, 0.77, 0.8], dark = [0.08, 0.08, 0.09], wood = [0.38, 0.25, 0.13];
  switch (a.prop) {
    case 'knife': {
      const d = nrm([hR[0] - arm.eR[0], hR[1] - arm.eR[1], hR[2] - arm.eR[2]]);
      const B = basisFrom(d, side);
      bd.rbox(along(hR, d, 0.06), B, [0.035, 0.11, 0.03], 0.012, dark, 0);
      bd.rbox(along(hR, d, 0.12), B, [0.07, 0.015, 0.035], 0.005, dark, 0);
      bd.rbox(along(hR, d, 0.25), B, [0.012, 0.24, 0.045], 0.004, metal, 0.15);
      break;
    }
    case 'orb': {
      const h = def.hitAt, e = t < h ? Math.min(1, t / h) : Math.max(0, 1 - (t - h) / 0.25);
      if (e > 0.05) { const B = basisFrom([0, 1, 0], side); bd.ellipsoid(hR, B, [0.12 + 0.12 * e, 0.12 + 0.12 * e, 0.12 + 0.12 * e], [0.45, 0.85, 1], 1); }
      break;
    }
    case 'rifle': {
      // held upside down, stock first: the stock sticks out past the lower hand
      const d = nrm([hL[0] - hR[0], hL[1] - hR[1], hL[2] - hR[2]]);
      const B = basisFrom(d, side);
      const mid = along(hR, d, 0.2);
      bd.rbox(mid, B, [0.07, 0.42, 0.11], 0.02, [0.12, 0.12, 0.13], 0);
      bd.rbox(along(hR, d, -0.3), B, [0.035, 0.42, 0.035], 0.015, [0.2, 0.2, 0.22], 0);
      bd.rbox(along(hL, d, 0.22), B, [0.06, 0.3, 0.12], 0.025, [0.16, 0.16, 0.18], 0);
      bd.rbox(along(hL, d, 0.37), B, [0.065, 0.05, 0.14], 0.015, dark, 0);
      break;
    }
    case 'nade': {
      const B = basisFrom([0, 1, 0], side);
      if (t < 0.85) bd.ellipsoid(hR, B, [0.085, 0.1, 0.085], [0.25, 0.32, 0.15], 0);
      else if (t < def.hitAt && bodyPt) bd.ellipsoid(bodyPt, B, [0.085, 0.1, 0.085], Math.floor(t * 10) % 2 ? [1, 0.2, 0.1] : [0.25, 0.32, 0.15], Math.floor(t * 10) % 2 ? 1 : 0);
      if (t > 0.3 && t < 1.25) bd.ellipsoid(hL, B, [0.04, 0.04, 0.012], [0.85, 0.75, 0.3], 0);   // the pin
      break;
    }
    case 'hammer': {
      // handle from the lower hand up through the upper one, head on the end
      const d = nrm([hR[0] - hL[0], hR[1] - hL[1], hR[2] - hL[2]]);
      const end = along(hL, d, 0.85);
      bd.capsule(along(hL, d, -0.08), end, 0.022, 0.022, wood, 0);
      const B = basisFrom(d, side);
      bd.rbox(end, { R: B.B, U: B.R, B: B.U }, [0.36, 0.16, 0.16], 0.03, [0.26, 0.26, 0.28], 0);
      bd.rbox(end, { R: B.B, U: B.R, B: B.U }, [0.2, 0.175, 0.175], 0.01, [1, 0.68, 0.08], 0.1);
      break;
    }
    default: break;
  }
  for (const p of bd.out) out.push(p);
}
