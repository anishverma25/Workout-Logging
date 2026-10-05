import type { BodyWeightEntry } from '@/domain/models/schemas';
import { bodyWeightSeries, bodyWeightSummary, bodyWeightTrend } from './bodyweight';

const entry = (day: number, kg: number): BodyWeightEntry => ({
  id: `33333333-3333-4333-8333-${String(day).padStart(12, '0')}`,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  origin: 'user',
  measuredAt: new Date(2026, 8, day, 7).toISOString(),
  weightKg: kg,
  enteredUnit: 'kg',
  note: null,
});

describe('body weight summary', () => {
  it('returns null without entries', () => {
    expect(bodyWeightSummary([])).toBeNull();
  });

  it('reports latest, previous and change vs a week earlier', () => {
    const s = bodyWeightSummary([entry(1, 66.0), entry(5, 66.4), entry(8, 66.6), entry(10, 66.9)])!;
    expect(s.latest.weightKg).toBe(66.9);
    expect(s.previous?.weightKg).toBe(66.6);
    // reference: latest entry on or before 3 Sep is 1 Sep (66.0)
    expect(s.weekChangeKg).toBeCloseTo(0.9, 5);
  });

  it('needs three entries in 7 days for a rolling average', () => {
    expect(
      bodyWeightSummary([entry(1, 66), entry(9, 67), entry(10, 67.2)])!.rollingAverageKg,
    ).toBeNull();
    expect(
      bodyWeightSummary([entry(8, 66.8), entry(9, 67), entry(10, 67.2)])!.rollingAverageKg,
    ).toBeCloseTo(67, 5);
  });

  it('has no weekly change until a week of data exists', () => {
    expect(bodyWeightSummary([entry(9, 67), entry(10, 67.2)])!.weekChangeKg).toBeNull();
  });
});

describe('body weight series and trend', () => {
  it('computes the 7-day average only where 3 or more entries fall in the window', () => {
    const s = bodyWeightSeries([entry(1, 66), entry(2, 67), entry(3, 66.5), entry(12, 70)]);
    expect(s.map((p) => p.averageKg)).toEqual([null, null, 66.5, null]);
  });

  it('ignores deleted entries and sorts by date', () => {
    const deleted = { ...entry(4, 99), deletedAt: '2026-09-05T00:00:00.000Z' };
    const s = bodyWeightSeries([entry(3, 66.5), deleted, entry(1, 66), entry(2, 67)]);
    expect(s.map((p) => p.kg)).toEqual([66, 67, 66.5]);
  });

  it('reports a trend from averages at least a week apart, never from single readings', () => {
    const noisy = [66.2, 66.9, 66.4, 66.8, 66.5, 67.1, 66.7, 67.0, 66.9, 67.3].map((kg, i) =>
      entry(i + 1, kg),
    );
    const t = bodyWeightTrend(bodyWeightSeries(noisy))!;
    expect(t.days).toBe(7);
    // First average: days 1 to 3 = 66.5. Last: days 4 to 10 = 66.9. Change +0.4 kg.
    expect(t.averageChangeKg).toBeCloseTo(0.4, 6);
    expect(bodyWeightTrend(bodyWeightSeries(noisy.slice(0, 5)))).toBeNull();
    expect(bodyWeightTrend([])).toBeNull();
  });
});
