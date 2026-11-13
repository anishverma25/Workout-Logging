import { Link } from 'react-router';
import { CalendarCheck, ChevronRight, Crown, TrendingUp, Trophy } from 'lucide-react';
import { useFeature } from '@/app/entitlement';
import type { WeeklyCheckin } from '@/domain/analytics/checkin';
import { cn } from '@/lib/cn';
import { formatDayMonth, addDays } from '@/lib/dates';
import { pluralize } from '@/lib/format';
import { formatWeightValue, type WeightUnit } from '@/lib/units';
import { ExplainButton } from '@/features/coach/CoachParts';

/** Monday's look back at last week: what improved, what stalled, one thing to focus on. */
export function CheckinCard({
  checkin,
  unit,
  className,
  brief,
}: {
  checkin: WeeklyCheckin | null;
  unit: WeightUnit;
  className?: string;
  /** The AI coach brief for this check-in, for its Explain button. */
  brief?: () => string;
}) {
  const included = useFeature('weekly_checkin');
  if (!checkin) return null;
  const range = `${formatDayMonth(checkin.weekStart)} to ${formatDayMonth(addDays(checkin.weekStart, 6))}`;
  // Free: the good news is theirs (sessions, lifts up, records); what stalled and the focus for
  // this week, the part that tells them what to do, is Pro.
  if (!included)
    return (
      <section
        aria-labelledby="checkin-title"
        className={cn('rounded-panel border border-border bg-surface p-5', className)}
        data-checkin-teaser
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
        <Link
          to="/pro"
          className="pressable mt-3 flex items-center gap-3 rounded-nested bg-surface-2 px-4 py-3"
          data-checkin-locked
        >
          <Crown className="size-4 shrink-0 text-lime" aria-hidden />
          <span className="type-meta min-w-0 flex-1 text-text-1">
            {checkin.stalled.length > 0
              ? `${pluralize(checkin.stalled.length, 'lift has', 'lifts have')} stalled. Why, and your focus for this week, are in Pro.`
              : 'Your focus for this week is ready in Pro.'}
          </span>
          <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />
        </Link>
      </section>
    );
  return (
    <section
      aria-labelledby="checkin-title"
      className={cn('rounded-panel border border-border bg-surface p-5', className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="type-meta text-text-2">{range}</p>
          <h2 id="checkin-title" className="type-title text-text-1">
            Last week
          </h2>
        </div>
        {brief ? <ExplainButton topic="checkin" about="last week" brief={brief} /> : null}
      </div>
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
