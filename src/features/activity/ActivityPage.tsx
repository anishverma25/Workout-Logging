import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Dumbbell, Footprints, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import {
  Card,
  ErrorState,
  ListRow,
  PrimaryButton,
  SecondaryButton,
  Skeleton,
} from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { useActivityData } from '@/data/hooks';
import { deleteActivity, restoreActivity } from '@/data/repositories/activity';
import { dayBurn, kindOf, workoutKcalOn } from '@/domain/activity/burn';
import type { ActivityLog } from '@/domain/models/schemas';
import { useNow } from '@/lib/useNow';
import { DayNav } from '../food/DayNav';
import { useDayParam } from '../food/useDayParam';
import { useFoodContext } from '../food/useFoodContext';
import { EvidenceLink } from '../science/EvidenceLink';
import { CardioSheet } from './CardioSheet';
import { EstimateNote } from './EstimateNote';
import { StepsSheet } from './StepsSheet';

const n = (v: number) => Math.round(v).toLocaleString('en-GB');

/**
 * Activity: calories burned in the day from weight training, cardio and steps, each an estimate
 * or a number typed from a watch or tracker. Steps are typed in: a web app cannot read a phone's
 * step counter reliably.
 */
export function ActivityPage() {
  const now = useNow();
  const ctx = useFoodContext(now);
  const activity = useActivityData();
  const { date, today, go, label } = useDayParam(now);
  const [cardio, setCardio] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const toast = useToast();

  const weightKg = ctx.snapshot?.weightKg ?? null;
  const heightCm = ctx.profile?.heightCm ?? null;
  const logs = useMemo(() => activity.data ?? [], [activity.data]);
  const day = useMemo(
    () =>
      logs.filter((l) => l.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [logs, date],
  );
  const sessions = day.filter((l) => l.kind === 'cardio');
  const steps = day.find((l) => l.kind === 'steps') ?? null;
  const weights = useMemo(
    () =>
      ctx.training ? workoutKcalOn(ctx.training, date) : { kcal: 0, sessions: 0, estimated: false },
    [ctx.training, date],
  );
  const burn = dayBurn({ logs, date, workoutKcal: weights.kcal });

  const remove = async (l: ActivityLog, name: string) => {
    await deleteActivity(db, [l.id]);
    toast(`Removed ${name}`, { label: 'Undo', onSelect: () => void restoreActivity(db, [l.id]) });
  };

  const loading = ctx.status === 'loading' || activity.status === 'loading';
  return (
    <>
      <PageHeader
        title="Activity"
        subtitle="Calories burned, with weights, cardio and steps"
        actions={
          <PrimaryButton
            compact
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => setCardio(true)}
            aria-label="Add cardio"
            data-add-cardio
          >
            Cardio
          </PrimaryButton>
        }
      />
      {loading ? <Skeleton height={256} radius="panel" /> : null}
      {ctx.status === 'error' || activity.status === 'error' ? (
        <ErrorState
          title="Activity could not load"
          message={ctx.error?.message}
          onRetry={() => window.location.reload()}
        />
      ) : null}
      {!loading && ctx.status === 'success' ? (
        <div className="flex max-w-3xl flex-col gap-4" data-activity-page>
          <DayNav label={label} onPrev={() => go(-1)} onNext={date < today ? () => go(1) : null} />

          <Card as="section" aria-labelledby="burn-title" data-burn-summary>
            <div className="flex items-center gap-2">
              <h2 id="burn-title" className="type-title text-text-1">
                Burned
              </h2>
              <EvidenceLink topic="activity-energy" about="how calories burned are estimated" />
            </div>
            <p className="mt-2 flex items-baseline gap-1">
              <span className="type-stat tabular text-text-1" data-burn-total>
                {burn.total > 0 && burn.estimated ? '~' : ''}
                {n(burn.total)}
              </span>
              <span className="type-meta text-text-2">kcal active</span>
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-3">
              <Part label="Weights" value={burn.workoutKcal} />
              <Part label="Cardio" value={burn.cardioKcal} />
              <Part label="Steps" value={burn.stepsKcal} />
            </dl>
            <p className="type-caption mt-3 text-text-2">
              Active calories are the ones above what your body burns at rest, so they add to your
              daily target rather than replace it.
            </p>
            <EstimateNote className="mt-3" />
          </Card>

          <Card as="section" aria-labelledby="steps-title" data-steps-card>
            <div className="flex items-center justify-between gap-3">
              <h2 id="steps-title" className="type-title text-text-1">
                Steps
              </h2>
              <SecondaryButton compact onClick={() => setStepsOpen(true)} data-add-steps>
                {steps ? 'Change' : 'Add steps'}
              </SecondaryButton>
            </div>
            {steps ? (
              <ul className="mt-2">
                <li>
                  <ListRow
                    title={`${n(steps.steps ?? 0)} steps`}
                    subtitle={
                      steps.kcalSource === 'typed' ? 'Calories typed by you' : 'Calories estimated'
                    }
                    leading={<Footprints className="size-5 text-text-2" aria-hidden />}
                    value={
                      <span className="type-headline tabular text-text-1">
                        {steps.kcalSource === 'estimated' ? '~' : ''}
                        {n(steps.kcal)} kcal
                      </span>
                    }
                    onClick={() => setStepsOpen(true)}
                    className="px-1"
                  />
                </li>
              </ul>
            ) : (
              <p className="type-meta mt-2 text-text-2">
                No steps for this day. Type the count from Apple Health, Google Fit or your watch.
              </p>
            )}
            <p className="type-caption mt-3 text-text-2" data-pedometer-note>
              Overload cannot count steps by itself. A web app cannot read your phone&apos;s step
              counter reliably, and guessing from motion would give wrong numbers.
            </p>
          </Card>

          <Card as="section" aria-labelledby="cardio-title" data-cardio-card>
            <h2 id="cardio-title" className="type-title text-text-1">
              Cardio
            </h2>
            {sessions.length ? (
              <ul className="mt-2 flex flex-col">
                {sessions.map((l) => {
                  const name = l.activity ? kindOf(l.activity).label : 'Cardio';
                  return (
                    <li key={l.id}>
                      <ListRow
                        title={name}
                        subtitle={[
                          `${l.minutes} min`,
                          l.speedKmh ? `${l.speedKmh} km/h` : null,
                          l.inclinePct ? `${l.inclinePct}% incline` : null,
                          l.watts ? `${l.watts} W` : null,
                          l.distanceKm ? `${l.distanceKm} km` : null,
                          l.kcalSource === 'typed' ? 'typed by you' : 'estimated',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        value={
                          <span className="flex items-center gap-2">
                            <span className="type-headline tabular text-text-1">
                              {l.kcalSource === 'estimated' ? '~' : ''}
                              {n(l.kcal)} kcal
                            </span>
                            <button
                              type="button"
                              aria-label={`Delete ${name}`}
                              className="pressable tap-target inline-flex size-9 items-center justify-center rounded-full text-text-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                void remove(l, name);
                              }}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          </span>
                        }
                        className="px-1"
                      />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="type-meta mt-2 text-text-2">
                Treadmill, stair master, cycle, elliptical and more. Add a session and see its
                calories.
              </p>
            )}
          </Card>

          <Card as="section" aria-labelledby="weights-title" data-weights-card>
            <h2 id="weights-title" className="type-title text-text-1">
              Weight training
            </h2>
            {weights.sessions ? (
              <ListRow
                title={`${weights.sessions} ${weights.sessions === 1 ? 'workout' : 'workouts'}`}
                subtitle="Open a workout in History to type your tracker's number"
                leading={<Dumbbell className="size-5 text-text-2" aria-hidden />}
                value={
                  <span className="type-headline tabular text-text-1">
                    {weights.estimated ? '~' : ''}
                    {n(weights.kcal)} kcal
                  </span>
                }
                to="/history"
                className="px-1"
              />
            ) : (
              <p className="type-meta mt-2 text-text-2">
                No workout on this day. Finished workouts show their calories here.{' '}
                <Link to="/workout" className="font-semibold text-text-1 underline">
                  Start a workout
                </Link>
              </p>
            )}
          </Card>
        </div>
      ) : null}

      <CardioSheet open={cardio} onClose={() => setCardio(false)} date={date} weightKg={weightKg} />
      <StepsSheet
        open={stepsOpen}
        onClose={() => setStepsOpen(false)}
        date={date}
        weightKg={weightKg}
        heightCm={heightCm}
        current={
          steps?.steps
            ? { steps: steps.steps, kcal: steps.kcal, typed: steps.kcalSource === 'typed' }
            : null
        }
      />
    </>
  );
}

function Part({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-nested bg-surface-2 px-3 py-2.5">
      <dt className="type-meta text-text-2">{label}</dt>
      <dd className="type-headline tabular mt-0.5 text-text-1">{n(value)}</dd>
    </div>
  );
}
