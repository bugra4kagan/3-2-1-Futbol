/**
 * Procedural Web Audio API sound generator for 3-2-1 Football Challenge
 * No external asset loading needed - instantaneous and 100% offline-ready.
 */

class SoundController {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Read user mute preference if available
    if (typeof window !== 'undefined') {
      this.isMuted = localStorage.getItem('sound_muted') === 'true';
    }
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sound_muted', String(this.isMuted));
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Countdown beep (pitch changes: 3 = 440Hz, 2 = 554Hz, 1 = 659Hz)
   */
  public playCountdown(num: number) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const freq = num === 3 ? 440 : num === 2 ? 554 : 659;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  /**
   * Referee Whistle sound on round start
   */
  public playWhistle() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [0, 0.12].forEach((offset) => {
      const osc1 = this.ctx!.createOscillator();
      const osc2 = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(2600, now + offset);
      osc2.frequency.setValueAtTime(2800, now + offset);

      gain.gain.setValueAtTime(0.18, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx!.destination);

      osc1.start(now + offset);
      osc2.start(now + offset);
      osc1.stop(now + offset + 0.1);
      osc2.stop(now + offset + 0.1);
    });
  }

  /**
   * Correct Answer Chime - uplifting major chord
   */
  public playCorrect() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.25, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.35);
    });
  }

  /**
   * Wrong Answer Buzzer - short low buzz
   */
  public playWrong() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(90, now + 0.2);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Full-time referee triple whistle (short - short - long) when a player hits 3 and the match ends
   */
  public playFullTimeWhistle() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const blasts = [
      { offset: 0, duration: 0.14 },
      { offset: 0.22, duration: 0.14 },
      { offset: 0.44, duration: 0.48 },
    ];

    blasts.forEach(({ offset, duration }) => {
      const start = now + offset;
      const osc1 = this.ctx!.createOscillator();
      const osc2 = this.ctx!.createOscillator();
      const trillOsc = this.ctx!.createOscillator();
      const trillGain = this.ctx!.createGain();
      const masterGain = this.ctx!.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(2680, start);
      osc2.frequency.setValueAtTime(2860, start);

      // Referee pea trill modulation (~38Hz)
      trillOsc.type = 'sine';
      trillOsc.frequency.setValueAtTime(38, start);
      trillGain.gain.setValueAtTime(85, start);
      trillOsc.connect(trillGain);
      trillGain.connect(osc1.frequency);

      masterGain.gain.setValueAtTime(0.001, start);
      masterGain.gain.linearRampToValueAtTime(0.22, start + 0.02);
      masterGain.gain.setValueAtTime(0.2, start + Math.max(0.03, duration - 0.05));
      masterGain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc1.connect(masterGain);
      osc2.connect(masterGain);
      masterGain.connect(this.ctx!.destination);

      trillOsc.start(start);
      osc1.start(start);
      osc2.start(start);
      trillOsc.stop(start + duration);
      osc1.stop(start + duration);
      osc2.stop(start + duration);
    });
  }

  /**
   * Stadium Goal Celebration sound when winning a round ("gol sesi")
   */
  public playGoal() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 1. Stadium crowd cheer noise burst (bandpass-filtered swell)
    const sampleRate = this.ctx.sampleRate;
    const durationSec = 0.85;
    const buffer = this.ctx.createBuffer(1, Math.floor(sampleRate * durationSec), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.65;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);
    filter.Q.setValueAtTime(0.9, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(0.22, now + 0.08);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + durationSec);

    // 2. Brassy stadium goal horn chord + triumphant rise
    const notes = [
      { f: 392.0, t: 0, dur: 0.24 },     // G4
      { f: 523.25, t: 0.08, dur: 0.26 }, // C5
      { f: 659.25, t: 0.16, dur: 0.34 }, // E5
      { f: 783.99, t: 0.24, dur: 0.5 },  // G5
      { f: 1046.5, t: 0.32, dur: 0.52 }, // C6
    ];

    notes.forEach(({ f, t, dur }) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + t);

      gain.gain.setValueAtTime(0.001, now + t);
      gain.gain.linearRampToValueAtTime(0.24, now + t + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + dur);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + t);
      osc.stop(now + t + dur);
    });
  }

  /**
   * Victory Fanfare
   */
  public playVictory() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const chords = [
      { f: 523.25, t: 0 },
      { f: 659.25, t: 0.12 },
      { f: 783.99, t: 0.24 },
      { f: 1046.5, t: 0.36 },
      { f: 880, t: 0.52 },
      { f: 1046.5, t: 0.7 },
    ];

    chords.forEach((c) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(c.f, now + c.t);

      gain.gain.setValueAtTime(0.25, now + c.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + c.t + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + c.t);
      osc.stop(now + c.t + 0.4);
    });
  }

  /**
   * Subtle 2-note notification chime for live friend activity toasts
   */
  public playNotification() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const tones = [
      { f: 659.25, t: 0, dur: 0.14 },   // E5
      { f: 880.0, t: 0.08, dur: 0.22 }, // A5
    ];

    tones.forEach(({ f, t, dur }) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + t);

      gain.gain.setValueAtTime(0.001, now + t);
      gain.gain.linearRampToValueAtTime(0.14, now + t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + dur);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + t);
      osc.stop(now + t + dur);
    });
  }
}

export const sounds = new SoundController();
