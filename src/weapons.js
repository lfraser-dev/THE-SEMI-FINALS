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
      P('feedCover', [0, 0.066, 0.02], [0.084, 0.018, 0.2], DARK2, { m: 'metal' }),
      P('coverLatch', [0, 0.07, 0.125], [0.05, 0.014, 0.02], BLACK, { m: 'metal' }),
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
      P('frontPost', [0, 0.065, -0.49], [0.006, 0.04, 0.012], BLACK, { m: 'metal' }),
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

export const CASE_ORDER = ['ar', 'smg', 'shotgun', 'sniper', 'lmg', 'pistol'];
