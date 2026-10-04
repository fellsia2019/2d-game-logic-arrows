import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoAdsPurchases, NO_ADS_PRODUCT_ID, type Payments, type Product, type Purchase } from '../src/platform/purchases';
import { YandexAdapter, type Sdk } from '../src/platform/yandex';
import { render, type View } from '../src/ui/render';
import { freshProfile } from '../src/core/profile';
import { newAttempt } from '../src/core/rules';
import { levels } from '../src/data/levels';
import { setLocale } from '../src/i18n';

const receipt: Purchase = { productID: NO_ADS_PRODUCT_ID, purchaseToken: 'permanent-purchase' };
const product: Product = { id: NO_ADS_PRODUCT_ID, price: '49 ЯН', priceValue: '49', priceCurrencyCode: 'YAN',
  getPriceCurrencyImage: () => 'https://example.com/currency.svg' };
function paymentsMock() {
  return { getCatalog: vi.fn(async () => [product]), getPurchases: vi.fn(async (): Promise<Purchase[]> => []),
    purchase: vi.fn(async () => receipt), consumePurchase: vi.fn() };
}
function platform(payments: Payments) {
  return { environment: { i18n: { lang: 'ru' } }, features: {}, on: vi.fn(),
    getPayments: vi.fn(async () => payments),
    adv: { showFullscreenAdv: vi.fn<Sdk['adv']['showFullscreenAdv']>(),
      showRewardedVideo: vi.fn<Sdk['adv']['showRewardedVideo']>() } } satisfies Sdk;
}
function view(): View {
  const profile = freshProfile(); profile.attempt = newAttempt(levels[1]); profile.hints = 0;
  return { profile, level: levels[1], modal: 'settings', status: '', hint: null, error: null, blocker: null,
    busy: false, externalPause: false, saveStatus: '', sdk: true, collectionTopic: 'all', query: '',
    favoritesOnly: false, detailOpen: false, intro: null };
}
afterEach(() => { vi.useRealTimers(); setLocale('ru'); });

