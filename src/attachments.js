// Weapon attachments. Each attachment changes stats and adds/edits box parts on the gun model.
// buildDef(base, loadout) returns a new weapon definition with everything applied.

const BLACK = [0.1, 0.1, 0.11];
const DARK = [0.2, 0.2, 0.22];
const GREY = [0.45, 0.46, 0.49];
const RED = [0.95, 0.12, 0.1];
const TAN = [0.55, 0.47, 0.35];
const LENS = [0.45, 0.7, 1];

export const SLOTS = [
  { id: 'optic', name: 'OPTIC' },
  { id: 'muzzle', name: 'MUZZLE' },
  { id: 'barrel', name: 'BARREL' },
  { id: 'underbarrel', name: 'UNDERBARREL' },
  { id: 'side', name: 'SIDE RAIL' },
  { id: 'magazine', name: 'MAGAZINE' },
  { id: 'stock', name: 'STOCK' },
  { id: 'ammo', name: 'AMMO' },
];

// Per-weapon mounting points (gun-local space, metres; -Z forward)
const MOUNT = {
  ar: { railY: 0.068, railZ: 0.0, sight: ['sightL', 'sightR', 'sightTop', 'dot'], muzzle: ['muzzle'], stock: ['stock'],
    under: { y: -0.043, z: -0.25 }, laser: [0.044, -0.004, -0.27] },
  smg: { railY: 0.059, railZ: 0.0, sight: ['sightL', 'sightR', 'sightTop', 'dot'], muzzle: ['muzzle'], stock: ['stock', 'stockpad'],
    under: { y: -0.045, z: -0.15, hide: ['fgrip'] }, laser: [0.04, -0.01, -0.13] },
  shotgun: { railY: 0.05, railZ: 0.0, rail: true, sight: ['rear'], muzzle: [], stock: ['stock'], shiftAlso: ['bead'],
    laser: [0.046, 0.0, -0.22] },
  sniper: { railY: 0.045, railZ: -0.02, sight: ['scope', 'scopeF', 'ring1', 'ring2', 'lens'], muzzle: ['brake'], stock: ['stock', 'cheek'],
    under: { y: -0.002, z: -0.3 }, laser: [0.04, 0.0, -0.26] },
  lmg: { railY: 0.08, railZ: 0.06, sight: ['sightL', 'sightR', 'sightTop', 'dot'], muzzle: [], stock: ['stock'],
    under: { y: -0.025, z: -0.3, hide: ['bipod'] }, laser: [0.05, 0.0, -0.34] },
  pistol: { railY: 0.05, railZ: 0.02, sight: ['front', 'rearL', 'rearR'], muzzle: [], stock: [], barrelFront: -0.11,
    laser: [0, -0.034, -0.075] },
  // the bespoke guns
  burst: { railY: 0.07, railZ: 0.0, sight: ['sightL', 'sightR', 'sightTop', 'dot'], muzzle: ['muzzle'], stock: ['stock'],
    under: { y: -0.024, z: -0.28 }, laser: [0.042, -0.006, -0.32] },
  dmr: { railY: 0.064, railZ: 0.0, sight: ['frontPost', 'frontEarL', 'frontEarR', 'rearAp', 'rearHole'], muzzle: ['muzzle', 'lug'], stock: ['stock'], shiftAlso: ['frontPost', 'frontEarL', 'frontEarR', 'frontBase'],
    under: { y: -0.034, z: -0.3 }, laser: [0.036, 0.0, -0.32] },
  bullpup: { railY: 0.07, railZ: -0.02, sight: ['scope', 'scopeBase', 'scopeBell', 'scopeLens', 'scopeDot'], muzzle: ['muzzle'], stock: [],
    under: { y: -0.042, z: -0.25, hide: ['fgrip'] }, laser: [0.04, 0.0, -0.22] },
  kv: { railY: 0.056, railZ: -0.04, sight: ['flipF', 'flipR', 'flipRL', 'flipRR'], muzzle: ['muzzle'], stock: ['stock', 'stockLow', 'stockPad'],
    under: { y: -0.085, z: -0.2 }, laser: [0.034, -0.01, -0.21] },
  mp: { railY: 0.062, railZ: -0.02, sight: ['front', 'rearL', 'rearR'], muzzle: ['thread'], stock: [], barrelFront: -0.185,
    laser: [0.022, 0.0, -0.13] },
  revolver: { railY: 0.058, railZ: -0.1, sight: ['front', 'rearL', 'rearR'], muzzle: [], stock: [], barrelFront: -0.215,
    laser: [0, -0.004, -0.15] },
  autoshotgun: { railY: 0.12, railZ: -0.02, rail: true, sight: ['rear', 'frontPost'], muzzle: ['brake'], stock: ['stock'],
    laser: [0.046, -0.02, -0.26] },
  double: { railY: 0.05, railZ: 0.03, rail: true, sight: [], muzzle: [], stock: ['stock'], laser: [0.034, -0.012, -0.22] },
  lever: { railY: 0.06, railZ: -0.05, rail: true, sight: ['rearSight', 'rearNotch'], muzzle: [], stock: ['stock'], shiftAlso: ['front', 'band'],
    under: { y: -0.016, z: -0.3 }, laser: [0.03, -0.004, -0.26] },
  minigun: { railY: 0.124, railZ: -0.08, rail: true, sight: [], muzzle: [], stock: [], laser: [0.07, 0.03, -0.24] },
  gl: { railY: 0.1, railZ: 0.0, sight: [], muzzle: [], stock: ['stock'], laser: [0.04, 0.0, -0.2] },
  tg: { railY: 0.06, railZ: 0.0, sight: [], muzzle: [], stock: ['brace'], laser: [0.03, 0.0, -0.15] },
  // build 0.39
  hx17: { railY: 0.071, railZ: 0.0, sight: ['flipF', 'flipR'], muzzle: ['muzzle'], stock: ['stock'],
    under: { y: 0.007, z: -0.24 }, laser: [0.044, 0.025, -0.24] },
  zu9: { railY: 0.053, railZ: -0.04, rail: true, sight: ['front', 'frontEarL', 'frontEarR', 'rearL', 'rearR'], muzzle: ['muzzle'], stock: ['stock', 'stockArmT', 'stockArmB'],
    under: { y: -0.02, z: -0.13 }, laser: [0.036, 0.0, -0.1] },
  amr: { railY: 0.068, railZ: -0.02, sight: ['scope', 'scopeF', 'scopeEye', 'lens', 'turret', 'turretS', 'ring1', 'ring2'], muzzle: ['brake'], stock: ['stock', 'cheek'],
    under: { y: -0.013, z: -0.33, hide: ['bipodBase'] }, laser: [0.044, 0.02, -0.3] },
  rt7: { railY: 0.058, railZ: 0.0, sight: ['rear', 'frontPost'], muzzle: ['brake'], stock: ['stock'], laser: [0.046, 0.01, -0.27] },
  hc50: { railY: 0.068, railZ: -0.01, sight: ['front', 'frontDot', 'rearL', 'rearR'], muzzle: [], stock: [], barrelFront: -0.157, laser: [0, -0.035, -0.085] },
  rk74: { railY: 0.063, railZ: 0.04, rail: true, sight: ['rearSight', 'frontPost'], muzzle: ['muzzle'], stock: ['stock'], shiftAlso: ['frontBase', 'frontPost', 'bipodBase', 'bipodLegL', 'bipodLegR'],
    under: { y: -0.025, z: -0.25, hide: ['bipodBase'] }, laser: [0.036, 0.0, -0.27] },
  // build 0.52
  kr45: { railY: 0.062, railZ: -0.02, sight: ['sightL', 'sightR', 'sightTop', 'dot'], muzzle: ['muzzle'], stock: ['stock', 'stockpad'],
    under: { y: -0.075, z: -0.17 }, laser: [0.032, 0.0, -0.15] },
  pdx: { railY: 0.092, railZ: -0.02, sight: ['sightL', 'sightR', 'sightTop', 'dot'], muzzle: ['muzzle'], stock: [],
    under: { y: -0.11, z: -0.19, hide: ['frontLip', 'frontHole'] }, laser: [0.034, -0.02, -0.18] },
  rg1: { railY: 0.045, railZ: -0.02, sight: ['scope', 'scopeF', 'ring1', 'ring2', 'lens'], muzzle: ['brake'], stock: ['stock', 'battery'],
    under: { y: -0.08, z: -0.3, hide: ['fgrip'] }, laser: [0.05, 0.0, -0.26] },
  bruiser: { railY: 0.092, railZ: 0.09, sight: ['sightL', 'sightR', 'sightTop', 'dot'], muzzle: ['muzzle'], stock: ['stock'],
    under: { y: -0.03, z: -0.32, hide: ['fgrip', 'fgripClamp'] }, laser: [0.055, 0.0, -0.36] },
  cr56: { railY: 0.066, railZ: 0.01, sight: ['sightL', 'sightR', 'sightTop', 'dot'], muzzle: ['muzzle'], stock: ['stock'],
    under: { y: -0.025, z: -0.24 }, laser: [0.04, -0.004, -0.27] },
  slug: { railY: 0.076, railZ: 0.0, sight: ['sightL', 'sightR', 'sightTop', 'dot'], muzzle: ['muzzle'], stock: ['stock'],
    under: { y: -0.032, z: -0.3 }, laser: [0.042, 0.0, -0.3] },
  bx9: { railY: 0.05, railZ: 0.02, sight: ['front', 'rearL', 'rearR'], muzzle: [], stock: [], barrelFront: -0.145,
    laser: [0, -0.034, -0.075] },
};
// slots a gun simply doesn't have
const NO_SLOT = { pdx: ['stock'], bx9: ['stock'], gl: ['optic', 'muzzle', 'barrel', 'underbarrel', 'side', 'magazine', 'stock', 'ammo'], tg: ['optic', 'muzzle', 'barrel', 'underbarrel', 'side', 'magazine', 'stock', 'ammo'], bullpup: ['stock'], double: ['magazine', 'barrel', 'muzzle'], lever: ['magazine'], minigun: ['barrel', 'muzzle', 'underbarrel', 'stock'] };

