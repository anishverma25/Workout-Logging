import { memo, useDeferredValue, useMemo, useState } from 'react';
import { ChevronRight, Trophy } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { Badge } from '@/components/kit';
import { Chips } from '@/components/ui/Fields';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { usePreferences, useTrainingData } from '@/data/hooks';
import { exerciseRecords, type ExerciseRecords } from '@/domain/analytics/records';
import { formatRecordValue, PR_LABELS, type PersonalRecord } from '@/domain/analytics/prs';
import { buildSessions } from '@/domain/analytics/sessions';
import { normalize } from '@/domain/exercises/search';
import { MUSCLE_LABELS } from '@/domain/models/labels';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/domain/models/schemas';
import { addDays, formatRelativeDay, startOfDay } from '@/lib/dates';
import { pluralize } from '@/lib/format';
import { formatWeight, type WeightUnit } from '@/lib/units';
import { useNow } from '@/lib/useNow';
import { cn } from '@/lib/cn';
import { SearchField } from '../exercises/ExerciseFilters';
import { ExerciseRecordsSheet } from './ExerciseRecordsSheet';
import { improvementText } from './format';

const RECENT_DAYS = 30;
/** Records set in the last 7 days (today included) carry a "New" badge. */
const NEW_DAYS = 7;

const rowCls =
  'pressable chrome flex min-h-14 w-full items-center gap-3 py-3 text-left rounded-field';

