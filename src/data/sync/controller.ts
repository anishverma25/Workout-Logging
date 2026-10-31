import { liveQuery, type Subscription } from 'dexie';
import type { WorkoutDatabase } from '../db';
import { getMeta, META_KEYS } from '../repositories/meta';
import { asRemoteError, MAX_ATTEMPTS, syncOnce } from './engine';
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
  private failures = 0;

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

    // Every local write lands in the outbox; watching it is how sync hears about changes.
    let first = true;
    const outbox = liveQuery(() => db.outbox.toArray()).subscribe({
      next: (entries) => {
        const rejected = entries.filter((e) => e.attempts >= MAX_ATTEMPTS).length;
        this.set({ pending: entries.length, rejected });
        if (first) first = false;
        // While backing off after a failure, new changes wait for the retry (or `online`).
        else if (entries.length > rejected && this.failures === 0) this.schedule(PUSH_DEBOUNCE_MS);
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

  private schedule(delay: number) {
    if (!this.session) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.syncNow();
    }, delay);
  }

  /** Runs a sync round now (or right after the one in progress). Resolves when done. */
  syncNow = (): Promise<void> => {
    if (!this.session) return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    const session = this.session;
    // No point trying without a network: wait for the browser's `online` event instead.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.set({ phase: 'offline' });
      return Promise.resolve();
    }
    this.running = (async () => {
      this.set({ phase: 'syncing' });
      try {
        await syncOnce(session.db, session.remote, session.userId);
        if (this.session !== session) return;
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
          this.again = false;
          void this.syncNow();
        }
      }
    })();
    return this.running;
  };
}

export const syncController = new SyncController();
