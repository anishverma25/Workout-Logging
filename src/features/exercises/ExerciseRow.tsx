import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { exerciseMeta } from '@/domain/models/labels';
import type { Exercise } from '@/domain/models/schemas';
import { cn } from '@/lib/cn';
import { sharesFor, sharesSummary } from '@/data/library/shares';

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
        // No two-letter tile (UI v3, G9), and hover only where there is a mouse, so a tapped
        // row never looks stuck pressed on a phone (F7).
        'pressable chrome flex min-h-14 w-full items-center gap-3 py-2.5 text-left [@media(hover:hover)]:hover:opacity-80',
        selectable && 'rounded-nested px-2',
        selected && 'bg-surface-2',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[1.0625rem] leading-[1.375rem] text-text-1">
            {exercise.name}
          </span>
          {exercise.isCustom ? <Badge>Yours</Badge> : null}
        </span>
        <span className="type-subhead mt-0.5 block truncate text-text-2">
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
