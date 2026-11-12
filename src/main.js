import { Renderer } from './renderer.js';
import { World, moveBoxTo } from './world.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Weapon, setHandLook } from './weapon.js';
import { WEAPONS, CASE_ORDER } from './weapons.js';
import { Effects } from './effects.js';
import { Sounds } from './audio.js';
import { Dummy, DestructibleWall, Workbench, gunCrates } from './props.js';
import { mat4, perspective, lookDir, mul, cross, norm, damp, dot, compose, anglesFor, clamp } from './math.js';
import { buildDef, ratings } from './attachments.js';
import { CLASSES, CLASS_ORDER, ABILITIES, HEAVIES, SIDEARMS, loadLoadout, saveLoadout } from './classes.js';
import { Contestant } from './contestant.js';
import { Thumbs } from './thumbs.js';
import { SLOTS as CSLOTS, RARITY, ITEMS, FEATURED, CURRENCY, loadCosmetics, saveCosmetics, owns, itemsFor, buy, buildOutfit, gunSkinFor, skinDef, swatch, iconFor } from './cosmetics.js';
import { Bench } from './bench.js';
import { anchorsFor, optionsFor, SLOTS } from './attachments.js';
const benchPV = mat4();
import testRange from './maps/testRange.js';
import { ARENAS } from './maps/arenas.js';
import { Course, fmtTime } from './course.js';
import { Elevator } from './elevator.js';
import { BotManager } from './bots.js';
import { Matchmaking } from './matchmaking.js';
import { Deathmatch } from './tdm.js';
import { Lobby } from './net.js';
import { StaticBatches } from './batch.js';
import { Gadgets, ropeParts, hookParts, BARRICADE, BLOCKADE, TETHER_COL } from './gadgets.js';
import { Heavy, HEAVY_STATS, TETHER } from './heavy.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');

let renderer;
try {
  renderer = new Renderer(canvas);
} catch (e) {
  $('menu').classList.add('hidden');
  $('error').textContent = `Couldn't start WebGL2: ${e.message}`;
  $('error').classList.remove('hidden');
  throw e;
}

// ---------- settings ----------
const settings = { sens: 1.0, fov: 95, volume: 0.5, aimKey: 'KeyV', fireKey: 'KeyF', aimMode: 'hold', trackpad: false, dashKey: 'KeyQ', grappleKey: 'KeyG', slamKey: 'KeyZ', abilityKey: 'KeyG', heavyKey: 'KeyQ' };
try { Object.assign(settings, JSON.parse(localStorage.getItem('semifinals.settings') || '{}')); } catch { /* ignore */ }
if (!settings.keysV2) { settings.abilityKey = 'KeyG'; settings.heavyKey = 'KeyQ'; settings.keysV2 = true; }   // build 0.41: ability on G, heavy weapon on Q
const saveSettings = () => { try { localStorage.setItem('semifinals.settings', JSON.stringify(settings)); } catch { /* ignore */ } };

// ---------- game objects ----------
const world = new World();
const batches = new StaticBatches(renderer);      // static scenery batches, made on the first frame
// which arena a box is in (its index in ARENAS), or -1 for the practice range
const zoneOf = (b) => {
  const c = b.center;
  for (let i = 0; i < ARENAS.length; i++) {
    const SA = ARENAS[i].area;
    if (c[0] > SA.min[0] && c[0] < SA.max[0] && c[1] > SA.min[1] && c[1] < SA.max[1] && c[2] > SA.min[2] && c[2] < SA.max[2]) return i;
  }
  return -1;
};
const effects = new Effects(world);
const input = new Input(canvas);
const sounds = new Sounds();
const gadgets = new Gadgets(world, effects, sounds);     // barricades, pads, drone pods, turret bases
// heavy weapons: drones, grenades, fire pools, turret brains. Hooks tie them to whoever you can hurt.
const heavy = new Heavy(world, effects, sounds, gadgets, {
  targets: (side) => (side && side !== true ? agentTargets(side) : enemyTargets()),
  hit: (ref, dmg, point, dir, name, side) => {
    if (side && side !== true) botGearHit(side, ref, dmg, point, dir);
    else hitTarget(ref, dmg, false, point, dir, name);
  },
  ignite: (ref, burn, name, side) => {
    if (side && side !== true) { if (ref.isPlayer) playerBurn = { t: burn.dur, dps: burn.dps, by: side, acc: 0 }; else botGearHit(side, ref, Math.round(burn.dps * burn.dur * 0.5), [ref.pos[0], ref.pos[1] + 1.2, ref.pos[2]], [0, 0, 0]); }
    else ignite(ref, burn, name);
  },
  gadgetHit: (g, dmg) => gadgetHit(g, dmg),
  me: () => myGadgetOwner(),
  myTeam: () => (tdm.active ? tdm.myTeam?.idx ?? -1 : -1),
  send: (m) => { if (online.active) online.send({ ...m, id: online.myId }); },
  playerPos: () => player.pos,
  remotePos: (id) => online.byId?.(id)?.bot?.pos,
  // I tethered another player: their game holds them in place
  onTether: (ref, a, len, dur) => { if (ref.remote && online.active) online.send({ t: 'teth', id: online.myId, who: ref.remote.id, a: a.map((v) => +v.toFixed(2)), len, dur }); },
  // someone tethered me
  tetherMe: (a, len, dur) => {
    playerTether = { anchor: a, len, t: dur };
    if (player.grapple) player.releaseGrapple(false);
    banner('TETHERED', 'YOU ARE TIED DOWN', 'bad', 1.2);
  },
  shake: (pos, r) => {
    const d = Math.hypot(player.pos[0] - pos[0], player.pos[1] - pos[1], player.pos[2] - pos[2]);
    if (d < r * 5) { player.shake = Math.max(player.shake || 0, 0.6 * (1 - d / (r * 5))); player.camPitchV += 0.6 * (1 - d / (r * 5)); }
  },
});
// a bot's gear (turret, drone, grenade, mine, tether) can hurt the player and the other team's bots
const playerRef = { isPlayer: true, get pos() { return player.pos; }, get alive() { return !player.dead; } };
let playerBurn = null;          // set on fire by a bot's gear: { t, dps, by, acc }
function agentTargets(agent) {
  const out = [];
  if (!tdm.active || tdm === online || !inStadium()) return out;
  const add = (ref, pos) => out.push({ ref, pos, chest: [pos[0], pos[1] + 1.2, pos[2]] });
  if (!player.dead && tdm.myTeam !== agent.team && !(cloakT > 0)) add(playerRef, player.pos);
  for (const a of tdm.agents) if (a.team !== agent.team && a.bot && a.bot.alive) add(a.bot, a.bot.pos);
  return out;
}
function botGearHit(agent, ref, dmg, point, dir) {
  if (ref.isPlayer) { player.lastHitBy = agent; damagePlayer(dmg, agent.pos || point, agent.name); return; }
  if (ref.agent) ref.agent.lastHitBy = agent;
  ref.damage(dmg, dir);
}
// everyone your heavy weapons can hurt right now: the other team in a match, the dummies in the range
function enemyTargets() {
  const out = [];
  const add = (ref) => { if (ref && ref.alive && ref.pos) out.push({ ref, pos: ref.pos, chest: [ref.pos[0], ref.pos[1] + 1.2, ref.pos[2]] }); };
  if (tdm.active) { if (inStadium()) for (const a of tdm.agents) if (a.bot && a.bot.team !== tdm.myTeam?.idx) add(a.bot); }
  else dummies.forEach(add);
  return out;
}
const applyBinds = () => { input.binds = { aim: settings.aimKey, fire: settings.fireKey }; input.aimMode = settings.aimMode; input.trackpad = !!settings.trackpad; };
applyBinds();
sounds.setVolume(settings.volume);
const player = new Player(world);
const map = testRange;
map.build(world);
for (const a of ARENAS) a.build(world);    // the semi-finals arenas, far away (PLAY on the home screen)
let stadium = ARENAS[0];                   // the arena the current match is in
const dummies = [...map.dummies].map((d) => new Dummy(world, effects, d.pos, d.move));
const walls = [...map.walls].map((w) => new DestructibleWall(world, effects, w.origin, w));
// attachments: one saved loadout per weapon
const classLo = loadLoadout();
let loadouts = {};
try { loadouts = JSON.parse(localStorage.getItem('semifinals.loadouts') || '{}') || {}; } catch { /* ignore */ }
const cosmetics = loadCosmetics();
setHandLook(buildOutfit(cosmetics, classLo.cls));
let skinClass = null;    // class whose weapon skin to show (defaults to the active class)
const defFor = (id) => skinDef(buildDef(WEAPONS[id], loadouts[id] || {}), gunSkinFor(cosmetics, skinClass || classLo.cls));
const cases = gunCrates(world, CASE_ORDER.map((id) => defFor(id)), map.bench.pos);   // guns jammed in two crates by the workbench
const workbench = new Workbench(world, map.bench.pos);
player.spawn(map.spawn.pos, map.spawn.yaw);
const course = new Course(map.course, sounds);
const elevator = new Elevator(world, map.elevator);
const lifts = [];        // (no lifts in the arenas)
const ai = new Deathmatch(world);           // team deathmatch against the AI
let tdm = ai;                               // the match being played: the AI one, or an online one
let where = 'range';       // 'range' or 'stadium'
const inStadium = () => where === 'stadium';
let padCd = 0, voidT = 0;
const botMgr = new BotManager(world, map.deck, map.deckRefs);
// player health (the player object only knows movement)
Object.assign(player, { hp: 150, maxHp: 150, dead: false, hurtT: 9, invuln: 0, press: null });

// two weapon slots: primary + sidearm
const slots = [new Weapon(defFor('ar')), new Weapon(defFor('pistol'))];
let current = 0;
let lastSlot = 1;
let launcherW = null, launcherKind = null, launcherT = 0;     // the grenade / tether launcher while it's out
let playerTether = null;          // an enemy's tether holding you: { anchor, len, t }
const weapon = () => launcherW || slots[current];

function switchTo(i) {
  if (launcherW) putAwayLauncher(false);
  if (i === current || !slots[i]) return;
  input.aimToggled = false;
  lastSlot = current;
  current = i;
  weapon().equip();
  sounds.swap();
  updateSlotHud();
}

// one primary and one sidearm: a sidearm always goes in slot 2, anything else replaces your primary
function pickUp(caseDef) {
  if (launcherW) putAwayLauncher(false);
  const def = defFor(caseDef.id);
  const slot = SIDEARMS.includes(def.id) ? 1 : 0;
  if (slots[slot].def.id === def.id) { slots[slot].ammo = def.mag; if (current !== slot) switchTo(slot); else weapon().equip(); sounds.pickup(); return; }
  slots[slot] = new Weapon(def);
  if (current !== slot) { lastSlot = current; current = slot; }
  slots[slot].equip();
  sounds.pickup();
  updateSlotHud();
}

// ---------- classes (chosen in the Armoury) ----------
// (classLo is hoisted into a var-like holder so defFor can be used while the file loads)
let equippedAbility = classLo[classLo.cls].ability;
let equippedHeavy = classLo[classLo.cls].heavy;
let heavyCd = 0;
let classDirty = true;          // class changed since the current test-range session started
function classWeapons() {
  const sel = classLo[classLo.cls];
  return [sel.weapon, sel.sidearm];
}
function applyClass() {
  const c = CLASSES[classLo.cls];
  Object.assign(player, { maxHp: c.hp, hp: c.hp, speedMul: c.speed });
  const [a, b] = classWeapons();
  slots[0] = new Weapon(defFor(a));
  slots[1] = new Weapon(defFor(b));
  current = 0; lastSlot = 1;
  equippedAbility = classLo[classLo.cls].ability;
  equippedHeavy = classLo[classLo.cls].heavy;
  heavyCd = 0;
  launcherW = null;
  setHandLook(buildOutfit(cosmetics, classLo.cls));
  player.resetAbilities?.();
  updateSlotHud();
  classDirty = false;
}

// called by the workbench when a loadout changes
function applyLoadout(id, lo) {
  loadouts[id] = lo;
  try { localStorage.setItem('semifinals.loadouts', JSON.stringify(loadouts)); } catch { /* ignore */ }
  const def = defFor(id);
  slots.forEach((w) => { if (w.def.id === id) w.setDef(def); });
  cases.forEach((c) => { if (c.def?.id === id) c.def = def; });
  updateSlotHud();
}

const stats = { shots: 0, hits: 0, kills: 0, chunks: 0 };
const damageNumbers = [];

function resetRange() {
  course.reset();
  botMgr.stop();
  map.deckRefs.screen.color = [0.15, 0.4, 0.9];
  Object.assign(player, { hp: player.maxHp, dead: false, press: null });
  cutscene = null; pressSeq = null;
  dummies.forEach((d) => d.reset());
  walls.forEach((w) => w.reset());
  effects.clear();
  Object.assign(stats, { shots: 0, hits: 0, kills: 0, chunks: 0 });
  player.respawn();
  slots.forEach((w) => { w.ammo = w.def.mag; w.reload = null; });
}

// ---------- camera basis (shared by shooting + viewmodel->world conversions) ----------
let camEye = [0, 0, 0], camFwd = [0, 0, -1], camRight = [1, 0, 0], camUp = [0, 1, 0];
function updateCamera() {
  const w = weapon();
  camEye = player.eye();
  camFwd = player.forward(w.kick, w.kickYaw);
  if (player.dead) {
    // slump to the floor and tip over
    const k = Math.min(1, (3 - deathT) / 0.6);
    camEye = [camEye[0], camEye[1] - k * (player.eyeH - 0.35), camEye[2]];
  }
  if (cutscene) { const c = cutsceneCam(); camEye = c.eye; camFwd = c.fwd; }
  camRight = norm(cross(camFwd, [0, 1, 0]));
  camUp = cross(camRight, camFwd);
  // apply roll to the basis so tracers/casings line up with what you see
  const roll = cutscene ? 0 : player.dead ? player.roll + Math.min(1, (3 - deathT) / 0.6) * 0.9 : player.roll;
  const c = Math.cos(roll), s = Math.sin(roll);
  const r2 = [0, 1, 2].map((k) => camRight[k] * c + camUp[k] * s);
  camUp = [0, 1, 2].map((k) => camUp[k] * c - camRight[k] * s);
  camRight = r2;
}
// The gun is drawn by its own camera (58° FOV, half the roll), so a gun-space point must go
// through the screen to land in the world where you actually see it.
const vmProjM = mat4(), vmViewM = mat4();
let worldVfov = 1.4, worldAspect = 1.7;
function vmToWorld(p) {
  const v = [
    vmViewM[0] * p[0] + vmViewM[4] * p[1] + vmViewM[8] * p[2] + vmViewM[12],
    vmViewM[1] * p[0] + vmViewM[5] * p[1] + vmViewM[9] * p[2] + vmViewM[13],
    vmViewM[2] * p[0] + vmViewM[6] * p[1] + vmViewM[10] * p[2] + vmViewM[14],
  ];
  const depth = Math.max(-v[2], 0.02);
  const nx = (vmProjM[0] * v[0]) / depth, ny = (vmProjM[5] * v[1]) / depth;   // NDC
  const th = Math.tan(worldVfov / 2);
  return [0, 1, 2].map((k) => camEye[k] + (camFwd[k] + camRight[k] * nx * th * worldAspect + camUp[k] * ny * th) * depth);
}
const viewToWorld = (p) => [0, 1, 2].map((k) => camEye[k] + camRight[k] * p[0] + camUp[k] * p[1] - camFwd[k] * p[2]);
const viewDirToWorld = (v) => [0, 1, 2].map((k) => camRight[k] * v[0] + camUp[k] * v[1] - camFwd[k] * v[2]);

