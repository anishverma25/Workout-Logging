import { describe, expect, it } from 'vitest';
import { areaOfRegion, exerciseLevels, leadsFromBehind, shareRole, sharesByArea } from './bodyMap';
import { MUSCLE_SHARES } from '@/data/library/shares';

describe('share roles', () => {
  it('primary is the top muscle or 30% and over; secondary 10 to 29; minor under 10', () => {
    expect(shareRole(0, 5)).toBe('primary');
    expect(shareRole(1, 30)).toBe('primary');
    expect(shareRole(1, 29)).toBe('secondary');
    expect(shareRole(2, 10)).toBe('secondary');
    expect(shareRole(3, 5)).toBe('minor');
  });
  it('shades each area at its strongest role', () => {
    const levels = exerciseLevels([
      { region: 'Mid chest (sternal pec)', share: 35 },
      { region: 'Triceps long head', share: 20 },
      { region: 'Upper chest (clavicular pec)', share: 5 },
    ]);
    expect(levels.get('chest')).toBe(3);
    expect(levels.get('triceps')).toBe(2);
  });
  it('groups shares by area, biggest first, adding up to the drawn total', () => {
    const g = sharesByArea([
      { region: 'Mid chest (sternal pec)', share: 35 },
      { region: 'Lower chest (costal pec)', share: 20 },
      { region: 'Triceps lateral & medial heads', share: 15 },
      { region: 'Front delts', share: 15 },
      { region: 'Upper chest (clavicular pec)', share: 10 },
      { region: 'Triceps long head', share: 5 },
    ]);
    expect(g.map((x) => [x.label, x.share])).toEqual([
      ['Chest', 65],
      ['Triceps', 20],
      ['Shoulders', 15],
    ]);
  });
  it('back-led exercises show the back first', () => {
    expect(leadsFromBehind([{ region: 'Lats' }])).toBe(true);
    expect(leadsFromBehind([{ region: 'Mid chest (sternal pec)' }])).toBe(false);
  });
  it('every region in the library is drawn on the body, except the two the drawing has no part for', () => {
    const missing = Object.values(MUSCLE_SHARES)
      .flatMap((s) => s.regions.map((r) => r.region))
      .filter((r) => areaOfRegion(r) === null);
    expect([...new Set(missing)].sort()).toEqual(['Iliopsoas', 'Sartorius', 'Serratus anterior']);
  });
});
