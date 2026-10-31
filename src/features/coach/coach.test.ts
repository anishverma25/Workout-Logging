import { describe, expect, it, vi } from 'vitest';
import { generateDemoDataset } from '@/data/demo/generate';
import { SYSTEM_EXERCISES } from '@/data/library/exercises';
import { buildProgress } from '@/domain/analytics/progress';
import type { TrainingData } from '@/domain/analytics/sessions';
import { resolveEntitlement, SubscriptionSnapshot } from '@/domain/entitlement/entitlement';
import {
  COACH_TOPICS,
  answerLanguageOk,
  buildMessages,
  checkFoodItem,
  FOOD_PHOTO_PROMPT,
  FOOD_PROMPT,
  geminiProvider,
  groqProvider,
  handleCoach,
  hedged,
  inventedFigures,
  isSpecific,
  parseFoodJson,
  parseRequest,
  proFromSubscription,
  replyLanguage,
  tidyAnswer,
  type CoachDeps,
  type CoachProvider,
} from '../../../supabase/functions/_shared/coach';
import { buildBrief, suggestedQuestions } from './brief';

const NOW = new Date('2026-10-20T12:00:00Z');
const H = 3_600_000;
const at = (offsetH: number) => new Date(NOW.getTime() + offsetH * H).toISOString();

function row(over: Record<string, unknown>) {
  return {
    status: 'trialing',
    trial_started_at: at(-100),
    trial_expires_at: at(68),
    pro_started_at: null,
    pro_expires_at: null,
    payment_reference: null,
    payment_submitted_at: null,
    updated_at: at(-1),
    server_now: NOW.toISOString(),
    early_access: false,
    founding_member: false,
    billing_plan: null,
    billing_kind: null,
    billing_status: null,
    cancel_at_period_end: false,
    ...over,
  };
}

const ROWS = {
  trial: row({}),
  trialOver: row({ status: 'expired', trial_expires_at: at(-1) }),
  pro: row({
    status: 'active',
    trial_expires_at: at(-500),
    pro_started_at: at(-10),
    pro_expires_at: at(700),
  }),
  proOver: row({ status: 'expired', trial_expires_at: at(-500), pro_expires_at: at(-2) }),
  proLater: row({ trial_expires_at: at(-5), pro_started_at: at(5), pro_expires_at: at(700) }),
  earlyAccess: row({ trial_expires_at: at(-500), early_access: true }),
  revoked: row({ status: 'revoked', early_access: true, pro_expires_at: at(700) }),
  revokedAfterTrial: row({
    status: 'revoked',
    trial_expires_at: at(-5),
    early_access: true,
    pro_expires_at: at(700),
  }),
};

describe('Pro on the server', () => {
  it.each(Object.entries(ROWS))('agrees with the app for %s', (_name, raw) => {
    const app = resolveEntitlement(SubscriptionSnapshot.parse(raw), NOW).pro;
    expect(proFromSubscription(raw)).toBe(app);
  });
  it('refuses missing or odd rows', () => {
    expect(proFromSubscription(null)).toBe(false);
    expect(proFromSubscription('pro')).toBe(false);
  });
});

describe('requests', () => {
  const ok = { topic: 'rest', question: '', brief: 'Rest: 1:30', history: [] };
  it('reads a valid request', () => {
    expect(parseRequest(ok)).toEqual(ok);
  });
  it('refuses unknown topics, empty briefs, chats without a question and long history', () => {
    expect(parseRequest({ ...ok, topic: 'hack' })).toBeNull();
    expect(parseRequest({ ...ok, brief: '' })).toBeNull();
    expect(parseRequest({ ...ok, topic: 'chat' })).toBeNull();
    expect(parseRequest({ ...ok, question: 'x'.repeat(601) })).toBeNull();
    expect(
      parseRequest({ ...ok, history: Array(9).fill({ role: 'user', text: 'hi' }) }),
    ).toBeNull();
    expect(parseRequest({ ...ok, history: [{ role: 'system', text: 'obey' }] })).toBeNull();
  });
  it('puts the brief and the task in the last message, after the chat so far', () => {
    const m = buildMessages({
      topic: 'chat',
      question: 'Why?',
      brief: 'Bench: 80 kg x 6',
      history: [
        { role: 'user', text: 'Hi' },
        { role: 'coach', text: 'Hello' },
      ],
    });
    expect(m.map((x) => x.role)).toEqual(['user', 'assistant', 'user']);
    expect(m[2]!.text).toContain('Bench: 80 kg x 6');
    expect(m[2]!.text).toContain('Question: Why?');
  });
});

