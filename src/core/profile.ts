import { TOPICS, type Attempt, type Fact, type Level, type Profile, type Result, type Topic } from './types';
import { continueAttempt } from './rules';
export function freshProfile(): Profile {
  return { version: 1, revision: 0, completed: [], best: {}, levelRewards: {}, unlocked: [], favorites: [],
    topics: [...TOPICS], rewardCursor: 0, introSeen: false, hints: 5, attempt: null, receipts: [],
    settings: { music: true, sound: true, reducedMotion: false } };
}
export function toggleTopic(profile: Profile, topic: Topic): Profile {
  if (profile.topics.includes(topic)) return profile.topics.length === 1 ? profile : { ...profile, topics: profile.topics.filter(t => t !== topic) };
  return { ...profile, topics: TOPICS.filter(t => t === topic || profile.topics.includes(t)) };
}
export function finish(profile: Profile, level: Level, facts: Fact[]): Profile {
  const attempt = profile.attempt;
  if (!attempt || attempt.phase !== 'won' || attempt.levelId !== level.id) return profile;
  const result: Result = { stars: attempt.continued ? 1 : attempt.totalMistakes ? 1 : attempt.hintsUsed ? 2 : 3,
    hints: attempt.hintsUsed, timeMs: attempt.activeMs };
  const prior = profile.best[level.id];
  const better = !prior || result.stars > prior.stars || (result.stars === prior.stars &&
    (result.hints < prior.hints || (result.hints === prior.hints && result.timeMs < prior.timeMs)));
  const next = { ...profile, best: better ? { ...profile.best, [level.id]: result } : profile.best };
  if (profile.completed.includes(level.id)) return next;
  const topics = TOPICS.filter(t => profile.topics.includes(t));
  let chosen: Fact | undefined, cursor = profile.rewardCursor;
  for (let i = 0; i < topics.length; i++) {
    const index = (profile.rewardCursor + i) % topics.length;
    chosen = facts.find(f => f.topic === topics[index] && !profile.unlocked.includes(f.id));
    if (chosen) { cursor = (index + 1) % topics.length; break; }
  }
  if (!chosen) {
    const topic = topics[profile.rewardCursor % topics.length];
    const eligible = facts.filter(f => f.topic === topic);
    chosen = eligible[profile.completed.length % eligible.length];
    cursor = (profile.rewardCursor + 1) % topics.length;
  }
  if (!chosen) throw new Error('Topic has no facts');
  return { ...next, completed: [...profile.completed, level.id], levelRewards: { ...profile.levelRewards, [level.id]: chosen.id },
    unlocked: profile.unlocked.includes(chosen.id) ? profile.unlocked : [...profile.unlocked, chosen.id], rewardCursor: cursor };
}
export function grantReward(profile: Profile, receipt: string, placement: 'hint' | 'continue', attemptId: string): Profile {
  if (profile.receipts.includes(receipt)) return profile;
  const next = { ...profile, receipts: [...profile.receipts.slice(-127), receipt] };
  if (placement === 'hint') return { ...next, hints: profile.hints + 1 };
  if (profile.attempt?.id !== attemptId) return next;
  return { ...next, attempt: continueAttempt(profile.attempt as Attempt) };
}
