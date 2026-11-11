// The gunsmith (at the workbench), in the style of Delta Force's: the gun sits big in the middle of a dark studio,
// every attachment slot is pinned to its spot on the gun with a leader line, and picking a slot opens a list of
// parts with their pros and cons spelled out. Stats update live (hover to preview, click to fit).
import { WEAPONS, CASE_ORDER } from './weapons.js';
import { CLASSES, CLASS_ORDER } from './classes.js';
import { SLOTS, ATTACHMENTS, slotsFor, optionsFor, buildDef, ratings, prosCons } from './attachments.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const SVGNS = 'http://www.w3.org/2000/svg';
const TOP = ['optic', 'side', 'muzzle', 'barrel'];       // labels above the gun; the rest go below
const classesOf = (id) => CLASS_ORDER.filter((c) => CLASSES[c].weapons.includes(id)).map((c) => CLASSES[c].name);

export class Bench {
  // getLoadout(id) -> object, setLoadout(id, lo)
  constructor({ root, getLoadout, setLoadout, sounds, onClose }) {
    Object.assign(this, { root, getLoadout, setLoadout, sounds, onClose });
    this.open = false;
    this.weaponId = 'ar';
    this.slot = null;          // slot whose parts list is open
    this.rotY = 0;             // extra spin from dragging
    this.hover = null;         // { slot, id } under the mouse, for the stat preview
    root.replaceChildren();
    root.innerHTML = `
      <div class="gs-top"><div class="gs-title"><small>GUNSMITH</small><div class="gs-weapon"></div></div>
        <div class="gs-hint">CLICK A SLOT ON THE GUN · DRAG TO TURN IT · E TO CLOSE</div></div>
      <div class="gs-list"></div>
      <svg class="gs-lines"></svg>
      <div class="gs-nodes"></div>
      <div class="gs-right"><div class="gs-parts"></div><div class="gs-stats"></div></div>
      <div class="gs-bottom"><span class="gs-count"></span><button class="gs-strip" type="button">STRIP ALL</button><button class="gs-done" type="button">DONE (E)</button></div>`;
    this.listEl = root.querySelector('.gs-list');
    this.nodesEl = root.querySelector('.gs-nodes');
    this.linesEl = root.querySelector('.gs-lines');
    this.partsEl = root.querySelector('.gs-parts');
    this.statsEl = root.querySelector('.gs-stats');
    this.titleEl = root.querySelector('.gs-weapon');
    this.countEl = root.querySelector('.gs-count');
    root.querySelector('.gs-done').addEventListener('click', () => this.onClose());
    root.querySelector('.gs-strip').addEventListener('click', () => {
      this.setLoadout(this.weaponId, {});
      this.sounds.swap();
      this.render();
    });
    // drag empty space to turn the gun
    let drag = null;
    addEventListener('mousedown', (e) => { if (this.open && !e.target.closest('.gs-list, .gs-right, .gs-node, .gs-bottom, .gs-top')) drag = e.clientX; });
    addEventListener('mousemove', (e) => { if (drag != null) { this.rotY += (e.clientX - drag) * 0.008; drag = e.clientX; } });
    addEventListener('mouseup', () => { drag = null; });
    this.nodeEls = {};
  }

  show(weaponId) {
    this.open = true;
    if (weaponId) this.weaponId = weaponId;
    this.slot = null;
    this.rotY = 0;
    this.root.classList.remove('hidden');
    this.render();
  }

  hide() {
    this.open = false;
    this.root.classList.add('hidden');
  }

  // the current build of the gun on the bench
  def() { return buildDef(WEAPONS[this.weaponId], this.getLoadout(this.weaponId)); }