export function RecordsPage() {
  const training = useTrainingData();
  const prefs = usePreferences();
  const now = useNow();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useDeferredValue(query);

  const records = useMemo(
    () =>
      training.data ? exerciseRecords(buildSessions(training.data), training.data.exercises) : [],
    [training.data],
  );
  const recent = useMemo(() => {
    const since = addDays(startOfDay(now), -(RECENT_DAYS - 1));
    return records
      .flatMap((r) => r.history)
      .filter((p) => p.date >= since)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [records, now]);
  const newSince = useMemo(() => addDays(startOfDay(now), -(NEW_DAYS - 1)), [now]);
  const shown = records.filter(
    (r) =>
      (!muscle || r.primaryMuscle === muscle) &&
      (q.trim() === '' || normalize(r.name).includes(normalize(q))),
  );
  const open = records.find((r) => r.exerciseId === openId) ?? null;

  return (
    <>
      <PageHeader
        back={{ to: '/more', label: 'More' }}
        title="Personal records"
        subtitle="Found in your logged sets, never entered by hand. Estimates are always labelled."
      />
      {training.status === 'loading' ? <Skeleton className="h-96" /> : null}
      {training.status === 'error' ? <ErrorState error={training.error} /> : null}

      {training.status === 'success' && records.length === 0 ? (
        <EmptyState
          icon={<Trophy aria-hidden />}
          title="No records yet"
          body="Your first session with an exercise sets the baseline. Beat it later, with more weight, more reps or a higher estimated 1RM, and the record appears here with the date and how much you improved."
        />
      ) : null}

      {records.length > 0 ? (
        <>
          <section aria-labelledby="recent-prs">
            <h2 id="recent-prs" className="type-title mb-3 text-text-1">
              Last {RECENT_DAYS} days
            </h2>
            {recent.length === 0 ? (
              <p className="type-meta flex min-h-22 items-center justify-center rounded-nested bg-surface-2 px-5 py-4 text-center text-text-2 [text-wrap:balance]">
                No new records in the last {RECENT_DAYS} days. Records come from beating an earlier
                best, so they arrive in bursts, not every week.
              </p>
            ) : (
              <ul className="divide-y-[0.5px] divide-divider rounded-panel border border-border bg-surface px-4">
                {recent.slice(0, 9).map((pr) => (
                  <li key={pr.id}>
                    <RecordRow
                      record={pr}
                      unit={prefs.weightUnit}
                      isNew={pr.date >= newSince}
                      onOpen={setOpenId}
                    />
                  </li>
                ))}
              </ul>
            )}
            {recent.length > 9 ? (
              <p className="type-meta mt-2 px-1 text-text-2">
                and {pluralize(recent.length - 9, 'more record')}. Open an exercise to see all of
                them.
              </p>
            ) : null}
          </section>

          <section aria-labelledby="all-bests" className="mt-8">
            <h2 id="all-bests" className="type-title mb-3 text-text-1">
              Bests by exercise
            </h2>
            <div className="mb-3 flex flex-col gap-3">
              <SearchField value={query} onChange={setQuery} label="Search your exercises" />
              <Chips
                label="Muscle group"
                allLabel="All muscles"
                options={MUSCLE_GROUPS.filter((m) =>
                  records.some((r) => r.primaryMuscle === m),
                ).map((m) => ({
                  value: m,
                  label: MUSCLE_LABELS[m],
                }))}
                value={muscle}
                onChange={setMuscle}
              />
            </div>
            {shown.length === 0 ? (
              <p className="type-meta flex min-h-22 items-center justify-center rounded-nested bg-surface-2 px-5 py-4 text-center text-text-2">
                No exercises match.
              </p>
            ) : (
              <ul className="divide-y-[0.5px] divide-divider rounded-panel border border-border bg-surface px-4">
                {shown.map((r) => (
                  <li key={r.exerciseId}>
                    <BestRow
                      record={r}
                      unit={prefs.weightUnit}
                      isNew={r.history.some((p) => p.date >= newSince)}
                      onOpen={setOpenId}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      <ExerciseRecordsSheet
        records={open}
        unit={prefs.weightUnit}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}

/** A value (Headline, tabular) with what it is beneath (Meta --text-2), right aligned. */
function Value({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <span className={cn('shrink-0 text-right', className)}>
      <span className="type-headline tabular block text-text-1">{value}</span>
      <span className="type-meta block text-text-2">{label}</span>
    </span>
  );
}

const RecordRow = memo(function RecordRow({
  record,
  unit,
  isNew,
  onOpen,
}: {
  record: PersonalRecord;
  unit: WeightUnit;
  isNew: boolean;
  onOpen: (exerciseId: string) => void;
}) {
  return (
    <button type="button" onClick={() => onOpen(record.exerciseId)} className={rowCls}>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="type-headline min-w-0 text-text-1 [overflow-wrap:break-word]">
            {record.exerciseName}
          </span>
          {isNew ? <Badge tone="lime">New</Badge> : null}
        </span>
        <span className="type-meta tabular mt-0.5 block text-text-2">
          {formatRelativeDay(record.date)} · {improvementText(record, unit)} over{' '}
          {formatRecordValue(record.type, record.previousBest, unit)}
        </span>
        {record.type === 'e1rm' && record.weightKg !== null && record.reps !== null ? (
          <span className="type-meta tabular block text-text-2">
            Estimated from {formatWeight(record.weightKg, unit)} × {record.reps}
          </span>
        ) : null}
      </span>
      <Value
        value={formatRecordValue(record.type, record.value, unit)}
        label={PR_LABELS[record.type]}
      />
      <ChevronRight className="size-5 shrink-0 text-text-3" aria-hidden />
    </button>
  );
});

const BestRow = memo(function BestRow({
  record: r,
  unit,
  isNew,
  onOpen,
}: {
  record: ExerciseRecords;
  unit: WeightUnit;
  isNew: boolean;
  onOpen: (exerciseId: string) => void;
}) {
  const other = r.mostReps
    ? { value: formatRecordValue('reps', r.mostReps.value, unit), label: 'Most reps' }
    : r.longestDuration
      ? {
          value: formatRecordValue('duration', r.longestDuration.value, unit),
          label: 'Longest time',
        }
      : r.longestDistance
        ? {
            value: formatRecordValue('distance', r.longestDistance.value, unit),
            label: 'Longest distance',
          }
        : null;
  return (
    <button type="button" onClick={() => onOpen(r.exerciseId)} className={rowCls}>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="type-headline min-w-0 text-text-1 [overflow-wrap:break-word]">
            {r.name}
          </span>
          {isNew ? <Badge tone="lime">New</Badge> : null}
        </span>
        <span className="type-meta mt-0.5 block truncate text-text-2">
          {MUSCLE_LABELS[r.primaryMuscle]} · {pluralize(r.sessions, 'session')}
        </span>
      </span>
      {r.heaviest ? (
        <Value
          value={formatWeight(r.heaviest.value, unit)}
          label={r.heaviest.reps ? `Heaviest × ${r.heaviest.reps}` : 'Heaviest'}
        />
      ) : other ? (
        <Value value={other.value} label={other.label} />
      ) : null}
      {r.bestE1rm ? (
        <Value
          value={formatWeight(r.bestE1rm.value, unit)}
          label="Estimated 1RM"
          className="hidden tab:block"
        />
      ) : null}
      {r.heaviest && other ? (
        <Value value={other.value} label={other.label} className="hidden lg:block" />
      ) : null}
      <ChevronRight className="size-5 shrink-0 text-text-3" aria-hidden />
    </button>
  );
});
