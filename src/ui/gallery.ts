import { localizedFact } from '../i18n/facts';
import { t as tr, initializeLocalLocale, setLanguagePreference } from '../i18n';
import '../style.css';
import './gallery.css';
import { freshProfile } from '../core/profile';
import { facts, TOPIC_LABELS } from '../data/facts';
import { levels } from '../data/levels';
import { TOPICS, type Topic } from '../core/types';
import { victoryContent, escape } from './render';
import { icon } from './icons';
import { currentTheme, toggleTheme } from './theme';
import { topicPaletteAttributes } from './topic-palettes';
import { toggleFactReading } from './fact-reading';
import { decode, SAVE_KEY } from '../platform/save';

initializeLocalLocale();
try { setLanguagePreference(decode(localStorage.getItem(SAVE_KEY))?.settings.language ?? 'auto'); } catch { /* private mode */ }
const app = document.querySelector<HTMLDivElement>('#gallery-app')!;
let topic: Topic | 'all' = 'all';
let galleryLimit = 48;
const favorites = new Set<string>();
const expandedFacts = new Set<string>();
function draw(): void {
  const visible = facts.map(localizedFact).filter(f => topic === 'all' || f.topic === topic);
  const shown = visible.slice(0, galleryLimit);
  app.innerHTML = `<main class="gallery-page"><header class="gallery-head"><div><p class="dialog-eyebrow">${tr("Проверка оформления")}</p><h1>${tr("Все карточки победы")}</h1><p>${tr("Карточек в каталоге:")} ${facts.length}. ${tr("Здесь действия не меняют игровой прогресс.")}</p></div><div class="gallery-actions"><button class="secondary" data-gallery="theme">${icon('art')}${tr("Тема:")} ${currentTheme() === 'dark' ? tr('тёмная') : tr('светлая')}</button><a class="secondary" href="./">${icon('next')}${tr("В игру")}</a></div></header><div class="gallery-controls"><div class="gallery-filters">${(['all', ...TOPICS] as const).map(t => `<button class="secondary ${t === topic ? 'active' : ''}" data-filter="${t}" ${t === 'all' ? '' : topicPaletteAttributes(t)} aria-pressed="${t === topic}">${t === 'all' ? icon('book') : icon(t)}${t === 'all' ? tr('Все темы') : tr(TOPIC_LABELS[t])}</button>`).join('')}</div><p role="status">${tr("Показано карточек:")} ${shown.length} ${tr('из')} ${visible.length}</p></div><div class="gallery-grid">${shown.map((fact, index) => {
    const level = levels[index % levels.length];
    const p = freshProfile(); p.unlocked = [fact.id]; p.favorites = favorites.has(fact.id) ? [fact.id] : [];
    p.levelRewards[level.id] = fact.id; p.best[level.id] = { stars: index % 3 + 1, hints: 0, timeMs: 0 };
    return `<section class="victory-dialog gallery-card" data-card="${fact.id}" aria-label="${escape(fact.title)}"><div class="dialog-content">${victoryContent(p, level, expandedFacts.has(fact.id))}</div></section>`;
  }).join('')}</div>${shown.length < visible.length ? `<div class="gallery-more"><button class="secondary" data-gallery="more">${icon('next')}${tr('Показать ещё')}</button></div>` : ''}</main>`;
}
app.addEventListener('click', event => {
  const target = (event.target as Element).closest<HTMLElement>('button'); if (!target) return;
  if (target.dataset.explain) {
    const id = target.dataset.explain;
    toggleFactReading(target) ? expandedFacts.add(id) : expandedFacts.delete(id);
    return;
  }
  if (target.dataset.gallery === 'theme') { toggleTheme(); draw(); }
  if (target.dataset.filter) { topic = target.dataset.filter as typeof topic; galleryLimit = 48; draw(); }
  if (target.dataset.gallery === 'more') { const scroll = window.scrollY; galleryLimit += 48; draw(); window.scrollTo(0, scroll); }
  if (target.dataset.favorite) {
    const id = target.dataset.favorite;
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    target.classList.toggle('selected', favorites.has(id));
    target.setAttribute('aria-pressed', String(favorites.has(id)));
    target.setAttribute('aria-label', favorites.has(id) ? tr('Убрать из избранного') : tr('В избранное'));
  }
  if (target.dataset.action === 'next') {
    const card = target.closest('.gallery-card');
    (card?.nextElementSibling ?? document.querySelector('.gallery-head'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (target.dataset.action === 'pause') document.querySelector('.gallery-head')?.scrollIntoView({ behavior: 'smooth' });
});
draw();
