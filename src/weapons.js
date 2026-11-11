// Weapon definitions. Models are built from boxes in gun-local space:
// origin = middle of the receiver, -Z = forward, units = metres.
//
// Part flags:  mag  -> moves during reloads      bolt -> kicks back on each shot / charge
//              pump -> slides back when pumping  em   -> emissive (glows)

const BLACK = [0.1, 0.1, 0.11];
const DARK = [0.25, 0.255, 0.27];
const DARK2 = [0.16, 0.165, 0.18];
const GREY = [0.45, 0.46, 0.49];
const STEEL = [0.58, 0.59, 0.62];
const WHITE = [0.9, 0.9, 0.92];
const RED = [0.95, 0.12, 0.1];
const TAN = [0.46, 0.39, 0.28];
const WOOD = [0.38, 0.22, 0.12];
const PORT = [0.04, 0.04, 0.045];

// P(name, centre, size, colour, extras). Extras: m = material (metal/steel/poly/rubber/wood/paint/brass/glass),
// shape ('cyl' / 'sphere' / rounding radius), grp = detail group that attachments hide or move with
// (sight / muzzle / stock / mag / under), plus mag / bolt / pump / em / rx / ry / rz.
const P = (name, c, s, col, extra = {}) => ({ name, c, s, col, ...extra });
const H = Math.PI / 2;
// a cylinder along Z (or across X with `across`)
const C = (name, c, d, len, col, extra = {}) => P(name, c, [d, d, len], col, { shape: 'cyl', ...extra });
const CX = (name, c, d, len, col, extra = {}) => P(name, c, [d, d, len], col, { shape: 'cyl', ry: H, ...extra });
const CY = (name, c, d, len, col, extra = {}) => P(name, c, [d, d, len], col, { shape: 'cyl', rx: H, ...extra });

// picatinny rail: a base strip with cross teeth from z0 (back) to z1 (front)
function rail(y, z0, z1, extra = {}, w = 0.024) {
  const out = [P('railBase', [0, y, (z0 + z1) / 2], [w, 0.008, z0 - z1], BLACK, { m: 'metal', ...extra })];
  for (let z = z0 - 0.008; z > z1 + 0.004; z -= 0.016) out.push(P('railTooth', [0, y + 0.005, z], [w + 0.006, 0.004, 0.008], BLACK, { m: 'metal', ...extra }));
  return out;
}

