import { Flame } from 'lucide-react';
import type { DashboardModel } from '@/domain/analytics/dashboard';
import { Rings, RingLegend, type RingSpec } from '@/components/ui/Rings';
import { pluralize } from '@/lib/format';
import { TextButton } from '@/components/kit';

type Week = DashboardModel['week'];

/**
 * The week against the person's own targets: sessions, working sets and minutes. A ring only
 * appears when its target exists, and every ring shows its numbers as text beside it.
 */
export function WeekRings({ week }: { week: Week }) {
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

  return rings.length > 0 ? (
    <div className="mb-4 flex items-center gap-5" data-week-rings>
      <Rings rings={rings} size={112} />
      <RingLegend rings={rings} className="min-w-0 flex-1" />
    </div>
  ) : (
    <div className="mb-4 flex flex-col items-start gap-1.5">
      <p className="type-subhead text-text-2">
        Set how many days a week you train and this card tracks your week against it.
      </p>
      <TextButton to="/setup?next=/" small>
        Set a weekly target
      </TextButton>
    </div>
  );
}

export function StreakPill({ weeks }: { weeks: number }) {
  if (weeks <= 0) return null;
  return (
    <span className="type-caption inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-lime-dim px-2.5 font-semibold text-lime">
      <Flame className="size-3.5" aria-hidden />
      <span className="tabular">{pluralize(weeks, 'week')}</span> in a row
    </span>
  );
}
