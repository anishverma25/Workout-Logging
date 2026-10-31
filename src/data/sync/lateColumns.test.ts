import { describe, expect, it } from 'vitest';
import { LATE_COLUMNS, specFor, toServerRow } from './mapping';
import { missingLateColumn } from './supabase';

describe('columns added after release', () => {
  it('are known per table', () => {
    expect(LATE_COLUMNS.sets).toEqual(['reps_left', 'reps_right']);
    expect(LATE_COLUMNS.workout_exercises).toEqual(['by_side']);
    expect(LATE_COLUMNS.routine_exercises).toEqual(['by_side']);
  });

  it('a server without the migration is recognised from its error', () => {
    const err = {
      code: 'PGRST204',
      message: "Could not find the 'reps_left' column of 'sets' in the schema cache",
    };
    expect(missingLateColumn('sets', err)).toEqual(['reps_left', 'reps_right']);
    expect(missingLateColumn('sets', { code: '23505', message: 'duplicate key' })).toBeNull();
    expect(missingLateColumn('workouts', err)).toBeNull();
  });

  it('are always sent, empty too, so clearing a side reaches the server', () => {
    const row = toServerRow(
      specFor('sets')!,
      { id: 'a', repsLeft: null, repsRight: null, reps: 8 },
      'user-1',
    );
    expect(row).toHaveProperty('reps_left', null);
    expect(row).toHaveProperty('reps_right', null);
  });
});
