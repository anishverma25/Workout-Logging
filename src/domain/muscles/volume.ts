import { isHardSet, PRIMARY_SET_WEIGHT, SECONDARY_SET_WEIGHT } from '../analytics/muscles';
import { isWorkingSet, type Session } from '../analytics/sessions';
import { targetsFor } from './targets';
import { groupOf, MUSCLE_BY_ID } from './taxonomy';

/**
 * Sets per muscle group and per muscle, from the muscle taxonomy (November 2026). The rules are
 * the app's existing ones, applied with more detail, and kept deliberately simple:
 *
 * - Only hard working sets count (`isHardSet`, as everywhere else).
 * - A group gets a direct set when any of the exercise's main muscles belongs to it, once per
 *   set however many of its muscles are main. It gets an indirect set when only assisting
 *   muscles belong to it. Weighted sets = direct × 1 + indirect × 0.5, as for the 12 groups.
 * - A muscle or head (level 3) is only ever credited with direct sets, from exercises that list
 *   it as a main muscle. This says which exercises trained it, not how much it grew: the
 *   stimulus to one head cannot be measured from the exercise name.
 * - Stabilizers are never counted.
 *
 * The 12-group numbers the Progress page, the Brain and the weekly report use (`muscleWorkload`)
 * are unchanged.
 */

export interface GroupVolume {
  group: string;
  direct: number;
  indirect: number;
  weighted: number;
  /** Direct sets per main muscle of the group, most first. */
  muscles: { id: string; direct: number }[];
}

export function detailedVolume(sessions: Session[]): GroupVolume[] {
  const groups = new Map<string, { direct: number; indirect: number }>();
  const muscles = new Map<string, number>();
  for (const session of sessions) {
    for (const { exercise, sets } of session.exercises) {
      if (!exercise) continue;
      const n = sets.filter((s) => isWorkingSet(s) && isHardSet(s)).length;
      if (n === 0) continue;
      const t = targetsFor(exercise);
      const mainGroups = new Set(t.primary.map((m) => groupOf(m)?.id).filter(Boolean) as string[]);
      const helpGroups = new Set(
        t.secondary
          .map((m) => groupOf(m)?.id)
          .filter((g): g is string => !!g && !mainGroups.has(g)),
      );
      for (const g of mainGroups) {
        const v = groups.get(g) ?? { direct: 0, indirect: 0 };
        v.direct += n;
        groups.set(g, v);
      }
      for (const g of helpGroups) {
        const v = groups.get(g) ?? { direct: 0, indirect: 0 };
        v.indirect += n;
        groups.set(g, v);
      }
      for (const m of new Set(t.primary)) {
        if (MUSCLE_BY_ID.get(m)?.level === 3) muscles.set(m, (muscles.get(m) ?? 0) + n);
      }
    }
  }
  return [...groups.entries()]
    .map(([group, v]) => ({
      group,
      direct: v.direct,
      indirect: v.indirect,
      weighted: v.direct * PRIMARY_SET_WEIGHT + v.indirect * SECONDARY_SET_WEIGHT,
      muscles: [...muscles.entries()]
        .filter(([id]) => groupOf(id)?.id === group)
        .map(([id, direct]) => ({ id, direct }))
        .sort((a, b) => b.direct - a.direct),
    }))
    .sort((a, b) => b.weighted - a.weighted);
}
