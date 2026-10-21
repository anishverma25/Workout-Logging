import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Crown, Globe, Mic, Plus, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router';
import {
  BottomSheet,
  ListRow,
  PrimaryButton,
  SearchField,
  SecondaryButton,
  SegmentedControl,
} from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
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
import { mealTemplates, recentFoods, type MealTemplate } from '@/domain/nutrition/analysis';
import { portionText, roundNutrients, sumNutrients, type Food } from '@/domain/nutrition/calc';
import { fitsDiet, searchFoods } from '@/domain/nutrition/search';
import { MEALS, ZERO, type Meal } from '@/domain/nutrition/types';
import { haptic } from '@/lib/haptics';
import { AiFoodLog } from './AiFoodLog';
import { defaultPortion } from './foodText';
import { NutrientLine, PortionEditor } from './PortionEditor';
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
  onCreateFood,
}: {
  open: boolean;
  onClose: () => void;
  ctx: FoodContext;
  date: string;
  meal: Meal;
  onCreateFood: (name: string) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Add food" hideHeader wide>
      {open ? (
        <AddFoodBody
          ctx={ctx}
          date={date}
          initialMeal={meal}
          onDone={onClose}
          onCreateFood={onCreateFood}
        />
      ) : null}
    </BottomSheet>
  );
}

type View = { kind: 'pick' } | { kind: 'edit'; index: number } | { kind: 'type' };