// Base effective range (m) before damage falls off
export const RANGE = { ar: 35, smg: 16, shotgun: 9, sniper: 120, lmg: 40, pistol: 20, burst: 45, dmr: 65, mp: 13, revolver: 30, autoshotgun: 8,
  kv: 14, bullpup: 30, lever: 70, minigun: 26, double: 10, hx17: 50, zu9: 13, amr: 140, rt7: 9, hc50: 28, rk74: 38,
  kr45: 14, pdx: 18, rg1: 150, bruiser: 45, cr56: 32, slug: 30, bx9: 14 };

// variants take the attachments (and mounting points) of the gun they're built on
export const STYLE = { burst: 'ar', dmr: 'ar', mp: 'pistol', revolver: 'pistol', autoshotgun: 'shotgun',
  kv: 'smg', bullpup: 'ar', lever: 'sniper', minigun: 'lmg', double: 'shotgun',
  gl: 'ar', tg: 'ar', hx17: 'ar', zu9: 'smg', amr: 'sniper', rt7: 'shotgun', hc50: 'pistol', rk74: 'lmg',
  kr45: 'smg', pdx: 'smg', rg1: 'sniper', bruiser: 'lmg', cr56: 'ar', slug: 'shotgun', bx9: 'pistol' };
const styleOf = (id) => STYLE[id] || id;

const P = (name, c, s, col, extra = {}) => ({ name, c, s, col, ...extra });
const H = Math.PI / 2;

// who takes what (by style)
const LONG = ['ar', 'smg', 'lmg', 'sniper'];
const AUTO = ['ar', 'smg', 'lmg'];
const NOSG = ['ar', 'smg', 'lmg', 'sniper', 'pistol'];
const SG = ['shotgun'];
const NOPI = ['ar', 'smg', 'lmg', 'sniper', 'shotgun'];

