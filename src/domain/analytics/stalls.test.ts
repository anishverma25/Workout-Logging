import { buildData, type SetSpec } from '@/test/fixtures';
import { SYSTEM_EXERCISES } from '@/data/library/exercises';
import { stableId } from '@/lib/ids';
import { buildSessions } from './sessions';
import { detectStalls } from './stalls';

const NOW = new Date(2026, 9, 7, 20);
const day = (offset: number) => {
  const d = new Date(2026, 9, 7, 10);
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};
const sets = (w: number, r: number, n = 3, rir?: number): SetSpec[] =>
  Array.from({ length: n }, () => ({ w, r, rir }));
const lift = (key: string, list: [number, SetSpec[]][]) =>
  list.map(([offset, s]) => ({ at: day(offset), exercises: [{ key, sets: s }] }));
const stalls = (
  specs: ReturnType<typeof lift>,
  experience: 'beginner' | 'advanced' | null = null,
) => detectStalls(buildSessions(buildData(specs)), NOW, experience, SYSTEM_EXERCISES);

describe('stalled lifts', () => {
  it('ignores a lift that keeps moving, by weight or by reps', () => {
    expect(
      stalls(
        lift('barbell-bench-press', [
          [-35, sets(80, 5)],
          [-28, sets(80, 6)],
          [-21, sets(82.5, 5)],
          [-14, sets(82.5, 6)],
          [-7, sets(82.5, 7)],
          [-1, sets(85, 5)],
        ]),
      ),
    ).toEqual([]);
  });

  it('does not count a light pump set as progress', () => {
    const r = stalls(
      lift('barbell-bench-press', [
        [-42, sets(80, 8)],
        [-35, sets(85, 6)],
        [-28, [...sets(85, 5), { w: 40, r: 20 }]],
        [-21, [...sets(85, 5), { w: 40, r: 22 }]],
        [-14, [...sets(85, 5), { w: 40, r: 25 }]],
        [-7, [...sets(85, 5), { w: 40, r: 26 }]],
      ]),
    );
    expect(r).toHaveLength(1);
    expect(r[0]!.best).toMatchObject({ weightKg: 85, reps: 6 });
  });

  it('reads a long gap as a break, not a plateau', () => {
    const r = stalls(
      lift('leg-press', [
        [-140, sets(160, 10)],
        [-133, sets(170, 10)],
        [-126, sets(175, 8)],
        [-20, sets(140, 10)],
        [-12, sets(150, 10)],
        [-5, sets(155, 10)],
      ]),
    );
    expect(r[0]).toMatchObject({ cause: 'break', sessionsSince: 3 });
    expect(r[0]!.facts.gapWeeks).toBe(15);
  });

  it('flags a lift trained too rarely', () => {
    const r = stalls(
      lift('barbell-bench-press', [
        [-100, sets(80, 5)],
        [-90, sets(85, 5)],
        [-72, sets(82.5, 5)],
        [-54, sets(82.5, 5)],
        [-36, sets(85, 4)],
        [-18, sets(85, 4)],
        [-2, sets(85, 4)],
      ]),
    );
    expect(r[0]!.cause).toBe('frequency');
    expect(r[0]!.facts.perWeek).toBeLessThan(0.75);
  });

  it('flags sets that stop far from failure', () => {
    const r = stalls(
      lift('barbell-bench-press', [
        [-35, sets(80, 5, 3, 2)],
        [-28, sets(85, 5, 3, 3)],
        [-21, sets(85, 5, 3, 4)],
        [-14, sets(85, 5, 3, 3)],
        [-7, sets(85, 4, 3, 4)],
      ]),
    );
    expect(r[0]).toMatchObject({ cause: 'effort', facts: { medianRir: 4 } });
  });

  it('flags fewer sets than before', () => {
    const r = stalls(
      lift('barbell-bench-press', [
        [-42, sets(80, 5, 4)],
        [-35, sets(82.5, 5, 4)],
        [-28, sets(85, 5, 4)],
        [-21, sets(85, 4, 2)],
        [-14, sets(82.5, 5, 2)],
        [-7, sets(85, 3, 2)],
      ]),
    );
    expect(r[0]).toMatchObject({ cause: 'volume', facts: { setsNow: 2, setsBefore: 4 } });
  });

  it('suggests reps first when the weight never changes', () => {
    const r = stalls(
      lift('barbell-bench-press', [
        [-35, sets(80, 5)],
        [-28, sets(85, 6)],
        [-21, sets(85, 5)],
        [-14, sets(85, 6)],
        [-7, sets(85, 5)],
      ]),
    );
    expect(r[0]).toMatchObject({ cause: 'same_load', facts: { loadKg: 85, repsAtLoad: 6 } });
  });

  it('gives each true plateau its own advice, by how long it has lasted', () => {
    const plateau = (weeks: number) =>
      lift('leg-press', [
        [-weeks * 7 - 7, sets(150, 10)],
        [-weeks * 7, sets(160, 10)],
        ...Array.from(
          { length: weeks },
          (_, i) =>
            [-weeks * 7 + (i + 1) * 7 - 3, sets(i % 2 ? 155 : 150, 10)] as [number, SetSpec[]],
        ),
      ]);
    const three = stalls(plateau(3))[0]!;
    expect(three.cause).toBe('rep_range');
    expect(three.facts.reps).toEqual([5, 7]);
    expect(stalls(plateau(3), 'advanced')[0]!.cause).toBe('deload');
    expect(stalls(plateau(4))[0]!.cause).toBe('deload');
    const long = stalls(plateau(7))[0]!;
    expect(long.cause).toBe('variation');
    expect(long.facts.variationId).toBe(stableId('exercise:hack-squat'));
  });

  it('suggests a different lift for the same muscle for an exercise with no listed variation', () => {
    const r = stalls(
      lift('leg-extension', [
        [-56, sets(60, 10)],
        [-49, sets(65, 10)],
        ...[-42, -35, -28, -21, -14, -7].map(
          (o, i) => [o, sets(i % 2 ? 62.5 : 60, 10)] as [number, SetSpec[]],
        ),
      ]),
    );
    const id = r[0]!.facts.variationId!;
    const swap = SYSTEM_EXERCISES.find((e) => e.id === id)!;
    expect(swap.primaryMuscle).toBe('quads');
    expect(swap.id).not.toBe(stableId('exercise:leg-extension'));
  });

  it('leaves out a lift you stopped doing', () => {
    const specs = lift('barbell-bench-press', [
      [-60, sets(80, 5)],
      [-53, sets(85, 5)],
      [-46, sets(80, 5)],
      [-39, sets(80, 5)],
      [-32, sets(80, 5)],
    ]);
    expect(stalls(specs)).toEqual([]);
  });
});
