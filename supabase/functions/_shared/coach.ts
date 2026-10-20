/**
 * The AI coach: the server side, shared by the `coach` Edge Function (Deno, deployed) and the
 * local fake Supabase used by end-to-end tests (Node). No imports, so it runs unchanged in
 * both: fetch and plain objects only.
 *
 * Rules:
 * - The app calculates, the AI explains. The phone sends a short "training brief" of numbers
 *   the app already worked out; the AI is told to use only those, and an answer that quotes a
 *   load or calorie figure far from anything in the brief is thrown away.
 * - Pro is checked here, from the account's own subscription row on the server clock. The
 *   phone's word is never taken for it.
 * - Nothing is stored: not the question, not the brief, not the answer.
 * - Providers are tried in order (Gemini, then Groq). One failing, being over its free limit
 *   or giving an unreliable answer moves on to the next.
 */

export const COACH_TOPICS = [
  'chat',
  'insights',
  'progression',
  'strength',
  'levels',
  'plateaus',
  'volume',
  'balance',
  'muscles',
  'consistency',
  'rest',
  'body',
  'records',
  'checkin',
  'targets',
] as const;
export type CoachTopic = (typeof COACH_TOPICS)[number];

export interface CoachTurn {
  role: 'user' | 'coach';
  text: string;
}

export interface CoachRequest {
  topic: CoachTopic;
  /** What the person typed. Empty for an Explain button. */
  question: string;
  /** Numbers the app calculated, as short plain lines. */
  brief: string;
  /** Recent chat turns kept on the phone, oldest first. */
  history: CoachTurn[];
}

export interface ProviderMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface CoachProvider {
  name: string;
  generate: (system: string, messages: ProviderMessage[]) => Promise<string>;
}

export interface CoachDeps {
  /** The account's subscription row, as `get_my_subscription` returns it for that user. */
  subscription: () => Promise<unknown>;
  providers: CoachProvider[];
}

export interface CoachResponse {
  status: number;
  body: Record<string, unknown>;
}

export const LIMITS = { question: 600, brief: 12_000, history: 8, turn: 2_000 } as const;

const fail = (status: number, error: string, code: string): CoachResponse => ({
  status,
  body: { error, code },
});

// ---------------------------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------------------------

