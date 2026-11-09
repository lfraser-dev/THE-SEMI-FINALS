// Procedural sound effects (no audio files needed).
export class Sounds {
  constructor() {
    this.ctx = null;
    this.volume = 0.5;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.6;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  burst(dur, freq, gain, type = 'lowpass', q = 0.7) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.3, dur + 0.05);
  }

  tone(f0, f1, dur, gain, type = 'sine') {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  shot() { this.burst(0.13, 2600, 0.55); this.burst(0.05, 6000, 0.25, 'highpass'); this.tone(150, 45, 0.11, 0.5); }
  hit() { this.tone(1400, 1100, 0.05, 0.18, 'square'); }
  kill() { this.tone(900, 1800, 0.12, 0.2, 'triangle'); this.burst(0.35, 1800, 0.35, 'bandpass', 1.2); }
  crumble() { this.burst(0.3, 700, 0.35); }
  dry() { this.tone(2200, 1800, 0.03, 0.12, 'square'); }
  reload() {
    if (!this.ctx) return;
    this.burst(0.05, 3000, 0.2, 'bandpass', 3);
    setTimeout(() => this.burst(0.06, 2400, 0.25, 'bandpass', 3), 650);
    setTimeout(() => this.burst(0.05, 3200, 0.3, 'bandpass', 4), 1350);
  }
  jump() { this.burst(0.08, 500, 0.12); }
  land() { this.burst(0.12, 300, 0.25); }
}
