import { COPY } from '@/domain/analytics/thresholdCopy';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  FlaskConical,
  Trophy,
} from 'lucide-react';
import { EvidenceLink } from '@/features/science/EvidenceLink';
import { PageHeader } from '@/app/layout/PageHeader';
import { BarChart } from '@/components/charts/BarChart';
import { ChartEmpty } from '@/components/charts/ChartParts';
import { LineChart } from '@/components/charts/LineChart';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ActionList, Chips } from '@/components/ui/Fields';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useDismissedSuggestions, usePreferences, useTrainingData } from '@/data/hooks';
import { ROLLING_WINDOW_DAYS } from '@/domain/analytics/bodyweight';
import { buildProgress, type ProgressModel, type ProgressRange } from '@/domain/analytics/progress';
import { formatRecordValue, PR_LABELS } from '@/domain/analytics/prs';
import { MUSCLE_LABELS } from '@/domain/models/labels';
import { cn } from '@/lib/cn';
import { formatDayMonth, formatShortDate } from '@/lib/dates';
import { formatCompact, formatSignedPercent, pluralize } from '@/lib/format';
import { formatWeight, formatWeightValue, toDisplayWeight, type WeightUnit } from '@/lib/units';
import { useNow } from '@/lib/useNow';
import { useStartWorkout } from '../workout/StartWorkout';
import { InsightList, Suggestions } from './Insights';
import { useFeature } from '@/app/entitlement';
import { ProLock } from '../pro/ProLock';
import { BalanceSection, LevelsSection, PlateausSection, RatesSection } from './StrengthExtras';

const RANGES: { value: ProgressRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
];

const isRange = (v: string | null): v is ProgressRange => RANGES.some((r) => r.value === v);

