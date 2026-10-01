import { describe, it, expect } from 'vitest';
import { freshProfile } from '../src/core/profile';
import { move, newAttempt, undo } from '../src/core/rules';
import { levels } from '../src/data/levels';
import { decode, ProfileStorage, validProfile } from '../src/platform/save';
import { introArrow, introPath } from '../src/ui/intro';

function firstEntry() {
  const p = freshProfile(); p.attempt = newAttempt(levels[0]); return p;
}
describe('visual first entry', () => {
  it('demonstrates a legal arrow with two empty cells leading to the edge', () => {
    const p = firstEntry(), arrow = introArrow(p, levels[0])!;
    expect(arrow.id).toBe('a3');
    expect(introPath(levels[0], arrow)).toEqual([{ x: 3, y: 1 }, { x: 3, y: 0 }]);
    expect(introPath({ ...levels[0], width: 5 }, { id: 'ray', x: 2, y: 1, dir: 1 }))
      .toEqual([{ x: 3, y: 1 }, { x: 4, y: 1 }]);
  });
  it('does not replay for seen, completed, interrupted or later levels', () => {
    const p = firstEntry();
    expect(introArrow({ ...p, introSeen: true }, levels[0])).toBeNull();
    expect(introArrow({ ...p, completed: [levels[0].id] }, levels[0])).toBeNull();
    expect(introArrow({ ...p, attempt: move(levels[0], p.attempt!, 'a2').attempt }, levels[0])).toBeNull();
    expect(introArrow({ ...p, attempt: newAttempt(levels[1]) }, levels[1])).toBeNull();
    expect(introArrow(p, { ...levels[0], solutionWitness: ['a1'] })).toBeNull();
  });
  it('allows an explicitly requested replay on a reset first level only', () => {
    const p = firstEntry(); p.introSeen = true; p.completed = [levels[0].id];
    expect(introArrow(p, levels[0], true)?.id).toBe('a3');
    expect(introArrow(p, levels[0])).toBeNull();
    expect(introArrow({ ...p, attempt: move(levels[0], p.attempt!, 'a3').attempt }, levels[0], true)).toBeNull();
    expect(introArrow({ ...p, attempt: newAttempt(levels[1]) }, levels[1], true)).toBeNull();
  });
  it('leaves a real undoable move without consuming mistakes, hints or granting a fact', () => {
    const p = firstEntry(), arrow = introArrow(p, levels[0])!;
    const after = move(levels[0], p.attempt!, arrow.id).attempt;
    expect(after.arrows).toHaveLength(2);
    expect(after.phase).toBe('playing');
    expect(after.totalMistakes).toBe(0); expect(after.hintsUsed).toBe(0);
    expect(undo(levels[0], after).arrows).toEqual(p.attempt!.arrows);
    expect(p.unlocked).toEqual([]); expect(p.hints).toBe(5);
  });
  it('accepts older saves while rejecting a corrupt tutorial marker', () => {
    const p = firstEntry(); delete p.introSeen;
    expect(decode(JSON.stringify(p))).toEqual(p);
    expect(validProfile({ ...p, introSeen: 'yes' })).toBe(false);
  });
  it('persists skipping or completion without dropping existing profile contents', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
      removeItem: (key: string) => { data.delete(key); } };
    const p = firstEntry(); p.introSeen = true;
    const saved = new ProfileStorage(storage).save(p);
    expect(new ProfileStorage(storage).load()).toEqual(saved);
    expect(introArrow(saved, levels[0])).toBeNull();
  });
});
