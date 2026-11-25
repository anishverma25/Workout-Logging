import { COMMUNITY_REWARD_DAYS, COMMUNITY_REWARD_KARMA } from '@/domain/entitlement/limits';
import { createTestServer, type TestServer } from '@/test/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Community (migration 0040) on real Postgres with every migration: anonymity never leaks the
 * account, the owner finds and bans it by content id, Macrotrophy Verified is granted and
 * removed by email only from the SQL editor, karma is earned only from real help, and the
 * 30-day reward is given once.
 */

let server: TestServer;
let n = 0;
const uuid = () => `00000000-0000-4000-b000-${String(++n).padStart(12, '0')}`;

const as = <T>(userId: string, sql: string, params: unknown[] = []) =>
  server
    .asUser(userId, (tx) => tx.query<{ r: T }>(`select ${sql} as r`, params))
    .then((res) => res.rows[0]!.r);

const owner = <T>(sql: string, params: unknown[] = []) =>
  server.pg.query<{ r: T }>(`select ${sql} as r`, params).then((res) => res.rows[0]!.r);

const fails = (p: Promise<unknown>) =>
  p.then(
    () => '',
    (e: Error) => e.message,
  );

/** A member with a username, rules accepted, an account old enough to vote. */
async function member(username: string, opts: { days?: number; rules?: boolean } = {}) {
  const email = `${username}@example.com`;
  const id = await server.createUser(email);
  await server.pg.query(
    `update auth.users set email_confirmed_at = now(), created_at = now() - make_interval(days => $2) where id = $1`,
    [id, opts.days ?? 60],
  );
  await server.pg.query(
    `update public.subscriptions set status = 'expired', trial_started_at = now() - interval '60 days',
       trial_expires_at = now() - interval '46 days' where user_id = $1`,
    [id],
  );
  await as(id, 'public.set_username($1)', [username]);
  if (opts.rules !== false) await as(id, 'public.forum_accept_rules()');
  return id;
}

const post = async (
  id: string,
  title: string,
  opts: { anonymous?: boolean; kind?: string; body?: string; media?: unknown[] } = {},
) => {
  const postId = await as<string>(id, 'public.forum_create_post($1, $2, $3, $4, $5, $6, $7, $8)', [
    uuid(),
    opts.kind ?? 'question',
    'training',
    title,
    opts.body ?? 'How many sets should I do for chest each week as a beginner?',
    opts.anonymous ?? false,
    JSON.stringify(opts.media ?? []),
    null,
  ]);
  // Moves the post back in time, so the next one is not refused as too fast.
  await server.pg.query(
    `update public.forum_posts set created_at = created_at - interval '2 minutes' where id = $1`,
    [postId],
  );
  return postId;
};

const reply = async (id: string, postId: string, body: string, anonymous = false) => {
  const replyId = await as<string>(id, 'public.forum_reply($1, $2, $3, $4, $5)', [
    uuid(),
    postId,
    body,
    anonymous,
    null,
  ]);
  await server.pg.query(
    `update public.forum_replies set created_at = created_at - interval '2 minutes' where id = $1`,
    [replyId],
  );
  return replyId;
};

beforeAll(async () => {
  server = await createTestServer();
}, 120_000);

afterAll(async () => {
  await server.close();
});