// ---------- shooting ----------
function fire(w) {
  const d = w.def;
  updateCamera();
  const spread = w.spread(player);
  const hipT = 1 - w.adsT;
  const muzzle = vmToWorld(w.gunPoint(d.muzzle));
  if (d.launcher) {
    const bolt = launcherKind === 'tether';
    const v = camFwd.map((c, i) => c * (bolt ? 42 : 30) + (i === 1 ? (bolt ? 1 : 2.5) : 0) + player.vel[i] * 0.3);
    heavy.launch(launcherKind, muzzle, v, true, HEAVY_STATS[launcherKind].name);
    launcherT = 0.55;
    return;
  }
  stats.shots++;
  if (cloakT > 0) { cloakT = 0; sounds.cloak?.(); }

  const perDummy = new Map();
  let anyHit = false;
  if (tdm.active && inStadium()) tdm.heard(tdm.you, camEye);      // the enemy hears your shots
  for (let i = 0; i < d.pellets; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = spread * (d.pellets > 1 ? Math.sqrt(Math.random()) : Math.sqrt(Math.random()));
    const dir = norm([0, 1, 2].map((k) => camFwd[k] + camRight[k] * Math.cos(a) * r + camUp[k] * Math.sin(a) * r));
    // bullets smash glass and carry on through it
    let o = camEye, left = 300, hit = null;
    for (let k = 0; k < 4; k++) {
      hit = world.raycast(o, dir, left);
      if (hit && hit.box.tag === 'glass') { breakGlass(hit.box, dir); o = hit.point.map((c, j) => c + dir[j] * 0.02); left -= hit.t; hit = null; continue; }
      break;
    }
    const end = hit ? hit.point : [0, 1, 2].map((k) => o[k] + dir[k] * left);
    if (i < 4) effects.tracer(muzzle, end);
    if (i === 0 && online.active) online.myShot(muzzle, end);
    if (!hit) continue;
    const b = hit.box;
    if (b.tag === 'bot' && tdm.active && b.ref.team === tdm.myTeam.idx) continue;   // no friendly fire
    if (b.tag === 'dummy' || b.tag === 'bot') {
      // damage falls off past the weapon's range (down to 55% at 2.2x range)
      const fall = 1 - 0.45 * clamp((hit.t - d.range) / (d.range * 1.2), 0, 1);
      const dmg = Math.round(d.dmg * (b.head ? d.headMult : 1) * fall);
      const e = perDummy.get(b.ref) || { dmg: 0, head: false, point: hit.point, dir };
      e.dmg += dmg;
      e.head = e.head || b.head;
      perDummy.set(b.ref, e);
      anyHit = true;
    } else if (b.tag === 'barricade' || (b.ref && b.ref.k && b.ref.hp != null)) {
      // gadgets (barricades, turrets, pods, mines, stations): sparks, and a hit unless it's your own team's
      const g = b.ref;
      if (!(tdm.active && g.team === tdm.myTeam?.idx)) {
        const fall = 1 - 0.45 * clamp((hit.t - d.range) / (d.range * 1.2), 0, 1);
        gadgetHit(g, Math.round(d.dmg * fall));
      }
      effects.impact(hit.point, hit.normal, [1, 0.8, 0.45]);
      if (i === 0) sounds.barricadeHit();
    } else if (b.tag === 'chunk') {
      stats.chunks += b.ref.hit(b, dir);
      if (i === 0) sounds.crumble();
    } else {
      effects.impact(hit.point, hit.normal, b.color);
      effects.decal(hit.point, hit.normal);
      if (d.burn && i < 3) for (let k = 0; k < 3; k++) effects.flame(hit.point.map((c, j) => c + hit.normal[j] * 0.05));
    }
  }
  if (anyHit) stats.hits++;
  // dragon's breath: a jet of fire out of the muzzle
  if (d.flame) {
    for (let k = 0; k < 34; k++) {
      const sp = 8 + Math.random() * 14, j = () => (Math.random() - 0.5) * 2.6;
      effects.flame(muzzle.map((c, i) => c + camFwd[i] * Math.random() * 0.3), [camFwd[0] * sp + j(), camFwd[1] * sp + j() - 1.2, camFwd[2] * sp + j()], 1.6 + Math.random() * 1.4);
    }
  }
  for (const [dummy, e] of perDummy) {
    if (!dummy.alive) continue;
    hitTarget(dummy, e.dmg, e.head, e.point, e.dir, d.name);
    if (d.burn && dummy.alive) ignite(dummy, d.burn, d.name);
  }
}

// apply your damage to a target (a range dummy, a bot, or another player online)
function hitTarget(dummy, dmg, head, point, dir, wname, burn = false) {
  const num = { pos: [...point], amount: dmg, head, burn, t: 0, el: null, drift: Math.random() - 0.5 };
  if (dummy.remote) {
    // another player online: tell them; they take the damage on their side
    online.myHit(dummy.remote, dmg, head, camEye);
    if (!burn) showHitmarker(false, head);
    damageNumbers.push(num);
    return;
  }
  if (dummy.agent) dummy.agent.lastHitBy = tdm.you;      // deathmatch kill credit
  const dead = dummy.damage(dmg, dir);
  if (dead) { stats.kills++; burning.delete(dummy); }
  if (dead && dummy.name) killFeed('YOU', burn ? `${wname} 🔥` : wname, dummy.name, head);
  if (!burn || dead) showHitmarker(dead, head);
  damageNumbers.push(num);
  if (dead) sounds.kill(); else if (!burn) sounds.hit();
}

// ---------- fire: incendiary rounds and dragon's breath set what they hit alight ----------
const burning = new Map();   // target -> { t, dps, acc, tick, name }
function ignite(target, burn, name) {
  const b = burning.get(target);
  if (b) { b.t = Math.max(b.t, burn.dur); b.dps = Math.max(b.dps, burn.dps); return; }
  burning.set(target, { t: burn.dur, dps: burn.dps, acc: 0, tick: 0, name });
  sounds.ignite?.();
}
function updateBurns(dt) {
  for (const [tg, b] of burning) {
    if (!tg.alive || b.t <= 0) { burning.delete(tg); continue; }
    const step = Math.min(dt, b.t);
    b.t -= dt; b.acc += b.dps * step; b.tick += dt;
    // flames licking up the body
    const n = Math.min(4, Math.floor(dt * 45 + Math.random()));
    for (let k = 0; k < n; k++) effects.flame([tg.pos[0] + (Math.random() - 0.5) * 0.45, tg.pos[1] + 0.15 + Math.random() * 1.5, tg.pos[2] + (Math.random() - 0.5) * 0.45], [0, 0.4, 0], 1.6 + Math.random());
    if (b.tick >= 0.4 || b.t <= 0) {
      b.tick = 0;
      const dmg = Math.round(b.acc);
      b.acc -= dmg;
      if (dmg > 0) hitTarget(tg, dmg, false, [tg.pos[0], tg.pos[1] + 1.3, tg.pos[2]], [0, 0, 0], b.name, true);
    }
  }
}

function handleWeaponEvents(w) {
  for (const ev of w.events) {
    if (ev.type === 'eject') {
      const v = viewDirToWorld(ev.vel);
      const pv = player.vel;
      effects.casing(vmToWorld(ev.pos), [v[0] + pv[0], v[1] + pv[1] * 0.5, v[2] + pv[2]]);
    } else if (ev.type === 'magdrop' && ev.part) {
      // the old mag gets flung out with a spin
      const pv = player.vel, fv = viewDirToWorld([0.9 + Math.random() * 0.6, -0.8, 0.5]);
      effects.spawnPiece(vmToWorld(ev.pos), ev.part.s, [pv[0] * 0.8 + fv[0] * 2.2, fv[1] * 2 + 0.6, pv[2] * 0.8 + fv[2] * 2.2], ev.part.col, 6);
      const m = effects.debris[effects.debris.length - 1];
      if (m) m.spin = m.spin.map(() => (Math.random() - 0.5) * 26);
    } else if (ev.type === 'jolt') {
      player.camPitchV += ev.amt * 0.45;
      player.landV -= ev.amt * 0.12;
    }
  }
  w.events.length = 0;
}

function handlePlayerEvents() {
  for (const ev of player.events) {
    if (ev === 'jump') sounds.jump();
    else if (ev === 'land') { sounds.land(); effects.dust(player.pos, 4); }
    else if (ev === 'slide') { sounds.slide(); effects.dust(player.pos, 5, player.vel); }
    else if (ev === 'mantle') sounds.mantle();
    else if (ev === 'vault') { sounds.vault(); effects.dust(player.pos, 3, player.vel); }
    else if (ev === 'vaultland') { sounds.land(); effects.dust(player.pos, 3, player.vel); }
    else if (ev === 'step') sounds.step(player.crouching ? 0.22 : player.sprinting ? 1 : 0.6);
    else if (ev === 'wallstep') sounds.wallStep();
    else if (ev === 'wallrun') sounds.wallRun();
    else if (ev === 'walljump') { sounds.wallJump(); effects.dust(player.eye(), 3, player.vel); }
    else if (ev === 'grab') sounds.grab();
    else if (ev === 'chain') sounds.chain(player.chain);
    else if (ev === 'dash') { sounds.dash(); effects.dust(player.pos, 4, player.vel); }
    else if (ev === 'dashready') sounds.dashReady();
    else if (ev === 'grapplefire') sounds.grappleFire();
    else if (ev === 'grapplehit') { sounds.grappleHit(); if (player.grapple) effects.impact(player.grapple.point, player.grapple.normal, [0.6, 0.6, 0.62]); }
    else if (ev === 'grapplerelease') sounds.grappleRelease();
    else if (ev === 'grapplemiss') sounds.grappleMiss();
    else if (ev === 'slamleap') sounds.slamLeap();
    else if (ev === 'slamdive') sounds.slamDive();
    else if (ev === 'slam') slamShockwave(player.slamHit);
  }
  player.events.length = 0;
  if (player.sliding && player.grounded && Math.random() < 0.5) effects.dust(player.pos, 1, player.vel);
}

// ground slam: damage dummies and break wall chunks in a radius
function slamShockwave(h) {
  if (!h) return;
  player.slamHit = null;
  const R = 4.2 * Math.sqrt(h.power), p = h.pos;
  sounds.slam(h.power);
  // ring of dust + chunks thrown out
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2, r = 0.6 + Math.random() * 0.5;
    const dir = [Math.cos(a), 0, Math.sin(a)];
    effects.dust([p[0] + dir[0] * r, p[1], p[2] + dir[2] * r], 1, [dir[0] * 14, 0, dir[2] * 14]);
    if (i % 3 === 0) {
      const sz = 0.06 + Math.random() * 0.08;
      effects.spawnPiece([p[0] + dir[0] * r, p[1] + 0.1, p[2] + dir[2] * r], [sz, sz, sz],
        [dir[0] * (4 + Math.random() * 4), 3 + Math.random() * 4, dir[2] * (4 + Math.random() * 4)], [0.55, 0.55, 0.58], 1.2);
    }
  }
  const victims = tdm.active ? enemyTargets().map((t) => t.ref) : [...dummies, ...botMgr.bots.filter((b) => b.visible)];
  for (const d of victims) {
    if (!d.alive) continue;
    const dx = d.pos[0] - p[0], dy = d.pos[1] - p[1], dz = d.pos[2] - p[2];
    const dist = Math.hypot(dx, dz);
    if (dist > R || Math.abs(dy) > 2.5) continue;
    const dmg = Math.round((25 + 65 * (1 - dist / R)) * h.power);
    hitTarget(d, dmg, false, [d.pos[0], d.pos[1] + 1.6, d.pos[2]], norm([dx || 0.01, 0.6, dz || 0.01]), 'SLAM');
  }
  for (const w of walls) {
    for (const row of w.cells) for (const b of row) {
      if (!b) continue;
      const dx = b.center[0] - p[0], dy = b.center[1] - p[1], dz = b.center[2] - p[2];
      const dist = Math.hypot(dx, dy * 1.4, dz);
      if (dist < R * 0.75) stats.chunks += w.hit(b, norm([dx, 0.4, dz]));
    }
  }
  // the shockwave blows out nearby windows
  for (const g of stadium.glassBoxes) {
    if (!g.world) continue;
    const dx = g.center[0] - p[0], dy = g.center[1] - p[1], dz = g.center[2] - p[2];
    if (Math.hypot(dx, dz) < R + 2 && dy > -3 && dy < 5) breakGlass(g, norm([dx, 0.5, dz]));
  }
}

// ---------- breakable glass ----------
const GLASS_SHARD = [0.72, 0.86, 0.93];
function breakGlass(b, dir = [0, 0, 0]) {
  if (!b.world) return;
  world.remove(b);
  const n = Math.min(26, 8 + Math.round(b.scale[0] * b.scale[1] * b.scale[2] * 0 + (b.scale[0] + b.scale[2]) * b.scale[1] * 1.2));
  for (let i = 0; i < n; i++) {
    const p = [b.min[0] + Math.random() * b.scale[0], b.min[1] + Math.random() * b.scale[1], b.min[2] + Math.random() * b.scale[2]];
    const s = 0.06 + Math.random() * 0.26, s2 = 0.06 + Math.random() * 0.26;
    const thin = b.scale[0] < b.scale[2] ? [0.025, s, s2] : b.scale[1] < 0.2 ? [s, 0.025, s2] : [s, s2, 0.025];
    const v = [dir[0] * 5 + (Math.random() - 0.5) * 3, dir[1] * 3 + Math.random() * 2, dir[2] * 5 + (Math.random() - 0.5) * 3];
    effects.spawnPiece(p, thin, v, GLASS_SHARD, 1.4 + Math.random() * 1.2, 0.25);
  }
  sounds.glass?.();
}
function resetGlass() {
  for (const g of stadium.glassBoxes) if (g.world) world.remove(g);
  stadium.glassBoxes = stadium.spawnGlass(world);
}
// the lift button you're looking at (within reach)
function lookLiftButton() {
  const hit = world.raycast(player.eye(), player.forward(), 3.2, false);
  return hit && hit.box.tag === 'liftbtn' ? hit.box.ref : null;
}

// ---------- combat deck: health, bots, console, cutscene ----------
let deathT = 0, killer = '', slowmo = 0, cutscene = null, pressSeq = null;
const dmgDirs = [];
const kills = [];

function killFeed(a, weaponName, b, head) {
  kills.unshift({ a, w: weaponName, b, head, t: 0 });
  if (kills.length > 5) kills.pop();
  renderKillFeed();
}

function damagePlayer(amount, from, name) {
  if (player.dead || player.invuln > 0 || cutscene) return;
  player.hp -= amount;
  player.hurtT = 0;
  sounds.hurt();
  player.camPitchV += (Math.random() - 0.3) * 0.5;
  player.shake = Math.max(player.shake, 0.22);
  const dx = from[0] - player.pos[0], dz = from[2] - player.pos[2];
  dmgDirs.push({ ang: Math.atan2(-dx, -dz), t: 0 });
  if (dmgDirs.length > 6) dmgDirs.shift();
  if (player.hp <= 0) die(name);
}

function die(name) {
  if (online.active && tdm === online) online.myDeath(typeof player.lastHitBy === 'string' ? player.lastHitBy : null);
  player.hp = 0;
  player.dead = true;
  deathT = 3;
  killer = name;
  sounds.death();
  killFeed(name, 'RIFLE', 'YOU', false);
  player.cancelAbilities();
  player.vel = [0, 0, 0];
}

function respawnPlayer() {
  fallTop = null;
  const A = map.deck.area, P = player.pos;
  const onDeck = botMgr.running || (P[0] > A.min[0] && P[0] < A.max[0] && P[1] > A.min[1] && P[1] < A.max[1] && P[2] > A.min[2] && P[2] < A.max[2]);
  const r = onDeck ? map.deck.respawn : { pos: player.spawnPoint, yaw: player.spawnYaw };
  player.teleport(r.pos, r.yaw);
  Object.assign(player, { hp: player.maxHp, dead: false, invuln: 1.5 });
  slots.forEach((w) => { w.ammo = w.def.mag; w.reload = null; });
  weapon().equip();
}

