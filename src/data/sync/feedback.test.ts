import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestServer, type TestServer } from '@/test/server';

/** Feedback on real Postgres with the migrations: people add and read only their own. */

let server: TestServer;
let userA: string;
let userB: string;
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

const submit = (
  userId: string,
  fields: { id?: string; rating?: number | null; tags?: string[]; message?: string } = {},
) =>
  server.asUser(userId, (tx) =>
    tx.query('select public.submit_feedback($1, $2, $3, $4, $5, $6, $7) as ok', [
      fields.id ?? id(),
      fields.rating === undefined ? 5 : fields.rating,
      fields.tags ?? ['love'],
      fields.message ?? '',
      'more',
      '/more',
      '0.1.0',
    ]),
  );

interface Item {
  id: string;
  rating: number | null;
  message: string;
  seen_at: string | null;
  reply: string | null;
}
const mine = async (userId: string) =>
  (
    await server.asUser(userId, (tx) =>
      tx.query<{ list: Item[] }>('select public.get_my_feedback() as list'),
    )
  ).rows[0]!.list;

beforeAll(async () => {
  server = await createTestServer();
  userA = await server.createUser('a@example.com');
  userB = await server.createUser('b@example.com');
}, 30_000);
afterAll(() => server.close());

describe('feedback', () => {
  it('saves a rating with tags and a message, and shows it only to its author', async () => {
    const feedbackId = id();
    await submit(userA, {
      id: feedbackId,
      rating: 4,
      tags: ['idea'],
      message: '  Add a plate calculator  ',
    });
    const list = await mine(userA);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: feedbackId, rating: 4, message: 'Add a plate calculator' });
    expect(await mine(userB)).toEqual([]);
  });

  it('sending the same feedback twice keeps one copy', async () => {
    const same = id();
    await submit(userB, { id: same, message: 'Twice' });
    await submit(userB, { id: same, message: 'Twice' });
    expect((await mine(userB)).filter((f) => f.id === same)).toHaveLength(1);
  });

  it('rejects empty feedback, unknown tags and bad ratings', async () => {
    await expect(submit(userA, { rating: null, message: '   ' })).rejects.toThrow(
      /rating or a message/,
    );
    await expect(submit(userA, { tags: ['spam'] })).rejects.toThrow(/check/);
    await expect(submit(userA, { rating: 9 })).rejects.toThrow(/check/);
  });

  it('cannot be read, written or changed directly, or by signed-out visitors', async () => {
    for (const sql of [
      'select * from public.feedback',
      `insert into public.feedback (id, user_id, message) values ('${id()}', '${userA}', 'x')`,
      `update public.feedback set reply = 'fake reply'`,
      'delete from public.feedback',
    ]) {
      await expect(server.asUser(userA, (tx) => tx.query(sql))).rejects.toThrow(
        /permission denied/,
      );
    }
    await expect(
      server.asAnon((tx) => tx.query('select public.get_my_feedback()')),
    ).rejects.toThrow(/permission denied/);
  });

  it('shows the administrator’s seen mark and reply to the author', async () => {
    const [first] = await mine(userA);
    await server.pg.query(
      `update public.feedback set seen_at = now(), reply = 'Coming next week', replied_at = now()
       where id = $1`,
      [first!.id],
    );
    const [after] = await mine(userA);
    expect(after).toMatchObject({ reply: 'Coming next week' });
    expect(after!.seen_at).not.toBeNull();
  });

  it('allows at most 10 a day for each person', async () => {
    const user = await server.createUser('busy@example.com');
    for (let i = 0; i < 10; i++) await submit(user, { message: `Note ${i}` });
    await expect(submit(user, { message: 'One more' })).rejects.toThrow(/Too much feedback/);
  });

  it('the queries in the feedback guide work as written', async () => {
    const guide = readFileSync(join(process.cwd(), 'docs', 'admin-feedback.md'), 'utf8');
    const blocks = [...guide.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1]!);
    const [overview, latest, markRead, reply] = blocks;
    expect(blocks).toHaveLength(4);
    const summary = await server.pg.query<{ entries: number; people: number }>(overview!);
    expect(Number(summary.rows[0]!.entries)).toBeGreaterThan(0);
    const rows = await server.pg.query<{ email: string; id: string }>(latest!);
    expect(rows.rows.some((r) => r.email === 'b@example.com')).toBe(true);
    await server.pg.exec(markRead!);
    const target = rows.rows.find((r) => r.email === 'b@example.com')!;
    await server.pg.exec(reply!.replace('paste-the-id-here', target.id));
    const item = (await mine(userB)).find((f) => f.id === target.id)!;
    expect(item.reply).toMatch(/Thanks!/);
    expect(item.seen_at).not.toBeNull();
  });
});
