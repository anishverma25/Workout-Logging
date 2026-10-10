import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { exerciseMeta, MUSCLE_LABELS } from '@/domain/models/labels';
import type { Exercise } from '@/domain/models/schemas';
import { cn } from '@/lib/cn';
import { sharesFor, sharesSummary } from '@/data/library/shares';

/** Two-letter muscle marker, so a long list scans by body part at a glance. */
export function MuscleMark({ exercise, className }: { exercise: Exercise; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'type-caption flex size-10 shrink-0 items-center justify-center rounded-tile bg-surface-2 font-semibold uppercase tracking-wide text-text-2',
        className,
      )}
    >
      {MUSCLE_LABELS[exercise.primaryMuscle].slice(0, 2)}
    </span>
  );
}

interface RowProps {
  exercise: Exercise;
  onSelect: () => void;
  selected?: boolean;
  /** Multi-select pickers show a check; plain lists show trailing content instead. */
  selectable?: boolean;
  trailing?: ReactNode;
}

export function ExerciseRow({ exercise, onSelect, selected, selectable, trailing }: RowProps) {
  const shares = sharesFor(exercise.id);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selectable ? !!selected : undefined}
      className={cn(
        'pressable chrome flex min-h-16 w-full items-center gap-3 rounded-nested px-2 py-2 text-left hover:bg-surface-2',
        selected && 'bg-surface-2',
      )}
    >
      <MuscleMark exercise={exercise} className={selected ? 'bg-text-1 text-bg' : undefined} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="type-headline truncate text-text-1">{exercise.name}</span>
          {exercise.isCustom ? <Badge>Yours</Badge> : null}
        </span>
        <span className="type-meta mt-0.5 block truncate text-text-2">
          {exerciseMeta(exercise)}
        </span>
        {shares ? (
          <span className="type-meta tabular block truncate text-text-2">
            {sharesSummary(shares)}
          </span>
        ) : null}
      </span>
      {selectable ? (
        <span
          aria-hidden
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            selected ? 'border-lime bg-lime text-on-lime' : 'border-border-strong',
          )}
        >
          {selected ? <Check className="size-4" strokeWidth={3} /> : null}
        </span>
      ) : (
        trailing
      )}
    </button>
  );
}
