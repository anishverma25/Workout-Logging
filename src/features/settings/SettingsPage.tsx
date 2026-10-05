import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  DEV_STATES,
  getDevEntitlement,
  onDevEntitlementChange,
  setDevEntitlement,
  type DevEntitlementState,
} from '@/app/devEntitlement';
import { FlaskConical, HardDrive, RotateCcw, Smartphone, Trash2 } from 'lucide-react';
import { isIosSafari, promptInstall, usePwa } from '@/app/pwa';
import { PageHeader } from '@/app/layout/PageHeader';
import { useTheme, type ThemePreference } from '@/app/theme';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useAccount } from '@/app/account';
import { SyncSummary } from '@/features/account/SyncStatus';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { clearDemoData, loadDemoData, resetDemoData } from '@/data/demo/service';
import { DEMO_FEATURED_DAYS, DEMO_HISTORY_DAYS } from '@/data/demo/generate';
import { useDemoStatus, usePreferences } from '@/data/hooks';
import { updatePreferences } from '@/data/repositories/meta';
import { getStorageState, requestPersistentStorage, type StorageState } from '@/data/storage';
import { formatShortDate } from '@/lib/dates';

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex max-w-2xl flex-col gap-5">
        <AppearanceSection />
        <UnitsSection />
        <InstallSection />
        <StorageSection />
        <DemoSection />
        {import.meta.env.DEV ? <DeveloperSection /> : null}
      </div>
    </>
  );
}

function Row({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        {detail ? <p className="mt-0.5 text-sm text-faint">{detail}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function AppearanceSection() {
  const { preference, setPreference } = useTheme();
  return (
    <Card className="p-5">
      <h2 className="mb-3 font-display text-xl font-semibold">Appearance</h2>
      <Row title="Theme" detail="System follows your phone or computer setting.">
        <SegmentedControl<ThemePreference>
          label="Theme"
          value={preference}
          onChange={setPreference}
          options={[
            { value: 'system', label: 'System' },
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ]}
        />
      </Row>
    </Card>
  );
}

function UnitsSection() {
  const prefs = usePreferences();
  const toast = useToast();
  return (
    <Card className="p-5">
      <h2 className="mb-3 font-display text-xl font-semibold">Units</h2>
      <Row
        title="Weight"
        detail="Changes how weights are shown. Your logged numbers are never altered."
      >
        <SegmentedControl
          label="Weight unit"
          value={prefs.weightUnit}
          onChange={async (weightUnit) => {
            await updatePreferences(db, { weightUnit });
            toast(`Showing weights in ${weightUnit}`);
          }}
          options={[
            { value: 'kg', label: 'kg' },
            { value: 'lb', label: 'lb' },
          ]}
        />
      </Row>
    </Card>
  );
}

function InstallSection() {
  const { installPrompt, installed } = usePwa();
  let detail: string;
  if (installed)
    detail = 'Installed. It opens from your home screen, works offline and updates itself.';
  else if (installPrompt)
    detail = 'Add it to your home screen. It opens like an app and works offline.';
  else if (isIosSafari()) detail = 'In Safari, tap Share, then Add to Home Screen.';
  else detail = "Use your browser's menu to install it or add it to your home screen.";
  return (
    <Card className="p-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-semibold">
        <Smartphone className="size-5 text-faint" aria-hidden /> Install the app
      </h2>
      <Row title={installed ? 'Installed' : 'Home screen'} detail={detail}>
        {installPrompt && !installed ? (
          <Button size="sm" variant="secondary" onClick={() => void promptInstall()}>
            Install
          </Button>
        ) : null}
      </Row>
    </Card>
  );
}

function StorageSection() {
  const account = useAccount();
  const signedIn = account.status === 'signedIn';
  const [state, setState] = useState<StorageState | null>(null);
  useEffect(() => {
    void getStorageState().then(setState);
  }, []);
  const label =
    state === 'persisted'
      ? 'Protected. The browser will keep your data.'
      : state === 'best-effort'
        ? 'Not protected yet. The browser may clear it if space runs low or the site goes unused.'
        : state === 'unsupported'
          ? 'This browser does not report storage protection.'
          : 'Checking...';
  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 font-display text-xl font-semibold">
        <HardDrive className="size-5 text-faint" aria-hidden /> Data on this device
      </h2>
      <p className="mb-4 text-sm text-muted">
        {signedIn
          ? 'Everything is saved on this device first, so the app works offline, and then synced to your account.'
          : 'Workouts are saved on this device. Without an account, this device holds your only copy.'}
      </p>
      <div className="mb-4 rounded-xl bg-surface-2 p-4">
        <SyncSummary />
        {account.status === 'signedOut' ? (
          <ButtonLink to="/sign-in?next=/account" size="sm" className="mt-3">
            Sign in to back up
          </ButtonLink>
        ) : null}
      </div>
      <Row title="Storage protection" detail={label}>
        {state === 'best-effort' ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => setState(await requestPersistentStorage())}
          >
            Protect my data
          </Button>
        ) : null}
      </Row>
    </Card>
  );
}

