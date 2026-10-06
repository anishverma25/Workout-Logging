import {
  RoutineTargets,
  type Exercise,
  type Routine,
  type RoutineDay,
  type RoutineExercise,
} from '@/domain/models/schemas';
import type { WorkoutDatabase } from '../db';
import { exerciseIdFor } from '../library/exercises';
import { templateByKey } from '../library/templates';
import { personalizeTemplate, type PlanOptions } from '../library/programs';
import { newRecordMeta, nowIso, patchRecord, patchRecords, putRecords, softDelete } from './write';

/**
 * Routines are plans for future workouts. Nothing in this file reads or writes workouts,
 * so editing, reordering or deleting a routine can never change logged history.
 */

export class RoutineError extends Error {}

const ROUTINE_TABLES = (db: WorkoutDatabase) => [
  db.routines,
  db.routineDays,
  db.routineExercises,
  db.exercises,
  db.outbox,
];

const alive = <T extends { deletedAt: string | null }>(rows: T[]) =>
  rows.filter((r) => r.deletedAt === null);

async function daysOf(db: WorkoutDatabase, routineId: string): Promise<RoutineDay[]> {
  const days = await db.routineDays.where('routineId').equals(routineId).toArray();
  return alive(days).sort((a, b) => a.order - b.order);
}

async function slotsOf(db: WorkoutDatabase, dayId: string): Promise<RoutineExercise[]> {
  const rows = await db.routineExercises.where('routineDayId').equals(dayId).toArray();
  return alive(rows).sort((a, b) => a.order - b.order);
}

/** Rewrites `order` to 0..n-1 for records whose position changed. */
async function renumber(
  db: WorkoutDatabase,
  table: 'routineDays' | 'routineExercises',
  ordered: { id: string; order: number }[],
) {
  await patchRecords<RoutineDay | RoutineExercise>(
    db,
    table,
    ordered.flatMap((r, index) =>
      r.order === index ? [] : [{ id: r.id, changes: { order: index } }],
    ),
  );
}

/** Sensible starting targets for a newly added exercise. Users change them in one tap. */
export function defaultTargets(exercise: Exercise | undefined) {
  if (exercise && exercise.trackingType === 'duration') {
    return { targetSets: 3, repMin: 30, repMax: 60, targetRir: null, restSeconds: 60 };
  }
  if (exercise && exercise.trackingType === 'cardio') {
    // One block of cardio, in minutes.
    return { targetSets: 1, repMin: 20, repMax: 30, targetRir: null, restSeconds: 0 };
  }
  if (exercise && exercise.trackingType === 'distance') {
    return { targetSets: 3, repMin: 20, repMax: 40, targetRir: null, restSeconds: 90 };
  }
  if (exercise?.category === 'compound') {
    return { targetSets: 3, repMin: 6, repMax: 10, targetRir: 2, restSeconds: 150 };
  }
  return { targetSets: 3, repMin: 10, repMax: 15, targetRir: 1, restSeconds: 90 };
}

// Routines

export async function createRoutineFromTemplate(
  db: WorkoutDatabase,
  templateKey: string,
  name?: string,
  /** Fit the template to a person's goal, experience, equipment and session length. */
  personalize?: PlanOptions,
): Promise<Routine> {
  const base = templateByKey(templateKey);
  if (!base) throw new RoutineError('Unknown template.');
  const template = personalize ? personalizeTemplate(base, personalize) : base;
  return db.transaction('rw', ROUTINE_TABLES(db), async () => {
    const hasActive =
      (await db.routines.filter((r) => r.deletedAt === null && r.isActive).count()) > 0;
    const at = nowIso();
    const routine: Routine = {
      ...newRecordMeta('user', at),
      name: (name ?? template.name).trim() || template.name,
      description: personalize ? 'Fitted to your goal, experience and equipment.' : null,
      isActive: !hasActive,
    };
    const days: RoutineDay[] = [];
    const slots: RoutineExercise[] = [];
    template.days.forEach((d, order) => {
      const day: RoutineDay = {
        ...newRecordMeta('user', at),
        routineId: routine.id,
        name: d.name,
        order,
        weekdays: d.weekdays,
      };
      days.push(day);
      d.exercises.forEach((e, exOrder) => {
        slots.push({
          ...newRecordMeta('user', at),
          routineDayId: day.id,
          exerciseId: exerciseIdFor(e.key),
          order: exOrder,
          targetSets: e.sets,
          repMin: e.repMin,
          repMax: e.repMax,
          targetRir: e.rir,
          restSeconds: e.rest,
          notes: null,
        });
      });
    });
    const known = new Set((await db.exercises.toArray()).map((e) => e.id));
    const missing = slots.find((s) => !known.has(s.exerciseId));
    if (missing)
      throw new RoutineError('The template uses an exercise that is not in the library.');
    await putRecords(db, 'routines', [routine]);
    await putRecords(db, 'routineDays', days);
    await putRecords(db, 'routineExercises', slots);
    return routine;
  });
}

