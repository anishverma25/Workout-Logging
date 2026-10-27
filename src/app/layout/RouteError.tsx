import { isRouteErrorResponse, useRouteError } from 'react-router';
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { IconTile, PrimaryButton } from '@/components/kit';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { isChunkLoadError, reloadOnceForNewVersion } from './chunkReload';

/**
 * Shown when a screen crashes. Says plainly that logged data is safe (it lives in the
 * on-device database, not in the screen) and offers a way back. Drawn like the kit's
 * ErrorState: neutral icon tile, title, Body --text-2, then the actions.
 */
export function RouteError() {
  const error = useRouteError();
  const [reloading] = useState(() => isChunkLoadError(error) && reloadOnceForNewVersion());
  if (reloading)
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg px-6 text-center" aria-busy>
        <p className="type-body text-text-2">Opening the new version of Overload...</p>
      </main>
    );
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error';
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-100 flex-col justify-center gap-6 px-4 pt-safe pb-safe tab:px-6">
      <IconTile icon={<AlertTriangle />} />
      <div>
        <h1 className="type-title text-text-1 [text-wrap:balance]">
          This screen ran into a problem
        </h1>
        <p className="type-body mt-2 text-text-2 [text-wrap:balance]">
          Your workouts are saved on this device and were not affected. Reloading usually fixes it.
          If it keeps happening, tell us what you tapped just before.
        </p>
        <p className="type-meta mt-3 font-mono break-words text-text-2">{message}</p>
      </div>
      <div className="flex flex-col gap-2">
        <PrimaryButton block onClick={() => window.location.reload()}>
          Reload
        </PrimaryButton>
        <a href="/" className={buttonClasses({ variant: 'secondary', size: 'lg', block: true })}>
          Go to Home
        </a>
        <a
          href={`/feedback?from=error&tag=bug&screen=${encodeURIComponent(window.location.pathname)}`}
          className="pressable tap-target type-body mx-auto inline-flex items-center rounded-tile px-2 font-medium text-text-1 underline-offset-4 hover:underline"
        >
          Report this problem
        </a>
      </div>
    </main>
  );
}
