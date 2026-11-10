// Matchmaking for PLAY: search for contestants → MATCH FOUND → 30 s to pick class, weapon and
// specialisation → team intro (4 teams of 3) → drop into the arena.
// Team names are drawn from a pool of five; player handles are generated from name parts.
import { CLASSES, CLASS_ORDER, ABILITIES, saveLoadout } from './classes.js';
import { WEAPONS } from './weapons.js';

export const TEAM_NAMES = ['THE GOLD RUSH', 'NEON VANDALS', 'SKY SHARKS', 'VAULT BREAKERS', 'LUCKY STRIKES'];
const TEAM_COLS = ['#ff7a1a', '#2f8cff', '#ff3d8b', '#2fd39a'];
const H1 = ['NOVA', 'VIPER', 'KAI', 'RONIN', 'ECHO', 'BLITZ', 'MAVERICK', 'ZERO', 'JINX', 'ORBIT', 'PIXEL', 'RAZOR', 'SABLE', 'TANGO', 'VOLT', 'WREN', 'GHOST', 'BANDIT', 'COMET', 'DIESEL'];
const H2 = ['', '', '_X', 'FOX', 'BYTE', 'JR', 'KING', 'LINE', 'RUSH', 'STAR', 'WAVE', 'BOT'];
const LOADOUT_TIME = 30;

const pickOf = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function handle(used) {
  for (let t = 0; t < 50; t++) {
    const n = pickOf(H1) + pickOf(H2) + (Math.random() < 0.45 ? String(Math.floor(Math.random() * 99) + 1) : '');
    if (!used.has(n)) { used.add(n); return n; }
  }
  return `CONTESTANT${used.size}`;
}
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

export class Matchmaking {
  constructor({ root, classLo, sounds, onChange, onDone, onCancel }) {
    Object.assign(this, { root, classLo, sounds, onChange, onDone, onCancel });
    this.phase = null;
    this.timer = null;
  }

  get active() { return this.phase != null; }

  start() {
    if (this.active) return;
    // build the match: 4 teams from the pool of five names, 3 contestants each, you on one of them
    const used = new Set();
    const names = shuffle([...TEAM_NAMES]).slice(0, 4);
    const mine = Math.floor(Math.random() * 4);
    this.teams = names.map((name, i) => ({
      name, col: TEAM_COLS[i], mine: i === mine,
      players: [0, 1, 2].map((k) => ({
        name: i === mine && k === 0 ? 'YOU' : handle(used),
        you: i === mine && k === 0,
        cls: pickOf(CLASS_ORDER), locked: false, lockAt: 4 + Math.random() * 20,
      })),
    }));
    this.you = this.teams[mine].players[0];
    this.you.cls = this.classLo.cls;
    this.found = 0;
    this.t = 0;
    this.root.classList.remove('hidden');
    this.setPhase('search');
    this.last = performance.now();
    this.timer = setInterval(() => this.tick(), 100);
  }

  cancel() {
    this.stop();
    this.onCancel?.();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.phase = null;
    this.root.classList.add('hidden');
    this.root.replaceChildren();
  }

  setPhase(p) {
    this.phase = p;
    this.t = 0;
    this.root.dataset.phase = p;
    this.root.replaceChildren();
    if (p === 'search') this.buildSearch();
    if (p === 'found') this.buildFound();
    if (p === 'loadout') this.buildLoadout();
    if (p === 'intro') this.buildIntro();
  }

  tick() {
    const now = performance.now(), dt = Math.min((now - this.last) / 1000, 1);
    this.last = now;
    this.t += dt;
    if (this.phase === 'search') {
      // contestants trickle in; your squad first
      const want = Math.min(12, Math.floor(this.t * 2.1 + 1));
      if (want > this.found) { this.found = want; this.sounds?.click?.(2200 + this.found * 60, 0.15, 4); this.updateSearch(); }
      this.searchTime.textContent = `0:${String(Math.floor(this.t)).padStart(2, '0')}`;
      if (this.found >= 12 && this.t > 6.2) this.setPhase('found');
    } else if (this.phase === 'found') {
      if (this.t > 1.8) { this.setPhase('loadout'); this.left = LOADOUT_TIME; }
    } else if (this.phase === 'loadout') {
      const before = Math.ceil(this.left);
      this.left -= dt;
      for (const tm of this.teams) for (const p of tm.players) if (!p.you && !p.locked && LOADOUT_TIME - this.left > p.lockAt) { p.locked = true; if (tm.mine) this.updateSquad(); }
      const n = Math.max(0, Math.ceil(this.left));
      if (n !== before) {
        this.clock.textContent = n;
        this.clockRing.style.setProperty('--p', (this.left / LOADOUT_TIME).toFixed(3));
        this.root.classList.toggle('hurry', n <= 5);
        if (n <= 5 && n > 0) this.sounds?.beep?.(false);
      }
      if (this.left <= 0) { this.you.locked = true; this.setPhase('intro'); }
    } else if (this.phase === 'intro') {
      const shown = Math.min(4, Math.floor(this.t / 0.9) + 1);
      if (shown !== this.shown) { this.shown = shown; this.sounds?.startRun?.(); }
      if (this.t > 4.4 && !this.dropShown) { this.dropShown = true; this.dropBtn.classList.add('on'); this.sounds?.finish?.(); }
    }
  }

