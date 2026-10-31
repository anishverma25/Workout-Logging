import { COPY } from '@/domain/analytics/thresholdCopy';
import { Delta, EmptyLine, TextButton } from '@/components/kit';
import type { StrengthTrend } from '@/domain/analytics/strength';
import { Sparkline } from '@/components/ui/Sparkline';
import { formatDayMonth } from '@/lib/dates';
import { formatSignedPercent } from '@/lib/format';
import { formatWeightValue, toDisplayWeight, type WeightUnit } from '@/lib/units';

interface StrengthCardProps {
  trends: StrengthTrend[];
  unit: WeightUnit;
  className?: string;
}

/** Strength trends as sparkline rows, like Stocks (UI v3, S3.8): green up, red down. */
export function StrengthCard({ trends, unit, className }: StrengthCardProps) {
  return (
    <section className={className} aria-labelledby="strength-title">
      <div className="mb-2 flex min-h-8 items-center justify-between gap-3">
        <h2 id="strength-title" className="type-section text-text-1">
          Strength
        </h2>
        {trends.length > 0 ? <TextButton to="/progress">See all</TextButton> : null}
      </div>
      {trends.length === 0 ? (
        <EmptyLine>{COPY.strengthTrendsEmpty}</EmptyLine>
      ) : (
        <ul className="divide-y-[0.5px] divide-divider rounded-card bg-surface px-4">
          {trends.map((t) => {
            const tone = t.change > 0.005 ? 'up' : t.change < -0.005 ? 'down' : 'flat';
            return (
              <li key={t.exerciseId} className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="type-subhead truncate text-text-1">{t.exerciseName}</p>
                  <p className="mt-0.5 whitespace-nowrap">
                    <span className="type-metric-sm text-text-1">
                      {formatWeightValue(t.latest, unit)}
                    </span>
                    <span className="ml-1 text-[0.8125rem] font-medium text-text-2">
                      {unit} e1RM
                    </span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Sparkline
                    values={t.points.map((p) => toDisplayWeight(p.e1rm, unit))}
                    label={`${t.exerciseName} estimated 1RM over ${t.points.length} sessions since ${formatDayMonth(t.points[0]!.date)}`}
                  />
                  <Delta tone={tone}>
                    {formatSignedPercent(t.change, 1)}
                    <span className="sr-only"> since {formatDayMonth(t.points[0]!.date)}</span>
                  </Delta>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="type-meta mt-2 px-4 text-text-2">{COPY.strengthTrendsDetail}</p>
    </section>
  );
}
