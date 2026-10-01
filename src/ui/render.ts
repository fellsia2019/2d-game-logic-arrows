import { localizedFact } from '../i18n/facts';
import { t as tr } from '../i18n';
import type { Arrow, Fact, Level, Profile, Topic } from '../core/types';
import { TOPICS } from '../core/types';
import { TOPIC_LABELS, facts } from '../data/facts';
import { introPath, type IntroView } from './intro';
import { icon } from './icons';
import { topicPaletteAttributes } from './topic-palettes';
export type Modal = 'pause' | 'collection' | 'topics' | 'settings' | 'restart' | 'hint-offer' | null;
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
const stars = (count: number) => `<span class="stars" aria-label="${count} ${tr("из 3 звёзд")}">${[1, 2, 3].map(i => `<span class="${i <= count ? 'earned' : ''}">${icon('star')}</span>`).join('')}</span>`;
const button = (action: string, label: string, cls = 'secondary', symbol?: string) => `<button class="${cls}" data-action="${action}">${symbol ? icon(symbol) : ''}<span>${label}</span></button>`;
function factCard(fact: Fact, profile: Profile, large = false, detail = false): string {
  fact = localizedFact(fact);
  return `<article class="fact-card ${large ? 'large' : ''}" ${topicPaletteAttributes(fact.topic)}><div class="fact-category"><span>${icon(fact.topic)}</span>${tr(TOPIC_LABELS[fact.topic])}</div>
    <h3>${escape(fact.title)}</h3><p>${escape(fact.text)}</p>
    ${large ? `<div class="fact-explanation ${detail ? 'open' : ''}"><button class="fact-explain-trigger" data-explain="${escape(fact.id)}" id="explain-trigger-${escape(fact.id)}" aria-expanded="${detail}" aria-controls="explain-panel-${escape(fact.id)}"><span class="fact-explain-icon">${icon('hint')}</span><span>${tr("Почему это так?")}</span><span class="fact-explain-chevron">${icon('chevron')}</span></button><div class="fact-explain-panel" id="explain-panel-${escape(fact.id)}" role="region" aria-labelledby="explain-trigger-${escape(fact.id)}" aria-hidden="${!detail}" ${detail ? '' : 'inert'}><div class="fact-explain-inner"><p>${escape(fact.detail)}</p></div></div></div>` : ''}
    <div class="fact-foot"><small>${tr("Источник:")} ${escape(fact.source)}</small><button class="favorite ${profile.favorites.includes(fact.id) ? 'selected' : ''}" data-favorite="${fact.id}" aria-label="${profile.favorites.includes(fact.id) ? tr('Убрать из избранного') : tr('В избранное')}" aria-pressed="${profile.favorites.includes(fact.id)}">${icon('heart')}</button></div></article>`;
}
function topicButtons(profile: Profile): string {
  return TOPICS.map(t => `<button class="topic-chip ${profile.topics.includes(t) ? 'selected' : ''}" data-topic="${t}" ${topicPaletteAttributes(t)} aria-pressed="${profile.topics.includes(t)}"><span class="topic-icon">${icon(t)}</span><span class="topic-label">${tr(TOPIC_LABELS[t])}</span><span class="topic-check">${icon('check')}</span></button>`).join('');
}
function languageChoice(profile: Profile): string {
  const selected = profile.settings.language ?? 'auto';
  return `<div class="setting language-setting"><label for="language-choice"><strong class="language-heading">${icon('geography')}${tr('Язык')}</strong></label><span class="language-description" id="language-description">${tr('Автоматический выбор по языку площадки или браузера')}</span><div class="language-select-wrap"><select id="language-choice" aria-describedby="language-description"><option value="auto" ${selected === 'auto' ? 'selected' : ''}>${tr('Автоматически')}</option><option value="ru" lang="ru" ${selected === 'ru' ? 'selected' : ''}>${tr('Русский')}</option><option value="en" lang="en" ${selected === 'en' ? 'selected' : ''}>English</option></select>${icon('chevron')}</div></div>`;
}
function cell(a: Arrow, v: View): string {
  const sourceLinks = v.level.links.filter(l => l.sourceId === a.id);
  const targetLinks = v.level.links.filter(l => l.targetId === a.id && v.profile.attempt!.arrows.some(t => t.id === l.sourceId));
  const source = sourceLinks.length > 0, target = targetLinks.length > 0;
  const number = source ? v.level.links.findIndex(l => l.sourceId === a.id) + 1 : target ? v.level.links.findIndex(l => l.targetId === a.id) + 1 : 0;
  const directionNames = [tr('вверх'), tr('вправо'), tr('вниз'), tr('влево')];
  const description = source ? tr(', поворачивает связанную стрелку по часовой стрелке') : target ? tr(', связанная стрелка') : '';
  return `<button class="arrow color-${(a.x + a.y * 2) % 4} ${source ? 'source' : ''} ${target ? 'target' : ''} ${v.hint === a.id ? 'hinted' : ''} ${v.error === a.id ? 'blocked' : ''} ${v.blocker === a.id ? 'obstacle' : ''}" data-arrow="${a.id}" data-x="${a.x}" data-y="${a.y}" style="--rotation:${a.dir * 90 - 90}deg;--shimmer-clock:${-((v.animationClock ?? 0) % 8000) / 1000}s;--hint-delay:${-(v.hintElapsed ?? 0) / 1000}s;--error-delay:${-(v.errorElapsed ?? 0) / 1000}s" aria-label="${tr("Стрелка")} ${directionNames[a.dir]}, ${tr("строка")} ${a.y + 1}, ${tr("столбец")} ${a.x + 1}${description}" ${v.busy || v.intro || v.externalPause || v.profile.attempt!.phase !== 'playing' ? 'disabled' : ''}>
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
  return `<div class="board-wrap"><div class="board" style="--size:${v.level.width}" aria-label="${tr("Игровое поле")} ${v.level.width} ${tr("на")} ${v.level.height}"><svg class="connections" viewBox="0 0 ${v.level.width * 100} ${v.level.height * 100}" aria-hidden="true">${connections}</svg><div class="grid">${cells}</div>${v.intro ? introGuide(v) : ''}</div></div>`;
}
function introGuide(v: View): string {
  const { arrow, phase, elapsed } = v.intro!;
  const path = introPath(v.level, arrow), last = path[path.length - 1] ?? arrow;
  const sx = (arrow.x + .5) * 100, sy = (arrow.y + .5) * 100;
  const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][arrow.dir];
  const ex = (last.x + .5) * 100 + dx * 36, ey = (last.y + .5) * 100 + dy * 36;
  return `<div class="intro-guide phase-${phase}" role="img" aria-label="${tr("Демонстрация свободного пути стрелки")}" style="--finger-x:${(arrow.x + .5) / v.level.width * 100}%;--finger-y:${(arrow.y + .5) / v.level.height * 100}%;--phase-elapsed:${-elapsed}ms">
    <svg class="intro-trail" viewBox="0 0 ${v.level.width * 100} ${v.level.height * 100}" aria-hidden="true"><path d="M${sx + dx * 45} ${sy + dy * 45} L${ex} ${ey}"/><circle cx="${ex}" cy="${ey}" r="9"/></svg>
    <span class="intro-tap-ring" aria-hidden="true"></span><svg class="intro-finger" viewBox="0 0 64 76" aria-hidden="true"><path d="M22 43V10a5 5 0 0 1 10 0v23l4-3a5 5 0 0 1 8 4l3-1a5 5 0 0 1 7 5l2 1a5 5 0 0 1 5 6v9c0 11-8 18-19 18h-8c-9 0-14-5-18-11L5 43c-3-5 3-10 7-6l10 9" fill="#fff" stroke="#596ac7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </div>`;
}
export function victoryContent(p: Profile, level: Level, detailOpen = false): string {
  const fact = facts.find(f => f.id === p.levelRewards[level.id]);
  return `<header class="victory-header"><div class="victory-mark">${icon('check')}</div><div class="dialog-eyebrow">${tr("Поле освобождено")}</div><h2>${tr("Отлично получилось!")}</h2>${stars(p.best[level.id]?.stars ?? 1)}</header><div class="reward-label">${p.lastFactReward?.levelId === level.id && !p.lastFactReward.isNew ? tr("Вспомним факт") : tr("Новый факт")}</div>${fact ? factCard(fact, p, true, detailOpen) : ''}<div class="dialog-actions">${button('next', tr('Следующий уровень'), 'primary', 'next')}${button('pause', tr('Меню'))}</div>`;
}
function dialogContent(v: View): string | null {
  const p = v.profile, attempt = p.attempt!;
  if (v.modal === 'collection') {
    const visible = p.unlocked.map(id => facts.find(f => f.id === id)).filter((f): f is Fact => !!f).map(localizedFact).filter(f => (v.collectionTopic === 'all' || f.topic === v.collectionTopic) &&
      (!v.favoritesOnly || p.favorites.includes(f.id)) && `${f.title} ${f.text} ${f.detail}`.toLocaleLowerCase().includes(v.query.toLocaleLowerCase()));
    return `<div class="dialog-eyebrow">${tr("Твоя коллекция")}</div><h2>${tr("Любопытное остаётся")}</h2><p class="muted">${tr("Открыто карточек:")} ${p.unlocked.length} ${tr("из")} ${facts.length}. ${tr("Пройдено уровней:")} ${p.completed.length}.</p><div class="collection-tools"><label class="search">${tr("Поиск по фактам")}<input id="fact-search" placeholder="${tr("Что хочется вспомнить?")}" value="${escape(v.query)}" autocomplete="off"></label><label class="select-label">${tr("Тема")}<select id="collection-topic"><option value="all">${tr("Все темы")}</option>${TOPICS.map(t => `<option value="${t}" ${v.collectionTopic === t ? 'selected' : ''}>${tr(TOPIC_LABELS[t])}</option>`).join('')}</select>${icon('chevron')}</label><button class="secondary ${v.favoritesOnly ? 'active' : ''}" data-action="favorites" aria-pressed="${v.favoritesOnly}">${icon('heart')}<span>${tr("Избранное")}</span></button></div>
      <div class="collection-list">${visible.length ? visible.reverse().map(f => factCard(f, p, true, v.expandedFacts?.has(f.id))).join('') : `<div class="empty-collection"><span>${icon('book')}</span><h3>${p.unlocked.length ? tr('Пока ничего не найдено') : tr('Здесь начинается любопытство')}</h3><p>${p.unlocked.length ? tr('Попробуй другую тему или измени поиск.') : tr('Очисти первое поле — и твой первый факт появится здесь.')}</p></div>`}</div>`;
  }
  if (v.modal === 'topics') return `<div class="dialog-eyebrow">${tr("Награда после победы")}</div><h2>${tr("Что тебе интересно?")}</h2><p class="muted">${tr("Выбери одну или несколько тем. Новый случайный факт после каждой победы. Оставь хотя бы одну тему.")}</p><div class="topic-options">${topicButtons(p)}</div><p class="dialog-note">${tr("В библиотеке")} ${facts.length} ${tr("фактов и")} ${TOPICS.length} ${tr("тем. Открытые карточки сохранятся.")}</p><div class="topic-actions">${button('close', tr('Готово'), 'primary', 'check')}</div>`;
  if (v.modal === 'settings') return `<div class="dialog-eyebrow">${tr("В твоём темпе")}</div><h2>${tr("Настройки")}</h2>${languageChoice(p)}<div class="setting"><div><strong>${tr("Звуки")}</strong><p>${tr("Короткие сигналы ходов и победы")}</p></div><button class="switch ${p.settings.sound ? 'on' : ''}" data-action="sound" role="switch" aria-checked="${p.settings.sound}" aria-label="${tr("Звуки")}"><span></span></button></div><div class="setting"><div><strong>${tr("Музыка")}</strong><p>${tr("Спокойная мелодия на фоне")}</p></div><button class="switch ${p.settings.music !== false ? 'on' : ''}" data-action="music" role="switch" aria-checked="${p.settings.music !== false}" aria-label="${tr("Музыка")}"><span></span></button></div><div class="setting"><div><strong>${tr("Меньше анимации")}</strong><p>${tr("Быстрая смена состояния без движения")}</p></div><button class="switch ${p.settings.reducedMotion ? 'on' : ''}" data-action="motion" role="switch" aria-checked="${p.settings.reducedMotion}" aria-label="${tr("Меньше анимации")}"><span></span></button></div><p class="dialog-note">${tr("Нет таймера. Нет спешки. Все уровни можно начать заново.")}</p>`;
  if (v.modal === 'hint-offer') return `<div class="result-symbol">${icon('hint')}</div><h2>${tr("Подсказки закончились")}</h2><p class="muted">${v.sdk ? tr('Посмотреть рекламу? За просмотр ты получишь одну подсказку.') : tr('За просмотр рекламы можно получить одну подсказку. Сейчас реклама недоступна. Попробуй позже.')}</p><div class="dialog-actions">${v.sdk ? button('ad-hint', tr('Посмотреть рекламу'), 'primary', 'video') : ''}${button('close', v.sdk ? tr('Не сейчас') : tr('Продолжить игру'))}</div>`;
  if (v.modal === 'restart') return `<div class="dialog-eyebrow">${tr("Начать сначала")}</div><h2>${tr("Повторить этот уровень?")}</h2><p class="muted">${tr("Поле вернётся к исходному состоянию. Ошибки восстановятся, потраченные подсказки — нет.")}</p><div class="dialog-actions">${button('restart-confirm', tr('Да, заново'), 'primary', 'restart')}${button('close', tr('Продолжить'))}</div>`;
  if (v.modal === 'pause') return `<div class="menu-art" aria-hidden="true" style="--menu-clock:${-((v.animationClock ?? 0) % 4800) / 1000}s"><span>${arrowSvg}</span><span>${arrowSvg}</span><span>${arrowSvg}</span><span>${arrowSvg}</span></div><h2 class="menu-title">${tr("Разгадай")}<br><em>${tr("и узнай")}</em></h2><div class="pause-actions">${button('close', p.completed.length || attempt.history.length ? tr('Продолжить') : tr('Играть'), 'primary menu-play', 'next')}<div class="menu-links">${button('collection', tr('Коллекция'), 'secondary', 'book')}${button('topics', tr('Темы'), 'secondary', 'hint')}${button('settings', tr('Настройки'), 'secondary', 'settings')}</div></div>${v.saveStatus.includes(tr('не сохраняется')) || v.saveStatus.includes(tr('другой')) ? `<p class="save-warning" role="status">${escape(v.saveStatus)}</p>` : ''}`;
  if (v.resultPending) return null;
  if (attempt.phase === 'won') return victoryContent(p, v.level, v.detailOpen);
  if (attempt.phase === 'lost') return `<div class="result-symbol">${icon('restart')}</div><div class="dialog-eyebrow">${tr("Попробуем ещё раз")}</div><h2>${tr("Три ошибки — новый взгляд")}</h2><p class="muted">${tr("Путь перекрывался другими стрелками. Начни то же поле заново — без ожидания.")}</p><div class="pause-actions">${button('restart-confirm', tr('Попробовать снова'), 'primary', 'restart')}${v.sdk && !attempt.continued ? button('ad-continue', tr('Посмотреть рекламу: ещё одна ошибка')) : ''}${button('pause', tr('Главное меню'))}</div>`;
  if (attempt.phase === 'deadlock') return `<div class="result-symbol">${icon('undo')}</div><div class="dialog-eyebrow">${tr("Порядок меняет путь")}</div><h2>${tr("Сейчас нет свободной стрелки")}</h2><p class="muted">${tr("Поворот закрыл выход. Отмени один или несколько ходов и попробуй другой порядок.")}</p><div class="dialog-actions">${button('undo', tr('Отменить ход'), 'primary', 'undo')}${button('restart-confirm', tr('Заново'))}</div>`;
  return null;
}
export function render(v: View): string {
  const p = v.profile, attempt = p.attempt!;
  const dialog = v.storageNotice ? null : dialogContent(v);
  const hasBack = v.modal === 'collection' || v.modal === 'topics' || v.modal === 'settings';
  const dialogClass = [v.modal === 'pause' ? 'main-menu' : v.modal === 'collection' ? 'collection-dialog' : !v.modal && attempt.phase === 'won' ? 'victory-dialog' : '', hasBack ? 'has-back' : ''].filter(Boolean).join(' ');
  const dialogNavigation = hasBack ? `<nav class="dialog-nav" aria-label="${tr("Навигация по меню")}">${button('close', tr('Назад'), 'secondary dialog-back', 'back')}<button class="close-dialog icon-button" data-action="close" aria-label="${tr("Вернуться в меню")}">${icon('close')}</button></nav>` : v.modal && v.modal !== 'pause' ? `<button class="close-dialog icon-button" data-action="close" aria-label="${tr("Закрыть")}">${icon('close')}</button>` : '';
  return `<main class="game-stage ${v.intro ? `intro-active intro-${v.intro.phase}` : ''}" ${v.storageNotice ? 'inert' : ''}><section class="play-area" aria-labelledby="level-title">
    <div class="play-head"><button class="icon-button" data-action="pause" aria-label="${tr("Главное меню")}">${icon('menu')}</button><h1 id="level-title">${tr("Уровень")} ${v.level.order}</h1><div class="mistakes" aria-label="${tr("Допустимых ошибок осталось:")} ${3 - attempt.mistakesUsed}">${[0, 1, 2].map(i => `<span class="${i < attempt.mistakesUsed ? 'spent' : ''}" aria-hidden="true">${icon('heart')}</span>`).join('')}</div></div>
    <div class="board-frame">${board(v)}</div>
    ${v.level.order === 1 ? '<div class="game-feedback">' : ''}<p class="game-status" role="status" aria-live="polite">${escape(v.intro ? '' : v.status || (v.level.teaching && v.level.order !== 1 ? tr(v.level.tutorial ?? '') : ''))}</p>${v.level.order === 1 ? `${button('how-play', tr('Как играть'), 'how-play', 'help')}</div>` : ''}
    <div class="game-tools" style="--tool-count:${v.level.links.length ? 3 : 2}">${button('hint', `${tr("Подсказка")}${v.level.teaching ? '' : ` · ${p.hints}`}`, 'tool hint-tool', 'hint')}${v.level.links.length ? `<button class="tool undo-tool" data-action="undo" aria-label="${tr("Отменить ход")}" ${v.intro || !attempt.history.length || attempt.phase === 'won' || attempt.phase === 'lost' ? 'disabled' : ''}>${icon('undo')}<span>${tr("Отменить ход")}</span></button>` : ''}<button class="tool restart-tool" data-action="restart">${icon('restart')}<span>${tr("Заново")}</span></button></div>
    ${v.saveStatus.includes(tr('не сохраняется')) ? `<p class="save-warning" role="status">${escape(v.saveStatus)}</p>` : ''}
    </section></main>
    ${v.intro ? `<div class="intro-scrim" aria-hidden="true"></div><button class="intro-skip" data-action="skip-intro">${tr("Пропустить")}</button>` : ''}
    ${dialog ? `<dialog id="game-dialog" class="${dialogClass}" aria-labelledby="dialog-title">${dialogNavigation}<div class="dialog-content">${dialog}</div></dialog>` : ''}
    ${v.storageNotice ? `<div class="external-pause" role="status"><div class="storage-notice"><p>${escape(v.storageNotice)}</p>${button('reload', tr('Обновить страницу'), 'primary', 'restart')}</div></div>` : v.externalPause ? `<div class="external-pause" role="status"><span>${tr("Игра на паузе")}</span></div>` : ''}`;
}
