import { useMemo } from 'react';
import { useParams } from 'react-router';
import { ArrowDownRight, ArrowUpRight, Check, Minus, Trophy } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { SyncLine } from '@/features/account/SyncStatus';
import { Card } from '@/components/ui/Card';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { usePreferences, useTrainingData } from '@/data/hooks';
import { formatRecordValue, PR_LABELS } from '@/domain/analytics/prs';
import { summarizeWorkout, type ExerciseChange } from '@/domain/workout/summary';
import { cn } from '@/lib/cn';
import { formatDayMonth, formatLongDay, formatRelativeDayInline } from '@/lib/dates';
import { formatCompact, formatDurationMinutes, formatSignedPercent, pluralize } from '@/lib/format';
import { formatWeight, toDisplayWeight, type WeightUnit } from '@/lib/units';

/** Shown right after finishing. Only metrics with real meaning; nothing padded in. */
export function SummaryPage() {
  const { workoutId } = useParams();
  const training = useTrainingData();
  const prefs = usePreferences();
  const unit = prefs.weightUnit;
  const summary = useMemo(
    () => (training.data && workoutId ? summarizeWorkout(training.data, workoutId) : null),
    [training.data, workoutId],
  );

  if (training.status === 'loading') return <Skeleton className="mt-10 h-96" />;
  if (training.status === 'error') return <ErrorState error={training.error} />;
  if (!summary) {
    return (
      <div className="pt-10">
        <ErrorState title="That workout was not found" />
        <ButtonLink to="/history" className="mt-4" variant="secondary">
          Go to history
        </ButtonLink>
      </div>
    );
  }
  const { session } = summary;

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <header className="relative overflow-hidden pb-6 pt-10 text-center lg:pt-14">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 size-80 -translate-x-1/2 rounded-full"
          style={{ background: 'radial-gradient(closest-side, var(--glow), transparent)' }}
        />
        <span className="summary-pop relative mx-auto flex size-16 items-center justify-center rounded-full bg-accent text-accent-ink">
          <Check className="size-8" strokeWidth={3} aria-hidden />
        </span>
        <h1 className="relative mt-4 font-display text-[1.75rem] font-bold leading-none">
          {session.workout.name} done
        </h1>
        <p className="relative mt-2 text-muted">{formatLongDay(session.date)}</p>
      </header>

      <dl className="rise-in grid grid-cols-3 gap-2" style={{ animationDelay: '0.12s' }}>
        <Stat
          label="Duration"
          value={
            summary.minutes === null
              ? 'n/a'
              : summary.minutes < 1
                ? '<1 min'
                : formatDurationMinutes(summary.minutes)
          }
        />
        <Stat label="Working sets" value={String(summary.workingSets)} />
        <Stat
          label={`Volume (${unit})`}
          value={
            summary.volumeKg > 0 ? formatCompact(toDisplayWeight(summary.volumeKg, unit)) : 'n/a'
          }
        />
      </dl>
      {summary.volumeVsLast ? (
        <p className="mt-3 text-center text-sm text-muted">
          Volume load {formatSignedPercent(summary.volumeVsLast.change)} vs your last{' '}
          {session.workout.name} on {formatDayMonth(summary.volumeVsLast.previousDate)}.
        </p>
      ) : null}

      {summary.prs.length > 0 ? (
        <Card
          className="rise-in record-sweep relative mt-6 overflow-hidden border-accent-text/30 p-5"
          style={{ animationDelay: '0.24s' }}
        >
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <Trophy className="trophy-lift size-5 text-accent-text" aria-hidden />
            {pluralize(summary.prs.length, 'new record')}
          </h2>
          <ul className="mt-3 divide-y divide-line">
            {summary.prs.map((pr) => (
              <li key={pr.id} className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{pr.exerciseName}</span>
                  <span className="text-sm text-faint">{PR_LABELS[pr.type]}</span>
                </span>
                <span className="tabular shrink-0 text-right">
                  <span className="block font-display text-lg font-semibold">
                    {formatRecordValue(pr.type, pr.value, unit)}
                  </span>
                  <span className="text-xs text-faint">
                    was {formatRecordValue(pr.type, pr.previousBest, unit)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {summary.prs.some((p) => p.type === 'e1rm') ? (
            <p className="mt-2 text-xs text-faint">
              Estimated 1RM is calculated from your sets with the Epley formula. It is not a lift
              you performed.
            </p>
          ) : null}
        </Card>
      ) : null}

      <Card className="rise-in mt-4 p-5" style={{ animationDelay: '0.32s' }}>
        <h2 className="font-display text-xl font-semibold">Exercises</h2>
        <ul className="mt-2 divide-y divide-line">
          {summary.exercises.map((e) => (
            <li key={e.exerciseId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-3">
              <span className="truncate font-semibold">{e.name}</span>
              <ChangeValue change={e.change} />
              <span className="text-sm text-faint">
                {pluralize(e.workingSets, 'working set')}
                {e.volumeKg > 0
                  ? ` · ${formatCompact(toDisplayWeight(e.volumeKg, unit))} ${unit}`
                  : ''}
              </span>
              <ChangeDetail change={e.change} unit={unit} />
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-faint">
          Changes compare your best set with the last time you did each exercise: estimated 1RM for
          compound lifts, top load for isolation lifts, most reps for bodyweight ones.
        </p>
      </Card>

      {session.workout.notes ? (
        <Card className="mt-4 p-5">
          <h2 className="font-display text-xl font-semibold">Notes</h2>
          <p className="mt-1 whitespace-pre-line text-muted">{session.workout.notes}</p>
        </Card>
      ) : null}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <ButtonLink to="/" size="lg" className="sm:flex-1">
          Done
        </ButtonLink>
        <ButtonLink
          to={`/history/${session.workout.id}`}
          size="lg"
          variant="secondary"
          className="sm:flex-1"
        >
          View workout details
        </ButtonLink>
      </div>
      <SyncLine className="mt-4 justify-center" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-3.5 text-center">
      <dt className="text-xs font-medium text-faint">{label}</dt>
      <dd className="tabular mt-1 font-display text-[1.3rem] font-bold leading-none">{value}</dd>
    </div>
  );
}

function ChangeValue({ change }: { change: ExerciseChange | null }) {
  if (!change) return <span />;
  if (change.kind === 'first') {
    return <span className="text-right text-sm text-faint">First time</span>;
  }
  const up = change.change > 0.0005;
  const down = change.change < -0.0005;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        'tabular inline-flex items-center justify-end gap-1 font-semibold',
        up ? 'text-accent-text' : down ? 'text-warn' : 'text-muted',
      )}
    >
      <Icon className="size-4" aria-hidden />
      {Math.abs(change.change) < 0.0005
        ? 'Same as last time'
        : formatSignedPercent(change.change, 1)}
    </span>
  );
}

function ChangeDetail({ change, unit }: { change: ExerciseChange | null; unit: WeightUnit }) {
  if (!change || change.kind === 'first') return <span />;
  const detail =
    change.kind === 'e1rm'
      ? `e1RM ${formatWeight(change.today, unit)}`
      : change.kind === 'load'
        ? `top load ${formatWeight(change.today, unit)}`
        : `${change.today} reps`;
  return (
    <span className="text-right text-xs text-faint">
      {detail}, vs{' '}
      {formatRelativeDayInline(change.previousDate)
        .replace(/^on /, '')
        .replace(/^today$/, 'earlier today')}
    </span>
  );
}
