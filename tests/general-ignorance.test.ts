import { describe, expect, it } from 'vitest';
import { facts } from '../src/data/facts';
import { generalIgnoranceEntries, generalIgnoranceCategories } from '../src/data/facts/general-ignorance-data';
import { freshProfile } from '../src/core/profile';
import { levels } from '../src/data/levels';
import { setLocale } from '../src/i18n';
import { localizedFact } from '../src/i18n/facts';
import { victoryContent } from '../src/ui/render';

describe('published general ignorance facts', () => {
  it('publishes all 32 bilingual facts while preserving their source metadata', () => {
    expect(generalIgnoranceEntries).toHaveLength(32);
    const liveIds = new Set(facts.map(fact => fact.id));
    const candidateIds = new Set<string>();
    for (const candidate of generalIgnoranceEntries) {
      expect(candidateIds.has(candidate.id)).toBe(false);
      expect(liveIds.has(`ignorance-${candidate.id}`)).toBe(true);
      candidateIds.add(candidate.id);
      expect(generalIgnoranceCategories[candidate.category]).toBeDefined();
      expect(candidate.ru.myth.trim()).not.toBe('');
      expect(candidate.ru.fact.trim()).not.toBe('');
      expect(candidate.ru.detail.trim().length, candidate.id).toBeGreaterThan(150);
      expect(candidate.ru.detail.split('\n\n'), candidate.id).toHaveLength(2);
      expect(candidate.en.myth.trim()).not.toBe('');
      expect(candidate.en.fact.trim()).not.toBe('');
      expect(candidate.en.detail.trim().length, candidate.id).toBeGreaterThan(150);
      expect(candidate.en.detail.split('\n\n'), candidate.id).toHaveLength(2);
      expect(new URL(candidate.sourceUrl).protocol).toBe('https:');
    }
  });
  it('keeps excluded topics out of both languages and source links out of the game', () => {
    const excluded = /(?<![А-Яа-яЁё])(?:политик|религи|войн|военн|оружи|сражен|битв|жрец|будд|библи[яиюе]|шлем)|\bpolitic|\breligion|\bmilitary|\bwarfare|\bbattle|\bweapon|\bpriest|\bbuddh|\bbible|\bhelmet/i;
    for (const fact of facts) {
      const ru = `${fact.title} ${fact.text} ${fact.detail} ${fact.source}`;
      expect(ru, fact.id).not.toMatch(excluded);
      setLocale('en');
      const en = localizedFact(fact);
      expect(`${en.title} ${en.text} ${en.detail}`, fact.id).not.toMatch(excluded);
      setLocale('ru');
    }
    const fact = facts.find(item => item.id === 'ignorance-senses')!;
    const profile = freshProfile();
    profile.levelRewards[levels[0].id] = fact.id;
    profile.best[levels[0].id] = { stars: 3, hints: 0, timeMs: 0 };
    const card = victoryContent(profile, levels[0], true);
    expect(card).toContain(fact.source);
    expect(card).not.toContain(fact.sourceUrl);
    expect(card).not.toMatch(/<a\b|href=/);
  });
});
