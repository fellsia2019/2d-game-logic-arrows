import { afterEach, describe, expect, it, vi } from 'vitest';
import { freshProfile } from '../src/core/profile';
import { newAttempt, move } from '../src/core/rules';
import { levels } from '../src/data/levels';
import { CLOUD_KEY, CLOUD_META_KEY, CloudProgress, type CloudPlayer } from '../src/platform/cloud';
import type { StorageLike } from '../src/platform/save';

class Memory implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}
function setup(data: Record<string, unknown> = {}, memory = new Memory(), owner = 'player-a') {
  const player: CloudPlayer = { getUniqueID: () => owner, getData: vi.fn(async () => data), setData: vi.fn(async () => {}) };
  const cloud = new CloudProgress(async () => player, memory);
  return { cloud, memory, player };
}
const snapshot = (profile = freshProfile(), updatedAt = 100) => ({ [CLOUD_KEY]: { version: 1, updatedAt, profile } });
afterEach(() => vi.useRealTimers());

describe('Yandex cloud progress', () => {
  it('restores a complete profile and an unfinished field before play', async () => {
    const profile = { ...freshProfile(), hints: 3, unlocked: ['venus-rotation'], favorites: ['venus-rotation'] };
    profile.attempt = move(levels[0], newAttempt(levels[0]), levels[0].solutionWitness[0]).attempt;
    profile.settings.language = 'en';
    const { cloud, player } = setup(snapshot(profile));
    expect(await cloud.load(freshProfile())).toEqual(profile);
    expect(player.getData).toHaveBeenCalledWith([CLOUD_KEY]);
    expect(cloud.status).toBe('saved'); cloud.stop();
  });
  it('imports the existing local save only on the first cloud launch', async () => {
    vi.useFakeTimers(); const local = { ...freshProfile(), hints: 2 };
    const { cloud, player } = setup();
    expect(await cloud.load(local)).toEqual(local); cloud.schedule(local);
    await vi.advanceTimersByTimeAsync(0);
    expect(player.setData).toHaveBeenCalledWith(expect.objectContaining({ [CLOUD_KEY]: expect.objectContaining({ profile: local }) }), true);
    expect(cloud.status).toBe('saved'); cloud.stop();
  });
  it('never imports the preceding account profile into a new account', async () => {
    const memory = new Memory(); memory.setItem(CLOUD_META_KEY, JSON.stringify({ owner: 'player-a', updatedAt: 1, dirty: true }));
    const { cloud } = setup({}, memory, 'player-b');
    expect(await cloud.load({ ...freshProfile(), hints: 0 })).toEqual(freshProfile()); cloud.stop();
  });
  it('honors a cloud reset instead of resurrecting a previously synced device save', async () => {
    const memory = new Memory(); memory.setItem(CLOUD_META_KEY, JSON.stringify({ owner: 'player-a', updatedAt: 1, dirty: false }));
    const { cloud } = setup({}, memory);
    expect(await cloud.load({ ...freshProfile(), hints: 0 })).toEqual(freshProfile()); cloud.stop();
  });
  it('keeps unsent offline moves if the server has not changed, regardless of device clocks', async () => {
    const memory = new Memory(); memory.setItem(CLOUD_META_KEY, JSON.stringify({ owner: 'player-a', updatedAt: 2, syncedAt: 100, dirty: true }));
    const { cloud } = setup(snapshot(), memory);
    const local = { ...freshProfile(), hints: 1 };
    expect(await cloud.load(local)).toEqual(local); cloud.stop();
  });
  it.each(['local', 'remote'] as const)('requires a choice when both copies changed and preserves a backup before choosing %s', async choice => {
    const memory = new Memory(); memory.setItem(CLOUD_META_KEY, JSON.stringify({ owner: 'player-a', updatedAt: 9999999999999, syncedAt: 20, dirty: true }));
    const { cloud, player } = setup(snapshot({ ...freshProfile(), hints: 3 }), memory);
    const local = { ...freshProfile(), hints: 1 };
    expect(await cloud.load(local)).toEqual(local); expect(cloud.status).toBe('conflict');
    cloud.schedule(local); expect(player.setData).not.toHaveBeenCalled();
    expect(memory.getItem('osvobodi-pole-cloud-conflict-v1')).toContain('"hints":3');
    expect(cloud.choose(choice).hints).toBe(choice === 'local' ? 1 : 3); cloud.stop();
  });
  it('marks offline device changes even if SDK initialization fails before a cloud read', () => {
    const memory = new Memory(); memory.setItem(CLOUD_META_KEY, JSON.stringify({ owner: 'player-a', updatedAt: 100, syncedAt: 100, dirty: false }));
    const { cloud } = setup({}, memory); cloud.schedule({ ...freshProfile(), hints: 1 });
    expect(JSON.parse(memory.getItem(CLOUD_META_KEY)!).dirty).toBe(true); cloud.stop();
  });
  it.each([null, { version: 2 }, { version: 1, updatedAt: 1, profile: { version: 1 } }])('protects malformed or future cloud data %j', async value => {
    const { cloud, player } = setup({ [CLOUD_KEY]: value });
    const local = freshProfile(); expect(await cloud.load(local)).toEqual(local);
    cloud.schedule(local); expect(cloud.status).toBe('protected'); expect(player.setData).not.toHaveBeenCalled(); cloud.stop();
  });
  it('bounds a hanging read and ignores its late result', async () => {
    vi.useFakeTimers(); let resolve!: (data: Record<string, unknown>) => void;
    const { cloud, player } = setup(); player.getData = () => new Promise(r => { resolve = r; });
    const local = freshProfile(), pending = cloud.load(local);
    await vi.advanceTimersByTimeAsync(6000); expect(await pending).toEqual(local);
    resolve(snapshot({ ...freshProfile(), hints: 0 })); await vi.advanceTimersByTimeAsync(0);
    cloud.schedule(local); expect(cloud.status).toBe('error'); expect(player.setData).not.toHaveBeenCalled(); cloud.stop();
  });
  it('never uploads a fallback if the initial server read failed', async () => {
    const { cloud, player } = setup(); player.getData = vi.fn(async () => { throw Error('offline'); });
    await cloud.load(freshProfile()); cloud.schedule(freshProfile());
    expect(player.setData).not.toHaveBeenCalled(); cloud.stop();
  });
  it('batches rapid changes and serializes cloud writes without a stale completion marking a newer save synced', async () => {
    vi.useFakeTimers(); const { cloud, player, memory } = setup();
    let finish!: () => void; player.setData = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    await cloud.load(freshProfile()); cloud.schedule({ ...freshProfile(), hints: 4 }); await vi.advanceTimersByTimeAsync(0);
    cloud.schedule({ ...freshProfile(), hints: 3 }); cloud.schedule({ ...freshProfile(), hints: 2 });
    expect(player.setData).toHaveBeenCalledTimes(1); finish(); await vi.advanceTimersByTimeAsync(0);
    expect(JSON.parse(memory.getItem(CLOUD_META_KEY)!).dirty).toBe(true);
    await vi.advanceTimersByTimeAsync(4000); expect(player.setData).toHaveBeenCalledTimes(2);
    expect(vi.mocked(player.setData).mock.calls[1][0][CLOUD_KEY]).toMatchObject({ profile: { hints: 2 } });
    finish(); await vi.advanceTimersByTimeAsync(0); expect(cloud.status).toBe('saved'); cloud.stop();
  });
  it('retries a failed save using the latest profile and reports success only after a flushed server write', async () => {
    vi.useFakeTimers(); const { cloud, player } = setup();
    vi.mocked(player.setData).mockRejectedValueOnce(Error('offline'));
    await cloud.load(freshProfile()); cloud.schedule({ ...freshProfile(), hints: 4 }); await vi.advanceTimersByTimeAsync(0);
    expect(cloud.status).toBe('error'); cloud.schedule({ ...freshProfile(), hints: 2 });
    await vi.advanceTimersByTimeAsync(15000);
    expect(vi.mocked(player.setData).mock.calls[1][0][CLOUD_KEY]).toMatchObject({ profile: { hints: 2 } });
    expect(cloud.status).toBe('saved'); cloud.stop();
  });
  it('stops pending writes when another tab or account takes over', async () => {
    vi.useFakeTimers(); const { cloud, player } = setup(); await cloud.load(freshProfile());
    cloud.schedule(freshProfile()); await vi.advanceTimersByTimeAsync(0);
    cloud.schedule({ ...freshProfile(), hints: 2 }); cloud.stop(); await vi.advanceTimersByTimeAsync(15000);
    expect(player.setData).toHaveBeenCalledTimes(1);
  });
  it('keeps an oversized save local and does not silently truncate progress', async () => {
    const { cloud, player } = setup(); await cloud.load(freshProfile());
    cloud.schedule({ ...freshProfile(), receipts: ['x'.repeat(200000)] });
    expect(cloud.status).toBe('too-large'); expect(player.setData).not.toHaveBeenCalled(); cloud.stop();
  });
  it.each(['resolve', 'reject'] as const)('keeps newer oversized progress dirty when an older in-flight save finishes with %s', async result => {
    vi.useFakeTimers(); const { cloud, player, memory } = setup();
    let finish!: () => void, fail!: (error: Error) => void;
    player.setData = vi.fn(() => new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; }));
    await cloud.load(freshProfile()); cloud.schedule(freshProfile()); await vi.advanceTimersByTimeAsync(0);
    cloud.schedule({ ...freshProfile(), receipts: ['x'.repeat(200000)] });
    if (result === 'resolve') finish(); else fail(Error('offline'));
    await vi.advanceTimersByTimeAsync(20000);
    expect(cloud.status).toBe('too-large');
    expect(JSON.parse(memory.getItem(CLOUD_META_KEY)!).dirty).toBe(true);
    expect(player.setData).toHaveBeenCalledTimes(1); cloud.stop();
  });
});
