import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sound } from '../src/audio/sound';
import { musicSamples } from '../src/audio/music';
import { freshProfile } from '../src/core/profile';
import { decode, validProfile } from '../src/platform/save';

class AudioMock {
  static instances: AudioMock[] = [];
  state = 'suspended'; currentTime = 0; sampleRate = 4000; destination = {};
  source = { connect: vi.fn(), start: vi.fn(), loop: false, buffer: null };
  constructor() { AudioMock.instances.push(this); }
  resume = vi.fn(async () => { this.state = 'running'; });
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  createBuffer() { return { copyToChannel: vi.fn() }; }
  createBufferSource() { return this.source; }
  createGain() {
    const gain = { gain: { value: 0, cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() }, connect: vi.fn() };
    return gain;
  }
}
afterEach(() => { vi.unstubAllGlobals(); AudioMock.instances = []; });
describe('background music', () => {
  it('waits for a gesture and uses one continuous loop through setting changes', () => {
    vi.stubGlobal('AudioContext', AudioMock);
    const sound = new Sound(); sound.pause(false, false);
    expect(AudioMock.instances).toHaveLength(0);
    sound.enabled = false; sound.unlock();
    const ctx = AudioMock.instances[0]; expect(ctx.source.loop).toBe(true);
    expect(ctx.source.start).toHaveBeenCalledTimes(1);
    sound.musicEnabled = false; sound.pause(false, false);
    expect(ctx.state).toBe('suspended');
    sound.musicEnabled = true; sound.pause(true, false);
    expect(ctx.state).toBe('running');
    expect(ctx.source.start).toHaveBeenCalledTimes(1);
  });
  it('suspends on external pause and resumes without recreating the loop', () => {
    vi.stubGlobal('AudioContext', AudioMock);
    const sound = new Sound(); sound.unlock(); const ctx = AudioMock.instances[0];
    sound.pause(true, true); expect(ctx.state).toBe('suspended');
    sound.pause(false, false); expect(ctx.state).toBe('running');
    expect(ctx.source.start).toHaveBeenCalledTimes(1);
  });
  it('lets effects remain enabled while music is disabled', () => {
    vi.stubGlobal('AudioContext', AudioMock);
    const sound = new Sound(); sound.musicEnabled = false; sound.unlock();
    const ctx = AudioMock.instances[0]; expect(ctx.state).toBe('running');
    expect(ctx.source.start).not.toHaveBeenCalled();
    sound.enabled = false; sound.pause(false, false); expect(ctx.state).toBe('suspended');
  });
  it('keeps the generated stereo loop finite, quiet and continuous at the seam', () => {
    const channels = musicSamples(4000);
    expect(channels[0].length).toBe(Math.round(32 * 60 / 78 * 4000));
    for (const channel of channels) {
      expect(channel.every(value => Number.isFinite(value) && Math.abs(value) < .15)).toBe(true);
      expect(channel.some(value => Math.abs(value) > .01)).toBe(true);
      expect(Math.abs(channel[0] - channel[channel.length - 1])).toBeLessThan(.035);
    }
  });
  it('accepts old saves and persists separate music and effects preferences', () => {
    const profile = freshProfile(); delete profile.settings.music;
    expect(decode(JSON.stringify(profile))).toEqual(profile);
    profile.settings.music = false; profile.settings.sound = true;
    expect(decode(JSON.stringify(profile))?.settings).toEqual(profile.settings);
    expect(validProfile({ ...profile, settings: { ...profile.settings, music: 'on' } })).toBe(false);
  });
});
