import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('rounded-panel border border-border bg-surface', className)}
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
        <h2 id={id} className="type-title text-text-1">
          {title}
        </h2>
        {detail ? <p className="type-meta mt-0.5 line-clamp-2 text-text-2">{detail}</p> : null}
      </div>
      {action ? (
        <Link
          to={action.to}
          className="pressable tap-target type-body inline-flex shrink-0 items-center gap-1 rounded-tile font-medium text-text-1 underline-offset-4 hover:underline"
        >
          {action.label}
          <ChevronRight className="size-4 text-text-2" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
