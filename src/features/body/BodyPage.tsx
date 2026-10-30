import { TargetsCard } from './TargetsCard';
import { useMemo, useState } from 'react';
import { Plus, Scale } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { LineChart } from '@/components/charts/LineChart';
import { ChartEmpty } from '@/components/charts/ChartParts';
import {
  Card,
  Delta,
  ListRow,
  Metric,
  PrimaryButton,
  SegmentedControl,
  Skeleton,
} from '@/components/kit';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { usePreferences, useTrainingData } from '@/data/hooks';
import {
  bodyWeightSeries,
  bodyWeightSummary,
  bodyWeightTrend,
  ROLLING_MIN_ENTRIES,
  ROLLING_WINDOW_DAYS,
  type BodyWeightPoint,
} from '@/domain/analytics/bodyweight';
import type { BodyWeightEntry } from '@/domain/models/schemas';
import { addDays, formatRelativeDay, formatShortDate, startOfDay } from '@/lib/dates';
import { pluralize } from '@/lib/format';
import { formatWeightValue, toDisplayWeight, type WeightUnit } from '@/lib/units';
import { useNow } from '@/lib/useNow';
import { BodyWeightSheet } from './BodyWeightSheet';
import { BodyNumbers } from './BodyNumbers';
import { MeasurementsSection } from './MeasurementsSection';
import { bodySnapshot } from '@/domain/analytics/body';
import { buildSessions } from '@/domain/analytics/sessions';
import { loggedDaysPerWeek } from '@/domain/analytics/week';
import { ageFromBirthDate } from '@/lib/dates';

type Range = '30d' | '90d' | 'all';
const RANGE_DAYS: Record<Exclude<Range, 'all'>, number> = { '30d': 30, '90d': 90 };

const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