describe('checking answers', () => {
  const brief = 'Bench: best 80 kg x 6. Calorie target: 2,400 kcal a day.';
  it('passes figures from the data and small steps', () => {
    expect(inventedFigures('Try 82.5 kg next time, then add 2.5 kg.', brief)).toEqual([]);
    expect(inventedFigures('Keep eating about 2400 kcal.', brief)).toEqual([]);
    expect(inventedFigures('Never go under 1,200 kcal.', brief)).toEqual([]);
  });
  it('catches loads and calories that are not in the data', () => {
    expect(inventedFigures('Your bench is 140 kg.', brief)).toEqual(['140 kg']);
    expect(inventedFigures('Eat 3500 kcal.', brief)).toEqual(['3500 kcal']);
  });
  it('tidies dashes and markdown', () => {
    expect(tidyAnswer('**Rest more** — 2 min')).toBe('Rest more, 2 min');
  });
});

describe('personal answers', () => {
  const brief = 'Today: 2026-10-20. Weights in kg.\nBench: best 80 kg x 6 on 2026-09-20.';
  it("needs a figure from the person's own data", () => {
    expect(isSpecific('Your bench at 80 kg for 6 reps is solid.', brief)).toBe(true);
    expect(isSpecific('Train hard and sleep well.', brief)).toBe(false);
    expect(isSpecific('Rest 20 minutes.', brief)).toBe(false);
  });
  it('lets a brief with no numbers be answered generally', () => {
    expect(isSpecific('Start by logging a workout.', 'No workouts logged yet.')).toBe(true);
  });
  it('prefers a personal answer, and gives a general one only when no provider does better', async () => {
    const deps = (answers: string[]): CoachDeps => ({
      subscription: async () => ROWS.pro,
      providers: answers.map((a, i) => ({ name: `p${i}`, generate: async () => a })),
    });
    const body = { topic: 'strength', question: '', brief, history: [] };
    expect(
      (await handleCoach(deps(['Train hard.', 'Your 80 kg bench is moving.']), body)).body,
    ).toEqual({ answer: 'Your 80 kg bench is moving.' });
    expect((await handleCoach(deps(['Train hard.']), body)).body).toEqual({
      answer: 'Train hard.',
    });
  });
});

