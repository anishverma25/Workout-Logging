import { Link, useLocation } from 'react-router';
import { ChevronRight, Dumbbell } from 'lucide-react';
import { useState } from 'react';
import { db } from '@/data/db';
import { useActiveWorkout, useLastSetAt, usePreferences, useRestTimer } from '@/data/hooks';
import { elapsedMs, finishWorkout } from '@/data/repositories/workouts';
import { CapsuleButton } from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { isFinished, remainingMs } from '@/domain/workout/restTimer';
import { formatClock } from '@/lib/format';
import { useNow } from '@/lib/useNow';

/** A workout whose last set is older than this is offered a tidy finish. */
export const FORGOTTEN_MS = 6 * 3_600_000;

/**
 * While a workout is running and you are on another screen, a bar above the tab bar leads
 * back to it, with the clock and any rest countdown. Nothing is lost by wandering off.
 */
export function WorkoutDock() {
  const { pathname } = useLocation();
  const active = useActiveWorkout();
  const workout = active.data;
  if (!workout || pathname === '/workout' || pathname.startsWith('/workouts/')) return null;
  return <Dock workoutName={workout.name} workout={workout} />;
}

function Dock({
  workoutName,
  workout,
}: {
  workoutName: string;
  workout: NonNullable<ReturnType<typeof useActiveWorkout>['data']>;
}) {
  const now = useNow(1000);
  const timer = useRestTimer().data ?? null;
  const resting = timer && timer.workoutId === workout.id && !isFinished(timer, now);
  const lastSetAt = useLastSetAt(workout.id).data ?? null;
  const prefs = usePreferences();
  const toast = useToast();
  const [kept, setKept] = useState(false);
  const [busy, setBusy] = useState(false);
  // A workout left open for hours (batch 11, T3): offer to finish it as of its last set,
  // never by itself.
  const stale = !kept && lastSetAt !== null && now.getTime() - Date.parse(lastSetAt) > FORGOTTEN_MS;
  if (stale) {
    const endAt = new Date(Date.parse(lastSetAt) + (prefs.defaultRestSeconds ?? 90) * 1000);
    const time = endAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+1rem+env(safe-area-inset-bottom))] z-30 px-4 lg:bottom-6 lg:left-60">
        <div
          role="status"
          className="pointer-events-auto mx-auto flex max-w-md flex-col gap-2 rounded-card bg-surface p-4"
          data-forgotten-workout
        >
          <p className="type-headline text-text-1">{workoutName} is still open</p>
          <p className="type-subhead text-text-2">
            Your last set was a while ago. Finish it as of then, or keep going.
          </p>
          <div className="flex flex-wrap gap-2">
            <CapsuleButton
              tone="lime"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void finishWorkout(db, workout.id, { now: endAt, keepUnconfirmed: false })
                  .then(() => toast(`Finished as of ${time}`))
                  .catch(() => toast('Could not finish it. Open the workout to finish it.'))
                  .finally(() => setBusy(false));
              }}
            >
              Finish it as of {time}
            </CapsuleButton>
            <CapsuleButton onClick={() => setKept(true)}>Keep going</CapsuleButton>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+1rem+env(safe-area-inset-bottom))] z-30 px-4 lg:bottom-6 lg:left-60">
      <Link
        to="/workout"
        className="pressable chrome pointer-events-auto mx-auto flex h-14 max-w-md items-center gap-3 rounded-full bg-lime pr-4 pl-5 text-on-lime"
      >
        <Dumbbell className="size-5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="type-headline block truncate">{workoutName} in progress</span>
          <span className="type-meta tabular block text-on-lime/75">
            {formatClock(elapsedMs(workout, now) / 1000)}
            {workout.pausedAt ? ' · paused' : ''}
            {resting ? ` · rest ${formatClock(Math.ceil(remainingMs(timer, now) / 1000))}` : ''}
          </span>
        </span>
        <span className="type-meta flex shrink-0 items-center gap-0.5 font-semibold">
          Resume <ChevronRight className="size-4" aria-hidden />
        </span>
      </Link>
    </div>
  );
}
