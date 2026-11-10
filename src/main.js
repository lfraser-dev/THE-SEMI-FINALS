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
import { SLOTS as CSLOTS, RARITY, ITEMS, FEATURED, CURRENCY, loadCosmetics, saveCosmetics, owns, itemsFor, buy, buildOutfit, gunSkinFor, skinDef, swatch, iconFor } from './cosmetics.js';
import { Bench } from './bench.js';
import testRange from './maps/testRange.js';
import { Course, fmtTime } from './course.js';
import { Elevator } from './elevator.js';
import { BotManager } from './bots.js';

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
const effects = new Effects(world);
const input = new Input(canvas);
const sounds = new Sounds();
const applyBinds = () => { input.binds = { aim: settings.aimKey, fire: settings.fireKey }; input.aimMode = settings.aimMode; };
applyBinds();
sounds.setVolume(settings.volume);
const player = new Player(world);
const map = testRange;
map.build(world);
const dummies = map.dummies.map((d) => new Dummy(world, effects, d.pos, d.move));
const walls = map.walls.map((w) => new DestructibleWall(world, effects, w.origin, w));
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
  for (let i = 0; i < d.pellets; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = spread * (d.pellets > 1 ? Math.sqrt(Math.random()) : Math.sqrt(Math.random()));
    const dir = norm([0, 1, 2].map((k) => camFwd[k] + camRight[k] * Math.cos(a) * r + camUp[k] * Math.sin(a) * r));
    const hit = world.raycast(camEye, dir, 300);
    const end = hit ? hit.point : [0, 1, 2].map((k) => camEye[k] + dir[k] * 300);
    if (i < 4) effects.tracer(muzzle, end);
    if (!hit) continue;
    const b = hit.box;
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
  const A = map.deck.area, P = player.pos;
  const onDeck = botMgr.running || (P[0] > A.min[0] && P[0] < A.max[0] && P[1] > A.min[1] && P[1] < A.max[1] && P[2] > A.min[2] && P[2] < A.max[2]);
  const r = onDeck ? map.deck.respawn : { pos: map.spawn.pos, yaw: map.spawn.yaw };
  player.teleport(r.pos, r.yaw);
  Object.assign(player, { hp: player.maxHp, dead: false, invuln: 1.5 });
  slots.forEach((w) => { w.ammo = w.def.mag; w.reload = null; });
  weapon().equip();
}