// enclosed reflex sight centred at height y, z (window 36 mm wide so ADS stays clear)
const redDot = (y, z, col = DARK) => [
  P('sightBase', [0, y - 0.026, z], [0.038, 0.01, 0.056], BLACK, { m: 'metal', grp: 'sight' }),
  P('sightL', [-0.022, y - 0.002, z], [0.008, 0.044, 0.054], col, { m: 'metal', grp: 'sight' }),
  P('sightR', [0.022, y - 0.002, z], [0.008, 0.044, 0.054], col, { m: 'metal', grp: 'sight' }),
  P('sightTop', [0, y + 0.022, z], [0.052, 0.008, 0.054], col, { m: 'metal', grp: 'sight' }),
  P('sightHood', [0, y + 0.018, z - 0.03], [0.054, 0.012, 0.008], BLACK, { m: 'metal', grp: 'sight' }),
  CX('sightKnob', [0.03, y - 0.006, z + 0.008], 0.014, 0.01, BLACK, { m: 'steel', grp: 'sight' }),
  P('sightBtn', [-0.027, y + 0.004, z + 0.012], [0.004, 0.008, 0.012], RED, { em: 0.4, grp: 'sight' }),
  P('sightGlassL', [-0.0175, y, z - 0.02], [0.002, 0.036, 0.002], [0.3, 0.75, 0.6], { em: 0.25, grp: 'sight' }),
  P('dot', [0, y, z + 0.02], [0.0035, 0.0035, 0.001], RED, { em: 1, grp: 'sight' }),
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

      // receiver
      P('receiver', [0, 0.02, 0], [0.064, 0.058, 0.32], DARK, { m: 'metal' }),
      P('lower', [0, -0.03, 0.035], [0.058, 0.048, 0.19], DARK2, { m: 'metal' }),
      P('magwell', [0, -0.052, -0.05], [0.064, 0.05, 0.1], DARK2, { m: 'metal' }),
      P('magwellLip', [0, -0.079, -0.05], [0.068, 0.008, 0.104], DARK, { m: 'metal' }),
      P('port', [0.0325, 0.022, -0.025], [0.002, 0.022, 0.07], PORT),
      P('deflector', [0.035, 0.022, 0.025], [0.006, 0.026, 0.016], DARK2, { m: 'metal' }),
      C('fwdAssist', [0.03, 0.034, 0.06], 0.018, 0.03, DARK2, { m: 'metal' }),
      P('charge', [0, 0.053, 0.168], [0.036, 0.01, 0.028], BLACK, { m: 'metal' }),
      P('chargeLatch', [-0.022, 0.053, 0.172], [0.012, 0.008, 0.016], BLACK, { m: 'metal' }),
      P('selector', [-0.033, -0.02, 0.07], [0.004, 0.008, 0.024], STEEL, { m: 'steel', rz: 0.0, rx: 0.4 }),
      P('magRelease', [0.031, -0.03, -0.005], [0.006, 0.012, 0.012], STEEL, { m: 'steel' }),
      P('boltRelease', [-0.031, -0.01, 0.0], [0.004, 0.02, 0.012], DARK2, { m: 'metal' }),
      P('pinF', [-0.03, -0.022, -0.06], [0.004, 0.008, 0.008], STEEL, { m: 'steel', shape: 'cyl', ry: H }),
      P('pinR', [-0.03, -0.022, 0.11], [0.004, 0.008, 0.008], STEEL, { m: 'steel', shape: 'cyl', ry: H }),
      P('guard', [0, -0.067, 0.04], [0.016, 0.006, 0.078], BLACK, { m: 'poly' }),
      P('trigger', [0, -0.048, 0.034], [0.006, 0.026, 0.008], STEEL, { m: 'steel', rx: 0.3 }),
      // handguard with slots
      P('handguard', [0, 0.008, -0.27], [0.068, 0.072, 0.24], BLACK, { m: 'poly' }),
      P('hgBottom', [0, -0.03, -0.27], [0.044, 0.006, 0.22], DARK2, { m: 'poly' }),
      ...[-0.2, -0.25, -0.3, -0.35].flatMap((z) => [P('hgSlot', [0.0345, 0.004, z], [0.002, 0.014, 0.032], PORT), P('hgSlot', [-0.0345, 0.004, z], [0.002, 0.014, 0.032], PORT)]),
      P('hgCap', [0, 0.008, -0.395], [0.07, 0.074, 0.014], DARK2, { m: 'metal' }),
      ...rail(0.058, 0.18, -0.39),
      // barrel + flash hider
      C('barrel', [0, 0.012, -0.4], 0.024, 0.18, BLACK, { m: 'metal' }),
      C('gasBlock', [0, 0.014, -0.415], 0.034, 0.024, DARK2, { m: 'metal' }),
      C('muzzle', [0, 0.012, -0.515], 0.036, 0.055, DARK, { m: 'metal' }),
      ...[0, 1, 2, 3].map((k) => P('mzSlot', [Math.cos(k * H + 0.78) * 0.0175, 0.012 + Math.sin(k * H + 0.78) * 0.0175, -0.525], [0.006, 0.006, 0.03], PORT, { grp: 'muzzle', rz: k * H + 0.78 })),
      C('mzCrown', [0, 0.012, -0.543], 0.03, 0.004, BLACK, { m: 'metal', grp: 'muzzle' }),
      ...redDot(0.086, 0.01),
      // grip
      P('grip', [0, -0.09, 0.1], [0.044, 0.11, 0.05], BLACK, { rx: -0.3, m: 'rubber' }),
      P('gripBack', [0, -0.085, 0.124], [0.04, 0.09, 0.014], DARK2, { rx: -0.3, m: 'rubber' }),
      P('gripCap', [0, -0.146, 0.118], [0.046, 0.012, 0.054], DARK2, { rx: -0.3, m: 'poly' }),
      // stock
      C('buffer', [0, 0.0, 0.22], 0.032, 0.14, DARK2, { m: 'metal', grp: 'stock' }),
      P('stock', [0, -0.012, 0.29], [0.05, 0.078, 0.16], DARK, { m: 'poly' }),
      P('cheekRest', [0, 0.034, 0.285], [0.046, 0.016, 0.11], DARK2, { m: 'poly', grp: 'stock' }),
      P('butt', [0, -0.016, 0.375], [0.054, 0.098, 0.022], BLACK, { m: 'rubber', grp: 'stock' }),
      P('stockLever', [0, -0.055, 0.25], [0.014, 0.012, 0.05], BLACK, { m: 'poly', grp: 'stock' }),
      P('slingLoop', [0.028, -0.03, 0.33], [0.006, 0.02, 0.03], STEEL, { m: 'steel', grp: 'stock' }),
      // accents
      P('stripe', [0.037, 0.018, -0.02], [0.004, 0.012, 0.22], RED, { em: 1 }),
      P('hgStripe', [0.0345, -0.018, -0.27], [0.003, 0.006, 0.2], RED, { em: 1 }),
      P('bolt', [0.042, 0.022, 0.03], [0.016, 0.016, 0.03], STEEL, { bolt: true, m: 'steel' }),
      // curved magazine
      P('mag', [0, -0.115, -0.05], [0.05, 0.16, 0.085], TAN, { rx: 0.22, mag: true, m: 'poly' }),
      ...[-1, 1].map((sx) => P('magRib', [sx * 0.026, -0.12, -0.051], [0.004, 0.11, 0.02], [0.4, 0.33, 0.23], { rx: 0.22, mag: true, grp: 'mag', m: 'poly' })),
      P('magWindow', [0.0262, -0.1, -0.03], [0.002, 0.07, 0.008], [0.15, 0.13, 0.1], { rx: 0.22, mag: true, grp: 'mag' }),
      P('magBase', [0, -0.193, -0.067], [0.056, 0.016, 0.094], BLACK, { rx: 0.22, mag: true, grp: 'mag', m: 'poly' }),
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

      P('receiver', [0, 0.01, -0.02], [0.062, 0.07, 0.28], WHITE, { m: 'paint' }),
      P('lower', [0, -0.034, 0.03], [0.054, 0.03, 0.18], BLACK, { m: 'poly' }),
      P('shroud', [0, 0.012, -0.19], [0.056, 0.058, 0.07], WHITE, { m: 'paint' }),
      ...[-0.17, -0.2].flatMap((z) => [P('vent', [0.0285, 0.016, z], [0.002, 0.03, 0.016], PORT), P('vent', [-0.0285, 0.016, z], [0.002, 0.03, 0.016], PORT)]),
      P('port', [0.0315, 0.02, -0.03], [0.002, 0.022, 0.06], PORT),
      P('chargeTube', [-0.034, 0.03, -0.1], [0.008, 0.014, 0.12], BLACK, { m: 'metal' }),
      P('chargeKnob', [-0.042, 0.03, -0.155], [0.014, 0.012, 0.014], BLACK, { m: 'metal' }),
      C('barrel', [0, 0.01, -0.24], 0.024, 0.1, BLACK, { m: 'metal' }),
      C('muzzle', [0, 0.01, -0.3], 0.036, 0.06, BLACK, { m: 'metal' }),
      ...[-0.285, -0.3, -0.315].map((z) => C('mzRing', [0, 0.01, z], 0.039, 0.005, DARK2, { m: 'metal', grp: 'muzzle' })),
      ...rail(0.05, 0.11, -0.15),
      ...redDot(0.078, 0.01, BLACK),
      P('grip', [0, -0.085, 0.07], [0.042, 0.1, 0.045], BLACK, { rx: -0.25, m: 'rubber' }),
      P('gripCap', [0, -0.135, 0.083], [0.044, 0.01, 0.048], DARK2, { rx: -0.25, m: 'poly' }),
      P('guard', [0, -0.058, 0.015], [0.014, 0.006, 0.07], BLACK, { m: 'poly' }),
      P('trigger', [0, -0.045, 0.012], [0.006, 0.022, 0.008], STEEL, { m: 'steel', rx: 0.3 }),
      P('selector', [-0.03, -0.02, 0.06], [0.004, 0.012, 0.016], RED, { em: 0.3 }),
      P('fgrip', [0, -0.08, -0.17], [0.034, 0.09, 0.034], BLACK, { m: 'rubber' }),
      P('fgripCap', [0, -0.128, -0.17], [0.038, 0.01, 0.038], DARK2, { m: 'poly', grp: 'under' }),
      P('fgripMount', [0, -0.03, -0.17], [0.04, 0.012, 0.05], BLACK, { m: 'metal', grp: 'under' }),
      // folding stock
      P('stock', [0, -0.01, 0.2], [0.02, 0.06, 0.16], BLACK, { m: 'metal' }),
      P('stockHinge', [0, 0.0, 0.12], [0.03, 0.04, 0.02], DARK2, { m: 'metal', grp: 'stock' }),
      P('stockpad', [0, -0.01, 0.28], [0.045, 0.08, 0.02], BLACK, { m: 'rubber' }),
      P('stockBar', [0, 0.015, 0.2], [0.012, 0.012, 0.16], DARK2, { m: 'metal', grp: 'stock' }),
      P('stripe', [0.032, -0.012, -0.02], [0.004, 0.012, 0.2], RED, { em: 1 }),
      P('logo', [0.0315, 0.024, 0.06], [0.002, 0.014, 0.03], BLACK),
      P('bolt', [0.034, 0.024, 0.02], [0.012, 0.016, 0.03], STEEL, { bolt: true, m: 'steel' }),
      P('mag', [0, -0.13, -0.06], [0.036, 0.19, 0.05], GREY, { mag: true, m: 'metal' }),
      P('magBase', [0, -0.229, -0.06], [0.04, 0.012, 0.056], BLACK, { mag: true, grp: 'mag', m: 'poly' }),
      ...[-1, 1].map((sx) => P('magRib', [sx * 0.0185, -0.13, -0.06], [0.002, 0.15, 0.012], DARK, { mag: true, grp: 'mag', m: 'metal' })),
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

      P('receiver', [0, 0, 0], [0.066, 0.1, 0.3], DARK, { m: 'metal' }),
      P('recTop', [0, 0.05, 0.0], [0.05, 0.012, 0.28], DARK2, { m: 'metal' }),
      P('port', [0.0335, 0.012, -0.03], [0.002, 0.04, 0.09], PORT),
      P('loadPort', [0, -0.052, 0.02], [0.04, 0.004, 0.09], PORT),
      P('portRim', [0, -0.051, 0.02], [0.05, 0.004, 0.1], BLACK, { m: 'metal' }),
      P('safety', [0, 0.056, 0.13], [0.012, 0.008, 0.016], RED, { em: 0.3 }),
      P('slideRelease', [-0.034, -0.035, 0.06], [0.004, 0.012, 0.016], STEEL, { m: 'steel' }),
      P('guard', [0, -0.065, 0.1], [0.016, 0.006, 0.075], BLACK, { m: 'metal' }),
      P('trigger', [0, -0.05, 0.095], [0.006, 0.026, 0.008], STEEL, { m: 'steel', rx: 0.3 }),
      // barrel with a vent rib, mag tube, pump
      C('barrel', [0, 0.025, -0.42], 0.036, 0.56, BLACK, { m: 'metal' }),
      P('ribBar', [0, 0.046, -0.42], [0.012, 0.004, 0.54], BLACK, { m: 'metal' }),
      ...Array.from({ length: 9 }, (_, i) => P('ribPost', [0, 0.042, -0.18 - i * 0.06], [0.01, 0.006, 0.006], BLACK, { m: 'metal' })),
      C('tube', [0, -0.02, -0.36], 0.03, 0.44, BLACK, { m: 'metal' }),
      C('tubeCap', [0, -0.02, -0.585], 0.034, 0.02, DARK, { m: 'metal' }),
      P('barrelClamp', [0, 0.002, -0.54], [0.04, 0.07, 0.02], DARK2, { m: 'metal' }),
      P('pump', [0, -0.02, -0.34], [0.062, 0.062, 0.17], WOOD, { pump: true, m: 'wood' }),
      ...[-0.29, -0.32, -0.35, -0.38].map((z) => P('pumpRidge', [0, -0.02, z], [0.066, 0.066, 0.008], [0.3, 0.17, 0.09], { pump: true, m: 'wood' })),
      P('pumpBar', [0.032, -0.005, -0.22], [0.004, 0.01, 0.24], STEEL, { pump: true, m: 'steel' }),
      P('bead', [0, 0.05, -0.68], [0.008, 0.012, 0.008], RED, { em: 1 }),
      P('rear', [0, 0.062, 0.08], [0.04, 0.016, 0.02], BLACK, { m: 'metal' }),
      P('rearNotch', [0, 0.068, 0.07], [0.012, 0.008, 0.002], RED, { em: 0.6, grp: 'sight' }),
      // side saddle with shells
      P('saddle', [-0.037, 0.004, -0.02], [0.008, 0.06, 0.12], BLACK, { m: 'poly' }),
      ...[-0.06, -0.03, 0.0, 0.03].flatMap((z) => [CY('saddleShell', [-0.046, 0.004, z], 0.022, 0.058, RED, { m: 'poly' }), CY('saddleBrass', [-0.046, -0.028, z], 0.023, 0.012, [0.75, 0.58, 0.3], { m: 'brass' })]),
      // wood grip + stock
      P('grip', [0, -0.08, 0.14], [0.045, 0.11, 0.05], WOOD, { rx: -0.3, m: 'wood' }),
      P('stock', [0, -0.025, 0.3], [0.05, 0.1, 0.24], WOOD, { m: 'wood' }),
      P('stockComb', [0, 0.022, 0.32], [0.046, 0.02, 0.2], [0.33, 0.19, 0.1], { m: 'wood', grp: 'stock' }),
      P('butt', [0, -0.03, 0.428], [0.054, 0.115, 0.02], BLACK, { m: 'rubber', grp: 'stock' }),
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

      P('receiver', [0, 0, 0], [0.066, 0.09, 0.4], WHITE, { m: 'paint' }),
      P('chassis', [0, -0.03, -0.05], [0.07, 0.04, 0.5], DARK2, { m: 'metal' }),
      ...[-0.18, -0.24, -0.3].flatMap((z) => [P('chSlot', [0.0355, -0.03, z], [0.002, 0.016, 0.036], PORT), P('chSlot', [-0.0355, -0.03, z], [0.002, 0.016, 0.036], PORT)]),
      P('port', [0.0335, 0.02, 0.04], [0.002, 0.024, 0.08], PORT),
      P('recRail', [0, 0.05, -0.02], [0.03, 0.01, 0.3], BLACK, { m: 'metal' }),
      P('guard', [0, -0.07, 0.12], [0.016, 0.006, 0.07], BLACK, { m: 'metal' }),
      P('trigger', [0, -0.055, 0.115], [0.006, 0.024, 0.008], STEEL, { m: 'steel', rx: 0.3 }),
      // fluted barrel + brake
      C('barrel', [0, 0.015, -0.5], 0.028, 0.6, BLACK, { m: 'metal' }),
      ...[0, 1, 2, 3].map((k) => P('flute', [Math.cos(k * H) * 0.0138, 0.015 + Math.sin(k * H) * 0.0138, -0.5], [0.004, 0.004, 0.42], DARK, { rz: k * H, m: 'metal' })),
      P('brake', [0, 0.015, -0.8], [0.045, 0.04, 0.07], BLACK, { m: 'metal' }),
      ...[-0.785, -0.81].flatMap((z) => [P('brakePort', [0.0226, 0.015, z], [0.002, 0.026, 0.012], PORT, { grp: 'muzzle' }), P('brakePort', [-0.0226, 0.015, z], [0.002, 0.026, 0.012], PORT, { grp: 'muzzle' })]),
      // scope
      C('scope', [0, 0.09, -0.02], 0.05, 0.3, BLACK, { m: 'metal' }),
      C('scopeF', [0, 0.09, -0.18], 0.062, 0.05, BLACK, { m: 'metal' }),
      C('scopeBell', [0, 0.09, -0.15], 0.056, 0.03, BLACK, { m: 'metal', grp: 'sight' }),
      C('scopeEye', [0, 0.09, 0.14], 0.056, 0.05, BLACK, { m: 'metal', grp: 'sight' }),
      C('scopeEyeRing', [0, 0.09, 0.115], 0.06, 0.012, DARK, { m: 'rubber', grp: 'sight' }),
      CY('turretTop', [0, 0.124, -0.01], 0.026, 0.02, DARK, { m: 'metal', grp: 'sight' }),
      CX('turretSide', [0.034, 0.09, -0.01], 0.026, 0.02, DARK, { m: 'metal', grp: 'sight' }),
      CX('turretParallax', [-0.034, 0.09, -0.01], 0.022, 0.016, DARK, { m: 'metal', grp: 'sight' }),
      P('turretMark', [0, 0.135, -0.01], [0.004, 0.002, 0.012], RED, { em: 0.7, grp: 'sight' }),
      P('ring1', [0, 0.065, -0.08], [0.03, 0.04, 0.02], DARK, { m: 'metal' }),
      P('ring2', [0, 0.065, 0.06], [0.03, 0.04, 0.02], DARK, { m: 'metal' }),
      P('lens', [0, 0.09, -0.206], [0.05, 0.05, 0.002], [0.5, 0.75, 1], { em: 0.6, shape: 'cyl', m: 'glass' }),
      // bolt handle (cycles with the bolt)
      P('bolt', [0.055, 0.03, 0.1], [0.05, 0.016, 0.016], STEEL, { bolt: true, m: 'steel' }),
      P('boltKnob', [0.084, 0.026, 0.1], [0.024, 0.024, 0.024], BLACK, { bolt: true, shape: 'sphere', m: 'poly' }),
      // grip + stock
      P('grip', [0, -0.08, 0.15], [0.045, 0.11, 0.05], BLACK, { rx: -0.3, m: 'rubber' }),
      P('stock', [0, -0.02, 0.34], [0.05, 0.11, 0.28], WHITE, { m: 'paint' }),
      P('stockHole', [0.0255, -0.035, 0.32], [0.002, 0.04, 0.12], DARK2, { grp: 'stock' }),
      P('stockHoleL', [-0.0255, -0.035, 0.32], [0.002, 0.04, 0.12], DARK2, { grp: 'stock' }),
      P('cheek', [0, 0.045, 0.3], [0.045, 0.03, 0.14], BLACK, { m: 'rubber' }),
      P('cheekKnob', [0.026, 0.03, 0.3], [0.01, 0.012, 0.012], STEEL, { m: 'steel', grp: 'stock', shape: 'cyl', ry: H }),
      P('butt', [0, -0.025, 0.487], [0.054, 0.12, 0.02], BLACK, { m: 'rubber', grp: 'stock' }),
      P('monopod', [0, -0.085, 0.42], [0.016, 0.04, 0.016], BLACK, { m: 'metal', grp: 'stock' }),
      // folded bipod
      P('bipodBase', [0, -0.055, -0.33], [0.04, 0.016, 0.03], BLACK, { m: 'metal', grp: 'under' }),
      ...[-1, 1].map((sx) => C('bipodLeg', [sx * 0.014, -0.06, -0.25], 0.012, 0.16, DARK2, { m: 'metal', grp: 'under' })),
      P('stripe', [0.034, 0, -0.1], [0.004, 0.02, 0.24], RED, { em: 1 }),
      P('mag', [0, -0.08, -0.02], [0.045, 0.08, 0.09], TAN, { mag: true, m: 'poly' }),
      P('magBase', [0, -0.124, -0.02], [0.05, 0.01, 0.094], BLACK, { mag: true, grp: 'mag', m: 'poly' }),
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

      P('receiver', [0, 0, 0], [0.09, 0.12, 0.44], DARK, { m: 'metal' }),
      P('feedCover', [0, 0.066, 0.02], [0.084, 0.018, 0.2], DARK2, { m: 'metal', cover: true }),
      P('coverLatch', [0, 0.07, 0.125], [0.05, 0.014, 0.02], BLACK, { m: 'metal', cover: true }),
      P('feedTray', [-0.046, 0.02, -0.02], [0.004, 0.04, 0.1], PORT),
      P('port', [0.0455, 0.0, 0.0], [0.002, 0.03, 0.1], PORT),
      ...[-0.15, -0.1, 0.1, 0.15].map((z) => P('rivet', [0.046, -0.04, z], [0.004, 0.008, 0.008], STEEL, { m: 'steel', shape: 'cyl', ry: H })),
      ...[-0.15, -0.1, 0.1, 0.15].map((z) => P('rivet', [-0.046, -0.04, z], [0.004, 0.008, 0.008], STEEL, { m: 'steel', shape: 'cyl', ry: H })),
      P('guard', [0, -0.08, 0.13], [0.018, 0.006, 0.08], BLACK, { m: 'metal' }),
      P('trigger', [0, -0.064, 0.125], [0.007, 0.028, 0.009], STEEL, { m: 'steel', rx: 0.3 }),
      // perforated heat shroud + barrel
      P('shroud', [0, 0.01, -0.36], [0.064, 0.074, 0.28], BLACK, { m: 'metal' }),
      ...[-0.27, -0.32, -0.37, -0.42, -0.47].flatMap((z) => [CX('shHole', [0, 0.02, z], 0.026, 0.066, PORT), CY('shHoleT', [0, 0.01, z], 0.022, 0.076, PORT)]),
      C('barrel', [0, 0.02, -0.58], 0.034, 0.24, BLACK, { m: 'metal' }),
      C('flash', [0, 0.02, -0.705], 0.044, 0.03, DARK2, { m: 'metal', grp: 'muzzle' }),
      P('frontPost', [0, 0.065, -0.49], [0.006, 0.04, 0.012], BLACK, { m: 'metal', grp: 'sight' }),
      // carry handle
      P('handle', [0, 0.11, -0.12], [0.02, 0.016, 0.14], BLACK, { m: 'poly' }),
      ...[-1, 1].map((sz) => P('handlePost', [0, 0.085, -0.12 + sz * 0.06], [0.016, 0.04, 0.014], DARK2, { m: 'metal' })),
      ...rail(0.078, 0.14, -0.02, {}, 0.03),
      ...redDot(0.1, 0.06),
      P('grip', [0, -0.1, 0.13], [0.045, 0.11, 0.05], BLACK, { rx: -0.3, m: 'rubber' }),
      P('gripCap', [0, -0.155, 0.147], [0.047, 0.012, 0.054], DARK2, { rx: -0.3, m: 'poly' }),
      P('stock', [0, -0.02, 0.33], [0.06, 0.11, 0.22], DARK, { m: 'poly' }),
      P('stockBuffer', [0, 0.015, 0.25], [0.05, 0.03, 0.06], DARK2, { m: 'metal', grp: 'stock' }),
      P('butt', [0, -0.025, 0.45], [0.064, 0.12, 0.022], BLACK, { m: 'rubber', grp: 'stock' }),
      // folded bipod
      P('bipod', [0, -0.05, -0.42], [0.05, 0.02, 0.06], DARK2, { m: 'metal' }),
      ...[-1, 1].map((sx) => C('bipodLeg', [sx * 0.018, -0.052, -0.33], 0.014, 0.2, GREY, { m: 'metal', grp: 'under' })),
      ...[-1, 1].map((sx) => P('bipodFoot', [sx * 0.018, -0.052, -0.225], [0.018, 0.012, 0.016], BLACK, { m: 'rubber', grp: 'under' })),
      P('stripe', [0.047, 0.03, -0.02], [0.004, 0.012, 0.36], RED, { em: 1 }),
      P('bolt', [0.055, 0.02, 0.06], [0.02, 0.02, 0.04], STEEL, { bolt: true, m: 'steel' }),
      // ammo box with a belt feeding up into the gun
      P('mag', [-0.03, -0.12, -0.04], [0.12, 0.13, 0.13], [0.3, 0.32, 0.26], { mag: true, m: 'metal' }),
      P('magLid', [-0.03, -0.052, -0.04], [0.124, 0.012, 0.134], [0.25, 0.27, 0.21], { mag: true, grp: 'mag', m: 'metal' }),
      P('magHandle', [-0.092, -0.12, -0.04], [0.008, 0.03, 0.07], BLACK, { mag: true, grp: 'mag', m: 'poly' }),
      P('magStencil', [-0.03, -0.12, -0.106], [0.07, 0.03, 0.002], [0.85, 0.75, 0.2], { mag: true, grp: 'mag' }),
      ...[0, 1, 2, 3].map((k) => CX('beltRound', [-0.03, -0.035 + k * 0.012, -0.06 + k * 0.012], 0.011, 0.05, [0.78, 0.6, 0.28], { mag: true, grp: 'mag', m: 'brass' })),
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

      P('frame', [0, 0, -0.01], [0.03, 0.035, 0.18], BLACK, { m: 'poly' }),
      P('dustRail', [0, -0.012, -0.065], [0.026, 0.01, 0.06], BLACK, { m: 'poly' }),
      ...[-0.05, -0.065, -0.08].map((z) => P('railNotch', [0, -0.018, z], [0.028, 0.003, 0.004], DARK2)),
      P('slide', [0, 0.03, -0.01], [0.034, 0.04, 0.2], WHITE, { bolt: true, m: 'paint' }),
      P('slideTop', [0, 0.051, -0.01], [0.024, 0.004, 0.19], [0.8, 0.8, 0.82], { bolt: true, m: 'paint' }),
      ...[0.05, 0.06, 0.07, 0.08].flatMap((z) => [P('serr', [0.0172, 0.03, z], [0.002, 0.03, 0.004], DARK, { bolt: true }), P('serr', [-0.0172, 0.03, z], [0.002, 0.03, 0.004], DARK, { bolt: true })]),
      P('port', [0.0172, 0.035, -0.01], [0.002, 0.018, 0.045], PORT, { bolt: true }),
      C('barrelHood', [0, 0.03, -0.108], 0.016, 0.006, BLACK, { m: 'metal' }),
      P('front', [0, 0.056, -0.1], [0.006, 0.01, 0.008], RED, { em: 1, bolt: true }),
      P('rearL', [-0.01, 0.056, 0.08], [0.006, 0.01, 0.008], BLACK, { bolt: true }),
      P('rearR', [0.01, 0.056, 0.08], [0.006, 0.01, 0.008], BLACK, { bolt: true }),
      P('grip', [0, -0.055, 0.06], [0.032, 0.11, 0.05], BLACK, { rx: -0.22, m: 'rubber' }),
      P('gripPanel', [0.0165, -0.055, 0.06], [0.002, 0.07, 0.032], DARK2, { rx: -0.22 }),
      P('gripPanelL', [-0.0165, -0.055, 0.06], [0.002, 0.07, 0.032], DARK2, { rx: -0.22 }),
      P('beaver', [0, 0.008, 0.09], [0.03, 0.012, 0.02], BLACK, { m: 'poly' }),
      P('guard', [0, -0.03, -0.01], [0.012, 0.006, 0.06], BLACK, { m: 'poly' }),
      P('guardFront', [0, -0.022, -0.04], [0.012, 0.022, 0.006], BLACK, { m: 'poly' }),
      P('trigger', [0, -0.016, -0.005], [0.006, 0.02, 0.006], STEEL, { m: 'steel', rx: 0.25 }),
      P('slideStop', [-0.016, 0.006, -0.0], [0.003, 0.006, 0.02], DARK2, { m: 'metal' }),
      P('magRelease', [-0.016, -0.012, 0.02], [0.003, 0.01, 0.008], DARK2, { m: 'metal' }),
      P('stripe', [0.0172, 0.016, -0.05], [0.002, 0.004, 0.08], RED, { em: 1, bolt: true }),
      P('mag', [0, -0.1, 0.07], [0.026, 0.06, 0.04], DARK, { rx: -0.22, mag: true, m: 'metal' }),
      P('magBase', [0, -0.133, 0.078], [0.03, 0.01, 0.044], BLACK, { rx: -0.22, mag: true, grp: 'mag', m: 'poly' }),
    ],
  },
};

