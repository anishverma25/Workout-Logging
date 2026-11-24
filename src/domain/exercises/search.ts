import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../models/labels';
import { shownGroup, targetsFor, worksMuscle } from '../muscles/targets';
import { MUSCLES, within } from '../muscles/taxonomy';
import type { Equipment, Exercise, MuscleGroup, Workout, WorkoutExercise } from '../models/schemas';

export type ExerciseSource = 'all' | 'library' | 'custom';

export interface ExerciseFilters {
  query: string;
  /** A stored group, or forearms (shown for wrist and grip work stored under biceps). */
  muscle: MuscleGroup | 'forearms' | null;
  equipment: Equipment | null;
  category: Exercise['category'] | null;
  source: ExerciseSource;
  /** A muscle, group or region from the advanced filter (taxonomy id), or null. */
  detail?: string | null;
}

export const EMPTY_FILTERS: ExerciseFilters = {
  query: '',
  muscle: null,
  equipment: null,
  category: null,
  source: 'all',
};

export function hasActiveFilters(f: ExerciseFilters): boolean {
  return (
    f.query.trim() !== '' ||
    f.muscle !== null ||
    f.equipment !== null ||
    f.category !== null ||
    f.source !== 'all' ||
    !!f.detail
  );
}

/** Lowercase, strip accents and punctuation so "pull up", "Pull-up" and "pullup" meet. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const COMPACT = (s: string) => s.replace(/ /g, '');

/**
 * Gym words people type that the library names differently. Each query word also matches the
 * words it maps to, so "abductor" finds the hip abduction machine and "rdl" the Romanian deadlift.
 */
const SYNONYMS: Record<string, string[]> = {
  abductor: ['abduction'],
  abductors: ['abduction'],
  adductor: ['adduction'],
  adductors: ['adduction'],
  inner: ['adduction'],
  outer: ['abduction'],
  thigh: ['adduction', 'abduction'],
  rdl: ['romanian'],
  sldl: ['stiff'],
  straight: ['stiff', 'straight'],
  legged: ['leg'],
  brachioradialis: ['brachioradialis', 'reverse'],
  forearm: ['brachioradialis', 'reverse', 'wrist'],
  forearms: ['brachioradialis', 'reverse', 'wrist'],
  reverse: ['reverse', 'brachioradialis'],
  btn: ['behind'],
  ohp: ['overhead'],
  db: ['dumbbell'],
  bb: ['barbell'],
  pec: ['pec', 'chest', 'fly'],
  pecs: ['chest'],
  lats: ['lat', 'pulldown'],
  traps: ['shrug'],
  delt: ['delt', 'lateral', 'shoulder'],
  delts: ['delt', 'lateral', 'shoulder'],
  crossover: ['fly'],
  pushdown: ['pushdown'],
  bicep: ['biceps', 'curl'],
  tricep: ['triceps'],
};

/**
 * Relevance of an exercise for a query. Higher is better, 0 means no match.
 * Every query word must match the name, a muscle or the equipment.
 * Name matches rank above metadata matches, and earlier matches above later ones.
 */
export function matchScore(
  exercise: Exercise,
  query: string,
  /** Other names people search for ("DB shrug"), by exercise id. */
  aliases?: ReadonlyMap<string, readonly string[]>,
): number {
  const q = normalize(query);
  if (q === '') return 1;
  const name = normalize(exercise.name);

  if (name === q) return 1000;
  const alias = aliasScore(aliases?.get(exercise.id), q);
  if (name.startsWith(q)) return Math.max(800, alias);
  if (COMPACT(name).includes(COMPACT(q))) return Math.max(600, alias);
  // A match on the name (or its muscle and equipment labels) always ranks above a match on a
  // muscle the exercise works, so typing an exercise still finds it first.
  const byName = nameScoreFor(exercise, q);
  if (byName > 0) return Math.max(400 + Math.min(byName, 199), alias);
  return alias || muscleScore(exercise, q);
}

/** A match on another name of the exercise: just below the same match on its own name. */
function aliasScore(aliases: readonly string[] | undefined, q: string): number {
  if (!aliases?.length) return 0;
  const words = q.split(' ');
  let best = 0;
  for (const raw of aliases) {
    const a = normalize(raw);
    if (a === q) best = Math.max(best, 900);
    else if (a.startsWith(q)) best = Math.max(best, 700);
    else if (COMPACT(a).includes(COMPACT(q))) best = Math.max(best, 500);
    else {
      const aw = a.split(' ');
      if (words.every((w) => aw.some((x) => x.startsWith(w) || x.startsWith(w.replace(/s$/, '')))))
        best = Math.max(best, 450);
    }
  }
  return best;
}

/**
 * Muscles the query names ("upper chest", "rear delts", "biceps long head", "tibs"): a node
 * whose gym name, anatomical name or another name contains every word typed.
 */
const muscleCache = new Map<string, string[]>();
export function musclesNamed(query: string): string[] {
  const q = normalize(query);
  if (q.length < 3) return [];
  const hit = muscleCache.get(q);
  if (hit) return hit;
  const words = q.split(' ');
  const found: { id: string; rank: number }[] = [];
  for (const m of MUSCLES) {
    const terms = [m.gym, m.name, ...(m.aliases ?? [])].map(normalize);
    let rank = 0;
    for (const t of terms) {
      const tw = t.split(' ');
      if (t === q) rank = Math.max(rank, 3);
      else if (
        words.every((w) => tw.some((x) => x.startsWith(w) || x.startsWith(w.replace(/s$/, ''))))
      )
        rank = Math.max(rank, 2);
    }
    if (rank) found.push({ id: m.id, rank });
  }
  const best = Math.max(0, ...found.map((f) => f.rank));
  const ids = found.filter((f) => f.rank === best).map((f) => f.id);
  if (muscleCache.size > 200) muscleCache.clear();
  muscleCache.set(q, ids);
  return ids;
}

