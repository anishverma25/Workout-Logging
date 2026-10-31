import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  joinSaid,
  speechProblem,
  speechRecognition,
  transcriptOf,
  type SpeechRecognitionLike,
} from './speech';
import { PrimaryButton, SecondaryButton } from '@/components/kit';
import { useCoachStore } from '@/app/coach';
import { askFoodLog, FOOD_LIMITS, FoodAiError } from '@/app/foodAi';
import type { FoodPortion } from '@/data/repositories/food';
import { parseMeal } from '@/domain/nutrition/parse';
import { AiByline, CoachConsent, Thinking } from '../coach/CoachParts';
import { AiItemRow } from './AiItemRow';
import { portionForItem } from './aiMatch';
import { defaultPortion } from './foodText';
import type { FoodContext } from './useFoodContext';

/**
 * Tell OverloadGPT what you ate (Pro). The words go to the server, which asks the AI with web
 * search for brands and restaurant items and checks every number it returns. Foods the
 * library already knows by exactly that name use the library's values; the rest are labelled
 * as found on the web or estimated. Without a connection the library parser fills what it can.
 */

type State =
  | { kind: 'idle' }
  | { kind: 'asking' }
  | { kind: 'done'; portions: FoodPortion[] }
  | { kind: 'fallback'; message: string; portions: FoodPortion[]; unknown: string[] };

