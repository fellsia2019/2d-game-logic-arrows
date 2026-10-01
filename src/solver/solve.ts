import { legalMoves, removeArrow } from '../core/rules';
import type { Arrow, Level } from '../core/types';
export type Solution = { status: 'solved'; path: string[]; visited: number } | { status: 'unsolvable' | 'budget'; visited: number };
export function solve(level: Level, initial = level.arrows, limit = 100_000): Solution {
  const memo = new Map<string, string[] | null>();
  const special = new Set(level.links.flatMap(l => [l.sourceId, l.targetId]));
  let visited = 0, exhausted = false;
  const search = (input: Arrow[]): string[] | null => {
    if (++visited > limit) { exhausted = true; return null; }
    let arrows = input;
    const prefix: string[] = [];
    // Ordinary arrows cannot rotate or trigger links, so greedily removing them is safe.
    for (;;) {
      const id = legalMoves(level, arrows).find(id => !special.has(id));
      if (!id) break;
      prefix.push(id); arrows = removeArrow(level, arrows, id);
    }
    if (!arrows.length) return prefix;
    const key = arrows.map(a => `${a.id}:${a.dir}`).sort().join('|');
    if (memo.has(key)) { const rest = memo.get(key); return rest ? [...prefix, ...rest] : null; }
    for (const id of legalMoves(level, arrows)) {
      const rest = search(removeArrow(level, arrows, id));
      if (rest) { const path = [id, ...rest]; memo.set(key, path); return [...prefix, ...path]; }
      if (exhausted) return null;
    }
    memo.set(key, null); return null;
  };
  const path = search(initial);
  return path ? { status: 'solved', path, visited } : { status: exhausted ? 'budget' : 'unsolvable', visited };
}
