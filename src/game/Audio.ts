import type { Preferences } from './state';

type SoundName = 'click' | 'attack' | 'hit' | 'cast' | 'heal' | 'loot' | 'level' | 'portal' | 'death' | 'slime';

export class GameAudio {
  private ctx?: AudioContext;
  private musicGain?: GainNode;
  private soundGain?: GainNode;
  private reverb?: ConvolverNode;
  private timer?: number;
  private nextBeat = 0;
  private beat = 0;
  private running = false;
  preferences: Preferences;
  constructor(preferences: Preferences) { this.preferences = preferences; }
  async unlock() {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.musicGain = this.ctx.createGain(); this.soundGain = this.ctx.createGain();
        this.musicGain.connect(this.ctx.destination); this.soundGain.connect(this.ctx.destination);
        this.reverb = this.ctx.createConvolver();
        const length = Math.floor(this.ctx.sampleRate * 1.8); const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const data = impulse.getChannelData(ch); for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.8) * .2; }
        this.reverb.buffer = impulse; this.reverb.connect(this.musicGain);
        this.setPreferences(this.preferences);
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      if (!this.running) { this.running = true; this.nextBeat = this.ctx.currentTime + .1; this.timer = window.setInterval(() => this.schedule(), 120); }
    } catch { /* Sound is optional when a browser or device has no audio output. */ }
  }
  setPreferences(preferences: Preferences) {
    this.preferences = preferences;
    if (!this.ctx) return;
    this.musicGain!.gain.setTargetAtTime(preferences.music ? preferences.volume * .29 : 0, this.ctx.currentTime, .12);
    this.soundGain!.gain.setTargetAtTime(preferences.sound ? preferences.volume * .65 : 0, this.ctx.currentTime, .08);
  }
  private note(midi: number, at: number, duration: number, volume: number, type: OscillatorType, destination: AudioNode, reverb = false) {
    if (!this.ctx) return;
    const oscillator = this.ctx.createOscillator(); const envelope = this.ctx.createGain();
    oscillator.type = type; oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(volume, at + .015); envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(envelope); envelope.connect(destination); if (reverb && this.reverb) envelope.connect(this.reverb);
    oscillator.start(at); oscillator.stop(at + duration + .1);
  }
  private schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const melody = [74, 71, 69, 67, 69, 71, 74, 79, 78, 74, 71, 69, 67, 64, 67, 71, 72, 71, 67, 64, 62, 67, 69, 71, 74, 72, 69, 66, 67, 69, 71, 74];
    const chords = [[55, 59, 62, 67], [52, 55, 59, 64], [48, 52, 55, 60], [50, 54, 57, 62]];
    if (this.nextBeat < this.ctx.currentTime - 1) this.nextBeat = this.ctx.currentTime + .1;
    while (this.nextBeat < this.ctx.currentTime + .5) {
      const chord = chords[Math.floor(this.beat / 8) % 4];
      this.note(chord[this.beat % 4], this.nextBeat, 2.1, .20, 'triangle', this.musicGain!, true);
      if (this.beat % 2 === 0) this.note(melody[(this.beat / 2) % melody.length], this.nextBeat + .012, 1.7, .15, 'sine', this.musicGain!, true);
      if (this.beat % 8 === 0) this.note(chord[0] - 12, this.nextBeat, 3.5, .17, 'sine', this.musicGain!);
      this.beat++; this.nextBeat += .37;
    }
  }
  play(name: SoundName) {
    if (!this.ctx || !this.soundGain || !this.preferences.sound || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const sounds: Record<SoundName, number[]> = {
      click: [83], attack: [57, 64], hit: [43], cast: [79, 83, 86], heal: [72, 76, 79], loot: [83, 90], level: [67, 71, 74, 79, 83, 86], portal: [62, 69, 74, 78, 81], death: [64, 60, 55, 48], slime: [67, 59],
    };
    sounds[name].forEach((midi, i) => this.note(midi, now + i * (name === 'attack' ? .03 : .085), name === 'click' ? .09 : name === 'level' ? 1.6 : .45, name === 'hit' ? .22 : .13, name === 'attack' || name === 'hit' ? 'triangle' : 'sine', this.soundGain!));
  }
  async suspend(hidden: boolean) {
    if (!this.ctx) return;
    try { if (hidden) await this.ctx.suspend(); else if (this.running) await this.ctx.resume(); } catch { /* Browser may require a new gesture. */ }
  }
  dispose() { if (this.timer) clearInterval(this.timer); void this.ctx?.close(); }
}
