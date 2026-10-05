import { CircleAlert, Info, TrendingUp } from 'lucide-react';
import type { Insight } from '@/domain/analytics/insights';
import { cn } from '@/lib/cn';

const TONE = {
  positive: { icon: TrendingUp, ring: 'bg-accent-soft text-accent-text' },
  attention: { icon: CircleAlert, ring: 'bg-warn-soft text-warn' },
  neutral: { icon: Info, ring: 'bg-surface-3 text-muted' },
} as const;

/** The single most useful insight, with the data it is based on spelled out. */
export function InsightCard({ insights, className }: { insights: Insight[]; className?: string }) {
  const insight = insights[0];
  if (!insight) return null;
  const { icon: Icon, ring } = TONE[insight.tone];
  return (
    <section
      aria-label="Training insight"
      className={cn('rounded-[var(--radius-card)] border border-line bg-surface-2 p-5', className)}
    >
      <div className="flex gap-3.5">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', ring)}>
          <Icon className="size-[1.15rem]" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[1.05rem] font-semibold leading-snug">{insight.title}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-faint">{insight.basis}</p>
        </div>
      </div>
    </section>
  );
}
