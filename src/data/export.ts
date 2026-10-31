import type { ActivityLog, FoodLog, WaterLog } from '@/domain/models/schemas';
import { buildSessions, type TrainingData } from '@/domain/analytics/sessions';
import { isAlive } from '@/domain/analytics/sessions';
import { MEASUREMENT_FIELDS } from '@/domain/models/schemas';

/** RFC 4180 CSV: quotes around fields with commas, quotes or line breaks. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          if (v === null || v === undefined) return '';
          const s = String(v);
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\r\n');
}

const iso = (d: string | null) => d ?? '';

/** Every completed set of every finished workout, one per row, in kg. */
export function setsCsv(data: TrainingData): string {
  const rows: (string | number | null)[][] = [
    [
      'workout_date',
      'workout',
      'exercise',
      'set_number',
      'set_type',
      'weight_kg',
      'reps',
      'rir',
      'rpe',
      'duration_sec',
      'distance_m',
      'notes',
      'workout_id',
      'reps_left',
      'reps_right',
    ],
  ];
  for (const s of buildSessions(data)) {
    for (const ex of s.exercises) {
      ex.sets
        .filter((x) => x.completedAt !== null)
        .forEach((x, i) =>
          rows.push([
            s.workout.startedAt,
            s.workout.name,
            ex.workoutExercise.exerciseName,
            i + 1,
            x.setType,
            x.weightKg,
            x.reps,
            x.rir,
            x.rpe,
            x.durationSec,
            x.distanceM,
            x.notes,
            s.workout.id,
            x.repsLeft ?? null,
            x.repsRight ?? null,
          ]),
        );
    }
  }
  return toCsv(rows);
}

/** Weigh-ins and tape measurements, one per row. */
export function bodyCsv(data: TrainingData): string {
  const rows: (string | number | null)[][] = [
    [
      'date',
      'type',
      'weight_kg',
      ...MEASUREMENT_FIELDS.map((f) => f.replace('Cm', '_cm')),
      'body_fat_pct',
      'note',
    ],
  ];
  for (const b of data.bodyWeights.filter(isAlive))
    rows.push([
      iso(b.measuredAt),
      'weigh-in',
      b.weightKg,
      ...MEASUREMENT_FIELDS.map(() => null),
      null,
      b.note,
    ]);
  for (const m of data.measurements.filter(isAlive))
    rows.push([
      iso(m.measuredAt),
      'measurements',
      null,
      ...MEASUREMENT_FIELDS.map((f) => m[f]),
      m.bodyFatPct,
      m.note,
    ]);
  rows.splice(
    1,
    rows.length - 1,
    ...rows.slice(1).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
  return toCsv(rows);
}

/** Every food logged, one per row, with the numbers saved at the time. */
export function foodCsv(logs: FoodLog[]): string {
  const rows: (string | number | null)[][] = [
    [
      'date',
      'meal',
      'food',
      'amount',
      'unit',
      'size',
      'grams',
      'oil',
      'kcal',
      'protein_g',
      'carbs_g',
      'fat_g',
      'fibre_g',
    ],
  ];
  const sorted = logs
    .filter((l) => l.deletedAt === null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  for (const l of sorted)
    rows.push([
      l.date,
      l.meal,
      l.foodName,
      l.amount,
      l.unit,
      l.size,
      l.grams,
      l.oilLevel,
      l.kcal,
      l.proteinG,
      l.carbsG,
      l.fatG,
      l.fibreG,
    ]);
  return toCsv(rows);
}

/** Water and activity, one day per row: ml drunk, steps, and the calories burned by each part. */
export function waterActivityCsv(water: WaterLog[], activity: ActivityLog[]): string {
  const days = new Map<
    string,
    { ml: number; steps: number | null; cardioMin: number; cardioKcal: number; stepsKcal: number }
  >();
  const day = (date: string) => {
    let d = days.get(date);
    if (!d) {
      d = { ml: 0, steps: null, cardioMin: 0, cardioKcal: 0, stepsKcal: 0 };
      days.set(date, d);
    }
    return d;
  };
  for (const w of water) if (w.deletedAt === null) day(w.date).ml += w.ml;
  for (const a of activity) {
    if (a.deletedAt !== null) continue;
    const d = day(a.date);
    if (a.kind === 'steps') {
      d.steps = a.steps;
      d.stepsKcal += a.kcal;
    } else {
      d.cardioMin += a.minutes ?? 0;
      d.cardioKcal += a.kcal;
    }
  }
  const rows: (string | number | null)[][] = [
    ['date', 'water_ml', 'steps', 'steps_kcal', 'cardio_minutes', 'cardio_kcal'],
  ];
  for (const [date, d] of [...days].sort((a, b) => a[0].localeCompare(b[0])))
    rows.push([date, d.ml, d.steps, d.stepsKcal, d.cardioMin, d.cardioKcal]);
  return toCsv(rows);
}

export function downloadText(text: string, name: string, type = 'text/csv') {
  // A byte order mark so spreadsheet apps read the text as UTF-8.
  const blob = new Blob(['﻿', text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
