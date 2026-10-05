import type { ReactNode } from 'react';
import { PageHeader } from '@/app/layout/PageHeader';

interface PlannedFeatureProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  /** What this area will let the user do, in plain words. */
  points: string[];
  children?: ReactNode;
}

/**
 * Honest placeholder for an area that is not built yet: it says what is coming instead of
 * showing invented content.
 */
export function PlannedFeature({ title, subtitle, icon, points, children }: PlannedFeatureProps) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <section className="rounded-[var(--radius-card)] border border-dashed border-line-strong p-6">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-surface-2 text-muted">
          {icon}
        </div>
        <h2 className="mt-4 font-display text-2xl font-semibold">Not built yet</h2>
        <p className="mt-1 text-muted">Here is what this space will do:</p>
        <ul className="mt-4 flex flex-col gap-2.5">
          {points.map((p) => (
            <li key={p} className="flex gap-3 text-[0.95rem]">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent-text" aria-hidden />
              {p}
            </li>
          ))}
        </ul>
        {children ? <div className="mt-6">{children}</div> : null}
      </section>
    </>
  );
}
