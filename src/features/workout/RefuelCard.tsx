import { Link } from 'react-router';
import { UtensilsCrossed } from 'lucide-react';
import { Card } from '@/components/kit';
import type { QueryState } from '@/data/hooks';
import type { TrainingData } from '@/domain/analytics/sessions';
import { dayTotals } from '@/domain/nutrition/analysis';
import { cn } from '@/lib/cn';
import { toDateKey } from '@/lib/dates';
import { useFoodContextFrom } from '../food/useFoodContext';

/** After a workout done today: protein so far against the target, and logging the next meal. */
export function RefuelCard({
  training,
  workoutDate,
  now,
  className,
}: {
  training: QueryState<TrainingData>;
  workoutDate: Date;
  now: Date;
  className?: string;
}) {
  const ctx = useFoodContextFrom(now, training);
  const today = toDateKey(now);
  if (ctx.status !== 'success' || toDateKey(workoutDate) !== today) return null;
  const totals = dayTotals(ctx.logs, today);
  const target = ctx.targets.proteinG;
  const gap = target !== null ? Math.round(target - totals.proteinG) : null;
  return (
    <Card
      as="section"
      aria-labelledby="refuel-title"
      className={cn('flex items-center gap-3', className)}
      data-refuel
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-tile bg-surface-2 text-text-2">
        <UtensilsCrossed className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="refuel-title" className="type-headline text-text-1">
          Refuel
        </h2>
        <p className="type-meta text-text-2">
          {gap !== null && gap > 0
            ? `${Math.round(totals.proteinG)} g protein so far today, ${gap} g to go.`
            : gap !== null
              ? `Protein target met today: ${Math.round(totals.proteinG)} g.`
              : `${Math.round(totals.proteinG)} g protein logged today.`}
        </p>
      </div>
      <Link
        to="/food?add=1"
        className="pressable chrome type-meta h-9 shrink-0 rounded-full bg-surface-2 px-4 leading-9 font-semibold text-text-1"
      >
        Log a meal
      </Link>
    </Card>
  );
}
