import { describe, it, expect } from 'vitest';
import { levels } from '../src/data/levels';
import { facts } from '../src/data/facts';
import { blocker, continueAttempt, fieldPhase, legalMoves, move, newAttempt, removeArrow, undo } from '../src/core/rules';
import { finish, freshProfile, grantReward, toggleTopic } from '../src/core/profile';
import { TOPICS, type Arrow, type Level, type Profile } from '../src/core/types';
import { solve } from '../src/solver/solve';
const classic: Level = { id: 'fixture', revision: 1, order: 1, title: '', width: 4, height: 4,
  arrows: [{ id: 'A', x: 1, y: 1, dir: 1 }, { id: 'B', x: 3, y: 1, dir: 0 }, { id: 'C', x: 1, y: 3, dir: 0 }], links: [], solutionWitness: ['B', 'A', 'C'] };
function wonProfile(index = 0, profile = freshProfile(), attemptId = `attempt-${index}`): Profile {
  const level = levels[index]; let attempt = newAttempt(level, attemptId);
  for (const id of level.solutionWitness) attempt = move(level, attempt, id).attempt;
  return { ...profile, attempt };
}
describe('ray and attempts', () => {
  it('finds the first obstacle and accepts boundary arrows', () => {
    expect(blocker(classic, classic.arrows, classic.arrows[0])?.id).toBe('B');
    expect(legalMoves(classic, classic.arrows)).toEqual(['B']);
    for (const dir of [0, 1, 2, 3] as const) expect(blocker(classic, [{ id: 'x', x: 0, y: 0, dir }], { id: 'x', x: 0, y: 0, dir })).toBeNull();
  });
  it('leaves the board unchanged on a blocked move and loses at three', () => {
    let a = newAttempt(classic);
    for (let i = 0; i < 3; i++) a = move(classic, a, 'A').attempt;
    expect(a.phase).toBe('lost'); expect(a.arrows).toEqual(classic.arrows);
    expect(a.history).toHaveLength(0); expect(a.totalMistakes).toBe(3);
    expect(move(classic, a, 'B').kind).toBe('ignored');
  });
  it('does not count unknown IDs', () => {
    const a = newAttempt(classic); expect(move(classic, a, 'missing').attempt).toBe(a);
  });
  it('undo restores a successful move without refunding mistakes', () => {
    let a = move(classic, newAttempt(classic), 'B').attempt;
    a = move(classic, a, 'C').attempt;
    const restored = undo(classic, a);
    expect(restored.arrows).toEqual(classic.arrows); expect(restored.mistakesUsed).toBe(1); expect(restored.undosUsed).toBe(1);
  });
  it('a confirmed continuation allows one more mistake only', () => {
    let a = newAttempt(classic);
    for (let i = 0; i < 3; i++) a = move(classic, a, 'A').attempt;
    a = continueAttempt(a); expect(a.mistakesUsed).toBe(2); expect(a.totalMistakes).toBe(3);
    a = move(classic, a, 'A').attempt;
    expect(a.phase).toBe('lost'); expect(continueAttempt(a)).toBe(a); expect(a.totalMistakes).toBe(4);
  });
});
describe('linked arrows', () => {
  it('the wrong order produces a deadlock which undo restores', () => {
    const level = levels[11]; let a = newAttempt(level);
    a = move(level, a, 'A').attempt;
    expect(a.arrows.find(a => a.id === 'B')?.dir).toBe(1);
    expect(solve(level, a.arrows).status).toBe('unsolvable');
    a = move(level, a, 'D').attempt; a = move(level, a, 'E').attempt;
    expect(a.phase).toBe('deadlock');
    a = undo(level, undo(level, undo(level, a)));
    expect(a.arrows).toEqual(level.arrows); expect(solve(level, a.arrows).status).toBe('solved');
  });
  it('a removed target is ignored', () => {
    const level = levels[11]; let arrows = removeArrow(level, level.arrows, 'B');
    arrows = removeArrow(level, arrows, 'A');
    expect(arrows.some(a => a.id === 'B')).toBe(false);
  });
  it('a blocked source does not rotate the target', () => {
    const level = { ...classic, links: [{ sourceId: 'A', targetId: 'C', quarterTurns: 1 as const }] };
    expect(move(level, newAttempt(level), 'A').attempt.arrows).toEqual(level.arrows);
  });
  it('distinguishes search budget from unsolvability', () => expect(solve(levels[11], levels[11].arrows, 0).status).toBe('budget'));
  it('matches a brute-force solver for all reachable states of the order lesson', () => {
    const level = levels[11], seen = new Set<string>();
    const brute = (arrows: Arrow[]): boolean => !arrows.length || legalMoves(level, arrows).some(id => brute(removeArrow(level, arrows, id)));
    const visit = (arrows: Arrow[]) => {
      const key = JSON.stringify(arrows); if (seen.has(key)) return; seen.add(key);
      expect(solve(level, arrows).status === 'solved').toBe(brute(arrows));
      for (const id of legalMoves(level, arrows)) visit(removeArrow(level, arrows, id));
    };
    visit(level.arrows); expect(seen.size).toBeGreaterThan(10);
  });
});
describe('fixed content', () => {
  it('has a continuous campaign of 100 distinct boards', () => {
    expect(levels).toHaveLength(100);
    expect(levels.map(l => l.order)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    expect(new Set(levels.map(l => l.id)).size).toBe(100);
    expect(new Set(levels.map(l => l.arrows.map(a => `${a.x},${a.y},${a.dir}`).sort().join('|'))).size).toBe(100);
  });
  it.each(levels)('$id is valid and its witness and solver both win', level => {
    const cells = new Set(level.arrows.map(a => `${a.x},${a.y}`));
    expect(cells.size).toBe(level.arrows.length);
    expect(new Set(level.arrows.map(a => a.id)).size).toBe(level.arrows.length);
    for (const a of level.arrows) { expect(a.x).toBeGreaterThanOrEqual(0); expect(a.y).toBeGreaterThanOrEqual(0); expect(a.x).toBeLessThan(level.width); expect(a.y).toBeLessThan(level.height); }
    let arrows = level.arrows;
    for (const id of level.solutionWitness) { expect(legalMoves(level, arrows)).toContain(id); arrows = removeArrow(level, arrows, id); }
    expect(fieldPhase(level, arrows)).toBe('won');
    const solution = solve(level); expect(solution.status).toBe('solved');
    if (solution.status === 'solved') {
      arrows = level.arrows;
      for (const id of solution.path) { expect(legalMoves(level, arrows)).toContain(id); arrows = removeArrow(level, arrows, id); }
      expect(arrows).toHaveLength(0);
    }
  });
  it('has 160 distinct sourced facts and twenty per topic', () => {
    expect(facts).toHaveLength(160); expect(new Set(facts.map(f => f.id)).size).toBe(160);
    expect(TOPICS).toHaveLength(8);
    for (const topic of TOPICS) expect(facts.filter(f => f.topic === topic)).toHaveLength(20);
    for (const f of facts) { expect(f.sourceUrl).toMatch(/^https:\/\//); expect(f.verifiedAt).toBe('2026-10-01'); }
  });
});
describe('transactional rewards', () => {
  it('keeps the reward of one attempt stable even if the topic selection changes', () => {
    let rolls = 0;
    const random = () => { rolls++; return 0; };
    const p = finish(wonProfile(), levels[0], facts, random);
    const again = finish({ ...p, topics: ['art'] }, levels[0], facts, random);
    expect(again.unlocked).toEqual(p.unlocked); expect(again.levelRewards).toEqual(p.levelRewards);
    expect(again.lastFactReward).toEqual(p.lastFactReward); expect(rolls).toBe(1);
  });
  it('awards another unseen card for a genuinely new winning attempt on the same level', () => {
    const p = finish(wonProfile(), levels[0], facts, () => 0);
    const replay = finish(wonProfile(0, p, 'replay-1'), levels[0], facts, () => 0);
    expect(replay.unlocked).toHaveLength(2); expect(replay.completed).toHaveLength(1);
    expect(replay.levelRewards[levels[0].id]).not.toBe(p.levelRewards[levels[0].id]);
    expect(replay.lastFactReward?.attemptId).toBe('replay-1');
    expect(replay.lastFactReward?.isNew).toBe(true);
  });
  it('uses the random draw across unseen cards in selected topics only', () => {
    const p = wonProfile(0, { ...freshProfile(), topics: ['science', 'human'] });
    const first = finish(p, levels[0], facts, () => 0);
    const last = finish(p, levels[0], facts, () => 0.999999);
    expect(facts.find(f => f.id === first.lastFactReward?.factId)?.topic).toBe('science');
    expect(facts.find(f => f.id === last.lastFactReward?.factId)?.topic).toBe('human');
    const one = { ...first, topics: ['science' as const] }; expect(toggleTopic(one, 'science')).toBe(one);
  });
  it('opens the whole catalogue without repetition across levels and replays', () => {
    let p = freshProfile();
    for (let i = 0; i < 160; i++) {
      const index = i % levels.length;
      p = finish(wonProfile(index, p, `catalogue-${i}`), levels[index], facts, () => 0);
      expect(p.unlocked).toHaveLength(i + 1);
    }
    expect(p.completed).toHaveLength(100);
  });
  it('avoids an immediate repeat once selected topics are exhausted', () => {
    const small = facts.filter(f => f.topic === 'space').slice(0, 2);
    let p = { ...freshProfile(), topics: ['space' as const] };
    p = finish(wonProfile(0, p, 'small-1'), levels[0], small, () => 0) as typeof p;
    p = finish(wonProfile(0, p, 'small-2'), levels[0], small, () => 0) as typeof p;
    const previous = p.lastFactReward?.factId;
    p = finish(wonProfile(0, p, 'small-3'), levels[0], small, () => 0) as typeof p;
    expect(p.lastFactReward?.factId).not.toBe(previous);
    expect(p.lastFactReward?.isNew).toBe(false); expect(p.unlocked).toHaveLength(2);
    expect(p.completed).toHaveLength(1);
  });
  it('can recall the only card when a pool contains a single exhausted card', () => {
    const p = finish(wonProfile(), levels[0], facts.slice(0, 1), () => 0);
    const next = finish(wonProfile(0, p, 'single-replay'), levels[0], facts.slice(0, 1), () => 0);
    expect(next.unlocked).toHaveLength(1); expect(next.lastFactReward?.isNew).toBe(false);
  });
  it('uses mistakes and hints for stars, excluding teaching hints', () => {
    const p = wonProfile(); expect(finish(p, levels[0], facts).best[levels[0].id].stars).toBe(3);
    p.attempt!.hintsUsed = 1; expect(finish(p, levels[0], facts).best[levels[0].id].stars).toBe(2);
    p.attempt!.totalMistakes = 1; expect(finish(p, levels[0], facts).best[levels[0].id].stars).toBe(1);
  });
  it('never lowers a personal best', () => {
    const p = finish(wonProfile(), levels[0], facts); const poor = wonProfile(0, p); poor.attempt!.totalMistakes = 2;
    expect(finish(poor, levels[0], facts).best[levels[0].id].stars).toBe(3);
  });
  it('grants a receipt once and ignores a continuation for a different attempt', () => {
    const p = freshProfile(); const next = grantReward(p, 'request-1', 'hint', 'attempt-1');
    expect(next.hints).toBe(6); expect(grantReward(next, 'request-1', 'hint', 'attempt-1')).toBe(next);
    expect(grantReward(next, 'request-2', 'continue', 'old').attempt).toBeNull();
  });
});
