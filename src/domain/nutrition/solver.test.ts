import { FOODS } from '@/data/library/foods';
import { describe, expect, it } from 'vitest';
import type { FoodLog } from '../models/schemas';
import { fitsDiet } from './search';
import {
  ADD_ONS,
  TEMPLATE_FOOD_IDS,
  costOf,
  eatNext,
  habitsFrom,
  planWeek,
  portionOf,
  type Budget,
  type Setting,
} from './solver';
import type { DietType } from './types';

const foods = new Map(FOODS.map((f) => [f.id, f]));

describe('the solver only uses foods the library has', () => {
  it('finds every food a template, pool or add-on names', () => {
    expect(TEMPLATE_FOOD_IDS.filter((id) => !foods.has(id))).toEqual([]);
    for (const id of TEMPLATE_FOOD_IDS) expect(portionOf(foods.get(id)!, foods.get(id)!.defaultAmount), id).not.toBeNull();
  });
});

describe('eat next', () => {
  const base = { meal: 'snacks' as const, foods, habits: new Map(), diet: 'veg' as DietType };

  it('closes the protein gap without going over the calories', () => {
    const picks = eatNext({ ...base, remaining: { kcal: 640, proteinG: 48 } });
    expect(picks).toHaveLength(3);
    for (const p of picks) {
      expect(p.nutrients.kcal).toBeLessThanOrEqual(640 * 1.05);
      expect(fitsDiet(p.food, 'veg')).toBe(true);
    }
    expect(picks[0]!.nutrients.proteinG).toBeGreaterThanOrEqual(12);
    expect(new Set(picks.map((p) => p.food.category)).size).toBe(3);
  });

  it('says nothing when the day is nearly full', () => {
    expect(eatNext({ ...base, remaining: { kcal: 90, proteinG: 30 } })).toEqual([]);
  });

  it('never suggests an egg to a vegetarian, and offers one to someone who eats them', () => {
    const veg = eatNext({ ...base, remaining: { kcal: 400, proteinG: 30 }, limit: 12 });
    expect(veg.some((p) => p.food.diet !== 'veg')).toBe(false);
    const egg = eatNext({ ...base, diet: 'egg', remaining: { kcal: 400, proteinG: 30 }, limit: 12 });
    expect(egg.some((p) => p.food.id === 'boiled-egg')).toBe(true);
  });

  it('in a mess it suggests only add-ons, and a tight budget leaves out whey', () => {
    const picks = eatNext({ ...base, diet: 'egg', setting: 'mess', budget: 'tight', remaining: { kcal: 500, proteinG: 40 }, limit: 10 });
    expect(picks.length).toBeGreaterThan(0);
    for (const p of picks) expect(ADD_ONS as readonly string[]).toContain(p.food.id);
    expect(picks.slice(0, 3).some((p) => costOf(p.food) === 3)).toBe(false);
  });

  it('puts what the person already eats at this meal first among equals', () => {
    const log = (date: string): FoodLog => ({
      id: crypto.randomUUID(), createdAt: `${date}T10:00:00.000Z`, updatedAt: `${date}T10:00:00.000Z`, deletedAt: null, origin: 'user',
      date, meal: 'snacks', foodId: 'roasted-chana', foodName: 'Roasted chana', amount: 40, unit: 'g', size: null, grams: 40, oilLevel: null,
      kcal: 150, proteinG: 8, carbsG: 22, fatG: 2, fibreG: 6, libraryVersion: 1,
    });
    const habits = habitsFrom([log('2026-11-08'), log('2026-11-09'), log('2026-11-10')], '2026-11-12');
    expect(habits.get('roasted-chana')).toMatchObject({ days: 3, amount: 40, unit: 'g' });
    const picks = eatNext({ ...base, habits, remaining: { kcal: 300, proteinG: 10 } });
    expect(picks.map((p) => p.food.id)).toContain('roasted-chana');
    expect(picks.find((p) => p.food.id === 'roasted-chana')!.amount).toBe(40);
  });
});

