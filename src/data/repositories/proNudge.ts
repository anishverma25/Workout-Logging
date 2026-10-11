import { EMPTY_NUDGE_STATE, MAX_NUDGES, type NudgeState } from '@/domain/entitlement/nudge';
import type { WorkoutDatabase } from '../db';
import { getMeta, META_KEYS, setMeta } from './meta';

/**
 * Which Pro reminders this account has already seen. Device state, not training data: it is
 * never synced and never leaves the device, so the worst a new device does is start the four
 * reminders over.
 */

interface Stored {
  shownIds?: unknown;
  lastShownAt?: unknown;
  dismissedAt?: unknown;
}

const date = (value: unknown): Date | null => {
  if (typeof value !== 'string') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function getNudgeState(db: WorkoutDatabase): Promise<NudgeState> {
  const stored = await getMeta<Stored>(db, META_KEYS.proNudge);
  if (!stored) return EMPTY_NUDGE_STATE;
  const ids = Array.isArray(stored.shownIds)
    ? stored.shownIds.filter((id): id is string => typeof id === 'string').slice(0, MAX_NUDGES)
    : [];
  return {
    shownIds: ids,
    lastShownAt: date(stored.lastShownAt),
    dismissedAt: date(stored.dismissedAt),
  };
}

async function write(db: WorkoutDatabase, state: NudgeState): Promise<void> {
  await setMeta(db, META_KEYS.proNudge, {
    shownIds: state.shownIds,
    lastShownAt: state.lastShownAt?.toISOString() ?? null,
    dismissedAt: state.dismissedAt?.toISOString() ?? null,
  });
}

/** Records that a reminder was shown, so the same one is never shown twice. */
export async function recordNudgeShown(
  db: WorkoutDatabase,
  id: string,
  now = new Date(),
): Promise<void> {
  const state = await getNudgeState(db);
  if (state.shownIds.includes(id)) return;
  await write(db, { ...state, shownIds: [...state.shownIds, id], lastShownAt: now });
}

/** "Not now": the next reminder waits a good while longer. */
export async function recordNudgeDismissed(db: WorkoutDatabase, now = new Date()): Promise<void> {
  const state = await getNudgeState(db);
  await write(db, { ...state, dismissedAt: now });
}
