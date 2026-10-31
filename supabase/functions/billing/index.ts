// Overload Pro billing with Razorpay. Deployed as a Supabase Edge Function (Deno):
//   supabase functions deploy billing --no-verify-jwt
// Routes: POST /billing/subscribe, /billing/order (pay once), /billing/verify, /billing/cancel (signed-in user, checked
// here with the user's access token) and POST /billing/webhook (Razorpay, checked with the
// webhook signature). Secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import {
  handleCancel,
  handleOrder,
  handleSubscribe,
  handleVerify,
  handleWebhook,
  type BillingDeps,
  type BillingResponse,
} from '../_shared/billing.ts';

const env = (name: string) => Deno.env.get(name) ?? '';

const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const config = {
  keyId: env('RAZORPAY_KEY_ID'),
  keySecret: env('RAZORPAY_KEY_SECRET'),
  webhookSecret: env('RAZORPAY_WEBHOOK_SECRET'),
};

const deps: BillingDeps = {
  config,
  async razorpay(method, path, body) {
    const res = await fetch(`https://api.razorpay.com/v1${path}`, {
      method,
      headers: {
        authorization: `Basic ${btoa(`${config.keyId}:${config.keySecret}`)}`,
        'content-type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      console.error('Razorpay error', res.status, JSON.stringify(json));
      return null;
    }
    return json;
  },
  async rpc(fn, args) {
    const { data, error } = await admin.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data;
  },
};

// Only the app's own origin may call the signed-in routes from a browser. Set APP_ORIGIN to
// the site's address, for example https://overloadgym.in.
const allowedOrigin = env('APP_ORIGIN');

function cors(origin: string | null): Record<string, string> {
  const allow = origin && (origin === allowedOrigin || !allowedOrigin) ? origin : allowedOrigin;
  return {
    'access-control-allow-origin': allow || '*',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'origin',
  };
}

function reply(result: BillingResponse, origin: string | null): Response {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { ...cors(origin), 'content-type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return reply({ status: 405, body: { error: 'POST only' } }, origin);
  if (!config.keyId || !config.keySecret) {
    return reply({ status: 503, body: { error: 'Payments are not set up yet.' } }, origin);
  }
  const route = new URL(req.url).pathname.split('/').pop();
  try {
    if (route === 'webhook') {
      const raw = await req.text();
      return reply(
        await handleWebhook(
          deps,
          raw,
          req.headers.get('x-razorpay-signature'),
          req.headers.get('x-razorpay-event-id'),
        ),
        origin,
      );
    }
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user)
      return reply({ status: 401, body: { error: 'Sign in first.' } }, origin);
    const userId = data.user.id;
    const body = await req.json().catch(() => ({}));
    if (route === 'subscribe') return reply(await handleSubscribe(deps, userId, body), origin);
    if (route === 'order') return reply(await handleOrder(deps, userId, body), origin);
    if (route === 'verify') return reply(await handleVerify(deps, userId, body), origin);
    if (route === 'cancel') return reply(await handleCancel(deps, userId), origin);
    return reply({ status: 404, body: { error: 'Not found' } }, origin);
  } catch (err) {
    console.error(err);
    return reply({ status: 500, body: { error: 'Something went wrong. Try again.' } }, origin);
  }
});
