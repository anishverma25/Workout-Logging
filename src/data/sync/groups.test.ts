import { createTestServer, type TestServer } from '@/test/server';

/**
 * Friends, groups and leaderboards on real Postgres with the migrations: usernames, join codes,
 * limits, privacy, admin powers and every rule of the Macrotrophy Score.
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
          // Ticked as they are done, a few minutes apart (the server checks the sets span 2+ min).
          new Date(start.getTime() + (i + 1) * 3 * 60_000).toISOString(),
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

/** A day's food: the protein split over lunch and dinner (one meal alone is not a day). */
async function food(
  userId: string,
  date: string,
  protein: number,
  createdAt?: string,
  meals: string[] = ['lunch', 'dinner'],
) {
  const created = createdAt ?? `${date}T08:00:00+05:30`;
  for (const meal of meals) {
    await server.asUser(userId, (tx) =>
      tx.query(
        `insert into public.food_logs (id, date, meal, food_id, food_name, amount, unit, grams,
          kcal, protein_g, carbs_g, fat_g, fibre_g, created_at, updated_at)
         values ($1, $2, $3, 'paneer', 'Paneer', 1, 'serving', 100, 300, $4, 5, 20, 0, $5, $5)`,
        [uuid(), date, meal, protein / meals.length, created],
      ),
    );
  }
}

