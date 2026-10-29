import type {
  CustomExerciseInput,
  Exercise,
  Routine,
  RoutineDay,
  RoutineExercise,
} from '@/domain/models/schemas';
import { targetsFromWorkout } from '@/domain/routines/fromWorkout';
import type { SharedExercise, SharedRoutine } from '@/domain/routines/share';
import type { WorkoutDatabase } from '../db';
import { SYSTEM_EXERCISE_KEYS, SYSTEM_EXERCISES, exerciseIdFor } from '../library/exercises';
import { createCustomExercise } from './exercises';
import { defaultTargets, RoutineError } from './routines';
import { newRecordMeta, nowIso, putRecords } from './write';

const alive = <T extends { deletedAt: string | null }>(rows: T[]) =>
  rows.filter((r) => r.deletedAt === null);

const KEY_BY_ID = new Map(SYSTEM_EXERCISES.map((e, i) => [e.id, SYSTEM_EXERCISE_KEYS[i]!]));

/** A routine of this account, ready to put in a link. */
export async function routineToShare(
  db: WorkoutDatabase,
  routineId: string,
): Promise<SharedRoutine> {
  const routine = await db.routines.get(routineId);
  if (!routine || routine.deletedAt !== null) throw new RoutineError('Routine not found.');
  const days = alive(await db.routineDays.where('routineId').equals(routineId).toArray()).sort(
    (a, b) => a.order - b.order,
  );
  if (days.length === 0) throw new RoutineError('Add a day to the routine first.');
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
  const out: SharedRoutine = { v: 1, name: routine.name, days: [] };
  for (const day of days) {
    const slots = alive(
      await db.routineExercises.where('routineDayId').equals(day.id).toArray(),
    ).sort((a, b) => a.order - b.order);
    const shared: SharedExercise[] = [];
    for (const s of slots) {
      const exercise = exercises.get(s.exerciseId);
      if (!exercise || exercise.deletedAt !== null) continue;
      const key = KEY_BY_ID.get(exercise.id);
      shared.push({
        ...(key
          ? { key }
          : {
              custom: {
                name: exercise.name,
                primaryMuscle: exercise.primaryMuscle,
                secondaryMuscles: exercise.secondaryMuscles,
                equipment: exercise.equipment,
                category: exercise.category,
                trackingType: exercise.trackingType,
                loadMode: exercise.loadMode,
              },
            }),
        sets: s.targetSets,
        repMin: s.repMin,
        repMax: s.repMax,
        rir: s.targetRir,
        rest: s.restSeconds,
        angle: s.angleDeg ?? null,
        superset: s.supersetGroup ?? null,
        bySide: s.bySide ?? null,
        notes: s.notes,
      });
    }
    out.days.push({ name: day.name, weekdays: day.weekdays, exercises: shared });
  }
  return out;
}

/** The exercise a shared one stands for in this account, made from its details if needed. */
async function resolveExercise(
  db: WorkoutDatabase,
  e: SharedExercise,
  mine: Exercise[],
): Promise<Exercise | null> {
  if (e.key) {
    const id = exerciseIdFor(e.key);
    // A key this version of the app does not know yet (sent from a newer version).
    return mine.find((x) => x.id === id && x.deletedAt === null) ?? null;
  }
  const c = e.custom!;
  const same = mine.find(
    (x) =>
      x.deletedAt === null &&
      x.name.trim().toLowerCase() === c.name.trim().toLowerCase() &&
      x.equipment === c.equipment,
  );
  if (same) return same;
  // A library exercise with that name: use it rather than make a second one.
  const named = mine.find(
    (x) => x.deletedAt === null && x.name.trim().toLowerCase() === c.name.trim().toLowerCase(),
  );
  if (named) return named;
  const input: CustomExerciseInput = { ...c, instructions: null };
  const made = await createCustomExercise(db, input);
  mine.push(made);
  return made;
}

/**
 * Adds a shared routine to this account as a new routine. Exercises it names that this version
 * of the app does not know are left out and listed. Active only when there is no active routine.
 */
