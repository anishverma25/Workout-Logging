import { buildData } from '@/test/fixtures';
import { buildSessions, workingSetCount } from './sessions';
import { sessionVolumeLoad } from './volume';

describe('volume load', () => {
  it('sums load x reps for completed working, back-off and drop sets', () => {
    const [s] = buildSessions(
      buildData([
        {
          at: '2026-09-01T18:00:00Z',
          exercises: [
            {
              key: 'barbell-bench-press',
              sets: [
                { w: 40, r: 8, type: 'warmup' },
                { w: 80, r: 8 },
                { w: 80, r: 7 },
                { w: 70, r: 10, type: 'backoff' },
                { w: 60, r: 8, type: 'drop' },
              ],
            },
          ],
        },
      ]),
    );
    // warm-up excluded: 640 + 560 + 700 + 480
    expect(sessionVolumeLoad(s!)).toBe(2380);
    expect(workingSetCount(s!)).toBe(4);
  });

  it('ignores incomplete sets', () => {
    const [s] = buildSessions(
      buildData([
        {
          at: '2026-09-01T18:00:00Z',
          exercises: [
            {
              key: 'barbell-bench-press',
              sets: [
                { w: 80, r: 8 },
                { w: 80, r: 8, done: false },
              ],
            },
          ],
        },
      ]),
    );
    expect(sessionVolumeLoad(s!)).toBe(640);
    expect(workingSetCount(s!)).toBe(1);
  });

  it('counts both hands for per-hand dumbbell exercises', () => {
    const [s] = buildSessions(
      buildData([
        {
          at: '2026-09-01T18:00:00Z',
          exercises: [{ key: 'dumbbell-curl', sets: [{ w: 12, r: 10 }] }],
        },
      ]),
    );
    expect(sessionVolumeLoad(s!)).toBe(240);
  });

  it('excludes bodyweight exercises from volume load but counts their sets', () => {
    const [s] = buildSessions(
      buildData([
        {
          at: '2026-09-01T18:00:00Z',
          exercises: [
            {
              key: 'pull-up',
              sets: [
                { w: null, r: 8 },
                { w: null, r: 7 },
              ],
            },
          ],
        },
      ]),
    );
    expect(sessionVolumeLoad(s!)).toBe(0);
    expect(workingSetCount(s!)).toBe(2);
  });
});