const botHooks = {
  player,
  hitPlayer: (dmg, bot, from) => damagePlayer(dmg, from, bot.name),
  shot: (bot, from, end, dist) => { effects.tracer(from, end); sounds.botShot(dist); },
  impact: (hit) => { effects.impact(hit.point, hit.normal, hit.box.color); if (hit.box.tag !== 'chunk') effects.decal(hit.point, hit.normal); },
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
    for (const [c, sz, col] of [[[0, 0.45, 0], [0.4, 0.3, 0.9], [0.55, 0.06, 0.05]], [[0, 1.25, 0], [0.55, 0.32, 0.55], [0.92, 0.1, 0.08]], [[0, 1.64, 0], [0.3, 0.3, 0.3], [1, 0.22, 0.16]]]) {
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
  hud.fade.style.opacity = course.failT > 0 ? course.failT / 0.35 : 0;

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

  if (nearConsole() && !pressSeq && !cutscene && !player.dead) {
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
  if (!sessionStarted || classDirty) {
    applyClass();
    resetRange();
    player.respawn();
    Object.assign(player, { hp: player.maxHp });
    sessionStarted = true;
  }
  start();
}
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
function itemCard(id, { onClick, on = false, priceTag = true }) {
  const it = ITEMS[id], r = RARITY[it.rarity];
  const b = el('button', `it${on ? ' on' : ''}${!owns(cosmetics, id) ? ' locked' : ''}`);
  b.type = 'button';
  b.style.setProperty('--r', rgb(r.color));
  const sw = swatch(it);
  const s0 = el('div', 'sw', iconFor(it.slot));
  s0.style.setProperty('--sw', sw ? rgb(sw) : 'rgba(255,255,255,.15)');
  b.append(s0, el('b', null, it.name), el('small', null, r.name));
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
$('mm-play').addEventListener('click', () => {
  const el = $('mm-play');
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  $('mm-locknote').classList.add('on');
  sounds.dry?.();
});
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
  $('mm-range-sub').textContent = sessionStarted && !classDirty ? 'RESUME YOUR SESSION' : 'GUNS · MOVEMENT · PARKOUR · BOTS';
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
let showroomChar = null, showroomKey = '';
function setShowroomClass() {
  const dressing = menuTab === 'custom' || menuTab === 'shop';
  const cls = dressing ? (custCls || classLo.cls) : classLo.cls;
  const c = CLASSES[cls], sel = classLo[cls];
  const key = `${cls}|${sel.weapon}|${JSON.stringify(cosmetics.equip[cls])}|${tryOn}`;
  if (key === showroomKey) return;
  showroomKey = key;
  const sp = map.showroom.spot;
  const keepT = showroomChar ? showroomChar.t : 0;
  showroomChar = new Contestant({ ...buildOutfit(cosmetics, cls, tryOn), name: c.name }, sp, 0.5);   // 3/4 turn so the gun faces you
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
  const home = menuTab === 'home';
  const k = home ? 1 : 0;
  camBlend += (k - camBlend) * Math.min(1, 0.12);
  const look = [cam.look[0] - 0.88 * camBlend, cam.look[1] + 0.05 * camBlend, cam.look[2]];
  const eye = [cam.eye[0] - 0.25 * camBlend + Math.sin(time * 0.2) * 0.12, cam.eye[1] + Math.sin(time * 0.31) * 0.03 + 0.05 * camBlend, cam.eye[2] - 0.5 * camBlend];
  const fwd = norm([look[0] - eye[0], look[1] - eye[1], look[2] - eye[2]]);
  perspective(projS, (aspect < 1 ? 62 : 44) * Math.PI / 180, aspect, 0.05, 200);
  lookDir(viewS, eye, fwd, [0, 1, 0], 0);
  renderer.begin();
  renderer.setCamera(projS, viewS, 0.0095, eye, true);
  renderer.setBlend(false);
  const near = (b) => b.max[0] > 280 && b.min[2] > 315;   // only the showroom set
  for (const b of world.boxes) if (b.alpha >= 1 && !b.hidden && near(b)) renderer.drawBox(b);
  if (showroomChar) {
    showroomChar.t = time;
    for (const p of showroomChar.parts()) renderer.draw(p.model, p.scale, p.color, 0, 1, p.emissive);
    for (const p of Weapon.worldParts(showroomChar.gunDef, showroomChar.gunMatrix)) renderer.draw(p.model, p.scale, p.color, 0, 1, p.emissive);
  }
}
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
  else if (!playing && e.code === 'Enter') enterRange();
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

// ---------- main loop ----------
const proj = mat4(), view = mat4(), vmProj = mat4(), identity = mat4();
let last = performance.now(), time = 0, fovKick = 0, timeScale = 1;
const weaponCtx = { fire, sounds };

function frame(now) {
  const rdt = Math.min((now - last) / 1000, 0.05);
  if (slowmo > 0) slowmo -= rdt;
  const dt = rdt * timeScale * (slowmo > 0 ? 0.3 : 1);
  last = now;
  time += dt;

  if (playing && !bench.open && (cutscene || pressSeq || player.dead)) {
    // the player isn't in control right now
    if (input.hit('KeyT')) resetRange();
    if (cutscene) updateCutscene(dt);
    else if (pressSeq) {
      updatePress(dt);
      weapon().update(dt, idleInput, player, weaponCtx);
    } else {
      deathT -= dt;
      if (deathT <= 0) respawnPlayer();
    }
    updateCombat(dt);
    updateCamera();
  } else if (playing && !bench.open) {
    let w = weapon();
    const sens = settings.sens * 0.0022 * (1 - w.adsT * (1 - w.def.adsZoom) * 0.9);
    player.look(input.dx, input.dy, sens);
    if (input.hit('KeyT')) resetRange();
    if (input.hit('Digit1')) switchTo(0);
    if (input.hit('Digit2')) switchTo(1);
    nearCase = findCase();
    nearBench = findBench();
    if (nearConsole() && input.hit('KeyE')) pressConsole();
    else if (nearCase && input.hit('KeyE')) pickUp(nearCase.def);
    else if (nearBench && input.hit('KeyE')) openBench();
    w = weapon();
    // only your class's equipped specialisation works
    const act = {
      dash: equippedAbility === 'dash' && input.hit(settings.dashKey),
      grapple: equippedAbility === 'grapple' && input.hit(settings.grappleKey),
      slam: equippedAbility === 'slam' && input.hit(settings.slamKey),
    };
    elevator.update(dt, player, sounds);
    player.update(dt, input, { ads: w.ads, firing: input.fireDown && w.ammo > 0 && !w.reloading && !player.trav, act });
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
  const botParts = botMgr.drawParts();
  const beams = worldBeams(w);

  // shadow pass
  // keep the sun's shadow map centred on the player so the annex gets shadows too
  renderer.setShadowArea([Math.round(player.pos[0] / 8) * 8, 0, Math.round(player.pos[2] / 8) * 8], 50);
  renderer.beginShadow();
  for (const b of world.boxes) if (!b.noShadow && !b.hidden) renderer.shadowDraw(b.model);
  for (const p of caseParts) renderer.shadowDraw(p.model);
  effects.drawShadows(renderer);
  for (const p of botParts) renderer.shadowDraw(p.model);
  renderer.endShadow();

  // world
  renderer.begin();
  renderer.setCamera(proj, view, 0.0095, camEye, true);
  renderer.drawSky(camEye);
  renderer.setBlend(false);
  for (const b of world.boxes) if (b.alpha >= 1 && !b.hidden) renderer.drawBox(b);
  for (const p of caseParts) renderer.draw(p.model, p.scale, p.color, 0, 1, p.emissive);
  effects.drawOpaque(renderer);
  for (const p of botParts) renderer.draw(p.model, p.scale, p.color, 0, 1, p.emissive);
  renderer.setBlend(true);
  for (const b of world.boxes) if (b.alpha < 1 && !b.hidden) renderer.drawBox(b);
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
    for (const p of Weapon.worldParts(defFor(bench.weaponId), previewM)) renderer.draw(p.model, p.scale, p.color, 0, 1, p.emissive);
  } else {
    for (const p of vmParts) renderer.draw(p.model, p.scale, p.color, 0, 1, p.emissive);
  }

  updateHud(dt, vfov);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// handy for debugging from the console / automated tests
 window.game = { cosmetics, refreshGuns, classLo, renderMenu, showTab, enterRange, cs: () => cutscene, botMgr, elevator, damagePlayer, pressConsole, setTimeScale: (v) => { timeScale = v; }, bench, openBench, closeBench, loadouts, applyLoadout, course, player, slots, weapon, world, stats, effects, dummies, walls, cases, input, start, setPlaying, resetRange, switchTo, pickUp, WEAPONS };
