import { Trophy } from 'lucide-react';
import { LineChart } from '@/components/charts/LineChart';
import { Sheet } from '@/components/ui/Sheet';
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
    <Sheet
      open
      onClose={onClose}
      size="lg"
      title={r.name}
      description={`${pluralize(r.sessions, 'session')} logged`}
    >
      <dl className="grid grid-cols-2 gap-2">
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
        <section className="mt-6">
          <h3 className="font-display text-lg font-semibold">Estimated 1RM by session</h3>
          <p className="mb-2 text-sm text-faint">
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
        <section className="mt-6">
          <h3 className="font-display text-lg font-semibold">Best reps at each load</h3>
          <p className="mb-2 text-sm text-faint">
            Warm-ups excluded. Beat a number here and you have a rep record at that load.
          </p>
          <div className="max-h-64 overflow-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-2 text-left text-xs text-faint">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Load
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Best reps
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-line">
                {r.repsAtLoad.map((row) => (
                  <tr key={row.weightKg}>
                    <td className="px-3 py-2 font-semibold">{formatWeight(row.weightKg, unit)}</td>
                    <td className="px-3 py-2">{row.reps}</td>
                    <td className="px-3 py-2 text-right text-faint">{formatShortDate(row.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <h3 className="font-display text-lg font-semibold">Record history</h3>
        {r.history.length === 0 ? (
          <p className="mt-1 text-sm text-muted">
            No records yet beyond your first session, which is the baseline.
          </p>
        ) : (
          <ol className="mt-2 divide-y divide-line">
            {r.history.map((pr) => (
              <li key={pr.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <Trophy className="size-3.5 text-accent-text" aria-hidden />
                    {PR_LABELS[pr.type]}
                  </span>
                  <span className="text-xs text-faint">{formatShortDate(pr.date)}</span>
                </span>
                <span className="tabular text-right">
                  <span className="block font-display text-lg font-semibold">
                    {formatRecordValue(pr.type, pr.value, unit)}
                  </span>
                  <span className="text-xs text-accent-text">{improvementText(pr, unit)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Sheet>
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
    <div className="rounded-2xl bg-surface-2 p-3.5">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-faint">
        {label}
        {estimate ? (
          <span className="rounded-full border border-line-strong px-1.5 text-[0.65rem]">
            estimate
          </span>
        ) : null}
      </dt>
      <dd className="tabular mt-1 font-display text-[1.3rem] font-bold leading-none">{value}</dd>
      <dd className="mt-1 text-xs text-faint">
        {detail ? `${detail} · ` : ''}
        {formatShortDate(best.date)}
      </dd>
    </div>
  );
}
