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
import { toggleFactExplanation } from './accordion';

const app = document.querySelector<HTMLDivElement>('#gallery-app')!;
let topic: Topic | 'all' = 'all';
const favorites = new Set<string>();
const expandedFacts = new Set<string>();
function draw(): void {
  const visible = facts.filter(f => topic === 'all' || f.topic === topic);
  app.innerHTML = `<main class="gallery-page"><header class="gallery-head"><div><p class="dialog-eyebrow">Проверка оформления</p><h1>Все карточки победы</h1><p>Все ${facts.length} фактов. Здесь действия не меняют игровой прогресс.</p></div><div class="gallery-actions"><button class="secondary" data-gallery="theme">${icon('art')}Тема: ${currentTheme() === 'dark' ? 'тёмная' : 'светлая'}</button><a class="secondary" href="./">${icon('next')}В игру</a></div></header><div class="gallery-controls"><div class="gallery-filters">${(['all', ...TOPICS] as const).map(t => `<button class="secondary ${t === topic ? 'active' : ''}" data-filter="${t}" ${t === 'all' ? '' : topicPaletteAttributes(t)} aria-pressed="${t === topic}">${t === 'all' ? icon('book') : icon(t)}${t === 'all' ? 'Все темы' : TOPIC_LABELS[t]}</button>`).join('')}</div><p role="status">Показано карточек: ${visible.length}</p></div><div class="gallery-grid">${visible.map((fact, index) => {
    const level = levels[index % levels.length];
    const p = freshProfile(); p.unlocked = [fact.id]; p.favorites = favorites.has(fact.id) ? [fact.id] : [];
    p.levelRewards[level.id] = fact.id; p.best[level.id] = { stars: index % 3 + 1, hints: 0, timeMs: 0 };
    return `<section class="victory-dialog gallery-card" data-card="${fact.id}" aria-label="${escape(fact.title)}"><div class="dialog-content">${victoryContent(p, level, expandedFacts.has(fact.id))}</div></section>`;
  }).join('')}</div></main>`;
}
app.addEventListener('click', event => {
  const target = (event.target as Element).closest<HTMLElement>('button'); if (!target) return;
  if (target.dataset.explain) {
    const id = target.dataset.explain;
    toggleFactExplanation(target) ? expandedFacts.add(id) : expandedFacts.delete(id);
    return;
  }
  if (target.dataset.gallery === 'theme') { toggleTheme(); draw(); }
  if (target.dataset.filter) { topic = target.dataset.filter as typeof topic; draw(); }
  if (target.dataset.favorite) {
    const id = target.dataset.favorite;
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    target.classList.toggle('selected', favorites.has(id));
    target.setAttribute('aria-pressed', String(favorites.has(id)));
    target.setAttribute('aria-label', favorites.has(id) ? 'Убрать из избранного' : 'В избранное');
  }
  if (target.dataset.action === 'next') {
    const card = target.closest('.gallery-card');
    (card?.nextElementSibling ?? document.querySelector('.gallery-head'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (target.dataset.action === 'pause') document.querySelector('.gallery-head')?.scrollIntoView({ behavior: 'smooth' });
});
draw();
