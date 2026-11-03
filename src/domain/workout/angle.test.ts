import { angleKind, formatAngle, signedAngle, startAngle } from './angle';

describe('bench angle', () => {
  it('knows which exercises take an incline or a decline', () => {
    expect(angleKind({ name: 'Incline dumbbell press' })).toBe('incline');
    expect(angleKind({ name: 'Decline barbell bench press' })).toBe('decline');
    expect(angleKind({ name: 'Incline dumbbell curl' })).toBe('incline');
    // Flat bench presses take an angle too, starting from flat (November 2026).
    expect(angleKind({ name: 'Barbell bench press' })).toBe('incline');
    expect(angleKind({ name: 'Dumbbell bench press' })).toBe('incline');
    expect(startAngle({ name: 'Barbell bench press' }, 'incline')).toBe(0);
    expect(startAngle({ name: 'Incline barbell bench press' }, 'incline')).toBe(30);
    expect(startAngle({ name: 'Decline barbell bench press' }, 'decline')).toBe(15);
    expect(angleKind({ name: 'Barbell back squat' })).toBeNull();
    // Smith machine presses sit on an adjustable bench, flat to upright.
    expect(angleKind({ name: 'Smith machine bench press' })).toBe('incline');
    expect(angleKind({ name: 'Smith machine shoulder press' })).toBe('incline');
    expect(angleKind({ name: 'Smith machine decline press' })).toBe('decline');
    expect(angleKind({ name: 'Smith machine squat' })).toBeNull();
    expect(angleKind({ name: 'Smith machine row' })).toBeNull();
    expect(angleKind({ name: 'Incline treadmill walk', trackingType: 'cardio' })).toBeNull();
  });

  it('stores decline as negative degrees and reads it back', () => {
    expect(signedAngle('decline', 15)).toBe(-15);
    expect(signedAngle('incline', 30)).toBe(30);
    expect(formatAngle(-15)).toBe('15° decline');
    expect(formatAngle(45)).toBe('45° incline');
    expect(formatAngle(0)).toBe('Flat');
  });
});
