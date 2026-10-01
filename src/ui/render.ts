import type { Arrow, Fact, Level, Profile, Topic } from '../core/types';
import { TOPICS } from '../core/types';
import { TOPIC_LABELS, facts } from '../data/facts';
import { levels } from '../data/levels';
import { introPath, type IntroView } from './intro';
import { icon } from './icons';
import { topicPaletteAttributes } from './topic-palettes';
export type Modal = 'pause' | 'collection' | 'topics' | 'settings' | 'restart' | null;
export interface View {
  profile: Profile; level: Level; modal: Modal; status: string; hint: string | null;
  error: string | null; blocker: string | null; busy: boolean; externalPause: boolean;
  saveStatus: string; sdk: boolean; collectionTopic: Topic | 'all'; query: string;
  favoritesOnly: boolean; detailOpen: boolean; intro: IntroView | null;
  expandedFacts?: ReadonlySet<string>;
  animationClock?: number; hintElapsed?: number;
  storageNotice?: string | null;
  errorElapsed?: number;
  resultPending?: boolean;
}
export const escape = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const arrowSvg = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 24h28M27 13l11 11-11 11" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const stars = (count: number) => `<span class="stars" aria-label="${count} из 3 звёзд">${[1, 2, 3].map(i => `<span class="${i <= count ? 'earned' : ''}">${icon('star')}</span>`).join('')}</span>`;
const button = (action: string, label: string, cls = 'secondary', symbol?: string) => `<button class="${cls}" data-action="${action}">${symbol ? icon(symbol) : ''}<span>${label}</span></button>`;
function factCard(fact: Fact, profile: Profile, large = false, detail = false): string {
  return `<article class="fact-card ${large ? 'large' : ''}" ${topicPaletteAttributes(fact.topic)}><div class="fact-category"><span>${icon(fact.topic)}</span>${TOPIC_LABELS[fact.topic]}</div>
    <h3>${escape(fact.title)}</h3><p>${escape(fact.text)}</p>
    ${large ? `<div class="fact-explanation ${detail ? 'open' : ''}"><button class="fact-explain-trigger" data-explain="${escape(fact.id)}" id="explain-trigger-${escape(fact.id)}" aria-expanded="${detail}" aria-controls="explain-panel-${escape(fact.id)}"><span class="fact-explain-icon">${icon('hint')}</span><span>Почему это так?</span><span class="fact-explain-chevron">${icon('chevron')}</span></button><div class="fact-explain-panel" id="explain-panel-${escape(fact.id)}" role="region" aria-labelledby="explain-trigger-${escape(fact.id)}" aria-hidden="${!detail}" ${detail ? '' : 'inert'}><div class="fact-explain-inner"><p>${escape(fact.detail)}</p></div></div></div>` : ''}
    <div class="fact-foot"><small>Источник: ${escape(fact.source)}</small><button class="favorite ${profile.favorites.includes(fact.id) ? 'selected' : ''}" data-favorite="${fact.id}" aria-label="${profile.favorites.includes(fact.id) ? 'Убрать из избранного' : 'В избранное'}" aria-pressed="${profile.favorites.includes(fact.id)}">${icon('heart')}</button></div></article>`;
}
function topicButtons(profile: Profile): string {
  return TOPICS.map(t => `<button class="topic-chip ${profile.topics.includes(t) ? 'selected' : ''}" data-topic="${t}" ${topicPaletteAttributes(t)} aria-pressed="${profile.topics.includes(t)}"><span class="topic-icon">${icon(t)}</span><span class="topic-label">${TOPIC_LABELS[t]}</span><span class="topic-check">${icon('check')}</span></button>`).join('');
}
function cell(a: Arrow, v: View): string {
  const sourceLinks = v.level.links.filter(l => l.sourceId === a.id);
  const targetLinks = v.level.links.filter(l => l.targetId === a.id && v.profile.attempt!.arrows.some(t => t.id === l.sourceId));
  const source = sourceLinks.length > 0, target = targetLinks.length > 0;
  const number = source ? v.level.links.findIndex(l => l.sourceId === a.id) + 1 : target ? v.level.links.findIndex(l => l.targetId === a.id) + 1 : 0;
  const directionNames = ['вверх', 'вправо', 'вниз', 'влево'];
  const description = source ? ', поворачивает связанную стрелку по часовой стрелке' : target ? ', связанная стрелка' : '';
  return `<button class="arrow color-${(a.x + a.y * 2) % 4} ${source ? 'source' : ''} ${target ? 'target' : ''} ${v.hint === a.id ? 'hinted' : ''} ${v.error === a.id ? 'blocked' : ''} ${v.blocker === a.id ? 'obstacle' : ''}" data-arrow="${a.id}" data-x="${a.x}" data-y="${a.y}" style="--rotation:${a.dir * 90 - 90}deg;--shimmer-clock:${-((v.animationClock ?? 0) % 8000) / 1000}s;--hint-delay:${-(v.hintElapsed ?? 0) / 1000}s;--error-delay:${-(v.errorElapsed ?? 0) / 1000}s" aria-label="Стрелка ${directionNames[a.dir]}, строка ${a.y + 1}, столбец ${a.x + 1}${description}" ${v.busy || v.intro || v.externalPause || v.profile.attempt!.phase !== 'playing' ? 'disabled' : ''}>
    <span class="arrow-icon">${arrowSvg}</span>${number ? `<span class="link-badge">${number}${source ? icon('restart') : ''}</span>` : ''}${target ? `<span class="forecast" style="--rotation:${((a.dir + 1) % 4) * 90 - 90}deg">${arrowSvg}</span>` : ''}</button>`;
}
function board(v: View): string {
  const arrows = v.profile.attempt!.arrows;
  const connections = v.level.links.map((link, i) => {
    const a = arrows.find(t => t.id === link.sourceId), b = arrows.find(t => t.id === link.targetId);
    if (!a || !b) return '';
    const x1 = (a.x + .5) * 100, y1 = (a.y + .5) * 100, x2 = (b.x + .5) * 100, y2 = (b.y + .5) * 100;
    return `<path d="M${x1} ${y1} Q${x1} ${y2} ${x2} ${y2}" class="connection"/><text x="${(x1 + x2) / 2}" y="${y2 - 8}" class="connection-number">${i + 1}</text>`;
  }).join('');
  const path = v.intro ? introPath(v.level, v.intro.arrow) : [];
  const cells = Array.from({ length: v.level.width * v.level.height }, (_, index) => {
    const a = arrows.find(t => t.x === index % v.level.width && t.y === Math.floor(index / v.level.width));
    const x = index % v.level.width, y = Math.floor(index / v.level.width);
    const pathIndex = path.findIndex(c => c.x === x && c.y === y);
    const source = v.intro && v.intro.arrow.x === x && v.intro.arrow.y === y;
    return `<div class="cell ${source ? 'intro-source' : pathIndex >= 0 ? 'intro-path' : ''}" style="--path-order:${pathIndex}">${a ? cell(a, v) : '<span class="empty-cell" aria-hidden="true"></span>'}</div>`;
  }).join('');
  return `<div class="board-wrap"><div class="board" style="--size:${v.level.width}" aria-label="Игровое поле ${v.level.width} на ${v.level.height}"><svg class="connections" viewBox="0 0 ${v.level.width * 100} ${v.level.height * 100}" aria-hidden="true">${connections}</svg><div class="grid">${cells}</div>${v.intro ? introGuide(v) : ''}</div></div>`;
}
function introGuide(v: View): string {
  const { arrow, phase, elapsed } = v.intro!;
  const path = introPath(v.level, arrow), last = path[path.length - 1] ?? arrow;
  const sx = (arrow.x + .5) * 100, sy = (arrow.y + .5) * 100;
  const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][arrow.dir];
  const ex = (last.x + .5) * 100 + dx * 36, ey = (last.y + .5) * 100 + dy * 36;
  return `<div class="intro-guide phase-${phase}" role="img" aria-label="Демонстрация свободного пути стрелки" style="--finger-x:${(arrow.x + .5) / v.level.width * 100}%;--finger-y:${(arrow.y + .5) / v.level.height * 100}%;--phase-elapsed:${-elapsed}ms">
    <svg class="intro-trail" viewBox="0 0 ${v.level.width * 100} ${v.level.height * 100}" aria-hidden="true"><path d="M${sx + dx * 45} ${sy + dy * 45} L${ex} ${ey}"/><circle cx="${ex}" cy="${ey}" r="9"/></svg>
    <span class="intro-tap-ring" aria-hidden="true"></span><svg class="intro-finger" viewBox="0 0 64 76" aria-hidden="true"><path d="M22 43V10a5 5 0 0 1 10 0v23l4-3a5 5 0 0 1 8 4l3-1a5 5 0 0 1 7 5l2 1a5 5 0 0 1 5 6v9c0 11-8 18-19 18h-8c-9 0-14-5-18-11L5 43c-3-5 3-10 7-6l10 9" fill="#fff" stroke="#596ac7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </div>`;
}
export function victoryContent(p: Profile, level: Level, detailOpen = false): string {
  const fact = facts.find(f => f.id === p.levelRewards[level.id]);
  const last = level.order === levels.length;
  return `<header class="victory-header"><div class="victory-mark">${icon('check')}</div><div class="dialog-eyebrow">${last ? 'Маршрут пройден' : 'Поле освобождено'}</div><h2>${last ? 'Все пути открыты' : 'Отлично получилось!'}</h2>${stars(p.best[level.id]?.stars ?? 1)}</header><div class="reward-label">Новый факт</div>${fact ? factCard(fact, p, true, detailOpen) : ''}<div class="dialog-actions">${button(last ? 'pause' : 'next', last ? 'Главное меню' : 'Следующий уровень', 'primary', 'next')}${last ? button('replay-campaign', 'Пройти ещё раз') : button('pause', 'Меню')}</div>${last ? `<p class="dialog-note">Ты прошёл все ${levels.length} задач. Можно улучшить звёзды или заглянуть в коллекцию.</p>` : ''}`;
}
function dialogContent(v: View): string | null {
  const p = v.profile, attempt = p.attempt!;
  if (v.modal === 'collection') {
    const visible = facts.filter(f => p.unlocked.includes(f.id) && (v.collectionTopic === 'all' || f.topic === v.collectionTopic) &&
      (!v.favoritesOnly || p.favorites.includes(f.id)) && `${f.title} ${f.text} ${f.detail}`.toLocaleLowerCase('ru').includes(v.query.toLocaleLowerCase('ru')));
    return `<div class="dialog-eyebrow">Твоя коллекция</div><h2>Любопытное остаётся</h2><p class="muted">Открыто карточек: ${p.unlocked.length} из ${facts.length}. Пройдено уровней: ${p.completed.length} из ${levels.length}.</p><div class="collection-tools"><label class="search">Поиск по фактам<input id="fact-search" placeholder="Что хочется вспомнить?" value="${escape(v.query)}" autocomplete="off"></label><label class="select-label">Тема<select id="collection-topic"><option value="all">Все темы</option>${TOPICS.map(t => `<option value="${t}" ${v.collectionTopic === t ? 'selected' : ''}>${TOPIC_LABELS[t]}</option>`).join('')}</select>${icon('chevron')}</label><button class="secondary ${v.favoritesOnly ? 'active' : ''}" data-action="favorites" aria-pressed="${v.favoritesOnly}">${icon('heart')}<span>Избранное</span></button></div>
      <div class="collection-list">${visible.length ? visible.reverse().map(f => factCard(f, p, true, v.expandedFacts?.has(f.id))).join('') : `<div class="empty-collection"><span>${icon('book')}</span><h3>${p.unlocked.length ? 'Пока ничего не найдено' : 'Здесь начинается любопытство'}</h3><p>${p.unlocked.length ? 'Попробуй другую тему или измени поиск.' : 'Очисти первое поле — и твой первый факт появится здесь.'}</p></div>`}</div>`;
  }
  if (v.modal === 'topics') return `<div class="dialog-eyebrow">Награда после победы</div><h2>Что тебе интересно?</h2><p class="muted">Выбери одну или несколько тем. Следующие факты будут из них. Оставь хотя бы одну.</p><div class="topic-options">${topicButtons(p)}</div><p class="dialog-note">Уже полученные карточки сохранятся.</p><div class="topic-actions">${button('close', 'Готово', 'primary', 'check')}</div>`;
  if (v.modal === 'settings') return `<div class="dialog-eyebrow">В твоём темпе</div><h2>Настройки</h2><div class="setting"><div><strong>Звуки</strong><p>Короткие сигналы ходов и победы</p></div><button class="switch ${p.settings.sound ? 'on' : ''}" data-action="sound" role="switch" aria-checked="${p.settings.sound}" aria-label="Звуки"><span></span></button></div><div class="setting"><div><strong>Музыка</strong><p>Спокойная мелодия на фоне</p></div><button class="switch ${p.settings.music !== false ? 'on' : ''}" data-action="music" role="switch" aria-checked="${p.settings.music !== false}" aria-label="Музыка"><span></span></button></div><div class="setting"><div><strong>Меньше анимации</strong><p>Быстрая смена состояния без движения</p></div><button class="switch ${p.settings.reducedMotion ? 'on' : ''}" data-action="motion" role="switch" aria-checked="${p.settings.reducedMotion}" aria-label="Меньше анимации"><span></span></button></div><p class="dialog-note">Нет таймера. Нет спешки. Все уровни можно начать заново.</p>`;
  if (v.modal === 'restart') return `<div class="dialog-eyebrow">Начать сначала</div><h2>Повторить этот уровень?</h2><p class="muted">Поле вернётся к исходному состоянию. Ошибки восстановятся, потраченные подсказки — нет.</p><div class="dialog-actions">${button('restart-confirm', 'Да, заново', 'primary', 'restart')}${button('close', 'Продолжить')}</div>`;
  if (v.modal === 'pause') return `<div class="menu-art" aria-hidden="true" style="--menu-clock:${-((v.animationClock ?? 0) % 4800) / 1000}s"><span>${arrowSvg}</span><span>${arrowSvg}</span><span>${arrowSvg}</span><span>${arrowSvg}</span></div><h2 class="menu-title">Разгадай<br><em>и узнай</em></h2><div class="pause-actions">${button('close', p.completed.length || attempt.history.length ? 'Продолжить' : 'Играть', 'primary menu-play', 'next')}<div class="menu-links">${button('collection', 'Коллекция', 'secondary', 'book')}${button('topics', 'Темы', 'secondary', 'hint')}${button('settings', 'Настройки', 'secondary', 'settings')}</div></div>${v.saveStatus.includes('не сохраняется') || v.saveStatus.includes('другой') ? `<p class="save-warning" role="status">${escape(v.saveStatus)}</p>` : ''}`;
  if (v.resultPending) return null;
  if (attempt.phase === 'won') return victoryContent(p, v.level, v.detailOpen);
  if (attempt.phase === 'lost') return `<div class="result-symbol">${icon('restart')}</div><div class="dialog-eyebrow">Попробуем ещё раз</div><h2>Три ошибки — новый взгляд</h2><p class="muted">Путь перекрывался другими стрелками. Начни то же поле заново — без ожидания.</p><div class="pause-actions">${button('restart-confirm', 'Попробовать снова', 'primary', 'restart')}${v.sdk && !attempt.continued ? button('ad-continue', 'Посмотреть рекламу: ещё одна ошибка') : ''}${button('pause', 'Главное меню')}</div>`;
  if (attempt.phase === 'deadlock') return `<div class="result-symbol">${icon('undo')}</div><div class="dialog-eyebrow">Порядок меняет путь</div><h2>Сейчас нет свободной стрелки</h2><p class="muted">Поворот закрыл выход. Отмени один или несколько ходов и попробуй другой порядок.</p><div class="dialog-actions">${button('undo', 'Отменить ход', 'primary', 'undo')}${button('restart-confirm', 'Заново')}</div>`;
  return null;
}
export function render(v: View): string {
  const p = v.profile, attempt = p.attempt!;
  const dialog = v.storageNotice ? null : dialogContent(v);
  const hasBack = v.modal === 'collection' || v.modal === 'topics' || v.modal === 'settings';
  const dialogClass = [v.modal === 'pause' ? 'main-menu' : v.modal === 'collection' ? 'collection-dialog' : !v.modal && attempt.phase === 'won' ? 'victory-dialog' : '', hasBack ? 'has-back' : ''].filter(Boolean).join(' ');
  const dialogNavigation = hasBack ? `<nav class="dialog-nav" aria-label="Навигация по меню">${button('close', 'Назад', 'secondary dialog-back', 'back')}<button class="close-dialog icon-button" data-action="close" aria-label="Вернуться в меню">${icon('close')}</button></nav>` : v.modal && v.modal !== 'pause' ? `<button class="close-dialog icon-button" data-action="close" aria-label="Закрыть">${icon('close')}</button>` : '';
  return `<main class="game-stage ${v.intro ? `intro-active intro-${v.intro.phase}` : ''}" ${v.storageNotice ? 'inert' : ''}><section class="play-area" aria-labelledby="level-title">
    <div class="play-head"><button class="icon-button" data-action="pause" aria-label="Главное меню">${icon('menu')}</button><h1 id="level-title">Уровень ${v.level.order}</h1><div class="mistakes" aria-label="Допустимых ошибок осталось: ${3 - attempt.mistakesUsed}">${[0, 1, 2].map(i => `<span class="${i < attempt.mistakesUsed ? 'spent' : ''}" aria-hidden="true">${icon('heart')}</span>`).join('')}</div></div>
    <div class="board-frame">${board(v)}</div>
    ${v.level.order === 1 ? '<div class="game-feedback">' : ''}<p class="game-status" role="status" aria-live="polite">${escape(v.intro ? '' : v.status || (v.level.teaching && v.level.order !== 1 ? v.level.tutorial ?? '' : ''))}</p>${v.level.order === 1 ? `${button('how-play', 'Как играть', 'how-play', 'help')}</div>` : ''}
    <div class="game-tools" style="--tool-count:${v.level.links.length ? 3 : 2}">${button('hint', `Подсказка${v.level.teaching ? '' : ` · ${p.hints}`}`, 'tool hint-tool', 'hint')}${v.level.links.length ? `<button class="tool undo-tool" data-action="undo" aria-label="Отменить ход" ${v.intro || !attempt.history.length || attempt.phase === 'won' || attempt.phase === 'lost' ? 'disabled' : ''}>${icon('undo')}<span>Отменить ход</span></button>` : ''}<button class="tool restart-tool" data-action="restart">${icon('restart')}<span>Заново</span></button></div>
    ${!p.hints && !v.level.teaching && v.sdk ? `<button class="ad-hint" data-action="ad-hint">${icon('video')}<span>+1 подсказка за рекламу</span></button>` : ''}
    ${v.saveStatus.includes('не сохраняется') ? `<p class="save-warning" role="status">${escape(v.saveStatus)}</p>` : ''}
    </section></main>
    ${v.intro ? `<div class="intro-scrim" aria-hidden="true"></div><button class="intro-skip" data-action="skip-intro">Пропустить</button>` : ''}
    ${dialog ? `<dialog id="game-dialog" class="${dialogClass}" aria-labelledby="dialog-title">${dialogNavigation}<div class="dialog-content">${dialog}</div></dialog>` : ''}
    ${v.storageNotice ? `<div class="external-pause" role="status"><div class="storage-notice"><p>${escape(v.storageNotice)}</p>${button('reload', 'Обновить страницу', 'primary', 'restart')}</div></div>` : v.externalPause ? `<div class="external-pause" role="status"><span>Игра на паузе</span></div>` : ''}`;
}
