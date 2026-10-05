import { Link, useLocation } from 'react-router';
import { ChevronRight, Dumbbell } from 'lucide-react';
import { useActiveWorkout, useRestTimer } from '@/data/hooks';
import { elapsedMs } from '@/data/repositories/workouts';
import { isFinished, remainingMs } from '@/domain/workout/restTimer';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/format';
import { useNow } from '@/lib/useNow';

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
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.4rem+env(safe-area-inset-bottom))] z-30 px-3 lg:bottom-6 lg:left-[17rem]">
      <Link
        to="/workout"
        className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-accent px-4 py-2.5 text-accent-ink shadow-[0_12px_32px_-12px_rgb(0_0_0/0.6)]"
      >
        <Dumbbell className="size-5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold leading-tight">
            {workoutName} in progress
          </span>
          <span className="tabular block text-sm text-accent-ink/75">
            {formatClock(elapsedMs(workout, now) / 1000)}
            {workout.pausedAt ? ' · paused' : ''}
            {resting ? ` · rest ${formatClock(Math.ceil(remainingMs(timer, now) / 1000))}` : ''}
          </span>
        </span>
        <span className={cn('flex shrink-0 items-center gap-0.5 text-sm font-semibold')}>
          Resume <ChevronRight className="size-4" aria-hidden />
        </span>
      </Link>
    </div>
  );
}
