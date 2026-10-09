import type {
  Readiness,
  Exercise,
  SetType,
  TargetSnapshot,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/domain/models/schemas';
import { previousPerformance, type SetSuggestion } from '@/domain/workout/previous';
import { toggleSupersetChanges } from '@/domain/workout/superset';
import type { WorkoutDatabase } from '../db';
import { newRecordMeta, nowIso, patchRecord, patchRecords, putRecords, softDelete } from './write';

/**
 * The active workout lives in IndexedDB from the first tap, so a refresh, a closed tab or a lost
 * connection never loses a set. Every function here writes immediately; there is no unsaved state.
 */

export class WorkoutError extends Error {}

export class ActiveWorkoutExistsError extends WorkoutError {
  constructor(public readonly workoutId: string) {
    super('A workout is already in progress.');
  }
}

const WORKOUT_TABLES = (db: WorkoutDatabase) => [
  db.workouts,
  db.workoutExercises,
  db.sets,
  db.exercises,
  db.routines,
  db.routineDays,
  db.routineExercises,
  db.outbox,
];

const alive = <T extends { deletedAt: string | null }>(rows: T[]) =>
  rows.filter((r) => r.deletedAt === null);

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export async function getActiveWorkout(db: WorkoutDatabase): Promise<Workout | null> {
  const rows = await db.workouts.where('status').equals('in_progress').toArray();
  return alive(rows).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;
}

async function assertNoActiveWorkout(db: WorkoutDatabase) {
  const active = await getActiveWorkout(db);
  if (active) throw new ActiveWorkoutExistsError(active.id);
}

async function exercisesOf(db: WorkoutDatabase, workoutId: string) {
  const rows = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
  return alive(rows).sort((a, b) => a.order - b.order);
}

async function setsOf(db: WorkoutDatabase, workoutExerciseId: string) {
  const rows = await db.sets.where('workoutExerciseId').equals(workoutExerciseId).toArray();
  return alive(rows).sort((a, b) => a.order - b.order);
}

async function renumber<T extends { id: string; order: number }>(
  db: WorkoutDatabase,
  table: 'workoutExercises' | 'sets',
  ordered: T[],
) {
  await patchRecords<WorkoutExercise | WorkoutSet>(
    db,
    table,
    ordered.flatMap((r, i) => (r.order === i ? [] : [{ id: r.id, changes: { order: i } }])),
  );
}

function blankSet(
  workoutId: string,
  workoutExerciseId: string,
  exerciseId: string,
  order: number,
  setType: SetType = 'working',
  at = nowIso(),
): WorkoutSet {
  return {
    ...newRecordMeta('user', at),
    workoutId,
    workoutExerciseId,
    exerciseId,
    order,
    setType,
    weightKg: null,
    reps: null,
    rir: null,
    rpe: null,
    durationSec: null,
    distanceM: null,
    completedAt: null,
    notes: null,
  };
}

/** Default name for a workout started without a routine, by time of day. */
export function emptyWorkoutName(at: Date): string {
  const h = at.getHours();
  if (h < 5) return 'Late night workout';
  if (h < 12) return 'Morning workout';
  if (h < 17) return 'Afternoon workout';
  return 'Evening workout';
}

// Starting

/**
 * Starts a workout from a routine day: its exercises, in order, with the targets copied into the
 * workout. The copy is what makes history immutable: later routine edits never reach it.
 */
export async function startWorkoutFromDay(
  db: WorkoutDatabase,
  dayId: string,
  now: Date = new Date(),
): Promise<Workout> {
  return db.transaction('rw', WORKOUT_TABLES(db), async () => {
    await assertNoActiveWorkout(db);
    const day = await db.routineDays.get(dayId);
    if (!day || day.deletedAt !== null)
      throw new WorkoutError('That routine day no longer exists.');
    const routine = await db.routines.get(day.routineId);
    const slots = alive(
      await db.routineExercises.where('routineDayId').equals(dayId).toArray(),
    ).sort((a, b) => a.order - b.order);
    const found = await db.exercises.bulkGet(slots.map((s) => s.exerciseId));
    const exercises = new Map(alive(found.filter((e): e is Exercise => !!e)).map((e) => [e.id, e]));
    const at = now.toISOString();
    const workout: Workout = {
      ...newRecordMeta('user', at),
      name: day.name,
      routineId: routine && routine.deletedAt === null ? routine.id : null,
      routineDayId: day.id,
      status: 'in_progress',
      startedAt: at,
      endedAt: null,
      pausedAt: null,
      pausedMs: 0,
      notes: null,
      timeZone: timeZone(),
    };
    const workoutExercises: WorkoutExercise[] = [];
    const sets: WorkoutSet[] = [];
    let order = 0;
    for (const slot of slots) {
      const exercise = exercises.get(slot.exerciseId);
      if (!exercise) continue; // deleted custom exercise: skip rather than fail the whole start
      const target: TargetSnapshot = {
        sets: slot.targetSets,
        repMin: slot.repMin,
        repMax: slot.repMax,
        rir: slot.targetRir,
        rest: slot.restSeconds,
      };
      const we: WorkoutExercise = {
        ...newRecordMeta('user', at),
        workoutId: workout.id,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        order: order++,
        notes: slot.notes,
        target,
        supersetGroup: slot.supersetGroup ?? null,
        angleDeg: slot.angleDeg ?? null,
      };
      workoutExercises.push(we);
      for (let i = 0; i < slot.targetSets; i++) {
        sets.push(blankSet(workout.id, we.id, exercise.id, i, 'working', at));
      }
    }
    await putRecords(db, 'workouts', [workout]);
    await putRecords(db, 'workoutExercises', workoutExercises);
    await putRecords(db, 'sets', sets);
    return workout;
  });
}

export async function startEmptyWorkout(
  db: WorkoutDatabase,
  now: Date = new Date(),
): Promise<Workout> {
  return db.transaction('rw', WORKOUT_TABLES(db), async () => {
    await assertNoActiveWorkout(db);
    const at = now.toISOString();
    const workout: Workout = {
      ...newRecordMeta('user', at),
      name: emptyWorkoutName(now),
      routineId: null,
      routineDayId: null,
      status: 'in_progress',
      startedAt: at,
      endedAt: null,
      pausedAt: null,
      pausedMs: 0,
      notes: null,
      timeZone: timeZone(),
    };
    await putRecords(db, 'workouts', [workout]);
    return workout;
  });
}

// Workout-level edits

export async function updateWorkoutDetails(
  db: WorkoutDatabase,
  workoutId: string,
  changes: { name?: string; notes?: string | null },
): Promise<void> {
  const patch: Partial<Workout> = {};
  if (changes.name !== undefined) {
    const name = changes.name.trim();
    if (!name) throw new WorkoutError('Give the workout a name.');
    patch.name = name.slice(0, 60);
  }
  if (changes.notes !== undefined) patch.notes = changes.notes?.trim() || null;
  await patchRecord<Workout>(db, 'workouts', workoutId, patch);
}

/** How the person felt before training, and how hard the session was. Both optional. */
export async function updateWorkoutFeel(
  db: WorkoutDatabase,
  workoutId: string,
  changes: { readiness?: Readiness | null; sessionRpe?: number | null },
): Promise<void> {
  const patch: Partial<Workout> = {};
  if (changes.readiness !== undefined) {
    const r = changes.readiness;
    if (r && [r.sleep, r.energy, r.soreness].some((v) => !Number.isInteger(v) || v < 1 || v > 5))
      throw new WorkoutError('Rate each from 1 to 5.');
    patch.readiness = r;
  }
  if (changes.sessionRpe !== undefined) {
    const v = changes.sessionRpe;
    if (v !== null && !(v >= 1 && v <= 10)) throw new WorkoutError('Rate effort from 1 to 10.');
    patch.sessionRpe = v;
  }
  await db.transaction('rw', [db.workouts, db.outbox], () =>
    patchRecord<Workout>(db, 'workouts', workoutId, patch),
  );
}

export async function pauseWorkout(db: WorkoutDatabase, workoutId: string, now = new Date()) {
  await db.transaction('rw', WORKOUT_TABLES(db), async () => {
    const w = await db.workouts.get(workoutId);
    if (!w || w.status !== 'in_progress' || w.pausedAt) return;
    await patchRecord<Workout>(db, 'workouts', workoutId, { pausedAt: now.toISOString() });
  });
}

export async function resumeWorkout(db: WorkoutDatabase, workoutId: string, now = new Date()) {
  await db.transaction('rw', WORKOUT_TABLES(db), async () => {
    const w = await db.workouts.get(workoutId);
    if (!w || !w.pausedAt) return;
    const paused = Math.max(0, now.getTime() - Date.parse(w.pausedAt));
    await patchRecord<Workout>(db, 'workouts', workoutId, {
      pausedAt: null,
      pausedMs: w.pausedMs + paused,
    });
  });
}

/** Training time so far: wall time minus completed and ongoing pauses. */
export function elapsedMs(workout: Workout, now: Date = new Date()): number {
  const end = workout.endedAt ? Date.parse(workout.endedAt) : now.getTime();
  const ongoing = workout.pausedAt ? Math.max(0, end - Date.parse(workout.pausedAt)) : 0;
  return Math.max(0, end - Date.parse(workout.startedAt) - workout.pausedMs - ongoing);
}

// Exercises in a workout

/** How many sets to add for a new exercise: last time's working set count, or 3. */
async function defaultSetCount(db: WorkoutDatabase, exerciseId: string, before: string) {
  const [workouts, workoutExercises, sets] = await Promise.all([
    db.workouts.where('status').equals('completed').toArray(),
    db.workoutExercises.where('exerciseId').equals(exerciseId).toArray(),
    db.sets.where('exerciseId').equals(exerciseId).toArray(),
  ]);
  const prev = previousPerformance({ workouts, workoutExercises, sets }, exerciseId, before);
  const working = prev?.sets.filter((s) => s.setType !== 'warmup').length ?? 0;
  return working > 0 ? Math.min(working, 6) : 3;
}

export async function addExercisesToWorkout(
  db: WorkoutDatabase,
  workoutId: string,
  exerciseIds: string[],
): Promise<WorkoutExercise[]> {
  if (exerciseIds.length === 0) return [];
  return db.transaction('rw', WORKOUT_TABLES(db), async () => {
    const workout = await db.workouts.get(workoutId);
    if (!workout || workout.deletedAt !== null) throw new WorkoutError('Workout not found.');
    const existing = await exercisesOf(db, workoutId);
    const at = nowIso();
    const added: WorkoutExercise[] = [];
    const sets: WorkoutSet[] = [];
    for (const [i, exerciseId] of exerciseIds.entries()) {
      const exercise = await db.exercises.get(exerciseId);
      if (!exercise || exercise.deletedAt !== null) throw new WorkoutError('Exercise not found.');
      const we: WorkoutExercise = {
        ...newRecordMeta('user', at),
        workoutId,
        exerciseId,
        exerciseName: exercise.name,
        order: existing.length + i,
        notes: null,
        target: null,
      };
      added.push(we);
      const count = await defaultSetCount(db, exerciseId, workout.startedAt);
      for (let n = 0; n < count; n++)
        sets.push(blankSet(workoutId, we.id, exerciseId, n, 'working', at));
    }
    await putRecords(db, 'workoutExercises', added);
    await putRecords(db, 'sets', sets);
    return added;
  });
}

/** Removes an exercise from this workout only. Its sets go with it. */
export async function removeWorkoutExercise(db: WorkoutDatabase, workoutExerciseId: string) {
  await db.transaction('rw', WORKOUT_TABLES(db), async () => {
    const we = await db.workoutExercises.get(workoutExerciseId);
    if (!we || we.deletedAt !== null) return;
    await softDelete(
      db,
      'sets',
      (await setsOf(db, workoutExerciseId)).map((s) => s.id),
    );
    await softDelete(db, 'workoutExercises', [workoutExerciseId]);
    await renumber(db, 'workoutExercises', await exercisesOf(db, we.workoutId));
  });
}

export async function moveWorkoutExercise(
  db: WorkoutDatabase,
  workoutExerciseId: string,
  delta: -1 | 1,
) {
  await db.transaction('rw', WORKOUT_TABLES(db), async () => {
    const we = await db.workoutExercises.get(workoutExerciseId);
    if (!we) return;
    const list = await exercisesOf(db, we.workoutId);
    const from = list.findIndex((x) => x.id === workoutExerciseId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved!);
    await renumber(db, 'workoutExercises', list);
  });
}

/** Moves an exercise to a position in the workout (drag to reorder). */
export async function moveWorkoutExerciseTo(
  db: WorkoutDatabase,
  workoutExerciseId: string,
  toIndex: number,
) {
  await db.transaction('rw', WORKOUT_TABLES(db), async () => {
    const we = await db.workoutExercises.get(workoutExerciseId);
    if (!we) return;
    const list = await exercisesOf(db, we.workoutId);
    const from = list.findIndex((x) => x.id === workoutExerciseId);
    const to = Math.max(0, Math.min(list.length - 1, toIndex));
    if (from < 0 || from === to) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved!);
    await renumber(db, 'workoutExercises', list);
  });
}

