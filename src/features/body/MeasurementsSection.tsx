import { useMemo, useState } from 'react';
import { Plus, Ruler } from 'lucide-react';
import { LineChart } from '@/components/charts/LineChart';
import { ChartEmpty } from '@/components/charts/ChartParts';
import { Card, IconTile, ListRow, SecondaryButton, SectionHeader } from '@/components/kit';
import { IconButton } from '@/components/ui/Button';
import { Chips } from '@/components/ui/Fields';
import { type LengthUnit } from '@/data/repositories/measurements';
import { measurementRatios, type MeasurementRatios } from '@/domain/analytics/body';
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
import { measurementLabel } from './measureSites';
import { EvidenceLink } from '../science/EvidenceLink';

type Series = MeasurementField | 'bodyFatPct';


export function MeasurementsSection({
  entries,
  unit,
  sex,
  heightCm = null,
}: {
  entries: BodyMeasurement[];
  unit: LengthUnit;
  sex: Sex | null;
  heightCm?: number | null;
}) {
  const label = (f: Series) =>
    f === 'bodyFatPct' ? 'Body fat' : measurementLabel(f, sex, f.endsWith('RightCm') || hasRight(f));
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<BodyMeasurement | null>(null);
  const sorted = useMemo(
    () => entries.filter(isAlive).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)),
    [entries],
  );
  const available = [...MEASUREMENT_FIELDS, 'bodyFatPct' as const].filter((f) =>
    sorted.some((e) => e[f] != null),
  );
  // A part measured on both sides reads "Left arm" next to "Right arm".
  const hasRight = (f: MeasurementField) =>
    sorted.some((e) => e[`${f.replace(/Cm$/, '')}RightCm` as MeasurementField] != null);
  const ratios = useMemo(
    () => measurementRatios(entries, { heightCm, sex }),
    [entries, heightCm, sex],
  );
  const [picked, setPicked] = useState<Series | null>(null);
  const field: Series | null =
    picked && available.includes(picked) ? picked : (available[0] ?? null);
  const show = (f: Series, v: number) =>
    f === 'bodyFatPct'
      ? `${v.toLocaleString('en-GB', { maximumFractionDigits: 1 })}%`
      : formatLength(v, unit);

  return (
    <section aria-labelledby="measurements-title" className="mt-8">
      <SectionHeader
        id="measurements-title"
        title="Measurements"
        className="items-center"
        action={
          sorted.length > 0 ? (
            // An icon, so the title never truncates to "Measuremen" (UI v3, F4).
            <IconButton
              label="Add measurements"
              icon={<Plus className="size-5" aria-hidden />}
              onClick={() => setAdding(true)}
            />
          ) : null
        }
      />

      {sorted.length === 0 ? (
        <Card className="flex flex-col items-start gap-4">
          <IconTile icon={<Ruler />} />
          <p className="type-body max-w-[48ch] text-text-2 [text-wrap:balance]">
            A tape measure shows what the scale cannot: a waist that shrinks while weight holds
            steady means fat lost and muscle gained. Waist and neck also give a body-fat estimate.
          </p>
          <SecondaryButton icon={<Plus aria-hidden />} onClick={() => setAdding(true)}>
            Add measurements
          </SecondaryButton>
        </Card>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <RatiosCard ratios={ratios} unit={unit} needsHeight={heightCm == null} />
          <Card flush className="self-start">
            <ul className="divide-y-[0.5px] divide-divider px-4" aria-label="Latest measurements">
              {available.map((f) => {
                const withValue = sorted.filter((e) => e[f] != null);
                const last = withValue[withValue.length - 1]!;
                const first = withValue[0]!;
                const change = (last[f] as number) - (first[f] as number);
                const shownChange =
                  f === 'bodyFatPct'
                    ? change
                    : toDisplayLength(Math.abs(change), unit) * Math.sign(change);
                return (
                  <li key={f}>
                    <ListRow
                      title={label(f)}
                      subtitle={
                        withValue.length > 1
                          ? `${shownChange > 0 ? '+' : shownChange < 0 ? '−' : ''}${Math.abs(
                              Math.round(shownChange * 10) / 10,
                            ).toLocaleString(
                              'en-GB',
                            )}${f === 'bodyFatPct' ? ' points' : ` ${unit}`} since ${formatDayMonth(new Date(first.measuredAt))}`
                          : `On ${formatDayMonth(new Date(last.measuredAt))}`
                      }
                      trailing={
                        <span className="type-headline tabular shrink-0 text-text-1">
                          {show(f, last[f] as number)}
                        </span>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            {field ? (
              <>
                <Chips
                  label="Measurement"
                  options={available.map((f) => ({ value: f, label: label(f) }))}
                  value={field}
                  onChange={(v) => v && setPicked(v)}
                  className="mb-3"
                />
                {sorted.filter((e) => e[field] != null).length >= 2 ? (
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
                          .filter((e) => e[field] != null)
                          .map((e) => ({
                            x: new Date(e.measuredAt).getTime(),
                            y:
                              field === 'bodyFatPct'
                                ? (e[field] as number)
                                : toDisplayLength(e[field] as number, unit),
                          })),
                      },
                    ]}
                    formatY={(v) => v.toLocaleString('en-GB', { maximumFractionDigits: 1 })}
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
            <ul
              className="mt-4 divide-y-[0.5px] divide-divider border-t-[0.5px] border-divider"
              aria-label="Measurement entries"
            >
              {[...sorted]
                .reverse()
                .slice(0, 8)
                .map((e) => (
                  <li key={e.id}>
                    <ListRow
                      onClick={() => setEditing(e)}
                      titleWeight={500}
                      title={formatShortDate(new Date(e.measuredAt))}
                      subtitle={[...MEASUREMENT_FIELDS, 'bodyFatPct' as const]
                        .filter((f) => e[f] != null)
                        .map((f) => `${label(f)} ${show(f, e[f] as number)}`)
                        .join(', ')}
                      chevron
                    />
                  </li>
                ))}
            </ul>
          </Card>
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

const BAND_COPY = {
  healthy: 'In the healthy range, under 0.5',
  raised: 'Above 0.5: worth bringing your waist down',
  high: 'Above 0.6: high, worth acting on',
} as const;

const PART = { arm: 'Arm', forearm: 'Forearm', thigh: 'Thigh', calf: 'Calf' } as const;

/** Waist ratios and any real left and right difference, from `measurementRatios`. */
function RatiosCard({
  ratios,
  unit,
  needsHeight,
}: {
  ratios: MeasurementRatios;
  unit: LengthUnit;
  needsHeight: boolean;
}) {
  const { waistToHeight: whtr, waistToHip: whr, sides } = ratios;
  if (!whtr && !whr && sides.length === 0) {
    if (!needsHeight) return null;
  }
  const n2 = (v: number) => v.toLocaleString('en-GB', { minimumFractionDigits: 2 });
  return (
    <Card flush className="self-start lg:col-span-2" data-measure-ratios>
      <ul className="divide-y-[0.5px] divide-divider px-4" aria-label="What your measurements say">
        {whtr ? (
          <li>
            <ListRow
              title="Waist to height"
              subtitle={BAND_COPY[whtr.band]}
              trailing={
                <span
                  className={`type-headline tabular shrink-0 ${whtr.band === 'healthy' ? 'text-up' : 'text-text-1'}`}
                >
                  {n2(whtr.value)}
                </span>
              }
            />
          </li>
        ) : needsHeight ? (
          <li>
            <ListRow
              title="Waist to height"
              subtitle="Add your height in Profile to see how your waist compares"
            />
          </li>
        ) : null}
        {whr ? (
          <li>
            <ListRow
              title="Waist to hip"
              subtitle={
                whr.raised ? 'At or above the WHO cut-off for raised risk' : 'Below the WHO cut-off'
              }
              trailing={<span className="type-headline tabular shrink-0">{n2(whr.value)}</span>}
            />
          </li>
        ) : null}
        {sides.map((s) => {
          const diff = toDisplayLength(Math.abs(s.rightCm - s.leftCm), unit);
          return (
            <li key={s.part}>
              <ListRow
                title={`${PART[s.part]}, left and right`}
                subtitle={`${s.rightCm > s.leftCm ? 'Right' : 'Left'} is ${diff.toLocaleString('en-GB', { maximumFractionDigits: 1 })} ${unit} bigger`}
                trailing={
                  <span className="type-meta tabular shrink-0 text-text-2">
                    {formatLength(s.leftCm, unit)} · {formatLength(s.rightCm, unit)}
                  </span>
                }
              />
            </li>
          );
        })}
      </ul>
      <div className="px-4 pb-3">
        <EvidenceLink topic="measurements" about="waist ratios" />
      </div>
    </Card>
  );
}
