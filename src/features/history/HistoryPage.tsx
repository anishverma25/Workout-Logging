import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, History as HistoryIcon, SlidersHorizontal, Trophy, X } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ActionList, Chips } from '@/components/ui/Fields';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { usePreferences, useTrainingData } from '@/data/hooks';
import {
  filterHistory,
  groupByWeek,
  historyEntries,
  historyFilterOptions,
  NO_HISTORY_FILTERS,
  type HistoryEntry,
  type HistoryFilters,
  type HistoryRange,
} from '@/domain/analytics/history';
import { formatRecordValue, PR_LABELS } from '@/domain/analytics/prs';
import { MUSCLE_LABELS } from '@/domain/models/labels';
import { MUSCLE_GROUPS } from '@/domain/models/schemas';
import { cn } from '@/lib/cn';
import { addDays, formatDayMonth, formatWeekdayShort, startOfWeek } from '@/lib/dates';
import { formatCompact, formatDurationMinutes, pluralize } from '@/lib/format';
import { formatWeightValue, toDisplayWeight, type WeightUnit } from '@/lib/units';
import { useNow } from '@/lib/useNow';
import { useStartWorkout } from '../workout/StartWorkout';

const RANGES: { value: HistoryRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
];

const WEEKS_PER_PAGE = 12;