/** Bench angle for this exercise in this workout: positive incline, negative decline. */
export async function updateWorkoutExerciseAngle(
  db: WorkoutDatabase,
  workoutExerciseId: string,
  angleDeg: number | null,
): Promise<void> {
  await patchRecord<WorkoutExercise>(db, 'workoutExercises', workoutExerciseId, {
    angleDeg: angleDeg === null ? null : clampAngle(angleDeg),
  });
}

export const clampAngle = (deg: number) => Math.max(-45, Math.min(90, Math.round(deg)));

export async function updateWorkoutExerciseNotes(
  db: WorkoutDatabase,
  workoutExerciseId: string,
  notes: string | null,
) {
  await patchRecord<WorkoutExercise>(db, 'workoutExercises', workoutExerciseId, {
    notes: notes?.trim() || null,
  });
}

// Sets

/** Adds a set at the end. Its weight starts as the set above it, which is usually right. */
export async function addSet(
  db: WorkoutDatabase,
  workoutExerciseId: string,
  setType: SetType = 'working',
): Promise<WorkoutSet> {
  return db.transaction('rw', WORKOUT_TABLES(db), async () => {
    const we = await db.workoutExercises.get(workoutExerciseId);
    if (!we || we.deletedAt !== null) throw new WorkoutError('Exercise not found.');
    const sets = await setsOf(db, workoutExerciseId);
    const set = blankSet(we.workoutId, we.id, we.exerciseId, sets.length, setType);
    await putRecords(db, 'sets', [set]);
    return set;
  });
}

