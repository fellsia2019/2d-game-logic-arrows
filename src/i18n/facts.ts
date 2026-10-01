import type { Fact } from '../core/types';
import { englishFacts } from './facts.en';
import { locale } from './index';
export function localizedFact(fact: Fact): Fact {
  if (locale() === 'ru') return fact;
  const translated = englishFacts[fact.id];
  if (!translated) throw new Error(`Missing English fact: ${fact.id}`);
  return { ...fact, title: translated[0], text: translated[1], detail: translated[2],
    source: fact.source.replace('Лувр', 'Louvre') };
}
