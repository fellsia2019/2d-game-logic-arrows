// Switch between the concise card and its dedicated reading view without
// stacking a second modal above the existing victory or collection dialog.
export function toggleFactReading(button: HTMLElement): boolean {
  const card = button.closest<HTMLElement>('.fact-card');
  if (!card) return false;
  const open = !card.classList.contains('reading');
  const summary = card.querySelector<HTMLElement>('.fact-summary');
  const reading = card.querySelector<HTMLElement>('.fact-reading');
  if (!summary || !reading) return false;
  card.classList.toggle('reading', open);
  summary.hidden = open;
  reading.hidden = !open;
  const dialog = card.closest<HTMLDialogElement>('dialog');
  if (dialog?.classList.contains('collection-dialog')) {
    dialog.classList.toggle('reading-mode', open);
    if (open) { dialog.dataset.previousScroll = String(dialog.scrollTop); dialog.scrollTop = 0; }
    else dialog.scrollTop = Number(dialog.dataset.previousScroll || 0);
  } else if (dialog) {
    dialog.classList.toggle('reading-mode', open);
    dialog.scrollTop = 0;
  } else {
    card.closest<HTMLElement>('.victory-dialog')?.classList.toggle('reading-mode', open);
  }
  const next = (open ? reading : summary).querySelector<HTMLButtonElement>('[data-explain]');
  next?.focus({ preventScroll: true });
  return open;
}
