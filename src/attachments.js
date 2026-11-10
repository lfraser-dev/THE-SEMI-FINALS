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
  { id: 'magazine', name: 'MAGAZINE' },
  { id: 'stock', name: 'STOCK' },
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
};

// Base effective range (m) before damage falls off
export const RANGE = { ar: 35, smg: 18, shotgun: 10, sniper: 120, lmg: 40, pistol: 20 };

const P = (name, c, s, col, extra = {}) => ({ name, c, s, col, ...extra });

// ---------------------------------------------------------------- attachment list
// mods are multipliers unless noted. `for` lists the weapons that accept it.
export const ATTACHMENTS = {
  // optics
  reddot: { slot: 'optic', name: 'MINI RED DOT', desc: 'Small, fast, clean dot.', for: ['shotgun', 'sniper', 'pistol'],
    optic: { h: 0.018, zoom: 0.86 }, mods: {} },
  holo: { slot: 'optic', name: 'HOLO SIGHT', desc: 'Wide window with a ring reticle.', for: ['ar', 'smg', 'shotgun', 'lmg', 'sniper'],
    optic: { h: 0.032, zoom: 0.82 }, mods: { adsSpeed: 0.95 } },
  prism2x: { slot: 'optic', name: '2× PRISM', desc: 'Mid-range magnification.', for: ['ar', 'smg', 'lmg', 'sniper'],
    optic: { h: 0.034, zoom: 0.52, eye: 0.17 }, mods: { adsSpeed: 0.82, adsSpread: 0.85 } },
  scope4x: { slot: 'optic', name: '4× SCOPE', desc: 'Long-range scope with a full overlay.', for: ['ar', 'lmg', 'sniper'],
    optic: { h: 0.048, zoom: 0.3, scope: true }, mods: { adsSpeed: 0.7, adsSpread: 0.7 } },
  // muzzle
  suppressor: { slot: 'muzzle', name: 'SUPPRESSOR', desc: 'Quiet shots, no muzzle flash, a little less range.', for: 'all',
    mods: { recoilUp: 0.9, recoilSide: 0.9, range: 0.88, gain: 0.35, flash: 0, adsSpeed: 0.95 } },
  compensator: { slot: 'muzzle', name: 'COMPENSATOR', desc: 'Cuts sideways recoil.', for: ['ar', 'smg', 'lmg', 'pistol', 'sniper'],
    mods: { recoilSide: 0.55, flash: 1.3, gain: 1.1 } },
  brake: { slot: 'muzzle', name: 'MUZZLE BRAKE', desc: 'Cuts vertical recoil. Loud.', for: ['ar', 'smg', 'lmg', 'sniper'],
    mods: { recoilUp: 0.75, flash: 1.5, gain: 1.25 } },
  choke: { slot: 'muzzle', name: 'FULL CHOKE', desc: 'Tighter pellet spread, more range.', for: ['shotgun'],
    mods: { spreadBase: 0.62, range: 1.3 } },
  // barrel
  longbarrel: { slot: 'barrel', name: 'LONG BARREL', desc: 'More range and accuracy, slower to aim.', for: ['ar', 'smg', 'shotgun', 'sniper', 'lmg'],
    barrel: { add: 0.13 }, mods: { range: 1.35, spreadBase: 0.8, adsSpeed: 0.9, recoilUp: 0.92 } },
  cqbbarrel: { slot: 'barrel', name: 'CQB BARREL', desc: 'Snappier and better on the move, less range.', for: ['ar', 'smg', 'shotgun', 'lmg'],
    barrel: { mul: 0.58 }, mods: { range: 0.75, spreadMove: 0.7, adsSpeed: 1.15, recoilUp: 1.1 } },
  // underbarrel
  vgrip: { slot: 'underbarrel', name: 'VERTICAL GRIP', desc: 'Steadier vertical recoil.', for: ['ar', 'smg', 'lmg', 'sniper'],
    mods: { recoilUp: 0.8, adsSpeed: 0.95 } },
  agrip: { slot: 'underbarrel', name: 'ANGLED GRIP', desc: 'Faster aiming.', for: ['ar', 'smg', 'lmg'],
    mods: { adsSpeed: 1.22, recoilUp: 0.94 } },
  laser: { slot: 'underbarrel', name: 'LASER SIGHT', desc: 'Tighter hip-fire. Shows a visible beam.', for: 'all',
    mods: { hipSpread: 0.68 } },
  // magazine
  extmag: { slot: 'magazine', name: 'EXTENDED MAG', desc: 'More rounds, slightly slower reload.', for: 'all',
    mods: { mag: 1.5, reload: 1.12, adsSpeed: 0.96 } },
  fastmag: { slot: 'magazine', name: 'FAST MAG', desc: 'Much quicker reloads.', for: 'all',
    mods: { reload: 0.72 } },
  drum: { slot: 'magazine', name: 'DRUM MAG', desc: 'Huge capacity, heavy and slow.', for: ['ar', 'smg'],
    mods: { mag: 2.2, reload: 1.4, adsSpeed: 0.85 } },
  // stock
  lightstock: { slot: 'stock', name: 'LIGHT STOCK', desc: 'Quicker handling, a bit more recoil.', for: ['ar', 'smg', 'shotgun', 'sniper', 'lmg'],
    mods: { adsSpeed: 1.15, recoilUp: 1.1, spreadMove: 0.85 } },
  heavystock: { slot: 'stock', name: 'HEAVY STOCK', desc: 'Soaks up recoil, slower to aim.', for: ['ar', 'smg', 'shotgun', 'sniper', 'lmg'],
    mods: { recoilUp: 0.85, recoilSide: 0.85, adsSpeed: 0.9 } },
  nostock: { slot: 'stock', name: 'NO STOCK', desc: 'Very fast handling, wild recoil.', for: ['ar', 'smg', 'shotgun'],
    mods: { adsSpeed: 1.35, recoilUp: 1.35, recoilSide: 1.3, spreadMove: 0.75 } },
};

