import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  DEV_STATES,
  getDevEntitlement,
  onDevEntitlementChange,
  setDevEntitlement,
  type DevEntitlementState,
} from '@/app/devEntitlement';
import { CalendarPlus, Download, FlaskConical, RotateCcw, Trash2 } from 'lucide-react';
import { isIosSafari, promptInstall, usePwa } from '@/app/pwa';
import { PageHeader } from '@/app/layout/PageHeader';
import { useTheme, type ThemePreference } from '@/app/theme';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useAccount } from '@/app/account';
import { SyncSummary } from '@/features/account/SyncStatus';
import { Panel, PanelRow, Switch } from '@/components/ui/List';
import { setDeviceSetting, useDeviceSettings } from '@/app/deviceSettings';
import { bodyCsv, downloadText, setsCsv } from '@/data/export';
import { trainingCalendar } from '@/data/calendar';
import { activeRoutine, daysForRoutine } from '@/domain/analytics/schedule';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { clearDemoData, loadDemoData, resetDemoData } from '@/data/demo/service';
import { DEMO_FEATURED_DAYS, DEMO_HISTORY_DAYS } from '@/data/demo/generate';
import { useDemoStatus, usePreferences, useTrainingData } from '@/data/hooks';
import { updatePreferences } from '@/data/repositories/meta';
import { getStorageState, requestPersistentStorage, type StorageState } from '@/data/storage';
import { formatShortDate, toDateKey } from '@/lib/dates';
import { formatClock, spokenDuration } from '@/lib/format';
import { Sheet } from '@/components/ui/Sheet';
import { DurationPicker } from '@/components/ui/DurationPicker';

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex max-w-2xl flex-col gap-7">
        <AppearanceSection />
        <RestSection />
        <WorkoutSection />
        <RemindersSection />
        <ExportSection />
        <InstallSection />
        <StorageSection />
        <DemoSection />
        {import.meta.env.DEV ? <DeveloperSection /> : null}
      </div>
    </>
  );
}

function AppearanceSection() {
  const { preference, setPreference } = useTheme();
  const prefs = usePreferences();
  const toast = useToast();
  return (
    <Panel title="Appearance and units">
      <PanelRow title="Theme" detail="System follows your phone or computer setting." stack>
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
      </PanelRow>
      <PanelRow
        title="Weight"
        detail="Changes how weights are shown. Your logged numbers are never altered."
        stack
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
      </PanelRow>
    </Panel>
  );
}

