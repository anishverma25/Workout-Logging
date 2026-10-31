import type { TargetSnapshot, WorkoutSet } from '../models/schemas';
import { checkProgression, loadIncrement, progressionStyle } from './progression';

const set = (weightKg: number, reps: number, rir: number | null = 2): WorkoutSet => ({
  id: crypto.randomUUID(),
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  deletedAt: null,
  origin: 'user',
  workoutId: 'w',
  workoutExerciseId: 'we',
  exerciseId: 'e',
  order: 0,
  setType: 'working',
  weightKg,
  reps,
  rir,
  rpe: null,
  durationSec: null,
  distanceM: null,
  completedAt: '2026-10-01T10:05:00.000Z',
  notes: null,
});
const target: TargetSnapshot = { sets: 3, repMin: 6, repMax: 10, rir: 2 };

describe('progression by experience', () => {
  it('lets beginners add load once every set reaches the bottom of the range', () => {
    const sets = [set(60, 6), set(60, 7), set(60, 6)];
    expect(progressionStyle('beginner')).toBe('linear');
    expect(checkProgression(target, sets, 'weight_reps', 'linear')).not.toBeNull();
    expect(checkProgression(target, sets, 'weight_reps', 'double')).toBeNull();
    expect(
      checkProgression(target, [set(60, 6), set(60, 5), set(60, 6)], 'weight_reps', 'linear'),
    ).toBeNull();
  });

  it('uses double progression for intermediate and advanced lifters', () => {
    expect(progressionStyle('intermediate')).toBe('double');
    expect(progressionStyle('advanced')).toBe('double');
    expect(progressionStyle(null)).toBe('double');
    expect(
      checkProgression(target, [set(60, 10), set(60, 10), set(60, 10)], 'weight_reps', 'double'),
    ).not.toBeNull();
  });

  it('still requires the planned effort', () => {
    expect(
      checkProgression(target, [set(60, 6, 0), set(60, 6), set(60, 6)], 'weight_reps', 'linear'),
    ).toBeNull();
  });

  it('suggests the smallest sensible jump in load', () => {
    const squat = { equipment: 'barbell' as const, primaryMuscle: 'quads' as const };
    const bench = { equipment: 'barbell' as const, primaryMuscle: 'chest' as const };
    expect(loadIncrement(squat, 'beginner', 'kg')).toBe(5);
    expect(loadIncrement(squat, 'intermediate', 'kg')).toBe(2.5);
    expect(loadIncrement(bench, 'beginner', 'kg')).toBe(2.5);
    expect(loadIncrement(squat, 'beginner', 'lb')).toBe(10);
    expect(loadIncrement(bench, 'advanced', 'lb')).toBe(5);
  });
});
