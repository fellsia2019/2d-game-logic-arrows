import definitions from './levels.json';
import type { Level } from '../core/types';
export const levels = definitions as Level[];
export const levelById = (id: string): Level => {
  const level = levels.find(l => l.id === id);
  if (!level) throw new Error(`Unknown level: ${id}`);
  return level;
};
