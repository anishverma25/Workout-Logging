import { describe, expect, it } from 'vitest';
import {
  firstDaysCard,
  learningLine,
  muscleSetsInsight,
  proteinInsight,
  type FirstDaysInput,
} from './firstDays';

const base: FirstDaysInput = {
  ageDays: 2,
  workouts: 0,
  foodDays: 0,
  weighIns: 0,
  plannedDay: null,
  hasRoutine: false,
  muscleSets: {},
  proteinPerKg: null,
  macros: true,
  learning: { week: 1, of: 6 },
  weekFoodDays: 0,
  weekWeighIns: 0,
};
const card = (o: Partial<FirstDaysInput>) => firstDaysCard({ ...base, ...o });

describe('the first 14 days', () => {
  it('no routine: pick one', () => {
    expect(card({})).toMatchObject({ kind: 'pick_routine', to: '/routines' });
  });
  it('a planned day: start it', () => {
    const c = card({ plannedDay: 'Push A', hasRoutine: true });
    expect(c).toMatchObject({ kind: 'first_workout', to: '/workout' });
    expect(c!.detail).toContain('Push A');
  });
  it('a routine but nothing planned today: still the first workout', () => {
    expect(card({ hasRoutine: true })).toMatchObject({ kind: 'first_workout' });
  });
  it('after the first workout: food, then weight', () => {
    expect(card({ workouts: 1 })).toMatchObject({ kind: 'first_food', to: '/food' });
    expect(card({ workouts: 1, foodDays: 1 })).toMatchObject({ kind: 'first_weight', to: '/body' });
  });
  it('all three done: this week’s sets against the research range', () => {
    const c = card({
      workouts: 1,
      foodDays: 1,
      weighIns: 1,
      muscleSets: { Chest: 9, Triceps: 4.5 },
    });
    expect(c).toMatchObject({ kind: 'muscle_sets', to: '/science#volume' });
    expect(c!.title).toBe('Chest: 9 hard sets this week');
    expect(c!.detail).toContain('10 to 20');
  });
  it('after 3 food days: average protein per kg against the goal range', () => {
    const c = card({
      workouts: 1,
      foodDays: 3,
      weighIns: 1,
      proteinPerKg: 1.14,
      proteinRange: [1.6, 2.2],
    });
    expect(c).toMatchObject({ kind: 'protein', to: '/science#protein' });
    expect(c!.title).toBe('You average 1.1 g of protein per kg');
    expect(c!.detail).toBe('For your goal the range starts at 1.6 g.');
  });
  it('no protein numbers without macro tracking', () => {
    const c = card({ workouts: 1, foodDays: 3, weighIns: 1, proteinPerKg: 1.1, macros: false });
    expect(c?.kind).not.toBe('protein');
  });
  it('nothing to say yet: the learning meter', () => {
    const c = card({ workouts: 1, foodDays: 1, weighIns: 1, weekFoodDays: 3, weekWeighIns: 2 });
    expect(c).toMatchObject({ kind: 'learning' });
    expect(c!.detail).toBe('Week 1 of 6. This week: 3 of 5 food days, 2 of 4 weigh-ins.');
  });
  it('after 14 days: only the learning meter, and only while learning', () => {
    expect(card({ ageDays: 15 })).toMatchObject({ kind: 'learning' });
    expect(card({ ageDays: 15, learning: null })).toBeNull();
    expect(card({ ageDays: 14 })).toMatchObject({ kind: 'pick_routine' });
  });
  it('done and learned: nothing', () => {
    expect(
      card({ workouts: 3, foodDays: 3, weighIns: 3, learning: null, macros: false }),
    ).toBeNull();
  });
  it('sets inside and above the range say so', () => {
    expect(muscleSetsInsight({ Back: 14 })!.detail).toContain('inside');
    expect(muscleSetsInsight({ Back: 24 })!.detail).toContain('above');
    expect(muscleSetsInsight({ Back: 0 })).toBeNull();
    expect(muscleSetsInsight({ Back: 1 })!.title).toBe('Back: 1 hard set this week');
  });
  it('protein inside and above the range say so', () => {
    expect(proteinInsight(1.8).detail).toContain('inside');
    expect(proteinInsight(2.6).detail).toContain('above');
  });
  it('the meter never shows more than asked for', () => {
    expect(learningLine({ week: 0, of: 6 }, 7, 7)).toBe(
      'Week 1 of 6. This week: 5 of 5 food days, 4 of 4 weigh-ins.',
    );
  });
});
