import { Renderer } from './renderer.js';
import { World, moveBoxTo } from './world.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Weapon } from './weapon.js';
import { WEAPONS, CASE_ORDER } from './weapons.js';
import { Effects } from './effects.js';
import { Sounds } from './audio.js';
import { Dummy, DestructibleWall, WeaponCase, Workbench } from './props.js';
import { mat4, perspective, lookDir, mul, cross, norm, damp, dot, compose, anglesFor, clamp } from './math.js';
import { buildDef, ratings } from './attachments.js';
import { CLASSES, CLASS_ORDER, ABILITIES, loadLoadout, saveLoadout } from './classes.js';
import { Contestant } from './contestant.js';
import { Thumbs } from './thumbs.js';
import { SLOTS as CSLOTS, RARITY, ITEMS, FEATURED, CURRENCY, loadCosmetics, saveCosmetics, owns, itemsFor, buy, buildOutfit, gunSkinFor, skinDef, swatch, iconFor } from './cosmetics.js';
import { Bench } from './bench.js';
import testRange from './maps/testRange.js';
import { ARENAS } from './maps/arenas.js';
import { Course, fmtTime } from './course.js';
import { Elevator } from './elevator.js';
import { BotManager } from './bots.js';
import { Matchmaking } from './matchmaking.js';
import { Deathmatch } from './tdm.js';
import { Lobby } from './net.js';
import { StaticBatches } from './batch.js';

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
const settings = { sens: 1.0, fov: 95, volume: 0.5, aimKey: 'KeyV', fireKey: 'KeyF', aimMode: 'hold', dashKey: 'KeyQ', grappleKey: 'KeyG', slamKey: 'KeyZ' };
try { Object.assign(settings, JSON.parse(localStorage.getItem('semifinals.settings') || '{}')); } catch { /* ignore */ }
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
const applyBinds = () => { input.binds = { aim: settings.aimKey, fire: settings.fireKey }; input.aimMode = settings.aimMode; };
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
let skinClass = null;    // class whose weapon skin to show (defaults to the active class)
const defFor = (id) => skinDef(buildDef(WEAPONS[id], loadouts[id] || {}), gunSkinFor(cosmetics, skinClass || classLo.cls));
const cases = CASE_ORDER.map((id, i) => new WeaponCase(world, defFor(id), [map.cases.xs[i], 0, map.cases.z], i + 1));
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
const weapon = () => slots[current];

function switchTo(i) {
  if (i === current || !slots[i]) return;
  input.aimToggled = false;
  lastSlot = current;
  current = i;
  weapon().equip();
  sounds.swap();
  updateSlotHud();
}

function pickUp(caseDef) {
  const def = defFor(caseDef.id);
  const other = slots.findIndex((w, i) => i !== current && w.def.id === def.id);
  if (weapon().def.id === def.id) { weapon().ammo = def.mag; weapon().equip(); sounds.pickup(); return; }
  if (other >= 0) { switchTo(other); return; }
  slots[current] = new Weapon(def);
  slots[current].equip();
  sounds.pickup();
  updateSlotHud();
}

