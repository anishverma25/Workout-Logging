import { BodyWeightEntry } from '@/domain/models/schemas';
import { toDateKey } from '@/lib/dates';
import { fromDisplayWeight, type WeightUnit } from '@/lib/units';
import type { WorkoutDatabase } from '../db';
import { newRecordMeta, patchRecord, putRecords, softDelete } from './write';

export class BodyWeightError extends Error {}

export interface BodyWeightInput {
  /** As typed, in `unit`. */
  weight: number;
  unit: WeightUnit;
  /** Local calendar day, yyyy-mm-dd. */
  date: string;
  note: string | null;
}

const MIN_KG = 20;
const MAX_KG = 400;

/**
 * When a weigh-in happened. Today means now; another day keeps its existing time when editing,
 * or 8:00 local (a typical morning weigh-in) for a new entry.
 */
export function measuredAtFor(date: string, now: Date, keepTimeFrom?: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BodyWeightError('Pick a date.');
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  if (keepTimeFrom && toDateKey(new Date(keepTimeFrom)) === date) return keepTimeFrom;
  if (date === toDateKey(now)) return now.toISOString();
  const at = new Date(y, m - 1, d, 8, 0, 0);
  if (at.getTime() > now.getTime()) throw new BodyWeightError('That date is in the future.');
  return at.toISOString();
}

function toKg(input: BodyWeightInput): number {
  if (!Number.isFinite(input.weight) || input.weight <= 0)
    throw new BodyWeightError('Enter your weight.');
  const kg = fromDisplayWeight(input.weight, input.unit);
  if (kg < MIN_KG || kg > MAX_KG) {
    throw new BodyWeightError(
      input.unit === 'kg'
        ? 'Enter a weight between 20 and 400 kg.'
        : 'Enter a weight between 44 and 880 lb.',
    );
  }
  return kg;
}

export async function addBodyWeight(
  db: WorkoutDatabase,
  input: BodyWeightInput,
  now: Date = new Date(),
): Promise<BodyWeightEntry> {
  const entry = BodyWeightEntry.parse({
    ...newRecordMeta('user', now.toISOString()),
    measuredAt: measuredAtFor(input.date, now),
    weightKg: toKg(input),
    enteredUnit: input.unit,
    note: input.note?.trim() || null,
  });
  await putRecords(db, 'bodyWeights', [entry]);
  return entry;
}

export async function updateBodyWeight(
  db: WorkoutDatabase,
  id: string,
  input: BodyWeightInput,
  now: Date = new Date(),
): Promise<void> {
  const current = await db.bodyWeights.get(id);
  if (!current || current.deletedAt !== null) throw new BodyWeightError('Entry not found.');
  await patchRecord<BodyWeightEntry>(db, 'bodyWeights', id, {
    measuredAt: measuredAtFor(input.date, now, current.measuredAt),
    weightKg: toKg(input),
    enteredUnit: input.unit,
    note: input.note?.trim() || null,
  });
}

export async function deleteBodyWeight(db: WorkoutDatabase, id: string): Promise<void> {
  await softDelete(db, 'bodyWeights', [id]);
}
