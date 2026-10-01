import { musicSamples } from './music';

export class Sound {
  private context: AudioContext | null = null;
  enabled = true;
  musicEnabled = true;
  private paused = false;
  private musicPaused = false;
  private unlocked = false;
  private musicGain: GainNode | null = null;
  unlock(): void {
    this.unlocked = true;
    this.sync();
  }
  pause(value: boolean, musicPaused = value): void {
    this.paused = value;
    this.musicPaused = musicPaused;
    this.sync();
  }
  private sync(): void {
    if (!this.unlocked) return;
    const music = this.musicEnabled && !this.musicPaused;
    const audible = music || (this.enabled && !this.paused);
    try {
      if (!audible && !this.context) return;
      this.context ??= new AudioContext();
      const ctx = this.context;
      if (music && !this.musicGain) {
        const samples = musicSamples(ctx.sampleRate);
        const buffer = ctx.createBuffer(2, samples[0].length, ctx.sampleRate);
        samples.forEach((data, channel) => buffer.copyToChannel(data, channel));
        const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
        this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0;
        source.connect(this.musicGain); this.musicGain.connect(ctx.destination); source.start();
      }
      if (this.musicGain) {
        const gain = this.musicGain.gain;
        gain.cancelScheduledValues(ctx.currentTime);
        gain.setTargetAtTime(music ? .55 : 0, ctx.currentTime, .12);
      }
      if (audible && ctx.state === 'suspended') void ctx.resume().catch(() => {});
      if (!audible && ctx.state === 'running') void ctx.suspend().catch(() => {});
    } catch { /* Audio remains optional on unsupported or blocked devices. */ }
  }
  play(kind: 'move' | 'error' | 'win' | 'hint' | 'undo'): void {
    if (!this.enabled || this.paused || !this.context || this.context.state !== 'running') return;
    const frequencies = { move: [440, 660], error: [170, 130], win: [523, 659, 784], hint: [760, 920], undo: [500, 350] };
    const start = this.context.currentTime;
    for (const [index, frequency] of frequencies[kind].entries()) {
      const oscillator = this.context.createOscillator(), gain = this.context.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      const time = start + index * .065;
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(.035, time + .01);
      gain.gain.exponentialRampToValueAtTime(.001, time + .12);
      oscillator.connect(gain); gain.connect(this.context.destination);
      oscillator.start(time); oscillator.stop(time + .13);
    }
  }
}
