import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CalendarDays, Plus, ScanText } from 'lucide-react';
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
export function EatNextCard({ ctx, date, today, now }: { ctx: FoodContext; date: string; today: string; now: Date }) {
  const toast = useToast();
  const menuPro = useFeature('ai_food');
  const planPro = useFeature('meal_plan');
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
        ctx.logs.filter((l) => !l.deletedAt && l.date === today && l.meal === meal).map((l) => l.foodId),
      ),
    });
  }, [kcalTarget, date, today, remaining, meal, ctx.diet, ctx.foodById, ctx.logs, ctx.katoriMl]);

  if (date !== today || !kcalTarget || remaining.kcal < EAT_NEXT_MIN_KCAL || picks.length === 0) return null;

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

  return (
    <section aria-labelledby="eat-next-title" data-eat-next>
      <h2 id="eat-next-title" className="type-section mb-2 text-text-1">
        Eat next
      </h2>
      <div className="rounded-card bg-surface px-4 pt-4 pb-2">
        <p className="type-subhead text-text-2" data-eat-next-left>
          You have{' '}
          <span className="tabular font-semibold text-text-1">{remaining.kcal.toLocaleString('en-IN')} kcal</span>
          {remaining.proteinG > 0 ? (
            <>
              {' '}
              and <span className="tabular font-semibold text-text-1">{remaining.proteinG} g protein</span>
            </>
          ) : null}{' '}
          left today.
        </p>
        <ul className="mt-2 divide-y-[0.5px] divide-divider">
          {picks.map((p) => (
            <li key={p.food.id} className="flex items-center gap-3 py-3" data-eat-next-item={p.food.id}>
              <div className="min-w-0 flex-1">
                <p className="type-headline text-text-1">{p.food.name}</p>
                <p className="type-footnote tabular text-text-2">
                  {portionText(p.amount, p.unit, p.size, p.food.pieceName)} · {Math.round(p.nutrients.kcal)} kcal ·{' '}
                  {Math.round(p.nutrients.proteinG)} g protein
                </p>
                <p className="type-footnote text-text-3">{WHY[p.why]}</p>
              </div>
              <button
                type="button"
                className="pressable chrome tap-target flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-lime disabled:opacity-40"
                aria-label={`Add ${p.food.name} to ${MEAL_LABEL[meal].toLowerCase()}`}
                disabled={busy !== null}
                onClick={() => void add(p)}
                data-eat-next-add
              >
                <Plus className="size-5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t-[0.5px] border-divider py-3">
          <Link to="/food/plan" className="pressable type-subhead inline-flex items-center gap-1.5 font-semibold text-lime" data-plan-week>
            <CalendarDays className="size-4" aria-hidden />
            Plan my week
            {!planPro ? <span className="type-footnote rounded-full bg-fill px-1.5 text-text-2">Pro</span> : null}
          </Link>
          <button
            type="button"
            className="pressable type-subhead inline-flex items-center gap-1.5 font-semibold text-lime"
            onClick={() => setMenu(true)}
            data-menu-open
          >
            <ScanText className="size-4" aria-hidden />
            Read a menu
            {!menuPro ? <span className="type-footnote rounded-full bg-fill px-1.5 text-text-2">Pro</span> : null}
          </button>
        </div>
      </div>
      <MenuSheet open={menu} onClose={() => setMenu(false)} ctx={ctx} remaining={remaining} date={date} meal={meal} />
    </section>
  );
}
