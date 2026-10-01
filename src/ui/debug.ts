import { levels } from '../data/levels';
import { icon } from './icons';
import { currentTheme, toggleTheme } from './theme';
import './debug.css';

interface DebugActions {
  state(): { levelId: string; hints: number; locked: boolean };
  victory(): void; addHint(): void; start(levelId: string): void;
}
export function mountDebugPanel(actions: DebugActions): { refresh(): void } {
  const root = document.createElement('details');
  root.className = 'debug-panel'; root.id = 'debug-panel';
  root.innerHTML = `<summary>${icon('settings')}<span>Дебаг</span></summary><div class="debug-content"><strong>Проверка игры</strong><p>Тестовые действия сохраняются.</p><label>Уровень<select aria-label="Тестовый уровень">${levels.map(l => `<option value="${l.id}">${l.order} · ${l.title}</option>`).join('')}</select></label><button data-debug="start">${icon('next')}Открыть уровень</button><button data-debug="victory">${icon('check')}Победа</button><button data-debug="hint">${icon('hint')}Добавить подсказку</button><button data-debug="theme">${icon('art')}<span></span></button><a href="./victory-gallery.html" target="_blank" rel="noopener">${icon('book')}Все карточки победы</a><div class="debug-stock" role="status"></div></div>`;
  const select = root.querySelector<HTMLSelectElement>('select')!;
  const refresh = () => {
    const state = actions.state();
    if (document.activeElement !== select) select.value = state.levelId;
    root.querySelector('.debug-stock')!.textContent = `Подсказки: ${state.hints}`;
    root.querySelector('[data-debug="theme"] span')!.textContent = `Тема: ${currentTheme() === 'dark' ? 'тёмная' : 'светлая'}`;
    root.querySelectorAll<HTMLButtonElement>('button[data-debug]').forEach(b => { b.disabled = state.locked; });
    // A native modal makes the rest of the document inert. Mount inside it so
    // the panel remains usable on menus and victory screens too.
    (document.querySelector('dialog[open]') ?? document.body).append(root);
  };
  root.addEventListener('click', event => {
    event.stopPropagation();
    const action = (event.target as Element).closest<HTMLButtonElement>('button[data-debug]')?.dataset.debug;
    if (!action || actions.state().locked) return;
    if (action === 'victory') { root.open = false; actions.victory(); }
    if (action === 'hint') actions.addHint();
    if (action === 'start') { root.open = false; actions.start(select.value); }
    if (action === 'theme') toggleTheme();
    refresh();
  });
  refresh(); return { refresh };
}
