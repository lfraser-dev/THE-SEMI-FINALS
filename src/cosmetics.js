// Cosmetics: outfit pieces + weapon skins, the shop catalogue, your wallet and what you own / wear.
// Everything is saved in this browser. Earning credits will come with the battle pass.
import { CLASSES, CLASS_ORDER } from './classes.js';

export const CURRENCY = 'CREDITS';
const START_CREDITS = 10000;

export const SLOTS = [
  { id: 'head', name: 'HEAD' },
  { id: 'top', name: 'TOP' },
  { id: 'outer', name: 'OUTERWEAR' },
  { id: 'legs', name: 'LEGS' },
  { id: 'shoes', name: 'SHOES' },
  { id: 'gloves', name: 'GLOVES' },
  { id: 'neck', name: 'NECK' },
  { id: 'body', name: 'SKIN TONE' },
  { id: 'wskin', name: 'WEAPON SKIN' },
];

export const RARITY = {
  common: { name: 'COMMON', color: [0.62, 0.64, 0.68] },
  rare: { name: 'RARE', color: [0.2, 0.55, 1] },
  epic: { name: 'EPIC', color: [0.68, 0.3, 1] },
  legendary: { name: 'LEGENDARY', color: [1, 0.68, 0.08] },
};

const C = {
  red: [0.92, 0.1, 0.08], white: [0.95, 0.95, 0.96], black: [0.08, 0.08, 0.09], char: [0.2, 0.2, 0.22], grey: [0.5, 0.51, 0.54],
  blue: [0.15, 0.45, 0.95], navy: [0.1, 0.16, 0.36], sky: [0.55, 0.82, 1], gold: [1, 0.72, 0.1], orange: [1, 0.45, 0.08],
  pink: [0.95, 0.25, 0.6], purple: [0.5, 0.2, 0.85], mint: [0.3, 0.95, 0.75], olive: [0.33, 0.36, 0.2], tan: [0.62, 0.52, 0.36],
  camo: [0.28, 0.32, 0.22], lime: [0.6, 0.95, 0.15], cream: [0.92, 0.88, 0.78], brown: [0.4, 0.27, 0.17],
};