/** Copies a set's values into a new, not yet completed set right below it. */
export async function duplicateSet(db: WorkoutDatabase, setId: string): Promise<WorkoutSet> {
  return db.transaction('rw', WORKOUT_TABLES(db), async () => {
    const source = await db.sets.get(setId);
    if (!source || source.deletedAt !== null) throw new WorkoutError('Set not found.');
    const sets = await setsOf(db, source.workoutExerciseId);
    const copy: WorkoutSet = {
      ...source,
      ...newRecordMeta('user'),
      order: source.order + 1,
      completedAt: null,
    };
    await putRecords(db, 'sets', [copy]);
    const ordered = sets.filter((s) => s.id !== source.id);
    ordered.splice(
      sets.findIndex((s) => s.id === source.id),
      0,
      source,
      copy,
    );
    await renumber(db, 'sets', ordered);
    return copy;
  });
}

export async function deleteSet(db: WorkoutDatabase, setId: string) {
  await db.transaction('rw', WORKOUT_TABLES(db), async () => {
    const set = await db.sets.get(setId);
    if (!set || set.deletedAt !== null) return;
    await softDelete(db, 'sets', [setId]);
    await renumber(db, 'sets', await setsOf(db, set.workoutExerciseId));
  });
}

export type SetPatch = Partial<
  Pick<
    WorkoutSet,
    'weightKg' | 'reps' | 'rir' | 'rpe' | 'durationSec' | 'distanceM' | 'setType' | 'notes'
  >
