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
  dash() { this.burst(0.22, 1800, 0.22, 'bandpass', 0.8); this.burst(0.12, 400, 0.18); this.tone(300, 900, 0.15, 0.05, 'sawtooth'); }
  dashReady() { this.tone(1400, 1700, 0.06, 0.05, 'triangle'); }
  grappleFire() { this.burst(0.18, 3200, 0.14, 'highpass'); this.tone(900, 2400, 0.16, 0.05, 'sawtooth'); }
  grappleHit() { this.click(1500, 0.35, 3); this.burst(0.1, 600, 0.22); }
  grappleRelease() { this.burst(0.1, 2200, 0.08, 'bandpass', 2); }
  grappleMiss() { this.tone(1600, 500, 0.25, 0.05, 'sawtooth'); }
  slamLeap() { this.burst(0.15, 500, 0.2); this.tone(200, 500, 0.2, 0.08, 'triangle'); }
  slamDive() { this.burst(0.4, 1200, 0.16, 'bandpass', 0.7); this.tone(700, 160, 0.35, 0.06, 'sawtooth'); }
  slam(power = 1) {
    this.burst(0.7, 260, 0.9 * Math.min(power, 1.2));
    this.burst(0.35, 1400, 0.35, 'bandpass', 0.8);
    this.tone(90, 32, 0.6, 0.6 * Math.min(power, 1.2));
    setTimeout(() => this.burst(0.5, 700, 0.25), 60);
  }
  botShot(dist = 10) {
    const g = Math.max(0.06, 0.4 / (1 + dist * 0.08));
    this.burst(0.09, 2200, g); this.tone(220, 60, 0.08, g * 0.7);
  }
  whiz() { this.burst(0.12, 4200, 0.12, 'bandpass', 6); this.tone(2400, 900, 0.1, 0.03, 'sine'); }
  hurt() { this.burst(0.18, 260, 0.45); this.tone(180, 90, 0.15, 0.18, 'sine'); }
  death() { this.tone(400, 60, 1.0, 0.25, 'sawtooth'); this.burst(0.6, 400, 0.4); }
  alarm() {
    for (let i = 0; i < 4; i++) setTimeout(() => { this.tone(620, 620, 0.22, 0.09, 'square'); setTimeout(() => this.tone(460, 460, 0.22, 0.09, 'square'), 240); }, i * 520);
  }
  button() { this.click(1800, 0.5, 3); this.tone(880, 1760, 0.12, 0.08, 'square'); }
  botDrop() { this.tone(1600, 200, 0.5, 0.05, 'sawtooth'); }
  botLand() { this.burst(0.2, 260, 0.35); }
  botDie() { this.burst(0.4, 1400, 0.3, 'bandpass', 1); this.tone(700, 120, 0.35, 0.1, 'square'); }
  doors() { this.burst(0.9, 500, 0.2); this.burst(0.5, 3000, 0.05, 'highpass'); }
  beep(hi = false) { this.click(hi ? 2600 : 1900, hi ? 0.4 : 0.25, 5); }   // dry tick, no melody
  waveClear() { [0, 110, 220].forEach((d, i) => setTimeout(() => this.tone(523 * [1, 1.25, 1.5][i], 523 * [1, 1.25, 1.5][i], 0.25, 0.1, 'triangle'), d)); }
  launch() { this.burst(0.35, 700, 0.3); this.tone(220, 1100, 0.32, 0.1, 'sawtooth'); this.burst(0.4, 3200, 0.07, 'highpass'); }
  glass() { this.burst(0.22, 5200, 0.2, 'highpass'); this.burst(0.45, 3000, 0.1, 'bandpass', 3); for (let i = 0; i < 5; i++) setTimeout(() => this.click(3800 + Math.random() * 3200, 0.1, 7), 25 + i * 40 + Math.random() * 30); }
  spin() { this.burst(0.2, 1700, 0.13, 'bandpass', 1.4); this.burst(0.12, 3600, 0.04, 'highpass'); }
  catch() { this.burst(0.06, 500, 0.28); this.click(2400, 0.22, 3); }
  whoosh() { this.burst(0.9, 900, 0.12, 'bandpass', 0.6); }
  elevatorStart() { this.click(900, 0.3, 2); this.burst(0.4, 400, 0.12); }      // gate latch + motor clunk
  elevatorDing() { this.burst(0.25, 300, 0.25); this.click(1400, 0.25, 3); }   // car settles
  hit() { this.tone(1400, 1100, 0.05, 0.18, 'square'); }
  kill() { this.tone(900, 1800, 0.12, 0.2, 'triangle'); this.burst(0.35, 1800, 0.35, 'bandpass', 1.2); }
  crumble() { this.burst(0.3, 700, 0.35); }
  dry() { this.tone(2200, 1800, 0.03, 0.12, 'square'); }
  jump() { this.burst(0.08, 500, 0.12); }
  land() { this.burst(0.12, 300, 0.25); }
}