/** Rest lengths, to the second, saved to the account so they follow you between devices. */
function RestSection() {
  const prefs = usePreferences();
  const [editing, setEditing] = useState<'default' | 'change' | null>(null);
  const change = prefs.exerciseChangeRestSeconds;
  return (
    <Panel
      title="Rest"
      footer="Each exercise in a routine can have its own rest; the default is used where it has none."
    >
      <PanelRow title="Start rest automatically" detail="When you tick a set done.">
        <Switch
          label="Start rest automatically"
          checked={prefs.autoStartRest}
          onChange={(v) => void updatePreferences(db, { autoStartRest: v })}
        />
      </PanelRow>
      <PanelRow
        title="Default rest"
        detail="Research supports 90 to 120 seconds between hard sets."
      >
        <button
          type="button"
          onClick={() => setEditing('default')}
          aria-label={`Default rest, ${spokenDuration(prefs.defaultRestSeconds)}. Change`}
          className="tabular h-10 rounded-full bg-surface-2 px-4 font-display text-[1.05rem] font-semibold"
        >
          {formatClock(prefs.defaultRestSeconds)}
        </button>
      </PanelRow>
      <PanelRow
        title="Rest between exercises"
        detail={
          change === null
            ? 'Off: the exercise you just finished decides.'
            : 'Used after the last set of an exercise, before the next one.'
        }
      >
        <div className="flex items-center gap-2">
          {change !== null ? (
            <button
              type="button"
              onClick={() => setEditing('change')}
              aria-label={`Rest between exercises, ${spokenDuration(change)}. Change`}
              className="tabular h-10 rounded-full bg-surface-2 px-4 font-display text-[1.05rem] font-semibold"
            >
              {formatClock(change)}
            </button>
          ) : null}
          <Switch
            label="Rest between exercises"
            checked={change !== null}
            onChange={(on) =>
              void updatePreferences(db, { exerciseChangeRestSeconds: on ? 180 : null })
            }
          />
        </div>
      </PanelRow>
      {editing ? (
        <RestLengthSheet
          title={editing === 'default' ? 'Default rest' : 'Rest between exercises'}
          initial={editing === 'default' ? prefs.defaultRestSeconds : (change ?? 180)}
          min={editing === 'default' ? 15 : 0}
          onSave={(sec) =>
            void updatePreferences(
              db,
              editing === 'default'
                ? { defaultRestSeconds: sec }
                : { exerciseChangeRestSeconds: sec },
            )
          }
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Panel>
  );
}

function RestLengthSheet({
  title,
  initial,
  min,
  onSave,
  onClose,
}: {
  title: string;
  initial: number;
  min: number;
  onSave: (seconds: number) => void;
  onClose: () => void;
}) {
  const [sec, setSec] = useState(initial);
  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      footer={
        <Button
          block
          onClick={() => {
            onSave(sec);
            onClose();
          }}
        >
          Save {formatClock(sec)}
        </Button>
      }
    >
      <DurationPicker label={title} value={sec} min={min} onChange={setSec} />
    </Sheet>
  );
}

function WorkoutSection() {
  const device = useDeviceSettings();
  return (
    <Panel title="During a workout" footer="These apply to this device only.">
      <PanelRow title="Sound when rest ends" detail="Two short tones while the app is open.">
        <Switch
          label="Sound when rest ends"
          checked={device.restSound}
          onChange={(v) => setDeviceSetting('restSound', v)}
        />
      </PanelRow>
      <PanelRow title="Vibrate when rest ends" detail="On phones that support it.">
        <Switch
          label="Vibrate when rest ends"
          checked={device.restVibrate}
          onChange={(v) => setDeviceSetting('restVibrate', v)}
        />
      </PanelRow>
      <PanelRow title="Keep the screen on" detail="While a workout is open and not paused.">
        <Switch
          label="Keep the screen on"
          checked={device.keepAwake}
          onChange={(v) => setDeviceSetting('keepAwake', v)}
        />
      </PanelRow>
    </Panel>
  );
}

function RemindersSection() {
  const training = useTrainingData();
  const toast = useToast();
  const [time, setTime] = useState('18:00');
  const data = training.data;
  const routine = data ? activeRoutine(data.routines) : null;
  const days = routine && data ? daysForRoutine(routine, data.routineDays) : [];
  const planned = days.filter((d) => d.weekdays.length > 0);
  return (
    <Panel
      title="Training reminders"
      footer="Your phone's calendar reminds you, even when the app is closed. Open the file and add it to your calendar."
    >
      {planned.length === 0 ? (
        <p className="py-3.5 text-sm text-muted">
          Set training days on your active routine first, and they can go in your calendar.
        </p>
      ) : (
        <PanelRow
          title={`${routine!.name} in your calendar`}
          detail={`${planned.length} training ${planned.length === 1 ? 'day' : 'days'}, reminder 30 minutes before.`}
          stack
        >
          <div className="flex items-center gap-2">
            <input
              type="time"
              aria-label="Training time"
              value={time}
              onChange={(e) => setTime(e.target.value || '18:00')}
              className="h-9 rounded-xl bg-surface-2 px-2.5 text-sm"
            />
            <Button
              size="sm"
              variant="secondary"
              icon={<CalendarPlus className="size-4" aria-hidden />}
              onClick={() => {
                downloadText(
                  trainingCalendar({
                    routineName: routine!.name,
                    days: planned,
                    time,
                    minutes: data?.profile?.sessionMinutes ?? 60,
                    remindBefore: 30,
                  }),
                  'training-days.ics',
                  'text/calendar',
                );
                toast('Calendar file downloaded');
              }}
            >
              Add to calendar
            </Button>
          </div>
        </PanelRow>
      )}
    </Panel>
  );
}

function ExportSection() {
  const training = useTrainingData();
  const data = training.data;
  const date = toDateKey(new Date());
  return (
    <Panel
      title="Your data"
      footer="CSV files open in Excel, Google Sheets and Numbers. Weights are in kg."
    >
      <PanelRow title="Workouts" detail="Every completed set, one per row.">
        <Button
          size="sm"
          variant="secondary"
          disabled={!data}
          icon={<Download className="size-4" aria-hidden />}
          onClick={() => data && downloadText(setsCsv(data), `workouts-${date}.csv`)}
        >
          Export
        </Button>
      </PanelRow>
      <PanelRow title="Body" detail="Weigh-ins and measurements.">
        <Button
          size="sm"
          variant="secondary"
          disabled={!data}
          icon={<Download className="size-4" aria-hidden />}
          onClick={() => data && downloadText(bodyCsv(data), `body-${date}.csv`)}
        >
          Export
        </Button>
      </PanelRow>
    </Panel>
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
    <Panel title="Install the app">
      <PanelRow title={installed ? 'Installed' : 'Home screen'} detail={detail}>
        {installPrompt && !installed ? (
          <Button size="sm" variant="secondary" onClick={() => void promptInstall()}>
            Install
          </Button>
        ) : null}
      </PanelRow>
    </Panel>
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
    <Panel
      title="Data on this device"
      footer={
        signedIn
          ? 'Everything is saved on this device first, so the app works offline, and then synced to your account.'
          : 'Workouts are saved on this device. Without an account, this device holds your only copy.'
      }
    >
      <div className="py-4">
        <SyncSummary />
        {account.status === 'signedOut' ? (
          <ButtonLink to="/sign-in?next=/account" size="sm" className="mt-3">
            Sign in to back up
          </ButtonLink>
        ) : null}
      </div>
      <PanelRow title="Storage protection" detail={label}>
        {state === 'best-effort' ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => setState(await requestPersistentStorage())}
          >
            Protect my data
          </Button>
        ) : null}
      </PanelRow>
    </Panel>
  );
}

