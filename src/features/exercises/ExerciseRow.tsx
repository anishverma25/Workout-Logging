import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { exerciseMeta, MUSCLE_LABELS } from '@/domain/models/labels';
import type { Exercise } from '@/domain/models/schemas';
import { cn } from '@/lib/cn';

/** Two-letter muscle marker, so a long list scans by body part at a glance. */
export function MuscleMark({ exercise, className }: { exercise: Exercise; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 font-display text-[0.95rem] font-semibold uppercase tracking-wide text-muted',
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
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selectable ? !!selected : undefined}
      className={cn(
        'flex min-h-16 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-surface-2',
        selected && 'bg-accent-soft hover:bg-accent-soft',
      )}
    >
      <MuscleMark
        exercise={exercise}
        className={selected ? 'bg-accent text-accent-ink' : undefined}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">{exercise.name}</span>
          {exercise.isCustom ? <Badge tone="accent">Yours</Badge> : null}
        </span>
        <span className="mt-0.5 block truncate text-sm text-faint">{exerciseMeta(exercise)}</span>
      </span>
      {selectable ? (
        <span
          aria-hidden
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            selected ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong',
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