// ---------------------------------------------------------------- variants
// New guns built on an existing one's model and animations (its `style`), with their own stats and look.
const clone = (o) => JSON.parse(JSON.stringify(o));
function variant(id, base, stats, edit) {
  const w = clone(WEAPONS[base]);
  Object.assign(w, stats, { id, style: base });
  if (edit) edit(w.parts, w);
  WEAPONS[id] = w;
}
const each = (parts, names, fn) => parts.forEach((p) => { if (names.includes(p.name)) fn(p); });
const BLUE = [0.15, 0.55, 1];
const OLIVE = [0.33, 0.35, 0.24];

// ---------------------------------------------------------------- bespoke guns
// Each one has its own model (no recolours) and its own reload (`reloadAnim`, see weapon.js). They borrow the
// handling basics (draw animation, attachment rules) of the gun type they're closest to (`style`).
function bespoke(id, base, stats, parts) {
  const w = clone(WEAPONS[base]);
  delete w.parts;
  WEAPONS[id] = Object.assign(w, stats, { id, style: base, parts });
}
const BRASS = [0.78, 0.6, 0.26];
const GOLD = [0.95, 0.76, 0.3];
const POLY = [0.2, 0.21, 0.23];
const SAND = [0.66, 0.58, 0.44];
const GREEN = [0.33, 0.37, 0.3];
const ORANGE = [1, 0.48, 0.08];
const YEL = [1, 0.78, 0.1];
const ring = (name, c, n, r, s, col, extra = {}) => Array.from({ length: n }, (_, k) => {
  const a = (k / n) * Math.PI * 2;
  return P(name, [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2]], s, col, { rz: a, ...extra });
});