// ---------------------------------------------------------------- attachment list
// mods are multipliers (dmg, rpm, range, recoilUp/Side, spreadBase/Move, adsSpread, hipSpread, adsSpeed, mag, reload, gain, flash, headMult).
// `for` = 'all' or the gun styles that accept it. `tier` is just for the menu colour.
export const ATTACHMENTS = {
  // ---- optics: open sights (window + reticle) and tube scopes
  reddot: { slot: 'optic', name: 'MINI RED DOT', desc: 'Tiny, fast, barely there.', for: ['shotgun', 'sniper', 'pistol', 'smg'],
    optic: { h: 0.018, zoom: 0.86, kind: 'mini' }, mods: { adsSpeed: 1.04 } },
  holo: { slot: 'optic', name: 'HOLO SIGHT', desc: 'Wide window with a ring reticle.', for: NOPI,
    optic: { h: 0.032, zoom: 0.82, kind: 'holo' }, mods: { adsSpeed: 0.97 } },
  reflex: { slot: 'optic', name: 'REFLEX SIGHT', desc: 'Big open lens with a chevron. Great awareness.', for: NOPI,
    optic: { h: 0.034, zoom: 0.84, kind: 'reflex' }, mods: { adsSpeed: 0.98 } },
  kobra: { slot: 'optic', name: 'KOBRA 1.25×', desc: 'Side-mounted rail sight, a touch of zoom.', for: LONG,
    optic: { h: 0.036, zoom: 0.72, kind: 'kobra' }, mods: { adsSpeed: 0.93, adsSpread: 0.92 } },
  prism2x: { slot: 'optic', name: '2× PRISM', desc: 'Mid-range magnification.', for: LONG,
    optic: { h: 0.034, zoom: 0.52, eye: 0.17, kind: 'prism' }, mods: { adsSpeed: 0.85, adsSpread: 0.85 } },
  acog3x: { slot: 'optic', name: '3× COMBAT SCOPE', desc: 'Short rugged scope with a fibre-optic top.', for: LONG,
    optic: { h: 0.04, zoom: 0.4, scope: true, kind: 'tube', len: 0.13, d: 0.036, bell: 0.044 }, mods: { adsSpeed: 0.78, adsSpread: 0.78 } },
  scope4x: { slot: 'optic', name: '4× SCOPE', desc: 'Long-range scope with a full overlay.', for: LONG,
    optic: { h: 0.048, zoom: 0.3, scope: true, kind: 'tube', len: 0.24, d: 0.04, bell: 0.056 }, mods: { adsSpeed: 0.7, adsSpread: 0.7 } },
  scope6x: { slot: 'optic', name: '6× SCOPE', desc: 'Picks heads off at the far wall.', for: ['ar', 'lmg', 'sniper'],
    optic: { h: 0.052, zoom: 0.2, scope: true, kind: 'tube', len: 0.29, d: 0.042, bell: 0.064 }, mods: { adsSpeed: 0.6, adsSpread: 0.6 } },
  aimpoint: { slot: 'optic', name: 'TUBE RED DOT', desc: 'A short open tube with a crisp dot. Quick and tidy.', for: NOPI,
    optic: { h: 0.04, zoom: 0.84, kind: 'aimpoint' }, mods: { adsSpeed: 1.01, adsSpread: 0.96 } },
  pistoldot: { slot: 'optic', name: 'PISTOL RED DOT', desc: 'Slide-mounted dot. Easier to track a target.', for: ['pistol'],
    optic: { h: 0.02, zoom: 0.86, kind: 'mini' }, mods: { adsSpread: 0.86, adsSpeed: 0.97 } },
  hybrid: { slot: 'optic', name: 'HOLO + MAGNIFIER', desc: 'Holo sight with a 3× magnifier flipped to the side.', for: LONG,
    optic: { h: 0.032, zoom: 0.6, kind: 'hybrid' }, mods: { adsSpeed: 0.88, adsSpread: 0.84 } },
  lpvo: { slot: 'optic', name: '1–6× LPVO', desc: 'Variable scope: close-ish to long. Middle of the road on speed.', for: LONG,
    optic: { h: 0.044, zoom: 0.36, scope: true, kind: 'tube', len: 0.2, d: 0.036, bell: 0.046 }, mods: { adsSpeed: 0.75, adsSpread: 0.74 } },
  scope12x: { slot: 'optic', name: '12× MARKSMAN SCOPE', desc: 'The biggest glass there is. Very slow, very far.', for: ['sniper'],
    optic: { h: 0.062, zoom: 0.1, scope: true, kind: 'tube', len: 0.38, d: 0.046, bell: 0.08 }, mods: { adsSpeed: 0.42, adsSpread: 0.45 } },
  scope8x: { slot: 'optic', name: '8× SNIPER SCOPE', desc: 'Huge glass. Slow to bring up, deadly once you do.', for: ['sniper', 'ar'],
    optic: { h: 0.058, zoom: 0.14, scope: true, kind: 'tube', len: 0.34, d: 0.044, bell: 0.074 }, mods: { adsSpeed: 0.5, adsSpread: 0.5 } },
  // ---- muzzle
  suppressor: { slot: 'muzzle', name: 'SUPPRESSOR', desc: 'Quiet shots, no muzzle flash, a little less range.', for: 'all',
    muz: { d: 0.044, len: 0.18, col: [0.16, 0.16, 0.17], rings: true }, mods: { recoilUp: 0.9, recoilSide: 0.9, range: 0.88, gain: 0.35, flash: 0, adsSpeed: 0.95 } },
  heavysup: { slot: 'muzzle', name: 'HEAVY SUPPRESSOR', desc: 'Near-silent and steady, but long and heavy.', for: NOSG,
    muz: { d: 0.052, len: 0.27, col: [0.3, 0.27, 0.2], rings: true }, mods: { recoilUp: 0.82, recoilSide: 0.85, range: 0.95, gain: 0.25, flash: 0, adsSpeed: 0.86 } },
  compensator: { slot: 'muzzle', name: 'COMPENSATOR', desc: 'Cuts sideways recoil.', for: NOSG,
    muz: { d: 0.036, len: 0.06, ports: 'top' }, mods: { recoilSide: 0.55, flash: 1.3, gain: 1.1 } },
  brake: { slot: 'muzzle', name: 'MUZZLE BRAKE', desc: 'Cuts vertical recoil. Loud.', for: NOSG,
    muz: { d: 0.05, h: 0.04, len: 0.075, ports: 'side' }, mods: { recoilUp: 0.75, flash: 1.5, gain: 1.25 } },
  flashhider: { slot: 'muzzle', name: 'FLASH HIDER', desc: 'Kills the flash so you can see what you hit.', for: NOSG,
    muz: { d: 0.034, len: 0.07, prongs: true }, mods: { flash: 0.15, recoilUp: 0.96 } },
  linear: { slot: 'muzzle', name: 'LINEAR COMP', desc: 'Pushes the blast forward. Balanced recoil, mid range.', for: AUTO,
    muz: { d: 0.042, len: 0.07, col: [0.62, 0.6, 0.55] }, mods: { recoilUp: 0.88, recoilSide: 0.82, gain: 1.05 } },
  compactsup: { slot: 'muzzle', name: 'COMPACT SUPPRESSOR', desc: 'Short can: mostly quiet, barely slows you down.', for: 'all',
    muz: { d: 0.04, len: 0.12, col: [0.22, 0.22, 0.24], rings: true }, mods: { recoilUp: 0.95, range: 0.92, gain: 0.45, flash: 0, adsSpeed: 0.98 } },
  monocore: { slot: 'muzzle', name: 'MONOCORE SUPPRESSOR', desc: 'Long tan can. Silent, keeps its range, cuts side kick.', for: NOSG,
    muz: { d: 0.038, len: 0.22, col: [0.52, 0.43, 0.28], rings: true }, mods: { recoilSide: 0.86, gain: 0.3, flash: 0, adsSpeed: 0.9 } },
  tripleport: { slot: 'muzzle', name: 'TRIPLE-PORT BRAKE', desc: 'Three rows of ports. Kills muzzle climb. Very loud.', for: NOSG,
    muz: { d: 0.048, h: 0.044, len: 0.09, ports: 'side3' }, mods: { recoilUp: 0.68, recoilSide: 0.92, flash: 1.7, gain: 1.35 } },
  choke: { slot: 'muzzle', name: 'FULL CHOKE', desc: 'Tighter pellet spread, more range.', for: SG,
    muz: { d: 0.046, len: 0.055 }, mods: { spreadBase: 0.62, range: 1.3 } },
  duckbill: { slot: 'muzzle', name: 'DUCKBILL', desc: 'Spreads pellets in a wide flat line. Brutal up close.', for: SG,
    muz: { d: 0.07, h: 0.02, len: 0.06 }, mods: { spreadBase: 1.35, range: 0.85, dmg: 1.12 } },
  // ---- barrel
  longbarrel: { slot: 'barrel', name: 'LONG BARREL', desc: 'More range and accuracy, slower to aim.', for: NOPI,
    barrel: { add: 0.13 }, mods: { range: 1.35, spreadBase: 0.8, adsSpeed: 0.9, recoilUp: 0.92 } },
  cqbbarrel: { slot: 'barrel', name: 'CQB BARREL', desc: 'Snappier and better on the move, less range.', for: NOPI,
    barrel: { mul: 0.58 }, mods: { range: 0.75, spreadMove: 0.7, adsSpeed: 1.15, recoilUp: 1.1 } },
  heavybarrel: { slot: 'barrel', name: 'HEAVY BARREL', desc: 'Thick and stiff: hits harder at range, kills your handling.', for: LONG,
    barrel: { add: 0.06, thick: 1.45 }, mods: { range: 1.25, dmg: 1.08, recoilUp: 0.88, adsSpeed: 0.82, spreadMove: 1.2 } },
  fluted: { slot: 'barrel', name: 'FLUTED BARREL', desc: 'Light and cool-running. Small all-round gains.', for: LONG,
    barrel: { add: 0.06, fins: true }, mods: { range: 1.12, adsSpeed: 1.05, spreadBase: 0.92 } },
  matchbarrel: { slot: 'barrel', name: 'MATCH BARREL', desc: 'Precision bore. Pinpoint first shots.', for: ['ar', 'sniper'],
    barrel: { add: 0.1, col: [0.55, 0.56, 0.6] }, mods: { spreadBase: 0.6, range: 1.2, adsSpeed: 0.92, rpm: 0.94 } },
  carbonbarrel: { slot: 'barrel', name: 'CARBON BARREL', desc: 'Carbon-wrapped and light. Faster aiming, a touch more range.', for: NOPI,
    barrel: { add: 0.04, col: [0.12, 0.12, 0.13] }, mods: { adsSpeed: 1.12, range: 1.06, recoilUp: 1.04 } },
  sbr: { slot: 'barrel', name: 'SHORT BARREL', desc: 'Cut down for corners. Handles fast, loses some reach.', for: NOPI,
    barrel: { mul: 0.75 }, mods: { range: 0.85, adsSpeed: 1.08, spreadMove: 0.85 } },
  // ---- underbarrel
  vgrip: { slot: 'underbarrel', name: 'VERTICAL GRIP', desc: 'Steadier vertical recoil.', for: LONG,
    grip: 'v', mods: { recoilUp: 0.8, adsSpeed: 0.95 } },
  agrip: { slot: 'underbarrel', name: 'ANGLED GRIP', desc: 'Faster aiming.', for: AUTO,
    grip: 'a', mods: { adsSpeed: 1.22, recoilUp: 0.94 } },
  stubby: { slot: 'underbarrel', name: 'STUBBY GRIP', desc: 'Short grip: steadier on the move.', for: LONG,
    grip: 's', mods: { spreadMove: 0.72, recoilUp: 0.92 } },
  handstop: { slot: 'underbarrel', name: 'HANDSTOP', desc: 'Keeps your hand forward. Less side-to-side kick.', for: LONG,
    grip: 'h', mods: { recoilSide: 0.72, adsSpeed: 1.04 } },
  ergogrip: { slot: 'underbarrel', name: 'ERGO GRIP', desc: 'Grooved grip that does a bit of everything.', for: AUTO,
    grip: 'e', mods: { recoilUp: 0.9, recoilSide: 0.9, adsSpeed: 1.06 } },
  bipod: { slot: 'underbarrel', name: 'BIPOD', desc: 'Folded legs. Clamps recoil down, slow to swing.', for: ['ar', 'lmg', 'sniper'],
    grip: 'b', mods: { recoilUp: 0.7, recoilSide: 0.75, adsSpeed: 0.85, spreadMove: 1.15 } },
  pgrip: { slot: 'underbarrel', name: 'PISTOL FOREGRIP', desc: 'Raked-back grip. Tames both kinds of recoil a little.', for: LONG,
    grip: 'p', mods: { recoilSide: 0.8, recoilUp: 0.9, adsSpeed: 0.97 } },
  fgrip: { slot: 'underbarrel', name: 'FOLDING GRIP', desc: 'Folded flat. Light, quick, steadier on the move.', for: LONG,
    grip: 'f', mods: { adsSpeed: 1.12, spreadMove: 0.85 } },
  // ---- side rail
  laser: { slot: 'side', name: 'RED LASER', desc: 'Tighter hip-fire. Shows a red beam.', for: 'all',
    side: { laser: [1, 0.12, 0.08] }, mods: { hipSpread: 0.68 } },
  greenlaser: { slot: 'side', name: 'GREEN LASER', desc: 'Brighter, tighter hip-fire, a bit slower to aim.', for: 'all',
    side: { laser: [0.2, 1, 0.3] }, mods: { hipSpread: 0.58, adsSpeed: 0.96 } },
  flashlight: { slot: 'side', name: 'TACTICAL LIGHT', desc: 'A bright torch. Faster to aim from the hip.', for: 'all',
    side: { light: true }, mods: { adsSpeed: 1.06, hipSpread: 0.9 } },
  combo: { slot: 'side', name: 'LASER-LIGHT COMBO', desc: 'Laser and light in one block. Heavy.', for: NOPI,
    side: { laser: [1, 0.12, 0.08], light: true }, mods: { hipSpread: 0.62, adsSpeed: 0.97 } },
  irlaser: { slot: 'side', name: 'IR LASER', desc: 'A faint violet beam. Tighter hip-fire, quick to aim.', for: 'all',
    side: { laser: [0.65, 0.25, 1] }, mods: { hipSpread: 0.74, adsSpeed: 1.03 } },
  rangefinder: { slot: 'side', name: 'RANGEFINDER', desc: 'Laser rangefinder: steadier aim and a bit more range.', for: NOPI,
    side: { laser: [1, 0.6, 0.1] }, mods: { adsSpread: 0.9, range: 1.05, hipSpread: 0.85 } },
  // ---- magazine
  extmag: { slot: 'magazine', name: 'EXTENDED MAG', desc: 'More rounds, slightly slower reload.', for: 'all',
    mods: { mag: 1.5, reload: 1.12, adsSpeed: 0.96 } },
  fastmag: { slot: 'magazine', name: 'FAST MAG', desc: 'Much quicker reloads.', for: 'all',
    mods: { reload: 0.72 } },
  drum: { slot: 'magazine', name: 'DRUM MAG', desc: 'Huge capacity, heavy and slow.', for: AUTO,
    mods: { mag: 2.2, reload: 1.4, adsSpeed: 0.85 } },
  coupler: { slot: 'magazine', name: 'MAG COUPLER', desc: 'Two mags taped together: flip them for a lightning reload.', for: ['ar', 'smg'],
    mods: { reload: 0.62, adsSpeed: 0.94 } },
  lightmag: { slot: 'magazine', name: 'POLYMER MAG', desc: 'Lighter mag, quicker handling, a few rounds less.', for: NOSG,
    mods: { mag: 0.8, adsSpeed: 1.1, reload: 0.9 } },
  quadmag: { slot: 'magazine', name: 'QUAD-STACK MAG', desc: 'Four columns of rounds. Huge, heavy, slow to swap.', for: AUTO,
    mods: { mag: 1.8, reload: 1.22, adsSpeed: 0.9 } },
  speedmag: { slot: 'magazine', name: 'RAPID MAG', desc: 'Pull-loop and a slick follower. Faster reloads, fewer rounds.', for: 'all',
    mods: { reload: 0.8, mag: 0.9 } },
  // ---- stock
  lightstock: { slot: 'stock', name: 'LIGHT STOCK', desc: 'Quicker handling, a bit more recoil.', for: NOPI,
    mods: { adsSpeed: 1.15, recoilUp: 1.1, spreadMove: 0.85 } },
  heavystock: { slot: 'stock', name: 'HEAVY STOCK', desc: 'Soaks up recoil, slower to aim.', for: NOPI,
    mods: { recoilUp: 0.85, recoilSide: 0.85, adsSpeed: 0.9 } },
  nostock: { slot: 'stock', name: 'NO STOCK', desc: 'Very fast handling, wild recoil.', for: ['ar', 'smg', 'shotgun'],
    mods: { adsSpeed: 1.35, recoilUp: 1.35, recoilSide: 1.3, spreadMove: 0.75 } },
  paddedstock: { slot: 'stock', name: 'PADDED STOCK', desc: 'Thick recoil pad: big kick reduction.', for: NOPI,
    mods: { recoilUp: 0.78, adsSpeed: 0.94, spreadMove: 1.06 } },
  foldstock: { slot: 'stock', name: 'FOLDING STOCK', desc: 'Skeleton bars. Fast on the move.', for: ['ar', 'smg', 'shotgun'],
    mods: { spreadMove: 0.7, adsSpeed: 1.2, recoilUp: 1.18 } },
  cheekstock: { slot: 'stock', name: 'CHEEK RISER STOCK', desc: 'Raised cheek rest. Steadier when aiming.', for: NOPI,
    mods: { adsSpread: 0.88, adsSpeed: 0.95, recoilUp: 0.95 } },
  tacstock: { slot: 'stock', name: 'TACTICAL STOCK', desc: 'Adjustable, padded. Steadier on the move and on the trigger.', for: NOPI,
    mods: { recoilUp: 0.9, spreadMove: 0.9, adsSpeed: 1.02 } },
  // ---- ammo (no model: a coloured band on the mag)
  hollowpoint: { slot: 'ammo', name: 'HOLLOW POINT', desc: 'Hits much harder up close, falls off fast.', for: 'all',
    ammo: [1, 0.5, 0.1], mods: { dmg: 1.15, range: 0.7 } },
  armorpiercing: { slot: 'ammo', name: 'ARMOUR PIERCING', desc: 'Keeps its punch at range. Less on headshots.', for: NOSG,
    ammo: [0.3, 0.3, 0.32], mods: { range: 1.3, headMult: 0.88 } },
  subsonic: { slot: 'ammo', name: 'SUBSONIC', desc: 'Quieter and softer to shoot. Less range.', for: NOSG,
    ammo: [0.3, 0.5, 1], mods: { gain: 0.6, recoilUp: 0.88, range: 0.8 } },
  highvel: { slot: 'ammo', name: 'HIGH VELOCITY', desc: 'Flatter, further. Bigger kick.', for: NOSG,
    ammo: [1, 0.85, 0.1], mods: { range: 1.4, recoilUp: 1.12 } },
  matchammo: { slot: 'ammo', name: 'MATCH GRADE', desc: 'Consistent rounds: tighter spread, better headshots.', for: NOSG,
    ammo: [0.2, 0.9, 0.5], mods: { spreadBase: 0.8, headMult: 1.12, rpm: 0.95 } },
  incendiary: { slot: 'ammo', name: 'INCENDIARY', desc: 'Sets whoever you hit on fire: 12 damage a second for 3 s. Less range.', for: NOSG,
    ammo: [1, 0.35, 0.05], burn: { dps: 12, dur: 3 }, mods: { flash: 1.5, range: 0.9 } },
  tracer: { slot: 'ammo', name: 'TRACER', desc: 'See every shot land. A bit tighter from the hip.', for: NOSG,
    ammo: [0.4, 1, 0.3], mods: { hipSpread: 0.9, spreadBase: 0.95 } },
  flechette: { slot: 'ammo', name: 'FLECHETTE', desc: 'Steel darts: tighter, much further, a little less punch.', for: SG,
    ammo: [0.7, 0.8, 0.9], mods: { range: 1.5, dmg: 0.9, spreadBase: 0.85 } },
  slugs: { slot: 'ammo', name: 'SLUG ROUNDS', desc: 'One heavy slug instead of pellets. Accurate and far.', for: SG,
    ammo: [0.9, 0.9, 0.9], slug: true, mods: { range: 3.2 } },
  dragon: { slot: 'ammo', name: "DRAGON'S BREATH", desc: 'Spits a jet of flame: sets targets alight (18 a second for 2.5 s). Short range.', for: SG,
    ammo: [1, 0.3, 0.05], burn: { dps: 18, dur: 2.5 }, flame: true, mods: { flash: 2.2, range: 0.8 } },
};

