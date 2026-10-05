import { useDeferredValue, useMemo, useState } from 'react';
import { Library, Plus } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useExerciseCatalog } from '@/data/hooks';
import {
  EMPTY_FILTERS,
  filterExercises,
  hasActiveFilters,
  recentExercises,
  type ExerciseFilters,
} from '@/domain/exercises/search';
import type { Exercise } from '@/domain/models/schemas';
import { formatRelativeDay } from '@/lib/dates';
import { pluralize } from '@/lib/format';
import { CustomExerciseSheet } from './CustomExerciseSheet';
import { ExerciseDetailSheet } from './ExerciseDetailSheet';
import { ExerciseFilterChips, SearchField } from './ExerciseFilters';
import { ExerciseRow } from './ExerciseRow';

export function ExercisesPage() {
  const catalog = useExerciseCatalog();
  const [filters, setFilters] = useState<ExerciseFilters>(EMPTY_FILTERS);
  const query = useDeferredValue(filters.query);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const data = catalog.data;
  const results = useMemo(
    () => (data ? filterExercises(data.exercises, { ...filters, query }) : []),
    [data, filters, query],
  );
  const recents = useMemo(
    () => (data ? recentExercises(data.exercises, data.usage, 8) : []),
    [data],
  );
  const lastUsed = useMemo(
    () => new Map(data?.usage.map((u) => [u.exerciseId, new Date(u.lastUsedAt)]) ?? []),
    [data],
  );
  const customCount = data?.exercises.filter((e) => e.isCustom).length ?? 0;
  const open = data?.exercises.find((e) => e.id === openId) ?? null;
  const filtering = hasActiveFilters(filters);

  const row = (e: Exercise) => {
    const used = lastUsed.get(e.id);
    return (
      <li key={e.id}>
        <ExerciseRow
          exercise={e}
          onSelect={() => setOpenId(e.id)}
          trailing={
            used ? (
              <span className="hidden shrink-0 text-sm text-faint sm:inline">
                {formatRelativeDay(used)}
              </span>
            ) : undefined
          }
        />
      </li>
    );
  };

  return (
    <>
      <PageHeader
        title="Exercises"
        subtitle={
          data
            ? `${data.exercises.length - customCount} in the library${customCount ? `, ${customCount} of your own` : ''}`
            : 'The movement library'
        }
        actions={
          <Button
            size="sm"
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => setCreating(true)}
            className="max-sm:hidden"
          >
            New exercise
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <SearchField
          value={filters.query}
          onChange={(q) => setFilters((f) => ({ ...f, query: q }))}
        />
        <ExerciseFilterChips filters={filters} onChange={setFilters} full />
      </div>

      {catalog.status === 'loading' ? <Skeleton className="mt-6 h-96" /> : null}
      {catalog.status === 'error' ? (
        <div className="mt-6">
          <ErrorState error={catalog.error} onRetry={() => window.location.reload()} />
        </div>
      ) : null}

      {data && filters.source === 'custom' && customCount === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<Library className="size-5" aria-hidden />}
          title="No exercises of your own yet"
          body="If a movement is missing from the library, add it yourself. Choose its muscles and how it is tracked, and it works everywhere: routines, workouts, records and analytics."
          actions={
            <Button
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => setCreating(true)}
            >
              Create an exercise
            </Button>
          }
        />
      ) : null}

      {data && !filtering && recents.length > 0 ? (
        <section aria-labelledby="recent-exercises" className="mt-7">
          <h2 id="recent-exercises" className="mb-1 px-2 font-display text-xl font-semibold">
            Recently used
          </h2>
          <ul className="grid sm:grid-cols-2 sm:gap-x-4">{recents.map(row)}</ul>
        </section>
      ) : null}

      {data && !(filters.source === 'custom' && customCount === 0) ? (
        <section aria-labelledby="all-exercises" className="mt-7">
          <div className="mb-1 flex items-baseline justify-between px-2">
            <h2 id="all-exercises" className="font-display text-xl font-semibold">
              {filtering ? pluralize(results.length, 'match', 'matches') : 'All exercises'}
            </h2>
            {filtering ? (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-sm font-medium text-accent-text underline-offset-4 hover:underline"
              >
                Clear filters
              </button>
            ) : null}
          </div>
          {results.length > 0 ? (
            <ul className="grid sm:grid-cols-2 sm:gap-x-4">{results.map(row)}</ul>
          ) : (
            <div className="px-2 py-8">
              <p className="text-muted">Nothing matches those filters.</p>
              <Button
                variant="secondary"
                className="mt-3"
                icon={<Plus className="size-4" aria-hidden />}
                onClick={() => setCreating(true)}
              >
                {filters.query.trim() ? `Create “${filters.query.trim()}”` : 'Create an exercise'}
              </Button>
            </div>
          )}
        </section>
      ) : null}

      {/* Floating create button on phones, in thumb reach above the tab bar. */}
      <Button
        onClick={() => setCreating(true)}
        icon={<Plus className="size-5" aria-hidden />}
        className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-30 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.5)] sm:hidden"
      >
        New
      </Button>

      <ExerciseDetailSheet exercise={open} onClose={() => setOpenId(null)} />
      <CustomExerciseSheet
        open={creating}
        onClose={() => setCreating(false)}
        initialName={filters.query.trim()}
        onSaved={(e) => setOpenId(e.id)}
      />
    </>
  );
}
