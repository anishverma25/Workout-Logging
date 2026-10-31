import { Link, useLocation } from 'react-router';
import { ChevronRight, Dumbbell } from 'lucide-react';
import { useActiveWorkout, useRestTimer } from '@/data/hooks';
import { elapsedMs } from '@/data/repositories/workouts';
import { isFinished, remainingMs } from '@/domain/workout/restTimer';
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
