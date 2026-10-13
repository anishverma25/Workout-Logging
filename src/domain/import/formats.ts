import type { SetType } from '@/domain/models/schemas';
import { num, parseCsv, type CsvTable } from './csv';
import { dateOrder, parseDuration, parseExportDate, type DateOrder } from './dates';

/**
 * Reading workout history exported from Hevy and Strong into one shape, before anything is
 * matched or saved. Pure: text in, data out.
 *
 * Hevy (Profile, Settings, Export data) gives `workout_data.csv`, and `measurement_data.csv`
 * for body weight and measurements. Weights are in kg (or lb, in a `weight_lbs` column).
 *
 * Strong (Settings, Export data) gives one CSV of workouts. Its weights are in whatever unit the
 * person used in Strong, which the file does not say, so the person tells us.
 */

export type ImportSource = 'hevy' | 'strong';
export type FileKind = 'hevy-workouts' | 'hevy-measurements' | 'strong-workouts';

export interface ImportedSet {
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  distanceM: number | null;
  rpe: number | null;
  notes: string | null;
}

export interface ImportedExercise {
  /** The name exactly as the other app had it. */
  name: string;
  notes: string | null;
  /** Exercises sharing a key were done as a superset. */
  supersetKey: string | null;
  sets: ImportedSet[];
}

export interface ImportedWorkout {
  /** Stable for the same workout in the same export, so importing twice adds nothing. */
  key: string;
  title: string;
  startedAt: Date;
  endedAt: Date | null;
  notes: string | null;
  exercises: ImportedExercise[];
}

export interface ImportedBodyEntry {
  measuredAt: Date;
  weightKg: number | null;
  enteredUnit: 'kg' | 'lb';
  bodyFatPct: number | null;
  neckCm: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  calfCm: number | null;
}

export interface ImportedLog {
  source: ImportSource;
  workouts: ImportedWorkout[];
  body: ImportedBodyEntry[];
  /** Rows that could not be read (no date, or nothing logged), reported to the person. */
  skippedRows: number;
}

export const LB_TO_KG = 0.45359237;
const IN_TO_CM = 2.54;
const MILE_TO_M = 1609.344;

export class ImportFormatError extends Error {}

/** Which export a file is, from its header row alone. */
export function detectFile(table: CsvTable): FileKind | null {
  const h = new Set(table.headers);
  if (h.has('exercise_title') && h.has('start_time') && h.has('set_index')) return 'hevy-workouts';
  if (h.has('date') && (h.has('weight_kg') || h.has('weight_lbs') || h.has('fat_percent')))
    return 'hevy-measurements';
  if (h.has('exercise name') && h.has('set order') && h.has('date')) return 'strong-workouts';
  return null;
}

const round = (n: number, places = 2) => Math.round(n * 10 ** places) / 10 ** places;
const text = (v: string | undefined) => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

/** RPE 1 to 10 when it is one. */
function rpeOf(v: string | undefined): number | null {
  const n = num(v);
  return n !== null && n >= 1 && n <= 10 ? n : null;
}

const HEVY_SET_TYPES: Record<string, SetType> = {
  normal: 'working',
  failure: 'working',
  warmup: 'warmup',
  dropset: 'drop',
};

function emptySet(s: ImportedSet): boolean {
  return s.weightKg === null && s.reps === null && s.durationSec === null && s.distanceM === null;
}

/** Groups rows into workouts and exercises, keeping the order the app wrote them in. */
function assemble(
  rows: {
    workoutKey: string;
    workout: Omit<ImportedWorkout, 'exercises' | 'key'>;
    exercise: Omit<ImportedExercise, 'sets'>;
    set: ImportedSet;
  }[],
): ImportedWorkout[] {
  const workouts = new Map<string, ImportedWorkout>();
  for (const r of rows) {
    let w = workouts.get(r.workoutKey);
    if (!w) {
      w = { key: r.workoutKey, ...r.workout, exercises: [] };
      workouts.set(r.workoutKey, w);
    }
    // A run of rows for the same exercise is one exercise; the same name again later in the
    // workout (a second block of it) is kept as its own entry, as it was logged.
    let ex = w.exercises[w.exercises.length - 1];
    if (!ex || ex.name !== r.exercise.name) {
      ex = { ...r.exercise, sets: [] };
      w.exercises.push(ex);
    } else if (!ex.notes && r.exercise.notes) ex.notes = r.exercise.notes;
    ex.sets.push(r.set);
  }
  return [...workouts.values()].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
}