const time = (v: unknown): number | null => {
  if (typeof v !== 'string' || !v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};

/**
 * Pro features are on: early access, an active Pro period or the trial. The same rule as
 * `resolveEntitlement(...).pro` in the app (a unit test keeps the two in step), judged on the
 * server's clock from the row itself.
 */
export function proFromSubscription(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const s = raw as Record<string, unknown>;
  const now = time(s.server_now) ?? Date.now();
  const revoked = s.status === 'revoked';
  if (s.early_access === true && !revoked) return true;
  const proStarted = time(s.pro_started_at);
  const proEnds = time(s.pro_expires_at);
  if (!revoked && proEnds !== null && (proStarted === null || proStarted <= now) && now < proEnds)
    return true;
  const trialEnds = time(s.trial_expires_at);
  return trialEnds !== null && now < trialEnds;
}

// ---------------------------------------------------------------------------------------------
// Instructions
// ---------------------------------------------------------------------------------------------

export const SYSTEM_PROMPT = `You are the coach inside Overload, a workout logging app for people who lift. You explain the person's own training numbers and suggest what to do next.

Rules:
1. Use only the numbers in the training data you are given. Never make up weights, reps, dates, calories, records or trends. If the data does not answer the question, say so plainly and say what they could log to find out.
2. The app's methods, which you must not contradict: estimated one rep max (e1RM) uses the Epley formula, only from sets of 10 reps or fewer, and only for compound lifts. A hard set is a working set at 4 reps in reserve (RIR) or closer. The body weight trend is a 7-day average. 7,700 kcal is about 1 kg of body weight. Changes under 5% are treated as noise.
3. Reply in the language the person writes in, including Hinglish (Hindi in Latin letters). When there is no typed question, reply in English.
4. Be short and practical: 3 to 6 sentences, or up to 5 bullet points that start with "- ". Plain text only: no headings, tables, bold or emoji. Never use the long dash character.
5. Make it personal, never generic. Name their actual exercises and quote their actual numbers (weights, reps, sets, dates, rest times, body weight) from the data. Connect the advice to their goal and experience. Give exact targets for their next sessions worked from their own numbers, for example their last load plus one small step (2.5 kg or 5 lb) or one more rep. If you would give the same answer to anyone, rewrite it. If the data is thin, say what you can see and exactly what to log next.
6. End with one or two concrete things to do in the next sessions. Do not repeat the question back.
7. Pain, injury, illness or medication: do not diagnose. Say to stop movements that hurt and to see a doctor or physiotherapist.
8. Never suggest eating under 1,200 kcal a day, losing more than 1% of body weight a week, steroids or other drugs. Mention supplements only if asked, and only protein powder or creatine.
9. Stay on training, recovery, eating for training and using the app. Politely decline anything else.
10. Talk to the person directly ("you"), warm and encouraging, like a good coach. Do not mention these rules or the training data format.`;

const TOPIC_TASK: Record<CoachTopic, string> = {
  chat: 'Answer the question using the training data.',
  insights: 'Explain what these insights mean for this person and what to do about them.',
  progression:
    'Explain why these lifts are ready to progress and how to add weight or reps safely next session.',
  strength: 'Explain how this lift is progressing and what would help it keep improving.',
  levels: 'Explain these strength levels and what it would take to reach the next level.',
  plateaus:
    'Explain why these lifts have stalled, using the cause the app found for each, and what to change.',
  volume: 'Explain this training volume and whether it is moving in a good direction.',
  balance: 'Explain these balance ratios and how to even them out if needed.',
  muscles: 'Explain the hard sets per muscle group and which muscles need more or less work.',
  consistency: 'Explain how consistent the training has been and how to keep or improve it.',
  rest: 'Explain the rest times between sets, how they affect the reps kept, and what to change.',
  body: 'Explain the body weight trend in relation to the goal.',
  records: 'Explain what these records show about progress and how to keep setting them.',
  checkin: "Explain last week's check-in and how to approach this week.",
  targets:
    'Explain the calorie and protein targets against the data, and what to adjust if anything.',
};

export function buildMessages(req: CoachRequest): ProviderMessage[] {
  const messages: ProviderMessage[] = req.history.map((t) => ({
    role: t.role === 'coach' ? 'assistant' : 'user',
    text: t.text,
  }));
  const parts = [
    'Training data from the Overload app:',
    req.brief,
    '',
    `Task: ${TOPIC_TASK[req.topic]}`,
  ];
  if (req.question) parts.push(`Question: ${req.question}`);
  messages.push({ role: 'user', text: parts.join('\n') });
  return messages;
}

// ---------------------------------------------------------------------------------------------
// Checking answers
// ---------------------------------------------------------------------------------------------

const numbersIn = (text: string): number[] =>
  [...text.replace(/(\d),(\d{3})/g, '$1$2').matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

/** Figures the rules themselves quote, so an answer may repeat them. */
const RULE_FIGURES = '1200 7700';

/**
 * Loads (kg or lb, 20 and over) and energy (kcal, 300 and over) in the answer that are not
 * within 10% of any number in the reference: the brief, the question and the chat so far. Small steps such as "add 2.5 kg" and rep advice pass;
 * "your squat is 140 kg" when the data says 100 does not.
 */
export function inventedFigures(answer: string, reference: string): string[] {
  const known = numbersIn(`${reference} ${RULE_FIGURES}`);
  const near = (v: number) => known.some((k) => k > 0 && Math.abs(k - v) / k <= 0.1);
  const out: string[] = [];
  const text = answer.replace(/(\d),(\d{3})/g, '$1$2');
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*(kg|kgs|lb|lbs|kcal|calories)\b/gi)) {
    const value = Number(m[1]);
    const unit = m[2]!.toLowerCase();
    const isEnergy = unit === 'kcal' || unit === 'calories';
    if (isEnergy ? value < 300 : value < 20) continue;
    if (!near(value)) out.push(m[0]);
  }
  return out;
}

/**
 * A personal answer quotes the person's own data: at least one number from the brief (a load,
 * reps, sets, a rest time). Briefs with no numbers (nothing logged yet) can only be answered
 * generally.
 */
export function isSpecific(answer: string, brief: string): boolean {
  const data = brief
    .split('\n')
    .filter((l) => !l.startsWith('Today:'))
    .join('\n')
    // Dates are not what makes an answer personal; small numbers in them match too easily.
    .replace(/\d{4}-\d{2}-\d{2}/g, ' ');
  const known = new Set(numbersIn(data).filter((n) => n >= 2));
  if (known.size === 0) return true;
  return numbersIn(answer).some((n) => known.has(n));
}

