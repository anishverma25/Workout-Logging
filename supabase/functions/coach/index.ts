// Macrotrophy AI coach. Deployed as a Supabase Edge Function (Deno):
//   supabase functions deploy coach --no-verify-jwt
// POST /coach with { topic, question, brief, history }, { kind: 'food', text } or
// { kind: 'food_photo', image, note }, signed in (checked here with the user's
// access token). Pro is checked from the account's subscription row; nothing is stored.
// Secrets: GEMINI_API_KEY (Google AI Studio) and/or GROQ_API_KEY (console.groq.com). Optional:
// GEMINI_MODEL, GROQ_MODEL, GROQ_VISION_MODEL to change models, APP_ORIGIN as for billing.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import {
  DEFAULT_MODELS,
  geminiProvider,
  groqProvider,
  handleCoach,
  isWarmUp,
  type CoachProvider,
  type CoachResponse,
} from '../_shared/coach.ts';

const env = (name: string) => Deno.env.get(name) ?? '';

const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Gemini first (better answers), Groq when Gemini fails or is over its free limit.
const providers: CoachProvider[] = [];
if (env('GEMINI_API_KEY'))
  providers.push(
    geminiProvider(env('GEMINI_API_KEY'), env('GEMINI_MODEL') || DEFAULT_MODELS.gemini),
  );
if (env('GROQ_API_KEY'))
  providers.push(
    groqProvider(
      env('GROQ_API_KEY'),
      env('GROQ_MODEL') || DEFAULT_MODELS.groq,
      fetch,
      env('GROQ_VISION_MODEL') || DEFAULT_MODELS.groqVision,
    ),
  );

// A comma-separated list is allowed, for example during a move to a new domain:
// https://macrotrophy.in,https://overloadgym.in
// Without APP_ORIGIN set, only the app's own addresses (and a local build) are allowed, never
// any site at all.
const DEFAULT_ORIGINS = [
  'https://macrotrophy.in',
  'https://www.macrotrophy.in',
  'https://overloadgym.in',
  'https://overload-gym.pages.dev',
];
const configuredOrigins = (env('APP_ORIGIN') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = configuredOrigins.length ? configuredOrigins : DEFAULT_ORIGINS;
const isLocal = (origin: string) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

function cors(origin: string | null): Record<string, string> {
  const allow =
    origin && (allowedOrigins.includes(origin) || (!configuredOrigins.length && isLocal(origin)))
      ? origin
      : allowedOrigins[0];
  return {
    'access-control-allow-origin': allow || '*',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'origin',
  };
}

function reply(result: CoachResponse, origin: string | null): Response {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { ...cors(origin), 'content-type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return reply({ status: 405, body: { error: 'POST only' } }, origin);
  try {
    const body = await req.json().catch(() => null);
    // Opening Macrotrophy AI or AI food logging starts the function early, so the real request
    // does not wait for a cold start. Nothing is read or sent to an AI.
    if (isWarmUp(body)) return reply({ status: 200, body: { ok: true } }, origin);
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    // Read the subscription as the person themselves, through the same function the app uses.
    const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { authorization: `Bearer ${token}` } },
    });
    // Asked at the same time as the user check, to save a round trip. Row level security
    // means it returns nothing useful for a bad token, and it is only used after the check.
    const subscription = (async () => {
      const { data: sub, error: subError } = await asUser.rpc('get_my_subscription');
      if (subError) throw new Error(subError.message);
      return sub;
    })();
    subscription.catch(() => undefined);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user)
      return reply({ status: 401, body: { error: 'Sign in first.', code: 'signed_out' } }, origin);
    const result = await handleCoach(
      {
        providers,
        subscription: () => subscription,
        // Today's AI uses for this person (migration 0028), claimed as the service role for the
        // user checked above, so nobody can call the counter directly.
        quota: {
          async claim(kind) {
            const { data: left, error: claimError } = await admin.rpc('ai_claim', {
              p_user: data.user.id,
              p_kind: kind,
            });
            if (claimError) throw new Error(claimError.message);
            return typeof left === 'number' ? left : -1;
          },
          async release(kind) {
            await admin.rpc('ai_release', { p_user: data.user.id, p_kind: kind });
          },
        },
      },
      body,
    );
    return reply(result, origin);
  } catch (err) {
    console.error(err);
    return reply({ status: 500, body: { error: 'Something went wrong. Try again.' } }, origin);
  }
});
