import { stableId } from '@/lib/ids';
import type {
  Equipment,
  Exercise,
  LoadMode,
  MuscleGroup,
  TrackingType,
} from '@/domain/models/schemas';

interface ExerciseSeed {
  key: string;
  name: string;
  primary: MuscleGroup;
  secondary?: MuscleGroup[];
  equipment: Equipment;
  category: 'compound' | 'isolation';
  tracking?: TrackingType;
  /** per_hand: log one dumbbell or one side; volume counts both. */
  loadMode?: LoadMode;
  /** Done one arm or one leg at a time: reps are logged for the left and right side apart. */
  eachSide?: boolean;
  /**
   * When an exercise became one side at a time by default: workouts and routines made before it
   * keep logging both sides together, so history reads as it was logged.
   */
  eachSideSince?: string;
  instructions: string;
}

/**
 * The built-in exercise library.
 *
 * Keys are permanent: they derive each exercise's id, which must stay identical on every device
 * and in every synced account. Never rename or remove a key. Fix a name or instruction freely.
 *
 * Instructions are brief setup and execution cues, not prescriptions. No exercise here is
 * claimed to be better than another; pick what suits your body, equipment and goals.
 */
/** The muscle-targeting import (November 2026) made 8 one-sided exercises per side by default. */
const EACH_SIDE_V2 = '2026-11-24T00:00:00.000Z';

