import { describe, expect, it } from 'vitest';
import { Campaign, initializeCampaign } from '../src/data/campaign';
import { difficultyFor, generateLevel, generatedInfo } from '../src/data/generated-levels';
import { levelById, levels } from '../src/data/levels';
import { legalMoves, move, newAttempt } from '../src/core/rules';
import { freshProfile, finish } from '../src/core/profile';
import { facts } from '../src/data/facts';
import { decode, validProfile } from '../src/platform/save';
import { introArrow, introPath } from '../src/ui/intro';
import { solve } from '../src/solver/solve';
import { victoryContent } from '../src/ui/render';

describe('personal generated campaign', () => {
  it('produces legal complete solutions and the required mechanics across 1000 boards', () => {
    const signatures = new Set<string>();
    for (let seed = 1; seed <= 5; seed++) for (let order = 1; order <= 200; order++) {
      const level = generateLevel(seed, order), tier = difficultyFor(order);
      expect(level.width).toBe(tier.size); expect(level.height).toBe(tier.size);
      expect(level.arrows).toHaveLength(tier.count); expect(level.links).toHaveLength(tier.links);
      expect(new Set(level.arrows.map(a => `${a.x},${a.y}`)).size).toBe(tier.count);
      expect(level.arrows.every(a => a.x >= 0 && a.x < tier.size && a.y >= 0 && a.y < tier.size && a.dir >= 0 && a.dir <= 3)).toBe(true);
      expect(new Set(level.links.map(l => l.sourceId)).size).toBe(tier.links);
      expect(new Set(level.links.map(l => l.targetId)).size).toBe(tier.links);
      let attempt = newAttempt(level);
      for (const id of level.solutionWitness) {
        expect(legalMoves(level, attempt.arrows)).toContain(id);
        attempt = move(level, attempt, id).attempt;
      }
      expect(attempt.phase).toBe('won'); expect(attempt.arrows).toHaveLength(0);
      const signature = level.arrows.map(a => `${a.x},${a.y},${a.dir}`).sort().join('|') + JSON.stringify(level.links);
      signatures.add(signature);
      if (order === 1) {
        const profile = freshProfile(); profile.attempt = newAttempt(level);
        const arrow = introArrow(profile, level)!;
        expect(arrow).not.toBeNull(); expect(introPath(level, arrow).length).toBeGreaterThan(0);
      }
    }
    expect(signatures.size).toBe(1000);
  }, 30000);
  it('reconstructs the same board after cache eviction, across seeds and high orders', () => {
    const original = structuredClone(generateLevel(0xffffffff, 101));
    for (let i = 200; i < 240; i++) generateLevel(17, i);
    expect(levelById(original.id)).toEqual(original);
    expect(generateLevel(0xfffffffe, 101).arrows).not.toEqual(original.arrows);
    expect(generateLevel(17, 4294967400).solutionWitness.length).toBeGreaterThan(0);
    expect(generatedInfo('generated-v1-ffffffff-101')).toEqual({ seed: 0xffffffff, order: 101, legacy: false });
    for (const id of ['generated-v2-ffffffff-1', 'generated-v1-ffffffff-0', 'generated-v1-xfffffff-1', 'generated-v1-ffffffff-9007199254740992']) expect(generatedInfo(id)).toBeNull();
  });
  it('gives the hint solver solvable linked puzzles', () => {
    for (const order of [11, 12, 24, 39, 60, 99, 103, 106, 109]) {
      const level = generateLevel(123, order);
      expect(solve(level, level.arrows).status).toBe('solved');
    }
  });
  it('prepares fifty levels, tops up ten ahead and bounds retained boards', async () => {
    const campaign = new Campaign(123);
    await campaign.prepare(1); expect(campaign.available()).toHaveLength(50);
    const future = structuredClone(campaign.get(41));
    await campaign.prepare(39); expect(campaign.available()).toHaveLength(50);
    const alreadyPrepared = campaign.prepare(39), boundary = campaign.prepare(40);
    await Promise.all([alreadyPrepared, boundary]); expect(campaign.available()).toHaveLength(100);
    await campaign.prepare(40); expect(campaign.available()).toHaveLength(100);
    expect(campaign.get(41)).toEqual(future);
    await campaign.prepare(90); expect(campaign.available().map(l => l.order)).toEqual(Array.from({ length: 100 }, (_, i) => i + 51));
    await campaign.prepare(101); expect(campaign.available()).toHaveLength(50);
    const restored = new Campaign(123); await restored.prepare(101);
    expect(restored.get(101)).toEqual(campaign.get(101));
    const filling = campaign.prepare(140); const jump = campaign.prepare(1001);
    await Promise.all([filling, jump]);
    expect(campaign.available()).toHaveLength(50); expect(campaign.available()[0].order).toBe(1001);
  });
  it('starts fresh at generated level one and preserves existing progress', () => {
    const fresh = freshProfile(), first = initializeCampaign(fresh);
    expect(first.order).toBe(1); expect(first.seed).toBe(fresh.campaignSeed);
    expect(initializeCampaign(fresh)).toEqual(first);
    const old = freshProfile(); old.attempt = newAttempt(levels[39]);
    const attempt = structuredClone(old.attempt);
    expect(initializeCampaign(old).order).toBe(40); expect(old.attempt).toEqual(attempt);
    const current = freshProfile(); current.attempt = newAttempt(generateLevel(17, 101));
    expect(initializeCampaign(current)).toEqual({ seed: 17, order: 101 });
    const noAttempt = freshProfile(); noAttempt.completed = [levels[99].id, levels[0].id];
    expect(initializeCampaign(noAttempt).order).toBe(101);
  });
  it('saves moves, rotations, history and an idempotent victory on generated boards', () => {
    const level = generateLevel(42, 99); let p = freshProfile(); p.campaignSeed = 42; p.attempt = newAttempt(level);
    p.attempt = move(level, p.attempt, level.solutionWitness[0]).attempt;
    expect(decode(JSON.stringify(p))).toEqual(p);
    for (const id of level.solutionWitness.slice(1)) p.attempt = move(level, p.attempt, id).attempt;
    p = finish(p, level, facts, () => 0);
    expect(validProfile(p)).toBe(true);
    const restored = decode(JSON.stringify(p))!;
    expect(finish(restored, level, facts, () => .9)).toEqual(p);
    expect(validProfile({ ...p, campaignSeed: -1 })).toBe(false);
    expect(validProfile({ ...p, campaignSeed: 43 })).toBe(false);
    expect(validProfile({ ...p, campaignSeed: 4294967296 })).toBe(false);
    expect(validProfile({ ...p, attempt: { ...p.attempt, levelId: 'generated-v2-0000002a-99' } })).toBe(false);
  });
  it('keeps the next-level action beyond the old campaign boundary', () => {
    for (const order of [100, 101, 1001]) {
      const level = generateLevel(12, order), p = freshProfile();
      const html = victoryContent(p, level);
      expect(html).toContain('data-action="next"');
      expect(html).not.toContain('Пройти ещё раз'); expect(html).not.toContain('Все пути открыты');
    }
  });
});
