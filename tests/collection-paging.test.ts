import { describe, expect, it } from 'vitest';
import { freshProfile } from '../src/core/profile';
import { newAttempt } from '../src/core/rules';
import { facts } from '../src/data/facts';
import { levels } from '../src/data/levels';
import { setLocale } from '../src/i18n';
import { render, type View } from '../src/ui/render';

describe('large collection', () => {
  it('renders unlocked cards in pages but searches every unlocked fact in either language', () => {
    const level = levels[0];
    const profile = freshProfile();
    profile.attempt = newAttempt(level);
    profile.unlocked = facts.slice(0, 120).map(fact => fact.id);
    const view: View = { profile, level, modal: 'collection', status: '', hint: null,
      error: null, blocker: null, busy: false, externalPause: false, saveStatus: '', sdk: false,
      collectionTopic: 'all', query: '', favoritesOnly: false, detailOpen: false, intro: null };
    setLocale('ru');
    const first = render(view);
    expect(first.match(/class="fact-card large/g)).toHaveLength(60);
    expect(first).toContain('Показать ещё');
    const next = render({ ...view, collectionLimit: 120 });
    expect(next.match(/class="fact-card large/g)).toHaveLength(120);
    expect(next).not.toContain('Показать ещё');
    view.query = facts[0].title;
    expect(render(view)).toContain(`data-explain="${facts[0].id}"`);
    setLocale('en');
    view.query = 'venus';
    expect(render(view)).toContain(`data-explain="${facts[0].id}"`);
    setLocale('ru');
  });
});
