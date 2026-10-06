import {
  BodyMeasurement,
  MEASUREMENT_FIELDS,
  type MeasurementField,
} from '@/domain/models/schemas';
import type { WorkoutDatabase } from '../db';
import { BodyWeightError, measuredAtFor } from './bodyweight';
import { newRecordMeta, patchRecord, putRecords, softDelete } from './write';

export class MeasurementError extends Error {}

export type LengthUnit = 'cm' | 'in';
export const CM_PER_INCH = 2.54;

export interface MeasurementInput {
  /** Values as typed, in `unit`. Missing or null means not measured this time. */
  values: Partial<Record<MeasurementField, number | null>>;
  unit: LengthUnit;
  /** Body fat from a scale or scan, in percent. */
  bodyFatPct: number | null;
  /** Local calendar day, yyyy-mm-dd. */
  date: string;
  note: string | null;
}

/** Plausible ranges in cm, the same as the database checks. */
export const MEASUREMENT_RANGES: Record<MeasurementField, [number, number]> = {
  waistCm: [30, 250],
  neckCm: [15, 80],
  hipCm: [40, 250],
  chestCm: [40, 250],
  armCm: [10, 80],
  thighCm: [20, 120],
  calfCm: [15, 80],
};

export const MEASUREMENT_LABELS: Record<MeasurementField, string> = {
  waistCm: 'Waist',
  neckCm: 'Neck',
  hipCm: 'Hips',
  chestCm: 'Chest',
  armCm: 'Arm',
  thighCm: 'Thigh',
  calfCm: 'Calf',
};

const round1 = (v: number) => Math.round(v * 10) / 10;

function toFields(input: MeasurementInput) {
  const out: Record<MeasurementField, number | null> = {
    waistCm: null,
    neckCm: null,
    hipCm: null,
    chestCm: null,
    armCm: null,
    thighCm: null,
    calfCm: null,
  };
  for (const field of MEASUREMENT_FIELDS) {
    const raw = input.values[field];
    if (raw === null || raw === undefined) continue;
    if (!Number.isFinite(raw) || raw <= 0)
      throw new MeasurementError(`Check the ${MEASUREMENT_LABELS[field].toLowerCase()} value.`);
    const cm = round1(input.unit === 'in' ? raw * CM_PER_INCH : raw);
    const [lo, hi] = MEASUREMENT_RANGES[field];
    if (cm < lo || cm > hi)
      throw new MeasurementError(
        `${MEASUREMENT_LABELS[field]} looks off. Enter it in ${input.unit === 'in' ? 'inches' : 'cm'}.`,
      );
    out[field] = cm;
  }
  let bodyFatPct: number | null = null;
  if (input.bodyFatPct !== null) {
    if (!(input.bodyFatPct >= 2 && input.bodyFatPct <= 70))
      throw new MeasurementError('Enter body fat between 2 and 70 percent.');
    bodyFatPct = round1(input.bodyFatPct);
  }
  if (MEASUREMENT_FIELDS.every((f) => out[f] === null) && bodyFatPct === null)
    throw new MeasurementError('Enter at least one measurement.');
  return { ...out, bodyFatPct, note: input.note?.trim() || null };
}

function when(date: string, now: Date, keep?: string) {
  try {
    return measuredAtFor(date, now, keep);
  } catch (err) {
    if (err instanceof BodyWeightError) throw new MeasurementError(err.message);
    throw err;
  }
}

export async function addMeasurement(
  db: WorkoutDatabase,
  input: MeasurementInput,
  now: Date = new Date(),
): Promise<BodyMeasurement> {
  const entry = BodyMeasurement.parse({
    ...newRecordMeta('user', now.toISOString()),
    measuredAt: when(input.date, now),
    ...toFields(input),
  });
  await db.transaction('rw', [db.bodyMeasurements, db.outbox], () =>
    putRecords(db, 'bodyMeasurements', [entry]),
  );
  return entry;
}

export async function updateMeasurement(
  db: WorkoutDatabase,
  id: string,
  input: MeasurementInput,
  now: Date = new Date(),
): Promise<void> {
  await db.transaction('rw', [db.bodyMeasurements, db.outbox], async () => {
    const current = await db.bodyMeasurements.get(id);
    if (!current || current.deletedAt !== null) throw new MeasurementError('Entry not found.');
    await patchRecord<BodyMeasurement>(db, 'bodyMeasurements', id, {
      measuredAt: when(input.date, now, current.measuredAt),
      ...toFields(input),
    });
  });
}

export async function deleteMeasurement(db: WorkoutDatabase, id: string): Promise<void> {
  await db.transaction('rw', [db.bodyMeasurements, db.outbox], () =>
    softDelete(db, 'bodyMeasurements', [id]),
  );
}
