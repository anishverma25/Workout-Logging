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
  /** A photo sent with the message (base64, no data: prefix). */
  image?: { mime: string; data: string };
}

export interface GenerateOptions {
  /** Let the model look things up on the web (Gemini Google Search, Groq browser search). */
  search?: boolean;
  /**
   * Told whether a web search really ran for the answer: false when search was not available
   * (free keys, over the allowance) and the request went again without it.
   */
  onSearch?: (searched: boolean) => void;
}

export interface CoachProvider {
  name: string;
  generate: (
    system: string,
    messages: ProviderMessage[],
    options?: GenerateOptions,
  ) => Promise<string>;
}

export interface CoachDeps {
  /** The account's subscription row, as `get_my_subscription` returns it for that user. */
  subscription: () => Promise<unknown>;
  providers: CoachProvider[];
  /**
   * Takes one of today's photo analyses for this account and returns how many are left, or -1
   * when none are (the `claim_ai_use` function). `release` gives one back after a failure.
   */
  photoQuota?: { claim: () => Promise<number>; release: () => Promise<void> };
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

export const SYSTEM_PROMPT = `You are OverloadGPT, the assistant inside Overload, a workout and food logging app for people in India who lift. You explain the person's own training and food numbers and suggest what to do next.

Rules:
1. Use only the numbers in the training data you are given. Never make up weights, reps, dates, calories, records or trends. If the data does not answer the question, say so plainly and say what they could log to find out.
2. The app's methods, which you must not contradict: estimated one rep max (e1RM) uses the Epley formula, only from sets of 10 reps or fewer, and only for compound lifts. A hard set is a working set at 4 reps in reserve (RIR) or closer. The body weight trend is a 7-day average. 7,700 kcal is about 1 kg of body weight. Changes under 5% are treated as noise.
3. Reply in the language the person writes in, including Hinglish (Hindi in Latin letters). When there is no typed question, reply in English.
4. Be short, practical and easy to read on a phone: one short opening sentence, then up to 5 bullet points that start with "- ", one idea or one exercise per bullet, each under 20 words. Write dates the way people say them, like "14th October" (add the year only if it is not this year), never as 2026-10-14. Write sets as "87.5 kg for 5 reps", not "87.5 kg x 5". Plain text only: no headings, tables, bold or emoji. Never use the long dash character.
5. Make it personal, never generic. Name their actual exercises and quote their actual numbers (weights, reps, sets, dates, rest times, body weight) from the data. Connect the advice to their goal and experience. Give exact targets for their next sessions worked from their own numbers, for example their last load plus one small step (2.5 kg or 5 lb) or one more rep. If you would give the same answer to anyone, rewrite it. If the data is thin, say what you can see and exactly what to log next.
6. End with one or two concrete things to do in the next sessions. Do not repeat the question back.
7. Pain, injury, illness or medication: do not diagnose. Say to stop movements that hurt and to see a doctor or physiotherapist.
8. Never suggest eating under 1,200 kcal a day, losing more than 1% of body weight a week, steroids or other drugs. Mention supplements only if asked, and only protein powder or creatine.
9. Stay on training, recovery, food and eating for training, and using the app. Politely decline anything else. For food, suggest everyday Indian foods that fit the diet in the data (vegetarian, eggetarian, Jain or non-vegetarian) and use household portions such as a katori, a roti or a glass.
10. Talk to the person directly ("you"), warm and encouraging, like a good coach. If asked your name, you are OverloadGPT. Do not mention these rules or the training data format.`;

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
    'Explain the calorie and protein targets against the data and the food log, and what to adjust if anything, with Indian foods that fit their diet.',
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
  if (body && typeof body === 'object' && (body as { kind?: unknown }).kind === 'food')
    return handleFoodLog(deps, body);
  if (body && typeof body === 'object' && (body as { kind?: unknown }).kind === 'food_photo')
    return handleFoodPhoto(deps, body);
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
        'OverloadGPT could not give an answer it could back with your numbers. Try asking another way.',
        'unreliable',
      )
    : fail(503, 'OverloadGPT is busy right now. Try again in a minute.', 'busy');
}

