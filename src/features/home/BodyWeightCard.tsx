import { formatDateInSentence } from '@/lib/format';
import { Scale } from 'lucide-react';
import { ROLLING_MIN_ENTRIES, type BodyWeightSummary } from '@/domain/analytics/bodyweight';
import { Card } from '@/components/ui/Card';
import { Sparkline } from '@/components/ui/Sparkline';
import { formatWeightValue, toDisplayWeight, type WeightUnit } from '@/lib/units';

interface BodyWeightCardProps {
  summary: BodyWeightSummary | null;
  unit: WeightUnit;
}

export function BodyWeightCard({ summary, unit }: BodyWeightCardProps) {
  return (
    <Card className="flex flex-col p-5" aria-labelledby="body-title">
      <h2 id="body-title" className="type-headline flex items-center gap-2 text-text-1">
        <Scale className="size-5 text-text-2" aria-hidden />
        Body weight
      </h2>
      {summary ? (
        <>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="flex items-baseline gap-1">
              <span className="type-stat tabular text-text-1">
                {formatWeightValue(summary.latest.weightKg, unit)}
              </span>
              <span className="type-meta text-text-2">{unit}</span>
            </p>
            {/* A single weigh-in would draw a flat line, which says nothing. */}
            {summary.series.length >= 2 ? (
              <Sparkline
                values={summary.series.map((p) => toDisplayWeight(p.kg, unit))}
                label={`Body weight over the last 30 days, ${summary.series.length} entries`}
                className="h-10 w-24"
              />
            ) : null}
          </div>
          <p className="type-meta mt-2 text-text-2">
            {summary.weekChangeKg !== null ? (
              <>
                <span className="tabular font-semibold text-text-1">
                  {summary.weekChangeKg >= 0 ? '+' : '−'}
                  {formatWeightValue(Math.abs(summary.weekChangeKg), unit)} {unit}
                </span>{' '}
                vs a week earlier
              </>
            ) : (
              'Log for a week to see change'
            )}
          </p>
          <p className="type-meta mt-auto pt-3 text-text-2">
            {summary.rollingAverageKg !== null
              ? `7-day average ${formatWeightValue(summary.rollingAverageKg, unit)} ${unit} from ${summary.rollingCount} entries. `
              : `Average shows after ${ROLLING_MIN_ENTRIES} entries in a week. `}
            Last logged {formatDateInSentence(new Date(summary.latest.measuredAt))}
          </p>
        </>
      ) : (
        <p className="type-meta mt-3 text-text-2">
          Weigh in a few mornings a week. Daily numbers swing with water and food, so the 7-day
          average is the one to watch.
        </p>
      )}
    </Card>
  );
}
