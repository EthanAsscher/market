// ═══════════════════════════════════════════════════════════
//  MARKET — Audio Engine
//  Web Audio API: procedural SFX + MP3 music with crossfade
// ═══════════════════════════════════════════════════════════

class AudioEngineClass {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicOscs: { osc: OscillatorNode; gain: GainNode; filter?: BiquadFilterNode }[] = [];
  private musicActive = false;
  private currentMode: "light" | "dark" = "light";
  private currentTrack: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private musicUrls: { light: string | null; dark: string | null } = { light: null, dark: null };
  private initialized = false;

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.12;
    this.musicGain.connect(this.masterGain);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.3;
    this.sfxGain.connect(this.masterGain);
    this.initialized = true;
  }

  // ─── MP3 Music ───
  private async loadTrack(url: string): Promise<AudioBuffer | null> {
    if (!this.ctx || !url) return null;
    try {
      const resp = await fetch(url);
      const buf = await resp.arrayBuffer();
      return await this.ctx.decodeAudioData(buf);
    } catch { return null; }
  }

  private async playTrack(mode: "light" | "dark"): Promise<boolean> {
    const url = this.musicUrls[mode];
    if (!url || !this.ctx || !this.musicGain) return false;
    const buf = await this.loadTrack(url);
    if (!buf) return false;

    // Fade out current
    if (this.currentTrack) {
      const old = this.currentTrack;
      old.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
      setTimeout(() => { try { old.src.stop(); } catch {} }, 2000);
    }

    // Play new
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 1.5);
    src.connect(gain);
    gain.connect(this.musicGain);
    src.start();
    this.currentTrack = { src, gain };
    this.musicActive = true;
    this.currentMode = mode;
    return true;
  }

  // ─── Procedural Music (fallback) ───
  private startProcedural(mode: "light" | "dark") {
    if (!this.ctx || !this.musicGain) return;
    this.stopMusic();
    this.currentMode = mode;
    this.musicActive = true;
    const t = this.ctx.currentTime;
    const notes = mode === "dark"
      ? [82.41, 110, 146.83, 185]
      : [130.81, 164.81, 196, 261.63];

    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();
      osc.type = i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.value = freq;
      osc.detune.setValueAtTime((Math.random() - 0.5) * 15, t);
      filter.type = "lowpass";
      filter.frequency.value = mode === "dark" ? 400 : 600;
      filter.Q.value = 1;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.06 / notes.length, t + 2);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain!);
      osc.start(t);
      this.musicOscs.push({ osc, gain, filter });
    });

    // LFO
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = mode === "dark" ? 0.05 : 0.08;
    lfoGain.gain.value = mode === "dark" ? 150 : 200;
    lfo.connect(lfoGain);
    this.musicOscs.forEach(o => { if (o.filter) lfoGain.connect(o.filter.frequency); });
    lfo.start(t);
    this.musicOscs.push({ osc: lfo, gain: lfoGain });
  }

  async startMusic(mode: "light" | "dark" = "light") {
    this.init();
    if (this.musicUrls[mode]) {
      const ok = await this.playTrack(mode);
      if (ok) return;
    }
    this.startProcedural(mode);
  }

  stopMusic() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicOscs.forEach(o => {
      try {
        if (o.gain.gain) o.gain.gain.linearRampToValueAtTime(0, t + 1);
        o.osc.stop(t + 1.1);
      } catch {}
    });
    this.musicOscs = [];
    if (this.currentTrack) {
      try {
        this.currentTrack.gain.gain.linearRampToValueAtTime(0, t + 1);
        this.currentTrack.src.stop(t + 1.1);
      } catch {}
      this.currentTrack = null;
    }
    this.musicActive = false;
  }

  setMode(mode: "light" | "dark") {
    if (this.musicActive && mode !== this.currentMode) this.startMusic(mode);
  }

  setMusicUrls(urls: { light?: string; dark?: string }) {
    if (urls.light) this.musicUrls.light = urls.light;
    if (urls.dark) this.musicUrls.dark = urls.dark;
  }

  playSfx(type: "buy" | "sell" | "event" | "claim" | "error" | "click") {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGain);

    switch (type) {
      case "buy":
        osc.type = "sine";
        osc.frequency.setValueAtTime(523, t);
        osc.frequency.linearRampToValueAtTime(784, t + 0.08);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.15);
        osc.start(t); osc.stop(t + 0.15);
        break;
      case "sell":
        osc.type = "triangle";
        osc.frequency.setValueAtTime(392, t);
        osc.frequency.linearRampToValueAtTime(294, t + 0.1);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.15);
        osc.start(t); osc.stop(t + 0.15);
        break;
      case "event":
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, t);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.4);
        osc.start(t); osc.stop(t + 0.4);
        // Second tone
        const o2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        o2.connect(g2); g2.connect(this.sfxGain!);
        o2.type = "sine"; o2.frequency.value = 1108;
        g2.gain.setValueAtTime(0, t + 0.1);
        g2.gain.linearRampToValueAtTime(0.15, t + 0.15);
        g2.gain.linearRampToValueAtTime(0, t + 0.5);
        o2.start(t + 0.1); o2.stop(t + 0.5);
        break;
      case "claim":
        [523, 659, 784].forEach((f, i) => {
          const co = this.ctx!.createOscillator();
          const cg = this.ctx!.createGain();
          co.connect(cg); cg.connect(this.sfxGain!);
          co.type = "sine"; co.frequency.value = f;
          cg.gain.setValueAtTime(0, t + i * 0.08);
          cg.gain.linearRampToValueAtTime(0.2, t + i * 0.08 + 0.02);
          cg.gain.linearRampToValueAtTime(0, t + i * 0.08 + 0.2);
          co.start(t + i * 0.08); co.stop(t + i * 0.08 + 0.2);
        });
        break;
      case "error":
        osc.type = "square";
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.linearRampToValueAtTime(150, t + 0.12);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.12);
        osc.start(t); osc.stop(t + 0.12);
        break;
      case "click":
        osc.type = "sine";
        osc.frequency.value = 1200;
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.03);
        osc.start(t); osc.stop(t + 0.03);
        break;
    }
  }

  setVolume(v: number) {
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  isPlaying() { return this.musicActive; }
  isInitialized() { return this.initialized; }
}

// Singleton
export const AudioEngine = new AudioEngineClass();
