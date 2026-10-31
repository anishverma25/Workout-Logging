import { hasSeenTour } from './seenTour';

/**
 * The public home page lives in index.html as plain HTML (`#landing`), so search engines and
 * first-time visitors can read it before any script runs. It shows at `/` only for someone who
 * is not signed in on this device and has not finished the welcome tour; everyone else gets the
 * app exactly as before (returning people go straight to sign in).
 *
 * The inline script in index.html's head applies this same rule before the first paint, and
 * the app applies it again once it starts (`<Landing />`), so either one alone is enough.
 * `landing.test.ts` runs the inline script against this function to keep them identical.
 */

/** Set on <html> while the landing page shows. index.css shows `#landing` only then. */
export const LANDING_ATTR = 'data-landing';

/** Where Supabase keeps the signed-in session: `sb-<project>-auth-token`. */
const SESSION_KEY = /^sb-.+-auth-token$/;

type KeyedStorage = Pick<Storage, 'length' | 'key'>;

export function hasStoredSession(storage?: KeyedStorage): boolean {
  try {
    const s = storage ?? localStorage;
    for (let i = 0; i < s.length; i++) {
      if (SESSION_KEY.test(s.key(i) ?? '')) return true;
    }
  } catch {
    // Blocked storage: nobody can be signed in on this device.
  }
  return false;
}

export function wantsLanding(pathname: string): boolean {
  return pathname === '/' && !hasSeenTour() && !hasStoredSession();
}
