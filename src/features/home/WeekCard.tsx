import { useState } from 'react';
import { Check, X } from 'lucide-react';
import type { DashboardModel } from '@/domain/analytics/dashboard';
import type { DayStatus } from '@/domain/analytics/schedule';
import { BottomSheet, InfoButton } from '@/components/kit';
import { cn } from '@/lib/cn';
import { StreakPill, WeekRings } from './RingsCard';
import { formatLongDay } from '@/lib/dates';
import { formatDurationSummary, formatNumber, shortDayName } from '@/lib/format';
import { toDisplayWeight, type WeightUnit } from '@/lib/units';

interface WeekCardProps {
  days: DashboardModel['weekDays'];
  week: DashboardModel['week'];
  streak: DashboardModel['streak'];
  routineName: string | null;
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
 * The week (UI v3, S3.4 and S3.5): rings against the person's targets and a strip of circles in
 * the order of the week-start setting. The targets, the legend, the last seven days and the
 * average live behind the (i) button.
 */
export function WeekCard({
  days,
  week,
  streak,
  routineName,
  window: w,
  consistency,
  unit,
  className,
}: WeekCardProps) {
  const [about, setAbout] = useState(false);
  return (
    <section className={className} aria-labelledby="week-title">
      <div className="mb-2 flex min-h-8 items-center justify-between gap-3">
        <h2 id="week-title" className="type-section text-text-1">
          This week
        </h2>
        <div className="flex items-center gap-2">
          <StreakPill weeks={streak.weeks} />
          <InfoButton label="this week" onClick={() => setAbout(true)} />
        </div>
      </div>
      <div className="rounded-card bg-surface p-4">
        <WeekRings week={week} />
        <WeekStrip days={days} />
      </div>
      <BottomSheet open={about} onClose={() => setAbout(false)} title="This week">
        {about ? (
          <WeekDetails
            week={week}
            routineName={routineName}
            window={w}
            consistency={consistency}
            unit={unit}
            showsPlanned={days.some((d) => d.state === 'planned')}
          />
        ) : null}
      </BottomSheet>
    </section>
  );
}

/** Where the week's targets come from, for the (i) sheet. */
function weekTargetSources(week: DashboardModel['week'], routineName: string | null): string[] {
  const sources: string[] = [];
  if (week.sessions.source === 'profile' || week.minutes.source === 'profile')
    sources.push('days and session length from your profile');
  if (week.sessions.source === 'routine' && week.sessions.target)
    sources.push(`days planned in ${routineName ?? 'your routine'}`);
  if (week.sets.source === 'routine')
    sources.push(`sets planned in ${routineName ?? 'your routine'}`);
  return sources;
}

/** The week as seven circles, in the order of the week-start setting (S3.5, S4.2). */
export function WeekStrip({ days, className }: { days: DayStatus[]; className?: string }) {
  return (
    <ol
      className={cn('grid grid-cols-7 gap-1', className)}
      aria-label="This week, day by day"
      data-week-strip
    >
      {days.map((d) => (
        <li key={d.date.toISOString()} className="flex flex-col items-center gap-1.5">
          <span
            aria-hidden
            className={cn('type-caption', d.isToday ? 'font-semibold text-text-1' : 'text-text-2')}
          >
            {shortDayName(d.date.getDay())}
          </span>
          <DayMark day={d} />
          <span className="sr-only">
            {formatLongDay(d.date)}: {d.sessions[0]?.workout.name ?? d.plannedDay?.name ?? 'rest'},{' '}
            {STATE_LABEL[d.state]}
            {d.isToday ? ' (today)' : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** What used to sit on the card: where the targets come from, the legend, the last 7 days. */
function WeekDetails({
  week,
  routineName,
  window: w,
  consistency,
  unit,
  showsPlanned,
}: {
  week: DashboardModel['week'];
  routineName: string | null;
  window: DashboardModel['recentWindow'];
  consistency: DashboardModel['consistency'];
  unit: WeightUnit;
  showsPlanned: boolean;
}) {
  const sources = weekTargetSources(week, routineName);
  const { planned, completed } = w.adherence;
  return (
    <div className="flex flex-col gap-5">
      {sources.length > 0 ? (
        <p className="type-body text-text-2">Targets: {sources.join(', ')}.</p>
      ) : null}
      <div className="type-meta flex flex-wrap gap-x-4 gap-y-2 text-text-2">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-lime" />
          Trained
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full border-[1.5px] border-down/60" />
          Missed
        </span>
        {showsPlanned ? (
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full border-[1.5px] border-text-3" />
            Planned
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full ring-2 ring-text-1" />
          Today
        </span>
      </div>
      <div data-last-7-days>
        <h3 className="type-label text-text-2">
          Last 7 days{planned > 0 ? ` · ${completed} of ${planned} planned` : ''}
        </h3>
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
        <p className="type-meta text-text-2">
          <span className="tabular font-semibold text-text-1">
            {formatNumber(consistency.averagePerWeek)}
          </span>{' '}
          sessions a week over the last {consistency.weeks.length - 1} weeks.
          {consistency.plannedPerWeek ? <> Your plan has {consistency.plannedPerWeek}.</> : null}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Seven 32px circles (UI v3, S3.5). Trained: lime with a black check. Planned: a thin ring.
 * Missed: a faint red ring. Rest: a small dot. Today: a white ring around it.
 */
function DayMark({ day }: { day: DayStatus }) {
  const label = day.sessions[0]?.workout.name ?? day.plannedDay?.name;
  let inner: React.ReactNode;
  switch (day.state) {
    case 'completed':
    case 'extra':
      inner = (
        <span
          className="flex size-8 items-center justify-center rounded-full bg-lime text-on-lime"
          title={label}
        >
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </span>
      );
      break;
    case 'missed':
      inner = (
        <span
          className="flex size-8 items-center justify-center rounded-full border-[1.5px] border-down/60 text-down/80"
          title={`${label} missed`}
        >
          <X className="size-3.5" strokeWidth={2.5} aria-hidden />
        </span>
      );
      break;
    case 'planned':
      inner = (
        <span
          className="block size-8 rounded-full border-[1.5px] border-text-3"
          title={`${label} planned`}
        />
      );
      break;
    default:
      inner = (
        <span className="flex size-8 items-center justify-center" title="Rest day">
          <span className="size-1.5 rounded-full bg-text-3" />
        </span>
      );
  }
  return (
    <span
      className={cn(
        'flex size-9 items-center justify-center rounded-full',
        day.isToday && 'ring-2 ring-text-1',
      )}
    >
      {inner}
    </span>
  );
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
