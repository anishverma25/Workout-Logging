import { Link } from 'react-router';
import { AlertTriangle, CloudCheck, HardDrive, RefreshCw, type LucideIcon } from 'lucide-react';
import { useAccount, useSyncStatus } from '@/app/account';
import { describeSync, type SyncTone } from '@/data/sync/describe';
import { cn } from '@/lib/cn';
import { useNow } from '@/lib/useNow';

const TONE: Record<SyncTone, { icon: LucideIcon; className: string }> = {
  local: { icon: HardDrive, className: 'text-faint' },
  pending: { icon: RefreshCw, className: 'text-warn' },
  synced: { icon: CloudCheck, className: 'text-accent-text' },
  problem: { icon: AlertTriangle, className: 'text-danger' },
};

function useSyncDescription() {
  const account = useAccount();
  const sync = useSyncStatus();
  const now = useNow(30_000);
  return describeSync(sync, account.status === 'signedIn', now);
}

/** Compact line for the sidebar and settings: where your data is right now. */
export function SyncBadge({ className }: { className?: string }) {
  const account = useAccount();
  const description = useSyncDescription();
  if (account.status === 'unavailable' || account.status === 'loading') return null;
  const { icon: Icon, className: tone } = TONE[description.tone];
  return (
    <Link
      to={account.status === 'signedIn' ? '/account' : '/sign-in'}
      className={cn(
        'flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-text',
        className,
      )}
      title={description.detail}
    >
      <Icon className={cn('size-4 shrink-0', tone)} aria-hidden />
      <span className="truncate">{description.title}</span>
    </Link>
  );
}

export function SyncSummary() {
  const description = useSyncDescription();
  const { icon: Icon, className: tone } = TONE[description.tone];
  return (
    <div className="flex gap-3" role="status" aria-label="Sync status">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2">
        <Icon className={cn('size-5', tone)} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{description.title}</p>
        <p className="mt-0.5 text-sm text-muted">{description.detail}</p>
      </div>
    </div>
  );
}

/** One quiet line under a finished workout: saved on this device, or synced to the account. */
export function SyncLine({ className }: { className?: string }) {
  const account = useAccount();
  const description = useSyncDescription();
  const { icon: Icon, className: tone } = TONE[description.tone];
  const signedIn = account.status === 'signedIn';
  return (
    <p
      className={cn('flex items-center gap-2 text-sm text-faint', className)}
      role="status"
      aria-label="Sync status"
    >
      <Icon className={cn('size-4 shrink-0', tone)} aria-hidden />
      <span>
        {signedIn ? description.title : 'Saved on this device only.'}
        {account.status === 'unavailable' || account.status === 'loading' ? null : (
          <>
            {' '}
            <Link
              to={signedIn ? '/account' : '/sign-in?next=/account'}
              className="underline underline-offset-4"
            >
              {signedIn ? 'Details' : 'Back it up'}
            </Link>
          </>
        )}
      </span>
    </p>
  );
}