export function ProgressPage() {
  const training = useTrainingData();
  const prefs = usePreferences();
  const now = useNow();
  const start = useStartWorkout();
  const dismissed = useDismissedSuggestions();
  const [params, setParams] = useSearchParams();
  const [pickingExercise, setPickingExercise] = useState(false);
  const rangeParam = params.get('range');
  const range: ProgressRange = isRange(rangeParam) ? rangeParam : '30d';
  const exerciseId = params.get('exercise');
  const unit = prefs.weightUnit;
  const longRangeIncluded = useFeature('long_range');
  const muscleBalanceIncluded = useFeature('muscle_balance');
  const progressionIncluded = useFeature('progression');
  const rangeLocked = (range === '90d' || range === 'all') && !longRangeIncluded;

  const model = useMemo(
    () =>
      training.data
        ? buildProgress(training.data, {
            range,
            exerciseId,
            now,
            weekStartsOn: prefs.weekStartsOn,
            unit,
          })
        : null,
    [training.data, range, exerciseId, now, prefs.weekStartsOn, unit],
  );

  const setParam = (key: string, value: string | null) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (value === null) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  return (
    <>
      <PageHeader title="Progress" subtitle="Calculated from your logged sets" />
      <Link
        to="/science"
        className="mb-2 flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 text-sm shadow-card"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--tile-sky)] text-white">
          <FlaskConical className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">The science behind these numbers</span>
          <span className="text-muted">
            Formulas and research sources for everything on this page.
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-faint" aria-hidden />
      </Link>
      {training.status === 'loading' ? <Skeleton className="h-96" /> : null}
      {training.status === 'error' ? <ErrorState error={training.error} /> : null}

      {model && !model.hasAnyData ? (
        <EmptyState
          icon={<ChartNoAxesColumnIncreasing className="size-5" aria-hidden />}
          title="Your progress starts with your first workout"
          body="Once you log workouts, this page shows your estimated 1RM over time, weekly volume, sets per muscle group, how consistently you train and your records. Every number is calculated from your own sets, and the science page explains how."
          actions={
            <>
              <Button
                icon={<Dumbbell className="size-4" aria-hidden />}
                onClick={() => start(null)}
              >
                Start a workout
              </Button>
              <Link
                to="/science"
                className="inline-flex h-11 items-center px-3 text-sm font-semibold text-accent-text"
              >
                How it is calculated
              </Link>
            </>
          }
        />
      ) : null}

      {model && model.hasAnyData ? (
        <>
          {/* One filter row, scoping everything below it. */}
          <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 border-b border-transparent bg-bg/90 px-4 py-2 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between lg:-mx-10 lg:px-10">
            <Chips
              label="Date range"
              options={
                longRangeIncluded
                  ? RANGES
                  : RANGES.map((r) =>
                      r.value === '90d' || r.value === 'all'
                        ? { ...r, label: `${r.label} · Pro` }
                        : r,
                    )
              }
              value={range}
              onChange={(r) => setParam('range', r === '30d' ? null : r)}
            />
            {model.exerciseOptions.length > 0 ? (
              <button
                type="button"
                onClick={() => setPickingExercise(true)}
                className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-sm font-semibold"
              >
                <span className="text-faint">Exercise</span>
                <span className="max-w-44 truncate">{model.selected?.name}</span>
                <ChevronDown className="size-4 text-faint" aria-hidden />
              </button>
            ) : null}
          </div>

          {rangeLocked ? (
            <ProLock
              feature="long_range"
              className="mt-6"
              lead="Your history is all here. Trends over 90 days and all time are part of Pro."
            />
          ) : (
            <>
              <p className="mt-2 text-sm text-faint">
                {formatDayMonth(model.window.start)} to{' '}
                {formatDayMonth(new Date(model.window.end.getTime() - 1))}
                {model.sessionsInWindow === 0 ? '. No workouts logged in this period.' : ''}
              </p>

              <Summary model={model} unit={unit} />

              <Section
                id="insights"
                title="Insights"
                science="insights"
                detail="Rules applied to your records. Each one states what it is based on."
              >
                <InsightList insights={model.insights} />
              </Section>

              <ProgressionBlock
                model={model}
                dismissed={dismissed}
                unit={unit}
                included={progressionIncluded}
              />

              <StrengthSection model={model} unit={unit} />
              <RatesSection
                model={model}
                unit={unit}
                names={new Map(training.data!.exercises.map((e) => [e.id, e.name]))}
              />
              <LevelsSection
                model={model}
                unit={unit}
                sexKnown={
                  training.data!.profile?.sex === 'male' || training.data!.profile?.sex === 'female'
                }
              />
              <PlateausSection model={model} unit={unit} exercises={training.data!.exercises} />
              <VolumeSection model={model} unit={unit} />
              <BalanceSection model={model} />
              {muscleBalanceIncluded ? (
                <MusclesSection model={model} />
              ) : (
                <Section id="muscles" title="Sets per muscle group" science="muscles">
                  <ProLock feature="muscle_balance" />
                </Section>
              )}
              <ConsistencySection model={model} />
              <BodySection model={model} unit={unit} />
              <RecordsSection model={model} unit={unit} />
            </>
          )}
        </>
      ) : null}

      <Sheet
        open={pickingExercise}
        onClose={() => setPickingExercise(false)}
        title="Choose an exercise"
        description="Weighted exercises you logged in this period."
      >
        <ActionList
          items={(model?.exerciseOptions ?? []).map((o) => ({
            label: o.name,
            hint: pluralize(o.sessions, 'session'),
            icon: <Dumbbell className="size-5" aria-hidden />,
            onSelect: () => {
              setParam('exercise', o.id);
              setPickingExercise(false);
            },
          }))}
        />
      </Sheet>
    </>
  );
}

function ProgressionBlock({
  model,
  dismissed,
  unit,
  included,
}: {
  model: ProgressModel;
  dismissed: Set<string>;
  unit: WeightUnit;
  included: boolean;
}) {
  const open = model.progression.filter((s) => !dismissed.has(s.id));
  if (open.length === 0) return null;
  return (
    <Section
      id="progression"
      title="Ready to progress"
      science="progression"
      detail="Based on your last session of each exercise and its routine target."
    >
      {included ? (
        <Suggestions suggestions={model.progression} dismissed={dismissed} unit={unit} />
      ) : (
        <ProLock
          feature="progression"
          lead={`${pluralize(open.length, 'exercise')} ${open.length === 1 ? 'is' : 'are'} ready for more weight or reps.`}
        />
      )}
    </Section>
  );
}

function Section({
  id,
  title,
  detail,
  science,
  children,
}: {
  id: string;
  title: string;
  detail?: string;
  /** Section of the science page that explains these numbers. */
  science?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`sec-${id}`} className="mt-9">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`sec-${id}`} className="font-display text-[1.3rem] font-bold leading-tight">
          {title}
        </h2>
        {science ? <EvidenceLink topic={science} about={title.toLowerCase()} /> : null}
      </div>
      {detail ? (
        <p className="mb-3 mt-0.5 text-sm text-faint">{detail}</p>
      ) : (
        <div className="mb-3" />
      )}
      {children}
    </section>
  );
}

