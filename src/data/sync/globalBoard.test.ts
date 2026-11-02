import { createTestServer, type TestServer } from '@/test/server';

/**
 * The global leaderboard on real Postgres with the migrations: everyone with points appears by
 * default under their profile name, the username only when they choose, the caller's own place
 * wherever it is, hidden accounts left out, and finished weeks frozen.
 */

let server: TestServer;
let exerciseId: string;
let n = 0;
const uuid = () => `00000000-0000-4000-a000-${String(++n).padStart(12, '0')}`;

const as = <T>(userId: string, sql: string, params: unknown[] = []) =>
  server
    .asUser(userId, (tx) => tx.query<{ r: T }>(`select ${sql} as r`, params))
    .then((res) => res.rows[0]!.r);

async function person(name: string | null, username?: string) {
  const id = await server.createUser(`${uuid()}@example.com`);
  if (name) {
    await server.asUser(id, (tx) =>
      tx.query(
        `insert into public.profiles (id, display_name, goal, experience, created_at, updated_at)
         values ($1, $2, 'strength', 'beginner', now(), now())`,
        [uuid(), name],
      ),
    );
  }
  if (username) await as(id, 'public.set_username($1)', [username]);
  return id;
}

/** A finished workout of `sets` working sets, logged live, this week. */
async function train(userId: string, sets = 3, at?: Date) {
  const start =
    at ??
    new Date(
      (
        await server.pg.query<{ t: string }>(
          `select greatest(now() - interval '40 minutes', from_ts + interval '1 minute') as t
           from public.community_bounds('week', 0)`,
        )
      ).rows[0]!.t,
    );
  const w = uuid();
  const we = uuid();
  const iso = start.toISOString();
  await server.asUser(userId, async (tx) => {
    await tx.query(
      `insert into public.workouts (id, name, status, started_at, ended_at, time_zone, created_at,
        updated_at) values ($1, 'Push', 'completed', $2, $3, 'Asia/Kolkata', $2, $2)`,
      [w, iso, new Date(start.getTime() + 30 * 60_000).toISOString()],
    );
    await tx.query(
      `insert into public.workout_exercises (id, workout_id, exercise_id, exercise_name,
        order_index, created_at, updated_at) values ($1, $2, $3, 'Bench', 0, $4, $4)`,
      [we, w, exerciseId, iso],
    );
    for (let i = 0; i < sets; i++) {
      await tx.query(
        `insert into public.sets (id, workout_id, workout_exercise_id, exercise_id, order_index,
          set_type, weight_kg, reps, rir, completed_at, created_at, updated_at)
         values ($1, $2, $3, $4, $5, 'working', 60, 8, 2, $6, $7, $7)`,
        [
          uuid(),
          w,
          we,
          exerciseId,
          i,
          new Date(start.getTime() + (i + 1) * 60_000).toISOString(),
          iso,
        ],
      );
    }
  });
}

interface Row {
  rank: number;
  name: string;
  username: string | null;
  avatar: string | null;
  me: boolean;
  score: number;
}
interface Board {
  rows: Row[];
  mine: Row | null;
  total: number;
  show_username: boolean;
  has_username: boolean;
  locked: boolean;
}
const board = (userId: string, period = 'week', offset = 0) =>
  as<Board>(userId, 'public.get_global_board($1, $2)', [period, offset]);

beforeAll(async () => {
  server = await createTestServer();
  await server.pg.query(
    'update public.app_settings set early_access_ended_at = now(), leaderboard_refresh_seconds = 0',
  );
  exerciseId = (
    await server.pg.query<{ id: string }>('select id from public.exercises order by id limit 1')
  ).rows[0]!.id;
}, 60_000);
afterAll(() => server.close());