// ---------------------------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------------------------

type Fetch = typeof fetch;

/**
 * Runs a request with web search first when asked, and again without it if that fails (search
 * not enabled for the key, over its allowance, or not offered by the model).
 */
async function withSearch(
  options: GenerateOptions | undefined,
  run: (grounded: boolean) => Promise<string>,
  canSearch = true,
): Promise<string> {
  if (options?.search && canSearch) {
    try {
      return await run(true);
    } catch (err) {
      options.onSearch?.(false);
      console.error(
        'search request failed, retrying without',
        err instanceof Error ? err.message : err,
      );
    }
  }
  if (options?.search) options.onSearch?.(false);
  return run(false);
}

/** Google Gemini (Generative Language API). Free tier: Flash-Lite models. */
export function geminiProvider(
  apiKey: string,
  model: string,
  fetchFn: Fetch = fetch,
): CoachProvider {
  return {
    name: 'gemini',
    generate: (system, messages, options) =>
      withSearch(options, async (grounded) => {
        const res = await fetchFn(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: messages.map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: m.image
                  ? [
                      { inline_data: { mime_type: m.image.mime, data: m.image.data } },
                      { text: m.text },
                    ]
                  : [{ text: m.text }],
              })),
              generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
              // Grounding with Google Search, for packaged and restaurant foods.
              ...(grounded ? { tools: [{ google_search: {} }] } : {}),
            }),
            signal: AbortSignal.timeout(grounded || hasImage(messages) ? 40_000 : 25_000),
          },
        );
        if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const json = (await res.json()) as {
          candidates?: {
            content?: { parts?: { text?: string; thought?: boolean }[] };
            groundingMetadata?: { webSearchQueries?: string[]; groundingChunks?: unknown[] };
          }[];
        };
        if (grounded) {
          const g = json.candidates?.[0]?.groundingMetadata;
          options?.onSearch?.(Boolean(g?.webSearchQueries?.length || g?.groundingChunks?.length));
        }
        return (json.candidates?.[0]?.content?.parts ?? [])
          .filter((p) => !p.thought)
          .map((p) => p.text ?? '')
          .join('');
      }),
  };
}

/** Groq (OpenAI-compatible chat completions). Free tier on open models. */
export function groqProvider(
  apiKey: string,
  model: string,
  fetchFn: Fetch = fetch,
  visionModel: string = DEFAULT_MODELS.groqVision,
): CoachProvider {
  return {
    name: 'groq',
    generate: (system, messages, options) => {
      // GPT-OSS cannot see images, so a photo goes to Groq's vision model instead.
      const photo = hasImage(messages);
      const use = photo ? visionModel : model;
      const gptOss = use.startsWith('openai/gpt-oss');
      return withSearch(
        options,
        async (grounded) => {
          const res = await fetchFn('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: use,
              messages: [
                { role: 'system', content: system },
                ...messages.map((m) => ({
                  role: m.role,
                  content: m.image
                    ? [
                        { type: 'text', text: m.text },
                        {
                          type: 'image_url',
                          image_url: { url: `data:${m.image.mime};base64,${m.image.data}` },
                        },
                      ]
                    : m.text,
                })),
              ],
              temperature: 0.4,
              max_completion_tokens: 2048,
              // GPT-OSS models think before answering; a little is enough for this.
              ...(gptOss ? { reasoning_effort: 'low' } : {}),
              // Groq's built-in browser search, offered on GPT-OSS models.
              ...(grounded ? { tools: [{ type: 'browser_search' }], tool_choice: 'auto' } : {}),
            }),
            signal: AbortSignal.timeout(grounded || photo ? 40_000 : 25_000),
          });
          if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
          const json = (await res.json()) as {
            choices?: { message?: { content?: string; executed_tools?: unknown[] } }[];
          };
          if (grounded)
            options?.onSearch?.(Boolean(json.choices?.[0]?.message?.executed_tools?.length));
          // Reasoning models may write their thinking in <think> tags before the answer.
          return (json.choices?.[0]?.message?.content ?? '').replace(
            /<think>[\s\S]*?<\/think>/g,
            '',
          );
        },
        gptOss,
      );
    },
  };
}

