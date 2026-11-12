// Contestant classes for the Armoury: Light / Medium / Heavy.
// Each has its own health, speed, size, weapons and a set ability (Light: grapple, Medium: bounce pad, Heavy: barricade). The chosen loadout is saved.

export const ABILITIES = {
  dash: { name: 'EVASIVE DASH', short: 'DASH', desc: 'Burst in any direction, even mid-air. 2 charges.', cd: '2.2 S / CHARGE' },
  grapple: { name: 'GRAPPLING HOOK', short: 'GRAPPLE', desc: 'Fire a hook up to 45 m away and reel yourself in. Jump or press again to let go with a boost.', cd: '4.5 S' },
  slam: { name: 'GROUND SLAM', short: 'SLAM', desc: 'Dive into the ground. The shockwave smashes walls and anything nearby. Leaps first if grounded.', cd: '7 S' },
  barricade: { name: 'BARRICADE', short: 'BARRICADE', desc: 'Slam a steel wall out of the floor in front of you. Soaks up 450 damage. Up to 2 at once.', cd: '10 S' },
  pad: { name: 'BOUNCE PAD', short: 'BOUNCE PAD', desc: 'Drop a pad where you aim. Anyone who steps on it gets launched sky high, you and your team included.', cd: '14 S' },
};

export const CLASSES = {
  light: {
    name: 'LIGHT', tag: 'FAST · FRAGILE · SLIPPERY',
    desc: 'The quickest contestant on the floor. Hit hard, get out, never be where they expect.',
    hp: 150, speed: 1.12, build: 0.88,
    weapons: ['smg', 'kv', 'zu9', 'mp', 'sniper', 'lever', 'revolver', 'hc50', 'pistol'], abilities: ['grapple'],
    color: [0.15, 0.55, 1],
    skin: { skin: [0.78, 0.57, 0.42], top: [0.13, 0.14, 0.17], zip: true, logo: [0.25, 0.65, 1], bottom: [0.07, 0.07, 0.085], shoes: [0.92, 0.92, 0.94],
      gloves: [0.78, 0.57, 0.42], accent: [0.25, 0.65, 1], kneeCol: [0.1, 0.1, 0.11], legStyle: 'slim', shoeStyle: 'kicks', head: 'cap', headCol: [0.15, 0.5, 0.95], hair: [0.08, 0.06, 0.05] },
  },
  medium: {
    name: 'MEDIUM', tag: 'BALANCED · VERSATILE',
    desc: 'Good at everything, best at staying in the fight. The backbone of any team.',
    hp: 250, speed: 1, build: 1,
    weapons: ['ar', 'burst', 'hx17', 'bullpup', 'dmr', 'shotgun', 'rt7', 'double', 'pistol'], abilities: ['pad'],
    color: [0.92, 0.1, 0.08],
    skin: { skin: [0.86, 0.66, 0.54], top: [0.12, 0.14, 0.21], zip: true, logo: [1, 0.72, 0.12], bottom: [0.06, 0.06, 0.075], shoes: [0.07, 0.07, 0.08],
      gloves: [0.86, 0.66, 0.54], accent: [0.92, 0.1, 0.08], kneeCol: [0.08, 0.08, 0.1], legStyle: 'slim', shoeStyle: 'kicks', head: 'hair', hair: [0.22, 0.14, 0.08] },
  },
  heavy: {
    name: 'HEAVY', tag: 'TOUGH · SLOW · LOUD',
    desc: 'A walking wall. Soaks up damage and turns cover into rubble.',
    hp: 350, speed: 0.86, build: 1.28,
    weapons: ['lmg', 'rk74', 'minigun', 'amr', 'autoshotgun', 'shotgun', 'revolver', 'hc50'], abilities: ['barricade'],
    color: [1, 0.68, 0.08],
    skin: { skin: [0.93, 0.76, 0.64], top: [0.1, 0.1, 0.11], vest: [0.95, 0.66, 0.1], bottom: [0.11, 0.11, 0.12], shoes: [0.08, 0.08, 0.09],
      gloves: [0.1, 0.1, 0.11], accent: [1, 0.68, 0.08], kneeCol: [0.12, 0.12, 0.13], kneePads: true, legStyle: 'cargo', shoeStyle: 'boot', gloveStyle: 'tactical', head: 'mask', headCol: [0.1, 0.1, 0.11], visor: [1, 0.68, 0.08], scarf: [0.1, 0.1, 0.11] },
  },
};
export const CLASS_ORDER = ['light', 'medium', 'heavy'];

const KEY = 'semifinals.loadout';
export function loadLoadout() {
  const def = { cls: 'medium', light: { weapon: 'smg', ability: 'grapple' }, medium: { weapon: 'ar', ability: 'pad' }, heavy: { weapon: 'lmg', ability: 'barricade' } };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && CLASSES[s.cls]) {
      for (const c of CLASS_ORDER) {
        if (s[c] && CLASSES[c].weapons.includes(s[c].weapon)) def[c].weapon = s[c].weapon;
        if (s[c] && CLASSES[c].abilities.includes(s[c].ability)) def[c].ability = s[c].ability;
      }
      def.cls = s.cls;
    }
  } catch { /* ignore */ }
  return def;
}
export function saveLoadout(lo) { try { localStorage.setItem(KEY, JSON.stringify(lo)); } catch { /* ignore */ } }
