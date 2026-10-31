import { Link } from 'react-router';
import { CapsuleButton } from '@/components/kit';
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
import { DailyRow } from './DailyRow';
import type { WeightUnit } from '@/lib/units';
import { MEAL_LABEL, mealForHour, useFoodContextFrom } from '../food/useFoodContext';

const n = (v: number) => Math.round(v).toLocaleString('en-GB');

/**
 * Today's numbers on Home (UI v3, S3.6): food, weight, water and activity as rows of one group,
 * each one tap from being logged. The usual meal for the time of day is a capsule under the
 * food row until that meal is logged.
 */
export function FoodCard({
  training,
  now,
  unit,
  className,
}: {
  training: QueryState<TrainingData>;
  now: Date;
  unit: WeightUnit;
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
  const left = kcal !== null ? kcal - totals.kcal : null;
  const logUsual = () => {
    if (!usual) return;
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
    });
  };
  return (
    <section aria-labelledby="food-card-title" className={className} data-food-card>
      <h2 id="food-card-title" className="type-section mb-2 text-text-1">
        Today’s numbers
      </h2>
      <div className="divide-y-[0.5px] divide-divider rounded-card bg-surface px-4">
        <div className="py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/food"
              className="pressable chrome flex min-w-0 flex-1 items-center gap-3"
              aria-label={`Food today: ${left !== null ? `${n(Math.abs(left))} kcal ${left >= 0 ? 'left' : 'over'}` : `${n(totals.kcal)} kcal`}`}
            >
              <CalorieRing eaten={totals.kcal} target={kcal} />
              <span className="min-w-0 flex-1">
                <span className="type-headline block text-text-1">
                  {left !== null ? (
                    <>
                      <span className="type-metric-sm">{n(Math.abs(left))}</span>{' '}
                      <span className="font-normal text-text-2">
                        kcal {left >= 0 ? 'left' : 'over'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="type-metric-sm">{n(totals.kcal)}</span>{' '}
                      <span className="font-normal text-text-2">kcal today</span>
                    </>
                  )}
                </span>
                <span className="type-subhead block truncate text-text-2">
                  Protein {totals.proteinG.toFixed(0)}
                  {proteinG !== null ? ` of ${proteinG}` : ''} g
                </span>
              </span>
            </Link>
            <CapsuleButton to="/food?add=1" aria-label="Log food">
              Log
            </CapsuleButton>
          </div>
          {usual ? (
            <button
              type="button"
              onClick={logUsual}
              className="pressable chrome type-meta mt-2.5 inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-fill px-3 text-text-1"
              aria-label={`Log your usual ${MEAL_LABEL[meal].toLowerCase()}: ${usual.items.map((i) => i.foodName).join(', ')}`}
              data-home-usual
            >
              <span className="truncate">
                Usual {MEAL_LABEL[meal].toLowerCase()} ·{' '}
                {usual.items.map((i) => i.foodName).join(', ')}
              </span>
              <span className="shrink-0 font-semibold text-lime">Log</span>
            </button>
          ) : null}
        </div>
        <DailyRow
          weights={training.data?.bodyWeights ?? []}
          unit={unit}
          glassMl={ctx.profile?.waterGlassMl ?? null}
          waterTargetMl={ctx.targets.waterMl}
          now={now}
        />
        <ActivitySection training={training} now={now} eatenKcal={totals.kcal} />
      </div>
    </section>
  );
}

/** A 30px ring that fills as food is logged; the track stays visible on an empty day. */
function CalorieRing({ eaten, target }: { eaten: number; target: number | null }) {
  const r = 12;
  const c = 2 * Math.PI * r;
  const f = target ? Math.min(1, Math.max(0, eaten / target)) : 0;
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden className="shrink-0 -rotate-90">
      <circle
        cx="15"
        cy="15"
        r={r}
        fill="none"
        stroke="var(--lime)"
        strokeOpacity={0.18}
        strokeWidth="4"
      />
      {f > 0 ? (
        <circle
          cx="15"
          cy="15"
          r={r}
          fill="none"
          stroke="var(--lime)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          className={cn('ring-arc')}
        />
      ) : null}
    </svg>
  );
}
