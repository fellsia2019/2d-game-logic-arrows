export type Direction = 0 | 1 | 2 | 3;
export interface Arrow { id: string; x: number; y: number; dir: Direction }
export interface Link { sourceId: string; targetId: string; quarterTurns: 1 }
export interface Level {
  id: string; revision: number; order: number; title: string;
  width: number; height: number; arrows: Arrow[]; links: Link[];
  tutorial?: string; teaching?: boolean; solutionWitness: string[];
}
export type Phase = 'playing' | 'deadlock' | 'won' | 'lost';
export interface Attempt {
  id: string; levelId: string; levelRevision: number;
  arrows: Arrow[]; history: Arrow[][]; phase: Phase; stateRevision: number;
  mistakesUsed: number; totalMistakes: number; hintsUsed: number;
  undosUsed: number; activeMs: number; continued: boolean;
}
export const TOPICS = ['space', 'nature', 'technology', 'art'] as const;
export type Topic = typeof TOPICS[number];
export interface Fact {
  id: string; topic: Topic; title: string; text: string; detail: string;
  source: string; sourceUrl: string; verifiedAt: string;
}
export interface Result { stars: number; hints: number; timeMs: number }
export interface Profile {
  version: 1; revision: number; completed: string[];
  best: Record<string, Result>; levelRewards: Record<string, string>;
  unlocked: string[]; favorites: string[]; topics: Topic[]; rewardCursor: number;
  hints: number; attempt: Attempt | null; receipts: string[];
  introSeen?: boolean;
  settings: { music?: boolean; sound: boolean; reducedMotion: boolean };
}
export const copyArrows = (arrows: Arrow[]): Arrow[] => arrows.map(a => ({ ...a }));