export function optionsFor(weaponId, slot) {
  const st = styleOf(weaponId);
  if ((slot === 'barrel' || slot === 'stock') && st === 'pistol') return [];
  if (NO_SLOT[weaponId]?.includes(slot)) return [];
  return Object.entries(ATTACHMENTS)
    .filter(([, a]) => a.slot === slot && (a.for === 'all' || a.for.includes(weaponId) || a.for.includes(st)))
    .map(([id, a]) => ({ id, ...a }));
}

export function slotsFor(weaponId) {
  return SLOTS.filter((s) => optionsFor(weaponId, s.id).length > 0);
}

// where each slot sits on the gun (gun-local), for the gunsmith's labels
export function anchorsFor(def) {
  const m = MOUNT[def.id] || MOUNT[styleOf(def.id)], out = {};
  const part = (n) => def.parts.find((p) => p.name === n && !p.hidden);
  out.optic = [0, def.sightY ?? m.railY + 0.03, m.railZ];
  out.muzzle = [...def.muzzle];
  const b = part('barrel');
  out.barrel = b ? [0, b.c[1], b.c[2]] : [0, def.muzzle[1], def.muzzle[2] + 0.1];
  out.underbarrel = m.under ? [0, m.under.y - 0.03, m.under.z] : [...def.foreGrip];
  out.side = [...m.laser];
  out.magazine = [...def.magPos];
  const s = part(m.stock[0]) || part('stock');
  out.stock = s ? [0, s.c[1], s.c[2] + s.s[2] * 0.3] : [0, 0, 0.2];
  out.ammo = [def.magPos[0], def.magPos[1] - 0.05, def.magPos[2]];
  return out;
}

