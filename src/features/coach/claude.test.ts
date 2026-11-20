import { describe, expect, it, vi } from 'vitest';
import {
  CLAUDE_HEDGE_MS,
  claudeMessages,
  claudeProvider,
  DEFAULT_MODELS,
  FOOD_LABEL_PROMPT,
  FOOD_PROMPT,
  handleCoach,
  handleFoodLabel,
  handleFoodLog,
  HEDGE_MS,
  hedged,
  LABEL_MODEL,
  patience,
  type CoachDeps,
  type CoachProvider,
  type GenerateOptions,
} from '../../../supabase/functions/_shared/coach';

/** Claude as the main AI provider (November 2026), with Gemini and Groq behind it. */

const MODELS = {
  chat: 'haiku-chat',
  food: 'haiku-food',
  label: 'haiku-label',
  menu: 'haiku-menu',
  photo: 'sonnet-photo',
};

type Call = [string, RequestInit];
const sent = (fetchFn: ReturnType<typeof vi.fn>, i = 0) =>
  JSON.parse(((fetchFn.mock.calls[i] as unknown as Call)[1].body as string) ?? '{}') as Record<
    string,
    unknown
  >;
const reply = (content: unknown[], extra: Record<string, unknown> = {}) =>
  Response.json({ content, stop_reason: 'end_turn', ...extra });