export async function updateRoutine(
  db: WorkoutDatabase,
  id: string,
  changes: { name?: string; description?: string | null },
): Promise<void> {
  const patch: Partial<Routine> = {};
  if (changes.name !== undefined) {
    const name = changes.name.trim();
    if (!name) throw new RoutineError('Give the routine a name.');
    if (name.length > 60) throw new RoutineError('Keep the name under 60 characters.');
    patch.name = name;
  }
  if (changes.description !== undefined) patch.description = changes.description?.trim() || null;
  await patchRecord<Routine>(db, 'routines', id, patch);
}

/** Exactly one routine is active: it decides what Home suggests and what adherence measures. */
export async function setActiveRoutine(db: WorkoutDatabase, id: string): Promise<void> {
  await db.transaction('rw', ROUTINE_TABLES(db), async () => {
    const routines = alive(await db.routines.toArray());
    await patchRecords<Routine>(
      db,
      'routines',
      routines
        .filter((r) => r.isActive !== (r.id === id))
        .map((r) => ({ id: r.id, changes: { isActive: r.id === id } })),
    );
  });
}

export async function duplicateRoutine(db: WorkoutDatabase, id: string): Promise<Routine> {
  return db.transaction('rw', ROUTINE_TABLES(db), async () => {
    const source = await db.routines.get(id);
    if (!source || source.deletedAt !== null) throw new RoutineError('Routine not found.');
    const at = nowIso();
    const routine: Routine = {
      ...source,
      ...newRecordMeta('user', at),
      name: copyName(source.name),
      isActive: false,
    };
    const days: RoutineDay[] = [];
    const slots: RoutineExercise[] = [];
    for (const day of await daysOf(db, id)) {
      const copy: RoutineDay = { ...day, ...newRecordMeta('user', at), routineId: routine.id };
      days.push(copy);
      for (const slot of await slotsOf(db, day.id)) {
        slots.push({ ...slot, ...newRecordMeta('user', at), routineDayId: copy.id });
      }
    }
    await putRecords(db, 'routines', [routine]);
    await putRecords(db, 'routineDays', days);
    await putRecords(db, 'routineExercises', slots);
    return routine;
  });
}

function copyName(name: string): string {
  const base = name.length > 52 ? name.slice(0, 52).trimEnd() : name;
  return `${base} (copy)`;
}

/** Deletes the plan. Workouts already logged from it stay exactly as they are. */
export async function deleteRoutine(db: WorkoutDatabase, id: string): Promise<void> {
  await db.transaction('rw', ROUTINE_TABLES(db), async () => {
    const routine = await db.routines.get(id);
    if (!routine || routine.deletedAt !== null) return;
    const days = await daysOf(db, id);
    const slotIds: string[] = [];
    for (const d of days) slotIds.push(...(await slotsOf(db, d.id)).map((s) => s.id));
    await softDelete(db, 'routineExercises', slotIds);
    await softDelete(
      db,
      'routineDays',
      days.map((d) => d.id),
    );
    await softDelete(db, 'routines', [id]);
    if (routine.isActive) {
      const next = alive(await db.routines.toArray()).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      )[0];
      if (next) await patchRecord<Routine>(db, 'routines', next.id, { isActive: true });
    }
  });
}

// Days

export async function addDay(
  db: WorkoutDatabase,
  routineId: string,
  name?: string,
): Promise<RoutineDay> {
  return db.transaction('rw', ROUTINE_TABLES(db), async () => {
    const days = await daysOf(db, routineId);
    if (days.length >= 7) throw new RoutineError('A routine can have up to 7 days.');
    const day: RoutineDay = {
      ...newRecordMeta('user'),
      routineId,
      name: name?.trim() || `Day ${days.length + 1}`,
      order: days.length,
      weekdays: [],
    };
    await putRecords(db, 'routineDays', [day]);
    return day;
  });
}

export async function renameDay(db: WorkoutDatabase, dayId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new RoutineError('Give the day a name.');
  if (trimmed.length > 40) throw new RoutineError('Keep the day name under 40 characters.');
  await patchRecord<RoutineDay>(db, 'routineDays', dayId, { name: trimmed });
}

/**
 * Sets the weekdays a day is planned on. A weekday belongs to one day per routine,
 * so taking a weekday here removes it from the routine's other days.
 */
export async function setDayWeekdays(
  db: WorkoutDatabase,
  dayId: string,
  weekdays: number[],
): Promise<void> {
  await db.transaction('rw', ROUTINE_TABLES(db), async () => {
    const day = await db.routineDays.get(dayId);
    if (!day) return;
    const wanted = [...new Set(weekdays)].filter((w) => w >= 0 && w <= 6).sort();
    for (const other of await daysOf(db, day.routineId)) {
      if (other.id === dayId) continue;
      const kept = other.weekdays.filter((w) => !wanted.includes(w));
      if (kept.length !== other.weekdays.length) {
        await patchRecord<RoutineDay>(db, 'routineDays', other.id, { weekdays: kept });
      }
    }
    await patchRecord<RoutineDay>(db, 'routineDays', dayId, { weekdays: wanted });
  });
}

