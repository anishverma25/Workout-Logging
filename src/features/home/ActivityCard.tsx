import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Flame, Footprints, Plus } from 'lucide-react';
import type { QueryState } from '@/data/hooks';
import { useActivityData } from '@/data/hooks';
import { dayBurn, workoutKcalOn } from '@/domain/activity/burn';
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

  const any = burn.total > 0 || (steps?.steps ?? 0) > 0;
  return (
    <section aria-labelledby="activity-card-title" className="py-3" data-activity-card>
      <div className="flex items-center gap-3">
        <Link to="/activity" className="pressable chrome flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-[1.875rem] shrink-0 items-center justify-center rounded-[0.5rem] bg-fill text-text-1">
            <Flame className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <h3 id="activity-card-title" className="type-headline text-text-1">
              {any ? (
                <>
                  <span className="type-metric-sm" data-activity-burned>
                    {tilde(burn.total)}
                    {n(burn.total)}
                  </span>{' '}
                  <span className="font-normal text-text-2">kcal burned</span>
                </>
              ) : (
                'Activity'
              )}
            </h3>
            <span className="type-subhead block truncate text-text-2">
              {any ? (
                <>
                  net{' '}
                  <span className="tabular" data-activity-net>
                    {eatenKcal - burn.total < 0 ? '−' : ''}
                    {n(Math.abs(eatenKcal - burn.total))}
                  </span>
                  {steps?.steps ? (
                    <>
                      {' · '}
                      <span className="tabular" data-activity-steps>
                        {n(steps.steps)}
                      </span>{' '}
                      steps
                    </>
                  ) : null}
                </>
              ) : (
                'None today'
              )}
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setStepsOpen(true)}
          className="pressable chrome tap-target type-subhead inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-fill px-3 font-semibold text-text-1"
          aria-label={steps?.steps ? 'Edit steps' : 'Add steps'}
          data-home-add-steps
        >
          <Footprints className="size-4" aria-hidden />
          Steps
        </button>
        <button
          type="button"
          onClick={() => setCardio(true)}
          className="pressable chrome tap-target type-subhead inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-fill px-3 font-semibold text-text-1"
          aria-label="Add cardio"
          data-home-add-cardio
        >
          <Plus className="size-4" aria-hidden />
          Cardio
        </button>
      </div>
      {burn.total > 0 ? (
        <p className="type-caption mt-2 pl-[2.625rem] text-text-3" data-estimate-note>
          Rough estimates, can be wrong. Weights {tilde(weights.kcal)}
          {n(weights.kcal)} · Cardio {tilde(burn.cardioKcal)}
          {n(burn.cardioKcal)} · Steps {tilde(burn.stepsKcal)}
          {n(burn.stepsKcal)}
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
