import { useMemo, useState } from 'react';
import { Plus, Ruler } from 'lucide-react';
import { LineChart } from '@/components/charts/LineChart';
import { ChartEmpty } from '@/components/charts/ChartParts';
import { Button } from '@/components/ui/Button';
import { Chips } from '@/components/ui/Fields';
import { MEASUREMENT_LABELS, type LengthUnit } from '@/data/repositories/measurements';
import { isAlive } from '@/domain/analytics/sessions';
import {
  MEASUREMENT_FIELDS,
  type BodyMeasurement,
  type MeasurementField,
  type Sex,
} from '@/domain/models/schemas';
import { formatDayMonth, formatShortDate } from '@/lib/dates';
import { formatLength, toDisplayLength } from './format';
import { MeasurementSheet } from './MeasurementSheet';

type Series = MeasurementField | 'bodyFatPct';

const label = (f: Series) => (f === 'bodyFatPct' ? 'Body fat' : MEASUREMENT_LABELS[f]);

export function MeasurementsSection({
  entries,
  unit,
  sex,
}: {
  entries: BodyMeasurement[];
  unit: LengthUnit;
  sex: Sex | null;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<BodyMeasurement | null>(null);
  const sorted = useMemo(
    () => entries.filter(isAlive).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)),
    [entries],
  );
  const available = [...MEASUREMENT_FIELDS, 'bodyFatPct' as const].filter((f) =>
    sorted.some((e) => e[f] !== null),
  );
  const [picked, setPicked] = useState<Series | null>(null);
  const field: Series | null =
    picked && available.includes(picked) ? picked : (available[0] ?? null);
  const show = (f: Series, v: number) =>
    f === 'bodyFatPct'
      ? `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
      : formatLength(v, unit);

  return (
    <section aria-labelledby="measurements-title" className="mt-8">
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <h2
          id="measurements-title"
          className="font-display text-[1.3rem] font-semibold leading-tight tracking-tight"
        >
          Measurements
        </h2>
        {sorted.length > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => setAdding(true)}
          >
            Add measurements
          </Button>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] bg-surface p-5">
          <span className="flex size-11 items-center justify-center rounded-[0.8rem] bg-[var(--tile-sky)] text-white">
            <Ruler className="size-5" aria-hidden />
          </span>
          <p className="max-w-[48ch] text-sm text-muted">
            A tape measure shows what the scale cannot: a waist that shrinks while weight holds
            steady means fat lost and muscle gained. Waist and neck also give a body-fat estimate.
          </p>
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setAdding(true)}>
            Add measurements
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <ul className="grid grid-cols-2 gap-2.5 self-start">
            {available.map((f) => {
              const withValue = sorted.filter((e) => e[f] !== null);
              const last = withValue[withValue.length - 1]!;
              const first = withValue[0]!;
              const change = (last[f] as number) - (first[f] as number);
              const shownChange =
                f === 'bodyFatPct'
                  ? change
                  : toDisplayLength(Math.abs(change), unit) * Math.sign(change);
              return (
                <li key={f} className="rounded-[1.1rem] bg-surface p-4">
                  <p className="text-[0.8125rem] font-medium text-faint">{label(f)}</p>
                  <p className="tabular mt-1 font-display text-[1.35rem] font-semibold leading-tight tracking-tight">
                    {show(f, last[f] as number)}
                  </p>
                  <p className="tabular mt-0.5 text-xs text-faint">
                    {withValue.length > 1
                      ? `${shownChange > 0 ? '+' : shownChange < 0 ? '−' : ''}${Math.abs(
                          Math.round(shownChange * 10) / 10,
                        ).toLocaleString()}${f === 'bodyFatPct' ? ' points' : ` ${unit}`} since ${formatDayMonth(new Date(first.measuredAt))}`
                      : `On ${formatDayMonth(new Date(last.measuredAt))}`}
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="rounded-[var(--radius-card)] bg-surface p-5">
            {field ? (
              <>
                <Chips
                  label="Measurement"
                  options={available.map((f) => ({ value: f, label: label(f) }))}
                  value={field}
                  onChange={(v) => v && setPicked(v)}
                  className="mb-3"
                />
                {sorted.filter((e) => e[field] !== null).length >= 2 ? (
                  <LineChart
                    label={`${label(field)} over time`}
                    height={190}
                    series={[
                      {
                        id: field,
                        label: label(field),
                        color: 'var(--chart-1)',
                        style: 'line',
                        points: sorted
                          .filter((e) => e[field] !== null)
                          .map((e) => ({
                            x: new Date(e.measuredAt).getTime(),
                            y:
                              field === 'bodyFatPct'
                                ? (e[field] as number)
                                : toDisplayLength(e[field] as number, unit),
                          })),
                      },
                    ]}
                    formatY={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    formatX={(x) => formatDayMonth(new Date(x))}
                    formatXLong={(x) => formatShortDate(new Date(x))}
                  />
                ) : (
                  <ChartEmpty height={190}>
                    One {label(field).toLowerCase()} entry so far. Measure again in a week or two to
                    see a trend.
                  </ChartEmpty>
                )}
              </>
            ) : null}
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {[...sorted]
                .reverse()
                .slice(0, 8)
                .map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(e)}
                      className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
                    >
                      <span className="shrink-0 whitespace-nowrap font-medium">
                        {formatShortDate(new Date(e.measuredAt))}
                      </span>
                      <span className="min-w-0 truncate text-sm text-faint">
                        {[...MEASUREMENT_FIELDS, 'bodyFatPct' as const]
                          .filter((f) => e[f] !== null)
                          .map((f) => `${label(f)} ${show(f, e[f] as number)}`)
                          .join(', ')}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}

      <MeasurementSheet open={adding} unit={unit} sex={sex} onClose={() => setAdding(false)} />
      <MeasurementSheet
        open={!!editing}
        entry={editing}
        unit={unit}
        sex={sex}
        onClose={() => setEditing(null)}
      />
    </section>
  );
}
