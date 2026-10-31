/**
 * A local stand-in for Supabase, for end-to-end tests only. Never deployed.
 *
 * - Postgres is PGlite running the project's real migrations, so row level security is real.
 * - /auth/v1 implements the parts of Supabase Auth the app uses (sign up, password sign-in,
 *   refresh, sign out, user, password reset request and update).
 * - /rest/v1 implements the parts of PostgREST the app uses (select with order, limit and the
 *   sync cursor filter; upsert; rpc), running every query as the signed-in user's role.
 *
 * Emails containing "+confirm" behave like a project that requires email confirmation.
 * Run with: node tests/fake-supabase/server.ts (Node 22+ strips the types).
 */
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import {
  handleCancel,
  handleOrder,
  handleSubscribe,
  handleVerify,
  handleWebhook,
  hmacSha256Hex,
  type BillingDeps,
} from '../../supabase/functions/_shared/billing.ts';
import {
  FOOD_LABEL_PROMPT,
  FOOD_PHOTO_PROMPT,
  LABEL_MODEL,
  FOOD_PROMPT,
  handleCoach,
  type CoachProvider,
} from '../../supabase/functions/_shared/coach.ts';

export const FAKE_SUPABASE_PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54329);
export const JWT_SECRET = 'local-e2e-secret-not-used-anywhere-else';

const root = process.cwd();
const pg = new PGlite();
await pg.exec(readFileSync(join(root, 'supabase/tests/auth-stub.sql'), 'utf8'));
for (const file of readdirSync(join(root, 'supabase/migrations')).sort()) {
  if (file.endsWith('.sql'))
    await pg.exec(readFileSync(join(root, 'supabase/migrations', file), 'utf8'));
}
await pg.exec('grant all on all tables in schema public to service_role;');
// The launch state: early access has ended, so new accounts get the 7-day trial and then the
// free plan. Early access itself is covered against real Postgres in subscriptions.test.ts.
// Keeping one fixed state here also means no test flips a setting every other test shares.
await pg.exec('update public.app_settings set early_access_ended_at = now()');

// ---------------------------------------------------------------------------------------------
// JWT (HS256)
// ---------------------------------------------------------------------------------------------

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

function signJwt(payload: Record<string, unknown>): string {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

function verifyJwt(token: string): Record<string, unknown> | null {
  const [head, body, sig] = token.split('.');
  if (!head || !body || !sig) return null;
  const expected = createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig)))
    return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as Record<string, unknown>;
  if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null;
  return payload;
}

export const ANON_KEY = signJwt({ role: 'anon', iss: 'fake-supabase', exp: 4102444800 });

// ---------------------------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------------------------

interface UserRow {
  id: string;
  email: string;
  encrypted_password: string;
  email_confirmed_at: Date | null;
  created_at: Date;
}

const refreshTokens = new Map<string, string>();

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
}

function checkPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(password, salt!, 32);
  return timingSafeEqual(candidate, Buffer.from(hash!, 'hex'));
}

function userJson(u: UserRow) {
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: u.email_confirmed_at?.toISOString() ?? null,
    created_at: u.created_at.toISOString(),
    updated_at: u.created_at.toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [{ id: u.id, user_id: u.id, provider: 'email', identity_data: { email: u.email } }],
  };
}

function session(u: UserRow) {
  const expiresIn = 3600;
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const refresh = randomBytes(24).toString('hex');
  refreshTokens.set(refresh, u.id);
  return {
    access_token: signJwt({
      sub: u.id,
      email: u.email,
      role: 'authenticated',
      aud: 'authenticated',
      exp: expiresAt,
    }),
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: expiresAt,
    refresh_token: refresh,
    user: userJson(u),
  };
}

async function userById(id: string) {
  return (await pg.query<UserRow>('select * from auth.users where id = $1', [id])).rows[0] ?? null;
}

function authError(res: ServerResponse, status: number, code: string, message: string) {
  send(res, status, { code: status, error_code: code, msg: message, message });
}