const hasImage = (messages: ProviderMessage[]) => messages.some((m) => m.image);

export const DEFAULT_MODELS = {
  gemini: 'gemini-3.5-flash-lite',
  groq: 'openai/gpt-oss-120b',
  /** Groq's model that can see images (Qwen 3.8, up to 3 images, 2,048 tokens each). */
  groqVision: 'qwen/qwen3.8-27b',
} as const;

// ---------------------------------------------------------------------------------------------
// AI food logging (Pro)
// ---------------------------------------------------------------------------------------------

/**
 * The person describes what they ate in their own words ("2 aloo parathas with curd and a
 * Starbucks cold coffee"); the AI splits it into foods with a weight and nutrients, looking up
 * branded and restaurant items on the web. This is the one place the AI gives numbers, so
 * every item is checked here and the app labels them as OverloadGPT estimates.
 */

export const FOOD_LIMITS = { text: 500, items: 15 } as const;

export interface FoodItem {
  name: string;
  /** How the person would say the portion: "2 parathas", "1 katori", "1 tall cup". */
  portion: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
  diet: 'veg' | 'egg' | 'nonveg';
  /**
   * "web" when a label or menu was found, "estimate" when worked out from a typical recipe,
   * "photo" when read from a photo, "label" when a nutrition label in the photo was read,
   * "yours" when the person typed the numbers themselves.
   */
  basis: 'web' | 'estimate' | 'photo' | 'label' | 'yours';
  /** For photos: how sure the AI is about the food and the amount. */
  confidence?: 'high' | 'medium' | 'low';
  /** Where the numbers came from, as a short name ("Starbucks India menu"). */
  ref: string;
}

export const FOOD_PROMPT = `You are OverloadGPT inside Overload, a food logging app used in India. The person tells you what they ate. Split it into separate foods and give each one's weight and nutrients for the portion they ate.

Rules:
1. Reply with JSON only: an array of objects with these keys: "name" (short food name in English, for example "Aloo paratha"), "portion" (the amount the way they said it, for example "2 parathas" or "1 katori"), "grams" (weight of that portion in grams, as eaten), "kcal", "protein_g", "carbs_g", "fat_g", "fibre_g" (all for that portion), "diet" ("veg", "egg" or "nonveg"), "basis" ("web" if you found the product, menu or label values, otherwise "estimate"), "ref" (where the values come from, a few words, for example "Amul label" or "typical home recipe").
2. For packaged foods, brands, supplements and restaurant or delivery items, search the web for the label or the brand's published nutrition and use it. For home food, use a typical Indian home recipe and Indian household portions: a katori is about 150 g of dal or sabzi, a roti about 40 g, a paratha 80 to 100 g, a glass 250 ml, a cup of chai 120 ml.
3. When no amount is given, use one normal portion.
4. Energy must agree with the macronutrients: about 4 kcal per g of protein and carbs and 9 per g of fat.
5. Never invent a food they did not mention. If something is not a food, leave it out. If nothing is a food, reply [].
6. Write the names in English even when the message is in Hindi or Hinglish.
7. When the person gives a weight, calories or grams of protein, carbs, fat or fibre for a food, use exactly their numbers for that food and work out only what they did not give.
8. Set "basis" to "web" only when you actually found the values on the web in this answer.`;

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v)
    ? v
    : typeof v === 'string' && v.trim() && Number.isFinite(Number(v))
      ? Number(v)
      : null;

