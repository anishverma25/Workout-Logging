import { Link } from 'react-router';
import { Trophy } from 'lucide-react';
import type { RecentWorkout } from '@/domain/analytics/dashboard';
import { Card, SectionHeader } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { formatRelativeDay } from '@/lib/dates';
import { formatCompact, formatDurationMinutes } from '@/lib/format';
import { toDisplayWeight, type WeightUnit } from '@/lib/units';

export function RecentActivity({
  items,
  unit,
  className,
}: {
  items: RecentWorkout[];
  unit: WeightUnit;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <Card className={cn('p-5', className)} aria-labelledby="recent-title">
      <SectionHeader
        id="recent-title"
        title="Recent workouts"
        action={{ label: 'History', to: '/history' }}
      />
      <ul className="divide-y divide-line">
        {items.map(({ session, minutes, workingSets, volumeKg, prCount }) => (
          <li key={session.workout.id}>
            <Link
              to="/history"
              className="-mx-2 flex items-center gap-4 rounded-xl px-2 py-3 transition-colors hover:bg-surface-2"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-3 font-display text-lg font-bold">
                {session.workout.name.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold">{session.workout.name}</span>
                  {prCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-text">
                      <Trophy className="size-3.5" aria-hidden />
                      {prCount} {prCount === 1 ? 'PR' : 'PRs'}
                    </span>
                  ) : null}
                </span>
                <span className="tabular mt-0.5 block text-sm text-faint">
                  {[
                    minutes !== null ? formatDurationMinutes(minutes) : null,
                    `${workingSets} sets`,
                    volumeKg > 0
                      ? `${formatCompact(toDisplayWeight(volumeKg, unit))} ${unit}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </span>
              <span className="shrink-0 text-sm text-muted">{formatRelativeDay(session.date)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
