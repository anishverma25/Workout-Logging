import { useEffect } from 'react';
import { useAccount, useSyncStatus } from '../account';
import { moveTarget, readyToMove } from '../domain';

const target = moveTarget(window.location, import.meta.env.VITE_CANONICAL_ORIGIN);

/**
 * On the old address, sends the person to the custom domain once their changes are saved to
 * their account. Renders nothing anywhere else.
 */
export function MoveToNewHome() {
  const account = useAccount();
  const sync = useSyncStatus();
  const ready = readyToMove(account, sync);

  useEffect(() => {
    if (target && ready) {
      window.location.replace(
        // Read again at move time: the page may have navigated inside the app since the build.
        moveTarget(window.location, import.meta.env.VITE_CANONICAL_ORIGIN) ?? target,
      );
    }
  }, [ready]);

  if (!target) return null;
  return (
    <p
      role="status"
      className="type-meta fixed inset-x-0 top-0 z-50 bg-surface px-4 py-2 text-center text-text-2 pt-[max(0.5rem,env(safe-area-inset-top))]"
    >
      {ready
        ? 'Moving to our new address...'
        : 'We are moving to our new address. Saving your changes first.'}
    </p>
  );
}
