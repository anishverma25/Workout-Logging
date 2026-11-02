import { createTestServer, type TestServer } from '@/test/server';

/**
 * Friends, groups and leaderboards on real Postgres with the migrations: usernames, join codes,
 * limits, privacy, admin powers and every rule of the Overload Score.
 */

let server: TestServer;
let exerciseId: string;
let otherExerciseId: string;
let n = 0;
const uuid = () => `00000000-0000-4000-9000-${String(++n).padStart(12, '0')}`;

const as = <T>(userId: string, sql: string, params: unknown[] = []) =>
  server
    .asUser(userId, (tx) => tx.query<{ r: T }>(`select ${sql} as r`, params))
    .then((res) => res.rows[0]!.r);

/** Ends the account's free trial, so it is on the free plan. */
const free = (userId: string) =>
  // The trial dates are pinned by a trigger in the real database; step around it here, as the
  // fake Supabase does for e2e, to stand in for time passing.
  server.pg.transaction(async (tx) => {
    await tx.exec('alter table public.subscriptions disable trigger subscriptions_touch');
    await tx.query(
      `update public.subscriptions set status = 'expired',
        trial_started_at = now() - interval '10 days',
        trial_expires_at = now() - interval '3 days' where user_id = $1`,
      [userId],
    );
    await tx.exec('alter table public.subscriptions enable trigger subscriptions_touch');
  });

const user = async (name?: string) => {
  const id = await server.createUser(`${uuid()}@example.com`);
  if (name) await as(id, 'public.set_username($1)', [name]);
  return id;
};

interface SetSpec {
  type?: 'warmup' | 'working' | 'backoff' | 'drop';
  kg?: number;
  reps?: number;
  rir?: number | null;
  exercise?: string;
}

