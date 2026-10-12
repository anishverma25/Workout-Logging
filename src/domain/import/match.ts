import type {
  Equipment,
  Exercise,
  LoadMode,
  MuscleGroup,
  TrackingType,
} from '@/domain/models/schemas';
import { normalize } from '@/domain/exercises/search';
import type { ImportedSet } from './formats';

/**
 * Turning another app's exercise names into Overload's library.
 *
 * Hevy and Strong name exercises "Movement (Equipment)", for example "Bench Press (Barbell)".
 * A match is only made when it is the same movement on the same equipment: a wrong match
 * would mix two lifts' numbers in every chart and record, which is worse than none. Anything
 * not matched becomes the person's own custom exercise, keeping its name, with the muscle,
 * equipment and tracking worked out from the name and the logged sets. The person can change
 * every match before anything is saved.
 */

/** Hevy and Strong names (lowercase) that the library calls something else. */
const ALIASES: Record<string, string> = {
  'bench press (barbell)': 'Barbell bench press',
  'incline bench press (barbell)': 'Incline barbell bench press',
  'bench press (dumbbell)': 'Dumbbell bench press',
  'incline bench press (dumbbell)': 'Incline dumbbell press',
  'chest press (machine)': 'Machine chest press',
  'bench press (smith machine)': 'Smith machine bench press',
  'decline bench press (barbell)': 'Decline barbell bench press',
  'decline bench press (dumbbell)': 'Decline dumbbell press',
  'jump rope': 'Jump rope',
  'chest fly (machine)': 'Pec deck',
  'butterfly (pec deck)': 'Pec deck',
  'pec deck (machine)': 'Pec deck',
  'cable fly crossovers': 'Cable fly',
  'cable crossover': 'Cable fly',
  'chest fly (cable)': 'Cable fly',
  'chest fly (dumbbell)': 'Dumbbell fly',
  'chest fly': 'Dumbbell fly',
  'push up': 'Push-up',
  'chest dip': 'Dips',
  'triceps dip': 'Dips',
  'chest dip (weighted)': 'Weighted dips',
  'deadlift (barbell)': 'Deadlift',
  'pull up': 'Pull-up',
  'chin up': 'Chin-up',
  'pull up (weighted)': 'Weighted pull-up',
  'pull up (assisted)': 'Assisted pull-up',
  'lat pulldown (cable)': 'Lat pulldown',
  'lat pulldown (machine)': 'Lat pulldown',
  'lat pulldown - close grip (cable)': 'Close-grip lat pulldown',
  'bent over row (barbell)': 'Barbell row',
  'pendlay row (barbell)': 'Pendlay row',
  'dumbbell row': 'One-arm dumbbell row',
  'bent over one arm row (dumbbell)': 'One-arm dumbbell row',
  'chest supported incline row (dumbbell)': 'Chest-supported row',
  'seated cable row - v grip (cable)': 'Seated cable row',
  'seated row (cable)': 'Seated cable row',
  'seated row (machine)': 'Machine row',
  'iso-lateral row (machine)': 'Machine row',
  't bar row': 'T-bar row',
  't bar row (barbell)': 'T-bar row',
  'straight arm lat pulldown (cable)': 'Straight-arm pulldown',
  'back extension (hyperextension)': 'Back extension',
  'shrug (barbell)': 'Barbell shrug',
  'overhead press (barbell)': 'Overhead press',
  'strict military press (barbell)': 'Overhead press',
  'seated overhead press (dumbbell)': 'Seated dumbbell shoulder press',
  'shoulder press (dumbbell)': 'Seated dumbbell shoulder press',
  'overhead press (dumbbell)': 'Seated dumbbell shoulder press',
  'shoulder press (machine)': 'Machine shoulder press',
  'overhead press (machine)': 'Machine shoulder press',
  'arnold press (dumbbell)': 'Arnold press',
  'lateral raise (dumbbell)': 'Dumbbell lateral raise',
  'lateral raise (cable)': 'Cable lateral raise',
  'lateral raise (machine)': 'Machine lateral raise',
  'front raise (dumbbell)': 'Dumbbell front raise',
  'rear delt reverse fly (dumbbell)': 'Rear delt fly',
  'reverse fly (dumbbell)': 'Rear delt fly',
  'rear delt reverse fly (machine)': 'Reverse pec deck',
  'reverse fly (machine)': 'Reverse pec deck',
  'face pull (cable)': 'Face pull',
  'upright row (cable)': 'Cable upright row',
  'bicep curl (barbell)': 'Barbell curl',
  'ez bar biceps curl': 'EZ-bar curl',
  'bicep curl (ez bar)': 'EZ-bar curl',
  'bicep curl (dumbbell)': 'Dumbbell curl',
  'hammer curl (dumbbell)': 'Hammer curl',
  'seated incline curl (dumbbell)': 'Incline dumbbell curl',
  'incline curl (dumbbell)': 'Incline dumbbell curl',
  'preacher curl (machine)': 'Preacher curl',
  'bicep curl (cable)': 'Cable curl',
  'bench press - close grip (barbell)': 'Close-grip bench press',
  'close grip bench press (barbell)': 'Close-grip bench press',
  'triceps rope pushdown': 'Triceps rope pushdown',
  'triceps pushdown (cable - rope)': 'Triceps rope pushdown',
  'triceps pushdown': 'Triceps bar pushdown',
  'triceps pushdown (cable - straight bar)': 'Triceps bar pushdown',
  'overhead triceps extension (cable)': 'Overhead triceps extension',
  'triceps extension (cable)': 'Overhead triceps extension',
  'skullcrusher (barbell)': 'Skull crusher',
  'skullcrusher (ez bar)': 'Skull crusher',
  'triceps extension (dumbbell)': 'Dumbbell overhead extension',
  'squat (barbell)': 'Back squat',
  'full squat': 'Back squat',
  'front squat (barbell)': 'Front squat',
  'hack squat (machine)': 'Hack squat',
  'leg press (machine)': 'Leg press',
  'goblet squat (dumbbell)': 'Goblet squat',
  'goblet squat (kettlebell)': 'Goblet squat',
  'bulgarian split squat (dumbbell)': 'Bulgarian split squat',
  'walking lunge (dumbbell)': 'Walking lunge',
  'lunge (dumbbell)': 'Walking lunge',
  'step up (dumbbell)': 'Dumbbell step-up',
  'leg extension (machine)': 'Leg extension',
  'romanian deadlift (barbell)': 'Romanian deadlift',
  'romanian deadlift (dumbbell)': 'Dumbbell Romanian deadlift',
  'straight leg deadlift': 'Stiff-leg deadlift',
  'stiff leg deadlift (barbell)': 'Stiff-leg deadlift',
  'lying leg curl (machine)': 'Lying leg curl',
  'seated leg curl (machine)': 'Seated leg curl',
  'nordic hamstrings curls': 'Nordic curl',
  'good morning (barbell)': 'Good morning',
  'hip thrust (barbell)': 'Hip thrust',
  'hip thrust (machine)': 'Machine hip thrust',
  'glute bridge': 'Glute bridge',
  'glute kickback (cable)': 'Cable glute kickback',
  'hip abduction (machine)': 'Hip abduction machine',
  'sumo deadlift (barbell)': 'Sumo deadlift',
  'standing calf raise (machine)': 'Standing calf raise',
  'standing calf raise (smith)': 'Standing calf raise',
  'standing calf raise (smith machine)': 'Standing calf raise',
  'seated calf raise (machine)': 'Seated calf raise',
  'seated calf raise': 'Seated calf raise',
  'calf press on leg press': 'Leg press calf raise',
  'calf press (machine)': 'Leg press calf raise',
  'single leg standing calf raise': 'Single-leg calf raise',
  'hanging leg raise': 'Hanging leg raise',
  'cable crunch': 'Cable crunch',
  crunch: 'Crunch',
  'ab wheel': 'Ab wheel rollout',
  'decline crunch': 'Decline sit-up',
  'sit up': 'Decline sit-up',
  plank: 'Plank',
  'side plank': 'Side plank',
  'pallof press (cable)': 'Pallof press',
  'farmers walk': "Farmer's carry",
  'farmer walk': "Farmer's carry",
  'kettlebell swing': 'Kettlebell swing',
  'pike pushup': 'Pike push-up',
  'band pull apart': 'Band pull-apart',
  treadmill: 'Treadmill run',
  running: 'Outdoor run',
  'running (treadmill)': 'Treadmill run',
  cycling: 'Stationary bike',
  spinning: 'Stationary bike',
  'rowing machine': 'Rowing machine',
  'elliptical trainer': 'Elliptical',
  'stair machine': 'Stair climber',
  'stair stepper': 'Stair climber',
};

