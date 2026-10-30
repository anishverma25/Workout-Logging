import { useState } from 'react';
import { CalendarRange, Check, Dumbbell, Play, Plus, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useActiveWorkoutView, usePreferences, useTrainingData } from '@/data/hooks';
import { activeRoutine, daysForRoutine, plannedDayOn } from '@/domain/analytics/schedule';
import { buildSessions } from '@/domain/analytics/sessions';
import { addDays, isSameDay } from '@/lib/dates';
import { formatDateInSentence, formatRepRange, pluralize } from '@/lib/format';
import { CapsuleButton, TextButton } from '@/components/kit';
import { buildDashboard } from '@/domain/analytics/dashboard';
import { WeekStrip } from '@/features/home/WeekCard';
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
  const prefs = usePreferences();
  const start = useStartWorkout();
  const now = useNow();
  const [expanded, setExpanded] = useState<string[]>([]);
  const data = training.data;
  const routine = data ? activeRoutine(data.routines) : null;
  const days = data ? daysForRoutine(routine, data.routineDays) : [];
  const today = plannedDayOn(now, days);
  const sessions = data ? buildSessions(data) : [];
  const weekDays = data && routine ? buildDashboard(data, prefs, now).weekDays : [];
  const lastSession = (dayId: string) =>
    [...sessions].reverse().find((s) => s.workout.routineDayId === dayId) ?? null;
  // Today's planned session, once logged today, shows as completed (B1).
  const todayLast = today ? lastSession(today.id) : null;
  const doneToday = todayLast && isSameDay(todayLast.date, now) ? todayLast : null;
  const next = nextSessionDay(days, today, doneToday !== null, now);
  const featured = doneToday && today ? today : next;
  const others = days.filter((d) => d.id !== featured?.id);
  const names = new Map((data?.exercises ?? []).map((e) => [e.id, e.name]));
  const slotsOf = (dayId: string) =>
    (data?.routineExercises ?? [])
      .filter((re) => re.routineDayId === dayId)
      .sort((a, b) => a.order - b.order);
  const metaOf = (dayId: string) => {
    const last = lastSession(dayId);
    return `${pluralize(slotsOf(dayId).length, 'exercise')}${
      last ? ` · last done ${formatDateInSentence(last.date, now)}` : ''
    }`;
  };

  return (
    <>
      <PageHeader
        title="Workout"
        subtitle={routine ? routine.name : undefined}
        actions={<TextButton to="/routines">Routines</TextButton>}
      />
      {training.status === 'loading' ? <Skeleton className="h-80" /> : null}

      {data && routine && days.length > 0 ? (
        <div className="flex flex-col gap-8">
          {weekDays.length > 0 ? <WeekStrip days={weekDays} className="-mt-1" /> : null}
          {featured ? (
            <FeaturedDay
              day={featured}
              title={doneToday && today?.id === featured.id ? 'Done today' : 'Next'}
              isToday={today?.id === featured.id}
              completed={doneToday && today?.id === featured.id ? doneToday : null}
              slots={slotsOf(featured.id)}
              names={names}
              meta={metaOf(featured.id)}
              showAll={expanded.includes(`${featured.id}:all`)}
              onShowAll={() => setExpanded((e) => [...e, `${featured.id}:all`])}
              onStart={() => start(featured.id)}
            />
          ) : null}
          <section aria-labelledby="other-days">
            <h2 id="other-days" className="type-section mb-2 text-text-1">
              {others.length > 0 ? 'Other days' : 'Start something else'}
            </h2>
            <ul className="divide-y-[0.5px] divide-divider rounded-card bg-surface px-4">
              {others.map((day) => {
                const slots = slotsOf(day.id);
                const open = expanded.includes(day.id);
                return (
                  <li key={day.id} className="py-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() =>
                          setExpanded((e) =>
                            open ? e.filter((x) => x !== day.id) : [...e, day.id],
                          )
                        }
                        className="pressable chrome min-w-0 flex-1 text-left"
                      >
                        <span className="type-headline block truncate text-text-1">{day.name}</span>
                        <span className="type-subhead block truncate text-text-2">
                          {metaOf(day.id)}
                        </span>
                      </button>
                      <CapsuleButton
                        aria-label={`Start ${day.name}`}
                        disabled={slots.length === 0}
                        onClick={() => start(day.id)}
                      >
                        Start
                      </CapsuleButton>
                    </div>
                    {open ? (
                      <ul className="mt-2">
                        {slots.map((sl) => (
                          <li
                            key={sl.id}
                            className="type-subhead flex min-h-8 items-center justify-between gap-3"
                          >
                            <span className="truncate text-text-1">
                              {names.get(sl.exerciseId) ?? 'Exercise'}
                            </span>
                            <span className="tabular shrink-0 text-text-2">
                              {sl.targetSets} × {formatRepRange(sl.repMin, sl.repMax)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
              <EmptyWorkoutRow onStart={() => start(null)} />
            </ul>
          </section>
        </div>
      ) : null}

      {data && !(routine && days.length > 0) ? (
        <div className="flex flex-col gap-4">
          <ul className="rounded-card bg-surface px-4">
            <EmptyWorkoutRow onStart={() => start(null)} />
          </ul>
          <p className="type-meta flex flex-wrap items-center gap-x-2 gap-y-1 px-4 text-text-2">
            <CalendarRange className="size-4" aria-hidden />
            <span>A routine fills workouts in for you.</span>
            <TextButton to="/routines" small>
              Set one up
            </TextButton>
          </p>
        </div>
      ) : null}
    </>
  );
}

function EmptyWorkoutRow({ onStart }: { onStart: () => void }) {
  return (
    <li className="flex items-center gap-3 py-3" aria-labelledby="empty-workout">
      <span className="flex size-[1.875rem] shrink-0 items-center justify-center rounded-[0.5rem] bg-fill text-text-1">
        <Dumbbell className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <h3 id="empty-workout" className="type-headline text-text-1">
          Empty workout
        </h3>
        <span className="type-subhead block truncate text-text-2">Add exercises as you go</span>
      </span>
      <CapsuleButton
        aria-label="Start empty workout"
        icon={<Plus className="size-4" aria-hidden />}
        onClick={onStart}
      >
        Start
      </CapsuleButton>
    </li>
  );
}

/** The session to do next, opened, with its one lime Start button (S4.3). */
function FeaturedDay({
  day,
  title,
  isToday,
  completed,
  slots,
  names,
  meta,
  showAll,
  onShowAll,
  onStart,
}: {
  day: RoutineDay;
  title: string;
  isToday: boolean;
  completed: ReturnType<typeof buildSessions>[number] | null;
  slots: { id: string; exerciseId: string; targetSets: number; repMin: number; repMax: number }[];
  names: Map<string, string>;
  meta: string;
  showAll: boolean;
  onShowAll: () => void;
  onStart: () => void;
}) {
  const shown = showAll ? slots : slots.slice(0, 4);
  return (
    <section aria-labelledby="next-day">
      <h2 className="type-section mb-2 text-text-1">{title}</h2>
      <article className="rounded-card bg-surface">
        <div className="px-4 pt-4 pb-1">
          <div className="flex items-center gap-2">
            <h3 id="next-day" className="type-title-1 min-w-0 truncate text-text-1">
              {day.name}
            </h3>
            {completed ? (
              <Badge tone="accent">
                <Check className="size-3.5 text-lime" aria-hidden />
                Completed
              </Badge>
            ) : isToday ? (
              <Badge>Today</Badge>
            ) : null}
          </div>
          <p className="type-subhead text-text-2">{meta}</p>
        </div>
        <ul className="divide-y-[0.5px] divide-divider px-4">
          {shown.map((sl) => (
            <li key={sl.id} className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-[1.0625rem] truncate text-text-1">
                {names.get(sl.exerciseId) ?? 'Exercise'}
              </span>
              <span className="type-subhead tabular shrink-0 text-text-2">
                {sl.targetSets} × {formatRepRange(sl.repMin, sl.repMax)}
              </span>
            </li>
          ))}
          {slots.length > shown.length ? (
            <li className="flex min-h-11 items-center">
              <TextButton onClick={onShowAll}>{slots.length - shown.length} more</TextButton>
            </li>
          ) : null}
        </ul>
        <div className="p-4 pt-3">
          {completed ? (
            <div className="flex items-center gap-3">
              <TextButton to={`/history/${completed.workout.id}`}>View</TextButton>
              <Button
                variant="secondary"
                className="ml-auto"
                aria-label={`Repeat ${day.name}`}
                icon={<RotateCcw className="size-4" aria-hidden />}
                onClick={onStart}
              >
                Repeat
              </Button>
            </div>
          ) : (
            <Button
              size="lg"
              variant="primary"
              block
              disabled={slots.length === 0}
              icon={<Play className="size-4 fill-current" aria-hidden />}
              onClick={onStart}
            >
              Start {day.name}
            </Button>
          )}
        </div>
      </article>
    </section>
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
