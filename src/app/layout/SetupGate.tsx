import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAccount, useSyncStatus } from '@/app/account';
import { useProfile } from '@/data/hooks';

/** An account this young that has never been set up is someone new: setup comes first. */
const NEW_ACCOUNT_MS = 3 * 86_400_000;

const askedKey = (userId: string) => `overload.setupAsked.${userId}`;

function alreadyAsked(userId: string): boolean {
  try {
    return localStorage.getItem(askedKey(userId)) === '1';
  } catch {
    return true; // Without storage, never send someone round in circles.
  }
}

function markAsked(userId: string) {
  try {
    localStorage.setItem(askedKey(userId), '1');
  } catch {
    // Nothing to do.
  }
}

/** Whether a new, never set up account should be taken to setup now. Pure, for tests. */
export function needsSetup(input: {
  createdAt: string | null | undefined;
  now: number;
  /** A sync has finished, so a profile made on another phone would already be here. */
  synced: boolean;
  hasProfile: boolean | null;
  asked: boolean;
}): boolean {
  if (input.asked || !input.synced || input.hasProfile !== false || !input.createdAt) return false;
  const made = Date.parse(input.createdAt);
  return Number.isFinite(made) && input.now - made < NEW_ACCOUNT_MS;
}

/**
 * Someone who confirmed their email, then signed in, lands in the app without having been
 * through setup. This sends a new account there once, after its first sync shows it has no
 * profile anywhere. "Not now" in setup is respected: it never asks twice on this phone.
 */
export function SetupGate() {
  const account = useAccount();
  const sync = useSyncStatus();
  const profile = useProfile();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const userId = account.user?.id ?? null;
  const go =
    userId !== null &&
    !pathname.startsWith('/workout') &&
    needsSetup({
      createdAt: account.user?.createdAt,
      now: Date.now(),
      synced: sync.lastSyncedAt !== null,
      hasProfile: profile.status === 'success' ? profile.data !== null : null,
      asked: alreadyAsked(userId),
    });
  useEffect(() => {
    if (!go || !userId) return;
    markAsked(userId);
    navigate(`/setup?next=${encodeURIComponent(`${pathname}${search}`)}`, { replace: true });
  }, [go, userId, navigate, pathname, search]);
  return null;
}

/** Setup marks the account as asked, so the gate never sends it back there. */
export { markAsked as markSetupAsked };