describe('global leaderboard', () => {
  it('shows everyone with points by name, never the username unless they choose', async () => {
    const asha = await person('Asha Rao', 'asha.lifts');
    const ravi = await person('Ravi K', 'ravi.k');
    const idle = await person('Idle One', 'idle.one');
    await train(asha, 6); // 10 + 6
    await train(ravi, 3); // 10 + 3
    const b = await board(ravi);
    const names = b.rows.map((r) => r.name);
    expect(names.indexOf('Asha Rao')).toBeLessThan(names.indexOf('Ravi K'));
    expect(names).not.toContain('Idle One');
    const ashaRow = b.rows.find((r) => r.name === 'Asha Rao')!;
    expect(ashaRow.username).toBeNull();
    expect(ashaRow.score).toBe(16);
    expect(b.mine).toMatchObject({ name: 'Ravi K', me: true, score: 13 });
    expect(Object.keys(ashaRow)).not.toContain('user_id');
    expect(b.has_username).toBe(true);
    expect(b.show_username).toBe(false);

    // Asha shows her username: it appears at once, without new scores.
    expect(await as(asha, 'public.set_show_username($1)', [true])).toBe(true);
    const after = await board(ravi);
    expect(after.rows.find((r) => r.name === 'Asha Rao')!.username).toBe('asha.lifts');
    expect((await board(asha)).show_username).toBe(true);
    await as(asha, 'public.set_show_username($1)', [false]);
    expect((await board(ravi)).rows.find((r) => r.name === 'Asha Rao')!.username).toBeNull();
    void idle;
  });

  it('includes people without a username or profile, and the Home standing', async () => {
    const noName = await person(null);
    await train(noName, 3);
    const b = await board(noName);
    expect(b.mine).toMatchObject({ name: 'Overload member', username: null });
    expect(b.has_username).toBe(false);
    const standing = await as<{ rank: number; total: number; score: number }>(
      noName,
      'public.get_my_global_standing()',
    );
    expect(standing.score).toBe(13);
    expect(standing.rank).toBe(b.mine!.rank);
    expect(standing.total).toBe(b.total);
  });

  it('leaves out accounts an administrator hides', async () => {
    const cheat = await person('Too Good', 'too.good');
    await train(cheat, 25);
    const viewer = await person('Viewer', 'viewer.v');
    expect((await board(viewer)).rows.map((r) => r.name)).toContain('Too Good');
    await server.pg.query('insert into public.leaderboard_hidden (user_id) values ($1)', [cheat]);
    expect((await board(viewer)).rows.map((r) => r.name)).not.toContain('Too Good');
  });

  it('sends photos only for the top 3 and the caller', async () => {
    const viewer = await person('Photo Viewer');
    const b = await board(viewer);
    for (const r of b.rows) if (r.rank > 3 && !r.me) expect(r.avatar).toBeNull();
  });

  it('cannot be read directly, and needs a signed-in person', async () => {
    const a = await person('Direct');
    for (const t of ['leaderboard_prefs', 'leaderboard_hidden', 'global_results']) {
      await expect(server.asUser(a, (tx) => tx.query(`select * from public.${t}`))).rejects.toThrow(
        /permission denied/,
      );
    }
    await expect(
      server.asAnon((tx) => tx.query("select public.get_global_board('week', 0)")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      server.asUser(a, (tx) => tx.query('select public.community_global_compute(now(), now())')),
    ).rejects.toThrow(/permission denied/);
  });

  it('freezes last week the first time it is shown', async () => {
    const a = await person('Last Week', 'last.week');
    const last = (
      await server.pg.query<{ from_ts: string }>(
        "select from_ts from public.community_bounds('week', -1)",
      )
    ).rows[0]!.from_ts;
    const day = new Date(new Date(last).getTime() + 86_400_000);
    await train(a, 3, day);
    const first = await board(a, 'week', -1);
    expect(first.locked).toBe(true);
    expect(first.mine!.score).toBe(13);
    await train(a, 3, new Date(day.getTime() + 86_400_000));
    expect((await board(a, 'week', -1)).mine!.score).toBe(13);
  });

  it('keeps showing stored results until they are older than the refresh time', async () => {
    await server.pg.query('update public.app_settings set leaderboard_refresh_seconds = 600');
    const a = await person('Cached', 'cached.c');
    const before = await board(a, 'month', 0);
    await train(a, 3);
    const still = await board(a, 'month', 0);
    expect(still.total).toBe(before.total);
    await server.pg.query('update public.app_settings set leaderboard_refresh_seconds = 0');
    const now = await board(a, 'month', 0);
    expect(now.mine!.score).toBe(13);
  });
});
