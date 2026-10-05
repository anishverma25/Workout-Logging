import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]',
        className,
      )}
      {...props}
    />
  );
}

interface SectionHeaderProps {
  title: string;
  /** Short context shown under the title. */
  detail?: ReactNode;
  action?: { label: string; to: string };
  id?: string;
}

export function SectionHeader({ title, detail, action, id }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2
          id={id}
          className="font-display text-[1.35rem] font-semibold leading-none tracking-[0.005em]"
        >
          {title}
        </h2>
        {detail ? <p className="mt-1.5 text-sm text-faint">{detail}</p> : null}
      </div>
      {action ? (
        <Link
          to={action.to}
          className="shrink-0 rounded-md text-sm font-medium text-accent-text underline-offset-4 hover:underline"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