/** The first JSON array in a model answer (models sometimes wrap it in a code block or text). */
export function parseFoodJson(text: string): unknown[] | null {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) return null;
  try {
    const v = JSON.parse(text.slice(start, end + 1)) as unknown;
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

const NOT_A_FOOD =
  /^(?:\d+\s*)?(?:g|gm|grams?)?\s*(?:of\s+)?(?:protein|carbs?|carbohydrates?|fats?|fib(?:re|er)|calories|kcal|cals?)$/i;

/** What the person typed about one food: its words and any numbers they gave. */
export interface StatedFood {
  words: string[];
  grams?: number;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fibreG?: number;
}

const NUM = String.raw`(\d+(?:\.\d+)?)`;
const NUTRIENT: [keyof StatedFood, string][] = [
  ['proteinG', 'protein'],
  ['carbsG', 'carbs?|carbohydrates?'],
  ['fatG', 'fats?'],
  ['fibreG', 'fib(?:re|er)'],
];

/**
 * The numbers a person typed, food by food: "200 g paneer 36 g protein, whey 1 scoop 120 kcal
 * 24g protein". Foods are split at commas, semicolons, new lines, "and" and "+". Grams, ml (as
 * grams) and kg are the weight; "g protein", "protein 24 g" and the like are nutrients.
 */
export function parseStated(text: string): StatedFood[] {
  return (
    text
      .split(/[,;\n+]|\band\b|\baur\b/i)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
      .map((part) => {
        const out: StatedFood = { words: [] };
        let rest = part;
        for (const [key, word] of NUTRIENT) {
          const re = new RegExp(
            String.raw`${NUM}\s*(?:g|gm|gms|grams?)?\s*(?:of\s+)?(?:${word})\b|(?:${word})\s*(?:of|:|-)?\s*${NUM}\s*(?:g|gm|gms|grams?)?`,
          );
          const m = re.exec(rest);
          if (m) {
            (out as unknown as Record<string, number>)[key] = Number(m[1] ?? m[2]);
            rest = rest.replace(m[0], ' ');
          }
        }
        const kcal = new RegExp(
          String.raw`${NUM}\s*(?:kcal|cal|calories|cals)\b|(?:calories|kcal)\s*(?:of|:|-)?\s*${NUM}`,
        ).exec(rest);
        if (kcal) {
          out.kcal = Number(kcal[1] ?? kcal[2]);
          rest = rest.replace(kcal[0], ' ');
        }
        const weight = new RegExp(String.raw`${NUM}\s*(kg|g|gm|gms|grams?|ml)\b`).exec(rest);
        if (weight) {
          out.grams = Number(weight[1]) * (weight[2] === 'kg' ? 1000 : 1);
          rest = rest.replace(weight[0], ' ');
        }
        out.words = rest
          .replace(/[^a-z\s]/g, ' ')
          .split(/\s+/)
          .filter(
            (w) =>
              w.length > 2 && !['with', 'the', 'some', 'had', 'ate', 'scoop', 'scoops'].includes(w),
          );
        return out;
      })
      // Numbers after a comma with no food named ("200 g paneer, 36 g protein") belong to the
      // food before them.
      .reduce<StatedFood[]>((list, part) => {
        const prev = list[list.length - 1];
        if (part.words.length === 0 && prev) {
          for (const [k, v] of Object.entries(part))
            if (k !== 'words' && (prev as unknown as Record<string, unknown>)[k] === undefined)
              (prev as unknown as Record<string, unknown>)[k] = v;
        } else list.push(part);
        return list;
      }, [])
  );
}

const hasNumbers = (s: StatedFood) =>
  s.grams !== undefined ||
  s.kcal !== undefined ||
  s.proteinG !== undefined ||
  s.carbsG !== undefined ||
  s.fatG !== undefined ||
  s.fibreG !== undefined;

/**
 * Puts the person's own numbers on the foods the AI found, matched by name: their weight scales
 * the food, their calories and macros replace the AI's, and when their calories leave less
 * room than the AI's carbs and fat need, those shrink to fit. Such foods are marked "yours".
 */
export function applyStated(items: FoodItem[], stated: StatedFood[]): FoodItem[] {
  const withNumbers = stated.filter(hasNumbers);
  if (withNumbers.length === 0) return items;
  const used = new Set<number>();
  const out = items.slice();
  for (const st of withNumbers) {
    let best = -1;
    let bestScore = 0;
    out.forEach((item, i) => {
      if (used.has(i)) return;
      const name = item.name.toLowerCase();
      const score = st.words.filter(
        (w) => name.includes(w) || name.includes(w.replace(/s$/, '')),
      ).length;
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    });
    // One food typed and one food found: they are the same, even without a shared word.
    if (best === -1 && withNumbers.length === 1 && out.length === 1) best = 0;
    if (best === -1) continue;
    used.add(best);
    const item = out[best]!;
    const factor = st.grams !== undefined && item.grams > 0 ? st.grams / item.grams : 1;
    const round = (v: number) => Math.round(v * 10) / 10;
    let next: FoodItem = {
      ...item,
      grams: st.grams !== undefined ? Math.round(st.grams) : item.grams,
      portion: st.grams !== undefined ? `${Math.round(st.grams)} g` : item.portion,
      kcal: Math.round(st.kcal ?? item.kcal * factor),
      proteinG: round(st.proteinG ?? item.proteinG * factor),
      carbsG: round(st.carbsG ?? item.carbsG * factor),
      fatG: round(st.fatG ?? item.fatG * factor),
      fibreG: round(st.fibreG ?? item.fibreG * factor),
    };
    if (st.kcal !== undefined) {
      // Their calories stand; macros they did not give shrink to fit what is left.
      const fixed =
        4 * (st.proteinG !== undefined ? next.proteinG : 0) +
        4 * (st.carbsG !== undefined ? next.carbsG : 0) +
        9 * (st.fatG !== undefined ? next.fatG : 0);
      const free =
        4 * (st.proteinG === undefined ? next.proteinG : 0) +
        4 * (st.carbsG === undefined ? next.carbsG : 0) +
        9 * (st.fatG === undefined ? next.fatG : 0);
      const room = Math.max(0, next.kcal - fixed);
      if (free > room && free > 0) {
        const k = room / free;
        next = {
          ...next,
          proteinG: st.proteinG === undefined ? round(next.proteinG * k) : next.proteinG,
          carbsG: st.carbsG === undefined ? round(next.carbsG * k) : next.carbsG,
          fatG: st.fatG === undefined ? round(next.fatG * k) : next.fatG,
          fibreG: st.fibreG === undefined ? round(Math.min(next.fibreG, next.carbsG)) : next.fibreG,
        };
      }
    }
    out[best] = { ...next, basis: 'yours', ref: 'Your numbers' };
  }
  return out;
}

/**
 * One item, checked: a real weight, no more than 9.5 kcal a gram (pure fat is 9), macros that
 * fit in the weight, and energy within 30% of what the macros add up to. Anything else is
 * dropped rather than shown.
 */
export function checkFoodItem(raw: unknown): FoodItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.trim().replace(/\s+/g, ' ').slice(0, 60) : '';
  const portion = typeof r.portion === 'string' ? r.portion.trim().slice(0, 40) : '';
  const grams = num(r.grams);
  const kcal = num(r.kcal);
  const p = num(r.protein_g) ?? 0;
  const c = num(r.carbs_g) ?? 0;
  const f = num(r.fat_g) ?? 0;
  const fib = num(r.fibre_g ?? r.fiber_g) ?? 0;
  if (!name || grams === null || kcal === null) return null;
  if (grams < 1 || grams > 2000 || kcal < 0 || p < 0 || c < 0 || f < 0 || fib < 0) return null;
  if (kcal > grams * 9.5) return null;
  if (p + c + f > grams * 1.05) return null;
  const macros = 4 * p + 4 * Math.max(0, c - fib) + 2 * Math.min(fib, c) + 9 * f;
  if (kcal >= 20 && Math.abs(macros - kcal) / kcal > 0.3) return null;
  if (kcal < 20 && macros > 40) return null;
  const diet = r.diet === 'egg' || r.diet === 'nonveg' ? r.diet : 'veg';
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    portion: portion || `${Math.round(grams)} g`,
    grams: Math.round(grams),
    kcal: Math.round(kcal),
    proteinG: round(p),
    carbsG: round(c),
    fatG: round(f),
    fibreG: round(fib),
    diet,
    basis:
      r.basis === 'web' || r.basis === 'photo' || r.basis === 'label' || r.basis === 'yours'
        ? (r.basis as FoodItem['basis'])
        : 'estimate',
    ...(r.confidence === 'high' || r.confidence === 'medium' || r.confidence === 'low'
      ? { confidence: r.confidence }
      : {}),
    ref: typeof r.ref === 'string' ? tidyAnswer(r.ref).slice(0, 60) : '',
  };
}

