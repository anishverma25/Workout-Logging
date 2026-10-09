import { ExternalLink } from 'lucide-react';
import { citationUrl } from '@/domain/analytics/citations';
import { shareSource } from '@/data/library/shares';
import type { ExerciseShares } from '@/data/library/muscleShares';
import { cn } from '@/lib/cn';

/**
 * Which muscles an exercise works and roughly how much, from EMG and muscle-growth studies. The
 * numbers are estimates of each muscle's share of the work, rounded to 5%, and say so.
 */
export function MuscleShares({ shares, compact }: { shares: ExerciseShares; compact?: boolean }) {
  return (
    <div>
      <ul className="flex flex-col gap-2" aria-label="Approximate share of the work">
        {shares.regions.map((r) => (
          <li key={r.region}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{r.region}</span>
              <span className="tabular font-semibold text-muted">{r.share}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--ring-track)]">
              <div
                className="h-full rounded-full bg-[var(--ring-1)]"
                style={{ width: `${r.share}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className={cn('text-sm text-muted', compact ? 'mt-2' : 'mt-3')}>{shares.note}</p>
      {!compact ? (
        <>
          <p className="mt-2 text-xs leading-relaxed text-faint">
            Approximate share of the work, rounded to 5%.{' '}
            {shares.confidence === 'moderate'
              ? 'Based on studies of this exercise or a near-identical one.'
              : 'Estimated from the closest exercise that has been studied.'}{' '}
            Muscle activity is not the same as the load each muscle carries, so treat these as a
            guide.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {shares.sources.map((id) => {
              const c = shareSource(id);
              if (!c) return null;
              const url = citationUrl(c);
              const text = `${c.authors.split(',')[0]} et al. ${c.year ?? ''}`.trim();
              return (
                <li key={id} className="text-xs">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-accent-text"
                    >
                      {text}, {c.journal.split(/\s\d/)[0]}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ) : (
                    <span className="text-faint">
                      {text}, {c.journal}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