describe('the weekly meal plan', () => {
  const diets: DietType[] = ['veg', 'egg', 'nonveg', 'jain'];
  const settings: Setting[] = ['home', 'hostel', 'mess', 'pg'];
  const budgets: Budget[] = ['tight', 'medium', 'open'];

  it('hits calories within 6% on every day, for every diet, kitchen and budget', () => {
    const off: string[] = [];
    for (const diet of diets)
      for (const setting of settings)
        for (const budget of budgets)
          for (const kcal of [1500, 1900, 2300, 2800]) {
            const plan = planWeek({ targets: { kcal, proteinG: Math.round(kcal * 0.055) }, diet, setting, budget, foods });
            expect(plan.days).toHaveLength(7);
            for (const day of plan.days) {
              if (Math.abs(day.totals.kcal / kcal - 1) > 0.06) off.push(`${diet} ${setting} ${budget} ${kcal}: day ${day.index} has ${day.totals.kcal}`);
              for (const meal of day.meals) for (const p of meal.items) if (!fitsDiet(p.food, diet)) off.push(`${p.food.id} for ${diet}`);
              if (day.meals.some((m) => m.items.length === 0)) off.push(`${diet} ${setting} ${budget}: an empty meal`);
              // A plate someone would eat: no heap of rotis, no meal carrying half the day.
              for (const meal of day.meals) {
                if (meal.items.some((p) => p.unit === 'piece' && p.amount > 4 && p.food.category === 'bread')) off.push(`${diet} ${setting} ${kcal}: ${meal.meal} has too many rotis`);
                if (meal.items.length > 6) off.push(`${diet} ${setting} ${kcal}: ${meal.meal} has ${meal.items.length} foods`);
              }
            }
          }
    expect(off.slice(0, 8)).toEqual([]);
  });

  it('meets a normal protein target, and says so when it cannot', () => {
    for (const diet of diets)
      for (const setting of settings) {
        const plan = planWeek({ targets: { kcal: 2200, proteinG: 110 }, diet, setting, budget: 'medium', foods });
        for (const day of plan.days) expect(day.totals.proteinG, `${diet} ${setting} day ${day.index}`).toBeGreaterThanOrEqual(99);
        expect(plan.proteinShort).toBe(false);
      }
    const hard = planWeek({ targets: { kcal: 1500, proteinG: 190 }, diet: 'jain', setting: 'mess', budget: 'tight', foods });
    expect(hard.proteinShort).toBe(true);
  });

  it('does not serve the same lunch or dinner two days running, and another seed gives another week', () => {
    const plan = planWeek({ targets: { kcal: 2200, proteinG: 120 }, diet: 'egg', setting: 'home', budget: 'medium', foods });
    const key = (d: number, meal: string) => plan.days[d]!.meals.find((m) => m.meal === meal)!.items.map((p) => p.food.id).join('+');
    for (let d = 1; d < 7; d++) {
      expect(key(d, 'lunch')).not.toBe(key(d - 1, 'lunch'));
      expect(key(d, 'dinner')).not.toBe(key(d - 1, 'dinner'));
    }
    const other = planWeek({ targets: { kcal: 2200, proteinG: 120 }, diet: 'egg', setting: 'home', budget: 'medium', foods, seed: 3 });
    expect(JSON.stringify(other.days.map((d) => d.meals.map((m) => m.items.map((p) => p.food.id))))).not.toBe(
      JSON.stringify(plan.days.map((d) => d.meals.map((m) => m.items.map((p) => p.food.id)))),
    );
  });

  it('the grocery list is ingredients at home, and only room food in a mess', () => {
    const home = planWeek({ targets: { kcal: 2200, proteinG: 120 }, diet: 'veg', setting: 'home', budget: 'medium', foods });
    expect(home.grocery.length).toBeGreaterThan(8);
    expect(home.grocery.every((g) => (g.grams ?? 0) > 0 || (g.count ?? 0) > 0)).toBe(true);
    expect(home.grocery.some((g) => /wheat flour/i.test(g.name))).toBe(true);
    expect(new Set(home.grocery.map((g) => g.name.toLowerCase())).size).toBe(home.grocery.length);
    const mess = planWeek({ targets: { kcal: 2200, proteinG: 120 }, diet: 'egg', setting: 'mess', budget: 'medium', foods });
    expect(mess.days.every((d) => d.meals.filter((m) => m.meal !== 'snacks').every((m) => m.kitchen))).toBe(true);
    expect(mess.grocery.some((g) => /wheat flour|phulka/i.test(g.name))).toBe(false);
    expect(mess.grocery.length).toBeGreaterThan(0);
    expect(mess.grocery.length).toBeLessThan(12);
  });
});
