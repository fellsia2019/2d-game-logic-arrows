// CSS Grid animates the content's natural height. No measurements or timers
// are needed, and reversing a transition uses the current animated position.
export function toggleFactExplanation(button: HTMLElement): boolean {
  const open = button.getAttribute('aria-expanded') !== 'true';
  const accordion = button.closest<HTMLElement>('.fact-explanation')!;
  const panel = accordion.querySelector<HTMLElement>('.fact-explain-panel')!;
  button.setAttribute('aria-expanded', String(open));
  accordion.classList.toggle('open', open);
  panel.setAttribute('aria-hidden', String(!open));
  panel.inert = !open;
  return open;
}