export function AiFoodLog({
  ctx,
  initialText,
  onFill,
}: {
  ctx: FoodContext;
  /** What the person searched for and did not find, typed in for them. */
  initialText?: string;
  onFill: (items: FoodPortion[]) => void;
}) {
  const store = useCoachStore();
  const [text, setText] = useState(initialText ?? '');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [listening, setListening] = useState(false);
  /** Words still being heard, shown under the box while the person speaks. */
  const [heard, setHeard] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const Speech = useMemo(() => speechRecognition(), []);

  useEffect(() => () => recognition.current?.abort(), []);

  if (!store.consent) return <CoachConsent />;

  function listen() {
    if (!Speech) return;
    if (listening) {
      recognition.current?.stop();
      return;
    }
    setVoiceError(null);
    setHeard('');
    let r: SpeechRecognitionLike;
    try {
      r = new Speech();
    } catch {
      setVoiceError(speechProblem(undefined));
      return;
    }
    // Indian English understands Hinglish best of the voices phones offer.
    r.lang = 'en-IN';
    // Words show while they are spoken, and listening stops by itself after a pause (the
    // continuous mode repeats words on Android).
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    let committed = '';
    r.onresult = (e) => {
      const { final, interim } = transcriptOf(e.results);
      if (final && final !== committed) {
        const fresh = final.startsWith(committed) ? final.slice(committed.length).trim() : final;
        committed = final;
        if (fresh) setText((t) => joinSaid(t, fresh));
      }
      setHeard(interim);
    };
    r.onerror = (e) => {
      // Stopping on purpose is not a problem.
      if (e.error !== 'aborted') setVoiceError(speechProblem(e.error));
    };
    r.onend = () => {
      setListening(false);
      setHeard('');
      recognition.current = null;
    };
    recognition.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      recognition.current = null;
      setVoiceError(speechProblem(undefined));
    }
  }

  async function ask() {
    const words = text.trim();
    if (!words) return;
    setState({ kind: 'asking' });
    try {
      const items = await askFoodLog(words, ctx.diet);
      setState({ kind: 'done', portions: items.map((i) => portionForItem(i, ctx)) });
    } catch (e) {
      // No connection or the AI is busy: the library still knows most everyday foods.
      // Only the curated library: the long tail matches stray words too easily.
      const curated = ctx.foods.filter((f) => f.source !== 'usda' && f.source !== 'indb');
      const parsed = parseMeal(words, curated, ctx.diet);
      setState({
        kind: 'fallback',
        message:
          e instanceof FoodAiError && e.code === 'not_pro'
            ? e.message
            : 'OverloadGPT could not be reached, so these come from the food library.',
        portions: parsed.items.map((i) => {
          const base = defaultPortion(i.food);
          const unit = i.unit ?? base.unit;
          return {
            ...base,
            unit,
            amount: i.amount,
            size: unit === 'katori' || unit === 'cup' ? 'medium' : null,
          };
        }),
        unknown: parsed.unknown,
      });
    }
  }

  const portions = state.kind === 'done' || state.kind === 'fallback' ? state.portions : [];

  return (
    <div className="flex flex-col gap-3" data-ai-food>
      <label className="type-meta text-text-2" htmlFor="ai-food">
        Say it the way you would tell a friend, in English or Hinglish. Brands, restaurants and home
        food all work.
      </label>
      <div className="relative">
        <textarea
          id="ai-food"
          data-autofocus
          value={text}
          maxLength={FOOD_LIMITS.text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="2 aloo parathas with curd, a scoop of ON whey in milk, Domino's farmhouse pizza 2 slices"
          className="type-body w-full resize-none rounded-field bg-surface-2 p-3 pr-12 text-text-1 placeholder:text-text-3"
        />
        {Speech ? (
          <button
            type="button"
            onClick={listen}
            aria-label={listening ? 'Stop listening' : 'Speak your meal'}
            aria-pressed={listening}
            data-voice
            className={cn(
              'pressable tap-target absolute right-2 bottom-2 inline-flex size-9 items-center justify-center rounded-full',
              listening ? 'animate-pulse bg-lime text-on-lime' : 'bg-surface text-text-1',
            )}
          >
            {listening ? (
              <MicOff className="size-5" aria-hidden />
            ) : (
              <Mic className="size-5" aria-hidden />
            )}
          </button>
        ) : null}
      </div>
      {listening ? (
        <p className="type-meta text-text-2" aria-live="polite" data-voice-live>
          {heard ? (
            <span className="text-text-1">{heard}</span>
          ) : (
            'Listening… say what you ate, then pause.'
          )}
        </p>
      ) : null}
      {voiceError ? (
        <p className="type-meta text-text-2" role="status" data-voice-error>
          {voiceError}
        </p>
      ) : null}

      {state.kind === 'asking' ? (
        <Thinking />
      ) : portions.length || state.kind !== 'idle' ? (
        <div className="type-meta text-text-2" aria-live="polite" data-ai-result>
          {state.kind === 'fallback' ? (
            <p className="mb-2">{state.message}</p>
          ) : portions.length ? (
            <div className="ai-surface mb-3 rounded-panel p-4">
              <AiByline className="mb-2" />
              <p className="type-answer text-text-1">
                Found {portions.length} {portions.length === 1 ? 'food' : 'foods'}. Adjust anything
                on your plate before you log it.
              </p>
            </div>
          ) : null}
          {portions.length ? (
            <ul className="flex flex-col gap-2">
              {portions.map((p, i) => (
                <AiItemRow
                  key={i}
                  portion={p}
                  katoriMl={ctx.katoriMl}
                  onChange={(next) =>
                    setState((st) =>
                      st.kind === 'done' || st.kind === 'fallback'
                        ? { ...st, portions: st.portions.map((x, j) => (j === i ? next : x)) }
                        : st,
                    )
                  }
                />
              ))}
            </ul>
          ) : (
            <p>No foods found in that. Try naming what you ate.</p>
          )}
          {state.kind === 'fallback' && state.unknown.length ? (
            <p className="mt-2">Not in the library: {state.unknown.join(', ')}.</p>
          ) : null}
        </div>
      ) : null}

      {portions.length ? (
        <div className="flex flex-col gap-2">
          <PrimaryButton block onClick={() => onFill(portions)}>
            Put on my plate
          </PrimaryButton>
          <SecondaryButton block compact onClick={() => void ask()}>
            Ask again
          </SecondaryButton>
        </div>
      ) : (
        <PrimaryButton
          block
          disabled={!text.trim() || state.kind === 'asking'}
          onClick={() => void ask()}
          icon={<Sparkles className="size-4" aria-hidden />}
        >
          Work it out
        </PrimaryButton>
      )}
      <p className="type-caption text-text-3">
        What you type is sent to a third-party AI service to work out the numbers. Check the
        portions on your plate before logging.
      </p>
    </div>
  );
}
