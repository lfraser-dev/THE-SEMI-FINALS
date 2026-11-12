// Contestant classes for the Armoury: Light / Medium / Heavy.
// Each has its own health, speed and size, and carries one primary gun, one sidearm, an ability (G) and a heavy
// weapon (Q). Abilities and heavy weapons come in variants you pick in the Armoury. The chosen loadout is saved.

export const ABILITIES = {
  dash: { name: 'EVASIVE DASH', short: 'DASH', desc: 'Burst in whatever direction you\'re holding, even mid-air, and keep the speed. 2 charges.', cd: '2.2 S / CHARGE' },
  grapple: { name: 'GRAPPLING HOOK', short: 'GRAPPLE', desc: 'Fire a hook up to 45 m away and reel yourself in. Jump or press again to let go with a boost.', cd: '4.5 S' },
  slam: { name: 'GROUND SLAM', short: 'SLAM', desc: 'Leap and dive into the ground. The shockwave hurts every enemy nearby (more the further you fall) and smashes walls.', cd: '7 S' },
  barricade: { name: 'BARRICADE', short: 'BARRICADE', desc: 'Slam a steel wall out of the floor in front of you. Soaks up 450 damage. Up to 2 at once.', cd: '10 S' },
  pad: { name: 'BOUNCE PAD', short: 'BOUNCE PAD', desc: 'Drop a pad where you aim. Anyone who steps on it gets launched sky high, you and your team included.', cd: '14 S' },
  tether: { name: 'TETHER LAUNCHER', short: 'TETHER', desc: 'G pulls out a launcher; click to fire a tether bolt. Hit someone and they are tied to the nearest wall or floor for 4 s. Hit a surface and it sits there as a trap that snags the next enemy to walk past.', cd: '9 S' },
  cloak: { name: 'CLOAKING DEVICE', short: 'CLOAK', desc: 'Go invisible for 6 s. Enemies can\'t pick you out beyond 4 m. Shooting drops the cloak.', cd: '16 S' },
  heal: { name: 'HEALING STATION', short: 'HEAL STATION', desc: 'Drop a station that heals you and your team within 4.5 m (20 HP a second) for 12 s. 150 HP, so guard it.', cd: '20 S' },
  launchpad: { name: 'LAUNCH PAD', short: 'LAUNCH PAD', desc: 'Faces the way you drop it and fires you forward in a long, flat arc. Great for crossing gaps fast.', cd: '14 S' },
  lowwall: { name: 'BLOCKADE', short: 'BLOCKADE', desc: 'A wide, waist-high steel wall (4.2 m). Crouch behind it or vault it. 700 HP, one at a time.', cd: '12 S' },
};

// Heavy weapons (Q): one per loadout, picked from your class's list.
export const HEAVIES = {
  dronepod: { name: 'DRONE POD', short: 'DRONE POD', desc: 'Drop a pod. 1.5 s later it launches a drone that hunts for 5 s. Finds an enemy: dives at them and explodes (90). Finds nothing: blows up where it is.', cd: '18 S' },
  swarmpod: { name: 'SWARM POD', short: 'SWARM POD', desc: 'The same pod with three little drones that fan out to hunt. Each hits for 40 in a smaller blast.', cd: '20 S' },
  gl_frag: { name: 'FRAG LAUNCHER', short: 'FRAG GL', desc: 'Single-shot launcher: Q pulls it out, click to fire one grenade that explodes on impact (85 in a 4 m blast).', cd: '9 S' },
  gl_sticky: { name: 'STICKY LAUNCHER', short: 'STICKY GL', desc: 'The grenade sticks to whatever it hits, people included, and goes off 1.2 s later. Bigger bang (110).', cd: '11 S' },
  gl_cluster: { name: 'CLUSTER LAUNCHER', short: 'CLUSTER', desc: 'The grenade bursts on impact into five bomblets that scatter and go off a moment later (35 each). Clears a room.', cd: '12 S' },
  gl_fire: { name: 'FIREBOMB LAUNCHER', short: 'FIREBOMB', desc: 'Bursts into a 3.5 m pool of fire that burns for 5 s and sets anyone who walks through it alight.', cd: '13 S' },
  turret_mg: { name: 'MG TURRET', short: 'MG TURRET', desc: 'Plant a turret that shoots the nearest enemy it can see within 30 m. Fast and light. 300 HP, lasts 25 s.', cd: '24 S' },
  mines: { name: 'PROXIMITY MINES', short: 'MINES', desc: 'Throw three mines in a spread where you aim. Each arms after 1 s and blows up (70) when an enemy gets within 2.2 m. They last 40 s.', cd: '20 S' },
  turret_flame: { name: 'FLAME TURRET', short: 'FLAME TURRET', desc: 'Short range (12 m) but it hoses the area in fire and sets everyone it touches alight. 350 HP, lasts 25 s.', cd: '26 S' },
  turret_heavy: { name: 'CANNON TURRET', short: 'CANNON', desc: 'Slow, heavy rounds out to 45 m (45 a shot). Tougher: 400 HP, lasts 25 s.', cd: '28 S' },
};
export const SIDEARMS = ['pistol', 'mp', 'revolver', 'hc50'];
// Throwables (Z): everyone picks one; two charges that recharge
export const THROWABLES = {
  frag: { name: 'FRAG GRENADE', short: 'FRAG', desc: 'Cook-free frag: bounces, then goes off 1.7 s after the throw. 90 damage in a 4.5 m blast.', cd: '2 × 14 S' },
  smoke: { name: 'SMOKE GRENADE', short: 'SMOKE', desc: 'A thick cloud nearly 10 m across for 12 s. Bots and turrets can\'t see through it; neither can anyone else.', cd: '2 × 14 S' },
  flash: { name: 'FLASHBANG', short: 'FLASH', desc: 'Whites out anyone looking at it (worse the closer and more head-on). Blinded bots can\'t pick targets for a few seconds.', cd: '2 × 14 S' },
};
export const THROW_ORDER = ['frag', 'smoke', 'flash'];

