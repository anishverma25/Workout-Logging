import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Flame, Footprints, Plus } from 'lucide-react';
import type { QueryState } from '@/data/hooks';
import { useActivityData } from '@/data/hooks';
import { dayBurn, ESTIMATE_WARNING, workoutKcalOn } from '@/domain/activity/burn';
import type { TrainingData } from '@/domain/analytics/sessions';
import { toDateKey } from '@/lib/dates';
import { CardioSheet } from '../activity/CardioSheet';
import { StepsSheet } from '../activity/StepsSheet';
import { useFoodContextFrom } from '../food/useFoodContext';

const n = (v: number) => Math.round(v).toLocaleString('en-GB');

/**
 * Today's activity inside the Home food card: calories burned in weights, cardio and steps, the
 * net against what was eaten, the steps typed in, and one tap to add steps or a cardio session.
 * The full day is on Activity.
 */
export function ActivitySection({
  training,
  now,
  eatenKcal,
}: {
  training: QueryState<TrainingData>;
  now: Date;
  /** Calories eaten today, for the net line. */
  eatenKcal: number;
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
    <section
      aria-labelledby="activity-card-title"
      className="mt-4 border-t-[0.5px] border-divider pt-4"
      data-activity-card
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          id="activity-card-title"
          className="type-body flex items-center gap-2 font-semibold text-text-1"
        >
          <Flame className="size-4 text-text-2" aria-hidden />
          Activity
        </h3>
        <Link to="/activity" className="type-meta font-semibold text-text-2">
          Open
        </Link>
      </div>
      <p className="type-meta mt-2 text-text-2">
        <span className="type-headline tabular text-text-1" data-activity-burned>
          {tilde(burn.total)}
          {n(burn.total)}
        </span>{' '}
        kcal burned · net{' '}
        <span className="tabular font-semibold text-text-1" data-activity-net>
          {eatenKcal - burn.total < 0 ? '−' : ''}
          {n(Math.abs(eatenKcal - burn.total))}
        </span>
        {steps?.steps ? (
          <>
            {' · '}
            <span className="tabular font-semibold text-text-1" data-activity-steps>
              {n(steps.steps)}
            </span>{' '}
            steps
          </>
        ) : null}
      </p>
      <p className="type-caption tabular mt-1 text-text-2">
        Weights {tilde(weights.kcal)}
        {n(weights.kcal)} · Cardio {tilde(burn.cardioKcal)}
        {n(burn.cardioKcal)} · Steps {tilde(burn.stepsKcal)}
        {n(burn.stepsKcal)}
      </p>
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
      {burn.total > 0 ? (
        <p className="type-caption mt-2 text-text-3" data-estimate-note>
          {ESTIMATE_WARNING}
        </p>
      ) : null}
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
    </section>
  );
}
