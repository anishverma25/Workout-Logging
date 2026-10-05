import { buildDashboard } from '@/domain/analytics/dashboard';
import { detectPersonalRecords } from '@/domain/analytics/prs';
import { buildSessions } from '@/domain/analytics/sessions';
import {
  BodyWeightEntry,
  DEFAULT_PREFERENCES,
  Profile,
  Routine,
  RoutineDay,
  RoutineExercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/domain/models/schemas';
import { addDays, isSameDay, startOfDay } from '@/lib/dates';
import { SYSTEM_EXERCISES } from '../library/exercises';
import { DEMO_FEATURED_DAYS, DEMO_HISTORY_DAYS, generateDemoDataset } from './generate';

// A range of anchor dates so the story holds whichever weekday the demo is loaded on.
const ANCHORS = [5, 6, 7, 8, 9, 10, 11].map((d) => new Date(2026, 9, d, 16, 40));

describe.each(ANCHORS)('demo dataset anchored at %s', (now) => {
  const ds = generateDemoDataset(now);
  const data = { ...ds, exercises: SYSTEM_EXERCISES };
  const sessions = buildSessions(data);
  const today = startOfDay(now);
  const featuredStart = addDays(today, -(DEMO_FEATURED_DAYS - 1));

  it('produces records that pass schema validation', () => {
    Profile.parse(ds.profile);
    ds.routines.forEach((r) => Routine.parse(r));
    ds.routineDays.forEach((r) => RoutineDay.parse(r));
    ds.routineExercises.forEach((r) => RoutineExercise.parse(r));
    ds.workouts.forEach((r) => Workout.parse(r));
    ds.workoutExercises.forEach((r) => WorkoutExercise.parse(r));
    ds.sets.forEach((r) => WorkoutSet.parse(r));
    ds.bodyWeights.forEach((r) => BodyWeightEntry.parse(r));
  });

  it('marks every record as demo data', () => {
    const all = [
      ds.profile,
      ...ds.routines,
      ...ds.routineDays,
      ...ds.routineExercises,
      ...ds.workouts,
      ...ds.workoutExercises,
      ...ds.sets,
      ...ds.bodyWeights,
    ];
    expect(all.every((r) => r.origin === 'demo')).toBe(true);
  });

  it('keeps every reference consistent', () => {
    const exerciseIds = new Set(SYSTEM_EXERCISES.map((e) => e.id));
    const workoutIds = new Set(ds.workouts.map((w) => w.id));
    const weById = new Map(ds.workoutExercises.map((we) => [we.id, we]));
    const dayIds = new Set(ds.routineDays.map((d) => d.id));
    expect(
      ds.workoutExercises.every(
        (we) => workoutIds.has(we.workoutId) && exerciseIds.has(we.exerciseId),
      ),
    ).toBe(true);
    expect(ds.sets.every((s) => weById.get(s.workoutExerciseId)?.workoutId === s.workoutId)).toBe(
      true,
    );
    expect(ds.sets.every((s) => weById.get(s.workoutExerciseId)?.exerciseId === s.exerciseId)).toBe(
      true,
    );
    expect(
      ds.routineExercises.every(
        (re) => dayIds.has(re.routineDayId) && exerciseIds.has(re.exerciseId),
      ),
    ).toBe(true);
    expect(ds.workouts.every((w) => w.routineDayId !== null && dayIds.has(w.routineDayId))).toBe(
      true,
    );
  });

  it('has unique ids', () => {
    const ids = [
      ds.profile.id,
      ...ds.workouts,
      ...ds.workoutExercises,
      ...ds.sets,
      ...ds.bodyWeights,
    ].map((r) => (typeof r === 'string' ? r : r.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers the history window and leaves today open', () => {
    expect(sessions.length).toBeGreaterThanOrEqual(20);
    expect(sessions.some((s) => isSameDay(s.date, now))).toBe(false);
    expect(sessions[0]!.date >= addDays(today, -DEMO_HISTORY_DAYS)).toBe(true);
  });

  it('includes warm-up, working, back-off and drop sets with effort ratings', () => {
    const types = new Set(ds.sets.map((s) => s.setType));
    expect([...types].sort()).toEqual(['backoff', 'drop', 'warmup', 'working']);
    expect(ds.sets.filter((s) => s.setType === 'working').every((s) => s.rir !== null)).toBe(true);
  });

  it('features one missed session in the last 7 days', () => {
    const model = buildDashboard(data, DEFAULT_PREFERENCES, now);
    const { planned, completed } = model.recentWindow.adherence;
    expect(planned - completed).toBe(1);
    expect(model.recentWindow.days.filter((d) => d.state === 'missed')).toHaveLength(1);
  });

  it('features a bench press record in the last 7 days', () => {
    const prs = detectPersonalRecords(sessions, SYSTEM_EXERCISES).filter(
      (r) => r.date >= featuredStart,
    );
    expect(prs.some((r) => r.exerciseName === 'Barbell bench press' && r.type === 'e1rm')).toBe(
      true,
    );
  });

  it('features a below-best squat session after a short night', () => {
    const model = buildDashboard(data, DEFAULT_PREFERENCES, now);
    expect(
      model.insights.some((i) => i.id.startsWith('below-best') && i.title.includes('Back squat')),
    ).toBe(true);
  });

  it('ends on the profile body weight with a usable 7-day average', () => {
    const model = buildDashboard(data, DEFAULT_PREFERENCES, now);
    expect(model.bodyWeight?.latest.weightKg).toBe(67);
    expect(model.bodyWeight?.rollingAverageKg).not.toBeNull();
  });

  it('shows strength trends for the main barbell lifts', () => {
    const model = buildDashboard(data, DEFAULT_PREFERENCES, now);
    expect(model.strength.length).toBe(3);
    expect(model.strength.map((t) => t.exerciseName)).toContain('Barbell bench press');
  });

  it('is not perfectly linear', () => {
    const benchE1rms = buildDashboard(data, DEFAULT_PREFERENCES, now)
      .strength.find((t) => t.exerciseName === 'Barbell bench press')!
      .points.map((p) => p.e1rm);
    const steps = benchE1rms.slice(1).map((v, i) => v - benchE1rms[i]!);
    expect(steps.some((d) => d <= 0)).toBe(true); // stalls or dips exist
    expect(new Set(steps.map((d) => d.toFixed(2))).size).toBeGreaterThan(1);
  });
});

describe('determinism', () => {
  it('produces identical data for the same seed and day', () => {
    const a = generateDemoDataset(new Date(2026, 9, 5, 9));
    const b = generateDemoDataset(new Date(2026, 9, 5, 21));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
