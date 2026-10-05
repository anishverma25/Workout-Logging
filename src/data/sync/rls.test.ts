import type { Transaction } from '@electric-sql/pglite';
import { exerciseIdFor } from '@/data/library/exercises';
import { createTestServer, type TestServer } from '@/test/server';

/**
 * Row level security, tested against real Postgres with the project's migrations.
 * The frontend is never trusted: every check here runs SQL directly as a signed-in user.
 */

const BENCH = exerciseIdFor('barbell-bench-press');
const T0 = '2026-09-01T10:00:00.000Z';
const T1 = '2026-09-02T10:00:00.000Z';
const meta = { created_at: T0, updated_at: T0, deleted_at: null };

/** One row in every user-owned table, linked the way the app links them. */
function rowsFor(userId: string) {
  const id = () => crypto.randomUUID();
  const routine = id();
  const day = id();
  const workout = id();
  const we = id();
  const custom = id();
  return {
    profiles: {
      id: id(),
      user_id: userId,
      display_name: 'A',
      goal: 'strength',
      experience: 'beginner',
      ...meta,
    },
    user_exercises: {
      id: custom,
      user_id: userId,
      name: 'Custom press',
      primary_muscle: 'chest',
      secondary_muscles: [],
      equipment: 'machine',
      category: 'compound',
      tracking_type: 'weight_reps',
      load_mode: 'total',
      ...meta,
    },
    routines: { id: routine, user_id: userId, name: 'Plan', is_active: true, ...meta },
    routine_days: {
      id: day,
      user_id: userId,
      routine_id: routine,
      name: 'Push',
      order_index: 0,
      weekdays: [1],
      ...meta,
    },
    routine_exercises: {
      id: id(),
      user_id: userId,
      routine_day_id: day,
      exercise_id: custom,
      order_index: 0,
      target_sets: 3,
      rep_min: 6,
      rep_max: 10,
      rest_seconds: 120,
      ...meta,
    },
    workouts: {
      id: workout,
      user_id: userId,
      name: 'Push',
      status: 'completed',
      started_at: T0,
      ended_at: T0,
      paused_ms: 0,
      time_zone: 'UTC',
      ...meta,
    },
    workout_exercises: {
      id: we,
      user_id: userId,
      workout_id: workout,
      exercise_id: BENCH,
      exercise_name: 'Barbell bench press',
      order_index: 0,
      ...meta,
    },
    sets: {
      id: id(),
      user_id: userId,
      workout_id: workout,
      workout_exercise_id: we,
      exercise_id: BENCH,
      order_index: 0,
      set_type: 'working',
      weight_kg: 100,
      reps: 5,
      completed_at: T0,
      ...meta,
    },
    body_weight: {
      id: id(),
      user_id: userId,
      measured_at: T0,
      weight_kg: 80,
      entered_unit: 'kg',
      ...meta,
    },
    user_preferences: {
      user_id: userId,
      weight_unit: 'kg',
      effort_metric: 'rir',
      week_starts_on: 1,
      default_rest_seconds: 120,
      auto_start_rest: true,
      updated_at: T0,
    },
  };
}

type Rows = ReturnType<typeof rowsFor>;
type TableName = keyof Rows;
const TABLES = Object.keys(rowsFor('x')) as TableName[];
const keyOf = (t: TableName) => (t === 'user_preferences' ? 'user_id' : 'id');
const idOf = (rows: Rows, t: TableName) =>
  (rows[t] as unknown as Record<string, string>)[keyOf(t)]!;

async function insertRow(tx: Transaction, table: string, row: object) {
  const cols = Object.keys(row);
  await tx.query(
    `insert into public.${table} (${cols.join(', ')})
     select ${cols.join(', ')} from jsonb_populate_record(null::public.${table}, $1::jsonb)`,
    [JSON.stringify(row)],
  );
}

async function insertAll(server: TestServer, userId: string, rows: Rows) {
  await server.asUser(userId, async (tx) => {
    for (const t of TABLES) await insertRow(tx, t, rows[t]);
  });
}

async function expectError(promise: Promise<unknown>, pattern: RegExp) {
  await expect(promise).rejects.toThrow(pattern);
}