function signed(kg: number, unit: WeightUnit): string {
  const v = toDisplayWeight(kg, unit);
  const rounded = Math.round(v * 10) / 10;
  if (rounded === 0) return `0 ${unit}`;
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toLocaleString('en-GB', { maximumFractionDigits: 1 })} ${unit}`;
}

export function BodyPage() {
  const training = useTrainingData();
  const prefs = usePreferences();
  const unit = prefs.weightUnit;
  const now = useNow();
  const [range, setRange] = useState<Range>('30d');
  const [editing, setEditing] = useState<BodyWeightEntry | null>(null);
  const [adding, setAdding] = useState(false);

  const entries = training.data?.bodyWeights;
  const series = useMemo(() => bodyWeightSeries(entries ?? []), [entries]);
  const summary = useMemo(() => bodyWeightSummary(entries ?? []), [entries]);
  const inRange = useMemo(() => {
    if (range === 'all') return series;
    const since = addDays(startOfDay(now), -(RANGE_DAYS[range] - 1));
    return series.filter((p) => p.date >= since);
  }, [series, range, now]);
  const trend = bodyWeightTrend(inRange);
  const months = groupByMonth([...series].reverse());
  const data = training.data;
  const profile = data?.profile ?? null;
  const snapshot = useMemo(
    () =>
      data
        ? bodySnapshot({
            profile,
            age: profile?.birthDate ? ageFromBirthDate(profile.birthDate, now) : null,
            bodyWeights: data.bodyWeights,
            measurements: data.measurements,
            loggedDaysPerWeek: loggedDaysPerWeek(buildSessions(data), now),
            now,
          })
        : null,
    [data, profile, now],
  );
  // The smoothed trend at each weigh-in, for the chart line.
  const trendById = useMemo(
    () => new Map((snapshot?.trend ?? []).map((t) => [t.date.getTime(), t.trendKg])),
    [snapshot],
  );

  return (
    <>
      <PageHeader back={{ to: '/more', label: 'More' }} title="Body metrics" />
      {training.status === 'loading' ? <Skeleton height="24rem" radius="panel" /> : null}
      {training.status === 'error' ? <ErrorState error={training.error} /> : null}

      {training.status === 'success' && !summary ? (
        <EmptyState
          icon={<Scale className="size-5" aria-hidden />}
          title="Track your body weight"
          body={`Log a weigh-in whenever you like. With ${ROLLING_MIN_ENTRIES} or more in a week you get a ${ROLLING_WINDOW_DAYS}-day average, which smooths out the daily swings from water and food. It also lets the app show strength relative to body weight.`}
          actions={
            <PrimaryButton icon={<Plus aria-hidden />} onClick={() => setAdding(true)}>
              Add your first weigh-in
            </PrimaryButton>
          }
        />
      ) : null}

      {summary ? (
        <>
          {/* The number people open this page for comes first (UI v3, S15.1). */}
          <section aria-label="Latest weight" className="rounded-card bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <Metric
                tier="hero"
                accentLabel
                label={`Latest · ${formatRelativeDay(new Date(summary.latest.measuredAt), now)}`}
                value={formatWeightValue(summary.latest.weightKg, unit)}
                unit={unit}
              />
              {summary.weekChangeKg !== null ? (
                <Delta
                  className="mt-6"
                  tone={
                    Math.abs(summary.weekChangeKg) < 0.05
                      ? 'flat'
                      : summary.weekChangeKg > 0
                        ? 'up'
                        : 'down'
                  }
                >
                  {signed(summary.weekChangeKg, unit)} in a week
                </Delta>
              ) : null}
            </div>
            <dl className="type-meta mt-1 flex flex-wrap gap-x-4 gap-y-1 text-text-2">
              <div className="flex gap-1">
                <dt>{ROLLING_WINDOW_DAYS}-day average</dt>
                <dd className="tabular text-text-1">
                  {summary.rollingAverageKg !== null
                    ? `${formatWeightValue(summary.rollingAverageKg, unit)} ${unit}`
                    : `needs ${ROLLING_MIN_ENTRIES} weigh-ins (${summary.rollingCount} so far)`}
                </dd>
              </div>
              {summary.previous ? (
                <div className="flex gap-1">
                  <dt>Previous</dt>
                  <dd className="tabular text-text-1">
                    {formatWeightValue(summary.previous.weightKg, unit)} {unit}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4">
            <Card>
              <div className="mb-3 flex flex-col gap-3">
                <h2 className="type-section text-text-1">Trend</h2>
                <SegmentedControl
                  label="Range"
                  block
                  options={[
                    { value: '30d', label: '30D', ariaLabel: '30 days' },
                    { value: '90d', label: '90D', ariaLabel: '90 days' },
                    { value: 'all', label: 'All', ariaLabel: 'All time' },
                  ]}
                  value={range}
                  onChange={setRange}
                />
              </div>
              {inRange.length >= 2 ? (
                <LineChart
                  label={`Body weight in ${unit}: weigh-ins and the smoothed trend`}
                  height={210}
                  series={[
                    {
                      id: 'raw',
                      label: 'Weigh-in',
                      color: 'var(--chart-2)',
                      style: 'dots',
                      points: inRange.map((p) => ({
                        x: p.date.getTime(),
                        y: toDisplayWeight(p.kg, unit),
                      })),
                    },
                    {
                      id: 'trend',
                      label: 'Trend',
                      color: 'var(--chart-1)',
                      style: 'line',
                      points: inRange
                        .filter((p) => trendById.has(p.date.getTime()))
                        .map((p) => ({
                          x: p.date.getTime(),
                          y: toDisplayWeight(trendById.get(p.date.getTime())!, unit),
                        })),
                    },
                  ]}
                  formatY={(v) => v.toLocaleString('en-GB', { maximumFractionDigits: 1 })}
                  formatXLong={(x) => formatShortDate(new Date(x))}
                />
              ) : (
                <ChartEmpty height={210}>
                  {inRange.length === 0
                    ? 'No weigh-ins in this range. Try a longer range.'
                    : 'One weigh-in in this range. Add another to start a trend line.'}
                </ChartEmpty>
              )}
              <p className="type-meta mt-3 text-text-2 [text-wrap:balance]">
                {trend
                  ? `Over ${pluralize(trend.days, 'day')}, your ${ROLLING_WINDOW_DAYS}-day average moved ${signed(trend.averageChangeKg, unit)}.`
                  : `A trend needs ${ROLLING_WINDOW_DAYS}-day averages at least a week apart in this range.`}{' '}
                The line is a smoothed trend, so day to day swings of a kilogram or so (mostly
                water) barely move it.
              </p>
              {/* The one lime action on this page (UI v3, S15.1). */}
              <PrimaryButton
                block
                className="mt-4"
                icon={<Plus aria-hidden />}
                onClick={() => setAdding(true)}
                aria-label="Add weigh-in"
              >
                Weigh-in
              </PrimaryButton>
            </Card>
          </div>
          {snapshot && data ? (
            <div className="mt-8">
              <BodyNumbers
                snapshot={snapshot}
                goal={profile?.goal ?? null}
                sex={profile?.sex ?? null}
                heightCm={profile?.heightCm ?? null}
                unit={unit}
                hasProfile={!!profile}
              />
              {profile ? (
                <TargetsCard profile={profile} snapshot={snapshot} data={data} now={now} />
              ) : null}
            </div>
          ) : null}

          {data ? (
            <MeasurementsSection
              entries={data.measurements}
              unit={prefs.lengthUnit}
              sex={profile?.sex ?? null}
            />
          ) : null}

          <section aria-labelledby="weigh-ins" className="mt-8">
            <h2 id="weigh-ins" className="type-section mb-2 text-text-1">
              All weigh-ins
            </h2>
            <div className="flex flex-col gap-6">
              {months.map((m) => (
                <div key={m.key}>
                  <h3 className="type-meta mb-2 px-1 font-semibold text-text-2">{m.label}</h3>
                  <Card flush>
                    <ul className="divide-y-[0.5px] divide-divider px-4">
                      {m.points.map((p) => (
                        <li key={p.entry.id}>
                          <EntryRow
                            point={p}
                            previous={series[series.indexOf(p) - 1]}
                            unit={unit}
                            onOpen={() => setEditing(p.entry)}
                          />
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <BodyWeightSheet
        open={adding}
        defaultUnit={unit}
        lastKg={summary?.latest.weightKg ?? null}
        onClose={() => setAdding(false)}
      />
      <BodyWeightSheet
        open={!!editing}
        entry={editing}
        defaultUnit={unit}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function EntryRow({
  point,
  previous,
  unit,
  onOpen,
}: {
  point: BodyWeightPoint;
  previous: BodyWeightPoint | undefined;
  unit: WeightUnit;
  onOpen: () => void;
}) {
  return (
    <ListRow
      onClick={onOpen}
      title={formatShortDate(point.date)}
      subtitle={point.entry.note || undefined}
      titleWeight={500}
      trailing={
        <span className="tabular shrink-0 text-right">
          <span className="type-headline block text-text-1">
            {formatWeightValue(point.kg, unit)} {unit}
          </span>
          {previous ? (
            <span className="type-meta block text-text-2">
              {signed(point.kg - previous.kg, unit)}
            </span>
          ) : null}
        </span>
      }
    />
  );
}

function groupByMonth(points: BodyWeightPoint[]) {
  const groups: { key: string; label: string; points: BodyWeightPoint[] }[] = [];
  for (const p of points) {
    const key = `${p.date.getFullYear()}-${p.date.getMonth()}`;
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: monthFormat.format(p.date), points: [] };
      groups.push(g);
    }
    g.points.push(p);
  }
  return groups;
}
