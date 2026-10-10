import { Link } from 'react-router';
import { AlertTriangle, Check, HardDrive, RefreshCw, type LucideIcon } from 'lucide-react';
import { useAccount, useSyncStatus } from '@/app/account';
import { IconTile } from '@/components/kit';
import { describeSync, type SyncTone } from '@/data/sync/describe';
import { cn } from '@/lib/cn';
import { useNow } from '@/lib/useNow';

/*
 * The same icons and colours as the kit's SyncStatus: neutral --text-2, the problem icon in
 * --warning, never lime. These wrappers add the "Sync status" name and the detail line.
 */
const ICON: Record<SyncTone, LucideIcon> = {
  local: HardDrive,
  pending: RefreshCw,
  synced: Check,
  problem: AlertTriangle,
};

const toneClass = (tone: SyncTone) => (tone === 'problem' ? 'text-warning' : 'text-text-2');

function useSyncDescription() {
  const account = useAccount();
  const sync = useSyncStatus();
  const now = useNow(30_000);
  return describeSync(sync, account.status === 'signedIn', now);
}

/** Compact line for the sidebar and More: where your data is right now. */
export function SyncBadge({ className }: { className?: string }) {
  const account = useAccount();
  const description = useSyncDescription();
  if (account.status === 'unavailable' || account.status === 'loading') return null;
  const Icon = ICON[description.tone];
  return (
    <Link
      to={account.status === 'signedIn' ? '/account' : '/sign-in'}
      className={cn(
        'type-meta flex items-center gap-2 rounded-field px-2 py-1.5 text-text-2 hover:bg-surface-2 hover:text-text-1',
        className,
      )}
      title={description.detail}
    >
      <Icon className={cn('size-4 shrink-0', toneClass(description.tone))} aria-hidden />
      <span className="truncate">{description.title}</span>
    </Link>
  );
}

/** Row for Account and Settings: icon tile, Headline title, Meta --text-2 detail. */
export function SyncSummary() {
  const description = useSyncDescription();
  const Icon = ICON[description.tone];
  return (
    <div className="flex min-h-14 items-center gap-3 py-2" role="status" aria-label="Sync status">
      <IconTile icon={<Icon className={toneClass(description.tone)} />} />
      <div className="min-w-0 flex-1">
        <p className="type-headline text-text-1">{description.title}</p>
        <p className="type-meta mt-0.5 text-text-2">{description.detail}</p>
      </div>
    </div>
  );
}

/** One quiet line under a finished workout: saved on this device, or synced to the account. */
export function SyncLine({ className }: { className?: string }) {
  const account = useAccount();
  const description = useSyncDescription();
  const Icon = ICON[description.tone];
  const signedIn = account.status === 'signedIn';
  return (
    <p
      className={cn('type-meta flex items-center gap-2 text-text-2', className)}
      role="status"
      aria-label="Sync status"
    >
      <Icon className={cn('size-4 shrink-0', toneClass(description.tone))} aria-hidden />
      <span>
        {signedIn ? description.title : 'Saved on this device only.'}
        {account.status === 'unavailable' || account.status === 'loading' ? null : (
          <>
            {' '}
            <Link
              to={signedIn ? '/account' : '/sign-in?next=/account'}
              className="font-medium text-text-1 underline underline-offset-4"
            >
              {signedIn ? 'Details' : 'Back it up'}
            </Link>
          </>
        )}
      </span>
    </p>
  );
}
