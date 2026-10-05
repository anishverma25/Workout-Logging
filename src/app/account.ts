import { useSyncExternalStore } from 'react';
import Dexie from 'dexie';
import type { Session } from '@supabase/supabase-js';
import { accountDbName, db, GUEST_DB_NAME, switchDatabase } from '@/data/db';
import { autoloadDemoIfFirstRun } from '@/data/demo/service';
import { ensureSystemExercises } from '@/data/repositories/training';
import { syncController, type SyncState } from '@/data/sync/controller';
import { cloudEnabled, supabase, SupabaseRemote } from '@/data/sync/supabase';

/**
 * Who is using the app, and which local database is open.
 *
 * - No account: the guest database. Data stays on this device. Demo data lives only here.
 * - Signed in: a database for that account, synced to the server. It starts empty unless the
 *   person chooses to bring their device data in.
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

/** Demo data loads on first run in development, or when VITE_DEMO_AUTOLOAD=true. */
export const DEMO_AUTOLOAD = import.meta.env.DEV || import.meta.env.VITE_DEMO_AUTOLOAD === 'true';

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

async function openGuestSpace() {
  syncController.stop();
  switchDatabase(GUEST_DB_NAME);
  await db.open();
  await autoloadDemoIfFirstRun(db, DEMO_AUTOLOAD);
}

async function openAccountSpace(user: AccountUser) {
  switchDatabase(accountDbName(user.id), { syncEnabled: true });
  await db.open();
  // The built-in library is local reference data; demo data is never loaded into an account.
  await ensureSystemExercises(db);
  if (supabase) void syncController.start(db, new SupabaseRemote(supabase), user.id);
}

let applying: Promise<void> = Promise.resolve();

/** Opens the right database for a session change. Changes are applied one at a time. */
function applySession(session: Session | null) {
  applying = applying.then(async () => {
    const user = session ? userOf(session) : null;
    if (user && state.user?.id !== user.id) await openAccountSpace(user);
    if (!user && (state.user || db.name !== GUEST_DB_NAME)) await openGuestSpace();
    setState({ status: user ? 'signedIn' : 'signedOut', user });
  });
  return applying;
}

/** Restores a saved session before the first render, so the right data shows immediately. */
export async function initAccount(): Promise<void> {
  if (!supabase) {
    await openGuestSpace();
    return;
  }
  let session: Session | null = null;
  try {
    session = (await supabase.auth.getSession()).data.session;
  } catch (err) {
    console.error('Could not restore the session', err);
  }
  if (!session) await openGuestSpace();
  await applySession(session);
  supabase.auth.onAuthStateChange((event, next) => {
    if (event === 'PASSWORD_RECOVERY') setState({ recovery: true });
    // Supabase advises against awaiting its own calls inside this callback.
    setTimeout(() => void applySession(next), 0);
  });
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
  if (/already registered|already been registered/i.test(message))
    return 'There is already an account with that email. Try signing in.';
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
  if (error) throw new AccountError(friendly(error.message));
  if (data.session) {
    await applySession(data.session);
    return 'signedIn';
  }
  return 'confirm';
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
