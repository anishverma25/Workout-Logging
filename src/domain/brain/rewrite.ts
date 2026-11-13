import type { Change } from './engine';
import { MAX_SETS_PER_EXERCISE } from './limits';

/**
 * The programme rewrite: turns the week's decisions into exact edits of the person's routine.
 * Pure. It returns the edits and the edits that undo them, so a temporary change (a lighter
 * week, a swap around pain, short sessions in exam week) can be put back exactly.
 */

export interface Slot {
  id: string;
  dayId: string;
  exerciseId: string;
  order: number;
  targetSets: number;
  restSeconds: number;
  primaryMuscle: string;
  secondaryMuscles: string[];
  category: 'compound' | 'isolation';
}

export interface DayPlan {
  id: string;
  /** Times a week the day is trained (its planned weekdays, at least once). */
  perWeek: number;
}

export interface Patch {
  slotId: string;
  targetSets?: number;
  exerciseId?: string;
}

/** Seconds a set takes, for session length. */
export const SET_SECONDS = 40;

const perWeekOf = (days: DayPlan[]) => new Map(days.map((d) => [d.id, Math.max(1, d.perWeek)]));

/** Planned weekly sets per muscle: direct sets count 1, helping sets 0.5. */
export function plannedMuscleSets(slots: Slot[], days: DayPlan[]): Record<string, number> {
  const freq = perWeekOf(days);
  const out: Record<string, number> = {};
  for (const s of slots) {
    const n = s.targetSets * (freq.get(s.dayId) ?? 1);
    if (s.primaryMuscle !== 'cardio') out[s.primaryMuscle] = (out[s.primaryMuscle] ?? 0) + n;
    for (const m of s.secondaryMuscles)
      if (m !== s.primaryMuscle && m !== 'cardio') out[m] = (out[m] ?? 0) + n * 0.5;
  }
  return out;
}

/** Minutes a day takes: every set and the rest after it. */
export function dayMinutes(slots: Slot[]): number {
  return slots.reduce((n, s) => n + (s.targetSets * (SET_SECONDS + s.restSeconds)) / 60, 0);
}

/** The longest planned session in minutes, or null without a routine. */
export function longestSession(slots: Slot[]): number | null {
  const byDay = new Map<string, Slot[]>();
  for (const s of slots) byDay.set(s.dayId, [...(byDay.get(s.dayId) ?? []), s]);
  if (byDay.size === 0) return null;
  return Math.round(Math.max(...[...byDay.values()].map(dayMinutes)));
}

export interface Rewrite {
  patches: Patch[];
  /** Edits that put every touched exercise back as it was. */
  undo: Patch[];
  /** Changes that could not be turned into an edit (no exercise for the muscle, no room). */
  unapplied: string[];
}

export function rewriteRoutine(slotsIn: Slot[], days: DayPlan[], changes: Change[]): Rewrite {
  const freq = perWeekOf(days);
  const slots = slotsIn.map((s) => ({ ...s }));
  const original = new Map(slotsIn.map((s) => [s.id, s]));
  const touched = new Set<string>();
  const unapplied: string[] = [];
  const touch = (s: Slot) => touched.add(s.id);

  for (const change of changes) {
    if (change.kind === 'sets') {
      let remaining = Math.abs(change.to - change.from);
      const adding = change.to > change.from;
      const mine = slots.filter((s) => s.primaryMuscle === change.muscle);
      for (;;) {
        if (remaining <= 0) break;
        const left = remaining;
        const slot = mine
          .filter((s) => (freq.get(s.dayId) ?? 1) <= left)
          .filter((s) => (adding ? s.targetSets < MAX_SETS_PER_EXERCISE : s.targetSets > 1))
          .sort((a, b) =>
            adding
              ? a.targetSets - b.targetSets ||
                Number(b.category === 'compound') - Number(a.category === 'compound') ||
                a.order - b.order
              : b.targetSets - a.targetSets ||
                Number(b.category === 'isolation') - Number(a.category === 'isolation') ||
                b.order - a.order,
          )[0];
        if (!slot) break;
        slot.targetSets += adding ? 1 : -1;
        remaining -= freq.get(slot.dayId) ?? 1;
        touch(slot);
      }
      if (remaining === Math.abs(change.to - change.from)) unapplied.push(change.id);
    } else if (change.kind === 'swap') {
      const mine = slots.filter((s) => s.exerciseId === change.fromExerciseId);
      if (mine.length === 0) unapplied.push(change.id);
      for (const slot of mine) {
        slot.exerciseId = change.toExerciseId;
        touch(slot);
      }
    } else if (change.kind === 'deload') {
      for (const slot of slots) {
        const to = Math.max(1, Math.round(slot.targetSets * change.share));
        if (to !== slot.targetSets) {
          slot.targetSets = to;
          touch(slot);
        }
      }
    } else if (change.kind === 'session') {
      const byDay = new Map<string, Slot[]>();
      for (const s of slots) byDay.set(s.dayId, [...(byDay.get(s.dayId) ?? []), s]);
      for (const list of byDay.values()) {
        // The extras go first, a set at a time from whichever has the most left; the main
        // lifts keep at least two sets.
        const pick = (category: Slot['category'], min: number) =>
          list
            .filter((s) => s.category === category && s.targetSets > min)
            .sort((a, b) => b.targetSets - a.targetSets || b.order - a.order)[0];
        while (dayMinutes(list) > change.minutes) {
          const slot = pick('isolation', 1) ?? pick('compound', 2);
          if (!slot) break;
          slot.targetSets -= 1;
          touch(slot);
        }
      }
    }
  }

  const patches: Patch[] = [];
  const undo: Patch[] = [];
  for (const slot of slots) {
    if (!touched.has(slot.id)) continue;
    const before = original.get(slot.id)!;
    const patch: Patch = { slotId: slot.id };
    const back: Patch = { slotId: slot.id };
    if (slot.targetSets !== before.targetSets) {
      patch.targetSets = slot.targetSets;
      back.targetSets = before.targetSets;
    }
    if (slot.exerciseId !== before.exerciseId) {
      patch.exerciseId = slot.exerciseId;
      back.exerciseId = before.exerciseId;
    }
    if (patch.targetSets === undefined && patch.exerciseId === undefined) continue;
    patches.push(patch);
    undo.push(back);
  }
  return { patches, undo, unapplied };
}
