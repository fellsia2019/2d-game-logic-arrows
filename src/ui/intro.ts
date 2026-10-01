import type { Arrow, Level, Profile } from '../core/types';
import { blocker, VECTORS } from '../core/rules';

export type IntroPhase = 'reveal' | 'point' | 'press' | 'exit';
export interface IntroView { arrow: Arrow; phase: IntroPhase; elapsed: number }

export function introArrow(profile: Profile, level: Level, replay = false): Arrow | null {
  const attempt = profile.attempt;
  if ((!replay && (profile.introSeen || profile.completed.includes(level.id))) || level.order !== 1 ||
    !attempt || attempt.levelId !== level.id || attempt.phase !== 'playing' ||
    attempt.history.length || attempt.totalMistakes || attempt.arrows.length !== level.arrows.length) return null;
  const arrow = attempt.arrows.find(a => a.id === level.solutionWitness[0]);
  return arrow && !blocker(level, attempt.arrows, arrow) ? { ...arrow } : null;
}

export function introPath(level: Level, arrow: Arrow): { x: number; y: number }[] {
  const [dx, dy] = VECTORS[arrow.dir], path: { x: number; y: number }[] = [];
  for (let x = arrow.x + dx, y = arrow.y + dy;
    x >= 0 && y >= 0 && x < level.width && y < level.height; x += dx, y += dy) path.push({ x, y });
  return path;
}
