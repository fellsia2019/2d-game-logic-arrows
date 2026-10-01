import { t } from '../i18n';
export class LoadingScreen {
  private element = document.querySelector<HTMLElement>('#loading-screen');
  private caption = this.element?.querySelector<HTMLElement>('.loading-caption');
  private fill = this.element?.querySelector<HTMLElement>('.loading-fill');
  private percent = this.element?.querySelector<HTMLElement>('.loading-percent');
  private started = performance.now();
  private frame = 0;
  private base = 20;
  private stopped = false;
  constructor() {
    const tick = () => {
      if (this.stopped || !this.element?.isConnected) return;
      // Decorative progress never claims completion until UI and SDK settle.
      this.paint(Math.min(94, this.base + (94 - this.base) * (1 - Math.exp(-(performance.now() - this.started) / 2600))));
      this.frame = requestAnimationFrame(tick);
    };
    tick();
  }
  stage(caption: string, progress: number): void {
    if (this.caption) this.caption.textContent = caption;
    this.base = progress;
  }
  private paint(progress: number): void {
    if (this.fill) this.fill.style.width = `${progress}%`;
    if (this.percent) this.percent.textContent = `${Math.floor(progress)}%`;
  }
  finish(onReady: () => void): void {
    if (this.stopped) return;
    this.stopped = true; cancelAnimationFrame(this.frame);
    const element = this.element;
    if (!element?.isConnected) { onReady(); return; }
    window.setTimeout(() => {
      this.stage(t('Всё готово!'), 100); this.paint(100);
      window.setTimeout(() => {
        element.classList.add('is-complete'); onReady();
        window.setTimeout(() => element.remove(), 220);
      }, 240);
    }, Math.max(0, 450 - (performance.now() - this.started)));
  }
}
