import { useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { HardDriveUpload, KeyRound, LogOut, Mail, RefreshCw, Trash2 } from 'lucide-react';
import { deleteAccount, signOut, useAccount, useSyncStatus } from '@/app/account';
import {
  BottomSheet,
  Card,
  ConfirmSheet,
  DestructiveButton,
  IconTile,
  ListGroup,
  ListRow,
  PrimaryButton,
  PushedHeader,
  SecondaryButton,
  SectionHeader,
  TextField,
} from '@/components/kit';
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
  const email = account.user?.email ?? undefined;
  return (
    <div className="mx-auto flex w-full max-w-180 flex-col">
      <PushedHeader backLabel="More" backTo="/more" title="Account" />
      <div className="flex flex-col gap-8">
        <SyncSection />
        <GuestImportCard userId={account.user!.id} />
        <section aria-labelledby="security-title">
          <SectionHeader
            id="security-title"
            title="Sign-in and security"
            description="Your account is protected by your password. Nobody else can see your training data."
          />
          <ListGroup>
            {email ? (
              <li>
                <ListRow leading={<IconTile icon={<Mail />} />} title="Email" subtitle={email} />
              </li>
            ) : null}
            <li>
              <ListRow
                to="/reset-password"
                leading={<IconTile icon={<KeyRound />} />}
                title="Change password"
                chevron
              />
            </li>
            <li>
              <SignOutRow />
            </li>
          </ListGroup>
        </section>
        <DeleteAccountCard />
      </div>
    </div>
  );
}

function SyncSection() {
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
    <section aria-labelledby="sync-title">
      <SectionHeader id="sync-title" title="Sync" />
      <ListGroup as="div">
        <SyncSummary />
      </ListGroup>
      <p className="type-meta mt-3 px-1 text-text-2">
        Everything is saved on this device first, so the app works offline. Changes go to your
        account as soon as there is a connection.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <SecondaryButton
          compact
          disabled={busy || sync.phase === 'syncing'}
          icon={<RefreshCw aria-hidden />}
          onClick={() =>
            run(async () => {
              await syncController.syncNow();
              const after = syncController.getState();
              toast(after.phase === 'idle' ? 'Sync finished' : 'Could not sync right now');
            })
          }
        >
          Sync now
        </SecondaryButton>
        {sync.rejected > 0 ? (
          <SecondaryButton
            compact
            disabled={busy}
            onClick={() =>
              run(async () => {
                await retryRejected(db);
                await syncController.syncNow();
              })
            }
          >
            Try failed changes again
          </SecondaryButton>
        ) : null}
      </div>
    </section>
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
    <Card as="section" aria-labelledby="import-title">
      <div className="flex items-center gap-3">
        <IconTile icon={<HardDriveUpload />} />
        <h2 id="import-title" className="type-title text-text-1">
          Data on this device
        </h2>
      </div>
      <p className="type-body mt-3 text-text-2">
        Before you signed in, this device saved {parts.join(', ')}. Add a copy to your account to
        back it up and see it everywhere you sign in.
      </p>
      <p className="type-meta mt-2 text-text-2">
        Demo data is never added. The copy on this device stays as it is.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <PrimaryButton compact disabled={busy} onClick={copy}>
          {busy ? 'Adding...' : 'Add to my account'}
        </PrimaryButton>
        <SecondaryButton
          compact
          disabled={busy}
          onClick={() => markMigrationHandled(guestDatabase(), userId, 'skipped')}
        >
          Not now
        </SecondaryButton>
      </div>
    </Card>
  );
}

function SignOutRow() {
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
      <ListRow
        leading={<IconTile icon={<LogOut />} />}
        title={<span className="text-danger-text">Sign out</span>}
        onClick={() => setOpen(true)}
      />
      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Sign out?"
        busy={busy}
        destructive
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
    <Card as="section" aria-labelledby="delete-title">
      <h2 id="delete-title" className="type-title text-text-1">
        Delete account
      </h2>
      <p className="type-meta mt-1 text-text-2">
        Removes your account and every workout, routine, measurement and goal in it, from the server
        and from this device. Export your data first if you want a copy (Settings). Photos on this
        device are not affected.
      </p>
      <DestructiveButton
        compact
        className="mt-4"
        icon={<Trash2 aria-hidden />}
        onClick={() => setOpen(true)}
      >
        Delete my account
      </DestructiveButton>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Delete your account?"
        subtitle="This cannot be undone."
        footer={
          <DestructiveButton
            block
            loading={busy}
            disabled={typed.trim().toLowerCase() !== 'delete'}
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
          </DestructiveButton>
        }
      >
        <TextField
          label="Type DELETE to confirm"
          value={typed}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          error={error}
          onChange={(e) => setTyped(e.target.value)}
        />
      </BottomSheet>
    </Card>
  );
}
