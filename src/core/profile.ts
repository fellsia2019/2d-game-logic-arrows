import { TOPICS, type Attempt, type Fact, type Level, type Profile, type Result, type Topic } from './types';
import { continueAttempt } from './rules';
export function freshProfile(): Profile {
  return { version: 1, revision: 0, completed: [], best: {}, levelRewards: {}, unlocked: [], favorites: [],
    topics: [...TOPICS], rewardCursor: 0, introSeen: false, hints: 5, attempt: null, receipts: [],
    settings: { music: true, sound: true, reducedMotion: false, language: 'auto' } };
}
export function toggleTopic(profile: Profile, topic: Topic): Profile {
  if (profile.topics.includes(topic)) return profile.topics.length === 1 ? profile : { ...profile, topics: profile.topics.filter(t => t !== topic) };
  return { ...profile, topics: TOPICS.filter(t => t === topic || profile.topics.includes(t)) };
}
export function finish(profile: Profile, level: Level, facts: Fact[], random: () => number = Math.random): Profile {
  const attempt = profile.attempt;
  if (!attempt || attempt.phase !== 'won' || attempt.levelId !== level.id) return profile;
  const result: Result = { stars: attempt.continued ? 1 : attempt.totalMistakes ? 1 : attempt.hintsUsed ? 2 : 3,
    hints: attempt.hintsUsed, timeMs: attempt.activeMs };
  const prior = profile.best[level.id];
  const better = !prior || result.stars > prior.stars || (result.stars === prior.stars &&
    (result.hints < prior.hints || (result.hints === prior.hints && result.timeMs < prior.timeMs)));
  const next = { ...profile, best: better ? { ...profile.best, [level.id]: result } : profile.best };
  if (profile.lastFactReward?.attemptId === attempt.id) return next;
  const eligible = facts.filter(f => profile.topics.includes(f.topic));
  const unseen = eligible.filter(f => !profile.unlocked.includes(f.id));
  const repeats = eligible.filter(f => f.id !== profile.lastFactReward?.factId);
  const pool = unseen.length ? unseen : repeats.length ? repeats : eligible;
  const chosen = pool[Math.floor(random() * pool.length)];
  if (!chosen) throw new Error('Topic has no facts');
  const isNew = !profile.unlocked.includes(chosen.id);
  return { ...next, completed: profile.completed.includes(level.id) ? profile.completed : [...profile.completed, level.id],
    levelRewards: { ...profile.levelRewards, [level.id]: chosen.id },
    unlocked: isNew ? [...profile.unlocked, chosen.id] : profile.unlocked,
    lastFactReward: { attemptId: attempt.id, levelId: level.id, factId: chosen.id, isNew } };
}
export function grantReward(profile: Profile, receipt: string, placement: 'hint' | 'continue', attemptId: string): Profile {
  if (profile.receipts.includes(receipt)) return profile;
  const next = { ...profile, receipts: [...profile.receipts.slice(-127), receipt] };
  if (placement === 'hint') return { ...next, hints: profile.hints + 1 };
  if (profile.attempt?.id !== attemptId) return next;
  return { ...next, attempt: continueAttempt(profile.attempt as Attempt) };
}
