import { freshProfile } from '../core/profile';
import { fieldPhase } from '../core/rules';
import { TOPICS, type Arrow, type Attempt, type Profile } from '../core/types';
import { levels } from '../data/levels';
import { facts } from '../data/facts';
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export const SAVE_KEY = 'osvobodi-pole-profile-v1';
export const BACKUP_KEY = SAVE_KEY + '-backup';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string') && new Set(v).size === v.length;
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validArrows(value: unknown, levelId: string): value is Arrow[] {
  const level = levels.find(l => l.id === levelId);
  if (!level || !Array.isArray(value) || value.length > level.arrows.length) return false;
  const seen = new Set<string>();
  return value.every(a => {
    if (!record(a) || typeof a.id !== 'string' || seen.has(a.id) || !integer(a.dir, 0, 3)) return false;
    const original = level.arrows.find(t => t.id === a.id); seen.add(a.id);
    return !!original && a.x === original.x && a.y === original.y;
  });
}
export function validAttempt(v: unknown): v is Attempt {
  if (!record(v) || typeof v.id !== 'string' || !v.id || typeof v.levelId !== 'string') return false;
  const level = levels.find(l => l.id === v.levelId);
  if (!level || v.levelRevision !== level.revision || !validArrows(v.arrows, level.id)) return false;
  if (!Array.isArray(v.history) || v.history.length > level.arrows.length || !v.history.every(s => validArrows(s, level.id))) return false;
  if (!['stateRevision', 'totalMistakes', 'hintsUsed', 'undosUsed', 'activeMs'].every(k => integer(v[k]))) return false;
  if (!integer(v.mistakesUsed, 0, 3) || (v.totalMistakes as number) < v.mistakesUsed || typeof v.continued !== 'boolean') return false;
  const phase = v.mistakesUsed === 3 ? 'lost' : fieldPhase(level, v.arrows);
  return v.phase === phase;
}
export function validProfile(v: unknown): v is Profile {
  if (!record(v) || v.version !== 1 || !integer(v.revision) || !integer(v.hints, 0, 10000) || !integer(v.rewardCursor)) return false;
  if (v.introSeen !== undefined && typeof v.introSeen !== 'boolean') return false;
  if (!strings(v.completed) || !v.completed.every(id => levels.some(l => l.id === id))) return false;
  if (!strings(v.unlocked) || !v.unlocked.every(id => facts.some(f => f.id === id))) return false;
  if (!strings(v.favorites) || !v.favorites.every(id => (v.unlocked as string[]).includes(id))) return false;
  if (!strings(v.topics) || !v.topics.length || !v.topics.every(t => TOPICS.some(topic => topic === t))) return false;
  if (!strings(v.receipts) || v.receipts.length > 128 || !record(v.best) || !record(v.levelRewards)) return false;
  if (!Object.entries(v.levelRewards).every(([levelId, factId]) => (v.completed as string[]).includes(levelId) &&
    typeof factId === 'string' && (v.unlocked as string[]).includes(factId))) return false;
  if (!(v.completed as string[]).every(id => typeof (v.levelRewards as Record<string, unknown>)[id] === 'string')) return false;
  if (!Object.entries(v.best).every(([id, r]) => (v.completed as string[]).includes(id) && record(r) && integer(r.stars, 1, 3) && integer(r.hints) && integer(r.timeMs))) return false;
  if (!(v.completed as string[]).every(id => record((v.best as Record<string, unknown>)[id]))) return false;
  if (!record(v.settings) || (v.settings.music !== undefined && typeof v.settings.music !== 'boolean') || typeof v.settings.sound !== 'boolean' || typeof v.settings.reducedMotion !== 'boolean') return false;
  return v.attempt === null || validAttempt(v.attempt);
}
export function decode(raw: string | null): Profile | null {
  try { const v: unknown = JSON.parse(raw ?? 'null'); return validProfile(v) ? v : null; } catch { return null; }
}
export class ProfileStorage {
  status: 'saved' | 'memory' | 'recovered' | 'future' | 'cleared' | 'conflict' = 'saved';
  private observedRaw: string | null | undefined;
  constructor(private readonly storage: StorageLike | null) {}
  load(): Profile {
    try {
      const raw = this.storage?.getItem(SAVE_KEY) ?? null;
      this.observedRaw = raw;
      if (raw) {
        try { const v: unknown = JSON.parse(raw); if (record(v) && integer(v.version, 2)) { this.status = 'future'; return freshProfile(); } } catch { /* try backup */ }
      }
      const profile = decode(raw);
      if (profile) return profile;
      // A missing primary means a new profile or an explicit reset, not corruption.
      const backup = raw === null ? null : decode(this.storage?.getItem(BACKUP_KEY) ?? null);
      if (backup) { this.status = 'recovered'; return backup; }
      if (!this.storage) this.status = 'memory';
    } catch { this.status = 'memory'; }
    return freshProfile();
  }
  private acceptCurrent(raw: string | null): boolean {
    if (this.status === 'cleared' || this.status === 'conflict') return false;
    if (this.observedRaw !== undefined && raw !== this.observedRaw) {
      this.status = raw === null ? 'cleared' : 'conflict';
      return false;
    }
    return true;
  }
  checkCurrent(): boolean {
    try {
      if (this.storage) return this.acceptCurrent(this.storage.getItem(SAVE_KEY));
    } catch { this.status = 'memory'; }
    return this.status !== 'cleared' && this.status !== 'conflict';
  }
  save(profile: Profile): Profile {
    const next = { ...profile, revision: profile.revision + 1 };
    if (!validProfile(next)) throw new Error('Invalid profile transaction');
    if (this.status === 'future') return next;
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      const prior = this.storage.getItem(SAVE_KEY);
      // Check the stored value too: storage events can be missed by an open tab.
      if (!this.acceptCurrent(prior)) return profile;
      if (decode(prior)) this.storage.setItem(BACKUP_KEY, prior!);
      else if (prior === null) this.storage.removeItem(BACKUP_KEY);
      const raw = JSON.stringify(next);
      this.storage.setItem(SAVE_KEY, raw); this.observedRaw = raw; this.status = 'saved';
    } catch { this.status = 'memory'; }
    return next;
  }
}