async function handleAuth(req: IncomingMessage, res: ServerResponse, path: string, url: URL) {
  const body = req.method === 'GET' ? {} : ((await readJson(req)) as Record<string, string>);

  if (path === '/signup' && req.method === 'POST') {
    const email = String(body.email ?? '').toLowerCase();
    if (!email.includes('@')) return authError(res, 400, 'validation_failed', 'Invalid email');
    if (String(body.password ?? '').length < 8)
      return authError(res, 422, 'weak_password', 'Password should be at least 8 characters.');
    const confirm = email.includes('+confirm');
    const exists = await pg.query('select 1 from auth.users where email = $1', [email]);
    if (exists.rows.length) {
      // As Supabase answers with email confirmation on: no error, a stand-in user with no
      // identities and no session, so taken addresses cannot be probed.
      if (confirm)
        return send(res, 200, {
          ...userJson({
            id: randomUUID(),
            email,
            email_confirmed_at: null,
            created_at: new Date(),
          } as UserRow),
          identities: [],
        });
      return authError(res, 422, 'user_already_exists', 'User already registered');
    }
    const id = randomUUID();
    await pg.query(
      'insert into auth.users (id, email, encrypted_password, email_confirmed_at) values ($1, $2, $3, $4)',
      [id, email, hashPassword(body.password!), confirm ? null : new Date()],
    );
    const user = (await userById(id))!;
    return send(res, 200, confirm ? userJson(user) : session(user));
  }

  if (path === '/token' && req.method === 'POST') {
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const email = String(body.email ?? '').toLowerCase();
      const user = (await pg.query<UserRow>('select * from auth.users where email = $1', [email]))
        .rows[0];
      if (!user || !checkPassword(String(body.password ?? ''), user.encrypted_password))
        return authError(res, 400, 'invalid_credentials', 'Invalid login credentials');
      if (!user.email_confirmed_at)
        return authError(res, 400, 'email_not_confirmed', 'Email not confirmed');
      return send(res, 200, session(user));
    }
    if (grant === 'refresh_token') {
      const id = refreshTokens.get(String(body.refresh_token));
      const user = id ? await userById(id) : null;
      if (!user) return authError(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token');
      refreshTokens.delete(String(body.refresh_token));
      return send(res, 200, session(user));
    }
    return authError(res, 400, 'unsupported_grant_type', 'Unsupported grant type');
  }

  const claims = bearerClaims(req);
  if (path === '/logout') {
    res.writeHead(204, cors(req)).end();
    return;
  }
  if (path === '/recover' && req.method === 'POST') return send(res, 200, {});
  if (path === '/user') {
    const user = claims?.sub ? await userById(String(claims.sub)) : null;
    if (!user) return authError(res, 401, 'no_authorization', 'Not signed in');
    if (req.method === 'PUT') {
      if (body.password) {
        if (String(body.password).length < 8)
          return authError(res, 422, 'weak_password', 'Password should be at least 8 characters.');
        await pg.query('update auth.users set encrypted_password = $2 where id = $1', [
          user.id,
          hashPassword(body.password),
        ]);
      }
    }
    return send(res, 200, userJson(user));
  }
  return authError(res, 404, 'not_found', `No auth route ${path}`);
}

// ---------------------------------------------------------------------------------------------
// REST
// ---------------------------------------------------------------------------------------------

function bearerClaims(req: IncomingMessage) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return token ? verifyJwt(token) : null;
}

const ident = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new RestError(400, 'PGRST100', `Bad name ${name}`);
  return `"${name}"`;
};

class RestError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function asRequester<T>(req: IncomingMessage, fn: (tx: Transaction) => Promise<T>) {
  const claims = bearerClaims(req);
  if (!claims) throw new RestError(401, 'PGRST301', 'JWT is missing or invalid');
  const role = claims.role === 'authenticated' ? 'authenticated' : 'anon';
  return pg.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    return fn(tx);
  });
}

const unquote = (v: string) => v.replace(/^"(.*)"$/, '$1');

