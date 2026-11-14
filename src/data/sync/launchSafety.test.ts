import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestServer, type TestServer } from '@/test/server';

/** Migration 0028 on real Postgres: AI limits, reserved names and the owner's switches. */
let server: TestServer;
beforeAll(async () => {
  server = await createTestServer();
});
afterAll(() => server.close());

const asService = async <T>(sql: string, params: unknown[] = []) =>
  server.pg.transaction(async (tx) => {
    await tx.exec('set local role service_role');
    return (await tx.query<{ r: T }>(sql, params)).rows[0]!.r;
  });
const claim = (user: string, kind: string) =>
  asService<number>('select public.ai_claim($1, $2) as r', [user, kind]);

describe('AI limits', () => {
  it('each kind has its own daily cap, and a release gives one back', async () => {
    const user = await server.createUser('ai-caps@example.com');
    const caps = { chat: 60, food: 80, photo: 15 } as const;
    for (const [kind, cap] of Object.entries(caps)) {
      let left = 0;
      for (let i = 0; i < cap; i++) left = await claim(user, kind);
      expect(left, kind).toBe(0);
      expect(await claim(user, kind), kind).toBe(-1);
    }
    await asService('select public.ai_release($1, $2) as r', [user, 'chat']);
    expect(await claim(user, 'chat')).toBe(0);
    await expect(claim(user, 'video')).rejects.toThrow();
  });

  it('the whole app stops for the day at its budget', async () => {
    await server.pg.exec('update public.app_settings set ai_daily_budget = 0');
    const user = await server.createUser('ai-budget@example.com');
    expect(await claim(user, 'chat')).toBe(-2);
    await server.pg.exec('update public.app_settings set ai_daily_budget = 3000');
    expect(await claim(user, 'chat')).toBe(59);
  });

  it('after 0029 the app cannot spend or refund uses itself', async () => {
    const user = await server.createUser('ai-old@example.com');
    for (const sql of [
      `select public.claim_ai_use('photo')`,
      `select public.release_ai_use('photo')`,
      `select public.ai_claim('${user}', 'chat')`,
    ])
      await expect(
        server.asUser(user, (tx) => tx.query(sql)),
        sql,
      ).rejects.toThrow();
  });
});

describe('usernames', () => {
  it('names that look like the brand are refused', async () => {
    const user = await server.createUser('names@example.com');
    const check = async (name: string) =>
      (
        await server.asUser(user, (tx) =>
          tx.query<{ r: string }>('select public.check_username($1) as r', [name]),
        )
      ).rows[0]!.r;
    for (const name of [
      'macrotrophy',
      'macrotrophy_ai',
      'MacrotrophyOfficial',
      'official',
      'team',
      'coach',
    ])
      expect(await check(name), name).toBe('reserved');
    expect(await check('teamrocket')).toBe('ok');
    expect(await check('anish_lifts')).toBe('ok');
  });
});

describe('switches', () => {
  it('anyone can read them; nobody but the owner can change them', async () => {
    const read = async () =>
      (await server.asAnon((tx) => tx.query<{ r: unknown }>('select public.get_app_flags() as r')))
        .rows[0]!.r;
    expect(await read()).toEqual({});
    await server.pg.exec(
      `update public.app_settings set flags = '{"ai_chat": false, "notice": "Back soon"}'`,
    );
    expect(await read()).toEqual({ ai_chat: false, notice: 'Back soon' });
    const user = await server.createUser('flags@example.com');
    await expect(
      server.asUser(user, (tx) => tx.query(`update public.app_settings set flags = '{}'`)),
    ).rejects.toThrow();
    await server.pg.exec(`update public.app_settings set flags = '{}'`);
  });
});