describe('Claude provider', () => {
  it('calls the Messages API with the key, the system rules and the chat model', async () => {
    const fetchFn = vi.fn(async () => reply([{ type: 'text', text: 'Hi' }]));
    const text = await claudeProvider('key', MODELS, fetchFn as typeof fetch).generate(
      'rules',
      [{ role: 'user', text: 'q' }],
      { purpose: 'chat' },
    );
    expect(text).toBe('Hi');
    const [url, init] = fetchFn.mock.calls[0] as unknown as Call;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    const body = sent(fetchFn);
    expect(body).toMatchObject({ model: 'haiku-chat', system: 'rules', max_tokens: 2048 });
    expect(body.messages).toEqual([{ role: 'user', content: [{ type: 'text', text: 'q' }] }]);
    expect(body.tools).toBeUndefined();
  });

  it('uses the model chosen for each feature', async () => {
    const fetchFn = vi.fn(async () => reply([{ type: 'text', text: '[]' }]));
    const p = claudeProvider('k', MODELS, fetchFn as typeof fetch);
    const photo = [{ role: 'user' as const, text: 'w', image: { mime: 'image/jpeg', data: 'AA' } }];
    await p.generate('r', photo, { purpose: 'photo' });
    await p.generate('r', photo, { purpose: 'label' });
    await p.generate('r', photo, { purpose: 'menu' });
    await p.generate('r', [{ role: 'user', text: 'x' }], { purpose: 'food' });
    // No purpose: a photo is a plate photo, words are chat.
    await p.generate('r', photo);
    await p.generate('r', [{ role: 'user', text: 'x' }]);
    expect(fetchFn.mock.calls.map((_, i) => sent(fetchFn, i).model)).toEqual([
      'sonnet-photo',
      'haiku-label',
      'haiku-menu',
      'haiku-food',
      'sonnet-photo',
      'haiku-chat',
    ]);
  });

  it('defaults to Haiku 5.5 for words and labels and Sonnet 5.5 for plate photos', () => {
    expect(DEFAULT_MODELS.claude).toEqual({
      chat: 'claude-haiku-5-5',
      food: 'claude-haiku-5-5',
      label: 'claude-haiku-5-5',
      menu: 'claude-haiku-5-5',
      photo: 'claude-sonnet-5-5',
    });
  });

  it('sends a photo before its words, joins turns and starts with the person', () => {
    expect(
      claudeMessages([
        { role: 'assistant', text: 'An old answer' },
        { role: 'user', text: 'first' },
        { role: 'user', text: '  ' },
        { role: 'user', text: 'second', image: { mime: 'image/png', data: 'AA' } },
        { role: 'assistant', text: 'reply' },
      ]),
    ).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'first' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AA' } },
          { type: 'text', text: 'second' },
        ],
      },
      { role: 'assistant', content: [{ type: 'text', text: 'reply' }] },
    ]);
  });

  it('searches the web for food, says it searched, and keeps only the final answer', async () => {
    const fetchFn = vi.fn(async () =>
      reply(
        [
          { type: 'text', text: 'Let me look that up [maybe].' },
          { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'x' } },
          { type: 'web_search_tool_result', tool_use_id: 's1', content: [] },
          { type: 'text', text: '[{"name":"Cold coffee",' },
          { type: 'text', text: '"grams":350}]' },
        ],
        { usage: { server_tool_use: { web_search_requests: 1 } } },
      ),
    );
    const onSearch = vi.fn();
    const text = await claudeProvider('k', MODELS, fetchFn as typeof fetch).generate(
      FOOD_PROMPT,
      [{ role: 'user', text: 'Starbucks cold coffee' }],
      { purpose: 'food', search: true, onSearch },
    );
    expect(text).toBe('[{"name":"Cold coffee","grams":350}]');
    expect(sent(fetchFn).tools).toEqual([
      { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
    ]);
    expect(onSearch).toHaveBeenCalledWith(true);
  });

  it('asks again without search when search is not available, and says no search ran', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response('web search is not enabled', { status: 400 }))
      .mockResolvedValueOnce(reply([{ type: 'text', text: '[]' }]));
    const onSearch = vi.fn();
    const text = await claudeProvider('k', MODELS, fetchFn as typeof fetch).generate(
      FOOD_PROMPT,
      [{ role: 'user', text: 'dal' }],
      { purpose: 'food', search: true, onSearch },
    );
    expect(text).toBe('[]');
    expect(sent(fetchFn, 0).tools).toBeDefined();
    expect(sent(fetchFn, 1).tools).toBeUndefined();
    expect(onSearch).toHaveBeenCalledWith(false);
    expect(onSearch).not.toHaveBeenCalledWith(true);
  });

  it('drops the temperature for a model that does not take one', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('temperature is not supported for this model', { status: 400 }),
      )
      .mockResolvedValueOnce(reply([{ type: 'text', text: 'ok' }]));
    const text = await claudeProvider('k', MODELS, fetchFn as typeof fetch).generate('r', [
      { role: 'user', text: 'q' },
    ]);
    expect(text).toBe('ok');
    expect(sent(fetchFn, 0).temperature).toBe(0.2);
    expect('temperature' in sent(fetchFn, 1)).toBe(false);
  });

  it('turns errors and refusals into a miss, so the next provider answers', async () => {
    const down = vi.fn(async () => new Response('overloaded', { status: 529 }));
    await expect(
      claudeProvider('k', MODELS, down as typeof fetch).generate('r', [
        { role: 'user', text: 'q' },
      ]),
    ).rejects.toThrow('529');
    const refused = vi.fn(async () => reply([], { stop_reason: 'refusal' }));
    expect(
      await claudeProvider('k', MODELS, refused as typeof fetch).generate('r', [
        { role: 'user', text: 'q' },
      ]),
    ).toBe('');
  });
});

