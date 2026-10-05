import type { BodyWeightEntry } from '@/domain/models/schemas';
import { bodyWeightSummary } from './bodyweight';

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
