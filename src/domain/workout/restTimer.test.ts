import {
  adjustRest,
  restedSec,
  isFinished,
  isRunning,
  pauseRest,
  remainingMs,
  resetRest,
  restProgress,
  resumeRest,
  startRest,
} from './restTimer';

const t0 = new Date('2026-10-05T12:00:00.000Z');
const at = (s: number) => new Date(t0.getTime() + s * 1000);

describe('rest timer', () => {
  it('counts down from the clock, not from ticks', () => {
    const s = startRest(90, t0, 'w');
    expect(remainingMs(s, at(0))).toBe(90_000);
    expect(remainingMs(s, at(30.5))).toBe(59_500);
    expect(isRunning(s, at(89))).toBe(true);
    expect(remainingMs(s, at(500))).toBe(0);
    expect(isFinished(s, at(90))).toBe(true);
    expect(restProgress(s, at(45))).toBeCloseTo(0.5, 6);
  });

  it('clamps silly durations', () => {
    expect(startRest(0, t0, null).durationSec).toBe(5);
    expect(startRest(5000, t0, null).durationSec).toBe(900);
  });

  it('pauses and resumes without losing time', () => {
    const s = startRest(120, t0, 'w');
    const paused = pauseRest(s, at(20));
    expect(remainingMs(paused, at(300))).toBe(100_000);
    expect(isRunning(paused, at(300))).toBe(false);
    expect(isFinished(paused, at(300))).toBe(false);
    const resumed = resumeRest(paused, at(300));
    expect(remainingMs(resumed, at(350))).toBe(50_000);
    expect(pauseRest(paused, at(400))).toBe(paused);
    expect(resumeRest(resumed, at(400))).toBe(resumed);
  });

  it('adds and removes time, and the total follows in both directions', () => {
    const s = startRest(60, t0, 'w');
    // 10 s in, 50 s left; +15 makes 65 s left and a 75 s rest in total.
    const more = adjustRest(s, 15, at(10));
    expect(remainingMs(more, at(10))).toBe(65_000);
    expect(more.durationSec).toBe(75);
    const shorter = adjustRest(more, -15, at(10));
    expect(shorter.durationSec).toBe(60);
    // Never below what was already rested.
    const less = adjustRest(more, -120, at(10));
    expect(remainingMs(less, at(10))).toBe(0);
    expect(less.durationSec).toBe(10);
    expect(restedSec(less, at(10))).toBe(10);
    expect(restedSec(more, at(40))).toBe(40);
    const pausedMore = adjustRest(pauseRest(s, at(10)), 30, at(10));
    expect(remainingMs(pausedMore, at(999))).toBe(80_000);
  });

  it('resets to the full length, stopped', () => {
    const r = resetRest(startRest(90, t0, 'w'));
    expect(remainingMs(r, at(1000))).toBe(90_000);
    expect(isRunning(r, at(1000))).toBe(false);
  });
});
