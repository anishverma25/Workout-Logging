import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The kit StatTile look as a term and value pair, for stats inside a <dl>: label (Meta
 * --text-2), value (Stat) with an optional unit (Meta --text-2). Used by the workout summary and
 * the workout detail.
 */
export function StatItem({
  label,
  value,
  unit,
  empty,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  /** Text shown instead of the value when there is nothing to measure. */
  empty?: string;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 rounded-panel border border-border bg-surface p-4', className)}>
      <dt className="type-meta truncate text-text-2">{label}</dt>
      {empty ? (
        <dd className="type-headline mt-1.5 text-text-2">{empty}</dd>
      ) : (
        <dd className="mt-1 flex flex-wrap items-baseline gap-x-1">
          <span className="type-stat text-text-1">{value}</span>
          {unit ? <span className="type-meta text-text-2">{unit}</span> : null}
        </dd>
      )}
    </div>
  );
}

/** "52 min" or "1 h 5 min" with each unit in Meta beside its number. */
export function DurationValue({ minutes }: { minutes: number }) {
  if (minutes < 1) {
    return (
      <>
        {'<1'}
        <Unit>min</Unit>
      </>
    );
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return (
    <>
      {h > 0 ? (
        <>
          {h}
          <Unit>h</Unit>
        </>
      ) : null}
      {m > 0 || h === 0 ? (
        <>
          {h > 0 ? ' ' : null}
          {m}
          <Unit>min</Unit>
        </>
      ) : null}
    </>
  );
}

function Unit({ children }: { children: ReactNode }) {
  return <span className="type-meta ml-1 text-text-2">{children}</span>;
}
