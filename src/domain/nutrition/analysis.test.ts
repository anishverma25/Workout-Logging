import type { FoodLog } from '../models/schemas';
import { FOOD_BY_ID } from '@/data/library/foods';
import type { TrendPoint } from '../analytics/body';
import {
  mealTemplates,
  nutritionSummary,
  proteinSuggestions,
  realMaintenance,
  recentFoods,
  totalsByDay,
} from './analysis';

let n = 0;
function log(
  date: string,
  foodId: string,
  kcal: number,
  proteinG: number,
  meal: FoodLog['meal'] = 'lunch',
): FoodLog {
  n += 1;
  const at = `${date}T12:00:${String(n % 60).padStart(2, '0')}.000Z`;
  return {
    id: crypto.randomUUID(),
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    origin: 'user',
    date,
    meal,
    foodId,
    foodName: foodId,
    amount: 1,
    unit: 'katori',
    size: 'medium',
    grams: 160,
    oilLevel: 'normal',
    kcal,
    proteinG,
    carbsG: 10,
    fatG: 5,
    fibreG: 2,
    libraryVersion: 1,
  };
}
const day = (i: number) => `2026-10-${String(i).padStart(2, '0')}`;

describe('food analysis', () => {
  it('adds up each day', () => {
    const t = totalsByDay([
      log(day(1), 'a', 100, 5),
      log(day(1), 'b', 50, 2.5),
      log(day(2), 'a', 10, 1),
    ]);
    expect(t.get(day(1))).toMatchObject({ kcal: 150, proteinG: 7.5 });
  });

  it('finds the usual meal (3 days in 4 weeks) and the last one', () => {
    const logs = [3, 5, 7].flatMap((d) => [
      log(day(d), 'poha', 160, 4, 'breakfast'),
      log(day(d), 'chai', 54, 1.5, 'breakfast'),
    ]);
    logs.push(log(day(9), 'idli', 200, 6, 'breakfast'));
    const t = mealTemplates(logs, 'breakfast', day(10));
    expect(t[0]).toMatchObject({ kind: 'usual', times: 3 });
    expect(t[0]!.items.map((i) => i.foodId).sort()).toEqual(['chai', 'poha']);
    expect(t[1]).toMatchObject({ kind: 'previous', date: day(9) });
    expect(mealTemplates(logs.slice(0, 4), 'breakfast', day(10))[0]!.kind).toBe('previous');
  });

  it('lists recent foods once each', () => {
    const r = recentFoods([log(day(1), 'a', 1, 1), log(day(2), 'b', 1, 1), log(day(3), 'a', 1, 1)]);
    expect(r.map((l) => l.foodId)).toEqual(['a', 'b']);
  });

  it('works out real maintenance from intake and the weight trend', () => {
    const now = new Date(2026, 10, 1, 12);
    const logs: FoodLog[] = [];
    for (let i = 1; i <= 28; i += 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      logs.push(log(key, 'x', 2200, 120));
    }
    const trend: TrendPoint[] = [];
    for (let i = 28; i >= 1; i -= 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      // Losing 0.5 kg over the 27 days between the first and last point.
      trend.push({ date: d, kg: 80, trendKg: 80 - (0.5 * (28 - i)) / 27 } as TrendPoint);
    }
    const m = realMaintenance({ logs, trend, now })!;
    expect(m.meanIntake).toBe(2200);
    // 2,200 + 7,700 × 0.5 / 27 ≈ 2,343.
    expect(m.kcal).toBe(2340);
    expect(realMaintenance({ logs: logs.slice(0, 10), trend, now })).toBeNull();
  });

  it('summarises protein on training and rest days', () => {
    const now = new Date(2026, 9, 20, 20);
    const logs = [10, 11, 12, 13, 14, 15].map((d) => log(day(d), 'x', 2000, d % 2 ? 140 : 100));
    const s = nutritionSummary({
      logs,
      days: 14,
      now,
      proteinTargetG: 120,
      trainingDates: new Set([day(11), day(13), day(15)]),
    });
    expect(s.loggedDays).toBe(6);
    expect(s.proteinTraining).toBe(140);
    expect(s.proteinRest).toBe(100);
    expect(s.proteinHitDays).toBe(3);
  });

  it('suggests protein that fits the diet and closes the gap', () => {
    const veg = proteinSuggestions({
      gapG: 25,
      diet: 'veg',
      foods: FOOD_BY_ID,
      eatenIds: new Set(),
    });
    expect(veg.length).toBeGreaterThan(0);
    for (const s of veg) expect(s.food.diet).toBe('veg');
    const eater = proteinSuggestions({
      gapG: 25,
      diet: 'nonveg',
      foods: FOOD_BY_ID,
      eatenIds: new Set(['boiled-egg']),
    });
    expect(eater[0]!.food.id).toBe('boiled-egg');
    expect(
      proteinSuggestions({ gapG: 5, diet: 'veg', foods: FOOD_BY_ID, eatenIds: new Set() }),
    ).toEqual([]);
  });
});
