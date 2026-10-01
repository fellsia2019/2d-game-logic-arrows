import { afterEach, describe, expect, it, vi } from 'vitest';
import ts from 'typescript';
import { finish, freshProfile } from '../src/core/profile';
import { move, newAttempt } from '../src/core/rules';
import { levels } from '../src/data/levels';
import { facts, TOPIC_LABELS } from '../src/data/facts';
import { generateLevel } from '../src/data/generated-levels';
import { portalLocale, setLocale, setAutomaticLocale, setLanguagePreference, languagePreference, t, locale } from '../src/i18n';
import { englishUI } from '../src/i18n/ui.en';
import { englishFacts } from '../src/i18n/facts.en';
import { localizedFact } from '../src/i18n/facts';
import { render, type View, type Modal } from '../src/ui/render';
import { YandexAdapter, type Sdk } from '../src/platform/yandex';
import { decode } from '../src/platform/save';

const uiSources = import.meta.glob<string>('../src/{main,ui/*}.ts', { query: '?raw', import: 'default', eager: true });
const cyrillic = /[А-Яа-яЁё]/;
afterEach(() => { vi.unstubAllGlobals(); setLanguagePreference('auto'); setAutomaticLocale('ru'); });
const withoutNativeLanguageName = (html: string) => html.replace(/<option value="ru" lang="ru"[^>]*>Русский<\/option>/g, '');
function view(level = levels[0]): View {
  const profile = freshProfile(); profile.attempt = newAttempt(level);
  return { profile, level, modal: null, status: '', hint: null, error: null, blocker: null,
    busy: false, externalPause: false, saveStatus: '', sdk: true, collectionTopic: 'all',
    query: '', favoritesOnly: false, detailOpen: false, intro: null };
}
describe('Russian and English localization', () => {
  it('uses the Yandex fallback language sets and normalizes browser language tags', () => {
    for (const language of ['ru', 'be', 'kk', 'uk', 'uz', 'UK-ua', 'ru_RU']) expect(portalLocale(language)).toBe('ru');
    for (const language of ['en', 'en-US', 'tr', 'de', 'ja', 'az', '']) expect(portalLocale(language)).toBe('en');
  });
  it('has translations for every literal UI key and all legacy and generated tutorials', () => {
    expect(Object.keys(uiSources)).toContain('../src/main.ts');
    expect(Object.keys(uiSources)).toContain('../src/ui/render.ts');
    for (const [path, code] of Object.entries(uiSources)) {
      const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true);
      const inspect = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['t', 'tr'].includes(node.expression.text)) {
          const key = node.arguments[0];
          if (key && ts.isStringLiteral(key)) expect(englishUI[key.text], `${path}: ${key.text}`).toBeTruthy();
        }
        ts.forEachChild(node, inspect);
      };
      inspect(source);
    }
    setLocale('en');
    for (const level of [...levels, generateLevel(123, 2), generateLevel(123, 11)]) {
      expect(t(level.title)).not.toMatch(cyrillic);
      expect(t(level.tutorial ?? '')).not.toMatch(cyrillic);
    }
    for (const name of Object.values(TOPIC_LABELS)) expect(t(name)).not.toMatch(cyrillic);
  });
  it('rejects untranslated source literals, template fragments, and blank dictionary entries', () => {
    for (const [path, code] of Object.entries(uiSources)) {
      const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true);
      const inspect = (node: ts.Node) => {
        if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ||
          ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) && cyrillic.test(node.text)) {
          const parent = node.parent;
          expect(ts.isCallExpression(parent) && ts.isIdentifier(parent.expression) &&
            ['t', 'tr'].includes(parent.expression.text), `${path}: untranslated ${node.text}`).toBe(true);
        }
        ts.forEachChild(node, inspect);
      };
      inspect(source);
    }
    for (const [key, value] of Object.entries(englishUI)) {
      expect(value.trim(), key).not.toBe('');
      if (key === 'Русский') expect(value).toBe('Русский');
      else expect(value, key).not.toMatch(cyrillic);
    }
  });
  it('preserves actual saved attempts, rewards, and favorites through both languages in every phase', () => {
    const tutorial = levels[11];
    const makeProfile = () => {
      const p = freshProfile(); p.attempt = newAttempt(tutorial); p.hints = 0; p.introSeen = true;
      p.unlocked = ['venus-rotation']; p.favorites = ['venus-rotation']; return p;
    };
    const snapshots = [makeProfile()];
    const lost = makeProfile(); Object.assign(lost.attempt!, { mistakesUsed: 3, totalMistakes: 3, phase: 'lost' }); snapshots.push(lost);
    const deadlock = makeProfile(); for (const id of ['A', 'D', 'E']) deadlock.attempt = move(tutorial, deadlock.attempt!, id).attempt; snapshots.push(deadlock);
    const won = makeProfile(); for (const id of tutorial.solutionWitness) won.attempt = move(tutorial, won.attempt!, id).attempt;
    snapshots.push(finish(won, tutorial, facts, () => 0));
    for (const original of snapshots) {
      const raw = JSON.stringify(original);
      for (const language of ['en', 'ru', 'en'] as const) {
        setLocale(language); const restored = decode(raw)!; expect(restored).toEqual(original);
        const afterFinish = finish(restored, tutorial, facts, () => 0.9);
        expect(afterFinish).toEqual(original);
        const v = view(tutorial); v.profile = restored;
        const html = render(v); if (language === 'en') expect(withoutNativeLanguageName(html)).not.toMatch(cyrillic);
        expect(JSON.stringify(restored)).toBe(raw);
      }
    }
  });
  it('translates exactly all 160 facts while preserving identity, sources, and saved progress', () => {
    expect(Object.keys(englishFacts).sort()).toEqual(facts.map(f => f.id).sort());
    const v = view(); v.profile.unlocked = facts.map(f => f.id); v.profile.favorites = [facts[0].id];
    const saved = JSON.stringify(v.profile);
    setLocale('en');
    for (const fact of facts) {
      const en = localizedFact(fact);
      expect(en.id).toBe(fact.id); expect(en.topic).toBe(fact.topic);
      expect(en.sourceUrl).toBe(fact.sourceUrl); expect(en.verifiedAt).toBe(fact.verifiedAt);
      for (const value of [en.title, en.text, en.detail, en.source]) {
        expect(value.length).toBeGreaterThan(0); expect(value).not.toMatch(cyrillic);
      }
      v.profile.levelRewards[v.level.id] = fact.id;
      v.profile.attempt!.phase = 'won';
      expect(withoutNativeLanguageName(render(v))).not.toMatch(cyrillic);
    }
    expect(decode(saved)).toEqual(JSON.parse(saved));
    setLocale('ru');
    for (const fact of facts) expect(localizedFact(fact)).toBe(fact);
  });
  it('keeps all screens and accessibility labels in English, including ad offers and errors', () => {
    setLocale('en');
    for (const modal of [null, 'pause', 'collection', 'topics', 'settings', 'restart', 'hint-offer'] satisfies Modal[]) {
      for (const sdk of [false, true]) {
        const v = view(); v.modal = modal; v.sdk = sdk; v.profile.hints = 0;
        v.profile.unlocked = facts.map(f => f.id);
        expect(withoutNativeLanguageName(render(v)), `${modal}, SDK ${sdk}`).not.toMatch(cyrillic);
      }
    }
    for (const phase of ['lost', 'deadlock', 'won'] as const) {
      const v = view(levels[11]); v.profile.attempt!.phase = phase;
      expect(render(v)).not.toMatch(cyrillic);
    }
    const v = view(); v.externalPause = true;
    expect(render(v)).toContain('Game paused');
    v.storageNotice = t('Сохранение удалено. Обнови страницу, чтобы начать с первого уровня.');
    expect(render(v)).not.toMatch(cyrillic);
    v.storageNotice = null; v.externalPause = false;
    v.intro = { arrow: v.level.arrows[0], phase: 'reveal', elapsed: 0 };
    expect(render(v)).not.toMatch(cyrillic);
  });
  it('searches localized fact text and escapes user input without translating it', () => {
    setLocale('en'); const v = view(); v.modal = 'collection'; v.profile.unlocked = ['venus-rotation', 'mars-rust'];
    v.query = 'Venus'; expect(render(v)).toContain('A year shorter than a rotation'); expect(render(v)).not.toContain('Red because of iron');
    v.query = '<script>Играть</script>'; expect(render(v)).toContain('&lt;script&gt;Играть&lt;/script&gt;');
  });
  it('keeps automatic detection as the default and remembers only ru or en as manual choices', () => {
    const oldProfile = freshProfile(); delete oldProfile.settings.language;
    expect(decode(JSON.stringify(oldProfile))?.settings.language).toBeUndefined();
    expect(freshProfile().settings.language).toBe('auto');
    setAutomaticLocale('en'); expect(locale()).toBe('en');
    setLanguagePreference('ru'); expect(languagePreference()).toBe('ru'); expect(locale()).toBe('ru');
    setAutomaticLocale('en'); expect(locale()).toBe('ru');
    setLanguagePreference('en'); expect(locale()).toBe('en');
    setAutomaticLocale('ru'); expect(locale()).toBe('en');
    setLanguagePreference('auto'); expect(locale()).toBe('ru');
    for (const language of ['auto', 'ru', 'en'] as const) {
      const profile = freshProfile(); profile.settings.language = language;
      expect(decode(JSON.stringify(profile))?.settings.language).toBe(language);
    }
    const invalid = freshProfile(); Object.assign(invalid.settings, { language: 'tr' });
    expect(decode(JSON.stringify(invalid))).toBeNull();
  });
  it('shows both language names in their own languages with a discoverable settings control', () => {
    setLocale('en'); const v = view(); v.modal = 'settings'; v.profile.settings.language = 'ru';
    const html = render(v);
    expect(html).toContain('id="language-choice"');
    expect(html).toContain('<option value="ru" lang="ru" selected>Русский</option>');
    expect(html).toContain('<option value="en" lang="en" >English</option>');
    expect(withoutNativeLanguageName(html)).not.toMatch(cyrillic);
  });
  it('applies the SDK language before Game Ready and overrides the initial local locale', async () => {
    const metadata = { documentElement: { lang: 'ru' }, title: '', querySelector: vi.fn(() => null) };
    vi.stubGlobal('document', metadata);
    const ready = vi.fn(() => { expect(locale()).toBe('en'); expect(metadata.documentElement.lang).toBe('en'); expect(metadata.title).toBe('Solve & Discover'); });
    const sdk: Sdk = { environment: { i18n: { lang: 'en' } }, features: { LoadingAPI: { ready } }, on: vi.fn(),
      adv: { showRewardedVideo: vi.fn(), showFullscreenAdv: vi.fn() } };
    setLocale('ru');
    const adapter = new YandexAdapter(vi.fn(), async () => sdk);
    expect(await adapter.initialize()).toBe(true); expect(adapter.language).toBe('en');
    expect(ready).not.toHaveBeenCalled(); adapter.markReady(); expect(ready).toHaveBeenCalledOnce();
    sdk.environment.i18n.lang = 'uk';
    const another = new YandexAdapter(vi.fn(), async () => sdk); await another.initialize(); expect(locale()).toBe('ru');
  });
});
