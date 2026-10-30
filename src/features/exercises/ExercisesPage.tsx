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
import { IconButton, TextLink } from '@/components/kit';
import { CustomExerciseSheet } from './CustomExerciseSheet';
import { ExerciseDetailSheet } from './ExerciseDetailSheet';
import { ExerciseFilterChips, SearchField } from './ExerciseFilters';
import { ExerciseRow } from './ExerciseRow';

const GROUP = 'divide-y-[0.5px] divide-divider rounded-card bg-surface px-4';

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
  const letters = useMemo(() => {
    const groups = new Map<string, Exercise[]>();
    for (const e of results) {
      const first = e.name.trim()[0]?.toUpperCase() ?? '#';
      const key = /[A-Z]/.test(first) ? first : '#';
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [results]);

  const row = (e: Exercise) => {
    const used = lastUsed.get(e.id);
    return (
      <li key={e.id}>
        <ExerciseRow
          exercise={e}
          onSelect={() => setOpenId(e.id)}
          trailing={
            used ? (
              <span className="type-meta hidden shrink-0 text-text-2 sm:inline">
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
        back={{ to: '/more', label: 'More' }}
        title="Exercises"
        subtitle={data ? pluralize(data.exercises.length, 'exercise') : undefined}
        actions={
          <IconButton
            label="New exercise"
            icon={<Plus className="size-5" aria-hidden />}
            onClick={() => setCreating(true)}
          />
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
          <h2 id="recent-exercises" className="type-section mb-2 text-text-1">
            Recently used
          </h2>
          <ul className={GROUP}>{recents.slice(0, 5).map(row)}</ul>
        </section>
      ) : null}

      {data && !(filters.source === 'custom' && customCount === 0) ? (
        <section aria-labelledby="all-exercises" className="mt-7">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 id="all-exercises" className="type-section text-text-1">
              {filtering ? pluralize(results.length, 'match', 'matches') : 'All exercises'}
            </h2>
            {filtering ? (
              <TextLink small onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear filters
              </TextLink>
            ) : null}
          </div>
          {results.length > 0 && filtering ? (
            <ul className={GROUP}>{results.map(row)}</ul>
          ) : results.length > 0 ? (
            // A to Z with sticky letters and an index down the side (UI v3, S13.3).
            <div className="flex flex-col gap-4 pr-5 lg:pr-0">
              {letters.map(([letter, list]) => (
                <section key={letter} id={`letter-${letter}`} className="scroll-mt-28">
                  <h3 className="type-headline sticky top-[calc(2.75rem+env(safe-area-inset-top))] z-10 -mx-1 bg-bg/90 px-1 py-1 text-text-2 backdrop-blur lg:top-0">
                    {letter}
                  </h3>
                  <ul className={GROUP}>{list.map(row)}</ul>
                </section>
              ))}
              <nav
                aria-label="Jump to a letter"
                className="fixed top-1/2 right-0.5 z-20 flex -translate-y-1/2 flex-col items-center lg:hidden"
              >
                {letters.map(([letter]) => (
                  <a
                    key={letter}
                    href={`#letter-${letter}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(`letter-${letter}`)?.scrollIntoView();
                    }}
                    className="chrome type-caption flex h-[1.05rem] w-5 items-center justify-center font-semibold text-lime"
                  >
                    {letter}
                  </a>
                ))}
              </nav>
            </div>
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