// apply: fields merged into the contestant's outfit. price 0 = free / given to everyone.
export const ITEMS = {
  // ---- head
  h_default: { slot: 'head', name: 'CLASS DEFAULT', price: 0, rarity: 'common', apply: {} },
  h_hair: { slot: 'head', name: 'BARE HEAD', price: 0, rarity: 'common', apply: { head: 'hair', hair: [0.08, 0.06, 0.05] } },
  h_redcap: { slot: 'head', name: 'STUDIO CAP', price: 400, rarity: 'common', apply: { head: 'cap', headCol: C.red, hair: C.black } },
  h_blackcap: { slot: 'head', name: 'MIDNIGHT CAP', price: 400, rarity: 'common', apply: { head: 'cap', headCol: C.black, hair: C.black } },
  h_beanie: { slot: 'head', name: 'WARM-UP BEANIE', price: 500, rarity: 'common', apply: { head: 'beanie', headCol: C.orange, accent: C.black, hair: C.black } },
  h_bucket: { slot: 'head', name: 'BUCKET HAT', price: 900, rarity: 'rare', apply: { head: 'bucket', headCol: C.tan, hair: C.black } },
  h_pinkhair: { slot: 'head', name: 'NEON DYE JOB', price: 1200, rarity: 'rare', apply: { head: 'spiky', hair: C.pink, hairGlow: 0.12 } },
  h_helmet: { slot: 'head', name: 'RIOT HELMET', price: 1400, rarity: 'rare', apply: { head: 'helmet', headCol: C.char, visor: C.sky } },
  h_whitemask: { slot: 'head', name: 'SHOWMAN MASK', price: 2200, rarity: 'epic', apply: { head: 'facemask', headCol: C.white, visor: C.black, hair: C.black, maskStripe: C.red, visorGlow: 0 } },
  h_goldhelm: { slot: 'head', name: 'GOLD STANDARD', price: 3500, rarity: 'legendary', apply: { head: 'helmet', headCol: C.gold, visor: C.black, headMat: 'brass' } },
  h_redmask: { slot: 'head', name: 'FINALIST MASK', price: 3500, rarity: 'legendary', apply: { head: 'facemask', headCol: C.black, visor: C.red, visorGlow: 0.95, hair: C.red, maskStripe: null } },
  // ---- top
  t_default: { slot: 'top', name: 'CLASS DEFAULT', price: 0, rarity: 'common', apply: {} },
  t_white: { slot: 'top', name: 'PLAIN WHITE TEE', price: 0, rarity: 'common', apply: { top: C.white, topStyle: 'tee', logo: null, print: null } },
  t_black: { slot: 'top', name: 'BLACK TEE', price: 300, rarity: 'common', apply: { top: C.black, topStyle: 'tee', logo: null, print: C.white } },
  t_red: { slot: 'top', name: 'STUDIO RED TEE', price: 500, rarity: 'common', apply: { top: C.red, topStyle: 'tee', logo: null, print: C.white } },
  t_mint: { slot: 'top', name: 'MINT CONDITION', price: 900, rarity: 'rare', apply: { top: C.mint, topStyle: 'tee', logo: null, print: C.black } },
  t_purple: { slot: 'top', name: 'ROYAL HOODIE', price: 1500, rarity: 'epic', apply: { top: C.purple, topStyle: 'hoodie', accent: C.gold, logo: C.gold } },
  // ---- outerwear
  o_default: { slot: 'outer', name: 'CLASS DEFAULT', price: 0, rarity: 'common', apply: {} },
  o_none: { slot: 'outer', name: 'NOTHING', price: 0, rarity: 'common', apply: { jacket: null, vest: null } },
  o_bomber: { slot: 'outer', name: 'BLACK BOMBER', price: 800, rarity: 'common', apply: { jacket: [0.1, 0.11, 0.12], jacketStyle: 'bomber', trim: [0.18, 0.18, 0.2], vest: null } },
  o_trackred: { slot: 'outer', name: 'TRACK JACKET', price: 1000, rarity: 'rare', apply: { jacket: C.red, jacketStyle: 'track', stripe: C.white, trim: [0.7, 0.07, 0.06], vest: null } },
  o_camovest: { slot: 'outer', name: 'FIELD VEST', price: 1000, rarity: 'rare', apply: { vest: C.camo, vestStyle: 'field', camo2: [0.16, 0.18, 0.12], camo3: [0.45, 0.42, 0.3], jacket: null } },
  o_puffer: { slot: 'outer', name: 'ARCTIC PUFFER', price: 1800, rarity: 'epic', apply: { jacket: C.sky, jacketStyle: 'puffer', vest: null } },
  o_goldvest: { slot: 'outer', name: 'HIGH ROLLER VEST', price: 3000, rarity: 'legendary', apply: { vest: [0.95, 0.7, 0.15], vestStyle: 'waistcoat', jacket: null } },
  o_whitejacket: { slot: 'outer', name: 'CHAMPION JACKET', price: 3000, rarity: 'legendary', apply: { jacket: C.white, jacketStyle: 'champion', trim: C.red, vest: null } },
  // ---- legs
  l_default: { slot: 'legs', name: 'CLASS DEFAULT', price: 0, rarity: 'common', apply: {} },
  l_black: { slot: 'legs', name: 'BLACK CARGOS', price: 0, rarity: 'common', apply: { bottom: C.black, legStyle: 'cargo' } },
  l_camo: { slot: 'legs', name: 'WOODLAND PANTS', price: 600, rarity: 'common', apply: { bottom: C.camo, legStyle: 'camo', camo2: [0.16, 0.18, 0.12], camo3: [0.45, 0.42, 0.3] } },
  l_tan: { slot: 'legs', name: 'DESERT CHINOS', price: 600, rarity: 'common', apply: { bottom: C.tan, legStyle: 'chino' } },
  l_red: { slot: 'legs', name: 'RED TRACKIES', price: 1100, rarity: 'rare', apply: { bottom: C.red, legStyle: 'track', stripe: C.white } },
  l_white: { slot: 'legs', name: 'SPOTLESS WHITES', price: 1600, rarity: 'epic', apply: { bottom: C.white, legStyle: 'chino' } },
  // ---- shoes
  s_default: { slot: 'shoes', name: 'CLASS DEFAULT', price: 0, rarity: 'common', apply: {} },
  s_black: { slot: 'shoes', name: 'COMBAT BOOTS', price: 0, rarity: 'common', apply: { shoes: C.black, shoeStyle: 'boot' } },
  s_white: { slot: 'shoes', name: 'CLEAN KICKS', price: 500, rarity: 'common', apply: { shoes: C.white, shoeStyle: 'kicks', accent: [0.1, 0.1, 0.12] } },
  s_lime: { slot: 'shoes', name: 'VOLT RUNNERS', price: 1000, rarity: 'rare', apply: { shoes: C.lime, shoeStyle: 'runner', soleCol: C.lime } },
  s_gold: { slot: 'shoes', name: 'GOLDEN SOLES', price: 2400, rarity: 'legendary', apply: { shoes: [1, 0.76, 0.22], shoeStyle: 'gold' } },
  // ---- gloves
  g_default: { slot: 'gloves', name: 'CLASS DEFAULT', price: 0, rarity: 'common', apply: {} },
  g_black: { slot: 'gloves', name: 'TACTICAL GLOVES', price: 0, rarity: 'common', apply: { gloves: [0.1, 0.1, 0.11], gloveStyle: 'tactical' } },
  g_red: { slot: 'gloves', name: 'BOXING TAPE', price: 500, rarity: 'common', apply: { gloves: C.red, gloveStyle: 'tape' } },
  g_white: { slot: 'gloves', name: 'HOST GLOVES', price: 900, rarity: 'rare', apply: { gloves: C.white, gloveStyle: 'host' } },
  // ---- neck
  n_default: { slot: 'neck', name: 'CLASS DEFAULT', price: 0, rarity: 'common', apply: {} },
  n_none: { slot: 'neck', name: 'NOTHING', price: 0, rarity: 'common', apply: { scarf: null, neckStyle: null } },
  n_red: { slot: 'neck', name: 'RED BANDANA', price: 400, rarity: 'common', apply: { scarf: C.red, neckStyle: 'bandana' } },
  n_mint: { slot: 'neck', name: 'MINT SCARF', price: 700, rarity: 'rare', apply: { scarf: C.mint, neckStyle: 'scarf', scarfStripe: C.white } },
  n_gold: { slot: 'neck', name: 'GOLD CHAIN', price: 2000, rarity: 'epic', apply: { scarf: C.gold, neckStyle: 'chain' } },
  // ---- skin tone (free)
  b_default: { slot: 'body', name: 'CLASS DEFAULT', price: 0, rarity: 'common', apply: {} },
  b_1: { slot: 'body', name: 'TONE 1', price: 0, rarity: 'common', apply: { skin: [0.95, 0.8, 0.68] } },
  b_2: { slot: 'body', name: 'TONE 2', price: 0, rarity: 'common', apply: { skin: [0.8, 0.6, 0.45] } },
  b_3: { slot: 'body', name: 'TONE 3', price: 0, rarity: 'common', apply: { skin: [0.56, 0.38, 0.26] } },
  b_4: { slot: 'body', name: 'TONE 4', price: 0, rarity: 'common', apply: { skin: [0.36, 0.24, 0.16] } },
  // ---- weapon skins (tint the gun's body; show on the gun in your hands too)
  w_default: { slot: 'wskin', name: 'FACTORY', price: 0, rarity: 'common', gun: null },
  w_crimson: { slot: 'wskin', name: 'CRIMSON', price: 800, rarity: 'common', gun: { main: C.red, dark: [0.35, 0.04, 0.03] } },
  w_arctic: { slot: 'wskin', name: 'ARCTIC', price: 800, rarity: 'common', gun: { main: [0.9, 0.92, 0.95], dark: [0.55, 0.6, 0.66] } },
  w_desert: { slot: 'wskin', name: 'DESERT OPS', price: 1000, rarity: 'rare', gun: { main: C.tan, dark: [0.3, 0.25, 0.17] } },
  w_toxic: { slot: 'wskin', name: 'TOXIC', price: 1600, rarity: 'epic', gun: { main: C.lime, dark: [0.08, 0.1, 0.06], glow: true } },
  w_gold: { slot: 'wskin', name: '24 KARAT', price: 4000, rarity: 'legendary', gun: { main: [1, 0.78, 0.2], dark: [0.55, 0.38, 0.06], glow: true } },
};

