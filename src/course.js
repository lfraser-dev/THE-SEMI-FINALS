// Parkour time trial: start gate, ordered checkpoints, finish gate, hazard floors that send you
// back to your last checkpoint, and a best time saved in this browser.
const inside = (p, b) =>
  p[0] >= b.min[0] && p[0] <= b.max[0] && p[1] >= (b.min[1] ?? -5) && p[1] <= (b.max[1] ?? 60) &&
  p[2] >= b.min[2] && p[2] <= b.max[2];

export const fmtTime = (t) => {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
};

export class Course {
  constructor(def, sounds) {
    this.def = def;
    this.sounds = sounds;
    this.state = 'idle';      // idle | running | done
    this.t = 0;
    this.next = 0;            // index of the next checkpoint to reach
    this.splits = [];
    this.respawn = def.start;
    this.flash = null;        // { text, sub, t, kind }
    this.wasIn = { start: false, finish: false };
    this.best = null;
    this.bestSplits = null;
    try {
      const saved = JSON.parse(localStorage.getItem('semifinals.course') || 'null');
      if (saved) { this.best = saved.best; this.bestSplits = saved.splits; }
    } catch { /* ignore */ }
  }

  show(text, sub = '', kind = '') { this.flash = { text, sub, t: 0, kind }; }

  restart(player) {
    this.state = 'idle';
    this.t = 0;
    this.next = 0;
    this.respawn = this.def.start;
    player.teleport(this.def.start.pos, this.def.start.yaw);
    this.show('PARKOUR', 'RUN THROUGH THE GATE TO START');
  }

  reset() { this.state = 'idle'; this.t = 0; this.next = 0; this.respawn = this.def.start; }

  // true while the HUD should show the course panel
  get visible() { return this.state !== 'idle' || this.near; }

  update(dt, player, input) {
    const d = this.def, p = player.pos;
    this.near = inside(p, d.area);
    if (this.flash) { this.flash.t += dt; if (this.flash.t > 1.6) this.flash = null; }
    if (input.hit('KeyX')) { this.restart(player); return; }
    if (this.state === 'running') this.t += dt;

    const inStart = inside(p, d.startGate), inFinish = inside(p, d.finishGate);
    if (inStart && !this.wasIn.start) {
      this.state = 'running';
      this.t = 0;
      this.next = 0;
      this.splits = [];
      this.respawn = d.start;
      this.sounds.startRun();
      this.show('GO', 'X — RESTART');
    }
    if (this.state === 'running' && this.next < d.checkpoints.length && inside(p, d.checkpoints[this.next])) {
      const cp = d.checkpoints[this.next];
      this.splits.push(this.t);
      const prev = this.bestSplits?.[this.next];
      const diff = prev != null ? this.t - prev : null;
      this.next++;
      this.respawn = cp.respawn;
      this.sounds.checkpoint();
      this.show(`CHECKPOINT ${this.next}/${d.checkpoints.length}`,
        diff == null ? fmtTime(this.t) : `${fmtTime(this.t)}  ${diff <= 0 ? '−' : '+'}${Math.abs(diff).toFixed(2)}`,
        diff != null && diff <= 0 ? 'good' : '');
    }
    if (inFinish && !this.wasIn.finish && this.state === 'running') {
      if (this.next < d.checkpoints.length) {
        this.show('MISSED A CHECKPOINT', `${this.next}/${d.checkpoints.length} — X TO RESTART`, 'bad');
      } else {
        this.state = 'done';
        this.splits.push(this.t);
        const pb = this.best == null || this.t < this.best;
        const diff = this.best != null ? this.t - this.best : null;
        if (pb) {
          this.best = this.t;
          this.bestSplits = this.splits.slice();
          try { localStorage.setItem('semifinals.course', JSON.stringify({ best: this.best, splits: this.bestSplits })); } catch { /* ignore */ }
        }
        this.sounds.finish();
        this.show(pb ? 'NEW BEST' : 'FINISH',
          `${fmtTime(this.t)}${diff != null ? `  ${diff <= 0 ? '−' : '+'}${Math.abs(diff).toFixed(2)}` : ''}`, pb ? 'good' : '');
      }
    }
    this.wasIn.start = inStart;
    this.wasIn.finish = inFinish;

    // hazard floor: touch it and you're sent back
    if (p[1] < 0.25 && !player.trav && d.hazards.some((h) => inside(p, h))) {
      const r = this.state === 'running' ? this.respawn : d.start;
      player.teleport(r.pos, r.yaw);
      this.sounds.fail();
      this.show('OUT', this.state === 'running' ? 'BACK TO CHECKPOINT' : '', 'bad');
      this.failT = 0.35;
    }
    if (this.failT > 0) this.failT -= dt;
  }
}