describe('row level security', () => {
  let server: TestServer;
  let userA: string;
  let userB: string;
  let rowsA: Rows;

  beforeAll(async () => {
    server = await createTestServer();
    userA = await server.createUser('a@example.com');
    userB = await server.createUser('b@example.com');
    rowsA = rowsFor(userA);
    await insertAll(server, userA, rowsA);
  }, 30_000);

  afterAll(() => server.close());

  it('lets a user read their own rows in every table', async () => {
    for (const t of TABLES) {
      const result = await server.asUser(userA, (tx) =>
        tx.query(`select 1 from public.${t} where ${keyOf(t)} = $1`, [idOf(rowsA, t)]),
      );
      expect(result.rows, t).toHaveLength(1);
    }
  });

  it('User A data is invisible to User B in every table', async () => {
    for (const t of TABLES) {
      const result = await server.asUser(userB, (tx) => tx.query(`select * from public.${t}`));
      expect(result.rows, t).toHaveLength(0);
    }
  });

  it('User B cannot modify User A data in any table', async () => {
    for (const t of TABLES) {
      const result = await server.asUser(userB, (tx) =>
        tx.query(`update public.${t} set updated_at = $2 where ${keyOf(t)} = $1`, [
          idOf(rowsA, t),
          T1,
        ]),
      );
      expect(result.affectedRows, t).toBe(0);
      const check = await server.asUser(userA, (tx) =>
        tx.query<{ updated_at: Date }>(
          `select updated_at from public.${t} where ${keyOf(t)} = $1`,
          [idOf(rowsA, t)],
        ),
      );
      expect(check.rows[0]!.updated_at.toISOString(), t).toBe(T0);
    }
  });

  it('User B cannot delete User A data in any table', async () => {
    for (const t of TABLES) {
      const result = await server.asUser(userB, (tx) =>
        tx.query(`delete from public.${t} where ${keyOf(t)} = $1`, [idOf(rowsA, t)]),
      );
      expect(result.affectedRows, t).toBe(0);
    }
    for (const t of TABLES) {
      const check = await server.asUser(userA, (tx) =>
        tx.query(`select 1 from public.${t} where ${keyOf(t)} = $1`, [idOf(rowsA, t)]),
      );
      expect(check.rows, t).toHaveLength(1);
    }
  });

  it('User B cannot overwrite User A rows by upserting their ids', async () => {
    const workout = { ...rowsA.workouts, user_id: userB, name: 'Hijacked', updated_at: T1 };
    await expectError(
      server.asUser(userB, (tx) =>
        tx.query(
          `insert into public.workouts select * from jsonb_populate_record(null::public.workouts, $1::jsonb)
           on conflict (id) do update set name = excluded.name, updated_at = excluded.updated_at`,
          [JSON.stringify({ ...workout, server_updated_at: T1 })],
        ),
      ),
      /row-level security/,
    );
    const check = await server.asUser(userA, (tx) =>
      tx.query<{ name: string }>('select name from public.workouts where id = $1', [
        rowsA.workouts.id,
      ]),
    );
    expect(check.rows[0]!.name).toBe('Push');
  });

  it('a user cannot insert rows owned by someone else', async () => {
    const rowsForA = rowsFor(userA);
    await expectError(
      server.asUser(userB, (tx) => insertRow(tx, 'routines', rowsForA.routines)),
      /row-level security/,
    );
  });

  it('a user cannot hand their row over to someone else', async () => {
    const rowsB = rowsFor(userB);
    await server.asUser(userB, (tx) => insertRow(tx, 'routines', rowsB.routines));
    await server.asUser(userB, (tx) =>
      tx.query('update public.routines set user_id = $2, updated_at = $3 where id = $1', [
        rowsB.routines.id,
        userA,
        T1,
      ]),
    );
    // The stamp trigger pins ownership, so the row still belongs to B.
    const owner = await server.pg.query<{ user_id: string }>(
      'select user_id from public.routines where id = $1',
      [rowsB.routines.id],
    );
    expect(owner.rows[0]!.user_id).toBe(userB);
  });

  it('User B cannot attach children to User A parents', async () => {
    const rowsB = rowsFor(userB);
    await expectError(
      server.asUser(userB, (tx) =>
        insertRow(tx, 'routine_days', { ...rowsB.routine_days, routine_id: rowsA.routines.id }),
      ),
      /foreign key/,
    );
    await expectError(
      server.asUser(userB, (tx) =>
        insertRow(tx, 'workout_exercises', {
          ...rowsB.workout_exercises,
          workout_id: rowsA.workouts.id,
        }),
      ),
      /foreign key/,
    );
  });

  it('User B cannot use User A custom exercises', async () => {
    const rowsB = rowsFor(userB);
    await server.asUser(userB, async (tx) => {
      await insertRow(tx, 'workouts', rowsB.workouts);
    });
    await expectError(
      server.asUser(userB, (tx) =>
        insertRow(tx, 'workout_exercises', {
          ...rowsB.workout_exercises,
          exercise_id: rowsA.user_exercises.id,
        }),
      ),
      /Unknown exercise/,
    );
  });

  it('signed-out visitors cannot read or write anything', async () => {
    for (const t of [...TABLES, 'exercises']) {
      await expectError(
        server.asAnon((tx) => tx.query(`select * from public.${t}`)),
        /permission denied/,
      );
    }
    await expectError(
      server.asAnon((tx) => insertRow(tx, 'routines', rowsFor(userA).routines)),
      /permission denied/,
    );
  });

  it('the built-in library is readable but not writable', async () => {
    const count = await server.asUser(userA, (tx) =>
      tx.query<{ n: number }>('select count(*)::int as n from public.exercises'),
    );
    expect(count.rows[0]!.n).toBeGreaterThan(80);
    await expectError(
      server.asUser(userA, (tx) =>
        tx.query(`update public.exercises set name = 'x' where id = $1`, [BENCH]),
      ),
      /permission denied/,
    );
  });

  it('sets server_updated_at itself and keeps created_at', async () => {
    const rows = rowsFor(userA);
    await server.asUser(userA, (tx) =>
      insertRow(tx, 'body_weight', {
        ...rows.body_weight,
        server_updated_at: '2000-01-01T00:00:00Z',
      }),
    );
    await server.asUser(userA, (tx) =>
      tx.query('update public.body_weight set created_at = $2, updated_at = $3 where id = $1', [
        rows.body_weight.id,
        '2001-01-01T00:00:00Z',
        T1,
      ]),
    );
    const row = await server.pg.query<{ server_updated_at: Date; created_at: Date }>(
      'select server_updated_at, created_at from public.body_weight where id = $1',
      [rows.body_weight.id],
    );
    expect(row.rows[0]!.server_updated_at.getFullYear()).toBeGreaterThan(2020);
    expect(row.rows[0]!.created_at.toISOString()).toBe(T0);
  });

  it('ignores an update older than the stored row (newer change wins)', async () => {
    const rows = rowsFor(userA);
    await server.asUser(userA, (tx) =>
      insertRow(tx, 'routines', { ...rows.routines, name: 'New', updated_at: T1 }),
    );
    const result = await server.asUser(userA, (tx) =>
      tx.query('update public.routines set name = $2, updated_at = $3 where id = $1', [
        rows.routines.id,
        'Stale',
        T0,
      ]),
    );
    expect(result.affectedRows).toBe(0);
    const row = await server.pg.query<{ name: string }>(
      'select name from public.routines where id = $1',
      [rows.routines.id],
    );
    expect(row.rows[0]!.name).toBe('New');
  });

  it('rejects invalid values at the database, not only in the app', async () => {
    const rows = rowsFor(userA);
    await expectError(
      server.asUser(userA, (tx) =>
        insertRow(tx, 'routine_exercises', {
          ...rowsA.routine_exercises,
          id: crypto.randomUUID(),
          rep_min: 12,
          rep_max: 6,
        }),
      ),
      /check constraint/,
    );
    await expectError(
      server.asUser(userA, (tx) =>
        insertRow(tx, 'body_weight', { ...rows.body_weight, weight_kg: 5 }),
      ),
      /check constraint/,
    );
  });
});
