import type { PersonalRecord } from '@/domain/analytics/prs';
import { formatSignedPercent } from '@/lib/format';
import { formatWeight, type WeightUnit } from '@/lib/units';

/** How much a record beat the previous best: "+2.5 kg (+3.1%)", "+1 rep", "+15 s". */
export function improvementText(pr: PersonalRecord, unit: WeightUnit): string {
  const diff = pr.value - pr.previousBest;
  // Reps records, a set's or a whole session's, are counted in reps, never kilograms (T5).
  if (pr.type === 'reps' && pr.weightKg)
    return `+${diff} ${diff === 1 ? 'rep' : 'reps'}, with ${formatWeight(pr.weightKg, unit)} help`;
  if (pr.type === 'reps' || pr.type === 'session_reps')
    return `+${diff} ${diff === 1 ? 'rep' : 'reps'}`;
  if (pr.type === 'duration') return `+${Math.round(diff)} s`;
  if (pr.type === 'distance') return `+${Math.round(diff)} m`;
  return `+${formatWeight(diff, unit)} (${formatSignedPercent(diff / pr.previousBest, 1)})`;
}