const EQUIPMENT_WORDS: [RegExp, Equipment, string][] = [
  [/smith/, 'machine', 'smith machine'],
  [/barbell|ez bar|trap bar/, 'barbell', 'barbell'],
  [/dumbbell/, 'dumbbell', 'dumbbell'],
  [/cable/, 'cable', 'cable'],
  [/kettlebell/, 'kettlebell', 'kettlebell'],
  [/band/, 'band', 'band'],
  [/machine|plate loaded|lever/, 'machine', 'machine'],
  [/bodyweight|weighted|assisted/, 'bodyweight', ''],
];

function splitName(raw: string): { base: string; equipment: Equipment | null; prefix: string } {
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(raw.trim());
  const base = normalize(m ? m[1]! : raw);
  const inParens = m ? m[2]!.toLowerCase() : '';
  for (const [re, eq, prefix] of EQUIPMENT_WORDS) {
    if (re.test(inParens)) return { base, equipment: eq, prefix };
  }
  return { base, equipment: null, prefix: '' };
}

/** Library entry for an imported name, or null when there is no safe match. */
export function matchExercise(raw: string, library: Exercise[]): Exercise | null {
  const byName = new Map(library.map((e) => [normalize(e.name), e]));
  const alias = ALIASES[raw.trim().toLowerCase().replace(/\s+/g, ' ')];
  if (alias) return byName.get(normalize(alias)) ?? null;

  const { base, equipment, prefix } = splitName(raw);
  const singular = base.replace(/s$/, '');
  // [name to look up, whether it already names the equipment]
  const tries: [string, boolean][] = [];
  if (prefix) {
    tries.push(
      [`${prefix} ${base}`, true],
      [`${prefix} ${singular}`, true],
      [`${base} ${prefix}`, true],
      [`${singular} ${prefix}`, true],
    );
  }
  tries.push([base, false], [singular, false]);
  for (const [candidate, namesEquipment] of tries) {
    const hit = byName.get(normalize(candidate));
    // The bare movement name only counts when the equipment agrees.
    if (hit && (namesEquipment || !equipment || hit.equipment === equipment)) return hit;
  }
  return null;
}

