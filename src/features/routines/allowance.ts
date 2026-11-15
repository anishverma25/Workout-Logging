import { FREE_ROUTINES } from '@/domain/entitlement/limits';
import { useFeature } from '@/app/entitlement';
import { useTrainingData } from '@/data/hooks';

/** Routines on the free plan (`domain/entitlement/limits.ts`); over the limit they are kept. */
export { FREE_ROUTINES };

/** Whether this account may add another routine (new, duplicate, saved from a workout, shared). */
export function useRoutineAllowance() {
  const unlimited = useFeature('unlimited_routines');
  const training = useTrainingData();
  const count = (training.data?.routines ?? []).filter(
    (r) => r.deletedAt === null && r.origin === 'user',
  ).length;
  return { unlimited, count, canAdd: unlimited || count < FREE_ROUTINES };
}
