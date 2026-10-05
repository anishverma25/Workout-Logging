import { useMemo, useState } from 'react';
import { Plus, Scale } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { LineChart } from '@/components/charts/LineChart';
import { ChartEmpty } from '@/components/charts/ChartParts';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chips } from '@/components/ui/Fields';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
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
import {
  addDays,
  formatDayMonth,
  formatRelativeDay,
  formatShortDate,
  startOfDay,
} from '@/lib/dates';
import { pluralize } from '@/lib/format';
import { formatWeightValue, toDisplayWeight, type WeightUnit } from '@/lib/units';
import { useNow } from '@/lib/useNow';
import { BodyWeightSheet } from './BodyWeightSheet';

type Range = '30d' | '90d' | 'all';
const RANGE_DAYS: Record<Exclude<Range, 'all'>, number> = { '30d': 30, '90d': 90 };

const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

function signed(kg: number, unit: WeightUnit): string {
  const v = toDisplayWeight(kg, unit);
  const rounded = Math.round(v * 10) / 10;
  if (rounded === 0) return `0 ${unit}`;
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`;
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

  return (
    <>
      <PageHeader
        title="Body metrics"
        subtitle="Body weight over time. The trend matters more than any single weigh-in."
        actions={
          series.length > 0 ? (
            <Button
              size="sm"
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => setAdding(true)}
              className="max-sm:hidden"
            >
              Add weigh-in
            </Button>
          ) : undefined
        }
      />
      {training.status === 'loading' ? <Skeleton className="h-96" /> : null}
      {training.status === 'error' ? <ErrorState error={training.error} /> : null}

      {training.status === 'success' && !summary ? (
        <EmptyState
          icon={<Scale className="size-5" aria-hidden />}
          title="Track your body weight"
          body={`Log a weigh-in whenever you like. With ${ROLLING_MIN_ENTRIES} or more in a week you get a ${ROLLING_WINDOW_DAYS}-day average, which smooths out the daily swings from water and food. It also lets the app show strength relative to body weight.`}
          actions={
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setAdding(true)}>
              Add your first weigh-in
            </Button>
          }
        />
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <Card className="p-5">
              <p className="text-sm text-faint">
                Latest · {formatRelativeDay(new Date(summary.latest.measuredAt), now)}
              </p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="font-display text-[3.4rem] font-bold leading-none">
                  {formatWeightValue(summary.latest.weightKg, unit)}
                </span>
                <span className="text-lg text-muted">{unit}</span>
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-faint">Previous</dt>
                  <dd className="tabular font-semibold">
                    {summary.previous ? (
                      <>
                        {formatWeightValue(summary.previous.weightKg, unit)} {unit}{' '}
                        <span className="font-normal text-muted">
                          ({signed(summary.latest.weightKg - summary.previous.weightKg, unit)})
                        </span>
                      </>
                    ) : (
                      'None yet'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-faint">{ROLLING_WINDOW_DAYS}-day average</dt>
                  <dd className="tabular font-semibold">
                    {summary.rollingAverageKg !== null ? (
                      `${formatWeightValue(summary.rollingAverageKg, unit)} ${unit}`
                    ) : (
                      <span className="font-normal text-muted">
                        Needs {ROLLING_MIN_ENTRIES} weigh-ins in {ROLLING_WINDOW_DAYS} days (
                        {summary.rollingCount} so far)
                      </span>
                    )}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-faint">Change vs a week earlier</dt>
                  <dd className="tabular font-semibold">
                    {summary.weekChangeKg !== null ? (
                      signed(summary.weekChangeKg, unit)
                    ) : (
                      <span className="font-normal text-muted">
                        Needs a weigh-in from at least a week before the latest
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-xl font-semibold">Trend</h2>
                <Chips
                  label="Range"
                  options={[
                    { value: '30d', label: '30 days' },
                    { value: '90d', label: '90 days' },
                    { value: 'all', label: 'All' },
                  ]}
                  value={range}
                  onChange={(r) => r && setRange(r)}
                  className="mx-0 px-0"
                />
              </div>
              {inRange.length >= 2 ? (
                <LineChart
                  label={`Body weight in ${unit}: weigh-ins and ${ROLLING_WINDOW_DAYS}-day average`}
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
                      id: 'avg',
                      label: `${ROLLING_WINDOW_DAYS}-day average`,
                      color: 'var(--chart-1)',
                      style: 'line',
                      points: inRange
                        .filter((p) => p.averageKg !== null)
                        .map((p) => ({
                          x: p.date.getTime(),
                          y: toDisplayWeight(p.averageKg!, unit),
                        })),
                    },
                  ]}
                  formatY={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  formatX={(x) => formatDayMonth(new Date(x))}
                  formatXLong={(x) => formatShortDate(new Date(x))}
                />
              ) : (
                <ChartEmpty height={210}>
                  {inRange.length === 0
                    ? 'No weigh-ins in this range. Try a longer range.'
                    : 'One weigh-in in this range. Add another to start a trend line.'}
                </ChartEmpty>
              )}
              <p className="mt-3 text-sm text-muted">
                {trend
                  ? `Over ${pluralize(trend.days, 'day')}, your ${ROLLING_WINDOW_DAYS}-day average moved ${signed(trend.averageChangeKg, unit)}.`
                  : `A trend needs ${ROLLING_WINDOW_DAYS}-day averages at least a week apart in this range.`}{' '}
                Day to day changes of a kilogram or so are normal and mostly water.
              </p>
            </Card>
          </div>

          <section aria-labelledby="weigh-ins" className="mt-8">
            <h2 id="weigh-ins" className="mb-3 font-display text-xl font-semibold">
              All weigh-ins
            </h2>
            <div className="flex flex-col gap-5">
              {months.map((m) => (
                <div key={m.key}>
                  <h3 className="mb-1.5 text-sm font-semibold text-faint">{m.label}</h3>
                  <Card className="overflow-hidden">
                    <ul className="divide-y divide-line">
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

          <Button
            onClick={() => setAdding(true)}
            icon={<Plus className="size-5" aria-hidden />}
            className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-30 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.5)] sm:hidden"
          >
            Weigh-in
          </Button>
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
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
    >
      <span className="min-w-0">
        <span className="block font-medium">{formatShortDate(point.date)}</span>
        {point.entry.note ? (
          <span className="block truncate text-sm text-faint">{point.entry.note}</span>
        ) : null}
      </span>
      <span className="tabular shrink-0 text-right">
        <span className="block font-display text-lg font-semibold">
          {formatWeightValue(point.kg, unit)} {unit}
        </span>
        {previous ? (
          <span className="text-xs text-faint">{signed(point.kg - previous.kg, unit)}</span>
        ) : null}
      </span>
    </button>
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