export async function handleFoodLog(deps: CoachDeps, body: unknown): Promise<CoachResponse> {
  const b = body as Record<string, unknown>;
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  if (!text || text.length > FOOD_LIMITS.text)
    return fail(400, 'That request could not be read.', 'bad_request');
  const diet = typeof b.diet === 'string' ? b.diet.slice(0, 10) : '';
  if (!proFromSubscription(await deps.subscription()))
    return fail(403, 'AI food logging is part of Pro.', 'not_pro');
  if (deps.providers.length === 0)
    return fail(503, 'AI food logging is not set up yet.', 'not_configured');

  const messages: ProviderMessage[] = [
    {
      role: 'user',
      text: `${diet ? `The person eats ${diet} food.\n` : ''}What they ate: ${text}`,
    },
  ];
  let empty = false;
  const stated = parseStated(text);
  for (const provider of deps.providers) {
    let answer: string;
    let searched = false;
    try {
      answer = await provider.generate(FOOD_PROMPT, messages, {
        search: true,
        onSearch: (s) => {
          searched = s;
        },
      });
    } catch (err) {
      console.error(`food: ${provider.name} failed`, err instanceof Error ? err.message : err);
      continue;
    }
    const list = parseFoodJson(answer);
    if (!list) {
      console.error(`food: ${provider.name} gave no JSON`);
      continue;
    }
    const checked = list
      .slice(0, FOOD_LIMITS.items)
      .map(checkFoodItem)
      .filter((i): i is FoodItem => i !== null)
      // A nutrient on its own ("30 g protein") is a number about a food, not a food.
      .filter((i) => !NOT_A_FOOD.test(i.name))
      // "From the web" only when a search really ran; otherwise it is the AI's own estimate.
      .map((i) => (i.basis === 'web' && !searched ? { ...i, basis: 'estimate' as const } : i))
      .map((i) => (i.basis === 'yours' ? { ...i, basis: 'estimate' as const } : i));
    // The person's own numbers win over the AI's, food by food.
    const items = applyStated(checked, stated);
    if (items.length === 0) {
      // A clear "nothing here is a food" is an answer; a list where every item failed is not.
      if (list.length === 0) empty = true;
      else console.error(`food: ${provider.name} items failed the checks`);
      continue;
    }
    return { status: 200, body: { items } };
  }
  if (empty) return { status: 200, body: { items: [] } };
  return fail(503, 'OverloadGPT is busy right now. Try again in a minute.', 'busy');
}

