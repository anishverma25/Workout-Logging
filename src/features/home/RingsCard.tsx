import { Link } from 'react-router';
import { Flame } from 'lucide-react';
import type { DashboardModel } from '@/domain/analytics/dashboard';
import { Rings, RingLegend, type RingSpec } from '@/components/ui/Rings';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';

interface Props {
  week: DashboardModel['week'];
  streak: DashboardModel['streak'];
  routineName: string | null;
  className?: string;
}

/**
 * The week at a glance: sessions, working sets and minutes against the person's own targets.
 * A ring only appears when its target exists, and every ring shows its numbers as text.
 */
export function RingsCard({ week, streak, routineName, className }: Props) {
  const rings: (RingSpec & { unit?: string })[] = [];
  if (week.sessions.target)
    rings.push({
      hue: 1,
      label: 'Sessions',
      value: week.sessions.value,
      target: week.sessions.target,
    });
  if (week.sets.target)
    rings.push({ hue: 2, label: 'Working sets', value: week.sets.value, target: week.sets.target });
  if (week.minutes.target)
    rings.push({
      hue: 3,
      label: 'Minutes',
      value: week.minutes.value,
      target: week.minutes.target,
    });

  const sources: string[] = [];
  if (week.sessions.source === 'profile' || week.minutes.source === 'profile')
    sources.push('days and session length from your profile');
  if (week.sessions.source === 'routine' && week.sessions.target)
    sources.push(`days planned in ${routineName ?? 'your routine'}`);
  if (week.sets.source === 'routine')
    sources.push(`sets planned in ${routineName ?? 'your routine'}`);

  return (
    <section
      aria-labelledby="week-rings-title"
      className={cn('rounded-[var(--radius-card)] bg-surface p-5', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="week-rings-title"
          className="font-display text-[1.3rem] font-semibold leading-tight tracking-tight"
        >
          This week
        </h2>
        {streak.weeks > 0 ? (
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-[var(--seg-track)] px-2.5 text-[0.8125rem] font-semibold">
            <Flame className="size-3.5 text-[var(--ring-2)]" aria-hidden />
            <span className="tabular">{pluralize(streak.weeks, 'week')}</span> in a row
          </span>
        ) : null}
      </div>

      {rings.length > 0 ? (
        <>
          <div className="mt-4 flex items-center gap-6">
            <Rings rings={rings} size={rings.length === 1 ? 108 : 132} />
            <RingLegend rings={rings} className="min-w-0 flex-1" />
          </div>
          <p className="mt-4 text-[0.8125rem] text-faint">Targets: {sources.join(', ')}.</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Set how many days a week you train and this card tracks your week against it.{' '}
          <Link
            to="/setup?next=/"
            className="font-medium text-accent-text underline-offset-4 hover:underline"
          >
            Set a weekly target
          </Link>
        </p>
      )}
    </section>
  );
}
