import { Link } from 'react-router';
import { UtensilsCrossed } from 'lucide-react';
import { Card, ProgressBar, SecondaryButton } from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import type { QueryState } from '@/data/hooks';
import { db } from '@/data/db';
import { copyFoodLogs, deleteFoodLogs } from '@/data/repositories/food';
import type { TrainingData } from '@/domain/analytics/sessions';
import { dayTotals, mealsOn, mealTemplates } from '@/domain/nutrition/analysis';
import { cn } from '@/lib/cn';
import { toDateKey } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { ActivitySection } from './ActivityCard';
import { MEAL_LABEL, mealForHour, useFoodContextFrom } from '../food/useFoodContext';

const n = (v: number) => Math.round(v).toLocaleString('en-GB');

/**
 * Today's food on Home: calories and protein against the targets, and the meal due now, with
 * the usual one in a tap when the person has one.
 */
export function FoodCard({
  training,
  now,
  className,
}: {
  training: QueryState<TrainingData>;
  now: Date;
  className?: string;
}) {
  const ctx = useFoodContextFrom(now, training);
  const toast = useToast();
  if (ctx.status !== 'success') return null;
  const today = toDateKey(now);
  const totals = dayTotals(ctx.logs, today);
  const meal = mealForHour(now.getHours());
  const logged = mealsOn(ctx.logs, today)[meal].length > 0;
  const usual = logged
    ? undefined
    : mealTemplates(ctx.logs, meal, today).find((t) => t.kind === 'usual');
  const { kcal, proteinG } = ctx.targets;
  return (
    <Card
      as="section"
      aria-labelledby="food-card-title"
      className={cn('p-5', className)}
      data-food-card
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="food-card-title" className="type-headline flex items-center gap-2 text-text-1">
          <UtensilsCrossed className="size-5 text-text-2" aria-hidden />
          Food today
        </h2>
        <Link to="/food" className="type-meta font-semibold text-text-2">
          Open
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <p className="type-meta text-text-2">
            <span className="type-headline tabular text-text-1">{n(totals.kcal)}</span>
            {kcal !== null ? ` of ${n(kcal)} kcal` : ' kcal'}
          </p>
          {kcal !== null ? (
            <ProgressBar value={totals.kcal} max={kcal} label="Calories today" className="mt-2" />
          ) : null}
        </div>
        <div>
          <p className="type-meta text-text-2">
            <span className="type-headline tabular text-text-1">
              {totals.proteinG.toFixed(0)} g
            </span>
            {proteinG !== null ? ` of ${proteinG} g protein` : ' protein'}
          </p>
          {proteinG !== null ? (
            <ProgressBar
              value={totals.proteinG}
              max={proteinG}
              label="Protein today"
              className="mt-2"
            />
          ) : null}
        </div>
      </div>
      {usual ? (
        <div className="mt-4 flex items-center gap-3 rounded-nested bg-surface-2 p-3">
          <p className="type-meta min-w-0 flex-1 truncate text-text-2">
            Your usual {MEAL_LABEL[meal].toLowerCase()}:{' '}
            {usual.items.map((i) => i.foodName).join(', ')}
          </p>
          <SecondaryButton
            compact
            onClick={() =>
              void copyFoodLogs(db, usual.items, { date: today, meal }).then((logs) => {
                haptic('medium');
                toast(`Logged your usual ${MEAL_LABEL[meal].toLowerCase()}`, {
                  label: 'Undo',
                  onSelect: () =>
                    void deleteFoodLogs(
                      db,
                      logs.map((l) => l.id),
                    ),
                });
              })
            }
          >
            Log
          </SecondaryButton>
        </div>
      ) : !logged ? (
        <Link
          to="/food?add=1"
          className="pressable chrome type-headline mt-4 flex h-11 items-center justify-center rounded-full bg-surface-2 text-text-1"
        >
          Log {MEAL_LABEL[meal].toLowerCase()}
        </Link>
      ) : null}
      <ActivitySection training={training} now={now} eatenKcal={totals.kcal} />
    </Card>
  );
}
