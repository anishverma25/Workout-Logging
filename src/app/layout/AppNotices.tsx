import { RefreshCw, WifiOff } from 'lucide-react';
import { applyUpdate, useOnline, usePwa } from '../pwa';

/** App-wide notices: offline state and a new version waiting. Quiet, never blocking. */
export function AppNotices() {
  const online = useOnline();
  const { updateReady } = usePwa();
  if (online && !updateReady) return null;
  return (
    <div className="flex flex-col gap-2 pt-3">
      {!online ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm text-muted"
        >
          <WifiOff className="size-4 shrink-0 text-faint" aria-hidden />
          Offline. Everything you log is saved on this device.
        </p>
      ) : null}
      {updateReady ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-sm"
        >
          <span>A new version of the app is ready.</span>
          <button
            type="button"
            onClick={applyUpdate}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 font-semibold text-accent-text hover:bg-surface-3"
          >
            <RefreshCw className="size-4" aria-hidden /> Reload
          </button>
        </div>
      ) : null}
    </div>
  );
}
