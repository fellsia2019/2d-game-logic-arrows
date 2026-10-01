import { VECTORS } from '../core/rules';
import type { Direction } from '../core/types';

const flights = new Set<HTMLElement>();

// Decorative copies live outside #app, so a new move can redraw the board
// while earlier arrows keep flying. Cleanup never changes the game state.
export function playDeparture(source: HTMLElement, frame: HTMLElement, distance: number, direction: Direction): void {
  const bounds = frame.getBoundingClientRect(), arrow = source.getBoundingClientRect();
  const flight = document.createElement('div');
  flight.className = 'departure-window';
  flight.setAttribute('aria-hidden', 'true');
  Object.assign(flight.style, {
    left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`,
    borderRadius: getComputedStyle(frame).borderRadius,
  });
  const ghost = source.cloneNode(true) as HTMLButtonElement;
  ghost.removeAttribute('data-arrow'); ghost.removeAttribute('id');
  ghost.disabled = true; ghost.tabIndex = -1;
  ghost.classList.remove('hinted', 'blocked', 'obstacle');
  ghost.classList.add('depart');
  Object.assign(ghost.style, {
    inset: 'auto', left: `${arrow.left - bounds.left}px`, top: `${arrow.top - bounds.top}px`,
    width: `${arrow.width}px`, height: `${arrow.height}px`,
  });
  ghost.style.setProperty('--exit-x', `${VECTORS[direction][0] * distance}px`);
  ghost.style.setProperty('--exit-y', `${VECTORS[direction][1] * distance}px`);
  ghost.style.setProperty('--shimmer-clock', `${-(performance.now() % 8000) / 1000}s`);
  const remove = () => { flight.remove(); flights.delete(flight); };
  ghost.addEventListener('animationend', event => { if (event.animationName === 'depart') remove(); });
  flight.append(ghost); flights.add(flight); document.body.append(flight);
  // Fallback for an interrupted/disabled CSS animation; only this copy is removed.
  setTimeout(remove, 350);
}

export function clearDepartures(): void {
  for (const flight of flights) flight.remove();
  flights.clear();
}
