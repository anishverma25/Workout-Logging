import { formatDate } from '@/lib/format';
import { useMemo, useState } from 'react';
import { Award, Flame, Medal, Share2, Weight, CalendarHeart, Dumbbell } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { useFeature } from '@/app/entitlement';
import { Button } from '@/components/ui/Button';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { usePreferences, useTrainingData } from '@/data/hooks';
import { goalProgress } from '@/domain/analytics/goals';
import { milestones, type Milestone } from '@/domain/analytics/milestones';
import { performanceByExercise } from '@/domain/analytics/performance';
import { monthRecap, yearRecap, type Recap } from '@/domain/analytics/recap';
import { buildSessions } from '@/domain/analytics/sessions';
import { weightTrend } from '@/domain/analytics/body';
import { addDays } from '@/lib/dates';

import { useNow } from '@/lib/useNow';
import { formatCompact } from '@/lib/format';
import { toDisplayWeight, type WeightUnit } from '@/lib/units';
import { ProLock } from '@/features/pro/ProLock';
import { GoalsSection } from './GoalsSection';
import { PhotosSection } from './PhotosSection';
import { recapTitle, renderRecapImage, shareImage } from './recapImage';
import type { GoalKind } from '@/domain/models/schemas';

const ICON: Record<Milestone['kind'], typeof Award> = {
  count: Dumbbell,
  lift: Weight,
  bodyweight: Medal,
  volume: Award,
  streak: Flame,
  anniversary: CalendarHeart,
};

export function JourneyPage() {
  const training = useTrainingData();
  const prefs = usePreferences();
  const now = useNow(60_000);
  const unit = prefs.weightUnit;
  const data = training.data;

  const model = useMemo(() => {
    if (!data) return null;
    const sessions = buildSessions(data);
    const history = performanceByExercise(sessions);
    const target = data.profile?.trainingDays ?? null;
    return {
      sessions,
      history,
      goals: data.goals.map((g) => goalProgress(g, history, data.bodyWeights, now)),
      milestones: milestones(sessions, data.bodyWeights, now, prefs.weekStartsOn, target),
      month: monthRecap(sessions, data.exercises, now),
      year: yearRecap(sessions, data.exercises, now),
    };
  }, [data, now, prefs.weekStartsOn]);

  const currentFor = (kind: GoalKind, exerciseId: string | null) => {
    if (!data || !model) return null;
    if (kind === 'body_weight') {
      const t = weightTrend(data.bodyWeights);
      return t[t.length - 1]?.trendKg ?? null;
    }
    const recent = (model.history.get(exerciseId ?? '') ?? []).filter(
      (p) => p.date >= addDays(now, -56),
    );
    const values = recent
      .map((p) => (kind === 'exercise_e1rm' ? p.bestE1rm : p.heaviestLoad) ?? 0)
      .filter((v) => v > 0);
    return values.length ? Math.max(...values) : null;
  };

  return (
    <>
      <PageHeader back={{ to: '/more', label: 'More' }} title="Journey" />
      {training.status === 'loading' ? <Skeleton className="h-96" /> : null}
      {training.status === 'error' ? <ErrorState error={training.error} /> : null}
      {data && model ? (
        <div className="max-w-4xl">
          <GoalsSection
            progress={model.goals}
            exercises={data.exercises}
            unit={unit}
            currentFor={currentFor}
          />
          <MilestonesSection list={model.milestones} />
          <PhotosSection />
          <RecapsSection month={model.month} year={model.year} unit={unit} />
        </div>
      ) : null}
    </>
  );
}

function MilestonesSection({ list }: { list: Milestone[] }) {
  const recent = [...list].reverse();
  return (
    <section aria-labelledby="milestones-title" className="mt-9">
      <h2 id="milestones-title" className="type-title mb-2.5 text-text-1">
        Milestones
      </h2>
      {recent.length === 0 ? (
        <p className="type-meta flex min-h-22 items-center justify-center rounded-nested bg-surface-2 px-5 py-4 text-center text-text-2">
          Your first logged session sets the baseline. Milestones follow: plate lifts, body-weight
          lifts, streaks and totals, all from your own log.
        </p>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {recent.map((m) => {
            const Icon = ICON[m.kind];
            return (
              <li
                key={m.id}
                className="flex items-center gap-3.5 rounded-panel border border-border bg-surface p-4"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lime-dim text-lime">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="type-headline block text-text-1">{m.title}</span>
                  <span className="type-meta block text-text-2">{m.detail}</span>
                </span>
                <span className="type-meta shrink-0 self-start text-text-2">
                  {formatDate(m.achievedAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RecapsSection({
  month,
  year,
  unit,
}: {
  month: Recap | null;
  year: Recap | null;
  unit: WeightUnit;
}) {
  const included = useFeature('recaps');
  const recaps = [year, month].filter(Boolean) as Recap[];
  return (
    <section aria-labelledby="recaps-title" className="mt-9">
      <h2 id="recaps-title" className="type-title mb-2.5 text-text-1">
        Recaps
      </h2>
      {!included ? (
        <ProLock feature="recaps" />
      ) : recaps.length === 0 ? (
        <p className="type-meta flex min-h-22 items-center justify-center rounded-nested bg-surface-2 px-5 py-4 text-center text-text-2">
          After your first full month of training, its recap appears here, ready to share.
        </p>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {recaps.map((r) => (
            <RecapCard key={r.kind} recap={r} unit={unit} />
          ))}
        </div>
      )}
    </section>
  );
}

function RecapCard({ recap, unit }: { recap: Recap; unit: WeightUnit }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const title = recapTitle(recap);
  return (
    <article className="rounded-panel border border-border bg-surface p-5">
      <h3 className="type-headline text-text-1">{title}</h3>
      <dl className="mt-3 grid grid-cols-3 gap-y-3">
        {[
          ['Workouts', String(recap.workouts)],
          ['Sets', recap.workingSets.toLocaleString('en-GB')],
          ['Records', String(recap.records)],
          [`Volume`, `${formatCompact(toDisplayWeight(recap.volumeKg, unit))} ${unit}`],
          ['Hours', (recap.minutes / 60).toLocaleString('en-GB', { maximumFractionDigits: 1 })],
          ['Days', String(recap.days)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="type-meta text-text-2">{label}</dt>
            <dd className="type-headline tabular text-text-1">{value}</dd>
          </div>
        ))}
      </dl>
      {recap.topLift ? (
        <p className="mt-3 text-sm text-muted">
          Biggest gain: {recap.topLift.name}, estimated 1RM up{' '}
          {formatCompact(toDisplayWeight(recap.topLift.toKg - recap.topLift.fromKg, unit))} {unit}.
        </p>
      ) : null}
      <Button
        size="sm"
        className="mt-4"
        disabled={busy}
        icon={<Share2 className="size-4" aria-hidden />}
        onClick={async () => {
          setBusy(true);
          try {
            const blob = await renderRecapImage(recap, unit);
            const result = await shareImage(
              blob,
              `${title.replace(/\s+/g, '-').toLowerCase()}.png`,
              title,
            );
            if (result === 'saved') toast('Image saved');
          } catch {
            toast('Could not create the image');
          } finally {
            setBusy(false);
          }
        }}
      >
        Share
      </Button>
    </article>
  );
}