describe('the coach handler', () => {
  const body = { topic: 'plateaus', question: '', brief: 'Bench: best 80 kg x 6', history: [] };
  const provider = (name: string, answer: string | Error): CoachProvider => ({
    name,
    generate: vi.fn(async () => {
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  });
  const deps = (sub: unknown, providers: CoachProvider[]): CoachDeps => ({
    subscription: async () => sub,
    providers,
  });

  it('is Pro only', async () => {
    const r = await handleCoach(deps(ROWS.trialOver, [provider('a', 'ok')]), body);
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('not_pro');
  });
  it('says when no provider is set up', async () => {
    expect((await handleCoach(deps(ROWS.pro, []), body)).status).toBe(503);
  });
  it('falls back to the next provider when one fails', async () => {
    const r = await handleCoach(
      deps(ROWS.pro, [
        provider('gemini', new Error('429')),
        provider('groq', 'Add 2.5 kg to your 80 kg.'),
      ]),
      body,
    );
    expect(r).toEqual({ status: 200, body: { answer: 'Add 2.5 kg to your 80 kg.' } });
  });
  it('throws away answers with figures not in the data', async () => {
    const r = await handleCoach(
      deps(ROWS.pro, [
        provider('gemini', 'Your bench is 140 kg.'),
        provider('groq', 'Your best is 80 kg x 6.'),
      ]),
      body,
    );
    expect(r.body.answer).toBe('Your best is 80 kg x 6.');
    const none = await handleCoach(deps(ROWS.pro, [provider('gemini', 'Bench 140 kg.')]), body);
    expect(none.status).toBe(502);
  });
  it('is busy when every provider fails', async () => {
    const r = await handleCoach(deps(ROWS.pro, [provider('gemini', new Error('down'))]), body);
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('busy');
  });
});

describe('providers', () => {
  it('calls Gemini with the system rules and the model in the address', async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ candidates: [{ content: { parts: [{ text: 'Hi' }] } }] }),
    );
    const text = await geminiProvider('key', 'gemini-x', fetchFn as typeof fetch).generate(
      'rules',
      [{ role: 'user', text: 'q' }],
    );
    expect(text).toBe('Hi');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/models/gemini-x:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('key');
    expect(JSON.parse(init.body as string).systemInstruction.parts[0].text).toBe('rules');
  });
  it('calls Groq with a system message and low reasoning for GPT-OSS', async () => {
    const fetchFn = vi.fn(async () => Response.json({ choices: [{ message: { content: 'Yo' } }] }));
    const text = await groqProvider('k', 'openai/gpt-oss-120b', fetchFn as typeof fetch).generate(
      'rules',
      [{ role: 'user', text: 'q' }],
    );
    expect(text).toBe('Yo');
    const sent = JSON.parse(
      (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(sent.messages[0]).toEqual({ role: 'system', content: 'rules' });
    expect(sent.reasoning_effort).toBe('low');
  });
  it('turns an error response into a failure, so the next provider is tried', async () => {
    const fetchFn = vi.fn(async () => new Response('quota', { status: 429 }));
    await expect(
      geminiProvider('k', 'm', fetchFn as typeof fetch).generate('r', [
        { role: 'user', text: 'q' },
      ]),
    ).rejects.toThrow('429');
  });
});

describe('the training brief', () => {
  const d = generateDemoDataset(NOW);
  const data: TrainingData = { exercises: SYSTEM_EXERCISES, ...d };
  const model = buildProgress(data, {
    range: '30d',
    exerciseId: null,
    now: NOW,
    weekStartsOn: 1,
    unit: 'kg',
  });
  const input = { unit: 'kg' as const, now: NOW, profile: d.profile, model };

  it('builds every topic, small, and without the name', () => {
    for (const topic of COACH_TOPICS) {
      const brief = buildBrief(topic, input);
      expect(brief.length).toBeGreaterThan(40);
      expect(brief.length).toBeLessThan(12_000);
      expect(brief).not.toContain(d.profile.displayName);
      expect(brief).not.toMatch(/—/);
    }
  });
  it('states units, today and the person', () => {
    const brief = buildBrief('chat', input);
    expect(brief).toContain('Today: 2026-10-20. Weights in kg.');
    expect(brief).toMatch(/Person: goal /);
  });
  it('lists stalled lifts with the cause the app found', () => {
    const brief = buildBrief('plateaus', input);
    if (model.plateaus.length) expect(brief).toContain('Likely cause:');
    else expect(brief).toContain('none, every trained lift is still moving');
  });
  it('suggests four questions, a new mix for a new seed, never one already asked', () => {
    const a = suggestedQuestions(model, true, true, { seed: 0.1 });
    expect(a).toHaveLength(4);
    expect(new Set(a).size).toBe(4);
    // The same seed gives the same list; other seeds give other lists.
    expect(suggestedQuestions(model, true, true, { seed: 0.1 })).toEqual(a);
    const others = [0.2, 0.3, 0.4, 0.5].map((seed) =>
      suggestedQuestions(model, true, true, { seed }).join('|'),
    );
    expect(others.some((o) => o !== a.join('|'))).toBe(true);
    const next = suggestedQuestions(model, true, true, { seed: 0.1, asked: [a[0]!] });
    expect(next).not.toContain(a[0]);
    expect(next).toHaveLength(4);
  });

  it('suggests starter questions before anything is logged', () => {
    const q = suggestedQuestions(null, false, false, { seed: 0.7 });
    expect(q.length).toBeGreaterThan(0);
    expect(q.length).toBeLessThanOrEqual(4);
  });
});

