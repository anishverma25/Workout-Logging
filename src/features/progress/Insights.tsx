import { Check, X } from 'lucide-react';
import { TextLink } from '@/components/kit';
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
        Nothing stands out in this period.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {insights.map((insight) => {
        const tone = INSIGHT_TONE[insight.tone];
        const Icon = tone.icon;
        return (
          <li key={insight.id} className="rounded-panel border border-border bg-surface p-4">
            <div className="flex gap-3">
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-tile',
                  tone.ring,
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="sr-only">{tone.label}:</span>
              </span>
              <div className="min-w-0">
                <p className="type-body font-medium text-text-1">{insight.title}</p>
                <p className="type-meta mt-1 text-text-2">{insight.basis}</p>
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
        <li key={s.id} className="rounded-panel border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-tile bg-surface-2 text-text-2">
                <Check className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="type-body font-medium text-text-1">
                  {s.exerciseName}: consider increasing the load slightly next session.
                </p>
                <p className="type-meta tabular mt-1 text-text-2">
                  {formatRelativeDayInline(s.date).replace(/^./, (c) => c.toUpperCase())} you did{' '}
                  {s.sets
                    .map((set) => `${formatWeightValue(set.weightKg, unit)} × ${set.reps}`)
                    .join(', ')}{' '}
                  against a target of {s.target.sets} ×{' '}
                  {formatRepRange(s.target.repMin, s.target.repMax)}
                  {s.target.rir !== null ? ` at RIR ${s.target.rir}` : ''}.{' '}
                  {s.effort === 'unknown'
                    ? 'RIR was not logged, so check it felt like the planned effort.'
                    : 'Every set reached the top of the range at the planned effort.'}{' '}
                  Your routine is not changed.
                </p>
                <TextLink to={`/history/${s.workoutId}`} small chevron className="mt-1">
                  See that workout
                </TextLink>
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
