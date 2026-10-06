import { Scale } from 'lucide-react';
import { ROLLING_MIN_ENTRIES, type BodyWeightSummary } from '@/domain/analytics/bodyweight';
import { Card } from '@/components/ui/Card';
import { Sparkline } from '@/components/ui/Sparkline';
import { formatRelativeDay } from '@/lib/dates';
import { formatWeightValue, toDisplayWeight, type WeightUnit } from '@/lib/units';

interface BodyWeightCardProps {
  summary: BodyWeightSummary | null;
  unit: WeightUnit;
}

export function BodyWeightCard({ summary, unit }: BodyWeightCardProps) {
  return (
    <Card className="flex flex-col p-5" aria-labelledby="body-title">
      <h2 id="body-title" className="flex items-center gap-2 text-sm font-medium text-muted">
        <Scale className="size-4 text-data-2" aria-hidden />
        Body weight
      </h2>
      {summary ? (
        <>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="flex items-baseline gap-1.5">
              <span className="tabular font-display text-[1.75rem] font-bold leading-none">
                {formatWeightValue(summary.latest.weightKg, unit)}
              </span>
              <span className="text-muted">{unit}</span>
            </p>
            <Sparkline
              tone="data"
              values={summary.series.map((p) => toDisplayWeight(p.kg, unit))}
              label={`Body weight over the last 30 days, ${summary.series.length} entries`}
              className="h-10 w-24"
            />
          </div>
          <p className="mt-2 text-sm text-muted">
            {summary.weekChangeKg !== null ? (
              <>
                <span className="tabular font-semibold text-text">
                  {summary.weekChangeKg >= 0 ? '+' : '−'}
                  {formatWeightValue(Math.abs(summary.weekChangeKg), unit)} {unit}
                </span>{' '}
                vs a week earlier
              </>
            ) : (
              'Log for a week to see change'
            )}
          </p>
          <p className="mt-auto pt-3 text-sm text-faint">
            {summary.rollingAverageKg !== null
              ? `7-day average ${formatWeightValue(summary.rollingAverageKg, unit)} ${unit} from ${summary.rollingCount} entries. `
              : `Average shows after ${ROLLING_MIN_ENTRIES} entries in a week. `}
            Last logged {formatRelativeDay(new Date(summary.latest.measuredAt)).toLowerCase()}.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Weigh in a few mornings a week. Daily numbers swing with water and food, so the 7-day
          average is the one to watch.
        </p>
      )}
    </Card>
  );
}
