// Little 3D portraits of cosmetics for the shop / customization cards.
// A second, tiny WebGL renderer draws a contestant wearing the item (framed on the right body part)
// or the skinned gun, in a studio lit with the item's rarity colour. Results are cached as image URLs.
import { Renderer } from './renderer.js';
import { Contestant } from './contestant.js';
import { Weapon } from './weapon.js';
import { mat4, perspective, lookDir, compose } from './math.js';

const SIZE = 224;
// camera framing per slot: [look-at height, distance, side offset, look-at forward]
const FRAME = {
  head: [1.7, 0.9, 0.18, 0], body: [1.68, 0.95, 0.15, 0], neck: [1.5, 0.82, 0.12, 0],
  top: [1.34, 1.45, 0.25, 0], outer: [1.3, 1.6, 0.3, 0],
  legs: [0.62, 2.05, 0.45, 0], shoes: [0.12, 0.85, 0.42, -0.02], gloves: [1.05, 0.9, 0.2, -0.22],
};

export class Thumbs {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE;
    this.ok = true;
    try { this.r = new Renderer(this.canvas); } catch { this.ok = false; }
    if (this.ok) this.r.size = [SIZE, SIZE];
    this.cache = new Map();
    this.queue = [];
    this.proj = mat4(); this.view = mat4(); this.floor = mat4();
    perspective(this.proj, 30 * Math.PI / 180, 1, 0.05, 1000);
  }

  // returns a cached URL, or null + queues the render (onReady(url) is called when done)
  get(key, spec, onReady) {
    if (!this.ok) return null;
    const hit = this.cache.get(key);
    if (hit) return hit;
    this.queue.push({ key, spec, onReady });
    if (!this.pumping) { this.pumping = true; requestAnimationFrame(() => this.pump()); }
    return null;
  }

  pump() {
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < 12) {
      const job = this.queue.shift();
      let url = this.cache.get(job.key);
      if (!url) { url = this.render(typeof job.spec === 'function' ? job.spec() : job.spec); this.cache.set(job.key, url); }
      job.onReady?.(url);
    }
    if (this.queue.length) requestAnimationFrame(() => this.pump());
    else this.pumping = false;
  }

  render(spec) {
    const r = this.r, bg = spec.color;
    r.size = [SIZE, SIZE];
    r.begin();
    let eye, look;
    if (spec.slot === 'wskin') {
      eye = [0.02, 0.06, -0.95]; look = [0, 0.0, 0];
    } else {
      const [y, dist, sx, fz] = FRAME[spec.slot] || FRAME.top;
      look = [0, y, fz - 0.02];
      eye = [sx, y + 0.06, -dist];
    }
    const fwd = [look[0] - eye[0], look[1] - eye[1], look[2] - eye[2]];
    const l = Math.hypot(...fwd); fwd.forEach((v, i) => { fwd[i] = v / l; });
    lookDir(this.view, eye, fwd, [0, 1, 0], 0);
    r.setStudio(bg, fwd, [-0.5, 0.8, -0.6]);
    r.setCamera(this.proj, this.view, 0.05, eye, false);
    r.setBlend(false);
    r.drawSky(eye);
    if (spec.slot === 'wskin') {
      // the gun side-on (right side to camera), muzzle to the right, scaled to fill the card
      const ps = spec.gunDef.parts.filter((p) => !p.hidden);
      const z0 = Math.min(...ps.map((p) => p.c[2] - p.s[2] / 2)), z1 = Math.max(...ps.map((p) => p.c[2] + p.s[2] / 2));
      const y0 = Math.min(...ps.map((p) => p.c[1] - p.s[1] / 2)), y1 = Math.max(...ps.map((p) => p.c[1] + p.s[1] / 2));
      const sc = Math.min(0.44 / (z1 - z0), 0.3 / (y1 - y0));
      const zm = (z0 + z1) / 2, ym = (y0 + y1) / 2;
      const m = mat4();
      m.set([0, 0, -sc, 0, 0, sc, 0, 0, sc, 0, 0, 0, -zm * sc, -ym * sc, 0, 1]);
      for (const p of Weapon.worldParts(spec.gunDef, m)) r.drawPart(p);
    } else {
      compose(this.floor, [0, -0.05, 0], [0, 0, 0], [40, 0.1, 40]);
      r.draw(this.floor, [40, 0.1, 40], bg.map((v) => v * 0.55), 0, 0, 0, 1, undefined, 'poly');
      const c = new Contestant(spec.outfit, [0, 0, 0], 0.3);
      c.pose = 'lobby'; c.t = 0.6; c.realGun = true; c.gunDef = spec.gunDef;
      r.setRim(bg.map((v) => v * 0.45));
      for (const p of c.parts()) r.drawPart(p);
      if (spec.gunDef) for (const p of Weapon.worldParts(spec.gunDef, c.gunMatrix)) r.drawPart(p);
      r.setRim(null);
    }
    r.setStudio(null);
    return this.canvas.toDataURL('image/jpeg', 0.86);
  }
}