export function readHevyWorkouts(
  table: CsvTable,
  fallback: DateOrder = 'dmy',
): Pick<ImportedLog, 'workouts' | 'skippedRows'> {
  const inLb = table.headers.includes('weight_lbs') && !table.headers.includes('weight_kg');
  const distanceInMiles =
    table.headers.includes('distance_miles') && !table.headers.includes('distance_km');
  const order = dateOrder(
    table.rows.flatMap((r) => [r.start_time, r.end_time]),
    fallback,
  );
  let skipped = 0;
  const rows = [];
  for (const row of table.rows) {
    const startedAt = parseExportDate(row.start_time, order);
    const name = text(row.exercise_title);
    if (!startedAt || !name) {
      skipped++;
      continue;
    }
    const weight = num(inLb ? row.weight_lbs : row.weight_kg);
    const distance = num(distanceInMiles ? row.distance_miles : row.distance_km);
    const set: ImportedSet = {
      setType: HEVY_SET_TYPES[(row.set_type ?? '').toLowerCase()] ?? 'working',
      weightKg: weight === null ? null : round(inLb ? weight * LB_TO_KG : weight),
      reps: num(row.reps) === null ? null : Math.round(num(row.reps)!),
      durationSec:
        num(row.duration_seconds) === null ? null : Math.round(num(row.duration_seconds)!),
      distanceM:
        distance === null ? null : Math.round(distance * (distanceInMiles ? MILE_TO_M : 1000)),
      rpe: rpeOf(row.rpe),
      notes: null,
    };
    if (emptySet(set)) {
      skipped++;
      continue;
    }
    const title = text(row.title) ?? 'Workout';
    const endedAt = parseExportDate(row.end_time, order);
    rows.push({
      workoutKey: `${row.start_time}|${title}`,
      workout: {
        title,
        startedAt,
        endedAt: endedAt && endedAt > startedAt ? endedAt : null,
        notes: text(row.description),
      },
      exercise: {
        name,
        notes: text(row.exercise_notes),
        supersetKey: text(row.superset_id),
      },
      set,
    });
  }
  return { workouts: assemble(rows), skippedRows: skipped };
}

/** Left and right averaged, or whichever side was measured. */
function sides(row: Record<string, string>, base: string, toCm: (n: number) => number) {
  const values = [`left_${base}`, `right_${base}`, base]
    .map(
      (k) =>
        num(row[`${k}_cm`]) ?? (num(row[`${k}_in`]) === null ? null : toCm(num(row[`${k}_in`])!)),
    )
    .filter((v): v is number => v !== null && v > 0);
  return values.length === 0 ? null : round(values.reduce((a, b) => a + b, 0) / values.length, 1);
}

export function readHevyMeasurements(
  table: CsvTable,
  fallback: DateOrder = 'dmy',
): Pick<ImportedLog, 'body' | 'skippedRows'> {
  const inLb = table.headers.includes('weight_lbs') && !table.headers.includes('weight_kg');
  const toCm = (n: number) => round(n * IN_TO_CM, 1);
  const order = dateOrder(
    table.rows.map((r) => r.date),
    fallback,
  );
  const one = (row: Record<string, string>, key: string) => {
    const cm = num(row[`${key}_cm`]);
    if (cm !== null && cm > 0) return round(cm, 1);
    const inch = num(row[`${key}_in`]);
    return inch !== null && inch > 0 ? toCm(inch) : null;
  };
  let skipped = 0;
  const body: ImportedBodyEntry[] = [];
  for (const row of table.rows) {
    const measuredAt = parseExportDate(row.date, order);
    if (!measuredAt) {
      skipped++;
      continue;
    }
    const weight = num(inLb ? row.weight_lbs : row.weight_kg);
    const entry: ImportedBodyEntry = {
      measuredAt,
      weightKg: weight === null || weight <= 0 ? null : round(inLb ? weight * LB_TO_KG : weight),
      enteredUnit: inLb ? 'lb' : 'kg',
      bodyFatPct: num(row.fat_percent),
      neckCm: one(row, 'neck'),
      chestCm: one(row, 'chest'),
      waistCm: one(row, 'waist') ?? one(row, 'abdomen'),
      hipCm: one(row, 'hips'),
      armCm: sides(row, 'bicep', toCm),
      thighCm: sides(row, 'thigh', toCm),
      calfCm: sides(row, 'calf', toCm),
    };
    const hasAnything = Object.entries(entry).some(
      ([k, v]) => k !== 'measuredAt' && k !== 'enteredUnit' && v !== null,
    );
    if (!hasAnything) {
      skipped++;
      continue;
    }
    body.push(entry);
  }
  return {
    body: body.sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime()),
    skippedRows: skipped,
  };
}