const botHooks = {
  player,
  hitPlayer: (dmg, bot, from) => { player.lastHitBy = bot.agent || null; damagePlayer(dmg, from, bot.name); },
  shot: (bot, from, end, dist) => { effects.tracer(from, end); sounds.botShot(dist); },
  impact: (hit, u) => {
    if (hit.box.tag === 'glass') { breakGlass(hit.box, u || [0, 0, 0]); return; }
    if (hit.box.tag === 'barricade') { gadgets.damage(hit.box.ref, 16); effects.impact(hit.point, hit.normal, [1, 0.8, 0.45]); return; }
    effects.impact(hit.point, hit.normal, hit.box.color); if (hit.box.tag !== 'chunk') effects.decal(hit.point, hit.normal);
  },
  onBotKill: (killer, victim) => { killFeed(killer.name, 'RIFLE', victim.name, false); },
  // a bot uses its gear: returns how long until it thinks about it again
  botGear: (agent, tgt, dist, hurting) => {
    const c = CLASSES[agent.cls] || CLASSES.medium;
    agent.gear ??= c.heavies[Math.floor(Math.random() * c.heavies.length)];
    const b = agent.bot, p = agent.pos, chest = [tgt.pos[0], tgt.pos[1] + 1.2, tgt.pos[2]];
    const yaw = Math.atan2(-(tgt.pos[0] - p[0]), -(tgt.pos[2] - p[2]));
    const spec = (o) => ({ gid: gadgets.newId(agent.name), owner: agent.name, team: agent.team.idx, teamCol: agent.team.rgb, side: agent, ...o });
    const lob = (kind, speed) => {
      // a lobbed shot that lands on them (a little off, like a person)
      const from = b.muzzle(), dx = chest[0] - from[0], dz = chest[2] - from[2], dy = chest[1] - from[1], h = Math.hypot(dx, dz);
      const T = h / speed, gk = (HEAVY_STATS[kind].grav ?? 1) * 14, err = 1 + (Math.random() - 0.5) * 0.18;
      heavy.launch(kind, from, [dx / T * err, (dy + 0.5 * gk * T * T) / T, dz / T * err], agent, HEAVY_STATS[kind].name);
    };
    if (agent.cls === 'medium' && hurting && agent.hpFrac < 0.5 && !(agent.healCd > time)) {
      const sp = gadgets.padSpot([p[0], p[1] + 1.5, p[2]], [0, -1, 0], p, 0.35);
      if (sp) { gadgets.place(spec({ k: 'heal', ax: 0, ...sp })); agent.healCd = time + 22; return 3; }
    }
    if (agent.cls === 'light' && dist > 5 && dist < 22 && !(agent.tetherCd > time) && Math.random() < 0.5) {
      lob('tether', 36); agent.tetherCd = time + 12; return 3;
    }
    const id = agent.gear;
    if (id.startsWith('gl_')) {
      if (dist < 6 || dist > 34) return 1;
      lob(id, 24);
      return HEAVY_STATS[id].cd + Math.random() * 6;
    }
    if (id === 'dronepod' || id === 'swarmpod') {
      if (dist > 30) return 1;
      const sp = gadgets.padSpot([p[0], p[1] + 1.5, p[2]], [0, -1, 0], p, 0.35);
      if (!sp) return 2;
      gadgets.place(spec({ k: 'pod', v: id === 'swarmpod' ? 'swarm' : undefined, ax: 0, ...sp }));
      return HEAVY_STATS[id].cd + Math.random() * 8;
    }
    if (id === 'mines') {
      if (dist > 20 || !hurting) return 2;          // drop them when falling back
      let n = 0;
      for (const k of [-1, 0, 1]) {
        const a = yaw + k * 0.9, x = p[0] - Math.sin(a) * 1.6, z = p[2] - Math.cos(a) * 1.6;
        const hit = world.raycast([x, p[1] + 1, z], [0, -1, 0], 2.5, false);
        if (hit && hit.normal[1] > 0.7) { gadgets.place(spec({ k: 'mine', ax: 0, p: [x, hit.point[1], z] })); n++; }
      }
      return n ? HEAVY_STATS.mines.cd + Math.random() * 8 : 2;
    }
    // turrets
    if (dist > 40) return 1;
    const sp = gadgets.turretSpot(p, yaw);
    if (!sp) return 2;
    gadgets.place(spec({ k: 'tur', v: id === 'turret_heavy' ? 'heavy' : id === 'turret_flame' ? 'flame' : undefined, ...sp }));
    return HEAVY_STATS[id].cd + Math.random() * 8;
  },
  barricade: (agent, tgt) => {
    const p = agent.pos, yaw = Math.atan2(-(tgt.pos[0] - p[0]), -(tgt.pos[2] - p[2]));
    const spot = gadgets.barricadeSpot(p, yaw);
    if (!spot) return false;
    gadgets.place({ gid: gadgets.newId(agent.name), k: 'bar', ...spot, owner: agent.name, team: agent.team.idx, teamCol: agent.team.rgb });
    return true;
  },
  whiz: (from, end) => {
    // did the round pass close to your head?
    const e = player.eye(), d = [end[0] - from[0], end[1] - from[1], end[2] - from[2]];
    const L = Math.hypot(...d), u = d.map((v) => v / L);
    const t = clamp((e[0] - from[0]) * u[0] + (e[1] - from[1]) * u[1] + (e[2] - from[2]) * u[2], 0, L);
    const q = from.map((c, i) => c + u[i] * t);
    if (Math.hypot(e[0] - q[0], e[1] - q[1], e[2] - q[2]) < 1.6) sounds.whiz();
  },
  onLand: (bot) => { effects.dust(bot.pos, 6); sounds.botLand(); },
  onKill: (bot) => {
    sounds.botDie();
    if (botMgr.state === 'fight' && botMgr.alive === 0) { slowmo = 0.9; }
  },
  // after the death fall: the body breaks apart
  onShatter: (bot) => {
    const s = bot.sc, f = bot.fallSign;
    const lay = (c) => bot.toWorld([c[0], 0.25, c[2] + f * c[1] * 0.9]);
    const tc = bot.pal ? [...bot.pal.values()] : null;     // team colours: [body, head, dark]
    for (const [c, sz, col0, ti] of [[[0, 0.45, 0], [0.4, 0.3, 0.9], [0.55, 0.06, 0.05], 2], [[0, 1.25, 0], [0.55, 0.32, 0.55], [0.92, 0.1, 0.08], 0], [[0, 1.64, 0], [0.3, 0.3, 0.3], [1, 0.22, 0.16], 1]]) {
      const col = tc ? tc[ti] : col0;
      const w = lay(c), sc = sz.map((v) => v * s);
      effects.shatter({ min: w.map((v, i) => v - sc[i] / 2), max: w.map((v, i) => v + sc[i] / 2), scale: sc, center: w, color: col }, bot.killDir || [0, 0, 0], 3, 2.5, 0.12);
    }
    effects.dust(bot.pos, 6);
    sounds.crumble();
  },
  onCleared: (n) => { banner('WAVE CLEARED', `WAVE ${n} DONE · NEXT WAVE IN 5`, 'good', 3); },
  onNextWave: (n) => { banner(`WAVE ${n}`, `${botMgr.bots.length} HOSTILES INBOUND`, 'bad', 2.2); },
};

// big centre banner (wave titles, countdown)
let bannerT = 0;
function banner(text, sub = '', kind = '', dur = 1.6) {
  hud.banner.className = kind;
  hud.banner.firstChild.textContent = text;
  hud.banner.lastChild.textContent = sub;
  bannerT = dur;
}

// --- console button
function nearConsole() {
  const c = map.deck.console;
  return Math.abs(player.pos[1] - c[1]) < 0.5 && Math.hypot(player.pos[0] - c[0], player.pos[2] - c[2]) < 2.3;
}
function pressConsole() {
  if (botMgr.running) {
    botMgr.stop();
    map.deckRefs.screen.color = [0.15, 0.4, 0.9];
    banner('SESSION ENDED', `BEST WAVE ${botMgr.best}`, '', 2);
    sounds.button();
    return;
  }
  const c = map.deck.console, e = player.eye();
  const to = [c[0] - e[0], c[1] + 1.1 - e[1], c[2] - e[2]];
  pressSeq = { t: 0, yaw0: player.yaw, pitch0: player.pitch, yaw1: Math.atan2(-to[0], -to[2]), pitch1: Math.atan2(to[1], Math.hypot(to[0], to[2])) };
  let dy = pressSeq.yaw1 - pressSeq.yaw0;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  pressSeq.yaw1 = pressSeq.yaw0 + dy;
  player.vel = [0, 0, 0];
  player.cancelAbilities();
}
const idleInput = { aiming: false, fireDown: false, fireHit: false, hit: () => false, down: () => false, mouse: () => false, mouseHit: () => false, dx: 0, dy: 0 };
function updatePress(dt) {
  const ps = pressSeq;
  ps.t += dt;
  const k = Math.min(ps.t / 0.35, 1), e = k * k * (3 - 2 * k);
  player.yaw = ps.yaw0 + (ps.yaw1 - ps.yaw0) * e;
  player.pitch = ps.pitch0 + (ps.pitch1 - ps.pitch0) * e;
  player.press = Math.min(ps.t / 0.9, 1);
  const btn = map.deckRefs.button;
  const down = ps.t > 0.38 && ps.t < 0.62;
  if (ps.t > 0.38 && !ps.clicked) { ps.clicked = true; sounds.button(); btn.color = [1, 0.85, 0.7]; btn.emissive = 1; map.deckRefs.screen.color = [0.9, 0.15, 0.1]; }
  const c = [...btn.center]; c[1] = map.deck.y + 1.14 - (down ? 0.05 : 0); moveBoxTo(btn, c);
  if (ps.t >= 0.9) {
    pressSeq = null;
    player.press = null;
    btn.color = [0.95, 0.15, 0.1]; btn.emissive = 0.8;
    startCutscene();
  }
}

// --- cutscene: sweep over the deck, watch the bots drop in, swoop back to you
const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const sm = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
function startCutscene() {
  botMgr.start(true);
  cutscene = { t: 0, eye0: player.eye(), fwd0: player.forward(), shown: false, doors: false };
  document.body.classList.add('cine');
}
function cutsceneCam() {
  const c = cutscene, cam = map.deck.cam;
  const look = (eye, at) => norm(at.map((v, i) => v - eye[i]));
  if (c.t < 1.9) {
    const k = sm(c.t / 1.9), eye = lerp3(cam.wide.from, cam.wide.to, k);
    return { eye, fwd: look(eye, cam.wide.look) };
  }
  if (c.t < 3.9) {
    const k = sm((c.t - 1.9) / 2), eye = lerp3(cam.pods.from, cam.pods.to, k);
    return { eye, fwd: look(eye, cam.pods.look) };
  }
  const k = sm((c.t - 3.9) / 0.9);
  const eye = lerp3(cam.pods.to, player.eye(), k);
  const f0 = look(cam.pods.to, cam.pods.look), f1 = player.forward();
  return { eye, fwd: norm(lerp3(f0, f1, k)) };
}
function updateCutscene(dt) {
  const c = cutscene;
  c.t += dt;
  if (c.t > 2.2 && !c.shown) { c.shown = true; banner(`WAVE ${botMgr.wave}`, `${botMgr.bots.length} HOSTILES INBOUND`, 'bad', 2.4); }
  if (c.t > 3.2 && !c.doors) { c.doors = true; botMgr.doorTarget = 1; sounds.doors(); }
  if (c.t >= 4.8) {
    cutscene = null;
    document.body.classList.remove('cine');
    botMgr.state = 'countdown';
    botMgr.timer = 3;
  }
}

let lastCount = 0;
function updateCombat(dt) {
  botMgr.update(dt, botHooks);
  if (tdm.active) {
    tdm.update(dt, tdm === online ? netHooks : botHooks);
    matchEvents();
  }
  if (botMgr.state === 'countdown') {
    const n = Math.ceil(botMgr.timer);
    if (n !== lastCount && n > 0) { lastCount = n; banner(String(n), 'GET READY', '', 0.9); sounds.beep(false); }
  } else if (lastCount && botMgr.state === 'fight') { lastCount = 0; banner('FIGHT', '', 'bad', 1); sounds.beep(true); }
  // regen after 4s without damage
  player.hurtT += dt;
  player.invuln = Math.max(0, player.invuln - dt);
  if (!player.dead && player.hurtT > 4 && player.hp < player.maxHp) player.hp = Math.min(player.maxHp, player.hp + 40 * dt);
}

// ---------- class gadgets: Medium's bounce pad, Heavy's barricade ----------
const myGadgetOwner = () => (online.active ? online.myId : 'me');
const ABIL_CD = { barricade: 10, lowwall: 12, pad: 14, launchpad: 14, heal: 20 };
// which cooldown each ability runs on
const ABIL_SLOT = { grapple: 'grapple', tether: 'grapple', dash: 'dash', cloak: 'cloak', pad: 'pad', launchpad: 'pad', heal: 'heal', barricade: 'barricade', lowwall: 'barricade', slam: 'slam' };
let cloakT = 0;          // CLOAK: seconds of invisibility left
const CLOAK_TIME = 6;
function placeGadget(spec) {
  const owner = myGadgetOwner();
  const full = { gid: gadgets.newId(owner), ...spec, owner, team: tdm.active ? tdm.myTeam?.idx : -1, teamCol: tdm.active ? tdm.myTeam?.rgb : null };
  gadgets.place(full);
  if (online.active) online.send({ t: 'gad', id: online.myId, g: full });
}
const noRoom = () => { sounds.denied(); banner('NO ROOM', 'NEEDS FLAT, OPEN FLOOR', 'bad', 0.9); };
function useGadget(kind) {
  const wall = kind === 'barricade' || kind === 'lowwall';
  const a = player.abil[ABIL_SLOT[kind]];
  if (!a || a.cd > 0 || player.dead) { if (a?.cd > 0) sounds.denied(); return; }
  const spot = wall ? gadgets.barricadeSpot(player.pos, player.yaw, kind === 'lowwall' ? BLOCKADE : BARRICADE)
    : gadgets.padSpot(player.eye(), player.forward(), player.pos, kind === 'heal' ? 0.35 : undefined);
  if (!spot) { noRoom(); return; }
  placeGadget({ k: wall ? 'bar' : kind === 'heal' ? 'heal' : 'pad', v: kind === 'lowwall' ? 'low' : kind === 'launchpad' ? 'launch' : undefined, yaw: +player.yaw.toFixed(3), ...spot });
  a.max = ABIL_CD[kind];
  a.cd = a.max;
  if (wall) { player.camPitchV -= 0.5; player.shake = Math.max(player.shake || 0, 0.2); }
}
// CLOAK: invisible for a few seconds; enemies can't pick you out unless they're right on top of you
function useCloak() {
  const a = player.abil.cloak;
  if (player.dead) return;
  if (cloakT > 0) { cloakT = 0; return; }
  if (a.cd > 0) { sounds.denied(); return; }
  cloakT = CLOAK_TIME;
  a.cd = a.max;
  sounds.cloak?.();
}
// healing stations heal whoever's on the owner's side nearby
function updateHealing(dt) {
  const myTeam = tdm.active ? tdm.myTeam?.idx ?? -1 : -1;
  for (const g of gadgets.list) {
    if (g.k !== 'heal' || g.t < 0.3) continue;
    const friendly = g.owner === myGadgetOwner() || (myTeam >= 0 && g.team === myTeam);
    const near = (p) => Math.hypot(p[0] - g.p[0], p[2] - g.p[2]) < 4.5 && Math.abs(p[1] - g.p[1]) < 2.5;
    if (friendly && !player.dead && player.hp < player.maxHp && near(player.pos)) {
      player.hp = Math.min(player.maxHp, player.hp + 20 * dt);
      if (Math.random() < dt * 8) effects.spawnPiece([player.pos[0] + (Math.random() - 0.5) * 0.8, player.pos[1] + 0.4 + Math.random(), player.pos[2] + (Math.random() - 0.5) * 0.8], [0.05, 0.05, 0.05], [0, 1.4, 0], [0.3, 1, 0.5], 0.6, 1);
    }
    if (tdm.active && tdm !== online) for (const a of tdm.agents) {
      const b = a.bot;
      if (b && b.alive && b.team === g.team && b.hp < b.maxHp && near(b.pos)) b.hp = Math.min(b.maxHp, b.hp + 20 * dt);
    }
    if (Math.random() < dt * 6) {
      effects.spawnPiece([g.p[0] + (Math.random() - 0.5) * 0.4, g.p[1] + 0.8, g.p[2] + (Math.random() - 0.5) * 0.4], [0.05, 0.05, 0.05], [(Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2], [0.3, 1, 0.5], 0.8, 1);
      effects.debris[effects.debris.length - 1].noGravity = true;
    }
  }
}

// ---------- heavy weapons (Q) ----------
function useHeavy() {
  if (player.dead) return;
  if (launcherW) { putAwayLauncher(false); return; }
  if (heavyCd > 0) { sounds.denied(); return; }
  const id = equippedHeavy, st = HEAVY_STATS[id];
  if (id.startsWith('gl_')) {
    // pull the launcher out; one click fires it, then it goes away
    const def = defFor('gl');
    def.parts = def.parts.map((p) => (p.name === 'band' ? { ...p, col: st.col } : p));
    def.name = st.name.replace(' LAUNCHER', '');
    launcherW = new Weapon(def);
    launcherW.ammo = 1;
    launcherW.equip();
    launcherKind = id; launcherT = 0;
    sounds.swap();
    updateSlotHud();
    return;
  }
  if (id === 'mines') {
    // three mines in a spread across where you're aiming
    const c = gadgets.padSpot(player.eye(), player.forward(), player.pos, 0.2);
    if (!c) { noRoom(); return; }
    const f = player.forward(), hl = Math.hypot(f[0], f[2]) || 1, side = [-f[2] / hl, f[0] / hl];
    let n = 0;
    for (const k of [-1, 0, 1]) {
      const x = c.p[0] + side[0] * k * 1.5, z = c.p[2] + side[1] * k * 1.5;
      const hit = world.raycast([x, c.p[1] + 1, z], [0, -1, 0], 2.5, false);
      if (!hit || hit.normal[1] < 0.7) continue;
      placeGadget({ k: 'mine', ax: 0, p: [+x.toFixed(3), +hit.point[1].toFixed(3), +z.toFixed(3)] });
      n++;
    }
    if (!n) { noRoom(); return; }
  } else if (id === 'dronepod' || id === 'swarmpod') {
    const spot = gadgets.padSpot(player.eye(), player.forward(), player.pos, 0.35);
    if (!spot) { noRoom(); return; }
    placeGadget({ k: 'pod', v: id === 'swarmpod' ? 'swarm' : undefined, ax: 0, ...spot });
  } else {
    const spot = gadgets.turretSpot(player.pos, player.yaw);
    if (!spot) { noRoom(); return; }
    placeGadget({ k: 'tur', v: id === 'turret_heavy' ? 'heavy' : id === 'turret_flame' ? 'flame' : undefined, ...spot });
    player.camPitchV -= 0.4;
  }
  heavyCd = st.cd;
}
// the Light's TETHER LAUNCHER (ability): same idea as the grenade launcher, it fires a tether bolt
function useTether() {
  if (player.dead) return;
  if (launcherW) { const was = launcherKind; putAwayLauncher(false); if (was === 'tether') return; }
  const a = player.abil.grapple;
  if (a.cd > 0) { sounds.denied(); return; }
  const def = defFor('tg');
  launcherW = new Weapon(def);
  launcherW.ammo = 1;
  launcherW.equip();
  launcherKind = 'tether'; launcherT = 0;
  sounds.swap();
  updateSlotHud();
}
function putAwayLauncher(fired) {
  if (!launcherW) return;
  launcherW = null;
  if (fired && launcherKind === 'tether') { player.abil.grapple.max = TETHER.cd; player.abil.grapple.cd = TETHER.cd; }
  else if (fired) heavyCd = HEAVY_STATS[launcherKind].cd;
  weapon().equip();
  updateSlotHud();
}
function gadgetHit(g, dmg) {
  gadgets.damage(g, dmg);
  if (online.active) online.send({ t: 'gdm', gid: g.gid, dmg });
}
// the player as something a bounce pad can throw
const padRider = {
  get pos() { return player.pos; }, get vel() { return player.vel; }, get dead() { return player.dead || !playing; }, padCd: 0,
  onBounce(vy, push) {
    player.cancelAbilities?.();
    Object.assign(player, { sliding: false, grounded: false, trav: null, wallRun: null, coyote: 0 });
    player.pos[1] += 0.05;
    player.vel[1] = vy;
    const hs = Math.hypot(player.vel[0], player.vel[2]);
    if (push) { player.vel[0] = push[0]; player.vel[2] = push[1]; }     // launch pad: thrown the way it faces
    else if (hs > 1.5) { const k = Math.min(1.3, 16 / hs); player.vel[0] *= k; player.vel[2] *= k; }
    player.shake = Math.max(player.shake || 0, 0.25);
    player.camPitchV -= 0.9;
    player.landV -= 0.4;
  },
};

// ---------- HUD ----------
const hud = {
  ammo: $('ammo'), reserve: $('reserve'), reload: $('reload'), speed: $('speed'), fps: $('fps'),
  kills: $('kills'), acc: $('acc'), chunks: $('chunks'), cross: $('crosshair'), hitmarker: $('hitmarker'),
  dmgLayer: $('damage'), state: $('state'), wname: $('weaponname'), wtype: $('weapontype'), prompt: $('prompt'),
  scope: $('scope'), slots: [$('slot1'), $('slot2')],
  ab: { main: $('ab-main'), heavy: $('ab-heavy') },
  hp: $('health'), hpBar: $('hpbar'), hpNum: $('hpnum'), dmg: $('dmgdirs'), lowhp: $('lowhp'), killfeed: $('killfeed'),
  wave: $('wavepanel'), waveTitle: $('wavetitle'), waveInfo: $('waveinfo'), banner: $('banner'), death: $('death'), deathSub: $('deathsub'),
  speedo: $('speedo'), speedBar: $('speedbar'), speedNum: $('speednum'), chain: $('chain'),
  course: $('course'), courseTime: $('coursetime'), courseInfo: $('courseinfo'), flash: $('flash'), fade: $('fade'),
};
let hitTimer = 0;
function showHitmarker(kill, head) {
  hud.hitmarker.className = kill ? 'kill' : head ? 'head' : '';
  hud.hitmarker.style.opacity = 1;
  hitTimer = kill ? 0.28 : 0.14;
}

function renderKillFeed() {
  hud.killfeed.replaceChildren(...kills.map((k) => {
    const row = document.createElement('div');
    row.className = k.a === 'YOU' ? 'mine' : k.b === 'YOU' ? 'me' : '';
    const a = document.createElement('b'); a.textContent = k.a;
    const w = document.createElement('span'); w.textContent = ` ${k.w}${k.head ? ' ◎' : ''} `;
    const b = document.createElement('b'); b.textContent = k.b;
    row.append(a, w, b);
    return row;
  }));
}
function keyLabel(code) { return code.replace(/^Key/, '').replace(/^Digit/, '').toUpperCase(); }
let grappleOk = false;
function updateAbilityHud() {
  const a = player.abil;
  const set = (el, frac, ready, extra = '') => {
    el.style.setProperty('--p', frac.toFixed(3));
    el.classList.toggle('ready', ready);
    el.querySelector('.cd').textContent = extra;
  };
  const ab = hud.ab.main, isG = equippedAbility === 'grapple' || equippedAbility === 'tether';
  const tetherOut = !!launcherW && launcherKind === 'tether';
  const name = ABILITIES[equippedAbility]?.short || '';
  if (ab.dataset.name !== name) { ab.dataset.name = name; ab.querySelector('b').textContent = name; }
  if (isG) {
    const gActive = (player.grapple && player.grapple.phase !== 'miss') || tetherOut;
    set(ab, gActive ? 0 : a.grapple.cd / a.grapple.max, a.grapple.cd <= 0 || gActive, a.grapple.cd > 0 && !gActive ? a.grapple.cd.toFixed(1) : '');
    ab.classList.toggle('active', !!gActive);
  } else if (equippedAbility === 'dash') {
    const d = a.dash, rem = d.charges < d.max ? 1 - d.t / d.recharge : 0;
    set(ab, d.charges > 0 ? 0 : rem, d.charges > 0);
    ab.classList.remove('active');
  } else {
    const k = ABIL_SLOT[equippedAbility], on = equippedAbility === 'cloak' && cloakT > 0;
    set(ab, on ? 0 : a[k].cd / a[k].max, a[k].cd <= 0 || on, on ? cloakT.toFixed(1) : a[k].cd > 0 ? a[k].cd.toFixed(1) : '');
    ab.classList.toggle('active', on);
  }
  const pips = equippedAbility === 'barricade' || equippedAbility === 'dash';
  ab.querySelector('.pips').classList.toggle('hidden', !pips);
  if (equippedAbility === 'barricade') {
    const mine = gadgets.list.filter((g) => g.owner === myGadgetOwner() && g.k === 'bar' && g.v !== 'low').length;
    ab.querySelectorAll('.pip').forEach((p, i) => p.classList.toggle('on', i < 2 - mine));
  } else if (equippedAbility === 'dash') ab.querySelectorAll('.pip').forEach((p, i) => p.classList.toggle('on', i < a.dash.charges));
  // heavy weapon
  const hv = hud.ab.heavy, hn = HEAVIES[equippedHeavy]?.short || '', hmax = HEAVY_STATS[equippedHeavy]?.cd || 1;
  if (hv.dataset.name !== hn) { hv.dataset.name = hn; hv.querySelector('b').textContent = hn; }
  set(hv, heavyCd / hmax, heavyCd <= 0, heavyCd > 0 ? heavyCd.toFixed(1) : '');
  hv.classList.toggle('active', !!launcherW && !tetherOut);
  // grapple range hint on the crosshair
  grappleOk = equippedAbility === 'grapple' && a.grapple.cd <= 0 && !player.grapple && !!player.grappleTarget();
  hud.cross.classList.toggle('grapple', grappleOk);
}
function refreshAbilityKeys() {
  hud.ab.main.querySelector('kbd').textContent = keyLabel(settings.abilityKey);
  hud.ab.heavy.querySelector('kbd').textContent = keyLabel(settings.heavyKey);
}

function updateSlotHud() {
  slots.forEach((w, i) => {
    hud.slots[i].textContent = `${i + 1}  ${w.def.name}`;
    hud.slots[i].classList.toggle('active', i === current);
  });
  hud.wname.textContent = weapon().def.name;
  hud.wtype.textContent = weapon().def.type;
}
updateSlotHud();
refreshAbilityKeys();
applyClass();

const vp = mat4();
function project(p) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (w <= 0.01) return null;
  return [(x / w * 0.5 + 0.5) * innerWidth, (1 - (y / w * 0.5 + 0.5)) * innerHeight];
}

