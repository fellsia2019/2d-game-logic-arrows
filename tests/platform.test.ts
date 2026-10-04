import { describe, it, expect, vi } from 'vitest';
import { ProfileStorage, SAVE_KEY, BACKUP_KEY, decode, validProfile, type StorageLike } from '../src/platform/save';
import { PauseReasons, YandexAdapter, type Sdk } from '../src/platform/yandex';
import { freshProfile, finish } from '../src/core/profile';
import { newAttempt, move } from '../src/core/rules';
import { levels } from '../src/data/levels';
import { facts } from '../src/data/facts';
import { render } from '../src/ui/render';
import { interstitialDue, type AdState } from '../src/platform/ad-policy';
class Memory implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}
function completedCampaign() {
  let profile = freshProfile();
  for (const level of levels) {
    profile.attempt = newAttempt(level);
    for (const id of level.solutionWitness) profile.attempt = move(level, profile.attempt, id).attempt;
    profile = finish(profile, level, facts);
  }
  return profile;
}
describe('durable profiles', () => {
  it('restores a partly completed field and its undo history', () => {
    const memory = new Memory(), store = new ProfileStorage(memory), p = freshProfile();
    p.attempt = move(levels[0], newAttempt(levels[0]), levels[0].solutionWitness[0]).attempt;
    const saved = store.save(p); expect(new ProfileStorage(memory).load()).toEqual(saved);
  });
  it('recovers a corrupt current save from the last valid backup', () => {
    const memory = new Memory(), store = new ProfileStorage(memory);
    const a = store.save(freshProfile()); store.save({ ...a, hints: 4 }); memory.setItem(SAVE_KEY, '{broken');
    const reader = new ProfileStorage(memory); expect(reader.load()).toEqual(a); expect(reader.status).toBe('recovered');
  });
  it('starts fresh when the primary was deleted, even with a completed backup', () => {
    const memory = new Memory(), store = new ProfileStorage(memory);
    const completed = store.save(completedCampaign()); store.save(completed);
    memory.removeItem(SAVE_KEY);
    const reader = new ProfileStorage(memory);
    expect(reader.load()).toEqual(freshProfile()); expect(reader.status).toBe('saved');
  });
  it('discards the orphaned backup before saving a fresh profile', () => {
    const memory = new Memory(); memory.setItem(BACKUP_KEY, JSON.stringify(completedCampaign()));
    const reader = new ProfileStorage(memory); reader.save(reader.load());
    expect(memory.getItem(BACKUP_KEY)).toBeNull();
    memory.setItem(SAVE_KEY, '{broken');
    expect(new ProfileStorage(memory).load()).toEqual(freshProfile());
  });
  it('never rewrites an open tab profile after clearing all storage', () => {
    const memory = new Memory(), store = new ProfileStorage(memory);
    const completed = store.save(completedCampaign()); store.save(completed);
    memory.data.clear();
    expect(store.save(completed)).toBe(completed);
    expect(store.status).toBe('cleared'); expect(memory.data.size).toBe(0);
    store.save(completed); expect(memory.data.size).toBe(0);
  });
  it('does not resurrect a removed primary from an open tab or its backup', () => {
    const memory = new Memory(), store = new ProfileStorage(memory);
    const completed = store.save(completedCampaign()); store.save(completed);
    const backup = memory.getItem(BACKUP_KEY); memory.removeItem(SAVE_KEY);
    store.save(completed);
    expect(store.status).toBe('cleared'); expect(memory.getItem(SAVE_KEY)).toBeNull();
    expect(memory.getItem(BACKUP_KEY)).toBe(backup);
  });
  it('detects deletion on focus checks without relying on a storage event', () => {
    const memory = new Memory(), store = new ProfileStorage(memory); store.save(completedCampaign());
    memory.data.clear();
    expect(store.checkCurrent()).toBe(false); expect(store.status).toBe('cleared');
    expect(memory.data.size).toBe(0);
  });
  it('protects a reset profile with a lower revision from a stale completed tab', () => {
    const memory = new Memory(), staleTab = new ProfileStorage(memory);
    let completed = staleTab.save(completedCampaign()); completed = staleTab.save(completed);
    memory.data.clear();
    const freshTab = new ProfileStorage(memory), fresh = freshTab.save(freshTab.load());
    expect(fresh.revision).toBeLessThan(completed.revision);
    staleTab.save(completed);
    expect(staleTab.status).toBe('conflict'); expect(decode(memory.getItem(SAVE_KEY))).toEqual(fresh);
    expect(memory.getItem(BACKUP_KEY)).toBeNull();
  });
  it('protects another tab changes even when storage events were missed', () => {
    const memory = new Memory(), first = new ProfileStorage(memory);
    const original = first.save(freshProfile());
    const second = new ProfileStorage(memory), loaded = second.load();
    const changed = second.save({ ...loaded, hints: 4 });
    first.save({ ...original, hints: 3 });
    expect(first.status).toBe('conflict'); expect(decode(memory.getItem(SAVE_KEY))).toEqual(changed);
  });
  it('keeps the reload action reachable over a completed campaign screen', () => {
    const html = render({ profile: completedCampaign(), level: levels.at(-1)!, modal: 'pause',
      status: '', hint: null, error: null, blocker: null, busy: false, externalPause: true,
      saveStatus: 'Сохранение удалено', sdk: false, collectionTopic: 'all', query: '',
      favoritesOnly: false, detailOpen: false, intro: null, storageNotice: 'Сохранение удалено.' });
    expect(html).not.toContain('<dialog'); expect(html).toContain('data-action="reload"');
    expect(html).toContain('inert');
    expect(html).not.toContain('Все пути открыты');
  });
  it('does not overwrite future schema versions', () => {
    const memory = new Memory(); memory.setItem(SAVE_KEY, '{"version":2}');
    const reader = new ProfileStorage(memory); reader.save(reader.load()); expect(memory.getItem(SAVE_KEY)).toBe('{"version":2}');
  });
  it('survives denied storage and honestly switches to memory', () => {
    const denied: StorageLike = { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('denied'); }, removeItem: () => { throw Error('denied'); } };
    const reader = new ProfileStorage(denied); const p = reader.load(); expect(reader.save(p).hints).toBe(5); expect(reader.status).toBe('memory');
  });
  it('rejects damaged field IDs, coordinates and inconsistent rewards', () => {
    const p = freshProfile(); p.attempt = newAttempt(levels[0]);
    p.attempt.arrows[0].x = 999; expect(validProfile(p)).toBe(false);
    expect(decode(JSON.stringify({ ...freshProfile(), completed: ['level-01'] }))).toBeNull();
  });
  it('persists the completed attempt and reward together across reload', () => {
    let p = freshProfile(); p.attempt = newAttempt(levels[0]);
    for (const id of levels[0].solutionWitness) p.attempt = move(levels[0], p.attempt, id).attempt;
    p = finish(p, levels[0], facts); const memory = new Memory(); new ProfileStorage(memory).save(p);
    const restored = new ProfileStorage(memory).load(); expect(finish(restored, levels[0], facts).unlocked).toHaveLength(1);
  });
  it('migrates an old saved victory without drawing a second fact', () => {
    let p = freshProfile(); p.attempt = newAttempt(levels[0]);
    for (const id of levels[0].solutionWitness) p.attempt = move(levels[0], p.attempt, id).attempt;
    p = finish(p, levels[0], facts, () => 0);
    const legacy = { ...p }; delete legacy.lastFactReward;
    const restored = decode(JSON.stringify(legacy))!;
    expect(restored.lastFactReward?.attemptId).toBe(p.attempt?.id);
    const again = finish(restored, levels[0], facts, () => 0.999);
    expect(again.unlocked).toEqual(p.unlocked); expect(again.levelRewards).toEqual(p.levelRewards);
  });
  it('preserves old collections and selected themes while allowing the new topics', () => {
    const old = { ...freshProfile(), topics: ['space' as const], unlocked: ['venus-rotation'], favorites: ['venus-rotation'] };
    expect(decode(JSON.stringify(old))).toEqual(old);
    expect(validProfile({ ...old, topics: ['history', 'geography', 'science', 'human'] })).toBe(true);
  });
  it('rejects a last reward inconsistent with the saved collection or level result', () => {
    const p = completedCampaign();
    expect(validProfile({ ...p, lastFactReward: { ...p.lastFactReward, factId: 'missing' } })).toBe(false);
    expect(validProfile({ ...p, lastFactReward: { ...p.lastFactReward, attemptId: '' } })).toBe(false);
    expect(validProfile({ ...p, lastFactReward: { ...p.lastFactReward, isNew: 'yes' } })).toBe(false);
  });
});
function mockSdk() {
  const callbacks = { rewarded: null as null | Parameters<Sdk['adv']['showRewardedVideo']>[0]['callbacks'],
    full: null as null | Parameters<Sdk['adv']['showFullscreenAdv']>[0]['callbacks'] };
  const events: Record<string, () => void> = {};
  const sdk: Sdk = { environment: { i18n: { lang: 'ru' } }, features: {
    LoadingAPI: { ready: vi.fn() }, GameplayAPI: { start: vi.fn(), stop: vi.fn() },
  }, on: (event, fn) => { events[event] = fn; }, adv: {
    showRewardedVideo: options => { callbacks.rewarded = options.callbacks; },
    showFullscreenAdv: options => { callbacks.full = options.callbacks; },
  } };
  return { sdk, callbacks, events };
}
describe('platform lifecycle', () => {
  it('requests mobile fullscreen only from an explicit game action and tolerates denial', async () => {
    const { sdk } = mockSdk();
    sdk.deviceInfo = { type: 'mobile' };
    sdk.screen = { fullscreen: { status: 'off', request: vi.fn(async () => { throw Error('denied'); }) } };
    const adapter = new YandexAdapter(() => {}, async () => sdk); await adapter.initialize();
    expect(sdk.screen.fullscreen.request).not.toHaveBeenCalled();
    adapter.requestMobileFullscreen(); await Promise.resolve(); expect(sdk.screen.fullscreen.request).toHaveBeenCalledOnce();
    sdk.screen.fullscreen.status = 'on'; adapter.requestMobileFullscreen(); expect(sdk.screen.fullscreen.request).toHaveBeenCalledOnce();
    sdk.screen.fullscreen.status = 'off'; sdk.deviceInfo.type = 'desktop'; adapter.requestMobileFullscreen();
    expect(sdk.screen.fullscreen.request).toHaveBeenCalledOnce();
  });
  it('signals account selection so the controller can stop old-account uploads and reload', async () => {
    const { sdk, events } = mockSdk(), changed = vi.fn();
    sdk.EVENTS = { ACCOUNT_SELECTION_DIALOG_OPENED: 'account-open', ACCOUNT_SELECTION_DIALOG_CLOSED: 'account-close' };
    const adapter = new YandexAdapter(() => {}, async () => sdk, () => {}, changed); await adapter.initialize();
    events['account-open'](); events['account-close'](); expect(changed.mock.calls).toEqual([[true], [false]]);
  });
  it('bounds a hanging SDK and ignores a provider that resolves after the timeout', async () => {
    vi.useFakeTimers();
    try {
      let resolve!: (sdk: Sdk) => void;
      const adapter = new YandexAdapter(() => {}, () => new Promise(r => { resolve = r; }));
      const result = adapter.initialize(); await vi.advanceTimersByTimeAsync(10000);
      expect(await result).toBe(false); expect(adapter.available).toBe(false);
      resolve(mockSdk().sdk); await Promise.resolve();
      expect(adapter.available).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it('sends ready once even if UI is ready before SDK', async () => {
    const { sdk } = mockSdk(); const adapter = new YandexAdapter(() => {}, async () => sdk);
    adapter.markReady(); adapter.setGameplay(true); await adapter.initialize(); adapter.markReady(); adapter.setGameplay(true);
    expect(sdk.features.LoadingAPI!.ready).toHaveBeenCalledTimes(1);
    expect(sdk.features.GameplayAPI!.start).toHaveBeenCalledTimes(1);
    adapter.setGameplay(false); expect(sdk.features.GameplayAPI!.stop).toHaveBeenCalledTimes(1);
  });
  it('does not reward close and ignores duplicated and late callbacks', async () => {
    const { sdk, callbacks } = mockSdk(), pause = vi.fn(), grant = vi.fn();
    const adapter = new YandexAdapter(pause, async () => sdk); await adapter.initialize();
    const first = adapter.rewarded(grant); callbacks.rewarded!.onClose(); expect(await first).toBe(false); expect(grant).not.toHaveBeenCalled();
    callbacks.rewarded!.onRewarded(); expect(grant).not.toHaveBeenCalled();
    const second = adapter.rewarded(grant); callbacks.rewarded!.onRewarded(); callbacks.rewarded!.onRewarded(); callbacks.rewarded!.onClose();
    expect(await second).toBe(true); expect(grant).toHaveBeenCalledTimes(1); expect(pause).toHaveBeenLastCalledWith(false, 'advertisement');
  });
  it('allows only one active ad request and recovers from errors', async () => {
    const { sdk, callbacks } = mockSdk(); const adapter = new YandexAdapter(() => {}, async () => sdk); await adapter.initialize();
    const pending = adapter.interstitial(); expect(await adapter.rewarded(() => {})).toBe(false);
    callbacks.full!.onError(); expect(await pending).toBe(false);
    const next = adapter.interstitial(); callbacks.full!.onClose(true); expect(await next).toBe(true);
  });
  it('independent pause reasons cannot resume each other', () => {
    const pause = new PauseReasons(); pause.set('hidden', true); pause.set('advertisement', true);
    pause.set('advertisement', false); expect(pause.paused).toBe(true); pause.set('hidden', false); expect(pause.paused).toBe(false);
  });
});
describe('ad placements', () => {
  const ready: AdState = { available: true, victories: 5, activeMs: 180000,
    lastInterstitialAt: 0, lastAdAttemptAt: -60000, nextTeaching: false };
  it('waits for five wins and three active minutes for the first interstitial', () => {
    expect(interstitialDue({ ...ready, victories: 4 })).toBe(false);
    expect(interstitialDue({ ...ready, activeMs: 179999 })).toBe(false);
    expect(interstitialDue(ready)).toBe(true);
  });
  it('protects local mode and teaching transitions', () => {
    expect(interstitialDue({ ...ready, available: false })).toBe(false);
    expect(interstitialDue({ ...ready, nextTeaching: true })).toBe(false);
  });
  it('requires three wins and another three active minutes after a shown ad', () => {
    const later = { ...ready, lastInterstitialAt: 180000, activeMs: 360000, victories: 3 };
    expect(interstitialDue({ ...later, victories: 2 })).toBe(false);
    expect(interstitialDue({ ...later, activeMs: 359999 })).toBe(false);
    expect(interstitialDue(later)).toBe(true);
  });
  it('backs off for a minute after an unsuccessful ad request', () => {
    expect(interstitialDue({ ...ready, lastAdAttemptAt: 120001 })).toBe(false);
    expect(interstitialDue({ ...ready, lastAdAttemptAt: 120000 })).toBe(true);
  });
});
