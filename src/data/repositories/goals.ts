import { TrainingGoal, type GoalKind } from '@/domain/models/schemas';
import type { WorkoutDatabase } from '../db';
import { newRecordMeta, patchRecord, putRecords, softDelete } from './write';

export class GoalError extends Error {}

export interface GoalInput {
  kind: GoalKind;
  exerciseId: string | null;
  /** In kg. */
  targetValue: number;
  /** The current value when the goal is set, in kg, if there is one. */
  startValue: number | null;
  /** yyyy-mm-dd, or null for no deadline. */
  targetDate: string | null;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

function validate(input: GoalInput, now: Date): Omit<GoalInput, never> {
  if (input.kind === 'body_weight' ? input.exerciseId !== null : !input.exerciseId)
    throw new GoalError('Pick an exercise.');
  if (!Number.isFinite(input.targetValue) || input.targetValue < 1 || input.targetValue > 1000)
    throw new GoalError('Enter a target.');
  if (input.targetDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate)) throw new GoalError('Pick a date.');
    const [y, m, d] = input.targetDate.split('-').map(Number) as [number, number, number];
    if (new Date(y, m - 1, d, 23, 59).getTime() < now.getTime())
      throw new GoalError('Pick a date in the future.');
  }
  if (
    input.kind !== 'body_weight' &&
    input.startValue !== null &&
    input.targetValue <= input.startValue
  )
    throw new GoalError('Set a target above what you lift now.');
  return {
    ...input,
    targetValue: round1(input.targetValue),
    startValue: input.startValue === null ? null : round1(input.startValue),
  };
}

export async function addGoal(
  db: WorkoutDatabase,
  input: GoalInput,
  now: Date = new Date(),
): Promise<TrainingGoal> {
  const goal = TrainingGoal.parse({
    ...newRecordMeta('user', now.toISOString()),
    ...validate(input, now),
    achievedAt: null,
  });
  await db.transaction('rw', [db.goals, db.outbox], () => putRecords(db, 'goals', [goal]));
  return goal;
}

export async function updateGoal(
  db: WorkoutDatabase,
  id: string,
  input: GoalInput,
  now: Date = new Date(),
): Promise<void> {
  const fields = validate(input, now);
  await db.transaction('rw', [db.goals, db.outbox], async () => {
    const current = await db.goals.get(id);
    if (!current || current.deletedAt !== null) throw new GoalError('Goal not found.');
    // A changed target is a new goal to reach.
    const achievedAt = current.targetValue === fields.targetValue ? current.achievedAt : null;
    await patchRecord<TrainingGoal>(db, 'goals', id, { ...fields, achievedAt });
  });
}

/** Records the moment a goal was first reached. Does nothing if it already was. */
export async function markGoalAchieved(
  db: WorkoutDatabase,
  id: string,
  at: Date = new Date(),
): Promise<void> {
  await db.transaction('rw', [db.goals, db.outbox], async () => {
    const current = await db.goals.get(id);
    if (!current || current.deletedAt !== null || current.achievedAt) return;
    if (current.origin !== 'user') return;
    await patchRecord<TrainingGoal>(db, 'goals', id, { achievedAt: at.toISOString() });
  });
}

export async function deleteGoal(db: WorkoutDatabase, id: string): Promise<void> {
  await db.transaction('rw', [db.goals, db.outbox], () => softDelete(db, 'goals', [id]));
}
