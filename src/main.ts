import './style.css';
import { facts } from './data/facts';
import { levelById } from './data/levels';
import { Campaign, initializeCampaign } from './data/campaign';
import { type Profile, type Topic, TOPICS } from './core/types';
import { move, newAttempt, undo } from './core/rules';
import { finish, grantReward, toggleTopic } from './core/profile';
import { ProfileStorage, SAVE_KEY } from './platform/save';
import { PauseReasons, YandexAdapter } from './platform/yandex';
import { Sound } from './audio/sound';
import { render, type Modal } from './ui/render';
import type { Solution } from './solver/solve';
import { introArrow, type IntroView } from './ui/intro';
import { FEEDBACK_DURATION_MS } from './ui/feedback';
import { LoadingScreen } from './ui/LoadingScreen';
import { interstitialDue } from './platform/ad-policy';
import { toggleFactExplanation } from './ui/accordion';
import { clearDepartures, playDeparture } from './ui/departures';

const app = document.querySelector<HTMLDivElement>('#app')!;
const loader = new LoadingScreen();
loader.stage('Готовим головоломки…', 35);
let booting = true;
let debugPanel: { refresh(): void } | null = null;
let storage: Storage | null = null;
try { storage = window.localStorage; } catch { /* private mode */ }
const saves = new ProfileStorage(storage);
let profile = saves.load();
const campaignStart = initializeCampaign(profile);
const campaign = new Campaign(campaignStart.seed);
if (!profile.attempt) profile.attempt = newAttempt(campaign.get(campaignStart.order));
if (profile.attempt.phase === 'won') profile = finish(profile, levelById(profile.attempt.levelId), facts);
profile = saves.save(profile);
document.body.classList.toggle('reduced-motion', profile.settings.reducedMotion);
const pauseReasons = new PauseReasons(), sound = new Sound();
let intro: IntroView | null = null, introFrame = 0, introStamp = 0, introAttemptId = '';
let modal: Modal = 'pause', status = '', busy = false, hint: string | null = null;
let resultPending = false;
let error: string | null = null, obstacle: string | null = null, hintBusy = false;
let hintStartedAt = 0, hintVersion = 0;
let errorVersion = 0, errorStartedAt = 0;
let query = '', collectionTopic: Topic | 'all' = 'all', favoritesOnly = false;
const expandedFacts = new Set<string>();
let clockStamp = performance.now(), activeSessionMs = 0, lastInterstitialAt = 0, lastAdAttemptAt = -60000;
let victoriesSinceAd = 0, adRequest = false, nextAdAt = 0, otherTab = false;
let storageNotice: string | null = null;
const motion = () => profile.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
const level = () => levelById(profile.attempt!.levelId);
const active = () => !booting && profile.attempt?.phase === 'playing' && !intro && !busy && !modal && !pauseReasons.paused && !otherTab;
function recordTime(): void {
  const now = performance.now(), elapsed = Math.max(0, Math.min(now - clockStamp, 1500));
  if (active()) { profile.attempt!.activeMs += Math.floor(elapsed); activeSessionMs += elapsed; }
  clockStamp = now;
}
function activity(): void {
  pauseReasons.set('menu', !!modal);
  document.body.classList.toggle('intro-paused', !!intro && pauseReasons.paused);
  sound.enabled = profile.settings.sound; sound.musicEnabled = profile.settings.music !== false;
  sound.pause(pauseReasons.paused, otherTab || ['hidden', 'focus', 'platform', 'advertisement'].some(reason => pauseReasons.has(reason)));
  sdk.setGameplay(active());
}
const sdk = new YandexAdapter((value, source) => {
  recordTime(); pauseReasons.set(source, value); activity(); draw();
});
const worker = new Worker(new URL('./solver/worker.ts', import.meta.url), { type: 'module' });
let requestId = 0;
let pendingHint: { id: number; attemptId: string; revision: number; timer: number } | null = null;
function protectChangedSave(): void {
  if (saves.status !== 'cleared' && saves.status !== 'conflict') return;
  otherTab = true;
  storageNotice = saves.status === 'cleared'
    ? 'Сохранение удалено. Обнови страницу, чтобы начать с первого уровня.'
    : 'Прогресс изменён в другой вкладке. Обнови страницу, чтобы загрузить актуальное сохранение.';
  cancelAnimationFrame(introFrame); intro = null; cancelHint();
  hint = null; error = null; obstacle = null; busy = false; modal = null; resultPending = false; clearDepartures();
  activity(); draw();
}
function verifySave(): boolean {
  if (otherTab) return false;
  if (saves.checkCurrent()) return true;
  protectChangedSave(); return false;
}
function commit(next = profile): void {
  if (otherTab) return;
  profile = saves.save(next); protectChangedSave();
}
function saveLabel(): string {
  if (storageNotice) return storageNotice;
  if (otherTab) return 'В другой вкладке появился новый прогресс';
  return { saved: 'Прогресс сохранён на устройстве', memory: 'Прогресс сейчас не сохраняется',
    recovered: 'Восстановлено резервное сохранение', future: 'Сохранение другой версии защищено',
    cleared: 'Сохранение удалено', conflict: 'Прогресс изменён в другой вкладке' }[saves.status];
}
function focusKey(): string | null {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return null;
  for (const attr of ['data-arrow', 'data-action', 'data-favorite', 'data-topic', 'data-explain']) {
    if (el.hasAttribute(attr)) return `[${attr}="${el.getAttribute(attr)}"]`;
  }
  return el.id ? `#${el.id}` : null;
}
function draw(): void {
  if (booting) return;
  const animationClock = performance.now();
  document.body.classList.toggle('reduced-motion', profile.settings.reducedMotion);
  const key = focusKey();
  const input = document.activeElement instanceof HTMLInputElement ? document.activeElement : null;
  const position = input?.selectionStart;
  const previousDialog = !!document.querySelector('dialog');
  app.innerHTML = render({ profile, level: level(), modal, status, busy: busy || hintBusy,
    hint, error, blocker: obstacle, externalPause: pauseReasons.has('platform') || pauseReasons.has('advertisement') || otherTab,
    saveStatus: saveLabel(), sdk: sdk.available, collectionTopic, query, favoritesOnly,
    detailOpen: expandedFacts.has(profile.levelRewards[level().id]), expandedFacts, intro,
    animationClock, hintElapsed: hint ? animationClock - hintStartedAt : 0,
    errorElapsed: error ? animationClock - errorStartedAt : 0, storageNotice, resultPending });
  if (intro) app.querySelectorAll<HTMLButtonElement>('.game-stage button').forEach(b => { b.disabled = true; });
  const dialog = document.querySelector<HTMLDialogElement>('#game-dialog');
  if (dialog) {
    const heading = dialog.querySelector('h2'); if (heading) heading.id = 'dialog-title';
    dialog.showModal();
    dialog.addEventListener('cancel', event => { event.preventDefault(); if (modal) closeModal(); });
  }
  if (key && (!dialog || previousDialog)) {
    const target = app.querySelector<HTMLElement>(key);
    if (target && (dialog ? dialog.contains(target) : true)) target.focus({ preventScroll: true });
    if (target instanceof HTMLInputElement && position !== null && position !== undefined) target.setSelectionRange(position, position);
  }
  if (storageNotice) app.querySelector<HTMLButtonElement>('[data-action="reload"]')?.focus({ preventScroll: true });
  activity();
  debugPanel?.refresh();
}
function openModal(value: Modal): void { recordTime(); modal = value; status = ''; resultPending = false; clearDepartures(); activity(); draw(); }
function closeModal(): void { recordTime(); modal = modal && ['collection', 'topics', 'settings'].includes(modal) ? 'pause' : null; expandedFacts.clear(); activity(); draw(); sound.unlock(); maybeIntro(); }
function start(id: string, replayIntro = false): void {
  if (otherTab || adRequest) return;
  recordTime(); profile.attempt = newAttempt(levelById(id)); modal = null; busy = false; hint = null; resultPending = false; clearDepartures();
  error = null; obstacle = null; errorVersion++; status = ''; expandedFacts.clear();
  cancelHint(); commit(); activity(); draw(); maybeIntro(replayIntro);
  void campaign.prepare(level().order).then(() => debugPanel?.refresh());
}
function maybeIntro(replay = false): void {
  if (intro || modal || busy || hintBusy || pauseReasons.paused || otherTab) return;
  const arrow = introArrow(profile, level(), replay);
  if (!arrow) return;
  recordTime(); intro = { arrow, phase: 'reveal', elapsed: 0 };
  introAttemptId = profile.attempt!.id; introStamp = performance.now();
  draw();
  introFrame = requestAnimationFrame(tickIntro);
}
function endIntro(seen = true): void {
  if (!intro) return;
  cancelAnimationFrame(introFrame); recordTime(); intro = null;
  if (seen && !otherTab) { profile.introSeen = true; commit(); }
  activity(); draw(); app.querySelector<HTMLButtonElement>('[data-arrow]')?.focus({ preventScroll: true });
}
function tickIntro(now: number): void {
  if (!intro) return;
  if (otherTab || profile.attempt?.id !== introAttemptId) { endIntro(false); return; }
  const elapsed = Math.min(Math.max(now - introStamp, 0), 100); introStamp = now;
  if (!pauseReasons.paused && !modal) {
    intro.elapsed += elapsed;
    const duration = { reveal: 1200, point: 1400, press: 400, exit: 650 }[intro.phase];
    if (intro.elapsed >= duration) {
      intro.elapsed = 0;
      if (intro.phase === 'exit') { endIntro(); return; }
      if (intro.phase === 'reveal') intro.phase = 'point';
      else if (intro.phase === 'point') intro.phase = 'press';
      else {
        const id = intro.arrow.id;
        intro.phase = 'exit'; profile.introSeen = true;
        draw(); performMove(id, true);
      }
      if (intro.phase !== 'exit') draw();
    }
  }
  introFrame = requestAnimationFrame(tickIntro);
}
function cancelHint(): void {
  if (pendingHint) clearTimeout(pendingHint.timer);
  pendingHint = null; hintBusy = false;
}
function performMove(id: string, demonstration = false): void {
  if (hintBusy || (!demonstration && !active()) || (demonstration &&
    (busy || modal || pauseReasons.paused || otherTab || profile.attempt?.phase !== 'playing'))) return;
  recordTime();
  const before = profile.attempt!, result = move(level(), before, id);
  if (result.kind === 'ignored') return;
  profile.attempt = result.attempt; hint = null; busy = result.kind === 'blocked';
  resultPending = result.kind === 'moved' && result.attempt.phase !== 'playing' && !motion();
  error = null; obstacle = null; const feedbackVersion = ++errorVersion;
  const newVictory = !profile.completed.includes(level().id);
  if (result.attempt.phase === 'won') {
    profile = finish(profile, level(), facts);
    if (newVictory) victoriesSinceAd++;
  }
  commit();
  if (otherTab) return;
  activity();
  if (result.kind === 'blocked') {
    error = id; errorStartedAt = performance.now(); obstacle = result.blocker ?? null;
    status = 'Путь перекрыт. Сначала убери стрелку перед ней.';
    sound.play('error'); draw();
    setTimeout(() => {
      if (errorVersion !== feedbackVersion || profile.attempt?.id !== before.id || otherTab) return;
      error = null; obstacle = null;
      if (profile.attempt.phase === 'playing') status = '';
      draw();
    }, FEEDBACK_DURATION_MS);
    setTimeout(() => {
      if (errorVersion !== feedbackVersion || profile.attempt?.id !== before.id || otherTab) return;
      recordTime(); busy = false; activity(); draw();
    }, motion() ? 20 : 480);
    return;
  }
  const clicked = app.querySelector<HTMLElement>(`[data-arrow="${id}"]`);
  if (clicked && !motion()) {
    const arrow = before.arrows.find(a => a.id === id)!;
    const distance = app.querySelector<HTMLElement>('.board')!.getBoundingClientRect().width;
    playDeparture(clicked, app.querySelector<HTMLElement>('.board-frame')!, distance, arrow.dir);
  }
  status = ''; sound.play(result.attempt.phase === 'won' ? 'win' : 'move');
  draw();
  if (!demonstration && result.attempt.phase === 'playing') {
    app.querySelector<HTMLButtonElement>('[data-arrow]')?.focus({ preventScroll: true });
  }
  // Only the result screen waits for the last flight. Ordinary moves have no
  // input lock or delayed redraw; earlier flights only remove their own copies.
  if (resultPending) {
    const { id: attemptId, stateRevision } = result.attempt;
    setTimeout(() => {
      if (!resultPending || otherTab || profile.attempt?.id !== attemptId ||
        profile.attempt.stateRevision !== stateRevision) return;
      resultPending = false; draw();
    }, 280);
  }
}
function performUndo(): void {
  if (!level().links.length || busy || adRequest || hintBusy || otherTab || pauseReasons.has('platform')) return;
  recordTime(); const next = undo(level(), profile.attempt!);
  if (next === profile.attempt) return;
  profile.attempt = next; hint = null; error = null; obstacle = null; errorVersion++; modal = null; resultPending = false; clearDepartures(); status = 'Ход возвращён. Попробуй другой порядок.';
  commit(); sound.play('undo'); activity(); draw();
}
const recoveryAdvice = () => level().links.length ? 'Можно отменить ход или начать заново.' : 'Можно начать уровень заново.';
function requestHint(): void {
  if (!active() || hintBusy) return;
  if (hint) { status = 'Подсвечена стрелка со свободным продолжением.'; draw(); return; }
  recordTime(); hintBusy = true; status = 'Ищем свободный маршрут…';
  const id = ++requestId;
  const timer = window.setTimeout(() => {
    if (pendingHint?.id !== id) return;
    cancelHint(); status = `Не удалось подобрать подсказку. ${recoveryAdvice()}`; draw();
  }, 2000);
  pendingHint = { id, attemptId: profile.attempt!.id, revision: profile.attempt!.stateRevision, timer };
  worker.postMessage({ requestId: id, level: level(), arrows: profile.attempt!.arrows }); draw();
}
worker.onmessage = (event: MessageEvent<{ requestId: number; solution: Solution }>) => {
  const pending = pendingHint;
  if (!pending || pending.id !== event.data.requestId) return;
  cancelHint();
  if (profile.attempt!.id !== pending.attemptId || profile.attempt!.stateRevision !== pending.revision || !active()) { draw(); return; }
  const solution = event.data.solution;
  if (solution.status === 'unsolvable') { status = level().links.length ? 'Этот порядок закрыл решение. Отмени один или несколько ходов.' : 'Не удалось найти решение. Можно начать уровень заново.'; draw(); return; }
  if (solution.status !== 'solved' || !solution.path.length) { status = `Не удалось подобрать подсказку. ${recoveryAdvice()}`; draw(); return; }
  if (!level().teaching && profile.hints === 0) { status = `Подсказки закончились. ${sdk.available ? 'Можно получить ещё одну за рекламу. ' : ''}${recoveryAdvice()}`; draw(); return; }
  hint = solution.path[0]; hintStartedAt = performance.now();
  const version = ++hintVersion;
  if (!level().teaching) { profile.hints--; profile.attempt!.hintsUsed++; commit(); }
  status = 'Подсвечен ход, после которого поле можно очистить.'; sound.play('hint'); draw();
  const hinted = hint;
  setTimeout(() => { if (hint === hinted && hintVersion === version) { hint = null; draw(); } }, FEEDBACK_DURATION_MS);
};
worker.onerror = () => { cancelHint(); status = `Подсказка временно недоступна. ${recoveryAdvice()}`; draw(); };
async function rewarded(placement: 'hint' | 'continue'): Promise<void> {
  if (!sdk.available || busy || adRequest || otherTab || pauseReasons.paused || performance.now() < nextAdAt) return;
  if (placement === 'continue' && (profile.attempt!.phase !== 'lost' || profile.attempt!.continued)) return;
  if (placement === 'hint' && profile.attempt!.phase !== 'playing') return;
  recordTime(); adRequest = true; commit();
  const receipt = crypto.randomUUID(), attemptId = profile.attempt!.id;
  const granted = await sdk.rewarded(() => {
    profile = grantReward(profile, receipt, placement, attemptId); commit();
    lastInterstitialAt = activeSessionMs;
  });
  adRequest = false; nextAdAt = performance.now() + 5000;
  status = granted ? placement === 'hint' ? 'Добавлена одна подсказка.' : 'Ещё одна ошибка доступна. Продолжай с этого поля.' : 'Реклама не завершена или недоступна. Поле сохранено.';
  draw();
}
async function nextLevel(): Promise<void> {
  if (adRequest || busy || otherTab || profile.attempt!.phase !== 'won') return;
  const next = campaign.get(level().order + 1);
  adRequest = true;
  if (interstitialDue({ available: sdk.available, victories: victoriesSinceAd, activeMs: activeSessionMs,
    lastInterstitialAt, lastAdAttemptAt, nextTeaching: !!next.teaching })) {
    lastAdAttemptAt = activeSessionMs; status = 'Реклама перед следующим уровнем'; commit(); draw();
    const shown = await sdk.interstitial();
    if (shown) { lastInterstitialAt = activeSessionMs; victoriesSinceAd = 0; }
  }
  adRequest = false; start(next.id);
}
app.addEventListener('click', event => {
  const target = (event.target as Element).closest<HTMLElement>('button, a[data-action]');
  if (!target || target.hasAttribute('disabled')) return;
  event.preventDefault(); sound.unlock();
  if (target.dataset.action === 'reload') { window.location.reload(); return; }
  if (!verifySave()) return;
  if (target.dataset.action === 'skip-intro') { if (intro && !otherTab && !pauseReasons.has('platform')) endIntro(); return; }
  if (intro) return;
  if (target.dataset.arrow) { performMove(target.dataset.arrow); return; }
  if (busy || adRequest || otherTab || pauseReasons.has('platform')) return;
  if (target.dataset.explain) {
    const id = target.dataset.explain;
    toggleFactExplanation(target) ? expandedFacts.add(id) : expandedFacts.delete(id);
    return;
  }
  if (target.dataset.favorite) {
    const id = target.dataset.favorite;
    profile.favorites = profile.favorites.includes(id) ? profile.favorites.filter(f => f !== id) : [...profile.favorites, id]; commit(); draw(); return;
  }
  if (target.dataset.topic) {
    const next = toggleTopic(profile, target.dataset.topic as Topic);
    if (next === profile) { status = 'Оставь хотя бы одну тему.'; target.animate([{ transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }], { duration: 180 }); return; }
    profile = next; commit();
    if (otherTab) return;
    const selected = profile.topics.includes(target.dataset.topic as Topic);
    target.classList.toggle('selected', selected);
    target.setAttribute('aria-pressed', String(selected));
    return;
  }
  switch (target.dataset.action) {
    case 'play': case 'close': closeModal(); break;
    case 'pause': case 'collection': case 'topics': case 'settings': openModal(target.dataset.action); break;
    case 'restart': if (profile.attempt!.history.length || profile.attempt!.totalMistakes) openModal('restart'); else start(level().id); break;
    case 'restart-confirm': start(level().id); break;
    case 'undo': performUndo(); break;
    case 'hint': requestHint(); break;
    case 'how-play': if (level().order === 1) start(level().id, true); break;
    case 'next': void nextLevel(); break;
    case 'favorites': favoritesOnly = !favoritesOnly; draw(); break;
    case 'music': profile.settings.music = profile.settings.music === false; commit(); draw(); break;
    case 'sound': profile.settings.sound = !profile.settings.sound; commit(); draw(); break;
    case 'motion': profile.settings.reducedMotion = !profile.settings.reducedMotion; commit(); draw(); break;
    case 'ad-hint': void rewarded('hint'); break;
    case 'ad-continue': void rewarded('continue'); break;
  }
});
app.addEventListener('input', event => { if ((event.target as HTMLElement).id === 'fact-search') { query = (event.target as HTMLInputElement).value; draw(); } });
app.addEventListener('change', event => {
  if ((event.target as HTMLElement).id === 'collection-topic') {
    const value = (event.target as HTMLSelectElement).value;
    collectionTopic = TOPICS.some(t => t === value) ? value as Topic : 'all'; draw();
  }
});
window.addEventListener('resize', clearDepartures);

