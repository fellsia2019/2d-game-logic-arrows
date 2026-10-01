import type { Fact, Topic } from '../../core/types';
import { generalIgnoranceEntries } from './general-ignorance-data';

// Prefix these IDs so old profile rewards can never be mistaken for a new card.
const topics: Record<string, Topic> = {
  senses: 'human', 'brain-ten-percent': 'human', ulcer: 'human', carrots: 'human',
  'dog-years': 'nature', chilli: 'science', banana: 'nature',
  lemmings: 'nature', chameleons: 'nature', 'polar-skin': 'nature',
  'camel-hump': 'nature', 'rhino-horn': 'nature', ostrich: 'nature',
  flamingo: 'nature', goldfish: 'nature',
  antarctica: 'geography', 'mauna-kea': 'geography', richter: 'science',
  drain: 'science', raindrops: 'science', 'ocean-oxygen': 'science',
  'diamond-coal': 'science', 'water-colour': 'science', 'glass-flow': 'science',
  'great-wall': 'space', 'eight-planets': 'space', 'asteroid-belt': 'space',
  'day-length': 'space', 'dinosaurs-and-people': 'science', 'computer-bug': 'technology',
  'round-earth': 'history', 'panama-hat': 'history',
};

export const generalIgnoranceFacts: Fact[] = generalIgnoranceEntries.map(candidate => ({
  id: `ignorance-${candidate.id}`,
  topic: topics[candidate.id],
  title: candidate.ru.myth,
  text: candidate.ru.fact,
  detail: candidate.ru.detail,
  source: candidate.source,
  // URLs are editorial metadata. The game renders source names as plain text.
  sourceUrl: candidate.sourceUrl,
  verifiedAt: '2026-10-01',
}));
