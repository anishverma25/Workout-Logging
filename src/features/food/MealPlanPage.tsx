import { useState } from 'react';
import { Check, Copy, ShoppingBasket } from 'lucide-react';
import { useFeature } from '@/app/entitlement';
import { PageHeader } from '@/app/layout/PageHeader';
import { ChipGroup, PrimaryButton, SecondaryButton, TextButton } from '@/components/kit';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { usePreferences } from '@/data/hooks';
import { deleteFoodLogs, FoodError, logFoods } from '@/data/repositories/food';
import { mealPlanFrom, saveMealPlan } from '@/data/repositories/plan';
import { portionText } from '@/domain/nutrition/calc';
import {
  BUDGET_LABEL,
  groceryList,
  planWeek,
  portionOf,
  SETTING_LABEL,
  type Budget,
  type GroceryItem,
  type PlanDay,
  type PlanMeal,
  type Portion,
  type Setting,
} from '@/domain/nutrition/solver';
import { ZERO, type Meal, type Nutrients, type UnitId } from '@/domain/nutrition/types';
import { addDays, startOfWeek, toDateKey, weekdayShortName } from '@/lib/dates';
import { useNow } from '@/lib/useNow';
import { usePlanItems } from '../brain/useBrain';
import { ProLock } from '../pro/ProLock';
import { readMealPrefs, writeMealPrefs } from './mealPrefs';
import { MEAL_LABEL, useFoodContext, type FoodContext } from './useFoodContext';

const BUDGET_HINT: Record<Budget, string> = {
  tight: 'Staples only: dal, chana, soya, eggs, milk, curd, peanuts.',
  medium: 'Adds paneer, chicken, fruit and makhana.',
  open: 'Adds whey, fish, Greek yogurt and nuts.',
};
const SETTING_HINT: Record<Setting, string> = {
  home: 'Meals cooked at home, with a grocery list of ingredients.',
  hostel: 'Mess meals as served, plus food you can keep in your room.',
  mess: 'Mess meals as served, plus add-ons like eggs, curd and chana.',
  pg: 'PG meals as served, plus food you can keep in your room.',
};

interface SavedPlan {
  setting: Setting;
  budget: Budget;
  seed: number;
  targets: { kcal: number; proteinG: number };
  proteinShort: boolean;
  days: { meals: { meal: Meal; kitchen: boolean; items: { id: string; amount: number; unit: UnitId }[] }[] }[];
}

const sum = (items: Portion[]): Nutrients =>
  items.reduce(
    (t, p) => ({
      kcal: t.kcal + p.nutrients.kcal,
      proteinG: t.proteinG + p.nutrients.proteinG,
      carbsG: t.carbsG + p.nutrients.carbsG,
      fatG: t.fatG + p.nutrients.fatG,
      fibreG: t.fibreG + p.nutrients.fibreG,
    }),
    ZERO,
  );

/** The saved plan with today's library numbers (a food that has gone is left out). */
function hydrate(saved: SavedPlan, ctx: FoodContext): PlanDay[] {
  return saved.days.map((d, index) => {
    const meals: PlanMeal[] = d.meals.map((m) => ({
      meal: m.meal,
      kitchen: m.kitchen,
      items: m.items
        .map((i) => {
          const food = ctx.foodById.get(i.id);
          return food ? portionOf(food, i.amount, i.unit, ctx.katoriMl) : null;
        })
        .filter((p): p is Portion => p !== null),
    }));
    return { index, meals, totals: sum(meals.flatMap((m) => m.items)) };
  });
}

const groceryText = (g: GroceryItem) =>
  g.count !== null
    ? `${g.count} ${g.count === 1 ? (g.countName ?? '').replace(/s$/, '') : (g.countName ?? '')}`.trim()
    : g.grams! >= 1000
      ? `${(g.grams! / 1000).toFixed(1)} kg`
      : `${g.grams} g`;

/**
 * Plan my week (Pro): seven days of meals aimed at the person's own calorie and protein
 * targets, for where they eat and what they can spend, with one grocery list. The same solver
 * as Eat next, so the two never disagree.
 */
