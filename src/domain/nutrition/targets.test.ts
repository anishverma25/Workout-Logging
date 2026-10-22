import type { EnergyPlan } from '../analytics/body';
import {
  calculatedTargets,
  calculatedWaterMl,
  dailyTargets,
  macroKcal,
  targetMode,
} from './targets';

const energy = {
  targetKcal: 2500,
  proteinG: [128, 160],
  fatMinG: 65,
} as unknown as EnergyPlan;

describe('calculated targets', () => {
  it('works out every macro from energy, protein and body weight', () => {
    const c = calculatedTargets(energy, 80)!;
    expect(c.kcal).toBe(2500);
    expect(c.proteinG).toBe(144);
    // Fat: the larger of 0.8 g/kg (64 g) and a quarter of energy (69 g), to 5 g.
    expect(c.fatG).toBe(70);
    // Carbohydrate is what is left: (2500 - 576 - 630) / 4 = 323, to 5 g.
    expect(c.carbsG).toBe(325);
    expect(c.fibreG).toBe(35);
    expect(c.waterMl).toBe(2750);
    // The macros add back to the energy within rounding.
    expect(Math.abs(macroKcal(c) - c.kcal)).toBeLessThan(60);
  });

  it('keeps fat at 0.8 g/kg for a heavier person on a low energy target', () => {
    const c = calculatedTargets({ ...energy, targetKcal: 1800 } as EnergyPlan, 110)!;
    expect(c.fatG).toBe(90);
  });

  it('never goes below zero carbs and returns null without an energy plan', () => {
    const c = calculatedTargets({ ...energy, targetKcal: 900 } as EnergyPlan, 80)!;
    expect(c.carbsG).toBeGreaterThanOrEqual(0);
    expect(calculatedTargets(null, 80)).toBeNull();
  });

  it('gives water as 35 ml per kg to 250 ml, between 1.5 and 4.5 litres', () => {
    expect(calculatedWaterMl(60)).toBe(2000);
    expect(calculatedWaterMl(80)).toBe(2750);
    expect(calculatedWaterMl(35)).toBe(1500);
    expect(calculatedWaterMl(200)).toBe(4500);
    expect(calculatedWaterMl(null)).toBeNull();
  });
});

describe('daily targets and the mode choice', () => {
  it('has no mode until the person chooses or has typed a number', () => {
    expect(targetMode(null)).toBeNull();
    expect(targetMode({})).toBeNull();
    expect(targetMode({ proteinTargetG: 150 })).toBe('own');
    expect(targetMode({ targetMode: 'calculated', proteinTargetG: 150 })).toBe('calculated');
  });

  it('uses the calculated numbers in calculated mode, even when own ones are saved', () => {
    const t = dailyTargets({ targetMode: 'calculated', calorieTarget: 3000 }, energy, 80);
    expect(t.kcal).toBe(2500);
    expect(t.kcalSource).toBe('calculated');
    expect(t.mode).toBe('calculated');
  });

  it('uses typed numbers in own mode and falls back to calculated for the rest', () => {
    const t = dailyTargets(
      { targetMode: 'own', calorieTarget: 3000, fibreTargetG: 40, waterTargetMl: 3500 },
      energy,
      80,
    );
    expect(t).toMatchObject({
      kcal: 3000,
      kcalSource: 'set',
      fibreG: 40,
      waterMl: 3500,
      proteinG: 144,
      proteinSource: 'calculated',
      mode: 'own',
    });
  });

  it('still gives water from body weight when there is no energy plan', () => {
    const t = dailyTargets(null, null, 70);
    expect(t.kcal).toBeNull();
    expect(t.waterMl).toBe(2500);
    expect(t.mode).toBeNull();
  });
});
