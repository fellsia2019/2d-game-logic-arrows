import { freshProfile } from '../core/profile';
import type { Profile } from '../core/types';
import { decode, type StorageLike } from './save';

export interface CloudPlayer {
  getUniqueID(): string;
  getData(keys: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush: boolean): Promise<void>;
}
export const CLOUD_KEY = 'arrowProfileV1';
export const CLOUD_META_KEY = 'osvobodi-pole-cloud-v1';
const INTERVAL = 4000; // At most 75 writes per five minutes; the SDK limit is 100.
interface Metadata { owner: string; updatedAt: number; dirty: boolean; syncedAt?: number }
interface Snapshot { version: 1; updatedAt: number; profile: Profile }
export type CloudStatus = 'local' | 'saved' | 'pending' | 'error' | 'protected' | 'too-large' | 'conflict';

// Local storage remains the immediate save. Only a successful cloud read permits uploads.
export class CloudProgress {
  status: CloudStatus = 'local';
  conflict: { local: Profile; remote: Profile; updatedAt: number } | null = null;
  private player: CloudPlayer | null = null;
  private owner = '';
  private pending: Snapshot | null = null;
  private writing = false;
  private stopped = false;
  private lastWrite = -Infinity;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private meta: Metadata | null = null;
  private savedRaw = '';
  constructor(private provider: () => Promise<CloudPlayer>, private storage: StorageLike | null,
    private changed: () => void = () => {}, private now: () => number = Date.now) {
    try {
      const value = JSON.parse(this.storage?.getItem(CLOUD_META_KEY) ?? 'null');
      if (typeof value?.owner === 'string' && Number.isSafeInteger(value.updatedAt) && typeof value.dirty === 'boolean') this.meta = value;
    } catch { /* first cloud session */ }
  }
  private update(status: CloudStatus): void { this.status = status; this.changed(); }
  private metadata(meta: Metadata): void {
    this.meta = meta;
    try { this.storage?.setItem(CLOUD_META_KEY, JSON.stringify(meta)); } catch { /* local mode already reports storage failures */ }
  }
  async load(local: Profile): Promise<Profile> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        this.provider().then(async player => ({ player, data: await player.getData([CLOUD_KEY]) })),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(Error('Cloud read timeout')), 6000); }),
      ]);
      if (this.stopped) return local;
      const owner = result.player.getUniqueID();
      if (!owner) throw Error('Cloud owner unavailable');
      const value = result.data[CLOUD_KEY] as Partial<Snapshot> | undefined;
      const remote = value && value.version === 1 && Number.isSafeInteger(value.updatedAt)
        ? decode(JSON.stringify(value.profile)) : null;
      // Never overwrite corrupt or newer cloud formats with a local fallback.
      if (value !== undefined && !remote) { this.update('protected'); return local; }
      this.player = result.player; this.owner = owner;
      const sameOwner = this.meta?.owner === owner;
      const unsentLocal = sameOwner && this.meta!.dirty;
      // Detect divergence from the last acknowledged server snapshot. Device clocks do not choose a winner.
      if (unsentLocal && remote && this.meta!.syncedAt !== value!.updatedAt && JSON.stringify(local) !== JSON.stringify(remote)) {
        this.conflict = { local, remote, updatedAt: value!.updatedAt! };
        try { this.storage?.setItem('osvobodi-pole-cloud-conflict-v1', JSON.stringify(this.conflict)); } catch { /* local backup unavailable */ }
        this.update('conflict'); return local;
      }
      const selected = unsentLocal ? local : remote ?? (this.meta ? freshProfile() : local);
      const updatedAt = unsentLocal ? this.meta!.updatedAt : remote ? value!.updatedAt! : this.now();
      this.metadata({ owner, updatedAt, dirty: !remote || !!unsentLocal, syncedAt: remote ? value!.updatedAt : undefined });
      if (remote && !unsentLocal) this.savedRaw = JSON.stringify(selected);
      this.update(remote && !unsentLocal ? 'saved' : 'pending');
      return selected;
    } catch { this.update('error'); return local; }
    finally { clearTimeout(timeout); }
  }
  choose(choice: 'local' | 'remote'): Profile {
    if (!this.conflict) throw Error('No cloud conflict');
    const conflict = this.conflict; this.conflict = null;
    const profile = choice === 'local' ? conflict.local : conflict.remote;
    this.metadata({ owner: this.owner, updatedAt: choice === 'local' ? this.now() : conflict.updatedAt,
      syncedAt: conflict.updatedAt, dirty: choice === 'local' });
    if (choice === 'remote') this.savedRaw = JSON.stringify(profile);
    this.update(choice === 'local' ? 'pending' : 'saved'); return profile;
  }
  schedule(profile: Profile): void {
    if (this.stopped || this.conflict) return;
    const raw = JSON.stringify(profile);
    // Even offline changes must mark the local cache as newer for the next launch.
    if (!this.player) {
      if (this.meta && this.status !== 'protected') this.metadata({ ...this.meta, updatedAt: this.now(), dirty: true });
      return;
    }
    if (raw === this.savedRaw && !this.pending) return;
    const snapshot: Snapshot = { version: 1, updatedAt: this.now(), profile: JSON.parse(raw) as Profile };
    this.metadata({ owner: this.owner, updatedAt: snapshot.updatedAt, syncedAt: this.meta?.syncedAt, dirty: true });
    if (new TextEncoder().encode(JSON.stringify({ [CLOUD_KEY]: snapshot })).length > 190_000) {
      this.pending = null; this.update('too-large'); return;
    }
    this.pending = snapshot; this.update('pending'); this.flush();
  }
  flush(): void {
    if (this.stopped || !this.player || !this.pending || this.writing || this.timer) return;
    const delay = Math.max(0, INTERVAL - (this.now() - this.lastWrite));
    if (delay) { this.timer = setTimeout(() => { this.timer = undefined; this.flush(); }, delay); return; }
    const snapshot = this.pending; this.pending = null; this.writing = true; this.lastWrite = this.now();
    const player = this.player;
    void Promise.resolve().then(() => player.setData({ [CLOUD_KEY]: snapshot }, true)).then(() => {
      if (this.stopped) return;
      this.savedRaw = JSON.stringify(snapshot.profile);
      if (!this.pending && this.status !== 'too-large') {
        this.metadata({ owner: this.owner, updatedAt: snapshot.updatedAt, syncedAt: snapshot.updatedAt, dirty: false }); this.update('saved');
      } else if (this.meta) {
        this.metadata({ ...this.meta, syncedAt: snapshot.updatedAt });
      }
    }).catch(() => {
      if (this.stopped) return;
      // A newer oversized profile is local-only; do not retry an older snapshot over it.
      if (this.status === 'too-large') return;
      this.pending ??= snapshot; this.update('error');
      this.timer = setTimeout(() => { this.timer = undefined; this.flush(); }, 15000);
    }).finally(() => { this.writing = false; if (!this.stopped) this.flush(); });
  }
  stop(): void { this.stopped = true; clearTimeout(this.timer); this.pending = null; }
}