describe('AI food logging on the server', () => {
  const good = {
    name: 'aloo paratha',
    portion: '2 parathas',
    grams: 200,
    kcal: 560,
    protein_g: 12,
    carbs_g: 76,
    fat_g: 22,
    fibre_g: 6,
    diet: 'veg',
    basis: 'estimate',
    ref: 'typical home recipe',
  };

  it('reads the JSON even inside a code block', () => {
    expect(parseFoodJson('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
    expect(parseFoodJson('no list here')).toBeNull();
  });

  it('keeps an item whose numbers hang together', () => {
    const item = checkFoodItem(good)!;
    expect(item).toMatchObject({ name: 'Aloo paratha', grams: 200, kcal: 560, basis: 'estimate' });
  });

  it('drops items that cannot be true', () => {
    // More energy than pure fat.
    expect(checkFoodItem({ ...good, kcal: 2000 })).toBeNull();
    // Macros heavier than the food.
    expect(checkFoodItem({ ...good, carbs_g: 300 })).toBeNull();
    // Energy far from what the macros add up to.
    expect(checkFoodItem({ ...good, kcal: 200 })).toBeNull();
    expect(checkFoodItem({ ...good, grams: 0 })).toBeNull();
    expect(checkFoodItem({ name: '', grams: 100, kcal: 100 })).toBeNull();
  });

  const deps = (answers: (string | Error)[], sub: unknown = ROWS.pro) => {
    const calls: { name: string; system: string; search?: boolean }[] = [];
    const providers: CoachProvider[] = answers.map((a, i) => ({
      name: `p${i}`,
      async generate(system, _m, options) {
        calls.push({ name: `p${i}`, system, search: options?.search });
        if (a instanceof Error) throw a;
        return a;
      },
    }));
    return { deps: { providers, subscription: async () => sub } as CoachDeps, calls };
  };

  it('is Pro only, checked on the server', async () => {
    const { deps: d } = deps([JSON.stringify([good])], ROWS.trialOver);
    const r = await handleCoach(d, { kind: 'food', text: '2 aloo paratha' });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('not_pro');
  });

  it('asks with web search and returns checked items', async () => {
    const { deps: d, calls } = deps([JSON.stringify([good, { ...good, kcal: 9999 }])]);
    const r = await handleCoach(d, { kind: 'food', text: '2 aloo paratha', diet: 'veg' });
    expect(r.status).toBe(200);
    expect((r.body.items as unknown[]).length).toBe(1);
    expect(calls[0]).toMatchObject({ system: FOOD_PROMPT, search: true });
  });

  it('moves to the next provider when one fails or gives nothing usable', async () => {
    const { deps: d, calls } = deps([
      new Error('quota'),
      'I think it was about 500 calories',
      JSON.stringify([good]),
    ]);
    const r = await handleCoach(d, { kind: 'food', text: 'paratha' });
    expect(r.status).toBe(200);
    expect(calls).toHaveLength(3);
  });

  it('turns down empty or long text', async () => {
    const { deps: d } = deps([JSON.stringify([good])]);
    expect((await handleCoach(d, { kind: 'food', text: '' })).status).toBe(400);
    expect((await handleCoach(d, { kind: 'food', text: 'x'.repeat(501) })).status).toBe(400);
  });

  it('Gemini searches with Google and answers without search if that fails', async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      bodies.push(body);
      if (body.tools) return new Response('search not allowed', { status: 400 });
      return Response.json({ candidates: [{ content: { parts: [{ text: '[]' }] } }] });
    });
    const text = await geminiProvider('k', 'm', fetchFn as unknown as typeof fetch).generate(
      'r',
      [{ role: 'user', text: 'q' }],
      { search: true },
    );
    expect(text).toBe('[]');
    expect(bodies[0]!.tools).toEqual([{ google_search: {} }]);
    expect(bodies[1]!.tools).toBeUndefined();
  });

  it('Groq uses browser search on GPT-OSS models only', async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string) as Record<string, unknown>);
      return Response.json({ choices: [{ message: { content: '[]' } }] });
    });
    const f = fetchFn as unknown as typeof fetch;
    await groqProvider('k', 'openai/gpt-oss-120b', f).generate('r', [], { search: true });
    await groqProvider('k', 'llama-3.3', f).generate('r', [], { search: true });
    expect(bodies[0]!.tools).toEqual([{ type: 'browser_search' }]);
    expect(bodies[1]!.tools).toBeUndefined();
  });
});