function AddFoodBody({
  ctx,
  date,
  initialMeal,
  onDone,
  onCreateFood,
}: {
  ctx: FoodContext;
  date: string;
  initialMeal: Meal;
  onDone: () => void;
  onCreateFood: (name: string) => void;
}) {
  const toast = useToast();
  const pro = useFeature('ai_food');
  useEffect(() => {
    void loadMoreFoods();
  }, []);
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

  const add = (food: Food) => {
    haptic('light');
    setPlate((p) => [...p, portionFor(food)]);
    setQuery('');
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
                onClick={() => setView({ kind: 'edit', index: i })}
                className="pressable chrome type-meta inline-flex h-9 items-center gap-1 rounded-l-full bg-surface-2 pr-2 pl-3 font-semibold text-text-1"
              >
                {portionText(p.amount, p.unit, p.size, p.food.pieceName)}{' '}
                {p.unit === 'piece' && p.food.pieceName ? '' : p.food.name.toLowerCase()}
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
        <PortionEditor
          portion={p}
          katoriMl={ctx.katoriMl}
          onChange={(next) => setPlate((list) => list.map((x, j) => (j === view.index ? next : x)))}
        />
        <PrimaryButton block onClick={() => setView({ kind: 'pick' })}>
          Done
        </PrimaryButton>
      </div>
    );
  }

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
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 -mx-5 flex flex-col gap-3 bg-surface px-5 pt-5 pb-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="type-title text-text-1">Add food</h2>
          <button
            type="button"
            onClick={onDone}
            aria-label="Close"
            className="pressable tap-target inline-flex size-9 items-center justify-center rounded-full bg-surface-2 text-text-2"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <SegmentedControl<Meal>
          label="Meal"
          block
          value={meal}
          onChange={setMeal}
          options={MEALS.map((m) => ({ value: m, label: MEAL_LABEL[m] }))}
        />
        <SearchField
          label="Search food"
          value={query}
          onChange={setQuery}
          placeholder="Dal, roti, paneer, chai…"
        />
      </div>
      <div className="pt-2 pb-4">
        {query.trim() ? (
          <Results
            ctx={ctx}
            query={query}
            onPick={add}
            onCreate={() => onCreateFood(query.trim())}
          />
        ) : (
          <Quick
            ctx={ctx}
            meal={meal}
            date={date}
            pro={pro}
            onTemplate={(t) => void logTemplate(t)}
            onPick={add}
            onType={() => setView({ kind: 'type' })}
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

function FoodRow({
  food,
  ctx,
  onPick,
}: {
  food: Food;
  ctx: FoodContext;
  onPick: (f: Food) => void;
}) {
  const detail = describe(food, ctx.katoriMl);
  return (
    <li>
      <ListRow
        title={food.name}
        subtitle={detail}
        onClick={() => onPick(food)}
        trailing={<Plus className="size-5 shrink-0 text-text-2" aria-hidden />}
        className="px-1"
      />
    </li>
  );
}

/** "1 katori · 139 kcal · 7 g protein" for a food at its usual portion. */
function describe(food: Food, katoriMl: number | null): string {
  try {
    const p = defaultPortion(food);
    const m = measurePortion(p, katoriMl);
    return `${portionText(p.amount, p.unit, p.size, food.pieceName)} · ${m.nutrients.kcal} kcal · ${m.nutrients.proteinG.toFixed(0)} g protein`;
  } catch {
    return '';
  }
}

const DIET_WORD = {
  veg: 'vegetarian',
  egg: 'eggetarian',
  nonveg: 'non-vegetarian',
  jain: 'Jain',
} as const;

function Results({
  ctx,
  query,
  onPick,
  onCreate,
}: {
  ctx: FoodContext;
  query: string;
  onPick: (f: Food) => void;
  onCreate: () => void;
}) {
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
            <FoodRow key={f.id} food={f} ctx={ctx} onPick={onPick} />
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
  ctx,
  meal,
  date,
  pro,
  onTemplate,
  onPick,
  onType,
  onCreate,
}: {
  ctx: FoodContext;
  meal: Meal;
  date: string;
  pro: boolean;
  onTemplate: (t: MealTemplate) => void;
  onPick: (f: Food) => void;
  onType: () => void;
  onCreate: () => void;
}) {
  const templates = useMemo(() => mealTemplates(ctx.logs, meal, date), [ctx.logs, meal, date]);
  const recent = useMemo(
    () =>
      recentFoods(ctx.logs, 10)
        .map((l) => ctx.foodById.get(l.foodId))
        .filter((f): f is Food => Boolean(f)),
    [ctx.logs, ctx.foodById],
  );
  const starters = STARTER_FOODS[meal]
    .map((id) => ctx.foodById.get(id))
    .filter((f): f is Food => Boolean(f) && fitsDiet(f!, ctx.diet) && !recent.includes(f!));

  return (
    <div className="flex flex-col gap-5">
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

      <AiHero pro={pro} onOpen={onType} />

      {recent.length ? (
        <section aria-labelledby="recent-foods">
          <h3 id="recent-foods" className="type-meta mb-1 font-semibold text-text-2">
            Recent
          </h3>
          <ul className="flex flex-col">
            {recent.map((f) => (
              <FoodRow key={f.id} food={f} ctx={ctx} onPick={onPick} />
            ))}
          </ul>
        </section>
      ) : null}

      {starters.length ? (
        <section aria-labelledby="starter-foods">
          <h3 id="starter-foods" className="type-meta mb-1 font-semibold text-text-2">
            Often eaten at {MEAL_LABEL[meal].toLowerCase()}
          </h3>
          <ul className="flex flex-col">
            {starters.map((f) => (
              <FoodRow key={f.id} food={f} ctx={ctx} onPick={onPick} />
            ))}
          </ul>
        </section>
      ) : null}

      <SecondaryButton compact onClick={onCreate} icon={<Plus className="size-4" aria-hidden />}>
        Add your own food or family recipe
      </SecondaryButton>
    </div>
  );
}

/**
 * The way in to AI food logging. Pro opens it; free accounts see what it does and where to
 * get it, because this is the fastest and most complete way to log.
 */
function AiHero({ pro, onOpen }: { pro: boolean; onOpen: () => void }) {
  const body = (
    <>
      <span className="flex items-center gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-lime-dim text-lime">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="type-headline block text-text-1">Tell OverloadGPT what you ate</span>
          <span className="type-meta block text-text-2">
            Any food, any brand, any restaurant. Type it or say it.
          </span>
        </span>
        <span className="type-caption inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2 py-1 font-semibold text-text-2">
          <Crown className="size-3.5" aria-hidden />
          Pro
        </span>
      </span>
      <span className="type-caption mt-3 flex flex-wrap gap-x-4 gap-y-1 text-text-2">
        <span className="inline-flex items-center gap-1">
          <Globe className="size-3.5" aria-hidden />
          Looks up labels and menus
        </span>
        <span className="inline-flex items-center gap-1">
          <Mic className="size-3.5" aria-hidden />
          Speak in English or Hinglish
        </span>
      </span>
      {pro ? null : (
        <span className="type-meta mt-3 block font-semibold text-text-1">
          Get Pro for the quickest, most accurate logging
        </span>
      )}
    </>
  );
  const cls =
    'pressable chrome block w-full rounded-nested border-[0.5px] border-divider bg-surface-2 p-4 text-left';
  return pro ? (
    <button type="button" onClick={onOpen} className={cls} data-type-meal>
      {body}
    </button>
  ) : (
    <Link to="/pro" className={cls} data-type-meal>
      {body}
    </Link>
  );
}
