import { AudioSettings } from '../types';

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;

  private ambientOsc1: OscillatorNode | null = null;
  private ambientOsc2: OscillatorNode | null = null;
  private heartbeatTimer: any = null;
  private heartbeatBpm: number = 60;
  private isMutedUnfocused: boolean = true;
  private isBinaural: boolean = true;

  private settings: AudioSettings = {
    master: 0.7,
    music: 0.55,
    sfx: 0.8,
    voice: 0.65,
    muteUnfocused: true,
    binaural: true
  };

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.voiceGain = this.ctx.createGain();

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.voiceGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.updateVolumes(this.settings);
      this.startAmbientMusic();
      this.startHeartbeatLoop();

      // Mute when unfocused listener
      window.addEventListener('blur', () => {
        if (this.isMutedUnfocused && this.masterGain && this.ctx) {
          this.masterGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
        }
      });
      window.addEventListener('focus', () => {
        if (this.masterGain && this.ctx) {
          this.masterGain.gain.setValueAtTime(this.settings.master, this.ctx.currentTime);
        }
      });
    } catch (e) {
      console.warn('AudioContext not supported or blocked:', e);
    }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public updateVolumes(settings: AudioSettings) {
    this.settings = { ...settings };
    this.isMutedUnfocused = settings.muteUnfocused;
    this.isBinaural = settings.binaural;

    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain || !this.voiceGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(settings.master, now, 0.05);
    this.musicGain.gain.setTargetAtTime(settings.music * 0.4, now, 0.05);
    this.sfxGain.gain.setTargetAtTime(settings.sfx, now, 0.05);
    this.voiceGain.gain.setTargetAtTime(settings.voice, now, 0.05);
  }

  private startAmbientMusic() {
    if (!this.ctx || !this.musicGain) return;

    // Dark low drone generator
    try {
      this.ambientOsc1 = this.ctx.createOscillator();
      this.ambientOsc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();

      this.ambientOsc1.type = 'sawtooth';
      this.ambientOsc1.frequency.setValueAtTime(45, this.ctx.currentTime); // Low bass drone

      this.ambientOsc2.type = 'sine';
      this.ambientOsc2.frequency.setValueAtTime(48.5, this.ctx.currentTime); // Slight binaural beat detune

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, this.ctx.currentTime);

      // Low frequency LFO for breathing drone filter
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(0.15, this.ctx.currentTime); // slow pulse
      lfoGain.gain.setValueAtTime(80, this.ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      this.ambientOsc1.connect(filter);
      this.ambientOsc2.connect(filter);
      filter.connect(this.musicGain);

      this.ambientOsc1.start();
      this.ambientOsc2.start();
    } catch (e) {
      console.error(e);
    }
  }

  private startHeartbeatLoop() {
    const playBeat = () => {
      if (this.ctx && this.sfxGain && this.heartbeatBpm > 40) {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(65, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.16);

        // Second thud (lub-dub)
        setTimeout(() => {
          if (!this.ctx || !this.sfxGain) return;
          const now2 = this.ctx.currentTime;
          const osc2 = this.ctx.createOscillator();
          const gain2 = this.ctx.createGain();

          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(55, now2);
          osc2.frequency.exponentialRampToValueAtTime(25, now2 + 0.15);

          gain2.gain.setValueAtTime(0.5, now2);
          gain2.gain.exponentialRampToValueAtTime(0.001, now2 + 0.18);

          osc2.connect(gain2);
          gain2.connect(this.sfxGain);
          osc2.start(now2);
          osc2.stop(now2 + 0.19);
        }, 140);
      }

      const intervalMs = (60 / Math.max(40, this.heartbeatBpm)) * 1000;
      this.heartbeatTimer = setTimeout(playBeat, intervalMs);
    };

    playBeat();
  }

  public setMonsterProximity(distRatio: number) {
    // distRatio: 0 = far, 1 = monster is right on top of player
    // Higher ratio -> faster BPM (from 50 to 140)
    const clamped = Math.max(0, Math.min(1, distRatio));
    this.heartbeatBpm = 50 + clamped * 100;
  }

  public playFootstep(isSprinting: boolean = false) {
    if (!this.ctx || !this.sfxGain) return;
    this.resume();
    const now = this.ctx.currentTime;

    // Noise buffer for creaky wood step
    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isSprinting ? 900 : 650, now);
    filter.Q.setValueAtTime(2, now);

    const gain = this.ctx.createGain();
    const vol = isSprinting ? 0.4 : 0.22;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isSprinting ? 0.07 : 0.09));

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
  }

  public playMonsterGrowl() {
    if (!this.ctx || !this.sfxGain) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.linearRampToValueAtTime(40, now + 1.2);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, now);
    filter.frequency.linearRampToValueAtTime(120, now + 1.2);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.6, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 1.35);
  }

  public playJumpscareScream() {
    if (!this.ctx || !this.sfxGain) return;
    this.resume();
    const now = this.ctx.currentTime;

    // High screech oscillator + chaotic noise
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(900, now);
    osc1.frequency.exponentialRampToValueAtTime(1800, now + 0.1);
    osc1.frequency.linearRampToValueAtTime(300, now + 0.8);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(920, now);
    osc2.frequency.linearRampToValueAtTime(250, now + 0.8);

    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.0);
    osc2.stop(now + 1.0);
  }

  public playKnifeStabStinger() {
    if (!this.ctx || !this.sfxGain) return;
    this.resume();
    const now = this.ctx.currentTime;

    // Sharp slash impact
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);

    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playShopBuy() {
    if (!this.ctx || !this.sfxGain) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.16); // G5

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.36);
  }

  public playWhisper() {
    if (!this.ctx || !this.voiceGain) return;
    this.resume();
    const now = this.ctx.currentTime;

    // Filtered noise simulating creepy breath / whisper
    const bufferSize = this.ctx.sampleRate * 1.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.Q.setValueAtTime(5, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.5);
    gain.gain.linearRampToValueAtTime(0.001, now + 1.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.voiceGain);

    noise.start(now);
  }

  public playWeaponShot() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  public stopAll() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    try {
      this.ambientOsc1?.stop();
      this.ambientOsc2?.stop();
    } catch {}
    this.ambientOsc1 = null;
    this.ambientOsc2 = null;

    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {}
      this.ctx = null;
    }
  }
}

export const soundSystem = new SoundSystem();
