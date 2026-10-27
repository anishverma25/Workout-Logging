import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Crown,
  Mic,
  Minus,
  Plus,
  ScanText,
  Sparkles,
  X,
} from 'lucide-react';
import { Link } from 'react-router';
import {
  BottomSheet,
  PrimaryButton,
  SearchField,
  SecondaryButton,
  SegmentedControl,
} from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { warmAi } from '@/app/aiWarm';
import { useFeature } from '@/app/entitlement';
import { db } from '@/data/db';
import { STARTER_FOODS } from '@/data/library/foods';
import { loadMoreFoods } from '@/data/library/moreFoods';
import {
  copyFoodLogs,
  deleteFoodLogs,
  FoodError,
  keepPlateFoods,
  logFoods,
  measurePortion,
  type FoodPortion,
} from '@/data/repositories/food';
import type { FoodLog } from '@/domain/models/schemas';
import {
  mealFoods,
  mealTemplates,
  recentFoods,
  type MealTemplate,
} from '@/domain/nutrition/analysis';
import { portionText, roundNutrients, sumNutrients, type Food } from '@/domain/nutrition/calc';
import { fitsDiet, searchFoods } from '@/domain/nutrition/search';
import { MEALS, ZERO, type Meal } from '@/domain/nutrition/types';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';
import { AiFoodLog } from './AiFoodLog';
import { PhotoFoodLog } from './PhotoFoodLog';
import { LabelLog } from './LabelLog';
import { defaultPortion } from './foodText';
import { FoodProfile } from './FoodProfile';
import { NutrientLine } from './PortionEditor';
import { MEAL_LABEL, type FoodContext } from './useFoodContext';

/**
 * Logging a meal: the usual meal and the last one in one tap, then a thali built by tapping
 * foods (each lands on the plate with the portion used last time), adjusted by tapping it on
 * the plate, and logged together. Pro can type the whole meal in one line.
 */
export function AddFoodSheet({
  open,
  onClose,
  ctx,
  date,
  meal,
  lockMeal = false,
  onCreateFood,
}: {
  open: boolean;
  onClose: () => void;
  ctx: FoodContext;
  date: string;
  meal: Meal;
  /** Opened from one meal's +: everything goes to that meal and there is no meal picker. */
  lockMeal?: boolean;
  onCreateFood: (name: string) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Add food" hideHeader wide tall>
      {open ? (
        <AddFoodBody
          ctx={ctx}
          date={date}
          initialMeal={meal}
          lockMeal={lockMeal}
          onDone={onClose}
          onCreateFood={onCreateFood}
        />
      ) : null}
    </BottomSheet>
  );
}

type View =
  | { kind: 'pick' }
  | { kind: 'edit'; index: number }
  | { kind: 'type' }
  | { kind: 'photo' }
  | { kind: 'label' }
  | { kind: 'food'; portion: FoodPortion };