function Tile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: 'up' | 'down';
}) {
  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <dt className="text-sm text-faint">{label}</dt>
      <dd className="mt-1 font-display text-[1.35rem] font-bold leading-none">{value}</dd>
      {detail ? (
        <dd
          className={cn(
            'tabular mt-1.5 text-xs',
            tone === 'up' ? 'text-accent-text' : tone === 'down' ? 'text-warn' : 'text-faint',
          )}
        >
          {detail}
        </dd>
      ) : null}
    </div>
  );
}

function Summary({ model, unit }: { model: ProgressModel; unit: WeightUnit }) {
  const { volume, consistency } = model;
  const volChange =
    volume.previousTotalKg && volume.previousTotalKg > 0
      ? (volume.totalKg - volume.previousTotalKg) / volume.previousTotalKg
      : null;
  const working = volume.periods.reduce((n, p) => n + p.workingSets, 0);
  return (
    <dl className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Tile
        label="Workouts"
        value={String(consistency.total)}
        detail={
          consistency.perWeek !== null
            ? `${consistency.perWeek.toFixed(1)} per week`
            : 'Too short for a weekly rate'
        }
      />
      <Tile label="Working sets" value={String(working)} detail="Warm-ups excluded" />
      <Tile
        label={`Volume load (${unit})`}
        value={volume.totalKg > 0 ? formatCompact(toDisplayWeight(volume.totalKg, unit)) : '0'}
        detail={
          volChange !== null
            ? `${formatSignedPercent(volChange)} vs previous ${model.window.days} days`
            : model.range === 'all'
              ? 'All logged weighted sets'
              : 'No earlier period to compare'
        }
        tone={
          volChange === null ? undefined : volChange > 0 ? 'up' : volChange < 0 ? 'down' : undefined
        }
      />
      <Tile
        label="Records"
        value={String(model.records.length)}
        detail={`${pluralize(new Set(model.records.map((r) => r.exerciseId)).size, 'exercise')}`}
      />
    </dl>
  );
}

