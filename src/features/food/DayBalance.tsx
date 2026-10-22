import { useMemo } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Flame } from 'lucide-react';
import { Card } from '@/components/kit';
import { useActivityData } from '@/data/hooks';
import { dayBurn, workoutKcalOn } from '@/domain/activity/burn';
import { dayTotals } from '@/domain/nutrition/analysis';
import { EstimateNote } from '../activity/EstimateNote';
import type { FoodContext } from './useFoodContext';

const n = (v: number) => Math.round(v).toLocaleString('en-GB');

/**
 * The end of the day on one card: calories eaten, calories burned in activity, and the difference. Burned calories are the active ones, estimates unless typed.
 */
export function DayBalance({ ctx, date }: { ctx: FoodContext; date: string }) {
  const activity = useActivityData();
  const eaten = dayTotals(ctx.logs, date).kcal;
  const logs = useMemo(() => activity.data ?? [], [activity.data]);
  const weights = useMemo(
    () =>
      ctx.training ? workoutKcalOn(ctx.training, date) : { kcal: 0, sessions: 0, estimated: false },
    [ctx.training, date],
  );
  if (activity.status !== 'success') return null;
  const burn = dayBurn({ logs, date, workoutKcal: weights.kcal });
  const net = eaten - burn.total;
  return (
    <Card as="section" aria-labelledby="balance-title" data-day-balance>
      <h2 id="balance-title" className="type-title text-text-1">
        Your day
      </h2>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        <div className="min-w-0 rounded-nested bg-surface-2 px-3 py-2.5">
          <dt className="type-meta text-text-2">Eaten</dt>
          <dd className="type-headline tabular mt-0.5 text-text-1" data-balance-eaten>
            {n(eaten)}
          </dd>
        </div>
        <div className="min-w-0 rounded-nested bg-surface-2 px-3 py-2.5">
          <dt className="type-meta text-text-2">Burned</dt>
          <dd className="type-headline tabular mt-0.5 text-text-1" data-balance-burned>
            {burn.total > 0 && burn.estimated ? '~' : ''}
            {n(burn.total)}
          </dd>
        </div>
        <div className="min-w-0 rounded-nested bg-surface-2 px-3 py-2.5">
          <dt className="type-meta text-text-2">Net</dt>
          <dd className="type-headline tabular mt-0.5 text-text-1" data-balance-net>
            {net > 0 ? '+' : net < 0 ? '−' : ''}
            {n(Math.abs(net))}
          </dd>
        </div>
      </dl>
      <p className="type-caption mt-2 text-text-2">
        Kcal. Net is eaten minus burned in activity. Your daily target already counts a normal day,
        so a day with no extra activity has a net near your target.
      </p>
      <ul className="mt-3 flex flex-col gap-1">
        <li>
          <Link
            to={`/activity?date=${date}`}
            className="pressable flex min-h-11 items-center gap-3 rounded-nested px-1 text-text-1"
          >
            <Flame className="size-5 text-text-2" aria-hidden />
            <span className="type-body min-w-0 flex-1">Weights, cardio and steps</span>
            <ChevronRight className="size-4 text-text-3" aria-hidden />
          </Link>
        </li>
      </ul>
      {burn.total > 0 ? <EstimateNote className="mt-3" /> : null}
    </Card>
  );
}
