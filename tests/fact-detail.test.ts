import { describe, expect, it } from 'vitest';
import { freshProfile } from '../src/core/profile';
import { facts } from '../src/data/facts';
import { detailExpansions } from '../src/data/facts/detail-expansions';
import { levels } from '../src/data/levels';
import { setLocale } from '../src/i18n';
import { localizedFact } from '../src/i18n/facts';
import { escape, victoryContent } from '../src/ui/render';

describe('long-form fact reading', () => {
  it('gives every released fact an original two-paragraph explanation in both languages', () => {
    expect(Object.keys(detailExpansions).sort()).toEqual(facts.filter(fact => !fact.id.startsWith('ignorance-') && !fact.id.startsWith('everyday-') && !fact.id.startsWith('verified-') && !fact.id.startsWith('new-')).map(fact => fact.id).sort());
    for (const fact of facts) {
      expect(fact.detail.split('\n\n'), fact.id).toHaveLength(2);
      expect(fact.detail.length, fact.id).toBeGreaterThan(180);
      setLocale('en');
      const english = localizedFact(fact);
      expect(english.detail.split('\n\n'), fact.id).toHaveLength(2);
      expect(english.detail.length, fact.id).toBeGreaterThan(180);
      expect(english.detail, fact.id).not.toMatch(/[А-Яа-яЁё]/);
      setLocale('ru');
    }
  });
  it('shows a concise victory card and a dedicated reading view with a way back', () => {
    const level = levels[0];
    const profile = freshProfile();
    profile.levelRewards[level.id] = facts[0].id;
    profile.best[level.id] = { stars: 3, hints: 0, timeMs: 0 };
    const concise = victoryContent(profile, level);
    expect(concise).toContain('Узнать больше');
    expect(concise).toContain('class="fact-reading" hidden');
    const reading = victoryContent(profile, level, true);
    expect(reading).toContain('class="fact-summary" hidden');
    expect(reading).toContain('К карточке');
    expect(reading).toContain('class="fact-reading"');
    expect(reading).toContain('fact-long-read');
    expect(reading).not.toMatch(/href=["']https?:\/\//);
    setLocale('en');
    expect(victoryContent(profile, level, true)).toContain('Back to card');
    setLocale('ru');
  });
  it('keeps the short factual context visible for every card in both reading languages', () => {
    const level = levels[0];
    const profile = freshProfile();
    for (const language of ['ru', 'en'] as const) {
      setLocale(language);
      for (const fact of facts) {
        profile.levelRewards[level.id] = fact.id;
        const html = victoryContent(profile, level, true);
        expect(html, `${language}: ${fact.id}`).toContain(`<p class="fact-reading-lead">${escape(localizedFact(fact).text)}</p>`);
        const lead = localizedFact(fact).text;
        if (language === 'ru') expect(lead, fact.id).not.toMatch(/^(?:он|она|оно|они|его|её|их|это|этот|эта|эти)(?=\s|[,.!?])/i);
        else expect(lead, fact.id).not.toMatch(/^(?:it|its|they|their|these|those|this|his|her)\b/i);
      }
    }
    setLocale('ru');
  });
  it('identifies the animal in the polar-bear swimming card without another card for context', () => {
    const fact = facts.find(fact => fact.id === 'polar-swimming')!;
    expect(fact.title).toContain('медведь');
    expect(fact.detail).toContain('Белый медведь');
    setLocale('en');
    const english = localizedFact(fact);
    expect(english.title).toContain('Polar bears');
    expect(english.detail).toContain('polar bear');
    setLocale('ru');
  });
});
