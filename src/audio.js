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

  shot(s = { freq: 2600, thump: 150, gain: 0.55 }) {
    const dur = s.dur || 0.13;
    this.burst(dur, s.freq, s.gain);
    this.burst(0.05, 6000, s.gain * 0.45, 'highpass');
    this.tone(s.thump, 40, dur * 0.85, s.gain * 0.9);
  }
  click(freq = 2800, gain = 0.25, q = 4) { this.burst(0.045, freq, gain, 'bandpass', q); }
  magOut() { this.click(2200, 0.28); setTimeout(() => this.burst(0.08, 900, 0.12), 60); }
  magIn() { this.click(3200, 0.35, 5); setTimeout(() => this.click(2600, 0.2), 70); }
  bolt() { this.click(2000, 0.3); setTimeout(() => this.click(3400, 0.32, 5), 110); }
  pump() { this.burst(0.07, 1400, 0.3, 'bandpass', 2); setTimeout(() => this.burst(0.07, 1900, 0.32, 'bandpass', 2), 150); }
  shell() { this.click(2600, 0.22, 3); }
  cloth() { this.burst(0.15, 1200, 0.07); }
  swap() { this.burst(0.12, 1500, 0.1); setTimeout(() => this.click(3000, 0.18), 120); }
  pickup() { this.tone(600, 1200, 0.12, 0.12, 'triangle'); this.click(2600, 0.25); }
  slide() { this.burst(0.55, 900, 0.22); this.burst(0.3, 3000, 0.06, 'highpass'); }
  vault() { this.burst(0.14, 800, 0.2); this.click(1100, 0.14, 2); setTimeout(() => this.burst(0.2, 1600, 0.08), 90); }
  mantle() { this.burst(0.18, 600, 0.22); this.click(1400, 0.12, 2); }
  step(vol = 0.6) { this.burst(0.06, 320 + Math.random() * 260, 0.16 * vol); this.click(900 + Math.random() * 500, 0.05 * vol, 1.5); }
  wallStep() { this.burst(0.05, 700 + Math.random() * 300, 0.11); this.click(1600, 0.05, 2); }
  wallRun() { this.burst(0.25, 1100, 0.1, 'bandpass', 1.2); }
  wallJump() { this.burst(0.12, 500, 0.2); this.burst(0.3, 2400, 0.06, 'highpass'); this.tone(300, 600, 0.12, 0.06, 'triangle'); }
  grab() { this.burst(0.08, 450, 0.3); this.click(1200, 0.2, 2); }
  chain(n) { this.tone(500 + n * 110, 900 + n * 160, 0.1, 0.08, 'triangle'); }
  checkpoint() { this.tone(880, 880, 0.08, 0.12, 'triangle'); setTimeout(() => this.tone(1320, 1320, 0.14, 0.12, 'triangle'), 80); }
  startRun() { this.tone(660, 1320, 0.18, 0.12, 'square'); }
  finish() { [0, 90, 180, 300].forEach((d, i) => setTimeout(() => this.tone(660 * [1, 1.25, 1.5, 2][i], 660 * [1, 1.25, 1.5, 2][i], 0.18, 0.12, 'triangle'), d)); }
  fail() { this.tone(400, 140, 0.3, 0.16, 'sawtooth'); }
  hit() { this.tone(1400, 1100, 0.05, 0.18, 'square'); }
  kill() { this.tone(900, 1800, 0.12, 0.2, 'triangle'); this.burst(0.35, 1800, 0.35, 'bandpass', 1.2); }
  crumble() { this.burst(0.3, 700, 0.35); }
  dry() { this.tone(2200, 1800, 0.03, 0.12, 'square'); }
  jump() { this.burst(0.08, 500, 0.12); }
  land() { this.burst(0.12, 300, 0.25); }
}
