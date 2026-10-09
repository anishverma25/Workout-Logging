/**
 * Rest timer as data. It stores when rest ends, not how many seconds are left, so the
 * remaining time is always computed from the clock: a refresh, a locked phone or a throttled
 * background tab cannot make it drift. Pausing freezes the remaining time.
 */
export interface RestTimerState {
  workoutId: string | null;
  durationSec: number;
  /** When rest ends, ISO. Null while paused. */
  endsAt: string | null;
  /** Remaining time while paused, ms. */
  pausedRemainingMs: number | null;
}

export const REST_PRESETS = [60, 90, 120, 180] as const;
export const MIN_REST_SEC = 5;
export const MAX_REST_SEC = 900;

const clampSec = (s: number) => Math.min(MAX_REST_SEC, Math.max(MIN_REST_SEC, Math.round(s)));

export function startRest(
  durationSec: number,
  now: Date,
  workoutId: string | null,
): RestTimerState {
  const d = clampSec(durationSec);
  return {
    workoutId,
    durationSec: d,
    endsAt: new Date(now.getTime() + d * 1000).toISOString(),
    pausedRemainingMs: null,
  };
}

export function remainingMs(state: RestTimerState, now: Date): number {
  if (state.pausedRemainingMs !== null) return state.pausedRemainingMs;
  if (!state.endsAt) return 0;
  return Math.max(0, Date.parse(state.endsAt) - now.getTime());
}

export function isRunning(state: RestTimerState | null, now: Date): boolean {
  return !!state && state.pausedRemainingMs === null && remainingMs(state, now) > 0;
}

export function isFinished(state: RestTimerState | null, now: Date): boolean {
  return !!state && state.pausedRemainingMs === null && remainingMs(state, now) === 0;
}

export function pauseRest(state: RestTimerState, now: Date): RestTimerState {
  if (state.pausedRemainingMs !== null) return state;
  return { ...state, endsAt: null, pausedRemainingMs: remainingMs(state, now) };
}

export function resumeRest(state: RestTimerState, now: Date): RestTimerState {
  if (state.pausedRemainingMs === null) return state;
  return {
    ...state,
    endsAt: new Date(now.getTime() + state.pausedRemainingMs).toISOString(),
    pausedRemainingMs: null,
  };
}

/**
 * Adds or removes time. The total length moves with it in both directions, so "of 2:15" always
 * shows the rest you will actually have taken. Never below the time already rested.
 */
export function adjustRest(state: RestTimerState, deltaSec: number, now: Date): RestTimerState {
  const leftMs = remainingMs(state, now);
  const elapsedMs = Math.max(0, state.durationSec * 1000 - leftMs);
  const nextLeft = Math.max(0, Math.min(MAX_REST_SEC * 1000 - elapsedMs, leftMs + deltaSec * 1000));
  const durationSec = Math.max(1, Math.round((elapsedMs + nextLeft) / 1000));
  if (state.pausedRemainingMs !== null)
    return { ...state, durationSec, pausedRemainingMs: nextLeft };
  return { ...state, durationSec, endsAt: new Date(now.getTime() + nextLeft).toISOString() };
}

/** Seconds rested so far: the full length once it has run out. */
export function restedSec(state: RestTimerState, now: Date): number {
  return Math.round((state.durationSec * 1000 - remainingMs(state, now)) / 1000);
}

/** Back to the full length, stopped, ready to start again. */
export function resetRest(state: RestTimerState): RestTimerState {
  return { ...state, endsAt: null, pausedRemainingMs: state.durationSec * 1000 };
}

/** 0 to 1, how much of the rest has passed. */
export function restProgress(state: RestTimerState, now: Date): number {
  if (state.durationSec <= 0) return 1;
  return 1 - remainingMs(state, now) / (state.durationSec * 1000);
}
