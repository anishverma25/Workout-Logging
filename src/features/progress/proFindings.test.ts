import { describe, expect, it } from 'vitest';
import { generateDemoDataset } from '@/data/demo/generate';
import { SYSTEM_EXERCISES } from '@/data/library/exercises';
import { buildProgress } from '@/domain/analytics/progress';
import type { TrainingData } from '@/domain/analytics/sessions';
import { proFindings } from './proFindings';

function modelAt(iso: string) {
  const now = new Date(iso);
  const data: TrainingData = { exercises: SYSTEM_EXERCISES, ...generateDemoDataset(now) };
  return buildProgress(data, { range: '7d', exerciseId: null, now, weekStartsOn: 1, unit: 'kg' });
}

describe('what Pro found', () => {
  it('states only facts the engine found, each with the locked part', () => {
    const model = modelAt('2026-11-14T12:00:00Z');
    const found = proFindings(model);
    expect(found.length).toBeGreaterThan(0);
    for (const f of found) {
      expect(f.fact).toMatch(/ready for more weight|stalled|out of balance/);
      expect(f.locked.length).toBeGreaterThan(0);
    }
    const off = model.balance.filter((b) => b.verdict === 'a_heavy' || b.verdict === 'b_heavy');
    expect(found.some((f) => f.fact.includes('out of balance'))).toBe(off.length > 0);
    expect(found.some((f) => f.fact.includes('stalled'))).toBe(model.plateaus.length > 0);
  });

  it('names stalls when there are some', () => {
    const found = proFindings(modelAt('2026-11-15T20:00:00Z'));
    expect(found.map((f) => f.fact)).toContain('2 lifts have stalled');
  });

  it('says nothing when nothing was found', () => {
    expect(proFindings({ progression: [], plateaus: [], balance: [] })).toEqual([]);
  });
});
