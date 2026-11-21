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