const STRONG_SET_TYPES: Record<string, SetType> = { w: 'warmup', d: 'drop', f: 'working' };

/**
 * Strong. `unit` is the weight unit the person used in Strong: the file does not record it.
 * Distances follow the same choice (km with kg, miles with lb), as Strong does.
 */
export function readStrongWorkouts(
  table: CsvTable,
  unit: 'kg' | 'lb',
  fallback: DateOrder = 'dmy',
): Pick<ImportedLog, 'workouts' | 'skippedRows'> {
  const dates = dateOrder(
    table.rows.map((r) => r.date),
    fallback,
  );
  let skipped = 0;
  const rows = [];
  for (const row of table.rows) {
    const startedAt = parseExportDate(row.date, dates);
    const name = text(row['exercise name']);
    const order = (row['set order'] ?? '').trim().toLowerCase();
    // Rest timer and note rows carry no set.
    const setType = /^\d+$/.test(order) ? 'working' : STRONG_SET_TYPES[order];
    if (!startedAt || !name || !setType) {
      skipped++;
      continue;
    }
    const weight = num(row.weight);
    const distance = num(row.distance);
    const seconds = num(row.seconds);
    const reps = num(row.reps);
    const set: ImportedSet = {
      setType,
      weightKg:
        weight === null || weight === 0 ? null : round(unit === 'lb' ? weight * LB_TO_KG : weight),
      reps: reps === null || reps === 0 ? null : Math.round(reps),
      durationSec: seconds === null || seconds === 0 ? null : Math.round(seconds),
      distanceM:
        distance === null || distance === 0
          ? null
          : Math.round(distance * (unit === 'lb' ? MILE_TO_M : 1000)),
      rpe: rpeOf(row.rpe),
      notes: text(row.notes),
    };
    if (emptySet(set)) {
      skipped++;
      continue;
    }
    const title = text(row['workout name']) ?? 'Workout';
    const duration = parseDuration(row.duration);
    rows.push({
      workoutKey: `${row.date}|${title}`,
      workout: {
        title,
        startedAt,
        endedAt: duration ? new Date(startedAt.getTime() + duration * 1000) : null,
        notes: text(row['workout notes']),
      },
      exercise: { name, notes: null, supersetKey: null },
      set,
    });
  }
  return { workouts: assemble(rows), skippedRows: skipped };
}

/**
 * Reads every file the person chose into one log. Hevy needs its workout file and may have a
 * measurements file too; Strong has one file.
 */
export function readExport(
  /** Each file as text (CSV) or as a table already read from a spreadsheet. */
  files: { name: string; text?: string; table?: CsvTable }[],
  /** dateOrder: how this device writes dates, for slash dates that read both ways. */
  options: { strongUnit: 'kg' | 'lb'; dateOrder?: DateOrder },
): ImportedLog {
  const log: ImportedLog = { source: 'hevy', workouts: [], body: [], skippedRows: 0 };
  let recognised = 0;
  const kinds = new Set<FileKind>();
  for (const file of files) {
    const table = file.table ?? parseCsv(file.text ?? '');
    const kind = detectFile(table);
    if (!kind) {
      throw new ImportFormatError(
        `${file.name} is not a Hevy or Strong export. Export it again from the app and choose the CSV file (or an Excel copy of it).`,
      );
    }
    recognised++;
    kinds.add(kind);
    if (kind === 'hevy-workouts') {
      const r = readHevyWorkouts(table, options.dateOrder);
      log.workouts.push(...r.workouts);
      log.skippedRows += r.skippedRows;
    } else if (kind === 'hevy-measurements') {
      const r = readHevyMeasurements(table, options.dateOrder);
      log.body.push(...r.body);
      log.skippedRows += r.skippedRows;
    } else {
      const r = readStrongWorkouts(table, options.strongUnit, options.dateOrder);
      log.workouts.push(...r.workouts);
      log.skippedRows += r.skippedRows;
      log.source = 'strong';
    }
  }
  if (recognised === 0) throw new ImportFormatError('Choose at least one export file.');
  if (
    kinds.has('strong-workouts') &&
    (kinds.has('hevy-workouts') || kinds.has('hevy-measurements'))
  ) {
    throw new ImportFormatError('Import Hevy and Strong files separately, one app at a time.');
  }
  log.workouts.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  return log;
}
