import type { MuscleGroup } from '@/domain/models/schemas';

/**
 * The muscle taxonomy (November 2026): three levels, one record per muscle.
 *
 * - Level 1, region: Chest, Back, Shoulders, Arms, Core, Hips, Legs, Neck.
 * - Level 2, group: the gym's names (Lats, Traps, Rotator cuff, Hip flexors, Calves...).
 * - Level 3, muscle: an anatomical muscle, head or region (clavicular pec, long head of the
 *   biceps, soleus).
 *
 * A muscle that works in more than one group has one record with one parent and `alsoIn` for
 * the other groups (rectus femoris is a quad and a hip flexor), so it is never counted twice.
 * Cardio and Full body are exercise kinds, not muscles, and are not here.
 *
 * The app's 12 stored muscle groups (`MuscleGroup`) stay as they are: every group here says
 * which of them it belongs to (`legacy`), so history, routines and analytics keep working.
 */

export type MuscleLevel = 1 | 2 | 3;

export interface MuscleNode {
  id: string;
  level: MuscleLevel;
  /** Anatomical name. */
  name: string;
  /** What people call it in the gym; shown first. */
  gym: string;
  parent: string | null;
  /** Other groups this muscle also belongs to (one record, never a duplicate). */
  alsoIn?: string[];
  /** More names people search with. */
  aliases?: string[];
  /** For level 2: the stored muscle group it counts toward, or null (forearms, neck...). */
  legacy?: MuscleGroup | null;
}

const region = (id: string, gym: string, aliases: string[] = []): MuscleNode => ({
  id,
  level: 1,
  name: gym,
  gym,
  parent: null,
  aliases,
});
const group = (
  id: string,
  parent: string,
  gym: string,
  legacy: MuscleGroup | null,
  aliases: string[] = [],
  name = gym,
): MuscleNode => ({ id, level: 2, name, gym, parent, legacy, aliases });
const muscle = (
  id: string,
  parent: string,
  name: string,
  gym: string,
  aliases: string[] = [],
  alsoIn?: string[],
): MuscleNode => ({ id, level: 3, name, gym, parent, aliases, ...(alsoIn ? { alsoIn } : {}) });

