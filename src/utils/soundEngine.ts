// WarioWare Retro Web Audio Synthesizer & Beat Sequencer
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private tempo: number = 130; // Starts around 130 BPM
  private timerId: any = null;
  private nextNoteTime: number = 0.0;
  private beatCount: number = 0;
  private onBeatCallback: ((beat: number, time: number) => void) | null = null;
  private isPlaying: boolean = false;
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {}

  public init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.35, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Build standard white noise buffer
    const bufferSize = this.ctx.sampleRate * 1.5; // 1.5 seconds of noise
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.35, this.ctx.currentTime);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setTempo(bpm: number) {
    this.tempo = Math.max(80, Math.min(bpm, 250));
  }

  public getTempo(): number {
    return this.tempo;
  }

  // Procedure for retro synth SFX
  public playSFX(type: 'jump' | 'stomp' | 'success' | 'failure' | 'speedup' | 'gameover' | 'tick' | 'explosion' | 'laugh' | 'click' | 'select' | 'unlock') {
    this.init();
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.connect(this.masterGain!);

    switch (type) {
      case 'click': {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.05);
        break;
      }
      case 'select': {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.setValueAtTime(600, t + 0.07);
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.setValueAtTime(0.4, t + 0.07);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.16);
        break;
      }
      case 'jump': {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(850, t + 0.18);
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.2);
        break;
      }
      case 'stomp': {
        // Quick noise burst with low-pass sweeping down
        if (this.noiseBuffer) {
          const source = this.ctx.createBufferSource();
          source.buffer = this.noiseBuffer;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(400, t);
          filter.frequency.exponentialRampToValueAtTime(50, t + 0.12);

          gain.gain.setValueAtTime(0.7, t);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

          source.connect(filter);
          filter.connect(gain);
          source.start(t);
          source.stop(t + 0.15);
        }
        break;
      }
      case 'tick': {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, t);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.03);
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.04);
        break;
      }
      case 'explosion': {
        if (this.noiseBuffer) {
          const source = this.ctx.createBufferSource();
          source.buffer = this.noiseBuffer;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800, t);
          filter.frequency.exponentialRampToValueAtTime(40, t + 0.6);

          gain.gain.setValueAtTime(1.0, t);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.7);

          source.connect(filter);
          filter.connect(gain);
          source.start(t);
          source.stop(t + 0.7);
        }
        break;
      }
      case 'success': {
        // Dynamic, joyful retro arpeggio: C5 -> E5 -> G5 -> C6
        const notes = [523.25, 659.25, 783.99, 1046.50];
        const step = 0.06;
        notes.forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const noteGain = this.ctx!.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, t + idx * step);
          noteGain.gain.setValueAtTime(0.25, t + idx * step);
          noteGain.gain.exponentialRampToValueAtTime(0.01, t + idx * step + 0.15);

          osc.connect(noteGain);
          noteGain.connect(gain);
          osc.start(t + idx * step);
          osc.stop(t + idx * step + 0.16);
        });
        break;
      }
      case 'failure': {
        // Melodramatic detuned slide down: G3 -> F#3 -> F3 (low)
        const notes = [196.00, 185.00, 174.61];
        const step = 0.12;
        notes.forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const noteGain = this.ctx!.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, t + idx * step);
          osc.frequency.linearRampToValueAtTime(freq - 30, t + idx * step + 0.1);
          noteGain.gain.setValueAtTime(0.3, t + idx * step);
          noteGain.gain.exponentialRampToValueAtTime(0.01, t + idx * step + 0.14);

          osc.connect(noteGain);
          noteGain.connect(gain);
          osc.start(t + idx * step);
          osc.stop(t + idx * step + 0.15);
        });
        break;
      }
      case 'speedup': {
        // Rapid siren rising pitch
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(250, t);
        osc.frequency.linearRampToValueAtTime(800, t + 0.15);
        osc.frequency.linearRampToValueAtTime(400, t + 0.3);
        osc.frequency.linearRampToValueAtTime(1000, t + 0.45);

        gain.gain.setValueAtTime(0.35, t);
        gain.gain.linearRampToValueAtTime(0.35, t + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

        osc.connect(gain);
        osc.start(t);
        osc.stop(t + 0.5);
        break;
      }
      case 'gameover': {
        // Low, sad melody
        const notes = [220.0, 196.0, 174.6, 146.8]; // A3 -> G3 -> F3 -> D3
        const step = 0.2;
        notes.forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const noteGain = this.ctx!.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t + idx * step);
          noteGain.gain.setValueAtTime(0.3, t + idx * step);
          noteGain.gain.exponentialRampToValueAtTime(0.01, t + idx * step + 0.22);

          osc.connect(noteGain);
          noteGain.connect(gain);
          osc.start(t + idx * step);
          osc.stop(t + idx * step + 0.25);
        });
        break;
      }
      case 'laugh': {
        // Replicates Wario's "Wah-ha-ha!" rhythmically using low, raspy synth bursts
        const bursts = [150, 130, 110];
        const step = 0.13;
        bursts.forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const bGain = this.ctx!.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, t + idx * step);
          osc.frequency.setValueAtTime(freq - 15, t + idx * step + 0.05);

          bGain.gain.setValueAtTime(0.35, t + idx * step);
          bGain.gain.exponentialRampToValueAtTime(0.01, t + idx * step + 0.12);

          osc.connect(bGain);
          bGain.connect(gain);
          osc.start(t + idx * step);
          osc.stop(t + idx * step + 0.13);
        });
        break;
      }
      case 'unlock': {
        // Uplifting retro unlock chime
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
        const step = 0.05;
        notes.forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const nGain = this.ctx!.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t + idx * step);
          nGain.gain.setValueAtTime(0.2, t + idx * step);
          nGain.gain.exponentialRampToValueAtTime(0.01, t + idx * step + 0.1);

          osc.connect(nGain);
          nGain.connect(gain);
          osc.start(t + idx * step);
          osc.stop(t + idx * step + 0.12);
        });
        break;
      }
    }
  }

  // Procedural background rhythm generator that adapts automatically to BPM changes
  private scheduleNextBeat() {
    if (!this.ctx || !this.isPlaying) return;

    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      const beatTime = this.nextNoteTime;
      const beatNum = this.beatCount;

      // Call our visual-sync beat callback
      if (this.onBeatCallback) {
        // Make sure it runs safely
        try {
          this.onBeatCallback(beatNum, beatTime);
        } catch (e) {
          console.error("Error in beat callback: ", e);
        }
      }

      // Synthesize rhythmic background accompaniment notes
      this.playBackgroundRhythmNode(beatNum, beatTime);

      // Advance clock based on current tempo
      const secondsPerBeat = 60.0 / this.tempo;
      this.nextNoteTime += secondsPerBeat;
      this.beatCount++;
    }

    // Loop scheduler
    this.timerId = setTimeout(() => this.scheduleNextBeat(), 25);
  }

  private playBackgroundRhythmNode(beatNum: number, time: number) {
    if (!this.ctx || this.isMuted) return;

    const gain = this.ctx.createGain();
    gain.connect(this.masterGain!);

    const barBeat = beatNum % 4; // 0, 1, 2, 3

    // Synthesize a retro drum kick on beat 0, simple snare click on beat 2, bassline on all beats
    // Bass note pitch fluctuates
    let bassFreq = 110; // A2
    if (barBeat === 0) bassFreq = 110;      // A2
    else if (barBeat === 1) bassFreq = 130; // C3
    else if (barBeat === 2) bassFreq = 146; // D3
    else if (barBeat === 3) bassFreq = 98;  // G2

    // Simple bass synth
    const bassOsc = this.ctx.createOscillator();
    bassOsc.type = 'triangle';
    bassOsc.frequency.setValueAtTime(bassFreq, time);
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    bassOsc.connect(gain);
    bassOsc.start(time);
    bassOsc.stop(time + 0.16);

    // Drum beat overlay
    if (barBeat === 0) {
      // Procedural kick
      const kickOsc = this.ctx.createOscillator();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(150, time);
      kickOsc.frequency.exponentialRampToValueAtTime(45, time + 0.08);

      const kickGain = this.ctx.createGain();
      kickGain.connect(this.masterGain!);
      kickGain.gain.setValueAtTime(0.2, time);
      kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

      kickOsc.connect(kickGain);
      kickOsc.start(time);
      kickOsc.stop(time + 0.1);
    } else if (barBeat === 2) {
      // Procedural snare/clap using noise
      if (this.noiseBuffer) {
        const snareSource = this.ctx.createBufferSource();
        snareSource.buffer = this.noiseBuffer;

        const snareFilter = this.ctx.createBiquadFilter();
        snareFilter.type = 'bandpass';
        snareFilter.frequency.setValueAtTime(1000, time);

        const snareGain = this.ctx.createGain();
        snareGain.connect(this.masterGain!);
        snareGain.gain.setValueAtTime(0.15, time);
        snareGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

        snareSource.connect(snareFilter);
        snareFilter.connect(snareGain);
        snareSource.start(time);
        snareSource.stop(time + 0.09);
      }
    } else {
      // Hi-hat tick
      const hatOsc = this.ctx.createOscillator();
      hatOsc.type = 'triangle';
      hatOsc.frequency.setValueAtTime(2000, time);

      const hatGain = this.ctx.createGain();
      hatGain.connect(this.masterGain!);
      hatGain.gain.setValueAtTime(0.05, time);
      hatGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

      hatOsc.connect(hatGain);
      hatOsc.start(time);
      hatOsc.stop(time + 0.03);
    }
  }

  public startBeatLoop(callback: (beat: number, time: number) => void) {
    this.init();
    if (this.isPlaying) return;
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isPlaying = true;
    this.onBeatCallback = callback;
    this.beatCount = 0;
    this.nextNoteTime = this.ctx ? this.ctx.currentTime + 0.05 : 0;
    this.scheduleNextBeat();
  }

  public stopBeatLoop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  public resetBeatCount() {
    this.beatCount = 0;
    if (this.ctx) {
      this.nextNoteTime = this.ctx.currentTime + 0.02;
    }
  }
}

export const sound = new SoundEngine();
