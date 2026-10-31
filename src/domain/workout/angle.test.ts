import { angleKind, formatAngle, signedAngle } from './angle';

describe('bench angle', () => {
  it('knows which exercises take an incline or a decline', () => {
    expect(angleKind({ name: 'Incline dumbbell press' })).toBe('incline');
    expect(angleKind({ name: 'Decline barbell bench press' })).toBe('decline');
    expect(angleKind({ name: 'Incline dumbbell curl' })).toBe('incline');
    expect(angleKind({ name: 'Barbell bench press' })).toBeNull();
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