let nearCase = null, nearBench = false;
function findBench() {
  const eye = player.eye(), fwd = player.forward(), c = workbench.center;
  const to = [c[0] - eye[0], 1.0 - eye[1] + c[1], c[2] + 0.4 - eye[2]];
  return Math.hypot(...to) < 3.0 && dot(norm(to), fwd) > 0.4;
}
function findCase() {
  const eye = player.eye(), fwd = player.forward();
  let best = null, bestDot = 0.93;
  for (const c of cases) {
    const to = [c.aim[0] - eye[0], c.aim[1] - eye[1], c.aim[2] - eye[2]];
    const dist = Math.hypot(...to);
    if (dist > 3.4) continue;
    const dd = dot(norm(to), fwd);
    if (dd > bestDot) { bestDot = dd; best = c; }
  }
  return best;
}

let fpsAcc = 0, fpsFrames = 0;
function updateHud(dt, fovRad) {
  const w = weapon();
  updateMatchHud(dt);
  hud.ammo.textContent = w.reloading && !w.reload.shell ? '--' : w.ammo;
  hud.ammo.classList.toggle('low', w.ammo <= Math.ceil(w.def.mag * 0.2));
  hud.reserve.textContent = `/ ${w.def.mag}`;
  let rp = 0;
  if (w.reload && !w.reload.shell) rp = w.reload.t / w.reload.total;
  if (w.reload && w.reload.shell) rp = w.ammo / w.def.mag;
  hud.reload.style.opacity = w.reload ? 1 : 0;
  hud.reload.style.setProperty('--p', rp);
  hud.speed.textContent = player.hSpeed.toFixed(1);
  hud.kills.textContent = stats.kills;
  hud.chunks.textContent = stats.chunks;
  hud.acc.textContent = stats.shots ? `${Math.round((stats.hits / stats.shots) * 100)}%` : '--';
  updateAbilityHud();
  hud.state.textContent = player.grapple?.phase === 'pull' ? 'GRAPPLE' : player.dash ? 'DASH' : player.slam ? 'SLAM' : player.hanging ? 'HANG' : player.wallRunning ? 'WALL RUN' : player.mantle ? 'MANTLE' : player.vaulting ? 'VAULT' : player.sliding ? 'SLIDE' : player.crouching ? 'CROUCH' : player.sprinting ? 'SPRINT' : !player.grounded ? 'AIR' : '';

  // speed meter + slide-hop chain
  hud.speedBar.style.setProperty('--p', Math.min(player.hSpeed / 16, 1).toFixed(3));
  hud.speedNum.textContent = player.hSpeed.toFixed(1);
  hud.chain.textContent = player.chain > 0 ? `CHAIN ×${player.chain}` : '';
  hud.speedo.classList.toggle('hot', player.chain > 0 || player.hSpeed > 11);

  // parkour course
  hud.course.classList.toggle('hidden', !course.visible);
  if (course.visible) {
    const cps = map.course.checkpoints.length;
    hud.courseTime.textContent = course.state === 'idle' ? '0:00.00' : fmtTime(course.t);
    hud.courseInfo.textContent = `CP ${Math.min(course.next, cps)}/${cps} · BEST ${course.best != null ? fmtTime(course.best) : '--'} · X RESTART`;
  }
  const f = course.flash;
  if (f) {
    hud.flash.style.opacity = f.t < 1.2 ? 1 : 1 - (f.t - 1.2) / 0.4;
    hud.flash.style.transform = `translate(-50%, -50%) scale(${1 + Math.max(0, 0.15 - f.t) * 1.2})`;
    if (hud.flash.dataset.text !== f.text + f.sub) {
      hud.flash.dataset.text = f.text + f.sub;
      hud.flash.className = f.kind;
      hud.flash.innerHTML = `<b></b><span></span>`;
      hud.flash.firstChild.textContent = f.text;
      hud.flash.lastChild.textContent = f.sub;
    }
  } else hud.flash.style.opacity = 0;
  hud.fade.style.opacity = course.failT > 0 ? course.failT / 0.35 : voidT > 0 ? 1 - voidT / 0.35 : 0;

  // health
  const hpk = player.hp / player.maxHp;
  hud.hpBar.style.setProperty('--p', hpk.toFixed(3));
  hud.hpNum.textContent = Math.ceil(player.hp);
  hud.hp.classList.toggle('low', hpk < 0.35);
  hud.lowhp.style.opacity = player.dead ? 0 : Math.max(0, (0.5 - hpk) * 1.6) + Math.max(0, 0.35 - player.hurtT) * 1.2;
  // damage direction arrows around the crosshair
  for (let i = dmgDirs.length - 1; i >= 0; i--) { dmgDirs[i].t += dt; if (dmgDirs[i].t > 1.2) dmgDirs.splice(i, 1); }
  while (hud.dmg.children.length < dmgDirs.length) hud.dmg.appendChild(document.createElement('i'));
  [...hud.dmg.children].forEach((el, i) => {
    const d = dmgDirs[i];
    if (!d) { el.style.opacity = 0; return; }
    const rel = d.ang - player.yaw;
    el.style.transform = `rotate(${(-rel * 180 / Math.PI).toFixed(1)}deg)`;
    el.style.opacity = d.t < 0.6 ? 1 : 1 - (d.t - 0.6) / 0.6;
  });
  // kill feed ageing
  let feedChanged = false;
  for (let i = kills.length - 1; i >= 0; i--) { kills[i].t += dt; if (kills[i].t > 6) { kills.splice(i, 1); feedChanged = true; } }
  if (feedChanged) renderKillFeed();
  // wave panel
  hud.wave.classList.toggle('hidden', !botMgr.running);
  if (botMgr.running) {
    hud.waveTitle.textContent = `WAVE ${botMgr.wave}`;
    hud.waveInfo.textContent = botMgr.state === 'cleared' ? `NEXT WAVE ${Math.ceil(botMgr.timer)}` : `${botMgr.alive} HOSTILES · BEST ${botMgr.best}`;
  }
  // banner
  bannerT -= dt;
  hud.banner.style.opacity = bannerT > 0 ? Math.min(1, bannerT * 3) : 0;
  hud.banner.style.transform = `translate(-50%, -50%) scale(${1 + Math.max(0, bannerT - (bannerT > 1.5 ? 1.5 : 99)) * 0.3})`;
  // death screen
  hud.death.classList.toggle('hidden', !player.dead);
  if (player.dead) hud.deathSub.textContent = `BY ${killer} · RESPAWN IN ${Math.ceil(deathT)}`;

  const spreadPx = Math.tan(w.spread(player)) / Math.tan(fovRad / 2) * (innerHeight / 2);
  hud.cross.style.setProperty('--gap', `${Math.max(4, spreadPx).toFixed(1)}px`);
  hud.cross.style.opacity = w.scoped ? 0 : 1 - w.adsT * 0.85;
  hud.cross.classList.toggle('shotgun', w.def.pellets > 1);
  hud.scope.style.opacity = w.scoped ? 1 : 0;

  const lb = playing && !player.dead && inStadium() ? lookLiftButton() : null;
  const hk = settings.abilityKey.replace(/^Key/, '');
  if (inStadium() && stadium.hook && playing && !player.dead && player.grapple?.anchor) {
    hud.prompt.innerHTML = `<kbd>${hk}</kbd> CUT THE LINE <span>OR JUMP</span>`;
    hud.prompt.style.opacity = 1;
  } else if (inStadium() && stadium.hook && playing && !player.dead && !player.grounded && player.vel[1] < -5 && fallTop != null && fallTop - player.pos[1] > 5) {
    hud.prompt.innerHTML = `<kbd>${hk}</kbd> <b>HOOK A CONTAINER</b> <span>BREAK YOUR FALL</span>`;
    hud.prompt.style.opacity = 1;
  } else if (lb) {
    hud.prompt.innerHTML = `<kbd>E</kbd> ${lb.car ? (lb.dir > 0 ? 'GO UP' : 'GO DOWN') : 'CALL LIFT'} <b>${lb.dir > 0 ? '▲' : '▼'}</b>`;
    hud.prompt.style.opacity = 1;
  } else if (nearConsole() && !pressSeq && !cutscene && !player.dead) {
    hud.prompt.innerHTML = botMgr.running ? '<kbd>E</kbd> END SESSION' : `<kbd>E</kbd> START <b>COMBAT</b> <span>BEST WAVE ${botMgr.best}</span>`;
    hud.prompt.style.opacity = 1;
  } else if (nearBench && !nearCase) {
    hud.prompt.innerHTML = '<kbd>E</kbd> WORKBENCH <span>ATTACHMENTS</span>';
    hud.prompt.style.opacity = 1;
  } else if (nearCase?.ammo) {
    hud.prompt.innerHTML = '<kbd>E</kbd> TAKE <b>AMMO</b> <span>FILL BOTH GUNS</span>';
    hud.prompt.style.opacity = 1;
  } else if (nearCase) {
    const d = nearCase.def;
    hud.prompt.innerHTML = `<kbd>E</kbd> ${weapon().def.id === d.id ? 'REFILL' : 'TAKE'} <b>${d.name}</b> <span>${d.type}</span>`;
    hud.prompt.style.opacity = 1;
  } else hud.prompt.style.opacity = 0;

  hitTimer -= dt;
  if (hitTimer <= 0) hud.hitmarker.style.opacity = 0;

  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const d = damageNumbers[i];
    d.t += dt;
    if (!d.el) {
      d.el = document.createElement('div');
      d.el.className = `dmg${d.head ? ' head' : ''}${d.burn ? ' burn' : ''}`;
      d.el.textContent = d.amount;
      hud.dmgLayer.appendChild(d.el);
    }
    if (d.t > 0.8) { d.el.remove(); damageNumbers.splice(i, 1); continue; }
    const s = project([d.pos[0], d.pos[1] + d.t * 0.8, d.pos[2]]);
    if (!s) { d.el.style.opacity = 0; continue; }
    d.el.style.transform = `translate(${s[0] + d.drift * 30 * d.t}px, ${s[1]}px) translate(-50%, -50%)`;
    d.el.style.opacity = d.t < 0.5 ? 1 : 1 - (d.t - 0.5) / 0.3;
  }

  fpsAcc += dt; fpsFrames++;
  if (fpsAcc > 0.5) { hud.fps.textContent = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }
}

// ---------- menu / pointer lock ----------
let playing = false, locked = false;
const menu = $('menu');

function setPlaying(on) {
  playing = on;
  if (!on) { renderMenu(); showTab('home'); }
  input.enabled = on;
  input.reset();
  menu.classList.toggle('hidden', on);
  document.body.classList.toggle('playing', on);
}

function start() {
  sounds.unlock();
  setPlaying(true);
  try {
    const p = canvas.requestPointerLock?.();
    if (p && p.catch) p.catch(() => $('locknote').classList.remove('hidden'));
    if (!canvas.requestPointerLock) $('locknote').classList.remove('hidden');
  } catch {
    $('locknote').classList.remove('hidden');
  }
}

