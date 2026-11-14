import { describe, expect, it } from 'vitest';
import { weeklyReport } from '@/domain/analytics/weekly';
import { WeightChart } from '@/features/report/ReportView';
import { reportInput, sampleReport } from '@/features/report/reportFixture';
import { repaired } from './weeklyReport';

describe('weekly report with old weigh-ins only (R1)', () => {
  // Weigh-ins two months before the week: none fall in the chart's four weeks.
  const old = Array.from({ length: 6 }, (_, i) => ({
    measuredAt: new Date(2026, 8, 1 + i, 7).toISOString(),
    weightKg: 82 - i * 0.1,
  }));

  it('makes the report without a body section instead of an empty chart', () => {
    const r = weeklyReport(reportInput({ weights: old }));
    expect(r.body).toBeNull();
  });

  it('opens a saved report whose body has no points, by dropping that section', () => {
    const saved = sampleReport();
    expect(saved.body).not.toBeNull();
    const broken = { ...saved, body: { ...saved.body!, points: [] } };
    expect(repaired(broken).body).toBeNull();
    const single = { ...saved, body: { ...saved.body!, points: saved.body!.points.slice(0, 1) } };
    expect(repaired(single).body).toBeNull();
    expect(repaired(saved)).toBe(saved);
  });

  it('the chart draws nothing rather than throwing for fewer than two points', () => {
    const saved = sampleReport();
    expect(() => WeightChart({ body: { ...saved.body!, points: [] } })).not.toThrow();
    expect(WeightChart({ body: { ...saved.body!, points: [] } })).toBeNull();
  });
});
