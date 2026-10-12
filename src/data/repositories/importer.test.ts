import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readExport } from '@/domain/import/formats';
import { planImport, type ExerciseChoice } from '@/domain/import/plan';
import { buildSessions } from '@/domain/analytics/sessions';
import { WorkoutDatabase } from '../db';
import { applyImport } from './importer';
import { ensureSystemExercises } from './training';

/**
 * Saving an import: ordinary records that sync, the person's choices respected, and the same
 * export imported twice adds nothing.
 */

const fixture = (name: string) => ({
  name,
  text: readFileSync(join(__dirname, '../../domain/import/fixtures', name), 'utf8'),
});

let db: WorkoutDatabase;
let n = 0;
beforeEach(async () => {
  db = new WorkoutDatabase(`import-${++n}`, { syncEnabled: true });
  await db.open();
  await ensureSystemExercises(db);
});
afterEach(async () => {
  await db.delete();
});

async function importHevy(namespace = 'user-a') {
  const log = readExport([fixture('hevy-workouts.csv'), fixture('hevy-measurements.csv')], {
    strongUnit: 'kg',
  });
  const plan = planImport(log, await db.exercises.toArray());
  const choices: Record<string, ExerciseChoice> = Object.fromEntries(
    plan.exercises.map((e) => [e.name, e.choice]),
  );
  return { log, plan, choices, result: await applyImport(db, log, choices, namespace) };
}

describe('applyImport', () => {
  it('saves workouts, sets, custom exercises and body data as synced user records', async () => {
    const { result } = await importHevy();
    expect(result).toMatchObject({
      workoutsAdded: 2,
      workoutsSkipped: 0,
      setsAdded: 13,
      bodyWeightsAdded: 2,
      measurementsAdded: 1,
      dropped: 0,
    });
    // Pullover, single-arm pushdown and Kelso shrugs have no library match.
    expect(result.exercisesCreated).toBe(3);

    const workouts = await db.workouts.toArray();
    expect(workouts.every((w) => w.origin === 'user' && w.status === 'completed')).toBe(true);
    const sets = await db.sets.toArray();
    expect(sets.every((s) => s.completedAt !== null)).toBe(true);
    // RPE 8 becomes RIR 2, so hard-set counts work on imported training too.
    expect(sets.find((s) => s.rpe === 8)!.rir).toBe(2);
    const custom = (await db.exercises.toArray()).filter((e) => e.isCustom);
    expect(custom.map((e) => e.name).sort()).toEqual([
      'KELSO SHRUGS (seat full down)',
      'Pullover (Dumbbell)',
      'Single Arm Triceps Pushdown (Cable)',
    ]);
    // Everything is queued to sync to the account.
    const queued = await db.outbox.count();
    expect(queued).toBe(2 + 10 + 13 + 3 + 2 + 1);
  });

  it('feeds the same analytics as training logged in the app', async () => {
    await importHevy();
    const exercises = await db.exercises.toArray();
    const sessions = buildSessions({
      profile: null,
      exercises,
      routines: [],
      routineDays: [],
      routineExercises: [],
      workouts: await db.workouts.toArray(),
      workoutExercises: await db.workoutExercises.toArray(),
      sets: await db.sets.toArray(),
      bodyWeights: [],
      measurements: [],
      goals: [],
    });
    expect(sessions).toHaveLength(2);
    const bench = exercises.find((e) => e.name === 'Barbell bench press')!;
    const upper = sessions.find((s) => s.workout.name === 'Upper A')!;
    expect(upper.exercises.some((e) => e.exercise?.id === bench.id)).toBe(true);
  });

  it('adds nothing when the same export is imported again, even after a deletion', async () => {
    await importHevy();
    const first = await db.workouts.toArray();
    await db.workouts.update(first[0]!.id, { deletedAt: new Date().toISOString() });
    const { result } = await importHevy();
    expect(result).toMatchObject({
      workoutsAdded: 0,
      workoutsSkipped: 2,
      setsAdded: 0,
      exercisesCreated: 0,
      bodyWeightsAdded: 0,
      measurementsAdded: 0,
    });
    expect(await db.workouts.count()).toBe(2);
    // The deleted one stays deleted.
    expect((await db.workouts.get(first[0]!.id))!.deletedAt).not.toBeNull();
  });

  it('keeps ids apart between accounts, so the server never sees a clash', async () => {
    await importHevy('user-a');
    const a = (await db.workouts.toArray()).map((w) => w.id);
    const other = new WorkoutDatabase(`import-other-${n}`, { syncEnabled: true });
    await other.open();
    await ensureSystemExercises(other);
    const log = readExport([fixture('hevy-workouts.csv')], { strongUnit: 'kg' });
    const plan = planImport(log, await other.exercises.toArray());
    await applyImport(
      other,
      log,
      Object.fromEntries(plan.exercises.map((e) => [e.name, e.choice])),
      'user-b',
    );
    const b = (await other.workouts.toArray()).map((w) => w.id);
    expect(b.some((id) => a.includes(id))).toBe(false);
    await other.delete();
  });

  it('follows the person’s choices, and leaves out impossible values', async () => {
    const log = readExport([fixture('hevy-workouts.csv')], { strongUnit: 'kg' });
    log.workouts[1]!.exercises[0]!.sets[1]!.weightKg = 2000;
    const plan = planImport(log, await db.exercises.toArray());
    const legPress = (await db.exercises.toArray()).find((e) => e.name === 'Hack squat')!;
    const choices: Record<string, ExerciseChoice> = Object.fromEntries(
      plan.exercises.map((e) => [e.name, e.choice]),
    );
    choices['Leg Press (Machine)'] = { kind: 'existing', exerciseId: legPress.id };
    const result = await applyImport(db, log, choices, 'user-a');
    expect(result.dropped).toBe(1);
    expect(result.setsAdded).toBe(12);
    const we = (await db.workoutExercises.toArray()).find((e) => e.exerciseId === legPress.id);
    expect(we?.exerciseName).toBe('Hack squat');
  });
});