// BR-3: three-round burst rifle. Angular white polymer, a long faceted handguard, blue burst glow.
bespoke('burst', 'ar', {
  name: 'BR-3', type: 'BURST RIFLE', auto: false, burst: 3, burstGap: 0.3, rpm: 950, mag: 30, dmg: 23, headMult: 2,
  reload: 2.0, reloadEmpty: 2.5, reloadAnim: 'tap',
  spread: { base: 0.003, move: 0.016, air: 0.03, bloom: 0.004, bloomMax: 0.025, ads: 0.22 },
  recoil: { up: 0.009, side: 0.005, vm: 0.9 },
  sightY: 0.088, adsZ: -0.27, hip: [0.17, -0.185, -0.56], muzzle: [0, 0.014, -0.62],
  grip: [0, -0.08, 0.1], foreGrip: [0, -0.05, -0.26], eject: [0.04, 0.02, -0.02], magPos: [0, -0.11, -0.06], bolt: [0.04, 0.03, 0.02],
  sound: { freq: 2900, thump: 160, gain: 0.5 },
}, [
  P('receiver', [0, 0.02, 0], [0.062, 0.064, 0.3], WHITE, { m: 'paint', shape: 0.008 }),
  P('upperRidge', [0, 0.056, -0.02], [0.046, 0.012, 0.27], DARK2, { m: 'metal' }),
  P('lower', [0, -0.028, 0.04], [0.056, 0.05, 0.2], POLY, { m: 'poly' }),
  P('magwell', [0, -0.05, -0.06], [0.06, 0.055, 0.095], WHITE, { m: 'paint' }),
  P('port', [0.0315, 0.024, -0.02], [0.002, 0.02, 0.07], PORT),
  P('handguard', [0, 0.012, -0.285], [0.068, 0.072, 0.27], WHITE, { m: 'paint', shape: 0.008 }),
  ...[-1, 1].map((sx) => P('hgFacet', [sx * 0.03, 0.044, -0.285], [0.016, 0.016, 0.27], POLY, { rz: sx * 0.78, m: 'poly' })),
  ...[-0.2, -0.26, -0.32, -0.38].flatMap((z) => [-1, 1].map((sx) => P('hgPort', [sx * 0.0345, 0.004, z], [0.002, 0.012, 0.036], PORT))),
  P('hgGlow', [0.035, -0.02, -0.29], [0.003, 0.005, 0.22], BLUE, { em: 1 }),
  P('hgGlowL', [-0.035, -0.02, -0.29], [0.003, 0.005, 0.22], BLUE, { em: 1 }),
  P('hgCap', [0, 0.012, -0.425], [0.06, 0.06, 0.012], POLY),
  C('barrel', [0, 0.014, -0.49], 0.022, 0.13, BLACK, { m: 'metal' }),
  C('muzzle', [0, 0.014, -0.585], 0.034, 0.06, DARK, { m: 'metal' }),
  ...[-1, 1].map((sx) => P('mzPort', [sx * 0.017, 0.014, -0.58], [0.004, 0.012, 0.03], PORT, { grp: 'muzzle' })),
  ...rail(0.07, 0.15, -0.41),
  ...redDot(0.088, 0.0, POLY),
  P('grip', [0, -0.085, 0.1], [0.042, 0.105, 0.048], BLACK, { rx: -0.28, m: 'rubber' }),
  P('gripBack', [0, -0.08, 0.124], [0.038, 0.085, 0.012], BLUE, { rx: -0.28, m: 'poly' }),
  P('guard', [0, -0.066, 0.04], [0.016, 0.006, 0.08], POLY),
  P('trigger', [0, -0.048, 0.036], [0.006, 0.026, 0.008], STEEL, { m: 'steel', rx: 0.3 }),
  P('selector', [-0.032, -0.01, 0.07], [0.004, 0.014, 0.022], BLUE, { em: 1 }),
  ...[0, 1, 2].map((k) => P('burstPip', [-0.032, 0.02, 0.04 + k * 0.012], [0.003, 0.006, 0.006], BLUE, { em: 1 })),
  C('stockTube', [0, 0.02, 0.2], 0.03, 0.1, DARK2, { m: 'metal', grp: 'stock' }),
  P('stock', [0, -0.006, 0.29], [0.048, 0.092, 0.16], WHITE, { m: 'paint', shape: 0.006 }),
  P('stockCut', [0.0245, -0.006, 0.29], [0.002, 0.05, 0.09], PORT, { grp: 'stock' }),
  P('stockCutL', [-0.0245, -0.006, 0.29], [0.002, 0.05, 0.09], PORT, { grp: 'stock' }),
  P('butt', [0, -0.01, 0.376], [0.052, 0.104, 0.02], BLACK, { m: 'rubber', grp: 'stock' }),
  P('charge', [0, 0.062, 0.16], [0.03, 0.01, 0.026], BLACK, { m: 'metal' }),
  P('bolt', [0.04, 0.03, 0.02], [0.014, 0.014, 0.03], STEEL, { bolt: true, m: 'steel' }),
  P('mag', [0, -0.11, -0.06], [0.048, 0.13, 0.072], DARK2, { mag: true, rx: 0.1, m: 'poly' }),
  ...[-1, 1].map((sx) => P('magRib', [sx * 0.025, -0.11, -0.06], [0.003, 0.1, 0.05], POLY, { mag: true, rx: 0.1, grp: 'mag' })),
  P('magBase', [0, -0.178, -0.067], [0.054, 0.014, 0.078], BLUE, { mag: true, rx: 0.1, grp: 'mag', m: 'poly' }),
]);

// FC-308: battle-rifle marksman. Walnut stock, parkerised steel, iron sights, flash hider and bayonet lug.
bespoke('dmr', 'ar', {
  name: 'FC-308', type: 'MARKSMAN RIFLE', auto: false, rpm: 330, mag: 15, dmg: 44, headMult: 2.1,
  reload: 2.2, reloadEmpty: 2.7, reloadAnim: 'check', dropAt: 0.36,
  spread: { base: 0.002, move: 0.022, air: 0.04, bloom: 0.012, bloomMax: 0.03, ads: 0.15 },
  recoil: { up: 0.026, side: 0.006, vm: 1.6 }, adsZoom: 0.72, adsSpeed: 11,
  sightY: 0.076, adsZ: -0.3, hip: [0.17, -0.19, -0.6], muzzle: [0, 0.02, -0.82],
  grip: [0, -0.075, 0.14], foreGrip: [0, -0.045, -0.3], eject: [0.04, 0.035, 0], magPos: [0, -0.078, -0.05], bolt: [0.035, 0.036, 0.02],
  sound: { freq: 2000, thump: 95, gain: 0.75, dur: 0.3 },
}, [
  P('receiver', [0, 0.027, 0.0], [0.05, 0.052, 0.28], [0.27, 0.28, 0.27], { m: 'metal' }),
  P('port', [0.0255, 0.035, 0.01], [0.002, 0.02, 0.07], PORT),
  P('opRod', [0.03, 0.012, -0.16], [0.008, 0.014, 0.32], DARK2, { m: 'metal' }),
  P('bolt', [0.035, 0.036, 0.02], [0.016, 0.014, 0.022], STEEL, { bolt: true, m: 'steel' }),
  P('stockFront', [0, -0.008, -0.24], [0.058, 0.05, 0.34], WOOD, { m: 'wood' }),
  P('hgTop', [0, 0.042, -0.27], [0.042, 0.016, 0.24], DARK, { m: 'poly' }),
  ...[-0.2, -0.26, -0.32].map((z) => P('hgVent', [0, 0.051, z], [0.03, 0.002, 0.02], PORT)),
  P('stockMid', [0, -0.02, 0.07], [0.056, 0.062, 0.22], WOOD, { m: 'wood' }),
  P('wrist', [0, -0.07, 0.14], [0.042, 0.1, 0.05], WOOD, { rx: -0.45, m: 'wood' }),
  P('stock', [0, -0.034, 0.3], [0.05, 0.1, 0.22], WOOD, { m: 'wood' }),
  P('comb', [0, 0.02, 0.29], [0.044, 0.02, 0.16], WOOD, { m: 'wood', grp: 'stock' }),
  P('butt', [0, -0.038, 0.415], [0.054, 0.116, 0.012], STEEL, { m: 'steel', grp: 'stock' }),
  P('swivelR', [0, -0.09, 0.36], [0.006, 0.02, 0.02], STEEL, { m: 'steel', grp: 'stock' }),
  C('barrel', [0, 0.02, -0.56], 0.024, 0.34, BLACK, { m: 'metal' }),
  C('gasCyl', [0, -0.006, -0.43], 0.018, 0.12, DARK2, { m: 'metal' }),
  P('frontBand', [0, 0.004, -0.42], [0.062, 0.052, 0.018], DARK2, { m: 'metal' }),
  C('muzzle', [0, 0.02, -0.765], 0.03, 0.065, DARK, { m: 'metal' }),
  ...[0, 1, 2, 3, 4].map((k) => P('mzSlot', [Math.cos(k * 1.256) * 0.0145, 0.02 + Math.sin(k * 1.256) * 0.0145, -0.775], [0.005, 0.005, 0.04], PORT, { grp: 'muzzle', rz: k * 1.256 })),
  P('lug', [0, -0.006, -0.735], [0.012, 0.012, 0.03], DARK2, { m: 'metal' }),
  P('frontPost', [0, 0.064, -0.74], [0.004, 0.034, 0.006], BLACK, { m: 'metal' }),
  ...[-1, 1].map((sx) => P(sx < 0 ? 'frontEarL' : 'frontEarR', [sx * 0.012, 0.058, -0.74], [0.004, 0.024, 0.008], BLACK, { m: 'metal' })),
  P('rearAp', [0, 0.066, 0.1], [0.026, 0.03, 0.012], DARK2, { m: 'metal' }),
  P('rearHole', [0, 0.076, 0.093], [0.006, 0.006, 0.002], [0.9, 0.9, 0.9], { em: 0.3 }),
  ...rail(0.056, 0.06, -0.06, {}, 0.026),
  P('guard', [0, -0.05, 0.09], [0.014, 0.006, 0.07], STEEL, { m: 'steel' }),
  P('trigger', [0, -0.036, 0.085], [0.006, 0.024, 0.008], STEEL, { m: 'steel', rx: 0.3 }),
  P('mag', [0, -0.078, -0.05], [0.046, 0.11, 0.08], BLACK, { mag: true, rx: 0.04, m: 'metal' }),
  P('magBase', [0, -0.135, -0.052], [0.05, 0.01, 0.084], DARK2, { mag: true, rx: 0.04, grp: 'mag', m: 'metal' }),
  ...[-1, 1].map((sx) => P('magRib', [sx * 0.0235, -0.08, -0.05], [0.002, 0.08, 0.01], DARK2, { mag: true, rx: 0.04, grp: 'mag' })),
]);

