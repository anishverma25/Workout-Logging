import type { EnergyPlan } from './body';
import { kcalForRate, rateForKcal, targetInsights } from './targets';

const energy = { tdee: 2700 } as EnergyPlan;
const base = {
  energy,
  weightKg: 80,
  rateKgPerWeek: null,
  goal: 'fat_loss' as const,
  experience: 'intermediate' as const,
  liftRates: [],
};
const find = (r: ReturnType<typeof targetInsights>, id: string) => r.find((i) => i.id === id);

describe('calorie and protein targets', () => {
  it('turns calories into a weekly rate and back', () => {
    expect(rateForKcal(2200, 2700)).toBeCloseTo(-0.4545, 3);
    expect(kcalForRate(2700, -0.6)).toBe(2050);
  });

  it('calls a deficit right for fat loss when it loses 0.5 to 1% a week', () => {
    const r = targetInsights({ ...base, targets: { kcal: 2150, proteinG: null } });
    expect(find(r, 'energy_rate')!.title).toBe('550 kcal below maintenance');
    expect(find(r, 'energy_goal')!.tone).toBe('good');
  });

  it('warns when a deficit is too big and suggests a target', () => {
    const r = targetInsights({ ...base, targets: { kcal: 1500, proteinG: null } });
    const g = find(r, 'energy_goal')!;
    expect(g.tone).toBe('warn');
    // 0.75% of 80 kg = 0.6 kg a week = 660 kcal a day below 2,700.
    expect(g.suggestKcal).toBe(2050);
  });

  it('warns about a surplus when the goal is fat loss, and a deficit when building', () => {
    expect(
      find(targetInsights({ ...base, targets: { kcal: 2900, proteinG: null } }), 'energy_goal')!
        .title,
    ).toBe('No deficit for fat loss');
    expect(
      find(
        targetInsights({ ...base, goal: 'hypertrophy', targets: { kcal: 2400, proteinG: null } }),
        'energy_goal',
      )!.title,
    ).toBe('A deficit while trying to build');
  });

  it('works out real maintenance from the weight trend', () => {
    const r = targetInsights({
      ...base,
      rateKgPerWeek: -0.1,
      targets: { kcal: 2150, proteinG: null },
    });
    const m = find(r, 'maintenance')!;
    // Eating 2,150 and losing 0.1 kg a week: maintenance about 2,260.
    expect(m.body).toContain('about 2,250');
    expect(m.suggestKcal).toBe(1600);
  });

  it('agrees when the trend matches the prediction', () => {
    const r = targetInsights({
      ...base,
      rateKgPerWeek: -0.5,
      targets: { kcal: 2150, proteinG: null },
    });
    expect(find(r, 'maintenance')!.tone).toBe('good');
  });

  it('flags lifts dropping in a deficit', () => {
    const r = targetInsights({
      ...base,
      liftRates: [-1, -0.5, 0.2],
      targets: { kcal: 2150, proteinG: null },
    });
    expect(find(r, 'strength')).toMatchObject({ tone: 'warn', suggestKcal: 2400 });
  });

  it('checks protein in g per kg against the goal', () => {
    const low = find(
      targetInsights({ ...base, targets: { kcal: null, proteinG: 120 } }),
      'protein',
    )!;
    expect(low).toMatchObject({ tone: 'warn', suggestProteinG: 160 });
    expect(
      find(targetInsights({ ...base, targets: { kcal: null, proteinG: 170 } }), 'protein')!.tone,
    ).toBe('good');
    expect(
      find(targetInsights({ ...base, targets: { kcal: null, proteinG: 260 } }), 'protein')!.tone,
    ).toBe('info');
  });
});
