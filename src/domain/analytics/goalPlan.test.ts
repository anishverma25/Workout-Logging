import { describe, expect, it } from 'vitest';
import { intakeOutcome, MIN_DAILY_KCAL, targetPlan, type TargetInput } from './goalPlan';

const base: TargetInput = {
  weightKg: 80,
  targetKg: 72,
  goal: 'fat_loss',
  experience: 'intermediate',
  maintenanceKcal: 2600,
  bmrKcal: 1750,
  today: '2026-10-27',
};

describe('targetPlan', () => {
  it('cuts at 0.75% a week with cutting protein, and says when', () => {
    const p = targetPlan(base);
    expect(p.direction).toBe('lose');
    // 0.6 kg a week × 7,700 ÷ 7 = 660 kcal under 2,600, rounded to 50.
    expect(p.kcal).toBe(1950);
    // 2.2 g per kg × 80 kg.
    expect(p.proteinG).toBe(175);
    expect(p.outcome.status).toBe('on_track');
    // About 8 kg at about 0.6 kg a week: 13 to 14 weeks.
    expect(p.outcome.weeks).toBeGreaterThan(13);
    expect(p.outcome.weeks).toBeLessThan(14);
    expect(p.outcome.date! > '2027-01-20' && p.outcome.date! < '2027-02-05').toBe(true);
  });

  it('gains at the lean-gain rate for the training age', () => {
    const p = targetPlan({ ...base, goal: 'hypertrophy', experience: 'beginner', targetKg: 84 });
    expect(p.direction).toBe('gain');
    expect(p.kcal).toBeGreaterThan(2600);
    // 0.375% of 80 kg = 0.3 kg a week (calories rounded to 50): 4 kg in 12 to 14 weeks.
    expect(p.outcome.weeks).toBeGreaterThan(12);
    expect(p.outcome.weeks).toBeLessThan(14);
  });

  it('follows the target when the goal points the other way', () => {
    const p = targetPlan({ ...base, goal: 'hypertrophy' });
    expect(p.goalOverridden).toBe(true);
    expect(p.kcal).toBeLessThan(2600);
  });

  it('holds when the target is within half a kilo', () => {
    const p = targetPlan({ ...base, targetKg: 80.3 });
    expect(p.direction).toBe('hold');
    expect(p.kcal).toBe(2600);
    expect(p.outcome.status).toBe('at_target');
  });

  it('never goes under resting energy or 1,200 kcal', () => {
    const p = targetPlan({ ...base, maintenanceKcal: 1800, bmrKcal: 1500 });
    expect(p.kcal).toBe(1500);
    expect(p.floored).toBe(true);
    expect(p.kcal).toBeGreaterThanOrEqual(MIN_DAILY_KCAL);
  });
});

describe('intakeOutcome', () => {
  const at = (kcal: number, proteinG: number | null = 175) =>
    intakeOutcome({ ...base, kcal, proteinG });

  it('moves the date when the calories change', () => {
    const plan = at(1950);
    const smaller = at(2200);
    expect(smaller.weeks!).toBeGreaterThan(plan.weeks!);
    expect(smaller.date! > plan.date!).toBe(true);
  });

  it('flags too fast, slow, no change, the wrong way and too low', () => {
    expect(at(1400).status).toBe('too_fast');
    expect(at(2450).status).toBe('slow');
    expect(at(2600).status).toBe('no_change');
    expect(at(2900).status).toBe('wrong_way');
    expect(at(1100).status).toBe('too_low');
    expect(at(2900).date).toBeNull();
  });

  it('checks protein against the goal range', () => {
    expect(at(1950, 120).proteinLow).toBe(true);
    expect(at(1950, 120).proteinPerKg).toBe(1.5);
    expect(at(1950, 175).proteinLow).toBe(false);
  });
});
