import { useEffect, useState } from 'react';
import { POINTS, scoreParts } from '@/app/community';
import { formatNumber } from '@/lib/format';

const COLOR: Record<string, string> = {
  workouts: 'var(--score-workouts)',
  hardSets: 'var(--score-hard-sets)',
  records: 'var(--score-records)',
  proteinDays: 'var(--score-protein)',
  consistency: 'var(--score-consistency)',
  progress: 'var(--score-progress)',
};
const EACH: Record<string, number> = {
  workouts: POINTS.workout,
  hardSets: POINTS.hardSet,
  records: POINTS.record,
  proteinDays: POINTS.proteinDay,
  consistency: POINTS.consistencyWeek,
  progress: 1,
};

type Fields = Parameters<typeof scoreParts>[0];

const R = 42;
const C = 2 * Math.PI * R;
/** The gap between two divisions of the ring, along the circle. */
const GAP = 3;

/**
 * Where someone's points came from: a ring split into one coloured division per part, the total
 * in the middle, and a short legend with the sum for each part.
 */
export function ScoreBreakdown({ row }: { row: Fields }) {
  const parts = scoreParts(row);
  const total = parts.reduce((s, p) => s + p.points, 0);
  const scored = parts.filter((p) => p.points > 0);
  // The divisions sweep in once (CSS turns this off with reduced motion).
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const lengths = scored.map((p) => (p.points / total) * C);
  const arcs = scored.map((p, i) => ({
    key: p.key,
    offset: lengths.slice(0, i).reduce((a, b) => a + b, 0),
    length: Math.max(0.5, lengths[i]! - (scored.length > 1 ? GAP : 0)),
  }));

  return (
    <div className="flex items-center gap-4" data-score-breakdown>
      <div className="relative size-28 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--fill)" strokeWidth="9" />
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={COLOR[a.key]}
              strokeWidth="9"
              strokeDasharray={`${grown ? a.length : 0} ${C}`}
              strokeDashoffset={-a.offset}
              className="score-arc"
            />
          ))}
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="type-stat tabular leading-none text-text-1">{formatNumber(total)}</span>
          <span className="type-caption text-text-2">points</span>
        </span>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5" aria-label="Points by part">
        {parts.map((p) => {
          const zero = p.points === 0;
          return (
            <li key={p.key} className="flex items-center gap-2" data-part={p.key}>
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: zero ? 'var(--fill)' : COLOR[p.key] }}
                aria-hidden
              />
              <span
                className={
                  zero
                    ? 'type-footnote min-w-0 flex-1 truncate text-text-3'
                    : 'type-footnote min-w-0 flex-1 truncate text-text-1'
                }
              >
                {p.label}
              </span>
              {zero ? null : (
                <span className="type-caption tabular shrink-0 text-text-2">
                  {formatNumber(p.count)} × {EACH[p.key]}
                </span>
              )}
              <span
                className={
                  zero
                    ? 'type-footnote tabular w-9 shrink-0 text-right text-text-3'
                    : 'type-footnote tabular w-9 shrink-0 text-right font-semibold text-text-1'
                }
              >
                {zero ? '0' : `+${formatNumber(p.points)}`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