/** Supports the filters the app sends: col.eq.value and the sync cursor `or`. */
function whereClause(url: URL, params: unknown[]) {
  const parts: string[] = [];
  for (const [key, value] of url.searchParams) {
    if (['select', 'order', 'limit', 'on_conflict', 'columns'].includes(key)) continue;
    if (key === 'or') {
      const m =
        /^\((\w+)\.gt\.("[^"]*"|[^,]+),and\((\w+)\.eq\.("[^"]*"|[^,]+),(\w+)\.gt\.("[^"]*"|[^)]+)\)\)$/.exec(
          value,
        );
      if (!m) throw new RestError(400, 'PGRST100', `Unsupported filter ${value}`);
      params.push(unquote(m[2]!), unquote(m[6]!));
      const ts = `$${params.length - 1}`;
      const id = `$${params.length}`;
      parts.push(
        `(${ident(m[1]!)} > ${ts}::timestamptz or (${ident(m[3]!)} = ${ts}::timestamptz and ${ident(m[5]!)}::text > ${id}))`,
      );
      continue;
    }
    const m = /^(eq|gt|lt|gte|lte)\.(.*)$/.exec(value);
    if (!m) throw new RestError(400, 'PGRST100', `Unsupported filter ${key}=${value}`);
    const op = { eq: '=', gt: '>', lt: '<', gte: '>=', lte: '<=' }[m[1] as 'eq'];
    params.push(unquote(m[2]!));
    parts.push(`${ident(key)}::text ${op} $${params.length}`);
  }
  return parts.length ? `where ${parts.join(' and ')}` : '';
}

async function handleRest(req: IncomingMessage, res: ServerResponse, path: string, url: URL) {
  const rpc = /^\/rpc\/(\w+)$/.exec(path);
  if (rpc && req.method === 'POST') {
    const args = (await readJson(req)) as Record<string, unknown>;
    const names = Object.keys(args);
    const result = await asRequester(req, (tx) =>
      tx.query<{ result: unknown }>(
        `select to_jsonb(${ident('public')}.${ident(rpc[1]!)}(${names
          .map((n, i) => `${ident(n)} => $${i + 1}`)
          .join(', ')})) as result`,
        names.map((n) => args[n]),
      ),
    );
    return send(res, 200, result.rows[0]?.result ?? null);
  }

  const table = ident(path.slice(1));
  if (req.method === 'GET') {
    const params: unknown[] = [];
    const where = whereClause(url, params);
    const order = (url.searchParams.get('order') ?? '')
      .split(',')
      .filter(Boolean)
      .map((o) => {
        const [col, dir] = o.split('.');
        return `${ident(col!)} ${dir === 'desc' ? 'desc' : 'asc'}`;
      });
    const limit = Number(url.searchParams.get('limit') ?? 1000);
    const rows = await asRequester(req, (tx) =>
      tx.query<{ row: unknown }>(
        `select to_jsonb(t) as row from public.${table} t ${where}
         ${order.length ? `order by ${order.join(', ')}` : ''} limit ${Math.min(limit, 1000)}`,
        params,
      ),
    );
    const data = rows.rows.map((r) => r.row);
    if ((req.headers.accept ?? '').includes('application/vnd.pgrst.object')) {
      if (data.length !== 1)
        throw new RestError(
          406,
          'PGRST116',
          'JSON object requested, multiple (or no) rows returned',
        );
      return send(res, 200, data[0]);
    }
    return send(res, 200, data);
  }

  if (req.method === 'POST') {
    const body = await readJson(req);
    const rows = (Array.isArray(body) ? body : [body]) as Record<string, unknown>[];
    if (rows.length === 0) return send(res, 201, null);
    const columns = Object.keys(rows[0]!);
    const cols = columns.map(ident).join(', ');
    const prefer = req.headers.prefer ?? '';
    const conflict = url.searchParams.get('on_conflict');
    let onConflict = '';
    if (prefer.includes('resolution=merge-duplicates')) {
      const key = ident(conflict ?? 'id');
      const updates = columns
        .filter((c) => ident(c) !== key)
        .map((c) => `${ident(c)} = excluded.${ident(c)}`)
        .join(', ');
      onConflict = `on conflict (${key}) do update set ${updates}`;
    }
    await asRequester(req, (tx) =>
      tx.query(
        `insert into public.${table} (${cols})
         select ${cols} from jsonb_populate_recordset(null::public.${table}, $1::jsonb) ${onConflict}`,
        [JSON.stringify(rows)],
      ),
    );
    res.writeHead(201, cors(req)).end();
    return;
  }
  throw new RestError(405, 'PGRST000', 'Method not supported by the fake');
}

