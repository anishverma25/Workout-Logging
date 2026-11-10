import { buildSessions } from '@/domain/analytics/sessions';
import type { FoodLog, TrainingGoal } from '@/domain/models/schemas';
import { weeklyReport, type WeeklyInput, type WeeklyReport } from '@/domain/analytics/weekly';
import { buildData } from '@/test/fixtures';

/**
 * A realistic week for report tests (test only): upper and lower four times a week for 9 weeks,
 * food at three meals with a protein gap at breakfast, weigh-ins most days on a slow cut and a
 * goal weight. The numbers are made up for tests and never shown to anyone.
 */

const meta = { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', deletedAt: null, origin: 'user' as const };
let n = 0;
const id = () => `00000000-0000-4000-9100-${String(++n).padStart(12, '0')}`;
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function log(date: string, meal: FoodLog['meal'], kcal: number, proteinG: number): FoodLog {
  return {
    id: id(),
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
    carbsG: (kcal * 0.5) / 4,
    fatG: (kcal * 0.25) / 9,
    fibreG: kcal / 110,
    libraryVersion: null,
  };
}

export function reportInput(over: Partial<WeeklyInput> = {}, opts: { thin?: boolean } = {}): WeeklyInput {
  const specs = [];
  for (let w = 0; w < 9; w++) {
    const days = [
      [0, 'Upper', [['barbell-bench-press', 80 + w * 1.5], ['barbell-row', 70 + w], ['overhead-press', 45 + w * 0.5]]],
      [1, 'Lower', [['back-squat', 110 + w * 2], ['deadlift', 140 + (w > 5 ? 2 : w)]]],
      [3, 'Upper', [['incline-barbell-bench-press', 60 + w], ['lat-pulldown', 60 + w]]],
      [5, 'Lower', [['back-squat', 105 + w * 2], ['romanian-deadlift', 100 + w]]],
    ] as const;
    for (const [d, name, lifts] of days) {
      if (opts.thin && w === 8 && d > 1) continue;
      const day = new Date(Date.UTC(2026, 8, 7 + w * 7 + d, 13, 0));
      specs.push({
        at: day.toISOString(),
        name,
        minutes: 64,
        exercises: lifts.map(([k, wt]) => ({ key: k, sets: [{ w: wt, r: 6, rir: 2 }, { w: wt, r: 6, rir: 2 }, { w: wt, r: 5, rir: 1 }] })),
      });
    }
  }
  const data = buildData(specs);
  const weekStart = new Date(2026, 10, 2);
  const logs: FoodLog[] = [];
  for (let i = -28; i < 7; i++) {
    if (opts.thin && i >= 0) continue;
    const day = new Date(2026, 10, 2 + i);
    if (i === 5) continue; // a day without food logged
    const k = key(day);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    logs.push(log(k, 'breakfast', 380, 14), log(k, 'lunch', 820, 42), log(k, 'snacks', 250, 12), log(k, 'dinner', weekend ? 1250 : 900, 52));
  }
  const weights = Array.from({ length: 35 }, (_, i) => ({
    measuredAt: new Date(2026, 10, 2 - 28 + i, 7).toISOString(),
    weightKg: Math.round((82 - i * (0.55 / 7) + (i % 3 === 0 ? 0.3 : -0.1)) * 10) / 10,
  })).filter((_, i) => i % 5 !== 4);
  const goals: TrainingGoal[] = [
    { id: id(), ...meta, kind: 'body_weight', exerciseId: null, targetValue: 76, startValue: 82, targetDate: null, achievedAt: null },
  ];
  return {
    weekStart,
    now: new Date(2026, 10, 9, 8, 30),
    sessions: buildSessions(data),
    exercises: data.exercises,
    logs,
    targets: { kcal: 2200, proteinG: 150 },
    ownTargets: true,
    goal: 'fat_loss',
    weights,
    measurements: [],
    goals,
    planned: 4,
    previousActions: null,
    ...over,
  };
}

/** A full report with last week's plan ticked off. */
export function sampleReport(opts: { thin?: boolean } = {}): WeeklyReport {
  const prev = weeklyReport({ ...reportInput(), weekStart: new Date(2026, 9, 26), now: new Date(2026, 10, 2, 8) });
  return weeklyReport(reportInput({ previousActions: prev.actions.length ? prev.actions : null }, opts));
}
