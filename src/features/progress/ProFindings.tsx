import { Link } from 'react-router';
import { ChevronRight, Crown, Lock } from 'lucide-react';
import type { ProgressModel } from '@/domain/analytics/progress';
import { proFindings } from './proFindings';

/**
 * For free members: what Pro has already found in their own logs, each as a real fact with the
 * answer locked. Nothing is invented and nothing of theirs is hidden: the facts come from the
 * same engine as the Pro sections, and only the explanation and the next step are Pro.
 */
export function ProFindings({ model }: { model: ProgressModel }) {
  const findings = proFindings(model);
  if (findings.length === 0) return null;
  return (
    <Link
      to="/pro"
      className="pressable glow-lime relative mt-6 block overflow-hidden rounded-panel bg-surface p-5"
      data-pro-findings
    >
      <div className="flex items-center gap-2">
        <Crown className="size-4 text-lime" aria-hidden />
        <p className="type-caption font-semibold text-lime">What Pro found in your training</p>
      </div>
      <ul className="mt-3 flex flex-col gap-3">
        {findings.map((f) => (
          <li key={f.fact}>
            <p className="type-headline text-text-1">{f.fact}</p>
            <p className="type-subhead flex items-center gap-1.5 text-text-2">
              <Lock className="size-3.5 shrink-0" aria-hidden />
              {f.locked}
            </p>
          </li>
        ))}
      </ul>
      <p className="type-subhead mt-4 flex items-center gap-1 font-semibold text-lime">
        See it all with Pro <ChevronRight className="size-4" aria-hidden />
      </p>
    </Link>
  );
}