// ---------------------------------------------------------------------------------------------
// Billing: the real Edge Function logic with a stand-in for the Razorpay API
// ---------------------------------------------------------------------------------------------

export const FAKE_RAZORPAY = {
  keyId: 'rzp_test_e2e',
  keySecret: 'e2e-key-secret',
  webhookSecret: 'e2e-webhook-secret',
};

interface FakeRazorpaySub {
  id: string;
  status: string;
  current_end: number | null;
  notes: Record<string, string>;
  plan_id: string;
}
const fakeOrders = new Map<string, { id: string; amount: number }>();
const fakeSubs = new Map<string, FakeRazorpaySub>();
const PLAN_MONTHS: Record<string, number> = { plan_e2eM: 1, plan_e2eQ: 3, plan_e2eY: 12 };

const billingDeps: BillingDeps = {
  config: FAKE_RAZORPAY,
  async razorpay(method, path, body) {
    if (method === 'POST' && path === '/subscriptions') {
      const b = body as { plan_id: string; notes: Record<string, string> };
      const sub = {
        id: `sub_${randomBytes(6).toString('hex')}`,
        status: 'created',
        current_end: null,
        notes: b.notes,
        plan_id: b.plan_id,
      };
      fakeSubs.set(sub.id, sub);
      return sub;
    }
    if (method === 'POST' && path === '/orders') {
      const b = body as { amount: number };
      const order = { id: `order_${randomBytes(6).toString('hex')}`, amount: b.amount };
      fakeOrders.set(order.id, order);
      return order;
    }
    const cancel = /^\/subscriptions\/(\w+)\/cancel$/.exec(path);
    if (cancel) return fakeSubs.get(cancel[1]!) ?? null;
    const get = /^\/subscriptions\/(\w+)$/.exec(path);
    if (get) {
      // Checkout finished: the first charge went through for one period.
      const sub = fakeSubs.get(get[1]!);
      if (!sub) return null;
      if (sub.status === 'created') {
        const end = new Date();
        end.setMonth(end.getMonth() + (PLAN_MONTHS[sub.plan_id] ?? 1));
        sub.status = 'active';
        sub.current_end = Math.floor(end.getTime() / 1000);
      }
      return sub;
    }
    return null;
  },
  async rpc(fn, args) {
    const keys = Object.keys(args);
    const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`;
    return pg.transaction(async (tx) => {
      await tx.exec('set local role service_role');
      const res = await tx.query<{ r: unknown }>(
        sql,
        keys.map((k) => args[k]),
      );
      return res.rows[0]?.r ?? null;
    });
  },
};

async function handleBilling(req: IncomingMessage, res: ServerResponse, route: string) {
  if (route === 'webhook') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString();
    const sig = req.headers['x-razorpay-signature'];
    const id = req.headers['x-razorpay-event-id'];
    const r = await handleWebhook(
      billingDeps,
      raw,
      typeof sig === 'string' ? sig : null,
      typeof id === 'string' ? id : null,
    );
    return send(res, r.status, r.body);
  }
  const claims = bearerClaims(req);
  const userId = claims?.role === 'authenticated' ? String(claims.sub) : null;
  if (!userId) return send(res, 401, { error: 'Sign in first.' });
  const body = await readJson(req);
  const r =
    route === 'subscribe'
      ? await handleSubscribe(billingDeps, userId, body)
      : route === 'verify'
        ? await handleVerify(billingDeps, userId, body)
        : route === 'cancel'
          ? await handleCancel(billingDeps, userId)
          : route === 'order'
            ? await handleOrder(billingDeps, userId, body)
            : { status: 404, body: { error: 'Not found' } };
  return send(res, r.status, r.body);
}

// ---------------------------------------------------------------------------------------------
// AI coach: the real handler with stand-in providers, so tests never use a real AI or quota.
// ---------------------------------------------------------------------------------------------

/**
 * Stand-in providers. A question can steer them, so tests running in parallel never share
 * state: "#gemini-down" makes the first provider fail, "#all-down" both, "#invent" makes them
 * quote a load that is not in the data.
 */
function fakeCoachProvider(name: 'gemini' | 'groq'): CoachProvider {
  return {
    name,
    async generate(system, messages, options) {
      const last = messages[messages.length - 1]!.text;
      if (system === FOOD_PROMPT) {
        const answer = fakeFoodAnswer(name, last);
        // A search "runs" when a brand is named, as it would with a key that can search.
        if (options?.search) options.onSearch?.(/[A-Z]{2,}|Starbucks|Amul/.test(last));
        return answer;
      }
      if (system === FOOD_PHOTO_PROMPT) return fakePhotoAnswer(name, last);
      if (system === FOOD_LABEL_PROMPT) {
        // The stronger label model is "over its free allowance", so the usual one answers.
        if (options?.model === LABEL_MODEL)
          throw new Error(`${name} label model is over its limit`);
        return JSON.stringify({
          product: 'Whey protein',
          brand: 'TestFit',
          serving_g: 33,
          serving_text: '1 scoop (33 g)',
          per_100g: { kcal: 400, protein_g: 80, carbs_g: 8, fat_g: 6, fibre_g: null, sugar_g: 3 },
          per_serving: { kcal: 132, protein_g: 26.4, carbs_g: 2.6, fat_g: 2, fibre_g: null },
        });
      }
      if (last.includes('#all-down') || (name === 'gemini' && last.includes('#gemini-down')))
        throw new Error(`${name} is over its limit`);
      if (last.includes('#invent')) return 'Your squat is 999 kg, so add more weight.';
      const question = /^Question: (.*)$/m.exec(last)?.[1];
      const fact = last.split('\n').find((l) => l.startsWith('- ')) ?? '- Your data is in.';
      return `${question ? `You asked: ${question}\n` : ''}Here is what your numbers say (${name === 'gemini' ? 'main' : 'backup'}).\n${fact}\n- Keep logging every set so the next answer has more to go on.`;
    },
  };
}

/**
 * AI food logging stand-in: each comma or "and" separated part becomes one 150 g food of
 * 240 kcal (12 g protein, 30 g carbs, 8 g fat), marked as found on the web when it names a
 * brand in capitals. "#food-down" makes both providers fail.
 */
function fakeFoodAnswer(name: string, message: string): string {
  if (message.includes('#food-down')) throw new Error(`${name} is over its limit`);
  const text = /What they ate: (.*)$/m.exec(message)?.[1] ?? '';
  const parts = text
    .split(/,|\band\b|\baur\b/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return JSON.stringify(
    parts.map((p) => ({
      name: p.replace(/^\d+\s*/, ''),
      portion: /^\d+/.test(p) ? p : `1 serving`,
      grams: 150,
      kcal: 240,
      protein_g: 12,
      carbs_g: 30,
      fat_g: 8,
      fibre_g: 0,
      diet: /chicken|egg/i.test(p) ? (/chicken/i.test(p) ? 'nonveg' : 'egg') : 'veg',
      basis: /[A-Z]{2,}|Starbucks|Amul/.test(p) ? 'web' : 'estimate',
      ref: /[A-Z]{2,}|Starbucks|Amul/.test(p) ? 'brand website' : 'typical recipe',
    })),
  );
}

/**
 * Photo stand-in: every photo is "2 rotis and a katori of dal tadka" plus one dish the library
 * does not have. A note containing "#photo-down" makes both providers fail.
 */
function fakePhotoAnswer(name: string, message: string): string {
  if (message.includes('#photo-down')) throw new Error(`${name} is over its limit`);
  return JSON.stringify([
    {
      name: 'Roti',
      portion: '2 rotis',
      grams: 80,
      kcal: 230,
      protein_g: 7,
      carbs_g: 44,
      fat_g: 3,
      fibre_g: 6,
      diet: 'veg',
      basis: 'photo',
      confidence: 'high',
      ref: 'two on the plate',
    },
    {
      name: 'Dal tadka',
      portion: '1 katori',
      grams: 160,
      kcal: 150,
      protein_g: 7,
      carbs_g: 18,
      fat_g: 5.5,
      fibre_g: 4,
      diet: 'veg',
      basis: 'photo',
      confidence: 'medium',
      ref: 'one katori, full',
    },
    {
      name: 'Mango pickle',
      portion: '1 tsp',
      grams: 10,
      kcal: 25,
      protein_g: 0.2,
      carbs_g: 1,
      fat_g: 2.2,
      fibre_g: 0.3,
      diet: 'veg',
      basis: 'photo',
      confidence: 'low',
      ref: 'small amount on the side',
    },
  ]);
}

async function handleCoachRoute(req: IncomingMessage, res: ServerResponse) {
  const claims = bearerClaims(req);
  if (claims?.role !== 'authenticated')
    return send(res, 401, { error: 'Sign in first.', code: 'signed_out' });
  const body = await readJson(req);
  const r = await handleCoach(
    {
      providers: [fakeCoachProvider('gemini'), fakeCoachProvider('groq')],
      subscription: () =>
        asRequester(req, async (tx) => {
          const q = await tx.query<{ r: unknown }>('select public.get_my_subscription() as r');
          return q.rows[0]?.r ?? null;
        }),
      photoQuota: {
        claim: () =>
          asRequester(req, async (tx) => {
            const q = await tx.query<{ r: number }>(`select public.claim_ai_use('photo') as r`);
            return q.rows[0]?.r ?? -1;
          }),
        release: () =>
          asRequester(req, async (tx) => {
            await tx.query(`select public.release_ai_use('photo')`);
          }),
      },
    },
    body,
  );
  return send(res, r.status, r.body);
}

// ---------------------------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------------------------

function cors(req: IncomingMessage): Record<string, string> {
  return {
    'access-control-allow-origin': req.headers.origin ?? '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': req.headers['access-control-request-headers'] ?? '*',
    'access-control-expose-headers': 'content-range, x-supabase-api-version',
  };
}

function send(res: ServerResponse, status: number, body: unknown) {
  const req = (res as ServerResponse & { req: IncomingMessage }).req;
  res.writeHead(status, { ...cors(req), 'content-type': 'application/json' });
  res.end(body === null ? '' : JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString();
  return text ? JSON.parse(text) : {};
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors(req)).end();
      return;
    }
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    if (url.pathname === '/health') return send(res, 200, { ok: true });
    // Test control, standing in for the administrator's SQL: open or end early access.
    // Test control, standing in for the administrator replying to feedback.
    if (url.pathname === '/__test/feedback-reply' && req.method === 'POST') {
      const { reply } = (await readJson(req)) as { reply: string };
      await pg.query(
        'update public.feedback set reply = $1, replied_at = now(), seen_at = now() where reply is null',
        [reply],
      );
      return send(res, 200, {});
    }
    // Test control, standing in for time passing: an account's trial ended some days ago.
    if (url.pathname === '/__test/expire-trial' && req.method === 'POST') {
      const { email, daysAgo = 1 } = (await readJson(req)) as { email: string; daysAgo?: number };
      // The trial is immutable in the real database (a trigger pins its dates), which is the
      // point. Standing in for time passing means stepping around that trigger here.
      const changed = await pg.transaction(async (tx) => {
        await tx.exec('alter table public.subscriptions disable trigger subscriptions_touch');
        const result = await tx.query(
          `update public.subscriptions set
             status = 'expired',
             trial_started_at = now() - make_interval(days => ($2::int + 7)),
             trial_expires_at = now() - make_interval(days => $2::int)
           where user_id = (select id from auth.users where email = $1)`,
          [email, Math.round(daysAgo)],
        );
        await tx.exec('alter table public.subscriptions enable trigger subscriptions_touch');
        return result.affectedRows ?? 0;
      });
      return send(res, 200, { changed });
    }
    if (url.pathname === '/__test/early-access' && req.method === 'POST') {
      const { open } = (await readJson(req)) as { open: boolean };
      await pg.query('update public.app_settings set early_access_ended_at = $1', [
        open ? null : new Date().toISOString(),
      ]);
      return send(res, 200, { open });
    }
    // Test control, standing in for the administrator's SQL: a personal message on Home.
    if (url.pathname === '/__test/banner' && req.method === 'POST') {
      const {
        email,
        message,
        hours = 24,
      } = (await readJson(req)) as {
        email: string;
        message: string | null;
        hours?: number;
      };
      const changed = await pg.query(
        `update public.subscriptions set
           banner_message = $2,
           banner_expires_at = case when $2::text is null then null
                                    else now() + make_interval(hours => $3::int) end
         where user_id = (select id from auth.users where email = $1)`,
        [email, message, Math.round(hours)],
      );
      return send(res, 200, { changed: changed.affectedRows ?? 0 });
    }
    // Test control, standing in for the administrator connecting Razorpay plans.
    if (url.pathname === '/__test/billing-plans' && req.method === 'POST') {
      const { connected } = (await readJson(req)) as { connected: boolean };
      await pg.exec(
        connected
          ? `update public.billing_plans set razorpay_plan_id = case id
               when 'monthly' then 'plan_e2eM' when 'quarterly' then 'plan_e2eQ'
               else 'plan_e2eY' end`
          : 'update public.billing_plans set razorpay_plan_id = null',
      );
      return send(res, 200, { connected });
    }
    // Test control, standing in for Razorpay Checkout's signature on a finished payment.
    if (url.pathname === '/__test/razorpay-sign' && req.method === 'POST') {
      const { payment_id, subscription_id, order_id } = (await readJson(req)) as Record<
        string,
        string
      >;
      // Subscriptions sign payment|subscription; one-time orders sign order|payment.
      const message = order_id ? `${order_id}|${payment_id}` : `${payment_id}|${subscription_id}`;
      return send(res, 200, { signature: await hmacSha256Hex(FAKE_RAZORPAY.keySecret, message) });
    }
    if (url.pathname === '/functions/v1/coach') {
      return await handleCoachRoute(req, res);
    }
    if (url.pathname.startsWith('/functions/v1/billing/')) {
      return await handleBilling(req, res, url.pathname.slice('/functions/v1/billing/'.length));
    }
    if (url.pathname.startsWith('/auth/v1')) {
      return await handleAuth(req, res, url.pathname.slice('/auth/v1'.length), url);
    }
    if (url.pathname.startsWith('/rest/v1')) {
      return await handleRest(req, res, url.pathname.slice('/rest/v1'.length), url);
    }
    send(res, 404, { message: 'Not found' });
  } catch (err) {
    if (err instanceof RestError) {
      return send(res, err.status, {
        code: err.code,
        message: err.message,
        details: null,
        hint: null,
      });
    }
    const e = err as { code?: string; message?: string };
    const status = e.code === '42501' ? 403 : e.code?.startsWith('23') ? 409 : 400;
    send(res, status, {
      code: e.code ?? 'XX000',
      message: e.message ?? String(err),
      details: null,
      hint: null,
    });
  }
});

server.listen(FAKE_SUPABASE_PORT, () => {
  process.stdout.write(
    `Fake Supabase on http://localhost:${FAKE_SUPABASE_PORT} (anon key ${ANON_KEY})\n`,
  );
});
