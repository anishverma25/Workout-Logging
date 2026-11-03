import { db } from '@/data/db';
import { setPinnedExerciseNote, type NoteKind } from '@/data/repositories/exerciseNotes';
import { setSlotNote } from '@/data/repositories/routines';
import { updateWorkoutExerciseNotes } from '@/data/repositories/workouts';

export interface NoteTargets {
  exerciseId: string;
  exerciseName: string;
  workoutExerciseId: string;
  /** The routine slot this exercise came from; null when not from a routine. */
  slotId: string | null;
  routineName: string | null;
  /** What each kind holds now. */
  current: Record<NoteKind, string>;
}

export const KIND_LABEL: Record<NoteKind, string> = {
  exercise: 'Every time',
  routine: 'This routine',
  workout: 'Today only',
};

export const KIND_HINT = (t: NoteTargets): Record<NoteKind, string> => ({
  exercise: `Shows every time you do ${t.exerciseName}, in any workout or routine.`,
  routine: `Shows whenever you do ${t.routineName ?? 'this routine'}, only for this exercise.`,
  workout: 'Only for this workout. Next time it shows as last time’s note.',
});

/** Saves one kind of note; the other kinds are left as they are. */
export async function saveNote(t: NoteTargets, kind: NoteKind, text: string) {
  if (kind === 'exercise') await setPinnedExerciseNote(db, t.exerciseId, text);
  else if (kind === 'routine' && t.slotId) await setSlotNote(db, t.slotId, text);
  else await updateWorkoutExerciseNotes(db, t.workoutExerciseId, text);
}