  render() {
    const id = this.weaponId, base = WEAPONS[id];
    const lo = { ...this.getLoadout(id) };
    // ---- weapon list, grouped by type
    const groups = new Map();
    for (const wid of CASE_ORDER) {
      const t = WEAPONS[wid].type;
      const key = /RIFLE|BULLPUP/.test(t) && !/SNIPER|LEVER|MARKSMAN/.test(t) ? 'RIFLES' : /SMG|MACHINE PISTOL/.test(t) ? 'SMGS'
        : /SHOTGUN|DOUBLE/.test(t) ? 'SHOTGUNS' : /SNIPER|LEVER|MARKSMAN/.test(t) ? 'PRECISION' : /LMG|MINIGUN/.test(t) ? 'HEAVY' : 'SIDEARMS';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(wid);
    }
    this.listEl.replaceChildren(...[...groups].flatMap(([g, ids]) => [el('div', 'gs-group', g), ...ids.map((wid) => {
      const b = el('button', `gs-gun${wid === id ? ' on' : ''}`);
      b.type = 'button';
      const n = Object.keys(this.getLoadout(wid)).length;
      b.append(el('b', null, WEAPONS[wid].name), el('span', null, WEAPONS[wid].type));
      if (n) b.append(el('i', null, String(n)));
      b.onclick = () => { this.weaponId = wid; this.slot = null; this.hover = null; this.sounds.click(2400, 0.15); this.render(); };
      return b;
    })]));
    const cls = classesOf(id);
    this.titleEl.replaceChildren(el('b', null, base.name), el('span', null, `${base.type}${cls.length ? ' · ' + cls.join(' / ') : ''}`));
    // ---- slot nodes (positioned every frame by layout())
    this.nodesEl.replaceChildren();
    this.nodeEls = {};
    for (const s of slotsFor(id)) {
      const n = el('button', `gs-node${this.slot === s.id ? ' on' : ''}${lo[s.id] ? ' fitted' : ''}`);
      n.type = 'button';
      const a = ATTACHMENTS[lo[s.id]];
      n.append(el('small', null, s.name), el('b', null, a && a.slot === s.id ? a.name : 'FACTORY'));
      n.onclick = () => { this.slot = this.slot === s.id ? null : s.id; this.hover = null; this.sounds.click(2000, 0.12); this.render(); };
      n.onmouseenter = () => n.classList.add('hot');
      n.onmouseleave = () => n.classList.remove('hot');
      this.nodesEl.append(n);
      this.nodeEls[s.id] = n;
    }
    const fitted = Object.keys(lo).length;
    this.countEl.textContent = `${fitted} / ${slotsFor(id).length} SLOTS FITTED`;
    this.renderParts();
    this.renderStats();
  }

  // the parts list for the open slot: cards with pros (green) and cons (red)
  renderParts() {
    const id = this.weaponId, base = WEAPONS[id], lo = { ...this.getLoadout(id) };
    if (!this.slot) {
      this.partsEl.replaceChildren(el('div', 'gs-parts-h', 'PICK A SLOT'), el('p', 'gs-tip', 'Click any label on the gun to see the parts that fit there.'));
      return;
    }
    const slotName = SLOTS.find((s) => s.id === this.slot).name;
    const head = el('div', 'gs-parts-h');
    head.append(el('b', null, slotName), el('span', null, `${optionsFor(id, this.slot).length} PARTS`));
    const card = (aid) => {
      const a = aid ? ATTACHMENTS[aid] : null;
      const on = (lo[this.slot] || null) === aid;
      const c = el('button', `gs-card${on ? ' on' : ''}`);
      c.type = 'button';
      c.append(el('b', null, a ? a.name : 'FACTORY'), el('p', null, a ? a.desc : 'The gun as it left the factory.'));
      if (!on) {
        const pc = prosCons(base, lo, this.slot, aid).slice(0, 5);
        if (pc.length) {
          const ul = el('div', 'gs-pc');
          for (const x of pc) ul.append(el('i', x.good ? 'pro' : 'con', `${x.good ? '▲' : '▼'} ${x.name}`));
          c.append(ul);
        }
      } else c.append(el('div', 'gs-fitted', 'FITTED'));
      c.onmouseenter = () => { this.hover = { slot: this.slot, id: aid }; this.renderStats(); };
      c.onmouseleave = () => { this.hover = null; this.renderStats(); };
      c.onclick = () => {
        const next = { ...this.getLoadout(id) };
        if (aid) next[this.slot] = aid; else delete next[this.slot];
        this.setLoadout(id, next);
        this.sounds.magIn();
        this.hover = null;
        this.render();
      };
      return c;
    };
    this.partsEl.replaceChildren(head, card(null), ...optionsFor(id, this.slot).map((o) => card(o.id)));
  }