  // ---------------------------------------------------------------- search
  buildSearch() {
    const wrap = el('div', 'mk-search');
    wrap.append(el('div', 'mk-kicker', `SEMI-FINALS · ${this.mapName || 'SKY DOCKS'} · 4 TEAMS OF 3`));
    const title = el('div', 'mk-title');
    title.append(el('span', null, 'FINDING MATCH'), el('i', 'mk-dots'));
    wrap.append(title);
    this.searchTime = el('div', 'mk-time', '0:00');
    wrap.append(this.searchTime);
    this.slots = el('div', 'mk-slots');
    for (let i = 0; i < 12; i++) this.slots.append(el('i'));
    wrap.append(this.slots);
    this.searchInfo = el('div', 'mk-info');
    wrap.append(this.searchInfo);
    const cancel = el('button', 'mk-cancel', 'CANCEL');
    cancel.type = 'button';
    cancel.onclick = () => this.cancel();
    wrap.append(cancel);
    this.root.append(wrap);
    this.updateSearch();
  }

  updateSearch() {
    [...this.slots.children].forEach((s, i) => s.classList.toggle('on', i < this.found));
    this.searchInfo.textContent = `CONTESTANTS FOUND ${this.found} / 12`;
  }

  // ---------------------------------------------------------------- found
  buildFound() {
    const w = el('div', 'mk-found');
    w.append(el('b', null, 'MATCH FOUND'), el('span', null, this.mapName || 'SKY DOCKS'));
    this.root.append(w);
    this.sounds?.checkpoint?.();
  }

  // ---------------------------------------------------------------- loadout (30 s)
  buildLoadout() {
    const left = el('div', 'mk-load');
    left.append(el('div', 'mk-kicker', `SEMI-FINALS · ${this.mapName || 'SKY DOCKS'}`));
    left.append(el('div', 'mk-title mk-title-s', 'CHOOSE YOUR LOADOUT'));
    this.loadBody = el('div', 'mk-load-body');
    left.append(this.loadBody);
    this.lockBtn = el('button', 'mk-lock', 'LOCK IN');
    this.lockBtn.type = 'button';
    this.lockBtn.onclick = () => this.lockIn();
    left.append(this.lockBtn);
    this.root.append(left);

    const clock = el('div', 'mk-clock');
    this.clockRing = el('div', 'mk-ring');
    this.clockRing.style.setProperty('--p', 1);
    this.clock = el('b', null, String(LOADOUT_TIME));
    this.clockRing.append(this.clock);
    clock.append(el('span', null, 'MATCH STARTS IN'), this.clockRing);
    this.root.append(clock);

    const squad = el('div', 'mk-squad');
    this.squad = squad;
    this.root.append(squad);
    this.renderLoadout();
    this.updateSquad();
  }

  renderLoadout() {
    const lo = this.classLo, c = CLASSES[lo.cls], sel = lo[lo.cls];
    const locked = this.you.locked;
    const row = (title, items) => { const h = el('h4', null, title); const r = el('div', 'mk-row'); r.append(...items); return [h, r]; };
    const card = (on, color, main, sub, onClick) => {
      const b = el('button', `mk-card${on ? ' on' : ''}`);
      b.type = 'button';
      b.disabled = locked;
      b.style.setProperty('--c', color);
      b.append(el('b', null, main), el('small', null, sub));
      b.onclick = () => { if (!this.you.locked) { onClick(); saveLoadout(lo); this.onChange?.(); this.sounds?.swap?.(); this.renderLoadout(); this.updateSquad(); } };
      return b;
    };
    const classes = CLASS_ORDER.map((id) => {
      const k = CLASSES[id];
      return card(id === lo.cls, rgb(k.color), k.name, `${k.hp} HP · ${Math.round(k.speed * 100)}% SPEED`, () => { lo.cls = id; this.you.cls = id; });
    });
    const weapons = c.weapons.map((id) => card(id === sel.weapon, rgb(c.color), WEAPONS[id].name, WEAPONS[id].type, () => { sel.weapon = id; }));
    const abilities = c.abilities.map((id) => card(id === sel.ability, rgb(c.color), ABILITIES[id].name, `COOLDOWN ${ABILITIES[id].cd}`, () => { sel.ability = id; }));
    this.loadBody.replaceChildren(
      el('p', 'mk-desc', c.desc),
      ...row('CLASS', classes), ...row('PRIMARY WEAPON', weapons), ...row('SPECIALISATION', abilities),
    );
    this.lockBtn.textContent = locked ? 'LOCKED IN ✓' : 'LOCK IN';
    this.lockBtn.classList.toggle('done', locked);
  }