export const CLASSES = {
  light: {
    name: 'LIGHT', tag: 'FAST · FRAGILE · SLIPPERY',
    desc: 'The quickest contestant on the floor. Hit hard, get out, never be where they expect.',
    hp: 150, speed: 1.12, build: 0.88,
    weapons: ['smg', 'kv', 'zu9', 'sniper', 'lever'], sidearms: ['pistol', 'mp', 'revolver', 'hc50'],
    abilities: ['grapple', 'tether', 'dash', 'cloak'], heavies: ['dronepod', 'swarmpod', 'mines'],
    color: [0.15, 0.55, 1],
    skin: { skin: [0.78, 0.57, 0.42], top: [0.13, 0.14, 0.17], zip: true, logo: [0.25, 0.65, 1], bottom: [0.07, 0.07, 0.085], shoes: [0.92, 0.92, 0.94],
      gloves: [0.78, 0.57, 0.42], accent: [0.25, 0.65, 1], kneeCol: [0.1, 0.1, 0.11], legStyle: 'slim', shoeStyle: 'kicks', head: 'cap', headCol: [0.15, 0.5, 0.95], hair: [0.08, 0.06, 0.05] },
  },
  medium: {
    name: 'MEDIUM', tag: 'BALANCED · VERSATILE',
    desc: 'Good at everything, best at staying in the fight. The backbone of any team.',
    hp: 250, speed: 1, build: 1,
    weapons: ['ar', 'burst', 'hx17', 'bullpup', 'dmr', 'shotgun', 'rt7', 'double'], sidearms: ['pistol', 'revolver', 'hc50'],
    abilities: ['pad', 'launchpad', 'heal'], heavies: ['gl_frag', 'gl_sticky', 'gl_fire', 'gl_cluster'],
    color: [0.92, 0.1, 0.08],
    skin: { skin: [0.86, 0.66, 0.54], top: [0.12, 0.14, 0.21], zip: true, logo: [1, 0.72, 0.12], bottom: [0.06, 0.06, 0.075], shoes: [0.07, 0.07, 0.08],
      gloves: [0.86, 0.66, 0.54], accent: [0.92, 0.1, 0.08], kneeCol: [0.08, 0.08, 0.1], legStyle: 'slim', shoeStyle: 'kicks', head: 'hair', hair: [0.22, 0.14, 0.08] },
  },
  heavy: {
    name: 'HEAVY', tag: 'TOUGH · SLOW · LOUD',
    desc: 'A walking wall. Soaks up damage and turns cover into rubble.',
    hp: 350, speed: 0.86, build: 1.28,
    weapons: ['lmg', 'rk74', 'minigun', 'amr', 'autoshotgun', 'shotgun'], sidearms: ['revolver', 'hc50', 'pistol'],
    abilities: ['barricade', 'lowwall', 'slam'], heavies: ['turret_mg', 'turret_heavy', 'turret_flame'],
    color: [1, 0.68, 0.08],
    skin: { skin: [0.93, 0.76, 0.64], top: [0.1, 0.1, 0.11], vest: [0.95, 0.66, 0.1], bottom: [0.11, 0.11, 0.12], shoes: [0.08, 0.08, 0.09],
      gloves: [0.1, 0.1, 0.11], accent: [1, 0.68, 0.08], kneeCol: [0.12, 0.12, 0.13], kneePads: true, legStyle: 'cargo', shoeStyle: 'boot', gloveStyle: 'tactical', head: 'mask', headCol: [0.1, 0.1, 0.11], visor: [1, 0.68, 0.08], scarf: [0.1, 0.1, 0.11] },
  },
};
export const CLASS_ORDER = ['light', 'medium', 'heavy'];

const KEY = 'semifinals.loadout';
export function loadLoadout() {
  const def = {
    cls: 'medium',
    light: { weapon: 'smg', sidearm: 'pistol', ability: 'grapple', heavy: 'dronepod', throwable: 'flash' },
    medium: { weapon: 'ar', sidearm: 'pistol', ability: 'pad', heavy: 'gl_frag', throwable: 'smoke' },
    heavy: { weapon: 'lmg', sidearm: 'revolver', ability: 'barricade', heavy: 'turret_mg', throwable: 'frag' },
  };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && CLASSES[s.cls]) {
      for (const c of CLASS_ORDER) {
        if (s[c] && CLASSES[c].weapons.includes(s[c].weapon)) def[c].weapon = s[c].weapon;
        if (s[c] && CLASSES[c].abilities.includes(s[c].ability)) def[c].ability = s[c].ability;
        if (s[c] && CLASSES[c].sidearms.includes(s[c].sidearm)) def[c].sidearm = s[c].sidearm;
        if (s[c] && CLASSES[c].heavies.includes(s[c].heavy)) def[c].heavy = s[c].heavy;
        if (s[c] && THROWABLES[s[c].throwable]) def[c].throwable = s[c].throwable;
      }
      def.cls = s.cls;
    }
  } catch { /* ignore */ }
  return def;
}
export function saveLoadout(lo) { try { localStorage.setItem(KEY, JSON.stringify(lo)); } catch { /* ignore */ } }
