import { type CSSProperties, type ReactNode } from 'react';
import {
  AlertTriangle,
  Check,
  CloudOff,
  HardDrive,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconTile } from './data';
import { SecondaryButton } from './actions';

/** Min height 88, surface-2, radius 16, centred Meta --text-2, max two lines. No dashed border. */
export function EmptyState({
  children,
  action,
  className,
}: {
  children: ReactNode;
  /** Optional neutral action under the text. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-22 flex-col items-center justify-center gap-2 rounded-nested bg-surface-2 px-5 py-4 text-center',
        className,
      )}
    >
      <p className="type-meta line-clamp-2 max-w-[32ch] text-text-2 [text-wrap:balance]">
        {children}
      </p>
      {action}
    </div>
  );
}

/** Screen-level error: icon tile, Headline, Meta, "Try again". */
export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = 'Try again',
  className,
}: {
  title: string;
  message?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-panel border border-border bg-surface px-5 py-8 text-center',
        className,
      )}
    >
      <IconTile icon={<AlertTriangle />} />
      <div>
        <p className="type-headline text-text-1">{title}</p>
        {message ? (
          <p className="type-meta mt-1 max-w-[36ch] text-text-2 [text-wrap:balance]">{message}</p>
        ) : null}
      </div>
      {onRetry ? (
        <SecondaryButton compact onClick={onRetry}>
          {retryLabel}
        </SecondaryButton>
      ) : null}
    </div>
  );
}

/**
 * Placeholder with the exact final dimensions, so nothing shifts when content arrives.
 * Shimmers unless reduced motion is on.
 */
export function Skeleton({
  width,
  height,
  radius = 'nested',
  className,
}: {
  width?: CSSProperties['width'];
  height: CSSProperties['height'];
  radius?: 'tile' | 'field' | 'nested' | 'panel' | 'full';
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'skeleton bg-surface-2',
        {
          tile: 'rounded-tile',
          field: 'rounded-field',
          nested: 'rounded-nested',
          panel: 'rounded-panel',
          full: 'rounded-full',
        }[radius],
        className,
      )}
      style={{ width: width ?? '100%', height }}
    />
  );
}

/**
 * The toast's look: surface-2, radius 16, Body --text-1, optional icon in --text-2. Never lime.
 * Shown by the toast provider (useKitToast); exported for the component check.
 */
export function ToastView({
  message,
  icon = <Check />,
  action,
}: {
  message: string;
  icon?: ReactNode | null;
  action?: { label: string; onSelect: () => void };
}) {
  return (
    <div className="pointer-events-auto flex min-h-12 max-w-[min(30rem,calc(100vw-2rem))] items-center gap-3 rounded-nested bg-surface-2 py-2 pr-2 pl-4">
      {icon ? (
        <span className="inline-flex size-5 shrink-0 text-text-2 [&>svg]:size-5" aria-hidden>
          {icon}
        </span>
      ) : null}
      <p className="type-body min-w-0 flex-1 py-1 text-text-1">{message}</p>
      {action ? (
        <button
          type="button"
          onClick={action.onSelect}
          className="pressable type-headline h-9 shrink-0 rounded-field px-3 text-text-1 hover:bg-surface"
        >
          {action.label}
        </button>
      ) : (
        <span className="w-2" />
      )}
    </div>
  );
}

/** A surface-2 row with an icon, for offline and info notes. Warning tone only for real warnings. */
export function InlineNotice({
  children,
  icon,
  tone = 'info',
  action,
  className,
}: {
  children: ReactNode;
  icon?: ReactNode;
  tone?: 'info' | 'warning';
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'warning' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-nested bg-surface-2 px-4 py-3', className)}
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 inline-flex size-5 shrink-0 [&>svg]:size-5',
          tone === 'warning' ? 'text-warning' : 'text-text-2',
        )}
      >
        {icon ?? (tone === 'warning' ? <AlertTriangle /> : <CloudOff />)}
      </span>
      <div className="type-meta min-w-0 flex-1 text-text-1">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export type SyncStatusTone = 'local' | 'pending' | 'synced' | 'problem';

const syncIcon: Record<SyncStatusTone, LucideIcon> = {
  local: HardDrive,
  pending: RefreshCw,
  synced: Check,
  problem: AlertTriangle,
};

/**
 * Where data is, in the words of describeSync (src/data/sync/describe.ts): pass its tone and
 * title unchanged. Icons are neutral; only the problem icon is --warning. Never lime.
 */
export function SyncStatus({
  tone,
  title,
  action,
  className,
}: {
  tone: SyncStatusTone;
  title: string;
  /** A "Details" link. */
  action?: ReactNode;
  className?: string;
}) {
  const Icon = syncIcon[tone];
  return (
    <div role="status" className={cn('flex items-center gap-2', className)}>
      <Icon
        className={cn('size-4 shrink-0', tone === 'problem' ? 'text-warning' : 'text-text-2')}
        aria-hidden
      />
      <span className="type-meta text-text-2">{title}</span>
      {action}
    </div>
  );
}
