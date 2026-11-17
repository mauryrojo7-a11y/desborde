const SOUND_MUTE_STORAGE_KEY = 'desborde_sound_muted_v1';

// Pentatonic major scale across 3 octaves (C4 -> A6) for ascending combo hits
const PENTATONIC_SCALE_HZ = [
  261.63, 293.66, 329.63, 392.0, 440.0,
  523.25, 587.33, 659.25, 783.99, 880.0,
  1046.5, 1174.66, 1318.51, 1567.98, 1760.0,
] as const;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted: boolean;

  constructor() {
    this.muted = this.readMutedFromStorage();
  }

  private readMutedFromStorage(): boolean {
    try {
      return window.localStorage.getItem(SOUND_MUTE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      window.localStorage.setItem(SOUND_MUTE_STORAGE_KEY, String(muted));
    } catch {
      // Ignore storage errors silently.
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.72, this.ctx.currentTime, 0.015);
    }
  }

  public toggleMute(): boolean {
    const next = !this.muted;
    this.setMuted(next);
    if (!next) {
      this.unlock();
      this.playUiClick();
    }
    return next;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-16, ctx.currentTime);
      compressor.knee.setValueAtTime(18, ctx.currentTime);
      compressor.ratio.setValueAtTime(6, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.18, ctx.currentTime);

      const master = ctx.createGain();
      master.gain.setValueAtTime(this.muted ? 0 : 0.72, ctx.currentTime);

      master.connect(compressor);
      compressor.connect(ctx.destination);

      this.ctx = ctx;
      this.masterGain = master;
      this.noiseBuffer = this.createWhiteNoiseBuffer(ctx);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
  }

  private createWhiteNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.35);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private ensureReady(): { ctx: AudioContext; out: GainNode } | null {
    if (this.muted) return null;
    this.unlock();
    if (!this.ctx || !this.masterGain) return null;
    return { ctx: this.ctx, out: this.masterGain };
  }

  public playImpulse(assisted: boolean): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = assisted ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(assisted ? 240 : 185, t);
    osc.frequency.exponentialRampToValueAtTime(assisted ? 560 : 410, t + 0.085);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.095);

    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  public playComboHit(combo: number): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;
    const t = ctx.currentTime;

    const noteIdx = Math.min(Math.max(combo - 1, 0), PENTATONIC_SCALE_HZ.length - 1);
    const baseFreq = PENTATONIC_SCALE_HZ[noteIdx];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.015, t + 0.09);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.24, t + 0.007);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.15);

    // Add shimmering harmonic overtone when fever combo is active (x5+)
    if (combo >= 5) {
      const shimmer = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      shimmer.type = 'sine';
      shimmer.frequency.setValueAtTime(baseFreq * 1.5, t);

      shimmerGain.gain.setValueAtTime(0.001, t);
      shimmerGain.gain.linearRampToValueAtTime(0.1, t + 0.01);
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      shimmer.connect(shimmerGain);
      shimmerGain.connect(out);
      shimmer.start(t);
      shimmer.stop(t + 0.17);
    }
  }

  public playDestroy(maxHp: number): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;
    const t = ctx.currentTime;
    const intensity = Math.min(1.5, 0.8 + maxHp * 0.08);

    // Sub-bass punch
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, t);
    sub.frequency.exponentialRampToValueAtTime(36, t + 0.24);

    subGain.gain.setValueAtTime(0.001, t);
    subGain.gain.linearRampToValueAtTime(0.36 * intensity, t + 0.01);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);

    sub.connect(subGain);
    subGain.connect(out);
    sub.start(t);
    sub.stop(t + 0.27);

    // Crisp filtered noise burst
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1250, t);
      filter.frequency.exponentialRampToValueAtTime(340, t + 0.14);
      filter.Q.setValueAtTime(1.6, t);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.22 * intensity, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(out);
      noise.start(t);
      noise.stop(t + 0.16);
    }
  }

  public playMultiplierPickup(mult: 2 | 3): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;
    const t = ctx.currentTime;

    const notes = mult === 3 ? [1046.5, 1318.51, 1567.98, 2093.0] : [880.0, 1174.66, 1567.98];
    notes.forEach((freq, idx) => {
      const start = t + idx * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.19);

      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }

  public playShockwave(): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(250, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + 0.38);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, t);
    filter.frequency.exponentialRampToValueAtTime(140, t + 0.36);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.32, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.42);
  }

  public playRevive(): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;
    const t = ctx.currentTime;

    [392.0, 523.25, 659.25, 783.99].forEach((freq, idx) => {
      const start = t + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  public playGameOver(): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;
    const t = ctx.currentTime;

    [329.63, 261.63, 196.0].forEach((freq, idx) => {
      const start = t + idx * 0.095;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.88, start + 0.18);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + 0.22);
    });
  }

  public playUiClick(): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.04);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + 0.055);
  }

  public playPurchase(): void {
    const audio = this.ensureReady();
    if (!audio) return;
    const { ctx, out } = audio;
    const t = ctx.currentTime;

    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const start = t + idx * 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }
}

export const soundEngine = new SoundEngine();
