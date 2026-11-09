// Weapon definitions. Models are built from boxes in gun-local space:
// origin = middle of the receiver, -Z = forward, units = metres.
//
// Part flags:  mag  -> moves during reloads      bolt -> kicks back on each shot / charge
//              pump -> slides back when pumping  em   -> emissive (glows)

const BLACK = [0.1, 0.1, 0.11];
const DARK = [0.2, 0.2, 0.22];
const GREY = [0.45, 0.46, 0.49];
const WHITE = [0.9, 0.9, 0.92];
const RED = [0.95, 0.12, 0.1];

const P = (name, c, s, col, extra = {}) => ({ name, c, s, col, ...extra });

// open-frame red-dot sight centred at height y, z
const redDot = (y, z, col = DARK) => [
  P('sightL', [-0.021, y, z], [0.006, 0.036, 0.05], col),
  P('sightR', [0.021, y, z], [0.006, 0.036, 0.05], col),
  P('sightTop', [0, y + 0.02, z], [0.048, 0.006, 0.05], col),
  P('dot', [0, y, z + 0.02], [0.0035, 0.0035, 0.001], RED, { em: 1 }),
];

export const WEAPONS = {
  ar: {
    id: 'ar', name: 'SF-47', type: 'ASSAULT RIFLE',
    auto: true, rpm: 720, mag: 30, dmg: 20, headMult: 2, pellets: 1,
    reload: 1.9, reloadEmpty: 2.4, reloadStyle: 'mag',
    spread: { base: 0.004, move: 0.018, air: 0.03, bloom: 0.0045, bloomMax: 0.035, ads: 0.25 },
    recoil: { up: 0.011, side: 0.007, vm: 1 }, adsZoom: 0.78, adsSpeed: 14,
    sightY: 0.086, adsZ: -0.27, hip: [0.17, -0.185, -0.56], muzzle: [0, 0.012, -0.55],
    grip: [0, -0.08, 0.1], foreGrip: [0, -0.04, -0.25], eject: [0.04, 0.02, -0.02], magPos: [0, -0.115, -0.05],
    bolt: [0.042, 0.02, 0.05],
    sound: { freq: 2600, thump: 150, gain: 0.55 },
    parts: [
      P('receiver', [0, 0, 0], [0.07, 0.095, 0.36], DARK),
      P('handguard', [0, -0.004, -0.25], [0.066, 0.078, 0.18], BLACK),
      P('barrel', [0, 0.012, -0.4], [0.028, 0.028, 0.18], BLACK),
      P('muzzle', [0, 0.012, -0.5], [0.04, 0.04, 0.05], DARK),
      P('sightbase', [0, 0.058, 0], [0.05, 0.02, 0.14], BLACK),
      ...redDot(0.086, 0.01),
      P('grip', [0, -0.09, 0.1], [0.045, 0.11, 0.05], BLACK, { rx: -0.3 }),
      P('stock', [0, -0.012, 0.27], [0.05, 0.085, 0.18], DARK),
      P('stripe', [0.037, 0.018, -0.02], [0.004, 0.012, 0.3], RED, { em: 1 }),
      P('bolt', [0.042, 0.02, 0.05], [0.016, 0.016, 0.03], GREY, { bolt: true }),
      P('mag', [0, -0.115, -0.05], [0.05, 0.16, 0.085], BLACK, { rx: 0.22, mag: true }),
    ],
  },

  smg: {
    id: 'smg', name: 'V9-S', type: 'SMG', oneHanded: true,
    auto: true, rpm: 1000, mag: 40, dmg: 13, headMult: 1.75, pellets: 1,
    reload: 1.6, reloadEmpty: 2.0, reloadStyle: 'mag',
    spread: { base: 0.008, move: 0.012, air: 0.02, bloom: 0.0035, bloomMax: 0.03, ads: 0.4 },
    recoil: { up: 0.0065, side: 0.009, vm: 0.7 }, adsZoom: 0.85, adsSpeed: 18,
    sightY: 0.078, adsZ: -0.25, hip: [0.16, -0.17, -0.5], muzzle: [0, 0.01, -0.36],
    grip: [0, -0.08, 0.06], foreGrip: [0, -0.1, -0.17], eject: [0.035, 0.02, -0.02], magPos: [0, -0.13, -0.06],
    bolt: [0.036, 0.02, 0.02],
    sound: { freq: 3400, thump: 190, gain: 0.42 },
    parts: [
      P('receiver', [0, 0, -0.02], [0.062, 0.09, 0.28], WHITE),
      P('barrel', [0, 0.01, -0.22], [0.026, 0.026, 0.12], BLACK),
      P('muzzle', [0, 0.01, -0.3], [0.036, 0.036, 0.06], BLACK),
      P('rail', [0, 0.052, -0.02], [0.04, 0.014, 0.2], BLACK),
      ...redDot(0.078, 0.01, BLACK),
      P('grip', [0, -0.085, 0.07], [0.042, 0.1, 0.045], BLACK, { rx: -0.25 }),
      P('fgrip', [0, -0.08, -0.17], [0.034, 0.09, 0.034], BLACK),
      P('stock', [0, -0.01, 0.2], [0.02, 0.06, 0.16], BLACK),
      P('stockpad', [0, -0.01, 0.28], [0.045, 0.08, 0.02], BLACK),
      P('stripe', [0.032, -0.02, -0.02], [0.004, 0.03, 0.2], RED, { em: 1 }),
      P('bolt', [0.036, 0.02, 0.02], [0.012, 0.016, 0.03], GREY, { bolt: true }),
      P('mag', [0, -0.13, -0.06], [0.036, 0.19, 0.05], BLACK, { mag: true }),
    ],
  },

  shotgun: {
    id: 'shotgun', name: 'SG-12', type: 'PUMP SHOTGUN',
    auto: false, rpm: 75, mag: 6, dmg: 9, headMult: 1.5, pellets: 10, action: 'pump',
    reloadStyle: 'shell', shellTime: 0.48,
    spread: { base: 0.055, move: 0.01, air: 0.015, bloom: 0, bloomMax: 0, ads: 0.75 },
    recoil: { up: 0.05, side: 0.012, vm: 2.2 }, adsZoom: 0.88, adsSpeed: 14,
    sightY: 0.062, adsZ: -0.3, hip: [0.17, -0.18, -0.55], muzzle: [0, 0.025, -0.7],
    grip: [0, -0.08, 0.13], foreGrip: [0, -0.04, -0.34], eject: [0.04, 0.02, 0], magPos: [0, -0.06, 0.02],
    sound: { freq: 1500, thump: 90, gain: 0.85, dur: 0.28 },
    parts: [
      P('receiver', [0, 0, 0], [0.068, 0.1, 0.3], DARK),
      P('barrel', [0, 0.025, -0.42], [0.036, 0.036, 0.56], BLACK),
      P('tube', [0, -0.02, -0.36], [0.03, 0.03, 0.44], BLACK),
      P('pump', [0, -0.02, -0.34], [0.062, 0.062, 0.17], [0.32, 0.2, 0.14], { pump: true }),
      P('bead', [0, 0.05, -0.68], [0.008, 0.012, 0.008], RED, { em: 1 }),
      P('rear', [0, 0.056, 0.08], [0.04, 0.014, 0.02], BLACK),
      P('grip', [0, -0.08, 0.14], [0.045, 0.11, 0.05], BLACK, { rx: -0.3 }),
      P('stock', [0, -0.025, 0.3], [0.05, 0.1, 0.24], [0.32, 0.2, 0.14]),
      P('port', [0, -0.052, 0.02], [0.04, 0.006, 0.08], BLACK),
      P('shell', [0, -0.08, 0.02], [0.024, 0.024, 0.06], RED, { mag: true, hidden: true }),
    ],
  },

  sniper: {
    id: 'sniper', name: 'LH-7', type: 'BOLT SNIPER',
    auto: false, rpm: 48, mag: 5, dmg: 95, headMult: 2, pellets: 1, action: 'bolt',
    reload: 2.6, reloadEmpty: 2.6, reloadStyle: 'mag', scope: true,
    spread: { base: 0.04, move: 0.04, air: 0.06, bloom: 0, bloomMax: 0, ads: 0 },
    recoil: { up: 0.045, side: 0.01, vm: 2.5 }, adsZoom: 0.3, adsSpeed: 8,
    sightY: 0.09, adsZ: -0.24, hip: [0.17, -0.19, -0.6], muzzle: [0, 0.015, -0.8],
    grip: [0, -0.08, 0.14], foreGrip: [0, -0.04, -0.3], eject: [0.045, 0.03, 0.06], magPos: [0, -0.08, -0.02],
    bolt: [0.055, 0.03, 0.1],
    sound: { freq: 1800, thump: 70, gain: 0.95, dur: 0.4 },
    parts: [
      P('receiver', [0, 0, 0], [0.066, 0.09, 0.4], WHITE),
      P('barrel', [0, 0.015, -0.5], [0.028, 0.028, 0.6], BLACK),
      P('brake', [0, 0.015, -0.8], [0.045, 0.04, 0.07], BLACK),
      P('scope', [0, 0.09, -0.02], [0.05, 0.05, 0.3], BLACK),
      P('scopeF', [0, 0.09, -0.18], [0.062, 0.062, 0.05], BLACK),
      P('ring1', [0, 0.06, -0.08], [0.03, 0.03, 0.02], DARK),
      P('ring2', [0, 0.06, 0.06], [0.03, 0.03, 0.02], DARK),
      P('lens', [0, 0.09, -0.205], [0.04, 0.04, 0.002], [0.5, 0.75, 1], { em: 0.6 }),
      P('grip', [0, -0.08, 0.15], [0.045, 0.11, 0.05], BLACK, { rx: -0.3 }),
      P('stock', [0, -0.02, 0.34], [0.05, 0.11, 0.28], WHITE),
      P('cheek', [0, 0.04, 0.3], [0.045, 0.03, 0.14], BLACK),
      P('stripe', [0.034, 0, -0.1], [0.004, 0.02, 0.3], RED, { em: 1 }),
      P('bolt', [0.055, 0.03, 0.1], [0.05, 0.016, 0.016], BLACK, { bolt: true }),
      P('mag', [0, -0.08, -0.02], [0.045, 0.08, 0.09], BLACK, { mag: true }),
    ],
  },

  lmg: {
    id: 'lmg', name: 'M60-X', type: 'LMG',
    auto: true, rpm: 620, mag: 100, dmg: 22, headMult: 1.5, pellets: 1,
    reload: 3.4, reloadEmpty: 3.9, reloadStyle: 'mag',
    spread: { base: 0.007, move: 0.03, air: 0.04, bloom: 0.003, bloomMax: 0.04, ads: 0.35 },
    recoil: { up: 0.009, side: 0.012, vm: 1.3 }, adsZoom: 0.8, adsSpeed: 9,
    sightY: 0.1, adsZ: -0.3, hip: [0.18, -0.2, -0.58], muzzle: [0, 0.02, -0.72],
    grip: [0, -0.1, 0.12], foreGrip: [0, -0.06, -0.3], eject: [0.05, 0.02, 0], magPos: [-0.03, -0.12, -0.04],
    bolt: [0.055, 0.02, 0.06],
    sound: { freq: 2100, thump: 110, gain: 0.65 },
    parts: [
      P('receiver', [0, 0, 0], [0.09, 0.12, 0.44], DARK),
      P('shroud', [0, 0.01, -0.36], [0.06, 0.07, 0.28], BLACK),
      P('barrel', [0, 0.02, -0.58], [0.034, 0.034, 0.24], BLACK),
      P('handle', [0, 0.1, -0.12], [0.02, 0.04, 0.14], BLACK),
      P('sightbase', [0, 0.07, 0.05], [0.06, 0.02, 0.12], BLACK),
      ...redDot(0.1, 0.06),
      P('grip', [0, -0.1, 0.13], [0.045, 0.11, 0.05], BLACK, { rx: -0.3 }),
      P('stock', [0, -0.02, 0.33], [0.06, 0.11, 0.22], DARK),
      P('bipod', [0, -0.05, -0.42], [0.05, 0.02, 0.2], GREY),
      P('stripe', [0.047, 0.03, -0.02], [0.004, 0.012, 0.4], RED, { em: 1 }),
      P('bolt', [0.055, 0.02, 0.06], [0.02, 0.02, 0.04], GREY, { bolt: true }),
      P('mag', [-0.03, -0.12, -0.04], [0.12, 0.13, 0.13], [0.3, 0.32, 0.26], { mag: true }),
    ],
  },

  pistol: {
    id: 'pistol', name: 'P-19', type: 'PISTOL', oneHanded: true,
    auto: false, rpm: 420, mag: 12, dmg: 24, headMult: 2, pellets: 1,
    reload: 1.3, reloadEmpty: 1.6, reloadStyle: 'mag', slide: true,
    spread: { base: 0.005, move: 0.012, air: 0.02, bloom: 0.008, bloomMax: 0.03, ads: 0.4 },
    recoil: { up: 0.02, side: 0.008, vm: 1.4 }, adsZoom: 0.9, adsSpeed: 18,
    sightY: 0.058, adsZ: -0.36, hip: [0.15, -0.16, -0.42], muzzle: [0, 0.03, -0.12],
    grip: [0, -0.05, 0.06], foreGrip: [-0.03, -0.07, 0.05], eject: [0.025, 0.04, 0], magPos: [0, -0.1, 0.07],
    bolt: [0, 0.03, -0.01],
    sound: { freq: 3000, thump: 170, gain: 0.5 },
    parts: [
      P('frame', [0, 0, -0.01], [0.03, 0.035, 0.18], BLACK),
      P('slide', [0, 0.03, -0.01], [0.034, 0.04, 0.2], WHITE, { bolt: true }),
      P('front', [0, 0.054, -0.1], [0.006, 0.01, 0.008], RED, { em: 1, bolt: true }),
      P('rearL', [-0.01, 0.054, 0.08], [0.006, 0.01, 0.008], BLACK, { bolt: true }),
      P('rearR', [0.01, 0.054, 0.08], [0.006, 0.01, 0.008], BLACK, { bolt: true }),
      P('grip', [0, -0.055, 0.06], [0.032, 0.11, 0.05], BLACK, { rx: -0.22 }),
      P('guard', [0, -0.03, -0.01], [0.01, 0.02, 0.06], BLACK),
      P('mag', [0, -0.1, 0.07], [0.026, 0.06, 0.04], DARK, { rx: -0.22, mag: true }),
    ],
  },
};

export const CASE_ORDER = ['ar', 'smg', 'shotgun', 'sniper', 'lmg', 'pistol'];
