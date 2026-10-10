import { COPY, TREND_WINDOW_WEEKS } from './thresholdCopy';
import { TREND_DAYS } from './dashboard';
import { PROJECTION_MIN_POINTS, PROJECTION_MIN_WEEKS } from './goals';
import { FREQUENCY_MIN_DAYS } from './progress';
import { PLATEAU_MIN_SESSIONS, PLATEAU_WEEKS } from './standards';
import { MIN_TREND_SESSIONS } from './strength';

/** The numbers quoted in a sentence, in order. */
const numbers = (text: string) => (text.match(/\d+(\.\d+)?/g) ?? []).map(Number);

describe('copy quotes the same thresholds the analytics use (D8)', () => {
  it('strength trends', () => {
    expect(TREND_WINDOW_WEEKS).toBe(TREND_DAYS / 7);
    expect(Number.isInteger(TREND_WINDOW_WEEKS)).toBe(true);
    expect(numbers(COPY.strengthTrendsEmpty)).toEqual([MIN_TREND_SESSIONS, TREND_WINDOW_WEEKS]);
    expect(numbers(COPY.strengthTrendsDetail)).toEqual([1, TREND_WINDOW_WEEKS]);
  });

  it('stalled lifts', () => {
    expect(numbers(COPY.stalledLiftsEmpty)).toEqual([PLATEAU_MIN_SESSIONS]);
    expect(numbers(COPY.stalledLiftsDetail)).toEqual([1, PLATEAU_WEEKS, PLATEAU_MIN_SESSIONS]);
  });

  it('goal projection', () => {
    expect(numbers(COPY.goalProjectionEmpty)).toEqual([
      PROJECTION_MIN_POINTS,
      PROJECTION_MIN_WEEKS,
    ]);
  });

  it('training frequency', () => {
    expect(numbers(COPY.frequencyEmpty)).toEqual([FREQUENCY_MIN_DAYS]);
  });
});
