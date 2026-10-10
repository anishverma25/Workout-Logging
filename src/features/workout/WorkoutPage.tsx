import { useState } from 'react';
import { CalendarRange, Check, ChevronDown, Dumbbell, Play, Plus, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useActiveWorkoutView, usePreferences, useTrainingData } from '@/data/hooks';
import { activeRoutine, daysForRoutine, plannedDayOn } from '@/domain/analytics/schedule';
import { buildSessions } from '@/domain/analytics/sessions';
import { addDays, isSameDay } from '@/lib/dates';
import { formatDateInSentence, formatRepRange, pluralize } from '@/lib/format';
import { TextLink } from '@/components/kit';
import type { RoutineDay } from '@/domain/models/schemas';
import { useNow } from '@/lib/useNow';
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
  const [expanded, setExpanded] = useState<string[]>([]);
  const data = training.data;
  const routine = data ? activeRoutine(data.routines) : null;
  const days = data ? daysForRoutine(routine, data.routineDays) : [];
  const today = plannedDayOn(now, days);
  const sessions = data ? buildSessions(data) : [];
  const lastSession = (dayId: string) =>
    [...sessions].reverse().find((s) => s.workout.routineDayId === dayId) ?? null;
  // Today's planned session, once logged today, shows as completed (B1).
  const todayLast = today ? lastSession(today.id) : null;
  const doneToday = todayLast && isSameDay(todayLast.date, now) ? todayLast : null;
  const next = nextSessionDay(days, today, doneToday !== null, now);
  const ordered = [
    ...(today ? [today] : []),
    ...(next && next.id !== today?.id ? [next] : []),
    ...days.filter((d) => d.id !== today?.id && d.id !== next?.id),
  ];

  return (
    <>
      <PageHeader title="Workout" />
      {training.status === 'loading' ? <Skeleton className="h-80" /> : null}

      {data && routine && days.length > 0 ? (
        <section aria-labelledby="routine-days">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="routine-days" className="type-title text-text-1">
              {routine.name}
            </h2>
            <TextLink to={`/routines/${routine.id}`} chevron>
              Edit routine
            </TextLink>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {ordered.map((day) => {
              const slots = data.routineExercises
                .filter((re) => re.routineDayId === day.id)
                .sort((a, b) => a.order - b.order);
              const names = new Map(data.exercises.map((e) => [e.id, e.name]));
              const last = lastSession(day.id);
              const completed = doneToday && today?.id === day.id ? doneToday : null;
              const isNext = next?.id === day.id && !completed;
              const open = isNext || completed !== null || expanded.includes(day.id);
              const meta = `${pluralize(slots.length, 'exercise')}${
                last ? ` · last done ${formatDateInSentence(last.date, now)}` : ''
              }`;
              if (!open) {
                return (
                  <li key={day.id}>
                    <article className="flex min-h-18 items-center gap-3 rounded-panel border border-border bg-surface py-3 pr-3 pl-5">
                      <button
                        type="button"
                        aria-expanded={false}
                        onClick={() => setExpanded((e) => [...e, day.id])}
                        className="pressable chrome flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="type-headline block truncate text-text-1">
                            {day.name}
                          </span>
                          <span className="type-meta block truncate text-text-2">{meta}</span>
                        </span>
                        <ChevronDown className="size-5 shrink-0 text-text-3" aria-hidden />
                      </button>
                      <Button
                        variant="secondary"
                        size="md"
                        aria-label={`Start ${day.name}`}
                        disabled={slots.length === 0}
                        onClick={() => start(day.id)}
                      >
                        Start
                      </Button>
                    </article>
                  </li>
                );
              }
              const shown = expanded.includes(`${day.id}:all`) ? slots : slots.slice(0, 4);
              return (
                <li key={day.id}>
                  <article className="flex h-full flex-col rounded-panel border border-border bg-surface p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {completed ? (
                          <Badge tone="accent">
                            <Check className="size-3.5 text-lime" aria-hidden />
                            Completed
                          </Badge>
                        ) : today?.id === day.id ? (
                          <Badge>Today</Badge>
                        ) : (
                          <Badge>Next</Badge>
                        )}
                        <h3 className="type-title mt-2 text-text-1">{day.name}</h3>
                        <p className="type-meta mt-0.5 text-text-2">{meta}</p>
                      </div>
                    </div>
                    <ul className="mt-3 flex-1">
                      {shown.map((s) => (
                        <li key={s.id} className="flex min-h-9 items-center justify-between gap-3">
                          <span className="type-body truncate font-medium text-text-1">
                            {names.get(s.exerciseId) ?? 'Exercise'}
                          </span>
                          <span className="type-meta tabular shrink-0 text-text-2">
                            {s.targetSets} × {formatRepRange(s.repMin, s.repMax)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {slots.length > shown.length ? (
                      <div className="mt-1">
                        <TextLink small onClick={() => setExpanded((e) => [...e, `${day.id}:all`])}>
                          {slots.length - shown.length} more
                        </TextLink>
                      </div>
                    ) : null}
                    {completed ? (
                      <div className="mt-4 flex items-center gap-3">
                        <TextLink to={`/history/${completed.workout.id}`} chevron>
                          View
                        </TextLink>
                        <Button
                          variant="secondary"
                          className="ml-auto"
                          aria-label={`Repeat ${day.name}`}
                          icon={<RotateCcw className="size-4" aria-hidden />}
                          onClick={() => start(day.id)}
                        >
                          Repeat
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="mt-4"
                        size="lg"
                        variant={isNext ? 'primary' : 'secondary'}
                        block
                        disabled={slots.length === 0}
                        icon={<Play className="size-4 fill-current" aria-hidden />}
                        onClick={() => start(day.id)}
                      >
                        Start {day.name}
                      </Button>
                    )}
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
          className="mt-6 flex flex-col gap-4 rounded-panel border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-tile bg-surface-2 text-text-2">
              <Dumbbell className="size-5" aria-hidden />
            </span>
            <div>
              <h2 id="empty-workout" className="type-headline text-text-1">
                Empty workout
              </h2>
              <p className="type-meta text-text-2">Add exercises as you go. No plan needed.</p>
            </div>
          </div>
          <Button
            variant="secondary"
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => start(null)}
          >
            Start empty workout
          </Button>
        </section>
      ) : null}

      {data && !routine ? (
        <p className="type-meta mt-6 flex items-center gap-2 text-text-2">
          <CalendarRange className="size-4" aria-hidden />
          <span>A routine fills workouts in for you.</span>
          <TextLink to="/routines" small chevron>
            Set one up
          </TextLink>
        </p>
      ) : null}
    </>
  );
}

/**
 * The session to start next: today's planned one unless it is already done, otherwise the next
 * planned weekday, otherwise the first day of the routine.
 */
function nextSessionDay(
  days: RoutineDay[],
  today: RoutineDay | null,
  doneToday: boolean,
  now: Date,
): RoutineDay | null {
  if (today && !doneToday) return today;
  for (let i = 1; i <= 7; i++) {
    const day = plannedDayOn(addDays(now, i), days);
    if (day) return day;
  }
  return days[0] ?? null;
}
