import { Trophy } from 'lucide-react';
import { formatRecordValue, PR_LABELS, type PersonalRecord } from '@/domain/analytics/prs';
import { Card } from '@/components/ui/Card';
import { formatRelativeDay } from '@/lib/dates';
import { formatWeight, formatWeightValue, type WeightUnit } from '@/lib/units';

interface RecordCardProps {
  record: PersonalRecord | null;
  recentCount: number;
  unit: WeightUnit;
}

export function RecordCard({ record, recentCount, unit }: RecordCardProps) {
  return (
    <Card className="flex flex-col p-5" aria-labelledby="record-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="record-title" className="flex items-center gap-2 text-sm font-medium text-muted">
          <Trophy className="size-4 text-accent-text" aria-hidden />
          Latest record
        </h2>
        {recentCount > 0 ? (
          <span className="text-xs text-faint">{recentCount} this week</span>
        ) : null}
      </div>

      {record ? (
        <>
          <p className="mt-3 truncate font-semibold">{record.exerciseName}</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="tabular font-display text-[1.75rem] font-bold leading-none">
              {record.type === 'e1rm' || record.type === 'load'
                ? formatWeightValue(record.value, unit)
                : formatRecordValue(record.type, record.value, unit).split(' ')[0]}
            </span>
            <span className="text-muted">
              {record.type === 'e1rm' || record.type === 'load'
                ? unit
                : (formatRecordValue(record.type, record.value, unit).split(' ')[1] ?? '')}
            </span>
          </p>
          <p className="mt-2 text-sm font-medium text-accent-text">{PR_LABELS[record.type]}</p>
          <p className="mt-auto pt-3 text-sm text-faint">
            {record.type === 'e1rm' && record.weightKg !== null && record.reps !== null
              ? `Estimated from ${formatWeight(record.weightKg, unit)} × ${record.reps}. `
              : null}
            Previous best {formatRecordValue(record.type, record.previousBest, unit)}.{' '}
            {formatRelativeDay(record.date)}.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Records show up when you beat an earlier best: heaviest load, estimated 1RM, or most reps
          on bodyweight moves.
        </p>
      )}
    </Card>
  );
}