describe('permanent no-ads purchase', () => {
  it('loads the catalog and verifies ownership before permitting an interstitial', async () => {
    const payments = paymentsMock(), purchases = new NoAdsPurchases(async () => payments);
    expect(purchases.canShowInterstitial).toBe(false);
    await purchases.refresh();
    expect(purchases.view.status).toBe('ready'); expect(purchases.view.product?.price).toBe('49 ЯН');
    expect(purchases.canShowInterstitial).toBe(true);
  });
  it('restores a permanent purchase on every new launch without consuming it', async () => {
    const payments = paymentsMock(); payments.getPurchases.mockResolvedValue([receipt]);
    for (let launch = 0; launch < 2; launch++) {
      const purchases = new NoAdsPurchases(async () => payments); await purchases.refresh();
      expect(purchases.view.status).toBe('owned'); expect(purchases.canShowInterstitial).toBe(false);
    }
    expect(payments.getPurchases).toHaveBeenCalledTimes(2); expect(payments.consumePurchase).not.toHaveBeenCalled();
  });
  it('restores ownership even when the catalog fails or the product has been removed', async () => {
    const payments = paymentsMock(); payments.getPurchases.mockResolvedValue([receipt]);
    payments.getCatalog.mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce([]);
    const purchases = new NoAdsPurchases(async () => payments);
    await purchases.refresh(); expect(purchases.view.status).toBe('owned');
    await purchases.refresh(); expect(purchases.view.status).toBe('owned');
    expect(purchases.canShowInterstitial).toBe(false);
  });
  it('activates only a confirmed matching purchase and never consumes the token', async () => {
    const payments = paymentsMock(), purchases = new NoAdsPurchases(async () => payments);
    await purchases.refresh(); expect(await purchases.buy()).toBe(true);
    expect(payments.purchase).toHaveBeenCalledWith({ id: 'disable_ads' });
    expect(purchases.canShowInterstitial).toBe(false); expect(purchases.view.status).toBe('owned');
    expect(await purchases.buy()).toBe(true); expect(payments.purchase).toHaveBeenCalledTimes(1);
    expect(payments.consumePurchase).not.toHaveBeenCalled();
  });
  it('prevents duplicate purchases and refreshes while the payment window is open', async () => {
    const payments = paymentsMock(); let resolve!: (receipt: Purchase) => void;
    payments.purchase.mockImplementation(() => new Promise(r => { resolve = r; }));
    const purchases = new NoAdsPurchases(async () => payments); await purchases.refresh();
    const pending = purchases.buy(); expect(purchases.view.status).toBe('purchasing');
    expect(await purchases.buy()).toBe(false); await purchases.refresh();
    expect(payments.getPurchases).toHaveBeenCalledTimes(1); expect(payments.purchase).toHaveBeenCalledTimes(1);
    resolve(receipt); expect(await pending).toBe(true);
  });
  it('cancels without granting ownership and lets the player retry', async () => {
    const payments = paymentsMock(); payments.purchase.mockRejectedValueOnce(Error('cancelled'));
    const purchases = new NoAdsPurchases(async () => payments); await purchases.refresh();
    expect(await purchases.buy()).toBe(false); expect(purchases.view.status).toBe('ready');
    expect(purchases.view.message).toContain('не завершена'); expect(purchases.canShowInterstitial).toBe(true);
    expect(await purchases.buy()).toBe(true);
  });
  it('recovers a payment that succeeded even though its purchase response was lost', async () => {
    const payments = paymentsMock(); payments.purchase.mockRejectedValueOnce(Error('connection lost'));
    const purchases = new NoAdsPurchases(async () => payments); await purchases.refresh();
    payments.getPurchases.mockResolvedValue([receipt]);
    expect(await purchases.buy()).toBe(true); expect(purchases.view.status).toBe('owned');
    expect(payments.purchase).toHaveBeenCalledTimes(1);
  });
  it('rejects receipts for another product and malformed or signed purchase lists', async () => {
    const payments = paymentsMock(); payments.purchase.mockResolvedValue({ ...receipt, productID: 'hints_10' });
    const purchases = new NoAdsPurchases(async () => payments); await purchases.refresh();
    expect(await purchases.buy()).toBe(false); expect(purchases.view.status).toBe('ready');
    payments.getPurchases.mockResolvedValue([{ ...receipt, purchaseToken: '' }]);
    await purchases.refresh(); expect(purchases.view.status).toBe('ready');
    payments.getPurchases.mockResolvedValue({ signature: 'opaque' } as unknown as Purchase[]);
    await purchases.refresh(); expect(purchases.view.status).toBe('error');
    expect(purchases.canShowInterstitial).toBe(false);
  });
  it('keeps ads blocked and buying unavailable after an ownership lookup error', async () => {
    const payments = paymentsMock(); payments.getPurchases.mockRejectedValueOnce(Error('offline'));
    const purchases = new NoAdsPurchases(async () => payments); await purchases.refresh();
    expect(purchases.view.status).toBe('error'); expect(purchases.canShowInterstitial).toBe(false);
    expect(await purchases.buy()).toBe(false); expect(payments.purchase).not.toHaveBeenCalled();
    await purchases.refresh(); expect(purchases.view.status).toBe('ready');
  });
  it('preserves known ownership across temporary payment initialization failures', async () => {
    const payments = paymentsMock(); payments.getPurchases.mockResolvedValue([receipt]);
    const provider = vi.fn(async () => payments), purchases = new NoAdsPurchases(provider);
    await purchases.refresh(); provider.mockRejectedValue(Error('offline'));
    await purchases.refresh(); expect(purchases.view.status).toBe('owned');
    expect(purchases.canShowInterstitial).toBe(false);
  });
  it('does not offer a purchase whose ID or price is missing from the catalog', async () => {
    const payments = paymentsMock(), purchases = new NoAdsPurchases(async () => payments);
    payments.getCatalog.mockResolvedValueOnce([]).mockResolvedValueOnce([{ ...product, price: '' }]);
    await purchases.refresh(); expect(purchases.view.status).toBe('unavailable');
    await purchases.refresh(); expect(await purchases.buy()).toBe(false);
    expect(payments.purchase).not.toHaveBeenCalled();
  });
  it('bounds hanging checks, shares an in-flight refresh, and ignores late ownership results', async () => {
    vi.useFakeTimers(); const payments = paymentsMock(); let resolve!: (list: Purchase[]) => void;
    payments.getPurchases.mockImplementation(() => new Promise(r => { resolve = r; }));
    const purchases = new NoAdsPurchases(async () => payments), pending = purchases.refresh();
    expect(purchases.refresh()).toBe(pending);
    await vi.advanceTimersByTimeAsync(8000); await pending;
    expect(purchases.view.status).toBe('error'); expect(purchases.canShowInterstitial).toBe(false);
    resolve([receipt]); await Promise.resolve(); expect(purchases.view.status).toBe('error');
  });
  it('bounds a hanging payments provider without leaving a loading state', async () => {
    vi.useFakeTimers(); const purchases = new NoAdsPurchases(() => new Promise(() => {}));
    const pending = purchases.refresh(); await vi.advanceTimersByTimeAsync(8000); await pending;
    expect(purchases.view.status).toBe('error'); expect(purchases.canShowInterstitial).toBe(false);
  });
});