// ---------------------------------------------------------------- surfaces
// Attachments sit on the gun's real surfaces (not fixed heights), so nothing floats.
function bounds(p) {
  const h = [p.s[0] / 2, p.s[1] / 2, p.s[2] / 2], rx = p.rx || 0, ry = p.ry || 0, rz = p.rz || 0;
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) {
    let x = a * h[0], y = b * h[1], z = c * h[2], t;
    t = y * Math.cos(rx) - z * Math.sin(rx); z = y * Math.sin(rx) + z * Math.cos(rx); y = t;
    t = x * Math.cos(ry) + z * Math.sin(ry); z = -x * Math.sin(ry) + z * Math.cos(ry); x = t;
    t = x * Math.cos(rz) - y * Math.sin(rz); y = x * Math.sin(rz) + y * Math.cos(rz); x = t;
    const q = [x + p.c[0], y + p.c[1], z + p.c[2]];
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], q[i]); hi[i] = Math.max(hi[i], q[i]); }
  }
  return { lo, hi };
}
const RETICLE = /^(apDot|dot|hoDot|rdDot|rxChev|rxGlass|kbDot|kbDotV|prChev|prStadia|scopeDot|hoRing|sightGlassL|sightBtn)$/;
function surfaces(def) {
  const solid = () => def.parts.filter((p) => !p.hidden && !p.mag && !p.em && !RETICLE.test(p.name)).map((p) => ({ p, b: bounds(p) }));
  const over = (b, i, a0, a1) => b.lo[i] <= a1 && b.hi[i] >= a0;
  return {
    // highest point of the gun over a z window, near the centreline
    top(z0, z1, xr = 0.02) { let y = -1; for (const { b } of solid()) if (over(b, 2, z0, z1) && over(b, 0, -xr, xr)) y = Math.max(y, b.hi[1]); return y < -0.5 ? null : y; },
    // lowest point under a z window, near the centreline (but not below the y limit, e.g. the mag)
    bottom(z0, z1, xr = 0.02, yMin = -0.07) { let y = 1; for (const { b } of solid()) if (over(b, 2, z0, z1) && over(b, 0, -xr, xr) && b.lo[1] > yMin) y = Math.min(y, b.lo[1]); return y > 0.5 ? null : y; },
    // outermost point on the right-hand side at a height / z window
    side(y0, y1, z0, z1) { let x = -1; for (const { b } of solid()) if (over(b, 2, z0, z1) && over(b, 1, y0, y1) && b.hi[0] > 0) x = Math.max(x, b.hi[0]); return x < 0 ? null : x; },
    // the back of the receiver (ignoring the stock), at a height window
    rear(y0, y1, skip) { let z = -1; for (const { p, b } of solid()) if (!skip(p) && over(b, 1, y0, y1) && over(b, 0, -0.014, 0.014)) z = Math.max(z, b.hi[2]); return z < -0.5 ? null : z; },
  };
}