// BX-56: bullpup. Smooth moulded body, integrated 1.5× scope, folding foregrip, smoke mag behind the grip.
bespoke('bullpup', 'ar', {
  name: 'BX-56', type: 'BULLPUP RIFLE', rpm: 780, mag: 30, dmg: 20, headMult: 2,
  reload: 2.2, reloadEmpty: 2.7, reloadAnim: 'bullpup',
  spread: { base: 0.004, move: 0.014, air: 0.028, bloom: 0.0045, bloomMax: 0.032, ads: 0.25 },
  recoil: { up: 0.01, side: 0.008, vm: 1 }, adsSpeed: 15, adsZoom: 0.66,
  sightY: 0.108, adsZ: -0.2, hip: [0.16, -0.17, -0.5], muzzle: [0, 0.02, -0.55],
  grip: [0, -0.09, -0.06], foreGrip: [0, -0.1, -0.25], eject: [0.045, 0.02, 0.1], magPos: [0, -0.1, 0.12], bolt: [-0.04, 0.03, -0.08],
}, [
  P('body', [0, 0.0, 0.08], [0.07, 0.09, 0.42], GREEN, { m: 'poly', shape: 0.02 }),
  P('bodyLow', [0, -0.042, 0.11], [0.066, 0.04, 0.3], [0.28, 0.31, 0.26], { m: 'poly', shape: 0.012 }),
  P('port', [0.0355, 0.02, 0.1], [0.002, 0.022, 0.07], PORT),
  P('portL', [-0.0355, 0.02, 0.1], [0.002, 0.022, 0.07], [0.22, 0.24, 0.2]),
  P('grip', [0, -0.09, -0.06], [0.04, 0.1, 0.046], [0.28, 0.31, 0.26], { rx: -0.15, m: 'rubber' }),
  P('guardBar', [0, -0.142, -0.07], [0.02, 0.012, 0.17], GREEN, { m: 'poly' }),
  P('guardPost', [0, -0.1, -0.15], [0.02, 0.07, 0.014], GREEN, { m: 'poly' }),
  P('trigger', [0, -0.055, -0.08], [0.006, 0.026, 0.008], STEEL, { m: 'steel', rx: 0.3 }),
  P('fgrip', [0, -0.08, -0.25], [0.03, 0.08, 0.03], BLACK, { m: 'rubber' }),
  P('fgripHinge', [0, -0.035, -0.25], [0.034, 0.014, 0.04], DARK2, { m: 'metal', grp: 'under' }),
  C('barrel', [0, 0.02, -0.33], 0.024, 0.3, BLACK, { m: 'metal' }),
  C('collar', [0, 0.02, -0.19], 0.042, 0.04, DARK2, { m: 'metal' }),
  C('muzzle', [0, 0.02, -0.51], 0.032, 0.05, DARK, { m: 'metal' }),
  P('scopeBase', [0, 0.07, -0.02], [0.03, 0.04, 0.13], GREEN, { m: 'poly' }),
  C('scope', [0, 0.108, -0.02], 0.04, 0.16, BLACK, { m: 'metal' }),
  C('scopeBell', [0, 0.108, -0.11], 0.05, 0.03, BLACK, { m: 'metal' }),
  P('scopeLens', [0, 0.108, -0.126], [0.042, 0.042, 0.002], [0.45, 0.7, 1], { em: 0.5, shape: 'cyl' }),
  P('scopeDot', [0, 0.108, -0.03], [0.003, 0.003, 0.001], RED, { em: 1 }),
  P('buttplate', [0, -0.002, 0.295], [0.072, 0.096, 0.02], BLACK, { m: 'rubber', shape: 0.01 }),
  P('bolt', [-0.04, 0.03, -0.08], [0.016, 0.012, 0.02], BLACK, { bolt: true, m: 'metal' }),
  P('mag', [0, -0.1, 0.12], [0.05, 0.13, 0.075], [0.3, 0.3, 0.33], { mag: true, rx: 0.1, m: 'poly' }),
  P('magWindow', [0.0255, -0.09, 0.12], [0.002, 0.08, 0.04], [0.85, 0.65, 0.3], { mag: true, rx: 0.1, grp: 'mag', em: 0.2 }),
  P('magBase', [0, -0.168, 0.113], [0.054, 0.012, 0.08], BLACK, { mag: true, rx: 0.1, grp: 'mag' }),
]);

// KV-45: the "Vector" — boxy upper over a slanted recoil block, mag ahead of the trigger, skeleton stock.
bespoke('kv', 'smg', {
  name: 'KV-45', type: 'SMG', rpm: 1250, mag: 25, dmg: 11, headMult: 1.6, reloadAnim: 'spin',
  spread: { base: 0.009, move: 0.01, air: 0.018, bloom: 0.003, bloomMax: 0.026, ads: 0.4 },
  recoil: { up: 0.0045, side: 0.006, vm: 0.55 },
  sightY: 0.068, adsZ: -0.26, hip: [0.15, -0.165, -0.48], muzzle: [0, 0.012, -0.36],
  grip: [0, -0.08, 0.06], foreGrip: [0, -0.085, -0.17], eject: [0.03, 0.02, -0.02], magPos: [0, -0.12, -0.06], bolt: [-0.032, 0.03, -0.1],
  sound: { freq: 3800, thump: 210, gain: 0.38 },
}, [
  P('upper', [0, 0.02, -0.03], [0.056, 0.052, 0.3], BLACK, { m: 'poly', shape: 0.006 }),
  P('block', [0, -0.045, -0.13], [0.054, 0.08, 0.14], DARK2, { m: 'poly', rx: 0.22, shape: 0.006 }),
  P('blockFace', [0, -0.07, -0.205], [0.05, 0.06, 0.012], POLY, { m: 'poly', rx: 0.22 }),
  P('shroud', [0, 0.014, -0.22], [0.05, 0.046, 0.08], BLACK, { m: 'metal' }),
  ...[-1, 1].map((sx) => P('shVent', [sx * 0.0255, 0.014, -0.22], [0.002, 0.02, 0.05], PORT)),
  C('barrel', [0, 0.012, -0.28], 0.022, 0.07, BLACK, { m: 'metal' }),
  C('muzzle', [0, 0.012, -0.33], 0.03, 0.04, DARK2, { m: 'metal' }),
  P('grip', [0, -0.08, 0.06], [0.04, 0.1, 0.044], BLACK, { rx: -0.25, m: 'rubber' }),
  P('guard', [0, -0.055, 0.0], [0.014, 0.006, 0.07], BLACK),
  P('trigger', [0, -0.042, -0.002], [0.006, 0.022, 0.008], STEEL, { m: 'steel', rx: 0.3 }),
  ...rail(0.048, 0.1, -0.18),
  P('flipF', [0, 0.066, -0.17], [0.006, 0.026, 0.006], DARK2, { m: 'metal' }),
  P('flipR', [0, 0.06, 0.08], [0.026, 0.016, 0.006], DARK2, { m: 'metal' }),
  P('flipRL', [-0.009, 0.072, 0.08], [0.006, 0.01, 0.006], DARK2, { m: 'metal' }),
  P('flipRR', [0.009, 0.072, 0.08], [0.006, 0.01, 0.006], DARK2, { m: 'metal' }),
  P('stock', [0, 0.025, 0.2], [0.012, 0.012, 0.18], DARK2, { m: 'metal' }),
  P('stockLow', [0, -0.045, 0.2], [0.012, 0.012, 0.18], DARK2, { m: 'metal', grp: 'stock' }),
  P('stockPad', [0, -0.01, 0.295], [0.04, 0.094, 0.02], BLACK, { m: 'rubber', grp: 'stock' }),
  P('accent', [0.029, -0.008, -0.04], [0.002, 0.008, 0.2], YEL, { em: 0.9 }),
  P('accentL', [-0.029, -0.008, -0.04], [0.002, 0.008, 0.2], YEL, { em: 0.9 }),
  P('bolt', [-0.032, 0.03, -0.1], [0.012, 0.012, 0.016], STEEL, { bolt: true, m: 'steel' }),
  P('mag', [0, -0.12, -0.06], [0.03, 0.17, 0.05], BLACK, { mag: true, rx: 0.18, m: 'poly' }),
  P('magBase', [0, -0.205, -0.075], [0.034, 0.012, 0.056], YEL, { mag: true, rx: 0.18, grp: 'mag' }),
]);

