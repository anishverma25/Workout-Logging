import { SYSTEM_EXERCISES } from '@/data/library/exercises';
import { buildData } from '@/test/fixtures';
import { buildSessions } from '../analytics/sessions';
import { badgesEarnedIn, computeBadges } from './badges';

const day = (d: number, hour = 18) =>
  `2026-08-${String(d).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`;

describe('badges', () => {
  // Eleven workouts over three straight weeks; the bench climbs to 100 kg.
  const specs = [3, 5, 7, 10, 12, 14, 17, 19, 21, 24, 25].map((d, i) => ({
    at: day(d, i === 0 ? 6 : 18),
    exercises: [
      {
        key: 'barbell-bench-press',
        sets: [
          { w: 60 + i * 4, r: 5 },
          { w: 60 + i * 4, r: 5 },
        ],
      },
    ],
  }));
  const data = buildData(specs);
  const badges = computeBadges({
    sessions: buildSessions(data),
    exercises: SYSTEM_EXERCISES,
    bodyWeights: [],
    now: new Date(2026, 8, 1),
    weekStartsOn: 1,
  });
  const get = (id: string) => badges.find((b) => b.id === id)!;

  it('counts workouts, with the workout each was earned in', () => {
    expect(get('workouts-1').earnedAt).not.toBeNull();
    expect(get('workouts-10')).toMatchObject({ current: 10, workoutId: data.workouts[9]!.id });
    expect(get('workouts-25')).toMatchObject({ current: 11, earnedAt: null });
  });

  it('counts the longest run of weeks in a row', () => {
    expect(get('streak-2').earnedAt).not.toBeNull();
    expect(get('streak-4')).toMatchObject({ current: 4 });
  });

  it('awards medals and the plate club from real sets', () => {
    expect(get('medals-1').earnedAt).not.toBeNull();
    expect(get('medals-10').earnedAt).not.toBeNull();
    expect(get('plates-barbell-bench-press-60').earnedAt).not.toBeNull();
    // 60 + 10 × 4 = 100 kg on the last workout.
    expect(get('plates-barbell-bench-press-100').workoutId).toBe(data.workouts[10]!.id);
    expect(badgesEarnedIn(badges, data.workouts[10]!.id).map((b) => b.id)).toContain(
      'plates-barbell-bench-press-100',
    );
  });

  it('notices habits and leaves the rest locked with progress', () => {
    expect(get('early-bird')).toMatchObject({ current: 1, target: 10, earnedAt: null });
    expect(get('tonnes-10').current).toBe(
      Math.floor(data.sets.reduce((n, s) => n + s.weightKg! * s.reps!, 0) / 1000),
    );
  });
});
