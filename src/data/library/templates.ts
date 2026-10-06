/**
 * Routine templates. Starting points only: every day, exercise and target is editable,
 * and none of them is presented as the right program for everyone.
 *
 * Weekdays use Date#getDay() numbers (0 = Sunday). They are suggestions for when each day
 * happens, which is what lets the app measure adherence. Users can change them.
 */

export interface TemplateExercise {
  key: string;
  sets: number;
  repMin: number;
  repMax: number;
  rir: number | null;
  rest: number;
}

export interface TemplateDay {
  name: string;
  weekdays: number[];
  exercises: TemplateExercise[];
}

export interface RoutineTemplate {
  key: string;
  name: string;
  /** Short line shown on the template card. */
  summary: string;
  daysPerWeek: number;
  days: TemplateDay[];
}

const c = (key: string, sets = 3, repMin = 6, repMax = 10, rir: number | null = 2, rest = 150) => ({
  key,
  sets,
  repMin,
  repMax,
  rir,
  rest,
});
const i = (key: string, sets = 3, repMin = 10, repMax = 15, rir: number | null = 1, rest = 90) => ({
  key,
  sets,
  repMin,
  repMax,
  rir,
  rest,
});

const push = (weekdays: number[]): TemplateDay => ({
  name: 'Push',
  weekdays,
  exercises: [
    c('barbell-bench-press', 3, 5, 8, 2, 180),
    c('incline-dumbbell-press', 3, 8, 12),
    c('seated-dumbbell-press', 3, 8, 12),
    i('cable-lateral-raise', 3, 12, 15),
    i('triceps-rope-pushdown'),
  ],
});
const pull = (weekdays: number[]): TemplateDay => ({
  name: 'Pull',
  weekdays,
  exercises: [
    c('lat-pulldown', 3, 8, 12),
    c('barbell-row', 3, 6, 10),
    c('seated-cable-row', 3, 10, 12),
    i('face-pull', 3, 12, 15),
    i('dumbbell-curl', 3, 8, 12),
  ],
});
const legs = (weekdays: number[]): TemplateDay => ({
  name: 'Legs',
  weekdays,
  exercises: [
    c('back-squat', 3, 5, 8, 2, 180),
    c('romanian-deadlift', 3, 6, 10),
    c('leg-press', 3, 10, 12),
    i('lying-leg-curl', 3, 10, 12),
    i('standing-calf-raise', 3, 10, 15),
  ],
});

