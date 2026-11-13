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

/**
 * The picture on an empty screen: the screen's own icon in lime, lit from behind and held in two
 * quiet rings, so an empty page looks expected and finished rather than broken.
 */
function EmptyArt({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex size-20 items-center justify-center" aria-hidden data-empty-art>
      <span className="absolute inset-0 rounded-full bg-lime-dim blur-xl" />
      <span className="absolute inset-0 rounded-full border border-lime/20" />
      <span className="absolute inset-2.5 rounded-full border border-dashed border-lime/25" />
      <span className="relative flex size-12 items-center justify-center rounded-full bg-surface-2 text-lime ring-1 ring-divider [&_svg]:size-6">
        {children}
      </span>
    </div>
  );
}

export function EmptyState({ icon, title, body, actions, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-4 rounded-panel border border-border bg-surface p-5',
        className,
      )}
    >
      <EmptyArt>{icon}</EmptyArt>
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