// ---------------------------------------------------------------- build
export function buildDef(base, loadout = {}) {
  const id = base.id, style = styleOf(id), m = MOUNT[id] || MOUNT[style];
  const def = {
    ...base,
    spread: { ...base.spread },
    recoil: { ...base.recoil },
    sound: { ...base.sound },
    muzzle: [...base.muzzle],
    magPos: [...base.magPos],
    foreGrip: [...base.foreGrip],
    parts: base.parts.map((p) => ({ ...p, c: [...p.c], s: [...p.s] })),
    range: RANGE[id] ?? RANGE[style],
    flashScale: 1,
    hipSpread: 1,
    laser: null,
    laserCol: null,
    loadout: { ...loadout },
  };
  const part = (name) => def.parts.find((p) => p.name === name);
  const hide = (names) => names.forEach((n) => { const p = part(n); if (p) p.hidden = true; });
  const hideGrp = (g) => def.parts.forEach((p) => { if (p.grp === g) p.hidden = true; });
  const add = (...ps) => def.parts.push(...ps);
  const A = (slot) => { const a = ATTACHMENTS[loadout[slot]]; return a && a.slot === slot && optionsFor(id, slot).some((o) => o.id === loadout[slot]) ? a : null; };
  const sid = (slot) => (A(slot) ? loadout[slot] : null);

  // stat multipliers
  const k = { adsSpeed: 1, adsSpread: 1, recoilUp: 1, recoilSide: 1, range: 1, gain: 1, flash: 1,
    spreadBase: 1, spreadMove: 1, hipSpread: 1, mag: 1, reload: 1, dmg: 1, rpm: 1, headMult: 1 };
  for (const slot of SLOTS) {
    const a = A(slot.id);
    if (a) for (const [key, v] of Object.entries(a.mods)) k[key] *= v;
  }

  // ---- barrel (first, since it moves the muzzle) ----
  const barrelA = A('barrel');
  const barrel = part('barrel');
  if (barrelA && barrel) {
    const bb = barrelA.barrel;
    const rear = barrel.c[2] + barrel.s[2] / 2;
    const oldLen = barrel.s[2], newLen = bb.add ? oldLen + bb.add : oldLen * bb.mul;
    barrel.s[2] = newLen;
    barrel.c[2] = rear - newLen / 2;
    if (bb.thick) { barrel.s[0] *= bb.thick; barrel.s[1] *= bb.thick; }
    if (bb.col) { barrel.col = bb.col; barrel.m = 'steel'; }
    const shift = newLen - oldLen;
    for (const n of [...m.muzzle, ...(m.shiftAlso || [])]) { const p = part(n); if (p) p.c[2] -= shift; }
    for (const p of def.parts) if (p.grp === 'muzzle') p.c[2] -= shift;
    def.muzzle[2] -= shift;
    if (bb.add) add(P('gasblock', [0, barrel.c[1] + 0.004, rear - newLen * 0.45], [0.036, 0.04, 0.03], DARK));
    if (bb.fins) for (let i = 0; i < 4; i++) add(P('flute', [0, barrel.c[1] + barrel.s[1] / 2, rear - newLen * (0.55 + i * 0.1)], [0.006, 0.006, 0.03], GREY, { m: 'steel' }));
  }

  // ---- muzzle device ----
  const muzA = A('muzzle'), muz = sid('muzzle');
  if (muzA) {
    hide(m.muzzle);
    hideGrp('muzzle');
    const b = part('barrel');
    const front = b ? b.c[2] - b.s[2] / 2 : (m.barrelFront ?? def.muzzle[2] + 0.02);
    const y = def.muzzle[1], mz = muzA.muz;
    const len = mz.len * (style === 'pistol' && muz === 'suppressor' ? 0.72 : 1);
    const dims = [mz.d, mz.h ?? mz.d, len];
    add(P(muz, [0, y, front - len / 2], dims, mz.col || DARK, { m: 'metal' }));
    if (mz.rings) {
      add(P('supRing', [0, y, front - 0.012], [dims[0] + 0.006, dims[1] + 0.006, 0.014], BLACK));
      add(P('supCap', [0, y, front - len + 0.006], [dims[0] + 0.004, dims[1] + 0.004, 0.012], BLACK));
      if (muz === 'heavysup') for (let i = 1; i < 4; i++) add(P('supBand', [0, y, front - len * i / 4], [dims[0] + 0.003, dims[1] + 0.003, 0.008], BLACK));
    }
    if (mz.ports === 'top') add(P('compPort', [0, y + dims[1] / 2, front - len / 2], [0.014, 0.004, 0.04], GREY));
    if (mz.ports === 'side3') for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) add(P('brakePort3', [sx * dims[0] / 2, y, front - len * (0.22 + i * 0.28)], [0.004, 0.026, 0.016], GREY));
    if (mz.ports === 'side') {
      add(P('brakeL', [-dims[0] / 2, y, front - len / 2], [0.004, 0.022, 0.05], GREY));
      add(P('brakeR', [dims[0] / 2, y, front - len / 2], [0.004, 0.022, 0.05], GREY));
    }
    if (mz.prongs) for (let i = 0; i < 4; i++) add(P('prong', [Math.cos(i * H + 0.78) * 0.016, y + Math.sin(i * H + 0.78) * 0.016, front - len - 0.012], [0.006, 0.006, 0.026], BLACK));
    def.muzzle[2] = front - len - 0.02;
  }

  // ---- optic ----
  const optA = A('optic');
  if (optA) {
    hide(m.sight);
    hideGrp('sight');
    const o = optA.optic, rz = m.railZ;
    // sit on whatever's really on top of the gun at the mount point (a rail, a carry handle, the receiver)
    const sf = surfaces(def);
    const top = sf.top(rz - 0.04, rz + 0.04) ?? m.railY;
    let ry = top;
    const h = ry + o.h;
    def.sightY = h;
    def.adsZoom = o.zoom;
    def.scope = !!o.scope;
    if (o.eye) def.adsZ = -o.eye;
    if (m.rail) { add(P('rail', [0, top + 0.005, rz], [0.03, 0.01, 0.14], BLACK, { m: 'metal' })); ry = top + 0.01; }
    if (o.kind === 'mini') {
      add(P('rdBase', [0, ry + 0.004, rz], [0.03, 0.008, 0.045], BLACK),
        P('rdL', [-0.014, h, rz + 0.01], [0.004, 0.024, 0.006], BLACK),
        P('rdR', [0.014, h, rz + 0.01], [0.004, 0.024, 0.006], BLACK),
        P('rdTop', [0, h + 0.013, rz + 0.01], [0.032, 0.004, 0.006], BLACK),
        P('rdDot', [0, h, rz + 0.012], [0.003, 0.003, 0.001], RED, { em: 1 }));
    } else if (o.kind === 'aimpoint') {
      // a short open tube (twelve rim staves) on a riser, with turret caps
      const r = 0.021, L = 0.05;
      add(P('apBase', [0, ry + 0.005, rz], [0.03, 0.01, 0.05], BLACK, { m: 'metal' }),
        P('apRiser', [0, (ry + 0.01 + h - r) / 2, rz], [0.02, Math.max(0.004, h - r - ry - 0.008), 0.03], BLACK, { m: 'metal' }));
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        add(P('apRim', [Math.cos(a) * r, h + Math.sin(a) * r, rz - 0.005], [0.012, 0.007, L], DARK, { m: 'metal', rz: a + H }));
      }
      add(P('apKnob', [r + 0.008, h, rz + 0.005], [0.014, 0.014, 0.014], BLACK, { shape: 'cyl', ry: H, m: 'steel' }),
        P('apCap', [0, h + r + 0.008, rz + 0.005], [0.014, 0.014, 0.012], BLACK, { shape: 'cyl', rx: H, m: 'steel' }),
        P('apDot', [0, h, rz + 0.012], [0.003, 0.003, 0.001], RED, { em: 1 }));
    } else if (o.kind === 'holo' || o.kind === 'hybrid') {
      add(P('hoBase', [0, ry + 0.006, rz], [0.044, 0.012, 0.08], BLACK),
        P('hoL', [-0.023, (ry + 0.01 + h + 0.028) / 2, rz - 0.01], [0.005, h + 0.018 - ry, 0.055], DARK),
        P('hoR', [0.023, (ry + 0.01 + h + 0.028) / 2, rz - 0.01], [0.005, h + 0.018 - ry, 0.055], DARK),
        P('hoTop', [0, h + 0.025, rz - 0.01], [0.051, 0.006, 0.055], DARK),
        P('hoDot', [0, h, rz - 0.02], [0.0025, 0.0025, 0.001], RED, { em: 1 }));
      for (const [dx, dy, sx, sy] of [[0, 0.009, 0.007, 0.0016], [0, -0.009, 0.007, 0.0016], [0.009, 0, 0.0016, 0.007], [-0.009, 0, 0.0016, 0.007]]) {
        add(P('hoRing', [dx, h + dy, rz - 0.02], [sx, sy, 0.001], RED, { em: 1 }));
      }
      if (o.kind === 'hybrid') {
        // a 3× magnifier behind it, flipped out to the right on its hinge
        const mz = rz + 0.07;
        add(P('mgBase', [0, ry + 0.005, mz], [0.03, 0.01, 0.04], BLACK, { m: 'metal' }),
          P('mgHinge', [0.022, ry + 0.012, mz], [0.014, 0.024, 0.03], BLACK, { m: 'metal' }),
          P('mgTube', [0.046, ry + 0.03, mz], [0.036, 0.036, 0.07], BLACK, { shape: 'cyl', m: 'metal' }),
          P('mgEye', [0.046, ry + 0.03, mz + 0.04], [0.04, 0.04, 0.012], BLACK, { shape: 'cyl', m: 'rubber' }),
          P('mgLens', [0.046, ry + 0.03, mz - 0.036], [0.03, 0.03, 0.002], LENS, { em: 0.4, shape: 'cyl' }));
      }
    } else if (o.kind === 'reflex') {
      // a big round-ish lens frame on a short mount
      add(P('rxBase', [0, ry + 0.006, rz + 0.01], [0.034, 0.012, 0.05], BLACK, { m: 'metal' }));
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        add(P('rxRim', [Math.cos(a) * 0.028, h + Math.sin(a) * 0.028, rz - 0.01], [0.016, 0.016, 0.01], DARK, { m: 'metal', rz: a }));
      }
      add(P('rxChev', [0, h - 0.002, rz - 0.012], [0.004, 0.004, 0.001], [0.2, 1, 0.3], { em: 1 }),
        P('rxGlass', [0.0, h, rz - 0.016], [0.002, 0.04, 0.001], [0.4, 0.8, 0.6], { em: 0.15 }));
    } else if (o.kind === 'kobra') {
      // side-rail dovetail mount with a tall rectangular window
      add(P('kbArm', [0, ry + 0.006, rz], [0.05, 0.012, 0.07], BLACK, { m: 'metal' }),
        P('kbL', [-0.022, h, rz - 0.01], [0.006, 0.05, 0.03], DARK, { m: 'metal' }),
        P('kbR', [0.022, h, rz - 0.01], [0.006, 0.05, 0.03], DARK, { m: 'metal' }),
        P('kbTop', [0, h + 0.026, rz - 0.01], [0.05, 0.006, 0.03], DARK, { m: 'metal' }),
        P('kbBot', [0, h - 0.026, rz - 0.01], [0.05, 0.006, 0.03], DARK, { m: 'metal' }),
        P('kbDot', [0, h + 0.004, rz - 0.012], [0.004, 0.004, 0.001], RED, { em: 1 }),
        P('kbDotV', [0, h - 0.002, rz - 0.012], [0.0012, 0.008, 0.001], RED, { em: 1 }));
    } else if (o.kind === 'prism') {
      const L = 0.06, hw = 0.03, hh = 0.027;
      add(P('prBase', [0, ry + 0.005, rz], [0.036, 0.01, 0.07], BLACK, { m: 'metal' }),
        P('prL', [-hw - 0.003, h, rz], [0.006, hh * 2 + 0.006, L], DARK, { m: 'metal' }),
        P('prR', [hw + 0.003, h, rz], [0.006, hh * 2 + 0.006, L], DARK, { m: 'metal' }),
        P('prTop', [0, h + hh + 0.003, rz], [hw * 2 + 0.012, 0.006, L], DARK, { m: 'metal' }),
        P('prBot', [0, h - hh - 0.003, rz], [hw * 2 + 0.012, 0.006, L * 0.6], DARK, { m: 'metal' }),
        P('prBlock', [0, (ry + h - hh) / 2, rz + 0.01], [0.03, Math.max(0.004, h - hh - ry), 0.04], BLACK, { m: 'metal' }),
        P('prKnob', [hw + 0.01, h, rz + 0.01], [0.014, 0.014, 0.01], BLACK, { m: 'steel', shape: 'cyl', ry: H }),
        P('prRimF', [0, h + hh + 0.004, rz - L / 2], [hw * 2 + 0.016, 0.008, 0.008], BLACK, { m: 'rubber' }),
        P('prChev', [0, h - 0.002, rz - 0.02], [0.004, 0.004, 0.001], RED, { em: 1 }));
    } else if (o.kind === 'tube') {
      const L = o.len, d = o.d, bell = o.bell;
      add(P('scBody', [0, h, rz], [d, d, L], BLACK, { shape: 'cyl', m: 'metal' }),
        P('scBell', [0, h, rz - L / 2 - 0.02], [bell, bell, 0.05], BLACK, { shape: 'cyl', m: 'metal' }),
        P('scEye', [0, h, rz + L / 2], [d + 0.008, d + 0.008, 0.04], BLACK, { shape: 'cyl', m: 'rubber' }),
        P('scTurret', [0, h + d / 2 + 0.006, rz], [0.022, 0.016, 0.022], DARK, { shape: 'cyl', rx: H }),
        P('scTurretS', [d / 2 + 0.006, h, rz], [0.016, 0.022, 0.022], DARK, { shape: 'cyl', ry: H }),
        P('scRing1', [0, (ry + h) / 2, rz - Math.min(L * 0.25, 0.045)], [0.03, h - ry, 0.02], DARK),
        P('scRing2', [0, (ry + h) / 2, rz + Math.min(L * 0.25, 0.045)], [0.03, h - ry, 0.02], DARK),
        P('scLens', [0, h, rz - L / 2 - 0.046], [bell - 0.006, bell - 0.006, 0.002], LENS, { em: 0.6, shape: 'cyl' }));
      if (loadout.optic === 'acog3x') add(P('fibre', [0, h + d / 2 + 0.004, rz - 0.01], [0.006, 0.006, 0.07], [0.3, 1, 0.3], { em: 0.8 }));
      if (L > 0.3) add(P('scParallax', [-d / 2 - 0.006, h, rz - 0.02], [0.014, 0.02, 0.02], DARK, { shape: 'cyl', ry: H }));
    }
  }

  // ---- underbarrel ----
  const ubA = A('underbarrel');
  if (ubA && m.under) {
    const u0 = m.under;
    if (u0.hide) hide(u0.hide);
    hideGrp('under');
    const under = surfaces(def).bottom(u0.z - 0.012, u0.z + 0.012, 0.012, -0.09);
    const u = { ...u0, y: under ?? u0.y };
    const g = ubA.grip;
    if (g === 'v' || g === 'e') {
      add(P('vgrip', [0, u.y - 0.043, u.z], [0.03, 0.086, 0.032], BLACK, { m: 'rubber' }));
      if (g === 'e') for (let i = 0; i < 3; i++) add(P('groove', [0, u.y - 0.025 - i * 0.022, u.z - 0.017], [0.026, 0.008, 0.004], DARK));
      def.foreGrip = [0, u.y - 0.05, u.z];
    } else if (g === 's') {
      add(P('stubby', [0, u.y - 0.025, u.z], [0.032, 0.05, 0.034], BLACK, { m: 'rubber' }));
      def.foreGrip = [0, u.y - 0.035, u.z];
    } else if (g === 'a') {
      add(P('agrip', [0, u.y - 0.016, u.z + 0.02], [0.034, 0.026, 0.09], BLACK, { rx: 0.45 }));
      def.foreGrip = [0, u.y - 0.03, u.z + 0.03];
    } else if (g === 'h') {
      add(P('handstop', [0, u.y - 0.011, u.z], [0.026, 0.024, 0.02], BLACK, { rx: -0.3 }));
      def.foreGrip = [0, u.y - 0.02, u.z + 0.02];
    } else if (g === 'p') {
      add(P('pgripMount', [0, u.y - 0.006, u.z], [0.032, 0.014, 0.05], DARK, { m: 'metal' }),
        P('pgrip', [0, u.y - 0.04, u.z + 0.008], [0.03, 0.085, 0.036], BLACK, { m: 'rubber', rx: -0.3 }));
      def.foreGrip = [0, u.y - 0.05, u.z + 0.012];
    } else if (g === 'f') {
      add(P('fgHinge', [0, u.y - 0.009, u.z], [0.03, 0.018, 0.03], DARK, { m: 'metal' }),
        P('fgFold', [0, u.y - 0.026, u.z + 0.05], [0.028, 0.026, 0.09], BLACK, { m: 'rubber' }));
      def.foreGrip = [0, u.y - 0.03, u.z + 0.02];
    } else if (g === 'b') {
      add(P('bipodBase', [0, u.y - 0.009, u.z], [0.036, 0.02, 0.03], BLACK, { m: 'metal' }));
      for (const sx of [-1, 1]) add(P('bipodLeg', [sx * 0.012, u.y - 0.02, u.z + 0.09], [0.01, 0.01, 0.2], DARK, { m: 'metal', ry: sx * 0.05 }));
      def.foreGrip = [0, u.y - 0.03, u.z];
    }
  }

  // ---- side rail ----
  const sideA = A('side');
  if (sideA) {
    const sd = sideA.side, l0 = m.laser;
    const sx = surfaces(def).side(l0[1] - 0.012, l0[1] + 0.012, l0[2] - 0.035, l0[2] + 0.035);
    const half = sd.light && !sd.laser ? 0.015 : sd.light ? 0.015 : 0.013;
    const lp = [sx != null ? sx + half - 0.001 : l0[0], l0[1], l0[2]];
    if (sd.laser && sd.light) {
      add(P('comboBox', lp, [0.03, 0.03, 0.08], DARK, { m: 'metal' }),
        P('comboLens', [lp[0], lp[1] + 0.006, lp[2] - 0.041], [0.016, 0.016, 0.002], [1, 1, 0.9], { em: 1, shape: 'cyl' }),
        P('laserLens', [lp[0], lp[1] - 0.009, lp[2] - 0.041], [0.006, 0.006, 0.002], sd.laser, { em: 1 }));
    } else if (sd.laser) {
      add(P('laserBox', lp, [0.026, 0.026, 0.07], DARK),
        P('laserLens', [lp[0], lp[1], lp[2] - 0.036], [0.01, 0.01, 0.002], sd.laser, { em: 1 }));
    } else if (sd.light) {
      add(P('torch', [lp[0], lp[1], lp[2]], [0.03, 0.03, 0.09], BLACK, { shape: 'cyl', m: 'metal' }),
        P('torchHead', [lp[0], lp[1], lp[2] - 0.05], [0.038, 0.038, 0.02], BLACK, { shape: 'cyl', m: 'metal' }),
        P('torchLens', [lp[0], lp[1], lp[2] - 0.061], [0.032, 0.032, 0.002], [1, 1, 0.92], { em: 1, shape: 'cyl' }));
    }
    if (sd.laser) { def.laser = [lp[0], lp[1] - (sd.light ? 0.009 : 0), lp[2] - 0.04]; def.laserCol = sd.laser; }
  }

  // ---- magazine ----
  const mag = part('mag');
  const mg = sid('magazine');
  if (mg === 'extmag' || mg === 'drum' || mg === 'lightmag' || mg === 'quadmag') hideGrp('mag');
  if (mg === 'extmag') {
    if (style === 'shotgun' && !base.reload) {
      def.mag = base.mag + 2;
      const tube = part('tube');
      if (tube) { tube.s[2] *= 1.18; tube.c[2] -= tube.s[2] * 0.08; }
    } else if (style === 'sniper') def.mag = base.mag + 3;
    else def.mag = Math.round(base.mag * 1.5);
    if (mag && !(style === 'shotgun' && !base.reload)) {
      const dy = mag.s[1] * 0.35;
      mag.s[1] += dy; mag.c[1] -= dy / 2; def.magPos[1] -= dy / 2;
    }
  } else if (mg === 'drum' && mag) {
    def.mag = Math.round(base.mag * 2.2);
    const top = mag.c[1] + mag.s[1] / 2;
    mag.s = [0.1, 0.13, 0.12];
    const ny = top - 0.065 + 0.012;
    def.magPos[1] += ny - mag.c[1]; mag.c[1] = ny;
    mag.rx = 0;
    mag.col = DARK;
  } else if (mg === 'quadmag' && mag) {
    def.mag = Math.round(base.mag * 1.8);
    const dy = mag.s[1] * 0.5;
    mag.s[1] += dy; mag.c[1] -= dy / 2; def.magPos[1] -= dy / 2;
    mag.s[2] *= 1.3; mag.col = [0.24, 0.25, 0.22];
    if (!mag.ry) for (const sx of [-1, 1]) add(P('quadRib', [mag.c[0] + sx * (mag.s[0] / 2 + 0.001), mag.c[1], mag.c[2]], [0.003, mag.s[1] * 0.8, 0.01], BLACK, { mag: true, rx: mag.rx || 0 }));
  } else if (mg === 'lightmag') {
    def.mag = Math.max(1, Math.round(base.mag * 0.8));
    if (mag) { mag.col = [0.72, 0.68, 0.6]; mag.m = 'poly'; }
  } else if (mg === 'coupler' && mag) {
    add({ ...mag, name: 'mag2', c: [mag.c[0] + mag.s[0] + 0.004, mag.c[1] + 0.01, mag.c[2]], s: [...mag.s], col: mag.col, mag: true });
    add(P('tape', [mag.c[0] + mag.s[0] / 2 + 0.002, mag.c[1] - 0.01, mag.c[2]], [mag.s[0] * 2 + 0.01, 0.018, mag.s[2] + 0.004], [0.75, 0.62, 0.15], { mag: true, rx: mag.rx || 0 }));
  } else if ((mg === 'fastmag' || mg === 'speedmag') && mag && !(style === 'shotgun' && !base.reload)) {
    add(P('magTab', [mag.c[0], mag.c[1] - mag.s[1] / 2 - 0.006, mag.c[2]], [mag.s[0] * 0.8, 0.012, mag.s[2] * 0.6], mg === 'speedmag' ? [0.2, 0.6, 1] : RED,
      { mag: true, rx: mag.rx || 0, em: 0.3 }));
  }

  // ---- ammo: a painted stripe, flush on the right side of a box mag (or of the receiver if there isn't one) ----
  const amA = A('ammo');
  if (amA) {
    const mp = mag && !mag.hidden && !mag.ry && mag.shape !== 'cyl' ? mag : null;
    if (mp) {
      const rx = mp.rx || 0, dy = -mp.s[1] * 0.28;
      add(P('ammoBand', [mp.c[0] + mp.s[0] / 2 + 0.0006, mp.c[1] + dy * Math.cos(rx), mp.c[2] + dy * Math.sin(rx)],
        [0.0012, Math.min(0.012, mp.s[1] * 0.12), mp.s[2] * 0.7], amA.ammo, { mag: true, rx, em: 0.35 }));
    } else {
      const r = ['receiver', 'frame', 'body', 'action', 'upper'].map(part).find((q) => q && !q.hidden);
      if (r) add(P('ammoBand', [r.c[0] + r.s[0] / 2 + 0.0006, r.c[1] - r.s[1] * 0.25, r.c[2] + r.s[2] * 0.15], [0.0012, 0.008, Math.min(0.05, r.s[2] * 0.3)], amA.ammo, { em: 0.35 }));
    }
    if (amA.burn) def.burn = amA.burn;
    if (amA.flame) def.flame = true;
    if (amA.slug) { def.pellets = 1; def.dmg = Math.round(base.dmg * base.pellets * 0.85); def.spread.base = 0.006; def.headMult = 1.8; }
  }

  // ---- stock ----
  const st = sid('stock');
  if (st) hideGrp('stock');
  const s0 = part(m.stock[0]);
  if (st && s0) {
    const front = s0.c[2] - s0.s[2] / 2, top0 = s0.c[1] + s0.s[1] / 2;
    if (st === 'nostock') {
      hide(m.stock);
    } else if (st === 'lightstock') {
      // skeleton stock: a thin top bar + butt plate
      s0.s = [s0.s[0] * 0.5, s0.s[1] * 0.28, s0.s[2]];
      s0.c[1] = top0 - s0.s[1] / 2;
      add(P('stockPlate', [0, top0 - 0.04, s0.c[2] + s0.s[2] / 2 - 0.01], [0.04, 0.08, 0.02], BLACK, { m: 'rubber' }));
    } else if (st === 'heavystock') {
      s0.s = [s0.s[0] * 1.15, s0.s[1] * 1.18, s0.s[2] * 1.12];
      s0.c[2] = front + s0.s[2] / 2;
      add(P('stockPad', [0, s0.c[1], s0.c[2] + s0.s[2] / 2 + 0.009], [s0.s[0] + 0.004, s0.s[1] + 0.004, 0.02], TAN, { m: 'rubber' }));
    } else if (st === 'paddedstock') {
      add(P('recoilPad', [0, s0.c[1], s0.c[2] + s0.s[2] / 2 + 0.019], [s0.s[0] + 0.01, s0.s[1] + 0.012, 0.04], [0.15, 0.15, 0.16], { m: 'rubber' }));
    } else if (st === 'cheekstock') {
      add(P('cheekRiser', [0, top0 + 0.011, s0.c[2] + 0.01], [s0.s[0] * 0.85, 0.022, Math.min(0.14, s0.s[2] * 0.7)], [0.16, 0.16, 0.17], { m: 'rubber' }),
        P('cheekButt', [0, s0.c[1], s0.c[2] + s0.s[2] / 2 + 0.008], [s0.s[0] + 0.002, s0.s[1] + 0.002, 0.016], BLACK, { m: 'rubber' }));
    } else if (st === 'tacstock') {
      add(P('tacPad', [0, s0.c[1], s0.c[2] + s0.s[2] / 2 + 0.008], [s0.s[0] + 0.004, s0.s[1] + 0.004, 0.016], [0.2, 0.2, 0.21], { m: 'rubber' }),
        P('tacLever', [0, s0.c[1] - s0.s[1] / 2 - 0.005, s0.c[2] - 0.02], [0.014, 0.012, 0.04], DARK, { m: 'metal' }),
        P('tacSling', [s0.s[0] / 2 + 0.003, s0.c[1], s0.c[2] + s0.s[2] * 0.3], [0.006, 0.02, 0.02], DARK, { m: 'steel' }));
    } else if (st === 'foldstock') {
      hide(m.stock);
      const y = s0.c[1];
      for (const yy of [y + 0.025, y - 0.025]) add(P('foldBar', [0, yy, front + s0.s[2] / 2], [0.01, 0.01, s0.s[2]], DARK, { m: 'metal' }));
      add(P('foldPlate', [0, y, front + s0.s[2]], [0.03, 0.08, 0.012], BLACK, { m: 'rubber' }));
    }
    // bridge from the back of the receiver to the new stock (the old buffer tube may have gone with the factory stock)
    const skip = (p) => m.stock.includes(p.name) || p.grp === 'stock' || /^(stock|fold|recoilPad|stockPad|stockPlate|cheekRiser|cheekButt|tac)/.test(p.name);
    const yy = s0.c[1] + 0.005;
    const rear = surfaces(def).rear(yy - 0.016, yy + 0.016, skip);
    if (st === 'nostock') {
      const z = rear ?? front;
      add(P('endcap', [0, yy, z + 0.009], [0.035, 0.04, 0.02], BLACK, { m: 'metal' }));
    } else if (rear != null && front > rear + 0.001) {
      add(P('stockLink', [0, yy, (rear + front) / 2], [0.03, 0.034, front - rear + 0.006], DARK, { m: 'metal', shape: 'cyl' }));
    }
  }

  // ---- apply stat multipliers ----
  def.adsSpeed = base.adsSpeed * k.adsSpeed;
  def.recoil.up *= k.recoilUp;
  def.recoil.side *= k.recoilSide;
  def.spread.base *= k.spreadBase;
  def.spread.move *= k.spreadMove;
  def.spread.ads *= k.adsSpread;
  def.hipSpread = k.hipSpread;
  def.range = (RANGE[id] ?? RANGE[style]) * k.range;
  def.dmg = Math.max(1, Math.round(def.dmg * k.dmg));
  def.rpm = Math.round(base.rpm * k.rpm);
  def.headMult = (def.headMult ?? base.headMult) * k.headMult;
  def.mag = Math.max(1, Math.round(def.mag * (mg === 'extmag' || mg === 'drum' || mg === 'lightmag' || mg === 'quadmag' ? 1 : k.mag)));
  def.sound.gain *= k.gain;
  if (k.gain < 0.5) { def.sound.freq *= 0.55; def.sound.thump *= 0.8; }
  def.flashScale = k.flash;
  if (base.reload) { def.reload = base.reload * k.reload; def.reloadEmpty = base.reloadEmpty * k.reload; }
  if (base.shellTime) def.shellTime = base.shellTime * k.reload;
  if (style === 'shotgun' && mg === 'fastmag' && base.shellTime) def.shellTime = base.shellTime * 0.7;
  return def;
}