/** Lighter upper day for the 5-day hybrids: different angles and more reps than Push and Pull. */
const upperVolume = (weekdays: number[]): TemplateDay => ({
  name: 'Upper',
  weekdays,
  exercises: [
    c('incline-barbell-bench-press', 3, 8, 10),
    c('chest-supported-row', 3, 8, 12),
    c('machine-shoulder-press', 3, 10, 12),
    c('close-grip-lat-pulldown', 3, 10, 12),
    i('cable-fly', 2, 12, 15),
    i('incline-dumbbell-curl', 2, 10, 15),
    i('overhead-triceps-extension', 2, 10, 15),
  ],
});
/** Lower day for the 5-day hybrids: hinge and single-leg focus, so legs are hit two ways. */
const lowerVolume = (weekdays: number[]): TemplateDay => ({
  name: 'Lower',
  weekdays,
  exercises: [
    c('romanian-deadlift', 3, 6, 10, 2, 180),
    c('hack-squat', 3, 8, 12),
    c('bulgarian-split-squat', 3, 8, 12),
    i('seated-leg-curl', 3, 10, 15),
    i('seated-calf-raise', 3, 12, 15),
    i('hanging-leg-raise', 2, 8, 15),
  ],
});

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    key: 'ppl',
    name: 'Push Pull Legs',
    summary: 'Six days. Pressing, pulling and legs on separate days, each twice a week.',
    daysPerWeek: 6,
    days: [push([1, 4]), pull([2, 5]), legs([3, 6])],
  },
  {
    key: 'pplul',
    name: 'Push Pull Legs Upper Lower',
    summary:
      'Five days. Push, pull and legs, then an upper and a lower day, so every muscle is trained twice a week.',
    daysPerWeek: 5,
    days: [push([1]), pull([2]), legs([3]), upperVolume([5]), lowerVolume([6])],
  },
  {
    key: 'ulppl',
    name: 'Upper Lower Push Pull Legs',
    summary:
      'Five days. The same sessions as PPLUL in a different order: upper and lower first, then push, pull, legs.',
    daysPerWeek: 5,
    days: [upperVolume([1]), lowerVolume([2]), push([4]), pull([5]), legs([6])],
  },
  {
    key: 'ppl-3',
    name: 'Push Pull Legs, 3 days',
    summary: 'Three days. Each session once a week: a simple start, or for a busy week.',
    daysPerWeek: 3,
    days: [push([1]), pull([3]), legs([5])],
  },
  {
    key: 'beginner-full-body',
    name: 'Beginner full body',
    summary:
      'Three days, two alternating workouts built on the main lifts. Add weight whenever every set hits its reps.',
    daysPerWeek: 3,
    days: [
      {
        name: 'Workout A',
        weekdays: [1, 5],
        exercises: [
          c('back-squat', 3, 5, 8, 2, 180),
          c('barbell-bench-press', 3, 5, 8, 2, 180),
          c('barbell-row', 3, 6, 10),
          i('plank', 2, 30, 60, null, 60),
        ],
      },
      {
        name: 'Workout B',
        weekdays: [3],
        exercises: [
          c('romanian-deadlift', 3, 6, 10, 2, 180),
          c('overhead-press', 3, 5, 8, 2, 180),
          c('lat-pulldown', 3, 8, 12),
          c('goblet-squat', 2, 10, 12),
        ],
      },
    ],
  },
  {
    key: 'upper-lower',
    name: 'Upper Lower',
    summary: 'Upper and lower body twice a week each.',
    daysPerWeek: 4,
    days: [
      {
        name: 'Upper',
        weekdays: [1, 4],
        exercises: [
          c('barbell-bench-press', 3, 5, 8, 2, 180),
          c('barbell-row', 3, 6, 10),
          c('seated-dumbbell-press', 3, 8, 12),
          c('lat-pulldown', 3, 8, 12),
          i('dumbbell-curl', 2, 10, 12),
          i('triceps-rope-pushdown', 2, 10, 12),
        ],
      },
      {
        name: 'Lower',
        weekdays: [2, 5],
        exercises: [
          c('back-squat', 3, 5, 8, 2, 180),
          c('romanian-deadlift', 3, 6, 10),
          c('bulgarian-split-squat', 3, 8, 12),
          i('lying-leg-curl', 3, 10, 12),
          i('standing-calf-raise', 3, 10, 15),
          i('cable-crunch', 3, 10, 15),
        ],
      },
    ],
  },
  {
    key: 'full-body',
    name: 'Full Body',
    summary: 'Three sessions a week, every major muscle group each time.',
    daysPerWeek: 3,
    days: [
      {
        name: 'Full body A',
        weekdays: [1],
        exercises: [
          c('back-squat', 3, 5, 8, 2, 180),
          c('barbell-bench-press', 3, 5, 8, 2, 180),
          c('barbell-row', 3, 6, 10),
          i('dumbbell-lateral-raise', 2, 12, 15),
          i('hanging-leg-raise', 2, 8, 15),
        ],
      },
      {
        name: 'Full body B',
        weekdays: [3],
        exercises: [
          c('romanian-deadlift', 3, 6, 10),
          c('overhead-press', 3, 5, 8, 2, 180),
          c('lat-pulldown', 3, 8, 12),
          c('leg-press', 3, 10, 12),
          i('dumbbell-curl', 2, 10, 12),
        ],
      },
      {
        name: 'Full body C',
        weekdays: [5],
        exercises: [
          c('front-squat', 3, 5, 8, 2, 180),
          c('incline-dumbbell-press', 3, 8, 12),
          c('seated-cable-row', 3, 10, 12),
          i('lying-leg-curl', 3, 10, 12),
          i('triceps-rope-pushdown', 2, 10, 12),
        ],
      },
    ],
  },
  {
    key: 'four-day',
    name: '4-day split',
    summary: 'Chest and triceps, back and biceps, legs, shoulders and abs.',
    daysPerWeek: 4,
    days: [
      {
        name: 'Chest and triceps',
        weekdays: [1],
        exercises: [
          c('barbell-bench-press', 3, 5, 8, 2, 180),
          c('incline-dumbbell-press', 3, 8, 12),
          i('cable-fly', 3, 10, 15),
          c('close-grip-bench-press', 3, 6, 10),
          i('overhead-triceps-extension', 3, 10, 12),
        ],
      },
      {
        name: 'Back and biceps',
        weekdays: [2],
        exercises: [
          c('pull-up', 3, 5, 10),
          c('barbell-row', 3, 6, 10),
          c('seated-cable-row', 3, 10, 12),
          i('barbell-curl', 3, 8, 12),
          i('hammer-curl', 2, 10, 12),
        ],
      },
      {
        name: 'Legs',
        weekdays: [4],
        exercises: [
          c('back-squat', 3, 5, 8, 2, 180),
          c('romanian-deadlift', 3, 6, 10),
          c('leg-press', 3, 10, 12),
          i('leg-extension', 3, 10, 15),
          i('seated-calf-raise', 3, 10, 15),
        ],
      },
      {
        name: 'Shoulders and abs',
        weekdays: [5],
        exercises: [
          c('overhead-press', 3, 5, 8, 2, 180),
          i('dumbbell-lateral-raise', 4, 12, 15),
          i('reverse-pec-deck', 3, 12, 15),
          i('cable-crunch', 3, 10, 15),
          i('hanging-leg-raise', 3, 8, 15),
        ],
      },
    ],
  },
  {
    key: 'five-day',
    name: '5-day split',
    summary: 'One main focus per day: chest, back, legs, shoulders, arms.',
    daysPerWeek: 5,
    days: [
      {
        name: 'Chest',
        weekdays: [1],
        exercises: [
          c('barbell-bench-press', 4, 5, 8, 2, 180),
          c('incline-dumbbell-press', 3, 8, 12),
          c('machine-chest-press', 3, 10, 12),
          i('cable-fly', 3, 12, 15),
        ],
      },
      {
        name: 'Back',
        weekdays: [2],
        exercises: [
          c('deadlift', 3, 3, 6, 2, 180),
          c('lat-pulldown', 3, 8, 12),
          c('one-arm-dumbbell-row', 3, 8, 12),
          i('straight-arm-pulldown', 3, 12, 15),
        ],
      },
      {
        name: 'Legs',
        weekdays: [3],
        exercises: [
          c('back-squat', 4, 5, 8, 2, 180),
          c('leg-press', 3, 10, 12),
          i('leg-extension', 3, 12, 15),
          i('lying-leg-curl', 3, 10, 12),
          i('standing-calf-raise', 4, 10, 15),
        ],
      },
      {
        name: 'Shoulders',
        weekdays: [4],
        exercises: [
          c('overhead-press', 3, 5, 8, 2, 180),
          i('dumbbell-lateral-raise', 4, 12, 15),
          i('rear-delt-fly', 3, 12, 15),
          i('barbell-shrug', 3, 10, 12),
        ],
      },
      {
        name: 'Arms',
        weekdays: [5],
        exercises: [
          i('ez-bar-curl', 3, 8, 12),
          c('close-grip-bench-press', 3, 6, 10),
          i('incline-dumbbell-curl', 3, 10, 12),
          i('triceps-rope-pushdown', 3, 10, 12),
          i('hammer-curl', 2, 10, 12),
        ],
      },
    ],
  },
  {
    key: 'six-day',
    name: '6-day split',
    summary: 'Chest and back, shoulders and arms, legs. Each pair twice a week.',
    daysPerWeek: 6,
    days: [
      {
        name: 'Chest and back',
        weekdays: [1, 4],
        exercises: [
          c('barbell-bench-press', 3, 5, 8, 2, 180),
          c('pull-up', 3, 5, 10),
          c('incline-dumbbell-press', 3, 8, 12),
          c('barbell-row', 3, 6, 10),
          i('cable-fly', 2, 12, 15),
        ],
      },
      {
        name: 'Shoulders and arms',
        weekdays: [2, 5],
        exercises: [
          c('overhead-press', 3, 5, 8, 2, 180),
          i('dumbbell-lateral-raise', 3, 12, 15),
          i('barbell-curl', 3, 8, 12),
          i('skull-crusher', 3, 8, 12),
          i('hammer-curl', 2, 10, 12),
        ],
      },
      {
        name: 'Legs',
        weekdays: [3, 6],
        exercises: [
          c('back-squat', 3, 5, 8, 2, 180),
          c('romanian-deadlift', 3, 6, 10),
          c('walking-lunge', 3, 10, 16),
          i('seated-leg-curl', 3, 10, 12),
          i('standing-calf-raise', 3, 10, 15),
        ],
      },
    ],
  },
  {
    key: 'custom',
    name: 'Custom',
    summary: 'Start blank and build every day yourself.',
    daysPerWeek: 0,
    days: [{ name: 'Day 1', weekdays: [], exercises: [] }],
  },
];

export const templateByKey = (key: string) => ROUTINE_TEMPLATES.find((t) => t.key === key);
