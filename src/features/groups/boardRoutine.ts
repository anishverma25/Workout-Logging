import type { BoardRoutine } from '@/app/community';
import { SYSTEM_EXERCISE_KEYS, SYSTEM_EXERCISES } from '@/data/library/exercises';
import type { SharedRoutine } from '@/domain/routines/share';

const KEY_BY_ID = new Map(SYSTEM_EXERCISES.map((e, i) => [e.id, SYSTEM_EXERCISE_KEYS[i]!]));

/**
 * A board routine as a routine of your own: library exercises only (someone's own exercises are
 * private), with their sets and rep targets, and the usual rest. Never any weights.
 */
export function boardRoutineToShared(
  r: BoardRoutine,
  owner: string,
): {
  routine: SharedRoutine;
  skipped: number;
} {
  let skipped = 0;
  const days = r.days
    .map((d) => ({
      name: d.name.slice(0, 40) || 'Day',
      weekdays: d.weekdays,
      exercises: d.exercises.flatMap((e) => {
        const key = e.exerciseId ? KEY_BY_ID.get(e.exerciseId) : undefined;
        if (!key) {
          skipped += 1;
          return [];
        }
        const repMin = Math.min(e.repMin, e.repMax);
        return [
          {
            key,
            sets: e.sets,
            repMin,
            repMax: Math.max(e.repMin, e.repMax),
            rir: e.rir,
            rest: repMin <= 6 ? 180 : 120,
          },
        ];
      }),
    }))
    .filter((d) => d.exercises.length > 0);
  const name = `${r.name} (from ${owner})`.slice(0, 60);
  return { routine: { v: 1, name, days }, skipped };
}
