import { useDeferredValue, useMemo, useState } from 'react';
import { ChevronRight, Trophy } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
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
import { SearchField } from '../exercises/ExerciseFilters';
import { ExerciseRecordsSheet } from './ExerciseRecordsSheet';
import { improvementText } from './format';

const RECENT_DAYS = 30;

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
  const shown = records.filter(
    (r) =>
      (!muscle || r.primaryMuscle === muscle) &&
      (q.trim() === '' || normalize(r.name).includes(normalize(q))),
  );
  const open = records.find((r) => r.exerciseId === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Personal records"
        subtitle="Found in your logged sets, never entered by hand. Estimates are always labelled."
      />
      {training.status === 'loading' ? <Skeleton className="h-96" /> : null}
      {training.status === 'error' ? <ErrorState error={training.error} /> : null}

      {training.status === 'success' && records.length === 0 ? (
        <EmptyState
          icon={<Trophy className="size-5" aria-hidden />}
          title="No records yet"
          body="Your first session with an exercise sets the baseline. Beat it later, with more weight, more reps or a higher estimated 1RM, and the record appears here with the date and how much you improved."
        />
      ) : null}

      {records.length > 0 ? (
        <>
          <section aria-labelledby="recent-prs">
            <h2 id="recent-prs" className="mb-3 font-display text-xl font-semibold">
              Last {RECENT_DAYS} days
            </h2>
            {recent.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line-strong p-5 text-sm text-muted">
                No new records in the last {RECENT_DAYS} days. Records come from beating an earlier
                best, so they arrive in bursts, not every week.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {recent.slice(0, 9).map((pr) => (
                  <li key={pr.id}>
                    <RecordCard
                      record={pr}
                      unit={prefs.weightUnit}
                      onOpen={() => setOpenId(pr.exerciseId)}
                    />
                  </li>
                ))}
              </ul>
            )}
            {recent.length > 9 ? (
              <p className="mt-2 text-sm text-faint">
                and {pluralize(recent.length - 9, 'more record')}. Open an exercise to see all of
                them.
              </p>
            ) : null}
          </section>

          <section aria-labelledby="all-bests" className="mt-9">
            <h2 id="all-bests" className="mb-3 font-display text-xl font-semibold">
              Bests by exercise
            </h2>
            <div className="mb-3 flex flex-col gap-2.5">
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
            <Card className="overflow-hidden">
              <div
                aria-hidden
                className="hidden grid-cols-[minmax(0,1fr)_8rem_9rem_7rem_1.25rem] gap-4 border-b border-line px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-faint md:grid"
              >
                <span>Exercise</span>
                <span className="text-right">Heaviest lifted</span>
                <span className="text-right">Estimated 1RM</span>
                <span className="text-right">Other best</span>
                <span />
              </div>
              <ul className="divide-y divide-line">
                {shown.map((r) => (
                  <li key={r.exerciseId}>
                    <BestRow
                      record={r}
                      unit={prefs.weightUnit}
                      onOpen={() => setOpenId(r.exerciseId)}
                    />
                  </li>
                ))}
              </ul>
              {shown.length === 0 ? (
                <p className="p-5 text-sm text-muted">No exercises match.</p>
              ) : null}
            </Card>
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

function RecordCard({
  record,
  unit,
  onOpen,
}: {
  record: PersonalRecord;
  unit: WeightUnit;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full w-full flex-col rounded-[var(--radius-card)] border border-line bg-surface p-4 text-left shadow-[var(--shadow-card)] transition-colors hover:border-line-strong"
    >
      <span className="flex items-center justify-between gap-2">
        <Badge tone="accent">
          <Trophy className="size-3" aria-hidden />
          {PR_LABELS[record.type]}
        </Badge>
        <span className="text-sm text-faint">{formatRelativeDay(record.date)}</span>
      </span>
      <span className="mt-3 truncate font-semibold">{record.exerciseName}</span>
      <span className="tabular mt-1 font-display text-[2rem] font-bold leading-none">
        {formatRecordValue(record.type, record.value, unit)}
      </span>
      <span className="tabular mt-2 text-sm text-muted">
        <span className="font-semibold text-accent-text">{improvementText(record, unit)}</span> over{' '}
        {formatRecordValue(record.type, record.previousBest, unit)}
      </span>
      {record.type === 'e1rm' && record.weightKg !== null && record.reps !== null ? (
        <span className="mt-1 text-xs text-faint">
          Estimated from {formatWeight(record.weightKg, unit)} × {record.reps}
        </span>
      ) : null}
    </button>
  );
}

function BestRow({
  record: r,
  unit,
  onOpen,
}: {
  record: ExerciseRecords;
  unit: WeightUnit;
  onOpen: () => void;
}) {
  const other = r.mostReps
    ? formatRecordValue('reps', r.mostReps.value, unit)
    : r.longestDuration
      ? formatRecordValue('duration', r.longestDuration.value, unit)
      : r.longestDistance
        ? formatRecordValue('distance', r.longestDistance.value, unit)
        : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-surface-2 md:grid-cols-[minmax(0,1fr)_8rem_9rem_7rem_1.25rem] md:px-5"
    >
      <span className="min-w-0">
        <span className="block truncate font-semibold">{r.name}</span>
        <span className="text-sm text-faint">
          {MUSCLE_LABELS[r.primaryMuscle]} · {pluralize(r.sessions, 'session')}
        </span>
      </span>
      <span className="tabular text-right md:block">
        {r.heaviest ? (
          <>
            <span className="block font-display text-lg font-semibold leading-tight">
              {formatWeight(r.heaviest.value, unit)}
            </span>
            <span className="text-xs text-faint md:hidden">heaviest</span>
            <span className="hidden text-xs text-faint md:inline">× {r.heaviest.reps}</span>
          </>
        ) : other ? (
          <span className="font-display text-lg font-semibold md:hidden">{other}</span>
        ) : null}
      </span>
      <span className="tabular hidden text-right md:block">
        {r.bestE1rm ? (
          <>
            <span className="block font-display text-lg font-semibold leading-tight">
              {formatWeight(r.bestE1rm.value, unit)}
            </span>
            <span className="text-xs text-faint">estimate</span>
          </>
        ) : (
          <span className="text-faint">n/a</span>
        )}
      </span>
      <span className="tabular hidden text-right font-display text-lg font-semibold md:block">
        {other ?? <span className="font-sans text-base font-normal text-faint">n/a</span>}
      </span>
      <ChevronRight className="hidden size-4 text-faint md:block" aria-hidden />
    </button>
  );
}
