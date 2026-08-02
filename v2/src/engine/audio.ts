/**
 * WebAudio synth: a sample-accurate metronome (kick / hat / bass locked to the
 * global beat clock via lookahead scheduling) plus one-shot SFX.
 */
class AudioMan {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private osc(
    type: OscillatorType,
    f0: number,
    f1: number,
    t0: number,
    dur: number,
    vol: number,
  ) {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(t0: number, dur: number, vol: number, hp = 4000) {
    if (!this.ctx || !this.master) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, Math.max(n, 1), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
  }

  /** metronome voice for absolute beat number `beatIndex`, scheduled at `time` */
  metroTick(time: number, beatIndex: number) {
    if (!this.ctx) return;
    const inBar = ((beatIndex % 4) + 4) % 4;
    if (inBar === 0) {
      this.osc("sine", 150, 45, time, 0.14, 0.9); // kick on the downbeat
    } else {
      this.noise(time, 0.05, 0.22, 6000); // hats
    }
    // simple bassline: I - I - V - V per bar, octave hop each bar
    const root = ((Math.floor(beatIndex / 4) % 2) === 0 ? 87.31 : 110) * (inBar >= 2 ? 1.5 : 1);
    this.osc("square", root, root, time, 0.18, 0.12);
  }

  instruction() {
    const t = this.now;
    this.osc("sawtooth", 300, 900, t, 0.18, 0.25);
    this.osc("sawtooth", 450, 1350, t + 0.05, 0.2, 0.2);
  }
  winJingle() {
    const t = this.now;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.osc("triangle", f, f, t + i * 0.09, 0.22, 0.3),
    );
  }
  loseJingle() {
    const t = this.now;
    [392, 311.13, 233.08].forEach((f, i) =>
      this.osc("sawtooth", f, f * 0.97, t + i * 0.14, 0.3, 0.22),
    );
  }
  coin() {
    const t = this.now;
    this.osc("square", 987.77, 987.77, t, 0.08, 0.2);
    this.osc("square", 1318.5, 1318.5, t + 0.08, 0.18, 0.2);
  }
  speedUp(step: number) {
    const t = this.now;
    for (let i = 0; i < 6; i++) {
      const f = 220 * Math.pow(1.12, i + step * 2);
      this.osc("square", f, f * 1.02, t + i * 0.11, 0.12, 0.2);
    }
  }
  doorMove() {
    this.noise(this.now, 0.25, 0.15, 900);
  }
  press() {
    this.osc("square", 660, 660, this.now, 0.05, 0.12);
  }
  boom() {
    const t = this.now;
    this.osc("sine", 120, 30, t, 0.4, 0.8);
    this.noise(t, 0.3, 0.4, 300);
  }
  gameOver() {
    const t = this.now;
    [246.94, 233.08, 220, 207.65, 196].forEach((f, i) =>
      this.osc("sawtooth", f, f, t + i * 0.22, 0.35, 0.2),
    );
  }
}

export const AUDIO = new AudioMan();