export function HistoryPage() {
  const training = useTrainingData();
  const prefs = usePreferences();
  const now = useNow();
  const start = useStartWorkout();
  const [filters, setFilters] = useState<HistoryFilters>(NO_HISTORY_FILTERS);
  const [picker, setPicker] = useState<'workout' | 'exercise' | 'muscle' | null>(null);

  const entries = useMemo(
    () => (training.data ? historyEntries(training.data) : []),
    [training.data],
  );
  const options = useMemo(() => historyFilterOptions(entries), [entries]);
  const filtered = useMemo(
    () => (training.data ? filterHistory(entries, filters, training.data.exercises, now) : []),
    [entries, filters, training.data, now],
  );
  const weeks = useMemo(
    () => groupByWeek(filtered, prefs.weekStartsOn),
    [filtered, prefs.weekStartsOn],
  );
  // Long histories render a few months at a time, so opening History stays instant after
  // years of training. Changing the filters starts again from the most recent weeks.
  const filtersKey = JSON.stringify(filters);
  const [shown, setShown] = useState({ key: filtersKey, weeks: WEEKS_PER_PAGE });
  const weekLimit = shown.key === filtersKey ? shown.weeks : WEEKS_PER_PAGE;
  const visibleWeeks = weeks.slice(0, weekLimit);
  const hiddenWorkouts = weeks.slice(weekLimit).reduce((n, w) => n + w.entries.length, 0);
  const exerciseName = options.exercises.find((e) => e.id === filters.exerciseId)?.name;
  const active =
    filters.workoutName !== null || filters.exerciseId !== null || filters.muscle !== null;

  return (
    <>
      <PageHeader
        title="History"
        subtitle={
          entries.length > 0
            ? `${pluralize(entries.length, 'workout')} logged. Every set exactly as you did it.`
            : undefined
        }
      />
      {training.status === 'loading' ? <Skeleton className="h-96" /> : null}
      {training.status === 'error' ? <ErrorState error={training.error} /> : null}

      {training.status === 'success' && entries.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon className="size-5" aria-hidden />}
          title="No workouts yet"
          body="Every finished workout lands here with its sets, volume and records, so you can see exactly what you did and when, and spot progress over weeks."
          actions={<Button onClick={() => start(null)}>Start a workout</Button>}
        />
      ) : null}

      {entries.length > 0 ? (
        <>
          <div className="flex flex-col gap-2.5">
            <Chips
              label="Date range"
              options={RANGES}
              value={filters.range}
              onChange={(range) => setFilters((f) => ({ ...f, range: range ?? 'all' }))}
            />
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              <FilterButton
                label="Workout"
                value={filters.workoutName}
                onOpen={() => setPicker('workout')}
                onClear={() => setFilters((f) => ({ ...f, workoutName: null }))}
              />
              <FilterButton
                label="Exercise"
                value={exerciseName ?? null}
                onOpen={() => setPicker('exercise')}
                onClear={() => setFilters((f) => ({ ...f, exerciseId: null }))}
              />
              <FilterButton
                label="Muscle"
                value={filters.muscle ? MUSCLE_LABELS[filters.muscle] : null}
                onOpen={() => setPicker('muscle')}
                onClear={() => setFilters((f) => ({ ...f, muscle: null }))}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-8 rounded-[var(--radius-card)] border border-dashed border-line-strong p-6">
              <p className="font-semibold">No workouts match these filters</p>
              <p className="mt-1 text-sm text-muted">Try a longer date range or remove a filter.</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => setFilters(NO_HISTORY_FILTERS)}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-faint" aria-live="polite">
              {active || filters.range !== 'all'
                ? `${pluralize(filtered.length, 'workout')} shown`
                : null}
            </p>
          )}

          <div className="mt-2 flex flex-col gap-8">
            {visibleWeeks.map((week) => (
              <section
                key={week.weekStart.toISOString()}
                aria-label={weekLabel(week.weekStart, now, prefs.weekStartsOn)}
              >
                <header className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-xl font-semibold">
                    {weekLabel(week.weekStart, now, prefs.weekStartsOn)}
                  </h2>
                  <p className="tabular text-sm text-faint">
                    {pluralize(week.entries.length, 'workout')} · {week.workingSets} sets
                    {week.volumeKg > 0
                      ? ` · ${formatCompact(toDisplayWeight(week.volumeKg, prefs.weightUnit))} ${prefs.weightUnit}`
                      : ''}
                  </p>
                </header>
                <ol className="relative flex flex-col gap-2.5 before:absolute before:bottom-3 before:left-[1.45rem] before:top-3 before:w-px before:bg-line lg:before:hidden">
                  {week.entries.map((e) => (
                    <li key={e.session.workout.id}>
                      <EntryRow entry={e} unit={prefs.weightUnit} />
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
          {hiddenWorkouts > 0 ? (
            <Button
              variant="secondary"
              block
              className="mt-8"
              onClick={() => setShown({ key: filtersKey, weeks: weekLimit + WEEKS_PER_PAGE })}
            >
              Show older workouts ({hiddenWorkouts} more)
            </Button>
          ) : null}
        </>
      ) : null}

      <Sheet open={picker === 'workout'} onClose={() => setPicker(null)} title="Filter by workout">
        <ActionList
          items={options.workoutNames.map((w) => ({
            label: w.name,
            hint: pluralize(w.count, 'time'),
            icon: <HistoryIcon className="size-5" aria-hidden />,
            onSelect: () => {
              setFilters((f) => ({ ...f, workoutName: w.name }));
              setPicker(null);
            },
          }))}
        />
      </Sheet>
      <Sheet
        open={picker === 'exercise'}
        onClose={() => setPicker(null)}
        title="Filter by exercise"
      >
        <ActionList
          items={options.exercises.map((x) => ({
            label: x.name,
            hint: `In ${pluralize(x.count, 'workout')}`,
            icon: (
              <span className="block size-5 text-center font-display font-bold">{x.name[0]}</span>
            ),
            onSelect: () => {
              setFilters((f) => ({ ...f, exerciseId: x.id }));
              setPicker(null);
            },
          }))}
        />
      </Sheet>
      <Sheet
        open={picker === 'muscle'}
        onClose={() => setPicker(null)}
        title="Filter by muscle"
        description="Workouts that trained it as a primary or secondary muscle."
      >
        <div className="grid grid-cols-2 gap-2">
          {MUSCLE_GROUPS.map((m) => (
            <Button
              key={m}
              variant={filters.muscle === m ? 'primary' : 'secondary'}
              onClick={() => {
                setFilters((f) => ({ ...f, muscle: m }));
                setPicker(null);
              }}
            >
              {MUSCLE_LABELS[m]}
            </Button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

function weekLabel(weekStart: Date, now: Date, weekStartsOn: 0 | 1): string {
  const current = startOfWeek(now, weekStartsOn);
  if (weekStart.getTime() === current.getTime()) return 'This week';
  if (weekStart.getTime() === addDays(current, -7).getTime()) return 'Last week';
  return `${formatDayMonth(weekStart)} to ${formatDayMonth(addDays(weekStart, 6))}`;
}

function FilterButton({
  label,
  value,
  onOpen,
  onClear,
}: {
  label: string;
  value: string | null;
  onOpen: () => void;
  onClear: () => void;
}) {
  if (value) {
    return (
      <span className="inline-flex h-9 shrink-0 items-center rounded-full bg-text pl-3.5 text-sm font-semibold text-bg">
        <button type="button" onClick={onOpen} className="max-w-48 truncate">
          {value}
        </button>
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${label.toLowerCase()} filter`}
          className="ml-1 inline-flex size-9 items-center justify-center rounded-full"
        >
          <X className="size-4" aria-hidden />
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm font-semibold text-muted hover:text-text"
    >
      <SlidersHorizontal className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}

function EntryRow({ entry, unit }: { entry: HistoryEntry; unit: WeightUnit }) {
  const { session } = entry;
  const h = entry.highlight;
  return (
    <Link
      to={`/history/${session.workout.id}`}
      className="group relative flex items-stretch gap-3 rounded-[var(--radius-card)] bg-surface p-3.5 pr-3 transition-colors hover:border-line-strong lg:grid lg:grid-cols-[4.5rem_minmax(0,1.4fr)_minmax(0,1fr)_6rem_6rem_1.5rem] lg:items-center lg:gap-5 lg:px-5"
    >
      <div className="relative z-[1] flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-2 py-1.5 text-center lg:w-auto">
        <span className="text-[0.7rem] font-medium text-faint">
          {formatWeekdayShort(session.date)}
        </span>
        <span className="tabular font-display text-xl font-bold leading-tight">
          {session.date.getDate()}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="truncate font-display text-[1.25rem] font-bold leading-tight">
            {session.workout.name}
          </span>
          {entry.prExercises > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-text">
              <Trophy className="size-3" aria-hidden />
              {entry.prExercises}
              <span className="sr-only">{entry.prExercises === 1 ? 'record' : 'records'}</span>
            </span>
          ) : null}
        </p>
        <p className="tabular mt-0.5 text-sm text-muted lg:hidden">
          {entry.minutes !== null ? `${formatDurationMinutes(entry.minutes)} · ` : ''}
          {entry.workingSets} sets
          {entry.volumeKg > 0
            ? ` · ${formatCompact(toDisplayWeight(entry.volumeKg, unit))} ${unit}`
            : ''}
        </p>
        <p className="mt-0.5 truncate text-sm text-faint">{entry.exerciseNames.join(', ')}</p>
        {h.kind === 'pr' ? (
          <p className="mt-1 truncate text-sm font-medium text-accent-text lg:hidden">
            <Highlight entry={entry} unit={unit} />
          </p>
        ) : null}
      </div>

      <p
        className={cn(
          'hidden min-w-0 text-sm lg:block',
          h.kind === 'pr' ? 'text-accent-text' : 'text-muted',
        )}
      >
        <Highlight entry={entry} unit={unit} />
      </p>
      <p className="tabular hidden text-right text-sm lg:block">
        <span className="block font-semibold">{entry.workingSets} sets</span>
        <span className="text-faint">
          {entry.volumeKg > 0
            ? `${formatCompact(toDisplayWeight(entry.volumeKg, unit))} ${unit}`
            : ''}
        </span>
      </p>
      <p className="tabular hidden text-right text-sm text-muted lg:block">
        {entry.minutes !== null ? formatDurationMinutes(entry.minutes) : ''}
      </p>
      <ChevronRight
        className="hidden size-5 self-center text-faint transition-transform group-hover:translate-x-0.5 sm:block"
        aria-hidden
      />
    </Link>
  );
}

function Highlight({ entry, unit }: { entry: HistoryEntry; unit: WeightUnit }) {
  const h = entry.highlight;
  if (h.kind === 'pr') {
    return (
      <>
        {PR_LABELS[h.record.type]} on {h.record.exerciseName}:{' '}
        {formatRecordValue(h.record.type, h.record.value, unit)}
      </>
    );
  }
  if (h.kind === 'top_set') {
    return (
      <>
        Top set {h.exerciseName} {formatWeightValue(h.weightKg, unit)} × {h.reps}
      </>
    );
  }
  return null;
}