function DemoSection() {
  const account = useAccount();
  if (account.status === 'signedIn') {
    return (
      <Panel title="Demo data" id="demo-data">
        <p className="py-3.5 text-sm text-muted">
          Your account only ever holds your own training, so demo data is not available while you
          are signed in. Sign out to explore the demo on this device.
        </p>
      </Panel>
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
    <Panel
      title="Demo data"
      id="demo-data"
      footer={`A fictional athlete, Arjun, with ${DEMO_HISTORY_DAYS / 7} weeks of Push Pull Legs training. The last ${DEMO_FEATURED_DAYS} days are the featured week. Demo records are kept separate and clearing them never touches your own workouts.`}
    >
      <div className="py-3.5 text-sm" role="status">
        {demo.status === 'loading'
          ? 'Checking...'
          : loaded
            ? `Loaded: ${demo.data?.workouts ?? 0} workouts${demo.data?.loadedAt ? `, generated ${formatShortDate(new Date(demo.data.loadedAt))}` : ''}.`
            : 'Not loaded.'}
      </div>
      <div className="flex flex-wrap gap-2 py-3.5">
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
    </Panel>
  );
}

/** Development builds only: preview each access state. Removed from production builds. */
function DeveloperSection() {
  const value = useSyncExternalStore(onDevEntitlementChange, getDevEntitlement);
  return (
    <Panel
      title="Developer"
      footer="Only in development builds. Changes what this browser tab shows, never the account."
    >
      <PanelRow title="Access state" detail="Preview trial and Pro screens.">
        <select
          aria-label="Access state"
          className="h-10 rounded-xl bg-surface-2 px-3"
          value={value}
          onChange={(e) => setDevEntitlement(e.target.value as DevEntitlementState)}
        >
          {DEV_STATES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </PanelRow>
    </Panel>
  );
}
