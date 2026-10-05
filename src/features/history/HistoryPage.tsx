import { useMemo } from 'react';
import { History as HistoryIcon, Trophy } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { detectPersonalRecords } from '@/domain/analytics/prs';
import {
  buildSessions,
  sessionDurationMinutes,
  workingSetCount,
} from '@/domain/analytics/sessions';
import { sessionVolumeLoad } from '@/domain/analytics/volume';
import { usePreferences, useTrainingData } from '@/data/hooks';
import { formatShortDate } from '@/lib/dates';
import { formatCompact, formatDurationMinutes } from '@/lib/format';
import { toDisplayWeight } from '@/lib/units';

/** Read-only list for now. Workout detail and filters arrive in Phase 4. */
export function HistoryPage() {
  const training = useTrainingData();
  const prefs = usePreferences();

  const rows = useMemo(() => {
    if (!training.data) return [];
    const sessions = buildSessions(training.data);
    const prs = detectPersonalRecords(sessions, training.data.exercises);
    const prByWorkout = new Map<string, Set<string>>();
    for (const r of prs)
      prByWorkout.set(r.workoutId, (prByWorkout.get(r.workoutId) ?? new Set()).add(r.exerciseId));
    return [...sessions].reverse().map((s) => ({
      session: s,
      minutes: sessionDurationMinutes(s),
      sets: workingSetCount(s),
      volume: sessionVolumeLoad(s),
      exercises: s.exercises.length,
      prs: prByWorkout.get(s.workout.id)?.size ?? 0,
    }));
  }, [training.data]);

  return (
    <>
      <PageHeader
        title="History"
        subtitle={rows.length > 0 ? `${rows.length} workouts logged` : undefined}
      />
      {training.status === 'loading' ? <Skeleton className="h-96" /> : null}
      {training.status === 'error' ? <ErrorState error={training.error} /> : null}
      {training.status === 'success' && rows.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon className="size-5" aria-hidden />}
          title="No workouts yet"
          body="Every finished workout lands here with its sets, volume and records, so you can see exactly what you did and when."
          actions={<ButtonLink to="/workout">Start a workout</ButtonLink>}
        />
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li
                key={r.session.workout.id}
                className="flex items-center gap-4 px-4 py-3.5 sm:px-5"
              >
                <div className="w-16 shrink-0 text-sm text-faint">
                  {formatShortDate(r.session.date)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    {r.session.workout.name}
                    {r.prs > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-text">
                        <Trophy className="size-3.5" aria-hidden /> {r.prs}
                        <span className="sr-only">
                          {r.prs === 1 ? 'personal record' : 'personal records'}
                        </span>
                      </span>
                    ) : null}
                  </p>
                  <p className="tabular text-sm text-faint">
                    {r.exercises} exercises, {r.sets} sets
                    {r.session.workout.notes ? (
                      <span className="block truncate text-muted">{r.session.workout.notes}</span>
                    ) : null}
                  </p>
                </div>
                <div className="tabular shrink-0 text-right text-sm">
                  <p className="font-semibold">
                    {r.volume > 0
                      ? `${formatCompact(toDisplayWeight(r.volume, prefs.weightUnit))} ${prefs.weightUnit}`
                      : ''}
                  </p>
                  <p className="text-faint">
                    {r.minutes !== null ? formatDurationMinutes(r.minutes) : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
