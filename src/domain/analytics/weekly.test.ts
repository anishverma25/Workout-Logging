import { buildData } from '@/test/fixtures';
import type { FoodLog } from '../models/schemas';
import { buildSessions } from './sessions';
import { fisherExact, weeklyReport, type WeeklyInput } from './weekly';

const meta = { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', deletedAt: null, origin: 'user' as const };

let n = 0;
const log = (date: string, meal: FoodLog['meal'], kcal: number, proteinG: number, carbsG = kcal / 8): FoodLog => ({
  id: `00000000-0000-4000-9000-${String(++n).padStart(12, '0')}`,
  ...meta,
  date,
  meal,
  foodId: 'x',
  foodName: 'Food',
  amount: 1,
  unit: 'g',
  size: null,
  grams: 100,
  oilLevel: null,
  kcal,
  proteinG,
  carbsG,
  fatG: 50,
  fibreG: 20,
  libraryVersion: null,
});

/** Push and legs four times a week for 8 weeks; the bench creeps up each week. */
function data() {
  const specs = [];
  for (let w = 0; w < 9; w++) {
    for (const [d, key, name] of [
      [0, 'barbell-bench-press', 'Push'],
      [1, 'back-squat', 'Legs'],
      [3, 'barbell-bench-press', 'Push'],
      [5, 'back-squat', 'Legs'],
    ] as const) {
      const day = new Date(Date.UTC(2026, 8, 7 + w * 7 + d, 18, 0));
      const w0 = key === 'barbell-bench-press' ? 80 + w * 1.5 : 120;
      specs.push({ at: day.toISOString(), name, minutes: 60, exercises: [{ key, sets: [{ w: w0, r: 5, rir: 2 }, { w: w0, r: 5, rir: 2 }, { w: w0, r: 5, rir: 1 }] }] });
    }
  }
  return buildData(specs);
}

function input(over: Partial<WeeklyInput> = {}): WeeklyInput {
  const d = data();
  const weekStart = new Date(2026, 10, 2); // Mon 2 Nov 2026, the last of the 9 weeks
  const logs: FoodLog[] = [];
  for (let i = -28; i < 7; i++) {
    const day = new Date(2026, 10, 2 + i);
    const k = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    logs.push(log(k, 'breakfast', 400, 20), log(k, 'lunch', 900, 50), log(k, 'dinner', 1000, 70));
  }
  const weights = Array.from({ length: 35 }, (_, i) => ({
    measuredAt: new Date(2026, 10, 2 - 28 + i, 7).toISOString(),
    weightKg: 80 - i * (0.5 / 7),
  }));
  return {
    weekStart,
    now: new Date(2026, 10, 9, 7),
    sessions: buildSessions(d),
    exercises: d.exercises,
    logs,
    targets: { kcal: 2300, proteinG: 140 },
    ownTargets: true,
    goal: 'fat_loss',
    weights,
    measurements: [],
    goals: [],
    planned: 4,
    previousActions: null,
    ...over,
  };
}

describe('weekly report', () => {
  it('matches known Fisher exact values', () => {
    // Checked against scipy.stats.fisher_exact (two-sided).
    expect(fisherExact(8, 3, 4, 5)).toBeCloseTo(0.36185, 4);
    expect(fisherExact(10, 2, 3, 9)).toBeCloseTo(0.012278, 5);
    expect(fisherExact(5, 5, 5, 5)).toBeCloseTo(1, 6);
    expect(fisherExact(12, 1, 4, 8)).toBeCloseTo(0.0036075, 6);
  });

  it('counts the week from logs, never guessing', () => {
    const r = weeklyReport(input());
    expect(r.weekStart).toBe('2026-11-02');
    expect(r.weekEnd).toBe('2026-11-08');
    expect(r.counts).toMatchObject({ sessions: 4, planned: 4, foodDays: 7, weighIns: 7 });
    // 2,300 kcal a day against a 2,300 target: every day within 10%.
    expect(r.counts.calorieDays).toBe(7);
    expect(r.counts.proteinDays).toBe(7);
    expect(r.pillars.training).toMatchObject({ status: 'good', label: 'On plan' });
    expect(r.days).toHaveLength(7);
    expect(r.days.filter((d) => d.session)).toHaveLength(4);
  });

  it('judges strength over 4 weeks against the 5% line', () => {
    const r = weeklyReport(input());
    const bench = r.lifts.find((l) => l.name.toLowerCase().includes('bench'))!;
    expect(bench.weeks).toHaveLength(8);
    // 1.5 kg a week on 80 kg: about 7% over 4 weeks, past the 5% line.
    expect(bench.real).toBe(true);
    const squat = r.lifts.find((l) => l.name.toLowerCase().includes('squat'))!;
    expect(squat.real).toBe(false);
    expect(r.win?.title).toMatch(/bench/i);
  });

  it('reads weight as pace, with maintenance from intake and the trend', () => {
    const r = weeklyReport(input());
    expect(r.body?.fatLoss).toBe(true);
    expect(r.body?.changeKg).toBeCloseTo(-0.5, 1);
    expect(r.energy?.meanIntake).toBe(2300);
    // 0.5 kg a week = 550 kcal a day from the body.
    expect(r.energy?.maintenance).toBeGreaterThan(2800);
    expect(r.energy?.maintenance).toBeLessThan(2900);
    expect(r.pillars.body.label).toBe('On pace');
  });

  it('turns the biggest gaps into next week, each with a check, and ticks them off later', () => {
    const r = weeklyReport(input());
    // Breakfast at 20 g is under 0.75 × 0.4 g/kg; it becomes an action with a check.
    const meal = r.actions.find((a) => a.id === 'meal-breakfast');
    expect(meal).toBeTruthy();
    expect(r.actions.length).toBeLessThanOrEqual(3);
    const next = weeklyReport(input({ previousActions: r.actions }));
    expect(next.lastWeek).toHaveLength(r.actions.length);
    expect(next.lastWeek!.find((c) => c.title === meal!.title)!.done).toBe(false);
  });

  it('leaves out food parts when food was not logged', () => {
    const r = weeklyReport(input({ logs: [] }));
    expect(r.enough).toEqual({ training: true, food: false });
    expect(r.nutrition).toBeNull();
    expect(r.counts.calorieDays).toBe(0);
    expect(r.pillars.nutrition.status).toBe('none');
  });

  it('never claims a pattern without enough sessions on both sides', () => {
    const r = weeklyReport(input());
    // Every day is well fed here, so there is no low side to compare with.
    expect(r.findings.find((f) => f.id === 'fuel-pattern')).toBeUndefined();
  });

  it('lists optional inputs honestly', () => {
    const r = weeklyReport(input());
    const has = Object.fromEntries(r.inputs.map((i) => [i.key, i.has]));
    expect(has).toMatchObject({ targets: true, meals: true, plan: true, effort: true, waist: false, goal: false });
  });
});
