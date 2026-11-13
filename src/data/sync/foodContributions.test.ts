import { hmacSha256Hex } from '../../../supabase/functions/_shared/billing';
import {
  handleOrder,
  handleVerify,
  type BillingDeps,
} from '../../../supabase/functions/_shared/billing';
import { createTestServer, type TestServer } from '@/test/server';

/**
 * Foods members suggest for everyone, on real Postgres with the migrations: nothing is shared
 * until the owner approves it, and an approved food quietly gives its author 5% off one payment.
 */

let server: TestServer;
let author: string;
let reader: string;
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

interface FoodFields {
  id?: string;
  name?: string;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}
const submit = (user: string, f: FoodFields = {}) =>
  server.asUser(user, (tx) =>
    tx.query<{ s: string }>(
      'select public.submit_food($1, $2, $3, $4, $5, $6, $7, $8, $9) as s',
      [
        f.id ?? id(),
        f.name ?? `Food ${n}`,
        'veg',
        f.kcal ?? 350,
        f.protein ?? 20,
        f.carbs ?? 45,
        f.fat ?? 10,
        2,
        40,
      ],
    ),
  );
const shared = async (user: string) =>
  (
    await server.asUser(user, (tx) =>
      tx.query<{ l: { id: string; name: string }[] }>('select public.get_shared_foods() as l'),
    )
  ).rows[0]!.l;
interface Thanks {
  foods: { id: string; name: string; status: string }[];
  credit: { percent: number; valid_until: string } | null;
  credits_waiting: number;
}
const thanks = async (user: string) =>
  (
    await server.asUser(user, (tx) =>
      tx.query<{ t: Thanks }>('select public.get_my_food_thanks() as t'),
    )
  ).rows[0]!.t;
const approve = async (foodId: string, name: string | null = null) =>
  (await server.pg.query<{ r: string }>('select public.approve_food($1, $2) as r', [foodId, name]))
    .rows[0]!.r;

const config = { keyId: 'rzp_test_key', keySecret: 'secret', webhookSecret: 'whsec' };
let orders = 0;
const deps = (): BillingDeps => ({
  config,
  razorpay: async (method, path) =>
    method === 'POST' && path === '/orders' ? { id: `order_fc${++orders}` } : null,
  rpc: async (fn, args) => {
    const names = Object.keys(args);
    const sql = `select public.${fn}(${names.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`;
    const out = await server.pg.query<{ r: unknown }>(sql, Object.values(args));
    return out.rows[0]?.r ?? null;
  },
});
const pay = async (user: string, plan: string, coupon?: string) => {
  const started = await handleOrder(deps(), user, { plan, coupon });
  const orderId = started.body.order_id as string;
  const paymentId = `pay_fc${orders}`;
  await handleVerify(deps(), user, {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: await hmacSha256Hex(config.keySecret, `${orderId}|${paymentId}`),
  });
  return started.body.amount as number;
};

beforeAll(async () => {
  server = await createTestServer();
  author = await server.createUser('author@example.com');
  reader = await server.createUser('reader@example.com');
}, 30_000);
afterAll(() => server.close());

