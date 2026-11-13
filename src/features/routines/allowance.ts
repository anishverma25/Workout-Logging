import { useFeature } from '@/app/entitlement';
import { useTrainingData } from '@/data/hooks';

/** Routines on the free plan; Pro has no limit. Routines over the limit are kept, never removed. */
export const FREE_ROUTINES = 2;

/** Whether this account may add another routine (new, duplicate, saved from a workout, shared). */
export function useRoutineAllowance() {
  const unlimited = useFeature('unlimited_routines');
  const training = useTrainingData();
  const count = (training.data?.routines ?? []).filter(
    (r) => r.deletedAt === null && r.origin === 'user',
  ).length;
  return { unlimited, count, canAdd: unlimited || count < FREE_ROUTINES };
}