document.addEventListener('keydown', event => {
  if (otherTab) return;
  if (intro && event.key === 'Escape') { event.preventDefault(); if (!otherTab && !pauseReasons.has('platform')) endIntro(); return; }
  if (event.key === 'Escape' && !document.querySelector('dialog') && !busy && !adRequest) { event.preventDefault(); openModal('pause'); return; }
  const current = (event.target as Element).closest<HTMLElement>('[data-arrow]');
  const vectors: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0] };
  if (!current || !vectors[event.key] || !active()) return;
  event.preventDefault();
  const [dx, dy] = vectors[event.key]; let x = Number(current.dataset.x) + dx, y = Number(current.dataset.y) + dy;
  while (x >= 0 && y >= 0 && x < level().width && y < level().height) {
    const next = app.querySelector<HTMLButtonElement>(`[data-arrow][data-x="${x}"][data-y="${y}"]`);
    if (next) { next.focus(); break; } x += dx; y += dy;
  }
});
document.addEventListener('visibilitychange', () => {
  recordTime(); pauseReasons.set('hidden', document.hidden); commit(); activity(); draw();
});
window.addEventListener('blur', () => { recordTime(); pauseReasons.set('focus', true); commit(); activity(); });
window.addEventListener('focus', () => { clockStamp = performance.now(); pauseReasons.set('focus', false); verifySave(); activity(); if (!modal) maybeIntro(); });
window.addEventListener('pagehide', () => { recordTime(); if (!otherTab) commit(); });
window.addEventListener('storage', event => {
  if (event.storageArea === storage && (event.key === SAVE_KEY || event.key === null)) verifySave();
});
setInterval(recordTime, 1000);
loader.stage(import.meta.env.MODE === 'yandex' ? 'Подключаем игровую платформу…' : 'Готовим игру…', 70);
void Promise.all([sdk.initialize(), campaign.prepare(campaignStart.order)]).then(() => loader.finish(() => {
  booting = false; draw(); sdk.markReady();
  if (import.meta.env.MODE !== 'yandex') {
    void import('./ui/debug').then(({ mountDebugPanel }) => {
      debugPanel = mountDebugPanel({
        levels: () => {
          const prepared = campaign.available();
          return prepared.some(l => l.id === level().id) ? prepared : [level(), ...prepared];
        },
        state: () => ({ levelId: level().id, hints: profile.hints, locked: booting || otherTab || adRequest }),
        start: id => { if (verifySave()) { endIntro(false); start(id); } },
        addHint: () => { if (!verifySave()) return; profile.hints = Math.min(10000, profile.hints + 1); commit(); draw(); },
        victory: () => {
          if (!verifySave()) return;
          endIntro(false); cancelHint(); recordTime();
          hint = null; error = null; obstacle = null; errorVersion++; busy = false; modal = null; resultPending = false; clearDepartures(); status = ''; expandedFacts.clear();
          profile.attempt = { ...profile.attempt!, arrows: [], phase: 'won',
            mistakesUsed: Math.min(2, profile.attempt!.mistakesUsed), stateRevision: profile.attempt!.stateRevision + 1 };
          profile = finish(profile, level(), facts); commit(); draw();
        },
      });
    });
  }
}));

// Developer inspection is limited to a read-only snapshot and is excluded from Yandex builds.
if (import.meta.env.DEV) {
  Object.defineProperty(window, '__arrowSnapshot', { get: () => structuredClone(profile), configurable: true });
}
export type { Profile };
