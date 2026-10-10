import { memo } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Trophy } from 'lucide-react';
import { cn } from '@/lib/cn';
import { shortDayName } from '@/lib/format';

interface WorkoutRowProps {
  to: string;
  date: Date;
  name: string;
  /** "44 min · 18 sets · 4,210 kg", Meta --text-2. */
  stats: string;
  /** Exercise names, one line with an ellipsis. */
  exercises: string[];
  /** Records set in this workout; shows a lime-dim badge. */
  records?: number;
  className?: string;
}

/**
 * One logged workout (UI Part 2, item 13), shared by Home's recent workouts and the History
 * list: a 56 × 56 date tile, the name, a stats line, the exercises and a chevron.
 */
export const WorkoutRow = memo(function WorkoutRow({
  to,
  date,
  name,
  stats,
  exercises,
  records = 0,
  className,
}: WorkoutRowProps) {
  return (
    <Link
      to={to}
      className={cn('pressable chrome flex items-center gap-3 rounded-nested py-2', className)}
    >
      <span
        aria-hidden
        className="flex size-14 shrink-0 flex-col items-center justify-center rounded-nested bg-surface-2"
      >
        <span className="type-caption text-text-2">{shortDayName(date.getDay())}</span>
        <span className="type-headline tabular text-text-1">{date.getDate()}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="type-headline truncate text-text-1">{name}</span>
          {records > 0 ? (
            <span className="type-caption inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-lime-dim px-2 font-semibold text-text-1">
              <Trophy className="size-3 text-lime" aria-hidden />
              {records}
              <span className="sr-only">{records === 1 ? 'record' : 'records'}</span>
            </span>
          ) : null}
        </span>
        <span className="type-meta tabular mt-0.5 block truncate text-text-2">{stats}</span>
        {exercises.length > 0 ? (
          <span className="type-meta block truncate text-text-2">{exercises.join(', ')}</span>
        ) : null}
      </span>
      <ChevronRight className="size-5 shrink-0 text-text-3" aria-hidden />
    </Link>
  );
});
