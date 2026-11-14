import { liveQuery, type Subscription } from 'dexie';
import type { WorkoutDatabase } from '../db';
import { getMeta, META_KEYS } from '../repositories/meta';
import {
  asRemoteError,
  MAX_ATTEMPTS,
  redownloadAccount,
  retryRejectedOncePerVersion,
  retrySkippedOncePerVersion,
  syncOnce,
} from './engine';
import type { RemoteStore } from './remote';

/**
 * What the app can honestly say about where data is.
 * - off: no account, data lives on this device only
 * - pending > 0: saved on this device, not yet confirmed by the server
 * - synced: the server confirmed every change (lastSyncedAt)
 */
export interface SyncState {
  phase: 'off' | 'idle' | 'syncing' | 'offline' | 'error';
  pending: number;
  /** Changes the server refused. They stay on the device until retried. */
  rejected: number;
  lastSyncedAt: string | null;
  error: string | null;
}

export const OFF_STATE: SyncState = {
  phase: 'off',
  pending: 0,
  rejected: 0,
  lastSyncedAt: null,
  error: null,
};

/** Wait after a local change before pushing, so a burst of edits goes out together. */
export const PUSH_DEBOUNCE_MS = 1_500;
/** Regular pull for changes from other devices while the app is open. */
export const PULL_INTERVAL_MS = 120_000;
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 300_000;

const appVersion = () => (typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'local');

export function backoffDelay(failures: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, failures - 1));
}

type Listener = (state: SyncState) => void;

export class SyncController {
  private state: SyncState = OFF_STATE;
  private listeners = new Set<Listener>();
  private session: {
    db: WorkoutDatabase;
    remote: RemoteStore;
    userId: string;
    outbox: Subscription;
    cleanup: () => void;
  } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private again = false;
  /** The queued round must pull too (any caller but a local change asked for it). */
  private againFull = false;
  private failures = 0;
  /** When the last round that pulled finished (ms), so a burst of edits only pushes. */
  private lastPullAt = 0;
  /** Skipped rows were looked at again this session (after the first full round). */
  private skippedChecked = false;

