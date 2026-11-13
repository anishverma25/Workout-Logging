import { describe, expect, it } from 'vitest';
import { nowCard, usualHour, type NowInput } from './now';

const base: NowInput = {
  hour: 14, dayOfMonth: 12, reviewChanges: 0, wrappedMonth: null, weighedToday: true, weighIns14: 10,
  usualWeighHour: 7, plannedDay: null, usualGymHour: 18, workoutOpen: false, foodDays7: 6,
  kcalLeft: 900, proteinLeft: 50, mealNow: 'lunch', mealLogged: true, fits: ['Curd', 'Boiled egg'],
};

describe('the Now card', () => {
  it('is quiet when nothing is worth saying', () => {
    expect(nowCard(base)).toBeNull();
    expect(nowCard({ ...base, foodDays7: 0, weighIns14: 0, hour: 8, weighedToday: false, mealLogged: false })).toBeNull();
  });
  it('changes through the day', () => {
    expect(nowCard({ ...base, hour: 7, weighedToday: false })).toMatchObject({ kind: 'weigh', to: '/body' });
    expect(nowCard({ ...base, hour: 8, mealNow: 'breakfast', mealLogged: false })).toMatchObject({ kind: 'meal', title: 'Log breakfast' });
    expect(nowCard({ ...base, hour: 18, plannedDay: 'Push' })).toMatchObject({ kind: 'train', title: 'Start Push' });
    expect(nowCard({ ...base, hour: 21, mealNow: 'dinner', proteinLeft: 40 })).toMatchObject({
      kind: 'protein', title: '40 g protein left', detail: 'These fit what is left today: Curd, Boiled egg.',
    });
  });
  it('the weekly review comes first, and a weigh-in is not asked for in the afternoon', () => {
    expect(nowCard({ ...base, hour: 7, weighedToday: false, reviewChanges: 2 })).toMatchObject({ kind: 'review' });
    expect(nowCard({ ...base, hour: 15, weighedToday: false })).toBeNull();
    expect(nowCard({ ...base, dayOfMonth: 1, wrappedMonth: 'October' })).toMatchObject({ kind: 'wrapped', title: 'Your October, wrapped' });
    expect(nowCard({ ...base, hour: 18, plannedDay: 'Push', workoutOpen: true })).toBeNull();
  });
  it('finds the usual hour from at least three times', () => {
    expect(usualHour([new Date(2026, 0, 1, 18), new Date(2026, 0, 2, 19), new Date(2026, 0, 3, 7)])).toBe(18);
    expect(usualHour([new Date()])).toBeNull();
  });
});
