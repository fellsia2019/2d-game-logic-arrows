import { solve } from './solve';
import type { Arrow, Level } from '../core/types';
self.onmessage = (event: MessageEvent<{ requestId: number; level: Level; arrows: Arrow[] }>) => {
  self.postMessage({ requestId: event.data.requestId, solution: solve(event.data.level, event.data.arrows) });
};
