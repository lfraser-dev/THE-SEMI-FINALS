// Workbench overlay: pick a weapon, swap attachments per slot, see stat changes live.
import { WEAPONS, CASE_ORDER } from './weapons.js';
import { SLOTS, ATTACHMENTS, slotsFor, optionsFor, buildDef, ratings } from './attachments.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export class Bench {
  // getLoadout(id) -> object, setLoadout(id, lo)
  constructor({ root, getLoadout, setLoadout, sounds, onClose }) {
    Object.assign(this, { root, getLoadout, setLoadout, sounds, onClose });
    this.open = false;
    this.weaponId = 'ar';
    this.rotY = 0.6;          // preview rotation (drag to spin)
    this.hover = null;        // attachment id under the mouse, for the stat preview
    this.tabs = root.querySelector('.bench-tabs');
    this.slotsEl = root.querySelector('.bench-slots');
    this.statsEl = root.querySelector('.bench-stats');
    this.titleEl = root.querySelector('.bench-weapon');
    this.descEl = root.querySelector('.bench-desc');
    root.querySelector('.bench-done').addEventListener('click', () => this.onClose());
    root.querySelector('.bench-clear').addEventListener('click', () => {
      this.setLoadout(this.weaponId, {});
      this.sounds.swap();
      this.render();
    });
    // drag empty space (the right side of the screen) to spin the gun
    let drag = null;
    addEventListener('mousedown', (e) => { if (this.open && !e.target.closest('.bench-panel')) drag = e.clientX; });
    addEventListener('mousemove', (e) => { if (drag != null) { this.rotY += (e.clientX - drag) * 0.01; drag = e.clientX; } });
    addEventListener('mouseup', () => { drag = null; });
  }

  show(weaponId) {
    this.open = true;
    if (weaponId) this.weaponId = weaponId;
    this.root.classList.remove('hidden');
    this.render();
  }

  hide() {
    this.open = false;
    this.root.classList.add('hidden');
  }

  render() {
    const id = this.weaponId, base = WEAPONS[id];
    const lo = { ...this.getLoadout(id) };
    // weapon tabs
    this.tabs.replaceChildren(...CASE_ORDER.map((wid) => {
      const b = el('button', `tab${wid === id ? ' on' : ''}`, WEAPONS[wid].name);
      const n = Object.keys(this.getLoadout(wid)).length;
      if (n) b.append(el('i', null, String(n)));
      b.onclick = () => { this.weaponId = wid; this.hover = null; this.sounds.click(2400, 0.15); this.render(); };
      return b;
    }));
    this.titleEl.replaceChildren(el('b', null, base.name), el('span', null, base.type));

    // slots with option chips
    this.slotsEl.replaceChildren(...slotsFor(id).map((slot) => {
      const row = el('div', 'slot');
      row.append(el('div', 'slot-name', slot.name));
      const chips = el('div', 'chips');
      const mk = (aid, name) => {
        const c = el('button', `chip${(lo[slot.id] || null) === aid ? ' on' : ''}`, name);
        c.onmouseenter = () => { this.hover = { slot: slot.id, id: aid }; this.renderStats(); this.renderDesc(aid); };
        c.onmouseleave = () => { this.hover = null; this.renderStats(); this.renderDesc(null); };
        c.onclick = () => {
          const next = { ...this.getLoadout(id) };
          if (aid) next[slot.id] = aid; else delete next[slot.id];
          this.setLoadout(id, next);
          this.sounds.magIn();
          this.render();
        };
        return c;
      };
      chips.append(mk(null, 'FACTORY'), ...optionsFor(id, slot.id).map((o) => mk(o.id, o.name)));
      row.append(chips);
      return row;
    }));
    this.renderStats();
    this.renderDesc(null);
  }

  renderDesc(aid) {
    const a = aid && ATTACHMENTS[aid];
    if (a) this.descEl.textContent = `${a.name} — ${a.desc}`;
    else {
      const n = Object.keys(this.getLoadout(this.weaponId)).length;
      this.descEl.textContent = n ? `${n} attachment${n > 1 ? 's' : ''} fitted. Hover an option to preview its stats.` : 'Factory configuration. Hover an option to preview its stats.';
    }
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
    this.statsEl.replaceChildren(...r2.map((s, i) => {
      const row = el('div', 'stat');
      const diff = s.v - r1[i].v;
      const better = diff > 0.004, worse = diff < -0.004;
      row.append(el('span', 'stat-name', s.name), el('span', `stat-val${better ? ' up' : worse ? ' down' : ''}`, s.text));
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
}
