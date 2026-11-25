import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CalendarDays, ChevronRight, Crown, Plus, ScanText } from 'lucide-react';
import { useFeature } from '@/app/entitlement';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { deleteFoodLogs, FoodError, logFoods } from '@/data/repositories/food';
import { dayTotals } from '@/domain/nutrition/analysis';
import { portionText } from '@/domain/nutrition/calc';
import { eatNext, EAT_NEXT_MIN_KCAL, habitsFrom, type Suggestion } from '@/domain/nutrition/solver';
import { haptic } from '@/lib/haptics';
import { readMealPrefs } from './mealPrefs';
import { MenuSheet } from './MenuSheet';
import { mealForHour, MEAL_LABEL, type FoodContext } from './useFoodContext';

const WHY: Record<Suggestion['why'], string> = {
  protein: 'Closes your protein gap',
  usual: 'You eat this often',
  fits: 'Fits what is left',
};

/**
 * Eat next (free): what is left of today's calories and protein, and up to three foods that
 * fit, each added with one tap. Quiet when the day is nearly full or has no targets.
 */
export function EatNextCard({
  ctx,
  date,
  today,
  now,
}: {
  ctx: FoodContext;
  date: string;
  today: string;
  now: Date;
}) {
  const toast = useToast();
  const menuPro = useFeature('ai_food');
  const planPro = useFeature('meal_plan');
  // Eat next works from protein as well as calories, so it is part of Pro macro tracking.
  const macros = useFeature('macro_tracking');
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const meal = mealForHour(now.getHours());
  const kcalTarget = ctx.targets.kcal;
  const proteinTarget = ctx.targets.proteinG;
  const eaten = useMemo(() => dayTotals(ctx.logs, date), [ctx.logs, date]);
  const remaining = useMemo(
    () => ({
      kcal: Math.round((kcalTarget ?? 0) - eaten.kcal),
      proteinG: Math.round((proteinTarget ?? 0) - eaten.proteinG),
    }),
    [kcalTarget, proteinTarget, eaten.kcal, eaten.proteinG],
  );
  const picks = useMemo(() => {
    if (!kcalTarget || date !== today) return [];
    const prefs = readMealPrefs();
    return eatNext({
      remaining,
      meal,
      diet: ctx.diet,
      foods: ctx.foodById,
      habits: habitsFrom(ctx.logs, today),
      setting: prefs.setting,
      budget: prefs.budget,
      katoriMl: ctx.katoriMl,
      eatenNow: new Set(
        ctx.logs
          .filter((l) => !l.deletedAt && l.date === today && l.meal === meal)
          .map((l) => l.foodId),
      ),
    });
  }, [kcalTarget, date, today, remaining, meal, ctx.diet, ctx.foodById, ctx.logs, ctx.katoriMl]);

  if (date !== today || !kcalTarget || remaining.kcal < EAT_NEXT_MIN_KCAL || picks.length === 0)
    return null;
  if (!macros)
    return (
      <Link
        to="/pro"
        className="pressable flex items-center gap-3 rounded-card bg-surface px-4 py-3"
        data-eat-next-locked
      >
        <Crown className="size-4 shrink-0 text-lime" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="type-headline block text-text-1">Eat next</span>
          <span className="type-subhead block text-text-2">
            {pluralizeFoods(picks.length)} that fit the rest of your day. With Pro.
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />
      </Link>
    );

  const add = async (p: Suggestion) => {
    setBusy(p.food.id);
    try {
      const logs = await logFoods(
        db,
        [{ food: p.food, amount: p.amount, unit: p.unit, size: p.size, oilLevel: null }],
        { date, meal, katoriMl: ctx.katoriMl },
      );
      haptic('medium');
      toast(`Logged ${p.food.name} to ${MEAL_LABEL[meal].toLowerCase()}`, {
        label: 'Undo',
        onSelect: () =>
          void deleteFoodLogs(
            db,
            logs.map((l) => l.id),
          ),
      });
    } catch (e) {
      toast(e instanceof FoodError ? e.message : 'Could not log that. Try again.');
    } finally {
      setBusy(null);
    }
  };

  // A slim quick-add strip under the meals (owner, 25 Nov 2026): the totals above already show
  // what is left, so this only offers foods that fit, one tap each.
  return (
    <section aria-labelledby="eat-next-title" data-eat-next className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="eat-next-title" className="type-section shrink-0 text-text-1">
          Eat next
        </h2>
        <p className="type-meta tabular min-w-0 truncate text-text-2" data-eat-next-left>
          <span className="sr-only">You have </span>
          {remaining.kcal.toLocaleString('en-IN')} kcal
          {remaining.proteinG > 0 ? ` · ${remaining.proteinG} g protein` : ''} left
        </p>
      </div>
      <div className="min-w-0 rounded-card bg-surface px-3.5 pt-3.5 pb-2.5">
        <ul className="relative -mx-3.5 flex gap-2 overflow-x-auto px-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {picks.map((p) => (
            <li
              key={p.food.id}
              className="flex max-w-[16rem] shrink-0 items-center gap-2.5 rounded-[0.875rem] bg-surface-2 py-1.5 pr-1.5 pl-3"
              data-eat-next-item={p.food.id}
            >
              <div className="min-w-0">
                <p className="type-subhead truncate font-semibold text-text-1">{p.food.name}</p>
                <p className="type-meta tabular truncate text-text-2">
                  {portionText(p.amount, p.unit, p.size, p.food.pieceName)} ·{' '}
                  {Math.round(p.nutrients.kcal)} kcal · {Math.round(p.nutrients.proteinG)} g P
                </p>
                <p className="sr-only">{WHY[p.why]}</p>
              </div>
              <button
                type="button"
                className="pressable chrome tap-target flex size-9 shrink-0 items-center justify-center rounded-full bg-lime text-on-lime disabled:opacity-40"
                aria-label={`Add ${p.food.name} to ${MEAL_LABEL[meal].toLowerCase()}`}
                disabled={busy !== null}
                onClick={() => void add(p)}
                data-eat-next-add
              >
                <Plus className="size-[1.125rem]" strokeWidth={2.5} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-x-5">
          <Link
            to="/food/plan"
            className="pressable type-meta tap-target inline-flex items-center gap-1.5 font-semibold text-lime"
            data-plan-week
          >
            <CalendarDays className="size-3.5" aria-hidden />
            Plan my week
            {!planPro ? (
              <span className="type-caption rounded-full bg-fill px-1.5 text-text-2">Pro</span>
            ) : null}
          </Link>
          <button
            type="button"
            className="pressable type-meta tap-target inline-flex items-center gap-1.5 font-semibold text-lime"
            onClick={() => setMenu(true)}
            data-menu-open
          >
            <ScanText className="size-3.5" aria-hidden />
            Read a menu
            {!menuPro ? (
              <span className="type-caption rounded-full bg-fill px-1.5 text-text-2">Pro</span>
            ) : null}
          </button>
        </div>
      </div>
      <MenuSheet
        open={menu}
        onClose={() => setMenu(false)}
        ctx={ctx}
        remaining={remaining}
        date={date}
        meal={meal}
      />
    </section>
  );
}

const pluralizeFoods = (n: number) => (n === 1 ? '1 food' : `${n} foods`);
