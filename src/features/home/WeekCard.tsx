import { Check, X } from 'lucide-react';
import type { DashboardModel } from '@/domain/analytics/dashboard';
import type { DayStatus } from '@/domain/analytics/schedule';
import { Card, SectionHeader } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { formatLongDay, formatWeekdayShort } from '@/lib/dates';
import { formatCompact, formatDurationMinutes } from '@/lib/format';
import { toDisplayWeight, type WeightUnit } from '@/lib/units';

interface WeekCardProps {
  window: DashboardModel['recentWindow'];
  consistency: DashboardModel['consistency'];
  unit: WeightUnit;
  className?: string;
}

const STATE_LABEL: Record<DayStatus['state'], string> = {
  completed: 'completed',
  extra: 'extra session',
  missed: 'missed',
  planned: 'planned',
  rest: 'rest day',
};

export function WeekCard({ window: w, consistency, unit, className }: WeekCardProps) {
  const { planned, completed } = w.adherence;
  return (
    <Card className={cn('p-5', className)} aria-labelledby="week-title">
      <SectionHeader
        id="week-title"
        title="Last 7 days"
        detail={
          planned > 0
            ? `${completed} of ${planned} planned sessions done`
            : `${w.sessions} sessions logged`
        }
      />

      {/* The rail: one column per day, today on the right. */}
      <ol className="grid grid-cols-7 gap-1.5" aria-label="Training days, oldest first">
        {w.days.map((d) => (
          <li key={d.date.toISOString()} className="flex flex-col items-center gap-2">
            <span
              className={cn('text-[0.7rem] font-semibold', d.isToday ? 'text-text' : 'text-faint')}
              aria-hidden
            >
              {formatWeekdayShort(d.date).slice(0, 2)}
            </span>
            <DayBar day={d} />
            <span className="sr-only">
              {formatLongDay(d.date)}: {d.sessions[0]?.workout.name ?? d.plannedDay?.name ?? 'rest'}
              , {STATE_LABEL[d.state]}
              {d.isToday ? ' (today)' : ''}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-accent" />
          Trained
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] border border-dashed border-line-strong" />
          Missed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] border-2 border-accent-text" />
          Planned
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line pt-4 sm:grid-cols-4 lg:grid-cols-2">
        <Stat label="Sessions" value={String(w.sessions)} />
        <Stat label="Working sets" value={String(w.workingSets)} />
        <Stat
          label="Volume load"
          value={formatCompact(toDisplayWeight(w.volumeKg, unit))}
          unit={unit}
        />
        <Stat label="Time trained" value={formatDurationMinutes(w.minutes)} />
      </dl>

      {consistency.averagePerWeek !== null ? (
        <p className="mt-4 border-t border-line pt-3.5 text-sm text-muted">
          <span className="tabular font-semibold text-text">
            {consistency.averagePerWeek.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </span>{' '}
          sessions a week over the last {consistency.weeks.length - 1} weeks.
          {consistency.plannedPerWeek ? <> Your plan has {consistency.plannedPerWeek}.</> : null}
        </p>
      ) : null}
    </Card>
  );
}

/** Bars carry state only; the workout name is in the tooltip and the screen-reader text. */
function DayBar({ day }: { day: DayStatus }) {
  const base =
    'relative flex h-16 w-full max-w-9 items-end justify-center overflow-hidden rounded-[0.6rem] pb-2';
  const label = day.sessions[0]?.workout.name ?? day.plannedDay?.name;
  switch (day.state) {
    case 'completed':
    case 'extra':
      return (
        <div className={cn(base, 'bg-accent text-accent-ink')} title={label}>
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </div>
      );
    case 'missed':
      return (
        <div
          className={cn(base, 'border border-dashed border-line-strong text-faint')}
          title={`${label} missed`}
        >
          <X className="size-3.5" strokeWidth={2.5} aria-hidden />
        </div>
      );
    case 'planned':
      return (
        <div
          className={cn(
            base,
            'border-2',
            day.isToday ? 'border-accent-text bg-accent-soft' : 'border-line-strong',
          )}
          title={`${label} planned`}
        />
      );
    default:
      return (
        <div className={cn(base, 'items-center')} title="Rest day">
          <span className="h-0.5 w-3 rounded-full bg-line-strong" />
        </div>
      );
  }
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-faint">{label}</dt>
      <dd className="tabular mt-0.5 font-display text-[1.35rem] font-semibold leading-none">
        {value}
        {unit ? (
          <span className="ml-1 font-sans text-sm font-medium text-muted">{unit}</span>
        ) : null}
      </dd>
    </div>
  );
}