export async function addSharedRoutine(
  db: WorkoutDatabase,
  shared: SharedRoutine,
): Promise<{ routine: Routine; missing: number }> {
  const mine = await db.exercises.toArray();
  const resolved: (Exercise | null)[][] = [];
  for (const day of shared.days) {
    const row: (Exercise | null)[] = [];
    for (const e of day.exercises) row.push(await resolveExercise(db, e, mine));
    resolved.push(row);
  }
  let missing = 0;
  const routine = await db.transaction(
    'rw',
    [db.routines, db.routineDays, db.routineExercises, db.outbox],
    async () => {
      const at = nowIso();
      const hasActive =
        (await db.routines.filter((r) => r.deletedAt === null && r.isActive).count()) > 0;
      const r: Routine = {
        ...newRecordMeta('user', at),
        name: shared.name.trim().slice(0, 60),
        description: null,
        isActive: !hasActive,
      };
      const days: RoutineDay[] = [];
      const slots: RoutineExercise[] = [];
      shared.days.forEach((d, order) => {
        const day: RoutineDay = {
          ...newRecordMeta('user', at),
          routineId: r.id,
          name: d.name.trim().slice(0, 40),
          order,
          weekdays: [...new Set(d.weekdays)].sort(),
        };
        days.push(day);
        let n = 0;
        d.exercises.forEach((e, i) => {
          const exercise = resolved[order]![i];
          if (!exercise) {
            missing += 1;
            return;
          }
          slots.push({
            ...newRecordMeta('user', at),
            routineDayId: day.id,
            exerciseId: exercise.id,
            order: n++,
            targetSets: e.sets,
            repMin: e.repMin,
            repMax: e.repMax,
            targetRir: e.rir,
            restSeconds: e.rest,
            notes: e.notes?.trim() || null,
            supersetGroup: e.superset ?? null,
            angleDeg: e.angle ?? null,
            bySide: e.bySide ?? null,
          });
        });
      });
      await putRecords(db, 'routines', [r]);
      await putRecords(db, 'routineDays', days);
      await putRecords(db, 'routineExercises', slots);
      return r;
    },
  );
  return { routine, missing };
}

export type SaveWorkoutTarget = { kind: 'new'; name: string } | { kind: 'day'; routineId: string };

/**
 * A finished workout as a routine day: the same exercises in the same order, with the sets and
 * reps that were done. Either a new routine of one day, or a new day added to a routine.
 * The workout itself is not changed.
 */
export async function saveWorkoutAsRoutine(
  db: WorkoutDatabase,
  workoutId: string,
  target: SaveWorkoutTarget,
): Promise<{ routine: Routine; day: RoutineDay }> {
  return db.transaction(
    'rw',
    [
      db.workouts,
      db.workoutExercises,
      db.sets,
      db.exercises,
      db.routines,
      db.routineDays,
      db.routineExercises,
      db.outbox,
    ],
    async () => {
      const workout = await db.workouts.get(workoutId);
      if (!workout || workout.deletedAt !== null)
        throw new RoutineError('That workout no longer exists.');
      const wes = alive(
        await db.workoutExercises.where('workoutId').equals(workoutId).toArray(),
      ).sort((a, b) => a.order - b.order);
      const at = nowIso();
      let routine: Routine;
      let order = 0;
      if (target.kind === 'new') {
        const hasActive =
          (await db.routines.filter((r) => r.deletedAt === null && r.isActive).count()) > 0;
        routine = {
          ...newRecordMeta('user', at),
          name: target.name.trim().slice(0, 60) || workout.name.slice(0, 60),
          description: null,
          isActive: !hasActive,
        };
      } else {
        const found = await db.routines.get(target.routineId);
        if (!found || found.deletedAt !== null) throw new RoutineError('Routine not found.');
        routine = found;
        const days = alive(await db.routineDays.where('routineId').equals(found.id).toArray());
        if (days.length >= 7) throw new RoutineError('A routine can have up to 7 days.');
        order = days.length;
      }
      const day: RoutineDay = {
        ...newRecordMeta('user', at),
        routineId: routine.id,
        name: workout.name.trim().slice(0, 40) || 'Day',
        order,
        weekdays: [],
      };
      const slots: RoutineExercise[] = [];
      for (const we of wes) {
        const exercise = await db.exercises.get(we.exerciseId);
        if (!exercise || exercise.deletedAt !== null) continue;
        const sets = await db.sets.where('workoutExerciseId').equals(we.id).toArray();
        const t = targetsFromWorkout(sets, exercise, we.target, defaultTargets(exercise));
        slots.push({
          ...newRecordMeta('user', at),
          routineDayId: day.id,
          exerciseId: exercise.id,
          order: slots.length,
          ...t,
          notes: null,
          supersetGroup: we.supersetGroup ?? null,
          angleDeg: we.angleDeg ?? null,
          bySide: we.bySide ?? null,
        });
      }
      if (slots.length === 0)
        throw new RoutineError('None of the exercises in that workout exist any more.');
      if (target.kind === 'new') await putRecords(db, 'routines', [routine]);
      await putRecords(db, 'routineDays', [day]);
      await putRecords(db, 'routineExercises', slots);
      return { routine, day };
    },
  );
}
