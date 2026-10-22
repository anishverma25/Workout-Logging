import type { FoodLog } from '../models/schemas';
import { analyseDay } from './dayAnalysis';

function log(
  meal: FoodLog['meal'],
  n: { kcal: number; p: number; c: number; f: number; fib: number },
  date = '2026-10-20',
): FoodLog {
  const at = `${date}T12:00:00.000Z`;
  return {
    id: crypto.randomUUID(),
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    origin: 'user',
    date,
    meal,
    foodId: 'x',
    foodName: 'x',
    amount: 1,
    unit: 'g',
    size: null,
    grams: 100,
    oilLevel: null,
    kcal: n.kcal,
    proteinG: n.p,
    carbsG: n.c,
    fatG: n.f,
    fibreG: n.fib,
    libraryVersion: 1,
  };
}

const base = {
  date: '2026-10-20',
  today: '2026-10-21',
  targets: { kcal: 2400, proteinG: 140 },
  proteinRangeGPerKg: [1.6, 2.2] as [number, number],
  weightKg: 70,
  maintenanceKcal: 2600,
  trainingDay: true,
};

// A lifter's day: 2,400 kcal, 140 g protein (25%), 300 g carbs (50%), 67 g fat (25%).
const day = [
  log('breakfast', { kcal: 600, p: 35, c: 75, f: 17, fib: 8 }),
  log('lunch', { kcal: 800, p: 45, c: 100, f: 22, fib: 12 }),
  log('snacks', { kcal: 200, p: 10, c: 25, f: 6, fib: 2 }),
  log('dinner', { kcal: 800, p: 50, c: 100, f: 22, fib: 12 }),
];

describe('a day of food, analysed', () => {
  it('nothing logged is no analysis', () => {
    expect(analyseDay({ ...base, logs: [] })).toBeNull();
  });

  it('energy against the target and real maintenance', () => {
    const a = analyseDay({ ...base, logs: day })!;
    expect(a.kcal).toBe(2400);
    expect(a.energy).toEqual({
      target: 2400,
      ofTarget: 1,
      verdict: 'in_range',
      vsMaintenance: -200,
    });
    const low = analyseDay({ ...base, logs: day.slice(0, 2) })!;
    expect(low.energy.verdict).toBe('low');
  });

  it('macronutrient split against the AMDR', () => {
    const a = analyseDay({ ...base, logs: day })!;
    expect(a.split!.protein).toMatchObject({ value: 24, verdict: 'in_range' });
    expect(a.split!.carbs).toMatchObject({ value: 51, verdict: 'in_range' });
    expect(a.split!.fat).toMatchObject({ value: 26, verdict: 'in_range' });
    const fatty = analyseDay({
      ...base,
      logs: [log('lunch', { kcal: 900, p: 20, c: 40, f: 75, fib: 2 })],
    })!;
    expect(fatty.split!.fat.verdict).toBe('high');
    expect(fatty.split!.carbs.verdict).toBe('low');
  });

  it('protein per kg against the goal and per meal against 0.4 g/kg', () => {
    const a = analyseDay({ ...base, logs: day })!;
    expect(a.proteinPerKg).toMatchObject({ value: 2, range: [1.6, 2.2], verdict: 'in_range' });
    // 0.4 g/kg of 70 kg is 28 g: breakfast, lunch and dinner reach it, the snack does not.
    expect(a.proteinSpread).toEqual({
      meals: ['breakfast', 'lunch', 'snacks', 'dinner'],
      reached: ['breakfast', 'lunch', 'dinner'],
      doseG: 28,
    });
  });

  it('fibre against 14 g per 1,000 kcal, and carbs per kg on training days', () => {
    const a = analyseDay({ ...base, logs: day })!;
    expect(a.fibre).toMatchObject({ value: 34, verdict: 'in_range' });
    expect(a.fibre.range[0]).toBe(34);
    expect(a.trainingCarbs).toMatchObject({ value: 4.3, range: [4, 7], verdict: 'in_range' });
    expect(analyseDay({ ...base, logs: day, trainingDay: false })!.trainingCarbs).toBeNull();
  });

  it('without a body weight, only what does not need one', () => {
    const a = analyseDay({ ...base, logs: day, weightKg: null })!;
    expect(a.proteinPerKg).toBeNull();
    expect(a.proteinSpread).toBeNull();
    expect(a.trainingCarbs).toBeNull();
    expect(a.split).not.toBeNull();
  });

  it('today is labelled as still being logged', () => {
    expect(analyseDay({ ...base, logs: day, today: '2026-10-20' })!.partial).toBe(true);
    expect(analyseDay({ ...base, logs: day })!.partial).toBe(false);
  });
});
