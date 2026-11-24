import { stableId } from '@/lib/ids';
import type { Exercise, MuscleGroup } from '@/domain/models/schemas';
import { within } from './taxonomy';

/**
 * What each library exercise works, in the muscle taxonomy (November 2026), reviewed one by one.
 *
 * - primary: the muscles the exercise is chosen for; a working set counts as a direct set.
 * - secondary: muscles that clearly assist; a set counts as half an indirect set (the app's rule
 *   since the evidence batch, `SECONDARY_SET_WEIGHT`).
 * - stabilizers: hold a position, never counted as sets.
 * - emphasis: what research says the exercise biases, in plain words. It biases, it never
 *   isolates one head or region.
 *
 * Keys are the library's permanent exercise keys. Custom exercises use their stored primary and
 * secondary groups (`legacyTargets`).
 */

export type Pattern =
  | 'horizontal push'
  | 'vertical push'
  | 'horizontal pull'
  | 'vertical pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'hip extension'
  | 'knee extension'
  | 'knee flexion'
  | 'elbow flexion'
  | 'elbow extension'
  | 'shoulder raise'
  | 'fly'
  | 'shrug'
  | 'calf raise'
  | 'trunk flexion'
  | 'anti-movement'
  | 'carry'
  | 'hip abduction'
  | 'hip adduction'
  | 'pullover'
  | 'cardio';

export interface ExerciseTargets {
  primary: string[];
  secondary: string[];
  stabilizers: string[];
  pattern: Pattern;
  /** Main joint actions, plain words. */
  actions: string;
  emphasis?: string;
}

type Row = [
  primary: string,
  secondary: string,
  stabilizers: string,
  pattern: Pattern,
  actions: string,
  emphasis?: string,
];

const split = (s: string) => (s ? s.split(' ') : []);

// Shorthands used below.
const PEC = 'pec-sternocostal pec-clavicular';
const TRI = 'triceps-long triceps-lateral triceps-medial';
const TRI_SHORT = 'triceps-lateral triceps-medial';
const BI = 'biceps-long biceps-short brachialis';
const LATS = 'latissimus-dorsi teres-major';
const MIDBACK = 'rhomboids trap-middle trap-lower';
const ERECT = 'iliocostalis longissimus spinalis multifidus';
const CORE = 'rectus-abdominis transverse-abdominis external-obliques internal-obliques';
const GRIP = 'finger-flexors wrist-flexors';
const QUADS = 'vastus-lateralis vastus-medialis vastus-intermedius rectus-femoris';
const VASTI = 'vastus-lateralis vastus-medialis vastus-intermedius';
const HAMS = 'biceps-femoris-long semitendinosus semimembranosus';
const HAMS_ALL = 'biceps-femoris-long biceps-femoris-short semitendinosus semimembranosus';
const GASTROC = 'gastroc-medial gastroc-lateral';
const CUFF = 'supraspinatus infraspinatus teres-minor subscapularis';

