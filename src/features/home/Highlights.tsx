import { Link } from 'react-router';
import { ChevronRight, Target, Trophy } from 'lucide-react';
import { useFeature } from '@/app/entitlement';
import { TextButton } from '@/components/kit';
import type { WeeklyCheckin } from '@/domain/analytics/checkin';
import { formatRecordValue, PR_LABELS, type PersonalRecord } from '@/domain/analytics/prs';
import { formatDate } from '@/lib/format';
import type { WeightUnit } from '@/lib/units';

/**
 * One or two things worth knowing today (UI v3, S3.7): the latest record and this week's focus
 * from the check-in, each a row that opens the page with the detail.
 */
export function Highlights({
  record,
  recentCount,
  checkin,
  unit,
  className,
}: {
  record: PersonalRecord | null;
  recentCount: number;
  checkin: WeeklyCheckin | null;
  unit: WeightUnit;
  className?: string;
}) {
  const checkinIncluded = useFeature('weekly_checkin');
  const focus = checkin && checkinIncluded ? checkin.focus.text : null;
  if (!record && !focus) return null;
  return (
    <section className={className} aria-labelledby="highlights-title">
      <div className="mb-2 flex min-h-8 items-center justify-between gap-3">
        <h2 id="highlights-title" className="type-section text-text-1">
          Highlights
        </h2>
        <TextButton to="/progress">See all</TextButton>
      </div>
      <ul className="divide-y-[0.5px] divide-divider rounded-card bg-surface px-4">
        {record ? (
          <li>
            <Link
              to="/records"
              className="pressable chrome flex items-center gap-3 py-3"
              data-home-record
            >
              <span className="flex size-[1.875rem] shrink-0 items-center justify-center rounded-[0.5rem] bg-gold-dim text-gold">
                <Trophy className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="type-headline block text-text-1">
                  {record.exerciseName}, {formatRecordValue(record.type, record.value, unit)}
                </span>
                <span className="type-subhead block truncate text-text-2">
                  {PR_LABELS[record.type]} · {formatDate(record.date)}
                </span>
              </span>
              {recentCount > 1 ? (
                <span className="type-meta shrink-0 text-text-2">{recentCount} this week</span>
              ) : null}
              <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />
            </Link>
          </li>
        ) : null}
        {focus ? (
          <li>
            <Link to="/progress" className="pressable chrome flex items-center gap-3 py-3">
              <span className="flex size-[1.875rem] shrink-0 items-center justify-center rounded-[0.5rem] bg-fill text-text-1">
                <Target className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="type-headline block text-text-1">This week</span>
                <span className="type-subhead block text-text-2">{focus}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
