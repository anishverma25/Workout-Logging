import { describe, expect, it } from 'vitest';
import { equipmentFits } from './equipment';

describe('what the equipment allows', () => {
  it('a full gym (or nothing said) allows everything', () => {
    expect(equipmentFits('barbell', 'full_gym')).toBe(true);
    expect(equipmentFits('machine', null)).toBe(true);
  });
  it('dumbbells only, and home', () => {
    expect(equipmentFits('dumbbell', 'dumbbells')).toBe(true);
    expect(equipmentFits('barbell', 'dumbbells')).toBe(false);
    expect(equipmentFits('dumbbell', 'home')).toBe(false);
    expect(equipmentFits('dumbbell', 'home', 'walking-lunge')).toBe(true);
    expect(equipmentFits('bodyweight', 'home')).toBe(true);
  });
});
