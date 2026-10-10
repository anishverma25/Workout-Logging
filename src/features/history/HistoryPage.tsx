import { WorkoutRow } from '@/features/shared/WorkoutRow';
import { workoutStats } from '@/features/shared/workoutStats';
import { useMemo, useState } from 'react';
import { ChevronDown, History as HistoryIcon, X } from 'lucide-react';
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
import { MUSCLE_LABELS } from '@/domain/models/labels';
import { MUSCLE_GROUPS } from '@/domain/models/schemas';
import { addDays, startOfWeek } from '@/lib/dates';
import { formatDateRange, formatNumber, pluralize } from '@/lib/format';
import { toDisplayWeight, type WeightUnit } from '@/lib/units';
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
    <div className="max-w-[45rem]">
      <PageHeader
        title="History"
        subtitle={entries.length > 0 ? `${pluralize(entries.length, 'workout')} logged` : undefined}
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
            <div className="mt-8 flex flex-col items-center gap-1 rounded-nested bg-surface-2 px-5 py-5 text-center">
              <p className="type-headline text-text-1">No workouts match these filters</p>
              <p className="type-meta text-text-2">Try a longer date range or remove a filter.</p>
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
            <p className="type-meta mt-4 text-text-2" aria-live="polite">
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
                <header className="mb-3">
                  <h2 className="type-title text-text-1">
                    {weekLabel(week.weekStart, now, prefs.weekStartsOn)}
                  </h2>
                  <p className="type-meta tabular mt-0.5 text-text-2">
                    {pluralize(week.entries.length, 'workout')} ·{' '}
                    {pluralize(week.workingSets, 'set')}
                    {week.volumeKg > 0
                      ? ` · ${formatNumber(toDisplayWeight(week.volumeKg, prefs.weightUnit), 0)} ${prefs.weightUnit}`
                      : ''}
                  </p>
                </header>
                <ol className="divide-y-[0.5px] divide-divider rounded-panel border border-border bg-surface px-4">
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
    </div>
  );
}

function weekLabel(weekStart: Date, now: Date, weekStartsOn: 0 | 1): string {
  const current = startOfWeek(now, weekStartsOn);
  if (weekStart.getTime() === current.getTime()) return 'This week';
  if (weekStart.getTime() === addDays(current, -7).getTime()) return 'Last week';
  return formatDateRange(weekStart, addDays(weekStart, 6), now);
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
      <span className="chrome type-meta inline-flex h-9 shrink-0 items-center rounded-full bg-text-1 pl-4 font-semibold text-bg">
        <button type="button" onClick={onOpen} className="max-w-56 truncate">
          {label}: {value}
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
      className="pressable chrome type-meta inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-surface-2 pr-3 pl-4 font-semibold text-text-1"
    >
      {label}
      <ChevronDown className="size-4 text-text-2" aria-hidden />
    </button>
  );
}

function EntryRow({ entry, unit }: { entry: HistoryEntry; unit: WeightUnit }) {
  const { session } = entry;
  return (
    <WorkoutRow
      to={`/history/${session.workout.id}`}
      date={session.date}
      name={session.workout.name}
      stats={workoutStats(entry.minutes, entry.workingSets, entry.volumeKg, unit)}
      exercises={entry.exerciseNames}
      records={entry.prExercises}
    />
  );
}
