import type { TrainingGoal } from '@/domain/models/schemas';
import { formatWeightValue, type WeightUnit } from '@/lib/units';

export function goalTitle(goal: TrainingGoal, names: Map<string, string>, unit: WeightUnit) {
  const target = `${formatWeightValue(goal.targetValue, unit)} ${unit}`;
  if (goal.kind === 'body_weight') return `Weigh ${target}`;
  const name = names.get(goal.exerciseId ?? '') ?? 'Exercise';
  return goal.kind === 'exercise_e1rm'
    ? `${name}: ${target} estimated 1RM`
    : `${name}: ${target} for a set`;
}
