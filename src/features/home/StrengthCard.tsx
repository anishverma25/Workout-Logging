import { TrendingUp } from 'lucide-react';
import type { StrengthTrend } from '@/domain/analytics/strength';
import { MIN_TREND_SESSIONS } from '@/domain/analytics/strength';
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
        detail="Estimated 1RM from your best set each session, last 5 weeks"
        action={trends.length > 0 ? { label: 'Progress', to: '/progress' } : undefined}
      />
      {trends.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl bg-surface-2 p-4 text-sm text-muted">
          <TrendingUp className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
          Trends appear once a weighted lift has {MIN_TREND_SESSIONS} sessions in the last 5 weeks.
          Until then, a line would be noise rather than progress.
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {trends.map((t) => {
            const up = t.change > 0.005;
            const down = t.change < -0.005;
            return (
              <li
                key={t.exerciseId}
                className="flex items-center gap-4 py-3.5 first:pt-1 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.exerciseName}</p>
                  <p className="mt-0.5 flex items-baseline gap-2">
                    <span className="tabular font-display text-[1.45rem] font-semibold leading-none">
                      {formatWeightValue(t.latest, unit)}
                    </span>
                    <span className="text-sm text-faint">{unit} e1RM</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Sparkline
                    values={t.points.map((p) => toDisplayWeight(p.e1rm, unit))}
                    label={`${t.exerciseName} estimated 1RM over ${t.points.length} sessions since ${formatDayMonth(t.points[0]!.date)}`}
                  />
                  <span
                    className={cn(
                      'tabular text-sm font-semibold',
                      up ? 'text-accent-text' : down ? 'text-warn' : 'text-muted',
                    )}
                  >
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
