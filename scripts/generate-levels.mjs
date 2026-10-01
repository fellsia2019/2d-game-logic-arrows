import { readFileSync, writeFileSync } from 'node:fs';

// Offline authoring only. Runtime always loads the checked, fixed JSON campaign.
const file = new URL('../src/data/levels.json', import.meta.url);
const levels = JSON.parse(readFileSync(file, 'utf8')).slice(0, 12);
const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const blocked = (arrows, a) => arrows.some(b => b.id !== a.id &&
  (a.dir === 0 ? b.x === a.x && b.y < a.y : a.dir === 1 ? b.y === a.y && b.x > a.x :
    a.dir === 2 ? b.x === a.x && b.y > a.y : b.y === a.y && b.x < a.x));
const random = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const signature = l => l.arrows.map(a => `${a.x},${a.y},${a.dir}`).sort().join('|');
const seen = new Set(levels.map(signature));

for (let order = 13; order <= 100; order++) {
  const size = order <= 20 ? 4 + (order % 3 !== 0 ? 1 : 0) : order <= 40 || order % 10 === 0 ? 5 : 6;
  const count = Math.min(size * size - 4, Math.round(size * size * (.43 + order / 450)));
  const linkCount = order % 3 === 0 || order >= 40 && order % 4 === 1 ? Math.min(3, 1 + Math.floor(order / 35)) : 0;
  let level;
  for (let trial = 0; trial < 2000; trial++) {
    const rng = random(order * 104729 + trial * 8191), arrows = [], links = [], witness = [];
    const cells = Array.from({ length: size * size }, (_, i) => ({ x: i % size, y: Math.floor(i / size) }));
    for (let index = 0; index < count; index++) {
      const candidates = cells.flatMap(c => vectors.map((_, dir) => ({ ...c, dir, id: `a${index + 1}` }))).filter(a => !blocked(arrows, a));
      const arrow = candidates[Math.floor(rng() * candidates.length)];
      if (!arrow) break;
      cells.splice(cells.findIndex(c => c.x === arrow.x && c.y === arrow.y), 1);
      // Reverse a rotation on an already built suffix. Removing this new source
      // restores that suffix, so the reversed insertion order proves solvability.
      if (links.length < linkCount && index >= Math.floor(count / 3) &&
        (rng() < .5 || count - index <= linkCount - links.length)) {
        const targets = arrows.filter(a => !links.some(l => l.targetId === a.id));
        const target = targets[Math.floor(rng() * targets.length)];
        if (target) { target.dir = (target.dir + 3) % 4; links.push({ sourceId: arrow.id, targetId: target.id, quarterTurns: 1 }); }
      }
      arrows.push(arrow); witness.unshift(arrow.id);
    }
    level = { id: `level-${String(order).padStart(2, '0')}`, revision: 1, order,
      title: `${linkCount ? 'Повороты' : 'Свободные пути'} ${order}`, width: size, height: size,
      arrows, links, solutionWitness: witness };
    const openings = arrows.filter(a => !blocked(arrows, a)).length;
    if (arrows.length === count && links.length === linkCount && openings >= 2 && openings <= Math.ceil(count * .4) &&
      new Set(arrows.map(a => a.dir)).size >= 3 && !seen.has(signature(level))) break;
    level = undefined;
  }
  if (!level) throw Error(`No suitable level ${order}`);
  let remaining = structuredClone(level.arrows);
  for (const id of level.solutionWitness) {
    const arrow = remaining.find(a => a.id === id);
    if (!arrow || blocked(remaining, arrow)) throw Error(`Invalid witness: ${level.id}/${id}`);
    remaining = remaining.filter(a => a.id !== id).map(a => ({ ...a,
      dir: (a.dir + level.links.filter(l => l.sourceId === id && l.targetId === a.id).length) % 4 }));
  }
  seen.add(signature(level)); levels.push(level);
}
writeFileSync(file, JSON.stringify(levels, null, 2) + '\n');
console.log(`Authored ${levels.length} fixed levels; ${levels.filter(l => l.links.length).length} with rotations.`);
