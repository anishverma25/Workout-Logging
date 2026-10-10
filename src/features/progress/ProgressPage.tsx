import { COPY } from '@/domain/analytics/thresholdCopy';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Dumbbell,
  FlaskConical,
  Trophy,
} from 'lucide-react';
import { EvidenceLink } from '@/features/science/EvidenceLink';
import { PageHeader } from '@/app/layout/PageHeader';
import { BarChart } from '@/components/charts/BarChart';
import { ChartEmpty, ChartTable } from '@/components/charts/ChartParts';
import { TextLink } from '@/components/kit';
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
import { FREQUENCY_MIN_DAYS } from '@/domain/analytics/progress';
import { MUSCLE_SCALE_MIN } from '@/domain/analytics/muscles';
import {
  formatCompact,
  formatDate,
  formatDateRange,
  formatDurationSummary,
  formatNumber,
  formatSignedPercent,
  pluralize,
} from '@/lib/format';
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
      {model && model.hasAnyData && !rangeLocked ? <JumpBar /> : null}
      <Link
        to="/science"
        className="pressable chrome mt-3 mb-4 flex min-h-14 items-center gap-3 rounded-panel border border-border bg-surface px-4 py-2.5"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-tile bg-surface-2 text-text-2">
          <FlaskConical className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="type-headline block text-text-1">How every number is calculated</span>
          <span className="type-meta block text-text-2">Formulas and the research behind them</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-text-3" aria-hidden />
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
              <TextLink to="/science" chevron>
                How it is calculated
              </TextLink>
            </>
          }
        />
      ) : null}

      {model && model.hasAnyData ? (
        <>
          {/* One filter row, scoping everything below it. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                className="pressable chrome type-meta inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-surface-2 px-4 font-semibold text-text-1"
              >
                <span className="text-text-2">Exercise:</span>
                <span className="max-w-44 truncate">{model.selected?.name}</span>
                <ChevronDown className="size-4 text-text-2" aria-hidden />
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
              <p className="type-meta mt-2 text-text-2">
                {formatDateRange(model.window.start, new Date(model.window.end.getTime() - 1), now)}
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
    <section id={id} aria-labelledby={`sec-${id}`} className="mt-8 scroll-mt-28">
      <div className="flex items-center gap-2">
        <h2 id={`sec-${id}`} className="type-title text-text-1">
          {title}
        </h2>
        {science ? <EvidenceLink topic={science} about={title.toLowerCase()} /> : null}
      </div>
      {detail ? (
        <p className="type-meta mt-0.5 mb-3 line-clamp-2 text-text-2">{detail}</p>
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
  /** Null (or zero where zero means nothing yet) shows "None yet". */
  value: string | null;
  detail?: string;
  tone?: 'up' | 'down';
}) {
  return (
    <div className="rounded-panel border border-border bg-surface p-4">
      <dt className="type-meta text-text-2">{label}</dt>
      {value === null ? (
        <dd className="type-headline mt-1.5 text-text-2">None yet</dd>
      ) : (
        <dd className="type-stat mt-1 text-text-1">{value}</dd>
      )}
      {detail ? (
        <dd className="type-meta tabular mt-1 flex items-center gap-1 text-text-2">
          {tone === 'up' ? (
            <ArrowUpRight className="size-4 shrink-0" aria-hidden />
          ) : tone === 'down' ? (
            <ArrowDownRight className="size-4 shrink-0" aria-hidden />
          ) : null}
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
    <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        label="Workouts"
        value={String(consistency.total)}
        detail={
          consistency.perWeek !== null
            ? `${formatNumber(consistency.perWeek)} per week`
            : `Needs ${FREQUENCY_MIN_DAYS} days`
        }
      />
      <Tile
        label="Working sets"
        value={working > 0 ? String(working) : null}
        detail="Warm-ups excluded"
      />
      <Tile
        label={`Volume load (${unit})`}
        value={volume.totalKg > 0 ? formatCompact(toDisplayWeight(volume.totalKg, unit)) : null}
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
        value={model.records.length > 0 ? String(model.records.length) : null}
        detail={
          model.records.length > 0
            ? pluralize(new Set(model.records.map((r) => r.exerciseId)).size, 'exercise')
            : undefined
        }
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
    <Section id="strength" title="Strength" science="e1rm" detail={undefined}>
      {!s ? (
        <ChartEmpty height={160}>
          No weighted exercises in this period. Strength charts need sets logged with a load.
        </ChartEmpty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="min-w-0 p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="type-headline text-text-1">Estimated 1RM ({unit})</h3>
              {s.e1rmChange ? (
                <span className="type-meta tabular font-semibold text-text-2">
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
            <p className="type-meta mt-2 text-text-2">
              Brzycki up to 5 reps, Epley above, reps in reserve counted, sets of 12 reps or fewer.
              An estimate, not a lift you performed.
            </p>
          </Card>

          <div className="grid min-w-0 gap-4">
            <Card className="min-w-0 p-4 sm:p-5">
              <h3 className="type-headline mb-2 text-text-1">Top set load ({unit})</h3>
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
              <h3 className="type-headline mb-2 text-text-1">Reps at the top load</h3>
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
            <h3 className="type-headline text-text-1">Relative strength</h3>
            {s.relativeStrength ? (
              <p className="mt-1">
                <span className="type-stat tabular text-text-1">
                  {s.relativeStrength.ratio.toFixed(2)}
                </span>{' '}
                <span className="type-meta text-text-2">× body weight</span>
                <span className="type-meta mt-1 block text-text-2">
                  Estimated 1RM {formatWeight(s.relativeStrength.e1rm, unit)} ÷ body weight{' '}
                  {formatWeight(s.relativeStrength.bodyKg, unit)} on{' '}
                  {formatShortDate(s.relativeStrength.date)}. Useful for tracking yourself over
                  time, not for comparing with others.
                </span>
              </p>
            ) : (
              <p className="type-meta mt-1 flex flex-wrap items-center gap-x-2 text-text-2">
                Needs a weigh-in on or before your latest {s.name} session.
                <TextLink to="/body" small chevron>
                  Add one
                </TextLink>
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
          <h3 className="type-headline mb-2 text-text-1">
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
              baseColor="var(--border-strong)"
              color="var(--lime)"
            />
          ) : (
            <ChartEmpty height={200}>No weighted working sets in this period.</ChartEmpty>
          )}
        </Card>
        <Card className="p-4 sm:p-5">
          <h3 className="type-headline mb-3 text-text-1">By exercise ({unit})</h3>
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
            <EmptyBox>No weighted working sets in this period.</EmptyBox>
          )}
        </Card>
      </div>
    </Section>
  );
}

function MusclesSection({ model }: { model: ProgressModel }) {
  const { workload, previous, weeks, recency } = model.muscles;
  const perWeek = weeks >= 2;
  const value = (w: { weighted: number }) => (perWeek ? w.weighted / weeks : w.weighted);
  const previousBy = new Map((previous ?? []).map((w) => [w.muscle, value(w)]));
  const trained = [...workload]
    .filter((w) => w.weighted > 0)
    .sort((x, y) => y.weighted - x.weighted);
  const untrained = workload.filter((w) => w.weighted === 0);
  // One fixed scale for every muscle so bars compare honestly (D4).
  const scaleMax = Math.max(MUSCLE_SCALE_MIN, ...trained.map(value));
  const versus = model.range === '7d' ? 'last week' : `previous ${model.window.days} days`;
  return (
    <Section
      id="muscles"
      title="Sets per muscle group"
      science="muscles"
      detail={`Hard working sets${perWeek ? ' per week' : ''}. Direct sets count 1, supporting sets count 0.5.`}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <Card className="p-4 sm:p-5">
          {trained.length > 0 ? (
            <>
              <ul className="flex flex-col gap-3" aria-label="Sets per muscle group">
                {trained.map((w) => {
                  const v = value(w);
                  const before = previousBy.get(w.muscle);
                  const change = before === undefined ? null : v - before;
                  return (
                    <li key={w.muscle}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="type-body font-medium text-text-1">
                          {MUSCLE_LABELS[w.muscle]}
                        </span>
                        <span className="tabular flex items-baseline gap-2">
                          {change !== null && Math.abs(change) >= 0.05 ? (
                            <span className="type-meta text-text-2">
                              {change > 0 ? '+' : '−'}
                              {formatNumber(Math.abs(change))} vs {versus}
                            </span>
                          ) : null}
                          <span className="type-headline text-text-1">{formatNumber(v)}</span>
                        </span>
                      </div>
                      <div
                        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-track"
                        aria-hidden
                      >
                        <div
                          className="h-full rounded-full bg-lime"
                          style={{ width: `${Math.min(100, (v / scaleMax) * 100)}%` }}
                        />
                      </div>
                      <span className="sr-only">
                        {w.direct} direct, {w.indirect} as a supporting muscle
                      </span>
                    </li>
                  );
                })}
              </ul>
              {untrained.length > 0 ? (
                <div className="mt-4">
                  <p className="type-meta mb-2 text-text-2">Not trained yet</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {untrained.map((w) => (
                      <li
                        key={w.muscle}
                        className="type-meta inline-flex h-7 items-center rounded-full bg-surface-2 px-3 text-text-2"
                      >
                        {MUSCLE_LABELS[w.muscle]}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="type-meta mt-4 text-text-2">
                Bars share one scale, full at {formatNumber(scaleMax)} sets
                {perWeek ? ' a week' : ''}. More hard sets tend to bring more growth, with smaller
                returns as the total climbs; no single number is right.
              </p>
              <ChartTable
                caption="Sets per muscle group"
                columns={[
                  'Muscle group',
                  perWeek ? 'Sets per week' : 'Sets',
                  'Direct',
                  'Supporting',
                ]}
                rows={trained.map((w) => [
                  MUSCLE_LABELS[w.muscle],
                  formatNumber(value(w)),
                  String(w.direct),
                  String(w.indirect),
                ])}
              />
            </>
          ) : (
            <EmptyBox>No working sets in this period.</EmptyBox>
          )}
        </Card>
        <Card className="p-4 sm:p-5">
          <h3 className="type-headline text-text-1">Last trained directly</h3>
          <p className="type-meta mb-2 text-text-2">
            Days since a working set where it was the primary muscle. A record of time passed, not a
            recovery score.
          </p>
          <ul className="divide-y-[0.5px] divide-divider">
            {[...recency]
              .sort((a, b) => (a.daysSince ?? 9999) - (b.daysSince ?? 9999))
              .map((r) => (
                <li key={r.muscle} className="flex min-h-11 items-center justify-between gap-3">
                  <span className="type-body text-text-1">{MUSCLE_LABELS[r.muscle]}</span>
                  <span className="type-meta tabular text-text-2">
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
          <h3 className="type-headline mb-2 text-text-1">Workouts per {per}</h3>
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
            baseColor="var(--border-strong)"
            color="var(--lime)"
          />
        </Card>
        <Card className="flex flex-col gap-4 p-4 sm:p-5">
          <div>
            <h3 className="type-headline text-text-1">Adherence</h3>
            {a.rate !== null ? (
              <>
                <p className="type-stat mt-1 text-text-1">{Math.round(a.rate * 100)}%</p>
                <p className="type-meta mt-1 text-text-2">
                  {a.completed} of {a.planned} planned, last {model.window.days} days. Planned days
                  come from your active routine.
                </p>
              </>
            ) : (
              <p className="type-meta mt-1 flex flex-wrap items-center gap-x-2 text-text-2">
                Shown when your active routine has planned weekdays in this period.
                <TextLink to="/routines" small chevron>
                  Set weekdays
                </TextLink>
              </p>
            )}
          </div>
          <div>
            <h3 className="type-headline text-text-1">Frequency</h3>
            <p className="type-meta mt-1 text-text-2">
              {consistency.perWeek !== null
                ? `${formatNumber(consistency.perWeek)} workouts per week${
                    consistency.perMonth !== null
                      ? `, ${formatNumber(consistency.perMonth)} per month`
                      : ''
                  }.`
                : COPY.frequencyEmpty}{' '}
              {consistency.minutes > 0
                ? `${formatDurationSummary(consistency.minutes)} trained so far.`
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
                  color: 'var(--chart-1)',
                  style: 'dots',
                  points: points.map((p) => ({
                    x: p.date.getTime(),
                    y: toDisplayWeight(p.kg, unit),
                  })),
                },
                {
                  id: 'avg',
                  label: `${ROLLING_WINDOW_DAYS}-day average`,
                  color: 'var(--chart-2)',
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
            <p className="type-meta mt-2 text-text-2">
              {trend
                ? `The ${ROLLING_WINDOW_DAYS}-day average moved ${trend.averageChangeKg >= 0 ? '+' : '−'}${formatWeight(Math.abs(trend.averageChangeKg), unit)} over ${pluralize(trend.days, 'day')}.`
                : 'Not enough weigh-ins for a trend in this period.'}
            </p>
          </>
        ) : (
          <EmptyBox>
            {points.length === 0
              ? 'No weigh-ins in this period.'
              : `One weigh-in in this period: ${formatWeight(points[0]!.kg, unit)}.`}
          </EmptyBox>
        )}
      </Card>
    </Section>
  );
}

function RecordsSection({ model, unit }: { model: ProgressModel; unit: WeightUnit }) {
  const now = new Date();
  return (
    <Section id="records" title="Records in this period" science="records">
      {model.records.length === 0 ? (
        <EmptyBox>No records in this period.</EmptyBox>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y-[0.5px] divide-divider">
            {model.records.slice(0, 12).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="type-headline block truncate text-text-1">{r.exerciseName}</span>
                  <span className="type-meta flex items-center gap-1.5 text-text-2">
                    <Trophy className="size-3.5" aria-hidden />
                    {PR_LABELS[r.type]} · {formatDate(r.date, now)}
                  </span>
                </span>
                <span className="tabular shrink-0 text-right">
                  <span className="type-headline block text-text-1">
                    {formatRecordValue(r.type, r.value, unit)}
                  </span>
                  <span className="type-meta text-text-2">
                    was {formatRecordValue(r.type, r.previousBest, unit)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t-[0.5px] border-divider px-4 py-2">
            <TextLink to="/records" chevron>
              All records
            </TextLink>
          </div>
        </Card>
      )}
    </Section>
  );
}

/** Empty chart or list: 88 high, surface-2, one centred line in Meta --text-2. */
function EmptyBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="type-meta flex min-h-22 items-center justify-center rounded-nested bg-surface-2 px-5 py-4 text-center text-text-2">
      {children}
    </p>
  );
}

const JUMPS = [
  { id: 'strength', label: 'Strength' },
  { id: 'volume', label: 'Volume' },
  { id: 'balance', label: 'Balance' },
  { id: 'consistency', label: 'Consistency' },
  { id: 'body', label: 'Body' },
] as const;

/** Sticky section bar (Part 4): tap to jump, the section in view is selected. */
function JumpBar() {
  const [current, setCurrent] = useState<string>(JUMPS[0].id);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setCurrent(visible.target.id);
      },
      { rootMargin: '-120px 0px -55% 0px' },
    );
    const els = JUMPS.map((j) => document.getElementById(j.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <nav
      aria-label="Progress sections"
      className="sticky top-[calc(2.75rem+env(safe-area-inset-top))] z-20 -mx-4 bg-bg px-4 py-2 tab:-mx-6 tab:px-6 lg:top-0 lg:-mx-8 lg:px-8"
    >
      <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {JUMPS.map((j) => (
          <li key={j.id}>
            <a
              href={`#${j.id}`}
              aria-current={current === j.id ? 'true' : undefined}
              onClick={(e) => {
                e.preventDefault();
                setCurrent(j.id);
                const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                document
                  .getElementById(j.id)
                  ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
              }}
              className={cn(
                'pressable chrome type-meta inline-flex h-9 items-center rounded-full px-4 font-semibold whitespace-nowrap',
                current === j.id ? 'bg-text-1 text-bg' : 'bg-surface-2 text-text-1',
              )}
            >
              {j.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
