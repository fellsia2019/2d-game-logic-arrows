import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadingScreen } from '../src/ui/LoadingScreen';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout });
  vi.stubGlobal('performance', { now: () => 0 });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function markup() {
  const caption = { textContent: '' }, fill = { style: { width: '' } }, percent = { textContent: '' };
  const children: Record<string, unknown> = { '.loading-caption': caption, '.loading-fill': fill, '.loading-percent': percent };
  const element = { isConnected: true, querySelector: (selector: string) => children[selector] ?? null,
    classList: { add: vi.fn() }, remove: vi.fn() };
  vi.stubGlobal('document', { querySelector: () => element });
  return { element, caption, fill, percent };
}

describe('loading screen lifecycle', () => {
  it('starts the game once when loading markup is absent', () => {
    vi.stubGlobal('document', { querySelector: () => null });
    const loader = new LoadingScreen(), ready = vi.fn();
    loader.stage('Готовим игру…', 70);
    loader.finish(ready); loader.finish(ready);
    vi.runAllTimers();
    expect(ready).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('completes normally and remains safe after its markup is removed', () => {
    const { element, caption, fill, percent } = markup();
    const loader = new LoadingScreen(), ready = vi.fn();
    loader.stage('Подключаем платформу…', 70);
    loader.finish(ready); loader.finish(ready);
    vi.advanceTimersByTime(450);
    expect(ready).not.toHaveBeenCalled();
    expect(caption.textContent).toBe('Всё готово!');
    expect(fill.style.width).toBe('100%'); expect(percent.textContent).toBe('100%');
    vi.advanceTimersByTime(240);
    expect(ready).toHaveBeenCalledTimes(1);
    expect(element.classList.add).toHaveBeenCalledWith('is-complete');
    vi.advanceTimersByTime(220);
    expect(element.remove).toHaveBeenCalledTimes(1);
  });

  it('continues startup if the loading element is removed before readiness', () => {
    const { element } = markup();
    const loader = new LoadingScreen(), ready = vi.fn();
    element.isConnected = false;
    loader.finish(ready); vi.runAllTimers();
    expect(ready).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(element.classList.add).not.toHaveBeenCalled();
  });
});