// ---------------------------------------------------------------------------------------------
// Photo food logging (Pro)
// ---------------------------------------------------------------------------------------------

/** About 1.1 MB of JPEG once decoded; the app sends photos resized to 1,280 px, well under. */
export const PHOTO_LIMITS = { base64: 1_500_000, note: 300, known: 160, knownName: 60 } as const;
/** Photo analyses per account per day, so a few people cannot use up everyone's AI allowance. */
export const PHOTOS_PER_DAY = 15;

export const FOOD_PHOTO_PROMPT = `You are OverloadGPT inside Overload, a food logging app used in India. You get one photo of food someone is about to eat or has eaten. Work out each food in it and how much of it there is, as accurately as you can.

Method:
1. Look at the whole photo first. List every separate food and drink. Count pieces exactly when you can (rotis, idlis, momos, slices, pieces of chicken). Do not list garnish, cutlery or packaging.
2. Judge amounts from things of known size in the photo: a dinner plate is about 27 cm across, a quarter plate 18 cm, a steel katori holds 150 to 200 ml, a steel glass 250 ml, a tea cup 120 ml, a phulka or roti is 15 to 18 cm and about 35 to 40 g, a slice of bread is about 28 g, a hand is about 18 cm long. Use the depth of curries and rice, not only the area.
3. Look for oil and ghee: a shiny or oily surface, a layer of oil on a curry, fried food. Count that fat in the numbers.
4. If a packaged food shows its nutrition label and you can read it, use the label values for the amount shown and set "basis" to "label".
5. Name foods the way people in India say them, in English (for example "Dal tadka", "Jeera rice", "Paneer butter masala", "Aloo paratha", "Chicken biryani"). When one of the names in the list you are given is the same food, use that exact name.
6. If the person added a note, it is more reliable than the photo for what the food is and how much: follow it.

Reply with JSON only: an array of objects with these keys: "name", "portion" (how much, the way a person would say it, for example "2 rotis" or "1 katori" or "1 plate"), "grams" (weight of that portion as eaten), "kcal", "protein_g", "carbs_g", "fat_g", "fibre_g" (all for that portion), "diet" ("veg", "egg" or "nonveg"), "basis" ("photo" or "label"), "confidence" ("high" when you are sure of both the food and the amount, "medium" when one of them is uncertain, "low" when both are), "ref" (a few words on how you judged the amount, for example "about 1 katori, full"). Energy must agree with the macronutrients: about 4 kcal per g of protein and carbs and 9 per g of fat. If there is no food in the photo, reply [].`;