  lockIn() {
    if (this.you.locked) return;
    this.you.locked = true;
    this.sounds?.magIn?.();
    this.renderLoadout();
    this.updateSquad();
    // everyone else hurries up once you're ready; the match starts a few seconds later
    if (this.left > 4) this.left = Math.min(this.left, 4.99);
    for (const tm of this.teams) for (const p of tm.players) p.lockAt = Math.min(p.lockAt, LOADOUT_TIME - this.left - 0.5);
  }

  updateSquad() {
    if (!this.squad) return;
    const tm = this.teams.find((t) => t.mine);
    const head = el('div', 'mk-squad-h');
    head.style.setProperty('--t', tm.col);
    head.append(el('small', null, 'YOUR TEAM'), el('b', null, tm.name));
    const rows = tm.players.map((p) => {
      const r = el('div', `mk-pl${p.you ? ' you' : ''}`);
      const k = CLASSES[p.cls];
      const chip = el('i', null, k.name);
      chip.style.setProperty('--c', rgb(k.color));
      r.append(el('b', null, p.name), chip, el('span', p.locked ? 'ok' : '', p.locked ? 'LOCKED' : 'PICKING…'));
      return r;
    });
    this.squad.replaceChildren(head, ...rows);
  }

  // ---------------------------------------------------------------- team intro
  buildIntro() {
    this.shown = 0;
    this.dropShown = false;
    const w = el('div', 'mk-intro');
    const top = el('div', 'mk-intro-top');
    top.append(el('small', null, 'THE SEMI-FINALS · ROUND 1'), el('b', null, this.mapName || 'SKY DOCKS'));
    w.append(top);
    const row = el('div', 'mk-teams');
    this.teams.forEach((tm, i) => {
      const cd = el('div', `mk-team${tm.mine ? ' mine' : ''}`);
      cd.style.setProperty('--t', tm.col);
      cd.style.animationDelay = `${i * 0.9}s`;
      const head = el('div', 'mk-team-h');
      head.append(el('small', null, tm.mine ? 'YOUR TEAM' : `TEAM ${i + 1}`), el('b', null, tm.name));
      cd.append(head);
      for (const p of tm.players) {
        const r = el('div', `mk-tp${p.you ? ' you' : ''}`);
        const k = CLASSES[p.cls];
        const chip = el('i', null, k.name);
        chip.style.setProperty('--c', rgb(k.color));
        r.append(el('b', null, p.name), chip);
        cd.append(r);
      }
      row.append(cd);
    });
    w.append(row);
    w.append(el('div', 'mk-rule', 'TOP 2 TEAMS ADVANCE TO THE FINAL'));
    this.dropBtn = el('button', 'mk-drop', 'DROP IN ▶');
    this.dropBtn.type = 'button';
    this.dropBtn.onclick = () => this.finish();
    w.append(this.dropBtn);
    this.root.append(w);
  }

  finish() {
    if (this.phase !== 'intro') return;
    const match = { teams: this.teams.map((t) => ({ name: t.name, col: t.col, mine: t.mine, players: t.players.map((p) => ({ name: p.name, cls: p.cls, you: p.you })) })) };
    this.stop();
    this.onDone?.(match);       // called from the click, so the game can lock the mouse
  }

  // keyboard: Esc cancels the search, Enter / Space locks in or drops in
  key(e) {
    if (!this.active) return false;
    if (e.code === 'Escape' && this.phase === 'search') { this.cancel(); return true; }
    if ((e.code === 'Enter' || e.code === 'Space') && this.phase === 'loadout') { this.lockIn(); return true; }
    if ((e.code === 'Enter' || e.code === 'Space') && this.phase === 'intro' && this.dropShown) { this.finish(); return true; }
    return true;   // swallow other keys while the overlay is up
  }
}