export const FEATURED = ['h_redmask', 'o_whitejacket', 'w_gold'];

const ICON = { head: '◓', top: '▀', outer: '▣', legs: '▥', shoes: '▂', gloves: '✋', neck: '◡', body: '●', wskin: '⌐' };
export const iconFor = (slot) => ICON[slot] || '■';

// swatch colour for an item card
export function swatch(item) {
  if (item.gun) return item.gun.main;
  const a = item.apply || {};
  return a.headCol || a.top || a.jacket || a.vest || a.bottom || a.shoes || a.gloves || a.scarf || a.skin || a.hair || null;
}

// ---------------------------------------------------------------- saved state
const KEY = 'semifinals.cosmetics';
export function loadCosmetics() {
  const st = { credits: START_CREDITS, owned: [], equip: {} };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s) {
      if (Number.isFinite(s.credits)) st.credits = s.credits;
      if (Array.isArray(s.owned)) st.owned = s.owned.filter((id) => ITEMS[id]);
      if (s.equip) st.equip = s.equip;
    }
  } catch { /* ignore */ }
  for (const c of CLASS_ORDER) {
    st.equip[c] = st.equip[c] || {};
    for (const sl of SLOTS) {
      const id = st.equip[c][sl.id];
      if (!id || !ITEMS[id] || ITEMS[id].slot !== sl.id || !owns(st, id)) st.equip[c][sl.id] = defaultFor(sl.id);
    }
  }
  return st;
}
export function saveCosmetics(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ } }
export const owns = (st, id) => ITEMS[id]?.price === 0 || st.owned.includes(id);
export function defaultFor(slot) { return Object.keys(ITEMS).find((id) => ITEMS[id].slot === slot); }
export function itemsFor(slot) { return Object.entries(ITEMS).filter(([, it]) => it.slot === slot).map(([id, it]) => ({ id, ...it })); }

