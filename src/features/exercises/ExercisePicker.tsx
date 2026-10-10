import { useDeferredValue, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/States';
import { useExerciseCatalog } from '@/data/hooks';
import {
  EMPTY_FILTERS,
  filterExercises,
  hasActiveFilters,
  recentExercises,
  type ExerciseFilters,
} from '@/domain/exercises/search';
import { pluralize } from '@/lib/format';
import type { MuscleGroup } from '@/domain/models/schemas';
import { CustomExerciseSheet } from './CustomExerciseSheet';
import { ExerciseFilterChips, SearchField } from './ExerciseFilters';
import { ExerciseRow } from './ExerciseRow';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** multi: tick several, then add. single: one tap picks and closes (swapping). */
  mode: 'multi' | 'single';
  onPick: (exerciseIds: string[]) => void | Promise<void>;
  /** Exercises already present; shown as such but still pickable. */
  presentIds?: string[];
  confirmLabel?: (count: number) => string;
  /** Start filtered to this muscle (swapping an exercise for a similar one). */
  suggestMuscle?: MuscleGroup;
}

export function ExercisePicker(props: Props) {
  return props.open ? <PickerContent {...props} /> : null;
}

function PickerContent({
  onClose,
  title,
  mode,
  onPick,
  presentIds = [],
  confirmLabel = (n) => `Add ${pluralize(n, 'exercise')}`,
  suggestMuscle,
}: Props) {
  const catalog = useExerciseCatalog();
  const [filters, setFilters] = useState<ExerciseFilters>(() =>
    suggestMuscle ? { ...EMPTY_FILTERS, muscle: suggestMuscle } : EMPTY_FILTERS,
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const query = useDeferredValue(filters.query);

  const exercises = catalog.data?.exercises;
  const results = useMemo(
    () => (exercises ? filterExercises(exercises, { ...filters, query }) : []),
    [exercises, filters, query],
  );
  const recents = useMemo(
    () => (catalog.data ? recentExercises(catalog.data.exercises, catalog.data.usage, 6) : []),
    [catalog.data],
  );
  const showRecents = !hasActiveFilters(filters) && recents.length > 0;
  const present = new Set(presentIds);

  async function pick(ids: string[]) {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await onPick(ids);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) => {
    if (mode === 'single') return void pick([id]);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const row = (e: (typeof results)[number]) => (
    <li key={e.id}>
      <ExerciseRow
        exercise={e}
        selectable={mode === 'multi'}
        selected={selected.includes(e.id)}
        onSelect={() => toggle(e.id)}
        trailing={
          present.has(e.id) ? <span className="text-sm text-faint">Current</span> : undefined
        }
      />
    </li>
  );

  return (
    <>
      <Sheet
        open={!creating}
        onClose={onClose}
        title={title}
        size="lg"
        className="sm:h-[min(92dvh,52rem)]"
        footer={
          mode === 'multi' ? (
            <Button
              block
              size="lg"
              disabled={selected.length === 0 || busy}
              onClick={() => pick(selected)}
            >
              {selected.length === 0 ? 'Select exercises' : confirmLabel(selected.length)}
            </Button>
          ) : undefined
        }
      >
        <div className="sticky top-0 z-10 -mx-5 flex flex-col gap-3 bg-surface px-5 pb-3">
          <SearchField
            value={filters.query}
            onChange={(q) => setFilters((f) => ({ ...f, query: q }))}
          />
          <ExerciseFilterChips filters={filters} onChange={setFilters} />
        </div>

        {catalog.status === 'loading' ? <Skeleton className="h-64" /> : null}

        {showRecents ? (
          <section aria-labelledby="picker-recent" className="mb-4">
            <h3 id="picker-recent" className="mb-1 px-2 text-sm font-semibold text-faint">
              Recently used
            </h3>
            <ul>{recents.map(row)}</ul>
          </section>
        ) : null}

        {catalog.data ? (
          <section aria-labelledby="picker-all">
            <h3 id="picker-all" className="mb-1 px-2 text-sm font-semibold text-faint">
              {hasActiveFilters(filters)
                ? pluralize(results.length, 'match', 'matches')
                : 'All exercises'}
            </h3>
            {results.length > 0 ? (
              <ul>{results.map(row)}</ul>
            ) : (
              <p className="px-2 py-6 text-muted">
                Nothing matches. Try fewer filters, or create it as your own exercise.
              </p>
            )}
          </section>
        ) : null}

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="pressable chrome type-headline mt-3 flex h-13 w-full items-center gap-3 rounded-nested bg-surface-2 px-4 text-left text-text-1"
        >
          <Plus className="size-5" aria-hidden />
          {filters.query.trim() ? `Create “${filters.query.trim()}”` : 'Create your own exercise'}
        </button>
      </Sheet>

      <CustomExerciseSheet
        open={creating}
        onClose={() => setCreating(false)}
        initialName={filters.query.trim()}
        onSaved={(e) => {
          setCreating(false);
          if (mode === 'single') void pick([e.id]);
          else setSelected((s) => [...s, e.id]);
          setFilters(EMPTY_FILTERS);
        }}
      />
    </>
  );
}
