/**
 * V2.0 Stadyum Ses Efektleri Yöneticisi (Web Audio API)
 * Harici MP3 dosyasına ihtiyaç duymaz; 404 hatası olmadan %100 çevrimdışı çalışır.
 * Mute tercihi localStorage ('sound_muted') üzerinden kalıcı olarak saklanır.
 */

import { sounds } from './audio';

class StadiumSoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.isMuted = localStorage.getItem('sound_muted') === 'true';
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.isMuted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getMuted(): boolean {
    if (typeof window !== 'undefined') {
      this.isMuted = localStorage.getItem('sound_muted') === 'true';
    }
    return this.isMuted;
  }

  public setMuted(muted: boolean): boolean {
    this.isMuted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sound_muted', String(muted));
    }
    if (sounds.getMuted() !== muted) {
      sounds.toggleMute();
    }
    return this.isMuted;
  }

  public toggleMute(): boolean {
    const next = !this.getMuted();
    return this.setMuted(next);
  }

  /**
   * Maç başlangıç hakem düdüğü
   */
  public playMatchStartWhistle(): void {
    if (this.getMuted()) return;
    sounds.playWhistle();
  }

  /**
   * Doğru tahmin: stadyum taraftar tezahüratı + parlak onay zili
   */
  public playCorrectCheer(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Kısa taraftar uğultusu (bandpass gürültü)
    const sampleRate = ctx.sampleRate;
    const dur = 0.45;
    const buffer = ctx.createBuffer(1, Math.floor(sampleRate * dur), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.4;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.Q.setValueAtTime(1.1, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.16, now + 0.06);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + dur);

    // 2. Parlak akor zili
    sounds.playCorrect();
  }

  /**
   * Yanlış tahmin: düşük buzzer + metalik direğe çarpma sesi
   */
  public playWrongPost(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Direğe çarpma metalik tonu
    const postOsc = ctx.createOscillator();
    const postGain = ctx.createGain();
    postOsc.type = 'triangle';
    postOsc.frequency.setValueAtTime(320, now);
    postOsc.frequency.exponentialRampToValueAtTime(115, now + 0.22);

    postGain.gain.setValueAtTime(0.24, now);
    postGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    postOsc.connect(postGain);
    postGain.connect(ctx.destination);
    postOsc.start(now);
    postOsc.stop(now + 0.24);

    sounds.playWrong();
  }

  /**
   * Son 5 saniye geri sayım tik-tak sesi
   */
  public playCountdownTick(secondsLeft: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const isTick = secondsLeft % 2 === 1;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isTick ? 920 : 720, now);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Altın Coin ödül şıngırtısı
   */
  public playCoinJingle(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [987.77, 1318.51, 1661.22]; // B5, E6, G#6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.065);

      gain.gain.setValueAtTime(0.001, now + idx * 0.065);
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.065 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.065 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.065);
      osc.stop(now + idx * 0.065 + 0.25);
    });
  }

  /**
   * Zafer fanfarı & Coin şıngırtısı
   */
  public playVictoryFanfare(): void {
    if (this.getMuted()) return;
    sounds.playVictory();
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        this.playCoinJingle();
      }, 420);
    }
  }
}

export const soundManager = new StadiumSoundManager();
