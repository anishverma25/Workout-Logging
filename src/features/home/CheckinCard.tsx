import { CalendarCheck, TrendingUp, Trophy } from 'lucide-react';
import { useFeature } from '@/app/entitlement';
import type { WeeklyCheckin } from '@/domain/analytics/checkin';
import { cn } from '@/lib/cn';
import { formatDayMonth, addDays } from '@/lib/dates';
import { pluralize } from '@/lib/format';
import { formatWeightValue, type WeightUnit } from '@/lib/units';
import { ProLock } from '@/features/pro/ProLock';

/** Monday's look back at last week: what improved, what stalled, one thing to focus on. */
export function CheckinCard({
  checkin,
  unit,
  className,
}: {
  checkin: WeeklyCheckin | null;
  unit: WeightUnit;
  className?: string;
}) {
  const included = useFeature('weekly_checkin');
  if (!checkin) return null;
  const range = `${formatDayMonth(checkin.weekStart)} to ${formatDayMonth(addDays(checkin.weekStart, 6))}`;
  if (!included)
    return (
      <ProLock
        feature="weekly_checkin"
        className={className}
        lead={`Your check-in for ${range} is ready.`}
      />
    );
  return (
    <section
      aria-labelledby="checkin-title"
      className={cn('rounded-panel border border-border bg-surface p-5', className)}
    >
      <p className="type-meta text-text-2">{range}</p>
      <h2 id="checkin-title" className="type-title text-text-1">
        Last week
      </h2>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat
          icon={<CalendarCheck className="size-4" aria-hidden />}
          label="Sessions"
          value={
            checkin.target ? `${checkin.sessions}/${checkin.target}` : String(checkin.sessions)
          }
        />
        <Stat
          icon={<TrendingUp className="size-4" aria-hidden />}
          label="Lifts up"
          value={String(checkin.improved.length)}
        />
        <Stat
          icon={<Trophy className="size-4" aria-hidden />}
          label="Records"
          value={String(checkin.records)}
        />
      </dl>
      {checkin.improved.length > 0 ? (
        <p className="type-meta mt-3 text-text-2">
          Up:{' '}
          {checkin.improved
            .slice(0, 3)
            .map((i) => `${i.name} +${formatWeightValue(i.gainKg, unit)} ${unit}`)
            .join(', ')}
          {checkin.improved.length > 3 ? ` and ${checkin.improved.length - 3} more` : ''}.
        </p>
      ) : null}
      {checkin.stalled.length > 0 ? (
        <p className="type-meta mt-1 text-text-2">
          Stalled:{' '}
          {checkin.stalled.map((s) => `${s.name} (${pluralize(s.weeks, 'week')})`).join(', ')}.
        </p>
      ) : null}
      <p className="type-meta mt-3 rounded-nested bg-surface-2 px-4 py-3 text-text-1">
        <span className="font-semibold">This week: </span>
        {checkin.focus.text}
      </p>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-nested bg-surface-2 px-2 py-2.5">
      <dt className="type-caption flex items-center justify-center gap-1 text-text-2">
        {icon}
        {label}
      </dt>
      <dd className="type-headline tabular mt-0.5 text-text-1">{value}</dd>
    </div>
  );
}
