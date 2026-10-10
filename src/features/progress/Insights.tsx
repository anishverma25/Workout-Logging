import { Check, X } from 'lucide-react';
import { Link } from 'react-router';
import { IconButton } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { dismissSuggestion } from '@/data/repositories/meta';
import type { Insight } from '@/domain/analytics/insights';
import type { ProgressionSuggestion } from '@/domain/analytics/progression';
import { cn } from '@/lib/cn';
import { formatRelativeDayInline } from '@/lib/dates';
import { formatRepRange } from '@/lib/format';
import { formatWeightValue, type WeightUnit } from '@/lib/units';
import { INSIGHT_TONE } from '../shared/insightTone';

export function InsightList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <p className="flex min-h-22 items-center justify-center rounded-nested bg-surface-2 px-5 py-4 text-center type-meta text-text-2">
        Nothing stands out in this period. Insights appear only when the data clearly shows
        something, so a quiet list is normal.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {insights.map((insight) => {
        const tone = INSIGHT_TONE[insight.tone];
        const Icon = tone.icon;
        return (
          <li key={insight.id} className="rounded-[var(--radius-card)] bg-surface p-4">
            <div className="flex gap-3">
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full',
                  tone.ring,
                )}
              >
                <Icon className="size-[1.1rem]" aria-hidden />
                <span className="sr-only">{tone.label}:</span>
              </span>
              <div className="min-w-0">
                <p className="font-semibold leading-snug">{insight.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-faint">{insight.basis}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Double-progression suggestions with the evidence shown. They never change the routine:
 * the person decides, and can dismiss one so it does not come back for that session.
 */
export function Suggestions({
  suggestions,
  dismissed,
  unit,
}: {
  suggestions: ProgressionSuggestion[];
  dismissed: Set<string>;
  unit: WeightUnit;
}) {
  const toast = useToast();
  const shown = suggestions.filter((s) => !dismissed.has(s.id));
  if (shown.length === 0) return null;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {shown.map((s) => (
        <li
          key={s.id}
          className="rounded-[var(--radius-card)] border border-accent-text/30 bg-surface p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
                <Check className="size-[1.1rem]" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-semibold leading-snug">
                  {s.exerciseName}: consider increasing the load slightly next session.
                </p>
                <p className="tabular mt-1.5 text-sm leading-relaxed text-faint">
                  {formatRelativeDayInline(s.date).replace(/^./, (c) => c.toUpperCase())} you did{' '}
                  {s.sets
                    .map((set) => `${formatWeightValue(set.weightKg, unit)}×${set.reps}`)
                    .join(', ')}{' '}
                  against a target of {s.target.sets} ×{' '}
                  {formatRepRange(s.target.repMin, s.target.repMax)}
                  {s.target.rir !== null ? ` at RIR ${s.target.rir}` : ''}.{' '}
                  {s.effort === 'unknown'
                    ? 'RIR was not logged, so check it felt like the planned effort.'
                    : 'Every set reached the top of the range at the planned effort.'}{' '}
                  Your routine is not changed.
                </p>
                <Link
                  to={`/history/${s.workoutId}`}
                  className="mt-2 inline-block text-sm font-medium text-accent-text underline-offset-4 hover:underline"
                >
                  See that workout
                </Link>
              </div>
            </div>
            <IconButton
              label={`Dismiss suggestion for ${s.exerciseName}`}
              icon={<X className="size-4" aria-hidden />}
              size="sm"
              onClick={async () => {
                await dismissSuggestion(db, s.id);
                toast('Suggestion dismissed');
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
