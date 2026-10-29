import { useSyncExternalStore } from 'react';
import Dexie from 'dexie';
import type { Session } from '@supabase/supabase-js';
import { accountDbName, db, GUEST_DB_NAME, switchDatabase } from '@/data/db';
import { autoloadDemoIfFirstRun } from '@/data/demo/service';
import { ensureSystemExercises } from '@/data/repositories/training';
import { syncController, type SyncState } from '@/data/sync/controller';
import { cloudEnabled, supabase, SupabaseRemote } from '@/data/sync/supabase';
import { markStage, startupFailed, withTimeout } from './startup';

/**
 * Who is using the app, and which local database is open.
 *
 * - Signed in: a database for that account, synced to the server. It starts empty unless the
 *   person chooses to bring data already on this device in.
 * - Signed out: the device database stays open, but the app itself is behind the account gate
 *   (`RequireAccount`), so only the welcome tour and the sign-in screens are reachable. Data
 *   logged on this device before accounts were required is still here, and can be imported.
 */

export interface AccountUser {
  id: string;
  email: string | null;
}

export interface AccountState {
  status: 'unavailable' | 'loading' | 'signedOut' | 'signedIn';
  user: AccountUser | null;
  /** Signed in through a password reset link: the person should choose a new password. */
  recovery: boolean;
}

/** The demo athlete can be loaded in development and in end-to-end builds, never in production. */
export const DEMO_AUTOLOAD = import.meta.env.DEV || import.meta.env.VITE_DEMO_AUTOLOAD === 'true';

/**
 * `pnpm dev` opens a new account with the demo athlete already in it, so there is something to
 * look at. End-to-end tests load it themselves when a test needs it, so they can also check
 * that a new account really does start empty.
 */
const AUTOLOAD_ON_FIRST_OPEN = DEMO_AUTOLOAD && import.meta.env.MODE !== 'e2e';

