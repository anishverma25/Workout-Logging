import { useLocation } from 'react-router';
import { CloudOff, RefreshCw } from 'lucide-react';
import { InlineNotice, SecondaryButton } from '@/components/kit';
import { useActiveWorkout } from '@/data/hooks';
import { cn } from '@/lib/cn';
import { applyUpdate, useOnline, usePwa } from '../pwa';

/**
 * App-wide notices: offline state and a new version waiting. Quiet, never blocking.
 *
 * The new version notice floats like a toast but stays until Reload is pressed. On the
 * workout and its summary it sits in the page instead, so it never covers set rows or the
 * Done button, and it never reloads by itself: nobody is interrupted mid-workout.
 */
export function AppNotices() {
  const online = useOnline();
  const { updateReady } = usePwa();
  if (online && !updateReady) return null;
  return (
    <>
      {!online ? (
        <InlineNotice icon={<CloudOff />} className="mt-3">
          Offline. Everything you log is saved on this device.
        </InlineNotice>
      ) : null}
      {updateReady ? <UpdateNotice /> : null}
    </>
  );
}

function UpdateNotice() {
  const { pathname } = useLocation();
  const active = useActiveWorkout();
  const inWorkout = pathname === '/workout' || pathname.startsWith('/workouts/');
  // The workout dock sits above the tab bar on other screens while a workout runs.
  const dockShown = Boolean(active.data) && !inWorkout;
  const card = (
    <div
      role="status"
      className="pointer-events-auto flex min-h-12 w-full max-w-[min(30rem,calc(100vw-2rem))] items-center gap-3 rounded-nested border border-border bg-surface py-2 pr-2 pl-4"
    >
      <RefreshCw className="size-5 shrink-0 text-text-2" aria-hidden />
      <p className="type-body min-w-0 flex-1 py-1 text-text-1">A new version is ready</p>
      <SecondaryButton compact onClick={applyUpdate}>
        Reload
      </SecondaryButton>
    </div>
  );
  if (inWorkout) return <div className="mt-3 flex justify-center">{card}</div>;
  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-4 z-40 flex justify-center lg:left-64',
        dockShown
          ? 'bottom-[calc(9.5rem+env(safe-area-inset-bottom))] lg:bottom-24'
          : 'bottom-[calc(var(--tabbar-h)+1rem+env(safe-area-inset-bottom))] lg:bottom-6',
      )}
    >
      {card}
    </div>
  );
}