// ---------- classes (chosen in the Armoury) ----------
// (classLo is hoisted into a var-like holder so defFor can be used while the file loads)
let equippedAbility = classLo[classLo.cls].ability;
let classDirty = true;          // class changed since the current test-range session started
function classWeapons() {
  const c = CLASSES[classLo.cls], primary = classLo[classLo.cls].weapon;
  return [primary, primary === 'pistol' ? c.weapons.find((w) => w !== 'pistol') : 'pistol'];
}
function applyClass() {
  const c = CLASSES[classLo.cls];
  Object.assign(player, { maxHp: c.hp, hp: c.hp, speedMul: c.speed });
  const [a, b] = classWeapons();
  slots[0] = new Weapon(defFor(a));
  slots[1] = new Weapon(defFor(b));
  current = 0; lastSlot = 1;
  equippedAbility = classLo[classLo.cls].ability;
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
  cases.forEach((c) => { if (c.def.id === id) c.def = def; });
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
  stats.shots++;

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
    } else if (b.tag === 'chunk') {
      stats.chunks += b.ref.hit(b, dir);
      if (i === 0) sounds.crumble();
    } else {
      effects.impact(hit.point, hit.normal, b.color);
      effects.decal(hit.point, hit.normal);
    }
  }
  if (anyHit) stats.hits++;
  for (const [dummy, e] of perDummy) {
    if (!dummy.alive) continue;
    if (dummy.remote) {
      // another player online: tell them; they take the damage on their side
      online.myHit(dummy.remote, e.dmg, e.head, camEye);
      showHitmarker(false, e.head);
      damageNumbers.push({ pos: [...e.point], amount: e.dmg, head: e.head, t: 0, el: null, drift: Math.random() - 0.5 });
      continue;
    }
    if (dummy.agent) dummy.agent.lastHitBy = tdm.you;      // deathmatch kill credit
    const dead = dummy.damage(e.dmg, e.dir);
    if (dead) stats.kills++;
    if (dead && dummy.name) killFeed('YOU', d.name, dummy.name, e.head);
    showHitmarker(dead, e.head);
    damageNumbers.push({ pos: [...e.point], amount: e.dmg, head: e.head, t: 0, el: null, drift: Math.random() - 0.5 });
    dead ? sounds.kill() : sounds.hit();
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
  let hitAny = false, killed = false;
  for (const d of [...dummies, ...botMgr.bots.filter((b) => b.visible)]) {
    if (!d.alive) continue;
    const dx = d.pos[0] - p[0], dy = d.pos[1] - p[1], dz = d.pos[2] - p[2];
    const dist = Math.hypot(dx, dz);
    if (dist > R || Math.abs(dy) > 2.5) continue;
    const dmg = Math.round((25 + 65 * (1 - dist / R)) * h.power);
    const dir = norm([dx || 0.01, 0.6, dz || 0.01]);
    const dead = d.damage(dmg, dir);
    hitAny = true;
    if (dead) { stats.kills++; killed = true; if (d.name) killFeed('YOU', 'SLAM', d.name, false); }
    damageNumbers.push({ pos: [d.pos[0], d.pos[1] + 1.6, d.pos[2]], amount: dmg, head: false, t: 0, el: null, drift: Math.random() - 0.5 });
  }
  if (hitAny) { showHitmarker(killed, false); killed ? sounds.kill() : sounds.hit(); }
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
    effects.impact(hit.point, hit.normal, hit.box.color); if (hit.box.tag !== 'chunk') effects.decal(hit.point, hit.normal);
  },
  onBotKill: (killer, victim) => { killFeed(killer.name, 'RIFLE', victim.name, false); },
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

