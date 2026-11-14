import { TABLE_SPECS } from './mapping';

/**
 * Batch 18 (S5): a new synced table must be `late: true`, so phones keep syncing everything
 * else on a server whose migration has not been run yet. A table moves into this list only
 * once its migration is applied on the live server and every app version in use knows it.
 */
const APPLIED_EVERYWHERE = [
  'profiles',
  'user_exercises',
  'routines',
  'routine_days',
  'routine_exercises',
  'workouts',
  'workout_exercises',
  'sets',
  'body_weight',
  'body_measurements',
  'goals',
  'custom_foods',
  'food_logs',
  'water_logs',
  'activity_logs',
];

describe('synced tables', () => {
  it('every table added after release is late', () => {
    for (const spec of TABLE_SPECS) {
      if (APPLIED_EVERYWHERE.includes(spec.server)) continue;
      expect(spec.late, `${spec.server} must be late: true (or listed as applied everywhere)`).toBe(
        true,
      );
    }
  });
  it('the list only names real tables', () => {
    const servers = TABLE_SPECS.map((s) => s.server as string);
    for (const t of APPLIED_EVERYWHERE) expect(servers).toContain(t);
  });
});