function StrengthSection({ model, unit }: { model: ProgressModel; unit: WeightUnit }) {
  const s = model.selected;
  const fmt = (v: number) => formatWeightValue(v, 'kg', 1);
  const xFmt = (x: number) => formatDayMonth(new Date(x));
  const xLong = (x: number) => formatShortDate(new Date(x));
  return (
    <Section
      id="strength"
      title="Strength"
      science="e1rm"
      detail={s ? `${s.name}, best set each session.` : undefined}
    >
      {!s ? (
        <ChartEmpty height={160}>
          No weighted exercises in this period. Strength charts need sets logged with a load.
        </ChartEmpty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="min-w-0 p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">Estimated 1RM ({unit})</h3>
              {s.e1rmChange ? (
                <span
                  className={cn(
                    'tabular text-sm font-semibold',
                    s.e1rmChange.fraction > 0
                      ? 'text-accent-text'
                      : s.e1rmChange.fraction < 0
                        ? 'text-warn'
                        : 'text-muted',
                  )}
                >
                  {Math.abs(s.e1rmChange.fraction) < 0.0005
                    ? 'No change in this period'
                    : `${formatSignedPercent(s.e1rmChange.fraction, 1)} in this period`}
                </span>
              ) : null}
            </div>
            {s.points.filter((p) => p.bestE1rm !== null).length >= 2 ? (
              <LineChart
                label={`Estimated 1RM for ${s.name} per session, and the best so far, in ${unit}`}
                height={220}
                series={[
                  {
                    id: 'e1rm',
                    label: 'Session best',
                    color: 'var(--chart-1)',
                    style: 'both',
                    points: s.points
                      .filter((p) => p.bestE1rm !== null)
                      .map((p) => ({ x: p.date.getTime(), y: toDisplayWeight(p.bestE1rm!, unit) })),
                  },
                  {
                    id: 'record',
                    label: 'Best so far',
                    color: 'var(--chart-2)',
                    style: 'line',
                    points: s.points
                      .filter((p) => p.runningBestE1rm !== null)
                      .map((p) => ({
                        x: p.date.getTime(),
                        y: toDisplayWeight(p.runningBestE1rm!, unit),
                      })),
                  },
                ]}
                formatY={fmt}
                formatX={xFmt}
                formatXLong={xLong}
              />
            ) : (
              <ChartEmpty height={220}>
                {s.points.length === 1
                  ? 'One session in this period. A trend needs at least two; try a longer range.'
                  : s.points.every((p) => p.bestE1rm === null) && s.points.length > 1
                    ? 'Estimated 1RM is only calculated for compound lifts with sets of 12 reps or fewer. Top set load and reps below still track this exercise.'
                    : 'Not enough sets of 12 reps or fewer in this period for a trend.'}
              </ChartEmpty>
            )}
            <p className="mt-2 text-xs text-faint">
              Brzycki up to 5 reps, Epley above, reps in reserve counted, sets of 12 reps or fewer.
              An estimate, not a lift you performed.
            </p>
          </Card>

          <div className="grid min-w-0 gap-4">
            <Card className="min-w-0 p-4 sm:p-5">
              <h3 className="mb-2 font-semibold">Top set load ({unit})</h3>
              {s.points.length >= 2 ? (
                <LineChart
                  label={`Heaviest working load for ${s.name} per session, in ${unit}`}
                  height={130}
                  series={[
                    {
                      id: 'load',
                      label: 'Top set load',
                      color: 'var(--chart-1)',
                      style: 'both',
                      points: s.points
                        .filter((p) => p.topLoad !== null)
                        .map((p) => ({
                          x: p.date.getTime(),
                          y: toDisplayWeight(p.topLoad!, unit),
                        })),
                    },
                  ]}
                  formatY={fmt}
                  formatX={xFmt}
                  formatXLong={xLong}
                />
              ) : (
                <ChartEmpty height={130}>Needs two sessions in this period.</ChartEmpty>
              )}
            </Card>
            <Card className="min-w-0 p-4 sm:p-5">
              <h3 className="mb-2 font-semibold">Reps at the top load</h3>
              {s.points.length >= 2 ? (
                <BarChart
                  label={`Reps done at the heaviest load each session for ${s.name}`}
                  height={130}
                  valueName="Reps"
                  formatValue={(v) => String(Math.round(v))}
                  bars={s.points.map((p) => ({
                    key: p.workoutId,
                    label: formatDayMonth(p.date),
                    longLabel: `${formatShortDate(p.date)}: ${p.topLoad !== null ? formatWeight(p.topLoad, unit) : ''}`,
                    value: p.topLoadReps ?? 0,
                  }))}
                />
              ) : (
                <ChartEmpty height={130}>Needs two sessions in this period.</ChartEmpty>
              )}
            </Card>
          </div>

          <Card className="p-4 sm:p-5 lg:col-span-2">
            <h3 className="font-semibold">Relative strength</h3>
            {s.relativeStrength ? (
              <p className="mt-1">
                <span className="tabular font-display text-[1.35rem] font-bold">
                  {s.relativeStrength.ratio.toFixed(2)}×
                </span>{' '}
                <span className="text-muted">body weight</span>
                <span className="mt-1 block text-sm text-faint">
                  Estimated 1RM {formatWeight(s.relativeStrength.e1rm, unit)} ÷ body weight{' '}
                  {formatWeight(s.relativeStrength.bodyKg, unit)} on{' '}
                  {formatShortDate(s.relativeStrength.date)}. Useful for tracking yourself over
                  time, not for comparing with others.
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">
                Needs a weigh-in on or before your latest {s.name} session.{' '}
                <Link
                  to="/body"
                  className="font-medium text-accent-text underline-offset-4 hover:underline"
                >
                  Add one
                </Link>
              </p>
            )}
          </Card>
        </div>
      )}
    </Section>
  );
}

function VolumeSection({ model, unit }: { model: ProgressModel; unit: WeightUnit }) {
  const per = model.bucket === 'day' ? 'day' : model.bucket === 'week' ? 'week' : 'month';
  const top = model.volume.byExercise.filter((e) => e.volumeKg > 0).slice(0, 8);
  return (
    <Section
      id="volume"
      title="Volume"
      science="volume"
      detail={`Load × reps on completed working sets, per ${per}. A measure of work done, not of muscle growth.`}
    >
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card className="p-4 sm:p-5">
          <h3 className="mb-2 font-semibold">
            Volume load per {per} ({unit})
          </h3>
          {model.volume.totalKg > 0 ? (
            <BarChart
              label={`Volume load per ${per} in ${unit}`}
              valueName={`Volume (${unit})`}
              formatValue={(v) => formatCompact(v)}
              bars={model.volume.periods.map((p) => ({
                key: p.period.start.toISOString(),
                label: p.period.label,
                longLabel: `${p.period.longLabel}${p.period.current ? ' (so far)' : p.period.partial ? ' (only partly in range)' : ''}`,
                value: toDisplayWeight(p.volumeKg, unit),
                highlight: p.period.current,
                note: `${p.workingSets} working sets`,
              }))}
              baseColor="var(--chart-1)"
              color="var(--chart-2)"
            />
          ) : (
            <ChartEmpty height={200}>No weighted working sets in this period.</ChartEmpty>
          )}
        </Card>
        <Card className="p-4 sm:p-5">
          <h3 className="mb-3 font-semibold">By exercise ({unit})</h3>
          {top.length > 0 ? (
            <BarChart
              orientation="horizontal"
              categoryName="Exercise"
              label={`Volume load by exercise in ${unit}`}
              valueName={`Volume (${unit})`}
              formatValue={(v) => formatCompact(v)}
              bars={top.map((e) => ({
                key: e.id,
                label: e.name,
                value: toDisplayWeight(e.volumeKg, unit),
                note: `${e.workingSets} sets`,
              }))}
            />
          ) : (
            <p className="text-sm text-muted">No weighted working sets in this period.</p>
          )}
        </Card>
      </div>
    </Section>
  );
}

