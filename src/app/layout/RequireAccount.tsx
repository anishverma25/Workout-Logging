import { Navigate, Outlet, useLocation } from 'react-router';
import { useAccount } from '../account';
import { hasSeenTour } from '../seenTour';
import { BrandMark } from './BrandMark';

/**
 * Overload is an account app: everything you log is backed up and synced, so the whole app
 * sits behind a signed-in account.
 *
 * - First visit on this device: the welcome tour, which ends in create account or sign in.
 * - Seen the tour already: straight to sign in, with where they were going kept in `next`.
 * - A build with no Supabase project configured has no accounts at all, so it runs on-device.
 */
export function RequireAccount() {
  const account = useAccount();
  const { pathname, search } = useLocation();

  if (account.status === 'unavailable') return <Outlet />;
  if (account.status === 'loading') return <Splash />;
  if (account.status === 'signedOut') {
    const from = `${pathname}${search}`;
    const next = from === '/' ? '' : `?next=${encodeURIComponent(from)}`;
    return <Navigate to={`${hasSeenTour() ? '/sign-in' : '/welcome'}${next}`} replace />;
  }
  return <Outlet />;
}

/**
 * Held while the saved session is restored, which is quick. The mark alone, with no text or
 * spinner, so a fast restore does not flash a loading screen.
 */
function Splash() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-bg"
      aria-busy
      aria-label="Opening"
    >
      <BrandMark className="size-12 opacity-60" />
    </div>
  );
}
