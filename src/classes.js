// Contestant classes for the Armoury: Light / Medium / Heavy.
// Each has its own health, speed, size, weapons and ability options. The chosen loadout is saved.

export const ABILITIES = {
  dash: { name: 'EVASIVE DASH', short: 'DASH', desc: 'Burst in any direction, even mid-air. 2 charges.', cd: '2.2 S / CHARGE' },
  grapple: { name: 'GRAPPLING HOOK', short: 'GRAPPLE', desc: 'Fire a hook up to 45 m away and reel yourself in. Jump to let go with a boost.', cd: '4.5 S' },
  slam: { name: 'GROUND SLAM', short: 'SLAM', desc: 'Dive into the ground. The shockwave smashes walls and anything nearby. Leaps first if grounded.', cd: '7 S' },
};

export const CLASSES = {
  light: {
    name: 'LIGHT', tag: 'FAST · FRAGILE · SLIPPERY',
    desc: 'The quickest contestant on the floor. Hit hard, get out, never be where they expect.',
    hp: 150, speed: 1.12, build: 0.88,
    weapons: ['smg', 'sniper', 'pistol'], abilities: ['dash', 'grapple'],
    color: [0.15, 0.55, 1],
    skin: { skin: [0.78, 0.57, 0.42], top: [0.12, 0.13, 0.16], jacket: [0.15, 0.55, 1], bottom: [0.1, 0.1, 0.12], shoes: [0.95, 0.95, 0.97],
      gloves: [0.1, 0.1, 0.12], accent: [0.6, 0.85, 1], head: 'cap', headCol: [0.15, 0.55, 1], hair: [0.08, 0.06, 0.05] },
  },
  medium: {
    name: 'MEDIUM', tag: 'BALANCED · VERSATILE',
    desc: 'Good at everything, best at staying in the fight. The backbone of any team.',
    hp: 250, speed: 1, build: 1,
    weapons: ['ar', 'shotgun', 'pistol'], abilities: ['grapple', 'dash'],
    color: [0.92, 0.1, 0.08],
    skin: { skin: [0.55, 0.37, 0.25], top: [0.92, 0.92, 0.94], vest: [0.92, 0.1, 0.08], bottom: [0.16, 0.16, 0.18], shoes: [0.92, 0.1, 0.08],
      gloves: [0.12, 0.12, 0.13], accent: [1, 1, 1], head: 'helmet', headCol: [0.94, 0.94, 0.96], visor: [0.95, 0.2, 0.12] },
  },
  heavy: {
    name: 'HEAVY', tag: 'TOUGH · SLOW · LOUD',
    desc: 'A walking wall. Soaks up damage and turns cover into rubble.',
    hp: 350, speed: 0.86, build: 1.28,
    weapons: ['lmg', 'shotgun'], abilities: ['slam', 'dash'],
    color: [1, 0.68, 0.08],
    skin: { skin: [0.93, 0.76, 0.64], top: [0.2, 0.2, 0.22], vest: [1, 0.68, 0.08], bottom: [0.2, 0.2, 0.22], shoes: [0.12, 0.12, 0.13],
      gloves: [0.12, 0.12, 0.13], accent: [1, 0.68, 0.08], head: 'mask', headCol: [0.15, 0.15, 0.16], visor: [1, 0.68, 0.08], scarf: [0.12, 0.12, 0.13] },
  },
};
export const CLASS_ORDER = ['light', 'medium', 'heavy'];

const KEY = 'semifinals.loadout';
export function loadLoadout() {
  const def = { cls: 'medium', light: { weapon: 'smg', ability: 'dash' }, medium: { weapon: 'ar', ability: 'grapple' }, heavy: { weapon: 'lmg', ability: 'slam' } };
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
