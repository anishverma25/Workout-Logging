import { useSyncExternalStore } from 'react';
import { db } from '@/data/db';
import { getMeta, setMeta } from '@/data/repositories/meta';
import { supabase } from '@/data/sync/supabase';
import {
  hasFeature,
  resolveEntitlement,
  SubscriptionSnapshot,
  type Entitlement,
  type ProFeature,
} from '@/domain/entitlement/entitlement';
import { useNow } from '@/lib/useNow';
import { getAccountState, subscribeAccount } from './account';
import { devSnapshot, getDevEntitlement, onDevEntitlementChange } from './devEntitlement';

/**
 * Trial and Pro access for the signed-in account, read from the server.
 *
 * - The subscription record comes only from `get_my_subscription` (server data, server clock).
 *   Nothing in local storage, the URL or app state can grant access.
 * - The last answer is cached in the account's local database so the app behaves the same
 *   offline. The cached clock never runs backwards past the last server time it saw, so
 *   setting the device clock back cannot extend a trial.
 * - Someone who edits the app's code in their own browser can change what their own screen
 *   shows; they cannot change their subscription, which only an administrator can.
 */

const CACHE_KEY = 'subscription.cache';
const REFRESH_MS = 10 * 60_000;

interface Cache {
  /** Raw JSON from the server, re-validated on every read. */
  raw: unknown;
  /** server_now minus the device time when it arrived. */
  offsetMs: number;
  serverNowMs: number;
}

interface State {
  userId: string | null;
  snapshot: SubscriptionSnapshot | null;
  offsetMs: number;
  /** Floor for the server clock estimate: the latest server time seen. */
  serverFloorMs: number;
  source: 'none' | 'server' | 'cache';
  loading: boolean;
  error: string | null;
}

let state: State = {
  userId: null,
  snapshot: null,
  offsetMs: 0,
  serverFloorMs: 0,
  source: 'none',
  loading: false,
  error: null,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function parse(raw: unknown): SubscriptionSnapshot | null {
  const parsed = SubscriptionSnapshot.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

async function fetchFromServer(userId: string) {
  if (!supabase) return;
  setState({ loading: true });
  try {
    const sent = Date.now();
    const { data, error } = await supabase.rpc('get_my_subscription');
    const received = Date.now();
    if (state.userId !== userId) return;
    if (error) throw new Error(error.message);
    const snapshot = parse(data);
    if (!snapshot?.server_now) throw new Error('The server sent an unexpected answer.');
    const serverNowMs = snapshot.server_now.getTime();
    const offsetMs = serverNowMs - (sent + received) / 2;
    setState({ snapshot, offsetMs, serverFloorMs: serverNowMs, source: 'server', error: null });
    await setMeta(db, CACHE_KEY, { raw: data, offsetMs, serverNowMs } satisfies Cache);
  } catch (err) {
    if (state.userId === userId) setState({ error: (err as Error).message });
  } finally {
    if (state.userId === userId) setState({ loading: false });
  }
}

async function loadFor(userId: string | null) {
  setState({
    userId,
    snapshot: null,
    offsetMs: 0,
    serverFloorMs: 0,
    source: 'none',
    error: null,
    loading: !!userId,
  });
  if (!userId) return;
  const cache = await getMeta<Cache>(db, CACHE_KEY);
  const snapshot = cache ? parse(cache.raw) : null;
  if (snapshot && cache && state.userId === userId) {
    setState({
      snapshot,
      offsetMs: cache.offsetMs,
      serverFloorMs: cache.serverNowMs,
      source: 'cache',
    });
  }
  await fetchFromServer(userId);
}

let started = false;

/** Follows sign-in and sign-out, and refreshes while the app is open. */
export function startEntitlement() {
  if (started) return;
  started = true;
  const sync = () => {
    const account = getAccountState();
    const userId = account.status === 'signedIn' ? (account.user?.id ?? null) : null;
    if (userId !== state.userId) void loadFor(userId);
  };
  subscribeAccount(sync);
  sync();
  onDevEntitlementChange(() => listeners.forEach((l) => l()));
  if (typeof window !== 'undefined') {
    const refresh = () => {
      if (state.userId && document.visibilityState === 'visible')
        void fetchFromServer(state.userId);
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    setInterval(refresh, REFRESH_MS);
  }
}

export function refreshEntitlement(): Promise<void> {
  return state.userId ? fetchFromServer(state.userId) : Promise.resolve();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export interface EntitlementView extends Entitlement {
  loading: boolean;
  /** Showing the last known answer because the server could not be reached. */
  offline: boolean;
  /** The server's time, as best known. Use this for countdowns. */
  now: Date;
}

export function useEntitlement(): EntitlementView {
  const s = useSyncExternalStore(subscribe, () => state);
  const dev = useSyncExternalStore(onDevEntitlementChange, getDevEntitlement);
  const deviceNow = useNow(30_000).getTime();
  const now = new Date(Math.max(s.serverFloorMs, deviceNow + s.offsetMs));
  const override = import.meta.env.DEV ? devSnapshot(dev, now) : null;
  const entitlement = resolveEntitlement(override ?? s.snapshot, now);
  return {
    ...entitlement,
    loading: s.loading && !s.snapshot,
    offline: s.source === 'cache' && !!s.error,
    now,
  };
}

export function useFeature(feature: ProFeature): boolean {
  return hasFeature(useEntitlement(), feature);
}
