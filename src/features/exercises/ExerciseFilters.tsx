import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Chips } from '@/components/ui/Fields';
import { CATEGORY_LABELS, EQUIPMENT_LABELS, MUSCLE_LABELS } from '@/domain/models/labels';
import { Equipment, MUSCLE_GROUPS } from '@/domain/models/schemas';
import type { ExerciseFilters as Filters, ExerciseSource } from '@/domain/exercises/search';
import { cn } from '@/lib/cn';

const muscleOptions = MUSCLE_GROUPS.map((m) => ({ value: m, label: MUSCLE_LABELS[m] }));
const equipmentOptions = Equipment.options.map((e) => ({ value: e, label: EQUIPMENT_LABELS[e] }));
const categoryOptions = (['compound', 'isolation'] as const).map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
}));
const sourceOptions: { value: Exclude<ExerciseSource, 'all'>; label: string }[] = [
  { value: 'library', label: 'Library' },
  { value: 'custom', label: 'Yours' },
];

export function SearchField({
  value,
  onChange,
  autoFocus,
  className,
  label = 'Search exercises',
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-11 items-center gap-2 rounded-field bg-surface-2 px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
        className,
      )}
    >
      <Search className="size-5 shrink-0 text-text-2" aria-hidden />
      <input
        type="search"
        aria-label={label}
        placeholder="Search by name, muscle or equipment"
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        onChange={(e) => onChange(e.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent text-[1.0625rem] text-text-1 outline-none placeholder:text-text-3 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="-mr-1.5 inline-flex size-9 items-center justify-center rounded-full text-faint hover:text-text"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

interface Props {
  filters: Filters;
  onChange: (next: Filters) => void;
  /** Show the equipment, type and source rows (the full page) or just muscles (pickers). */
  full?: boolean;
}

export function ExerciseFilterChips({ filters, onChange, full }: Props) {
  const extra =
    Number(filters.equipment !== null) +
    Number(filters.category !== null) +
    Number(filters.source !== 'all');
  const [expanded, setExpanded] = useState(extra > 0);
  const show = !full || expanded;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start gap-2">
        <Chips
          label="Muscle group"
          allLabel="All muscles"
          options={muscleOptions}
          value={filters.muscle}
          onChange={(muscle) => onChange({ ...filters, muscle })}
          className="min-w-0 flex-1"
        />
      </div>
      {full ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
          className="pressable tap-target type-meta inline-flex h-9 w-fit items-center gap-1.5 rounded-full px-1 font-medium text-text-1"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          {expanded ? 'Fewer filters' : 'More filters'}
          {extra > 0 ? (
            <span className="type-caption tabular rounded-full bg-surface-2 px-2 leading-5 text-text-1">
              {extra}
            </span>
          ) : null}
        </button>
      ) : null}
      {show ? (
        <Chips
          label="Equipment"
          allLabel="Any equipment"
          options={equipmentOptions}
          value={filters.equipment}
          onChange={(equipment) => onChange({ ...filters, equipment })}
        />
      ) : null}
      {full && expanded ? (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-6">
          <Chips
            label="Exercise type"
            allLabel="Any type"
            options={categoryOptions}
            value={filters.category}
            onChange={(category) => onChange({ ...filters, category })}
          />
          <Chips
            label="Source"
            allLabel="All exercises"
            options={sourceOptions}
            value={filters.source === 'all' ? null : filters.source}
            onChange={(source) => onChange({ ...filters, source: source ?? 'all' })}
          />
        </div>
      ) : null}
    </div>
  );
}