describe('Claude first, the others behind it', () => {
  const PRO = {
    status: 'active',
    pro_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    server_now: new Date().toISOString(),
  };
  const provider = (
    name: string,
    answer: string | Error,
    seen?: GenerateOptions[],
  ): CoachProvider => ({
    name,
    generate: vi.fn(async (_s, _m, options) => {
      seen?.push(options ?? {});
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  });
  const deps = (providers: CoachProvider[]): CoachDeps => ({
    subscription: async () => PRO,
    providers,
  });
  const chat = { topic: 'plateaus', question: '', brief: 'Bench: best 80 kg x 6', history: [] };

  it('Claude answers chat when it can, and Gemini when it cannot', async () => {
    const gemini = provider('gemini', 'Gemini says your 80 kg x 6 is holding.');
    const first = await handleCoach(
      deps([provider('claude', 'Your 80 kg x 6 is holding; add a set.'), gemini]),
      chat,
    );
    expect(first.body.answer).toBe('Your 80 kg x 6 is holding; add a set.');
    expect(gemini.generate).not.toHaveBeenCalled();
    const fallback = await handleCoach(
      deps([provider('claude', new Error('Claude 529')), gemini]),
      chat,
    );
    expect(fallback.body.answer).toBe('Gemini says your 80 kg x 6 is holding.');
  });

  it('tells Claude which feature is asking', async () => {
    const seen: GenerateOptions[] = [];
    await handleCoach(deps([provider('claude', 'Your 80 kg x 6 holds.', seen)]), chat);
    await handleFoodLog(deps([provider('claude', '[]', seen)]), { kind: 'food', text: 'dal' });
    expect(seen.map((o) => o.purpose)).toEqual(['chat', 'food']);
    expect(seen[1]!.search).toBe(true);
  });

  it('gives Claude longer before asking the next one, others the usual wait', () => {
    const wait = patience(['claude', 'gemini', 'groq'], HEDGE_MS.chat, CLAUDE_HEDGE_MS.chat);
    expect([wait(0), wait(1), wait(2)]).toEqual([8_000, 3_000, 3_000]);
    // Without Claude nothing changes.
    expect(patience(['gemini', 'groq'], HEDGE_MS.food, CLAUDE_HEDGE_MS.food)(0)).toBe(7_000);
    // A fallback still fits inside the app's 30 s wait for food, photos and labels.
    for (const ms of [CLAUDE_HEDGE_MS.food, CLAUDE_HEDGE_MS.photo, CLAUDE_HEDGE_MS.label])
      expect(ms).toBeLessThanOrEqual(15_000);
  });

  it('a hedge can wait a different time after each attempt', async () => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const started: number[] = [];
    const value = await hedged<string>(
      2,
      async (i) => {
        started.push(i);
        await wait(i === 0 ? 60 : 1);
        return { ok: true, value: `answer ${i}` };
      },
      (i) => (i === 0 ? 200 : 10),
    );
    // The first had 200 ms of patience and answered in 60: the second was never asked.
    expect(value).toBe('answer 0');
    expect(started).toEqual([0]);
  });

  const label = { kind: 'food_label', image: 'aGVsbG8=', mime: 'image/jpeg' };
  const printed = JSON.stringify({
    product: 'Whey',
    brand: 'TestFit',
    serving_g: 33,
    per_100g: { kcal: 400, protein_g: 80, carbs_g: 8, fat_g: 6 },
  });

  it('labels: Claude reads first; when it fails, Gemini’s label model, then the rest', async () => {
    const seen: GenerateOptions[] = [];
    const ok = await handleFoodLabel(
      deps([provider('claude', printed, seen), provider('gemini', printed, seen)]),
      label,
    );
    expect(ok.status).toBe(200);
    expect(seen).toEqual([{ purpose: 'label' }]);

    const order: string[] = [];
    const track = (name: string, answer: string | Error): CoachProvider => ({
      name,
      generate: async (system, _m, options) => {
        expect(system).toBe(FOOD_LABEL_PROMPT);
        order.push(`${name}${options?.model ? `:${options.model}` : ''}`);
        if (answer instanceof Error) throw answer;
        return answer;
      },
    });
    const fallback = await handleFoodLabel(
      deps([
        track('claude', new Error('Claude 529')),
        track('gemini', printed),
        track('groq', printed),
      ]),
      label,
    );
    expect(fallback.status).toBe(200);
    expect(order).toEqual(['claude', `gemini:${LABEL_MODEL}`]);
  });

  it('labels: "not a label" from the first answer is said plainly', async () => {
    const r = await handleFoodLabel(
      deps([provider('claude', '{"not_a_label": true}'), provider('gemini', printed)]),
      label,
    );
    expect(r).toMatchObject({ status: 422, body: { code: 'not_a_label' } });
  });
});