// MP-9: compact machine pistol. Mag through the grip, little vertical foregrip, stock folded down the side.
bespoke('mp', 'pistol', {
  name: 'MP-9', type: 'MACHINE PISTOL', auto: true, rpm: 1100, mag: 24, dmg: 11, headMult: 1.6, slide: false, reloadAnim: 'drop',
  reload: 1.4, reloadEmpty: 1.7,
  spread: { base: 0.012, move: 0.012, air: 0.018, bloom: 0.004, bloomMax: 0.035, ads: 0.45 },
  recoil: { up: 0.006, side: 0.01, vm: 0.8 },
  sightY: 0.062, adsZ: -0.32, hip: [0.15, -0.16, -0.42], muzzle: [0, 0.03, -0.21],
  grip: [0, -0.06, 0.05], foreGrip: [0, -0.07, -0.1], eject: [0.025, 0.04, -0.02], magPos: [0, -0.15, 0.06], bolt: [0, 0.036, 0.085],
  sound: { freq: 3600, thump: 200, gain: 0.4 },
}, [
  P('frame', [0, 0.024, -0.02], [0.04, 0.052, 0.2], BLACK, { m: 'poly', shape: 0.005 }),
  P('port', [0.0205, 0.03, -0.03], [0.002, 0.016, 0.04], PORT),
  ...rail(0.054, 0.07, -0.1, {}, 0.022),
  C('barrel', [0, 0.03, -0.15], 0.02, 0.07, BLACK, { m: 'metal' }),
  C('thread', [0, 0.03, -0.195], 0.024, 0.02, DARK2, { m: 'metal' }),
  P('grip', [0, -0.06, 0.05], [0.034, 0.11, 0.044], BLACK, { rx: -0.12, m: 'rubber' }),
  P('fgrip', [0, -0.03, -0.1], [0.022, 0.05, 0.022], BLACK, { m: 'rubber' }),
  P('guard', [0, -0.006, -0.015], [0.012, 0.006, 0.06], BLACK),
  P('trigger', [0, 0.004, -0.02], [0.006, 0.02, 0.006], STEEL, { m: 'steel', rx: 0.3 }),
  P('stockFold', [0.028, 0.006, 0.04], [0.008, 0.012, 0.18], DARK2, { m: 'metal' }),
  P('stockPad', [0.028, -0.01, -0.05], [0.01, 0.05, 0.02], BLACK, { m: 'rubber' }),
  P('front', [0, 0.064, -0.11], [0.006, 0.012, 0.008], BLACK),
  P('rearL', [-0.01, 0.064, 0.07], [0.006, 0.012, 0.008], BLACK),
  P('rearR', [0.01, 0.064, 0.07], [0.006, 0.012, 0.008], BLACK),
  P('selector', [-0.021, 0.0, 0.03], [0.003, 0.012, 0.012], RED, { em: 0.8 }),
  P('bolt', [0, 0.036, 0.085], [0.032, 0.014, 0.012], DARK2, { bolt: true, m: 'metal' }),
  P('mag', [0, -0.15, 0.06], [0.026, 0.12, 0.036], DARK2, { mag: true, rx: -0.12, m: 'metal' }),
  P('magBase', [0, -0.21, 0.068], [0.03, 0.012, 0.04], RED, { mag: true, rx: -0.12, grp: 'mag' }),
]);

// R-357: a proper wheelgun. Steel frame, fluted cylinder (swings out to reload), full-lug barrel, rubber grip.
bespoke('revolver', 'pistol', {
  name: 'R-357', type: 'REVOLVER', auto: false, rpm: 140, mag: 6, dmg: 58, headMult: 1.8, slide: false, reloadAnim: 'revolver', reloadEject: 6, dropAt: 0.2, shellCol: [0.75, 0.6, 0.3],
  reload: 2.4, reloadEmpty: 2.4,
  spread: { base: 0.003, move: 0.014, air: 0.025, bloom: 0.02, bloomMax: 0.04, ads: 0.3 },
  recoil: { up: 0.05, side: 0.012, vm: 2.4 },
  sightY: 0.062, adsZ: -0.34, hip: [0.15, -0.16, -0.42], muzzle: [0, 0.034, -0.22],
  grip: [0, -0.055, 0.065], foreGrip: [-0.03, -0.07, 0.05], eject: [0.02, 0.03, 0], magPos: [0, 0.018, -0.01], bolt: [0, 0.05, 0.05],
  sound: { freq: 1500, thump: 75, gain: 0.85, dur: 0.32 },
}, [
  P('frame', [0, 0.004, 0.0], [0.026, 0.05, 0.1], STEEL, { m: 'steel' }),
  P('topStrap', [0, 0.042, -0.005], [0.022, 0.012, 0.085], STEEL, { m: 'steel' }),
  C('barrel', [0, 0.034, -0.13], 0.026, 0.17, STEEL, { m: 'steel' }),
  P('lug', [0, 0.012, -0.125], [0.018, 0.028, 0.16], STEEL, { m: 'steel' }),
  P('rib', [0, 0.05, -0.13], [0.009, 0.008, 0.17], DARK2, { m: 'metal' }),
  C('crown', [0, 0.034, -0.216], 0.02, 0.004, DARK2, { m: 'metal' }),
  P('front', [0, 0.062, -0.2], [0.006, 0.018, 0.018], RED, { em: 0.7 }),
  P('rearL', [-0.006, 0.054, 0.035], [0.004, 0.01, 0.01], BLACK),
  P('rearR', [0.006, 0.054, 0.035], [0.004, 0.01, 0.01], BLACK),
  P('hammer', [0, 0.05, 0.05], [0.008, 0.026, 0.014], DARK2, { bolt: true, m: 'steel', rx: -0.3 }),
  P('grip', [0, -0.055, 0.065], [0.032, 0.1, 0.044], BLACK, { rx: -0.35, m: 'rubber' }),
  ...[0, 1, 2].map((k) => P('finger', [0, -0.03 - k * 0.026, 0.04 - k * 0.009], [0.034, 0.008, 0.01], DARK2, { rx: -0.35 })),
  P('medallion', [0.0165, -0.05, 0.065], [0.002, 0.014, 0.014], GOLD, { em: 0.2 }),
  P('guard', [0, -0.028, 0.005], [0.01, 0.006, 0.05], STEEL, { m: 'steel' }),
  P('guardFront', [0, -0.016, -0.02], [0.01, 0.024, 0.006], STEEL, { m: 'steel' }),
  P('trigger', [0, -0.012, 0.006], [0.006, 0.022, 0.006], DARK2, { m: 'steel', rx: 0.3 }),
  P('latch', [-0.014, 0.018, 0.04], [0.004, 0.01, 0.016], DARK2),
  C('mag', [0, 0.018, -0.01], 0.064, 0.058, STEEL, { mag: true, m: 'steel' }),
  ...[0, 1, 2, 3, 4, 5].map((k) => P('flute', [Math.cos(k * 1.047 + 0.52) * 0.031, 0.018 + Math.sin(k * 1.047 + 0.52) * 0.031, -0.01], [0.008, 0.008, 0.05], DARK, { mag: true, grp: 'mag' })),
  ...[0, 1, 2, 3, 4, 5].map((k) => P('chamber', [Math.cos(k * 1.047) * 0.019, 0.018 + Math.sin(k * 1.047) * 0.019, 0.02], [0.01, 0.01, 0.002], BRASS, { mag: true, grp: 'mag', em: 0.1 })),
  C('ejRod', [0, 0.0, -0.07], 0.008, 0.06, STEEL, { mag: true, m: 'steel' }),
]);

// AS-20: AA-12-style auto shotgun. Boxy receiver, a big drum, ventilated heat shield, carry handle, muzzle brake.
bespoke('autoshotgun', 'shotgun', {
  name: 'AS-20', type: 'AUTO SHOTGUN', auto: true, rpm: 210, mag: 8, dmg: 8, headMult: 1.4, pellets: 8, reloadAnim: 'drum',
  action: undefined, reloadStyle: 'mag', reload: 2.6, reloadEmpty: 3.0,
  spread: { base: 0.06, move: 0.012, air: 0.018, bloom: 0.006, bloomMax: 0.02, ads: 0.8 },
  recoil: { up: 0.035, side: 0.014, vm: 1.8 },
  sightY: 0.128, adsZ: -0.3, hip: [0.18, -0.2, -0.55], muzzle: [0, 0.02, -0.52],
  grip: [0, -0.09, 0.1], foreGrip: [0, -0.07, -0.26], eject: [0.045, 0.02, 0], magPos: [0, -0.12, -0.06], bolt: [-0.042, 0.03, -0.12],
  sound: { freq: 1400, thump: 85, gain: 0.8, dur: 0.24 },
}, [
  P('receiver', [0, 0.01, 0], [0.07, 0.11, 0.36], DARK2, { m: 'metal', shape: 0.006 }),
  P('recSeam', [0.0355, 0.0, 0], [0.002, 0.004, 0.34], BLACK),
  P('port', [0.0355, 0.03, 0.0], [0.002, 0.03, 0.08], PORT),
  P('shield', [0, 0.072, -0.2], [0.054, 0.02, 0.26], BLACK, { m: 'metal' }),
  ...[-0.12, -0.17, -0.22, -0.27].map((z) => P('shieldHole', [0, 0.083, z], [0.03, 0.002, 0.026], PORT)),
  P('handle', [0, 0.11, -0.02], [0.02, 0.016, 0.17], BLACK, { m: 'poly' }),
  ...[-1, 1].map((sz) => P('handlePost', [0, 0.085, -0.02 + sz * 0.07], [0.018, 0.04, 0.016], BLACK)),
  P('rear', [0, 0.124, 0.05], [0.022, 0.01, 0.01], DARK),
  P('frontPost', [0, 0.1, -0.31], [0.006, 0.03, 0.008], DARK),
  C('barrel', [0, 0.02, -0.38], 0.034, 0.16, BLACK, { m: 'metal' }),
  P('brake', [0, 0.02, -0.48], [0.052, 0.046, 0.06], DARK, { m: 'metal' }),
  ...[-1, 1].flatMap((sx) => [-0.47, -0.49].map((z) => P('brakePort', [sx * 0.026, 0.02, z], [0.004, 0.026, 0.01], PORT, { grp: 'muzzle' }))),
  P('hgLower', [0, -0.04, -0.25], [0.064, 0.04, 0.17], BLACK, { m: 'poly' }),
  ...[-0.2, -0.24, -0.28, -0.32].map((z) => P('hgRib', [0, -0.061, z], [0.066, 0.004, 0.01], DARK2)),
  P('grip', [0, -0.09, 0.1], [0.044, 0.11, 0.05], BLACK, { rx: -0.25, m: 'rubber' }),
  P('guard', [0, -0.07, 0.05], [0.016, 0.006, 0.08], BLACK),
  P('trigger', [0, -0.055, 0.045], [0.006, 0.026, 0.008], STEEL, { m: 'steel', rx: 0.3 }),
  P('stock', [0, -0.012, 0.3], [0.06, 0.11, 0.2], BLACK, { m: 'poly', shape: 0.008 }),
  P('butt', [0, -0.015, 0.405], [0.066, 0.12, 0.02], DARK2, { m: 'rubber', grp: 'stock' }),
  P('stripe', [0.036, -0.02, 0.0], [0.002, 0.008, 0.26], RED, { em: 0.9 }),
  P('bolt', [-0.042, 0.03, -0.12], [0.016, 0.014, 0.02], STEEL, { bolt: true, m: 'steel' }),
  CX('mag', [0, -0.12, -0.06], 0.16, 0.09, BLACK, { mag: true, m: 'poly' }),
  CX('drumCap', [0.047, -0.12, -0.06], 0.13, 0.006, DARK2, { mag: true, grp: 'mag' }),
  CX('drumHub', [0.051, -0.12, -0.06], 0.04, 0.006, RED, { mag: true, grp: 'mag', em: 0.4 }),
  P('drumNeck', [0, -0.05, -0.06], [0.05, 0.03, 0.06], BLACK, { mag: true, grp: 'mag' }),
]);

