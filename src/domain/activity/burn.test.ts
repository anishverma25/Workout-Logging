import type { ActivityLog, BodyWeightEntry, Workout, WorkoutSet } from '../models/schemas';
import {
  dayBurn,
  estimateCardio,
  estimateSteps,
  estimateWorkout,
  hardSetShare,
  netKcal,
  outdoorCyclingMet,
  rowingMetByWatts,
  strideM,
  walkingVo2,
  weightOn,
  workoutMinutes,
} from './burn';

describe('cardio estimates', () => {
  it('uses the ACSM walking equation on a treadmill', () => {
    // 5 km/h is 83.3 m/min: VO2 = 0.1 x 83.3 + 3.5 = 11.8, a MET of 3.4.
    const flat = estimateCardio({
      activity: 'treadmill_walk',
      minutes: 30,
      weightKg: 70,
      speedKmh: 5,
    })!;
    expect(flat.met).toBe(3.4);
    expect(flat.kcal).toBe(83);
    // A 5% incline adds 1.8 x speed x grade: 7.5 ml/kg/min.
    expect(walkingVo2(5, 5)).toBeCloseTo(19.33, 1);
    const hill = estimateCardio({
      activity: 'treadmill_walk',
      minutes: 30,
      weightKg: 70,
      speedKmh: 5,
      inclinePct: 5,
    })!;
    expect(hill.kcal).toBe(158);
  });

  it('uses the running equation and works speed out from distance', () => {
    const run = estimateCardio({
      activity: 'treadmill_run',
      minutes: 30,
      weightKg: 70,
      speedKmh: 9,
    })!;
    expect(run.kcal).toBe(300);
    const byDistance = estimateCardio({
      activity: 'run_outdoor',
      minutes: 30,
      weightKg: 70,
      distanceKm: 4.5,
    })!;
    expect(byDistance.kcal).toBe(300);
    expect(byDistance.basis).toMatch(/9\.0 km\/h/);
  });

  it('uses watts for a gym bike, and effort without them', () => {
    const watts = estimateCardio({
      activity: 'cycle_indoor',
      minutes: 30,
      weightKg: 70,
      watts: 100,
    })!;
    expect(watts.kcal).toBeGreaterThan(180);
    expect(watts.kcal).toBeLessThan(200);
    const light = estimateCardio({
      activity: 'cycle_indoor',
      minutes: 60,
      weightKg: 70,
      effort: 'light',
    })!;
    const hard = estimateCardio({
      activity: 'cycle_indoor',
      minutes: 60,
      weightKg: 70,
      effort: 'hard',
    })!;
    expect(light.kcal).toBe(Math.round(2.5 * 70));
    expect(hard.kcal).toBe(Math.round(7.8 * 70));
  });

  it('gives the stair machine one Compendium value whatever the effort', () => {
    const a = estimateCardio({
      activity: 'stair_machine',
      minutes: 20,
      weightKg: 80,
      effort: 'light',
    })!;
    const b = estimateCardio({
      activity: 'stair_machine',
      minutes: 20,
      weightKg: 80,
      effort: 'hard',
    })!;
    expect(a.kcal).toBe(b.kcal);
    expect(a.met).toBe(9.3);
    expect(a.kcal).toBe(Math.round(8.3 * 80 * (20 / 60)));
  });

  it('scales with weight and time, and gives nothing for nothing', () => {
    expect(netKcal(5, 100, 60)).toBe(400);
    expect(netKcal(0.5, 100, 60)).toBe(0);
    expect(estimateCardio({ activity: 'hiit', minutes: 0, weightKg: 70 })).toBeNull();
    expect(estimateCardio({ activity: 'hiit', minutes: 20, weightKg: 0 })).toBeNull();
  });

  it('bands outdoor cycling and rowing', () => {
    expect(outdoorCyclingMet(12)).toBe(4);
    expect(outdoorCyclingMet(20)).toBe(8);
    expect(outdoorCyclingMet(30)).toBe(12);
    expect(rowingMetByWatts(90)).toBe(5);
    expect(rowingMetByWatts(180)).toBe(11);
  });
});

describe('steps', () => {
  it('turns steps into distance with a stride from height, then into net calories', () => {
    expect(strideM(173)).toBeCloseTo(0.716, 2);
    expect(strideM(null)).toBe(0.7);
    const e = estimateSteps({ steps: 10000, weightKg: 70, heightCm: 173 })!;
    expect(e.kcal).toBe(251);
    expect(e.basis).toMatch(/7\.2 km/);
    expect(estimateSteps({ steps: 0, weightKg: 70 })).toBeNull();
  });
});

