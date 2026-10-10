import { COPY } from '@/domain/analytics/thresholdCopy';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { EmptyState } from '@/components/kit';
import type { StrengthTrend } from '@/domain/analytics/strength';
import { Card, SectionHeader } from '@/components/ui/Card';
import { Sparkline } from '@/components/ui/Sparkline';
import { cn } from '@/lib/cn';
import { formatDayMonth } from '@/lib/dates';
import { formatSignedPercent } from '@/lib/format';
import { formatWeightValue, toDisplayWeight, type WeightUnit } from '@/lib/units';

interface StrengthCardProps {
  trends: StrengthTrend[];
  unit: WeightUnit;
  className?: string;
}

export function StrengthCard({ trends, unit, className }: StrengthCardProps) {
  return (
    <Card className={cn('p-5', className)} aria-labelledby="strength-title">
      <SectionHeader
        id="strength-title"
        title="Strength"
        detail={COPY.strengthTrendsDetail}
        action={trends.length > 0 ? { label: 'Progress', to: '/progress' } : undefined}
      />
      {trends.length === 0 ? (
        <EmptyState>{COPY.strengthTrendsEmpty}</EmptyState>
      ) : (
        <ul className="divide-y-[0.5px] divide-divider">
          {trends.map((t) => {
            const up = t.change > 0.005;
            const down = t.change < -0.005;
            return (
              <li
                key={t.exerciseId}
                className="flex items-center gap-4 py-3.5 first:pt-1 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="type-body truncate font-medium text-text-1">{t.exerciseName}</p>
                  <p className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="type-title tabular text-text-1">
                      {formatWeightValue(t.latest, unit)}
                    </span>
                    <span className="type-meta text-text-2">{unit} e1RM</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Sparkline
                    values={t.points.map((p) => toDisplayWeight(p.e1rm, unit))}
                    label={`${t.exerciseName} estimated 1RM over ${t.points.length} sessions since ${formatDayMonth(t.points[0]!.date)}`}
                  />
                  <span className="type-meta tabular inline-flex items-center gap-0.5 font-semibold text-text-1">
                    {up ? (
                      <ArrowUpRight className="size-4 text-text-2" aria-hidden />
                    ) : down ? (
                      <ArrowDownRight className="size-4 text-text-2" aria-hidden />
                    ) : (
                      <ArrowRight className="size-4 text-text-2" aria-hidden />
                    )}
                    {formatSignedPercent(t.change, 1)}
                    <span className="sr-only"> since {formatDayMonth(t.points[0]!.date)}</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
