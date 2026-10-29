import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, Sparkles } from 'lucide-react';
import { warmAi } from '@/app/aiWarm';
import { ask, CoachError, HISTORY_DAYS, useCoachStore } from '@/app/coach';
import { useFeature } from '@/app/entitlement';
import { PageHeader } from '@/app/layout/PageHeader';
import { Card, ErrorState, IconButton, Skeleton } from '@/components/kit';
import { usePreferences, useTrainingData } from '@/data/hooks';
import { buildProgress } from '@/domain/analytics/progress';
import { useNow } from '@/lib/useNow';
import { nutritionBrief, useFoodContextFrom } from '../food/useFoodContext';
import { buildBrief, suggestedQuestions, type BriefInput } from './brief';
import { AiByline, CoachConsent, CoachLock, CoachText, Thinking } from './CoachParts';

/**
 * Ask your coach: a chat about your own training. Each question carries a brief of the last
 * 30 days the app has calculated; the AI explains it and suggests what to do. Pro only.
 */
export function CoachPage() {
  return (
    <>
      <PageHeader
        back={{ to: '/progress', label: 'Progress' }}
        title="OverloadGPT"
        subtitle="Ask about your training and food, in any language"
      />
      <div className="flex max-w-2xl flex-col gap-4">
        <CoachBody />
      </div>
    </>
  );
}

/** The coach itself, on its page or in the sheet the floating button opens. */
export function CoachBody() {
  const pro = useFeature('ai_coach');
  const store = useCoachStore();
  if (!pro)
    return (
      <>
        <CoachLock lead="Ask OverloadGPT anything about your training and food." />
        <WhatItDoes />
      </>
    );
  if (!store.consent)
    return (
      <Card>
        <CoachConsent />
      </Card>
    );
  return <Chat />;
}

function WhatItDoes() {
  return (
    <Card>
      <h2 className="type-headline text-text-1">What OverloadGPT does</h2>
      <ul className="type-meta mt-3 flex list-disc flex-col gap-2 pl-5 text-text-2">
        <li>
          Explains why a lift has stalled, using the cause Overload found, and what to change.
        </li>
        <li>Tells you which lifts are ready for more weight, and how much.</li>
        <li>
          Checks your weekly sets, rest times, balance, food and calorie targets against the
          evidence.
        </li>
        <li>Answers in your language, Hinglish included, from your own logged numbers.</li>
        <li>Every card on Progress has an Explain button that does this in one tap.</li>
      </ul>
    </Card>
  );
}

function useBriefInput(): BriefInput | null {
  const training = useTrainingData();
  const prefs = usePreferences();
  const now = useNow();
  const food = useFoodContextFrom(now, training);
  const nutrition = useMemo(() => nutritionBrief(food, now), [food, now]);
  return useMemo(() => {
    if (!training.data) return null;
    const profile = training.data.profile ?? null;
    return {
      unit: prefs.weightUnit,
      now,
      profile,
      data: training.data,
      model: buildProgress(training.data, {
        range: '30d',
        exerciseId: null,
        now,
        weekStartsOn: prefs.weekStartsOn,
        unit: prefs.weightUnit,
      }),
      targets:
        profile && (profile.calorieTarget || profile.proteinTargetG)
          ? {
              kcal: profile.calorieTarget ?? null,
              proteinG: profile.proteinTargetG ?? null,
              calculatedKcal: null,
              bodyWeightKg: null,
              insights: [],
            }
          : null,
      nutrition,
    };
  }, [training.data, prefs.weightUnit, prefs.weekStartsOn, now, nutrition]);
}