const SEEDS: ExerciseSeed[] = [
  // Chest
  {
    key: 'barbell-bench-press',
    name: 'Barbell bench press',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'barbell',
    category: 'compound',
    instructions:
      'Lie with eyes under the bar, feet planted and shoulder blades pulled back. Lower the bar to the lower chest with control, then press up and slightly back.',
  },
  {
    key: 'incline-barbell-bench-press',
    name: 'Incline barbell bench press',
    primary: 'chest',
    secondary: ['shoulders', 'triceps'],
    equipment: 'barbell',
    category: 'compound',
    instructions:
      'Set the bench to a low incline. Lower the bar to the upper chest with elbows slightly tucked, then press to lockout over the shoulders.',
  },
  {
    key: 'dumbbell-bench-press',
    name: 'Dumbbell bench press',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'dumbbell',
    category: 'compound',
    loadMode: 'per_hand',
    instructions:
      'Start with the dumbbells over the chest. Lower them to the sides of the chest with forearms vertical, then press back up. Log the weight of one dumbbell.',
  },
  {
    key: 'incline-dumbbell-press',
    name: 'Incline dumbbell press',
    primary: 'chest',
    secondary: ['shoulders', 'triceps'],
    equipment: 'dumbbell',
    category: 'compound',
    loadMode: 'per_hand',
    instructions:
      'On a low incline bench, lower the dumbbells beside the upper chest and press them up and slightly together. Log the weight of one dumbbell.',
  },
  {
    key: 'machine-chest-press',
    name: 'Machine chest press',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'machine',
    category: 'compound',
    instructions:
      'Set the seat so the handles line up with mid chest. Press forward without locking hard, then return slowly until you feel a stretch.',
  },
  {
    key: 'smith-machine-bench-press',
    name: 'Smith machine bench press',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'machine',
    category: 'compound',
    instructions:
      'Position the bench so the bar touches the lower chest. Unhook, lower under control and press up along the fixed path.',
  },
  {
    key: 'cable-fly',
    name: 'Cable fly',
    primary: 'chest',
    equipment: 'cable',
    category: 'isolation',
    instructions:
      'Stand between the pulleys with a soft bend in the elbows. Bring the handles together in a wide arc in front of the chest, then open back to a stretch.',
  },
  {
    key: 'dumbbell-fly',
    name: 'Dumbbell fly',
    primary: 'chest',
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    instructions:
      'Lie on a flat bench with dumbbells over the chest and elbows slightly bent. Open the arms wide until you feel a stretch, then bring them back together.',
  },
  {
    key: 'pec-deck',
    name: 'Pec deck',
    primary: 'chest',
    equipment: 'machine',
    category: 'isolation',
    instructions:
      'Sit tall with the handles at chest height. Squeeze the arms together in front of you, pause briefly, then return slowly.',
  },
  {
    key: 'push-up',
    name: 'Push-up',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'bodyweight_reps',
    instructions:
      'Hands slightly wider than shoulders and body in a straight line. Lower the chest to just above the floor, then push away.',
  },
  {
    key: 'dips',
    name: 'Dips',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'bodyweight_reps',
    instructions:
      'Support yourself on the bars with a slight forward lean. Lower until the shoulders are just below the elbows, then press back up.',
  },
  {
    key: 'weighted-dips',
    name: 'Weighted dips',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'weighted_bodyweight',
    instructions:
      'Wear a belt or hold a dumbbell between the feet. Lower with a slight forward lean and press back up. Log only the added weight.',
  },

  // Back
  {
    key: 'deadlift',
    name: 'Deadlift',
    primary: 'back',
    secondary: ['glutes', 'hamstrings', 'quads'],
    equipment: 'barbell',
    category: 'compound',
    instructions:
      'Bar over mid foot, hips back, back flat and arms straight. Push the floor away and stand tall, keeping the bar close to the legs.',
  },
  {
    key: 'pull-up',
    name: 'Pull-up',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'bodyweight_reps',
    instructions:
      'Hang with an overhand grip slightly wider than shoulders. Pull the chest toward the bar by driving the elbows down, then lower to a full hang.',
  },
  {
    key: 'chin-up',
    name: 'Chin-up',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'bodyweight_reps',
    instructions:
      'Hang with an underhand, shoulder-width grip. Pull until the chin clears the bar, then lower under control.',
  },
  {
    key: 'weighted-pull-up',
    name: 'Weighted pull-up',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'weighted_bodyweight',
    instructions:
      'Add weight with a belt or vest and pull as for a pull-up. Log only the added weight.',
  },
  {
    key: 'assisted-pull-up',
    name: 'Assisted pull-up',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'machine',
    category: 'compound',
    tracking: 'assisted_bodyweight',
    instructions:
      'Kneel or stand on the assistance platform and pull as for a pull-up. Log the assistance weight; less assistance means more work.',
  },
  {
    key: 'lat-pulldown',
    name: 'Lat pulldown',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'cable',
    category: 'compound',
    instructions:
      'Grip slightly wider than shoulders and lean back a little. Pull the bar to the upper chest by driving the elbows down, then let it rise to a full stretch.',
  },
  {
    key: 'close-grip-lat-pulldown',
    name: 'Close-grip lat pulldown',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'cable',
    category: 'compound',
    instructions:
      'Use a narrow neutral handle. Pull it to the upper chest with elbows close to the body, then return to a full stretch.',
  },
  {
    key: 'barbell-row',
    name: 'Barbell row',
    primary: 'back',
    secondary: ['biceps', 'shoulders'],
    equipment: 'barbell',
    category: 'compound',
    instructions:
      'Hinge forward with a flat back and the bar hanging at arm length. Row it to the lower ribs, pause, then lower without letting the torso rise.',
  },
  {
    key: 'pendlay-row',
    name: 'Pendlay row',
    primary: 'back',
    secondary: ['biceps', 'shoulders'],
    equipment: 'barbell',
    category: 'compound',
    instructions:
      'With the torso near parallel to the floor, row the bar from a dead stop on the floor to the lower chest. Reset on the floor each rep.',
  },
  {
    key: 'one-arm-dumbbell-row',
    name: 'One-arm dumbbell row',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'dumbbell',
    category: 'compound',
    loadMode: 'per_hand',
    eachSide: true,
    eachSideSince: EACH_SIDE_V2,
    instructions:
      'Brace one hand on a bench. Row the dumbbell toward the hip, keeping the shoulder down, then lower to a full stretch. Log the dumbbell weight; reps are per side.',
  },
  {
    key: 'chest-supported-row',
    name: 'Chest-supported row',
    primary: 'back',
    secondary: ['biceps', 'shoulders'],
    equipment: 'dumbbell',
    category: 'compound',
    loadMode: 'per_hand',
    instructions:
      'Lie face down on an incline bench. Row both dumbbells up and back, squeeze the shoulder blades, then lower. Log the weight of one dumbbell.',
  },
  {
    key: 'seated-cable-row',
    name: 'Seated cable row',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'cable',
    category: 'compound',
    instructions:
      'Sit tall with a slight knee bend. Pull the handle to the stomach while keeping the chest up, then reach forward to a stretch.',
  },
  {
    key: 'machine-row',
    name: 'Machine row',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'machine',
    category: 'compound',
    instructions:
      'Set the chest pad so you can reach the handles at full stretch. Pull the elbows back, pause, and return slowly.',
  },
  {
    key: 't-bar-row',
    name: 'T-bar row',
    primary: 'back',
    secondary: ['biceps', 'shoulders'],
    equipment: 'barbell',
    category: 'compound',
    instructions:
      'Straddle the bar with a flat back and hinge forward. Row the handle to the chest, then lower to a full stretch.',
  },
  {
    key: 'straight-arm-pulldown',
    name: 'Straight-arm pulldown',
    primary: 'back',
    equipment: 'cable',
    category: 'isolation',
    instructions:
      'Face a high pulley with arms nearly straight. Sweep the bar down to the thighs using the lats, then let it rise slowly.',
  },
  {
    key: 'back-extension',
    name: 'Back extension',
    primary: 'back',
    secondary: ['glutes', 'hamstrings'],
    equipment: 'bodyweight',
    category: 'isolation',
    tracking: 'bodyweight_reps',
    instructions:
      'Set the pad at the hips. Lower the torso with a neutral spine, then lift back up until the body is straight.',
  },
  {
    key: 'barbell-shrug',
    name: 'Barbell shrug',
    primary: 'back',
    equipment: 'barbell',
    category: 'isolation',
    instructions:
      'Hold the bar at arm length. Lift the shoulders straight up toward the ears, pause, then lower fully.',
  },

  // Shoulders
  {
    key: 'overhead-press',
    name: 'Overhead press',
    primary: 'shoulders',
    secondary: ['triceps'],
    equipment: 'barbell',
    category: 'compound',
    instructions:
      'Start with the bar on the front of the shoulders and glutes tight. Press it straight up, moving the head back then through, and lock out overhead.',
  },
  {
    key: 'seated-dumbbell-press',
    name: 'Seated dumbbell shoulder press',
    primary: 'shoulders',
    secondary: ['triceps'],
    equipment: 'dumbbell',
    category: 'compound',
    loadMode: 'per_hand',
    instructions:
      'Sit against an upright bench with dumbbells at shoulder height. Press up until the arms are straight, then lower to ear level. Log one dumbbell.',
  },
  {
    key: 'machine-shoulder-press',
    name: 'Machine shoulder press',
    primary: 'shoulders',
    secondary: ['triceps'],
    equipment: 'machine',
    category: 'compound',
    instructions:
      'Set the seat so the handles start at shoulder height. Press up without shrugging, then lower under control.',
  },
  {
    key: 'arnold-press',
    name: 'Arnold press',
    primary: 'shoulders',
    secondary: ['triceps'],
    equipment: 'dumbbell',
    category: 'compound',
    loadMode: 'per_hand',
    instructions:
      'Start with palms facing you at chin height. Rotate the palms forward as you press overhead, and reverse on the way down. Log one dumbbell.',
  },
  {
    key: 'dumbbell-lateral-raise',
    name: 'Dumbbell lateral raise',
    primary: 'shoulders',
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    instructions:
      'Stand with a slight forward lean. Raise the dumbbells out to the sides to shoulder height, leading with the elbows, then lower slowly. Log one dumbbell.',
  },
  {
    key: 'cable-lateral-raise',
    name: 'Cable lateral raise',
    primary: 'shoulders',
    equipment: 'cable',
    category: 'isolation',
    loadMode: 'per_hand',
    eachSide: true,
    eachSideSince: EACH_SIDE_V2,
    instructions:
      'Stand side-on to a low pulley. Raise the handle out to the side to shoulder height, then lower slowly. Log the stack weight; reps are per side.',
  },
  {
    key: 'machine-lateral-raise',
    name: 'Machine lateral raise',
    primary: 'shoulders',
    equipment: 'machine',
    category: 'isolation',
    instructions:
      'Line the shoulders up with the machine pivot. Raise the pads out to the sides to shoulder height, then lower under control.',
  },
  {
    key: 'front-raise',
    name: 'Dumbbell front raise',
    primary: 'shoulders',
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    instructions:
      'Raise the dumbbells in front of you to shoulder height with a soft elbow, then lower slowly. Log one dumbbell.',
  },
  {
    key: 'rear-delt-fly',
    name: 'Rear delt fly',
    primary: 'shoulders',
    secondary: ['back'],
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    instructions:
      'Hinge forward with a flat back. Raise the dumbbells out to the sides, leading with the elbows, then lower slowly. Log one dumbbell.',
  },
  {
    key: 'reverse-pec-deck',
    name: 'Reverse pec deck',
    primary: 'shoulders',
    secondary: ['back'],
    equipment: 'machine',
    category: 'isolation',
    instructions:
      'Face the pad with the handles at shoulder height. Sweep the arms back and out, pause, then return slowly.',
  },
  {
    key: 'face-pull',
    name: 'Face pull',
    primary: 'shoulders',
    secondary: ['back'],
    equipment: 'cable',
    category: 'isolation',
    instructions:
      'Set a rope at upper chest height. Pull toward the face, separating the hands and rotating the knuckles back, then return.',
  },
  {
    key: 'upright-row',
    name: 'Cable upright row',
    primary: 'shoulders',
    secondary: ['back'],
    equipment: 'cable',
    category: 'compound',
    instructions:
      'With a shoulder-width grip on a low pulley, pull the bar up along the body to lower chest height, elbows leading. Stop if the shoulders feel pinched.',
  },

  // Biceps
  {
    key: 'barbell-curl',
    name: 'Barbell curl',
    primary: 'biceps',
    equipment: 'barbell',
    category: 'isolation',
    instructions:
      'Stand tall with elbows at your sides. Curl the bar up without swinging, squeeze, then lower to full extension.',
  },
  {
    key: 'ez-bar-curl',
    name: 'EZ-bar curl',
    primary: 'biceps',
    equipment: 'barbell',
    category: 'isolation',
    instructions:
      'Hold the angled grips of the EZ bar. Curl up with elbows still, then lower under control.',
  },
  {
    key: 'dumbbell-curl',
    name: 'Dumbbell curl',
    primary: 'biceps',
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    instructions:
      'Curl the dumbbells with palms turning up, keeping the elbows by your sides, then lower fully. Log one dumbbell.',
  },
  {
    key: 'hammer-curl',
    name: 'Hammer curl',
    primary: 'biceps',
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    instructions:
      'Hold the dumbbells with palms facing each other. Curl up without turning the wrists, then lower fully. Log one dumbbell.',
  },
  {
    key: 'incline-dumbbell-curl',
    name: 'Incline dumbbell curl',
    primary: 'biceps',
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    instructions:
      'Sit back on an incline bench with arms hanging behind the body. Curl up while keeping the upper arms still. Log one dumbbell.',
  },
  {
    key: 'preacher-curl',
    name: 'Preacher curl',
    primary: 'biceps',
    equipment: 'machine',
    category: 'isolation',
    instructions:
      'Rest the upper arms on the preacher pad. Curl up, then lower slowly to nearly straight without bouncing.',
  },
  {
    key: 'cable-curl',
    name: 'Cable curl',
    primary: 'biceps',
    equipment: 'cable',
    category: 'isolation',
    instructions:
      'Face a low pulley with a straight or EZ handle. Curl up with elbows fixed, then lower under constant tension.',
  },

  // Triceps
  {
    key: 'close-grip-bench-press',
    name: 'Close-grip bench press',
    primary: 'triceps',
    secondary: ['chest', 'shoulders'],
    equipment: 'barbell',
    category: 'compound',
    instructions:
      'Grip about shoulder width. Lower the bar to the lower chest with elbows close to the body, then press up.',
  },
  {
    key: 'triceps-rope-pushdown',
    name: 'Triceps rope pushdown',
    primary: 'triceps',
    equipment: 'cable',
    category: 'isolation',
    instructions:
      'Hold the rope at a high pulley with elbows at your sides. Push down and spread the rope at the bottom, then let it rise to elbow height.',
  },
  {
    key: 'triceps-bar-pushdown',
    name: 'Triceps bar pushdown',
    primary: 'triceps',
    equipment: 'cable',
    category: 'isolation',
    instructions:
      'Hold a straight or V bar at a high pulley. Extend the elbows fully without leaning over the bar, then return slowly.',
  },
  {
    key: 'overhead-triceps-extension',
    name: 'Overhead triceps extension',
    primary: 'triceps',
    equipment: 'cable',
    category: 'isolation',
    instructions:
      'Face away from the pulley with the rope behind your head. Extend the arms forward and up, then bend back to a deep stretch.',
  },
  {
    key: 'skull-crusher',
    name: 'Skull crusher',
    primary: 'triceps',
    equipment: 'barbell',
    category: 'isolation',
    instructions:
      'Lie on a bench holding an EZ bar over the chest. Bend the elbows to lower it behind the forehead, then extend back up.',
  },
  {
    key: 'dumbbell-overhead-extension',
    name: 'Dumbbell overhead extension',
    primary: 'triceps',
    equipment: 'dumbbell',
    category: 'isolation',
    instructions:
      'Hold one dumbbell with both hands overhead. Lower it behind the head by bending the elbows, then extend back up.',
  },
  {
    key: 'bench-dip',
    name: 'Bench dip',
    primary: 'triceps',
    secondary: ['chest', 'shoulders'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'bodyweight_reps',
    instructions:
      'Hands on the edge of a bench behind you. Lower by bending the elbows to about 90 degrees, then press back up.',
  },

  // Quads
  {
    key: 'back-squat',
    name: 'Back squat',
    primary: 'quads',
    secondary: ['glutes', 'hamstrings'],
    equipment: 'barbell',
    category: 'compound',
    instructions:
      'Bar on the upper back, feet about shoulder width. Brace, sit down between the hips to at least parallel, then drive up.',
  },
  {
    key: 'front-squat',
    name: 'Front squat',
    primary: 'quads',
    secondary: ['glutes'],
    equipment: 'barbell',
    category: 'compound',
    instructions:
      'Rest the bar on the front of the shoulders with elbows high. Squat down with an upright torso, then stand up.',
  },
  {
    key: 'hack-squat',
    name: 'Hack squat',
    primary: 'quads',
    secondary: ['glutes'],
    equipment: 'machine',
    category: 'compound',
    instructions:
      'Shoulders under the pads and feet mid platform. Lower until the thighs are at least parallel, then press up.',
  },
  {
    key: 'leg-press',
    name: 'Leg press',
    primary: 'quads',
    secondary: ['glutes'],
    equipment: 'machine',
    category: 'compound',
    instructions:
      'Feet shoulder width on the platform. Lower until the knees are well bent without the lower back lifting off the pad, then press.',
  },
  {
    key: 'goblet-squat',
    name: 'Goblet squat',
    primary: 'quads',
    secondary: ['glutes'],
    equipment: 'dumbbell',
    category: 'compound',
    instructions:
      'Hold one dumbbell at the chest. Squat down with the elbows inside the knees, then stand up.',
  },
  {
    key: 'bulgarian-split-squat',
    name: 'Bulgarian split squat',
    primary: 'quads',
    secondary: ['glutes'],
    equipment: 'dumbbell',
    category: 'compound',
    loadMode: 'per_hand',
    eachSide: true,
    eachSideSince: EACH_SIDE_V2,
    instructions:
      'Rear foot on a bench and dumbbells at your sides. Lower the back knee toward the floor, then drive up through the front foot. Log one dumbbell; reps are per leg.',
  },
  {
    key: 'walking-lunge',
    name: 'Walking lunge',
    primary: 'quads',
    secondary: ['glutes'],
    equipment: 'dumbbell',
    category: 'compound',
    loadMode: 'per_hand',
    eachSide: true,
    eachSideSince: EACH_SIDE_V2,
    instructions:
      'Step forward and lower the back knee toward the floor, then step through into the next lunge. Log one dumbbell and total steps as reps.',
  },
  {
    key: 'leg-extension',
    name: 'Leg extension',
    primary: 'quads',
    equipment: 'machine',
    category: 'isolation',
    instructions:
      'Line the knees up with the machine pivot. Straighten the legs, pause, then lower slowly.',
  },
  {
    key: 'step-up',
    name: 'Dumbbell step-up',
    primary: 'quads',
    secondary: ['glutes'],
    equipment: 'dumbbell',
    category: 'compound',
    loadMode: 'per_hand',
    eachSide: true,
    eachSideSince: EACH_SIDE_V2,
    instructions:
      'Step onto a box with the whole foot and drive up to stand on it, then step down with control. Log one dumbbell; reps are per leg.',
  },

  // Hamstrings
  {
    key: 'romanian-deadlift',
    name: 'Romanian deadlift',
    primary: 'hamstrings',
    secondary: ['glutes', 'back'],
    equipment: 'barbell',
    category: 'compound',
    instructions:
      'Stand with the bar at the hips and knees soft. Push the hips back, sliding the bar down the thighs until you feel a strong stretch, then stand up.',
  },
  {
    key: 'dumbbell-romanian-deadlift',
    name: 'Dumbbell Romanian deadlift',
    primary: 'hamstrings',
    secondary: ['glutes', 'back'],
    equipment: 'dumbbell',
    category: 'compound',
    loadMode: 'per_hand',
    instructions:
      'Hinge at the hips with the dumbbells close to the legs and a flat back, then stand tall. Log one dumbbell.',
  },
  {
    key: 'stiff-leg-deadlift',
    name: 'Stiff-leg deadlift',
    primary: 'hamstrings',
    secondary: ['glutes', 'back'],
    equipment: 'barbell',
    category: 'compound',
    instructions:
      'Start from the floor with knees only slightly bent. Lift by extending the hips, keeping the back flat.',
  },
  {
    key: 'lying-leg-curl',
    name: 'Lying leg curl',
    primary: 'hamstrings',
    equipment: 'machine',
    category: 'isolation',
    instructions:
      'Lie face down with the pad above the heels. Curl the heels toward the glutes, then lower slowly to straight.',
  },
  {
    key: 'seated-leg-curl',
    name: 'Seated leg curl',
    primary: 'hamstrings',
    equipment: 'machine',
    category: 'isolation',
    instructions:
      'Sit with the thigh pad snug and the lower pad above the heels. Curl down and back, then return slowly.',
  },
  {
    key: 'nordic-curl',
    name: 'Nordic curl',
    primary: 'hamstrings',
    equipment: 'bodyweight',
    category: 'isolation',
    tracking: 'bodyweight_reps',
    instructions:
      'Kneel with the ankles anchored. Lower the body forward as slowly as you can, catch yourself, and push back up.',
  },
  {
    key: 'good-morning',
    name: 'Good morning',
    primary: 'hamstrings',
    secondary: ['glutes', 'back'],
    equipment: 'barbell',
    category: 'compound',
    instructions:
      'Bar on the upper back and knees soft. Hinge forward with a flat back until you feel the hamstrings stretch, then stand up.',
  },

  // Glutes
  {
    key: 'hip-thrust',
    name: 'Hip thrust',
    primary: 'glutes',
    secondary: ['hamstrings'],
    equipment: 'barbell',
    category: 'compound',
    instructions:
      'Upper back on a bench and bar over the hips. Drive the hips up until the body is flat from shoulders to knees, pause, then lower.',
  },
  {
    key: 'machine-hip-thrust',
    name: 'Machine hip thrust',
    primary: 'glutes',
    secondary: ['hamstrings'],
    equipment: 'machine',
    category: 'compound',
    instructions:
      'Set the pad across the hips. Drive up to full hip extension, pause, then lower under control.',
  },
  {
    key: 'glute-bridge',
    name: 'Glute bridge',
    primary: 'glutes',
    secondary: ['hamstrings'],
    equipment: 'bodyweight',
    category: 'isolation',
    tracking: 'bodyweight_reps',
    instructions:
      'Lie on your back with knees bent. Push through the heels to lift the hips, squeeze, then lower.',
  },
  {
    key: 'cable-kickback',
    name: 'Cable glute kickback',
    primary: 'glutes',
    equipment: 'cable',
    category: 'isolation',
    eachSide: true,
    eachSideSince: EACH_SIDE_V2,
    instructions:
      'Attach an ankle strap to a low pulley. Kick the leg back and slightly up without arching the lower back. Reps are per leg.',
  },
  {
    key: 'hip-abduction',
    name: 'Hip abduction machine',
    primary: 'glutes',
    equipment: 'machine',
    category: 'isolation',
    instructions: 'Sit tall and push the pads apart, pause, then return slowly.',
  },
  {
    key: 'sumo-deadlift',
    name: 'Sumo deadlift',
    primary: 'glutes',
    secondary: ['quads', 'hamstrings', 'back'],
    equipment: 'barbell',
    category: 'compound',
    instructions:
      'Wide stance with toes turned out and hands inside the knees. Push the knees out and stand up with the bar close.',
  },

  // Calves
  {
    key: 'standing-calf-raise',
    name: 'Standing calf raise',
    primary: 'calves',
    equipment: 'machine',
    category: 'isolation',
    instructions:
      'Balls of the feet on the edge of the platform. Lower the heels to a full stretch, pause, then rise as high as you can.',
  },
  {
    key: 'seated-calf-raise',
    name: 'Seated calf raise',
    primary: 'calves',
    equipment: 'machine',
    category: 'isolation',
    instructions:
      'Pad on the lower thighs and balls of the feet on the platform. Lower to a deep stretch, then rise fully.',
  },
  {
    key: 'leg-press-calf-raise',
    name: 'Leg press calf raise',
    primary: 'calves',
    equipment: 'machine',
    category: 'isolation',
    instructions:
      'With legs straight, place the balls of the feet on the low edge of the platform. Push through the toes, then lower to a stretch.',
  },
  {
    key: 'single-leg-calf-raise',
    name: 'Single-leg calf raise',
    primary: 'calves',
    equipment: 'bodyweight',
    category: 'isolation',
    tracking: 'bodyweight_reps',
    eachSide: true,
    eachSideSince: EACH_SIDE_V2,
    instructions:
      'Stand on one foot on a step. Lower the heel below the step, then rise onto the toes. Reps are per leg.',
  },

  // Abs
  {
    key: 'hanging-leg-raise',
    name: 'Hanging leg raise',
    primary: 'abs',
    equipment: 'bodyweight',
    category: 'isolation',
    tracking: 'bodyweight_reps',
    instructions:
      'Hang from a bar. Raise the legs by curling the pelvis up, avoiding a swing, then lower slowly.',
  },
  {
    key: 'cable-crunch',
    name: 'Cable crunch',
    primary: 'abs',
    equipment: 'cable',
    category: 'isolation',
    instructions:
      'Kneel facing a high pulley holding the rope by your head. Curl the ribs toward the hips, then return.',
  },
  {
    key: 'crunch',
    name: 'Crunch',
    primary: 'abs',
    equipment: 'bodyweight',
    category: 'isolation',
    tracking: 'bodyweight_reps',
    instructions:
      'Lie on your back with knees bent. Curl the shoulders off the floor by bringing the ribs toward the pelvis, then lower.',
  },
  {
    key: 'ab-wheel-rollout',
    name: 'Ab wheel rollout',
    primary: 'abs',
    equipment: 'other',
    category: 'isolation',
    tracking: 'bodyweight_reps',
    instructions:
      'Kneel holding the wheel. Roll forward as far as you can without the lower back sagging, then pull back.',
  },
  {
    key: 'decline-sit-up',
    name: 'Decline sit-up',
    primary: 'abs',
    equipment: 'bodyweight',
    category: 'isolation',
    tracking: 'bodyweight_reps',
    instructions: 'Hook the feet on a decline bench. Curl up to sitting, then lower under control.',
  },
  {
    key: 'plank',
    name: 'Plank',
    primary: 'abs',
    equipment: 'bodyweight',
    category: 'isolation',
    tracking: 'duration',
    instructions:
      'Forearms under the shoulders and body in a straight line. Brace and hold without letting the hips sag. Log the time held.',
  },
  {
    key: 'side-plank',
    name: 'Side plank',
    primary: 'abs',
    equipment: 'bodyweight',
    category: 'isolation',
    tracking: 'duration',
    instructions:
      'Support yourself on one forearm with the body straight from head to feet. Hold, then switch sides. Log the time per side.',
  },
  {
    key: 'pallof-press',
    name: 'Pallof press',
    primary: 'abs',
    equipment: 'cable',
    category: 'isolation',
    instructions:
      'Stand side-on to a pulley at chest height. Press the handle straight out and resist the pull to rotate, then bring it back. Reps are per side.',
  },

  // Full body and conditioning
  {
    key: 'farmers-carry',
    name: "Farmer's carry",
    primary: 'back',
    secondary: ['abs'],
    equipment: 'dumbbell',
    category: 'compound',
    tracking: 'distance',
    instructions:
      'Hold heavy dumbbells at your sides, stand tall and walk with short steps. Log the distance covered.',
  },
  {
    key: 'kettlebell-swing',
    name: 'Kettlebell swing',
    primary: 'glutes',
    secondary: ['hamstrings', 'back'],
    equipment: 'kettlebell',
    category: 'compound',
    instructions:
      'Hike the bell back between the legs, then snap the hips forward to float it to chest height. Let it fall back into the next rep.',
  },

  // Added for training at home.
  {
    key: 'pike-push-up',
    name: 'Pike push-up',
    primary: 'shoulders',
    secondary: ['triceps'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'bodyweight_reps',
    instructions:
      'Start in a push-up with the hips high, so the body makes an upside-down V. Bend the elbows to bring the top of the head toward the floor, then press back up.',
  },
  {
    key: 'band-pull-apart',
    name: 'Band pull-apart',
    primary: 'shoulders',
    secondary: ['back'],
    equipment: 'band',
    category: 'isolation',
    tracking: 'bodyweight_reps',
    instructions:
      'Hold a light band at shoulder height with straight arms. Pull it apart until it touches the chest, squeezing the shoulder blades, then return slowly.',
  },

  // Cardio: time and distance together. Pace is worked out from the two.
  {
    key: 'treadmill-run',
    name: 'Treadmill run',
    primary: 'cardio',
    equipment: 'machine',
    category: 'compound',
    tracking: 'cardio',
    instructions:
      'Warm up with a few minutes of walking, then run at a pace you can hold. Log the minutes and the distance the display shows.',
  },
  {
    key: 'outdoor-run',
    name: 'Outdoor run',
    primary: 'cardio',
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'cardio',
    instructions:
      'Start easy for the first few minutes and settle into a steady rhythm. Log the time and the distance from your watch or phone.',
  },
  {
    key: 'incline-walk',
    name: 'Incline treadmill walk',
    primary: 'cardio',
    equipment: 'machine',
    category: 'compound',
    tracking: 'cardio',
    instructions:
      'Set a steep incline and a brisk walking pace. Walk tall without holding the rails. Log the minutes and distance.',
  },
  {
    key: 'stationary-bike',
    name: 'Stationary bike',
    primary: 'cardio',
    equipment: 'machine',
    category: 'compound',
    tracking: 'cardio',
    instructions:
      'Set the saddle so the knee stays slightly bent at the bottom of the stroke. Keep a steady cadence. Log the minutes and distance.',
  },
  {
    key: 'rowing-machine',
    name: 'Rowing machine',
    primary: 'cardio',
    secondary: ['back', 'quads'],
    equipment: 'machine',
    category: 'compound',
    tracking: 'cardio',
    instructions:
      'Drive with the legs first, then lean back slightly and pull the handle to the lower ribs. Reverse the order on the way back. Log the minutes and metres.',
  },
  {
    key: 'elliptical',
    name: 'Elliptical',
    primary: 'cardio',
    equipment: 'machine',
    category: 'compound',
    tracking: 'cardio',
    instructions:
      'Stand tall, push and pull the handles with the stride, and keep the whole foot on the pedal. Log the minutes and distance.',
  },
  {
    key: 'stair-climber',
    name: 'Stair climber',
    primary: 'cardio',
    secondary: ['glutes', 'quads'],
    equipment: 'machine',
    category: 'compound',
    tracking: 'duration',
    instructions:
      'Take full steps and keep a light grip on the rails, if any. Log the minutes worked.',
  },
  {
    key: 'jump-rope',
    name: 'Jump rope',
    primary: 'cardio',
    secondary: ['calves'],
    equipment: 'other',
    category: 'compound',
    tracking: 'duration',
    instructions:
      'Small jumps on the balls of the feet, turning the rope from the wrists. Log the time skipped.',
  },

  // Added later: keep new entries at the end, each release seeds its own slice.
  {
    key: 'hip-adduction',
    name: 'Hip adduction machine',
    primary: 'adductors',
    equipment: 'machine',
    category: 'isolation',
    instructions:
      'Also called the adductor machine; it works the inner thighs. Sit tall with the pads on the inside of the knees, squeeze the legs together, pause, then let them open slowly.',
  },
  {
    key: 'decline-bench-press',
    name: 'Decline barbell bench press',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'barbell',
    category: 'compound',
    instructions:
      'Hook the feet under the pads on a bench set 15 to 30 degrees head-down. Lower the bar to the lower chest with control, then press up over the shoulders.',
  },
  {
    key: 'decline-dumbbell-press',
    name: 'Decline dumbbell press',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'dumbbell',
    category: 'compound',
    loadMode: 'per_hand',
    instructions:
      'On a bench set 15 to 30 degrees head-down, press the dumbbells up over the lower chest and lower them slowly to chest level. Log one dumbbell.',
  },
  // Round 2 additions (October 2026). New entries always go at the end: the server library is
  // seeded by position.
  {
    key: 'kelso-shrug',
    name: 'Kelso shrug',
    primary: 'back',
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    instructions:
      'Lie chest down on a bench set to a low incline with the dumbbells hanging straight down. Keeping the arms straight, pull the shoulder blades back and together, hold for a second, then let them spread apart. The arms do not bend. Log one dumbbell.',
  },
  {
    key: 'keenan-flap',
    name: 'Keenan flap',
    primary: 'back',
    equipment: 'cable',
    category: 'isolation',
    eachSide: true,
    eachSideSince: EACH_SIDE_V2,
    instructions:
      'Fit a cuff just above the elbow, with the cable set high. Sit sideways on a high incline bench and, with the arm nearly straight, pull the elbow down and in toward your side, then let it rise slowly overhead. One arm at a time.',
  },
  {
    key: 'behind-the-neck-press',
    name: 'Behind-the-neck press',
    primary: 'shoulders',
    secondary: ['triceps'],
    equipment: 'barbell',
    category: 'compound',
    instructions:
      'Seated or standing, hold the bar behind the head with a grip a little wider than the shoulders. Press it straight up to lockout, then lower it under control to about ear level. Only use it if you can reach that position without pain; stop short of the neck.',
  },
  {
    key: 'brachioradialis-curl',
    name: 'Brachioradialis curl',
    primary: 'biceps',
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    instructions:
      'Hold the dumbbells with palms facing down (a reverse grip). Keep the elbows by your sides and curl up without letting the wrists drop, then lower slowly. Thumbs-up hammer curls work the same muscle a little less. Log one dumbbell.',
  },
  {
    key: 'dumbbell-stiff-leg-deadlift',
    name: 'Dumbbell stiff-leg deadlift',
    primary: 'hamstrings',
    secondary: ['glutes', 'back'],
    equipment: 'dumbbell',
    category: 'compound',
    loadMode: 'per_hand',
    instructions:
      'Stand with the dumbbells in front of the thighs and the knees only slightly bent. Push the hips back and lower the dumbbells along the legs with a flat back until the hamstrings stretch, then stand tall by driving the hips forward. Log one dumbbell.',
  },
  // Round 4 (October 2026): the box squat and one-arm and one-leg versions, whose reps are
  // logged for each side. New entries always go at the end: the server library is seeded by
  // position.
  {
    key: 'box-squat',
    name: 'Box squat',
    primary: 'quads',
    secondary: ['glutes', 'hamstrings', 'back'],
    equipment: 'barbell',
    category: 'compound',
    instructions:
      'Set a box or bench behind you at the depth you want, usually with the thighs about level with the floor when seated. With the bar on your upper back and the feet a little wider than for a back squat, push the hips back and sit down onto the box under control. Pause briefly with the back tight and the shins near vertical, without relaxing or rocking, then drive up through the whole foot to standing.',
  },
  {
    key: 'one-arm-cable-triceps-extension',
    name: 'One-arm cable triceps extension',
    primary: 'triceps',
    equipment: 'cable',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Fit a cuff or a single handle to a high cable. Keep the upper arm still by your side, or by your head for the overhead version, and straighten the elbow fully, then let it bend back slowly. Do all the reps with one arm, then the other, and log each side.',
  },
  {
    key: 'one-arm-machine-lateral-raise',
    name: 'One-arm machine lateral raise',
    primary: 'shoulders',
    equipment: 'machine',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Sit or stand side-on in the lateral raise machine with the pad against the outside of one arm. Raise the arm out to the side to about shoulder height, leading with the elbow, then lower slowly. Finish one side, then switch, and log each side.',
  },
  {
    key: 'single-leg-extension',
    name: 'Single-leg extension',
    primary: 'quads',
    equipment: 'machine',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Sit in the leg extension machine with the pad on one shin, just above the ankle. Straighten the knee fully and squeeze the front of the thigh, then lower slowly. Do one leg, then the other, and log each side.',
  },
  {
    key: 'one-arm-pec-deck',
    name: 'One-arm pec deck',
    primary: 'chest',
    secondary: ['shoulders'],
    equipment: 'machine',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Sit in the pec deck and use one handle or pad at a time, the other arm braced. Bring the arm across in an arc until the hand is in front of the chest, then open slowly until the chest stretches. Finish one side, then switch, and log each side.',
  },
  {
    key: 'single-leg-press',
    name: 'Single-leg press',
    primary: 'quads',
    secondary: ['glutes', 'hamstrings'],
    equipment: 'machine',
    category: 'compound',
    eachSide: true,
    instructions:
      'Place one foot in the middle of the platform, the other off to the side. Lower the platform until the knee is well bent with the lower back still on the pad, then press up without locking the knee hard. Do one leg, then the other, and log each side.',
  },
  {
    key: 'single-leg-curl',
    name: 'Single-leg curl',
    primary: 'hamstrings',
    equipment: 'machine',
    category: 'isolation',
    eachSide: true,
    instructions:
      'In a seated or lying leg curl, set the pad behind one ankle. Curl the heel towards you as far as it goes, then let the leg straighten slowly. Do one leg, then the other, and log each side.',
  },
  {
    key: 'one-arm-lat-pulldown',
    name: 'One-arm lat pulldown',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'cable',
    category: 'compound',
    eachSide: true,
    instructions:
      'Hold a single handle on a high cable, kneeling or seated with the arm overhead. Pull the elbow down to your side and slightly back, without twisting the torso, then let the arm rise fully. Do one arm, then the other, and log each side.',
  },
  {
    key: 'one-arm-cable-row',
    name: 'One-arm cable row',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'cable',
    category: 'compound',
    eachSide: true,
    instructions:
      'Hold a single handle on a cable at chest or waist height. Sit or stand tall and row the elbow back past the body, then reach forward again until the shoulder blade moves forward. Do one arm, then the other, and log each side.',
  },
  {
    key: 'one-arm-cable-curl',
    name: 'One-arm cable curl',
    primary: 'biceps',
    equipment: 'cable',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Hold a single handle on a low cable with the palm up. Keep the elbow by your side and curl the hand up to the shoulder, then lower slowly to a straight arm. Do one arm, then the other, and log each side.',
  },
  {
    key: 'single-leg-romanian-deadlift',
    name: 'Single-leg Romanian deadlift',
    primary: 'hamstrings',
    secondary: ['glutes', 'back'],
    equipment: 'dumbbell',
    category: 'compound',
    eachSide: true,
    instructions:
      'Stand on one leg with a slight knee bend, a dumbbell in the opposite hand. Hinge at the hip, letting the free leg reach back in line with the torso, until the standing hamstring stretches, then stand tall. Log the weight in your hand and the reps for each leg.',
  },
  // November 2026: 42 exercises from the muscle-targeting sheet (migration 0039).
  {
    key: 'high-to-low-cable-fly',
    name: 'High-to-low cable fly',
    primary: 'chest',
    secondary: ['shoulders'],
    equipment: 'cable',
    category: 'isolation',
    instructions:
      'Set both pulleys above head height. With a slight bend in the elbows, sweep the handles down and together in front of the lower chest, then let them return slowly.',
  },
  {
    key: 'low-to-high-cable-fly',
    name: 'Low-to-high cable fly',
    primary: 'chest',
    secondary: ['shoulders'],
    equipment: 'cable',
    category: 'isolation',
    instructions:
      'Set both pulleys near the floor. With soft elbows, sweep the handles up and together to about chin height, then lower them slowly.',
  },
  {
    key: 'deficit-push-up',
    name: 'Deficit push-up',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'bodyweight_reps',
    instructions:
      'Put the hands on push-up handles or plates so the chest can go below hand level. Keep the body straight, lower until the chest passes the hands, then push away.',
  },
  {
    key: 'neutral-grip-pull-up',
    name: 'Neutral-grip pull-up',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'bodyweight_reps',
    instructions:
      'Hang from parallel handles with the palms facing each other. Pull the chest up by driving the elbows down to the sides, then lower to a full hang.',
  },
  {
    key: 'machine-pullover',
    name: 'Machine pullover',
    primary: 'back',
    equipment: 'machine',
    category: 'isolation',
    instructions:
      'Sit with the pads on the backs of the upper arms and the arms overhead. Drive the elbows down and around to the sides, then let them rise slowly to a full stretch.',
  },
  {
    key: 'one-arm-cable-lat-pull-in',
    name: 'One-arm cable lat pull-in',
    primary: 'back',
    equipment: 'cable',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Kneel or stand beside a high cable holding a single handle with a long arm. Pull the hand down and in towards the hip in an arc, keeping the elbow nearly straight, then return slowly. Do one arm, then the other, and log each side.',
  },
  {
    key: 'wide-elbow-chest-supported-row',
    name: 'Wide-elbow chest-supported row',
    primary: 'back',
    secondary: ['shoulders', 'biceps'],
    equipment: 'dumbbell',
    category: 'compound',
    loadMode: 'per_hand',
    instructions:
      'Lie face down on an incline bench with a dumbbell in each hand. Row with the elbows flared out to the sides until the upper arms are level with the back, then lower. Log the weight of one dumbbell.',
  },
  {
    key: '45-degree-hip-back-extension',
    name: '45-degree hip back extension',
    primary: 'glutes',
    secondary: ['hamstrings', 'back'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'bodyweight_reps',
    instructions:
      'Set the pad just below the hips on a 45-degree bench. Hinge at the hips with a neutral spine, then squeeze the glutes to rise until the body is in a straight line. Hold a plate for more load.',
  },
  {
    key: 'reverse-hyperextension',
    name: 'Reverse hyperextension',
    primary: 'glutes',
    secondary: ['hamstrings', 'back'],
    equipment: 'machine',
    category: 'isolation',
    instructions:
      'Lie face down on the machine with the hips at the edge and the legs hanging. Lift the legs behind you to body height by squeezing the glutes, then lower with control.',
  },
  {
    key: 'incline-prone-y-raise',
    name: 'Incline prone Y raise',
    primary: 'back',
    secondary: ['shoulders'],
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    instructions:
      'Lie face down on an incline bench with light dumbbells. Raise the arms up and out into a Y, thumbs up, until they line up with the body, then lower slowly. Log the weight of one dumbbell.',
  },
  {
    key: 'cable-shrug',
    name: 'Cable shrug',
    primary: 'back',
    equipment: 'cable',
    category: 'isolation',
    instructions:
      'Stand between two low pulleys, or at one with a bar. Lift the shoulders straight up towards the ears, pause, then lower to a full stretch.',
  },
  {
    key: 'bayesian-cable-rear-delt-fly',
    name: 'Bayesian cable rear-delt fly',
    primary: 'shoulders',
    secondary: ['back'],
    equipment: 'cable',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Stand side-on to a cable at shoulder height and take the handle with the far hand. With a soft elbow, sweep the arm out and back to the side of the body, then return slowly. Do one arm, then the other, and log each side.',
  },
  {
    key: 'cable-external-rotation',
    name: 'Cable external rotation',
    primary: 'shoulders',
    equipment: 'cable',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Set a cable at elbow height and stand side-on. Keep the elbow bent to 90 degrees and against the side, and rotate the hand out away from the body, then back slowly. Do one arm, then the other, and log each side.',
  },
  {
    key: 'cable-internal-rotation',
    name: 'Cable internal rotation',
    primary: 'shoulders',
    equipment: 'cable',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Set a cable at elbow height and stand side-on with the near hand on the handle. Keep the elbow bent to 90 degrees against the side and rotate the hand in across the stomach, then back slowly. Do one arm, then the other, and log each side.',
  },
  {
    key: 'push-up-plus',
    name: 'Push-up plus',
    primary: 'shoulders',
    secondary: ['chest', 'triceps'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'bodyweight_reps',
    instructions:
      'Do a push-up, then at the top push the floor further away so the shoulder blades spread around the ribs. Lower the shoulder blades back, then the body.',
  },
  {
    key: 'spider-curl',
    name: 'Spider curl',
    primary: 'biceps',
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    instructions:
      'Lie chest down on an incline bench with the arms hanging straight. Curl the dumbbells up without moving the upper arms, squeeze, then lower to straight arms. Log the weight of one dumbbell.',
  },
  {
    key: 'bayesian-cable-curl',
    name: 'Bayesian cable curl',
    primary: 'biceps',
    equipment: 'cable',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Face away from a low cable holding the handle, with the arm drawn slightly behind the body. Curl the hand to the shoulder without letting the elbow drift forward, then lower to a full stretch. Do one arm, then the other, and log each side.',
  },
  {
    key: 'reverse-ez-bar-curl',
    name: 'Reverse EZ-bar curl',
    primary: 'biceps',
    equipment: 'barbell',
    category: 'isolation',
    instructions:
      'Hold an EZ bar with the palms facing down. Keep the elbows at your sides and curl up without letting the wrists drop, then lower slowly.',
  },
  {
    key: 'cross-body-cable-triceps-extension',
    name: 'Cross-body cable triceps extension',
    primary: 'triceps',
    equipment: 'cable',
    category: 'isolation',
    instructions:
      'Stand between two high pulleys, each hand holding the opposite cable so the arms cross. Straighten the elbows out to the sides, then let them bend back slowly. Both arms at once, or one at a time and log each side.',
  },
  {
    key: 'seated-wrist-curl',
    name: 'Seated wrist curl',
    primary: 'biceps',
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    instructions:
      'Sit with the forearms on the thighs, palms up and wrists past the knees. Let the dumbbells roll down to the fingers, then curl the wrists up as far as they go. Log the weight of one dumbbell.',
  },
  {
    key: 'reverse-wrist-curl',
    name: 'Reverse wrist curl',
    primary: 'biceps',
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    instructions:
      'Sit with the forearms on the thighs, palms down and wrists past the knees. Lift the backs of the hands up as far as they go, then lower slowly. Log the weight of one dumbbell.',
  },
  {
    key: 'wrist-pronation',
    name: 'Wrist pronation',
    primary: 'biceps',
    equipment: 'dumbbell',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Rest the forearm on a bench holding a dumbbell by one end, thumb side up. Turn the palm down slowly, then back to the start. Do one hand, then the other, and log each side.',
  },
  {
    key: 'wrist-supination',
    name: 'Wrist supination',
    primary: 'biceps',
    equipment: 'dumbbell',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Rest the forearm on a bench holding a dumbbell by one end, palm down. Turn the palm up slowly, then back to the start. Do one hand, then the other, and log each side.',
  },
  {
    key: 'dead-hang',
    name: 'Dead hang',
    primary: 'back',
    equipment: 'bodyweight',
    category: 'isolation',
    tracking: 'duration',
    instructions:
      'Hang from a bar with an overhand grip and straight arms, shoulders lightly engaged. Hold for time.',
  },
  {
    key: 'reverse-nordic-curl',
    name: 'Reverse Nordic curl',
    primary: 'quads',
    equipment: 'bodyweight',
    category: 'isolation',
    tracking: 'bodyweight_reps',
    instructions:
      'Kneel upright with the feet anchored or free. Keeping hips and torso in one line, lean back as far as you control, then use the quads to return to upright.',
  },
  {
    key: 'sissy-squat',
    name: 'Sissy squat',
    primary: 'quads',
    equipment: 'bodyweight',
    category: 'isolation',
    tracking: 'bodyweight_reps',
    instructions:
      'Hold a support and rise onto the toes. Let the knees travel forward as you lean back in one straight line from knees to head, lower as far as comfortable, then return.',
  },
  {
    key: 'smith-machine-heel-elevated-squat',
    name: 'Smith machine heel-elevated squat',
    primary: 'quads',
    secondary: ['glutes', 'adductors'],
    equipment: 'machine',
    category: 'compound',
    instructions:
      'Stand under the Smith bar with the heels raised on a plate or wedge and the feet slightly forward. Squat down with an upright torso as deep as you control, then drive up.',
  },
  {
    key: 'standing-single-leg-curl',
    name: 'Standing single-leg curl',
    primary: 'hamstrings',
    equipment: 'machine',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Stand in the machine with the pad behind one ankle and the hips against the support. Curl the heel up towards the glute, then lower slowly to a straight leg. Do one leg, then the other, and log each side.',
  },
  {
    key: 'glute-ham-raise',
    name: 'Glute-ham raise',
    primary: 'hamstrings',
    secondary: ['glutes'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'bodyweight_reps',
    instructions:
      'Lock the ankles in the bench with the knees on the pad. Lower the upper body forward under control until it is level, then curl back up with the hamstrings, keeping the hips straight.',
  },
  {
    key: 'cable-hip-abduction',
    name: 'Cable hip abduction',
    primary: 'glutes',
    equipment: 'cable',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Fit an ankle strap to a low cable and stand side-on with the outer leg strapped. Lift the leg out to the side without leaning, then lower slowly. Do one leg, then the other, and log each side.',
  },
  {
    key: 'cable-standing-hip-adduction',
    name: 'Cable standing hip adduction',
    primary: 'adductors',
    equipment: 'cable',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Fit an ankle strap to a low cable and stand side-on with the near leg strapped. Pull the leg across in front of the standing leg, then return slowly. Do one leg, then the other, and log each side.',
  },
  {
    key: 'copenhagen-adduction',
    name: 'Copenhagen adduction',
    primary: 'adductors',
    secondary: ['abs'],
    equipment: 'bodyweight',
    category: 'isolation',
    tracking: 'duration',
    instructions:
      'Lie on your side with the top leg on a bench and the forearm on the floor. Lift the hips so the body is straight, held up by the top leg. Hold for time, then switch sides.',
  },
  {
    key: 'standing-cable-hip-flexion',
    name: 'Standing cable hip flexion',
    primary: 'quads',
    equipment: 'cable',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Fit an ankle strap to a low cable and face away from it. Drive the knee up to hip height without leaning back, then lower slowly. Do one leg, then the other, and log each side.',
  },
  {
    key: 'seated-hip-flexion-raise',
    name: 'Seated hip flexion raise',
    primary: 'quads',
    equipment: 'bodyweight',
    category: 'isolation',
    tracking: 'bodyweight_reps',
    eachSide: true,
    instructions:
      'Sit tall on a bench or the floor. Lift one knee or straight leg as high as you can without leaning back, pause, then lower. Do one leg, then the other, and log each side.',
  },
  {
    key: 'donkey-calf-raise',
    name: 'Donkey calf raise',
    primary: 'calves',
    equipment: 'machine',
    category: 'isolation',
    instructions:
      'Bend at the hips with the pad on the lower back and the balls of the feet on the step. Lower the heels to a full stretch, pause, then rise as high as you can.',
  },
  {
    key: 'tibialis-raise',
    name: 'Tibialis raise',
    primary: 'calves',
    equipment: 'bodyweight',
    category: 'isolation',
    tracking: 'bodyweight_reps',
    instructions:
      'Lean back against a wall with the heels a foot or so in front. Lift the toes and fronts of the feet as high as you can, then lower slowly.',
  },
  {
    key: 'banded-ankle-eversion',
    name: 'Banded ankle eversion',
    primary: 'calves',
    equipment: 'band',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Sit with a band around the outside of one foot, anchored to the inside. Turn the sole of the foot outwards against the band, then return slowly. Do one foot, then the other, and log each side.',
  },
  {
    key: 'reverse-crunch-posterior-pelvic-tilt',
    name: 'Reverse crunch with posterior pelvic tilt',
    primary: 'abs',
    equipment: 'bodyweight',
    category: 'isolation',
    tracking: 'bodyweight_reps',
    instructions:
      'Lie on your back with the knees bent over the hips. Curl the pelvis up and roll the lower back off the floor, then lower slowly without swinging the legs.',
  },
  {
    key: 'cable-woodchop',
    name: 'Cable woodchop',
    primary: 'abs',
    secondary: ['glutes'],
    equipment: 'cable',
    category: 'compound',
    instructions:
      'Stand side-on to a cable with both hands on the handle. Rotate through the trunk and pull the handle diagonally across the body, then return slowly. Do both sides.',
  },
  {
    key: 'suitcase-carry',
    name: 'Suitcase carry',
    primary: 'abs',
    secondary: ['back'],
    equipment: 'dumbbell',
    category: 'compound',
    tracking: 'distance',
    instructions:
      'Hold one heavy dumbbell at one side, stand tall without leaning and walk with short steps. Switch hands and walk back. Log the distance covered.',
  },
  {
    key: 'neck-flexion',
    name: 'Neck flexion',
    primary: 'back',
    equipment: 'other',
    category: 'isolation',
    instructions:
      'Lie on your back with the head off the end of a bench and a light plate on the forehead, held with the hands. Slowly bring the chin to the chest, then lower. Go light, never jerk, and get advice if your neck has a problem.',
  },
  {
    key: 'neck-extension',
    name: 'Neck extension',
    primary: 'back',
    equipment: 'other',
    category: 'isolation',
    instructions:
      'Lie face down with the head off the end of a bench and a light plate behind the head, or use a neck harness. Slowly lift the head back, then lower. Go light and never force the movement.',
  },
  // November 2026: 39 researched additions (second sheet, also seeded by migration 0039).
  {
    key: 'dumbbell-pullover',
    name: 'Dumbbell pullover',
    primary: 'back',
    secondary: ['chest', 'triceps'],
    equipment: 'dumbbell',
    category: 'isolation',
    instructions:
      'Lie across or along a bench holding one dumbbell over the chest with both hands. Keeping a slight, fixed bend in the elbows, lower it back behind the head to a comfortable stretch, then pull it back over the chest. Log the weight of the dumbbell.',
  },
  {
    key: 'seated-machine-triceps-dip',
    name: 'Seated machine triceps dip',
    primary: 'triceps',
    secondary: ['chest', 'shoulders'],
    equipment: 'machine',
    category: 'compound',
    instructions:
      'Sit upright with the handles at your sides and the elbows close in. Press both handles down until the arms are straight, then let them rise slowly.',
  },
  {
    key: 'dumbbell-shrug',
    name: 'Dumbbell shrug',
    primary: 'back',
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    instructions:
      'Stand tall with a dumbbell in each hand at your sides. Lift the shoulders straight up towards the ears without rolling them, pause, then lower. Log the weight of one dumbbell.',
  },
  {
    key: 'standing-cable-shoulder-press',
    name: 'Standing cable shoulder press',
    primary: 'shoulders',
    secondary: ['triceps'],
    equipment: 'cable',
    category: 'compound',
    loadMode: 'per_hand',
    instructions:
      'Stand in a split stance between two low cables with a handle in each hand at shoulder height. Press both handles overhead together without leaning back or using the legs, then lower. Log the weight of one stack.',
  },
  {
    key: 'behind-the-neck-lat-pulldown',
    name: 'Behind-the-neck lat pulldown',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'cable',
    category: 'compound',
    instructions:
      'Sit at the pulldown with a wide overhand grip. Pull the bar down behind the head only as far as your shoulders move comfortably, keeping the head still, then return. Stop if the shoulders or neck complain.',
  },
  {
    key: 'weighted-push-up',
    name: 'Weighted push-up',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'weighted_bodyweight',
    instructions:
      'Wear a weighted vest or have a plate placed on the upper back. With the hands about shoulder width and the body straight, lower the chest to the floor, then push up. Log only the added weight.',
  },
  {
    key: 'weighted-standing-single-leg-calf-raise',
    name: 'Weighted standing single-leg calf raise',
    primary: 'calves',
    equipment: 'dumbbell',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Stand on one foot on a step holding a dumbbell, with a hand on a support for balance. With the knee nearly straight, lower the heel to a stretch, then rise as high as you can. Log the weight held and the reps for each leg.',
  },
  {
    key: 'smith-machine-shoulder-press',
    name: 'Smith machine shoulder press',
    primary: 'shoulders',
    secondary: ['triceps'],
    equipment: 'machine',
    category: 'compound',
    instructions:
      'Sit on an upright bench under the Smith bar with the bar in front of your face. Press it overhead along the fixed path, then lower to about chin height.',
  },
  {
    key: 'standing-dumbbell-shoulder-press',
    name: 'Standing dumbbell shoulder press',
    primary: 'shoulders',
    secondary: ['triceps'],
    equipment: 'dumbbell',
    category: 'compound',
    loadMode: 'per_hand',
    instructions:
      'Stand tall with the dumbbells at shoulder height. Press both overhead together without bending the knees or leaning back, then lower. Log the weight of one dumbbell.',
  },
  {
    key: 'single-arm-dumbbell-shoulder-press',
    name: 'Single-arm dumbbell shoulder press',
    primary: 'shoulders',
    secondary: ['triceps', 'abs'],
    equipment: 'dumbbell',
    category: 'compound',
    eachSide: true,
    instructions:
      'Stand tall with one dumbbell at shoulder height. Press it overhead without leaning to the side or using the legs, then lower. Do one arm, then the other, and log each side.',
  },
  {
    key: 'cable-rear-delt-fly',
    name: 'Cable rear delt fly',
    primary: 'shoulders',
    secondary: ['back'],
    equipment: 'cable',
    category: 'isolation',
    loadMode: 'per_hand',
    instructions:
      'Set two cables at shoulder height and take the opposite handle in each hand so the cables cross. With soft, fixed elbows, sweep both arms out and back, then return slowly. Do not row. Log the weight of one stack.',
  },
  {
    key: 'assisted-dip',
    name: 'Assisted dip',
    primary: 'triceps',
    secondary: ['chest', 'shoulders'],
    equipment: 'machine',
    category: 'compound',
    tracking: 'assisted_bodyweight',
    instructions:
      'Kneel or stand on the assistance pad and hold the parallel handles. Keep the torso upright and the elbows tucked, lower until the upper arms are about level, then press up. Log the assistance weight; less assistance means more work.',
  },
  {
    key: 'dumbbell-triceps-kickback',
    name: 'Dumbbell triceps kickback',
    primary: 'triceps',
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    eachSide: true,
    instructions:
      'Lean forward with one hand on a bench and the working upper arm against your side. Straighten the elbow until the arm is in line with the body, then bend it back without swinging. One arm at a time and log each side, or both arms together.',
  },
  {
    key: 'cable-triceps-kickback',
    name: 'Cable triceps kickback',
    primary: 'triceps',
    equipment: 'cable',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Hold a single handle from a low cable and lean forward with the upper arm fixed at your side. Straighten the elbow until the arm is in line with the body, then return slowly. Do one arm, then the other, and log each side.',
  },
  {
    key: 'smith-machine-shrug',
    name: 'Smith machine shrug',
    primary: 'back',
    equipment: 'machine',
    category: 'isolation',
    instructions:
      'Stand with the Smith bar in front of the thighs and the arms long. Lift the shoulders straight up towards the ears without rolling them, pause, then lower.',
  },
  {
    key: 'incline-dumbbell-fly',
    name: 'Incline dumbbell fly',
    primary: 'chest',
    secondary: ['shoulders'],
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    instructions:
      'Lie on a bench set to about 20 to 30 degrees with the dumbbells over the chest. With soft, fixed elbows, open the arms out to a stretch, then bring them back together. Do not press. Log the weight of one dumbbell.',
  },
  {
    key: 'decline-push-up',
    name: 'Decline push-up',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'bodyweight_reps',
    instructions:
      'Put the feet on a bench or box about 30 to 45 cm high and the hands on the floor at shoulder width. Keep the body straight, lower the chest to the floor, then push up.',
  },
  {
    key: 'incline-push-up',
    name: 'Incline push-up',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'bodyweight_reps',
    instructions:
      'Put the hands on a bench or stable edge at shoulder width with the feet on the floor. Keep the body straight, lower the chest to the edge, then push away.',
  },
  {
    key: 'diamond-push-up',
    name: 'Diamond push-up',
    primary: 'triceps',
    secondary: ['chest', 'shoulders'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'bodyweight_reps',
    instructions:
      'Put the hands close together under the chest, thumbs and fingers forming a diamond. Keep the elbows close and the body straight, lower the chest to the hands, then push up.',
  },
  {
    key: 'reverse-grip-lat-pulldown',
    name: 'Reverse-grip lat pulldown',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'cable',
    category: 'compound',
    instructions:
      'Hold the bar with the palms facing you at shoulder width. Pull it down in front to the upper chest with little lean or swing, then let it rise to straight arms.',
  },
  {
    key: 'weighted-chin-up',
    name: 'Weighted chin-up',
    primary: 'back',
    secondary: ['biceps'],
    equipment: 'bodyweight',
    category: 'compound',
    tracking: 'weighted_bodyweight',
    instructions:
      'Add weight with a belt or vest and hang with the palms facing you at shoulder width. Pull the chin over the bar, then lower to a full hang. Log only the added weight.',
  },
  {
    key: 'smith-machine-calf-raise',
    name: 'Smith machine calf raise',
    primary: 'calves',
    equipment: 'machine',
    category: 'isolation',
    instructions:
      'Stand under the Smith bar with the balls of both feet on a raised plate or step. With the knees nearly straight, lower the heels to a stretch, then rise as high as you can.',
  },
  {
    key: 'standing-dumbbell-calf-raise',
    name: 'Standing dumbbell calf raise',
    primary: 'calves',
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    instructions:
      'Stand on a step with a dumbbell in each hand. With the knees nearly straight, lower the heels to a stretch, then rise as high as you can. Log the weight of one dumbbell.',
  },
  {
    key: 'barbell-wrist-curl',
    name: 'Barbell wrist curl',
    primary: 'biceps',
    equipment: 'barbell',
    category: 'isolation',
    instructions:
      'Sit with the forearms on the thighs or a bench, palms up and wrists past the edge, holding a barbell. Curl the wrists up as far as they go, then lower slowly.',
  },
  {
    key: 'cable-wrist-curl',
    name: 'Cable wrist curl',
    primary: 'biceps',
    equipment: 'cable',
    category: 'isolation',
    instructions:
      'Kneel or sit facing a low cable with a straight bar, forearms supported and palms up. Curl the wrists up as far as they go, then lower slowly. With a single handle, do one hand at a time and log each side.',
  },
  {
    key: 'dumbbell-preacher-curl',
    name: 'Dumbbell preacher curl',
    primary: 'biceps',
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    eachSide: true,
    instructions:
      'Rest the back of the upper arm on the preacher pad with the palm up. Curl the dumbbell up without lifting the elbow, then lower to a nearly straight arm. One arm at a time and log each side, or both arms together.',
  },
  {
    key: 'concentration-curl',
    name: 'Concentration curl',
    primary: 'biceps',
    equipment: 'dumbbell',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Sit with the working elbow braced against the inside of the thigh. Curl the dumbbell up to the shoulder without moving the body, then lower to a straight arm. Do one arm, then the other, and log each side.',
  },
  {
    key: 'reverse-barbell-wrist-curl',
    name: 'Reverse barbell wrist curl',
    primary: 'biceps',
    equipment: 'barbell',
    category: 'isolation',
    instructions:
      'Sit with the forearms on the thighs or a bench, palms down and wrists past the edge, holding a barbell. Lift the backs of the hands up as far as they go without lifting the elbows, then lower slowly.',
  },
  {
    key: 'reverse-cable-wrist-curl',
    name: 'Reverse cable wrist curl',
    primary: 'biceps',
    equipment: 'cable',
    category: 'isolation',
    instructions:
      'Kneel or sit facing a low cable with a straight bar, forearms supported and palms down. Lift the backs of the hands up as far as they go, then lower slowly. With a single handle, do one hand at a time and log each side.',
  },
  {
    key: 'wrist-roller',
    name: 'Wrist roller',
    primary: 'biceps',
    equipment: 'other',
    category: 'isolation',
    instructions:
      'Hold the roller in front with both hands, the weight hanging on its cord. Roll the weight all the way up by turning the wrists, then lower it under control. One rep is up and down. Log the hanging weight.',
  },
  {
    key: 'plate-pinch-hold',
    name: 'Plate pinch hold',
    primary: 'biceps',
    equipment: 'other',
    category: 'isolation',
    tracking: 'duration',
    instructions:
      'Pinch smooth weight plates together between the thumb and fingers of one hand, arm hanging at your side. Hold for time, then switch hands. Log each hand as its own set.',
  },
  {
    key: 'single-arm-cable-shoulder-press',
    name: 'Single-arm cable shoulder press',
    primary: 'shoulders',
    secondary: ['triceps', 'abs'],
    equipment: 'cable',
    category: 'compound',
    eachSide: true,
    instructions:
      'Stand in a split stance with a single handle from a low cable at shoulder height. Press it overhead without twisting the trunk, then lower. Do one arm, then the other, and log each side.',
  },
  {
    key: 'cable-front-raise',
    name: 'Cable front raise',
    primary: 'shoulders',
    equipment: 'cable',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Face away from a low cable holding the handle at your side. Raise the straight arm in front to shoulder height, then lower slowly. One arm at a time and log each side, or both hands on a bar.',
  },
  {
    key: 'incline-dumbbell-shrug',
    name: 'Incline dumbbell shrug',
    primary: 'back',
    equipment: 'dumbbell',
    category: 'isolation',
    loadMode: 'per_hand',
    instructions:
      'Lie chest down on a bench set to 30 to 45 degrees with the dumbbells hanging. Keeping the arms straight, lift the shoulders up towards the ears and slightly back, then lower. Do not row. Log the weight of one dumbbell.',
  },
  {
    key: 'behind-the-back-barbell-shrug',
    name: 'Behind-the-back barbell shrug',
    primary: 'back',
    equipment: 'barbell',
    category: 'isolation',
    instructions:
      'Hold a barbell behind the thighs with straight arms. Lift the shoulders straight up towards the ears, pause, then lower.',
  },
  {
    key: 'single-arm-straight-arm-pulldown',
    name: 'Single-arm straight-arm pulldown',
    primary: 'back',
    equipment: 'cable',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Face a high cable holding a single handle with a soft, fixed elbow. Pull the hand down in an arc to the hip without bending the elbow, then return slowly. Do one arm, then the other, and log each side.',
  },
  {
    key: 'seated-single-leg-calf-raise',
    name: 'Seated single-leg calf raise',
    primary: 'calves',
    equipment: 'machine',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Sit with one forefoot on the step and the knee bent to about 90 degrees under the pad, or with a dumbbell on the thigh. Lower the heel to a stretch, then rise as high as you can. Do one leg, then the other, and log each side.',
  },
  {
    key: 'weighted-tibialis-raise',
    name: 'Weighted tibialis raise',
    primary: 'calves',
    equipment: 'other',
    category: 'isolation',
    instructions:
      'Sit or stand with the heels supported and both feet under a tibialis machine pad or tib bar. Pull the toes and fronts of the feet up as high as you can, then lower slowly.',
  },
  {
    key: 'neck-lateral-flexion',
    name: 'Neck lateral flexion',
    primary: 'back',
    equipment: 'other',
    category: 'isolation',
    eachSide: true,
    instructions:
      'Lie on your side with the head off the end of a bench, or use a harness or your hand for resistance. Slowly bend the ear towards the shoulder and back, without turning the head. Go light, do one side, then the other, and log each side.',
  },
];

/** Fixed timestamp so system records are identical on every device and every load. */
const LIBRARY_VERSION_TIME = '2026-01-01T00:00:00.000Z';

export const exerciseIdFor = (key: string) => stableId(`exercise:${key}`);

export const SYSTEM_EXERCISES: Exercise[] = SEEDS.map((s) => ({
  id: exerciseIdFor(s.key),
  createdAt: LIBRARY_VERSION_TIME,
  updatedAt: LIBRARY_VERSION_TIME,
  deletedAt: null,
  origin: 'system',
  name: s.name,
  primaryMuscle: s.primary,
  secondaryMuscles: s.secondary ?? [],
  equipment: s.equipment,
  category: s.category,
  trackingType: s.tracking ?? 'weight_reps',
  loadMode: s.loadMode ?? 'total',
  instructions: s.instructions,
  isCustom: false,
}));

export const SYSTEM_EXERCISE_KEYS = SEEDS.map((s) => s.key);

/** Library exercises done one side at a time: their reps are logged for each side by default. */
export const EACH_SIDE_EXERCISE_IDS: ReadonlySet<string> = new Set(
  SEEDS.filter((s) => s.eachSide).map((s) => exerciseIdFor(s.key)),
);

/** Exercises that became per side by default later, and from when (see `eachSideSince`). */
export const EACH_SIDE_SINCE: ReadonlyMap<string, string> = new Map(
  SEEDS.filter((s) => s.eachSide && s.eachSideSince).map((s) => [
    exerciseIdFor(s.key),
    s.eachSideSince!,
  ]),
);
