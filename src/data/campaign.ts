import type { Level, Profile } from '../core/types';
import { generateLevel, generatedInfo, newLevelSeed } from './generated-levels';
import { levelById } from './levels';

export function initializeCampaign(profile: Profile): { seed: number; order: number } {
  profile.campaignSeed ??= (profile.attempt && generatedInfo(profile.attempt.levelId)?.seed) ?? newLevelSeed();
  const order = profile.attempt ? levelById(profile.attempt.levelId).order
    : profile.completed.reduce((last, id) => Math.max(last, generatedInfo(id)?.order ?? levelById(id).order), 0) + 1;
  return { seed: profile.campaignSeed, order };
}

export class Campaign {
  private prepared = new Map<number, Level>();
  private from = 1;
  private through = 50;
  private filling: Promise<void> | null = null;
  constructor(readonly seed: number) {}
  get(order: number): Level { return this.prepared.get(order) ?? generateLevel(this.seed, order); }
  available(): Level[] { return [...this.prepared.values()].sort((a, b) => a.order - b.order); }
  prepare(order: number): Promise<void> {
    this.from = Math.floor((order - 1) / 50) * 50 + 1;
    this.through = (Math.floor((order + 10) / 50) + 1) * 50;
    for (const index of this.prepared.keys()) {
      if (index < this.from || index > this.through) this.prepared.delete(index);
    }
    return this.ensurePrepared();
  }
  private ensurePrepared(): Promise<void> {
    if (this.available().length === this.through - this.from + 1) return Promise.resolve();
    this.filling ??= this.fill().finally(() => { this.filling = null; });
    return this.filling.then(() => this.ensurePrepared());
  }
  private async fill(): Promise<void> {
    let batch = 0;
    for (;;) {
      let missing = this.from;
      while (missing <= this.through && this.prepared.has(missing)) missing++;
      if (missing > this.through) return;
      this.prepared.set(missing, generateLevel(this.seed, missing));
      if (++batch === 5) { batch = 0; await new Promise<void>(resolve => setTimeout(resolve, 0)); }
    }
  }
}