// ---------- main menu ----------
let sessionStarted = false;
function enterRange() {
  if (where !== 'range') {
    if (tdm.active) endMatch(false);
    where = 'range';
    gadgets.clear(); burning.clear(); heavy.clear(); heavyCd = 0; putAwayLauncher(false); playerTether = null; cloakT = 0; playerBurn = null;
    player.spawn(map.spawn.pos, map.spawn.yaw);
    $('mapname').lastChild.textContent = map.name;
    document.body.classList.remove('stadium');
    effects.clear();
  }
  if (!sessionStarted || classDirty) {
    applyClass();
    resetRange();
    player.respawn();
    Object.assign(player, { hp: player.maxHp });
    sessionStarted = true;
  }
  start();
}
// PLAY: the semi-finals arena
function enterStadium() {
  const arriving = where !== 'stadium';
  if (classDirty || !sessionStarted) { applyClass(); sessionStarted = true; }
  if (arriving) {
    where = 'stadium';
    gadgets.clear(); burning.clear(); heavy.clear(); heavyCd = 0; putAwayLauncher(false); playerTether = null; cloakT = 0; playerBurn = null;
    botMgr.stop();
    course.reset();
    cutscene = null; pressSeq = null;
    effects.clear();
    player.spawn(stadium.spawn.pos, stadium.spawn.yaw);
    Object.assign(player, { hp: player.maxHp, dead: false, press: null });
    slots.forEach((w) => { w.ammo = w.def.mag; w.reload = null; });
    banner(stadium.name, 'SEMI-FINALS', '', 2.4);
    document.body.classList.add('stadium');
    $('mapname').lastChild.textContent = stadium.name;
  }
  start();
}
const resume = () => (inStadium() ? enterStadium() : enterRange());
$('play').addEventListener('click', enterRange);
let menuTab = 'home';
function showTab(tab) {
  menuTab = tab;
  document.querySelectorAll('.mm-nav button, .mm-gear').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  document.querySelectorAll('.mm-page').forEach((p) => p.classList.toggle('hidden', p.dataset.page !== tab));
  $('menu').dataset.screen = tab;
  tryOn = null;
  if (tab === 'custom' || tab === 'shop') custCls = custCls || classLo.cls;
  renderMenu();
  sounds.click?.(2400, 0.12);
}
document.querySelectorAll('.mm-nav button, .mm-gear, .mm-logo').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
document.querySelectorAll('.mm-back').forEach((b) => b.addEventListener('click', () => showTab('home')));
addEventListener('keydown', (e) => {
  if (!playing && !bench.open && e.code === 'Escape' && menuTab !== 'home' && !rebinding) showTab('home');
});
let custCls = null, custSlot = 'head', tryOn = null, shopFilter = 'all';
const fmt = (n) => n.toLocaleString('en-GB');
const thumbs = new Thumbs();
const thumbKey = (id, cls) => `${id}|${cls}|${classLo[cls].weapon}|${JSON.stringify(cosmetics.equip[cls])}`;
function thumbSpec(id, cls) {
  const it = ITEMS[id], w = classLo[cls].weapon;
  const skin = it.slot === 'wskin' ? it.gun : gunSkinFor(cosmetics, cls);
  skinClass = cls;
  const gunDef = skinDef(buildDef(WEAPONS[w], loadouts[w] || {}), skin);
  skinClass = null;
  const outfit = { ...buildOutfit(cosmetics, cls, it.slot === 'wskin' ? null : id) };
  return { slot: it.slot, outfit, gunDef, color: RARITY[it.rarity].color.map((v) => v * 0.8) };
}
function itemCard(id, { onClick, on = false, priceTag = true }) {
  const it = ITEMS[id], r = RARITY[it.rarity];
  const b = el('button', `it${on ? ' on' : ''}${!owns(cosmetics, id) ? ' locked' : ''}`);
  b.type = 'button';
  b.style.setProperty('--r', rgb(r.color));
  // a live 3D portrait of the item (falls back to a colour swatch if the thumbnail renderer isn't available)
  const cls = custCls || classLo.cls;
  const img = el('img', 'sw3');
  img.alt = '';
  img.style.background = `radial-gradient(circle at 50% 40%, ${rgb(r.color.map((v) => v * 0.8))}, ${rgb(r.color.map((v) => v * 0.25))})`;
  const url = thumbs.get(thumbKey(id, cls), () => thumbSpec(id, cls), (u) => { img.src = u; });
  if (url) img.src = url;
  if (!thumbs.ok) {
    const sw = swatch(it);
    const s0 = el('div', 'sw', iconFor(it.slot));
    s0.style.setProperty('--sw', sw ? rgb(sw) : 'rgba(255,255,255,.15)');
    b.append(s0);
  } else b.append(img);
  b.append(el('b', null, it.name), el('small', null, r.name));
  if (priceTag) {
    if (owns(cosmetics, id)) b.append(el('span', 'price own', it.price ? 'OWNED' : 'FREE'));
    else b.append(el('span', 'price', `◆ ${fmt(it.price)}`));
  }
  b.onclick = onClick;
  return b;
}
function renderCustom() {
  const cls = custCls || classLo.cls;
  $('cu-classes').replaceChildren(...CLASS_ORDER.map((id) => {
    const k = CLASSES[id];
    const b = el('button', `mm-class${id === cls ? ' on' : ''}`);
    b.type = 'button';
    b.style.setProperty('--c', rgb(k.color));
    b.append(el('b', null, k.name));
    b.onclick = () => { custCls = id; tryOn = null; sounds.swap?.(); renderMenu(); };
    return b;
  }));
  $('cu-slots').replaceChildren(...CSLOTS.map((sl) => {
    const b = el('button', sl.id === custSlot ? 'on' : '', sl.name);
    b.type = 'button';
    b.onclick = () => { custSlot = sl.id; tryOn = null; renderMenu(); };
    return b;
  }));
  const eq = cosmetics.equip[cls];
  $('cu-items').replaceChildren(...itemsFor(custSlot).map((it) => itemCard(it.id, {
    on: eq[custSlot] === it.id || tryOn === it.id,
    onClick: () => {
      if (owns(cosmetics, it.id)) {
        eq[custSlot] = it.id; tryOn = null; saveCosmetics(cosmetics);
        if (custSlot === 'wskin') refreshGuns();
        sounds.cloth?.();
      } else { tryOn = it.id; sounds.click?.(2000, 0.15); }
      renderMenu();
    },
  })));
  const foot = $('cu-foot');
  if (tryOn) {
    const it = ITEMS[tryOn];
    const go = el('button', null, 'GET IT IN THE SHOP ›');
    go.type = 'button';
    go.onclick = () => { const t = tryOn; showTab('shop'); tryOn = t; renderMenu(); };
    foot.replaceChildren(`Previewing ${it.name} (not owned).`, go);
  } else foot.replaceChildren(`Equipped on ${CLASSES[cls].name}. Click an owned item to wear it, or a locked one to preview it.`);
}
function renderShop() {
  const sell = Object.keys(ITEMS).filter((id) => ITEMS[id].price > 0);
  const pick = (id) => () => { tryOn = id; sounds.click?.(2000, 0.15); renderMenu(); };
  $('sh-featured').replaceChildren(...FEATURED.map((id) => itemCard(id, { on: tryOn === id, onClick: pick(id) })));
  const filters = [['all', 'ALL'], ...CSLOTS.filter((s0) => sell.some((id) => ITEMS[id].slot === s0.id)).map((s0) => [s0.id, s0.name])];
  $('sh-filter').replaceChildren(...filters.map(([id, name]) => {
    const b = el('button', id === shopFilter ? 'on' : '', name);
    b.type = 'button';
    b.onclick = () => { shopFilter = id; renderMenu(); };
    return b;
  }));
  const order = { legendary: 0, epic: 1, rare: 2, common: 3 };
  const list = sell.filter((id) => !FEATURED.includes(id) && (shopFilter === 'all' || ITEMS[id].slot === shopFilter))
    .sort((a, b) => order[ITEMS[a].rarity] - order[ITEMS[b].rarity] || ITEMS[b].price - ITEMS[a].price);
  $('sh-grid').replaceChildren(...list.map((id) => itemCard(id, { on: tryOn === id, onClick: pick(id) })));
  // buy panel for the selected item
  const box = $('sh-buy');
  if (!tryOn) { box.classList.remove('on'); return; }
  const it = ITEMS[tryOn], r = RARITY[it.rarity], own = owns(cosmetics, tryOn);
  box.classList.add('on');
  box.style.setProperty('--r', rgb(r.color));
  const slotName = CSLOTS.find((x) => x.id === it.slot).name;
  const worn = own && cosmetics.equip[custCls || classLo.cls][it.slot] === tryOn;
  const btn = el('button', own ? 'own' : cosmetics.credits < it.price ? 'no' : '', worn ? 'EQUIPPED ✓' : own ? 'EQUIP' : `BUY ◆ ${fmt(it.price)}`);
  btn.type = 'button';
  btn.onclick = () => {
    const cls = custCls || classLo.cls;
    if (!own && !buy(cosmetics, tryOn)) { sounds.dry?.(); return; }
    if (!own) sounds.pickup?.();
    cosmetics.equip[cls][it.slot] = tryOn;
    if (cls === classLo.cls) setHandLook(buildOutfit(cosmetics, cls));
    saveCosmetics(cosmetics);
    if (it.slot === 'wskin') refreshGuns();
    renderMenu();
  };
  const note = worn ? `Wearing it on ${CLASSES[custCls || classLo.cls].name}.` : own ? `Owned. Equip it on ${CLASSES[custCls || classLo.cls].name}.` : cosmetics.credits < it.price ? 'Not enough credits.' : `Buys and equips on ${CLASSES[custCls || classLo.cls].name}.`;
  box.replaceChildren(el('small', null, `${r.name} · ${slotName}`), el('b', null, it.name), btn, el('p', null, note));
}
// rebuild guns after a weapon-skin change (in your hands, the cases and the showroom)
function refreshGuns() {
  setHandLook(buildOutfit(cosmetics, classLo.cls));
  slots.forEach((w) => { const a = w.ammo; w.setDef(defFor(w.def.id)); w.ammo = Math.min(a, w.def.mag); });
  cases.forEach((c) => { if (c.def) c.def = defFor(c.def.id); });
  showroomKey = '';
}
// PLAY: matchmaking → loadout (30 s) → team intro → the arena. Once you're in a match, PLAY resumes it.
let match = null;
const mmk = new Matchmaking({
  root: $('mmk'), classLo, sounds, maps: ARENAS.map((a) => a.name),
  onChange: () => { classDirty = true; renderMenu(); },
  onCancel: () => { menu.classList.remove('hidden'); renderMenu(); },
  onDone: (m) => {
    match = m;
    stadium = ARENAS[m.map] || ARENAS[0];
    setTeamsHud(m);
    where = 'none';            // arrive fresh
    classDirty = true;
    enterStadium();
    startMatch(m);
  },
});
// ONLINE: host or join a room for 1v1 / 2v2 with friends
const lobby = new Lobby(world, {
  root: $('net'), arenas: ARENAS.map((a) => a.name), getClass: () => classLo.cls,
  onClose: () => { menu.classList.remove('hidden'); renderMenu(); },
  onStart: (info) => startOnline(info),
  onHostLeft: () => { banner('HOST LEFT', 'MATCH OVER', 'bad', 2); setTimeout(() => endMatch(true), 1600); },
});
const online = lobby.online;
const netHooks = {
  player,
  onShatter: (b) => botHooks.onShatter(b),
  remoteShot: (f, e, r) => { effects.tracer(f, e); sounds.botShot(Math.hypot(player.pos[0] - f[0], player.pos[2] - f[2])); if (r) botHooks.whiz(f, e); },
  remoteHit: (dmg, from, name, byId) => { player.lastHitBy = byId; damagePlayer(dmg, from, name); },
  feed: (a, b, wid) => killFeed(a, WEAPONS[wid]?.name || 'GUN', b, false),
  banner: (...a) => banner(...a),
  weaponId: () => weapon().def.id,
  cloaked: () => cloakT > 0,
  grapplePoint: () => (player.grapple && player.grapple.phase !== 'miss' ? player.grapple.point.map((v) => +v.toFixed(2)) : null),
  remoteGadget: (spec) => gadgets.place(spec),
  remoteHeavy: (m) => heavy.remote(m),
  remoteGadgetHit: (gid, dmg) => gadgets.damage(gadgets.byId(gid), dmg),
  get stadium() { return stadium; },
  // hooks for the bots I run when I'm hosting: the usual bot hooks, but their shots are seen by everyone, kills are
  // reported by the online match, and they leave their gear at home
  bot: {
    ...botHooks,
    shot: (b, from, end, pd) => { botHooks.shot(b, from, end, pd); online.send({ t: 'shot', id: b.agent.id, f: from.map((v) => +v.toFixed(2)), e: end.map((v) => +v.toFixed(2)) }); },
    hitPlayer: (dmg, bot, from) => { player.lastHitBy = bot.agent.id; damagePlayer(dmg, from, bot.name); },
    onBotKill: () => {},
    botGear: () => 30,
    barricade: () => false,
  },
};
function startOnline(info) {
  if (ai.active) ai.stop();
  tdm = online;
  online.g = netHooks;
  stadium = ARENAS[info.arena] || ARENAS[0];
  match = { online: true, teams: info.teams.map((t) => ({ name: t.name, col: t.col, mine: t.mine })) };
  setTeamsHud(match);
  where = 'none';
  classDirty = true;
  menu.classList.add('hidden');
  enterStadium();
  batches.world = null;
  gadgets.clear(); burning.clear(); heavy.clear(); heavyCd = 0; putAwayLauncher(false); playerTether = null; cloakT = 0; playerBurn = null;
  resetGlass();
  const sp = stadium.spawns[info.team];
  player.spawn(sp.pos, sp.yaw);
  Object.assign(player, { hp: player.maxHp, dead: false, invuln: 1.5, lastHitBy: null });
  $('matchend').classList.add('hidden');
  if (!playing) banner('CLICK TO PLAY', `${stadium.name} · THE MATCH IS ON`, 'good', 3);
}
// in a match but not holding the mouse (the match started from the lobby, or a rematch): a click jumps back in
addEventListener('mousedown', () => {
  if (playing || bench.open || lobby.open || !tdm.active || !inStadium()) return;
  if (!menu.classList.contains('hidden') || !$('matchend').classList.contains('hidden')) return;
  start();
});
$('mm-online').addEventListener('click', () => { sounds.unlock(); menu.classList.add('hidden'); lobby.show(); });
addEventListener('keydown', (e) => {
  if (!lobby.open || e.target?.tagName === 'INPUT') return;
  if (e.code === 'Escape') { lobby.hide(); menu.classList.remove('hidden'); renderMenu(); }
  e.stopImmediatePropagation();
}, true);
function setTeamsHud(m) {
  $('teams').replaceChildren(...m.teams.map((t) => {
    const d = document.createElement('div');
    d.className = `tm${t.mine ? ' mine' : ''}`;
    d.style.setProperty('--t', t.col);
    const b = document.createElement('b'); b.textContent = t.name;
    const c = document.createElement('span'); c.textContent = '0';
    d.append(b, c);
    return d;
  }));
}
// ---------- tdm match: start / end, events, HUD ----------
let lastMatch = null;
function startMatch(m) {
  lastMatch = m;
  if (tdm === online || online.inRoom) { online.leave(); tdm = ai; }
  batches.world = null;     // re-batch once the match props are set up
  gadgets.clear(); burning.clear(); heavy.clear(); heavyCd = 0; putAwayLauncher(false); playerTether = null; cloakT = 0; playerBurn = null;
  resetGlass();
  walls.forEach((w) => w.reset());
  tdm.start(m, stadium, player, classLo.cls);
  setTeamsHud(m);
  const sp = stadium.spawns[tdm.myTeam.idx];
  player.spawn(sp.pos, sp.yaw);
  Object.assign(player, { hp: player.maxHp, dead: false, invuln: 1 });
  $('matchend').classList.add('hidden');
}
function endMatch(toMenu) {
  if (tdm === online) { online.leave(); tdm = ai; } else tdm.stop();
  gadgets.clear(); burning.clear(); heavy.clear(); heavyCd = 0; putAwayLauncher(false); playerTether = null; cloakT = 0; playerBurn = null;
  match = null;
  $('matchend').classList.add('hidden');
  if (toMenu && playing) setPlaying(false);
  renderMenu();
}
function matchEvents() {
  for (const ev of tdm.events) {
    if (ev.type === 'start') { banner('TEAM DEATHMATCH', `${stadium.name} · FIRST TO 10 KILLS`, '', 2.6); sounds.startRun?.(); }
    else if (ev.type === 'kill') {
      const mine = ev.team === tdm.myTeam, left = 10 - ev.team.kills;
      if (ev.killer === tdm.you) { sounds.checkpoint?.(); banner('ELIMINATED', ev.victim.name, 'good', 1); }
      if (left > 0 && left <= 3 && !tdm.over && !ev.remoteScore) banner(`${left} TO GO`, `${ev.team.name} ${mine ? '— YOUR TEAM' : ''}`.trim(), mine ? 'good' : 'bad', 1.4);
    } else if (ev.type === 'end') { banner(`${ev.winner.name} WIN`, ev.winner === tdm.myTeam ? 'YOU ADVANCE' : 'ELIMINATED', ev.winner === tdm.myTeam ? 'good' : 'bad', 2.6); sounds.finish?.(); setTimeout(showMatchEnd, 2600); }
  }
  tdm.events.length = 0;
}
function showMatchEnd() {
  if (!tdm.over) return;
  const st = tdm.over.standings, place = st.indexOf(tdm.myTeam);
  const el = $('matchend');
  const card = document.createElement('div');
  card.className = 'me-card';
  const h = document.createElement('small'); h.textContent = `THE SEMI-FINALS · ${stadium.name}`;
  const t = document.createElement('b'); t.textContent = place < 1 ? 'YOU ADVANCE TO THE FINAL' : 'ELIMINATED';
  t.className = place < 1 ? 'win' : 'lose';
  card.append(h, t);
  st.forEach((tm, i) => {
    const r = document.createElement('div');
    r.className = `me-row${tm === tdm.myTeam ? ' mine' : ''}${i < 1 ? ' adv' : ''}`;
    r.style.setProperty('--t', tm.col);
    r.innerHTML = `<i>${i + 1}</i><b></b><span>${tm.kills} KILLS</span>`;
    r.querySelector('b').textContent = tm.name;
    card.append(r);
  });
  const btn = (text, fn, cls = '') => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.className = cls; b.onclick = fn; card.append(b); return b; };
  const again = () => { $('matchend').classList.add('hidden'); start(); };
  if (tdm === online) {
    if (online.isHost) btn('REMATCH', () => { online.rematch(); again(); });
    else { const w = document.createElement('p'); w.className = 'me-wait'; w.textContent = 'WAITING FOR THE HOST TO START A REMATCH…'; card.append(w); }
  } else if (lastMatch) btn('PLAY AGAIN', () => { startMatch(lastMatch); again(); });
  btn(tdm === online ? 'LEAVE' : 'BACK TO LOBBY', () => endMatch(true), 'alt');
  el.replaceChildren(card);
  el.classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}
