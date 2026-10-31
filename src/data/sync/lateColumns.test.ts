import { describe, expect, it } from 'vitest';
import { DROPPABLE_COLUMNS, LATE_COLUMNS, specFor, toServerRow } from './mapping';
import { missingLateColumn, SupabaseRemote } from './supabase';

describe('columns added after release', () => {
  it('are known per table', () => {
    expect(LATE_COLUMNS.sets).toEqual(['reps_left', 'reps_right']);
    expect(LATE_COLUMNS.workout_exercises).toEqual(['by_side']);
    expect(LATE_COLUMNS.routine_exercises).toEqual(['by_side']);
    expect(LATE_COLUMNS.profiles).toEqual(['avatar']);
    // Only the profile photo may be left behind; side reps and by-side wait for the migration.
    expect(DROPPABLE_COLUMNS).toEqual({ profiles: ['avatar'] });
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

describe('a server without a late column', () => {
  function fakeClient(missing: string) {
    const sent: Record<string, unknown>[][] = [];
    const client = {
      from: () => ({
        upsert: async (rows: Record<string, unknown>[]) => {
          sent.push(rows);
          return rows.some((r) => missing in r)
            ? { error: { code: 'PGRST204', message: `Could not find the '${missing}' column` } }
            : { error: null };
        },
      }),
    };
    return { client, sent };
  }

  it('still saves a profile with a photo, without the photo', async () => {
    const { client, sent } = fakeClient('avatar');
    const remote = new SupabaseRemote(client as never);
    await remote.upsert('profiles', [
      {
        id: 'p',
        display_name: 'Anish',
        avatar: 'data:image/jpeg;base64,AAAA',
        calorie_target: 2200,
      },
    ]);
    expect(sent).toHaveLength(2);
    expect(sent[1]![0]).toEqual({ id: 'p', display_name: 'Anish', calorie_target: 2200 });
  });

  it('keeps a set with side reps waiting until the migration is run', async () => {
    const { client } = fakeClient('reps_left');
    const remote = new SupabaseRemote(client as never);
    await expect(
      remote.upsert('sets', [{ id: 's', reps: 8, reps_left: 8, reps_right: 9 }]),
    ).rejects.toThrow();
  });
});
