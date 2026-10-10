import { Check, X } from 'lucide-react';
import type { DashboardModel } from '@/domain/analytics/dashboard';
import type { DayStatus } from '@/domain/analytics/schedule';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { formatLongDay } from '@/lib/dates';
import { formatDurationSummary, formatNumber, shortDayName } from '@/lib/format';
import { toDisplayWeight, type WeightUnit } from '@/lib/units';

interface WeekCardProps {
  days: DashboardModel['weekDays'];
  window: DashboardModel['recentWindow'];
  consistency: DashboardModel['consistency'];
  unit: WeightUnit;
  className?: string;
}

const STATE_LABEL: Record<DayStatus['state'], string> = {
  completed: 'trained',
  extra: 'extra session',
  missed: 'missed',
  planned: 'planned',
  rest: 'rest day',
};

/**
 * Training days of the current week, in the order of the week-start setting (D9), with the
 * last seven days' numbers underneath.
 */
export function WeekCard({ days, window: w, consistency, unit, className }: WeekCardProps) {
  const { planned, completed } = w.adherence;
  const showsPlanned = days.some((d) => d.state === 'planned');
  const first = days[0];
  const last = days[days.length - 1];
  return (
    <Card className={cn('p-5', className)} aria-labelledby="week-title">
      <div className="mb-4">
        <h2 id="week-title" className="type-title text-text-1">
          Training days
        </h2>
        <p className="type-meta mt-0.5 text-text-2">
          {first && last
            ? `${shortDayName(first.date.getDay())} to ${shortDayName(last.date.getDay())}`
            : null}
          {planned > 0 ? ` · ${completed} of ${planned} planned, last 7 days` : null}
        </p>
      </div>

      <ol className="grid grid-cols-7 gap-1.5" aria-label="This week, day by day">
        {days.map((d) => (
          <li key={d.date.toISOString()} className="flex flex-col items-center gap-2">
            <span
              aria-hidden
              className={cn(
                'type-caption',
                d.isToday ? 'font-semibold text-text-1' : 'text-text-2',
              )}
            >
              {shortDayName(d.date.getDay())}
            </span>
            <DayMark day={d} />
            <span className="sr-only">
              {formatLongDay(d.date)}: {d.sessions[0]?.workout.name ?? d.plannedDay?.name ?? 'rest'}
              , {STATE_LABEL[d.state]}
              {d.isToday ? ' (today)' : ''}
            </span>
          </li>
        ))}
      </ol>

      <div className="type-meta mt-3 flex flex-wrap gap-x-4 gap-y-1 text-text-2" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-lime" />
          Trained
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] border border-dashed border-border-strong" />
          Missed
        </span>
        {showsPlanned ? (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] border border-border-strong" />
            Planned
          </span>
        ) : null}
      </div>
      <p className="type-meta mt-2 text-text-2">Today only counts once you log it.</p>

      <div className="mt-5 border-t-[0.5px] border-divider pt-4">
        <h3 className="type-label text-text-2">Last 7 days</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4">
          <Stat label="Sessions" value={String(w.sessions)} />
          <Stat label="Working sets" value={String(w.workingSets)} />
          <Stat
            label="Volume load"
            value={formatNumber(toDisplayWeight(w.volumeKg, unit), 0)}
            unit={unit}
          />
          <Stat label="Time trained" value={formatDurationSummary(w.minutes)} />
        </dl>
      </div>

      {consistency.averagePerWeek !== null ? (
        <p className="type-meta mt-4 border-t-[0.5px] border-divider pt-3.5 text-text-2">
          <span className="tabular font-semibold text-text-1">
            {formatNumber(consistency.averagePerWeek)}
          </span>{' '}
          sessions a week over the last {consistency.weeks.length - 1} weeks.
          {consistency.plannedPerWeek ? <> Your plan has {consistency.plannedPerWeek}.</> : null}
        </p>
      ) : null}
    </Card>
  );
}

/** Trained: lime pill with a check. Missed: dashed outline with ×. Planned: outline. Else a dot. */
function DayMark({ day }: { day: DayStatus }) {
  const base = 'flex h-14 w-full max-w-9 items-center justify-center rounded-field';
  const label = day.sessions[0]?.workout.name ?? day.plannedDay?.name;
  switch (day.state) {
    case 'completed':
    case 'extra':
      return (
        <div className={cn(base, 'bg-lime text-on-lime')} title={label}>
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </div>
      );
    case 'missed':
      return (
        <div
          className={cn(base, 'border border-dashed border-border-strong text-text-2')}
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
            day.isToday ? 'border-2 border-lime bg-lime-dim' : 'border border-border-strong',
          )}
          title={`${label} planned`}
        />
      );
    default:
      return (
        <div className={base} title="Rest day">
          <span className="size-1 rounded-full bg-text-3" />
        </div>
      );
  }
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <dt className="type-meta text-text-2">{label}</dt>
      <dd className="type-headline tabular mt-0.5 text-text-1">
        {value}
        {unit ? <span className="type-meta ml-1 text-text-2">{unit}</span> : null}
      </dd>
    </div>
  );
}
