import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SYSTEM_EXERCISES } from '@/data/library/exercises';
import { parseCsv, parseCsvRows } from './csv';
import { parseDuration, parseExportDate } from './dates';
import { detectFile, ImportFormatError, readExport } from './formats';
import { inferExercise, matchExercise } from './match';
import { planImport } from './plan';
import { inferRoutine } from './routine';

/**
 * Reading Hevy and Strong exports. The fixtures copy the real files' headers, quoting and date
 * formats; the numbers in them are made up.
 */

const fixture = (name: string) => ({
  name,
  text: readFileSync(join(__dirname, 'fixtures', name), 'utf8'),
});
const hevy = () => readExport([fixture('hevy-workouts.csv')], { strongUnit: 'kg' });
const lib = SYSTEM_EXERCISES;
const named = (name: string) => matchExercise(name, lib)?.name ?? null;

describe('CSV', () => {
  it('reads quotes, doubled quotes, line breaks in quotes and blank lines', () => {
    const rows = parseCsvRows('a,b\n"x, y","say ""hi"""\n\n"two\nlines",3\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['two\nlines', '3'],
    ]);
  });

  it('detects semicolon files and decimal commas', () => {
    const t = parseCsv('Weight;Reps\n92,5;5');
    expect(t.rows[0]).toEqual({ weight: '92,5', reps: '5' });
  });
});

describe('dates', () => {
  it('reads Hevy and Strong dates in the local time zone', () => {
    expect(parseExportDate('12 Oct 2026, 19:07')).toEqual(new Date(2026, 9, 12, 19, 7));
    expect(parseExportDate('Oct 12, 2026, 7:07 PM')).toEqual(new Date(2026, 9, 12, 19, 7));
    expect(parseExportDate('2023-03-01 18:05:22')).toEqual(new Date(2023, 2, 1, 18, 5, 22));
    expect(parseExportDate('31 Feb 2026, 10:00')).toBeNull();
    expect(parseExportDate('yesterday')).toBeNull();
  });

  it('reads Strong durations', () => {
    expect(parseDuration('1h 2m')).toBe(3720);
    expect(parseDuration('45m')).toBe(2700);
    expect(parseDuration('50s')).toBe(50);
    expect(parseDuration('')).toBeNull();
  });
});

describe('Hevy', () => {
  it('recognises each file from its header', () => {
    expect(detectFile(parseCsv(fixture('hevy-workouts.csv').text))).toBe('hevy-workouts');
    expect(detectFile(parseCsv(fixture('hevy-measurements.csv').text))).toBe('hevy-measurements');
    expect(detectFile(parseCsv(fixture('strong.csv').text))).toBe('strong-workouts');
    expect(detectFile(parseCsv('name,age\nA,3'))).toBeNull();
  });

  it('groups rows into workouts, exercises and sets, oldest first', () => {
    const log = hevy();
    expect(log.source).toBe('hevy');
    expect(log.workouts.map((w) => w.title)).toEqual(['Lower B', 'Upper A']);
    const upper = log.workouts[1]!;
    expect(upper.startedAt).toEqual(new Date(2026, 9, 12, 19, 7));
    expect(upper.endedAt).toEqual(new Date(2026, 9, 12, 20, 56));
    expect(upper.notes).toBe('Felt strong');
    expect(upper.exercises.map((e) => [e.name, e.sets.length])).toEqual([
      ['Bench Press (Barbell)', 3],
      ['Lat Pulldown (Cable)', 1],
      ['Single Arm Triceps Pushdown (Cable)', 2],
      ['Pullover (Dumbbell)', 1],
      ['Plank', 1],
    ]);
    const bench = upper.exercises[0]!;
    expect(bench.notes).toBe('Paused reps');
    expect(bench.sets.map((s) => s.setType)).toEqual(['warmup', 'working', 'working']);
    expect(bench.sets[1]).toMatchObject({ weightKg: 80, reps: 8, rpe: 8 });
    expect(upper.exercises[2]!.sets[1]!.setType).toBe('drop');
    expect(upper.exercises[1]!.supersetKey).toBe('0');
    expect(upper.exercises[4]!.sets[0]).toMatchObject({ durationSec: 60, weightKg: null });
  });

  it('keeps distance, and leaves out rows with nothing logged', () => {
    const lower = hevy().workouts[0]!;
    expect(lower.exercises.find((e) => e.name === 'Treadmill')!.sets[0]).toMatchObject({
      distanceM: 2500,
      durationSec: 900,
    });
    expect(lower.exercises.find((e) => e.name === 'Cable Crunch')).toBeUndefined();
    expect(hevy().skippedRows).toBe(1);
  });

  it('reads body weight, body fat and tape measurements in inches', () => {
    const log = readExport([fixture('hevy-measurements.csv')], { strongUnit: 'kg' });
    expect(log.body).toHaveLength(2);
    expect(log.body[0]).toMatchObject({ weightKg: 70.5, bodyFatPct: null, waistCm: null });
    expect(log.body[1]).toMatchObject({
      weightKg: 67.8,
      bodyFatPct: 14.5,
      neckCm: 38.1,
      chestCm: 101.6,
      // Left and right averaged: 14 and 14.4 inches.
      armCm: 36.1,
      waistCm: 81.3,
    });
    expect(log.skippedRows).toBe(1);
  });
});