function MusclesSection({ model }: { model: ProgressModel }) {
  const { workload, weeks, recency } = model.muscles;
  const perWeek = weeks >= 2;
  const rows = [...workload].sort((a, b) => b.weighted - a.weighted);
  const value = (w: (typeof workload)[number]) => (perWeek ? w.weighted / weeks : w.weighted);
  return (
    <Section
      id="muscles"
      title="Sets per muscle group"
      science="muscles"
      detail={`Working sets: 1 for the primary muscle, 0.5 for each secondary muscle${perWeek ? ', averaged per week' : ''}.`}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <Card className="p-4 sm:p-5">
          {rows.some((w) => w.weighted > 0) ? (
            <BarChart
              orientation="horizontal"
              categoryName="Muscle group"
              label={
                perWeek
                  ? 'Weighted working sets per week by muscle group'
                  : 'Weighted working sets by muscle group'
              }
              valueName={perWeek ? 'Sets per week' : 'Sets'}
              formatValue={(v) => (Math.round(v * 10) / 10).toLocaleString('en-GB')}
              bars={rows.map((w) => ({
                key: w.muscle,
                label: MUSCLE_LABELS[w.muscle],
                value: value(w),
                note: `${w.direct} direct, ${w.indirect} as secondary`,
              }))}
            />
          ) : (
            <p className="text-sm text-muted">No working sets in this period.</p>
          )}
        </Card>
        <Card className="p-4 sm:p-5">
          <h3 className="font-semibold">Last trained directly</h3>
          <p className="mb-2 text-xs text-faint">
            Days since a working set where it was the primary muscle. A record of time passed, not a
            recovery score.
          </p>
          <ul className="divide-y divide-line text-sm">
            {[...recency]
              .sort((a, b) => (a.daysSince ?? 9999) - (b.daysSince ?? 9999))
              .map((r) => (
                <li key={r.muscle} className="flex justify-between py-1.5">
                  <span>{MUSCLE_LABELS[r.muscle]}</span>
                  <span className="tabular text-muted">
                    {r.daysSince === null
                      ? 'Not yet'
                      : r.daysSince === 0
                        ? 'Today'
                        : r.daysSince === 1
                          ? '1 day ago'
                          : `${r.daysSince} days ago`}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      </div>
    </Section>
  );
}

function ConsistencySection({ model }: { model: ProgressModel }) {
  const { consistency } = model;
  const per = model.bucket === 'day' ? 'day' : model.bucket === 'week' ? 'week' : 'month';
  const a = consistency.adherence;
  return (
    <Section id="consistency" title="Consistency" science="frequency">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <Card className="p-4 sm:p-5">
          <h3 className="mb-2 font-semibold">Workouts per {per}</h3>
          <BarChart
            label={`Workouts per ${per}`}
            valueName="Workouts"
            formatValue={(v) => String(Math.round(v))}
            bars={consistency.periods.map((p) => ({
              key: p.period.start.toISOString(),
              label: p.period.label,
              longLabel: `${p.period.longLabel}${p.period.current ? ' (so far)' : p.period.partial ? ' (only partly in range)' : ''}`,
              value: p.workouts,
              highlight: p.period.current,
            }))}
            baseColor="var(--chart-1)"
            color="var(--chart-2)"
          />
        </Card>
        <Card className="flex flex-col gap-4 p-4 sm:p-5">
          <div>
            <h3 className="font-semibold">Adherence</h3>
            {a.rate !== null ? (
              <>
                <p className="mt-1 font-display text-[1.35rem] font-bold leading-none">
                  {Math.round(a.rate * 100)}%
                </p>
                <p className="mt-1 text-sm text-muted">
                  {a.completed} of {pluralize(a.planned, 'planned session')} completed. Planned days
                  come from your active routine.
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">
                Shown when your active routine has planned weekdays in this period.{' '}
                <Link to="/routines" className="font-medium text-accent-text">
                  Set weekdays
                </Link>
              </p>
            )}
          </div>
          <div>
            <h3 className="font-semibold">Frequency</h3>
            <p className="mt-1 text-sm text-muted">
              {consistency.perWeek !== null
                ? `${consistency.perWeek.toFixed(1)} workouts per week`
                : COPY.frequencyEmpty}
              {consistency.perMonth !== null
                ? `, ${consistency.perMonth.toFixed(1)} per month`
                : ''}
              .{' '}
              {consistency.minutes > 0
                ? `${Math.round(consistency.minutes / 60)} hours of training in total.`
                : ''}
            </p>
          </div>
        </Card>
      </div>
    </Section>
  );
}

function BodySection({ model, unit }: { model: ProgressModel; unit: WeightUnit }) {
  const { points, trend } = model.body;
  return (
    <Section id="body" title="Body weight" science="body-weight">
      <Card className="p-4 sm:p-5">
        {points.length >= 2 ? (
          <>
            <LineChart
              label={`Body weight in ${unit} with the ${ROLLING_WINDOW_DAYS}-day average`}
              height={200}
              series={[
                {
                  id: 'raw',
                  label: 'Weigh-in',
                  color: 'var(--chart-2)',
                  style: 'dots',
                  points: points.map((p) => ({
                    x: p.date.getTime(),
                    y: toDisplayWeight(p.kg, unit),
                  })),
                },
                {
                  id: 'avg',
                  label: `${ROLLING_WINDOW_DAYS}-day average`,
                  color: 'var(--chart-1)',
                  style: 'line',
                  points: points
                    .filter((p) => p.averageKg !== null)
                    .map((p) => ({ x: p.date.getTime(), y: toDisplayWeight(p.averageKg!, unit) })),
                },
              ]}
              formatY={(v) => v.toLocaleString('en-GB', { maximumFractionDigits: 1 })}
              formatX={(x) => formatDayMonth(new Date(x))}
              formatXLong={(x) => formatShortDate(new Date(x))}
            />
            <p className="mt-2 text-sm text-muted">
              {trend
                ? `The ${ROLLING_WINDOW_DAYS}-day average moved ${trend.averageChangeKg >= 0 ? '+' : '−'}${formatWeight(Math.abs(trend.averageChangeKg), unit)} over ${pluralize(trend.days, 'day')}.`
                : 'Not enough weigh-ins for a trend in this period.'}
            </p>
          </>
        ) : (
          <ChartEmpty height={140}>
            {points.length === 0 ? 'No weigh-ins in this period.' : 'One weigh-in in this period.'}{' '}
            <Link to="/body" className="font-medium text-accent-text">
              Body metrics
            </Link>
          </ChartEmpty>
        )}
      </Card>
    </Section>
  );
}

function RecordsSection({ model, unit }: { model: ProgressModel; unit: WeightUnit }) {
  return (
    <Section id="records" title="Records in this period" science="records">
      {model.records.length === 0 ? (
        <p className="flex min-h-22 items-center justify-center rounded-nested bg-surface-2 px-5 py-4 text-center type-meta text-text-2">
          No records in this period. They come from beating an earlier best, so they arrive in
          bursts.
        </p>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {model.records.slice(0, 12).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{r.exerciseName}</span>
                  <span className="flex items-center gap-1.5 text-sm text-faint">
                    <Trophy className="size-3.5 text-accent-text" aria-hidden />
                    {PR_LABELS[r.type]} · {formatShortDate(r.date)}
                  </span>
                </span>
                <span className="tabular shrink-0 text-right">
                  <span className="block font-display text-lg font-semibold">
                    {formatRecordValue(r.type, r.value, unit)}
                  </span>
                  <span className="text-xs text-faint">
                    was {formatRecordValue(r.type, r.previousBest, unit)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <Link
            to="/records"
            className="block border-t border-line px-4 py-3 text-sm font-medium text-accent-text hover:bg-surface-2"
          >
            All records
          </Link>
        </Card>
      )}
    </Section>
  );
}