const ROWS: Record<string, Row> = {
  // Chest
  'barbell-bench-press': [
    PEC,
    `delt-front ${TRI}`,
    `${CUFF} serratus-anterior`,
    'horizontal push',
    'Shoulder horizontal adduction, elbow extension',
    'Mostly the sternocostal (mid and lower) chest',
  ],
  'incline-barbell-bench-press': [
    'pec-clavicular pec-sternocostal',
    `delt-front ${TRI}`,
    `${CUFF} serratus-anterior`,
    'horizontal push',
    'Shoulder flexion and horizontal adduction, elbow extension',
    'A low incline (about 30°) biases the upper chest',
  ],
  'dumbbell-bench-press': [
    PEC,
    `delt-front ${TRI}`,
    `${CUFF} serratus-anterior`,
    'horizontal push',
    'Shoulder horizontal adduction, elbow extension',
    'Deeper stretch than the barbell; mostly mid and lower chest',
  ],
  'incline-dumbbell-press': [
    'pec-clavicular pec-sternocostal',
    `delt-front ${TRI}`,
    `${CUFF} serratus-anterior`,
    'horizontal push',
    'Shoulder flexion and horizontal adduction, elbow extension',
    'A low incline biases the upper chest',
  ],
  'machine-chest-press': [
    PEC,
    `delt-front ${TRI}`,
    '',
    'horizontal push',
    'Shoulder horizontal adduction, elbow extension',
  ],
  'smith-machine-bench-press': [
    PEC,
    `delt-front ${TRI}`,
    CUFF,
    'horizontal push',
    'Shoulder horizontal adduction, elbow extension',
  ],
  'cable-fly': [
    PEC,
    'delt-front',
    'biceps-short',
    'fly',
    'Shoulder horizontal adduction',
    'Low-to-high cables bias the upper chest, high-to-low the lower chest',
  ],
  'dumbbell-fly': [
    PEC,
    'delt-front',
    'biceps-short',
    'fly',
    'Shoulder horizontal adduction',
    'Hardest at the stretch',
  ],
  'pec-deck': [PEC, 'delt-front', '', 'fly', 'Shoulder horizontal adduction'],
  'push-up': [
    PEC,
    `delt-front ${TRI}`,
    `serratus-anterior ${CORE}`,
    'horizontal push',
    'Shoulder horizontal adduction, elbow extension',
    'The serratus works more than in a bench press',
  ],
  dips: [
    `pec-sternocostal ${TRI}`,
    'delt-front pec-clavicular',
    'pec-minor trap-lower',
    'vertical push',
    'Shoulder flexion from extension, elbow extension',
    'A forward lean biases the lower chest, upright the triceps',
  ],
  'weighted-dips': [
    `pec-sternocostal ${TRI}`,
    'delt-front pec-clavicular',
    'pec-minor trap-lower',
    'vertical push',
    'Shoulder flexion from extension, elbow extension',
    'A forward lean biases the lower chest, upright the triceps',
  ],
  'decline-bench-press': [
    'pec-sternocostal',
    `delt-front ${TRI}`,
    CUFF,
    'horizontal push',
    'Shoulder horizontal adduction and extension, elbow extension',
    'Biases the lower (sternocostal) chest',
  ],
  'decline-dumbbell-press': [
    'pec-sternocostal',
    `delt-front ${TRI}`,
    CUFF,
    'horizontal push',
    'Shoulder horizontal adduction and extension, elbow extension',
    'Biases the lower (sternocostal) chest',
  ],
  'one-arm-pec-deck': [
    PEC,
    'delt-front',
    'external-obliques internal-obliques',
    'fly',
    'Shoulder horizontal adduction',
  ],
  'keenan-flap': [
    'latissimus-dorsi teres-major',
    'pec-sternocostal triceps-long',
    'rectus-abdominis',
    'pullover',
    'Shoulder extension and adduction',
  ],

  // Back
  deadlift: [
    `glute-max ${ERECT} adductor-magnus`,
    `${HAMS} ${VASTI} trap-upper trap-middle latissimus-dorsi ${GRIP}`,
    `${CORE} quadratus-lumborum rhomboids`,
    'hinge',
    'Hip and knee extension, spine held still',
  ],
  'pull-up': [
    LATS,
    `${BI} brachioradialis trap-lower rhomboids delt-rear`,
    `finger-flexors ${CORE}`,
    'vertical pull',
    'Shoulder adduction and extension, elbow flexion',
  ],
  'chin-up': [
    `${LATS} biceps-long biceps-short`,
    'brachialis trap-lower rhomboids pec-sternocostal',
    `finger-flexors ${CORE}`,
    'vertical pull',
    'Shoulder extension, elbow flexion',
    'Palms toward you: more biceps than a pull-up',
  ],
  'weighted-pull-up': [
    LATS,
    `${BI} brachioradialis trap-lower rhomboids delt-rear`,
    `finger-flexors ${CORE}`,
    'vertical pull',
    'Shoulder adduction and extension, elbow flexion',
  ],
  'assisted-pull-up': [
    LATS,
    `${BI} brachioradialis trap-lower rhomboids`,
    'finger-flexors',
    'vertical pull',
    'Shoulder adduction and extension, elbow flexion',
  ],
  'lat-pulldown': [
    LATS,
    `${BI} brachioradialis trap-lower rhomboids delt-rear`,
    'finger-flexors',
    'vertical pull',
    'Shoulder adduction and extension, elbow flexion',
  ],
  'close-grip-lat-pulldown': [
    LATS,
    `${BI} brachioradialis rhomboids trap-lower`,
    'finger-flexors',
    'vertical pull',
    'Shoulder extension, elbow flexion',
  ],
  'barbell-row': [
    `${LATS} ${MIDBACK}`,
    `delt-rear ${BI} brachioradialis`,
    `${ERECT} ${HAMS} glute-max ${GRIP}`,
    'horizontal pull',
    'Shoulder extension, scapular retraction, elbow flexion',
  ],
  'pendlay-row': [
    `${LATS} ${MIDBACK}`,
    `delt-rear ${BI} brachioradialis`,
    `${ERECT} ${HAMS} glute-max ${GRIP}`,
    'horizontal pull',
    'Shoulder extension, scapular retraction, elbow flexion',
  ],
  'one-arm-dumbbell-row': [
    `${LATS} rhomboids trap-middle`,
    `delt-rear ${BI} brachioradialis`,
    `external-obliques internal-obliques ${GRIP}`,
    'horizontal pull',
    'Shoulder extension, scapular retraction, elbow flexion',
    'Elbow close to the side biases the lats',
  ],
  'chest-supported-row': [
    `${MIDBACK} ${LATS}`,
    `delt-rear ${BI} brachioradialis`,
    'finger-flexors',
    'horizontal pull',
    'Shoulder extension, scapular retraction, elbow flexion',
    'No lower back work, so the upper back can take the load',
  ],
  'seated-cable-row': [
    `${LATS} ${MIDBACK}`,
    `delt-rear ${BI} brachioradialis`,
    `${ERECT} finger-flexors`,
    'horizontal pull',
    'Shoulder extension, scapular retraction, elbow flexion',
  ],
  'machine-row': [
    `${MIDBACK} ${LATS}`,
    `delt-rear ${BI} brachioradialis`,
    'finger-flexors',
    'horizontal pull',
    'Shoulder extension, scapular retraction, elbow flexion',
  ],
  't-bar-row': [
    `${LATS} ${MIDBACK}`,
    `delt-rear ${BI} brachioradialis`,
    `${ERECT} glute-max ${HAMS} ${GRIP}`,
    'horizontal pull',
    'Shoulder extension, scapular retraction, elbow flexion',
  ],
  'straight-arm-pulldown': [
    LATS,
    'triceps-long pec-sternocostal',
    `rectus-abdominis ${GRIP}`,
    'pullover',
    'Shoulder extension with straight arms',
    'Lats without the biceps',
  ],
  'back-extension': [
    `${ERECT} glute-max`,
    HAMS,
    'quadratus-lumborum',
    'hinge',
    'Hip and spine extension',
    'Rounding the back biases the erectors; a flat back the glutes and hamstrings',
  ],
  'barbell-shrug': [
    'trap-upper',
    `levator-scapulae trap-middle ${GRIP}`,
    'rhomboids',
    'shrug',
    'Scapular elevation',
  ],
  'kelso-shrug': [
    'trap-middle rhomboids trap-lower',
    'trap-upper',
    'finger-flexors',
    'shrug',
    'Scapular retraction',
    'Chest-supported shrug for the mid traps',
  ],
  'one-arm-lat-pulldown': [
    LATS,
    `${BI} brachioradialis trap-lower`,
    'external-obliques internal-obliques finger-flexors',
    'vertical pull',
    'Shoulder adduction and extension, elbow flexion',
  ],
  'one-arm-cable-row': [
    `${LATS} rhomboids trap-middle`,
    `delt-rear ${BI}`,
    'external-obliques internal-obliques finger-flexors',
    'horizontal pull',
    'Shoulder extension, scapular retraction, elbow flexion',
  ],

  // Shoulders
  'overhead-press': [
    'delt-front delt-side',
    `${TRI} pec-clavicular trap-upper serratus-anterior`,
    `${CORE} ${ERECT} glute-max ${CUFF}`,
    'vertical push',
    'Shoulder flexion and abduction, elbow extension, upward rotation of the shoulder blade',
  ],
  'seated-dumbbell-press': [
    'delt-front delt-side',
    `${TRI} pec-clavicular trap-upper serratus-anterior`,
    CUFF,
    'vertical push',
    'Shoulder flexion and abduction, elbow extension',
  ],
  'machine-shoulder-press': [
    'delt-front delt-side',
    `${TRI} pec-clavicular`,
    '',
    'vertical push',
    'Shoulder flexion and abduction, elbow extension',
  ],
  'arnold-press': [
    'delt-front delt-side',
    `${TRI} pec-clavicular serratus-anterior`,
    CUFF,
    'vertical push',
    'Shoulder flexion, abduction and rotation, elbow extension',
  ],
  'behind-the-neck-press': [
    'delt-side delt-front',
    `${TRI} trap-upper serratus-anterior`,
    CUFF,
    'vertical push',
    'Shoulder abduction, elbow extension',
    'Needs good shoulder mobility',
  ],
  'dumbbell-lateral-raise': [
    'delt-side',
    'delt-front trap-upper supraspinatus serratus-anterior',
    '',
    'shoulder raise',
    'Shoulder abduction',
  ],
  'cable-lateral-raise': [
    'delt-side',
    'delt-front trap-upper supraspinatus serratus-anterior',
    '',
    'shoulder raise',
    'Shoulder abduction',
    'Keeps tension low in the range, where dumbbells are light',
  ],
  'machine-lateral-raise': [
    'delt-side',
    'delt-front trap-upper supraspinatus',
    '',
    'shoulder raise',
    'Shoulder abduction',
  ],
  'one-arm-machine-lateral-raise': [
    'delt-side',
    'delt-front trap-upper supraspinatus',
    'external-obliques internal-obliques',
    'shoulder raise',
    'Shoulder abduction',
  ],
  'front-raise': [
    'delt-front',
    'pec-clavicular delt-side serratus-anterior',
    '',
    'shoulder raise',
    'Shoulder flexion',
  ],
  'rear-delt-fly': [
    'delt-rear',
    'trap-middle rhomboids infraspinatus teres-minor',
    ERECT,
    'fly',
    'Shoulder horizontal abduction',
  ],
  'reverse-pec-deck': [
    'delt-rear',
    'trap-middle rhomboids infraspinatus teres-minor',
    '',
    'fly',
    'Shoulder horizontal abduction',
  ],
  'face-pull': [
    'delt-rear infraspinatus teres-minor',
    'trap-middle trap-lower rhomboids',
    '',
    'horizontal pull',
    'Shoulder horizontal abduction and external rotation',
    'Rear delts and rotator cuff together',
  ],
  'upright-row': [
    'delt-side trap-upper',
    'delt-front biceps-long biceps-short brachialis',
    '',
    'shoulder raise',
    'Shoulder abduction, scapular elevation, elbow flexion',
    'A wider grip biases the side delts',
  ],
  'band-pull-apart': [
    'delt-rear trap-middle rhomboids',
    'infraspinatus teres-minor trap-lower',
    '',
    'fly',
    'Shoulder horizontal abduction, scapular retraction',
  ],
  'pike-push-up': [
    'delt-front delt-side',
    `${TRI} pec-clavicular serratus-anterior`,
    CORE,
    'vertical push',
    'Shoulder flexion, elbow extension',
  ],

  // Biceps
  'barbell-curl': [
    'biceps-long biceps-short',
    'brachialis brachioradialis',
    'wrist-flexors',
    'elbow flexion',
    'Elbow flexion with the palms up',
  ],
  'ez-bar-curl': [
    'biceps-long biceps-short',
    'brachialis brachioradialis',
    'wrist-flexors',
    'elbow flexion',
    'Elbow flexion',
  ],
  'dumbbell-curl': [
    'biceps-long biceps-short',
    'brachialis brachioradialis',
    'wrist-flexors',
    'elbow flexion',
    'Elbow flexion and supination',
  ],
  'hammer-curl': [
    'brachialis brachioradialis',
    'biceps-long biceps-short',
    'wrist-extensors',
    'elbow flexion',
    'Elbow flexion with a neutral grip',
    'Biases the brachialis and brachioradialis',
  ],
  'incline-dumbbell-curl': [
    'biceps-long biceps-short',
    'brachialis brachioradialis',
    '',
    'elbow flexion',
    'Elbow flexion with the arm behind the body',
    'Trains the biceps at long length; often used for the long head',
  ],
  'preacher-curl': [
    'biceps-short biceps-long brachialis',
    'brachioradialis',
    '',
    'elbow flexion',
    'Elbow flexion with the arm in front',
    'Hardest with the elbow straight; biases the short head and brachialis',
  ],
  'cable-curl': [
    'biceps-long biceps-short',
    'brachialis brachioradialis',
    'wrist-flexors',
    'elbow flexion',
    'Elbow flexion',
  ],
  'one-arm-cable-curl': [
    'biceps-long biceps-short',
    'brachialis brachioradialis',
    'wrist-flexors',
    'elbow flexion',
    'Elbow flexion',
  ],
  'brachioradialis-curl': [
    'brachioradialis',
    'brachialis biceps-long biceps-short',
    'wrist-extensors',
    'elbow flexion',
    'Elbow flexion with the palms down',
    'Reverse grip biases the brachioradialis',
  ],

  // Triceps
  'close-grip-bench-press': [
    `${TRI} pec-sternocostal`,
    'delt-front pec-clavicular',
    CUFF,
    'horizontal push',
    'Elbow extension, shoulder flexion',
  ],
  'triceps-rope-pushdown': [
    TRI_SHORT,
    'triceps-long anconeus',
    'rectus-abdominis',
    'elbow extension',
    'Elbow extension with the arm at the side',
    'Arms at the side bias the lateral and medial heads',
  ],
  'triceps-bar-pushdown': [
    TRI_SHORT,
    'triceps-long anconeus',
    'rectus-abdominis',
    'elbow extension',
    'Elbow extension with the arm at the side',
    'Arms at the side bias the lateral and medial heads',
  ],
  'overhead-triceps-extension': [
    'triceps-long triceps-lateral triceps-medial',
    '',
    'rectus-abdominis serratus-anterior',
    'elbow extension',
    'Elbow extension with the arm overhead',
    'The long head grows more overhead than in pushdowns (Maeo 2023)',
  ],
  'dumbbell-overhead-extension': [
    'triceps-long triceps-lateral triceps-medial',
    '',
    'rectus-abdominis serratus-anterior',
    'elbow extension',
    'Elbow extension with the arm overhead',
    'Overhead biases the long head',
  ],
  'skull-crusher': [
    TRI,
    'anconeus',
    '',
    'elbow extension',
    'Elbow extension with the arm in front',
  ],
  'bench-dip': [
    TRI,
    'delt-front pec-sternocostal',
    '',
    'elbow extension',
    'Elbow extension, shoulder extension',
  ],
  'one-arm-cable-triceps-extension': [
    TRI,
    'anconeus',
    'external-obliques internal-obliques',
    'elbow extension',
    'Elbow extension',
  ],

  // Legs
  'back-squat': [
    `${VASTI} glute-max adductor-magnus`,
    `rectus-femoris ${HAMS} soleus`,
    `${ERECT} ${CORE} quadratus-lumborum`,
    'squat',
    'Knee and hip extension',
  ],
  'box-squat': [
    `${VASTI} glute-max adductor-magnus`,
    `rectus-femoris ${HAMS}`,
    `${ERECT} ${CORE}`,
    'squat',
    'Knee and hip extension',
    'Sitting back to the box shifts work toward the hips',
  ],
  'front-squat': [
    VASTI,
    `glute-max adductor-magnus rectus-femoris`,
    `${ERECT} ${CORE} trap-upper`,
    'squat',
    'Knee and hip extension',
    'An upright torso keeps more of the work on the quads',
  ],
  'hack-squat': [
    VASTI,
    'glute-max adductor-magnus rectus-femoris',
    '',
    'squat',
    'Knee and hip extension',
  ],
  'leg-press': [
    `${VASTI} glute-max`,
    'adductor-magnus rectus-femoris',
    '',
    'squat',
    'Knee and hip extension',
    'Feet low on the plate bias the quads, high the glutes and hamstrings',
  ],
  'single-leg-press': [
    `${VASTI} glute-max`,
    'adductor-magnus rectus-femoris glute-med',
    '',
    'squat',
    'Knee and hip extension',
  ],
  'goblet-squat': [
    `${VASTI} glute-max`,
    'adductor-magnus rectus-femoris',
    `${CORE} ${ERECT}`,
    'squat',
    'Knee and hip extension',
  ],
  'bulgarian-split-squat': [
    `${VASTI} glute-max`,
    'adductor-magnus rectus-femoris',
    'glute-med tfl external-obliques internal-obliques',
    'lunge',
    'Knee and hip extension, one leg',
    'A longer stride and forward lean bias the glutes',
  ],
  'walking-lunge': [
    `${VASTI} glute-max`,
    'adductor-magnus rectus-femoris',
    'glute-med tfl external-obliques internal-obliques',
    'lunge',
    'Knee and hip extension, one leg',
  ],
  'step-up': [
    `${VASTI} glute-max`,
    'adductor-magnus rectus-femoris',
    'glute-med tfl',
    'lunge',
    'Knee and hip extension, one leg',
  ],
  'leg-extension': [
    QUADS,
    '',
    '',
    'knee extension',
    'Knee extension',
    'The only common lift that trains the rectus femoris through its full knee range',
  ],
  'single-leg-extension': [QUADS, '', '', 'knee extension', 'Knee extension'],
  'romanian-deadlift': [
    `${HAMS} glute-max`,
    `adductor-magnus ${ERECT}`,
    `${GRIP} trap-middle ${CORE}`,
    'hinge',
    'Hip extension with the knees soft',
    'Hip-extension work for the long hamstrings (not the short head)',
  ],
  'dumbbell-romanian-deadlift': [
    `${HAMS} glute-max`,
    `adductor-magnus ${ERECT}`,
    `${GRIP} ${CORE}`,
    'hinge',
    'Hip extension with the knees soft',
    'Hip-extension work for the long hamstrings',
  ],
  'stiff-leg-deadlift': [
    `${HAMS} glute-max`,
    `adductor-magnus ${ERECT}`,
    `${GRIP} ${CORE}`,
    'hinge',
    'Hip extension with straight knees',
    'Hip-extension work for the long hamstrings',
  ],
  'dumbbell-stiff-leg-deadlift': [
    `${HAMS} glute-max`,
    `adductor-magnus ${ERECT}`,
    `${GRIP} ${CORE}`,
    'hinge',
    'Hip extension with straight knees',
    'Hip-extension work for the long hamstrings',
  ],
  'single-leg-romanian-deadlift': [
    `${HAMS} glute-max`,
    'adductor-magnus glute-med',
    `${ERECT} glute-min fibularis foot-intrinsics`,
    'hinge',
    'Hip extension, one leg',
    'Balance work for the side glutes and ankle',
  ],
  'good-morning': [
    `${HAMS} glute-max ${ERECT}`,
    'adductor-magnus',
    CORE,
    'hinge',
    'Hip extension with the bar on the back',
  ],
  'lying-leg-curl': [
    HAMS_ALL,
    'gastroc-medial gastroc-lateral',
    '',
    'knee flexion',
    'Knee flexion',
    'Knee-flexion work, including the short head',
  ],
  'seated-leg-curl': [
    HAMS_ALL,
    'gastroc-medial gastroc-lateral',
    '',
    'knee flexion',
    'Knee flexion with the hip bent',
    'Grew the hamstrings more than lying curls in one study (Maeo 2021)',
  ],
  'single-leg-curl': [
    HAMS_ALL,
    'gastroc-medial gastroc-lateral',
    '',
    'knee flexion',
    'Knee flexion',
  ],
  'nordic-curl': [
    'semitendinosus biceps-femoris-long biceps-femoris-short semimembranosus',
    'gastroc-medial gastroc-lateral',
    `glute-max ${CORE}`,
    'knee flexion',
    'Knee flexion lowered slowly',
    'Biases the semitendinosus (Bourne 2017)',
  ],
  'hip-thrust': [
    'glute-max',
    `${HAMS} adductor-magnus ${VASTI}`,
    `${CORE} glute-med`,
    'hip extension',
    'Hip extension',
    'Hardest at the top, where the glutes are short',
  ],
  'machine-hip-thrust': [
    'glute-max',
    `${HAMS} adductor-magnus`,
    'glute-med',
    'hip extension',
    'Hip extension',
  ],
  'glute-bridge': [
    'glute-max',
    `${HAMS} adductor-magnus`,
    `${CORE} glute-med`,
    'hip extension',
    'Hip extension',
  ],
  'cable-kickback': [
    'glute-max',
    'biceps-femoris-long semitendinosus semimembranosus glute-med',
    `${ERECT} ${CORE}`,
    'hip extension',
    'Hip extension, one leg',
  ],
  'hip-abduction': [
    'glute-med glute-min tfl',
    'glute-max',
    '',
    'hip abduction',
    'Hip abduction',
    'Leaning forward brings in more of the upper glute max',
  ],
  'hip-adduction': [
    'adductor-longus adductor-brevis adductor-magnus gracilis pectineus',
    '',
    '',
    'hip adduction',
    'Hip adduction',
  ],
  'sumo-deadlift': [
    `glute-max adductor-magnus ${VASTI}`,
    `${HAMS} ${ERECT} adductor-longus trap-upper ${GRIP}`,
    `${CORE} quadratus-lumborum`,
    'hinge',
    'Hip and knee extension with a wide stance',
    'More quads and adductors than a conventional deadlift',
  ],
  'standing-calf-raise': [
    `${GASTROC} soleus`,
    'plantaris fibularis tibialis-posterior',
    'foot-intrinsics',
    'calf raise',
    'Ankle plantar flexion with a straight knee',
    'A straight knee works the gastrocnemius more',
  ],
  'seated-calf-raise': [
    'soleus',
    `${GASTROC} fibularis tibialis-posterior`,
    '',
    'calf raise',
    'Ankle plantar flexion with a bent knee',
    'A bent knee leaves most of the work to the soleus',
  ],
  'leg-press-calf-raise': [
    `${GASTROC} soleus`,
    'plantaris fibularis',
    '',
    'calf raise',
    'Ankle plantar flexion',
  ],
  'single-leg-calf-raise': [
    `${GASTROC} soleus`,
    'plantaris fibularis tibialis-posterior',
    'foot-intrinsics glute-med',
    'calf raise',
    'Ankle plantar flexion, one leg',
  ],

  // Core
  'hanging-leg-raise': [
    'rectus-abdominis psoas iliacus',
    'rectus-femoris external-obliques internal-obliques',
    `${GRIP} latissimus-dorsi`,
    'trunk flexion',
    'Hip flexion and posterior pelvic tilt',
    'Curling the pelvis up brings in the abs; legs only is mostly hip flexors',
  ],
  'cable-crunch': [
    'rectus-abdominis',
    'external-obliques internal-obliques',
    '',
    'trunk flexion',
    'Spine flexion',
  ],
  crunch: [
    'rectus-abdominis',
    'external-obliques internal-obliques',
    '',
    'trunk flexion',
    'Spine flexion',
  ],
  'decline-sit-up': [
    'rectus-abdominis psoas iliacus',
    'external-obliques internal-obliques rectus-femoris',
    '',
    'trunk flexion',
    'Spine and hip flexion',
  ],
  'ab-wheel-rollout': [
    'rectus-abdominis transverse-abdominis',
    'external-obliques internal-obliques latissimus-dorsi',
    'serratus-anterior delt-front',
    'anti-movement',
    'Resisting spine extension',
  ],
  plank: [
    'rectus-abdominis transverse-abdominis',
    'external-obliques internal-obliques',
    'serratus-anterior delt-front glute-max',
    'anti-movement',
    'Resisting spine extension',
  ],
  'side-plank': [
    'external-obliques internal-obliques quadratus-lumborum',
    'transverse-abdominis glute-med',
    'delt-side',
    'anti-movement',
    'Resisting side bending',
  ],
  'pallof-press': [
    'external-obliques internal-obliques transverse-abdominis',
    'rectus-abdominis',
    'glute-med',
    'anti-movement',
    'Resisting rotation',
  ],

  // Full body and carries
  'farmers-carry': [
    `${GRIP} trap-upper`,
    'quadratus-lumborum external-obliques internal-obliques',
    `${ERECT} glute-med hand-intrinsics`,
    'carry',
    'Holding a heavy load while walking',
  ],
  'kettlebell-swing': [
    'glute-max biceps-femoris-long semitendinosus semimembranosus',
    `${ERECT} adductor-magnus`,
    `${CORE} ${GRIP} delt-front`,
    'hinge',
    'Fast hip extension',
  ],

  // Cardio (no muscle counting; exercise kind)
  'treadmill-run': ['', '', '', 'cardio', 'Running'],
  'outdoor-run': ['', '', '', 'cardio', 'Running'],
  'incline-walk': ['', '', '', 'cardio', 'Walking uphill'],
  'stationary-bike': ['', '', '', 'cardio', 'Cycling'],
  'rowing-machine': ['', '', '', 'cardio', 'Rowing'],
  elliptical: ['', '', '', 'cardio', 'Elliptical'],
  'stair-climber': ['', '', '', 'cardio', 'Stair climbing'],
  'jump-rope': ['', '', '', 'cardio', 'Skipping'],
  // November 2026: the 42 exercises added from the muscle-targeting sheet, generated from its
  // regions (primary 30% or top, secondary 10 to 29%, stabilizers under 10%).
  'high-to-low-cable-fly': [
    'pec-sternocostal',
    'delt-front',
    'pec-clavicular',
    'fly',
    'Shoulder horizontal adduction from above',
    'Lower chest bias, only directional',
  ],
  'low-to-high-cable-fly': [
    'pec-clavicular pec-sternocostal',
    'delt-front',
    'serratus-anterior',
    'fly',
    'Shoulder flexion and horizontal adduction from below',
    'Upper chest bias, only directional',
  ],
  'deficit-push-up': [
    'pec-sternocostal',
    'delt-front triceps-lateral triceps-medial pec-clavicular',
    'serratus-anterior triceps-long rectus-abdominis',
    'horizontal push',
    'Shoulder horizontal adduction, elbow extension',
    'Deeper stretch than a floor push-up',
  ],
  'neutral-grip-pull-up': [
    'latissimus-dorsi',
    'brachialis brachioradialis biceps-long biceps-short teres-major',
    'trap-middle rhomboids',
    'vertical pull',
    'Shoulder extension, elbow flexion',
  ],
  'machine-pullover': [
    'latissimus-dorsi',
    'teres-major',
    'triceps-long trap-lower',
    'pullover',
    'Shoulder extension with straight arms',
    'Lats with little biceps work',
  ],
  'one-arm-cable-lat-pull-in': [
    'latissimus-dorsi',
    'teres-major',
    'trap-lower external-obliques internal-obliques',
    'pullover',
    'Shoulder extension and adduction, one arm',
  ],
  'wide-elbow-chest-supported-row': [
    'trap-middle rhomboids delt-rear',
    'latissimus-dorsi trap-lower',
    'brachialis biceps-long biceps-short',
    'horizontal pull',
    'Shoulder horizontal abduction, scapular retraction',
    'Upper back and rear delts more than lats',
  ],
  '45-degree-hip-back-extension': [
    'glute-max biceps-femoris-long semitendinosus semimembranosus',
    'iliocostalis longissimus spinalis multifidus',
    'adductor-magnus',
    'hip extension',
    'Hip extension',
    'Glute-biased with a neutral spine',
  ],
  'reverse-hyperextension': [
    'glute-max biceps-femoris-long semitendinosus semimembranosus',
    'iliocostalis longissimus spinalis multifidus',
    '',
    'hip extension',
    'Hip extension with the legs moving',
  ],
  'incline-prone-y-raise': [
    'trap-lower',
    'trap-middle rhomboids delt-side delt-rear',
    'infraspinatus teres-minor supraspinatus serratus-anterior',
    'shoulder raise',
    'Scapular upward rotation, shoulder flexion',
    'Lower traps',
  ],
  'cable-shrug': [
    'trap-upper',
    'levator-scapulae',
    'finger-flexors',
    'shrug',
    'Scapular elevation',
  ],
  'bayesian-cable-rear-delt-fly': [
    'delt-rear',
    'trap-middle rhomboids infraspinatus teres-minor',
    '',
    'fly',
    'Shoulder horizontal abduction, one arm',
  ],
  'cable-external-rotation': [
    'infraspinatus teres-minor',
    'delt-rear',
    'trap-middle rhomboids',
    'anti-movement',
    'Shoulder external rotation',
  ],
  'cable-internal-rotation': [
    'subscapularis',
    'pec-sternocostal',
    'latissimus-dorsi teres-major delt-front',
    'anti-movement',
    'Shoulder internal rotation',
  ],
  'push-up-plus': [
    'serratus-anterior',
    'pec-sternocostal delt-front triceps-lateral triceps-medial',
    'rectus-abdominis',
    'horizontal push',
    'Scapular protraction at the top of a push-up',
    'Serratus anterior',
  ],
  'spider-curl': [
    'biceps-long biceps-short brachialis',
    'brachioradialis',
    '',
    'elbow flexion',
    'Elbow flexion with the arm in front',
    'Hard at the top of the curl',
  ],
  'bayesian-cable-curl': [
    'biceps-long biceps-short',
    'brachialis brachioradialis',
    '',
    'elbow flexion',
    'Elbow flexion with the arm behind the body',
    'Biceps at long length',
  ],
  'reverse-ez-bar-curl': [
    'brachioradialis brachialis',
    'biceps-long biceps-short wrist-extensors finger-extensors',
    '',
    'elbow flexion',
    'Elbow flexion, palms down',
    'Brachialis and brachioradialis',
  ],
  'cross-body-cable-triceps-extension': [
    'triceps-lateral triceps-medial triceps-long',
    '',
    '',
    'elbow extension',
    'Elbow extension',
  ],
  'seated-wrist-curl': ['wrist-flexors', 'finger-flexors', '', 'elbow flexion', 'Wrist flexion'],
  'reverse-wrist-curl': [
    'wrist-extensors finger-extensors',
    '',
    'brachioradialis',
    'elbow flexion',
    'Wrist extension',
  ],
  'wrist-pronation': [
    'pronators',
    'wrist-flexors',
    'brachioradialis',
    'elbow flexion',
    'Forearm pronation',
  ],
  'wrist-supination': [
    'biceps-long biceps-short supinator',
    '',
    'brachioradialis wrist-extensors finger-extensors',
    'elbow flexion',
    'Forearm supination',
  ],
  'dead-hang': [
    'finger-flexors',
    'latissimus-dorsi trap-lower',
    'teres-major wrist-flexors infraspinatus teres-minor',
    'anti-movement',
    'Grip and shoulder hang',
  ],
  'reverse-nordic-curl': [
    'rectus-femoris vastus-lateralis vastus-medialis vastus-intermedius',
    '',
    'rectus-abdominis glute-max',
    'knee extension',
    'Knee extension under a long lever',
    'Rectus femoris at long length',
  ],
  'sissy-squat': [
    'vastus-lateralis vastus-medialis vastus-intermedius',
    'rectus-femoris',
    'rectus-abdominis',
    'knee extension',
    'Knee extension with the hips open',
  ],
  'smith-machine-heel-elevated-squat': [
    'vastus-lateralis vastus-medialis vastus-intermedius',
    'glute-max adductor-magnus',
    'rectus-femoris',
    'squat',
    'Knee and hip extension, heels raised',
    'More quads than a flat-foot squat',
  ],
  'standing-single-leg-curl': [
    'biceps-femoris-long semitendinosus semimembranosus biceps-femoris-short',
    'gastroc-medial gastroc-lateral',
    '',
    'knee flexion',
    'Knee flexion, one leg',
  ],
  'glute-ham-raise': [
    'biceps-femoris-long semitendinosus semimembranosus biceps-femoris-short',
    'glute-max',
    'gastroc-medial gastroc-lateral iliocostalis longissimus spinalis multifidus',
    'knee flexion',
    'Knee flexion with the hips held straight',
  ],
  'cable-hip-abduction': [
    'glute-med glute-min',
    'tfl glute-max',
    '',
    'hip abduction',
    'Hip abduction, one leg',
  ],
  'cable-standing-hip-adduction': [
    'adductor-longus adductor-brevis gracilis pectineus',
    'adductor-magnus',
    'glute-med glute-min external-obliques internal-obliques',
    'hip adduction',
    'Hip adduction, one leg',
  ],
  'copenhagen-adduction': [
    'adductor-longus adductor-brevis gracilis pectineus',
    'external-obliques internal-obliques adductor-magnus',
    'transverse-abdominis serratus-anterior glute-med glute-min',
    'hip adduction',
    'Isometric hip adduction in a side plank',
  ],
  'standing-cable-hip-flexion': [
    'psoas iliacus',
    'rectus-femoris tfl',
    'sartorius glute-med glute-min',
    'trunk flexion',
    'Hip flexion, one leg',
  ],
  'seated-hip-flexion-raise': [
    'psoas iliacus',
    'rectus-femoris',
    'tfl sartorius rectus-abdominis',
    'trunk flexion',
    'Hip flexion above 90 degrees',
  ],
  'donkey-calf-raise': [
    'gastroc-medial gastroc-lateral soleus',
    '',
    '',
    'calf raise',
    'Ankle plantar flexion with the knees straight',
    'Gastrocnemius',
  ],
  'tibialis-raise': [
    'tibialis-anterior',
    'extensor-digitorum-longus extensor-hallucis',
    '',
    'calf raise',
    'Ankle dorsiflexion',
  ],
  'banded-ankle-eversion': [
    'fibularis',
    'extensor-digitorum-longus extensor-hallucis',
    '',
    'calf raise',
    'Ankle eversion',
  ],
  'reverse-crunch-posterior-pelvic-tilt': [
    'rectus-abdominis',
    'external-obliques internal-obliques psoas iliacus',
    '',
    'trunk flexion',
    'Posterior pelvic tilt, spinal flexion from below',
  ],
  'cable-woodchop': [
    'external-obliques internal-obliques',
    'rectus-abdominis transverse-abdominis',
    'glute-max glute-med glute-min delt-front latissimus-dorsi serratus-anterior',
    'anti-movement',
    'Trunk rotation',
  ],
  'suitcase-carry': [
    'external-obliques internal-obliques',
    'quadratus-lumborum finger-flexors trap-upper glute-med glute-min',
    '',
    'carry',
    'Resisting side bend while walking',
    'Obliques and quadratus lumborum',
  ],
  'neck-flexion': [
    'sternocleidomastoid deep-neck-flexors',
    'scalenes',
    '',
    'trunk flexion',
    'Neck flexion',
  ],
  'neck-extension': [
    'splenius cervical-extensors',
    'trap-upper levator-scapulae',
    '',
    'anti-movement',
    'Neck extension',
  ],
  // November 2026: the 39 researched additions, generated from their regions the same way.
  'dumbbell-pullover': [
    'pec-sternocostal',
    'latissimus-dorsi triceps-long',
    'pec-clavicular serratus-anterior teres-major',
    'pullover',
    'Shoulder extension with the elbows held still',
    'Chest and lats together, not a lat isolation',
  ],
  'seated-machine-triceps-dip': [
    'triceps-lateral triceps-medial',
    'triceps-long pec-sternocostal delt-front',
    'latissimus-dorsi serratus-anterior',
    'elbow extension',
    'Elbow extension, shoulder extension',
  ],
  'dumbbell-shrug': [
    'trap-upper',
    'levator-scapulae finger-flexors',
    'trap-middle rhomboids iliocostalis longissimus spinalis',
    'shrug',
    'Shoulder blade elevation',
  ],
  'standing-cable-shoulder-press': [
    'delt-front',
    'delt-side triceps-lateral triceps-medial serratus-anterior',
    'triceps-long trap-upper trap-lower external-obliques internal-obliques rectus-abdominis',
    'vertical push',
    'Shoulder flexion, elbow extension',
  ],
  'behind-the-neck-lat-pulldown': [
    'latissimus-dorsi',
    'trap-middle rhomboids teres-major brachialis biceps-long biceps-short',
    'delt-rear trap-lower finger-flexors',
    'vertical pull',
    'Shoulder adduction, elbow flexion',
  ],
  'weighted-push-up': [
    'pec-sternocostal',
    'triceps-lateral triceps-medial triceps-long delt-front',
    'pec-clavicular serratus-anterior rectus-abdominis',
    'horizontal push',
    'Shoulder horizontal adduction, elbow extension',
  ],
  'weighted-standing-single-leg-calf-raise': [
    'gastroc-medial gastroc-lateral soleus',
    '',
    'fibularis tibialis-anterior',
    'calf raise',
    'Ankle plantar flexion with the knee straight',
    'Gastrocnemius',
  ],
  'smith-machine-shoulder-press': [
    'delt-front',
    'delt-side triceps-lateral triceps-medial',
    'triceps-long pec-clavicular serratus-anterior trap-upper',
    'vertical push',
    'Shoulder flexion, elbow extension',
  ],
  'standing-dumbbell-shoulder-press': [
    'delt-front',
    'delt-side triceps-lateral triceps-medial serratus-anterior',
    'triceps-long trap-upper trap-lower rectus-abdominis external-obliques internal-obliques',
    'vertical push',
    'Shoulder flexion, elbow extension',
  ],
  'single-arm-dumbbell-shoulder-press': [
    'delt-front',
    'delt-side triceps-lateral triceps-medial serratus-anterior external-obliques internal-obliques',
    'triceps-long quadratus-lumborum trap-upper',
    'vertical push',
    'Shoulder flexion, elbow extension, resisting side bend',
  ],
  'cable-rear-delt-fly': [
    'delt-rear',
    'trap-middle rhomboids infraspinatus teres-minor',
    'delt-side trap-lower',
    'fly',
    'Shoulder horizontal abduction',
    'Rear delts',
  ],
  'assisted-dip': [
    'triceps-lateral triceps-medial',
    'triceps-long pec-sternocostal delt-front',
    'serratus-anterior',
    'elbow extension',
    'Elbow extension, shoulder extension',
  ],
  'dumbbell-triceps-kickback': [
    'triceps-lateral triceps-medial triceps-long',
    '',
    'delt-rear finger-flexors',
    'elbow extension',
    'Elbow extension with the arm by the side',
  ],
  'cable-triceps-kickback': [
    'triceps-lateral triceps-medial triceps-long',
    '',
    'delt-rear finger-flexors',
    'elbow extension',
    'Elbow extension with the arm by the side',
  ],
  'smith-machine-shrug': [
    'trap-upper',
    'levator-scapulae finger-flexors',
    'trap-middle rhomboids',
    'shrug',
    'Shoulder blade elevation',
  ],
  'incline-dumbbell-fly': [
    'pec-clavicular pec-sternocostal',
    'delt-front',
    'biceps-long biceps-short subscapularis',
    'fly',
    'Shoulder horizontal adduction on an incline',
    'Upper chest bias, only directional',
  ],
  'decline-push-up': [
    'pec-clavicular',
    'pec-sternocostal triceps-lateral triceps-medial triceps-long delt-front',
    'serratus-anterior rectus-abdominis',
    'horizontal push',
    'Shoulder flexion and horizontal adduction, elbow extension',
    'Feet-up angle: a little more front delt and clavicular pec',
  ],
  'incline-push-up': [
    'pec-sternocostal',
    'triceps-lateral triceps-medial triceps-long delt-front',
    'serratus-anterior rectus-abdominis',
    'horizontal push',
    'Shoulder horizontal adduction, elbow extension',
    'Easier than a floor push-up',
  ],
  'diamond-push-up': [
    'triceps-lateral triceps-medial',
    'triceps-long pec-sternocostal',
    'delt-front serratus-anterior rectus-abdominis',
    'horizontal push',
    'Elbow extension, shoulder horizontal adduction',
    'Triceps',
  ],
  'reverse-grip-lat-pulldown': [
    'latissimus-dorsi',
    'biceps-long biceps-short brachialis teres-major trap-middle rhomboids',
    'trap-lower finger-flexors',
    'vertical pull',
    'Shoulder extension, elbow flexion with the palms up',
  ],
  'weighted-chin-up': [
    'latissimus-dorsi',
    'biceps-long biceps-short brachialis teres-major',
    'trap-middle rhomboids trap-lower finger-flexors rectus-abdominis',
    'vertical pull',
    'Shoulder extension, elbow flexion with the palms up',
  ],
  'smith-machine-calf-raise': [
    'gastroc-medial gastroc-lateral soleus',
    '',
    'fibularis tibialis-anterior',
    'calf raise',
    'Ankle plantar flexion with the knees straight',
    'Gastrocnemius',
  ],
  'standing-dumbbell-calf-raise': [
    'gastroc-medial gastroc-lateral soleus',
    '',
    'fibularis tibialis-anterior',
    'calf raise',
    'Ankle plantar flexion with the knees straight',
    'Gastrocnemius',
  ],
  'barbell-wrist-curl': ['wrist-flexors', 'finger-flexors', '', 'elbow flexion', 'Wrist flexion'],
  'cable-wrist-curl': ['wrist-flexors', 'finger-flexors', '', 'elbow flexion', 'Wrist flexion'],
  'dumbbell-preacher-curl': [
    'biceps-long biceps-short',
    'brachialis brachioradialis',
    'wrist-flexors',
    'elbow flexion',
    'Elbow flexion with the upper arm supported',
  ],
  'concentration-curl': [
    'biceps-long biceps-short',
    'brachialis brachioradialis',
    'wrist-flexors',
    'elbow flexion',
    'Elbow flexion with the upper arm braced',
  ],
  'reverse-barbell-wrist-curl': [
    'wrist-extensors finger-extensors',
    'finger-flexors',
    '',
    'elbow flexion',
    'Wrist extension',
  ],
  'reverse-cable-wrist-curl': [
    'wrist-extensors finger-extensors',
    'finger-flexors',
    '',
    'elbow flexion',
    'Wrist extension',
  ],
  'wrist-roller': [
    'wrist-flexors wrist-extensors finger-extensors',
    'finger-flexors',
    '',
    'elbow flexion',
    'Wrist flexion and extension',
  ],
  'plate-pinch-hold': [
    'thumb hand-intrinsics finger-flexors',
    'wrist-flexors',
    'wrist-extensors finger-extensors',
    'carry',
    'Pinch grip held for time',
    'Thumb and hand muscles',
  ],
  'single-arm-cable-shoulder-press': [
    'delt-front',
    'delt-side triceps-lateral triceps-medial serratus-anterior external-obliques internal-obliques',
    'triceps-long quadratus-lumborum trap-upper',
    'vertical push',
    'Shoulder flexion, elbow extension, resisting twist',
  ],
  'cable-front-raise': [
    'delt-front',
    'pec-clavicular serratus-anterior',
    'delt-side trap-upper finger-flexors',
    'shoulder raise',
    'Shoulder flexion',
    'Front delts',
  ],
  'incline-dumbbell-shrug': [
    'trap-upper trap-middle rhomboids',
    'levator-scapulae',
    'trap-lower delt-rear finger-flexors',
    'shrug',
    'Shoulder blade elevation with some retraction',
  ],
  'behind-the-back-barbell-shrug': [
    'trap-upper',
    'levator-scapulae finger-flexors trap-middle rhomboids',
    '',
    'shrug',
    'Shoulder blade elevation',
  ],
  'single-arm-straight-arm-pulldown': [
    'latissimus-dorsi',
    'teres-major triceps-long',
    'delt-rear pec-sternocostal external-obliques internal-obliques finger-flexors',
    'pullover',
    'Shoulder extension with the elbow held still',
    'Lats',
  ],
  'seated-single-leg-calf-raise': [
    'soleus',
    'gastroc-medial gastroc-lateral',
    'fibularis tibialis-anterior',
    'calf raise',
    'Ankle plantar flexion with the knee bent',
    'Soleus',
  ],
  'weighted-tibialis-raise': [
    'tibialis-anterior',
    'extensor-digitorum-longus extensor-hallucis',
    '',
    'calf raise',
    'Ankle dorsiflexion',
  ],
  'neck-lateral-flexion': [
    'sternocleidomastoid',
    'scalenes splenius cervical-extensors levator-scapulae',
    'trap-upper',
    'trunk flexion',
    'Neck side bend',
  ],
};

