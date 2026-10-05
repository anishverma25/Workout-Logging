import { addDays, addMinutes, differenceInCalendarDays, startOfDay } from '@/lib/dates';
import { seededId } from '@/lib/ids';
import { createRng, type Rng } from '@/lib/random';
import { roundTo } from '@/lib/units';
import type {
  BodyWeightEntry,
  Profile,
  Routine,
  RoutineDay,
  RoutineExercise,
  SetType,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/domain/models/schemas';
import { exerciseIdFor, SYSTEM_EXERCISES } from '../library/exercises';
import { DEMO_PROFILE, DEMO_PROGRAM, DEMO_ROUTINE, type ProgramExercise } from './program';

/** Total history generated. The last 7 days are the featured week; earlier weeks give PRs and trends a baseline. */
export const DEMO_HISTORY_DAYS = 35;
export const DEMO_FEATURED_DAYS = 7;
export const DEMO_SEED = 20_261_005;

export interface DemoDataset {
  profile: Profile;
  routines: Routine[];
  routineDays: RoutineDay[];
  routineExercises: RoutineExercise[];
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  sets: WorkoutSet[];
  bodyWeights: BodyWeightEntry[];
}

interface LiftState {
  weightKg: number | null;
  baseReps: number;
  /** Best estimated 1RM so far, used to script the featured record. */
  bestE1rm: number;
  lastFirstReps: number | null;
  lastWeightKg: number | null;
}

const iso = (d: Date) => d.toISOString();
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const exerciseNames = new Map(SYSTEM_EXERCISES.map((e) => [e.id, e.name]));

/**
 * Builds the complete fictional dataset relative to `now`.
 * Pure and deterministic: the same seed and calendar day always produce identical records.
 * Nothing is generated for today, so "Today's workout" is still open to start.
 */
export function generateDemoDataset(now: Date, seed: number = DEMO_SEED): DemoDataset {
  const rng = createRng(seed);
  const idRng = createRng(seed ^ 0x5eed);
  const id = () => seededId(idRng);
  const today = startOfDay(now);
  const firstDay = addDays(today, -DEMO_HISTORY_DAYS);
  const featuredStart = addDays(today, -(DEMO_FEATURED_DAYS - 1));
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const meta = (at: Date) => ({
    createdAt: iso(at),
    updatedAt: iso(at),
    deletedAt: null,
    origin: 'demo' as const,
  });

  // Profile
  const birthYear = now.getFullYear() - DEMO_PROFILE.age - (isBeforeBirthday(now) ? 1 : 0);
  const profile: Profile = {
    id: id(),
    ...meta(addDays(firstDay, -1)),
    displayName: DEMO_PROFILE.displayName,
    birthDate: `${birthYear}-${DEMO_PROFILE.birthMonthDay}`,
    goal: DEMO_PROFILE.goal,
    experience: DEMO_PROFILE.experience,
  };

  // Routine
  const routineCreated = addDays(firstDay, -1);
  const routine: Routine = {
    id: id(),
    ...meta(routineCreated),
    name: DEMO_ROUTINE.name,
    description: DEMO_ROUTINE.description,
    isActive: true,
  };
  const routineDays: RoutineDay[] = [];
  const routineExercises: RoutineExercise[] = [];
  const dayByKey = new Map<string, RoutineDay>();
  DEMO_PROGRAM.forEach((day, order) => {
    const rd: RoutineDay = {
      id: id(),
      ...meta(routineCreated),
      routineId: routine.id,
      name: day.name,
      order,
      weekdays: day.weekdays,
    };
    routineDays.push(rd);
    dayByKey.set(day.key, rd);
    day.exercises.forEach((ex, exOrder) => {
      routineExercises.push({
        id: id(),
        ...meta(routineCreated),
        routineDayId: rd.id,
        exerciseId: exerciseIdFor(ex.key),
        order: exOrder,
        targetSets: ex.sets,
        repMin: ex.repMin,
        repMax: ex.repMax,
        targetRir: ex.rir,
        restSeconds: ex.restSeconds,
        notes: null,
      });
    });
  });

  // Training days: which planned sessions happened.
  const planned: { date: Date; dayKey: ProgramDayKey }[] = [];
  for (let d = firstDay; d < today; d = addDays(d, 1)) {
    const day = DEMO_PROGRAM.find((p) => p.weekdays.includes(d.getDay()));
    if (day) planned.push({ date: d, dayKey: day.key });
  }
  const featuredPull = planned.find((p) => p.date >= featuredStart && p.dayKey === 'pull');
  const sessionsToLog = planned.filter((p) => {
    if (p === featuredPull) return false; // one missed session in the featured week
    if (p.date >= featuredStart) return true;
    return !rng.chance(0.14); // occasional missed sessions earlier on
  });

  // Final key sessions are scripted so the featured week tells a clear, realistic story:
  // a good bench day (record) and a poor squat day after a short night (below best).
  const lastBench = [...sessionsToLog].reverse().find((s) => s.dayKey === 'push');
  const lastLegs = [...sessionsToLog].reverse().find((s) => s.dayKey === 'legs');

  const state = new Map<string, LiftState>();
  for (const day of DEMO_PROGRAM) {
    for (const ex of day.exercises) {
      state.set(ex.key, {
        weightKg: ex.startKg ?? null,
        baseReps: ex.startReps ?? ex.repMin,
        bestE1rm: 0,
        lastFirstReps: null,
        lastWeightKg: null,
      });
    }
  }

  const workouts: Workout[] = [];
  const workoutExercises: WorkoutExercise[] = [];
  const sets: WorkoutSet[] = [];

  for (const session of sessionsToLog) {
    const program = DEMO_PROGRAM.find((p) => p.key === session.dayKey)!;
    const routineDay = dayByKey.get(session.dayKey)!;
    const isSaturday = session.date.getDay() === 6;
    const startedAt = addMinutes(
      session.date,
      isSaturday ? 9 * 60 + rng.int(0, 50) : 18 * 60 + rng.int(0, 95),
    );
    const workoutId = id();
    let clock = addMinutes(startedAt, rng.int(5, 9)); // getting set up, general warm-up
    let note: string | null = null;

    const dayReadiness =
      session === lastBench ? 1 : session === lastLegs ? -1 : rng.pick([-1, 0, 0, 0, 1]);
    if (session === lastLegs)
      note = 'Short on sleep. Squats felt heavy, kept the rest of the session honest.';
    else if (rng.chance(0.12))
      note = rng.pick([
        'Gym was packed, waited for the rack.',
        'Felt strong today.',
        'Left shoulder a bit tight on presses.',
      ]);

    program.exercises.forEach((ex, order) => {
      const exerciseId = exerciseIdFor(ex.key);
      const we: WorkoutExercise = {
        id: id(),
        ...meta(startedAt),
        workoutId,
        exerciseId,
        exerciseName: exerciseNames.get(exerciseId) ?? ex.key,
        order,
        notes: null,
        target: { sets: ex.sets, repMin: ex.repMin, repMax: ex.repMax, rir: ex.rir },
      };
      workoutExercises.push(we);

      const lift = state.get(ex.key)!;
      // The scripted readiness applies to the first exercise of the day (the main lift).
      const readiness =
        order === 0 ? dayReadiness : clamp(dayReadiness + rng.pick([-1, 0, 0, 0, 0, 1]), -1, 1);
      // On the featured bench day, the top set is good enough to beat the previous best e1RM.
      let minFirstReps = 0;
      if (session === lastBench && order === 0 && lift.weightKg) {
        minFirstReps = Math.floor(30 * (lift.bestE1rm / lift.weightKg - 1)) + 1;
      }
      // On the featured legs day the main lift falls two reps short of last time at the same load.
      const isBadDayLift = session === lastLegs && order === 0 && lift.lastFirstReps !== null;
      // A bad day: the lifter keeps last session's load rather than taking the planned increase.
      if (isBadDayLift && lift.lastWeightKg !== null) lift.weightKg = lift.lastWeightKg;
      // Target about 5% under the best e1RM at that load, never below the bottom of the range minus one.
      const maxFirstReps =
        isBadDayLift && lift.weightKg
          ? Math.max(ex.repMin - 1, Math.floor(30 * ((0.95 * lift.bestE1rm) / lift.weightKg - 1)))
          : 99;
      const performed = performExercise(ex, lift, readiness, rng, minFirstReps, maxFirstReps);
      let setOrder = 0;
      for (const s of performed) {
        clock = addMinutes(clock, s.restBeforeMin);
        sets.push({
          id: id(),
          ...meta(clock),
          workoutId,
          workoutExerciseId: we.id,
          exerciseId,
          order: setOrder++,
          setType: s.type,
          weightKg: s.weightKg,
          reps: s.reps,
          rir: s.rir,
          rpe: null,
          durationSec: null,
          distanceM: null,
          completedAt: iso(clock),
          notes: null,
        });
      }
      clock = addMinutes(clock, rng.between(1.5, 3)); // moving to the next station
    });

    const endedAt = addMinutes(clock, rng.int(2, 5));
    workouts.push({
      id: workoutId,
      createdAt: iso(startedAt),
      updatedAt: iso(endedAt),
      deletedAt: null,
      origin: 'demo',
      name: program.name,
      routineId: routine.id,
      routineDayId: routineDay.id,
      status: 'completed',
      startedAt: iso(startedAt),
      endedAt: iso(endedAt),
      notes: note,
      timeZone,
    });
  }

  // Body weight: most mornings, a slow upward trend with day-to-day water noise.
  const bodyWeights: BodyWeightEntry[] = [];
  for (let d = firstDay; d < today; d = addDays(d, 1)) {
    const daysAgo = differenceInCalendarDays(today, d);
    const isLast = daysAgo === 1;
    const recent = daysAgo <= DEMO_FEATURED_DAYS;
    if (!isLast && !rng.chance(recent ? 0.8 : 0.6)) continue;
    const t = 1 - daysAgo / DEMO_HISTORY_DAYS;
    const trend =
      DEMO_PROFILE.bodyWeightStartKg +
      (DEMO_PROFILE.bodyWeightKg - DEMO_PROFILE.bodyWeightStartKg) * t;
    const kg = isLast ? DEMO_PROFILE.bodyWeightKg : Math.round((trend + rng.noise(0.45)) * 10) / 10;
    const at = addMinutes(d, 7 * 60 + rng.int(0, 50));
    bodyWeights.push({
      id: id(),
      ...meta(at),
      measuredAt: iso(at),
      weightKg: kg,
      enteredUnit: 'kg',
      note: null,
    });
  }

  return {
    profile,
    routines: [routine],
    routineDays,
    routineExercises,
    workouts,
    workoutExercises,
    sets,
    bodyWeights,
  };
}

type ProgramDayKey = (typeof DEMO_PROGRAM)[number]['key'];

function isBeforeBirthday(now: Date): boolean {
  const [m, d] = DEMO_PROFILE.birthMonthDay.split('-').map(Number) as [number, number];
  return now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d);
}