describe('Strong', () => {
  it('reads sets in the unit the person used, warm-ups, RPE and duration', () => {
    const log = readExport([fixture('strong.csv')], { strongUnit: 'lb' });
    expect(log.source).toBe('strong');
    expect(log.workouts).toHaveLength(2);
    const evening = log.workouts[0]!;
    expect(evening.endedAt!.getTime() - evening.startedAt.getTime()).toBe(3720_000);
    expect(evening.notes).toBe('Good session');
    const squat = evening.exercises[0]!;
    // The rest timer row is not a set.
    expect(squat.sets.map((s) => [s.setType, s.weightKg, s.reps])).toEqual([
      ['warmup', 43.09, 5],
      ['working', 102.06, 5],
      ['working', 102.06, 5],
    ]);
    expect(squat.sets[1]).toMatchObject({ rpe: 8.5, notes: 'Belt' });
    expect(evening.exercises[1]!.sets[0]).toMatchObject({ weightKg: null, reps: 10 });
    // Miles with pounds, as Strong does.
    expect(log.workouts[1]!.exercises[1]!.sets[0]).toMatchObject({
      distanceM: 4989,
      durationSec: 1500,
    });
  });

  it('reads the semicolon export with decimal commas the same way', () => {
    const log = readExport([fixture('strong-semicolon.csv')], { strongUnit: 'kg' });
    expect(log.workouts[0]!.exercises[0]!.sets[0]).toMatchObject({ weightKg: 92.5, reps: 5 });
  });

  it('refuses files that are not exports, and mixing the two apps', () => {
    expect(() =>
      readExport([{ name: 'notes.csv', text: 'a,b\n1,2' }], { strongUnit: 'kg' }),
    ).toThrow(ImportFormatError);
    expect(() =>
      readExport([fixture('strong.csv'), fixture('hevy-workouts.csv')], { strongUnit: 'kg' }),
    ).toThrow('one app at a time');
  });
});

describe('matching exercises to the library', () => {
  it('matches the same movement on the same equipment', () => {
    expect(named('Bench Press (Barbell)')).toBe('Barbell bench press');
    expect(named('Squat (Barbell)')).toBe('Back squat');
    expect(named('Lat Pulldown (Cable)')).toBe('Lat pulldown');
    expect(named('Leg Press (Machine)')).toBe('Leg press');
    expect(named('Hip Thrust (Machine)')).toBe('Machine hip thrust');
    expect(named('Chest Fly (Machine)')).toBe('Pec deck');
    expect(named('Leg Extension (Machine)')).toBe('Leg extension');
    expect(named('Preacher Curl (Machine)')).toBe('Preacher curl');
    expect(named('Cable Crunch')).toBe('Cable crunch');
    expect(named('Pull Up')).toBe('Pull-up');
    expect(named('Plank')).toBe('Plank');
    expect(named('Hip Adduction (Machine)')).toBe('Hip adduction machine');
  });

  it('never matches a different lift, even with a similar name', () => {
    expect(named('Incline Bench Press (Smith Machine)')).toBeNull();
    expect(named('Overhead Press (Smith Machine)')).toBeNull();
    expect(named('Single Leg Extensions')).toBeNull();
    expect(named('KELSO SHRUGS (seat full down)')).toBeNull();
    expect(named('Pullover (Dumbbell)')).toBeNull();
  });

  it('describes unmatched exercises from their name and sets', () => {
    const weighted = [
      {
        setType: 'working',
        weightKg: 20,
        reps: 8,
        durationSec: null,
        distanceM: null,
        rpe: null,
        notes: null,
      },
    ] as const;
    expect(inferExercise('Single Arm Triceps Pushdown (Cable)', [...weighted])).toMatchObject({
      primaryMuscle: 'triceps',
      equipment: 'cable',
      category: 'isolation',
      trackingType: 'weight_reps',
      loadMode: 'per_hand',
    });
    expect(inferExercise('Hip Adduction (Machine)', [...weighted])).toMatchObject({
      primaryMuscle: 'adductors',
      equipment: 'machine',
    });
    expect(inferExercise('Pullover (Dumbbell)', [...weighted])).toMatchObject({
      primaryMuscle: 'back',
      loadMode: 'total',
    });
    expect(inferExercise('TNF UPPER PEC PULLOVERS (CABLE)', [...weighted]).primaryMuscle).toBe(
      'chest',
    );
    expect(inferExercise('Saggital Rowing Machine', [...weighted])).toMatchObject({
      primaryMuscle: 'back',
      equipment: 'machine',
      category: 'compound',
    });
    expect(inferExercise('Incline Bench Press (Smith Machine)', [...weighted])).toMatchObject({
      primaryMuscle: 'chest',
      category: 'compound',
    });
    expect(inferExercise('cable cuff brachialis curls', [...weighted]).primaryMuscle).toBe(
      'biceps',
    );
    expect(
      inferExercise('Hollow hold', [
        { ...weighted[0], weightKg: null, reps: null, durationSec: 40 },
      ]).trackingType,
    ).toBe('duration');
  });
});