/** What an exercise with no library match becomes: the person's own, described from its name. */
export interface InferredExercise {
  name: string;
  primaryMuscle: MuscleGroup;
  equipment: Equipment;
  category: 'compound' | 'isolation';
  trackingType: TrackingType;
  loadMode: LoadMode;
}

/** First rule that matches wins; order matters ("leg curl" before "curl"). */
const MUSCLE_RULES: [RegExp, MuscleGroup][] = [
  [
    /treadmill|running|\brun\b|cycling|bike|elliptical|stair|^walk(ing)?$|^(rowing machine|rower)|jump rope|swim/,
    'cardio',
  ],
  [/calf|calves/, 'calves'],
  [/adduct/, 'adductors'],
  [/abduct|glute|hip thrust|kickback|bridge/, 'glutes'],
  [/leg curl|hamstring|nordic|romanian|\brdl\b|stiff|straight leg dead|good morning/, 'hamstrings'],
  [/squat|leg press|leg extension|lunge|step up|sissy|hack/, 'quads'],
  [/crunch|plank|sit up|\bab\b|abs|leg raise|knee raise|oblique|pallof|wood ?chop|hollow/, 'abs'],
  [/pec|chest|bench|fly|flye|push up|pushup|dip/, 'chest'],
  [/curl|brachialis/, 'biceps'],
  [/tricep|pushdown|push down|skull|kickback|extension/, 'triceps'],
  [
    /lateral raise|front raise|rear delt|reverse fly|shoulder|overhead press|military|arnold|face pull|upright row|delt/,
    'shoulders',
  ],
  [
    /shrug|deadlift|row|pulldown|pull down|pull up|pullup|chin|pullover|lat\b|lats|sagg?ittal|back/,
    'back',
  ],
];

const ISOLATION =
  /fly|flye|raise|curl|extension|pushdown|push down|kickback|crunch|shrug|abduct|adduct|pullover|plank|calf/;
const COMPOUND =
  /press|squat|deadlift|row|pulldown|pull up|pullup|chin|dip|lunge|thrust|clean|snatch|push up|step up/;
/** Moves done with one dumbbell held in both hands, logged as that one weight. */
const ONE_DUMBBELL = /pullover|goblet|overhead extension|triceps extension|french press/;

function muscleOf(name: string): MuscleGroup {
  for (const [re, m] of MUSCLE_RULES) if (re.test(name)) return m;
  return 'back';
}

function trackingOf(sets: ImportedSet[]): TrackingType {
  const has = (k: keyof ImportedSet) => sets.some((s) => s[k] !== null && s[k] !== 0);
  if (has('weightKg')) return 'weight_reps';
  if (has('reps')) return 'bodyweight_reps';
  if (has('distanceM') && has('durationSec')) return 'cardio';
  if (has('distanceM')) return 'distance';
  if (has('durationSec')) return 'duration';
  return 'weight_reps';
}

export function inferExercise(raw: string, sets: ImportedSet[]): InferredExercise {
  const name = raw.trim().replace(/\s+/g, ' ').slice(0, 80);
  const lower = normalize(raw);
  const { equipment } = splitName(raw);
  const eq: Equipment =
    equipment ??
    (/smith|machine|sagg?ittal|kelso|hammer strength|iso lateral/.test(lower)
      ? 'machine'
      : /cable/.test(lower)
        ? 'cable'
        : /dumbbell|\bdb\b/.test(lower)
          ? 'dumbbell'
          : /barbell|\bbb\b/.test(lower)
            ? 'barbell'
            : 'other');
  const primaryMuscle = muscleOf(lower);
  const tracking = trackingOf(sets);
  const category =
    primaryMuscle === 'cardio' || (COMPOUND.test(lower) && !ISOLATION.test(lower))
      ? 'compound'
      : 'isolation';
  const perSide = /single arm|single leg|one arm|one leg|unilateral/.test(lower);
  const loadMode: LoadMode =
    tracking === 'weight_reps' && (perSide || (eq === 'dumbbell' && !ONE_DUMBBELL.test(lower)))
      ? 'per_hand'
      : 'total';
  return { name, primaryMuscle, equipment: eq, category, trackingType: tracking, loadMode };
}
