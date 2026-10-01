import { copyArrows, type Arrow, type Attempt, type Level, type Phase } from './types';
export const VECTORS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
export function blocker(level: Pick<Level, 'width' | 'height'>, arrows: Arrow[], arrow: Arrow): Arrow | null {
  const [dx, dy] = VECTORS[arrow.dir];
  let x = arrow.x + dx, y = arrow.y + dy;
  while (x >= 0 && y >= 0 && x < level.width && y < level.height) {
    const other = arrows.find(a => a.x === x && a.y === y);
    if (other) return other;
    x += dx; y += dy;
  }
  return null;
}
export const legalMoves = (level: Level, arrows: Arrow[]): string[] => arrows.filter(a => !blocker(level, arrows, a)).map(a => a.id);
export function removeArrow(level: Level, arrows: Arrow[], id: string): Arrow[] {
  const source = arrows.find(a => a.id === id);
  if (!source || blocker(level, arrows, source)) return copyArrows(arrows);
  return arrows.filter(a => a.id !== id).map(a => ({ ...a,
    dir: (a.dir + level.links.filter(l => l.sourceId === id && l.targetId === a.id).length) % 4 as Arrow['dir'],
  }));
}
export function fieldPhase(level: Level, arrows: Arrow[]): Phase {
  return !arrows.length ? 'won' : legalMoves(level, arrows).length ? 'playing' : 'deadlock';
}
export function newAttempt(level: Level, id: string = crypto.randomUUID()): Attempt {
  return { id, levelId: level.id, levelRevision: level.revision, arrows: copyArrows(level.arrows),
    history: [], phase: fieldPhase(level, level.arrows), stateRevision: 0,
    mistakesUsed: 0, totalMistakes: 0, hintsUsed: 0, undosUsed: 0, activeMs: 0, continued: false };
}
export function move(level: Level, attempt: Attempt, id: string): { attempt: Attempt; kind: 'ignored' | 'blocked' | 'moved'; blocker?: string } {
  if (attempt.phase !== 'playing') return { attempt, kind: 'ignored' };
  const arrow = attempt.arrows.find(a => a.id === id);
  if (!arrow) return { attempt, kind: 'ignored' };
  const hit = blocker(level, attempt.arrows, arrow);
  if (hit) {
    const mistakesUsed = attempt.mistakesUsed + 1;
    return { kind: 'blocked', blocker: hit.id, attempt: { ...attempt, mistakesUsed,
      totalMistakes: attempt.totalMistakes + 1, stateRevision: attempt.stateRevision + 1,
      phase: mistakesUsed >= 3 ? 'lost' : 'playing' } };
  }
  const arrows = removeArrow(level, attempt.arrows, id);
  return { kind: 'moved', attempt: { ...attempt, arrows, history: [...attempt.history, copyArrows(attempt.arrows)],
    stateRevision: attempt.stateRevision + 1, phase: fieldPhase(level, arrows) } };
}
export function undo(level: Level, attempt: Attempt): Attempt {
  if (!attempt.history.length || attempt.phase === 'lost' || attempt.phase === 'won') return attempt;
  const arrows = copyArrows(attempt.history[attempt.history.length - 1]);
  return { ...attempt, arrows, history: attempt.history.slice(0, -1), phase: fieldPhase(level, arrows),
    undosUsed: attempt.undosUsed + 1, stateRevision: attempt.stateRevision + 1 };
}
export function continueAttempt(attempt: Attempt): Attempt {
  if (attempt.phase !== 'lost' || attempt.continued) return attempt;
  return { ...attempt, continued: true, mistakesUsed: 2, phase: 'playing', stateRevision: attempt.stateRevision + 1 };
}
