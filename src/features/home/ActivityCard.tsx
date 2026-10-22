import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Flame, Footprints, Plus } from 'lucide-react';
import { Card } from '@/components/kit';
import type { QueryState } from '@/data/hooks';
import { useActivityData } from '@/data/hooks';
import { dayBurn, workoutKcalOn } from '@/domain/activity/burn';
import type { TrainingData } from '@/domain/analytics/sessions';
import { cn } from '@/lib/cn';
import { toDateKey } from '@/lib/dates';
import { CardioSheet } from '../activity/CardioSheet';
import { EstimateNote } from '../activity/EstimateNote';
import { StepsSheet } from '../activity/StepsSheet';
import { useFoodContextFrom } from '../food/useFoodContext';

const n = (v: number) => Math.round(v).toLocaleString('en-GB');

/**
 * Today's activity on Home, under the food card: calories burned in weights, cardio and steps,
 * the steps typed in, and one tap to add steps or a cardio session. The full day is on Activity.
 */
export function ActivityCard({
  training,
  now,
  className,
}: {
  training: QueryState<TrainingData>;
  now: Date;
  className?: string;
}) {
  const ctx = useFoodContextFrom(now, training);
  const activity = useActivityData();
  const [cardio, setCardio] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const today = toDateKey(now);
  const logs = useMemo(() => activity.data ?? [], [activity.data]);
  const weights = useMemo(
    () =>
      ctx.status === 'success' && ctx.training
        ? workoutKcalOn(ctx.training, today)
        : { kcal: 0, sessions: 0, estimated: false },
    [ctx.status, ctx.training, today],
  );
  if (ctx.status !== 'success' || activity.status !== 'success') return null;
  const burn = dayBurn({ logs, date: today, workoutKcal: weights.kcal });
  const steps =
    logs.find((l) => l.deletedAt === null && l.date === today && l.kind === 'steps') ?? null;
  const weightKg = ctx.snapshot?.weightKg ?? null;
  const tilde = (kcal: number) => (kcal > 0 && burn.estimated ? '~' : '');

  return (
    <Card
      as="section"
      aria-labelledby="activity-card-title"
      className={cn('p-5', className)}
      data-activity-card
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="activity-card-title" className="type-headline flex items-center gap-2 text-text-1">
          <Flame className="size-5 text-text-2" aria-hidden />
          Activity today
        </h2>
        <Link to="/activity" className="type-meta font-semibold text-text-2">
          Open
        </Link>
      </div>
      <p className="type-meta mt-3 text-text-2">
        <span className="type-headline tabular text-text-1" data-activity-burned>
          {tilde(burn.total)}
          {n(burn.total)}
        </span>{' '}
        kcal burned
        {steps?.steps ? (
          <>
            {' · '}
            <span className="tabular text-text-1" data-activity-steps>
              {n(steps.steps)}
            </span>{' '}
            steps
          </>
        ) : null}
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {[
          ['Weights', weights.kcal],
          ['Cardio', burn.cardioKcal],
          ['Steps', burn.stepsKcal],
        ].map(([label, kcal]) => (
          <div key={label} className="min-w-0 rounded-nested bg-surface-2 px-3 py-2">
            <dt className="type-caption text-text-2">{label}</dt>
            <dd className="type-body tabular font-semibold text-text-1">
              {tilde(kcal as number)}
              {n(kcal as number)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setStepsOpen(true)}
          className="pressable chrome type-meta inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-field bg-surface-2 px-2 font-semibold text-text-1"
          data-home-add-steps
        >
          <Footprints className="size-4 shrink-0" aria-hidden />
          {steps?.steps ? 'Edit steps' : 'Add steps'}
        </button>
        <button
          type="button"
          onClick={() => setCardio(true)}
          className="pressable chrome type-meta inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-field bg-surface-2 px-2 font-semibold text-text-1"
          data-home-add-cardio
        >
          <Plus className="size-4 shrink-0" aria-hidden />
          Add cardio
        </button>
      </div>
      {burn.total > 0 ? <EstimateNote className="mt-3" /> : null}
      <CardioSheet
        open={cardio}
        onClose={() => setCardio(false)}
        date={today}
        weightKg={weightKg}
      />
      <StepsSheet
        open={stepsOpen}
        onClose={() => setStepsOpen(false)}
        date={today}
        weightKg={weightKg}
        heightCm={ctx.profile?.heightCm ?? null}
        current={
          steps?.steps
            ? { steps: steps.steps, kcal: steps.kcal, typed: steps.kcalSource === 'typed' }
            : null
        }
      />
    </Card>
  );
}
