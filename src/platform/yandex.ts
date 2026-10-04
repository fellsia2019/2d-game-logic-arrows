import { portalLocale, setAutomaticLocale } from '../i18n';
import { NoAdsPurchases, type Payments } from './purchases';

export interface Sdk {
  environment: { i18n: { lang: string } };
  features: { LoadingAPI?: { ready(): void }; GameplayAPI?: { start(): void; stop(): void } };
  on(event: 'game_api_pause' | 'game_api_resume', callback: () => void): void;
  getPayments?(options: { signed: false }): Promise<Payments>;
  adv: {
    showRewardedVideo(options: { callbacks: { onOpen(): void; onRewarded(): void; onClose(): void; onError(): void } }): void;
    showFullscreenAdv(options: { callbacks: { onOpen(): void; onClose(shown: boolean): void; onError(): void } }): void;
  };
}
declare global { interface Window { YaGames?: { init(): Promise<Sdk> } } }
async function loadSdk(): Promise<Sdk> {
  if (!window.YaGames && import.meta.env.MODE === 'yandex') {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script'); script.src = '/sdk.js'; script.async = true;
      const timer = window.setTimeout(() => reject(new Error('SDK loading timeout')), 8000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); reject(new Error('SDK unavailable')); };
      document.head.append(script);
    });
  }
  if (!window.YaGames) throw new Error('Local mode');
  return window.YaGames.init();
}
export class YandexAdapter {
  private sdk: Sdk | null = null;
  private ready = false;
  private readySent = false;
  private gameplay = false;
  private gameplaySent = false;
  private busy = false;
  readonly purchases: NoAdsPurchases;
  language = 'ru';
  constructor(private pause: (paused: boolean, source: 'platform' | 'advertisement' | 'purchase') => void,
    private provider: () => Promise<Sdk> = loadSdk, purchasesChanged: () => void = () => {}) {
    this.purchases = new NoAdsPurchases(() => {
      if (!this.sdk?.getPayments) return Promise.reject(new Error('Payments unavailable'));
      return this.sdk.getPayments({ signed: false });
    }, purchasesChanged);
  }
  get available(): boolean { return !!this.sdk; }
  get purchasesSupported(): boolean { return !!this.sdk?.getPayments; }
  get interstitialAvailable(): boolean {
    return this.available && (!this.purchasesSupported || this.purchases.canShowInterstitial);
  }
  async initialize(): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      this.sdk = await Promise.race([this.provider(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('SDK initialization timeout')), 10000);
      })]); this.language = this.sdk.environment.i18n.lang; setAutomaticLocale(portalLocale(this.language));
      this.sdk.on('game_api_pause', () => this.pause(true, 'platform'));
      this.sdk.on('game_api_resume', () => this.pause(false, 'platform'));
      this.sync();
      // Purchase discovery must not hold Game Ready or a playable screen hostage to the network.
      if (this.purchasesSupported) void this.purchases.refresh();
      return true;
    } catch { return false; } finally { clearTimeout(timer); }
  }
  markReady(): void { this.ready = true; this.sync(); }
  setGameplay(active: boolean): void { this.gameplay = active; this.sync(); }
  private sync(): void {
    if (!this.sdk) return;
    if (this.ready && !this.readySent) { this.sdk.features.LoadingAPI?.ready(); this.readySent = true; }
    if (this.gameplay !== this.gameplaySent) {
      if (this.gameplay) this.sdk.features.GameplayAPI?.start(); else this.sdk.features.GameplayAPI?.stop();
      this.gameplaySent = this.gameplay;
    }
  }
  async rewarded(grant: () => void): Promise<boolean> {
    if (!this.sdk || this.busy) return false;
    this.busy = true; this.pause(true, 'advertisement');
    return new Promise(resolve => {
      let done = false, granted = false;
      const finish = () => { if (done) return; done = true; this.busy = false; this.pause(false, 'advertisement'); resolve(granted); };
      try {
        this.sdk!.adv.showRewardedVideo({ callbacks: {
          onOpen: () => { if (!done) this.pause(true, 'advertisement'); },
          onRewarded: () => { if (!done && !granted) { granted = true; grant(); } },
          onClose: finish, onError: finish,
        } });
      } catch { finish(); }
    });
  }
  async interstitial(): Promise<boolean> {
    if (!this.interstitialAvailable || this.busy) return false;
    this.busy = true; this.pause(true, 'advertisement');
    return new Promise(resolve => {
      let done = false;
      const finish = (shown: boolean) => { if (done) return; done = true; this.busy = false; this.pause(false, 'advertisement'); resolve(shown); };
      try { this.sdk!.adv.showFullscreenAdv({ callbacks: { onOpen: () => {}, onClose: finish, onError: () => finish(false) } }); }
      catch { finish(false); }
    });
  }
  async buyNoAds(): Promise<boolean> {
    if (!this.purchasesSupported || this.busy || this.purchases.view.status !== 'ready') return false;
    this.busy = true; this.pause(true, 'purchase');
    try { return await this.purchases.buy(); }
    finally { this.busy = false; this.pause(false, 'purchase'); }
  }
  async restorePurchases(): Promise<void> {
    if (!this.purchasesSupported || this.busy) return;
    this.busy = true;
    try { await this.purchases.refresh(); }
    finally { this.busy = false; }
  }
}
export class PauseReasons {
  private reasons = new Set<string>();
  set(reason: string, paused: boolean): void { if (paused) this.reasons.add(reason); else this.reasons.delete(reason); }
  get paused(): boolean { return this.reasons.size > 0; }
  has(reason: string): boolean { return this.reasons.has(reason); }
}
