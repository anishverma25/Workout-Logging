import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  /** What this area does and why it matters. */
  body: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, body, actions, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-4 rounded-[var(--radius-card)] bg-surface p-6',
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-[0.9rem] bg-accent-soft text-accent-text">
        {icon}
      </div>
      <div className="max-w-[46ch]">
        <h2 className="font-display text-[1.45rem] font-bold leading-tight tracking-tight">
          {title}
        </h2>
        <div className="mt-2 text-[0.95rem] leading-relaxed text-muted">{body}</div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Your data could not be read',
  error,
  onRetry,
}: {
  title?: string;
  error?: Error;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] bg-danger-soft p-5"
    >
      <div className="flex items-center gap-2 font-semibold text-danger">
        <AlertTriangle className="size-5" aria-hidden />
        {title}
      </div>
      <p className="text-sm text-muted">
        Nothing was deleted. This usually means the browser blocked local storage (for example in a
        private window).
        {error ? (
          <span className="mt-1 block font-mono text-xs text-faint">{error.message}</span>
        ) : null}
      </p>
      {onRetry ? (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-[var(--radius-card)] bg-surface', className)} />;
}