let state: AccountState = {
  status: cloudEnabled ? 'loading' : 'unavailable',
  user: null,
  recovery: false,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<AccountState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const getAccountState = () => state;
export const subscribeAccount = subscribe;

export function useAccount(): AccountState {
  return useSyncExternalStore(subscribe, () => state);
}

export function useSyncStatus(): SyncState {
  return useSyncExternalStore(syncController.subscribe, syncController.getState);
}

const userOf = (session: Session): AccountUser => ({
  id: session.user.id,
  email: session.user.email ?? null,
});

/**
 * Opening the on-phone database normally takes milliseconds. Past this, something is wrong
 * (storage blocked or full), and start-up says so instead of waiting on a black screen.
 */
export const DB_OPEN_LIMIT_MS = 10_000;

async function openDatabase() {
  markStage('opening your data on this phone');
  await withTimeout(db.open(), DB_OPEN_LIMIT_MS, 'opening your data on this phone');
  markStage('loading the exercise library');
}

async function openGuestSpace() {
  syncController.stop();
  syncingFor = null;
  switchDatabase(GUEST_DB_NAME);
  await openDatabase();
  await ensureSystemExercises(db);
}

async function openAccountSpace(user: AccountUser, sync = true) {
  switchDatabase(accountDbName(user.id), { syncEnabled: true });
  await openDatabase();
  // The built-in library is local reference data. Demo data is loaded only in development and
  // in end-to-end tests; it stays on the device either way, because only `origin: 'user'`
  // records are ever sent to the server.
  await autoloadDemoIfFirstRun(db, AUTOLOAD_ON_FIRST_OPEN);
  await ensureSystemExercises(db);
  if (sync) startSync(user);
}

/** The account sync is running for, so a confirmed session never starts it twice. */
let syncingFor: string | null = null;

function startSync(user: AccountUser) {
  if (!supabase || syncingFor === user.id) return;
  syncingFor = user.id;
  void syncController.start(db, new SupabaseRemote(supabase), user.id);
}

let applying: Promise<void> = Promise.resolve();

/** Opens the right database for a session change. Changes are applied one at a time. */
function applySession(session: Session | null) {
  return applyUser(session ? userOf(session) : null);
}

/**
 * `sync: false` opens the person's data without syncing yet: used while their saved session is
 * still being confirmed, so nothing is sent or pulled before the server accepts it.
 */
function applyUser(user: AccountUser | null, { sync = true } = {}) {
  // One failed change must never block every later one (the chain would stay rejected and the
  // app would wait on its opening screen for good), so each change starts after the last one
  // settles, whether it worked or not. The caller still gets this change's own error.
  const next = applying
    .catch(() => undefined)
    .then(async () => {
      if (user && state.user?.id !== user.id) await openAccountSpace(user, sync);
      // The same person, now confirmed (a refresh that finished late, or came back online).
      else if (user && sync) startSync(user);
      if (!user && (state.user || db.name !== GUEST_DB_NAME)) await openGuestSpace();
      setState({ status: user ? 'signedIn' : 'signedOut', user });
    });
  applying = next;
  return next;
}

/**
 * How long opening the app waits for the saved session to be confirmed. Confirming can mean
 * refreshing it over the network, which on a slow connection took seconds of black screen.
 */
export const SESSION_WAIT_MS = 800;

/**
 * With no saved session, restoring is a storage read and takes no time. If it still has not
 * answered by now, the app opens signed out rather than waiting; a session that turns up later
 * signs the person in through the auth listener.
 */
export const SESSION_LIMIT_MS = 5_000;

/** The person whose session is saved on this device, read straight from storage. */
export function storedUser(
  storage: Pick<Storage, 'length' | 'key' | 'getItem'>,
): AccountUser | null {
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i) ?? '';
      if (!/^sb-.+-auth-token$/.test(key)) continue;
      const saved = JSON.parse(storage.getItem(key) ?? 'null') as {
        user?: { id?: unknown; email?: unknown };
      } | null;
      const id = saved?.user?.id;
      if (typeof id === 'string' && id)
        return { id, email: typeof saved?.user?.email === 'string' ? saved.user.email : null };
    }
  } catch {
    // Storage blocked or unreadable: wait for the session as before.
  }
  return null;
}

/** Restores a saved session before the first render, so the right data shows immediately. */
export async function initAccount(): Promise<void> {
  if (!supabase) {
    await openGuestSpace();
    return;
  }
  // Listening first, so sign-in changes are still followed if opening the data below fails.
  supabase.auth.onAuthStateChange((event, next) => {
    if (event === 'PASSWORD_RECOVERY') setState({ recovery: true });
    // Supabase advises against awaiting its own calls inside this callback.
    setTimeout(() => void applySession(next).catch(startupFailed), 0);
  });
  const restored = supabase.auth.getSession().then(
    (r) => r.data.session,
    (err: unknown) => {
      console.error('Could not restore the session', err);
      return null;
    },
  );
  let saved: AccountUser | null = null;
  try {
    saved = storedUser(window.localStorage);
  } catch {
    // No storage: wait for the session.
  }
  markStage('restoring your sign-in');
  const session = await Promise.race([
    restored,
    new Promise<undefined | null>((r) =>
      setTimeout(() => r(saved ? undefined : null), saved ? SESSION_WAIT_MS : SESSION_LIMIT_MS),
    ),
  ]);
  if (session === undefined && saved) {
    // Still confirming the saved session (a slow network): open this person's data now. The
    // refresh finishes in the background; if the session turns out to be gone, the sign-out
    // event below takes them to sign in.
    await applyUser(saved, { sync: false });
    void restored.then((s) => {
      if (!s) return;
      if (s.user.id === saved.id) {
        // Confirmed: the data already open is theirs, so syncing can start.
        void applying.catch(() => undefined).then(() => startSync(userOf(s)));
      } else void applySession(s).catch(startupFailed);
    });
  } else {
    if (!session) await openGuestSpace();
    await applySession(session ?? null);
  }
}

