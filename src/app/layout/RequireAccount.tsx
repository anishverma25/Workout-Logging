import { useLayoutEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAccount } from '../account';
import { LANDING_ATTR, wantsLanding } from '../landing';
import { hasSeenTour } from '../seenTour';
import { BrandMark } from './BrandMark';
import { Landing } from './Landing';

/**
 * Overload is an account app: everything you log is backed up and synced, so the whole app
 * sits behind a signed-in account.
 *
 * - First visit on this device, at `/`: the public home page (`<Landing />`), which leads to the
 *   tour, sign up and sign in. Anywhere else: the welcome tour.
 * - Seen the tour already: straight to sign in, with where they were going kept in `next`.
 * - A build with no Supabase project configured has no accounts at all, so it runs on-device.
 */
export function RequireAccount() {
  const account = useAccount();
  const { pathname, search } = useLocation();
  // Signed out (or about to find out) at the home address, on a device that has not seen the
  // tour: the public home page. Everyone else gets the app as before.
  const landing =
    (account.status === 'signedOut' || account.status === 'loading') && wantsLanding(pathname);

  // The head script may have shown the home page before the app knew better (no accounts in
  // this build, for example). Whenever it is not wanted, it goes.
  useLayoutEffect(() => {
    if (!landing) document.documentElement.removeAttribute(LANDING_ATTR);
  }, [landing]);

  if (landing) return <Landing />;
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
