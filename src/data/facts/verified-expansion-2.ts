import type { Fact } from '../../core/types';
import { build } from './expansion-2/types';
import { spaceGroups } from './expansion-2/space';
import { natureGroups } from './expansion-2/nature';
import { scienceGroups } from './expansion-2/science';
import { geographyGroups } from './expansion-2/geography';
import { cultureGroups } from './expansion-2/culture';

const entries = build([...spaceGroups, ...natureGroups, ...scienceGroups, ...geographyGroups, ...cultureGroups]);
export const secondExpansionFacts: Fact[] = entries.map(entry => entry.fact);
export const secondExpansionEnglish: Record<string, (typeof entries)[number]['en']> = Object.fromEntries(entries.map(entry => [entry.fact.id, entry.en]));