describe('Community', () => {
  it('needs a username and the rules before posting, and lets anyone signed in read', async () => {
    const id = await server.createUser('newbie@example.com');
    expect(await fails(post(id, 'Hello there'))).toMatch(/Community: username/);
    await as(id, 'public.set_username($1)', ['newbie']);
    expect(await fails(post(id, 'Hello there'))).toMatch(/Community: rules/);
    await as(id, 'public.forum_accept_rules()');
    expect(await post(id, 'Hello there')).toMatch(/[0-9a-f-]{36}/);
    const feed = await as<{ items: unknown[] }>(
      id,
      `public.forum_feed('latest', null, null, null, null)`,
    );
    expect(feed.items.length).toBeGreaterThan(0);
    expect(
      await server.asAnon((tx) =>
        fails(tx.query(`select public.forum_feed('latest', null, null, null, null)`)),
      ),
    ).toMatch(/permission denied/);
  });

  it('never shows who wrote anonymous content, anywhere a member can look', async () => {
    const author = await member('secretlifter');
    const reader = await member('curiousreader');
    await owner(`public.community_owner_verify('secretlifter@example.com')`);
    const postId = await post(author, 'Anonymous question about my cut', { anonymous: true });
    await reply(author, postId, 'Adding some detail to my own question here', true);
    await reply(reader, postId, 'Eat enough protein, about 1.6 g per kg a day', false);

    const seen = JSON.stringify([
      await as(reader, 'public.forum_post($1)', [postId]),
      await as(reader, `public.forum_feed('latest', null, null, null, null)`),
      await as(reader, `public.forum_feed('for_you', null, null, 'cut', null)`),
      await as(reader, 'public.forum_home()'),
      await as(reader, 'public.forum_activity_list()'),
      await as(author, 'public.forum_activity_list()'),
      await as(reader, 'public.forum_profile($1)', ['secretlifter']),
    ]);
    expect(seen).not.toContain(author);
    const detail = await as<{
      author: Record<string, unknown>;
      reply_list: { author: Record<string, unknown>; is_op: boolean }[];
    }>(reader, 'public.forum_post($1)', [postId]);
    expect(detail.author).toEqual({ anonymous: true, label: 'Anonymous Lifter', me: false });
    // The verified mark stays hidden on anonymous content.
    expect(JSON.stringify(detail.author)).not.toContain('verified');
    expect(detail.reply_list[0]!.author).toEqual({
      anonymous: true,
      label: 'Anonymous Lifter',
      me: false,
    });
    expect(detail.reply_list[0]!.is_op).toBe(true);
    // Their public profile lists none of it.
    const profile = await as<{
      posts: unknown[];
      answers: number;
      karma: number | null;
      verified: boolean;
    }>(reader, 'public.forum_profile($1)', ['secretlifter']);
    expect(profile.posts).toEqual([]);
    expect(profile.answers).toBe(0);
    expect(profile.karma).toBeNull();
    expect(profile.verified).toBe(true);
    // The author sees it in Mine, marked anonymous.
    const mine = await as<{ id: string; anonymous: boolean }[]>(
      author,
      `public.forum_mine('posts')`,
    );
    expect(mine.find((p) => p.id === postId)?.anonymous).toBe(true);
  });

  it('gives each anonymous person in a thread their own label, unrelated across threads', async () => {
    const a = await member('anona');
    const b = await member('anonb');
    const c = await member('anonc');
    const p1 = await post(a, 'Thread one about squats');
    await reply(b, p1, 'First anonymous reply in this thread', true);
    await reply(c, p1, 'Second anonymous reply in this thread', true);
    await reply(b, p1, 'Back again with the same label', true);
    const d = await as<{ reply_list: { author: { label: string } }[] }>(
      a,
      'public.forum_post($1)',
      [p1],
    );
    expect(d.reply_list.map((r) => r.author.label)).toEqual([
      'Anonymous Lifter',
      'Anonymous Lifter 2',
      'Anonymous Lifter',
    ]);
    const p2 = await post(a, 'Thread two about deadlifts');
    await reply(c, p2, 'In this thread c is first', true);
    const d2 = await as<{ reply_list: { author: { label: string } }[] }>(
      a,
      'public.forum_post($1)',
      [p2],
    );
    expect(d2.reply_list[0]!.author.label).toBe('Anonymous Lifter');
  });

  it('lets only the SQL editor verify by email, and the badge follows username content only', async () => {
    const creator = await member('creatorone');
    const other = await member('someoneelse');
    // Members cannot run the owner's functions or read the tables.
    for (const sql of [
      `public.community_owner_verify('creatorone@example.com')`,
      `public.community_owner_unverify('creatorone@example.com')`,
      `public.community_owner_ban_by_user('${creator}', 'x')`,
      `public.community_owner_find_author('post', '${creator}')`,
      `(select count(*) from public.forum_members)`,
      `(select count(*) from public.community_owner_pending_reports)`,
      `(select count(*) from public.community_owner_verified)`,
      `public.forum_is_verified('${creator}')`,
    ]) {
      expect(await fails(as(creator, sql))).toMatch(/permission denied/);
    }
    expect(await owner<string>(`public.community_owner_verify('CreatorOne@Example.com ')`)).toBe(
      'Verified: @creatorone',
    );
    const named = await post(creator, 'Named post from a creator');
    const hidden = await post(creator, 'Anonymous post from a creator', { anonymous: true });
    const a = await as<{ author: { verified?: boolean } }>(other, 'public.forum_post($1)', [named]);
    const b = await as<{ author: { verified?: boolean } }>(other, 'public.forum_post($1)', [
      hidden,
    ]);
    expect(a.author.verified).toBe(true);
    expect(b.author.verified).toBeUndefined();
    expect((await as<{ verified: boolean }>(creator, 'public.forum_me()')).verified).toBe(true);
    // Removing it, and nothing else changes.
    const before = await server.pg.query(`select * from public.subscriptions where user_id = $1`, [
      creator,
    ]);
    expect(await owner<string>(`public.community_owner_unverify('creatorone@example.com')`)).toBe(
      'No longer verified: @creatorone',
    );
    const after = await server.pg.query(`select * from public.subscriptions where user_id = $1`, [
      creator,
    ]);
    expect(after.rows).toEqual(before.rows);
    const c = await as<{ author: { verified?: boolean } }>(other, 'public.forum_post($1)', [named]);
    expect(c.author.verified).toBe(false);
    expect(await fails(owner(`public.community_owner_verify('nobody@example.com')`))).toMatch(
      /No account/,
    );
  });

  it('earns karma only from other eligible members, reverses it cleanly, never for Support', async () => {
    const asker = await member('asker');
    const helper = await member('helper');
    const fresh = await member('freshvoter', { days: 0 });
    const p = await post(asker, 'What rep range for hypertrophy?');
    const r = await reply(
      helper,
      p,
      'Anything from 6 to 30 reps works when sets are taken close to failure.',
    );
    const karma = async () => (await as<{ karma: number }>(helper, 'public.forum_me()')).karma;
    expect(
      await fails(as(helper, `public.forum_react('reply', $1, 'helpful', true)`, [r])),
    ).toMatch(/own/);
    await as(asker, `public.forum_react('reply', $1, 'helpful', true)`, [r]);
    await as(asker, `public.forum_react('reply', $1, 'helpful', true)`, [r]);
    expect(await karma()).toBe(5);
    // A brand-new account's vote shows but gives no karma.
    await as(fresh, `public.forum_react('reply', $1, 'helpful', true)`, [r]);
    expect(await karma()).toBe(5);
    await as(asker, `public.forum_best_answer($1, $2)`, [p, r]);
    expect(await karma()).toBe(25);
    await as(asker, `public.forum_best_answer($1, null)`, [p]);
    expect(await karma()).toBe(5);
    await as(asker, `public.forum_react('reply', $1, 'helpful', false)`, [r]);
    expect(await karma()).toBe(0);
    const j = await post(helper, 'Six months of consistency', {
      kind: 'journey',
      body: 'What I learned.',
    });
    await as(asker, `public.forum_react('post', $1, 'support', true)`, [j]);
    expect(await karma()).toBe(0);
    expect(await fails(as(asker, `public.forum_react('post', $1, 'helpful', true)`, [p]))).toMatch(
      /reaction/,
    );
    // Only the asker picks the best answer, never their own reply.
    expect(await fails(as(helper, `public.forum_best_answer($1, $2)`, [p, r]))).toMatch(
      /not found/,
    );
    const own = await reply(asker, p, 'Thanks, I will try this out next week for sure.');
    expect(await fails(as(asker, `public.forum_best_answer($1, $2)`, [p, own]))).toMatch(/own/);
  });

  it('caps Helpful karma from one member to another', async () => {
    const voter = await member('ringvoter');
    const target = await member('ringtarget');
    const p = await post(voter, 'Many questions in one thread');
    for (let i = 0; i < 8; i++) {
      const r = await reply(target, p, `Answer number ${i} with enough detail to be useful.`);
      await as(voter, `public.forum_react('reply', $1, 'helpful', true)`, [r]);
    }
    expect((await as<{ karma: number }>(target, 'public.forum_me()')).karma).toBe(25);
  });

  it('lets the owner find and ban an anonymous author by content id, everywhere at once', async () => {
    const troll = await member('trollaccount');
    const victim = await member('victimaccount');
    const p = await post(victim, 'Feedback on my squat form please');
    const r = await reply(troll, p, 'This is a rude anonymous reply to you', true);
    await as(victim, `public.forum_report('reply', $1, null, 'harassment', 'rude')`, [r]);
    const queue = await server.pg.query<{ target_id: string; priority: string }>(
      `select target_id, priority from public.community_owner_pending_reports`,
    );
    expect(queue.rows).toContainEqual({ target_id: r, priority: 'urgent' });
    const found = await server.pg.query<{ user_id: string; anonymous: boolean; username: string }>(
      `select * from public.community_owner_find_author('reply', $1)`,
      [r],
    );
    expect(found.rows[0]).toMatchObject({
      user_id: troll,
      anonymous: true,
      username: 'trollaccount',
    });
    expect(
      await owner(`public.community_owner_ban_by_content('reply', $1, 'Harassment')`, [r]),
    ).toBe('Banned from Community: trollaccount');
    expect(await fails(post(troll, 'Trying again anonymously', { anonymous: true }))).toMatch(
      /banned/,
    );
    expect(await fails(reply(troll, p, 'Another reply'))).toMatch(/banned/);
    expect(await fails(as(troll, `public.forum_react('post', $1, 'support', true)`, [p]))).toMatch(
      /banned/,
    );
    const d = await as<{ reply_list: { id: string }[] }>(victim, 'public.forum_post($1)', [p]);
    expect(d.reply_list.map((x) => x.id)).not.toContain(r);
    expect(await owner(`public.community_owner_unban($1, 'Appeal accepted')`, [troll])).toMatch(
      /again/,
    );
    expect(await reply(troll, p, 'I am sorry about that earlier.')).toMatch(/-/);
  });

  it('blocks an anonymous author without revealing them, and only their anonymous content', async () => {
    const blocker = await member('blocker');
    const anon = await member('anonposter');
    const p1 = await post(anon, 'Anonymous one', { anonymous: true });
    const p2 = await post(anon, 'Public one');
    await as(blocker, `public.forum_block('post', $1, null)`, [p1]);
    const list = await as<{ label: string }[]>(blocker, 'public.forum_blocks_list()');
    expect(JSON.stringify(list)).not.toContain('anonposter');
    expect(JSON.stringify(list)).not.toContain(anon);
    expect(await fails(as(blocker, 'public.forum_post($1)', [p1]))).toMatch(/not found/);
    expect(await as<{ id: string }>(blocker, 'public.forum_post($1)', [p2])).toMatchObject({
      id: p2,
    });
  });

  it('answers "not found" the same for someone else\'s content and for nothing', async () => {
    const a = await member('ownera');
    const b = await member('ownerb');
    const p = await post(a, 'My own post here');
    const someone = await fails(
      as(b, `public.forum_edit_post($1, 'Changed title', 'x', null)`, [p]),
    );
    const nothing = await fails(
      as(b, `public.forum_edit_post($1, 'Changed title', 'x', null)`, [uuid()]),
    );
    expect(someone).toBe(nothing);
    expect(await fails(as(b, `public.forum_delete('post', $1)`, [p]))).toBe(
      await fails(as(b, `public.forum_delete('post', $1)`, [uuid()])),
    );
  });

  it('gives the 30-day reward once, after the server checks every rule', async () => {
    const earner = await member('earner');
    await server.pg.query(
      `update public.forum_reward_rules set karma = 20, best_answers = 1, helpful_voters = 2, replies = 2,
         reply_threads = 2, active_days = 1, account_days = 1`,
    );
    const v1 = await member('voterone');
    const v2 = await member('votertwo');
    const p1 = await post(v1, 'Question one for the earner');
    const p2 = await post(v2, 'Question two for the earner');
    const r1 = await reply(
      earner,
      p1,
      'A long and careful answer that explains the reasoning in detail.',
    );
    const r2 = await reply(
      earner,
      p2,
      'Another long and careful answer that explains the reasoning well.',
    );
    expect(await fails(as(earner, 'public.forum_claim_reward($1)', [uuid()]))).toMatch(
      /not eligible/,
    );
    await as(v1, `public.forum_react('reply', $1, 'helpful', true)`, [r1]);
    await as(v2, `public.forum_react('reply', $1, 'helpful', true)`, [r2]);
    await as(v1, `public.forum_best_answer($1, $2)`, [p1, r1]);
    const progress = await as<{ eligible: boolean; qualifying: number }>(
      earner,
      'public.forum_my_karma()',
    );
    expect(progress).toMatchObject({ eligible: true, qualifying: 30 });
    const key = uuid();
    const [first, again] = await Promise.all([
      as<{ status: string }>(earner, 'public.forum_claim_reward($1)', [key]),
      as<{ status: string }>(earner, 'public.forum_claim_reward($1)', [key]),
    ]);
    expect(first.status).toBe('applied');
    expect(again.status).toBe('applied');
    expect(await fails(as(earner, 'public.forum_claim_reward($1)', [uuid()]))).toMatch(
      /not eligible/,
    );
    const sub = await server.pg.query<{ status: string; days: number }>(
      // The reward starts after any trial or Pro time already running (the trial cannot move).
      `select status, round(extract(epoch from pro_expires_at - greatest(trial_expires_at, now())) / 86400)::int as days
       from public.subscriptions where user_id = $1`,
      [earner],
    );
    expect(sub.rows[0]).toEqual({ status: 'active', days: 30 });
    expect(
      (
        await server.pg.query(
          `select count(*)::int as c from public.forum_reward_claims where user_id = $1`,
          [earner],
        )
      ).rows[0],
    ).toEqual({ c: 1 });
    await server.pg
      .query(`update public.forum_reward_rules set karma = 300, best_answers = 3, helpful_voters = 15,
      replies = 12, reply_threads = 8, active_days = 10, account_days = 30`);
  });

  it('holds a photo reported as explicit by an established member, and checks photo data', async () => {
    const poster = await member('photoposter');
    const reporter = await member('photoreporter');
    const jpeg = `data:image/jpeg;base64,/9j/${'A'.repeat(200)}`;
    const p = await post(poster, 'Progress photo after a year', {
      kind: 'journey',
      media: [{ full: jpeg, thumb: jpeg, w: 900, h: 1200 }],
    });
    const d = await as<{ media: { id: string }[] }>(reporter, 'public.forum_post($1)', [p]);
    expect(d.media).toHaveLength(1);
    await as(reporter, `public.forum_report('media', $1, null, 'explicit', '')`, [d.media[0]!.id]);
    const after = await as<{ media: unknown[] }>(reporter, 'public.forum_post($1)', [p]);
    expect(after.media).toHaveLength(0);
    expect(await fails(as(reporter, 'public.forum_photo($1)', [d.media[0]!.id]))).toMatch(
      /not found/,
    );
    expect(
      await fails(
        post(poster, 'Bad photo data here', {
          kind: 'journey',
          media: [{ full: 'data:image/svg+xml;base64,PHN2Zz4=', thumb: jpeg, w: 10, h: 10 }],
        }),
      ),
    ).toMatch(/violates check constraint/);
  });

  it('turns off with one switch', async () => {
    const a = await member('switchuser');
    await owner(`public.community_owner_switch('community_posting', false)`);
    expect(await fails(post(a, 'Posting while paused'))).toMatch(/paused/);
    await owner(`public.community_owner_switch('community_posting', true)`);
    expect(await post(a, 'Posting after the pause')).toMatch(/-/);
  });

  it('runs every query in docs/community-owner-sql.md as written', async () => {
    const a = await member('docauthor');
    const b = await member('docreporter');
    await server.pg.query(`update auth.users set email = 'creator@example.com' where id = $1`, [a]);
    const p = await post(b, 'A question for the docs test');
    const r = await reply(a, p, 'A reply that will be reported in the docs test.', true);
    await as(b, `public.forum_report('reply', $1, null, 'harassment', '')`, [r]);
    const report = (
      await server.pg.query<{ id: number }>(
        `select id from public.forum_reports order by id desc limit 1`,
      )
    ).rows[0]!.id;
    const doc = readFileSync(join(process.cwd(), 'docs', 'community-owner-sql.md'), 'utf8');
    const blocks = [...doc.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1]!);
    expect(blocks.length).toBeGreaterThan(10);
    const rules = (await server.pg.query('select * from public.forum_reward_rules')).rows[0];
    for (const block of blocks) {
      const sql = block
        .replaceAll('PASTE-THE-USER-ID', a)
        .replaceAll('PASTE-THE-ID', r)
        .replaceAll('x@example.com', 'creator@example.com')
        .replace('resolve_report(123,', `resolve_report(${report},`);
      for (const statement of sql
        .split(/;\s*(?:--[^\n]*)?\n/)
        .map((x) => x.trim())
        .filter(Boolean)) {
        await server.pg.query(statement.replace(/;$/, ''));
      }
    }
    await server.pg.query(`update public.forum_reward_rules set karma = $1, best_answers = $2`, [
      (rules as { karma: number }).karma,
      (rules as { best_answers: number }).best_answers,
    ]);
    for (const s of ['community', 'community_posting', 'community_photos', 'community_rewards'])
      await owner(`public.community_owner_switch($1, true)`, [s]);
  });

  it('keeps every Community table closed to members and visitors', async () => {
    const id = await member('tablepeeker');
    for (const t of [
      'forum_members',
      'forum_posts',
      'forum_replies',
      'forum_media',
      'forum_reactions',
      'forum_saves',
      'forum_follows',
      'forum_hidden',
      'forum_blocks',
      'forum_activity',
      'forum_reports',
      'forum_mod_log',
      'forum_edits',
      'forum_karma',
      'forum_reward_rules',
      'forum_reward_claims',
    ]) {
      expect(await fails(as(id, `(select count(*) from public.${t})`))).toMatch(
        /permission denied/,
      );
      expect(
        await server.asAnon((tx) => fails(tx.query(`select count(*) from public.${t}`))),
      ).toMatch(/permission denied/);
      expect(
        await fails(
          server.asUser(id, (tx) => tx.query(`update public.${t} set created_at = now()`)),
        ),
      ).toMatch(/permission denied|does not exist/);
    }
    // Members cannot hand karma to anyone or give themselves the reward.
    expect(await fails(as(id, `public.forum_reverse(1, 'x')`))).toMatch(/permission denied/);
    expect(await fails(as(id, `public.forum_apply_reward('${id}')`))).toMatch(/permission denied/);
  });

  it('refuses phone numbers and drug sourcing, not ordinary numbers', async () => {
    const id = await member('textchecker');
    expect(await fails(post(id, 'Call me on 98765 43210 for coaching'))).toMatch(/contact/);
    expect(await fails(post(id, 'Where to buy anavar online'))).toMatch(/drugs/);
    expect(
      await post(id, 'Logged 1764051234567 grams lifted this year (id 9876543210123)'),
    ).toMatch(/-/);
  });

  it('starts with the reward rules the app copy states', async () => {
    const r = (
      await server.pg.query<{ karma: number; reward_days: number }>(
        'select karma, reward_days from public.forum_reward_rules',
      )
    ).rows[0]!;
    expect(r).toEqual({ karma: COMMUNITY_REWARD_KARMA, reward_days: COMMUNITY_REWARD_DAYS });
  });
});
