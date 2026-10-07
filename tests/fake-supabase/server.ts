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
    identities: [],
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
    const exists = await pg.query('select 1 from auth.users where email = $1', [email]);
    if (exists.rows.length)
      return authError(res, 422, 'user_already_exists', 'User already registered');
    const confirm = email.includes('+confirm');
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
    if (url.pathname === '/__test/early-access' && req.method === 'POST') {
      const { open } = (await readJson(req)) as { open: boolean };
      await pg.query('update public.app_settings set early_access_ended_at = $1', [
        open ? null : new Date().toISOString(),
      ]);
      return send(res, 200, { open });
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
