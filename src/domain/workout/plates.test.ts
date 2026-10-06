import { platesFor, PLATES_KG, PLATES_LB, warmupSets } from './plates';

describe('plate calculator', () => {
  it('loads each side heaviest first', () => {
    expect(platesFor(100, 20, PLATES_KG)).toEqual({
      perSide: [25, 15],
      achieved: 100,
      remainder: 0,
    });
    expect(platesFor(62.5, 20, PLATES_KG)!.perSide).toEqual([20, 1.25]);
    expect(platesFor(225, 45, PLATES_LB)!.perSide).toEqual([45, 45]);
    expect(platesFor(20, 20, PLATES_KG)!.perSide).toEqual([]);
  });

  it('says what the plates cannot make', () => {
    expect(platesFor(101, 20, PLATES_KG)!.remainder).toBe(1);
    expect(platesFor(15, 20, PLATES_KG)).toBeNull();
  });
});

describe('warm-up sets', () => {
  it('builds from the empty bar to 80% of the working weight', () => {
    expect(warmupSets(100, { bar: 20, step: 2.5 })).toEqual([
      { weight: 20, reps: 10 },
      { weight: 40, reps: 5 },
      { weight: 60, reps: 3 },
      { weight: 80, reps: 1 },
    ]);
  });

  it('skips steps that would repeat or sit below the bar', () => {
    expect(warmupSets(30, { bar: 20, step: 2.5 })).toEqual([{ weight: 22.5, reps: 1 }]);
    expect(warmupSets(20, { bar: 20, step: 2.5 })).toEqual([]);
    expect(warmupSets(24, { bar: null, step: 2 })).toEqual([
      { weight: 8, reps: 5 },
      { weight: 14, reps: 3 },
      { weight: 18, reps: 1 },
    ]);
  });
});