  getState = () => this.state;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private set(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  async start(db: WorkoutDatabase, remote: RemoteStore, userId: string) {
    this.stop();
    const lastSyncedAt = (await getMeta<string>(db, META_KEYS.lastSyncedAt)) ?? null;
    this.set({ phase: 'idle', pending: 0, rejected: 0, lastSyncedAt, error: null });
    this.failures = 0;
    this.lastPullAt = 0;
    this.skippedChecked = false;
    // A new app version may have fixed what made the server refuse a change: try those once.
    try {
      await retryRejectedOncePerVersion(db, appVersion());
    } catch {
      // Never blocks sync starting.
    }

    // Every local write lands in the outbox; watching it is how sync hears about changes.
    let first = true;
    const outbox = liveQuery(() => db.outbox.toArray()).subscribe({
      next: (entries) => {
        const rejected = entries.filter((e) => e.attempts >= MAX_ATTEMPTS).length;
        this.set({ pending: entries.length, rejected });
        if (first) first = false;
        // While backing off after a failure, new changes wait for the retry (or `online`).
        else if (entries.length > rejected && this.failures === 0)
          this.schedule(PUSH_DEBOUNCE_MS, 'push');
      },
    });

    const onOnline = () => this.syncNow();
    const onOffline = () => this.set({ phase: 'offline' });
    const onVisible = () => {
      if (document.visibilityState === 'visible') this.syncNow();
    };
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') this.syncNow();
    }, PULL_INTERVAL_MS);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      document.addEventListener('visibilitychange', onVisible);
    }
    this.session = {
      db,
      remote,
      userId,
      outbox,
      cleanup: () => {
        clearInterval(interval);
        if (typeof window !== 'undefined') {
          window.removeEventListener('online', onOnline);
          window.removeEventListener('offline', onOffline);
          document.removeEventListener('visibilitychange', onVisible);
        }
      },
    };
    this.syncNow();
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.session) {
      this.session.outbox.unsubscribe();
      this.session.cleanup();
    }
    this.session = null;
    this.set(OFF_STATE);
  }

  private timerKind: 'push' | 'full' = 'full';

  private schedule(delay: number, kind: 'push' | 'full' = 'full') {
    if (!this.session) return;
    // A waiting full round (a retry) is never downgraded to a push-only one.
    if (this.timer) {
      clearTimeout(this.timer);
      if (this.timerKind === 'full') kind = 'full';
    }
    this.timerKind = kind;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.run(kind === 'push');
    }, delay);
  }

  /**
   * Account, "Download my account again": waits for any round in progress, sends what is
   * waiting, then fetches everything again. Refused while changes are still waiting.
   */
  redownload = async (): Promise<'done' | 'pending' | 'failed' | 'off'> => {
    const session = this.session;
    if (!session) return 'off';
    await this.syncNow();
    if (this.session !== session) return 'off';
    while (this.running) await this.running;
    let result: 'done' | 'pending' | 'failed' = 'failed';
    this.running = (async () => {
      this.set({ phase: 'syncing' });
      try {
        const r = await redownloadAccount(session.db, session.remote);
        result = r.ok ? 'done' : 'pending';
        if (this.session !== session) return;
        this.lastPullAt = Date.now();
        const lastSyncedAt = (await getMeta<string>(session.db, META_KEYS.lastSyncedAt)) ?? null;
        this.set({ phase: 'idle', error: null, lastSyncedAt });
      } catch (err) {
        if (this.session !== session) return;
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        this.set({ phase: offline ? 'offline' : 'error', error: asRemoteError(err).message });
      } finally {
        this.running = null;
        if (this.again && this.session === session) {
          const full = this.againFull;
          this.again = false;
          this.againFull = false;
          void this.run(!full);
        }
      }
    })();
    await this.running;
    return result;
  };

  /** Runs a full sync round (push, then pull) now, or right after the one in progress. */
  syncNow = (): Promise<void> => this.run(false);

  /**
   * A round after a local change pushes only, unless the last pull is older than the regular
   * pull interval: other devices' changes still arrive on start, online, visible and the
   * interval, but a burst of edits no longer asks every table each time.
   */
  private run(pushOnly: boolean): Promise<void> {
    if (!this.session) return Promise.resolve();
    if (this.running) {
      this.again = true;
      if (!pushOnly) this.againFull = true;
      return this.running;
    }
    const session = this.session;
    // No point trying without a network: wait for the browser's `online` event instead.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.set({ phase: 'offline' });
      return Promise.resolve();
    }
    const pull = !pushOnly || Date.now() - this.lastPullAt >= PULL_INTERVAL_MS;
    this.running = (async () => {
      this.set({ phase: 'syncing' });
      try {
        await syncOnce(session.db, session.remote, session.userId, { pull });
        if (this.session !== session) return;
        if (pull) this.lastPullAt = Date.now();
        if (pull && !this.skippedChecked) {
          this.skippedChecked = true;
          try {
            await retrySkippedOncePerVersion(session.db, session.remote, appVersion());
          } catch {
            // Tried again next session; never fails a round.
          }
        }
        this.failures = 0;
        const lastSyncedAt = (await getMeta<string>(session.db, META_KEYS.lastSyncedAt)) ?? null;
        this.set({ phase: 'idle', error: null, lastSyncedAt });
      } catch (err) {
        if (this.session !== session) return;
        const error = asRemoteError(err);
        this.failures++;
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        this.set({ phase: offline ? 'offline' : 'error', error: error.message });
        this.schedule(backoffDelay(this.failures));
      } finally {
        this.running = null;
        if (this.again && this.session === session) {
          const full = this.againFull;
          this.again = false;
          this.againFull = false;
          void this.run(!full);
        }
      }
    })();
    return this.running;
  }
}

export const syncController = new SyncController();
