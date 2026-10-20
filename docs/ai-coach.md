# AI coach

Pro members can ask the coach about their training (`/coach`, or the round button at the
bottom right of every screen except the coach page and a running workout) or tap **Explain**
on a card (every Progress section, the weekly check-in on Home, and nutrition targets on Body).
Users never see which AI service answers: the app, the consent and the privacy policy say "a
third-party AI service", and the server's reply does not name the provider. Free
accounts see the same buttons marked Pro, and tapping them shows what Pro adds.

## How it works

1. The phone builds a **training brief**: short lines of numbers the app has already
   calculated for that card or for the last 30 days (`src/features/coach/brief.ts`). No name,
   email or account id.
2. It calls the `coach` Edge Function (`supabase/functions/coach`), which checks the person is
   signed in and has Pro (trial, Pro or early access, from `get_my_subscription` on the
   server's clock).
3. The function asks **Google Gemini** (free tier, `gemini-3.5-flash-lite` by default). If
   Gemini fails or is over its free limit, it asks **Groq** (`openai/gpt-oss-120b` by default).
4. An answer that quotes a load or calorie figure far from anything in the brief is thrown
   away and the next provider is tried (`inventedFigures` in `_shared/coach.ts`).
   An answer that quotes none of the person's own numbers counts as generic and the next
   provider is tried too (`isSpecific`); a generic answer is shown only when no provider gives
   a personal one. The instructions require their exercises, numbers, goal and exact targets
   for the next session; the chat brief includes the last 6 workouts and the current routine.
5. Nothing is stored on the server. The chat is kept on the phone, per account, for 7 days
   (`src/app/coach.ts`). Explain answers are reused for the rest of the day while the card's
   numbers are unchanged, which saves free quota.

The person turns the coach on once per phone, after reading what is sent and that Google may
use it to improve its products (free tier). Settings has a switch and a Clear button. The
privacy policy has an "AI coach" section.

There is no daily question limit for Pro members. Free limits: Gemini Flash-Lite about 500
requests a day per Google project; Groq's free tier on GPT-OSS 120B about 1,000 a day.

## Setting it up (once)

1. **Gemini key**: aistudio.google.com > Get API key > Create API key. Free tier, no billing.
2. **Groq key**: console.groq.com > API Keys > Create API Key. Free tier.
3. **Supabase secrets**: Project > Edge Functions > Secrets (or `supabase secrets set`):
   `GEMINI_API_KEY`, `GROQ_API_KEY`. Optional: `GEMINI_MODEL`, `GROQ_MODEL` to change models.
   `APP_ORIGIN` is shared with billing (already `https://overloadgym.in`).
4. **Deploy**: `supabase functions deploy coach --no-verify-jwt` (the function checks the
   access token itself, like billing).

With only one key set, the coach uses that provider alone. With none, it says it is not set up.

## Changing models

Groq retires models regularly (Llama 3.3 70B was shut down in August 2026). If answers stop
coming from Groq, check console.groq.com/docs/deprecations and set `GROQ_MODEL` to the
recommended replacement. The same applies to `GEMINI_MODEL`.

## Tests

- Unit: `src/features/coach/coach.test.ts` (Pro check matches the app, request limits,
  invented figures, fallback, provider requests, every brief).
- End to end: `tests/e2e/coach.spec.ts`, against the real handler in the fake Supabase with
  stand-in providers. A question containing `#gemini-down`, `#all-down` or `#invent` steers
  them.
