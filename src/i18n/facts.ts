import type { Fact } from '../core/types';
import { englishFacts } from './facts.en';
import { detailExpansions } from '../data/facts/detail-expansions';
import { generalIgnoranceEntries } from '../data/facts/general-ignorance-data';
import { everydayEnglish } from '../data/facts/everyday';
import { verifiedEnglish } from '../data/facts/verified-expansion';
import { secondExpansionEnglish } from '../data/facts/verified-expansion-2';
import { locale } from './index';
export function localizedFact(fact: Fact): Fact {
  if (locale() === 'ru') return fact;
  if (fact.id.startsWith('ignorance-')) {
    const candidate = generalIgnoranceEntries.find(item => `ignorance-${item.id}` === fact.id);
    if (!candidate) throw new Error(`Missing English fact: ${fact.id}`);
    return { ...fact, title: candidate.en.myth, text: candidate.en.fact, detail: candidate.en.detail };
  }
  if (fact.id.startsWith('everyday-')) {
    const translated = everydayEnglish[fact.id];
    if (!translated) throw new Error(`Missing English fact: ${fact.id}`);
    return { ...fact, ...translated };
  }
  if (fact.id.startsWith('verified-')) {
    const translated = verifiedEnglish[fact.id];
    if (!translated) throw new Error(`Missing English fact: ${fact.id}`);
    return { ...fact, ...translated };
  }
  if (fact.id.startsWith('new-')) {
    const translated = secondExpansionEnglish[fact.id];
    if (!translated) throw new Error(`Missing English fact: ${fact.id}`);
    return { ...fact, ...translated };
  }
  const translated = englishFacts[fact.id];
  if (!translated) throw new Error(`Missing English fact: ${fact.id}`);
  return { ...fact, title: translated[0], text: translated[1],
    detail: `${translated[2]}\n\n${detailExpansions[fact.id]?.[1] ?? ''}`.trim(),
    source: fact.source.replace('Лувр', 'Louvre') };
}