const markerEls = [], tagEls = [];
let tagT = 0;
function poolEl(pool, parent, cls, i) {
  if (!pool[i]) { const d = document.createElement('div'); d.className = cls; d.innerHTML = '<i></i><b></b><small></small>'; parent.append(d); pool[i] = d; }
  return pool[i];
}
// ---------- scoreboard: hold Tab in a match ----------
let boardT = 0;
function updateBoard(dt) {
  const show = tdm.active && inStadium() && playing && input.down('Tab');
  $('board').classList.toggle('hidden', !show);
  if (!show || (boardT -= dt) > 0) return;
  boardT = 0.25;
  const kd = (e) => (tdm === online ? online.kd?.[e.isPlayer ? online.myId : e.id] || { k: 0, d: 0 } : { k: e.kills || 0, d: e.deaths || 0 });
  const rows = tdm.entities().map((e) => ({ e, ...kd(e) }));
  const cols = tdm.teams.map((t) => {
    const col = document.createElement('div');
    col.className = `bd-team${t === tdm.myTeam ? ' mine' : ''}`;
    col.style.setProperty('--t', t.col);
    col.innerHTML = '<div class="bd-head"><b></b><span></span></div><div class="bd-row bd-labels"><span>PLAYER</span><span>CLASS</span><span>K</span><span>D</span></div>';
    col.querySelector('.bd-head b').textContent = t.name;
    col.querySelector('.bd-head span').textContent = `${t.kills} KILLS`;
    for (const r of rows.filter((x) => x.e.team === t).sort((a, b) => b.k - a.k || a.d - b.d)) {
      const row = document.createElement('div');
      row.className = `bd-row${r.e.isPlayer ? ' me' : ''}${r.e.alive ? '' : ' dead'}`;
      const name = r.e.isPlayer ? `${lobby.name || 'YOU'} (YOU)` : r.e.name;
      const cls = r.e.isPlayer ? classLo.cls : r.e.cls;
      for (const v of [name, CLASSES[cls]?.name || '', r.k, r.d]) { const c = document.createElement('span'); c.textContent = v; row.append(c); }
      col.append(row);
    }
    return col;
  });
  const head = document.createElement('div');
  head.className = 'bd-title';
  head.textContent = `${stadium.name} · FIRST TO ${tdm === online ? 10 : 10}`;
  $('board').replaceChildren(head, ...cols);
}
function updateMatchHud(dt) {
  updateBoard(dt);
  const on = tdm.active && inStadium() && (playing || !!tdm.over);
  $('objective').classList.toggle('hidden', !on);
  $('markers').classList.toggle('hidden', !on);
  $('tags').classList.toggle('hidden', !on);
  if (!on) return;
  const o = tdm.objective();
  const obj = $('objective');
  obj.children[0].textContent = o?.text || '';
  obj.children[0].style.color = o?.col || '#fff';
  obj.children[1].textContent = o?.sub || '';
  obj.children[2].style.setProperty('--p', (o?.steal || 0).toFixed(3));
  obj.children[2].style.opacity = o?.steal ? 1 : 0;
  [...$('teams').children].forEach((d, i) => { const c = String(tdm.teams[i].kills); if (d.lastChild.textContent !== c) d.lastChild.textContent = c; });
  // objective markers, pinned to the screen edge when off screen
  const ms = tdm.markers(), eye = player.eye();
  ms.forEach((m, i) => {
    const el = poolEl(markerEls, $('markers'), 'mkr', i);
    let sp = project(m.pos);
    const W = innerWidth, H = innerHeight, pad = 46;
    let edge = false;
    if (!sp) { const f = player.forward(); const side = (m.pos[0] - eye[0]) * -f[2] + (m.pos[2] - eye[2]) * f[0]; sp = [side > 0 ? W - pad : pad, H * 0.55]; edge = true; }
    if (sp[0] < pad || sp[0] > W - pad || sp[1] < pad + 80 || sp[1] > H - 190) edge = true;
    sp = [clamp(sp[0], pad + 120, W - pad - 120), clamp(sp[1], pad + 80, H - 190)];
    el.style.transform = `translate(${sp[0].toFixed(1)}px, ${sp[1].toFixed(1)}px)`;
    el.style.setProperty('--c', m.col);
    el.className = `mkr ${m.kind}${edge ? ' edge' : ''}`;
    el.children[0].textContent = m.kind === 'station' ? '⬢' : m.kind === 'box' ? '◆' : '▼';
    el.children[1].textContent = m.label;
    el.children[2].textContent = `${Math.round(Math.hypot(m.pos[0] - eye[0], m.pos[1] - eye[1], m.pos[2] - eye[2]))} M`;
    el.style.display = '';
  });
  for (let i = ms.length; i < markerEls.length; i++) markerEls[i].style.display = 'none';
  // name tags: teammates always, enemies when you can see them
  tagT -= dt;
  const agents = tdm.agents;
  if (tagT <= 0) {
    tagT = 0.2;
    for (const a of agents) {
      if (!a.alive || a.team === tdm.myTeam) continue;
      const h = [a.pos[0], a.pos[1] + 1.6, a.pos[2]], d = [h[0] - eye[0], h[1] - eye[1], h[2] - eye[2]], L = Math.hypot(...d);
      a.seen = L < 45 && !world.raycast(eye, d.map((v) => v / L), L - 0.5, true, (b) => b.tag === 'glass' || b.tag === 'bot');
    }
  }
  let n = 0;
  for (const a of agents) {
    const ally = a.team === tdm.myTeam;
    if (!a.alive || (!ally && !a.seen)) continue;
    const sp = project([a.pos[0], a.pos[1] + 2.2 * a.bot.sc, a.pos[2]]);
    if (!sp || sp[0] < 0 || sp[0] > innerWidth || sp[1] < 0 || sp[1] > innerHeight) continue;
    const el = poolEl(tagEls, $('tags'), 'tag', n++);
    el.className = `tag${ally ? ' ally' : ''}`;
    el.style.setProperty('--c', a.team.col);
    el.style.transform = `translate(${sp[0].toFixed(1)}px, ${sp[1].toFixed(1)}px)`;
    el.children[0].textContent = ally ? '▼' : '';
    el.children[1].textContent = a.name;
    el.children[2].style.width = `${Math.round(clamp(a.hpFrac, 0, 1) * 100)}%`;
    el.style.display = '';
  }
  for (let i = n; i < tagEls.length; i++) tagEls[i].style.display = 'none';
}
$('mm-play').addEventListener('click', () => {
  if (match && inStadium() && !classDirty) { enterStadium(); return; }
  sounds.unlock();
  menu.classList.add('hidden');
  mmk.start();
  renderMenu();
});
addEventListener('keydown', (e) => {
  if (mmk.active && mmk.key(e)) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
function renderMenu() {
  const c = CLASSES[classLo.cls], sel = classLo[classLo.cls];
  document.documentElement.style.setProperty('--cls', rgb(c.color));
  $('mm-chip').innerHTML = '';
  $('mm-chip').append('CLASS ', el('b', null, c.name));
  $('mm-credits').textContent = `${fmt(cosmetics.credits)} ${CURRENCY}`;
  if (menuTab === 'custom') renderCustom();
  if (menuTab === 'shop') renderShop();
  $('mm-name').replaceChildren(el('b', null, c.name), el('span', null, `${WEAPONS[sel.weapon].name} · ${ABILITIES[sel.ability].short} · ${HEAVIES[sel.heavy].short}`));
  $('mm-range-sub').textContent = sessionStarted && !classDirty && !inStadium() ? 'RESUME YOUR SESSION' : 'GUNS · MOVEMENT · PARKOUR · BOTS';
  $('mm-play-sub').textContent = match && inStadium() && !classDirty ? `RESUME · ${stadium.name}` : 'SEMI-FINALS · FIND A MATCH';
  // play page summary
  const sum = $('mm-sum');
  const cell = (k, v) => { const d = el('div'); d.append(el('small', null, k), el('b', null, v)); return d; };
  const edit = el('button', 'edit', 'EDIT LOADOUT IN THE ARMOURY ›');
  edit.type = 'button';
  edit.onclick = () => showTab('armoury');
  sum.replaceChildren(cell('CLASS', c.name), cell('WEAPON', `${WEAPONS[sel.weapon].name} + ${WEAPONS[sel.sidearm].name}`), cell('ABILITY', ABILITIES[sel.ability].short), cell('HEAVY', HEAVIES[sel.heavy].short), edit);
  // armoury: class tabs
  $('mm-classes').replaceChildren(...CLASS_ORDER.map((id) => {
    const k = CLASSES[id];
    const b = el('button', `mm-class${id === classLo.cls ? ' on' : ''}`);
    b.type = 'button';
    b.style.setProperty('--c', rgb(k.color));
    b.append(el('b', null, k.name), el('span', null, `${k.hp} HP`));
    b.onclick = () => { classLo.cls = id; classDirty = true; saveLoadout(classLo); sounds.swap?.(); renderMenu(); };
    return b;
  }));
  const info = $('mm-classinfo');
  info.style.setProperty('--c', rgb(c.color));
  const stat = (name, p, txt) => { const d = el('div', 'mm-stat'); const i = el('i'); i.style.setProperty('--p', p); d.append(el('span', null, name), i, el('em', null, txt)); return d; };
  info.replaceChildren(el('p', null, c.desc), stat('HEALTH', c.hp / 350, String(c.hp)), stat('SPEED', (c.speed - 0.7) / 0.5, `${Math.round(c.speed * 100)}%`),
    stat('SIZE', c.build / 1.3, c.build < 1 ? 'SMALL' : c.build > 1 ? 'LARGE' : 'MEDIUM'));
  // weapons
  $('mm-weapons').replaceChildren(...c.weapons.map((id) => {
    const d = defFor(id), r = ratings(d);
    const pick = (n) => r.find((x) => x.name === n);
    const b = el('button', `mm-wpn${id === sel.weapon ? ' on' : ''}`);
    b.type = 'button';
    b.style.setProperty('--c', rgb(c.color));
    const bars = el('div', 'bars');
    for (const n of ['DAMAGE', 'FIRE RATE', 'RANGE']) {
      const sp = el('span', null, n); const i = el('i'); i.style.setProperty('--p', pick(n).v.toFixed(3)); sp.append(i); bars.append(sp);
    }
    b.append(el('b', null, WEAPONS[id].name), el('small', null, WEAPONS[id].type), bars);
    b.onclick = () => { sel.weapon = id; classDirty = true; saveLoadout(classLo); sounds.magIn?.(); renderMenu(); };
    return b;
  }));
  // sidearms
  $('mm-sidearms').replaceChildren(...c.sidearms.map((id) => {
    const b = el('button', `mm-wpn mm-side${id === sel.sidearm ? ' on' : ''}`);
    b.type = 'button';
    b.style.setProperty('--c', rgb(c.color));
    b.append(el('b', null, WEAPONS[id].name), el('small', null, WEAPONS[id].type));
    b.onclick = () => { sel.sidearm = id; classDirty = true; saveLoadout(classLo); sounds.magIn?.(); renderMenu(); };
    return b;
  }));
  // heavy weapons
  $('mm-heavies').replaceChildren(...c.heavies.map((id) => {
    const a = HEAVIES[id];
    const b = el('button', `mm-abl${id === sel.heavy ? ' on' : ''}`);
    b.type = 'button';
    b.style.setProperty('--c', rgb(c.color));
    b.append(el('b', null, a.name), el('small', null, `COOLDOWN ${a.cd}`), el('p', null, a.desc));
    b.onclick = () => { sel.heavy = id; classDirty = true; saveLoadout(classLo); sounds.click?.(2600, 0.3, 4); renderMenu(); };
    return b;
  }));
  // abilities
  $('mm-abilities').replaceChildren(...c.abilities.map((id) => {
    const a = ABILITIES[id];
    const b = el('button', `mm-abl${id === sel.ability ? ' on' : ''}`);
    b.type = 'button';
    b.style.setProperty('--c', rgb(c.color));
    b.append(el('b', null, a.name), el('small', null, `COOLDOWN ${a.cd}`), el('p', null, a.desc));
    b.onclick = () => { sel.ability = id; classDirty = true; saveLoadout(classLo); sounds.click?.(2600, 0.3, 4); renderMenu(); };
    return b;
  }));
  // showroom character
  setShowroomClass();
}

// ---------- showroom (the 3D scene behind the main menu) ----------
let showroomChar = null, showroomKey = '', showroomCls = 'medium';
const skinClassShown = () => showroomCls;
function setShowroomClass() {
  const dressing = menuTab === 'custom' || menuTab === 'shop';
  const cls = dressing ? (custCls || classLo.cls) : classLo.cls;
  const c = CLASSES[cls], sel = classLo[cls];
  const key = `${cls}|${sel.weapon}|${JSON.stringify(cosmetics.equip[cls])}|${tryOn}`;
  if (key === showroomKey) return;
  showroomKey = key;
  showroomCls = cls;
  const sp = map.showroom.spot;
  const keepT = showroomChar ? showroomChar.t : 0;
  showroomChar = new Contestant({ ...buildOutfit(cosmetics, cls, tryOn), name: c.name }, sp, 0.18);   // nearly square to the camera
  showroomChar.t = keepT;
  showroomChar.pose = 'lobby';
  showroomChar.realGun = true;
  skinClass = cls;
  showroomChar.gunDef = skinDef(buildDef(WEAPONS[sel.weapon], loadouts[sel.weapon] || {}), gunSkinFor(cosmetics, cls, tryOn));
  skinClass = null;
  const R = map.showroomRefs;
  R.panels.forEach((p, i) => { p.color = [...c.color]; p.emissive = i % 2 ? 0.45 : 0.85; });
  R.bars.forEach((p) => { p.color = [...c.color]; });
  R.ring.forEach((p) => { p.color = [...c.color]; });
}
const projS = mat4(), viewS = mat4();
let camBlend = 1;
function drawShowroom(aspect) {
  const cam = map.showroom.cam;
  // home: character centred; other screens: character on the right of the panel
  const home = menuTab === 'home' && !mmk.active;
  const k = home ? 1 : 0;
  camBlend += (k - camBlend) * Math.min(1, 0.12);
  const look = [cam.look[0] - 0.88 * camBlend, cam.look[1] + 0.05 * camBlend, cam.look[2]];
  const eye = [cam.eye[0] - 0.25 * camBlend + Math.sin(time * 0.2) * 0.12, cam.eye[1] + Math.sin(time * 0.31) * 0.03 + 0.05 * camBlend, cam.eye[2] - 0.5 * camBlend];
  const fwd = norm([look[0] - eye[0], look[1] - eye[1], look[2] - eye[2]]);
  perspective(projS, (aspect < 1 ? 62 : 40) * Math.PI / 180, aspect, 0.05, 1000);
  lookDir(viewS, eye, fwd, [0, 1, 0], 0);
  renderer.begin();
  // seamless photo-studio backdrop in the class colour, one soft key light from the upper left
  const rc = CLASSES[skinClassShown()].color;
  renderer.setStudio(rc, fwd, [0.55, 0.78, -0.5]);
  renderer.setCamera(projS, viewS, 0.075, eye, false);
  renderer.setBlend(false);
  renderer.drawSky(eye);
  const sp = map.showroom.spot;
  compose(studioFloorM, [sp[0], sp[1] - 0.05, sp[2]], [0, 0, 0], [80, 0.1, 80]);
  renderer.draw(studioFloorM, [80, 0.1, 80], rc.map((v) => v * 0.62), 0, 0, 0, 1, undefined, 'poly');
  if (showroomChar) {
    showroomChar.t = time;
    // soft contact shadow under the feet
    renderer.setBlend(true);
    compose(studioShadowM, [sp[0], sp[1] + 0.004, sp[2]], [0, 0, 0], [0.95, 0.01, 0.7]);
    renderer.draw(studioShadowM, [0.95, 0.01, 0.7], [0, 0, 0], 0, 0, 0, 0.38, 'sphere');
    compose(studioShadowM2, [sp[0], sp[1] + 0.006, sp[2]], [0, 0, 0], [0.55, 0.01, 0.42]);
    renderer.draw(studioShadowM2, [0.55, 0.01, 0.42], [0, 0, 0], 0, 0, 0, 0.35, 'sphere');
    renderer.setBlend(false);
    renderer.setRim(rc.map((v) => v * 0.55));
    for (const p of showroomChar.parts()) renderer.drawPart(p);
    for (const p of Weapon.worldParts(showroomChar.gunDef, showroomChar.gunMatrix)) renderer.drawPart(p);
    renderer.setRim(null);
  }
  renderer.setStudio(null);
}
const studioFloorM = mat4(), studioShadowM = mat4(), studioShadowM2 = mat4();
showTab('home');
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    locked = true;
    $('locknote').classList.add('hidden');
  } else if (locked) {
    locked = false;
    if (!bench.open) setPlaying(false);    // leaving lock to use the workbench isn't pausing
  }
});
addEventListener('keydown', (e) => {
  if (bench.open) {
    if (e.code === 'Escape' || e.code === 'KeyE') { e.preventDefault(); closeBench(); }
    return;
  }
  if (playing && !locked && (e.code === 'Escape' || e.code === 'KeyP')) setPlaying(false);
  else if (!playing && e.code === 'Enter') resume();
});