  renderStats() {
    const id = this.weaponId, base = WEAPONS[id];
    const lo = { ...this.getLoadout(id) };
    const cur = buildDef(base, lo);
    let shown = cur;
    if (this.hover) {
      const h = { ...lo };
      if (this.hover.id) h[this.hover.slot] = this.hover.id; else delete h[this.hover.slot];
      shown = buildDef(base, h);
    }
    const r0 = ratings(buildDef(base, {})), r1 = ratings(cur), r2 = ratings(shown);
    const head = el('div', 'gs-parts-h');
    head.append(el('b', null, 'STATS'), el('span', null, this.hover ? 'PREVIEW' : ''));
    this.statsEl.replaceChildren(head, ...r2.map((s, i) => {
      const row = el('div', 'stat');
      const diff = s.v - r1[i].v;
      const better = diff > 0.004, worse = diff < -0.004;
      row.append(el('span', 'stat-name', s.name), el('span', `stat-val${better ? ' up' : worse ? ' down' : ''}`, s.text || `${Math.round(s.v * 100)}`));
      const bar = el('div', 'bar');
      const fill = el('i');
      fill.style.width = `${(Math.min(s.v, r1[i].v) * 100).toFixed(1)}%`;
      bar.append(fill);
      if (better || worse) {
        const d = el('b', better ? 'up' : 'down');
        d.style.left = `${(Math.min(s.v, r1[i].v) * 100).toFixed(1)}%`;
        d.style.width = `${(Math.abs(diff) * 100).toFixed(1)}%`;
        bar.append(d);
      }
      const mark = el('u');
      mark.style.left = `${(r0[i].v * 100).toFixed(1)}%`;   // factory value
      bar.append(mark);
      row.append(bar);
      return row;
    }));
  }

  // pts: { slot: [x, y] screen px of that slot's spot on the gun } — place the labels and draw the leader lines
  layout(pts) {
    const W = innerWidth, H = innerHeight;
    const left = Math.min(260, W * 0.2), right = W - Math.min(380, W * 0.3);
    const ids = Object.keys(this.nodeEls).filter((s) => pts[s]);
    const gunTop = Math.min(...ids.map((s) => pts[s][1])), gunBot = Math.max(...ids.map((s) => pts[s][1]));
    const rows = { top: ids.filter((s) => TOP.includes(s)), bot: ids.filter((s) => !TOP.includes(s)) };
    const lines = [];
    for (const [row, list] of Object.entries(rows)) {
      list.sort((a, b) => pts[a][0] - pts[b][0]);
      const y = row === 'top' ? Math.max(90, gunTop - 120) : Math.min(H - 150, gunBot + 90);
      const w = 150, gap = 10;
      // spread them out along the row, as close to their spots as they can get
      let xs = list.map((s) => Math.max(left + 10, Math.min(right - w - 10, pts[s][0] - w / 2)));
      for (let i = 1; i < xs.length; i++) xs[i] = Math.max(xs[i], xs[i - 1] + w + gap);
      const over = xs.length ? xs[xs.length - 1] + w - (right - 10) : 0;
      if (over > 0) xs = xs.map((x) => x - over);
      for (let i = xs.length - 2; i >= 0; i--) xs[i] = Math.min(xs[i], xs[i + 1] - w - gap);
      list.forEach((s, i) => {
        const n = this.nodeEls[s];
        n.style.transform = `translate(${xs[i].toFixed(0)}px, ${y.toFixed(0)}px)`;
        n.style.width = `${w}px`;
        const ax = xs[i] + w / 2, ay = row === 'top' ? y + 46 : y;
        lines.push([ax, ay, pts[s][0], pts[s][1], s]);
      });
    }
    this.linesEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
    this.linesEl.replaceChildren(...lines.flatMap(([x1, y1, x2, y2, s]) => {
      const on = this.slot === s, fitted = !!this.getLoadout(this.weaponId)[s];
      const l = document.createElementNS(SVGNS, 'polyline');
      const mid = y1 + (y2 - y1) * 0.5;
      l.setAttribute('points', `${x1},${y1} ${x1},${mid} ${x2},${y2}`);
      l.setAttribute('class', on ? 'on' : fitted ? 'fit' : '');
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', x2); c.setAttribute('cy', y2); c.setAttribute('r', on ? 5 : 3.5);
      c.setAttribute('class', on ? 'on' : fitted ? 'fit' : '');
      return [l, c];
    }));
  }
}
