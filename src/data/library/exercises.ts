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
