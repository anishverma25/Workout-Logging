# OverloadGPT (the AI coach)

Users see the AI coach as **OverloadGPT**. Code, the route `/coach`, the Pro feature
`ai_coach` and the `coach` Edge Function keep their names. Since food logging, the chat brief
and the targets Explain include food lines (averages, today, real maintenance, diet).

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
3. The function asks **Claude** first (November 2026, when `ANTHROPIC_API_KEY` is set), then
   **Google Gemini** (free tier, `gemini-3.5-flash-lite` by default), then **Groq**
   (`openai/gpt-oss-120b` by default), each when the one before fails, is over its limit or
   gives an answer that fails the checks. Claude uses a model per feature (see "Claude" below).
4. An answer that quotes a load or calorie figure far from anything in the brief is thrown
   away and the next provider is tried (`inventedFigures` in `_shared/coach.ts`).
   An answer that quotes none of the person's own numbers counts as generic and the next
   provider is tried too (`isSpecific`); a generic answer is shown only when no provider gives
   a personal one. The instructions require their exercises, numbers, goal and exact targets
   for the next session; the chat brief includes the last 6 workouts and the current routine.
5. **Speed.** If the first provider has not answered in time (`HEDGE_MS`: 3 s for chat, 7 s for
   typed food, 10 s for photos and labels; Claude gets `CLAUDE_HEDGE_MS`: 8 s for chat, 12 s for
   the rest, so it answers almost every time and a fallback still fits the app's 30 s wait), the
   next is asked as well, and the first answer that passes every check wins; a failure moves on
   at once (`hedged`, `HEDGE_MS`). Opening OverloadGPT or the food screen sends `{ kind: 'warm' }`
   so the function is already running when the question comes (`src/app/aiWarm.ts`), and the
   function reads the subscription while it checks the user. This can use a second request
   when Gemini is slow; the free limits below allow for it.
6. **Language.** The reply language follows the question: English in, English out; Hinglish
   in, Hinglish out; Devanagari Hindi in, Hindi out (`replyLanguage`, a "Reply in" line in the
   request). An answer in the wrong language is set aside and the next provider is tried
   (`answerLanguageOk`).
7. Nothing is stored on the server. The chat is kept on the phone, per account, for 7 days
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
   `APP_ORIGIN` is shared with billing: a comma-separated list, `https://macrotrophy.in,https://overloadgym.in`.
4. **Deploy**: `supabase functions deploy coach --no-verify-jwt` (the function checks the
   access token itself, like billing).

With only one key set, the coach uses that provider alone. With none, it says it is not set up.

## Claude (November 2026)

Claude is the first provider whenever `ANTHROPIC_API_KEY` is set; Gemini and Groq stay behind
it, so a Claude outage, an expired key or a spent limit only means the old providers answer.
Each feature has its own model, set in Supabase Edge Function secrets (no deploy needed to
change one):

| Secret                  | Used for                                      | Default             |
| ----------------------- | --------------------------------------------- | ------------------- |
| `ANTHROPIC_CHAT_MODEL`  | Macrotrophy AI chat and Explain               | `claude-haiku-5-5`  |
| `ANTHROPIC_FOOD_MODEL`  | Ask AI (typed food, with Claude's web search) | `claude-haiku-5-5`  |
| `ANTHROPIC_LABEL_MODEL` | Label reading                                 | `claude-haiku-5-5`  |
| `ANTHROPIC_PHOTO_MODEL` | AI snap (plate photos)                        | `claude-sonnet-5-5` |
| `ANTHROPIC_MENU_MODEL`  | Read a menu                                   | the label model     |

- Code: `claudeProvider` and `claudeMessages` in `_shared/coach.ts`; each handler passes a
  `purpose` so the provider picks the model. The function logs which provider answered
  ("coach: answered by claude", "food: answered by claude with a web search"), visible in
  Supabase, Edge Functions, coach, Logs.
- Web search uses Claude's server tool (`web_search_20250305`, at most 3 searches). It must be
  allowed for the organisation in the Claude Console and costs extra per search. When it is not
  allowed the request is sent again without search, and foods are labelled "Estimated", not
  "From the web".
- Labels and menus are hedged like photos now (they used to wait for each provider in turn,
  which made label reads end in "That took too long").
- A model that refuses a temperature is asked again without one.
- Costs are paid: keep a monthly spend limit on the workspace in the Claude Console. Keys can
  expire: replace `ANTHROPIC_API_KEY` before its end date (until then nothing breaks, the
  fallbacks answer).

## Changing models

Groq retires models regularly (Llama 3.3 70B was shut down in August 2026). If answers stop
coming from Groq, check console.groq.com/docs/deprecations and set `GROQ_MODEL` to the
recommended replacement. The same applies to `GEMINI_MODEL`.

## Tests

- Unit: `src/features/coach/coach.test.ts` (Pro check matches the app, request limits,
  invented figures, fallback, provider requests, every brief) and
  `src/features/coach/claude.test.ts` (Claude requests, models per feature, web search,
  fallback order, patience, labels).
- End to end: `tests/e2e/coach.spec.ts`, against the real handler in the fake Supabase with
  stand-in providers. A question containing `#gemini-down`, `#all-down` or `#invent` steers
  them.
