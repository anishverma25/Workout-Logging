import { createTestServer, type TestServer } from '@/test/server';

/** Batch 11 (T1, migration 0035): timed targets up to 600 reach the server, nothing above. */
let server: TestServer;
beforeAll(async () => {
  server = await createTestServer();
}, 30_000);
afterAll(() => server.close());

it('routine targets allow 600 and refuse more', async () => {
  const defs = await server.pg.query<{ d: string }>(
    `select pg_get_constraintdef(oid) as d from pg_constraint
      where conrelid = 'public.routine_exercises'::regclass and contype = 'c'`,
  );
  const text = defs.rows.map((r) => r.d).join(' | ');
  expect(text).toMatch(/rep_max >= 1\) AND \(rep_max <= 600/);
  expect(text).not.toMatch(/<= 100\b/);
});
