import { Renderer } from './renderer.js';
import { World } from './world.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Weapon } from './weapon.js';
import { Effects } from './effects.js';
import { Sounds } from './audio.js';
import { Dummy, DestructibleWall } from './props.js';
import { mat4, perspective, lookDir, mul, cross, norm, damp } from './math.js';
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
const weapon = new Weapon();
const map = testRange;
map.build(world);
const dummies = map.dummies.map((d) => new Dummy(world, effects, d.pos, d.move));
const walls = map.walls.map((w) => new DestructibleWall(world, effects, w.origin, w));
player.spawn(map.spawn.pos, map.spawn.yaw);

const stats = { shots: 0, hits: 0, kills: 0, chunks: 0 };
const damageNumbers = [];

function resetRange() {
  dummies.forEach((d) => d.reset());
  walls.forEach((w) => w.reset());
  effects.clear();
  Object.assign(stats, { shots: 0, hits: 0, kills: 0, chunks: 0 });
  player.respawn();
  weapon.ammo = weapon.magSize;
  weapon.reloading = 0;
}

// ---------- shooting ----------
function fire(spread) {
  const eye = player.eye();
  const fwd = player.forward(weapon.kick, weapon.kickYaw);
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  const a = Math.random() * Math.PI * 2, r = spread * Math.sqrt(Math.random());
  const dir = norm([0, 1, 2].map((k) => fwd[k] + right[k] * Math.cos(a) * r + up[k] * Math.sin(a) * r));
  const hit = world.raycast(eye, dir, 300);
  stats.shots++;

  const hipT = 1 - weapon.adsT;
  const muzzle = [0, 1, 2].map((k) => eye[k] + fwd[k] * 0.7 + right[k] * 0.2 * hipT - up[k] * (0.1 + 0.08 * hipT));
  const end = hit ? hit.point : [0, 1, 2].map((k) => eye[k] + dir[k] * 300);
  effects.tracer(muzzle, end);
  if (!hit) return;

  const b = hit.box;
  if (b.tag === 'dummy') {
    const dmg = b.head ? 40 : 20;
    const dead = b.ref.damage(dmg, dir);
    stats.hits++;
    if (dead) stats.kills++;
    showHitmarker(dead, b.head);
    damageNumbers.push({ pos: [...hit.point], amount: dmg, head: b.head, t: 0, el: null, drift: Math.random() - 0.5 });
    dead ? sounds.kill() : sounds.hit();
  } else if (b.tag === 'chunk') {
    stats.chunks += b.ref.hit(b, dir);
    sounds.crumble();
  } else {
    effects.impact(hit.point, hit.normal, b.color);
    effects.decal(hit.point, hit.normal);
  }
}

// ---------- HUD ----------
const hud = {
  ammo: $('ammo'), reserve: $('reserve'), reload: $('reload'), speed: $('speed'), fps: $('fps'),
  kills: $('kills'), acc: $('acc'), chunks: $('chunks'), cross: $('crosshair'), hitmarker: $('hitmarker'),
  dmgLayer: $('damage'), state: $('state'),
};
let hitTimer = 0;
function showHitmarker(kill, head) {
  hud.hitmarker.className = kill ? 'kill' : head ? 'head' : '';
  hud.hitmarker.style.opacity = 1;
  hitTimer = kill ? 0.28 : 0.14;
}

const vp = mat4();
function project(p) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (w <= 0.01) return null;
  return [(x / w * 0.5 + 0.5) * innerWidth, (1 - (y / w * 0.5 + 0.5)) * innerHeight];
}

let fpsAcc = 0, fpsFrames = 0;
function updateHud(dt, fovRad) {
  hud.ammo.textContent = weapon.reloading ? '--' : weapon.ammo;
  hud.ammo.classList.toggle('low', weapon.ammo <= 6);
  hud.reload.style.opacity = weapon.reloading ? 1 : 0;
  hud.reload.style.setProperty('--p', weapon.reloading ? 1 - weapon.reloading / weapon.reloadTime : 0);
  hud.speed.textContent = player.hSpeed.toFixed(1);
  hud.kills.textContent = stats.kills;
  hud.chunks.textContent = stats.chunks;
  hud.acc.textContent = stats.shots ? `${Math.round((stats.hits / stats.shots) * 100)}%` : '--';
  hud.state.textContent = player.sliding ? 'SLIDING' : player.crouching ? 'CROUCH' : player.sprinting ? 'SPRINT' : !player.grounded ? 'AIR' : '';

  // crosshair gap follows the real bullet spread
  const spreadPx = Math.tan(weapon.spread(player)) / Math.tan(fovRad / 2) * (innerHeight / 2);
  hud.cross.style.setProperty('--gap', `${Math.max(4, spreadPx).toFixed(1)}px`);
  hud.cross.style.opacity = 1 - weapon.adsT * 0.85;

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
let last = performance.now(), time = 0, fovKick = 0, wasGrounded = true;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  time += dt;

  if (playing) {
    const sens = settings.sens * 0.0022 * (1 - weapon.adsT * 0.35);
    player.look(input.dx, input.dy, sens);
    if (input.hit('KeyT')) resetRange();
    const jumpedBefore = player.vel[1];
    player.update(dt, input, { ads: weapon.ads, firing: input.mouse(0) && weapon.ammo > 0 });
    if (player.vel[1] > 5 && jumpedBefore <= 0.1) sounds.jump();
    if (player.grounded && !wasGrounded) sounds.land();
    wasGrounded = player.grounded;
    weapon.update(dt, input, player, fire, sounds);
  }
  dummies.forEach((d) => d.update(dt, time));
  effects.update(dt);

  // ---- render ----
  const aspect = renderer.resize();
  const targetKick = player.sliding ? 10 : player.sprinting ? 6 : 0;
  fovKick += (targetKick - fovKick) * damp(6, dt);
  // settings.fov is horizontal (like most shooters); convert to vertical
  const hfov = (settings.fov + fovKick) * (1 - weapon.adsT * 0.22) * Math.PI / 180;
  const vfov = 2 * Math.atan(Math.tan(hfov / 2) / aspect);
  perspective(proj, vfov, aspect, 0.05, 500);
  const eye = player.eye();
  lookDir(view, eye, player.forward(weapon.kick, weapon.kickYaw));
  mul(vp, proj, view);

  renderer.begin();
  renderer.setCamera(proj, view, 0.0105);
  renderer.setBlend(false);
  for (const b of world.boxes) renderer.drawBox(b);
  effects.drawOpaque(renderer);
  renderer.setBlend(true);
  effects.drawTransparent(renderer);
  renderer.setBlend(false);

  renderer.clearDepth();
  perspective(vmProj, 58 * Math.PI / 180, aspect, 0.01, 10);
  renderer.setCamera(vmProj, identity, 0);
  for (const p of weapon.viewmodel(player, time)) renderer.draw(p.model, p.scale, p.color, 0, 1, p.emissive);

  updateHud(dt, vfov);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// handy for debugging from the console / automated tests
window.game = { player, weapon, world, stats, effects, dummies, walls, input, start, setPlaying, resetRange };
