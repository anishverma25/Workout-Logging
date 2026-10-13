import { useId } from 'react';
import { Card } from '@/components/kit';
import {
  COMPOUND_SHORT,
  ISOLATION_SHORT,
  formatRest,
  restAnalysis,
  workoutRest,
} from '@/domain/analytics/rest';
import type { Session, SessionExercise } from '@/domain/analytics/sessions';
import { EvidenceLink } from '../science/EvidenceLink';

const ALL_TIME: [Date, Date] = [new Date(0), new Date(8.64e15)];

/**
 * Rest taken in one workout: the typical rest between sets and between exercises, the total,
 * and how it compares with the evidence for compound and isolation lifts.
 */
export function RestCard({
  exercises,
  minutes,
  className,
}: {
  exercises: Pick<SessionExercise, 'exercise' | 'sets'>[];
  /** Workout length, for the share of it spent resting. */
  minutes: number | null;
  className?: string;
}) {
  const id = useId();
  const sets = exercises.flatMap((e) => e.sets);
  const rest = workoutRest(sets);
  const timed = rest.betweenSets.count + rest.betweenExercises.count;
  if (timed < 2 || rest.timedShare < 0.5) return null;

  const session = {
    workout: {} as Session['workout'],
    date: new Date(1),
    exercises: exercises.map((e) => ({ ...e, workoutExercise: {} as never })),
  } as Session;
  const byType = restAnalysis([session], ...ALL_TIME);
  const lines: string[] = [];
  if (byType.compound.median !== null && byType.compound.count >= 2) {
    lines.push(
      byType.compound.median < COMPOUND_SHORT
        ? `Compound lifts: ${formatRest(byType.compound.median)} between sets. Studies favour 2 to 3 minutes on these: you keep more reps on the next set and build more over time.`
        : `Compound lifts: ${formatRest(byType.compound.median)} between sets, in the range that keeps your reps up.`,
    );
  }
  if (byType.isolation.median !== null && byType.isolation.count >= 2) {
    lines.push(
      byType.isolation.median < ISOLATION_SHORT
        ? `Isolation lifts: ${formatRest(byType.isolation.median)}. Resting at least a minute grows slightly more muscle.`
        : `Isolation lifts: ${formatRest(byType.isolation.median)}, enough for these.`,
    );
  }
  const share =
    minutes && minutes > 0 ? Math.round((rest.totalSeconds / 60 / minutes) * 100) : null;

  return (
    <Card as="section" aria-labelledby={id} className={className}>
      <div className="flex items-center gap-2">
        <h2 id={id} className="type-title text-text-1">
          Rest
        </h2>
        <EvidenceLink topic="rest-analysis" about="rest" />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        <div className="min-w-0">
          <dt className="type-meta text-text-2">Between sets</dt>
          <dd className="type-headline tabular mt-0.5 text-text-1">
            {rest.betweenSets.median !== null ? formatRest(rest.betweenSets.median) : 'None'}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="type-meta text-text-2">Between exercises</dt>
          <dd className="type-headline tabular mt-0.5 text-text-1">
            {rest.betweenExercises.median !== null
              ? formatRest(rest.betweenExercises.median)
              : 'None'}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="type-meta text-text-2">Total</dt>
          <dd className="type-headline tabular mt-0.5 text-text-1">
            {Math.round(rest.totalSeconds / 60)} min
            {share !== null && share <= 100 ? (
              <span className="type-meta text-text-2"> · {share}%</span>
            ) : null}
          </dd>
        </div>
      </dl>
      {lines.length > 0 ? (
        <ul className="type-body mt-3 flex flex-col gap-1.5 text-text-1">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : null}
      <p className="type-meta mt-3 text-text-2">
        Typical values, measured from when you ticked off each set, less the time the set took.
      </p>
    </Card>
  );
}
