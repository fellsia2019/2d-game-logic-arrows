export const NO_ADS_PRODUCT_ID = 'disable_ads';
const REQUEST_TIMEOUT_MS = 8000;

export interface Purchase { productID: string; purchaseToken: string; }
export interface Product {
  id: string; price: string; priceValue: string; priceCurrencyCode: string;
  getPriceCurrencyImage(size: 'small' | 'medium' | 'svg'): string;
}
export interface Payments {
  getCatalog(): Promise<Product[]>;
  getPurchases(): Promise<Purchase[]>;
  purchase(options: { id: string }): Promise<Purchase>;
}
export interface NoAdsView {
  status: 'unavailable' | 'loading' | 'ready' | 'purchasing' | 'owned' | 'error';
  product: { price: string; value: string; currency: string; currencyImage: string } | null;
  message: string;
}

async function bounded<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([request, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Payments request timeout')), REQUEST_TIMEOUT_MS);
    })]);
  } finally { clearTimeout(timer); }
}
const isNoAds = (purchase: Purchase): boolean => purchase?.productID === NO_ADS_PRODUCT_ID &&
  typeof purchase.purchaseToken === 'string' && purchase.purchaseToken.length > 0;

// Permanent purchases stay in Yandex's list: never consume them or trust a local profile flag.
export class NoAdsPurchases {
  private payments: Payments | null = null;
  private refreshRequest: Promise<void> | null = null;
  private checked = false;
  private owned = false;
  private state: NoAdsView = { status: 'unavailable', product: null, message: '' };
  constructor(private provider: () => Promise<Payments>, private changed: () => void = () => {}) {}
  get view(): NoAdsView { return this.state; }
  get canShowInterstitial(): boolean { return this.checked && !this.owned; }
  private update(next: Partial<NoAdsView>): void {
    this.state = { ...this.state, ...next }; this.changed();
  }
  refresh(): Promise<void> {
    if (this.state.status === 'purchasing') return Promise.resolve();
    if (this.refreshRequest) return this.refreshRequest;
    this.refreshRequest = this.load().finally(() => { this.refreshRequest = null; });
    return this.refreshRequest;
  }
  private async load(): Promise<void> {
    this.checked = false;
    this.update({ status: this.owned ? 'owned' : 'loading', message: '' });
    try {
      this.payments = await bounded(this.provider());
      const [purchases, catalog] = await Promise.allSettled([
        bounded(this.payments.getPurchases()), bounded(this.payments.getCatalog()),
      ]);
      if (purchases.status === 'fulfilled' && Array.isArray(purchases.value)) {
        this.owned = purchases.value.some(isNoAds); this.checked = true;
      }
      let product: NoAdsView['product'] = null;
      if (catalog.status === 'fulfilled' && Array.isArray(catalog.value)) {
        const item = catalog.value.find(p => p.id === NO_ADS_PRODUCT_ID);
        if (item && typeof item.price === 'string' && item.price.trim() &&
          typeof item.priceValue === 'string' && item.priceValue.trim() &&
          typeof item.priceCurrencyCode === 'string' && item.priceCurrencyCode.trim()) {
          let currencyImage = '';
          try {
            const url = new URL(item.getPriceCurrencyImage('small'));
            if (url.protocol === 'https:') currencyImage = url.href;
          } catch { /* A textual SDK price is still usable without its currency image. */ }
          product = { price: item.price, value: item.priceValue, currency: item.priceCurrencyCode, currencyImage };
        }
      }
      if (this.owned) this.update({ status: 'owned', product, message: 'Покупка активна. Рекламы между уровнями больше нет.' });
      else if (!this.checked) this.update({ status: 'error', product: null,
        message: 'Не удалось проверить покупки. Попробуй восстановить их ещё раз.' });
      else if (product) this.update({ status: 'ready', product, message: '' });
      else this.update({ status: 'unavailable', product: null, message: 'Покупка сейчас недоступна. Попробуй позже.' });
    } catch {
      this.update({ status: this.owned ? 'owned' : 'error',
        message: this.owned ? 'Покупка активна. Рекламы между уровнями больше нет.' : 'Не удалось проверить покупки. Попробуй восстановить их ещё раз.' });
    }
  }
  async buy(): Promise<boolean> {
    if (this.owned) return true;
    if (this.state.status !== 'ready' || !this.payments || this.refreshRequest) return false;
    this.update({ status: 'purchasing', message: 'Заверши покупку в окне Яндекса.' });
    try {
      // Do not time out the payment window: only the SDK may finish or cancel it.
      const purchase = await this.payments.purchase({ id: NO_ADS_PRODUCT_ID });
      if (!isNoAds(purchase)) throw new Error('Unexpected purchase');
      this.owned = true; this.checked = true;
      this.update({ status: 'owned', message: 'Покупка активна. Рекламы между уровнями больше нет.' });
      return true;
    } catch {
      // A lost response may follow a successful payment. Reconcile before offering another purchase.
      this.update({ status: 'loading' });
      await this.refresh();
      if (!this.owned && this.state.status === 'ready') {
        this.update({ message: 'Покупка не завершена. Можно попробовать снова.' });
      }
      return this.owned;
    }
  }
}
