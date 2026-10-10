import type { Insight } from '@/domain/analytics/insights';
import { cn } from '@/lib/cn';
import { INSIGHT_TONE as TONE } from '../shared/insightTone';

/** The single most useful insight, with the data it is based on spelled out. */
export function InsightCard({ insights, className }: { insights: Insight[]; className?: string }) {
  const insight = insights[0];
  if (!insight) return null;
  const { icon: Icon, ring } = TONE[insight.tone];
  return (
    <section
      aria-label="Training insight"
      className={cn('rounded-panel border border-border bg-surface p-5', className)}
    >
      <div className="flex gap-3">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-tile', ring)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="type-headline text-text-1">{insight.title}</p>
          <p className="type-meta mt-1 text-text-2">{insight.basis}</p>
        </div>
      </div>
    </section>
  );
}