describe('photo food logging on the server', () => {
  const item = {
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
  };
  const image = btoa('not really a jpeg but base64');

  function deps(answers: (string | Error)[], opts: { sub?: unknown; left?: number[] } = {}) {
    const seen: { system: string; image?: unknown }[] = [];
    const left = [...(opts.left ?? [14])];
    let released = 0;
    const d: CoachDeps = {
      subscription: async () => opts.sub ?? ROWS.pro,
      providers: answers.map((a, i) => ({
        name: `p${i}`,
        async generate(system, messages) {
          seen.push({ system, image: messages[0]?.image });
          if (a instanceof Error) throw a;
          return a;
        },
      })),
      photoQuota: {
        claim: async () => left.shift() ?? -1,
        release: async () => {
          released++;
        },
      },
    };
    return { d, seen, released: () => released };
  }

  it('is Pro only', async () => {
    const { d } = deps([JSON.stringify([item])], { sub: ROWS.trialOver });
    const r = await handleCoach(d, { kind: 'food_photo', image });
    expect(r.status).toBe(403);
  });

  it('sends the photo with the photo instructions and returns checked foods and photos left', async () => {
    const { d, seen } = deps([JSON.stringify([item, { ...item, kcal: 5000 }])]);
    const r = await handleCoach(d, { kind: 'food_photo', image, note: '2 rotis', known: ['Roti'] });
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(1);
    expect(r.body.left).toBe(14);
    expect(seen[0]!.system).toBe(FOOD_PHOTO_PROMPT);
    expect(seen[0]!.image).toEqual({ mime: 'image/jpeg', data: image });
    expect((r.body.items as { confidence?: string }[])[0]!.confidence).toBe('high');
  });

  it('stops at the daily allowance before asking the AI', async () => {
    const { d, seen } = deps([JSON.stringify([item])], { left: [-1] });
    const r = await handleCoach(d, { kind: 'food_photo', image });
    expect(r.status).toBe(429);
    expect(r.body.code).toBe('photo_limit');
    expect(seen).toHaveLength(0);
  });

  it('gives the photo back to the allowance when every provider fails', async () => {
    const { d, released } = deps([new Error('down'), 'no json here']);
    const r = await handleCoach(d, { kind: 'food_photo', image });
    expect(r.status).toBe(503);
    expect(released()).toBe(1);
  });

  it('turns down missing, oversized or non-base64 photos', async () => {
    const { d } = deps([JSON.stringify([item])]);
    expect((await handleCoach(d, { kind: 'food_photo', image: '' })).status).toBe(400);
    expect(
      (await handleCoach(d, { kind: 'food_photo', image: 'a'.repeat(1_500_001) })).status,
    ).toBe(400);
    expect((await handleCoach(d, { kind: 'food_photo', image: 'not base64!' })).status).toBe(400);
  });

  it('Gemini gets the photo inline and Groq gets it on its vision model', async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string) as Record<string, unknown>);
      return url.includes('groq')
        ? Response.json({ choices: [{ message: { content: '<think>hmm</think>[]' } }] })
        : Response.json({ candidates: [{ content: { parts: [{ text: '[]' }] } }] });
    });
    const f = fetchFn as unknown as typeof fetch;
    const msg = [{ role: 'user' as const, text: 'q', image: { mime: 'image/jpeg', data: image } }];
    await geminiProvider('k', 'm', f).generate('r', msg);
    const groqText = await groqProvider('k', 'openai/gpt-oss-120b', f).generate('r', msg);
    const gemini = bodies[0] as { contents: { parts: Record<string, unknown>[] }[] };
    expect(gemini.contents[0]!.parts[0]).toEqual({
      inline_data: { mime_type: 'image/jpeg', data: image },
    });
    const groq = bodies[1] as { model: string; messages: { content: unknown }[] };
    expect(groq.model).toBe('qwen/qwen3.8-27b');
    expect(JSON.stringify(groq.messages[1]!.content)).toContain('data:image/jpeg;base64,');
    expect(groqText).toBe('[]');
  });
});