describe('payments and platform lifecycle', () => {
  it('does not delay SDK readiness, and suppresses interstitial calls during restoration and after purchase', async () => {
    const payments = paymentsMock(), sdk = platform(payments);
    const adapter = new YandexAdapter(() => {}, async () => sdk);
    expect(await adapter.initialize()).toBe(true); expect(sdk.getPayments).toHaveBeenCalledWith({ signed: false });
    expect(await adapter.interstitial()).toBe(false); expect(sdk.adv.showFullscreenAdv).not.toHaveBeenCalled();
    await adapter.purchases.refresh(); expect(adapter.interstitialAvailable).toBe(true);
    expect(await adapter.buyNoAds()).toBe(true);
    expect(await adapter.interstitial()).toBe(false); expect(sdk.adv.showFullscreenAdv).not.toHaveBeenCalled();
  });
  it('pauses payment audio and serializes payments with ads while keeping rewarded bonuses after buying', async () => {
    const payments = paymentsMock(), sdk = platform(payments), pause = vi.fn();
    let resolve!: (value: Purchase) => void;
    payments.purchase.mockImplementation(() => new Promise(r => { resolve = r; }));
    const adapter = new YandexAdapter(pause, async () => sdk); await adapter.initialize(); await adapter.purchases.refresh();
    const pending = adapter.buyNoAds(); expect(pause).toHaveBeenLastCalledWith(true, 'purchase');
    expect(await adapter.buyNoAds()).toBe(false); expect(await adapter.rewarded(() => {})).toBe(false);
    expect(await adapter.interstitial()).toBe(false);
    resolve(receipt); expect(await pending).toBe(true); expect(pause).toHaveBeenLastCalledWith(false, 'purchase');
    const grant = vi.fn(), rewarded = adapter.rewarded(grant);
    const options = sdk.adv.showRewardedVideo.mock.calls[0][0] as Parameters<Sdk['adv']['showRewardedVideo']>[0];
    options.callbacks.onRewarded(); options.callbacks.onClose(); expect(await rewarded).toBe(true);
    expect(grant).toHaveBeenCalledTimes(1);
  });
});

describe('purchase presentation', () => {
  it('shows SDK price and currency, explains optional bonuses, and escapes catalog content', async () => {
    const payments = paymentsMock(), purchases = new NoAdsPurchases(async () => payments); await purchases.refresh();
    const html = render({ ...view(), noAds: purchases.view });
    expect(html).toContain('data-action="buy-no-ads"'); expect(html).toContain('49 ЯН');
    expect(html).toContain('https://example.com/currency.svg'); expect(html).toContain('alt="YAN"');
    expect(html).toContain('Добровольные просмотры'); expect(html).toContain('Восстановить покупки');
    expect(render({ ...view(), noAds: { ...purchases.view, product: { ...purchases.view.product!, price: '<script>', currencyImage: '' } } })).toContain('&lt;script&gt;');
  });
  it('hides buying in local mode, after ownership, and when purchases are unavailable', () => {
    expect(render(view())).not.toContain('buy-no-ads');
    const owned = { status: 'owned' as const, product: null, message: '' };
    const html = render({ ...view(), noAds: owned });
    expect(html).toContain('Реклама между уровнями отключена'); expect(html).not.toContain('buy-no-ads');
    expect(html).not.toContain('restore-purchases');
    expect(render({ ...view(), noAds: { ...owned, status: 'error' } })).not.toContain('buy-no-ads');
    expect(render({ ...view(), modal: 'pause', noAds: owned })).toContain('Без рекламы между уровнями');
  });
  it('keeps rewarded offers available for owners', () => {
    const v = view(); v.level = levels.find(l => !l.teaching)!; v.profile.attempt = newAttempt(v.level);
    const noAds = { status: 'owned' as const, product: null, message: '' };
    expect(render({ ...v, modal: 'hint-offer', noAds })).toContain('data-action="ad-hint"');
    v.profile.attempt.phase = 'lost'; v.profile.attempt.mistakesUsed = 3;
    expect(render({ ...v, modal: null, noAds })).toContain('data-action="ad-continue"');
  });
  it('translates purchase offers and every payment status when switching languages', () => {
    setLocale('en');
    const messages = ['Покупка активна. Рекламы между уровнями больше нет.',
      'Не удалось проверить покупки. Попробуй восстановить их ещё раз.', 'Покупка сейчас недоступна. Попробуй позже.',
      'Заверши покупку в окне Яндекса.', 'Покупка не завершена. Можно попробовать снова.'];
    const noAds = { status: 'ready' as const, product: { price: '49 USD', value: '49', currency: 'USD', currencyImage: '' }, message: '' };
    const html = render({ ...view(), noAds });
    expect(html).toContain('No ads between levels'); expect(html).toContain('Buy'); expect(html).toContain('Restore purchases');
    for (const status of ['unavailable', 'loading', 'ready', 'purchasing', 'owned', 'error'] as const) {
      for (const message of messages) {
        const translated = render({ ...view(), noAds: { ...noAds, status, message } });
        expect(translated.replace(/<option value="ru" lang="ru"[^>]*>Русский<\/option>/g, '')).not.toMatch(/[А-Яа-яЁё]/);
      }
    }
    expect(render({ ...view(), modal: 'pause', noAds })).toContain('Remove ads');
  });
});