interface Score {
  user_id: string;
  workouts: number;
  hard_sets: number;
  records: number;
  protein_days: number;
  consistency_weeks: number;
  progress_points: number;
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

describe('Macrotrophy Score', () => {
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

  it('counts one workout a day and six a week, and hard sets at 25', async () => {
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
    // 3 workouts, the 3 days of the week also earn the consistency bonus, and 1 record.
    expect(s.consistency_weeks).toBe(1);
    expect(s.score).toBe(10 * 3 + 10 + 10 + 5);
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
    // A second session today adds its hard sets, not another 10 points: 16 against 13.
    expect(mine[0]).toMatchObject({ rank: 2, above: 'week.leader', behind_by: 3 });
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

describe('duels', () => {
  interface Duel {
    id: string;
    live: boolean;
    challenger: string;
    opponent: string;
    challenger_score: number;
    opponent_score: number;
    mine: boolean;
    i_am_challenger: boolean;
  }
  const duels = (userId: string, group: string) =>
    as<{ limit: number; duels: Duel[] }>(userId, 'public.get_group_duels($1)', [group]);
  /** An hour ago: inside this week whatever day the tests run, and logged live. */
  const recently = () => new Date(Date.now() - 60 * 60_000);

  async function trio() {
    const tag = String(++n);
    const a = await user(`duel_a${tag}`);
    const b = await user(`duel_b${tag}`);
    const c = await user(`duel_c${tag}`);
    const g = await as<{ id: string; code: string }>(a, 'public.create_group($1)', ['Duelists']);
    await as(b, 'public.join_group($1)', [g.code]);
    await as(c, 'public.join_group($1)', [g.code]);
    return {
      a,
      b,
      c,
      group: g.id,
      names: { a: `duel_a${tag}`, b: `duel_b${tag}`, c: `duel_c${tag}` },
    };
  }

  it('one member challenges another, and both see the live points of the week', async () => {
    const { a, b, c, group, names } = await trio();
    await as(a, 'public.create_duel($1, $2)', [group, names.b]);
    await workout(b, recently(), three());
    const mine = await duels(a, group);
    expect(mine.limit).toBe(3);
    expect(mine.duels).toMatchObject([
      {
        live: true,
        challenger: names.a,
        opponent: names.b,
        challenger_score: 0,
        opponent_score: 13,
        mine: true,
        i_am_challenger: true,
      },
    ]);
    // The whole group can watch; someone outside it cannot.
    expect((await duels(c, group)).duels).toMatchObject([{ mine: false, opponent_score: 13 }]);
    const outsider = await user();
    await expect(duels(outsider, group)).rejects.toThrow(/Not a member/);
    // Nothing but usernames and points comes back.
    expect(JSON.stringify(mine)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-4000-9000/);
  });

  it('refuses a second duel with the same person, a duel with yourself, strangers, and a fourth in a week', async () => {
    const { a, b, group, names } = await trio();
    await as(a, 'public.create_duel($1, $2)', [group, names.b]);
    await expect(as(a, 'public.create_duel($1, $2)', [group, names.b])).rejects.toThrow(
      /Duel exists/,
    );
    await expect(as(b, 'public.create_duel($1, $2)', [group, names.a])).rejects.toThrow(
      /Duel exists/,
    );
    await expect(as(a, 'public.create_duel($1, $2)', [group, names.a])).rejects.toThrow(
      /Duel yourself/,
    );
    await expect(as(a, 'public.create_duel($1, $2)', [group, 'nobody_here'])).rejects.toThrow(
      /No member/,
    );
    const tag = String(++n);
    const outsider = await user(`duel_out${tag}`);
    await expect(as(outsider, 'public.create_duel($1, $2)', [group, names.a])).rejects.toThrow(
      /Not a member/,
    );
    await as(a, 'public.create_duel($1, $2)', [group, names.c]);
    const d = await user(`duel_d${tag}`);
    const e = await user(`duel_e${tag}`);
    const code = (
      await server.pg.query<{ code: string }>('select code from public.groups where id = $1', [
        group,
      ])
    ).rows[0]!.code;
    await as(d, 'public.join_group($1)', [code]);
    await as(e, 'public.join_group($1)', [code]);
    await as(a, 'public.create_duel($1, $2)', [group, `duel_d${tag}`]);
    await expect(as(a, 'public.create_duel($1, $2)', [group, `duel_e${tag}`])).rejects.toThrow(
      /Duel limit 3/,
    );
    // Being challenged does not use up your own three.
    await as(e, 'public.create_duel($1, $2)', [group, names.a]);
    expect(b).toBeTruthy();
    // The table itself is closed.
    await expect(
      server.asUser(a, (tx) => tx.query('select * from public.group_duels')),
    ).rejects.toThrow(/permission denied/);
  });

  it('either of the two can call it off, nobody else, and leaving the group ends it', async () => {
    const { a, b, c, group, names } = await trio();
    const made = await as<{ id: string }>(a, 'public.create_duel($1, $2)', [group, names.b]);
    expect(await as<boolean>(c, 'public.cancel_duel($1)', [made.id])).toBe(false);
    expect((await duels(a, group)).duels).toHaveLength(1);
    expect(await as<boolean>(b, 'public.cancel_duel($1)', [made.id])).toBe(true);
    expect((await duels(a, group)).duels).toHaveLength(0);
    await as(a, 'public.create_duel($1, $2)', [group, names.c]);
    await as(c, 'public.leave_group($1)', [group]);
    expect((await duels(a, group)).duels).toHaveLength(0);
  });

  it('last week is settled once, with the winner by points', async () => {
    const { a, b, group, names } = await trio();
    const made = await as<{ id: string }>(a, 'public.create_duel($1, $2)', [group, names.b]);
    // The duel was last week's, and A trained in it.
    await server.pg.query(
      'update public.group_duels set week_start = week_start - 7 where id = $1',
      [made.id],
    );
    const lastWeek = new Date(Date.now() - 7 * 86_400_000);
    await workout(a, lastWeek, three(), { createdAt: lastWeek });
    const seen = await duels(b, group);
    expect(seen.duels).toMatchObject([{ live: false, challenger_score: 13, opponent_score: 0 }]);
    const row = (
      await server.pg.query<{ winner: string; settled_at: string }>(
        'select winner, settled_at from public.group_duels where id = $1',
        [made.id],
      )
    ).rows[0]!;
    expect(row.winner).toBe(a);
    // A workout logged afterwards does not rewrite a finished duel.
    await workout(b, lastWeek, [...three(), ...three(), ...three()], { createdAt: lastWeek });
    expect((await duels(b, group)).duels).toMatchObject([
      { challenger_score: 13, opponent_score: 0 },
    ]);
    expect(await as<boolean>(a, 'public.cancel_duel($1)', [made.id])).toBe(false);
  });

  // -------------------------------------------------------------------------------------------
  // Fairer points (migration 0026)
  // -------------------------------------------------------------------------------------------

  it('does not count a workout whose sets were all ticked at once', async () => {
    const a = await user();
    const w = await workout(a, day(8), three());
    // Every set marked done in the same minute, as if ticked at the end.
    await server.pg.query(
      `update public.sets set completed_at = (select started_at + interval '40 minutes'
         from public.workouts where id = $1) where workout_id = $1`,
      [w],
    );
    const s = await scoreOf(a);
    expect(s.workouts).toBe(0);
    expect(s.hard_sets).toBe(0);
  });

  it('gives a consistency bonus for each week with 3 training days, and none for 2', async () => {
    const two = await user();
    await workout(two, day(7), three());
    await workout(two, day(9), three());
    expect((await scoreOf(two)).consistency_weeks).toBe(0);
    const four = await user();
    for (const d of [7, 9, 11, 12]) await workout(four, day(d), three());
    const s = await scoreOf(four);
    expect(s.consistency_weeks).toBe(1);
    expect(s.score).toBe(4 * 10 + 4 * 3 + 10);
    // A month counts each week on its own.
    const m = await scores([four], '2026-09-01T00:00:00+05:30', '2026-10-01T00:00:00+05:30');
    expect(m.get(four)!.consistency_weeks).toBe(1);
  });

  it('gives progress points for getting stronger on 3 or more lifts, up to 10', async () => {
    const a = await user();
    const lifts = [exerciseId, otherExerciseId];
    const third = (
      await server.pg.query<{ id: string }>(
        'select id from public.exercises where id <> all($1) order by id limit 1',
        [lifts],
      )
    ).rows[0]!.id;
    const all = [...lifts, third];
    const sessions = (kg: number) => all.map((exercise) => ({ kg, reps: 8, exercise }));
    // The 4 weeks before: 60 kg on each lift.
    await workout(a, new Date('2026-08-20T18:00:00+05:30'), sessions(60));
    await workout(a, new Date('2026-08-27T18:00:00+05:30'), sessions(60));
    // This week: 5% more on every lift.
    await workout(a, day(8), sessions(63));
    const s = await scoreOf(a);
    expect(Number(s.progress_pct)).toBeCloseTo(5, 0);
    expect(s.progress_points).toBe(5);
    // Two lifts alone are not enough to judge.
    const b = await user();
    const pair = (kg: number) =>
      lifts.flatMap((exercise) => [
        { kg, reps: 8, exercise },
        { kg, reps: 8, exercise },
      ]);
    await workout(b, new Date('2026-08-20T18:00:00+05:30'), pair(60));
    await workout(b, new Date('2026-08-27T18:00:00+05:30'), pair(60));
    await workout(b, day(8), pair(80));
    expect((await scoreOf(b)).progress_points).toBe(0);
  });

  it('a protein day needs food at two meals', async () => {
    const a = await user();
    await setProteinTarget(a, 100);
    await food(a, '2026-09-08', 150, undefined, ['lunch']);
    await food(a, '2026-09-09', 150);
    expect((await scoreOf(a)).protein_days).toBe(1);
  });

  // -------------------------------------------------------------------------------------------
  // Routines on the boards
  // -------------------------------------------------------------------------------------------

  async function giveRoutine(userId: string) {
    const r = uuid();
    const d1 = uuid();
    const d2 = uuid();
    const now = new Date().toISOString();
    const own = uuid();
    await server.asUser(userId, async (tx) => {
      await tx.query(
        `insert into public.user_exercises (id, name, primary_muscle, equipment, category,
          tracking_type, load_mode, created_at, updated_at)
         values ($1, 'Secret cable thing', 'chest', 'cable', 'isolation', 'weight_reps', 'total',
          $2, $2)`,
        [own, now],
      );
      await tx.query(
        `insert into public.routines (id, name, is_active, created_at, updated_at)
         values ($1, 'PPL', true, $2, $2)`,
        [r, now],
      );
      for (const [i, [d, name]] of [
        [d1, 'Push'],
        [d2, 'Pull'],
      ].entries()) {
        await tx.query(
          `insert into public.routine_days (id, routine_id, name, order_index, weekdays, created_at,
            updated_at) values ($1, $2, $3, $4, $5, $6, $6)`,
          [d, r, name, i, [1 + i * 2], now],
        );
      }
      await tx.query(
        `insert into public.routine_exercises (id, routine_day_id, exercise_id, order_index,
          target_sets, rep_min, rep_max, target_rir, rest_seconds, created_at, updated_at)
         values ($1, $2, $3, 0, 4, 6, 10, 2, 120, $4, $4),
                ($5, $2, $9, 1, 3, 10, 15, null, 90, $4, $4),
                ($6, $7, $8, 0, 3, 8, 12, null, 90, $4, $4)`,
        [uuid(), d1, exerciseId, now, uuid(), uuid(), d2, otherExerciseId, own],
      );
    });
  }

  it('shows a ranked member’s routine plan to group members, never weights, and only while shared', async () => {
    const a = await user('plan.owner');
    const b = await user('plan.viewer');
    const outsider = await user('plan.outsider');
    const g = await as<{ id: string; code: string }>(a, 'public.create_group($1)', ['Plans']);
    await as(b, 'public.join_group($1)', [g.code]);
    await giveRoutine(a);

    type Plan = {
      name: string;
      days: {
        name: string;
        weekdays: number[];
        exercises: {
          exercise_id: string | null;
          name: string;
          sets: number;
          rep_min: number;
          rep_max: number;
        }[];
      }[];
    };
    const plan = await as<Plan>(b, 'public.get_member_routine($1, $2)', [g.id, 'Plan.Owner ']);
    expect(plan.name).toBe('PPL');
    expect(plan.days.map((d) => d.name)).toEqual(['Push', 'Pull']);
    expect(plan.days[0]!.weekdays).toEqual([1]);
    expect(plan.days[0]!.exercises[0]).toMatchObject({
      exercise_id: exerciseId,
      sets: 4,
      rep_min: 6,
      rep_max: 10,
    });
    // An exercise of their own is named only vaguely and cannot be copied.
    expect(plan.days[0]!.exercises[1]).toMatchObject({
      exercise_id: null,
      name: 'Their own exercise',
    });
    expect(JSON.stringify(plan)).not.toMatch(/weight|kg|user_id|rest|Secret/);

    await expect(
      as(outsider, 'public.get_member_routine($1, $2)', [g.id, 'plan.owner']),
    ).rejects.toThrow(/Not a member/);

    // Turned off: nothing is shown.
    await as(a, 'public.set_share_routine($1)', [false]);
    expect(await as(b, 'public.get_member_routine($1, $2)', [g.id, 'plan.owner'])).toBeNull();
    await as(a, 'public.set_share_routine($1)', [true]);
    expect(await as(b, 'public.get_member_routine($1, $2)', [g.id, 'plan.owner'])).not.toBeNull();
  });

  it('keeps routine plans closed to direct reads', async () => {
    const a = await user();
    await expect(as(a, `public.community_routine('${a}')`)).rejects.toThrow();
  });

  it('free accounts start one duel a week, Pro three; only paying members wear the crown', async () => {
    const a = await user('limit.free');
    const b = await user('limit.b');
    const c = await user('limit.c');
    const g = await as<{ id: string; code: string }>(a, 'public.create_group($1)', ['Limits']);
    await as(b, 'public.join_group($1)', [g.code]);
    await as(c, 'public.join_group($1)', [g.code]);
    await free(a);
    await as(a, 'public.create_duel($1, $2)', [g.id, 'limit.b']);
    await expect(as(a, 'public.create_duel($1, $2)', [g.id, 'limit.c'])).rejects.toThrow(
      /Duel limit 1/,
    );
    expect((await as<{ limit: number }>(a, 'public.get_group_duels($1)', [g.id])).limit).toBe(1);
    // On the trial: three.
    expect((await as<{ limit: number }>(b, 'public.get_group_duels($1)', [g.id])).limit).toBe(3);

    // The crown: not for a trial, yes once paid.
    await workout(b, new Date(), three());
    const rowsFor = async () =>
      (
        await as<{ rows: { username: string; pro: boolean }[] }>(
          a,
          'public.get_group_board($1, $2, $3)',
          [g.id, 'week', 0],
        )
      ).rows;
    expect((await rowsFor()).find((r) => r.username === 'limit.b')?.pro).toBe(false);
    await server.pg.query(
      `update public.subscriptions set pro_expires_at = now() + interval '30 days' where user_id = $1`,
      [b],
    );
    expect((await rowsFor()).find((r) => r.username === 'limit.b')?.pro).toBe(true);
  });
});