const T0 = '2026-10-22T10:00:00.000Z';
const set = (over: Partial<WorkoutSet>): WorkoutSet => ({
  id: 'x',
  createdAt: T0,
  updatedAt: T0,
  deletedAt: null,
  origin: 'user',
  workoutId: 'w',
  workoutExerciseId: 'we',
  exerciseId: 'e',
  order: 0,
  setType: 'working',
  weightKg: 50,
  reps: 8,
  rir: null,
  rpe: null,
  durationSec: null,
  distanceM: null,
  completedAt: T0,
  notes: null,
  ...over,
});

describe('workout estimates', () => {
  it('counts the share of hard sets, ignoring warm-ups and sets with no effort', () => {
    expect(hardSetShare([])).toBeNull();
    expect(hardSetShare([set({})])).toBeNull();
    const sets = [
      set({ rir: 1 }),
      set({ rir: 3 }),
      set({ rpe: 9 }),
      set({ rpe: 6 }),
      set({ rir: 0, setType: 'warmup' }),
      set({ rir: 0, completedAt: null }),
    ];
    expect(hardSetShare(sets)).toBe(0.5);
  });

  it('sits between 3.5 and 6.0 METs by how hard the sets were', () => {
    const easy = estimateWorkout({ minutes: 60, weightKg: 80, hardShare: 0 })!;
    const hard = estimateWorkout({ minutes: 60, weightKg: 80, hardShare: 1 })!;
    const unknown = estimateWorkout({ minutes: 60, weightKg: 80, hardShare: null })!;
    expect(easy.kcal).toBe(200);
    expect(hard.kcal).toBe(400);
    expect(unknown.kcal).toBe(300);
    expect(unknown.basis).toMatch(/middle effort/);
  });

  it('measures minutes without pauses, and counts a running workout up to now', () => {
    const w = {
      startedAt: '2026-10-22T10:00:00.000Z',
      endedAt: '2026-10-22T11:10:00.000Z',
      pausedAt: null,
      pausedMs: 10 * 60_000,
    } as Workout;
    expect(workoutMinutes(w)).toBe(60);
    const running = { ...w, endedAt: null, pausedMs: 0 } as Workout;
    expect(workoutMinutes(running, new Date('2026-10-22T10:30:00.000Z'))).toBe(30);
    const paused = { ...running, pausedAt: '2026-10-22T10:20:00.000Z' } as Workout;
    expect(workoutMinutes(paused, new Date('2026-10-22T10:45:00.000Z'))).toBe(20);
  });
});

describe('weight and the day', () => {
  const w = (measuredAt: string, weightKg: number): BodyWeightEntry => ({
    id: measuredAt,
    createdAt: measuredAt,
    updatedAt: measuredAt,
    deletedAt: null,
    origin: 'user',
    measuredAt,
    weightKg,
    enteredUnit: 'kg',
    note: null,
  });
  it('uses the latest weigh-in up to the day, else the first one', () => {
    const list = [w('2026-10-01T06:00:00.000Z', 82), w('2026-10-15T06:00:00.000Z', 80)];
    expect(weightOn(list, '2026-10-10')).toBe(82);
    expect(weightOn(list, '2026-10-20')).toBe(80);
    expect(weightOn(list, '2026-09-01')).toBe(82);
    expect(weightOn([], '2026-10-20')).toBeNull();
  });

  const log = (
    kind: ActivityLog['kind'],
    kcal: number,
    source: ActivityLog['kcalSource'],
    date = '2026-10-22',
  ): ActivityLog => ({
    id: String(Math.random()),
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    origin: 'user',
    date,
    kind,
    activity: kind === 'cardio' ? 'treadmill_walk' : null,
    minutes: null,
    distanceKm: null,
    speedKmh: null,
    inclinePct: null,
    watts: null,
    effort: null,
    steps: null,
    kcal,
    kcalSource: source,
  });
  it('adds up workout, cardio and steps for a day', () => {
    const d = dayBurn({
      logs: [
        log('cardio', 150, 'typed'),
        log('steps', 200, 'estimated'),
        log('cardio', 99, 'typed', '2026-10-21'),
      ],
      date: '2026-10-22',
      workoutKcal: 250,
    });
    expect(d).toEqual({
      workoutKcal: 250,
      cardioKcal: 150,
      stepsKcal: 200,
      total: 600,
      estimated: true,
    });
    const typed = dayBurn({
      logs: [log('cardio', 150, 'typed')],
      date: '2026-10-22',
      workoutKcal: 0,
    });
    expect(typed.estimated).toBe(false);
  });
});