export async function handleFoodPhoto(deps: CoachDeps, body: unknown): Promise<CoachResponse> {
  const b = body as Record<string, unknown>;
  const image = typeof b.image === 'string' ? b.image : '';
  const mime = b.mime === 'image/png' || b.mime === 'image/webp' ? b.mime : 'image/jpeg';
  if (!image || image.length > PHOTO_LIMITS.base64 || !/^[A-Za-z0-9+/=]+$/.test(image))
    return fail(400, 'That photo could not be read.', 'bad_request');
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, PHOTO_LIMITS.note) : '';
  const diet = typeof b.diet === 'string' ? b.diet.slice(0, 10) : '';
  const known = Array.isArray(b.known)
    ? b.known
        .filter((k): k is string => typeof k === 'string')
        .map((k) => k.slice(0, PHOTO_LIMITS.knownName))
        .slice(0, PHOTO_LIMITS.known)
    : [];
  if (!proFromSubscription(await deps.subscription()))
    return fail(403, 'Photo food logging is part of Pro.', 'not_pro');
  if (deps.providers.length === 0)
    return fail(503, 'Photo food logging is not set up yet.', 'not_configured');
  const left = deps.photoQuota ? await deps.photoQuota.claim() : PHOTOS_PER_DAY;
  if (left < 0)
    return fail(
      429,
      `You have used today's ${PHOTOS_PER_DAY} photos. Type or say the meal instead, or try again tomorrow.`,
      'photo_limit',
    );

  const text = [
    diet ? `The person eats ${diet} food.` : '',
    known.length ? `Names used in the app: ${known.join(', ')}.` : '',
    note ? `Their note: ${note}` : 'No note.',
    'Work out the food in this photo.',
  ]
    .filter(Boolean)
    .join('\n');
  const messages: ProviderMessage[] = [{ role: 'user', text, image: { mime, data: image } }];
  let empty = false;
  for (const provider of deps.providers) {
    let answer: string;
    try {
      answer = await provider.generate(FOOD_PHOTO_PROMPT, messages);
    } catch (err) {
      console.error(`photo: ${provider.name} failed`, err instanceof Error ? err.message : err);
      continue;
    }
    const list = parseFoodJson(answer);
    if (!list) {
      console.error(`photo: ${provider.name} gave no JSON`);
      continue;
    }
    const items = list
      .slice(0, FOOD_LIMITS.items)
      .map(checkFoodItem)
      .filter((i): i is FoodItem => i !== null)
      .map((i) => ({ ...i, basis: i.basis === 'label' ? ('label' as const) : ('photo' as const) }));
    if (items.length === 0) {
      if (list.length === 0) empty = true;
      else console.error(`photo: ${provider.name} items failed the checks`);
      continue;
    }
    return { status: 200, body: { items, left: Math.max(0, left) } };
  }
  if (empty) return { status: 200, body: { items: [], left: Math.max(0, left) } };
  // Nothing usable came back, so the photo does not count against today's allowance.
  await deps.photoQuota?.release().catch(() => undefined);
  return fail(503, 'OverloadGPT is busy right now. Try again in a minute.', 'busy');
}