function Chat() {
  const store = useCoachStore();
  const input = useBriefInput();
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<{ question: string; message: string } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const messages = store.messages.filter((m) => !m.topic);
  // A new mix on every visit and after every answer, leaving out what was already asked.
  const [seed] = useState(() => Math.random());
  const asked = store.messages.filter((m) => m.role === 'user').map((m) => m.text);
  const askedKey = asked.join('\n');
  const suggestions = useMemo(
    () =>
      suggestedQuestions(input?.model ?? null, !!input?.targets, !!input?.nutrition, {
        seed: seed + asked.length,
        asked,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- askedKey stands for asked
    [input, seed, askedKey],
  );

  // Opens at the latest message, like any chat: straight there the first time the chat is
  // drawn (it waits for the person's numbers), smoothly for each new message after that.
  const placed = useRef(false);
  const ready = !!input;
  useEffect(() => {
    if (!ready || !end.current) return;
    end.current.scrollIntoView({ block: 'end', behavior: placed.current ? 'smooth' : 'auto' });
    placed.current = true;
  }, [ready, messages.length, pending, error]);

  // Starts the server while the person is still typing.
  useEffect(() => warmAi(), []);

  async function send(question: string) {
    const q = question.trim();
    if (!q || pending || !input) return;
    setDraft('');
    setError(null);
    setPending(q);
    try {
      await ask(q, buildBrief('chat', input));
    } catch (err) {
      setError({
        question: q,
        message: err instanceof CoachError ? err.message : 'Something went wrong. Try again.',
      });
    } finally {
      setPending(null);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };

  if (!input) return <Skeleton height={240} radius="panel" />;

  return (
    <>
      {messages.length === 0 && !pending && !error ? (
        <Card>
          <div className="flex items-center gap-2 text-text-1">
            <Sparkles className="size-5" aria-hidden />
            <h2 className="type-headline">Ask about your training and food</h2>
          </div>
          <p className="type-meta mt-1 text-text-2">
            OverloadGPT reads your last 30 days: lifts, records, stalls, sets per muscle, rest, body
            weight and what you ate. Pick a question or write your own.
          </p>
        </Card>
      ) : null}

      <ol className="flex flex-col gap-3" aria-label="Chat with OverloadGPT" aria-live="polite">
        {messages.map((m) => (
          <li key={m.id}>
            <Bubble role={m.role} text={m.text} />
          </li>
        ))}
        {pending ? (
          <>
            <li>
              <Bubble role="user" text={pending} />
            </li>
            <li>
              <div className="rounded-panel border border-border bg-surface p-4">
                <Thinking />
              </div>
            </li>
          </>
        ) : null}
        {error ? (
          <>
            <li>
              <Bubble role="user" text={error.question} />
            </li>
            <li>
              <ErrorState
                title="No answer this time"
                message={error.message}
                onRetry={() => void send(error.question)}
              />
            </li>
          </>
        ) : null}
      </ol>

      {!pending ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested questions">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void send(s)}
              className="pressable chrome type-meta rounded-full bg-surface-2 px-3.5 py-2 text-left text-text-1"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="flex items-end gap-2 rounded-panel border border-border bg-surface p-2"
      >
        <label htmlFor="coach-question" className="sr-only">
          Your question
        </label>
        <textarea
          id="coach-question"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
          rows={2}
          maxLength={600}
          placeholder="Ask anything, like: bench kyu nahi badh raha?"
          className="type-body min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-text-1 outline-none placeholder:text-text-3"
        />
        <IconButton
          type="submit"
          label="Send"
          icon={<ArrowUp />}
          disabled={!draft.trim() || !!pending}
          className={draft.trim() && !pending ? 'bg-lime text-on-lime' : undefined}
        />
      </form>
      <p className="type-caption px-1 text-text-2">
        Your chat is kept on this phone for {HISTORY_DAYS} days. Written by AI from your logged
        numbers; it can be wrong.
      </p>
      <div ref={end} />
    </>
  );
}

function Bubble({ role, text }: { role: 'user' | 'coach'; text: string }) {
  if (role === 'user')
    return (
      <div className="flex justify-end">
        <p className="type-answer max-w-[85%] rounded-panel rounded-br-tile bg-surface-2 px-4 py-2.5 whitespace-pre-wrap text-text-1">
          {text}
        </p>
      </div>
    );
  return (
    <div className="ai-surface rounded-panel p-4 lg:p-5">
      <AiByline />
      <CoachText text={text} />
    </div>
  );
}