function DemoSection() {
  const account = useAccount();
  if (account.status === 'signedIn') {
    return (
      <Card className="p-5" id="demo-data" aria-labelledby="demo-title">
        <h2
          id="demo-title"
          className="mb-1 flex items-center gap-2 font-display text-xl font-semibold"
        >
          <FlaskConical className="size-5 text-warn" aria-hidden /> Demo data
        </h2>
        <p className="text-sm text-muted">
          Your account only ever holds your own training, so demo data is not available while you
          are signed in. Sign out to explore the demo on this device.
        </p>
      </Card>
    );
  }
  return <GuestDemoSection />;
}

function GuestDemoSection() {
  const demo = useDemoStatus();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<unknown>, message: string) => async () => {
    setBusy(true);
    try {
      await fn();
      toast(message);
    } finally {
      setBusy(false);
    }
  };
  const loaded = demo.data?.loaded ?? false;

  return (
    <Card className="p-5" id="demo-data" aria-labelledby="demo-title">
      <h2
        id="demo-title"
        className="mb-1 flex items-center gap-2 font-display text-xl font-semibold"
      >
        <FlaskConical className="size-5 text-warn" aria-hidden /> Demo data
      </h2>
      <p className="mb-4 text-sm text-muted">
        A fictional athlete, Arjun, with {DEMO_HISTORY_DAYS / 7} weeks of Push Pull Legs training.
        The last {DEMO_FEATURED_DAYS} days are the featured week. Demo records are kept separate and
        clearing them never touches your own workouts.
      </p>
      <div className="mb-4 rounded-xl bg-surface-2 px-4 py-3 text-sm" role="status">
        {demo.status === 'loading'
          ? 'Checking...'
          : loaded
            ? `Loaded: ${demo.data?.workouts ?? 0} workouts${demo.data?.loadedAt ? `, generated ${formatShortDate(new Date(demo.data.loadedAt))}` : ''}.`
            : 'Not loaded.'}
      </div>
      <div className="flex flex-wrap gap-2">
        {!loaded ? (
          <Button
            disabled={busy}
            icon={<FlaskConical className="size-4" aria-hidden />}
            onClick={run(() => loadDemoData(db), 'Demo data loaded')}
          >
            Load demo data
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              disabled={busy}
              icon={<RotateCcw className="size-4" aria-hidden />}
              onClick={run(() => resetDemoData(db), 'Demo data reset to today')}
            >
              Reset to today
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              icon={<Trash2 className="size-4" aria-hidden />}
              onClick={run(() => clearDemoData(db), 'Demo data cleared')}
            >
              Clear demo data
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

/** Development builds only: preview each access state. Removed from production builds. */
function DeveloperSection() {
  const value = useSyncExternalStore(onDevEntitlementChange, getDevEntitlement);
  return (
    <Card className="border-dashed p-5">
      <h2 className="mb-1 font-display text-xl font-semibold">Developer</h2>
      <p className="mb-4 text-sm text-muted">
        Only in development builds. Changes what this browser tab shows, never the account.
      </p>
      <Row title="Access state" detail="Preview trial and Pro screens.">
        <select
          aria-label="Access state"
          className="h-10 rounded-xl border border-line bg-surface-2 px-3"
          value={value}
          onChange={(e) => setDevEntitlement(e.target.value as DevEntitlementState)}
        >
          {DEV_STATES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Row>
    </Card>
  );
}
