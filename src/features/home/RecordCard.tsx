import { Trophy } from 'lucide-react';
import { formatRecordValue, PR_LABELS, type PersonalRecord } from '@/domain/analytics/prs';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/kit';
import { COPY } from '@/domain/analytics/thresholdCopy';
import { formatDate } from '@/lib/format';
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
        <h2 id="record-title" className="type-headline flex items-center gap-2 text-text-1">
          <Trophy className="size-5 text-text-2" aria-hidden />
          Latest record
        </h2>
        {recentCount > 0 ? (
          <span className="type-meta text-text-2">{recentCount} this week</span>
        ) : null}
      </div>

      {record ? (
        <>
          <p className="type-body mt-3 truncate font-medium text-text-1">{record.exerciseName}</p>
          <p className="mt-1 flex items-baseline gap-1">
            <span className="type-stat tabular text-text-1">
              {record.type === 'e1rm' || record.type === 'load'
                ? formatWeightValue(record.value, unit)
                : formatRecordValue(record.type, record.value, unit).split(' ')[0]}
            </span>
            <span className="type-meta text-text-2">
              {record.type === 'e1rm' || record.type === 'load'
                ? unit
                : (formatRecordValue(record.type, record.value, unit).split(' ')[1] ?? '')}
            </span>
          </p>
          <p className="type-meta mt-1 font-semibold text-text-1">{PR_LABELS[record.type]}</p>
          <p className="type-meta mt-auto pt-3 text-text-2">
            {record.type === 'e1rm' && record.weightKg !== null && record.reps !== null
              ? `Estimated from ${formatWeight(record.weightKg, unit)} × ${record.reps}. `
              : null}
            Previous best {formatRecordValue(record.type, record.previousBest, unit)}.{' '}
            {formatDate(record.date)}.
          </p>
        </>
      ) : (
        <EmptyState className="mt-3">{COPY.recordsEmpty}</EmptyState>
      )}
    </Card>
  );
}
