import { Trophy } from 'lucide-react';
import { LineChart } from '@/components/charts/LineChart';
import { BottomSheet } from '@/components/kit';
import { useTrainingData } from '@/data/hooks';
import { performanceByExercise } from '@/domain/analytics/performance';
import { formatRecordValue, PR_LABELS } from '@/domain/analytics/prs';
import type { BestSet, ExerciseRecords } from '@/domain/analytics/records';
import { buildSessions } from '@/domain/analytics/sessions';
import { formatDayMonth, formatShortDate } from '@/lib/dates';
import { pluralize } from '@/lib/format';
import { formatWeight, formatWeightValue, toDisplayWeight, type WeightUnit } from '@/lib/units';
import { improvementText } from './format';

interface Props {
  records: ExerciseRecords | null;
  unit: WeightUnit;
  onClose: () => void;
}

export function ExerciseRecordsSheet(props: Props) {
  return props.records ? <Body {...props} records={props.records} /> : null;
}

function Body({ records: r, unit, onClose }: Props & { records: ExerciseRecords }) {
  const training = useTrainingData();
  const e1rmPoints =
    training.data && r.trackingType === 'weight_reps'
      ? (performanceByExercise(buildSessions(training.data)).get(r.exerciseId) ?? [])
          .filter((p) => p.bestE1rm !== null)
          .map((p) => ({ x: p.date.getTime(), y: toDisplayWeight(p.bestE1rm!, unit) }))
      : [];

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={r.name}
      subtitle={`${pluralize(r.sessions, 'session')} logged`}
    >
      <dl className="grid grid-cols-2 gap-3 pt-1">
        {r.heaviest ? (
          <Best
            label={
              r.trackingType === 'weighted_bodyweight' ? 'Heaviest added load' : 'Heaviest lifted'
            }
            value={formatWeight(r.heaviest.value, unit)}
            best={r.heaviest}
            detail={r.heaviest.reps ? `× ${r.heaviest.reps}` : undefined}
          />
        ) : null}
        {r.bestE1rm ? (
          <Best
            label="Estimated 1RM"
            value={formatWeight(r.bestE1rm.value, unit)}
            best={r.bestE1rm}
            detail={`from ${formatWeight(r.bestE1rm.weightKg!, unit)} × ${r.bestE1rm.reps}`}
            estimate
          />
        ) : null}
        {r.mostReps ? (
          <Best label="Most reps" value={`${r.mostReps.value}`} best={r.mostReps} />
        ) : null}
        {r.longestDuration ? (
          <Best
            label="Longest time"
            value={formatRecordValue('duration', r.longestDuration.value, unit)}
            best={r.longestDuration}
          />
        ) : null}
        {r.longestDistance ? (
          <Best
            label="Longest distance"
            value={formatRecordValue('distance', r.longestDistance.value, unit)}
            best={r.longestDistance}
          />
        ) : null}
      </dl>

      {e1rmPoints.length >= 2 ? (
        <section className="mt-8">
          <h3 className="type-title text-text-1">Estimated 1RM by session</h3>
          <p className="type-meta mt-0.5 mb-3 text-text-2">
            Best set each session, sets of 12 reps or fewer. Brzycki up to 5 reps, Epley above.
          </p>
          <LineChart
            label={`Estimated 1RM for ${r.name} by session, in ${unit}`}
            height={180}
            series={[
              {
                id: 'e1rm',
                label: 'Estimated 1RM',
                color: 'var(--chart-1)',
                points: e1rmPoints,
                style: 'both',
              },
            ]}
            formatY={(v) => formatWeightValue(v, 'kg')}
            formatX={(x) => formatDayMonth(new Date(x))}
            formatXLong={(x) => formatShortDate(new Date(x))}
            endLabel
          />
        </section>
      ) : null}

      {r.repsAtLoad.length > 0 ? (
        <section className="mt-8">
          <h3 className="type-title text-text-1">Best reps at each load</h3>
          <p className="type-meta mt-0.5 mb-3 text-text-2">
            Warm-ups excluded. Beat a number here and you have a rep record at that load.
          </p>
          <div className="max-h-64 overflow-auto rounded-nested bg-surface-2">
            <table className="type-body w-full">
              <thead className="type-caption sticky top-0 bg-surface-2 text-left text-text-2">
                <tr className="border-b-[0.5px] border-divider">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Load
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Best reps
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="tabular divide-y-[0.5px] divide-divider">
                {r.repsAtLoad.map((row) => (
                  <tr key={row.weightKg}>
                    <td className="px-4 py-2.5 font-semibold text-text-1">
                      {formatWeight(row.weightKg, unit)}
                    </td>
                    <td className="px-4 py-2.5 text-text-1">{row.reps}</td>
                    <td className="type-meta px-4 py-2.5 text-right text-text-2">
                      {formatShortDate(row.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <h3 className="type-title text-text-1">Record history</h3>
        {r.history.length === 0 ? (
          <p className="type-meta mt-2 flex min-h-22 items-center justify-center rounded-nested bg-surface-2 px-5 py-4 text-center text-text-2">
            No records yet beyond your first session, which is the baseline.
          </p>
        ) : (
          <ol className="mt-2 divide-y-[0.5px] divide-divider">
            {r.history.map((pr) => (
              <li key={pr.id} className="flex min-h-14 items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="type-headline flex items-center gap-2 text-text-1">
                    <Trophy className="size-4 shrink-0 text-text-2" aria-hidden />
                    {PR_LABELS[pr.type]}
                  </span>
                  <span className="type-meta mt-0.5 block text-text-2">
                    {formatShortDate(pr.date)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="type-headline tabular block text-text-1">
                    {formatRecordValue(pr.type, pr.value, unit)}
                  </span>
                  <span className="type-meta tabular mt-0.5 block text-text-2">
                    {improvementText(pr, unit)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </BottomSheet>
  );
}

function Best({
  label,
  value,
  best,
  detail,
  estimate,
}: {
  label: string;
  value: string;
  best: BestSet;
  detail?: string;
  estimate?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-nested bg-surface-2 p-4">
      <dt className="type-meta flex flex-wrap items-center gap-1.5 text-text-2">
        {label}
        {estimate ? (
          <span className="type-caption inline-flex h-5 items-center rounded-full bg-surface px-2 font-semibold text-text-2">
            estimate
          </span>
        ) : null}
      </dt>
      <dd className="type-title tabular mt-1 text-text-1">{value}</dd>
      <dd className="type-meta tabular mt-0.5 text-text-2">
        {detail ? `${detail} · ` : ''}
        {formatShortDate(best.date)}
      </dd>
    </div>
  );
}
