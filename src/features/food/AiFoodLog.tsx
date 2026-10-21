import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Globe, Mic, MicOff, Sparkles } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '@/components/kit';
import { useCoachStore } from '@/app/coach';
import { askFoodLog, FOOD_LIMITS, FoodAiError, foodFromItem, type FoodItem } from '@/app/foodAi';
import { measurePortion, type FoodPortion } from '@/data/repositories/food';
import { normalize } from '@/domain/exercises/search';
import { portionText, type Food } from '@/domain/nutrition/calc';
import { parseMeal } from '@/domain/nutrition/parse';
import { fitsDiet } from '@/domain/nutrition/search';
import { CoachConsent, Thinking } from '../coach/CoachParts';
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

/** A library food with exactly this name or alias, so its own values are used. */
function libraryMatch(item: FoodItem, ctx: FoodContext): Food | null {
  const name = normalize(item.name);
  for (const f of ctx.foods) {
    if (f.source === 'usda' || f.source === 'indb') continue;
    if (normalize(f.name) === name || f.aliases.some((a) => normalize(a) === name))
      return fitsDiet(f, ctx.diet) || item.diet === f.diet ? f : null;
  }
  return null;
}

/** The portion for an item: pieces when the library food has them and the weight agrees. */
function portionForItem(item: FoodItem, ctx: FoodContext): FoodPortion {
  const food = libraryMatch(item, ctx);
  if (!food) return defaultPortion(foodFromItem(item));
  const count = Number(/^\s*(\d+(?:\.\d+)?)/.exec(item.portion)?.[1] ?? '1');
  if (food.pieceG && food.units.includes('piece')) {
    const each = item.grams / count;
    if (each > food.pieceG * 0.6 && each < food.pieceG * 1.6)
      return { ...defaultPortion(food), unit: 'piece', amount: count };
  }
  if (food.units.includes('g'))
    return {
      food,
      amount: item.grams,
      unit: 'g',
      size: null,
      oilLevel: food.fatPer100 ? 'normal' : null,
    };
  return defaultPortion(food);
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
          {state.kind === 'fallback' ? <p className="mb-2">{state.message}</p> : null}
          {portions.length ? (
            <ul className="flex flex-col gap-2">
              {portions.map((p, i) => (
                <ItemRow key={i} portion={p} katoriMl={ctx.katoriMl} />
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

function ItemRow({ portion, katoriMl }: { portion: FoodPortion; katoriMl: number | null }) {
  const f = portion.food;
  const amount =
    f.ai && portion.unit === 'serving'
      ? `${f.ai.portion} (${f.servingG} g)`
      : portionText(portion.amount, portion.unit, portion.size, f.pieceName);
  let kcal: number | null = null;
  let protein: number | null = null;
  try {
    const m = measurePortion(portion, katoriMl);
    kcal = Math.round(m.nutrients.kcal);
    protein = Math.round(m.nutrients.proteinG);
  } catch {
    // Shown without numbers; the plate measures it again.
  }
  return (
    <li className="flex items-start gap-3 rounded-nested bg-surface-2 p-3">
      <span className="min-w-0 flex-1">
        <span className="type-headline block text-text-1">{f.name}</span>
        {f.ai?.ref ? <span className="type-caption block text-text-3">{f.ai.ref}</span> : null}
        <span className="type-meta block text-text-2">
          {amount}
          {kcal !== null ? ` · ${kcal} kcal · ${protein} g protein` : ''}
        </span>
      </span>
      <span className="type-caption inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2 py-1 font-semibold text-text-2">
        {f.ai ? (
          f.ai.basis === 'web' ? (
            <>
              <Globe className="size-3.5" aria-hidden />
              From the web
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" aria-hidden />
              Estimated
            </>
          )
        ) : (
          <>
            <Check className="size-3.5" aria-hidden />
            Library
          </>
        )}
      </span>
    </li>
  );
}
