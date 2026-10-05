/**
 * The demo athlete's Push / Pull / Legs program and starting strength levels.
 * Fictional data for development and demos only.
 */

export interface ProgramExercise {
  key: string;
  sets: number;
  repMin: number;
  repMax: number;
  rir: number | null;
  restSeconds: number;
  /** Starting working load in kg. Omitted for bodyweight exercises. */
  startKg?: number;
  incrementKg?: number;
  /** Starting first-set reps for bodyweight exercises. */
  startReps?: number;
  warmups?: 0 | 1 | 2;
  backoff?: boolean;
  dropOnLastSet?: boolean;
}

export interface ProgramDay {
  key: 'push' | 'pull' | 'legs';
  name: string;
  /** Date#getDay() numbers. */
  weekdays: number[];
  exercises: ProgramExercise[];
}

export const DEMO_PROFILE = {
  displayName: 'Arjun Mehta',
  age: 20,
  birthMonthDay: '03-14',
  goal: 'strength_hypertrophy' as const,
  experience: 'intermediate' as const,
  /** Latest recorded body weight. */
  bodyWeightKg: 67,
  bodyWeightStartKg: 66.3,
};

export const DEMO_ROUTINE = {
  name: 'Push Pull Legs',
  description: 'Six-day split. Each day twice a week, double progression on every lift.',
};

export const DEMO_PROGRAM: ProgramDay[] = [
  {
    key: 'push',
    name: 'Push',
    weekdays: [1, 4],
    exercises: [
      {
        key: 'barbell-bench-press',
        sets: 3,
        repMin: 5,
        repMax: 8,
        rir: 2,
        restSeconds: 180,
        startKg: 65,
        incrementKg: 2.5,
        warmups: 2,
        backoff: true,
      },
      {
        key: 'incline-dumbbell-press',
        sets: 3,
        repMin: 8,
        repMax: 12,
        rir: 2,
        restSeconds: 120,
        startKg: 22,
        incrementKg: 2,
      },
      {
        key: 'overhead-press',
        sets: 3,
        repMin: 6,
        repMax: 10,
        rir: 2,
        restSeconds: 150,
        startKg: 37.5,
        incrementKg: 2.5,
      },
      {
        key: 'cable-lateral-raise',
        sets: 3,
        repMin: 12,
        repMax: 15,
        rir: 1,
        restSeconds: 75,
        startKg: 7.5,
        incrementKg: 2.5,
        dropOnLastSet: true,
      },
      {
        key: 'triceps-rope-pushdown',
        sets: 3,
        repMin: 10,
        repMax: 15,
        rir: 1,
        restSeconds: 75,
        startKg: 25,
        incrementKg: 2.5,
      },
      {
        key: 'cable-fly',
        sets: 2,
        repMin: 12,
        repMax: 15,
        rir: 1,
        restSeconds: 75,
        startKg: 15,
        incrementKg: 2.5,
      },
    ],
  },
  {
    key: 'pull',
    name: 'Pull',
    weekdays: [2, 5],
    exercises: [
      { key: 'pull-up', sets: 3, repMin: 6, repMax: 10, rir: 2, restSeconds: 150, startReps: 7 },
      {
        key: 'barbell-row',
        sets: 3,
        repMin: 6,
        repMax: 10,
        rir: 2,
        restSeconds: 150,
        startKg: 57.5,
        incrementKg: 2.5,
        warmups: 1,
      },
      {
        key: 'lat-pulldown',
        sets: 3,
        repMin: 8,
        repMax: 12,
        rir: 2,
        restSeconds: 120,
        startKg: 52.5,
        incrementKg: 2.5,
      },
      {
        key: 'face-pull',
        sets: 3,
        repMin: 12,
        repMax: 15,
        rir: 2,
        restSeconds: 75,
        startKg: 20,
        incrementKg: 2.5,
      },
      {
        key: 'dumbbell-curl',
        sets: 3,
        repMin: 8,
        repMax: 12,
        rir: 1,
        restSeconds: 75,
        startKg: 12,
        incrementKg: 2,
      },
      {
        key: 'hammer-curl',
        sets: 2,
        repMin: 10,
        repMax: 12,
        rir: 1,
        restSeconds: 75,
        startKg: 14,
        incrementKg: 2,
      },
    ],
  },
  {
    key: 'legs',
    name: 'Legs',
    weekdays: [3, 6],
    exercises: [
      {
        key: 'back-squat',
        sets: 3,
        repMin: 5,
        repMax: 8,
        rir: 2,
        restSeconds: 180,
        startKg: 85,
        incrementKg: 2.5,
        warmups: 2,
        backoff: true,
      },
      {
        key: 'romanian-deadlift',
        sets: 3,
        repMin: 8,
        repMax: 10,
        rir: 2,
        restSeconds: 150,
        startKg: 72.5,
        incrementKg: 2.5,
        warmups: 1,
      },
      {
        key: 'leg-press',
        sets: 3,
        repMin: 10,
        repMax: 12,
        rir: 2,
        restSeconds: 120,
        startKg: 140,
        incrementKg: 5,
      },
      {
        key: 'lying-leg-curl',
        sets: 3,
        repMin: 10,
        repMax: 12,
        rir: 1,
        restSeconds: 90,
        startKg: 40,
        incrementKg: 2.5,
      },
      {
        key: 'standing-calf-raise',
        sets: 3,
        repMin: 10,
        repMax: 15,
        rir: 1,
        restSeconds: 75,
        startKg: 60,
        incrementKg: 5,
      },
      {
        key: 'hanging-leg-raise',
        sets: 3,
        repMin: 10,
        repMax: 15,
        rir: 2,
        restSeconds: 75,
        startReps: 10,
      },
    ],
  },
];
