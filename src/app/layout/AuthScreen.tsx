import { Suspense } from 'react';
import { Outlet } from 'react-router';

/**
 * The screens that get someone into an account: full screen, no navigation bars, since there
 * is nothing to navigate to until they are signed in.
 */
export function AuthScreen() {
  return (
    <div className="min-h-dvh bg-bg px-[max(1rem,env(safe-area-inset-left))] pt-safe pb-safe">
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </div>
  );
}
