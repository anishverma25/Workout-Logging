import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Sparkles } from 'lucide-react';
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

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

function speechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    (new () => SpeechRecognitionLike) | null;
}

type State =
  | { kind: 'idle' }
  | { kind: 'asking' }
  | { kind: 'done'; portions: FoodPortion[] }
  | { kind: 'fallback'; message: string; portions: FoodPortion[]; unknown: string[] };

export function AiFoodLog({
  ctx,
  onFill,
}: {
  ctx: FoodContext;
  onFill: (items: FoodPortion[]) => void;
}) {
  const store = useCoachStore();
  const [text, setText] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const Speech = useMemo(() => speechRecognition(), []);

  useEffect(() => () => recognition.current?.stop(), []);

  if (!store.consent) return <CoachConsent />;

  function listen() {
    if (!Speech) return;
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const r = new Speech();
    r.lang = 'en-IN';
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const said = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (said) setText((t) => (t.trim() ? `${t.trim()}, ${said}` : said));
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognition.current = r;
    setListening(true);
    r.start();
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
            className="pressable tap-target absolute right-2 bottom-2 inline-flex size-9 items-center justify-center rounded-full bg-surface text-text-1"
          >
            {listening ? (
              <MicOff className="size-5" aria-hidden />
            ) : (
              <Mic className="size-5" aria-hidden />
            )}
          </button>
        ) : null}
      </div>

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
                <AiItemRow key={i} portion={p} katoriMl={ctx.katoriMl} />
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
