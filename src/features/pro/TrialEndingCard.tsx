import { useMemo } from 'react';
import { Crown } from 'lucide-react';
import { useEntitlement } from '@/app/entitlement';
import { CapsuleButton } from '@/components/kit';
import { usePreferences } from '@/data/hooks';
import { buildProgress } from '@/domain/analytics/progress';
import type { TrainingData } from '@/domain/analytics/sessions';
import { trialEndingCopy, trialEndingDue } from '@/domain/entitlement/trialEnding';
import { proFindings } from '@/features/progress/proFindings';

/**
 * The last 3 days of the trial (batch 9): when it ends, what Pro found in the person's own
 * logs, and what stays free. Calm on purpose: no countdown, no urgency.
 */
export function TrialEndingCard({ data }: { data: TrainingData }) {
  const e = useEntitlement();
  const prefs = usePreferences();
  const due = e.plan === 'trial' && !e.unknown && trialEndingDue(e.remainingMs);
  const findings = useMemo(() => {
    if (!due) return [];
    const model = buildProgress(data, {
      range: '30d',
      exerciseId: null,
      now: new Date(),
      weekStartsOn: prefs.weekStartsOn,
      unit: prefs.weightUnit,
    });
    return proFindings(model).map((f) => f.fact);
  }, [due, data, prefs.weekStartsOn, prefs.weightUnit]);
  if (!due || !e.trialEndsAt) return null;
  const copy = trialEndingCopy(e.trialEndsAt, findings);
  return (
    <section
      aria-labelledby="trial-ending-title"
      className="mb-6 rounded-card bg-surface p-4"
      data-trial-ending
    >
      <div className="flex items-center gap-2">
        <Crown className="size-4 text-lime" aria-hidden />
        <h2 id="trial-ending-title" className="type-headline text-text-1">
          {copy.title}
        </h2>
      </div>
      {copy.findings.length > 0 ? (
        <>
          <p className="type-footnote mt-3 text-text-2">What Pro found in your logs</p>
          <ul className="mt-1 flex flex-col gap-1">
            {copy.findings.map((f) => (
              <li key={f} className="type-subhead text-text-1">
                {f}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="type-subhead mt-3 text-text-2">{copy.free}</p>
      <div className="mt-4">
        <CapsuleButton to="/pro" tone="lime">
          See plans
        </CapsuleButton>
      </div>
    </section>
  );
}
