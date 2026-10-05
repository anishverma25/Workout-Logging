import { isRouteErrorResponse, useRouteError } from 'react-router';
import { AlertTriangle } from 'lucide-react';

/**
 * Shown when a screen crashes. Says plainly that logged data is safe (it lives in the
 * on-device database, not in the screen) and offers a way back.
 */
export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error';
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-6 py-10">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <AlertTriangle className="size-6" aria-hidden />
      </div>
      <div>
        <h1 className="font-display text-[2rem] font-bold leading-tight">
          This screen ran into a problem
        </h1>
        <p className="mt-2 text-muted">
          Your workouts are saved on this device and were not affected. Reloading usually fixes it.
          If it keeps happening, tell us what you tapped just before.
        </p>
        <p className="mt-3 break-words font-mono text-xs text-faint">{message}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-12 rounded-[var(--radius-control)] bg-accent px-5 font-semibold text-accent-ink"
        >
          Reload
        </button>
        <a
          href="/"
          className="inline-flex h-12 items-center rounded-[var(--radius-control)] border border-line bg-surface-2 px-5 font-semibold"
        >
          Go to Home
        </a>
      </div>
    </main>
  );
}