export class AccountError extends Error {}

function requireClient() {
  if (!supabase) throw new AccountError('Accounts are not available in this version of the app.');
  return supabase;
}

/** Plain-language messages for the errors people actually hit. */
function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'That email and password do not match.';
  if (/email not confirmed/i.test(message))
    return 'Confirm your email first. Check your inbox for the link.';
  if (/already registered|already been registered|already exists/i.test(message))
    return 'There is already an account with this email. Sign in instead.';
  if (/rate limit|too many/i.test(message))
    return 'Too many attempts. Wait a minute and try again.';
  if (/failed to fetch|network/i.test(message))
    return 'Could not reach the server. Check your connection.';
  if (/password should be|weak password/i.test(message))
    return 'Choose a longer password: at least 8 characters.';
  return message;
}

export const MIN_PASSWORD_LENGTH = 8;

export async function signIn(email: string, password: string): Promise<void> {
  const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
  if (error) throw new AccountError(friendly(error.message));
  await applySession(data.session);
}

/** Returns 'confirm' when the project requires email confirmation before the first sign-in. */
export async function signUp(email: string, password: string): Promise<'signedIn' | 'confirm'> {
  if (password.length < MIN_PASSWORD_LENGTH)
    throw new AccountError('Choose a longer password: at least 8 characters.');
  const { data, error } = await requireClient().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/account` },
  });
  if (error && /already registered|already been registered|already exists/i.test(error.message))
    throw new AccountExistsError();
  if (error) throw new AccountError(friendly(error.message));
  if (data.session) {
    await applySession(data.session);
    return 'signedIn';
  }
  if (isExistingAccount(data.user)) throw new AccountExistsError();
  return 'confirm';
}

/** Signing up with an email that already has an account. */
export class AccountExistsError extends AccountError {
  constructor() {
    super('There is already an account with this email. Sign in instead.');
  }
}

/**
 * With email confirmation on, Supabase does not say an email is taken (so addresses cannot be
 * probed by the error). It answers with a stand-in user that has no sign-in identities and no
 * session. A real new account always has its email identity.
 */
export function isExistingAccount(user: { identities?: unknown[] | null } | null): boolean {
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await requireClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  // Rate limits are worth reporting; "no such user" is not, so accounts cannot be probed.
  if (error && /rate limit|too many|failed to fetch|network/i.test(error.message))
    throw new AccountError(friendly(error.message));
}

export async function updatePassword(password: string): Promise<void> {
  if (password.length < MIN_PASSWORD_LENGTH)
    throw new AccountError('Choose a longer password: at least 8 characters.');
  const { error } = await requireClient().auth.updateUser({ password });
  if (error) throw new AccountError(friendly(error.message));
  setState({ recovery: false });
}

/**
 * Signs out. The account's local copy is removed only when every change has reached the
 * server; otherwise it stays on the device so nothing unsynced is lost, and syncs at the
 * next sign-in.
 */
export async function signOut(): Promise<{ removedLocalCopy: boolean }> {
  const client = requireClient();
  const user = state.user;
  const { pending } = syncController.getState();
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw new AccountError(friendly(error.message));
  await applySession(null);
  if (user && pending === 0) {
    await Dexie.delete(accountDbName(user.id));
    return { removedLocalCopy: true };
  }
  return { removedLocalCopy: false };
}

/**
 * Deletes the account on the server (every row it owns goes with it) and then this device's
 * copy. Photos and guest data on the device are not touched. Cannot be undone.
 */
export async function deleteAccount(): Promise<void> {
  const client = requireClient();
  const user = state.user;
  if (!user) throw new AccountError('Sign in first.');
  const { error } = await client.rpc('delete_my_account');
  if (error) throw new AccountError(friendly(error.message));
  syncController.stop();
  await client.auth.signOut({ scope: 'local' });
  await applySession(null);
  await Dexie.delete(accountDbName(user.id));
}
