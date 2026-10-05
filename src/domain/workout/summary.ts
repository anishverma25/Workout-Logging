import type { Exercise } from '../models/schemas';
import { performanceFor } from '../analytics/performance';
import { detectPersonalRecords, type PersonalRecord } from '../analytics/prs';
import {
  buildSessions,
  isWorkingSet,
  sessionDurationMinutes,
  type Session,
  type SessionExercise,
  type TrainingData,
} from '../analytics/sessions';
import { sessionVolumeLoad, setVolumeLoad } from '../analytics/volume';

export type ExerciseChange =
  | {
      kind: 'e1rm';
      /** Best estimated 1RM today and in the previous session, kg. */
      today: number;
      previous: number;
      change: number;
      previousDate: Date;
    }
  | { kind: 'reps'; today: number; previous: number; change: number; previousDate: Date }
  | { kind: 'first' };

export interface ExerciseSummary {
  exerciseId: string;
  name: string;
  workingSets: number;
  volumeKg: number;
  /** Not set for exercises without a comparable metric (timed, distance, no eligible sets). */
  change: ExerciseChange | null;
  prs: PersonalRecord[];
}

export interface WorkoutSummary {
  session: Session;
  minutes: number | null;
  exercises: ExerciseSummary[];
  workingSets: number;
  warmupSets: number;
  volumeKg: number;
  prs: PersonalRecord[];
  /** Same routine day last time, only when both sessions have volume. */
  volumeVsLast: { previousKg: number; change: number; previousDate: Date } | null;
}

function previousSessionWith(sessions: Session[], before: Session, exerciseId: string) {
  for (let i = sessions.indexOf(before) - 1; i >= 0; i--) {
    const s = sessions[i]!;
    const ex = s.exercises.find(
      (e) => e.workoutExercise.exerciseId === exerciseId && e.sets.some(isWorkingSet),
    );
    if (ex) return { session: s, exercise: ex };
  }
  return null;
}

function changeFor(
  current: SessionExercise,
  session: Session,
  sessions: Session[],
): ExerciseChange | null {
  const exercise: Exercise | undefined = current.exercise;
  const id = current.workoutExercise.exerciseId;
  const prev = previousSessionWith(sessions, session, id);
  const today = performanceFor(exercise, id, session.workout.id, session.date, current.sets);
  const comparable =
    exercise?.trackingType === 'weight_reps'
      ? today.bestE1rm !== null
      : exercise?.trackingType === 'bodyweight_reps'
        ? today.mostReps !== null
        : false;
  if (!comparable) return null;
  if (!prev) return { kind: 'first' };
  const before = performanceFor(
    exercise,
    id,
    prev.session.workout.id,
    prev.session.date,
    prev.exercise.sets,
  );
  if (exercise?.trackingType === 'weight_reps') {
    if (before.bestE1rm === null || today.bestE1rm === null) return null;
    return {
      kind: 'e1rm',
      today: today.bestE1rm,
      previous: before.bestE1rm,
      change: (today.bestE1rm - before.bestE1rm) / before.bestE1rm,
      previousDate: prev.session.date,
    };
  }
  if (before.mostReps === null || today.mostReps === null) return null;
  return {
    kind: 'reps',
    today: today.mostReps,
    previous: before.mostReps,
    change: (today.mostReps - before.mostReps) / before.mostReps,
    previousDate: prev.session.date,
  };
}

/**
 * Everything the post-workout summary shows, derived from the logged sets.
 * Comparisons use the same metric on both sides and are left out when there is nothing
 * honest to compare: a first-ever session, a timed exercise, or no load-eligible sets.
 */
export function summarizeWorkout(data: TrainingData, workoutId: string): WorkoutSummary | null {
  const sessions = buildSessions(data);
  const session = sessions.find((s) => s.workout.id === workoutId);
  if (!session) return null;
  const allPrs = detectPersonalRecords(sessions, data.exercises).filter(
    (p) => p.workoutId === workoutId,
  );

  const exercises: ExerciseSummary[] = session.exercises
    .filter((e) => e.sets.some((s) => s.completedAt !== null))
    .map((e) => ({
      exerciseId: e.workoutExercise.exerciseId,
      name: e.workoutExercise.exerciseName,
      workingSets: e.sets.filter(isWorkingSet).length,
      volumeKg: e.sets.reduce((sum, s) => sum + setVolumeLoad(s, e.exercise), 0),
      change: changeFor(e, session, sessions),
      prs: allPrs.filter((p) => p.exerciseId === e.workoutExercise.exerciseId),
    }));

  const volumeKg = sessionVolumeLoad(session);
  let volumeVsLast: WorkoutSummary['volumeVsLast'] = null;
  const dayId = session.workout.routineDayId;
  if (dayId && volumeKg > 0) {
    const index = sessions.indexOf(session);
    const previous = sessions
      .slice(0, index)
      .reverse()
      .find((s) => s.workout.routineDayId === dayId);
    const previousKg = previous ? sessionVolumeLoad(previous) : 0;
    if (previous && previousKg > 0) {
      volumeVsLast = {
        previousKg,
        change: (volumeKg - previousKg) / previousKg,
        previousDate: previous.date,
      };
    }
  }

  return {
    session,
    minutes: sessionDurationMinutes(session),
    exercises,
    workingSets: exercises.reduce((n, e) => n + e.workingSets, 0),
    warmupSets: session.exercises.reduce(
      (n, e) => n + e.sets.filter((s) => s.completedAt !== null && s.setType === 'warmup').length,
      0,
    ),
    volumeKg,
    prs: allPrs,
    volumeVsLast,
  };
}
