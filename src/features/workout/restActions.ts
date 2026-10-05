import { db } from '@/data/db';
import { saveRestTimer } from '@/data/repositories/meta';
import {
  adjustRest,
  pauseRest,
  resetRest,
  resumeRest,
  startRest,
  type RestTimerState,
} from '@/domain/workout/restTimer';

/** Every rest timer change goes through here, so the bar, the sheet and set completion agree. */
export const restActions = {
  start: (seconds: number, workoutId: string | null) =>
    saveRestTimer(db, startRest(seconds, new Date(), workoutId)),
  pause: (s: RestTimerState) => saveRestTimer(db, pauseRest(s, new Date())),
  resume: (s: RestTimerState) => saveRestTimer(db, resumeRest(s, new Date())),
  adjust: (s: RestTimerState, delta: number) => saveRestTimer(db, adjustRest(s, delta, new Date())),
  reset: (s: RestTimerState) => saveRestTimer(db, resetRest(s)),
  clear: () => saveRestTimer(db, null),
};
