import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../models/labels';
import type { Equipment, Exercise, MuscleGroup, Workout, WorkoutExercise } from '../models/schemas';

export type ExerciseSource = 'all' | 'library' | 'custom';

export interface ExerciseFilters {
  query: string;
  muscle: MuscleGroup | null;
  equipment: Equipment | null;
  category: Exercise['category'] | null;
  source: ExerciseSource;
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
    f.source !== 'all'
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
 * Relevance of an exercise for a query. Higher is better, 0 means no match.
 * Every query word must match the name, a muscle or the equipment.
 * Name matches rank above metadata matches, and earlier matches above later ones.
 */
export function matchScore(exercise: Exercise, query: string): number {
  const q = normalize(query);
  if (q === '') return 1;
  const name = normalize(exercise.name);
  const nameWords = name.split(' ');
  const meta = normalize(
    [
      MUSCLE_LABELS[exercise.primaryMuscle],
      ...exercise.secondaryMuscles.map((m) => MUSCLE_LABELS[m]),
      EQUIPMENT_LABELS[exercise.equipment],
    ].join(' '),
  );

  if (name === q) return 1000;
  if (name.startsWith(q)) return 800;
  if (COMPACT(name).includes(COMPACT(q))) return 600;

  let score = 0;
  for (const word of q.split(' ')) {
    const wordIndex = nameWords.findIndex((w) => w.startsWith(word));
    if (wordIndex >= 0) score += 100 - Math.min(wordIndex, 9) * 5;
    else if (name.includes(word)) score += 40;
    else if (meta.split(' ').some((w) => w.startsWith(word))) score += 20;
    else return 0;
  }
  return score;
}

export function filterExercises(exercises: Exercise[], filters: ExerciseFilters): Exercise[] {
  const scored: { exercise: Exercise; score: number }[] = [];
  for (const exercise of exercises) {
    if (exercise.deletedAt !== null) continue;
    if (filters.muscle && exercise.primaryMuscle !== filters.muscle) continue;
    if (filters.equipment && exercise.equipment !== filters.equipment) continue;
    if (filters.category && exercise.category !== filters.category) continue;
    if (filters.source === 'custom' && !exercise.isCustom) continue;
    if (filters.source === 'library' && exercise.isCustom) continue;
    const score = matchScore(exercise, filters.query);
    if (score > 0) scored.push({ exercise, score });
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
