import { blocker, legalMoves, removeArrow } from '../core/rules';
import type { Arrow, Level, Link } from '../core/types';

// Keep v1 deterministic: saved IDs encode the seed and order, including retries.
const cache = new Map<string, Level>();
export function generatedInfo(id: string): { seed: number; order: number; legacy: boolean } | null {
  const match = /^(generated-v1|endless-v1)-([0-9a-f]{8})-([1-9]\d*)$/.exec(id);
  if (!match) return null;
  const order = Number(match[3]), legacy = match[1] === 'endless-v1';
  return Number.isSafeInteger(order) && order > (legacy ? 100 : 0) ? { seed: parseInt(match[2], 16), order, legacy } : null;
}
export const newLevelSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0];
const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
  value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
};
function checked(level: Level): boolean {
  let arrows = level.arrows;
  for (const id of level.solutionWitness) {
    if (!legalMoves(level, arrows).includes(id)) return false;
    arrows = removeArrow(level, arrows, id);
  }
  return !arrows.length;
}
export function difficultyFor(order: number): { size: number; count: number; links: number; teaching: boolean } {
  if (order <= 10) return { size: 4, count: order === 1 ? 3 : order === 2 ? 5 : Math.min(12, order + 4), links: 0, teaching: order <= 3 };
  if (order <= 12) return { size: 4, count: order === 11 ? 6 : 7, links: 1, teaching: true };
  if (order <= 20) return { size: 5, count: 9 + order % 4, links: order % 3 === 0 ? 1 : 0, teaching: false };
  if (order <= 40) return { size: 5, count: 12 + order % 5, links: order % 3 === 0 ? 1 + order % 2 : 0, teaching: false };
  if (order <= 60) return { size: 6, count: 16 + order % 5, links: order % 3 === 0 ? 1 + order % 2 : 0, teaching: false };
  if (order <= 100) return { size: 6, count: 20 + order % 4, links: order % 3 === 0 ? 2 + order % 2 : 0, teaching: false };
  const step = (order - 101) % 12;
  const size = [5, 6, 5, 6, 4, 6, 5, 6, 5, 6, 5, 6][step];
  return { size, count: Math.round(size * size * (.43 + (step % 4) * .06)), links: step % 3 === 2 ? 1 + Math.floor(step / 3) % 3 : step === 7 ? 2 : 0, teaching: false };
}
export function generateLevel(seed: number, order: number, legacy = false): Level {
  const id = `${legacy ? 'endless-v1' : 'generated-v1'}-${(seed >>> 0).toString(16).padStart(8, '0')}-${order}`;
  if (!generatedInfo(id)) throw Error('Invalid generated level ID');
  const saved = cache.get(id); if (saved) return saved;
  const settings = random((seed ^ Math.imul(order, 104729) ^ Math.floor(order / 4294967296)) >>> 0);
  // Difficulty varies instead of growing forever: short boards alternate with
  // denser puzzles. Linked boards have at most three sources and three targets.
  let { size, count, links: linkCount, teaching } = difficultyFor(order);
  if (legacy) {
    size = order % 8 === 0 ? 4 : settings() < .45 ? 5 : 6;
    count = Math.round(size * size * (.43 + settings() * .22));
    linkCount = order % 3 === 0 ? 1 + Math.floor(settings() * 3) : 0; teaching = false;
  }
  let result: Level | undefined;
  for (let trial = 0; trial < 120; trial++) {
    const rng = random((seed ^ Math.imul(order, 104729) ^ Math.imul(trial + 1, 8191) ^ (legacy ? 0 : Math.floor(order / 4294967296))) >>> 0);
    const arrows: Arrow[] = [], links: Link[] = [], witness: string[] = [];
    const cells = Array.from({ length: size * size }, (_, i) => ({ x: i % size, y: Math.floor(i / size) }));
    for (let index = 0; index < count; index++) {
      const candidates = cells.flatMap(c => [0, 1, 2, 3].map(dir => ({ ...c, dir: dir as Arrow['dir'], id: `a${index + 1}` })))
        .filter(a => !blocker({ width: size, height: size }, arrows, a));
      const arrow = candidates[Math.floor(rng() * candidates.length)];
      if (!arrow) break;
      cells.splice(cells.findIndex(c => c.x === arrow.x && c.y === arrow.y), 1);
      // Build backwards from a solved suffix. Removing the inserted source
      // restores the target rotation and the already proven suffix solution.
      if (links.length < linkCount && index >= Math.floor(count / 3) &&
        (rng() < .5 || count - index <= linkCount - links.length)) {
        const targets = arrows.filter(a => !links.some(l => l.targetId === a.id));
        const target = targets[Math.floor(rng() * targets.length)];
        if (target) { target.dir = (target.dir + 3) % 4 as Arrow['dir']; links.push({ sourceId: arrow.id, targetId: target.id, quarterTurns: 1 }); }
      }
      arrows.push(arrow); witness.unshift(arrow.id);
    }
    const candidate: Level = { id, revision: 1, order, title: links.length ? 'Новые повороты' : 'Новый маршрут',
      width: size, height: size, arrows, links, solutionWitness: witness };
    const openings = legalMoves(candidate, arrows).length;
    const introHasPath = legacy || order !== 1 || (() => {
      const first = arrows.find(a => a.id === witness[0])!;
      return first.dir === 0 ? first.y > 0 : first.dir === 1 ? first.x < size - 1 : first.dir === 2 ? first.y < size - 1 : first.x > 0;
    })();
    if (arrows.length === count && links.length === linkCount && openings >= (order === 1 ? 1 : 2) &&
      openings <= (order <= 3 ? count : Math.ceil(count * .5)) && new Set(arrows.map(a => a.dir)).size >= (order <= 3 ? 2 : 3) && introHasPath && checked(candidate)) {
      result = candidate; break;
    }
  }
  // A bounded generator always returns a valid board, even if quality retries
  // fail. This simple fallback has an explicit top-to-bottom solution.
  if (!result) {
    const arrows: Arrow[] = Array.from({ length: count }, (_, i) => ({ id: `a${i + 1}`, x: i % size, y: Math.floor(i / size), dir: 0 }));
    result = { id, revision: 1, order, title: 'Новый маршрут', width: size, height: size, arrows, links: [], solutionWitness: arrows.map(a => a.id) };
    if (!legacy) {
      for (let i = 0; i < linkCount; i++) {
        arrows[size + i].dir = 3;
        result.links.push({ sourceId: arrows[i].id, targetId: arrows[size + i].id, quarterTurns: 1 });
      }
      if (order === 1) { arrows[2].dir = 2; result.solutionWitness = ['a3', 'a1', 'a2']; }
      if (linkCount) result.title = 'Новые повороты';
    }
  }
  result.teaching = teaching;
  if (teaching && order !== 1) result.tutorial = order === 11 || order === 12
    ? 'Стрелка со знаком поворота разворачивает связанную стрелку на 90° по часовой стрелке.'
    : 'Сначала убери стрелку, перед которой свободен путь.';
  if (cache.size >= 32) cache.delete(cache.keys().next().value!);
  cache.set(id, result); return result;
}