// ---------- plus menu: hold B to swap attachments mid-fight (like Battlefield 2042) ----------
// Four arms: optic (up), underbarrel (left), muzzle (right), ammo (down). The mouse moves a cursor; click a part to fit it.
const PLUS_ARMS = [['optic', 'top'], ['underbarrel', 'left'], ['muzzle', 'right'], ['ammo', 'bottom']];
const plus = { open: false, cur: [0, 0], opts: [], hot: null, swapT: 0 };
function plusOptions(id, slot) {
  const all = optionsFor(id, slot), cur = (loadouts[id] || {})[slot];
  const pick = all.slice(0, 4);
  if (cur && !pick.some((o) => o.id === cur)) pick[3] = all.find((o) => o.id === cur);
  return [null, ...pick];
}
function renderPlus() {
  const root = $('plus'), w = weapon(), id = w.def.id, lo = loadouts[id] || {};
  root.replaceChildren();
  const head = document.createElement('div');
  head.className = 'pl-head';
  head.innerHTML = `<b></b><span>CLICK A PART · RELEASE B TO CLOSE</span>`;
  head.firstChild.textContent = w.def.name;
  root.append(head);
  for (const [slot, side] of PLUS_ARMS) {
    const opts = optionsFor(id, slot).length ? plusOptions(id, slot) : [];
    const arm = document.createElement('div');
    arm.className = `pl-arm ${side}${opts.length ? '' : ' empty'}`;
    const t = document.createElement('small');
    t.textContent = SLOTS.find((x) => x.id === slot).name;
    arm.append(t);
    for (const o of opts) {
      const b = document.createElement('div');
      const aid = o ? o.id : null;
      b.className = `pl-opt${(lo[slot] || null) === aid ? ' on' : ''}`;
      b.textContent = o ? o.name : 'FACTORY';
      b.dataset.slot = slot; b.dataset.aid = aid || '';
      arm.append(b);
    }
    if (!opts.length) { const n = document.createElement('div'); n.className = 'pl-opt none'; n.textContent = 'N/A'; arm.append(n); }
    root.append(arm);
  }
  const c = document.createElement('i');
  c.className = 'pl-cursor';
  root.append(c);
  root.classList.remove('hidden');
  plus.opts = [...root.querySelectorAll('.pl-opt:not(.none)')].map((e) => ({ e, r: e.getBoundingClientRect() }));
}
function updatePlus() {
  const want = input.down('KeyB') && !player.dead && !cutscene && !pressSeq;
  if (want && !plus.open) { plus.open = true; plus.cur = [innerWidth / 2, innerHeight / 2]; renderPlus(); sounds.click?.(1800, 0.12); }
  if (!want && plus.open) { plus.open = false; $('plus').classList.add('hidden'); }
  if (!plus.open) return;
  plus.cur[0] = clamp(plus.cur[0] + input.dx * 1.1, 0, innerWidth);
  plus.cur[1] = clamp(plus.cur[1] + input.dy * 1.1, 0, innerHeight);
  const c = $('plus').querySelector('.pl-cursor');
  if (c) c.style.transform = `translate(${plus.cur[0]}px, ${plus.cur[1]}px)`;
  let hot = null;
  for (const o of plus.opts) {
    const { r } = o;
    if (plus.cur[0] >= r.left - 6 && plus.cur[0] <= r.right + 6 && plus.cur[1] >= r.top - 3 && plus.cur[1] <= r.bottom + 3) { hot = o; break; }
  }
  if (hot !== plus.hot) { plus.hot?.e.classList.remove('hot'); hot?.e.classList.add('hot'); plus.hot = hot; }
  if (input.fireHit && hot) {
    const w = weapon(), id = w.def.id, slot = hot.e.dataset.slot, aid = hot.e.dataset.aid || null;
    const next = { ...(loadouts[id] || {}) };
    if (aid) next[slot] = aid; else delete next[slot];
    const ammo = w.ammo;
    applyLoadout(id, next);
    w.ammo = Math.min(ammo, w.def.mag);           // swapping parts doesn't refill the gun
    w.equipT = Math.min(w.equipT, 0.55);          // a quick fiddle with the gun
    sounds.magIn?.();
    player.camPitchV += 0.15;
    renderPlus();
  }
  // the menu has the mouse: no looking around or shooting while it's open
  input.dx = 0; input.dy = 0;
  input.clicked.delete(0); input.buttons.delete(0);
}

// ---------- workbench ----------
const bench = new Bench({
  root: $('bench'),
  getLoadout: (id) => loadouts[id] || {},
  setLoadout: (id, lo) => applyLoadout(id, lo),
  sounds,
  onClose: () => closeBench(),
});
function openBench() {
  bench.show(weapon().def.id);
  document.body.classList.add('benching');
  input.enabled = false;
  input.reset();
  document.body.classList.remove('playing');
  sounds.cloth();
  if (document.pointerLockElement) document.exitPointerLock();
}
function closeBench() {
  bench.hide();
  document.body.classList.remove('benching');
  sounds.cloth();
  start();       // re-locks the mouse (this runs from a click/keypress, so the browser allows it)
}
let lastWheel = 0;
addEventListener('wheel', () => {
  if (!playing || performance.now() - lastWheel < 250) return;
  lastWheel = performance.now();
  switchTo(current === 0 ? 1 : 0);
}, { passive: true });

function bindSlider(id, key, fmt, onChange) {
  const el = $(id), out = $(`${id}-val`);
  el.value = settings[key];
  out.textContent = fmt(settings[key]);
  el.addEventListener('input', () => {
    settings[key] = parseFloat(el.value);
    out.textContent = fmt(settings[key]);
    onChange?.(settings[key]);
    saveSettings();
  });
}
bindSlider('sens', 'sens', (v) => v.toFixed(2));
bindSlider('fov', 'fov', (v) => `${v}°`);
bindSlider('vol', 'volume', (v) => `${Math.round(v * 100)}%`, (v) => sounds.setVolume(v));

// ---------- keyboard aim / shoot, rebindable ----------
const RESERVED = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ControlLeft', 'KeyC', 'KeyR', 'KeyE',
  'KeyT', 'KeyX', 'Digit1', 'Digit2', 'Escape', 'KeyP', 'Enter'];
const BINDS = { aimKey: 'bind-aim', fireKey: 'bind-fire', abilityKey: 'bind-ability', heavyKey: 'bind-heavy' };
const keyName = (code) => code.replace(/^Key/, '').replace(/^Digit/, '').replace(/Left$|Right$/, (m) => ` ${m.toUpperCase()}`).toUpperCase();
let rebinding = null;
function refreshBindButtons() {
  for (const [k, id] of Object.entries(BINDS)) $(id).textContent = keyName(settings[k]);
  $('aim-mode').textContent = settings.aimMode === 'toggle' ? 'TOGGLE' : 'HOLD';
  $('trackpad-mode').textContent = settings.trackpad ? 'ON' : 'OFF';
  document.querySelectorAll('.keyhint-aim').forEach((el) => { el.textContent = keyName(settings.aimKey); });
  document.querySelectorAll('.keyhint-fire').forEach((el) => { el.textContent = keyName(settings.fireKey); });
  document.querySelectorAll('.keyhint-ability').forEach((el) => { el.textContent = keyName(settings.abilityKey); });
  document.querySelectorAll('.keyhint-heavy').forEach((el) => { el.textContent = keyName(settings.heavyKey); });
}
function startRebind(which, btn) {
  rebinding = { which, btn };
  btn.textContent = 'PRESS A KEY…';
  btn.classList.add('waiting');
  $('bindnote').textContent = 'Esc to cancel';
}
for (const [k, id] of Object.entries(BINDS)) $(id).addEventListener('click', (e) => startRebind(k, e.currentTarget));
$('trackpad-mode').addEventListener('click', () => {
  settings.trackpad = !settings.trackpad;
  applyBinds(); saveSettings(); refreshBindButtons();
});
$('aim-mode').addEventListener('click', () => {
  settings.aimMode = settings.aimMode === 'toggle' ? 'hold' : 'toggle';
  applyBinds(); saveSettings(); refreshBindButtons();
});
addEventListener('keydown', (e) => {
  if (!rebinding) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const { which, btn } = rebinding;
  btn.classList.remove('waiting');
  rebinding = null;
  if (e.code !== 'Escape') {
    const taken = Object.keys(BINDS).some((k) => k !== which && settings[k] === e.code);
    if (RESERVED.includes(e.code) || taken) {
      $('bindnote').textContent = `${keyName(e.code)} is already used — pick another key`;
    } else {
      settings[which] = e.code;
      $('bindnote').textContent = '';
      applyBinds(); saveSettings(); refreshAbilityKeys();
    }
  } else $('bindnote').textContent = '';
  refreshBindButtons();
}, true);
refreshBindButtons();

// ---------- grapple rope + laser sight ----------
const previewM = mat4();
const beamPool = Array.from({ length: 4 }, () => mat4());
function beam(i, a, b, thick, color, emissive, alpha) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d);
  if (l < 0.01) return null;
  const s = [thick, thick, l];
  compose(beamPool[i], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], anglesFor(d), s);
  return { model: beamPool[i], scale: s, color, emissive, alpha };
}
let reel = null;           // the grapple line reeling back in after you let go
function worldBeams(w) {
  const out = [];
  const g = player.grapple;
  if (!bench.open && (g || reel)) {
    const hm = w.handModels[0];
    const hand = vmToWorld([hm[12], hm[13], hm[14]]);
    let tip, sag = 0, wave = 0, open = 0, spin = time * 26;
    if (g && g.phase === 'fire') {
      // the hook flies out spinning, the line snaking after it
      const k = Math.min(g.t / g.travel, 1);
      tip = hand.map((c, i) => c + (g.point[i] - c) * k);
      wave = 0.12 + 0.3 * (1 - k); sag = 0.15;
    } else if (g && g.phase === 'pull') {
      // it bites: claws open, the line twangs and pulls taut
      const ten = Math.min(1, g.t / 0.3);
      tip = g.point; open = 1; spin = g.spin ??= time * 26;
      wave = 0.2 * (1 - ten) * Math.cos(g.t * 30); sag = 0.35 * (1 - ten) * (1 - ten);
    } else if (g) {
      const k = g.t < 0.16 ? g.t / 0.16 : Math.max(0, 1 - (g.t - 0.16) / 0.16);
      tip = g.from.map((c, i) => c + g.dir[i] * 45 * k);
      wave = 0.3; sag = 0.5 * k;
    } else {
      // let go: the line reels back into the launcher
      const k = Math.min(1, (time - reel.t0) / 0.2);
      tip = reel.tip.map((c, i) => c + (hand[i] - c) * k * k);
      if (k >= 1) reel = null;
      wave = 0.25 * (1 - k); sag = 0.6 * (1 - k); open = 1 - k;
    }
    if (g && g.phase !== 'miss') reel = { tip: [...tip], t0: time };
    const dir = tip.map((c, i) => c - hand[i]);
    const accent = player.grappleMode === 'tether' ? TETHER_COL : undefined;
    out.push(...ropeParts(hand, tip, { sag, wave, t: time, thick: 0.017, accent }));
    if (Math.hypot(...dir) > 0.3) out.push(...hookParts(tip, dir, spin, open, accent));
  }
  heavy.parts(out, time);
  const lp = !bench.open && !w.scoped ? w.laserPoint() : null;
  if (lp) {
    // the laser follows the barrel, not the crosshair
    const start = vmToWorld(lp);
    const far = vmToWorld(w.gunPoint([w.def.laser[0], w.def.laser[1], w.def.laser[2] - 30]));
    const ldir = norm(far.map((c, i) => c - start[i]));
    const hit = world.raycast(start, ldir, 120);
    const end = hit ? hit.point : start.map((c, i) => c + ldir[i] * 120);
    const lc = w.def.laserCol || [1, 0.12, 0.08];
    const r = w.adsT < 0.6 ? beam(2, start, end, 0.006, lc, 1, 0.35 * (1 - w.adsT / 0.6)) : null;
    if (r) out.push(r);
    if (hit) {
      const sz = 0.025 + hit.t * 0.0012;
      const dm = beamPool[3];
      compose(dm, hit.point.map((c, i) => c + hit.normal[i] * 0.01), [0, 0, 0], [sz, sz, sz]);
      out.push({ model: dm, scale: [sz, sz, sz], color: lc, emissive: 1, alpha: 0.9 });
    }
  }
  return out;
}

// ---------- stadium: launch pads and the void ----------
function launch(pad) {
  // aim the arc so it lands on the pad's target: pick the upward speed, solve for the flight time
  const g = 21, from = player.pos, to = pad.to;
  const dy = to[1] - from[1], vy = Math.max(pad.vy, Math.sqrt(Math.max(0, 2 * g * dy)) + 1);
  const T = (vy + Math.sqrt(vy * vy - 2 * g * dy)) / g;
  player.cancelAbilities?.();
  Object.assign(player, { sliding: false, grounded: false, trav: null, wallRun: null });
  player.vel = [(to[0] - from[0]) / T, vy, (to[2] - from[2]) / T];
  player.shake = Math.max(player.shake || 0, 0.15);
  player.camPitchV -= 0.6;
  sounds.launch?.();
  effects.dust(player.pos, 6, [0, 6, 0]);
  padCd = 0.6;
}
// ---------- Sky Docks: the container hook and fall damage ----------
let fallTop = null;
// the container to hook: the nearest one in front of you within 45 m, else the nearest one at all
function hookTarget() {
  const eye = player.eye(), f = player.forward();
  let best = null, bs = Infinity;
  for (const b of world.boxes) {
    if (b.tag !== 'cargo') continue;
    // nearest point on the container's top
    const p = [clamp(eye[0], b.min[0] + 0.8, b.max[0] - 0.8), b.max[1] + 0.2, clamp(eye[2], b.min[2] + 0.8, b.max[2] - 0.8)];
    const d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]], L = Math.hypot(...d);
    if (L > 45 || L < 1.5) continue;
    const facing = (d[0] * f[0] + d[1] * f[1] + d[2] * f[2]) / L;
    const sc = L * (facing > 0.5 ? 1 : facing > 0 ? 1.8 : 3);
    if (sc < bs) { bs = sc; best = { box: b, point: p }; }
  }
  return best;
}
function updateFall() {
  if (!stadium.fallLethal || player.dead) { fallTop = null; return; }
  const y = player.pos[1];
  if (player.grapple && player.grapple.phase === 'pull') { fallTop = y; return; }   // hanging on a line resets the fall
  if (player.grounded) {
    if (fallTop != null) {
      const drop = fallTop - y;
      if (drop > stadium.fallLethal) { damagePlayer(9999, player.pos, 'THE DROP'); banner('TOO FAR', `A ${Math.round(drop)} M DROP`, 'bad', 1.4); }
      else if (drop > stadium.fallHurt) { damagePlayer(Math.round((drop - stadium.fallHurt) * 18), [player.pos[0], player.pos[1] - 1, player.pos[2]], 'THE DROP'); }
    }
    fallTop = null;
  } else fallTop = Math.max(fallTop ?? y, y);
}

function updateStadium(dt) {
  updateFall();
  const shoe = stadium.refs?.shoe;
  if (shoe) {
    if (!shoe.base) shoe.base = shoe.map((b) => [...b.center]);
    const bob = Math.sin(time * 0.7) * 1.2;
    shoe.forEach((b, i) => moveBoxTo(b, [shoe.base[i][0], shoe.base[i][1] + bob, shoe.base[i][2]]));
  }
  padCd -= dt;
  if (padCd <= 0 && player.grounded) {
    for (const p of stadium.pads) {
      if (Math.abs(player.pos[0] - p.at[0]) < 1.1 && Math.abs(player.pos[2] - p.at[2]) < 1.1 && Math.abs(player.pos[1] - (p.at[1] + 0.25)) < 0.3) { launch(p); break; }
    }
  }
  // fell into the void: out, back to the spawn
  if (player.pos[1] < stadium.voidY && voidT <= 0) {
    voidT = 0.35;
    sounds.fail?.();
    banner(...(stadium.voidText || ['OUT', 'FELL INTO THE VOID']), 'bad', 1.3);
  }
  if (voidT > 0) {
    voidT -= dt;
    if (voidT <= 0) {
      player.respawn();
      Object.assign(player, { hp: player.maxHp, invuln: 1 });
    }
  }
}

