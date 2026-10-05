import { Link } from 'react-router';
import { CalendarRange, Dumbbell, Play, Plus } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useActiveWorkoutView, usePreferences, useTrainingData } from '@/data/hooks';
import { activeRoutine, daysForRoutine, plannedDayOn } from '@/domain/analytics/schedule';
import { buildSessions } from '@/domain/analytics/sessions';
import { formatRelativeDayInline } from '@/lib/dates';
import { formatRepRange, pluralize } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { cn } from '@/lib/cn';
import { ActiveWorkout } from './ActiveWorkout';
import { useStartWorkout } from './StartWorkout';

export function WorkoutPage() {
  const active = useActiveWorkoutView();
  const prefs = usePreferences();
  if (active.status === 'loading') return <Skeleton className="mt-10 h-96" />;
  if (active.status === 'error') {
    return (
      <div className="pt-10">
        <ErrorState error={active.error} onRetry={() => window.location.reload()} />
      </div>
    );
  }
  if (active.data) return <ActiveWorkout view={active.data} prefs={prefs} />;
  return <StartScreen />;
}

function StartScreen() {
  const training = useTrainingData();
  const start = useStartWorkout();
  const now = useNow();
  const data = training.data;
  const routine = data ? activeRoutine(data.routines) : null;
  const days = data ? daysForRoutine(routine, data.routineDays) : [];
  const today = plannedDayOn(now, days);
  const sessions = data ? buildSessions(data) : [];
  const lastDone = (dayId: string) =>
    [...sessions].reverse().find((s) => s.workout.routineDayId === dayId)?.date ?? null;
  const ordered = today ? [today, ...days.filter((d) => d.id !== today.id)] : days;

  return (
    <>
      <PageHeader title="Workout" subtitle="Log sets faster than typing them into Notes." />
      {training.status === 'loading' ? <Skeleton className="h-80" /> : null}

      {data && routine && days.length > 0 ? (
        <section aria-labelledby="routine-days">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="routine-days" className="font-display text-xl font-semibold">
              {routine.name}
            </h2>
            <Link
              to={`/routines/${routine.id}`}
              className="text-sm font-medium text-accent-text underline-offset-4 hover:underline"
            >
              Edit routine
            </Link>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {ordered.map((day) => {
              const slots = data.routineExercises
                .filter((re) => re.routineDayId === day.id)
                .sort((a, b) => a.order - b.order);
              const names = new Map(data.exercises.map((e) => [e.id, e.name]));
              const last = lastDone(day.id);
              const isToday = today?.id === day.id;
              return (
                <li key={day.id}>
                  <article
                    className={cn(
                      'flex h-full flex-col rounded-[var(--radius-card)] border bg-surface p-5 shadow-[var(--shadow-card)]',
                      isToday ? 'border-accent-text/40' : 'border-line',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {isToday ? <Badge tone="accent">Planned today</Badge> : null}
                        <h3 className="mt-1.5 font-display text-[1.9rem] font-bold leading-none">
                          {day.name}
                        </h3>
                        <p className="mt-1.5 text-sm text-muted">
                          {pluralize(slots.length, 'exercise')}
                          {last ? ` · last done ${formatRelativeDayInline(last)}` : ''}
                        </p>
                      </div>
                    </div>
                    <ul className="mt-3 flex-1 text-sm">
                      {slots.slice(0, 4).map((s) => (
                        <li key={s.id} className="flex justify-between gap-3 py-1">
                          <span className="truncate">{names.get(s.exerciseId) ?? 'Exercise'}</span>
                          <span className="tabular shrink-0 text-faint">
                            {s.targetSets} × {formatRepRange(s.repMin, s.repMax)}
                          </span>
                        </li>
                      ))}
                      {slots.length > 4 ? (
                        <li className="py-1 text-faint">and {slots.length - 4} more</li>
                      ) : null}
                    </ul>
                    <Button
                      className="mt-4"
                      size={isToday ? 'lg' : 'md'}
                      variant={isToday ? 'primary' : 'secondary'}
                      block
                      disabled={slots.length === 0}
                      icon={<Play className="size-4 fill-current" aria-hidden />}
                      onClick={() => start(day.id)}
                    >
                      Start {day.name}
                    </Button>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {data ? (
        <section
          aria-labelledby="empty-workout"
          className="mt-6 flex flex-col gap-4 rounded-[var(--radius-card)] border border-dashed border-line-strong p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-muted">
              <Dumbbell className="size-5" aria-hidden />
            </span>
            <div>
              <h2 id="empty-workout" className="font-display text-xl font-semibold">
                Empty workout
              </h2>
              <p className="text-sm text-muted">Add exercises as you go. No plan needed.</p>
            </div>
          </div>
          <Button
            variant={routine ? 'secondary' : 'primary'}
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => start(null)}
          >
            Start empty workout
          </Button>
        </section>
      ) : null}

      {data && !routine ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted">
          <CalendarRange className="size-4" aria-hidden />
          <span>
            A routine fills workouts in for you.{' '}
            <Link
              to="/routines"
              className="font-medium text-accent-text underline-offset-4 hover:underline"
            >
              Set one up
            </Link>
          </span>
        </p>
      ) : null}
    </>
  );
}
