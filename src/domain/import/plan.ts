import type { Exercise } from '@/domain/models/schemas';
import { normalize } from '@/domain/exercises/search';
import type { ImportedLog } from './formats';
import { inferExercise, matchExercise, type InferredExercise } from './match';
import { inferRoutine, type InferredRoutine } from './routine';

/**
 * What an import will do, shown to the person before anything is saved: how many workouts and
 * sets, the dates they cover, and what each exercise becomes in Overload.
 */

export type ExerciseChoice =
  /** Log it under this exercise (from the library, or one the person already has). */
  | { kind: 'existing'; exerciseId: string }
  /** Keep it as the person's own exercise, described as shown. */
  | { kind: 'custom'; exercise: InferredExercise };

export interface ExercisePlan {
  /** The name in the other app. */
  name: string;
  sets: number;
  workouts: number;
  /** The suggestion; the person can change it. */
  choice: ExerciseChoice;
  /** Why: matched in the library, already one of theirs, or new. */
  reason: 'library' | 'yours' | 'new';
}

export interface ImportPlan {
  workouts: number;
  sets: number;
  firstWorkout: Date | null;
  lastWorkout: Date | null;
  bodyEntries: number;
  exercises: ExercisePlan[];
  /** The routine they were following, rebuilt from recent workouts, or null if there is none. */
  routine: InferredRoutine | null;
}

export function planImport(log: ImportedLog, exercises: Exercise[]): ImportPlan {
  const alive = exercises.filter((e) => e.deletedAt === null);
  const library = alive.filter((e) => !e.isCustom);
  const yours = new Map(alive.filter((e) => e.isCustom).map((e) => [normalize(e.name), e]));

  const stats = new Map<
    string,
    {
      sets: number;
      workouts: Set<string>;
      sample: ImportedLog['workouts'][number]['exercises'][number]['sets'];
    }
  >();
  let sets = 0;
  for (const w of log.workouts) {
    for (const ex of w.exercises) {
      const s = stats.get(ex.name) ?? { sets: 0, workouts: new Set<string>(), sample: [] };
      s.sets += ex.sets.length;
      s.workouts.add(w.key);
      s.sample.push(...ex.sets);
      stats.set(ex.name, s);
      sets += ex.sets.length;
    }
  }

  const plans: ExercisePlan[] = [...stats.entries()].map(([name, s]) => {
    const own = yours.get(normalize(name));
    if (own) {
      return {
        name,
        sets: s.sets,
        workouts: s.workouts.size,
        reason: 'yours',
        choice: { kind: 'existing', exerciseId: own.id },
      };
    }
    const hit = matchExercise(name, library);
    if (hit) {
      return {
        name,
        sets: s.sets,
        workouts: s.workouts.size,
        reason: 'library',
        choice: { kind: 'existing', exerciseId: hit.id },
      };
    }
    return {
      name,
      sets: s.sets,
      workouts: s.workouts.size,
      reason: 'new',
      choice: { kind: 'custom', exercise: inferExercise(name, s.sample) },
    };
  });
  // Most-used first: those are the ones worth checking.
  plans.sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name));

  return {
    workouts: log.workouts.length,
    sets,
    firstWorkout: log.workouts[0]?.startedAt ?? null,
    lastWorkout: log.workouts[log.workouts.length - 1]?.startedAt ?? null,
    bodyEntries: log.body.length,
    exercises: plans,
    routine: inferRoutine(log, log.source),
  };
}