export function optionsFor(weaponId, slot) {
  if ((slot === 'barrel' || slot === 'stock') && weaponId === 'pistol') return [];
  return Object.entries(ATTACHMENTS)
    .filter(([, a]) => a.slot === slot && (a.for === 'all' || a.for.includes(weaponId)))
    .map(([id, a]) => ({ id, ...a }));
}

export function slotsFor(weaponId) {
  return SLOTS.filter((s) => optionsFor(weaponId, s.id).length > 0);
}

// ---------------------------------------------------------------- build
export function buildDef(base, loadout = {}) {
  const id = base.id, m = MOUNT[id];
  const def = {
    ...base,
    spread: { ...base.spread },
    recoil: { ...base.recoil },
    sound: { ...base.sound },
    muzzle: [...base.muzzle],
    magPos: [...base.magPos],
    foreGrip: [...base.foreGrip],
    parts: base.parts.map((p) => ({ ...p, c: [...p.c], s: [...p.s] })),
    range: RANGE[id],
    flashScale: 1,
    hipSpread: 1,
    laser: null,
    loadout: { ...loadout },
  };
  const part = (name) => def.parts.find((p) => p.name === name);
  const hide = (names) => names.forEach((n) => { const p = part(n); if (p) p.hidden = true; });
  const hideGrp = (g) => def.parts.forEach((p) => { if (p.grp === g) p.hidden = true; });
  const add = (...ps) => def.parts.push(...ps);

  // stat multipliers
  const k = { adsSpeed: 1, adsSpread: 1, recoilUp: 1, recoilSide: 1, range: 1, gain: 1, flash: 1,
    spreadBase: 1, spreadMove: 1, hipSpread: 1, mag: 1, reload: 1 };
  for (const slot of SLOTS) {
    const a = ATTACHMENTS[loadout[slot.id]];
    if (!a || a.slot !== slot.id) continue;
    for (const [key, v] of Object.entries(a.mods)) k[key] *= v;
  }

  // ---- barrel (first, since it moves the muzzle) ----
  const barrelA = ATTACHMENTS[loadout.barrel];
  const barrel = part('barrel');
  if (barrelA && barrel) {
    const rear = barrel.c[2] + barrel.s[2] / 2;
    const oldLen = barrel.s[2], newLen = barrelA.barrel.add ? oldLen + barrelA.barrel.add : oldLen * barrelA.barrel.mul;
    barrel.s[2] = newLen;
    barrel.c[2] = rear - newLen / 2;
    const shift = newLen - oldLen;
    for (const n of [...m.muzzle, ...(m.shiftAlso || [])]) { const p = part(n); if (p) p.c[2] -= shift; }
    for (const p of def.parts) if (p.grp === 'muzzle') p.c[2] -= shift;
    def.muzzle[2] -= shift;
    if (barrelA.barrel.add) add(P('gasblock', [0, barrel.c[1] + 0.004, rear - newLen * 0.45], [0.036, 0.04, 0.03], DARK));
  }

  // ---- muzzle device ----
  const muz = loadout.muzzle;
  if (ATTACHMENTS[muz]?.slot === 'muzzle') {
    hide(m.muzzle);
    hideGrp('muzzle');
    const b = part('barrel');
    const front = b ? b.c[2] - b.s[2] / 2 : (m.barrelFront ?? def.muzzle[2] + 0.02);
    const y = def.muzzle[1];
    const dims = { suppressor: [0.044, 0.044, id === 'pistol' ? 0.13 : 0.18], compensator: [0.036, 0.036, 0.06], brake: [0.05, 0.04, 0.075], choke: [0.046, 0.046, 0.055] }[muz];
    const len = dims[2];
    add(P(muz, [0, y, front - len / 2], dims, muz === 'suppressor' ? [0.16, 0.16, 0.17] : DARK));
    if (muz === 'suppressor') {
      add(P('supRing', [0, y, front - 0.012], [dims[0] + 0.006, dims[1] + 0.006, 0.014], BLACK));
      add(P('supCap', [0, y, front - len + 0.006], [dims[0] + 0.004, dims[1] + 0.004, 0.012], BLACK));
    } else if (muz === 'compensator') {
      add(P('compPort', [0, y + dims[1] / 2, front - len / 2], [0.014, 0.004, 0.04], GREY));
    } else if (muz === 'brake') {
      add(P('brakeL', [-dims[0] / 2, y, front - len / 2], [0.004, 0.022, 0.05], GREY));
      add(P('brakeR', [dims[0] / 2, y, front - len / 2], [0.004, 0.022, 0.05], GREY));
    }
    def.muzzle[2] = front - len - 0.02;
  }

  // ---- optic ----
  const optA = ATTACHMENTS[loadout.optic];
  if (optA?.slot === 'optic') {
    hide(m.sight);
    hideGrp('sight');
    const o = optA.optic, ry = m.railY, rz = m.railZ;
    const h = ry + o.h;
    def.sightY = h;
    def.adsZoom = o.zoom;
    def.scope = !!o.scope;
    if (o.eye) def.adsZ = -o.eye;
    if (m.rail) add(P('rail', [0, ry - 0.005, rz], [0.03, 0.01, 0.14], BLACK));
    const name = loadout.optic;
    if (name === 'reddot') {
      add(P('rdBase', [0, ry + 0.004, rz], [0.03, 0.008, 0.045], BLACK),
        P('rdL', [-0.014, h, rz + 0.01], [0.004, 0.024, 0.006], BLACK),
        P('rdR', [0.014, h, rz + 0.01], [0.004, 0.024, 0.006], BLACK),
        P('rdTop', [0, h + 0.013, rz + 0.01], [0.032, 0.004, 0.006], BLACK),
        P('rdDot', [0, h, rz + 0.012], [0.003, 0.003, 0.001], RED, { em: 1 }));
    } else if (name === 'holo') {
      add(P('hoBase', [0, ry + 0.006, rz], [0.044, 0.012, 0.08], BLACK),
        P('hoL', [-0.023, h + 0.004, rz - 0.01], [0.005, 0.042, 0.055], DARK),
        P('hoR', [0.023, h + 0.004, rz - 0.01], [0.005, 0.042, 0.055], DARK),
        P('hoTop', [0, h + 0.025, rz - 0.01], [0.051, 0.006, 0.055], DARK),
        P('hoDot', [0, h, rz - 0.02], [0.0025, 0.0025, 0.001], RED, { em: 1 }));
      for (const [dx, dy, sx, sy] of [[0, 0.009, 0.007, 0.0016], [0, -0.009, 0.007, 0.0016], [0.009, 0, 0.0016, 0.007], [-0.009, 0, 0.0016, 0.007]]) {
        add(P('hoRing', [dx, h + dy, rz - 0.02], [sx, sy, 0.001], RED, { em: 1 }));
      }
    } else if (name === 'prism2x') {
      // short prism housing with a wide, open window: thin side walls, a rim at each end, chevron reticle
      const L = 0.06, hw = 0.03, hh = 0.027;
      add(P('prBase', [0, ry + 0.005, rz], [0.036, 0.01, 0.07], BLACK, { m: 'metal' }),
        P('prL', [-hw - 0.003, h, rz], [0.006, hh * 2 + 0.006, L], DARK, { m: 'metal' }),
        P('prR', [hw + 0.003, h, rz], [0.006, hh * 2 + 0.006, L], DARK, { m: 'metal' }),
        P('prTop', [0, h + hh + 0.003, rz], [hw * 2 + 0.012, 0.006, L], DARK, { m: 'metal' }),
        P('prBot', [0, h - hh - 0.003, rz], [hw * 2 + 0.012, 0.006, L * 0.6], DARK, { m: 'metal' }),
        P('prBlock', [0, (ry + h - hh) / 2 + 0.003, rz + 0.01], [0.03, Math.max(0.004, h - hh - ry - 0.004), 0.04], BLACK, { m: 'metal' }),
        P('prKnob', [hw + 0.01, h, rz + 0.01], [0.014, 0.014, 0.01], BLACK, { m: 'steel', shape: 'cyl', ry: Math.PI / 2 }),
        P('prRimF', [0, h + hh + 0.004, rz - L / 2], [hw * 2 + 0.016, 0.008, 0.008], BLACK, { m: 'rubber' }),
        P('prRimFL', [-hw - 0.004, h, rz - L / 2], [0.008, hh * 2 + 0.008, 0.008], BLACK, { m: 'rubber' }),
        P('prRimFR', [hw + 0.004, h, rz - L / 2], [0.008, hh * 2 + 0.008, 0.008], BLACK, { m: 'rubber' }),
        P('prChev', [0, h - 0.002, rz - 0.02], [0.004, 0.004, 0.001], RED, { em: 1 }),
        P('prChevL', [-0.003, h - 0.004, rz - 0.02], [0.003, 0.0015, 0.001], RED, { em: 1 }),
        P('prChevR', [0.003, h - 0.004, rz - 0.02], [0.003, 0.0015, 0.001], RED, { em: 1 }),
        P('prStadia', [0, h - 0.012, rz - 0.02], [0.0008, 0.008, 0.001], RED, { em: 0.8 }));
    } else if (name === 'scope4x') {
      add(P('scBody', [0, h, rz], [0.04, 0.04, 0.24], BLACK),
        P('scBell', [0, h, rz - 0.13], [0.056, 0.056, 0.05], BLACK),
        P('scEye', [0, h, rz + 0.12], [0.048, 0.048, 0.04], BLACK),
        P('scTurret', [0, h + 0.026, rz], [0.022, 0.016, 0.022], DARK),
        P('scRing1', [0, (ry + h) / 2, rz - 0.06], [0.03, h - ry, 0.02], DARK),
        P('scRing2', [0, (ry + h) / 2, rz + 0.06], [0.03, h - ry, 0.02], DARK),
        P('scLens', [0, h, rz - 0.156], [0.042, 0.042, 0.002], LENS, { em: 0.6 }));
    }
  }

  // ---- underbarrel ----
  const ub = loadout.underbarrel;
  if (ub === 'laser') {
    const lp = m.laser;
    add(P('laserBox', lp, [0.026, 0.026, 0.07], DARK),
      P('laserLens', [lp[0], lp[1], lp[2] - 0.036], [0.01, 0.01, 0.002], RED, { em: 1 }));
    def.laser = [lp[0], lp[1], lp[2] - 0.04];
  } else if ((ub === 'vgrip' || ub === 'agrip') && m.under) {
    const u = m.under;
    if (u.hide) hide(u.hide);
    hideGrp('under');
    if (ub === 'vgrip') {
      add(P('vgrip', [0, u.y - 0.043, u.z], [0.03, 0.086, 0.032], BLACK));
      def.foreGrip = [0, u.y - 0.05, u.z];
    } else {
      add(P('agrip', [0, u.y - 0.016, u.z + 0.02], [0.034, 0.026, 0.09], BLACK, { rx: 0.45 }));
      def.foreGrip = [0, u.y - 0.03, u.z + 0.03];
    }
  }

  // ---- magazine ----
  const mag = part('mag');
  const mg = loadout.magazine;
  if (mg === 'extmag' || mg === 'drum') hideGrp('mag');
  if (mg === 'extmag') {
    if (id === 'shotgun') {
      def.mag = base.mag + 2;
      const tube = part('tube');
      if (tube) { tube.s[2] *= 1.18; tube.c[2] -= tube.s[2] * 0.08; }
    } else if (id === 'sniper') def.mag = base.mag + 3;
    else def.mag = Math.round(base.mag * 1.5);
    if (mag && id !== 'shotgun') {
      const dy = mag.s[1] * 0.35;
      mag.s[1] += dy; mag.c[1] -= dy / 2; def.magPos[1] -= dy / 2;
    }
  } else if (mg === 'drum' && mag) {
    def.mag = Math.round(base.mag * 2.2);
    mag.s = [0.1, 0.13, 0.12];
    mag.c[1] -= 0.035; def.magPos[1] -= 0.035;
    mag.rx = 0;
    mag.col = DARK;
  } else if (mg === 'fastmag' && mag && id !== 'shotgun') {
    add(P('magTab', [mag.c[0], mag.c[1] - mag.s[1] / 2 - 0.006, mag.c[2]], [mag.s[0] * 0.8, 0.012, mag.s[2] * 0.6], RED,
      { mag: true, rx: mag.rx || 0, em: 0.3 }));
  }

  // ---- stock ----
  const st = loadout.stock;
  if (st === 'nostock' || st === 'lightstock' || st === 'heavystock') hideGrp('stock');
  if (st === 'nostock') {
    hide(m.stock);
    const s0 = part(m.stock[0]);
    if (s0) add(P('endcap', [0, s0.c[1] + 0.01, s0.c[2] - s0.s[2] / 2 + 0.01], [0.035, 0.05, 0.02], BLACK));
  } else if (st === 'lightstock' || st === 'heavystock') {
    const s0 = part(m.stock[0]);
    if (s0) {
      if (st === 'lightstock') {
        // skeleton stock: a thin top bar + butt plate
        s0.s = [s0.s[0] * 0.5, s0.s[1] * 0.28, s0.s[2]];
        s0.c[1] += 0.02;
        add(P('stockPlate', [0, s0.c[1] - 0.03, s0.c[2] + s0.s[2] / 2 - 0.01], [0.04, 0.08, 0.02], BLACK));
      } else {
        s0.s = [s0.s[0] * 1.15, s0.s[1] * 1.18, s0.s[2] * 1.12];
        s0.c[2] += s0.s[2] * 0.05;
        add(P('stockPad', [0, s0.c[1], s0.c[2] + s0.s[2] / 2 + 0.01], [s0.s[0] + 0.004, s0.s[1] + 0.004, 0.02], TAN));
      }
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
  def.range = RANGE[id] * k.range;
  def.sound.gain *= k.gain;
  if (k.gain < 0.5) { def.sound.freq *= 0.55; def.sound.thump *= 0.8; }
  def.flashScale = k.flash;
  if (base.reload) { def.reload = base.reload * k.reload; def.reloadEmpty = base.reloadEmpty * k.reload; }
  if (base.shellTime) def.shellTime = base.shellTime * k.reload;
  if (id === 'shotgun' && mg === 'fastmag') def.shellTime = base.shellTime * 0.7;
  return def;
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
    { name: 'RELOAD', v: def.reload ? Math.max(0, 1 - def.reload / 4.5) : Math.max(0, 1 - def.shellTime / 0.8),
      text: def.reload ? `${def.reload.toFixed(2)} S` : `${def.shellTime.toFixed(2)} S/SHELL` },
  ];
}
