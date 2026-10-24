import { Flame } from 'lucide-react';
import type { DashboardModel } from '@/domain/analytics/dashboard';
import { Rings, RingLegend, type RingSpec } from '@/components/ui/Rings';
import { pluralize } from '@/lib/format';
import { TextLink } from '@/components/kit';

interface Props {
  week: DashboardModel['week'];
  routineName: string | null;
}

/**
 * The week against the person's own targets: sessions, working sets and minutes. A ring only
 * appears when its target exists, and every ring shows its numbers as text. Shown at the top of
 * the Home week card.
 */
export function WeekRings({ week, routineName }: Props) {
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

  return rings.length > 0 ? (
    <div className="mb-5" data-week-rings>
      <div className="flex items-center gap-6">
        <Rings rings={rings} />
        <RingLegend rings={rings} className="min-w-0 flex-1" />
      </div>
      <p className="type-caption mt-3 text-text-2">Targets: {sources.join(', ')}.</p>
    </div>
  ) : (
    <div className="mb-5 flex flex-col items-start gap-2">
      <p className="type-meta text-text-2">
        Set how many days a week you train and this card tracks your week against it.
      </p>
      <TextLink to="/setup?next=/" chevron>
        Set a weekly target
      </TextLink>
    </div>
  );
}

export function StreakPill({ weeks }: { weeks: number }) {
  if (weeks <= 0) return null;
  return (
    <span className="type-caption inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2.5 font-semibold text-text-1">
      <Flame className="size-3.5 text-text-2" aria-hidden />
      <span className="tabular">{pluralize(weeks, 'week')}</span> in a row
    </span>
  );
}
