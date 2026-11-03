import type {
  PinnedExerciseNote,
  RoutineExercise,
  Workout,
} from '@/domain/models/schemas';
import type { WorkoutDatabase } from '../db';
import { newRecordMeta, patchRecord, putRecords, softDelete } from './write';

export const PINNED_NOTE_MAX = 500;

/**
 * Notes come in three kinds (November 2026, as in Hevy):
 * - pinned to the exercise: shown every time the person does it (this file);
 * - pinned to the routine: the routine slot's `notes`, shown whenever that routine is done;
 * - for this workout only: the workout exercise's `notes`.
 */
export type NoteKind = 'exercise' | 'routine' | 'workout';

const newest = (a: PinnedExerciseNote, b: PinnedExerciseNote) =>
  b.updatedAt.localeCompare(a.updatedAt);

/** Live notes for an exercise, newest first (two devices may each have made one). */
async function liveNotes(db: WorkoutDatabase, exerciseId: string) {
  return (await db.exerciseNotes.where('exerciseId').equals(exerciseId).toArray())
    .filter((n) => n.deletedAt === null)
    .sort(newest);
}

/** The note pinned to each exercise, by exercise id. */
export async function pinnedNotesByExercise(
  db: WorkoutDatabase,
  exerciseIds: string[],
): Promise<Map<string, PinnedExerciseNote>> {
  const out = new Map<string, PinnedExerciseNote>();
  if (exerciseIds.length === 0) return out;
  const notes = await db.exerciseNotes.where('exerciseId').anyOf(exerciseIds).toArray();
  for (const n of notes.filter((x) => x.deletedAt === null).sort(newest)) {
    if (!out.has(n.exerciseId)) out.set(n.exerciseId, n);
  }
  return out;
}

/**
 * Pins a note to an exercise, replacing the one there. Empty text removes it. Extra copies
 * made on another device are removed too, so one note remains.
 */
export async function setPinnedExerciseNote(
  db: WorkoutDatabase,
  exerciseId: string,
  text: string,
  now: Date = new Date(),
): Promise<void> {
  const note = text.trim().slice(0, PINNED_NOTE_MAX);
  await db.transaction('rw', [db.exerciseNotes, db.outbox], async () => {
    const [current, ...extra] = await liveNotes(db, exerciseId);
    if (extra.length > 0)
      await softDelete(
        db,
        'exerciseNotes',
        extra.map((n) => n.id),
      );
    if (!note) {
      if (current) await softDelete(db, 'exerciseNotes', [current.id]);
      return;
    }
    if (current) {
      if (current.note !== note)
        await patchRecord<PinnedExerciseNote>(db, 'exerciseNotes', current.id, { note });
      return;
    }
    await putRecords(db, 'exerciseNotes', [
      { ...newRecordMeta('user', now.toISOString()), exerciseId, note },
    ]);
  });
}

/**
 * The routine slot a workout exercise came from: the same exercise on the workout's routine
 * day. Null for a workout not started from a routine, or when the day no longer has it.
 */
export async function routineSlotsFor(
  db: WorkoutDatabase,
  workout: Pick<Workout, 'routineDayId'>,
): Promise<Map<string, RoutineExercise>> {
  const out = new Map<string, RoutineExercise>();
  if (!workout.routineDayId) return out;
  const day = await db.routineDays.get(workout.routineDayId);
  if (!day || day.deletedAt !== null) return out;
  const slots = (await db.routineExercises.where('routineDayId').equals(day.id).toArray())
    .filter((s) => s.deletedAt === null)
    .sort((a, b) => a.order - b.order);
  for (const s of slots) if (!out.has(s.exerciseId)) out.set(s.exerciseId, s);
  return out;
}