// DB-2: side-by-side break-action. Engraved steel action, walnut fore-end and straight English stock, twin hammers.
bespoke('double', 'shotgun', {
  name: 'DB-2', type: 'DOUBLE BARREL', auto: false, rpm: 360, mag: 2, dmg: 9, headMult: 1.5, pellets: 12, reloadAnim: 'break', reloadEject: 2, shellCol: [0.85, 0.15, 0.1],
  action: undefined, reloadStyle: 'mag', reload: 2.1, reloadEmpty: 2.1, hinge: [0, -0.012, -0.035],
  spread: { base: 0.048, move: 0.01, air: 0.015, bloom: 0, bloomMax: 0, ads: 0.75 },
  recoil: { up: 0.06, side: 0.014, vm: 2.6 },
  sightY: 0.054, adsZ: -0.32, hip: [0.17, -0.18, -0.6], muzzle: [0, 0.02, -0.68],
  grip: [0, -0.04, 0.16], foreGrip: [0, -0.04, -0.22], eject: [0, 0.035, -0.02], magPos: [0, 0.02, -0.02], bolt: [0, 0.05, 0.07],
  sound: { freq: 1300, thump: 70, gain: 0.95, dur: 0.32 },
}, [
  P('action', [0, 0.002, 0.03], [0.062, 0.062, 0.12], STEEL, { m: 'steel', shape: 0.01 }),
  ...[-1, 1].flatMap((sx) => [P('engrave', [sx * 0.0315, 0.0, 0.03], [0.002, 0.03, 0.08], GOLD, { em: 0.15 }), P('engrave2', [sx * 0.0315, 0.02, 0.05], [0.002, 0.004, 0.05], GOLD, { em: 0.15 })]),
  C('barrel', [-0.017, 0.02, -0.34], 0.034, 0.62, BLACK, { m: 'metal', brk: true }),
  C('barrel2', [0.017, 0.02, -0.34], 0.034, 0.62, BLACK, { m: 'metal', brk: true }),
  P('rib', [0, 0.04, -0.34], [0.012, 0.006, 0.6], DARK2, { m: 'metal', brk: true }),
  P('lumps', [0, -0.006, -0.06], [0.05, 0.022, 0.06], DARK2, { m: 'metal', brk: true }),
  P('foreend', [0, -0.012, -0.2], [0.06, 0.04, 0.2], WOOD, { m: 'wood', brk: true }),
  P('foreendTip', [0, -0.012, -0.302], [0.05, 0.034, 0.012], [0.3, 0.2, 0.12], { m: 'wood', brk: true }),
  P('bead', [0, 0.047, -0.635], [0.007, 0.007, 0.007], BRASS, { brk: true, em: 0.2 }),
  ...[-1, 1].map((sx) => P('hammer', [sx * 0.018, 0.05, 0.075], [0.008, 0.028, 0.012], DARK2, { bolt: true, m: 'steel', rx: -0.35 })),
  P('topLever', [0, 0.04, 0.1], [0.012, 0.008, 0.045], STEEL, { m: 'steel', rz: 0.3 }),
  P('wrist', [0, -0.036, 0.16], [0.04, 0.06, 0.12], WOOD, { rx: -0.2, m: 'wood' }),
  P('grip', [0, -0.04, 0.16], [0.001, 0.001, 0.001], WOOD),
  P('stock', [0, -0.05, 0.33], [0.05, 0.112, 0.24], WOOD, { rx: -0.08, m: 'wood' }),
  P('butt', [0, -0.065, 0.455], [0.054, 0.124, 0.014], [0.12, 0.1, 0.09], { m: 'rubber', grp: 'stock' }),
  P('guard', [0, -0.04, 0.1], [0.014, 0.006, 0.07], STEEL, { m: 'steel' }),
  ...[0, 1].map((k) => P('trigger', [0, -0.026, 0.09 + k * 0.018], [0.006, 0.022, 0.006], GOLD, { m: 'steel', rx: 0.3 })),
  P('mag', [0, 0.02, -0.02], [0.07, 0.03, 0.04], [0.8, 0.15, 0.1], { mag: true, hidden: true }),
]);

// LV-44: lever-action. Brass receiver, octagonal barrel over a tube magazine, walnut furniture, big lever loop.
bespoke('lever', 'sniper', {
  name: 'LV-44', type: 'LEVER RIFLE', rpm: 100, mag: 8, dmg: 68, headMult: 1.9, scope: false, lever: true, shellCol: [0.8, 0.62, 0.28],
  reloadStyle: 'shell', shellTime: 0.42, adsZoom: 0.68, adsSpeed: 12,
  spread: { base: 0.004, move: 0.025, air: 0.045, bloom: 0, bloomMax: 0, ads: 0.1 },
  recoil: { up: 0.04, side: 0.008, vm: 2.2 },
  sightY: 0.058, adsZ: -0.3, hip: [0.17, -0.18, -0.6], muzzle: [0, 0.03, -0.73],
  grip: [0, -0.03, 0.15], foreGrip: [0, -0.03, -0.2], eject: [0, 0.06, 0.03], magPos: [0.026, 0.0, 0.03], bolt: [0, -0.04, 0.07],
  sound: { freq: 1700, thump: 85, gain: 0.85, dur: 0.34 },
}, [
  P('receiver', [0, 0.012, 0.02], [0.044, 0.072, 0.17], BRASS, { m: 'metal' }),
  P('sidePlate', [0.0225, 0.012, 0.03], [0.002, 0.04, 0.09], GOLD, { em: 0.12 }),
  P('gate', [0.0225, -0.002, 0.03], [0.003, 0.018, 0.034], DARK2),
  C('barrel', [0, 0.03, -0.41], 0.028, 0.62, DARK2, { m: 'metal' }),
  ...[-1, 1].map((sx) => P('flat', [sx * 0.0125, 0.03, -0.41], [0.004, 0.02, 0.6], BLACK, { m: 'metal' })),
  C('magTube', [0, -0.004, -0.36], 0.02, 0.5, DARK2, { m: 'metal' }),
  P('band', [0, 0.013, -0.62], [0.034, 0.052, 0.016], DARK2, { m: 'metal' }),
  P('forend', [0, 0.004, -0.18], [0.046, 0.044, 0.2], WOOD, { m: 'wood' }),
  P('front', [0, 0.052, -0.7], [0.004, 0.016, 0.008], BRASS, { em: 0.3 }),
  P('rearSight', [0, 0.05, -0.12], [0.026, 0.012, 0.006], DARK2),
  P('rearNotch', [0, 0.056, -0.122], [0.006, 0.006, 0.008], BLACK),
  P('hammer', [0, 0.056, 0.095], [0.008, 0.026, 0.012], DARK2, { bolt: true, m: 'steel', rx: -0.3 }),
  P('lever', [0, -0.034, 0.07], [0.01, 0.01, 0.12], DARK2, { bolt: true, m: 'steel' }),
  P('leverLoop', [0, -0.07, 0.115], [0.01, 0.06, 0.012], DARK2, { bolt: true, m: 'steel' }),
  P('leverLoopB', [0, -0.098, 0.08], [0.01, 0.01, 0.07], DARK2, { bolt: true, m: 'steel' }),
  P('trigger', [0, -0.03, 0.06], [0.005, 0.02, 0.006], GOLD, { m: 'steel', rx: 0.3 }),
  P('wrist', [0, -0.018, 0.15], [0.036, 0.052, 0.08], WOOD, { rx: -0.3, m: 'wood' }),
  P('stock', [0, -0.04, 0.3], [0.044, 0.1, 0.22], WOOD, { rx: -0.05, m: 'wood' }),
  P('butt', [0, -0.05, 0.415], [0.046, 0.112, 0.012], DARK2, { m: 'metal', grp: 'stock' }),
  C('saddleRing', [-0.026, 0.0, 0.06], 0.02, 0.004, BRASS, { ry: Math.PI / 2 }),
  P('shell', [0, -0.08, 0.02], [0.016, 0.016, 0.05], BRASS, { mag: true, hidden: true }),
]);

// ROTARY-X: a proper minigun. Six barrels in a clamped cluster on a rotor housing, a motor pod, twin spade grips,
// a carry handle, and a feed chute running round from the ammo box hung on the left.
bespoke('minigun', 'lmg', {
  name: 'ROTARY-X', type: 'MINIGUN', rpm: 1600, mag: 250, dmg: 12, headMult: 1.4, spin: 0.55, reloadAnim: 'minigun',
  reload: 4.4, reloadEmpty: 4.9,
  spread: { base: 0.016, move: 0.03, air: 0.04, bloom: 0.0012, bloomMax: 0.03, ads: 0.6 },
  recoil: { up: 0.0035, side: 0.008, vm: 0.6 }, adsSpeed: 7, adsZoom: 0.88,
  sightY: 0.145, adsZ: -0.38, hip: [0.2, -0.24, -0.66], muzzle: [0, 0.0, -0.9],
  grip: [0.05, -0.07, 0.2], foreGrip: [-0.05, -0.07, 0.2], eject: [0.06, -0.08, -0.1], magPos: [-0.13, -0.12, 0.0], bolt: [0.08, -0.02, -0.05],
  sound: { freq: 2400, thump: 130, gain: 0.5 },
}, [
  ...Array.from({ length: 6 }, (_, i) => { const a = i * Math.PI / 3; return C('mgBarrel', [Math.cos(a) * 0.03, Math.sin(a) * 0.03, -0.53], 0.02, 0.66, i % 2 ? BLACK : DARK2, { m: 'metal', spin: true }); }),
  ...Array.from({ length: 6 }, (_, i) => { const a = i * Math.PI / 3; return C('mgBore', [Math.cos(a) * 0.03, Math.sin(a) * 0.03, -0.863], 0.012, 0.004, PORT, { spin: true }); }),
  C('rod', [0, 0, -0.52], 0.016, 0.64, STEEL, { m: 'steel', spin: true }),
  C('clampF', [0, 0, -0.82], 0.1, 0.024, DARK2, { m: 'metal', spin: true }),
  C('clampM', [0, 0, -0.55], 0.096, 0.02, DARK2, { m: 'metal', spin: true }),
  C('clampR', [0, 0, -0.3], 0.1, 0.03, DARK, { m: 'metal', spin: true }),
  C('housing', [0, 0, -0.14], 0.13, 0.2, DARK2, { m: 'metal' }),
  ...ring('housingBolt', [0, 0, -0.04], 8, 0.062, [0.01, 0.01, 0.01], STEEL, { m: 'steel' }),
  P('body', [0, 0.0, 0.08], [0.12, 0.11, 0.2], DARK, { m: 'metal', shape: 0.01 }),
  P('motor', [0.08, -0.02, -0.05], [0.05, 0.07, 0.18], YEL, { m: 'paint', shape: 0.01 }),
  C('motorCap', [0.08, -0.02, -0.145], 0.05, 0.012, BLACK, { m: 'metal' }),
  ...[-0.1, -0.06, -0.02, 0.02].map((z) => P('motorFin', [0.107, -0.02, z], [0.004, 0.06, 0.008], DARK2)),
  P('handle', [0, 0.11, -0.08], [0.022, 0.02, 0.24], BLACK, { m: 'rubber' }),
  ...[-1, 1].map((sz) => P('handlePost', [0, 0.08, -0.08 + sz * 0.1], [0.02, 0.05, 0.02], DARK2)),
  ...[-1, 1].map((sx) => P('spade', [sx * 0.05, -0.07, 0.2], [0.026, 0.11, 0.026], BLACK, { m: 'rubber' })),
  P('spadeBar', [0, -0.005, 0.2], [0.13, 0.024, 0.024], DARK2, { m: 'metal' }),
  P('spadeBar2', [0, -0.13, 0.2], [0.13, 0.02, 0.02], DARK2, { m: 'metal' }),
  P('fireBtn', [0, -0.005, 0.214], [0.03, 0.016, 0.006], RED, { em: 0.9 }),
  P('shield', [0, 0.062, -0.5], [0.075, 0.008, 0.5], BLACK, { m: 'metal' }),
  ...[-0.35, -0.45, -0.55, -0.65].map((z) => P('shieldHole', [0, 0.067, z], [0.05, 0.002, 0.05], PORT)),
  ...[0, 1, 2].map((k) => P('chute', [-0.07 - k * 0.022, -0.04 - k * 0.025, 0.02 - k * 0.006], [0.03, 0.03, 0.06], DARK2, { m: 'metal', rz: -0.6 })),
  P('mag', [-0.13, -0.12, 0.0], [0.1, 0.14, 0.17], GREEN, { mag: true, m: 'paint', shape: 0.008 }),
  P('boxLid', [-0.13, -0.046, 0.0], [0.104, 0.012, 0.174], [0.25, 0.28, 0.22], { mag: true, grp: 'mag' }),
  P('boxLatch', [-0.18, -0.08, 0.0], [0.006, 0.03, 0.04], STEEL, { mag: true, grp: 'mag' }),
  P('boxStencil', [-0.13, -0.12, 0.0865], [0.07, 0.03, 0.002], YEL, { mag: true, grp: 'mag', em: 0.3 }),
  P('bolt', [0.08, -0.02, -0.05], [0.001, 0.001, 0.001], DARK),
]);

