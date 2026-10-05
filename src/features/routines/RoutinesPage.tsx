import { CalendarRange } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { daysForRoutine } from '@/domain/analytics/schedule';
import { useTrainingData } from '@/data/hooks';
import { formatWeekdayShort } from '@/lib/dates';

/** Read-only overview. Creating and editing routines is Phase 2. */
export function RoutinesPage() {
  const training = useTrainingData();
  const data = training.data;
  const names = new Map(data?.exercises.map((e) => [e.id, e.name]) ?? []);
  // A fixed Sunday (4 Jan 2026) to turn weekday numbers into localized names.
  const weekdayName = (n: number) => formatWeekdayShort(new Date(2026, 0, 4 + n));

  return (
    <>
      <PageHeader title="Routines" subtitle="Your training plans. Editing arrives next." />
      {training.status === 'loading' ? <Skeleton className="h-96" /> : null}
      {training.status === 'error' ? <ErrorState error={training.error} /> : null}
      {data && data.routines.length === 0 ? (
        <EmptyState
          icon={<CalendarRange className="size-5" aria-hidden />}
          title="No routines yet"
          body="A routine is your plan: training days, exercises and target sets and reps. It tells Home what to train today and makes adherence possible to measure. Changing a routine never rewrites past workouts."
        />
      ) : null}
      {data?.routines.map((routine) => (
        <section key={routine.id} className="mb-8" aria-labelledby={`routine-${routine.id}`}>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 id={`routine-${routine.id}`} className="font-display text-2xl font-bold">
              {routine.name}
            </h2>
            {routine.isActive ? <Badge tone="accent">Active</Badge> : null}
            {routine.origin === 'demo' ? <Badge tone="warn">Demo</Badge> : null}
          </div>
          {routine.description ? (
            <p className="-mt-2 mb-4 text-muted">{routine.description}</p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {daysForRoutine(routine, data.routineDays).map((day) => (
              <Card key={day.id} className="p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-[1.6rem] font-bold leading-none">{day.name}</h3>
                  <span className="text-sm text-faint">
                    {day.weekdays.map(weekdayName).join(', ')}
                  </span>
                </div>
                <ol className="mt-4 divide-y divide-line">
                  {data.routineExercises
                    .filter((re) => re.routineDayId === day.id)
                    .sort((a, b) => a.order - b.order)
                    .map((re) => (
                      <li key={re.id} className="flex items-baseline justify-between gap-3 py-2">
                        <span className="truncate">{names.get(re.exerciseId) ?? 'Exercise'}</span>
                        <span className="tabular shrink-0 text-sm text-muted">
                          {re.targetSets} × {re.repMin}–{re.repMax}
                          {re.targetRir !== null ? (
                            <span className="text-faint">, RIR {re.targetRir}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                </ol>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