export const EXERCISE_TARGETS: Record<string, ExerciseTargets> = Object.fromEntries(
  Object.entries(ROWS).map(([key, [p, s, st, pattern, actions, emphasis]]) => [
    key,
    {
      primary: split(p),
      secondary: split(s),
      stabilizers: split(st),
      pattern,
      actions,
      ...(emphasis ? { emphasis } : {}),
    },
  ]),
);

const LEGACY_GROUPS: Record<MuscleGroup, string[]> = {
  chest: ['pecs'],
  back: ['lats', 'upper-back'],
  shoulders: ['delts'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  quads: ['quads'],
  hamstrings: ['hamstrings'],
  glutes: ['glutes'],
  adductors: ['adductors'],
  calves: ['calves'],
  abs: ['abs'],
  cardio: [],
};

const BY_ID = new Map(
  Object.entries(EXERCISE_TARGETS).map(([key, t]) => [stableId(`exercise:${key}`), t]),
);

/**
 * What an exercise works. Library exercises use the reviewed table above; your own exercises
 * use the groups you chose for them (no head or region is guessed for them).
 */
export function targetsFor(
  exercise: Pick<Exercise, 'id' | 'primaryMuscle' | 'secondaryMuscles'>,
): ExerciseTargets {
  const known = BY_ID.get(exercise.id);
  if (known) return known;
  return {
    primary: LEGACY_GROUPS[exercise.primaryMuscle] ?? [],
    secondary: exercise.secondaryMuscles.flatMap((m) => LEGACY_GROUPS[m] ?? []),
    stabilizers: [],
    pattern: exercise.primaryMuscle === 'cardio' ? 'cardio' : 'anti-movement',
    actions: '',
  };
}

/** Whether an exercise works a muscle, group or region: 2 as a primary, 1 as an assistant, 0 not. */
export function worksMuscle(targets: ExerciseTargets, nodeId: string): 0 | 1 | 2 {
  const set = within(nodeId);
  if (targets.primary.some((m) => set.has(m))) return 2;
  if (targets.secondary.some((m) => set.has(m))) return 1;
  return 0;
}

/**
 * The group shown for an exercise ("Forearms · Barbell"). Forearm and neck work is stored under
 * the nearest of the 12 groups (wrist curls under biceps, neck work under back) so every app
 * version can read it; people see what it really trains.
 */
export type ShownGroup = MuscleGroup | 'forearms' | 'neck';

export function shownGroup(
  exercise: Pick<Exercise, 'id' | 'primaryMuscle' | 'secondaryMuscles'>,
): ShownGroup {
  const known = BY_ID.get(exercise.id);
  if (known && known.primary.length) {
    const forearms = within('forearms');
    if (known.primary.every((m) => forearms.has(m) && m !== 'brachioradialis')) return 'forearms';
    const neck = within('neck');
    if (known.primary.every((m) => neck.has(m))) return 'neck';
  }
  return exercise.primaryMuscle;
}
