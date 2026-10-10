import { useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { HardDriveUpload, KeyRound, LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { deleteAccount, signOut, useAccount, useSyncStatus } from '@/app/account';
import { PageHeader } from '@/app/layout/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmSheet, Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/Fields';
import { useToast } from '@/components/ui/Toast';
import { db, guestDatabase } from '@/data/db';
import { useGuestImport } from '@/data/hooks';
import { syncController } from '@/data/sync/controller';
import { retryRejected } from '@/data/sync/engine';
import { copyGuestData, hasGuestData, markMigrationHandled } from '@/data/sync/migrate';
import { pluralize } from '@/lib/format';
import { AccountsUnavailable } from './AuthPages';
import { SyncSummary } from './SyncStatus';

/** Pages that only make sense with an account send signed-out visitors to sign in first. */
export function RequireAccount({ children }: { children: ReactNode }) {
  const account = useAccount();
  const location = useLocation();
  if (account.status === 'unavailable') return <AccountsUnavailable />;
  if (account.status === 'loading') return null;
  if (account.status !== 'signedIn') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?next=${next}`} replace />;
  }
  return <>{children}</>;
}

export function AccountPage() {
  return (
    <RequireAccount>
      <AccountContent />
    </RequireAccount>
  );
}

function AccountContent() {
  const account = useAccount();
  return (
    <>
      <PageHeader
        back={{ to: '/more', label: 'More' }}
        title="Account"
        subtitle={account.user?.email ?? undefined}
      />
      <div className="flex max-w-2xl flex-col gap-5">
        <SyncCard />
        <GuestImportCard userId={account.user!.id} />
        <Card className="p-5">
          <h2 className="mb-1 font-display text-xl font-semibold">Sign-in and security</h2>
          <p className="mb-4 text-sm text-muted">
            Your account is protected by your password. Nobody else can see your training data.
          </p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink
              to="/reset-password"
              variant="secondary"
              icon={<KeyRound className="size-4" aria-hidden />}
            >
              Change password
            </ButtonLink>
            <SignOutButton />
          </div>
        </Card>
        <DeleteAccountCard />
      </div>
    </>
  );
}

function SyncCard() {
  const sync = useSyncStatus();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="p-5">
      <h2 className="mb-4 font-display text-xl font-semibold">Sync</h2>
      <SyncSummary />
      <p className="mt-4 text-sm text-faint">
        Everything is saved on this device first, so the app works offline. Changes go to your
        account as soon as there is a connection.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={busy || sync.phase === 'syncing'}
          icon={<RefreshCw className="size-4" aria-hidden />}
          onClick={() =>
            run(async () => {
              await syncController.syncNow();
              const after = syncController.getState();
              toast(after.phase === 'idle' ? 'Sync finished' : 'Could not sync right now');
            })
          }
        >
          Sync now
        </Button>
        {sync.rejected > 0 ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await retryRejected(db);
                await syncController.syncNow();
              })
            }
          >
            Try failed changes again
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function GuestImportCard({ userId }: { userId: string }) {
  const state = useGuestImport(userId);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const data = state.data;
  if (!data || data.handled || !hasGuestData(data.summary)) return null;
  const s = data.summary;
  const parts = [
    s.workouts ? pluralize(s.workouts, 'workout') : null,
    s.routines ? pluralize(s.routines, 'routine') : null,
    s.customExercises ? pluralize(s.customExercises, 'custom exercise') : null,
    s.bodyWeights ? pluralize(s.bodyWeights, 'body weight entry', 'body weight entries') : null,
    s.hasActiveWorkout ? 'an unfinished workout' : null,
  ].filter(Boolean);

  const copy = async () => {
    setBusy(true);
    try {
      const guest = guestDatabase();
      const result = await copyGuestData(guest, db);
      await markMigrationHandled(guest, userId, 'copied');
      toast(
        result.skippedActiveWorkout
          ? 'Added to your account. Your unfinished workout stayed on this device because the account has one open.'
          : 'Added to your account',
      );
      void syncController.syncNow();
    } catch (err) {
      console.error(err);
      toast('Could not add the data. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-accent/40 p-5" aria-labelledby="import-title">
      <h2
        id="import-title"
        className="mb-1 flex items-center gap-2 font-display text-xl font-semibold"
      >
        <HardDriveUpload className="size-5 text-accent-text" aria-hidden /> Data on this device
      </h2>
      <p className="text-[0.95rem] text-muted">
        Before you signed in, this device saved {parts.join(', ')}. Add a copy to your account to
        back it up and see it everywhere you sign in.
      </p>
      <p className="mt-2 text-sm text-faint">
        Demo data is never added. The copy on this device stays as it is.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={copy}>
          {busy ? 'Adding...' : 'Add to my account'}
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => markMigrationHandled(guestDatabase(), userId, 'skipped')}
        >
          Not now
        </Button>
      </div>
    </Card>
  );
}

function SignOutButton() {
  const sync = useSyncStatus();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const waiting = sync.pending;
  const confirm = async () => {
    setBusy(true);
    try {
      const { removedLocalCopy } = await signOut();
      toast(
        removedLocalCopy ? 'Signed out' : 'Signed out. Unsynced changes are kept on this device.',
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not sign out');
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        variant="ghost"
        icon={<LogOut className="size-4" aria-hidden />}
        onClick={() => setOpen(true)}
      >
        Sign out
      </Button>
      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Sign out?"
        busy={busy}
        confirmLabel="Sign out"
        onConfirm={confirm}
        body={
          waiting > 0 ? (
            <>
              <p>
                {pluralize(waiting, 'change')} {waiting === 1 ? 'has' : 'have'} not reached your
                account yet. They stay on this device and sync the next time you sign in here.
              </p>
              <p className="mt-2">To avoid that, connect to the internet and sync first.</p>
            </>
          ) : (
            <p>
              Your training is safe in your account. This device will forget its copy, and you can
              sign in again at any time.
            </p>
          )
        }
      />
    </>
  );
}

/** Deleting the account: typed confirmation, because it cannot be undone. */
function DeleteAccountCard() {
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="p-5">
      <h2 className="mb-1 font-display text-xl font-semibold">Delete account</h2>
      <p className="mb-4 text-sm text-muted">
        Removes your account and every workout, routine, measurement and goal in it, from the server
        and from this device. Export your data first if you want a copy (Settings). Photos on this
        device are not affected.
      </p>
      <Button
        variant="danger"
        icon={<Trash2 className="size-4" aria-hidden />}
        onClick={() => setOpen(true)}
      >
        Delete my account
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Delete your account?"
        description="This cannot be undone."
        footer={
          <Button
            variant="danger"
            block
            disabled={busy || typed.trim().toLowerCase() !== 'delete'}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await deleteAccount();
                toast('Account deleted');
                navigate('/', { replace: true });
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not delete the account.');
                setBusy(false);
              }
            }}
          >
            {busy ? 'Deleting...' : 'Delete everything'}
          </Button>
        }
      >
        <TextField
          label="Type DELETE to confirm"
          value={typed}
          autoComplete="off"
          error={error}
          onChange={(e) => setTyped(e.target.value)}
        />
      </Sheet>
    </Card>
  );
}