// ---------- main loop ----------
const proj = mat4(), view = mat4(), vmProj = mat4(), identity = mat4();
let last = performance.now(), time = 0, fovKick = 0, timeScale = 1;
const weaponCtx = { fire, sounds };

let perfT = 0, perfN = 0, perfLast = 0;
// a bug in one frame must never stop the game loop (that freezes the game with the mouse still locked)
let frameErr = 0;
function frame(now) {
  try { frameBody(now); } catch (e) {
    if (frameErr++ < 3) console.error(e);
    requestAnimationFrame(frame);
  }
}
function frameBody(now) {
  const rdt = Math.min((now - last) / 1000, 0.05);
  if (slowmo > 0) slowmo -= rdt;
  const dt = rdt * timeScale * (slowmo > 0 ? 0.3 : 1);
  last = now;
  time += dt;
  // dynamic resolution: drop the render scale when frames take too long, raise it again when there's headroom
  if (playing && document.visibilityState === 'visible') {
    perfT += Math.min((now - perfLast) / 1000, 0.25); perfN++;
    if (perfT > 1.5) {
      const avg = perfT / perfN;
      if (avg > 1 / 50) renderer.resScale = Math.max(0.55, (renderer.resScale || 1) - 0.1);
      else if (avg < 1 / 58) renderer.resScale = Math.min(1, (renderer.resScale || 1) + 0.05);
      perfT = 0; perfN = 0;
    }
  }
  perfLast = now;

  if (playing && !bench.open && (cutscene || pressSeq || player.dead)) {
    // the player isn't in control right now
    if (input.hit('KeyT') && !tdm.active) resetRange();
    if (cutscene) updateCutscene(dt);
    else if (pressSeq) {
      updatePress(dt);
      weapon().update(dt, idleInput, player, weaponCtx);
    } else {
      deathT -= dt;
      if (deathT <= 0) respawnPlayer();
    }
    if (inStadium()) for (const c of stadium.cargo || []) c.update(dt, player);
    updateCombat(dt);
    updateCamera();
  } else if (playing && !bench.open) {
    let w = weapon();
    const sens = settings.sens * 0.0022 * (1 - w.adsT * (1 - w.def.adsZoom) * 0.9);
    updatePlus();             // hold B: swap attachments on the fly (eats the mouse while it's open)
    player.look(input.dx, input.dy, sens);
    if (input.hit('KeyT') && !tdm.active) resetRange();
    if (input.hit('Digit1')) switchTo(0);
    if (input.hit('Digit2')) switchTo(1);
    nearCase = findCase();
    nearBench = findBench();
    const liftBtn = lookLiftButton();
    if (liftBtn && input.hit('KeyE')) liftBtn.lift.press(liftBtn, sounds);
    else if (nearConsole() && input.hit('KeyE')) pressConsole();
    else if (nearCase?.ammo && input.hit('KeyE')) { slots.forEach((w) => { w.ammo = w.def.mag; }); sounds.magIn?.(); sounds.pickup(); }
    else if (nearCase && input.hit('KeyE')) pickUp(nearCase.def);
    else if (nearBench && input.hit('KeyE')) openBench();
    w = weapon();
    // only your class's equipped specialisation works
    let hooked = false;
    if (inStadium() && stadium.hook && input.hit(settings.abilityKey)) {
      if (player.grapple && player.grapple.phase !== 'miss') { player.releaseGrapple(false); sounds.grappleRelease(); hooked = true; }
      else {
        const t = hookTarget();
        if (t) { player.hookTo(t.box, t.point); hooked = true; fallTop = null; }
      }
    }
    const abilityHit = !hooked && input.hit(settings.abilityKey);
    const eq = equippedAbility;
    const act = { grapple: eq === 'grapple' && abilityHit, dash: eq === 'dash' && abilityHit, slam: eq === 'slam' && abilityHit };
    if (abilityHit) {
      if (eq === 'tether') useTether();
      else if (eq === 'cloak') useCloak();
      else if (ABIL_CD[eq]) useGadget(eq);
    }
    if (input.hit(settings.heavyKey)) useHeavy();
    if (launcherW && launcherT > 0 && (launcherT -= dt) <= 0) putAwayLauncher(true);
    elevator.update(dt, player, sounds);
    for (const l of lifts) l.update(dt, player, sounds);
    if (inStadium()) for (const c of stadium.cargo || []) c.update(dt, player);
    // heavier guns slow you down; a spinning minigun slows you a lot more
    player.speedMul = CLASSES[classLo.cls].speed * (w.def.moveMul ?? 1) * (w.def.spin && (w.spinT || 0) > 0.05 ? 0.72 : 1);
    player.update(dt, input, { ads: w.ads, firing: input.fireDown && w.ammo > 0 && !w.reloading && !player.trav, act });
    if (playerTether) {
      // tied down: you can't get further than the line's length from the spike
      const T = playerTether, a = T.anchor, p = player.pos;
      T.t -= dt;
      const dx = p[0] - a[0], dz = p[2] - a[2], d = Math.hypot(dx, dz);
      if (d > T.len) {
        p[0] = a[0] + (dx / d) * T.len; p[2] = a[2] + (dz / d) * T.len;
        const out = (player.vel[0] * dx + player.vel[2] * dz) / d;
        if (out > 0) { player.vel[0] -= (dx / d) * out; player.vel[2] -= (dz / d) * out; }
      }
      if (p[1] > a[1] + T.len + 1.2) { p[1] = a[1] + T.len + 1.2; player.vel[1] = Math.min(0, player.vel[1]); }
      if (player.grapple) player.releaseGrapple(false);
      if (T.t <= 0 || player.dead) playerTether = null;
    }
    if (inStadium()) updateStadium(dt);
    updateCombat(dt);
    course.update(dt, player, input);
    handlePlayerEvents();
    updateCamera();
    w.update(dt, input, player, weaponCtx);
    handleWeaponEvents(w);
  }
  dummies.forEach((d) => d.update(dt, time));
  if (playing && !bench.open) {
    gadgets.update(dt, [padRider]);
    heavy.update(dt);
    updateBurns(dt);
    updateHealing(dt);
    if (playerBurn) {
      playerBurn.t -= dt; playerBurn.acc += playerBurn.dps * dt;
      if (Math.random() < dt * 20) effects.flame([player.pos[0] + (Math.random() - 0.5) * 0.5, player.pos[1] + 0.3 + Math.random() * 1.2, player.pos[2] + (Math.random() - 0.5) * 0.5], [0, 0.5, 0], 1.3);
      if (playerBurn.acc >= 4) { const d = Math.floor(playerBurn.acc); playerBurn.acc -= d; player.lastHitBy = playerBurn.by; damagePlayer(d, playerBurn.by.pos || player.pos, playerBurn.by.name); }
      if (playerBurn.t <= 0 || player.dead) playerBurn = null;
    }
    if (cloakT > 0 && ((cloakT -= dt) <= 0 || player.dead)) { cloakT = 0; sounds.cloak?.(); }
    document.body.classList.toggle('cloaked', cloakT > 0);
    if (tdm.you) tdm.you.cloaked = cloakT > 0;
    heavyCd = Math.max(0, heavyCd - dt);
    if (player.dead && launcherW) putAwayLauncher(false);
  }
  effects.update(dt);

  // ---- render ----
  const w = weapon();
  const aspect = renderer.resize();
  if (!playing && !bench.open) {
    drawShowroom(aspect);
    input.endFrame();
    requestAnimationFrame(frame);
    return;
  }
  const targetKick = player.dash ? 16 : player.grapple?.phase === 'pull' ? 10 : player.slam?.phase === 'fall' ? 7 : player.wallRunning ? 8 : player.vaulting ? 8 : player.sliding ? 9 : player.sprinting ? 5 : player.mantle ? 3 : 0;
  fovKick += (targetKick - fovKick) * damp(player.dash ? 18 : 6, dt);
  const hfov = (settings.fov + fovKick) * (1 - w.adsT * (1 - w.def.adsZoom)) * Math.PI / 180;
  const vfov = 2 * Math.atan(Math.tan(Math.min(hfov, 2.9) / 2) / aspect);
  perspective(proj, vfov, aspect, 0.05, 500);
  updateCamera();
  lookDir(view, camEye, camFwd, [0, 1, 0], player.roll);
  mul(vp, proj, view);

  const caseParts = inStadium() ? [] : cases.flatMap((c) => c.parts(time, c === nearCase));
  // viewmodel first: the grapple rope and laser start from the hands / gun
  perspective(vmProjM, 58 * Math.PI / 180, aspect, 0.01, 10);
  lookDir(vmViewM, [0, 0, 0], [0, 0, -1], [0, 1, 0], player.roll * 0.5);
  worldVfov = vfov; worldAspect = aspect;
  const vmParts = bench.open || cutscene || player.dead ? [] : w.viewmodel(player, time);
  const botParts = tdm.active && inStadium() ? [...botMgr.drawParts(), ...tdm.drawParts()] : botMgr.drawParts();
  const beams = worldBeams(w);

  // shadow pass
  // keep the sun's shadow map centred on the player so the annex gets shadows too
  // only draw the place you're in (the range or the stadium), and only what the camera can see
  const st = inStadium(), SA = stadium.area;
  const curZone = st ? ARENAS.indexOf(stadium) : -1;
  const zoneOk = (b) => zoneOf(b) === curZone;
  const shadowHalf = st ? stadium.shadowHalf : 50;
  const sc = [Math.round(player.pos[0] / 8) * 8, Math.round(player.pos[1] / 8) * 8, Math.round(player.pos[2] / 8) * 8];
  renderer.setShadowArea(sc, shadowHalf);
  const fogD = st ? stadium.fog : 0.0095;
  const farCull = 2.4 / fogD;           // past this the fog has swallowed everything
  const radius = (b) => 0.5 * Math.hypot(b.scale[0], b.scale[1], b.scale[2]);
  const nearShadow = (b) => {
    const dx = b.center[0] - sc[0], dy = b.center[1] - sc[1], dz = b.center[2] - sc[2], lim = shadowHalf * 1.5 + radius(b);
    return dx * dx + dy * dy + dz * dz < lim * lim;
  };
  const tv = Math.tan(vfov / 2), kf = Math.hypot(tv, tv * aspect), kr = Math.sqrt(1 + kf * kf);
  const inView = (b) => {
    const r = radius(b);
    const dx = b.center[0] - camEye[0], dy = b.center[1] - camEye[1], dz = b.center[2] - camEye[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > (farCull + r) * (farCull + r)) return false;
    const al = dx * camFwd[0] + dy * camFwd[1] + dz * camFwd[2];
    if (al < -r) return false;
    if (Math.sqrt(Math.max(0, d2 - al * al)) > al * kf + r * kr) return false;
    return !!b.tag || r > 0.0022 * Math.sqrt(d2);     // skip tiny props far away (never targets)
  };
  // static scenery is drawn in instanced batches; only boxes that move or change are drawn one by one
  if (!batches.world) batches.build(world, zoneOf);
  batches.sync();
  const live = world.boxes.filter((b) => !b.hidden && !b.batched && zoneOk(b));
  const sphereShadow = (c, r) => {
    const dx = c[0] - sc[0], dy = c[1] - sc[1], dz = c[2] - sc[2], lim = shadowHalf * 1.5 + r;
    return dx * dx + dy * dy + dz * dz < lim * lim;
  };
  const sphereView = (c, r) => {
    const dx = c[0] - camEye[0], dy = c[1] - camEye[1], dz = c[2] - camEye[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > (farCull + r) * (farCull + r)) return false;
    const al = dx * camFwd[0] + dy * camFwd[1] + dz * camFwd[2];
    if (al < -r) return false;
    return Math.sqrt(Math.max(0, d2 - al * al)) <= al * kf + r * kr;
  };
  // character / prop parts: cull each against the view, and only nearby ones cast shadows
  const pc = [0, 0, 0];
  const partR = (p) => 0.5 * Math.hypot(p.scale[0], p.scale[1], p.scale[2]);
  const partAt = (p) => { pc[0] = p.model[12]; pc[1] = p.model[13]; pc[2] = p.model[14]; return pc; };
  const partView = (p) => sphereView(partAt(p), partR(p));
  const shadowNear = Math.min(shadowHalf, 32);
  const partShadow = (p) => {
    const c = partAt(p), dx = c[0] - player.pos[0], dy = c[1] - player.pos[1], dz = c[2] - player.pos[2];
    return dx * dx + dy * dy + dz * dz < shadowNear * shadowNear;
  };
  const caseVis = caseParts.filter(partView), botVis = botParts.filter(partView);
  renderer.beginShadow();
  batches.drawShadows(curZone, sphereShadow);
  for (const b of live) if (!b.noShadow && nearShadow(b)) renderer.shadowDraw(b.model, b.shape, b.scale);
  for (const p of caseParts) if (partShadow(p)) renderer.shadowDraw(p.model, p.shape, p.scale);
  effects.drawShadows(renderer);
  for (const p of botParts) if (partShadow(p)) renderer.shadowDraw(p.model, p.shape, p.scale);
  renderer.endShadow();

  // world
  renderer.begin();
  renderer.setCamera(proj, view, fogD, camEye, true);
  renderer.drawSky(camEye);
  renderer.setBlend(false);
  batches.draw(curZone, sphereView);
  const vis = live.filter(inView);
  for (const b of vis) if (b.alpha >= 1) renderer.drawBox(b);
  for (const p of caseVis) renderer.drawPart(p);
  effects.drawOpaque(renderer);
  for (const p of botVis) renderer.drawPart(p);
  renderer.setBlend(true);
  for (const b of vis) if (b.alpha < 1) renderer.drawBox(b);
  effects.drawTransparent(renderer);
  for (const b of beams) renderer.draw(b.model, b.scale, b.color, 0, 0, b.emissive, b.alpha);
  for (const b of botMgr.beams()) renderer.draw(b.model, b.scale, b.color, 0, 0, b.emissive, b.alpha);
  renderer.setBlend(false);

  // viewmodel
  renderer.clearDepth();
  renderer.setCamera(vmProjM, vmViewM, 0, [0, 0, 0], false);
  renderer.setUnder(camEye[1] < -1.2);
  if (bench.open) {
    // the gunsmith: the gun side-on in the middle of a dark studio, with its slot labels pinned to it
    renderer.clearTo([0.075, 0.08, 0.09]);
    const bd = defFor(bench.weaponId);
    const span = Math.max(0.5, Math.max(...bd.parts.filter((p) => !p.hidden).map((p) => p.c[2] + p.s[2] / 2)) - Math.min(...bd.parts.filter((p) => !p.hidden).map((p) => p.c[2] - p.s[2] / 2)));
    const dist = clamp(span * 1.25, 0.75, 1.7) * Math.max(1, 1.5 / aspect);
    compose(previewM, [-0.03 * dist, 0.02 * dist, -dist], [0.04, -Math.PI / 2 + bench.rotY, 0], [1, 1, 1]);
    for (const p of Weapon.worldParts(bd, previewM)) renderer.drawPart(p);
    mul(benchPV, vmProjM, vmViewM);
    const a = anchorsFor(bd), pts = {};
    for (const [k, v] of Object.entries(a)) {
      const w = [0, 1, 2].map((i) => previewM[i] * v[0] + previewM[4 + i] * v[1] + previewM[8 + i] * v[2] + previewM[12 + i]);
      const x = benchPV[0] * w[0] + benchPV[4] * w[1] + benchPV[8] * w[2] + benchPV[12];
      const y = benchPV[1] * w[0] + benchPV[5] * w[1] + benchPV[9] * w[2] + benchPV[13];
      const ww = benchPV[3] * w[0] + benchPV[7] * w[1] + benchPV[11] * w[2] + benchPV[15];
      if (ww > 0.01) pts[k] = [(x / ww * 0.5 + 0.5) * innerWidth, (1 - (y / ww * 0.5 + 0.5)) * innerHeight];
    }
    bench.layout(pts);
  } else {
    if (cloakT > 0) for (const p of vmParts) renderer.drawPart({ ...p, color: p.color.map((c, i) => c * 0.35 + [0.35, 0.6, 1][i] * 0.4), emissive: Math.max(p.emissive || 0, 0.35) });
    else for (const p of vmParts) renderer.drawPart(p);
  }

  updateHud(dt, vfov);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// handy for debugging from the console / automated tests
 window.game = { heavy, useHeavy, applyClass, useGadget, useTether, useCloak, get cloakT() { return cloakT; }, get launcherW() { return launcherW; }, gadgets, get burning() { return burning; }, lobby, online, get tdm() { return tdm; }, batches, renderer, map, ARENAS, get stadium() { return stadium; }, setArena: (i) => { stadium = ARENAS[i]; }, lifts, hooks: botHooks, updateFall, hookTarget, fallTop: () => fallTop, breakGlass, updateCombat, startMatch: (m) => startMatch(m), enterStadium, where: () => where, sr: () => showroomChar, cosmetics, refreshGuns, classLo, renderMenu, showTab, enterRange, cs: () => cutscene, botMgr, elevator, damagePlayer, pressConsole, setTimeScale: (v) => { timeScale = v; }, bench, openBench, closeBench, loadouts, applyLoadout, course, player, slots, weapon, world, stats, effects, dummies, walls, cases, input, start, setPlaying, resetRange, switchTo, pickUp, WEAPONS };
