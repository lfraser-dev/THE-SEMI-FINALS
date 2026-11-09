import { Renderer } from './renderer.js';
import { World } from './world.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Weapon } from './weapon.js';
import { WEAPONS, CASE_ORDER } from './weapons.js';
import { Effects } from './effects.js';
import { Sounds } from './audio.js';
import { Dummy, DestructibleWall, WeaponCase } from './props.js';
import { mat4, perspective, lookDir, mul, cross, norm, damp, dot } from './math.js';
import testRange from './maps/testRange.js';

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
const settings = { sens: 1.0, fov: 95, volume: 0.5 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('semifinals.settings') || '{}')); } catch { /* ignore */ }
const saveSettings = () => { try { localStorage.setItem('semifinals.settings', JSON.stringify(settings)); } catch { /* ignore */ } };

// ---------- game objects ----------
const world = new World();
const effects = new Effects(world);
const input = new Input(canvas);
const sounds = new Sounds();
sounds.setVolume(settings.volume);
const player = new Player(world);
const map = testRange;
map.build(world);
const dummies = map.dummies.map((d) => new Dummy(world, effects, d.pos, d.move));
const walls = map.walls.map((w) => new DestructibleWall(world, effects, w.origin, w));
const cases = CASE_ORDER.map((id, i) => new WeaponCase(world, WEAPONS[id], [map.cases.xs[i], 0, map.cases.z], i + 1));
player.spawn(map.spawn.pos, map.spawn.yaw);

// two weapon slots: primary + sidearm
const slots = [new Weapon(WEAPONS.ar), new Weapon(WEAPONS.pistol)];
let current = 0;
let lastSlot = 1;
const weapon = () => slots[current];

function switchTo(i) {
  if (i === current || !slots[i]) return;
  lastSlot = current;
  current = i;
  weapon().equip();
  sounds.swap();
  updateSlotHud();
}

function pickUp(def) {
  const other = slots.findIndex((w, i) => i !== current && w.def.id === def.id);
  if (weapon().def.id === def.id) { weapon().ammo = def.mag; weapon().equip(); sounds.pickup(); return; }
  if (other >= 0) { switchTo(other); return; }
  slots[current] = new Weapon(def);
  slots[current].equip();
  sounds.pickup();
  updateSlotHud();
}

const stats = { shots: 0, hits: 0, kills: 0, chunks: 0 };
const damageNumbers = [];

function resetRange() {
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
  camRight = norm(cross(camFwd, [0, 1, 0]));
  camUp = cross(camRight, camFwd);
  // apply roll to the basis so tracers/casings line up with what you see
  const c = Math.cos(player.roll), s = Math.sin(player.roll);
  const r2 = [0, 1, 2].map((k) => camRight[k] * c + camUp[k] * s);
  camUp = [0, 1, 2].map((k) => camUp[k] * c - camRight[k] * s);
  camRight = r2;
}
const viewToWorld = (p) => [0, 1, 2].map((k) => camEye[k] + camRight[k] * p[0] + camUp[k] * p[1] - camFwd[k] * p[2]);
const viewDirToWorld = (v) => [0, 1, 2].map((k) => camRight[k] * v[0] + camUp[k] * v[1] - camFwd[k] * v[2]);

// ---------- shooting ----------
function fire(w) {
  const d = w.def;
  updateCamera();
  const spread = w.spread(player);
  const hipT = 1 - w.adsT;
  const muzzle = viewToWorld([d.hip[0] * hipT, (d.hip[1] + 0.03) * hipT - 0.05 * w.adsT, -0.7]);
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
    if (b.tag === 'dummy') {
      const dmg = Math.round(d.dmg * (b.head ? d.headMult : 1));
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
      effects.casing(viewToWorld(ev.pos), [v[0] + pv[0], v[1] + pv[1] * 0.5, v[2] + pv[2]]);
    } else if (ev.type === 'magdrop' && ev.part) {
      const pv = player.vel;
      effects.spawnPiece(viewToWorld(ev.pos), ev.part.s, [pv[0] * 0.8, -1, pv[2] * 0.8], ev.part.col, 6);
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
  }
  player.events.length = 0;
  if (player.sliding && player.grounded && Math.random() < 0.5) effects.dust(player.pos, 1, player.vel);
}

// ---------- HUD ----------
const hud = {
  ammo: $('ammo'), reserve: $('reserve'), reload: $('reload'), speed: $('speed'), fps: $('fps'),
  kills: $('kills'), acc: $('acc'), chunks: $('chunks'), cross: $('crosshair'), hitmarker: $('hitmarker'),
  dmgLayer: $('damage'), state: $('state'), wname: $('weaponname'), wtype: $('weapontype'), prompt: $('prompt'),
  scope: $('scope'), slots: [$('slot1'), $('slot2')],
};
let hitTimer = 0;
function showHitmarker(kill, head) {
  hud.hitmarker.className = kill ? 'kill' : head ? 'head' : '';
  hud.hitmarker.style.opacity = 1;
  hitTimer = kill ? 0.28 : 0.14;
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

const vp = mat4();
function project(p) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (w <= 0.01) return null;
  return [(x / w * 0.5 + 0.5) * innerWidth, (1 - (y / w * 0.5 + 0.5)) * innerHeight];
}

