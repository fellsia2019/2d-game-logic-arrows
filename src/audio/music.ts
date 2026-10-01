// Original, gently looping C-major / A-minor instrumental. No external recordings.
export function musicSamples(sampleRate: number): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const beat = 60 / 78, duration = 32 * beat, size = Math.round(duration * sampleRate);
  const channels: [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] = [new Float32Array(size), new Float32Array(size)];
  const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
  const note = (midi: number, start: number, length: number, volume: number, pan: number, pad = false) => {
    const hz = frequency(midi), count = Math.ceil(length * sampleRate);
    const offset = Math.round(start * sampleRate);
    for (let i = 0; i < count; i++) {
      const t = i / sampleRate, progress = t / length;
      const envelope = pad ? Math.sin(Math.PI * progress) ** 2 : Math.min(t / .045, 1) * Math.exp(-3.5 * progress) * Math.min((length - t) / .3, 1);
      const tone = Math.sin(2 * Math.PI * hz * t) + .14 * Math.sin(4 * Math.PI * hz * t);
      const value = tone * envelope * volume, index = (offset + i) % size;
      channels[0][index] += value * (1 - pan * .3);
      channels[1][index] += value * (1 + pan * .3);
    }
  };
  const chords = [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]];
  for (let bar = 0; bar < 8; bar++) {
    const chord = chords[bar % 4];
    chord.forEach((pitch, i) => note(pitch, bar * 4 * beat, 5 * beat, .019, (i - 1) * .6, true));
  }
  const melody = [72, 76, 79, 76, 69, 72, 76, 72, 69, 72, 77, 72, 71, 74, 79, 74];
  melody.forEach((pitch, i) => note(pitch, i * 2 * beat, 2.8 * beat, .032, i % 2 ? .4 : -.4));
  return channels;
}