interface PerformedSet {
  type: SetType;
  weightKg: number | null;
  reps: number;
  rir: number | null;
  restBeforeMin: number;
}

/**
 * One exercise in one session, using double progression:
 * reps climb within the range at a fixed load; once every working set reaches the top
 * of the range, the load goes up and reps reset. Readiness shifts the day up or down.
 */
function performExercise(
  ex: ProgramExercise,
  lift: LiftState,
  readiness: number,
  rng: Rng,
  minFirstReps = 0,
  maxFirstReps = 99,
): PerformedSet[] {
  const out: PerformedSet[] = [];
  const restMin = ex.restSeconds / 60;
  const w = lift.weightKg;
  const restJitter = () => rng.between(0.85, 1.25);

  // Warm-ups
  if (w !== null && ex.warmups) {
    const ramps =
      ex.warmups === 2
        ? [
            [0.5, 8],
            [0.7, 5],
          ]
        : [[0.6, 8]];
    ramps.forEach(([pct, reps], i) => {
      out.push({
        type: 'warmup',
        weightKg: Math.max(20, roundTo(w * (pct as number), ex.incrementKg ?? 2.5)),
        reps: reps as number,
        rir: null,
        restBeforeMin: i === 0 ? 0 : rng.between(1, 1.6),
      });
    });
  }

  // Working sets with fatigue across sets
  const firstReps = Math.min(
    Math.max(
      clamp(lift.baseReps + readiness, Math.max(1, ex.repMin - 1), ex.repMax + 1),
      Math.min(minFirstReps, ex.repMax + 2),
    ),
    Math.max(1, maxFirstReps),
  );
  lift.lastFirstReps = firstReps;
  lift.lastWeightKg = w;
  let reps = firstReps;
  const working: number[] = [];
  for (let i = 0; i < ex.sets; i++) {
    if (i > 0 && rng.chance(i === 1 ? 0.4 : 0.55)) reps -= 1;
    const r = Math.max(1, Math.max(ex.repMin - 3, reps));
    working.push(r);
    const target = ex.rir ?? 2;
    const rir = clamp(
      Math.round(target - i * 0.7 - (readiness < 0 ? 0.6 : 0) + rng.noise(0.5)),
      0,
      4,
    );
    out.push({
      type: 'working',
      weightKg: w,
      reps: r,
      rir,
      restBeforeMin: out.length === 0 ? 0 : restMin * restJitter(),
    });
  }

  // Back-off set at about 85%
  if (w !== null && ex.backoff) {
    out.push({
      type: 'backoff',
      weightKg: roundTo(w * 0.85, ex.incrementKg ?? 2.5),
      reps: Math.min(firstReps + 3, ex.repMax + 3),
      rir: rng.pick([1, 2, 2]),
      restBeforeMin: restMin * restJitter(),
    });
  }

  // Drop set straight after the last working set
  if (w !== null && ex.dropOnLastSet) {
    out.push({
      type: 'drop',
      weightKg: Math.max(ex.incrementKg ?? 2.5, w - (ex.incrementKg ?? 2.5)),
      reps: rng.int(7, 10),
      rir: 0,
      restBeforeMin: 0.2,
    });
  }

  for (const s of out) {
    if (s.type !== 'warmup' && s.weightKg && s.reps <= 12) {
      lift.bestE1rm = Math.max(
        lift.bestE1rm,
        s.reps === 1 ? s.weightKg : s.weightKg * (1 + s.reps / 30),
      );
    }
  }

  // Progression for next time
  if (readiness >= 0) {
    if (working.every((r) => r >= ex.repMax)) {
      if (w !== null) {
        // After a load increase, reps follow from demonstrated strength (top-set e1RM at the new load).
        const next = w + (ex.incrementKg ?? 2.5);
        const capability = w * (1 + firstReps / 30);
        const predicted = Math.floor(30 * (capability / next - 1)) - rng.pick([0, 0, 1]);
        lift.weightKg = next;
        lift.baseReps = clamp(predicted, ex.repMin, ex.repMax - 1);
      }
    } else if (firstReps >= lift.baseReps && (readiness > 0 || rng.chance(0.6))) {
      // Rep gains are not guaranteed every session; stalls are normal.
      lift.baseReps = Math.min(lift.baseReps + 1, ex.repMax);
    }
  }
  return out;
}