/** An exercise that works a muscle the query names: below any match on the exercise's name. */
function muscleScore(exercise: Exercise, q: string): number {
  const named = musclesNamed(q);
  if (named.length === 0) return 0;
  const t = targetsFor(exercise);
  // The muscle listed first is the one the exercise is chosen for: it ranks higher, and an
  // exercise whose research note names the region ("long head") a little higher again.
  const tail = q.split(' ').slice(-2).join(' ');
  const emphasised = !!t.emphasis && tail.length > 3 && normalize(t.emphasis).includes(tail);
  let best = 0;
  for (const id of named) {
    const set = within(id);
    const i = t.primary.findIndex((m) => set.has(m));
    if (i >= 0) best = Math.max(best, 300 - Math.min(i, 9) * 10 + (emphasised ? 5 : 0));
    else if (t.secondary.some((m) => set.has(m))) best = Math.max(best, 60);
  }
  return best;
}

function nameScoreFor(exercise: Exercise, query: string): number {
  const q = normalize(query);
  const name = normalize(exercise.name);
  const nameWords = name.split(' ');
  const meta = normalize(
    [
      MUSCLE_LABELS[exercise.primaryMuscle],
      ...exercise.secondaryMuscles.map((m) => MUSCLE_LABELS[m]),
      EQUIPMENT_LABELS[exercise.equipment],
    ].join(' '),
  );

  let score = 0;
  for (const word of q.split(' ')) {
    // "curls", "flaps", "presses": a plural also matches the singular in the name.
    const singular =
      word.length > 3 && word.endsWith('es') && /(ss|x|ch|sh)es$/.test(word)
        ? word.slice(0, -2)
        : word.length > 3 && word.endsWith('s') && !word.endsWith('ss')
          ? word.slice(0, -1)
          : null;
    const forms = [word, ...(singular ? [singular] : []), ...(SYNONYMS[word] ?? [])];
    const best = Math.max(...forms.map((w) => wordScore(w)));
    if (best === 0) return 0;
    score += best;
  }
  return score;

  function wordScore(word: string): number {
    const wordIndex = nameWords.findIndex((w) => w.startsWith(word));
    if (wordIndex >= 0) return 100 - Math.min(wordIndex, 9) * 5;
    if (name.includes(word)) return 40;
    if (meta.split(' ').some((w) => w.startsWith(word))) return 20;
    return 0;
  }
}

export function filterExercises(
  exercises: Exercise[],
  filters: ExerciseFilters,
  aliases?: ReadonlyMap<string, readonly string[]>,
): Exercise[] {
  const scored: { exercise: Exercise; score: number }[] = [];
  for (const exercise of exercises) {
    if (exercise.deletedAt !== null) continue;
    if (filters.muscle) {
      const shown = shownGroup(exercise);
      // Wrist curls are stored under biceps but listed under Forearms, never under Biceps.
      if (filters.muscle === 'forearms' ? shown !== 'forearms' : shown === 'forearms') continue;
      if (filters.muscle !== 'forearms' && exercise.primaryMuscle !== filters.muscle) continue;
    }
    if (filters.equipment && exercise.equipment !== filters.equipment) continue;
    if (filters.category && exercise.category !== filters.category) continue;
    if (filters.source === 'custom' && !exercise.isCustom) continue;
    if (filters.source === 'library' && exercise.isCustom) continue;
    // The advanced filter: exercises that train the muscle first, then those it helps in.
    const works = filters.detail ? worksMuscle(targetsFor(exercise), filters.detail) : 0;
    if (filters.detail && works === 0) continue;
    const score = matchScore(exercise, filters.query, aliases);
    if (score > 0) scored.push({ exercise, score: score + (works === 2 ? 50 : 0) });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name))
    .map((s) => s.exercise);
}

export interface ExerciseUsage {
  exerciseId: string;
  lastUsedAt: string;
  workouts: number;
}

/**
 * When each exercise was last logged, newest first. Reads workouts in progress too,
 * so an exercise added a minute ago shows up as recent.
 */
export function exerciseUsage(
  workouts: Workout[],
  workoutExercises: WorkoutExercise[],
): ExerciseUsage[] {
  const workoutById = new Map(
    workouts.filter((w) => w.deletedAt === null && w.status !== 'cancelled').map((w) => [w.id, w]),
  );
  const byExercise = new Map<string, { last: string; ids: Set<string> }>();
  for (const we of workoutExercises) {
    if (we.deletedAt !== null) continue;
    const workout = workoutById.get(we.workoutId);
    if (!workout) continue;
    const entry = byExercise.get(we.exerciseId) ?? { last: '', ids: new Set<string>() };
    if (workout.startedAt > entry.last) entry.last = workout.startedAt;
    entry.ids.add(workout.id);
    byExercise.set(we.exerciseId, entry);
  }
  return [...byExercise.entries()]
    .map(([exerciseId, e]) => ({ exerciseId, lastUsedAt: e.last, workouts: e.ids.size }))
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
}

export function recentExercises(
  exercises: Exercise[],
  usage: ExerciseUsage[],
  limit = 8,
): Exercise[] {
  const byId = new Map(exercises.filter((e) => e.deletedAt === null).map((e) => [e.id, e]));
  const result: Exercise[] = [];
  for (const u of usage) {
    const e = byId.get(u.exerciseId);
    if (e) result.push(e);
    if (result.length >= limit) break;
  }
  return result;
}