function AddFoodBody({
  ctx,
  date,
  initialMeal,
  lockMeal,
  onDone,
  onCreateFood,
}: {
  ctx: FoodContext;
  date: string;
  initialMeal: Meal;
  lockMeal: boolean;
  onDone: () => void;
  onCreateFood: (name: string) => void;
}) {
  const toast = useToast();
  const pro = useFeature('ai_food');
  useEffect(() => {
    void loadMoreFoods();
  }, []);
  // Pro may snap or type the meal: start the AI server while they choose.
  useEffect(() => {
    if (pro) warmAi();
  }, [pro]);
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [query, setQuery] = useState('');
  const [plate, setPlate] = useState<FoodPortion[]>([]);
  const [view, setView] = useState<View>({ kind: 'pick' });
  const [busy, setBusy] = useState(false);

  const last = useMemo(() => {
    const map = new Map<string, FoodLog>();
    for (const l of recentFoods(ctx.logs, 200)) map.set(l.foodId, l);
    return map;
  }, [ctx.logs]);

  /** The portion this person used last time, else the food's usual one. */
  const portionFor = (food: Food): FoodPortion => {
    const prev = last.get(food.id);
    if (prev && food.units.includes(prev.unit))
      return {
        food,
        amount: prev.amount,
        unit: prev.unit,
        size: prev.size,
        oilLevel: prev.oilLevel,
      };
    return defaultPortion(food);
  };
  const hasHistory = (food: Food) => {
    const prev = last.get(food.id);
    return !!prev && food.units.includes(prev.unit);
  };

  /**
   * Puts a portion on the plate. The same food in the same measure adds up ("2 rotis", then "4
   * rotis") instead of becoming a second line. The screen stays where it is, search and all.
   */
  const putOnPlate = (portion: FoodPortion) =>
    setPlate((list) => {
      const i = list.findIndex(
        (p) => p.food.id === portion.food.id && p.unit === portion.unit && p.size === portion.size,
      );
      if (i < 0) return [...list, portion];
      return list.map((p, j) =>
        j === i ? { ...p, amount: Math.round((p.amount + portion.amount) * 100) / 100 } : p,
      );
    });

  const add = (food: Food) => {
    haptic('light');
    putOnPlate(portionFor(food));
  };

  /** One step less of a food on the plate (the amount one tap adds), off the plate at zero. */
  const takeOne = (food: Food) => {
    haptic('light');
    const step = portionFor(food);
    setPlate((list) => {
      const i = list.findLastIndex((p) => p.food.id === food.id);
      if (i < 0) return list;
      const p = list[i]!;
      const less = p.unit === step.unit ? p.amount - step.amount : 0;
      return less > 0.001
        ? list.map((x, j) => (j === i ? { ...x, amount: Math.round(less * 100) / 100 } : x))
        : list.filter((_, j) => j !== i);
    });
  };

  /** What of each food is on the plate now, for the rows. */
  const onPlate = useMemo(() => {
    const map = new Map<string, FoodPortion>();
    for (const p of plate) if (!map.has(p.food.id)) map.set(p.food.id, p);
    return map;
  }, [plate]);

  // Coming back from a food's profile or the plate keeps the list where it was.
  const pickRef = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(0);
  const leave = (next: View) => {
    const scroller = pickRef.current?.closest('[data-sheet-body]');
    if (scroller) scrollTop.current = scroller.scrollTop;
    setView(next);
  };
  useLayoutEffect(() => {
    if (view.kind !== 'pick') return;
    const scroller = pickRef.current?.closest('[data-sheet-body]');
    if (scroller && scrollTop.current) scroller.scrollTop = scrollTop.current;
  }, [view.kind]);

  /** Opens the food's profile to see its nutrients and set the amount before adding it. */
  const open = (food: Food) => leave({ kind: 'food', portion: portionFor(food) });

  const rows: RowProps = {
    ctx,
    stepFor: portionFor,
    hasHistory,
    onPlate,
    onPick: open,
    onAdd: add,
    onRemove: takeOne,
  };

  const totals = roundNutrients(
    sumNutrients(
      plate.map((p) => {
        try {
          return measurePortion(p, ctx.katoriMl).nutrients;
        } catch {
          return ZERO;
        }
      }),
    ),
  );

  async function logPlate() {
    setBusy(true);
    try {
      const kept = await keepPlateFoods(db, plate);
      const logs = await logFoods(db, kept, { date, meal, katoriMl: ctx.katoriMl });
      haptic('medium');
      toast(
        `Logged ${logs.length === 1 ? logs[0]!.foodName : `${logs.length} foods`} to ${MEAL_LABEL[meal].toLowerCase()}`,
        {
          label: 'Undo',
          onSelect: () =>
            void deleteFoodLogs(
              db,
              logs.map((l) => l.id),
            ),
        },
      );
      onDone();
    } catch (e) {
      toast(e instanceof FoodError ? e.message : 'Could not log that. Try again.');
      setBusy(false);
    }
  }

  async function logTemplate(t: MealTemplate) {
    const logs = await copyFoodLogs(db, t.items, { date, meal });
    haptic('medium');
    toast(
      `Logged your ${t.kind === 'usual' ? 'usual' : 'last'} ${MEAL_LABEL[meal].toLowerCase()}`,
      {
        label: 'Undo',
        onSelect: () =>
          void deleteFoodLogs(
            db,
            logs.map((l) => l.id),
          ),
      },
    );
    onDone();
  }

  const footer =
    plate.length > 0 && view.kind !== 'edit' ? (
      <div className="flex flex-col gap-3" data-plate>
        <ul className="flex flex-wrap gap-2" aria-label="On your plate">
          {plate.map((p, i) => (
            <li key={`${p.food.id}-${i}`} className="flex">
              <button
                type="button"
                onClick={() => leave({ kind: 'edit', index: i })}
                className="pressable chrome type-meta inline-flex h-9 items-center gap-1 rounded-l-full bg-surface-2 pr-2 pl-3 font-semibold text-text-1"
              >
                {portionText(p.amount, p.unit, p.size, p.food.pieceName)}{' '}
                {p.unit === 'piece' && p.food.pieceName && p.food.pieceName[0] !== 'serving'
                  ? ''
                  : p.food.name.toLowerCase()}
              </button>
              <button
                type="button"
                aria-label={`Remove ${p.food.name}`}
                onClick={() => setPlate((list) => list.filter((_, j) => j !== i))}
                className="pressable chrome inline-flex h-9 items-center rounded-r-full bg-surface-2 pr-2.5 pl-1 text-text-2"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-3">
          <NutrientLine kcal={totals.kcal} proteinG={totals.proteinG} />
          <PrimaryButton onClick={() => void logPlate()} loading={busy} data-log-plate>
            Log to {MEAL_LABEL[meal].toLowerCase()}
          </PrimaryButton>
        </div>
      </div>
    ) : null;

  if (view.kind === 'edit') {
    const p = plate[view.index];
    if (!p) {
      setView({ kind: 'pick' });
      return null;
    }
    return (
      <div className="flex flex-col gap-4 pt-5">
        <BackRow label={p.food.name} onBack={() => setView({ kind: 'pick' })} />
        <FoodProfile
          portion={p}
          katoriMl={ctx.katoriMl}
          targets={ctx.targets}
          actionLabel="Done"
          onChange={(next) => setPlate((list) => list.map((x, j) => (j === view.index ? next : x)))}
          onDone={() => setView({ kind: 'pick' })}
        />
      </div>
    );
  }

  if (view.kind === 'food')
    return (
      <div className="flex flex-col gap-4 pt-5">
        <BackRow label={view.portion.food.name} onBack={() => setView({ kind: 'pick' })} />
        <FoodProfile
          portion={view.portion}
          katoriMl={ctx.katoriMl}
          targets={ctx.targets}
          actionLabel="Add to plate"
          onChange={(next) => setView({ kind: 'food', portion: next })}
          onDone={() => {
            haptic('light');
            putOnPlate(view.portion);
            setView({ kind: 'pick' });
          }}
        />
      </div>
    );

  if (view.kind === 'photo')
    return (
      <div className="flex flex-col gap-4 pt-5">
        <BackRow label="Snap your plate" onBack={() => setView({ kind: 'pick' })} />
        <PhotoFoodLog
          ctx={ctx}
          meal={meal}
          onType={() => setView({ kind: 'type' })}
          onFill={(items) => {
            setPlate((p) => [...p, ...items]);
            setView({ kind: 'pick' });
          }}
        />
      </div>
    );

  if (view.kind === 'label')
    return (
      <div className="flex flex-col gap-4 pt-5">
        <BackRow label="From a pack" onBack={() => setView({ kind: 'pick' })} />
        <LabelLog
          pro={pro}
          onFill={(items) => {
            setPlate((p) => [...p, ...items]);
            setView({ kind: 'pick' });
          }}
        />
      </div>
    );

  if (view.kind === 'type')
    return (
      <div className="flex flex-col gap-4 pt-5">
        <BackRow label="Tell OverloadGPT" onBack={() => setView({ kind: 'pick' })} />
        <AiFoodLog
          ctx={ctx}
          onFill={(items) => {
            setPlate((p) => [...p, ...items]);
            setView({ kind: 'pick' });
          }}
        />
      </div>
    );

  return (
    <div className="flex flex-col" ref={pickRef}>
      <div className="sticky top-0 z-10 -mx-5 flex flex-col gap-3 bg-surface px-5 pt-5 pb-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="type-title text-text-1">
            {lockMeal ? `Add to ${MEAL_LABEL[meal].toLowerCase()}` : 'Add food'}
          </h2>
          <button
            type="button"
            onClick={onDone}
            aria-label="Close"
            className="pressable tap-target inline-flex size-9 items-center justify-center rounded-full bg-surface-2 text-text-2"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {lockMeal ? null : (
          <SegmentedControl<Meal>
            label="Meal"
            block
            value={meal}
            onChange={setMeal}
            options={MEALS.map((m) => ({ value: m, label: MEAL_LABEL[m] }))}
          />
        )}
        <SearchField
          label="Search food"
          value={query}
          onChange={setQuery}
          placeholder="Dal, roti, paneer, chai…"
        />
      </div>
      <div className="pt-2 pb-4">
        {query.trim() ? (
          <Results rows={rows} query={query} onCreate={() => onCreateFood(query.trim())} />
        ) : (
          <Quick
            rows={rows}
            meal={meal}
            date={date}
            pro={pro}
            onTemplate={(t) => void logTemplate(t)}
            onType={() => leave({ kind: 'type' })}
            onPhoto={() => leave({ kind: 'photo' })}
            onLabel={() => leave({ kind: 'label' })}
            onCreate={() => onCreateFood('')}
          />
        )}
      </div>
      {footer ? (
        <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 border-t-[0.5px] border-divider bg-surface px-5 pt-3 pb-5">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

function BackRow({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="pressable tap-target -ml-2 inline-flex size-9 items-center justify-center rounded-full text-text-1"
      >
        <ChevronLeft className="size-6" aria-hidden />
      </button>
      <h2 className="type-title min-w-0 truncate text-text-1">{label}</h2>
    </div>
  );
}

interface RowProps {
  ctx: FoodContext;
  /** What one tap of + adds: the amount from last time, else the usual portion. */
  stepFor: (f: Food) => FoodPortion;
  hasHistory: (f: Food) => boolean;
  onPlate: Map<string, FoodPortion>;
  onPick: (f: Food) => void;
  onAdd: (f: Food) => void;
  onRemove: (f: Food) => void;
}

function FoodRow({ food, rows }: { food: Food; rows: RowProps }) {
  const step = rows.stepFor(food);
  const detail = describe(step, rows.ctx.katoriMl, rows.hasHistory(food));
  const there = rows.onPlate.get(food.id);
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => rows.onPick(food)}
        className="pressable chrome flex min-h-14 min-w-0 flex-1 flex-col justify-center rounded-nested px-1 py-2 text-left"
        data-food-row={food.id}
      >
        <span className="type-headline block truncate text-text-1">{food.name}</span>
        {detail ? (
          <span className="type-meta tabular block truncate text-text-2">{detail}</span>
        ) : null}
        {there ? (
          <span
            className="type-caption tabular block truncate font-semibold text-lime"
            data-on-plate
          >
            On your plate: {portionText(there.amount, there.unit, there.size, food.pieceName)}
          </span>
        ) : null}
      </button>
      {there ? (
        <button
          type="button"
          onClick={() => rows.onRemove(food)}
          aria-label={`Less ${food.name}`}
          className="pressable tap-target inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-1"
          data-quick-remove
        >
          <Minus className="size-5" aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => rows.onAdd(food)}
        aria-label={`Add ${portionText(step.amount, step.unit, step.size, food.pieceName)} of ${food.name} to plate`}
        className={cn(
          'pressable tap-target inline-flex size-10 shrink-0 items-center justify-center rounded-full',
          there ? 'bg-lime text-on-lime' : 'bg-surface-2 text-text-1',
        )}
        data-quick-add
      >
        <Plus className="size-5" aria-hidden />
      </button>
    </li>
  );
}

/**
 * "Last time: 2 rotis · 204 kcal · 7 g protein" (or the usual portion for a food not eaten
 * before): exactly what one tap of + adds, numbers in bold.
 */
function describe(p: FoodPortion, katoriMl: number | null, fromHistory: boolean) {
  try {
    const m = measurePortion(p, katoriMl);
    return (
      <>
        {fromHistory ? 'Last time: ' : ''}
        {portionText(p.amount, p.unit, p.size, p.food.pieceName)} ·{' '}
        <strong className="font-semibold text-text-1">{m.nutrients.kcal} kcal</strong> ·{' '}
        <strong className="font-semibold text-text-1">{m.nutrients.proteinG.toFixed(0)} g</strong>{' '}
        protein
      </>
    );
  } catch {
    return null;
  }
}

const DIET_WORD = {
  veg: 'vegetarian',
  egg: 'eggetarian',
  nonveg: 'non-vegetarian',
  jain: 'Jain',
} as const;

function Results({
  rows,
  query,
  onCreate,
}: {
  rows: RowProps;
  query: string;
  onCreate: () => void;
}) {
  const { ctx } = rows;
  const results = useMemo(
    () => searchFoods(ctx.foods, query, ctx.diet),
    [ctx.foods, query, ctx.diet],
  );
  const hidden = useMemo(
    () => results.length === 0 && !!ctx.diet && searchFoods(ctx.foods, query, null, 1).length > 0,
    [results.length, ctx.foods, query, ctx.diet],
  );
  return (
    <div data-food-results>
      {results.length ? (
        <ul className="flex flex-col">
          {results.map((f) => (
            <FoodRow key={f.id} food={f} rows={rows} />
          ))}
        </ul>
      ) : (
        <p className="type-meta rounded-nested bg-surface-2 p-4 text-center text-text-2">
          {hidden
            ? `“${query.trim()}” does not fit your ${DIET_WORD[ctx.diet!]} diet. You can change your diet in food settings.`
            : `No food called “${query.trim()}” yet. Tell OverloadGPT and it will find it.`}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <SecondaryButton compact onClick={onCreate} icon={<Plus className="size-4" aria-hidden />}>
          Add your own
        </SecondaryButton>
        <Link
          to={`/feedback?message=${encodeURIComponent(`Please add this dish: ${query.trim()}`)}`}
          className="pressable type-meta inline-flex h-9 items-center px-2 font-semibold text-text-2"
        >
          Suggest this dish
        </Link>
      </div>
    </div>
  );
}

function Quick({
  rows,
  meal,
  date,
  pro,
  onTemplate,
  onType,
  onPhoto,
  onLabel,
  onCreate,
}: {
  rows: RowProps;
  meal: Meal;
  date: string;
  pro: boolean;
  onLabel: () => void;
  onTemplate: (t: MealTemplate) => void;
  onType: () => void;
  onPhoto: () => void;
  onCreate: () => void;
}) {
  const { ctx } = rows;
  const templates = useMemo(() => mealTemplates(ctx.logs, meal, date), [ctx.logs, meal, date]);
  const lists = useMemo(() => mealFoods(ctx.logs, meal, date), [ctx.logs, meal, date]);
  const foodsOf = (logs: { foodId: string }[]) =>
    logs.map((l) => ctx.foodById.get(l.foodId)).filter((f): f is Food => Boolean(f));
  const recent = foodsOf(lists.recent);
  const usual = foodsOf(lists.usual.map((u) => u.log));
  const starters = STARTER_FOODS[meal]
    .map((id) => ctx.foodById.get(id))
    .filter(
      (f): f is Food =>
        Boolean(f) && fitsDiet(f!, ctx.diet) && !recent.includes(f!) && !usual.includes(f!),
    );

  return (
    <div className="flex flex-col gap-5">
      {recent.length ? (
        <FoodList id="recent-foods" title="Recently eaten" foods={recent} rows={rows} />
      ) : null}
      {usual.length ? (
        <FoodList
          id="usual-foods"
          title={`Usually at ${MEAL_LABEL[meal].toLowerCase()}`}
          foods={usual}
          rows={rows}
        />
      ) : null}

      {templates.length ? (
        <section aria-label="Log again">
          <ul className="flex flex-col gap-2">
            {templates.map((t) => {
              const n = roundNutrients(
                sumNutrients(
                  t.items.map((i) => ({
                    kcal: i.kcal,
                    proteinG: i.proteinG,
                    carbsG: i.carbsG,
                    fatG: i.fatG,
                    fibreG: i.fibreG,
                  })),
                ),
              );
              return (
                <li key={t.kind}>
                  <div
                    className="flex items-center gap-3 rounded-nested bg-surface-2 p-3"
                    data-template={t.kind}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="type-headline text-text-1">
                        {t.kind === 'usual'
                          ? `Your usual ${MEAL_LABEL[meal].toLowerCase()}`
                          : `Same as last time`}
                      </p>
                      <p className="type-meta truncate text-text-2">
                        {t.items.map((i) => i.foodName).join(', ')} · {n.kcal} kcal
                      </p>
                    </div>
                    <PrimaryButton compact onClick={() => onTemplate(t)}>
                      Log
                    </PrimaryButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <AiHero pro={pro} onType={onType} onPhoto={onPhoto} />
      <button
        type="button"
        onClick={onLabel}
        className="pressable chrome flex w-full items-center gap-3 rounded-nested bg-surface-2 p-4 text-left"
        data-pack-food
      >
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-text-1">
          <ScanText className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="type-headline block text-text-1">From a pack</span>
          <span className="type-meta mt-0.5 block text-text-2">
            Read the nutrition label, or scan the barcode
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-text-3" aria-hidden />
      </button>

      {starters.length ? (
        <FoodList
          id="starter-foods"
          title={`Popular at ${MEAL_LABEL[meal].toLowerCase()}`}
          foods={starters}
          rows={rows}
        />
      ) : null}

      <SecondaryButton compact onClick={onCreate} icon={<Plus className="size-4" aria-hidden />}>
        Add your own food or family recipe
      </SecondaryButton>
    </div>
  );
}

function FoodList({
  id,
  title,
  foods,
  rows,
}: {
  id: string;
  title: string;
  foods: Food[];
  rows: RowProps;
}) {
  return (
    <section aria-labelledby={id} data-food-list={id}>
      <h3 id={id} className="type-meta mb-1 font-semibold text-text-2">
        {title}
      </h3>
      <ul className="flex flex-col">
        {foods.map((f) => (
          <FoodRow key={f.id} food={f} rows={rows} />
        ))}
      </ul>
    </section>
  );
}

/**
 * The way in to AI food logging: a photo of the plate, or the meal typed or spoken. Pro opens
 * them; free accounts see what they do and where to get them, because this is the fastest and
 * most complete way to log.
 */
function AiHero({
  pro,
  onType,
  onPhoto,
}: {
  pro: boolean;
  onType: () => void;
  onPhoto: () => void;
}) {
  const head = (
    <span className="flex items-start gap-3">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-lime-dim text-lime">
        <Sparkles className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="type-headline text-text-1">Let OverloadGPT log it</span>
          <span className="type-caption inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2 py-0.5 font-semibold text-text-2">
            <Crown className="size-3.5" aria-hidden />
            Pro
          </span>
        </span>
        <span className="type-meta mt-0.5 block text-text-2">
          Snap your plate or say what you ate: any food, brand or restaurant.
        </span>
      </span>
    </span>
  );
  const action =
    'pressable chrome type-meta inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-surface px-3 font-semibold text-text-1';
  if (!pro)
    return (
      <Link
        to="/pro"
        className="pressable chrome block w-full rounded-nested border-[0.5px] border-divider bg-surface-2 p-4 text-left"
        data-type-meal
      >
        {head}
        <span className="mt-3 grid grid-cols-2 gap-2" aria-hidden>
          <span className={action}>
            <Camera className="size-4" />
            Snap a photo
          </span>
          <span className={action}>
            <Mic className="size-4" />
            Type or say it
          </span>
        </span>
        <span className="type-meta mt-3 block font-semibold text-text-1">
          Get Pro for the quickest, most accurate logging
        </span>
      </Link>
    );
  return (
    <div className="rounded-nested border-[0.5px] border-divider bg-surface-2 p-4" data-ai-hero>
      {head}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={onPhoto} className={action} data-photo-meal>
          <Camera className="size-4" aria-hidden />
          Snap a photo
        </button>
        <button type="button" onClick={onType} className={action} data-type-meal>
          <Mic className="size-4" aria-hidden />
          Type or say it
        </button>
      </div>
    </div>
  );
}