let nearCase = null;
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
  hud.state.textContent = player.mantle ? 'MANTLE' : player.sliding ? 'SLIDE' : player.crouching ? 'CROUCH' : player.sprinting ? 'SPRINT' : !player.grounded ? 'AIR' : '';

  const spreadPx = Math.tan(w.spread(player)) / Math.tan(fovRad / 2) * (innerHeight / 2);
  hud.cross.style.setProperty('--gap', `${Math.max(4, spreadPx).toFixed(1)}px`);
  hud.cross.style.opacity = w.scoped ? 0 : 1 - w.adsT * 0.85;
  hud.cross.classList.toggle('shotgun', w.def.pellets > 1);
  hud.scope.style.opacity = w.scoped ? 1 : 0;

  if (nearCase) {
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

$('play').addEventListener('click', start);
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    locked = true;
    $('locknote').classList.add('hidden');
  } else if (locked) {
    locked = false;
    setPlaying(false);
  }
});
addEventListener('keydown', (e) => {
  if (playing && !locked && (e.code === 'Escape' || e.code === 'KeyP')) setPlaying(false);
  else if (!playing && e.code === 'Enter') start();
});
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

// ---------- main loop ----------
const proj = mat4(), view = mat4(), vmProj = mat4(), identity = mat4();
let last = performance.now(), time = 0, fovKick = 0;
const weaponCtx = { fire, sounds };

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  time += dt;

  if (playing) {
    let w = weapon();
    const sens = settings.sens * 0.0022 * (1 - w.adsT * (1 - w.def.adsZoom) * 0.9);
    player.look(input.dx, input.dy, sens);
    if (input.hit('KeyT')) resetRange();
    if (input.hit('Digit1')) switchTo(0);
    if (input.hit('Digit2')) switchTo(1);
    if (input.hit('KeyQ')) switchTo(lastSlot);
    nearCase = findCase();
    if (nearCase && input.hit('KeyE')) pickUp(nearCase.def);
    w = weapon();
    player.update(dt, input, { ads: w.ads, firing: input.mouse(0) && w.ammo > 0 && !w.reloading });
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
  const targetKick = player.sliding ? 9 : player.sprinting ? 5 : 0;
  fovKick += (targetKick - fovKick) * damp(6, dt);
  const hfov = (settings.fov + fovKick) * (1 - w.adsT * (1 - w.def.adsZoom)) * Math.PI / 180;
  const vfov = 2 * Math.atan(Math.tan(Math.min(hfov, 2.9) / 2) / aspect);
  perspective(proj, vfov, aspect, 0.05, 500);
  updateCamera();
  lookDir(view, camEye, camFwd, [0, 1, 0], player.roll);
  mul(vp, proj, view);

  const caseParts = cases.flatMap((c) => c.parts(time));

  // shadow pass
  renderer.beginShadow();
  for (const b of world.boxes) if (!b.noShadow) renderer.shadowDraw(b.model);
  for (const p of caseParts) renderer.shadowDraw(p.model);
  effects.drawShadows(renderer);
  renderer.endShadow();

  // world
  renderer.begin();
  renderer.setCamera(proj, view, 0.0095, camEye, true);
  renderer.drawSky(camEye);
  renderer.setBlend(false);
  for (const b of world.boxes) if (b.alpha >= 1) renderer.drawBox(b);
  for (const p of caseParts) renderer.draw(p.model, p.scale, p.color, 0, 1, p.emissive);
  effects.drawOpaque(renderer);
  renderer.setBlend(true);
  for (const b of world.boxes) if (b.alpha < 1) renderer.drawBox(b);
  effects.drawTransparent(renderer);
  renderer.setBlend(false);

  // viewmodel
  renderer.clearDepth();
  perspective(vmProj, 58 * Math.PI / 180, aspect, 0.01, 10);
  const vmView = mat4();
  lookDir(vmView, [0, 0, 0], [0, 0, -1], [0, 1, 0], player.roll * 0.5);
  renderer.setCamera(vmProj, vmView, 0, [0, 0, 0], false);
  for (const p of w.viewmodel(player, time)) renderer.draw(p.model, p.scale, p.color, 0, 1, p.emissive);

  updateHud(dt, vfov);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// handy for debugging from the console / automated tests
window.game = { player, slots, weapon, world, stats, effects, dummies, walls, cases, input, start, setPlaying, resetRange, switchTo, pickUp, WEAPONS };