export function buy(st, id) {
  const it = ITEMS[id];
  if (!it || owns(st, id) || st.credits < it.price) return false;
  st.credits -= it.price;
  st.owned.push(id);
  saveCosmetics(st);
  return true;
}

// the outfit a class wears, optionally with one item swapped in (for try-on previews)
export function buildOutfit(st, cls, tryOn = null) {
  const base = { ...CLASSES[cls].skin, build: CLASSES[cls].build };
  const eq = { ...st.equip[cls] };
  if (tryOn && ITEMS[tryOn]) eq[ITEMS[tryOn].slot] = tryOn;
  for (const sl of SLOTS) {
    const it = ITEMS[eq[sl.id]];
    if (it?.apply) Object.assign(base, it.apply);
  }
  return base;
}

export function gunSkinFor(st, cls, tryOn = null) {
  let id = st.equip[cls].wskin;
  if (tryOn && ITEMS[tryOn]?.slot === 'wskin') id = tryOn;
  return ITEMS[id]?.gun || null;
}

// recolour a weapon definition's parts with a skin (keeps mags, lenses, lights and accents)
export function skinDef(def, skin) {
  if (!skin) return def;
  const lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  const parts = def.parts.map((p) => {
    if (p.em || p.mag) return p;
    const l = lum(p.col);
    const sat = Math.max(...p.col) - Math.min(...p.col);
    if (sat > 0.25) return p;                                    // coloured accents stay
    const col = l < 0.14 ? skin.dark : skin.main.map((v) => v * (0.55 + l * 1.1));
    return { ...p, col, em: skin.glow && l >= 0.14 ? 0.12 : p.em };
  });
  return { ...def, parts };
}