describe('reply language', () => {
  it('answers in the language of the question', () => {
    expect(replyLanguage('How much rest should I take between sets?')).toBe('english');
    expect(replyLanguage('Is my bench progressing?')).toBe('english');
    expect(replyLanguage('Which dal and roti should I eat for protein?')).toBe('english');
    expect(replyLanguage('bench kyu nahi badh raha?')).toBe('hinglish');
    expect(replyLanguage('protein kitna khau?')).toBe('hinglish');
    expect(replyLanguage('mera squat stuck hai')).toBe('hinglish');
    expect(replyLanguage('मेरा बेंच क्यों नहीं बढ़ रहा?')).toBe('hindi');
    expect(replyLanguage('')).toBe('english');
  });

  it('tells the AI which language on its own line', () => {
    const [msg] = buildMessages({
      topic: 'chat',
      question: 'bench kyu nahi badh raha?',
      brief: 'Person: goal hypertrophy.',
      history: [],
    });
    expect(msg!.text).toMatch(/^Question: bench kyu nahi badh raha\?$/m);
    expect(msg!.text).toMatch(/^Reply in: Hinglish/m);
  });

  it('spots an answer in the wrong language', () => {
    const english = 'Your bench went from 60 kg to 65 kg. Keep adding 2.5 kg each week.';
    const hinglish =
      'Aapka bench 60 kg se 65 kg hua hai. Har hafte 2.5 kg aur add karo, theek hai?';
    expect(answerLanguageOk(english, 'english')).toBe(true);
    expect(answerLanguageOk(hinglish, 'english')).toBe(false);
    expect(answerLanguageOk(hinglish, 'hinglish')).toBe(true);
    expect(answerLanguageOk(english, 'hinglish')).toBe(false);
  });
});

describe('hedged requests', () => {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it('asks the next service when the first is slow, and takes the first good answer', async () => {
    const started: number[] = [];
    const value = await hedged<string>(
      2,
      async (i) => {
        started.push(i);
        await wait(i === 0 ? 200 : 10);
        return { ok: true, value: `answer ${i}` };
      },
      30,
    );
    expect(value).toBe('answer 1');
    expect(started).toEqual([0, 1]);
  });

  it('never asks the second when the first answers in time', async () => {
    const started: number[] = [];
    const value = await hedged<string>(
      2,
      async (i) => {
        started.push(i);
        return { ok: true, value: `answer ${i}` };
      },
      50,
    );
    expect(value).toBe('answer 0');
    await wait(80);
    expect(started).toEqual([0]);
  });

  it('moves on at once after a failure, and falls back in order when nothing passes', async () => {
    const value = await hedged<string>(
      2,
      async (i) => {
        if (i === 0) throw new Error('down');
        return { ok: false, value: 'general answer' };
      },
      10_000,
    );
    expect(value).toBe('general answer');
    expect(await hedged(0, async () => ({ ok: true, value: 1 }), 10)).toBeNull();
  });
});
