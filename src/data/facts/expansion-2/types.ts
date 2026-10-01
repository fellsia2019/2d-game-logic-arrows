import type { Fact, Topic } from '../../../core/types';

export type Copy = readonly [title: string, text: string, first: string, second: string];
export type Row = readonly [id: string, ru: Copy, en: Copy, sourceUrlOverride?: string];
export type Group = readonly [topic: Topic, source: string, sourceUrl: string, rows: readonly Row[]];
export type Entry = { fact: Fact; en: { title: string; text: string; detail: string } };

export function build(groups: readonly Group[]): Entry[] {
  return groups.flatMap(([topic, source, sourceUrl, rows]) => rows.map(([id, ru, en, sourceUrlOverride]) => ({
    fact: { id: `new-${id}`, topic, title: ru[0], text: ru[1], detail: `${ru[2]}\n\n${ru[3]}`,
      source, sourceUrl: sourceUrlOverride ?? sourceUrl, verifiedAt: '2026-10-01' },
    en: { title: en[0], text: en[1], detail: `${en[2]}\n\n${en[3]}` },
  })));
}