export async function moveDay(db: WorkoutDatabase, dayId: string, delta: -1 | 1): Promise<void> {
  await db.transaction('rw', ROUTINE_TABLES(db), async () => {
    const day = await db.routineDays.get(dayId);
    if (!day) return;
    const days = await daysOf(db, day.routineId);
    const from = days.findIndex((d) => d.id === dayId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= days.length) return;
    const [moved] = days.splice(from, 1);
    days.splice(to, 0, moved!);
    await renumber(db, 'routineDays', days);
  });
}

export async function deleteDay(db: WorkoutDatabase, dayId: string): Promise<void> {
  await db.transaction('rw', ROUTINE_TABLES(db), async () => {
    const day = await db.routineDays.get(dayId);
    if (!day || day.deletedAt !== null) return;
    await softDelete(
      db,
      'routineExercises',
      (await slotsOf(db, dayId)).map((s) => s.id),
    );
    await softDelete(db, 'routineDays', [dayId]);
    await renumber(db, 'routineDays', await daysOf(db, day.routineId));
  });
}

/** Copies a day (with its exercises) right after itself. Weekdays are not copied. */
export async function duplicateDay(db: WorkoutDatabase, dayId: string): Promise<RoutineDay> {
  return db.transaction('rw', ROUTINE_TABLES(db), async () => {
    const day = await db.routineDays.get(dayId);
    if (!day || day.deletedAt !== null) throw new RoutineError('Day not found.');
    const days = await daysOf(db, day.routineId);
    if (days.length >= 7) throw new RoutineError('A routine can have up to 7 days.');
    const at = nowIso();
    const copy: RoutineDay = {
      ...day,
      ...newRecordMeta('user', at),
      name: `${day.name.slice(0, 33)} (copy)`,
      weekdays: [],
      order: day.order + 1,
    };
    const slots = (await slotsOf(db, dayId)).map((s) => ({
      ...s,
      ...newRecordMeta('user', at),
      routineDayId: copy.id,
    }));
    await putRecords(db, 'routineDays', [copy]);
    await putRecords(db, 'routineExercises', slots);
    const ordered = days.filter((d) => d.id !== dayId);
    ordered.splice(
      days.findIndex((d) => d.id === dayId),
      0,
      day,
      copy,
    );
    await renumber(db, 'routineDays', ordered);
    return copy;
  });
}

// Exercises within a day

export async function addExercisesToDay(
  db: WorkoutDatabase,
  dayId: string,
  exerciseIds: string[],
): Promise<RoutineExercise[]> {
  if (exerciseIds.length === 0) return [];
  return db.transaction('rw', ROUTINE_TABLES(db), async () => {
    const existing = await slotsOf(db, dayId);
    const exercises = await db.exercises.bulkGet(exerciseIds);
    const at = nowIso();
    const slots = exerciseIds.map((exerciseId, i) => {
      const exercise = exercises[i];
      if (!exercise || exercise.deletedAt !== null) throw new RoutineError('Exercise not found.');
      return {
        ...newRecordMeta('user', at),
        routineDayId: dayId,
        exerciseId,
        order: existing.length + i,
        ...defaultTargets(exercise),
        notes: null,
      } satisfies RoutineExercise;
    });
    await putRecords(db, 'routineExercises', slots);
    return slots;
  });
}

export async function updateTargets(
  db: WorkoutDatabase,
  slotId: string,
  targets: RoutineTargets,
): Promise<void> {
  const parsed = RoutineTargets.parse(targets);
  await patchRecord<RoutineExercise>(db, 'routineExercises', slotId, {
    ...parsed,
    notes: parsed.notes?.trim() || null,
  });
}

/** Replaces the exercise in a slot and keeps its targets. */
export async function swapExercise(
  db: WorkoutDatabase,
  slotId: string,
  exerciseId: string,
): Promise<void> {
  const exercise = await db.exercises.get(exerciseId);
  if (!exercise || exercise.deletedAt !== null) throw new RoutineError('Exercise not found.');
  await patchRecord<RoutineExercise>(db, 'routineExercises', slotId, { exerciseId });
}

export async function moveExercise(
  db: WorkoutDatabase,
  slotId: string,
  delta: -1 | 1,
): Promise<void> {
  await db.transaction('rw', ROUTINE_TABLES(db), async () => {
    const slot = await db.routineExercises.get(slotId);
    if (!slot) return;
    const slots = await slotsOf(db, slot.routineDayId);
    const from = slots.findIndex((s) => s.id === slotId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= slots.length) return;
    const [moved] = slots.splice(from, 1);
    slots.splice(to, 0, moved!);
    await renumber(db, 'routineExercises', slots);
  });
}

export async function removeExercise(db: WorkoutDatabase, slotId: string): Promise<void> {
  await db.transaction('rw', ROUTINE_TABLES(db), async () => {
    const slot = await db.routineExercises.get(slotId);
    if (!slot || slot.deletedAt !== null) return;
    await softDelete(db, 'routineExercises', [slotId]);
    await renumber(db, 'routineExercises', await slotsOf(db, slot.routineDayId));
  });
}
