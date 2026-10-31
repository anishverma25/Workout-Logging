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
        'flex flex-col items-start gap-4 rounded-panel border border-border bg-surface p-5',
        className,
      )}
    >
      <div className="flex size-9 items-center justify-center rounded-tile bg-surface-2 text-text-2 [&_svg]:size-5">
        {icon}
      </div>
      <div className="max-w-[46ch]">
        <h2 className="type-title text-text-1">{title}</h2>
        <div className="type-body mt-1 text-text-2 [text-wrap:balance]">{body}</div>
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
      className="flex flex-col items-start gap-3 rounded-panel border border-border bg-surface p-5"
    >
      <div className="type-headline flex items-center gap-3 text-text-1">
        <span className="flex size-9 items-center justify-center rounded-tile bg-surface-2 text-text-2">
          <AlertTriangle className="size-5" aria-hidden />
        </span>
        {title}
      </div>
      <p className="type-meta text-text-2">
        Nothing was deleted. This usually means the browser blocked local storage (for example in a
        private window).
        {error ? (
          <span className="mt-1 block font-mono text-xs text-text-2">{error.message}</span>
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
  return <div aria-hidden className={cn('skeleton rounded-panel bg-surface-2', className)} />;
}
