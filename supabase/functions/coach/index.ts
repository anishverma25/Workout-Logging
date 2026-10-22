// Overload AI coach. Deployed as a Supabase Edge Function (Deno):
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
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user)
      return reply({ status: 401, body: { error: 'Sign in first.', code: 'signed_out' } }, origin);
    // Read the subscription as the person themselves, through the same function the app uses.
    const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { authorization: `Bearer ${token}` } },
    });
    const body = await req.json().catch(() => null);
    const result = await handleCoach(
      {
        providers,
        async subscription() {
          const { data: sub, error: subError } = await asUser.rpc('get_my_subscription');
          if (subError) throw new Error(subError.message);
          return sub;
        },
        // Today's photo allowance for this person (migration 0012).
        photoQuota: {
          async claim() {
            const { data: left, error: claimError } = await asUser.rpc('claim_ai_use', {
              p_kind: 'photo',
            });
            if (claimError) throw new Error(claimError.message);
            return typeof left === 'number' ? left : -1;
          },
          async release() {
            await asUser.rpc('release_ai_use', { p_kind: 'photo' });
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
