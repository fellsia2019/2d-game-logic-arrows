import { englishUI } from './ui.en';
export type Locale = 'ru' | 'en';
export type LanguagePreference = 'auto' | Locale;
let currentLocale: Locale = 'ru';
let automaticLocale: Locale = 'ru';
let currentPreference: LanguagePreference = 'auto';
const russianLanguages = new Set(['ru', 'be', 'kk', 'uk', 'uz']);
export const locale = (): Locale => currentLocale;
export const languagePreference = (): LanguagePreference => currentPreference;
export const portalLocale = (language: string): Locale => russianLanguages.has(language.trim().toLowerCase().split(/[-_]/)[0]) ? 'ru' : 'en';
export function t(source: string): string {
  if (currentLocale === 'ru') return source;
  const numberedTitle = /^(Повороты|Свободные пути) (\d+)$/.exec(source);
  if (numberedTitle) return `${numberedTitle[1] === 'Повороты' ? 'Rotations' : 'Clear paths'} ${numberedTitle[2]}`;
  return englishUI[source] ?? source;
}
export function setLocale(next: Locale): void {
  currentLocale = next;
  if (typeof document === 'undefined') return;
  document.documentElement.lang = next;
  document.title = t('Разгадай и узнай');
  document.querySelector('meta[name="description"]')?.setAttribute('content', next === 'en'
    ? 'Solve arrow puzzles at your own pace and discover fascinating facts.'
    : 'Разгадывай головоломки со стрелками в своём темпе и узнавай любопытные факты.');
  const loader = document.querySelector('#loading-screen');
  if (loader) {
    const kicker = loader.querySelector('.loading-kicker'); if (kicker) kicker.textContent = t('Логика + любопытство');
    const title = loader.querySelector('h1'); if (title) title.innerHTML = `${t('Разгадай')}<br><em>${t('и узнай')}</em>`;
    const caption = loader.querySelector('.loading-caption'); if (caption) caption.textContent = t('Готовим игру…');
    const noScript = loader.querySelector('noscript p'); if (noScript) noScript.textContent = t('Включи JavaScript, чтобы начать игру.');
  }
}
export function setAutomaticLocale(next: Locale): void {
  automaticLocale = next;
  if (currentPreference === 'auto') setLocale(next);
}
export function setLanguagePreference(next: LanguagePreference): void {
  currentPreference = next;
  setLocale(next === 'auto' ? automaticLocale : next);
}
export function initializeLocalLocale(): void {
  const browserLanguage = typeof navigator === 'undefined' ? 'ru' : navigator.language;
  const override = import.meta.env.DEV ? new URLSearchParams(location.search).get('lang') : null;
  setAutomaticLocale(portalLocale(override || browserLanguage));
}