describe('the plan shown before importing', () => {
  it('counts what will come in and suggests a home for every exercise', () => {
    const plan = planImport(hevy(), lib);
    expect(plan.workouts).toBe(2);
    expect(plan.sets).toBe(13);
    expect(plan.firstWorkout).toEqual(new Date(2026, 9, 3, 19, 40));
    const bench = plan.exercises.find((e) => e.name === 'Bench Press (Barbell)')!;
    expect(bench).toMatchObject({ sets: 3, workouts: 1, reason: 'library' });
    // Most-used first.
    expect(plan.exercises[0]!.name).toBe('Bench Press (Barbell)');
    expect(plan.exercises.find((e) => e.name === 'Hip Adduction (Machine)')!.reason).toBe(
      'library',
    );
    expect(plan.exercises.find((e) => e.name === 'Pullover (Dumbbell)')!.reason).toBe('new');
  });

  it('reuses an exercise the person already made with the same name', () => {
    const mine = {
      ...lib[0]!,
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Kelso shrugs (seat full down)',
      isCustom: true,
    };
    const plan = planImport(hevy(), [...lib, mine]);
    expect(plan.exercises.find((e) => e.name === 'KELSO SHRUGS (seat full down)')).toMatchObject({
      reason: 'yours',
      choice: { kind: 'existing', exerciseId: mine.id },
    });
  });
});

describe('the routine rebuilt from recent workouts', () => {
  it('turns each recent workout title into a day, with exercises, sets and reps', () => {
    const routine = inferRoutine(hevy(), 'hevy')!;
    // No shared name between "Lower B" and "Upper A", so it is named after the app.
    expect(routine.name).toBe('My Hevy routine');
    expect(routine.days.map((d) => [d.name, d.weekdays])).toEqual([
      ['Lower B', [6]],
      ['Upper A', [1]],
    ]);
    const upper = routine.days[1]!;
    expect(upper.slots.map((s) => s.name)).toEqual([
      'Bench Press (Barbell)',
      'Lat Pulldown (Cable)',
      'Single Arm Triceps Pushdown (Cable)',
      'Pullover (Dumbbell)',
      'Plank',
    ]);
    // Warm-ups are not target sets; the reps span the working sets; RPE 8 and 10 give RIR 2.
    expect(upper.slots[0]).toMatchObject({ sets: 2, repMin: 7, repMax: 8, targetRir: 2 });
    expect(upper.slots[2]).toMatchObject({ sets: 2, repMin: 4, repMax: 6, supersetKey: '0' });
    // A hold has no reps, so it gets an ordinary range to edit later.
    expect(upper.slots[4]).toMatchObject({ sets: 1, repMin: 8, repMax: 12, targetRir: null });
  });

  it('names the routine after what its days share, and gives each weekday to one day', () => {
    const day = (title: string, date: Date) => ({
      key: `${title}${date.toISOString()}`,
      title,
      startedAt: date,
      endedAt: null,
      notes: null,
      exercises: [
        {
          name: 'Squat (Barbell)',
          notes: null,
          supersetKey: null,
          sets: [
            {
              setType: 'working' as const,
              weightKg: 100,
              reps: 5,
              durationSec: null,
              distanceM: null,
              rpe: null,
              notes: null,
            },
          ],
        },
      ],
    });
    const log = {
      source: 'hevy' as const,
      body: [],
      skippedRows: 0,
      workouts: [
        // An old programme, outside the last six weeks, is left out.
        day('Old Push', new Date(2026, 6, 1, 18)),
        day('FULL BODY EACH OTHER DAY (A)', new Date(2026, 8, 26, 19)), // Sat
        day('FULL BODY EACH OTHER DAY (B)', new Date(2026, 8, 28, 19)), // Mon
        day('FULL BODY EACH OTHER DAY (A)', new Date(2026, 9, 3, 19)), // Sat
        day('Evening Workout', new Date(2026, 9, 7, 19)),
        day('FULL BODY EACH OTHER DAY (A)', new Date(2026, 9, 12, 19)), // Mon, the latest
      ],
    };
    const routine = inferRoutine(log, 'hevy')!;
    expect(routine.name).toBe('FULL BODY EACH OTHER DAY');
    // Monday was trained as A once and B once: the most recent wins.
    expect(routine.days.map((d) => [d.name, d.weekdays])).toEqual([
      ['FULL BODY EACH OTHER DAY (A)', [1, 6]],
      ['FULL BODY EACH OTHER DAY (B)', []],
    ]);
  });

  it('makes no routine from sessions that were never from one', () => {
    expect(
      inferRoutine(readExport([fixture('strong.csv')], { strongUnit: 'kg' }), 'strong'),
    ).toBeNull();
  });
});
