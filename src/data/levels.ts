import definitions from './levels.json';
import type { Level } from '../core/types';
import { generatedInfo, generateLevel } from './generated-levels';
// Retain the old catalogue solely to read existing saves and regression tests.
export const levels = definitions as Level[];
export const isLevelId = (id: string): boolean => levels.some(l => l.id === id) || !!generatedInfo(id);
export const levelById = (id: string): Level => {
  const level = levels.find(l => l.id === id);
  if (level) return level;
  const info = generatedInfo(id);
  if (info) return generateLevel(info.seed, info.order, info.legacy);
  throw new Error(`Unknown level: ${id}`);
};