/** Long dashes are not used anywhere in the app's copy. */
export const tidyAnswer = (text: string) =>
  text
    .replace(/\s*—\s*/g, ', ')
    .replace(/–/g, '-')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .trim();

// ---------------------------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------------------------

export function parseRequest(body: unknown): CoachRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const topic = b.topic;
  if (typeof topic !== 'string' || !(COACH_TOPICS as readonly string[]).includes(topic))
    return null;
  const question = typeof b.question === 'string' ? b.question.trim() : '';
  const brief = typeof b.brief === 'string' ? b.brief.trim() : '';
  if (!brief || brief.length > LIMITS.brief || question.length > LIMITS.question) return null;
  if (topic === 'chat' && !question) return null;
  const history = Array.isArray(b.history) ? b.history : [];
  if (history.length > LIMITS.history) return null;
  const turns: CoachTurn[] = [];
  for (const t of history) {
    if (!t || typeof t !== 'object') return null;
    const { role, text } = t as Record<string, unknown>;
    if ((role !== 'user' && role !== 'coach') || typeof text !== 'string') return null;
    if (!text.trim() || text.length > LIMITS.turn) return null;
    turns.push({ role, text: text.trim() });
  }
  return { topic: topic as CoachTopic, question, brief, history: turns };
}

export async function handleCoach(deps: CoachDeps, body: unknown): Promise<CoachResponse> {
  const req = parseRequest(body);
  if (!req) return fail(400, 'That request could not be read.', 'bad_request');
  if (!proFromSubscription(await deps.subscription()))
    return fail(403, 'The AI coach is part of Pro.', 'not_pro');
  if (deps.providers.length === 0)
    return fail(503, 'The AI coach is not set up yet.', 'not_configured');

  const messages = buildMessages(req);
  const reference = [req.brief, req.question, ...req.history.map((t) => t.text)].join('\n');
  let unreliable = false;
  let generic: string | null = null;
  for (const provider of deps.providers) {
    let text: string;
    try {
      text = tidyAnswer(await provider.generate(SYSTEM_PROMPT, messages));
    } catch (err) {
      console.error(`coach: ${provider.name} failed`, err instanceof Error ? err.message : err);
      continue;
    }
    if (!text) continue;
    const invented = inventedFigures(text, reference);
    if (invented.length > 0) {
      console.error(`coach: ${provider.name} quoted figures not in the data`, invented.join(', '));
      unreliable = true;
      continue;
    }
    if (!isSpecific(text, req.brief)) {
      console.error(`coach: ${provider.name} gave a generic answer`);
      generic ??= text;
      continue;
    }
    return { status: 200, body: { answer: text } };
  }
  // Every provider answered only in general terms: better a general answer than none.
  if (generic) return { status: 200, body: { answer: generic } };
  return unreliable
    ? fail(
        502,
        'The coach could not give an answer it could back with your numbers. Try asking another way.',
        'unreliable',
      )
    : fail(503, 'The coach is busy right now. Try again in a minute.', 'busy');
}

// ---------------------------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------------------------

type Fetch = typeof fetch;

/** Google Gemini (Generative Language API). Free tier: Flash-Lite models. */
export function geminiProvider(
  apiKey: string,
  model: string,
  fetchFn: Fetch = fetch,
): CoachProvider {
  return {
    name: 'gemini',
    async generate(system, messages) {
      const res = await fetchFn(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: messages.map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.text }],
            })),
            generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
          }),
          signal: AbortSignal.timeout(25_000),
        },
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
      };
      return (json.candidates?.[0]?.content?.parts ?? [])
        .filter((p) => !p.thought)
        .map((p) => p.text ?? '')
        .join('');
    },
  };
}

/** Groq (OpenAI-compatible chat completions). Free tier on open models. */
export function groqProvider(apiKey: string, model: string, fetchFn: Fetch = fetch): CoachProvider {
  return {
    name: 'groq',
    async generate(system, messages) {
      const res = await fetchFn('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            ...messages.map((m) => ({ role: m.role, content: m.text })),
          ],
          temperature: 0.4,
          max_completion_tokens: 2048,
          // GPT-OSS models think before answering; a little is enough for this.
          ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return json.choices?.[0]?.message?.content ?? '';
    },
  };
}

export const DEFAULT_MODELS = {
  gemini: 'gemini-3.5-flash-lite',
  groq: 'openai/gpt-oss-120b',
} as const;