// what an attachment does, in words: [{ name, good }] (compared with the gun as it is now)
export function prosCons(base, lo, slot, aid) {
  const a = ratings(buildDef(base, lo));
  const next = { ...lo };
  if (aid) next[slot] = aid; else delete next[slot];
  const b = ratings(buildDef(base, next));
  const out = [];
  b.forEach((s, i) => {
    const d = s.v - a[i].v;
    if (Math.abs(d) > 0.006) out.push({ name: s.name, good: d > 0, d });
  });
  const at = aid && ATTACHMENTS[aid];
  if (at?.burn) out.push({ name: `BURN ${at.burn.dps}/S FOR ${at.burn.dur} S`, good: true, d: 1 });
  if (at?.flame) out.push({ name: 'FLAME JET', good: true, d: 0.9 });
  return out.sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
}

// ---------------------------------------------------------------- stat ratings for the menu (0..1, higher = better)
export function ratings(def) {
  const dps = def.dmg * def.pellets * def.rpm / 60;
  return [
    { name: 'DAMAGE', v: Math.min(def.dmg * def.pellets / 100, 1), text: `${def.dmg}${def.pellets > 1 ? `×${def.pellets}` : ''}` },
    { name: 'FIRE RATE', v: Math.min(def.rpm / 1000, 1), text: `${def.rpm} RPM` },
    { name: 'DPS', v: Math.min(dps / 300, 1), text: `${Math.round(dps)}` },
    { name: 'RANGE', v: Math.min(def.range / 100, 1), text: `${Math.round(def.range)} M` },
    { name: 'ACCURACY', v: Math.max(0, 1 - def.spread.base / 0.06), text: '' },
    { name: 'RECOIL CONTROL', v: Math.max(0, 1 - def.recoil.up / 0.06), text: '' },
    { name: 'HANDLING', v: Math.min(def.adsSpeed / 22, 1), text: '' },
    { name: 'MOBILITY', v: Math.max(0, 1 - def.spread.move / 0.045), text: '' },
    { name: 'MAGAZINE', v: Math.min(def.mag / 100, 1), text: `${def.mag}` },
    { name: 'ZOOM', v: Math.min((1 / def.adsZoom - 1) / 6, 1), text: `${(1 / def.adsZoom).toFixed(1)}×` },
    { name: 'HIP FIRE', v: Math.max(0, Math.min(1, 1.15 - (def.hipSpread ?? 1) * 0.75 - def.spread.base * 4)), text: '' },
    { name: 'STEALTH', v: Math.max(0, Math.min(1, 1 - def.sound.gain * (def.flashScale ?? 1 ? 1 : 0.8) / 1.1)), text: def.sound.gain < 0.4 ? 'SILENT' : '' },
    { name: 'RELOAD', v: def.reload ? Math.max(0, 1 - def.reload / 4.5) : Math.max(0, 1 - def.shellTime / 0.8),
      text: def.reload ? `${def.reload.toFixed(2)} S` : `${def.shellTime.toFixed(2)} S/SHELL` },
  ];
}
