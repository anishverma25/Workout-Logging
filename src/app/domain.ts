import type { AccountState } from './account';
import type { SyncState } from '@/data/sync/controller';

/**
 * Moving people from the old `*.pages.dev` address to the custom domain. Browsers keep data per
 * address, so the move waits until every change on this phone is saved to the account.
 *
 * The move is off until `VITE_CANONICAL_ORIGIN` is set for the build (Cloudflare Pages,
 * Production), so the redirect can be switched on after the domain is approved for payments.
 */

/** Addresses that move to the canonical one. Previews and localhost never do. */
export const LEGACY_HOSTS = ['overload-gym.pages.dev'];

interface Place {
  hostname: string;
  pathname: string;
  search: string;
  hash: string;
}

/** Where this page should move to, or null when it should stay. Keeps path, query and hash. */
export function moveTarget(
  place: Place,
  canonicalOrigin: string | undefined,
  legacyHosts: string[] = LEGACY_HOSTS,
): string | null {
  if (!canonicalOrigin || !legacyHosts.includes(place.hostname)) return null;
  let origin: URL;
  try {
    origin = new URL(canonicalOrigin);
  } catch {
    return null;
  }
  if (origin.protocol !== 'https:' || origin.hostname === place.hostname) return null;
  return `${origin.origin}${place.pathname}${place.search}${place.hash}`;
}

/**
 * True when leaving this address loses nothing: no cloud (nothing to sync), no account open
 * (the sign-in screens and the tour), or an account with every change confirmed by the server.
 */
export function readyToMove(account: Pick<AccountState, 'status'>, sync: SyncState): boolean {
  if (account.status === 'unavailable' || account.status === 'signedOut') return true;
  if (account.status === 'loading') return false;
  return sync.phase === 'idle' && sync.pending === 0 && sync.rejected === 0;
}