export const MUSCLES: MuscleNode[] = [
  // Regions
  region('chest', 'Chest', ['pecs']),
  region('back', 'Back'),
  region('shoulders', 'Shoulders'),
  region('arms', 'Arms'),
  region('core', 'Core', ['midsection']),
  region('hips', 'Hips'),
  region('legs', 'Legs', ['lower body']),
  region('neck', 'Neck'),

  // Chest
  group('pecs', 'chest', 'Chest', 'chest', ['pecs', 'pectorals'], 'Pectorals'),
  muscle('pec-clavicular', 'pecs', 'Pectoralis major, clavicular part', 'Upper chest', [
    'upper pecs',
    'clavicular head',
  ]),
  muscle('pec-sternocostal', 'pecs', 'Pectoralis major, sternocostal part', 'Mid and lower chest', [
    'lower chest',
    'mid chest',
    'sternal head',
  ]),
  muscle('pec-minor', 'pecs', 'Pectoralis minor', 'Pec minor'),

  // Back and shoulder blades
  group('lats', 'back', 'Lats', 'back', ['latissimus', 'wings']),
  muscle('latissimus-dorsi', 'lats', 'Latissimus dorsi', 'Lats', ['lat']),
  muscle('teres-major', 'lats', 'Teres major', 'Teres major'),
  group('upper-back', 'back', 'Upper back', 'back', ['mid back', 'rhomboids']),
  muscle('rhomboids', 'upper-back', 'Rhomboid major and minor', 'Rhomboids'),
  group('traps', 'back', 'Traps', 'back', ['trapezius']),
  muscle('trap-upper', 'traps', 'Trapezius, upper part', 'Upper traps', ['shrug muscles']),
  muscle('trap-middle', 'traps', 'Trapezius, middle part', 'Mid traps', ['middle traps']),
  muscle('trap-lower', 'traps', 'Trapezius, lower part', 'Lower traps'),
  muscle(
    'levator-scapulae',
    'traps',
    'Levator scapulae',
    'Levator scapulae',
    [],
    ['neck-extensors'],
  ),
  group('serratus', 'back', 'Serratus', 'back', ['boxer muscle'], 'Serratus anterior'),
  muscle('serratus-anterior', 'serratus', 'Serratus anterior', 'Serratus'),
  group('spinal-erectors', 'back', 'Lower back', 'back', [
    'spinal erectors',
    'erectors',
    'low back',
  ]),
  muscle('iliocostalis', 'spinal-erectors', 'Iliocostalis', 'Erectors, outer column'),
  muscle('longissimus', 'spinal-erectors', 'Longissimus', 'Erectors, middle column'),
  muscle('spinalis', 'spinal-erectors', 'Spinalis', 'Erectors, inner column'),
  muscle('multifidus', 'spinal-erectors', 'Multifidus', 'Deep spine stabilizers', ['deep back']),
  muscle('semispinalis', 'spinal-erectors', 'Semispinalis', 'Semispinalis', [], ['neck-extensors']),
  muscle('rotatores', 'spinal-erectors', 'Rotatores', 'Rotatores'),

  // Shoulders
  group('delts', 'shoulders', 'Delts', 'shoulders', ['deltoids', 'shoulders']),
  muscle('delt-front', 'delts', 'Deltoid, anterior part', 'Front delts', [
    'anterior delts',
    'front shoulder',
  ]),
  muscle('delt-side', 'delts', 'Deltoid, lateral part', 'Side delts', [
    'lateral delts',
    'middle delts',
    'medial delts',
  ]),
  muscle('delt-rear', 'delts', 'Deltoid, posterior part', 'Rear delts', [
    'posterior delts',
    'rear shoulder',
  ]),
  group('rotator-cuff', 'shoulders', 'Rotator cuff', 'shoulders', ['rotators', 'cuff']),
  muscle('supraspinatus', 'rotator-cuff', 'Supraspinatus', 'Supraspinatus'),
  muscle('infraspinatus', 'rotator-cuff', 'Infraspinatus', 'Infraspinatus', ['external rotators']),
  muscle('teres-minor', 'rotator-cuff', 'Teres minor', 'Teres minor'),
  muscle('subscapularis', 'rotator-cuff', 'Subscapularis', 'Subscapularis', ['internal rotators']),

  // Arms
  group('biceps', 'arms', 'Biceps', 'biceps', ['bis', 'elbow flexors']),
  muscle('biceps-long', 'biceps', 'Biceps brachii, long head', 'Biceps long head', [
    'outer biceps',
    'peak',
  ]),
  muscle('biceps-short', 'biceps', 'Biceps brachii, short head', 'Biceps short head', [
    'inner biceps',
  ]),
  muscle('brachialis', 'biceps', 'Brachialis', 'Brachialis'),
  muscle('coracobrachialis', 'biceps', 'Coracobrachialis', 'Coracobrachialis'),
  group('triceps', 'arms', 'Triceps', 'triceps', ['tris']),
  muscle('triceps-long', 'triceps', 'Triceps brachii, long head', 'Triceps long head'),
  muscle('triceps-lateral', 'triceps', 'Triceps brachii, lateral head', 'Triceps lateral head', [
    'outer triceps',
    'horseshoe',
  ]),
  muscle('triceps-medial', 'triceps', 'Triceps brachii, medial head', 'Triceps medial head'),
  muscle('anconeus', 'triceps', 'Anconeus', 'Anconeus'),
  group('forearms', 'arms', 'Forearms', null, ['grip', 'wrists']),
  muscle('brachioradialis', 'forearms', 'Brachioradialis', 'Brachioradialis', [], ['biceps']),
  muscle(
    'wrist-flexors',
    'forearms',
    'Flexor carpi radialis and ulnaris, palmaris longus',
    'Wrist flexors',
    ['forearm flexors'],
  ),
  muscle(
    'wrist-extensors',
    'forearms',
    'Extensor carpi radialis longus and brevis, extensor carpi ulnaris',
    'Wrist extensors',
    ['forearm extensors'],
  ),
  muscle(
    'finger-flexors',
    'forearms',
    'Flexor digitorum superficialis and profundus',
    'Finger flexors',
    ['grip', 'grip strength'],
  ),
  muscle(
    'finger-extensors',
    'forearms',
    'Extensor digitorum and finger extensors',
    'Finger extensors',
  ),
  muscle('pronators', 'forearms', 'Pronator teres and quadratus', 'Pronators'),
  muscle('supinator', 'forearms', 'Supinator', 'Supinator'),
  muscle('thumb', 'forearms', 'Thumb flexors, extensors and abductors', 'Thumb muscles'),
  muscle('hand-intrinsics', 'forearms', 'Intrinsic hand muscles', 'Hand muscles', ['grip']),

  // Core
  group('abs', 'core', 'Abs', 'abs', ['six pack', 'abdominals']),
  muscle('rectus-abdominis', 'abs', 'Rectus abdominis', 'Six pack', [
    'upper abs',
    'lower abs',
    'rectus',
  ]),
  group('obliques', 'core', 'Obliques', 'abs', ['side abs', 'waist']),
  muscle('external-obliques', 'obliques', 'External obliques', 'External obliques'),
  muscle('internal-obliques', 'obliques', 'Internal obliques', 'Internal obliques'),
  group('deep-core', 'core', 'Deep core', 'abs', ['core stability', 'trunk stabilizers']),
  muscle('transverse-abdominis', 'deep-core', 'Transversus abdominis', 'Transverse abs', [
    'tva',
    'tummy vacuum',
  ]),
  muscle('quadratus-lumborum', 'deep-core', 'Quadratus lumborum', 'QL', ['ql']),
  muscle('diaphragm', 'deep-core', 'Diaphragm', 'Diaphragm', ['breathing']),
  muscle('pelvic-floor', 'deep-core', 'Pelvic floor muscles', 'Pelvic floor'),

  // Hips
  group('glutes', 'hips', 'Glutes', 'glutes', ['butt', 'booty', 'gluteus']),
  muscle('glute-max', 'glutes', 'Gluteus maximus', 'Glute max', ['gluteus maximus']),
  muscle(
    'glute-med',
    'glutes',
    'Gluteus medius',
    'Glute medius',
    ['side glutes', 'gluteus medius'],
    ['abductors'],
  ),
  muscle(
    'glute-min',
    'glutes',
    'Gluteus minimus',
    'Glute minimus',
    ['gluteus minimus'],
    ['abductors', 'hip-rotators'],
  ),
  group('abductors', 'hips', 'Abductors', 'glutes', ['outer thigh', 'hip abductors']),
  muscle(
    'tfl',
    'abductors',
    'Tensor fasciae latae',
    'TFL',
    ['tensor fasciae latae'],
    ['hip-flexors'],
  ),
  group('hip-flexors', 'hips', 'Hip flexors', null, ['hip flexor']),
  muscle('psoas', 'hip-flexors', 'Psoas major', 'Psoas', ['iliopsoas']),
  muscle('iliacus', 'hip-flexors', 'Iliacus', 'Iliacus', ['iliopsoas']),
  muscle('sartorius', 'hip-flexors', 'Sartorius', 'Sartorius'),
  group('adductors', 'hips', 'Adductors', 'adductors', ['inner thigh', 'groin']),
  muscle('adductor-magnus', 'adductors', 'Adductor magnus', 'Adductor magnus', [], ['hamstrings']),
  muscle('adductor-longus', 'adductors', 'Adductor longus', 'Adductor longus'),
  muscle('adductor-brevis', 'adductors', 'Adductor brevis', 'Adductor brevis'),
  muscle('gracilis', 'adductors', 'Gracilis', 'Gracilis'),
  muscle('pectineus', 'adductors', 'Pectineus', 'Pectineus', [], ['hip-flexors']),
  group('hip-rotators', 'hips', 'Hip rotators', 'glutes', ['deep six', 'deep hip rotators']),
  muscle('piriformis', 'hip-rotators', 'Piriformis', 'Piriformis'),
  muscle('obturators', 'hip-rotators', 'Obturator internus and externus', 'Obturators'),
  muscle('gemelli', 'hip-rotators', 'Superior and inferior gemelli', 'Gemelli'),
  muscle('quadratus-femoris', 'hip-rotators', 'Quadratus femoris', 'Quadratus femoris'),

  // Legs
  group('quads', 'legs', 'Quads', 'quads', ['quadriceps', 'thighs', 'front thigh']),
  muscle('rectus-femoris', 'quads', 'Rectus femoris', 'Rectus femoris', [], ['hip-flexors']),
  muscle('vastus-lateralis', 'quads', 'Vastus lateralis', 'Outer quad', [
    'outer quads',
    'vastus lateralis',
  ]),
  muscle('vastus-medialis', 'quads', 'Vastus medialis', 'Inner quad', [
    'teardrop',
    'vmo',
    'vastus medialis',
  ]),
  muscle('vastus-intermedius', 'quads', 'Vastus intermedius', 'Deep quad', ['vastus intermedius']),
  group('hamstrings', 'legs', 'Hamstrings', 'hamstrings', ['hams', 'back thigh']),
  muscle(
    'biceps-femoris-long',
    'hamstrings',
    'Biceps femoris, long head',
    'Outer hamstring, long head',
  ),
  muscle(
    'biceps-femoris-short',
    'hamstrings',
    'Biceps femoris, short head',
    'Outer hamstring, short head',
  ),
  muscle('semitendinosus', 'hamstrings', 'Semitendinosus', 'Inner hamstring (semitendinosus)'),
  muscle('semimembranosus', 'hamstrings', 'Semimembranosus', 'Inner hamstring (semimembranosus)'),
  group('calves', 'legs', 'Calves', 'calves', ['calf']),
  muscle('gastroc-medial', 'calves', 'Gastrocnemius, medial head', 'Inner calf', [
    'gastrocnemius',
    'gastrocs',
  ]),
  muscle('gastroc-lateral', 'calves', 'Gastrocnemius, lateral head', 'Outer calf', [
    'gastrocnemius',
    'gastrocs',
  ]),
  muscle('soleus', 'calves', 'Soleus', 'Soleus'),
  muscle('plantaris', 'calves', 'Plantaris', 'Plantaris'),
  group('shins', 'legs', 'Shins', 'calves', ['front of shin', 'anterior lower leg', 'tibialis']),
  muscle('tibialis-anterior', 'shins', 'Tibialis anterior', 'Tibialis', ['tibs', 'shin muscle']),
  muscle('extensor-hallucis', 'shins', 'Extensor hallucis longus', 'Big toe lifter'),
  muscle('extensor-digitorum-longus', 'shins', 'Extensor digitorum longus', 'Toe lifters'),
  group('ankles', 'legs', 'Ankles and feet', 'calves', ['ankle stabilizers', 'peroneals', 'feet']),
  muscle('fibularis', 'ankles', 'Fibularis (peroneus) longus, brevis and tertius', 'Peroneals', [
    'peroneus',
    'fibularis',
  ]),
  muscle('tibialis-posterior', 'ankles', 'Tibialis posterior', 'Tibialis posterior'),
  muscle(
    'toe-flexors',
    'ankles',
    'Flexor hallucis longus and flexor digitorum longus',
    'Toe flexors',
  ),
  muscle('foot-intrinsics', 'ankles', 'Intrinsic foot muscles', 'Foot muscles', ['arch']),

  // Neck
  group('neck-flexors', 'neck', 'Neck, front', null, ['neck'], 'Neck flexors'),
  muscle('sternocleidomastoid', 'neck-flexors', 'Sternocleidomastoid', 'SCM', ['scm']),
  muscle('scalenes', 'neck-flexors', 'Scalenes', 'Scalenes'),
  muscle(
    'deep-neck-flexors',
    'neck-flexors',
    'Longus colli and longus capitis',
    'Deep neck flexors',
  ),
  group('neck-extensors', 'neck', 'Neck, back', null, ['neck'], 'Neck extensors'),
  muscle('splenius', 'neck-extensors', 'Splenius capitis and cervicis', 'Splenius'),
  muscle(
    'cervical-extensors',
    'neck-extensors',
    'Suboccipitals and deep cervical extensors',
    'Deep neck extensors',
  ),
];

export const MUSCLE_BY_ID = new Map(MUSCLES.map((m) => [m.id, m]));

/** The group (level 2) a muscle counts toward first, or the node itself for a group. */
export function groupOf(id: string): MuscleNode | null {
  let n = MUSCLE_BY_ID.get(id) ?? null;
  while (n && n.level > 2) n = n.parent ? (MUSCLE_BY_ID.get(n.parent) ?? null) : null;
  return n && n.level === 2 ? n : null;
}

/** Every node under `id` (itself included), following `alsoIn` too. */
export function within(id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const m of MUSCLES) {
      if (out.has(m.id)) continue;
      if ((m.parent && out.has(m.parent)) || m.alsoIn?.some((g) => out.has(g))) {
        out.add(m.id);
        grew = true;
      }
    }
  }
  return out;
}

export const childrenOf = (id: string) =>
  MUSCLES.filter((m) => m.parent === id || m.alsoIn?.includes(id));

export const MUSCLE_COUNTS = {
  regions: MUSCLES.filter((m) => m.level === 1).length,
  groups: MUSCLES.filter((m) => m.level === 2).length,
  muscles: MUSCLES.filter((m) => m.level === 3).length,
};