/** A workout as the app syncs it: logged live unless `createdAt` says otherwise. */
async function workout(
  userId: string,
  start: Date,
  sets: SetSpec[],
  opts: { minutes?: number; createdAt?: Date; status?: string } = {},
) {
  const w = uuid();
  const end = new Date(start.getTime() + (opts.minutes ?? 45) * 60_000);
  const created = (opts.createdAt ?? start).toISOString();
  const status = opts.status ?? 'completed';
  await server.asUser(userId, async (tx) => {
    await tx.query(
      `insert into public.workouts (id, name, status, started_at, ended_at, time_zone, created_at,
        updated_at) values ($1, 'Push', $2, $3, $4, 'Asia/Kolkata', $5, $5)`,
      [w, status, start.toISOString(), status === 'completed' ? end.toISOString() : null, created],
    );
    const exercises = new Map<string, string>();
    for (const [i, s] of sets.entries()) {
      const ex = s.exercise ?? exerciseId;
      let we = exercises.get(ex);
      if (!we) {
        we = uuid();
        exercises.set(ex, we);
        await tx.query(
          `insert into public.workout_exercises (id, workout_id, exercise_id, exercise_name,
            order_index, created_at, updated_at) values ($1, $2, $3, 'Bench', $4, $5, $5)`,
          [we, w, ex, exercises.size - 1, created],
        );
      }
      await tx.query(
        `insert into public.sets (id, workout_id, workout_exercise_id, exercise_id, order_index,
          set_type, weight_kg, reps, rir, completed_at, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
        [
          uuid(),
          w,
          we,
          ex,
          i,
          s.type ?? 'working',
          s.kg ?? 60,
          s.reps ?? 8,
          s.rir === undefined ? 2 : s.rir,
          new Date(start.getTime() + (i + 1) * 60_000).toISOString(),
          created,
        ],
      );
    }
  });
  return w;
}

const three = (kg = 60, reps = 8): SetSpec[] => [
  { kg, reps },
  { kg, reps },
  { kg, reps },
];

async function setProteinTarget(userId: string, grams: number) {
  await server.asUser(userId, (tx) =>
    tx.query(
      `insert into public.profiles (id, display_name, goal, experience, protein_target_g,
        created_at, updated_at) values ($1, 'X', 'strength', 'beginner', $2, now(), now())`,
      [uuid(), grams],
    ),
  );
}

async function food(userId: string, date: string, protein: number, createdAt?: string) {
  const created = createdAt ?? `${date}T08:00:00+05:30`;
  await server.asUser(userId, (tx) =>
    tx.query(
      `insert into public.food_logs (id, date, meal, food_id, food_name, amount, unit, grams,
        kcal, protein_g, carbs_g, fat_g, fibre_g, created_at, updated_at)
       values ($1, $2, 'lunch', 'paneer', 'Paneer', 1, 'serving', 100, 300, $3, 5, 20, 0, $4, $4)`,
      [uuid(), date, protein, created],
    ),
  );
}

interface Score {
  user_id: string;
  workouts: number;
  hard_sets: number;
  records: number;
  protein_days: number;
  has_protein_target: boolean;
  active_days: number;
  volume_kg: string;
  progress_pct: string | null;
  score: number;
}

// A fixed past week (Monday 7 to Sunday 13 September 2026, India time).
const WEEK_FROM = '2026-09-07T00:00:00+05:30';
const WEEK_TO = '2026-09-14T00:00:00+05:30';
const day = (d: number, h = 18) =>
  new Date(`2026-09-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00+05:30`);

async function scores(users: string[], from = WEEK_FROM, to = WEEK_TO) {
  const res = await server.pg.query<Score>(
    'select * from public.community_scores($1::uuid[], $2::timestamptz, $3::timestamptz)',
    [users, from, to],
  );
  return new Map(res.rows.map((r) => [r.user_id, r]));
}
const scoreOf = async (userId: string) => (await scores([userId])).get(userId)!;

beforeAll(async () => {
  server = await createTestServer();
  // The launch state: early access has ended, so only paying or trial accounts are Pro.
  await server.pg.query('update public.app_settings set early_access_ended_at = now()');
  const ex = await server.pg.query<{ id: string }>(
    "select id from public.exercises where load_mode = 'total' order by id limit 2",
  );
  exerciseId = ex.rows[0]!.id;
  otherExerciseId = ex.rows[1]!.id;
}, 60_000);
afterAll(() => server.close());

describe('usernames', () => {
  it('are unique whatever the capitals, cleaned and checked on the server', async () => {
    const a = await user();
    const b = await user();
    expect(await as(a, 'public.set_username($1)', ['  @Iron.Anish '])).toBe('iron.anish');
    expect(await as(a, 'public.get_my_username()')).toBe('iron.anish');
    expect(await as(b, 'public.check_username($1)', ['IRON.ANISH'])).toBe('taken');
    await expect(as(b, 'public.set_username($1)', ['Iron.Anish'])).rejects.toThrow(/taken/);
    expect(await as(a, 'public.check_username($1)', ['iron.anish'])).toBe('ok');
    for (const bad of ['ab', 'a b', '.anish', 'anish_', 'an..ish', 'ánish', 'a'.repeat(21)])
      expect(await as(b, 'public.check_username($1)', [bad]), bad).toBe('invalid');
    for (const reserved of ['admin', 'overload', 'overload.team', 'Support'])
      expect(await as(b, 'public.check_username($1)', [reserved]), reserved).toBe('reserved');
    // Changing it frees the old one.
    expect(await as(a, 'public.set_username($1)', ['anish.lifts'])).toBe('anish.lifts');
    expect(await as(b, 'public.set_username($1)', ['iron.anish'])).toBe('iron.anish');
  });

  it('cannot be read or written directly, and signed-out visitors get nothing', async () => {
    const a = await user('direct.read');
    for (const t of ['usernames', 'groups', 'group_members', 'group_results']) {
      await expect(server.asUser(a, (tx) => tx.query(`select * from public.${t}`))).rejects.toThrow(
        /permission denied/,
      );
    }
    await expect(
      server.asAnon((tx) => tx.query("select public.check_username('someone')")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      server.asUser(a, (tx) =>
        tx.query('select * from public.community_scores(array[$1]::uuid[], now(), now())', [a]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('groups', () => {
  it('are created with a code, joined by typing it (any case, spaces or dashes)', async () => {
    const a = await user('maker.one');
    const b = await user('joiner.one');
    const g = await as<{ id: string; code: string; name: string }>(a, 'public.create_group($1)', [
      '  Iron   Squad ',
    ]);
    expect(g.name).toBe('Iron Squad');
    expect(g.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const typed = `${g.code.slice(0, 3).toLowerCase()} - ${g.code.slice(3)}`;
    const joined = await as<{ id: string; already: boolean }>(b, 'public.join_group($1)', [typed]);
    expect(joined).toMatchObject({ id: g.id, already: false });
    expect((await as<{ already: boolean }>(b, 'public.join_group($1)', [g.code])).already).toBe(
      true,
    );
    const mine = await as<{ id: string; role: string; members: number }[]>(
      b,
      'public.get_my_groups()',
    );
    expect(mine).toEqual([expect.objectContaining({ id: g.id, role: 'member', members: 2 })]);
    await expect(as(b, 'public.join_group($1)', ['ZZZZZZ'])).rejects.toThrow(/No group/);
  });

  it('need a username first, and free accounts can be in three', async () => {
    const nameless = await user();
    await expect(as(nameless, 'public.create_group($1)', ['X'])).rejects.toThrow(/username/);
    const a = await user('three.groups');
    await free(a);
    for (const name of ['One', 'Two', 'Three']) await as(a, 'public.create_group($1)', [name]);
    await expect(as(a, 'public.create_group($1)', ['Four'])).rejects.toThrow(/limit 3/);
    // Pro allows ten.
    await server.pg.query(
      "update public.subscriptions set status = 'active', pro_started_at = now(), pro_expires_at = now() + interval '30 days' where user_id = $1",
      [a],
    );
    await as(a, 'public.create_group($1)', ['Four']);
  });

  it('hold at most 30 people', async () => {
    const admin = await user('full.admin');
    const g = await as<{ code: string }>(admin, 'public.create_group($1)', ['Big']);
    for (let i = 0; i < 29; i++)
      await as(await user(`member.${i}x`), 'public.join_group($1)', [g.code]);
    await expect(as(await user('one.too.many'), 'public.join_group($1)', [g.code])).rejects.toThrow(
      /full/,
    );
  });

  it('let only the admin rename, change the code and remove people', async () => {
    const a = await user('admin.ana');
    const b = await user('member.bo');
    const g = await as<{ id: string; code: string }>(a, 'public.create_group($1)', ['Gym']);
    await as(b, 'public.join_group($1)', [g.code]);
    await expect(as(b, 'public.rename_group($1, $2)', [g.id, 'Mine'])).rejects.toThrow(/admin/);
    await expect(as(b, 'public.new_group_code($1)', [g.id])).rejects.toThrow(/admin/);
    await expect(as(b, 'public.remove_group_member($1, $2)', [g.id, 'admin.ana'])).rejects.toThrow(
      /admin/,
    );
    expect(await as(a, 'public.rename_group($1, $2)', [g.id, 'Gym Bros'])).toBe('Gym Bros');
    const code = await as<string>(a, 'public.new_group_code($1)', [g.id]);
    expect(code).not.toBe(g.code);
    const c = await user('late.comer');
    await expect(as(c, 'public.join_group($1)', [g.code])).rejects.toThrow(/No group/);
    await as(c, 'public.join_group($1)', [code]);
    expect(await as(a, 'public.remove_group_member($1, $2)', [g.id, 'member.bo'])).toBe(true);
    expect(await as(b, 'public.get_my_groups()')).toEqual([]);
  });

  it('pass admin to the longest member when the admin leaves, and vanish when empty', async () => {
    const a = await user('first.in');
    const b = await user('second.in');
    const g = await as<{ id: string; code: string }>(a, 'public.create_group($1)', ['Pass']);
    await as(b, 'public.join_group($1)', [g.code]);
    expect(await as(a, 'public.leave_group($1)', [g.id])).toBe(true);
    const left = await as<{ role: string }[]>(b, 'public.get_my_groups()');
    expect(left[0]!.role).toBe('admin');
    await as(b, 'public.leave_group($1)', [g.id]);
    const exists = await server.pg.query('select 1 from public.groups where id = $1', [g.id]);
    expect(exists.rows).toHaveLength(0);
  });

  it('show boards only to members, without user ids or anyone else’s workouts', async () => {
    const a = await user('board.owner');
    await free(a);
    const outsider = await user('out.sider');
    const g = await as<{ id: string }>(a, 'public.create_group($1)', ['Private']);
    await expect(
      as(outsider, 'public.get_group_board($1, $2, $3)', [g.id, 'week', 0]),
    ).rejects.toThrow(/Not a member/);
    expect(await as(outsider, 'public.get_group_avatars($1, $2)', [g.id, ['board.owner']])).toEqual(
      {},
    );
    const board = await as<{ rows: Record<string, unknown>[] }>(
      a,
      'public.get_group_board($1, $2, $3)',
      [g.id, 'week', 0],
    );
    expect(board.rows).toHaveLength(1);
    expect(board.rows[0]).toMatchObject({ username: 'board.owner', me: true, rank: 1 });
    expect(Object.keys(board.rows[0]!)).not.toContain('user_id');
    // Free accounts do not get the totals behind the Pro boards.
    expect(Object.keys(board.rows[0]!)).not.toContain('volume_kg');
  });

  it('are left on deleting the account', async () => {
    const a = await user('stays.here');
    const b = await user('goes.away');
    const g = await as<{ id: string; code: string }>(a, 'public.create_group($1)', ['Bye']);
    await as(b, 'public.join_group($1)', [g.code]);
    await server.asUser(b, (tx) => tx.query('select public.delete_my_account()'));
    const mine = await as<{ members: number }[]>(a, 'public.get_my_groups()');
    expect(mine[0]!.members).toBe(1);
  });
});

describe('Overload Score', () => {
  it('counts workouts and hard sets, ignoring warm-ups and easy sets', async () => {
    const a = await user();
    await workout(a, day(7), [
      { type: 'warmup' },
      { rir: 2 },
      { rir: 4 },
      { rir: 5 }, // easy: not hard
      { rir: null }, // effort not logged: counts
    ]);
    const s = await scoreOf(a);
    expect(s).toMatchObject({ workouts: 1, hard_sets: 3, active_days: 1 });
    expect(s.score).toBe(10 + 3);
  });

  it('skips workouts that are short, have under 3 working sets, run, or were not logged live', async () => {
    const a = await user();
    await workout(a, day(8), three(), { minutes: 9 });
    await workout(a, day(9), [{ type: 'warmup' }, {}, {}]);
    await workout(a, day(10), three(), { status: 'in_progress' });
    // Imported or typed in later: created a week after it started.
    await workout(a, day(11), three(), { createdAt: day(18) });
    expect((await scoreOf(a)).workouts).toBe(0);
  });

  it('caps workouts at two a day and six a week, and hard sets at 25', async () => {
    const a = await user();
    for (const h of [6, 9, 12]) await workout(a, day(7, h), Array(10).fill({}));
    for (const d of [8, 9, 10, 11, 12]) await workout(a, day(d), Array(10).fill({}));
    const s = await scoreOf(a);
    expect(s.workouts).toBe(6);
    expect(s.hard_sets).toBe(25);
  });

  it('counts a record only on an exercise done twice before, and not a wild jump', async () => {
    const a = await user();
    await workout(a, new Date('2026-08-20T18:00:00+05:30'), three(60, 8));
    // A new exercise is never a "record" in its first sessions.
    await workout(a, day(7), [...three(60, 8), { kg: 40, reps: 8, exercise: otherExerciseId }]);
    expect((await scoreOf(a)).records).toBe(0);
    await workout(a, day(9), three(65, 8));
    // 300 kg after 65 kg is not believable.
    await workout(a, day(11), three(300, 8));
    const s = await scoreOf(a);
    expect(s.records).toBe(1);
    expect(s.score).toBe(10 * 3 + 10 + 5);
  });

  it('gives protein points on days reaching 90% of the person’s own target', async () => {
    const a = await user();
    expect((await scoreOf(a)).has_protein_target).toBe(false);
    await setProteinTarget(a, 100);
    await food(a, '2026-09-07', 95);
    await food(a, '2026-09-08', 60);
    await food(a, '2026-09-08', 30); // two logs make 90
    await food(a, '2026-09-09', 80); // short
    // Logged long after the day: does not count.
    await food(a, '2026-09-10', 150, '2026-09-13T08:00:00+05:30');
    const s = await scoreOf(a);
    expect(s).toMatchObject({ protein_days: 2, has_protein_target: true });
    expect(s.score).toBe(6);
  });

  it('ranks by score, then hard sets, then workouts', async () => {
    const admin = await user('rank.one');
    const two = await user('rank.two');
    const g = await as<{ id: string; code: string }>(admin, 'public.create_group($1)', ['Rank']);
    await as(two, 'public.join_group($1)', [g.code]);
    await workout(admin, day(7), [{}, {}, {}, { rir: 6 }]);
    await workout(two, day(7), [{}, {}, {}]);
    await setProteinTarget(two, 50);
    await food(two, '2026-09-08', 60);
    const rows = (
      await server.pg.query<{ b: { username: string; rank: number; score: number }[] }>(
        'select public.community_board($1, $2, $3) as b',
        [g.id, WEEK_FROM, WEEK_TO],
      )
    ).rows[0]!.b;
    expect(rows.map((r) => [r.username, r.score])).toEqual([
      ['rank.two', 16],
      ['rank.one', 13],
    ]);
  });

  it('this week: the board, who trained today and the place on the home card', async () => {
    const a = await user('week.leader');
    const b = await user('week.chaser');
    const g = await as<{ id: string; code: string }>(a, 'public.create_group($1)', ['Now']);
    await as(b, 'public.join_group($1)', [g.code]);
    const start = (
      await server.pg.query<{ t: string }>(
        `select greatest(now() - interval '20 minutes', from_ts + interval '1 minute') as t
         from public.community_bounds('week', 0)`,
      )
    ).rows[0]!.t;
    await workout(a, new Date(start), three());
    await workout(a, new Date(new Date(start).getTime() + 1000), three(), { minutes: 15 });
    await workout(b, new Date(start), three());
    const board = await as<{
      rows: { username: string; rank: number; me: boolean; score: number }[];
      trained_today: string[];
      group: { members: number };
      locked: boolean;
    }>(b, 'public.get_group_board($1, $2, $3)', [g.id, 'week', 0]);
    expect(board.rows.map((r) => r.username)).toEqual(['week.leader', 'week.chaser']);
    expect(board.rows[1]!.me).toBe(true);
    expect(board.locked).toBe(false);
    expect(board.group.members).toBe(2);
    const mine = await as<{ rank: number; above: string; behind_by: number }[]>(
      b,
      'public.get_my_groups()',
    );
    expect(mine[0]).toMatchObject({ rank: 2, above: 'week.leader', behind_by: 13 });
    const month = await as<{ rows: unknown[] }>(b, 'public.get_group_board($1, $2, $3)', [
      g.id,
      'month',
      0,
    ]);
    expect(month.rows).toHaveLength(2);
  });

  it('freezes a finished week the first time it is shown', async () => {
    const a = await user('frozen.week');
    const g = await as<{ id: string }>(a, 'public.create_group($1)', ['Frozen']);
    // The group must have existed during that week.
    await server.pg.query(
      "update public.groups set created_at = now() - interval '30 days' where id = $1",
      [g.id],
    );
    const last = (
      await server.pg.query<{ from_ts: string }>(
        "select from_ts from public.community_bounds('week', -1)",
      )
    ).rows[0]!.from_ts;
    await workout(a, new Date(new Date(last).getTime() + 86_400_000), three());
    const first = await as<{ rows: { score: number }[]; locked: boolean }>(
      a,
      'public.get_group_board($1, $2, $3)',
      [g.id, 'week', -1],
    );
    expect(first.locked).toBe(true);
    expect(first.rows[0]!.score).toBe(13);
    await workout(a, new Date(new Date(last).getTime() + 2 * 86_400_000), three());
    const again = await as<{ rows: { score: number }[] }>(a, 'public.get_group_board($1, $2, $3)', [
      g.id,
      'week',
      -1,
    ]);
    expect(again.rows[0]!.score).toBe(13);
    const winners = await as<{ username: string; period: string }[]>(
      a,
      'public.get_group_winners($1)',
      [g.id],
    );
    expect(winners[0]).toMatchObject({ username: 'frozen.week', period: 'week' });
  });
});