describe('food contributions', () => {
  it('a suggestion waits for review, and reaches everyone only once approved', async () => {
    const foodId = id();
    expect((await submit(author, { id: foodId, name: '  Sattu   paratha ' })).rows[0]!.s).toBe(
      'pending',
    );
    // Sending the same one again (a retry after a lost connection) adds nothing.
    expect((await submit(author, { id: foodId, name: 'Sattu paratha' })).rows[0]!.s).toBe('pending');
    expect(await shared(reader)).toEqual([]);
    expect((await thanks(author)).foods).toEqual([
      { id: foodId, name: 'Sattu paratha', status: 'pending' },
    ]);
    expect((await thanks(author)).credit).toBeNull();
    // Other people see nothing of it, not even that it exists.
    expect((await thanks(reader)).foods).toEqual([]);

    expect(await approve(foodId)).toMatch(/^approved, 5% credit/);
    const list = await shared(reader);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: foodId, name: 'Sattu paratha', kcal: 350, piece_g: 40 });
    // No author is sent with a shared food.
    expect(Object.keys(list[0]!)).not.toContain('user_id');
    expect(await approve(foodId)).toBe('already approved');
  });

  it('refuses numbers that cannot be a real food, repeats, and floods', async () => {
    // 100 kcal cannot hold 30 g protein and 40 g fat.
    await expect(submit(author, { kcal: 100, protein: 30, carbs: 0, fat: 40 })).rejects.toThrow(
      /disagree/,
    );
    await expect(submit(author, { name: 'x' })).rejects.toThrow(/Name/);
    await expect(submit(author, { kcal: 0, protein: 0, carbs: 0, fat: 0 })).rejects.toThrow(
      /missing/,
    );
    // Already in the shared library, whoever asks.
    await expect(submit(reader, { name: 'sattu PARATHA' })).rejects.toThrow(/Already/);
    const flooder = await server.createUser('flood@example.com');
    for (let i = 0; i < 5; i++) await submit(flooder, { name: `Flood ${i}` });
    await expect(submit(flooder, { name: 'Flood 6' })).rejects.toThrow(/Daily limit/);
  });

  it('thanks the author with 5% off one payment, and a second food covers the month after', async () => {
    const t1 = await thanks(author);
    expect(t1.credit?.percent).toBe(5);
    expect(t1.credits_waiting).toBe(1);
    const firstUntil = t1.credit!.valid_until;
    // A second approved food this month does not stack: it moves to the month after.
    const second = id();
    await submit(author, { id: second, name: 'Litti chokha' });
    await approve(second, 'Litti chokha (2 pieces)');
    const t2 = await thanks(author);
    expect(t2.credits_waiting).toBe(2);
    expect(t2.credit!.valid_until).toBe(firstUntil);
    const rows = await server.pg.query<{ valid_from: string; valid_until: string }>(
      `select valid_from::text, valid_until::text from public.food_credits
       where user_id = $1 order by valid_from`,
      [author],
    );
    const nextFrom = new Date(`${rows.rows[0]!.valid_until}T00:00:00Z`);
    nextFrom.setUTCDate(nextFrom.getUTCDate() + 1);
    expect(rows.rows[1]!.valid_from).toBe(nextFrom.toISOString().slice(0, 10));
    expect((await shared(reader)).map((f) => f.name)).toContain('Litti chokha (2 pieces)');

    // It is applied by itself at payment: 399 less 5% is 379.
    expect(await pay(author, 'quarterly')).toBe(37900);
    const used = await server.pg.query<{ used: number }>(
      `select count(*)::int as used from public.food_credits where user_id = $1 and used_at is not null`,
      [author],
    );
    expect(used.rows[0]!.used).toBe(1);
    // The next payment this month is at the normal price: the second credit is for later.
    expect(await pay(author, 'monthly')).toBe(14900);
    // Someone without a credit pays the normal price.
    expect(await pay(reader, 'monthly')).toBe(14900);
  });

  it('a typed code wins over the credit, which is then kept for another payment', async () => {
    const helper = await server.createUser('helper@example.com');
    const foodId = id();
    await submit(helper, { id: foodId, name: 'Thekua' });
    await approve(foodId);
    expect(await pay(helper, 'yearly', 'RISHI10')).toBe(134900);
    expect((await thanks(helper)).credit?.percent).toBe(5);
    expect(await pay(helper, 'monthly')).toBe(14200);
    expect((await thanks(helper)).credit).toBeNull();
  });

  it('an abandoned payment does not use the credit up', async () => {
    const helper = await server.createUser('helper2@example.com');
    const foodId = id();
    await submit(helper, { id: foodId, name: 'Dal pitha' });
    await approve(foodId);
    expect((await handleOrder(deps(), helper, { plan: 'monthly' })).body.amount).toBe(14200);
    expect((await thanks(helper)).credit?.percent).toBe(5);
  });

  it('rejecting says why to nobody but the owner, and keeps the tables closed', async () => {
    const foodId = id();
    await submit(reader, { id: foodId, name: 'Mystery shake' });
    await server.pg.query('select public.reject_food($1, $2)', [foodId, 'No such product']);
    expect((await thanks(reader)).foods[0]).toEqual({
      id: foodId,
      name: 'Mystery shake',
      status: 'rejected',
    });
    expect((await shared(author)).map((f) => f.name)).not.toContain('Mystery shake');
    const review = await server.pg.query<{ name: string; from_email: string }>(
      `select name, from_email from public.food_review where id = $1`,
      [foodId],
    );
    expect(review.rows[0]).toEqual({ name: 'Mystery shake', from_email: 'reader@example.com' });
    for (const sql of [
      'select * from public.food_submissions',
      'select * from public.food_credits',
      'select * from public.food_review',
      `select public.approve_food('${foodId}')`,
      `select public.reject_food('${foodId}')`,
      `select public.billing_credit('${reader}')`,
      `insert into public.food_credits (user_id, submission_id, valid_from, valid_until)
       values ('${reader}', '${foodId}', current_date, current_date)`,
    ]) {
      await expect(server.asUser(reader, (tx) => tx.query(sql)), sql).rejects.toThrow();
    }
  });
});
