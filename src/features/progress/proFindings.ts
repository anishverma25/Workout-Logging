import type { ProgressModel } from '@/domain/analytics/progress';
import { pluralize } from '@/lib/format';

/** The facts Pro has found in these logs, each with the part that stays locked. */
export function proFindings(model: Pick<ProgressModel, 'progression' | 'plateaus' | 'balance'>) {
  const findings: { fact: string; locked: string }[] = [];
  if (model.progression.length > 0)
    findings.push({
      fact: `${pluralize(model.progression.length, 'lift is', 'lifts are')} ready for more weight or reps`,
      locked: 'Which ones, and by how much',
    });
  if (model.plateaus.length > 0)
    findings.push({
      fact: `${pluralize(model.plateaus.length, 'lift has', 'lifts have')} stalled`,
      locked: 'The cause, and what to change',
    });
  const off = model.balance.filter(
    (b) => b.ratio !== null && (b.verdict === 'a_heavy' || b.verdict === 'b_heavy'),
  );
  if (off.length > 0)
    findings.push({
      fact: `${pluralize(off.length, 'part of your training is', 'parts of your training are')} out of balance`,
      locked: 'Which muscles, and how many sets to add',
    });
  return findings;
}