>;

export async function updateSet(db: WorkoutDatabase, setId: string, patch: SetPatch) {
  const clean: SetPatch = { ...patch };
  if (clean.weightKg !== undefined && clean.weightKg !== null)
    clean.weightKg = clamp(clean.weightKg, 0, 1000);
  if (clean.reps !== undefined && clean.reps !== null) clean.reps = clampInt(clean.reps, 0, 1000);
  if (clean.rir !== undefined && clean.rir !== null) clean.rir = clamp(clean.rir, 0, 10);
  if (clean.rpe !== undefined && clean.rpe !== null) clean.rpe = clamp(clean.rpe, 1, 10);
  if (clean.durationSec !== undefined && clean.durationSec !== null)
    clean.durationSec = clampInt(clean.durationSec, 0, 86_400);
  if (clean.distanceM !== undefined && clean.distanceM !== null)
    clean.distanceM = clamp(clean.distanceM, 0, 1_000_000);
  if (clean.notes !== undefined) clean.notes = clean.notes?.trim() || null;
  await patchRecord<WorkoutSet>(db, 'sets', setId, clean);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clampInt = (v: number, lo: number, hi: number) => Math.round(clamp(v, lo, hi));

export type CompleteResult =
  { ok: true; set: WorkoutSet; alreadyCompleted: boolean } | { ok: false; reason: string };

/** What a set needs before it can be marked done, by tracking type. */
export function missingForCompletion(
  set: Pick<WorkoutSet, 'weightKg' | 'reps' | 'durationSec' | 'distanceM'>,
  exercise: Pick<Exercise, 'trackingType'> | undefined,
): string | null {
  const t = exercise?.trackingType ?? 'weight_reps';
  if (t === 'duration') return set.durationSec ? null : 'Enter the time first.';
  // Distance is optional for cardio (a bike without a display); time is not.
  if (t === 'cardio') return set.durationSec ? null : 'Enter the minutes first.';
  if (t === 'distance') return set.distanceM ? null : 'Enter the distance first.';
  if (t === 'weight_reps' && set.weightKg === null) return 'Enter the weight first.';
  if (!set.reps) return 'Enter the reps first.';
  return null;
}

/**
 * Marks a set done. Empty fields take the suggested values (last time's matching set), which
 * is what makes "tap done" the whole interaction for a repeated set.
 * Idempotent: completing a completed set changes nothing, so a double tap cannot double-log.
 */
export async function completeSet(
  db: WorkoutDatabase,
  setId: string,
  suggestion: SetSuggestion | null = null,
  now: Date = new Date(),
): Promise<CompleteResult> {
  return db.transaction('rw', WORKOUT_TABLES(db), async () => {
    const set = await db.sets.get(setId);
    if (!set || set.deletedAt !== null) return { ok: false as const, reason: 'Set not found.' };
    if (set.completedAt !== null) return { ok: true as const, set, alreadyCompleted: true };
    const exercise = await db.exercises.get(set.exerciseId);
    const filled = {
      weightKg: set.weightKg ?? suggestion?.weightKg ?? null,
      reps: set.reps ?? suggestion?.reps ?? null,
      durationSec: set.durationSec ?? suggestion?.durationSec ?? null,
      distanceM: set.distanceM ?? suggestion?.distanceM ?? null,
    };
    if (exercise?.trackingType === 'bodyweight_reps') filled.weightKg = set.weightKg;
    if (exercise?.trackingType === 'weighted_bodyweight' && filled.weightKg === null)
      filled.weightKg = 0;
    const missing = missingForCompletion(filled, exercise);
    if (missing) return { ok: false as const, reason: missing };
    const saved = await patchRecord<WorkoutSet>(db, 'sets', setId, {
      ...filled,
      completedAt: now.toISOString(),
    });
    return { ok: true as const, set: saved!, alreadyCompleted: false };
  });
}

export async function uncompleteSet(db: WorkoutDatabase, setId: string) {
  await patchRecord<WorkoutSet>(db, 'sets', setId, { completedAt: null });
}

// Finishing

export interface FinishCheck {
  completedSets: number;
  /** Sets with values typed in but not marked done. */
  unconfirmedSets: number;
  /** Sets left completely empty. Removed on finish. */
  emptySets: number;
}

export async function finishCheck(db: WorkoutDatabase, workoutId: string): Promise<FinishCheck> {
  const sets = alive(await db.sets.where('workoutId').equals(workoutId).toArray());
  const completed = sets.filter((s) => s.completedAt !== null);
  const open = sets.filter((s) => s.completedAt === null);
  const hasValues = (s: WorkoutSet) =>
    s.weightKg !== null || s.reps !== null || s.durationSec !== null || s.distanceM !== null;
  return {
    completedSets: completed.length,
    unconfirmedSets: open.filter(hasValues).length,
    emptySets: open.filter((s) => !hasValues(s)).length,
  };
}

/**
 * Ends the workout and turns it into history.
 * - Sets that were never marked done are removed, unless `keepUnconfirmed` marks the ones with
 *   values as done (the user confirms this in the finish dialog).
 * - Exercises left with no completed sets are removed, so history only holds what happened.
 * Idempotent: finishing a finished workout does nothing.
 */
export async function finishWorkout(
  db: WorkoutDatabase,
  workoutId: string,
  options: { keepUnconfirmed?: boolean; now?: Date } = {},
): Promise<Workout> {
  const now = options.now ?? new Date();
  return db.transaction('rw', WORKOUT_TABLES(db), async () => {
    const workout = await db.workouts.get(workoutId);
    if (!workout || workout.deletedAt !== null) throw new WorkoutError('Workout not found.');
    if (workout.status !== 'in_progress') return workout;

    const at = now.toISOString();
    const exercises = await exercisesOf(db, workoutId);
    const exerciseInfo = new Map(
      (await db.exercises.bulkGet(exercises.map((e) => e.exerciseId)))
        .filter((e): e is Exercise => !!e)
        .map((e) => [e.id, e]),
    );
    const toDelete: string[] = [];
    const toComplete: string[] = [];
    let completedCount = 0;
    for (const we of exercises) {
      const sets = await setsOf(db, we.id);
      let kept = 0;
      for (const s of sets) {
        if (s.completedAt !== null) {
          kept++;
        } else if (
          options.keepUnconfirmed &&
          !missingForCompletion(s, exerciseInfo.get(s.exerciseId))
        ) {
          toComplete.push(s.id);
          kept++;
        } else {
          toDelete.push(s.id);
        }
      }
      completedCount += kept;
      if (kept === 0) {
        await softDelete(db, 'workoutExercises', [we.id]);
      }
    }
    if (completedCount === 0) {
      throw new WorkoutError(
        'No sets are marked done yet. Complete a set, or discard the workout.',
      );
    }
    await softDelete(db, 'sets', toDelete);
    await patchRecords<WorkoutSet>(
      db,
      'sets',
      toComplete.map((id) => ({ id, changes: { completedAt: at } })),
    );
    // Renumber what is left so history shows 1, 2, 3 with no gaps.
    const remaining = await exercisesOf(db, workoutId);
    await renumber(db, 'workoutExercises', remaining);
    for (const we of remaining) await renumber(db, 'sets', await setsOf(db, we.id));

    const pausedMs = workout.pausedAt
      ? workout.pausedMs + Math.max(0, now.getTime() - Date.parse(workout.pausedAt))
      : workout.pausedMs;
    const saved = await patchRecord<Workout>(db, 'workouts', workoutId, {
      status: 'completed',
      endedAt: at,
      pausedAt: null,
      pausedMs,
    });
    return saved!;
  });
}

/** Discards an in-progress workout and everything logged in it. */
export async function cancelWorkout(db: WorkoutDatabase, workoutId: string, now = new Date()) {
  await db.transaction('rw', WORKOUT_TABLES(db), async () => {
    const workout = await db.workouts.get(workoutId);
    if (!workout || workout.deletedAt !== null || workout.status !== 'in_progress') return;
    const sets = alive(await db.sets.where('workoutId').equals(workoutId).toArray());
    await softDelete(
      db,
      'sets',
      sets.map((s) => s.id),
    );
    await softDelete(
      db,
      'workoutExercises',
      (await exercisesOf(db, workoutId)).map((e) => e.id),
    );
    await patchRecord<Workout>(db, 'workouts', workoutId, {
      status: 'cancelled',
      endedAt: now.toISOString(),
      deletedAt: now.toISOString(),
    });
  });
}

/** Deletes a logged workout from history (soft delete, so it can sync and be audited). */
export async function deleteWorkout(db: WorkoutDatabase, workoutId: string) {
  await db.transaction('rw', WORKOUT_TABLES(db), async () => {
    const sets = alive(await db.sets.where('workoutId').equals(workoutId).toArray());
    await softDelete(
      db,
      'sets',
      sets.map((s) => s.id),
    );
    await softDelete(
      db,
      'workoutExercises',
      (await exercisesOf(db, workoutId)).map((e) => e.id),
    );
    await softDelete(db, 'workouts', [workoutId]);
  });
}

// Gym-floor tools

/**
 * Puts warm-up sets in front of an exercise's sets, replacing warm-ups that are not done yet.
 * Weights are in kg.
 */
export async function addWarmupSets(
  db: WorkoutDatabase,
  workoutExerciseId: string,
  warmups: { weightKg: number; reps: number }[],
): Promise<void> {
  await db.transaction('rw', WORKOUT_TABLES(db), async () => {
    const we = await db.workoutExercises.get(workoutExerciseId);
    if (!we || we.deletedAt !== null) throw new WorkoutError('Exercise not found.');
    const current = await setsOf(db, workoutExerciseId);
    const stale = current.filter((s) => s.setType === 'warmup' && s.completedAt === null);
    if (stale.length)
      await softDelete(
        db,
        'sets',
        stale.map((s) => s.id),
      );
    const kept = current.filter((s) => !stale.includes(s));
    const fresh = warmups.map((w, i) => ({
      ...blankSet(we.workoutId, we.id, we.exerciseId, i, 'warmup'),
      weightKg: w.weightKg,
      reps: w.reps,
    }));
    await putRecords(db, 'sets', fresh);
    // Done warm-ups stay first, then the new ones, then everything else.
    const doneWarmups = kept.filter((s) => s.setType === 'warmup');
    const rest = kept.filter((s) => s.setType !== 'warmup');
    await renumber(db, 'sets', [...doneWarmups, ...fresh, ...rest]);
  });
}

/**
 * Swaps the exercise of a workout entry that has no completed sets yet (the machine is
 * taken). Its unfinished sets move to the new exercise; history stays with each exercise.
 */
export async function swapWorkoutExercise(
  db: WorkoutDatabase,
  workoutExerciseId: string,
  exerciseId: string,
): Promise<void> {
  await db.transaction('rw', WORKOUT_TABLES(db), async () => {
    const we = await db.workoutExercises.get(workoutExerciseId);
    if (!we || we.deletedAt !== null) throw new WorkoutError('Exercise not found.');
    const exercise = await db.exercises.get(exerciseId);
    if (!exercise || exercise.deletedAt !== null) throw new WorkoutError('Exercise not found.');
    const sets = await setsOf(db, workoutExerciseId);
    if (sets.some((s) => s.completedAt !== null))
      throw new WorkoutError('Sets are already done. Add the new exercise instead.');
    await patchRecord<WorkoutExercise>(db, 'workoutExercises', workoutExerciseId, {
      exerciseId,
      exerciseName: exercise.name,
    });
    // Numbers typed for the old exercise rarely fit the new one.
    await patchRecords<WorkoutSet>(
      db,
      'sets',
      sets.map((s) => ({
        id: s.id,
        changes: { exerciseId, weightKg: null, reps: null, durationSec: null, distanceM: null },
      })),
    );
  });
}

/**
 * Links an exercise with the one after it as a superset (done back to back, resting after the
 * round), or unlinks it. Exercises in a superset share a group number.
 */
export async function toggleSupersetWithNext(
  db: WorkoutDatabase,
  workoutExerciseId: string,
): Promise<void> {
  await db.transaction('rw', WORKOUT_TABLES(db), async () => {
    const we = await db.workoutExercises.get(workoutExerciseId);
    if (!we || we.deletedAt !== null) throw new WorkoutError('Exercise not found.');
    const all = alive(
      await db.workoutExercises.where('workoutId').equals(we.workoutId).toArray(),
    ).sort((a, b) => a.order - b.order);
    const i = all.findIndex((e) => e.id === we.id);
    if (!all[i + 1]) throw new WorkoutError('There is no exercise after this one.');
    await patchRecords<WorkoutExercise>(db, 'workoutExercises', toggleSupersetChanges(all, i));
  });
}

/**
 * Whether to rest after a set: not when the next exercise in the same superset still has a
 * set to do, so the round flows straight on.
 */
export function restAfterSet(
  exerciseId: string,
  exercises: { id: string; order: number; supersetGroup?: number | null; pending: number }[],
): boolean {
  const current = exercises.find((e) => e.id === exerciseId);
  if (!current || current.supersetGroup == null) return true;
  const group = exercises
    .filter((e) => e.supersetGroup === current.supersetGroup)
    .sort((a, b) => a.order - b.order);
  const after = group.filter((e) => e.order > current.order);
  return !after.some((e) => e.pending > 0);
}
