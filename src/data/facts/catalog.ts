import type { Fact, Topic } from '../../core/types';

type Card = readonly [id: string, title: string, text: string, detail: string];

// Authored cards grouped by primary source. IDs are permanent save keys.
export function cards(topic: Topic, source: string, sourceUrl: string, rows: readonly Card[]): Fact[] {
  return rows.map(([id, title, text, detail]) => ({ id, topic, title, text, detail,
    source, sourceUrl, verifiedAt: '2026-10-01' }));
}