// a little extra detail on the original six: sling hardware, maker plates, screws, witness marks
const polish = {
  ar: [P('slingF', [0, -0.034, -0.385], [0.006, 0.014, 0.02], STEEL, { m: 'steel' }), P('plate', [0.0295, -0.03, 0.06], [0.002, 0.012, 0.045], GREY, { em: 0.1 }),
    P('witness', [-0.0325, -0.02, 0.085], [0.002, 0.004, 0.004], RED, { em: 0.6 }), P('deflectorBrass', [0.0365, 0.022, 0.03], [0.002, 0.016, 0.01], [0.75, 0.6, 0.3])],
  smg: [P('slingR', [0.03, -0.028, 0.12], [0.006, 0.018, 0.02], STEEL, { m: 'steel' }), P('plate', [0.0315, 0.0, -0.08], [0.002, 0.012, 0.04], GREY, { em: 0.1 }),
    ...[-0.06, 0.0, 0.06].map((z) => P('screw', [0.0315, -0.02, z], [0.002, 0.006, 0.006], STEEL, { m: 'steel' }))],
  shotgun: [P('slingF', [0, -0.042, -0.56], [0.006, 0.014, 0.02], STEEL, { m: 'steel' }), P('padLine', [0, -0.03, 0.418], [0.056, 0.12, 0.004], RED, { em: 0.3 }),
    P('plate', [0.034, -0.02, 0.05], [0.002, 0.014, 0.05], GREY, { em: 0.1 })],
  sniper: [P('studF', [0, -0.052, -0.4], [0.008, 0.012, 0.016], STEEL, { m: 'steel' }), P('plate', [0.034, -0.03, 0.08], [0.002, 0.014, 0.06], GREY, { em: 0.1 }),
    ...[-0.05, 0.05].map((z) => P('screw', [0.034, 0.01, z], [0.002, 0.006, 0.006], STEEL, { m: 'steel' }))],
  lmg: [P('plate', [0.046, -0.01, -0.04], [0.002, 0.016, 0.06], GREY, { em: 0.1 }), P('slingF', [0, -0.03, -0.46], [0.006, 0.016, 0.02], STEEL, { m: 'steel' }),
    P('heatTab', [0, 0.05, -0.3], [0.03, 0.004, 0.04], [1, 0.45, 0.1], { em: 0.4 })],
  pistol: [...[-0.06, -0.075, -0.09].map((z) => P('railSlot', [0, -0.019, z], [0.03, 0.002, 0.004], PORT)), P('plate', [0.0155, -0.002, 0.03], [0.002, 0.008, 0.03], GREY, { em: 0.1 })],
};
for (const [id, ps] of Object.entries(polish)) WEAPONS[id].parts.push(...ps);

// ---------------------------------------------------------------- fit pass: close the gaps between parts
// (found by checking every part touches the rest of the gun)
const fit = (id, name, fn) => WEAPONS[id].parts.filter((p) => p.name === name).forEach(fn);
const addTo = (id, ...ps) => WEAPONS[id].parts.push(...ps);
fit('ar', 'selector', (p) => { p.c[0] = -0.03; });
fit('ar', 'witness', (p) => { p.c[0] = -0.0295; });
for (const n of ['railBase', 'railTooth']) fit('ar', n, (p) => { p.c[1] -= 0.005; });
for (const n of ['railBase', 'railTooth']) fit('burst', n, (p) => { p.c[1] -= 0.004; });
fit('dmr', 'barrel', (p) => { p.s[2] = 0.355; p.c[2] = -0.5675; });
fit('dmr', 'hgTop', (p) => { p.c[1] = 0.026; p.s[1] = 0.02; p.s[2] = 0.26; p.c[2] = -0.265; });
fit('dmr', 'hgVent', (p) => { p.c[1] = 0.0365; });
fit('dmr', 'stock', (p) => { p.c[2] = 0.295; p.s[2] = 0.23; });
fit('dmr', 'lug', (p) => { p.c[1] = 0.003; });
addTo('dmr', P('frontBase', [0, 0.04, -0.74], [0.02, 0.018, 0.02], BLACK, { m: 'metal' }));
fit('bullpup', 'scopeBase', (p) => { p.c[1] = 0.065; p.s[1] = 0.05; });
fit('bullpup', 'fgripHinge', (p) => { p.c[1] = -0.04; });
fit('bullpup', 'barrel', (p) => { p.s[2] = 0.31; p.c[2] = -0.335; });
addTo('bullpup', P('hgFront', [0, -0.005, -0.2], [0.06, 0.06, 0.16], GREEN, { m: 'poly', shape: 0.014 }));
fit('mp', 'stockFold', (p) => { p.c[0] = 0.024; });
fit('mp', 'stockPad', (p) => { p.c[0] = 0.024; });
fit('mp', 'fgrip', (p) => { p.c[1] = -0.027; });
fit('mp', 'front', (p) => { p.c[2] = -0.095; });
fit('autoshotgun', 'hgLower', (p) => { p.c[1] = -0.03; p.s[1] = 0.05; });
fit('autoshotgun', 'hgRib', (p) => { p.c[1] = -0.056; });
fit('autoshotgun', 'stock', (p) => { p.c[2] = 0.29; p.s[2] = 0.22; });
fit('autoshotgun', 'frontPost', (p) => { p.c[1] = 0.097; });
addTo('autoshotgun', P('barrelShroud', [0, 0.02, -0.25], [0.05, 0.05, 0.17], DARK2, { m: 'metal' }));
fit('double', 'hammer', (p) => { p.c[1] = 0.042; });
fit('sniper', 'bipodBase', (p) => { p.c[2] = -0.29; });
fit('sniper', 'studF', (p) => { p.c[2] = -0.28; });
fit('lever', 'barrel', (p) => { p.s[2] = 0.66; p.c[2] = -0.39; });
fit('lever', 'flat', (p) => { p.s[2] = 0.64; p.c[2] = -0.39; });
fit('lever', 'saddleRing', (p) => { p.c[0] = -0.024; });
for (const n of ['spade', 'spadeBar', 'spadeBar2']) fit('minigun', n, (p) => { p.c[2] = 0.19; });
fit('minigun', 'fireBtn', (p) => { p.c[2] = 0.204; });
fit('minigun', 'shield', (p) => { p.c[2] = -0.495; p.s[2] = 0.52; });
fit('shotgun', 'padLine', (p) => { p.grp = 'stock'; });
addTo('kv', P('gripTop', [0, -0.018, 0.05], [0.05, 0.028, 0.07], BLACK, { m: 'poly' }));
fit('revolver', 'hammer', (p) => { p.c[1] = 0.042; p.s[1] = 0.03; });

// ---------------------------------------------------------------- balance pass (build 0.34)
// Body-shot time to kill a Medium (250 HP), by role: SMGs ~0.7 s up close but fall off fast; rifles ~0.85–0.95 s at
// any range; marksman / lever / revolver reward hits (4–5 shots, headshots matter); shotguns kill in 2 close shots
// and are useless at range; the heavy guns trade mobility for big magazines. moveMul = how fast you move carrying it.
const BALANCE = {
  ar: { dmg: 22, rpm: 720, moveMul: 1 },
  burst: { dmg: 28, rpm: 1000, burstGap: 0.22, moveMul: 1 },
  dmr: { dmg: 52, rpm: 330, headMult: 2.2, moveMul: 0.96 },
  bullpup: { dmg: 20, rpm: 860, moveMul: 1.02 },
  smg: { dmg: 21, rpm: 950, moveMul: 1.06 },
  kv: { dmg: 17, rpm: 1200, moveMul: 1.06 },
  mp: { dmg: 17, rpm: 1100, moveMul: 1.08 },
  shotgun: { dmg: 13, pellets: 10, rpm: 85, moveMul: 1 },
  autoshotgun: { dmg: 9, pellets: 8, rpm: 210, mag: 8, moveMul: 0.95 },
  double: { dmg: 11, pellets: 12, rpm: 240, moveMul: 1.02 },
  sniper: { dmg: 110, headMult: 2.3, rpm: 48, moveMul: 0.94 },
  lever: { dmg: 72, rpm: 140, headMult: 1.9, moveMul: 0.98 },
  lmg: { dmg: 24, rpm: 620, mag: 100, moveMul: 0.9 },
  minigun: { dmg: 10, rpm: 1300, mag: 200, spin: 0.7, moveMul: 0.82,
    spread: { base: 0.02, move: 0.04, air: 0.05, bloom: 0.0015, bloomMax: 0.035, ads: 0.7 } },
  pistol: { dmg: 26, rpm: 400, moveMul: 1.08 },
  revolver: { dmg: 64, rpm: 150, headMult: 2, moveMul: 1.06 },
};
for (const [id, b] of Object.entries(BALANCE)) Object.assign(WEAPONS[id], b);

export const CASE_ORDER = ['ar', 'burst', 'dmr', 'bullpup', 'smg', 'kv', 'mp', 'shotgun', 'autoshotgun', 'double', 'sniper', 'lever', 'lmg', 'minigun', 'pistol', 'revolver'];