export function MealPlanPage() {
  const pro = useFeature('meal_plan');
  const now = useNow();
  const ctx = useFoodContext(now);
  const items = usePlanItems();
  const prefs = usePreferences();
  const toast = useToast();
  const [meal, setMeal] = useState(readMealPrefs);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const weekStart = startOfWeek(now, prefs.weekStartsOn);
  const weekKey = toDateKey(weekStart);
  const today = toDateKey(now);
  const [day, setDay] = useState(() => Math.min(6, Math.max(0, Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${weekKey}T12:00:00`).getTime()) / 86_400_000))));

  const item = items.status === 'success' ? mealPlanFrom(items.data, weekKey) : null;
  const saved = (item?.data as unknown as SavedPlan | undefined) ?? null;
  const days = saved && ctx.status === 'success' ? hydrate(saved, ctx) : null;
  const grocery = days && saved ? groceryList(days, saved.setting) : [];
  const targets =
    ctx.targets.kcal && ctx.targets.proteinG ? { kcal: ctx.targets.kcal, proteinG: ctx.targets.proteinG } : null;

  const choose = (next: typeof meal) => {
    setMeal(next);
    writeMealPrefs(next);
  };
  const make = async (seed: number) => {
    if (!targets) return;
    setBusy(true);
    try {
      const plan = planWeek({
        targets,
        diet: ctx.diet,
        setting: meal.setting,
        budget: meal.budget,
        foods: ctx.foodById,
        katoriMl: ctx.katoriMl,
        seed,
      });
      const data: SavedPlan = {
        setting: meal.setting,
        budget: meal.budget,
        seed,
        targets,
        proteinShort: plan.proteinShort,
        days: plan.days.map((d) => ({
          meals: d.meals.map((m) => ({
            meal: m.meal,
            kitchen: m.kitchen,
            items: m.items.map((p) => ({ id: p.food.id, amount: p.amount, unit: p.unit })),
          })),
        })),
      };
      await saveMealPlan(db, weekKey, data as unknown as Record<string, unknown>);
    } finally {
      setBusy(false);
    }
  };
  const logMeal = async (m: PlanMeal, date: string) => {
    try {
      const logs = await logFoods(
        db,
        m.items.map((p) => ({ food: p.food, amount: p.amount, unit: p.unit, size: p.size, oilLevel: null })),
        { date, meal: m.meal, katoriMl: ctx.katoriMl },
      );
      toast(`Logged ${MEAL_LABEL[m.meal].toLowerCase()}`, {
        label: 'Undo',
        onSelect: () =>
          void deleteFoodLogs(
            db,
            logs.map((l) => l.id),
          ),
      });
    } catch (e) {
      toast(e instanceof FoodError ? e.message : 'Could not log that. Try again.');
    }
  };
  const copy = async () => {
    const text = grocery.map((g) => `${g.name}: ${groceryText(g)}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('Could not copy. Select the list and copy it instead.');
    }
  };

  const shownDay = days?.[day] ?? null;
  const dayDate = toDateKey(addDays(weekStart, day));

  return (
    <>
      <PageHeader back={{ to: '/food', label: 'Food' }} title="Plan my week" subtitle="Meals that hit your targets" />
      {!pro ? (
        <ProLock feature="meal_plan" />
      ) : ctx.status === 'loading' || items.status === 'loading' ? (
        <Skeleton className="h-72 rounded-panel" />
      ) : ctx.status === 'error' ? (
        <ErrorState />
      ) : !targets ? (
        <div className="rounded-panel bg-surface p-5">
          <p className="type-body text-text-1">Set your daily calorie and protein targets first.</p>
          <TextButton to="/food" className="mt-2">
            Food
          </TextButton>
        </div>
      ) : (
        <div className="flex max-w-3xl flex-col gap-5" data-meal-plan>
          <section className="flex flex-col gap-4 rounded-panel bg-surface p-5">
            <div className="flex flex-col gap-2">
              <p className="type-footnote text-text-2">Where you eat</p>
              <ChipGroup
                label="Where you eat"
                value={meal.setting}
                onChange={(setting) => choose({ ...meal, setting })}
                options={(Object.keys(SETTING_LABEL) as Setting[]).map((s) => ({ value: s, label: SETTING_LABEL[s] }))}
              />
              <p className="type-footnote text-text-3">{SETTING_HINT[meal.setting]}</p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="type-footnote text-text-2">Budget</p>
              <ChipGroup
                label="Budget"
                value={meal.budget}
                onChange={(budget) => choose({ ...meal, budget })}
                options={(Object.keys(BUDGET_LABEL) as Budget[]).map((b) => ({ value: b, label: BUDGET_LABEL[b] }))}
              />
              <p className="type-footnote text-text-3">{BUDGET_HINT[meal.budget]}</p>
            </div>
            <p className="type-subhead text-text-2">
              Aiming at{' '}
              <span className="tabular font-semibold text-text-1">{targets.kcal.toLocaleString('en-IN')} kcal</span> and{' '}
              <span className="tabular font-semibold text-text-1">{targets.proteinG} g protein</span> a day, your current
              targets{ctx.diet ? `, ${ctx.diet === 'nonveg' ? 'non-veg' : ctx.diet}` : ''}.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <PrimaryButton block loading={busy} onClick={() => void make(saved ? saved.seed + 1 : 0)} data-meal-plan-make>
                {saved ? 'Make another week' : 'Make my week'}
              </PrimaryButton>
            </div>
          </section>

          {saved && days && shownDay ? (
            <>
              {saved.proteinShort ? (
                <p className="type-footnote rounded-nested bg-surface-2 p-3 text-text-2" role="status">
                  Your protein target could not be fully met with this kitchen and budget. A wider budget, or eggs or
                  whey if you eat them, closes it.
                </p>
              ) : null}
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Days">
                {days.map((d) => {
                  const date = addDays(weekStart, d.index);
                  const on = d.index === day;
                  return (
                    <button
                      key={d.index}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setDay(d.index)}
                      className={
                        on
                          ? 'pressable type-footnote shrink-0 rounded-full bg-text-1 px-3.5 py-2 font-semibold text-bg'
                          : 'pressable type-footnote shrink-0 rounded-full bg-surface px-3.5 py-2 text-text-2'
                      }
                    >
                      {weekdayShortName(date.getDay())} {date.getDate()}
                    </button>
                  );
                })}
              </div>
              <section className="flex flex-col divide-y-[0.5px] divide-divider rounded-panel bg-surface px-5" data-meal-plan-day={day}>
                {shownDay.meals.map((m) => (
                  <div key={m.meal} className="py-4" data-plan-meal={m.meal}>
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="type-headline text-text-1">
                        {MEAL_LABEL[m.meal]}
                        {m.kitchen ? <span className="type-footnote ml-2 font-normal text-text-3">as served</span> : null}
                      </h2>
                      <span className="type-footnote tabular text-text-2">
                        {Math.round(sum(m.items).kcal)} kcal · {Math.round(sum(m.items).proteinG)} g
                      </span>
                    </div>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {m.items.map((p) => (
                        <li key={p.food.id} className="type-subhead text-text-2">
                          {p.food.name}
                          <span className="text-text-3"> · {portionText(p.amount, p.unit, p.size, p.food.pieceName)}</span>
                        </li>
                      ))}
                    </ul>
                    {dayDate <= today ? (
                      <SecondaryButton compact className="mt-3" onClick={() => void logMeal(m, dayDate)} data-plan-log>
                        Log this meal
                      </SecondaryButton>
                    ) : null}
                  </div>
                ))}
                <p className="type-subhead tabular py-4 text-text-1" data-meal-plan-total>
                  Day total: {Math.round(shownDay.totals.kcal).toLocaleString('en-IN')} kcal ·{' '}
                  {Math.round(shownDay.totals.proteinG)} g protein
                </p>
              </section>

              {grocery.length ? (
                <section className="rounded-panel bg-surface p-5" data-grocery>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="type-headline flex items-center gap-2 text-text-1">
                      <ShoppingBasket className="size-5 text-text-2" aria-hidden />
                      {saved.setting === 'home' ? 'Grocery list for the week' : 'To keep in your room'}
                    </h2>
                    <SecondaryButton compact icon={copied ? <Check /> : <Copy />} onClick={() => void copy()}>
                      {copied ? 'Copied' : 'Copy'}
                    </SecondaryButton>
                  </div>
                  <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                    {grocery.map((g) => (
                      <li key={g.name} className="flex items-baseline justify-between gap-3">
                        <span className="type-subhead text-text-1">{g.name}</span>
                        <span className="type-subhead tabular shrink-0 text-text-2">{groceryText(g)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="type-footnote mt-3 text-text-3">
                    Amounts are for one person for the seven days, rounded up to the nearest 50 g. Oil, salt and spices
                    you already have are included where a recipe uses them.
                  </p>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </>
  );
}
