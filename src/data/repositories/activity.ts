import { ActivityLog, type CardioActivity } from '@/domain/models/schemas';
import { estimateCardio, estimateSteps, kindOf, type Effort } from '@/domain/activity/burn';
import type { WorkoutDatabase } from '../db';
import { newRecordMeta, patchRecord, patchRecords, putRecords, softDelete } from './write';

export class ActivityError extends Error {}

export interface CardioInput {
  date: string;
  activity: CardioActivity;
  minutes: number;
  speedKmh?: number | null;
  inclinePct?: number | null;
  distanceKm?: number | null;
  watts?: number | null;
  effort?: Effort | null;
  /** A number from a watch, tracker or machine. Replaces the estimate. */
  typedKcal?: number | null;
}

interface Context {
  weightKg: number | null;
  heightCm?: number | null;
}

const opt = (v: number | null | undefined, digits = 1) =>
  v == null ? null : Math.round(v * 10 ** digits) / 10 ** digits;

/** Logs one cardio session. The calories are the typed number, else an estimate kept as saved. */
export async function addCardio(
  db: WorkoutDatabase,
  input: CardioInput,
  ctx: Context,
  now: Date = new Date(),
): Promise<ActivityLog> {
  const minutes = Math.round(input.minutes);
  if (!(minutes >= 1 && minutes <= 1000)) throw new ActivityError('Enter the minutes, 1 to 1,000.');
  const kind = kindOf(input.activity);
  const typed = input.typedKcal != null ? Math.round(input.typedKcal) : null;
  if (typed !== null && !(typed >= 0 && typed <= 10000))
    throw new ActivityError('Enter calories from 0 to 10,000.');
  let kcal = typed;
  if (kcal === null) {
    if (!ctx.weightKg)
      throw new ActivityError('Add a weigh-in to estimate calories, or type the calories.');
    const burn = estimateCardio({
      activity: input.activity,
      minutes,
      weightKg: ctx.weightKg,
      speedKmh: input.speedKmh,
      inclinePct: input.inclinePct,
      distanceKm: input.distanceKm,
      watts: input.watts,
      effort: input.effort ?? (kind.efforts.includes('moderate') ? 'moderate' : null),
    });
    if (!burn) throw new ActivityError('Could not estimate. Type the calories instead.');
    kcal = burn.kcal;
  }
  const log = ActivityLog.parse({
    ...newRecordMeta('user', now.toISOString()),
    date: input.date,
    kind: 'cardio',
    activity: input.activity,
    minutes,
    distanceKm: opt(input.distanceKm, 2),
    speedKmh: opt(input.speedKmh),
    inclinePct: opt(input.inclinePct),
    watts: input.watts == null ? null : Math.round(input.watts),
    effort: kind.efforts.length ? (input.effort ?? 'moderate') : null,
    steps: null,
    kcal,
    kcalSource: typed !== null ? 'typed' : 'estimated',
  });
  await db.transaction('rw', [db.activityLogs, db.outbox], () =>
    putRecords(db, 'activityLogs', [log]),
  );
  return log;
}

/** The day's steps: one record a day, replaced when saved again. */
export async function saveSteps(
  db: WorkoutDatabase,
  input: { date: string; steps: number; typedKcal?: number | null },
  ctx: Context,
  now: Date = new Date(),
): Promise<ActivityLog> {
  const steps = Math.round(input.steps);
  if (!(steps >= 1 && steps <= 200000)) throw new ActivityError('Enter steps from 1 to 200,000.');
  const typed = input.typedKcal != null ? Math.round(input.typedKcal) : null;
  if (typed !== null && !(typed >= 0 && typed <= 10000))
    throw new ActivityError('Enter calories from 0 to 10,000.');
  let kcal = typed;
  if (kcal === null) {
    if (!ctx.weightKg)
      throw new ActivityError('Add a weigh-in to estimate calories, or type the calories.');
    kcal = estimateSteps({ steps, weightKg: ctx.weightKg, heightCm: ctx.heightCm })!.kcal;
  }
  const fields = {
    steps,
    kcal,
    kcalSource: typed !== null ? ('typed' as const) : ('estimated' as const),
  };
  return db.transaction('rw', [db.activityLogs, db.outbox], async () => {
    const existing = (await db.activityLogs.where('date').equals(input.date).toArray()).find(
      (l) => l.kind === 'steps' && l.deletedAt === null,
    );
    if (existing) return (await patchRecord<ActivityLog>(db, 'activityLogs', existing.id, fields))!;
    const log = ActivityLog.parse({
      ...newRecordMeta('user', now.toISOString()),
      date: input.date,
      kind: 'steps',
      activity: null,
      minutes: null,
      distanceKm: null,
      speedKmh: null,
      inclinePct: null,
      watts: null,
      effort: null,
      ...fields,
    });
    await putRecords(db, 'activityLogs', [log]);
    return log;
  });
}

export async function deleteActivity(db: WorkoutDatabase, ids: string[]): Promise<void> {
  await db.transaction('rw', [db.activityLogs, db.outbox], () =>
    softDelete(db, 'activityLogs', ids),
  );
}

export async function restoreActivity(db: WorkoutDatabase, ids: string[]): Promise<void> {
  await db.transaction('rw', [db.activityLogs, db.outbox], () =>
    patchRecords<ActivityLog>(
      db,
      'activityLogs',
      ids.map((id) => ({ id, changes: { deletedAt: null } })),
    ),
  );
}