// ---------- HUD ----------
const hud = {
  ammo: $('ammo'), reserve: $('reserve'), reload: $('reload'), speed: $('speed'), fps: $('fps'),
  kills: $('kills'), acc: $('acc'), chunks: $('chunks'), cross: $('crosshair'), hitmarker: $('hitmarker'),
  dmgLayer: $('damage'), state: $('state'), wname: $('weaponname'), wtype: $('weapontype'), prompt: $('prompt'),
  scope: $('scope'), slots: [$('slot1'), $('slot2')],
  ab: { dash: $('ab-dash'), grapple: $('ab-grapple'), slam: $('ab-slam') },
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
  const dRem = a.dash.charges < a.dash.max ? 1 - a.dash.t / a.dash.recharge : 0;
  set(hud.ab.dash, a.dash.charges > 0 ? 0 : dRem, a.dash.charges > 0);
  hud.ab.dash.querySelectorAll('.pip').forEach((p, i) => p.classList.toggle('on', i < a.dash.charges));
  const gActive = player.grapple && player.grapple.phase !== 'miss';
  set(hud.ab.grapple, gActive ? 0 : a.grapple.cd / a.grapple.max, a.grapple.cd <= 0 || gActive, a.grapple.cd > 0 && !gActive ? a.grapple.cd.toFixed(1) : '');
  hud.ab.grapple.classList.toggle('active', !!gActive);
  set(hud.ab.slam, a.slam.cd / a.slam.max, a.slam.cd <= 0, a.slam.cd > 0 ? a.slam.cd.toFixed(1) : '');
  // grapple range hint on the crosshair
  for (const k of ['dash', 'grapple', 'slam']) hud.ab[k].classList.toggle('hidden', k !== equippedAbility);
  grappleOk = equippedAbility === 'grapple' && a.grapple.cd <= 0 && !player.grapple && !!player.grappleTarget();
  hud.cross.classList.toggle('grapple', grappleOk);
}
function refreshAbilityKeys() {
  hud.ab.dash.querySelector('kbd').textContent = keyLabel(settings.dashKey);
  hud.ab.grapple.querySelector('kbd').textContent = keyLabel(settings.grappleKey);
  hud.ab.slam.querySelector('kbd').textContent = keyLabel(settings.slamKey);
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
  let best = null, bestDot = 0.55;
  for (const c of cases) {
    const to = [c.center[0] - eye[0], c.center[1] + 1.5 - eye[1], c.center[2] - eye[2]];
    const dist = Math.hypot(...to);
    if (dist > 3.2) continue;
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
  const hk = settings.grappleKey.replace(/^Key/, '');
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
      d.el.className = `dmg${d.head ? ' head' : ''}`;
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
    saveCosmetics(cosmetics);
    if (it.slot === 'wskin') refreshGuns();
    renderMenu();
  };
  const note = worn ? `Wearing it on ${CLASSES[custCls || classLo.cls].name}.` : own ? `Owned. Equip it on ${CLASSES[custCls || classLo.cls].name}.` : cosmetics.credits < it.price ? 'Not enough credits.' : `Buys and equips on ${CLASSES[custCls || classLo.cls].name}.`;
  box.replaceChildren(el('small', null, `${r.name} · ${slotName}`), el('b', null, it.name), btn, el('p', null, note));
}
// rebuild guns after a weapon-skin change (in your hands, the cases and the showroom)
function refreshGuns() {
  slots.forEach((w) => { const a = w.ammo; w.setDef(defFor(w.def.id)); w.ammo = Math.min(a, w.def.mag); });
  cases.forEach((c) => { c.def = defFor(c.def.id); });
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
  resetGlass();
  const sp = stadium.spawns[info.team];
  player.spawn(sp.pos, sp.yaw);
  Object.assign(player, { hp: player.maxHp, dead: false, invuln: 1.5, lastHitBy: null });
  $('matchend').classList.add('hidden');
}
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
function startMatch(m) {
  if (tdm === online || online.inRoom) { online.leave(); tdm = ai; }
  batches.world = null;     // re-batch once the match props are set up
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
  const btn = document.createElement('button');
  btn.type = 'button'; btn.textContent = 'BACK TO LOBBY';
  btn.onclick = () => endMatch(true);
  card.append(btn);
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
function updateMatchHud(dt) {
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
  $('mm-name').replaceChildren(el('b', null, c.name), el('span', null, `${WEAPONS[sel.weapon].name} · ${ABILITIES[sel.ability].short}`));
  $('mm-range-sub').textContent = sessionStarted && !classDirty && !inStadium() ? 'RESUME YOUR SESSION' : 'GUNS · MOVEMENT · PARKOUR · BOTS';
  $('mm-play-sub').textContent = match && inStadium() && !classDirty ? `RESUME · ${stadium.name}` : 'SEMI-FINALS · FIND A MATCH';
  // play page summary
  const sum = $('mm-sum');
  const cell = (k, v) => { const d = el('div'); d.append(el('small', null, k), el('b', null, v)); return d; };
  const edit = el('button', 'edit', 'EDIT LOADOUT IN THE ARMOURY ›');
  edit.type = 'button';
  edit.onclick = () => showTab('armoury');
  sum.replaceChildren(cell('CLASS', c.name), cell('WEAPON', WEAPONS[sel.weapon].name), cell('ABILITY', ABILITIES[sel.ability].short), edit);
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
const BINDS = { aimKey: 'bind-aim', fireKey: 'bind-fire', dashKey: 'bind-dash', grappleKey: 'bind-grapple', slamKey: 'bind-slam' };
const keyName = (code) => code.replace(/^Key/, '').replace(/^Digit/, '').replace(/Left$|Right$/, (m) => ` ${m.toUpperCase()}`).toUpperCase();
let rebinding = null;
function refreshBindButtons() {
  for (const [k, id] of Object.entries(BINDS)) $(id).textContent = keyName(settings[k]);
  $('aim-mode').textContent = settings.aimMode === 'toggle' ? 'TOGGLE' : 'HOLD';
  document.querySelectorAll('.keyhint-aim').forEach((el) => { el.textContent = keyName(settings.aimKey); });
  document.querySelectorAll('.keyhint-fire').forEach((el) => { el.textContent = keyName(settings.fireKey); });
  for (const k of ['dash', 'grapple', 'slam']) document.querySelectorAll(`.keyhint-${k}`).forEach((el) => { el.textContent = keyName(settings[`${k}Key`]); });
}
function startRebind(which, btn) {
  rebinding = { which, btn };
  btn.textContent = 'PRESS A KEY…';
  btn.classList.add('waiting');
  $('bindnote').textContent = 'Esc to cancel';
}
for (const [k, id] of Object.entries(BINDS)) $(id).addEventListener('click', (e) => startRebind(k, e.currentTarget));
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
function worldBeams(w) {
  const out = [];
  const g = player.grapple;
  if (g && !bench.open) {
    const hm = w.handModels[0];
    const hand = vmToWorld([hm[12], hm[13], hm[14]]);
    let tip;
    if (g.phase === 'fire') {
      const k = Math.min(g.t / g.travel, 1);
      tip = hand.map((c, i) => c + (g.point[i] - c) * k);
    } else if (g.phase === 'pull') tip = g.point;
    else {
      const k = g.t < 0.16 ? g.t / 0.16 : Math.max(0, 1 - (g.t - 0.16) / 0.16);
      tip = g.from.map((c, i) => c + g.dir[i] * 45 * k);
    }
    const r = beam(0, hand, tip, 0.018, [0.12, 0.12, 0.13], 0, 1);
    if (r) out.push(r);
    const hook = beam(1, tip.map((c, i) => c - (tip[i] - hand[i]) * 0.0), tip.map((c, i) => c + (tip[i] - hand[i]) / (Math.hypot(...tip.map((v, j) => v - hand[j])) || 1) * 0.12), 0.07, [0.95, 0.15, 0.1], 0.4, 1);
    if (hook) out.push(hook);
  }
  const lp = !bench.open && !w.scoped ? w.laserPoint() : null;
  if (lp) {
    // the laser follows the barrel, not the crosshair
    const start = vmToWorld(lp);
    const far = vmToWorld(w.gunPoint([w.def.laser[0], w.def.laser[1], w.def.laser[2] - 30]));
    const ldir = norm(far.map((c, i) => c - start[i]));
    const hit = world.raycast(start, ldir, 120);
    const end = hit ? hit.point : start.map((c, i) => c + ldir[i] * 120);
    const r = w.adsT < 0.6 ? beam(2, start, end, 0.006, [1, 0.12, 0.08], 1, 0.35 * (1 - w.adsT / 0.6)) : null;
    if (r) out.push(r);
    if (hit) {
      const sz = 0.025 + hit.t * 0.0012;
      const dm = beamPool[3];
      compose(dm, hit.point.map((c, i) => c + hit.normal[i] * 0.01), [0, 0, 0], [sz, sz, sz]);
      out.push({ model: dm, scale: [sz, sz, sz], color: [1, 0.15, 0.1], emissive: 1, alpha: 0.9 });
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
  if (tdm.active) player.speedMul = CLASSES[classLo.cls].speed;
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
function frame(now) {
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
    player.look(input.dx, input.dy, sens);
    if (input.hit('KeyT') && !tdm.active) resetRange();
    if (input.hit('Digit1')) switchTo(0);
    if (input.hit('Digit2')) switchTo(1);
    nearCase = findCase();
    nearBench = findBench();
    const liftBtn = lookLiftButton();
    if (liftBtn && input.hit('KeyE')) liftBtn.lift.press(liftBtn, sounds);
    else if (nearConsole() && input.hit('KeyE')) pressConsole();
    else if (nearCase && input.hit('KeyE')) pickUp(nearCase.def);
    else if (nearBench && input.hit('KeyE')) openBench();
    w = weapon();
    // only your class's equipped specialisation works
    let hooked = false;
    if (inStadium() && stadium.hook && input.hit(settings.grappleKey)) {
      if (player.grapple && player.grapple.phase !== 'miss') { player.releaseGrapple(false); sounds.grappleRelease(); hooked = true; }
      else {
        const t = hookTarget();
        if (t) { player.hookTo(t.box, t.point); hooked = true; fallTop = null; }
      }
    }
    const act = {
      dash: equippedAbility === 'dash' && input.hit(settings.dashKey),
      grapple: !hooked && equippedAbility === 'grapple' && input.hit(settings.grappleKey),
      slam: equippedAbility === 'slam' && input.hit(settings.slamKey),
    };
    elevator.update(dt, player, sounds);
    for (const l of lifts) l.update(dt, player, sounds);
    if (inStadium()) for (const c of stadium.cargo || []) c.update(dt, player);
    player.update(dt, input, { ads: w.ads, firing: input.fireDown && w.ammo > 0 && !w.reloading && !player.trav, act });
    if (inStadium()) updateStadium(dt);
    updateCombat(dt);
    course.update(dt, player, input);
    handlePlayerEvents();
    updateCamera();
    w.update(dt, input, player, weaponCtx);
    handleWeaponEvents(w);
  }
  dummies.forEach((d) => d.update(dt, time));
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

  const caseParts = cases.flatMap((c) => c.parts(time));
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
    // gun preview on the right of the workbench menu
    compose(previewM, [0.5, -0.02, -1.25], [0.12, bench.rotY + time * 0.25, 0], [1, 1, 1]);
    for (const p of Weapon.worldParts(defFor(bench.weaponId), previewM)) renderer.drawPart(p);
  } else {
    for (const p of vmParts) renderer.drawPart(p);
  }

  updateHud(dt, vfov);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// handy for debugging from the console / automated tests
 window.game = { lobby, online, get tdm() { return tdm; }, batches, renderer, map, ARENAS, get stadium() { return stadium; }, setArena: (i) => { stadium = ARENAS[i]; }, lifts, hooks: botHooks, updateFall, hookTarget, fallTop: () => fallTop, breakGlass, updateCombat, startMatch: (m) => startMatch(m), enterStadium, where: () => where, sr: () => showroomChar, cosmetics, refreshGuns, classLo, renderMenu, showTab, enterRange, cs: () => cutscene, botMgr, elevator, damagePlayer, pressConsole, setTimeScale: (v) => { timeScale = v; }, bench, openBench, closeBench, loadouts, applyLoadout, course, player, slots, weapon, world, stats, effects, dummies, walls, cases, input, start, setPlaying, resetRange, switchTo, pickUp, WEAPONS };
